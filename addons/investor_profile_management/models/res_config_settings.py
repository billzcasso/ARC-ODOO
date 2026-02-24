import logging
from datetime import timedelta

import requests

from odoo import _, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    ekyc_base_url = fields.Char(
        string='VNPT eKYC Base URL',
        default='https://api.idg.vnpt.vn',
        help='Base URL cho VNPT eKYC API. Mặc định: https://api.idg.vnpt.vn'
    )
    ekyc_token_endpoint = fields.Char(
        string='Token Endpoint',
        help='Endpoint dùng để lấy access token tự động từ VNPT.'
    )
    ekyc_token_id = fields.Char(string='Token ID')
    ekyc_token_key = fields.Char(string='Token Key', password=True)
    ekyc_access_token = fields.Char(string='Access Token', readonly=True)
    ekyc_token_expiration = fields.Datetime(string='Access Token hết hạn', readonly=True)
    ekyc_public_key_ca = fields.Text(
        string='Public Key CA',
        help='Public Key CA để xác thực chứng chỉ SSL của VNPT eKYC'
    )

    PARAMS = {
        'ekyc_base_url': 'investor_profile_management.ekyc_base_url',
        'ekyc_token_endpoint': 'investor_profile_management.ekyc_token_endpoint',
        'ekyc_token_id': 'investor_profile_management.ekyc_token_id',
        'ekyc_token_key': 'investor_profile_management.ekyc_token_key',
        'ekyc_access_token': 'investor_profile_management.ekyc_access_token',
        'ekyc_token_expiration': 'investor_profile_management.ekyc_token_expiration',
        'ekyc_public_key_ca': 'investor_profile_management.ekyc_public_key_ca',
    }

    def _get_param(self, key, default=''):
        return self.env['ir.config_parameter'].sudo().get_param(self.PARAMS[key], default)

    def _set_param(self, key, value):
        self.env['ir.config_parameter'].sudo().set_param(self.PARAMS[key], value or '')

    def get_values(self):
        res = super().get_values()
        
        # Parse datetime from config_parameter
        ekyc_token_expiration = False
        token_exp_str = self._get_param('ekyc_token_expiration')
        if token_exp_str:
            try:
                ekyc_token_expiration = fields.Datetime.from_string(token_exp_str)
            except (ValueError, TypeError):
                ekyc_token_expiration = False
        
        res.update({
            'ekyc_base_url': self._get_param('ekyc_base_url'),
            'ekyc_token_endpoint': self._get_param('ekyc_token_endpoint'),
            'ekyc_token_id': self._get_param('ekyc_token_id'),
            'ekyc_token_key': self._get_param('ekyc_token_key'),
            'ekyc_access_token': self._get_param('ekyc_access_token'),
            'ekyc_token_expiration': ekyc_token_expiration,
            'ekyc_public_key_ca': self._get_param('ekyc_public_key_ca'),
        })
        return res

    def set_values(self):
        super().set_values()
        self._set_param('ekyc_base_url', self.ekyc_base_url)
        self._set_param('ekyc_token_endpoint', self.ekyc_token_endpoint)
        self._set_param('ekyc_token_id', self.ekyc_token_id)
        self._set_param('ekyc_token_key', self.ekyc_token_key)
        self._set_param('ekyc_public_key_ca', self.ekyc_public_key_ca)
        # Access token & expiration chỉ set khi tạo mới
        if self.ekyc_access_token:
            self._set_param('ekyc_access_token', self.ekyc_access_token)
        if self.ekyc_token_expiration:
            self._set_param('ekyc_token_expiration', self.ekyc_token_expiration)

    def action_generate_ekyc_token(self):
        self.ensure_one()

        base_url = self.ekyc_base_url or self._get_param('ekyc_base_url')
        token_endpoint = self.ekyc_token_endpoint or self._get_param('ekyc_token_endpoint')
        token_id = self.ekyc_token_id or self._get_param('ekyc_token_id')
        token_key = self.ekyc_token_key or self._get_param('ekyc_token_key')

        if not token_id or not token_key:
            raise UserError(_('Vui lòng nhập Token ID và Token Key.'))

        if not token_endpoint:
            if not base_url:
                raise UserError(_('Vui lòng cấu hình Base URL hoặc Token Endpoint.'))
            token_endpoint = base_url.rstrip('/') + '/oauth/token'

        payload = {
            'tokenId': token_id,
            'tokenKey': token_key,
        }

        try:
            response = requests.post(token_endpoint, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json() or {}
        except Exception as exc:
            _logger.exception('Unable to fetch VNPT access token: %s', exc)
            raise UserError(_('Không thể gọi API lấy access token: %s') % exc)

        token = (
            data.get('access_token')
            or data.get('accessToken')
            or data.get('token')
            or data.get('data', {}).get('access_token')
            or data.get('data', {}).get('accessToken')
        )

        if not token:
            raise UserError(_('Phản hồi không có access token: %s') % data)

        expires_in = (
            data.get('expires_in')
            or data.get('expire_in')
            or data.get('expiresIn')
            or data.get('data', {}).get('expires_in')
        )

        expiration_dt = fields.Datetime.now()
        if expires_in:
            try:
                expiration_dt += timedelta(seconds=int(expires_in))
            except Exception:
                expiration_dt += timedelta(hours=8)
        else:
            expiration_dt += timedelta(hours=8)

        expiration_str = fields.Datetime.to_string(expiration_dt)

        self.ekyc_access_token = token
        self.ekyc_token_expiration = expiration_dt

        self._set_param('ekyc_access_token', token)
        self._set_param('ekyc_token_expiration', expiration_str)

        message = _('Đã lấy access token mới. Hết hạn vào: %s') % expiration_dt
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {'title': _('VNPT eKYC'), 'message': message, 'type': 'success'},
        }

    def action_update_ekyc_tokens(self):
        """Auto-update VNPT eKYC tokens from system parameters"""
        self.ensure_one()
        
        # Token values from config parameter
        params = self.env['ir.config_parameter'].sudo()
        TOKEN_ID = params.get_param('investor_profile_management.ekyc_token_id', '')
        TOKEN_KEY = params.get_param('investor_profile_management.ekyc_token_key', '')
        ACCESS_TOKEN = params.get_param('investor_profile_management.ekyc_access_token', '')
        PUBLIC_KEY_CA = params.get_param('investor_profile_management.ekyc_public_key_ca', '')
        
        if not TOKEN_ID or not TOKEN_KEY:
            raise UserError(_('Cấu hình mặc định chưa được thiết lập trong System Parameters (ir.config_parameter).'))
        
        # Update tokens
        self.ekyc_token_id = TOKEN_ID
        self.ekyc_token_key = TOKEN_KEY
        self.ekyc_access_token = ACCESS_TOKEN
        self.ekyc_public_key_ca = PUBLIC_KEY_CA
        
        # Set expiration (8 hours from now)
        expiration_dt = fields.Datetime.now() + timedelta(hours=8)
        self.ekyc_token_expiration = expiration_dt
        
        # Save to config
        self.set_values()
        
        message = _('Đã cập nhật tokens VNPT eKYC thành công. Access token hết hạn vào: %s') % expiration_dt
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {'title': _('VNPT eKYC'), 'message': message, 'type': 'success'},
        }

    def action_create_sample_api_records(self):
        """Create sample API records for testing"""
        self.ensure_one()
        
        api_record_model = self.env['api.record']
        
        # Sample records
        samples = [
            {
                'endpoint': 'https://api.idg.vnpt.vn/file-service/v1/addFile',
                'method': 'POST',
                'api_type': 'ekyc',
                'request_headers': {'Token-id': '4454b0b5-cb14-62fa-e063-62199f0ab40b', 'Authorization': 'Bearer ...'},
                'request_data': {'title': 'CCCD mặt trước', 'description': 'OCR front ID'},
                'response_status': 200,
                'response_data': {'message': 'IDG-00000000', 'object': {'hash': 'idg-xxx-xxx-xxx'}},
                'status': 'success',
                'duration_ms': 1250.5,
            },
            {
                'endpoint': 'https://api.idg.vnpt.vn/ai/v1/ocr/id/front',
                'method': 'POST',
                'api_type': 'ekyc',
                'request_headers': {'Token-id': '4454b0b5-cb14-62fa-e063-62199f0ab40b', 'Content-Type': 'application/json'},
                'request_data': {'img_front': 'idg-xxx-xxx-xxx', 'client_session': 'WEB_web_browser_Device_1.0.0_xxx_1234567890', 'type': -1},
                'response_status': 200,
                'response_data': {'message': 'IDG-00000000', 'object': {'name': 'NGUYỄN VĂN A', 'id': '012345678'}},
                'status': 'success',
                'duration_ms': 2340.2,
            },
            {
                'endpoint': 'https://api.idg.vnpt.vn/ai/v1/ocr/id/back',
                'method': 'POST',
                'api_type': 'ekyc',
                'request_headers': {'Token-id': '4454b0b5-cb14-62fa-e063-62199f0ab40b', 'Content-Type': 'application/json'},
                'request_data': {'img_back': 'idg-xxx-xxx-xxx', 'client_session': 'WEB_web_browser_Device_1.0.0_xxx_1234567890'},
                'response_status': 200,
                'response_data': {'message': 'IDG-00000000', 'object': {'issue_date': '01/01/2020', 'issue_place': 'Hà Nội'}},
                'status': 'success',
                'duration_ms': 1890.7,
            },
            {
                'endpoint': 'https://api.idg.vnpt.vn/ai/v1/face/compare',
                'method': 'POST',
                'api_type': 'ekyc',
                'request_headers': {'Token-id': '4454b0b5-cb14-62fa-e063-62199f0ab40b', 'Content-Type': 'application/json'},
                'request_data': {'img_front': 'idg-xxx-xxx-xxx', 'img_face': 'idg-yyy-yyy-yyy'},
                'response_status': 200,
                'response_data': {'message': 'IDG-00000000', 'object': {'result': 'Khuôn mặt khớp 99.7%', 'msg': 'MATCH', 'prob': 99.7}},
                'status': 'success',
                'duration_ms': 1567.3,
            },
            {
                'endpoint': 'https://api.idg.vnpt.vn/ai/v1/ocr/id/front',
                'method': 'POST',
                'api_type': 'ekyc',
                'request_headers': {'Token-id': '4454b0b5-cb14-62fa-e063-62199f0ab40b', 'Content-Type': 'application/json'},
                'request_data': {'img_front': 'invalid-hash'},
                'response_status': 404,
                'response_data': {'status': 'Not Found', 'message': 'IDG-00010102', 'errors': ['File not found']},
                'status': 'error',
                'error_message': 'File not found',
                'duration_ms': 450.1,
            },
        ]
        
        created_count = 0
        for sample in samples:
            try:
                api_record_model.create_record(
                    endpoint=sample['endpoint'],
                    method=sample['method'],
                    request_headers=sample.get('request_headers'),
                    request_data=sample.get('request_data'),
                    response_status=sample.get('response_status'),
                    response_data=sample.get('response_data'),
                    status=sample.get('status', 'success'),
                    error_message=sample.get('error_message'),
                    duration_ms=sample.get('duration_ms'),
                    api_type=sample.get('api_type', 'ekyc'),
                )
                created_count += 1
            except Exception as e:
                _logger.exception('Failed to create sample API record: %s', e)
        
        message = _('Đã tạo %d bản ghi API mẫu thành công.') % created_count
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {'title': _('API Records'), 'message': message, 'type': 'success'},
        }



