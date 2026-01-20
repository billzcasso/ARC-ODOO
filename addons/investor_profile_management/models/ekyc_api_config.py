from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging
from datetime import timedelta
import requests

_logger = logging.getLogger(__name__)


class EKYCApiConfig(models.Model):
    """Configuration for VNPT eKYC API"""
    _name = 'ekyc.api.config'
    _description = 'VNPT eKYC API Configuration'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'name'

    name = fields.Char('Configuration Name', required=True, default='Default Configuration')
    
    # API Credentials
    token_id = fields.Char('Token ID', required=True)
    token_key = fields.Char('Token Key', required=True, password=True)
    access_token = fields.Char('Access Token', readonly=True, password=True)
    public_key_ca = fields.Text('Public Key CA', help='Public Key CA để xác thực chứng chỉ SSL')
    
    # API URLs
    base_url = fields.Char('Base URL', required=True, default='https://api.idg.vnpt.vn')
    token_endpoint = fields.Char('Token Endpoint', help='Endpoint để lấy access token. Nếu để trống sẽ dùng base_url/oauth/token')
    
    # Status
    is_active = fields.Boolean('Is Active', default=True)
    token_expiration = fields.Datetime('Token Expiration', readonly=True)
    last_sync_date = fields.Datetime('Last Sync Date', readonly=True)
    last_sync_status = fields.Selection([
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('not_synced', 'Not Synced')
    ], string='Last Sync Status', default='not_synced', readonly=True)
    
    # Statistics
    total_api_calls = fields.Integer('Total API Calls', compute='_compute_statistics', readonly=True)
    success_calls = fields.Integer('Success Calls', compute='_compute_statistics', readonly=True)
    failed_calls = fields.Integer('Failed Calls', compute='_compute_statistics', readonly=True)
    last_api_call_date = fields.Datetime('Last API Call Date', compute='_compute_statistics', readonly=True)

    @api.depends('name')
    def _compute_statistics(self):
        """Compute statistics from API records"""
        for record in self:
            api_records = self.env['api.record'].search([
                ('api_type', '=', 'ekyc')
            ])
            record.total_api_calls = len(api_records)
            record.success_calls = len(api_records.filtered(lambda r: r.status == 'success'))
            record.failed_calls = len(api_records.filtered(lambda r: r.status == 'error'))
            last_record = api_records.sorted('request_timestamp', reverse=True)[:1]
            record.last_api_call_date = last_record.request_timestamp if last_record else False

    @api.model
    def get_config(self):
        """Get active configuration"""
        config = self.search([('is_active', '=', True)], limit=1)
        if not config:
            # Create default if not exists
            config = self.create({
                'name': 'Default Configuration',
                'is_active': True,
            })
        return config

    def action_generate_token(self):
        """
        Generate new access token from VNPT OAuth API
        
        LƯU Ý: Nếu gặp lỗi 500, vui lòng:
        1. Vào portal VNPT eKYC (https://ekyc.vnpt.vn)
        2. Lấy access token mới
        3. Paste vào trường Access Token bên dưới
        4. Lưu lại
        """
        self.ensure_one()
        
        if not self.token_id or not self.token_key:
            raise UserError(_('Vui lòng nhập Token ID và Token Key.'))
        
        token_endpoint = self.token_endpoint
        if not token_endpoint:
            if not self.base_url:
                raise UserError(_('Vui lòng cấu hình Base URL hoặc Token Endpoint.'))
            token_endpoint = self.base_url.rstrip('/') + '/oauth/token'
        
        payload = {
            'tokenId': self.token_id,
            'tokenKey': self.token_key,
        }
        
        try:
            response = requests.post(token_endpoint, json=payload, timeout=30)
            
            # Log response details before raising error
            if not response.ok:
                try:
                    error_detail = response.json()
                    _logger.error('VNPT OAuth error response (JSON): %s', error_detail)
                except:
                    error_detail = response.text
                    _logger.error('VNPT OAuth error response (Text): %s', error_detail)
                _logger.error('VNPT OAuth status code: %s, URL: %s', response.status_code, token_endpoint)
            
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
            or 8 * 3600
        )
        
        expiration_dt = fields.Datetime.now() + timedelta(seconds=int(expires_in))
        
        self.write({
            'access_token': token,
            'token_expiration': expiration_dt,
            'last_sync_date': fields.Datetime.now(),
            'last_sync_status': 'success',
        })
        
        message = _('Đã lấy access token mới. Hết hạn vào: %s') % expiration_dt
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {'title': _('VNPT eKYC'), 'message': message, 'type': 'success'},
        }

    def action_update_from_default(self):
        """Update tokens from default values"""
        self.ensure_one()
        
        TOKEN_ID = '4454b0b5-cb14-62fa-e063-62199f0ab40b'
        TOKEN_KEY = 'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALlzLZ/MkL89AA1a34lamXMce/GLbfCdltABRhpPjve+v5wy9amxCY0nyuGnLdMfOiVqCmTwUaRp5jKnlChV9NECAwEAAQ=='
        ACCESS_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0cmFuc2FjdGlvbl9pZCI6IjE4ZDExYWQzLWI0MzUtNGJiZS1iY2Q1LTVkMDg5ZDYxMzlhNCIsInN1YiI6ImZhNzhmNWQ5LWM5MTYtMTFmMC1hNzY5LTg1NjY4N2U5ODMwYSIsImF1ZCI6WyJyZXN0c2VydmljZSJdLCJ1c2VyX25hbWUiOiJuaGFudnYyazRAZ21haWwuY29tIiwic2NvcGUiOlsicmVhZCJdLCJpc3MiOiJodHRwczovL2xvY2FsaG9zdCIsIm5hbWUiOiJuaGFudnYyazRAZ21haWwuY29tIiwiZXhwIjoxNzY0MzE0OTExLCJ1dWlkX2FjY291bnQiOiJmYTc4ZjVkOS1jOTE2LTExZjAtYTc2OS04NTY2ODdlOTgzMGEiLCJhdXRob3JpdGllcyI6WyJVU0VSIl0sImp0aSI6IjBkNDkxZmZmLWY3ZTUtNGU4ZS05NTQxLTZiOWZmNzFhZGExYiIsImNsaWVudF9pZCI6ImNsaWVudGFwcCJ9.RpKpFlNky_KVOsWPx4EEWFdvWHUrJdnqsT6Ja9jeE8hrKRzwqfBEomKsu9ekwepIBZVeabtawQ7P0K-5oDHaOf1C-PSvnaYRXjgJWgnOlOUfTA2OLBsaHwuuYRH9XK228LdgV82DzvxY3_PbmGkXJxLbwgCQMXTVE5A98Y7jE01pktZbKjBYUjVEQIK2rL-51klhLKZ0WKt2RkX8BLTGu0G4C5YqbAPZUHt3bOByyqYzFg4qJqIOq-wo2XD47OnJbYdF5DTgdmE6YRoYhU6Id1-XPUl3H48Ds2U6OYjLDZJKBATi_k01Cs56X-SQfTX3aChme2HLsJYxwdrs4XeUHQ'
        PUBLIC_KEY_CA = 'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAIMTEFLtDPRRl9oJw8li/MnajhlrTyQN6b8N34g9zwYPvfEutL0ClPFxaZJp89KhxEBLdBoJb/5Wo+ZhMdDZI58CAwEAAQ=='
        
        expiration_dt = fields.Datetime.now() + timedelta(hours=8)
        
        self.write({
            'token_id': TOKEN_ID,
            'token_key': TOKEN_KEY,
            'access_token': ACCESS_TOKEN,
            'public_key_ca': PUBLIC_KEY_CA,
            'token_expiration': expiration_dt,
        })
        
        # Also update ir.config_parameter
        params = self.env['ir.config_parameter'].sudo()
        params.set_param('investor_profile_management.ekyc_token_id', TOKEN_ID)
        params.set_param('investor_profile_management.ekyc_token_key', TOKEN_KEY)
        params.set_param('investor_profile_management.ekyc_access_token', ACCESS_TOKEN)
        params.set_param('investor_profile_management.ekyc_public_key_ca', PUBLIC_KEY_CA)
        params.set_param('investor_profile_management.ekyc_token_expiration', fields.Datetime.to_string(expiration_dt))
        
        message = _('Đã cập nhật tokens từ cấu hình mặc định. Access token hết hạn vào: %s') % expiration_dt
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {'title': _('VNPT eKYC'), 'message': message, 'type': 'success'},
        }

    def action_view_api_records(self):
        """View API records for this configuration"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('API Records'),
            'res_model': 'api.record',
            'view_mode': 'list,form',
            'domain': [('api_type', '=', 'ekyc')],
            'context': {'default_api_type': 'ekyc'},
        }

