import base64
import json
import logging
import os
import tempfile
import time
from datetime import timedelta
from io import BytesIO

import requests

from odoo import _, fields, http
from odoo.http import request

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    Image = None

_logger = logging.getLogger(__name__)


class EKYCIntegrationController(http.Controller):
    
    EKYC_BASE_URL = 'https://api.idg.vnpt.vn'
    EKYC_ENDPOINTS = {
        'upload_file': '/file-service/v1/addFile',
        'classify_id': '/ai/v1/classify/id',
        'card_liveness': '/ai/v1/card/liveness',
        'ocr_front': '/ai/v1/ocr/id/front',
        'ocr_back': '/ai/v1/ocr/id/back',
        'ocr_full': '/ai/v1/ocr/id',
        'face_compare': '/ai/v1/face/compare',
        'face_liveness': '/ai/v1/face/liveness',
        'face_mask': '/ai/v1/face/mask',
        'face_add': '/face-service/face/add',
        'face_verify': '/face-service/face/verify',
        'face_search': '/face-service/face/search',
        'face_search_k': '/face-service/face/search-k',
    }
    REQUEST_TIMEOUT = 30
    PROCESS_TIMEOUT = 60
    REQUIRED_PORTRAIT_COUNT = 7
    
    # VNPT eKYC Technical Standards
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_FORMATS = ['jpg', 'jpeg', 'png']
    
    # Minimum resolution requirements (width x height)
    MIN_ID_CARD_RESOLUTION = (600, 900)  # Minimum for ID card
    GOOD_ID_CARD_RESOLUTION = (1200, 1800)  # Good quality
    BEST_ID_CARD_RESOLUTION = (2400, 3600)  # Best quality
    
    MIN_PORTRAIT_RESOLUTION = (400, 400)  # Minimum for portrait
    GOOD_PORTRAIT_RESOLUTION = (800, 800)  # Good quality
    BEST_PORTRAIT_RESOLUTION = (1600, 1600)  # Best quality

    CONFIG_PARAMS = {
        'base_url': 'investor_profile_management.ekyc_base_url',
        'token_endpoint': 'investor_profile_management.ekyc_token_endpoint',
        'token_id': 'investor_profile_management.ekyc_token_id',
        'token_key': 'investor_profile_management.ekyc_token_key',
        'access_token': 'investor_profile_management.ekyc_access_token',
        'token_expiration': 'investor_profile_management.ekyc_token_expiration',
        'public_key_ca': 'investor_profile_management.ekyc_public_key_ca',
    }
    
    def _make_secure_response(self, data, status=200):
        """Create standardized response with security headers"""
        return request.make_response(
            json.dumps(data),
            headers=[
                ('Content-Type', 'application/json'),
                ('X-Content-Type-Options', 'nosniff'),
                ('X-Frame-Options', 'DENY')
            ],
            status=status
        )
    
    def _make_success_response(self, data, message="Success"):
        """Create standardized success response"""
        return self._make_secure_response({
            'success': True,
            'message': message,
            'data': data
        })
    
    def _make_error_response(self, error_message, status=400):
        """Create standardized error response"""
        return self._make_secure_response({
            'success': False,
            'error': error_message
        }, status)
    
    def _get_config(self):
        """Get eKYC configuration from ekyc.api.config or fallback to ir.config_parameter"""
        # Try to get from ekyc.api.config first
        ekyc_config = request.env['ekyc.api.config'].sudo().get_config()
        if ekyc_config and ekyc_config.is_active:
            return {
                'base_url': ekyc_config.base_url or self.EKYC_BASE_URL,
                'token_endpoint': ekyc_config.token_endpoint or '',
                'token_id': ekyc_config.token_id or '',
                'token_key': ekyc_config.token_key or '',
                'access_token': ekyc_config.access_token or '',
                'token_expiration': fields.Datetime.to_string(ekyc_config.token_expiration) if ekyc_config.token_expiration else '',
                'public_key_ca': ekyc_config.public_key_ca or '',
            }
        
        # Fallback to ir.config_parameter
        params = request.env['ir.config_parameter'].sudo()
        config = {key: params.get_param(param_key) for key, param_key in self.CONFIG_PARAMS.items()}
        if not config.get('base_url'):
            config['base_url'] = self.EKYC_BASE_URL
        return config

    def _store_token(self, token, expiration_dt):
        """Store token in both ekyc.api.config and ir.config_parameter"""
        # Update ekyc.api.config
        ekyc_config = request.env['ekyc.api.config'].sudo().get_config()
        if ekyc_config:
            ekyc_config.write({
                'access_token': token or '',
                'token_expiration': expiration_dt if expiration_dt else False,
                'last_sync_date': fields.Datetime.now(),
                'last_sync_status': 'success',
            })
        
        # Also update ir.config_parameter for backward compatibility
        params = request.env['ir.config_parameter'].sudo()
        params.set_param(self.CONFIG_PARAMS['access_token'], token or '')
        params.set_param(
            self.CONFIG_PARAMS['token_expiration'],
            fields.Datetime.to_string(expiration_dt) if expiration_dt else ''
        )

    def _refresh_access_token(self, config):
        token_id = config.get('token_id')
        token_key = config.get('token_key')
        if not token_id or not token_key:
            _logger.warning('VNPT token id/key chưa được cấu hình. Bỏ qua việc làm mới token.')
            return config.get('access_token')

        token_endpoint = config.get('token_endpoint')
        base_url = (config.get('base_url') or self.EKYC_BASE_URL).rstrip('/')
        if not token_endpoint:
            token_endpoint = f"{base_url}/oauth/token"

        payload = {
            'tokenId': token_id,
            'tokenKey': token_key,
        }

        _logger.info('Yêu cầu access token mới từ %s', token_endpoint)
        _logger.debug('OAuth payload: tokenId=%s...', token_id[:20] if token_id else 'None')
        try:
            resp = requests.post(token_endpoint, json=payload, timeout=self.REQUEST_TIMEOUT)
            
            # Log response details before raising error
            if not resp.ok:
                try:
                    error_detail = resp.json()
                    _logger.error('VNPT OAuth error response (JSON): %s', error_detail)
                except:
                    error_detail = resp.text
                    _logger.error('VNPT OAuth error response (Text): %s', error_detail)
                _logger.error('VNPT OAuth status code: %s, URL: %s', resp.status_code, token_endpoint)
            
            resp.raise_for_status()
            data = resp.json() or {}
        except Exception as exc:
            _logger.exception('Không thể gọi API token VNPT: %s', exc)
            raise Exception(_('Không thể lấy Access Token từ VNPT eKYC: %s') % exc)

        token = (
            data.get('access_token')
            or data.get('accessToken')
            or data.get('token')
            or data.get('data', {}).get('access_token')
            or data.get('data', {}).get('accessToken')
        )
        if not token:
            raise Exception(_('Phản hồi token không hợp lệ: %s') % data)

        expires_in = (
            data.get('expires_in')
            or data.get('expire_in')
            or data.get('expiresIn')
            or data.get('data', {}).get('expires_in')
            or 8 * 3600
        )

        expiration_dt = fields.Datetime.now() + timedelta(seconds=int(expires_in))
        self._store_token(token, expiration_dt)
        config['access_token'] = token
        config['token_expiration'] = fields.Datetime.to_string(expiration_dt)
        return token

    def _ensure_access_token(self, config):
        """
        Lấy access token từ config.
        KHÔNG tự động refresh token vì VNPT OAuth API đang lỗi 500.
        Admin cần cập nhật token thủ công từ portal VNPT.
        """
        token = config.get('access_token')
        expiration = config.get('token_expiration')
        
        # Kiểm tra token có tồn tại không
        if not token:
            _logger.error('Access token chưa được cấu hình. Vui lòng cập nhật từ portal VNPT.')
            raise Exception(_('Access token chưa được cấu hình. Vui lòng vào Settings → VNPT eKYC Configuration để cập nhật.'))
        
        # Kiểm tra token có hết hạn không
        if expiration:
            try:
                exp_dt = fields.Datetime.from_string(expiration)
                if exp_dt <= fields.Datetime.now():
                    _logger.warning('Access token đã hết hạn vào %s. Vui lòng cập nhật token mới từ portal VNPT.', expiration)
                    # Vẫn trả về token cũ để thử, có thể VNPT vẫn chấp nhận
                    # Nếu không được, API sẽ trả về 401 và admin sẽ biết cần cập nhật
            except Exception as e:
                _logger.warning('Không thể parse token expiration: %s', e)
        
        return token

    def _prepare_headers(self, config, content_type='application/json', include_mac=True):
        """Prepare headers for VNPT eKYC API requests"""
        headers = {
            'Content-Type': content_type,
        }
        if config.get('token_id'):
            headers['Token-id'] = config['token_id']
        if config.get('token_key'):
            headers['Token-key'] = config['token_key']
        try:
            token = self._ensure_access_token(config)
        except Exception as exc:
            _logger.warning('Không thể làm mới token VNPT eKYC: %s', exc)
            token = None
        if token:
            headers['Authorization'] = f"Bearer {token}"
        if include_mac:
            headers['mac-address'] = 'TEST1'
        return headers
    
    def _generate_client_session(self, platform='WEB', device_id=None):
        """Generate client_session string according to VNPT format"""
        import time
        import uuid
        if not device_id:
            device_id = str(uuid.uuid4())
        timestamp = int(time.time())
        # Format: <PLATFORM>_<model>_<OS>_<Device/Simulator>_<SDK version>_<Device id>_<Time stamp>
        return f"{platform}_web_browser_Device_1.0.0_{device_id}_{timestamp}"

    def _make_ekyc_request(self, endpoint, files=None, json_data=None, data=None, timeout=None, 
                          content_type='application/json', partner_id=None, investor_profile_id=None, 
                          log_api=True):
        """
        Make request to eKYC service with error handling and API logging
        
        Args:
            endpoint: API endpoint
            files: Files to upload
            json_data: JSON data to send
            data: Form data to send
            timeout: Request timeout
            content_type: Content type header
            partner_id: Related partner ID for logging
            investor_profile_id: Related investor profile ID for logging
            log_api: Whether to log this API call
        """
        config = self._get_config()
        base_url = (config.get('base_url') or self.EKYC_BASE_URL).rstrip('/')
        url = f"{base_url}{endpoint}"
        
        # For file upload, use multipart/form-data
        if files:
            content_type = None  # requests will set multipart/form-data automatically
            include_mac = False  # mac-address not needed for file upload
        else:
            include_mac = True
        
        headers = self._prepare_headers(config, content_type=content_type, include_mac=include_mac)
        
        # Prepare request data for logging
        request_start_time = time.time()
        api_record = None
        
        if log_api:
            try:
                # Create API record before request
                api_record = request.env['api.record'].sudo().create_record(
                    endpoint=url,
                    method='POST',
                    request_data=json_data if json_data else data,
                    request_headers=headers,
                    request_params=None,
                    status='pending',
                    api_type='ekyc',
                    partner_id=partner_id,
                    investor_profile_id=investor_profile_id,
                )
            except Exception as e:
                _logger.warning('Failed to create API record: %s', e)

        try:
            timeout = timeout or self.REQUEST_TIMEOUT
            _logger.info('Call VNPT eKYC: %s', url)
            
            if files:
                # File upload request
                response = requests.post(
                    url,
                    files=files,
                    data=data,
                    headers=headers,
                    timeout=timeout,
                )
            elif json_data:
                # JSON request
                response = requests.post(
                    url,
                    json=json_data,
                    headers=headers,
                    timeout=timeout,
                )
            else:
                # Form data request
                response = requests.post(
                    url,
                    data=data,
                    headers=headers,
                    timeout=timeout,
                )
            
            # Calculate duration
            duration_ms = (time.time() - request_start_time) * 1000
            
            if not response.ok:
                error_data = response.text
                try:
                    error_json = response.json()
                    error_data = error_json.get('message', error_json.get('errors', error_data))
                except:
                    pass
                _logger.error('VNPT eKYC error %s - %s', response.status_code, error_data)
                
                # Update API record with error
                if api_record and log_api:
                    try:
                        api_record.sudo().write({
                            'response_status': response.status_code,
                            'response_data': response.text[:10000],  # Limit size
                            'response_headers': json.dumps(dict(response.headers)),
                            'status': 'error',
                            'error_message': str(error_data)[:5000],  # Limit size
                            'duration_ms': duration_ms,
                            'response_timestamp': fields.Datetime.now(),
                        })
                    except Exception as e:
                        _logger.warning('Failed to update API record: %s', e)
                
                raise Exception(_('eKYC service error: %s') % response.status_code)

            # Update API record with success
            if api_record and log_api:
                try:
                    response_data = response.json() if response.text else {}
                    api_record.sudo().write({
                        'response_status': response.status_code,
                        'response_data': json.dumps(response_data, indent=2, ensure_ascii=False)[:10000],  # Limit size
                        'response_headers': json.dumps(dict(response.headers)),
                        'status': 'success',
                        'duration_ms': duration_ms,
                        'response_timestamp': fields.Datetime.now(),
                    })
                except Exception as e:
                    _logger.warning('Failed to update API record: %s', e)
            
            return response.json()
            
        except requests.exceptions.Timeout:
            duration_ms = (time.time() - request_start_time) * 1000
            _logger.exception('VNPT eKYC timeout')
            
            # Update API record with timeout
            if api_record and log_api:
                try:
                    api_record.sudo().write({
                        'status': 'timeout',
                        'error_message': 'Request timeout',
                        'duration_ms': duration_ms,
                        'response_timestamp': fields.Datetime.now(),
                    })
                except Exception as e:
                    _logger.warning('Failed to update API record: %s', e)
            
            raise Exception(_('eKYC service timeout. Vui lòng thử lại.'))
        except requests.exceptions.ConnectionError:
            duration_ms = (time.time() - request_start_time) * 1000
            _logger.exception('VNPT eKYC connection error')
            
            # Update API record with connection error
            if api_record and log_api:
                try:
                    api_record.sudo().write({
                        'status': 'error',
                        'error_message': 'Connection error',
                        'duration_ms': duration_ms,
                        'response_timestamp': fields.Datetime.now(),
                    })
                except Exception as e:
                    _logger.warning('Failed to update API record: %s', e)
            
            raise Exception(_('Không thể kết nối đến eKYC service. Vui lòng kiểm tra kết nối.'))
        except Exception as e:
            duration_ms = (time.time() - request_start_time) * 1000
            _logger.exception('Unexpected eKYC error')
            
            # Update API record with error
            if api_record and log_api:
                try:
                    api_record.sudo().write({
                        'status': 'error',
                        'error_message': str(e)[:5000],  # Limit size
                        'duration_ms': duration_ms,
                        'response_timestamp': fields.Datetime.now(),
                    })
                except Exception as ex:
                    _logger.warning('Failed to update API record: %s', ex)
            
            raise Exception(_('Lỗi xử lý eKYC: %s') % str(e))
    
    def _validate_file_format(self, filename):
        """Validate file format according to VNPT eKYC standards"""
        if not filename:
            raise ValueError('Tên file không hợp lệ')
        
        ext = filename.lower().split('.')[-1] if '.' in filename else ''
        if ext not in self.ALLOWED_FORMATS:
            raise ValueError(
                f'Định dạng file không được hỗ trợ. Chỉ chấp nhận: {", ".join(self.ALLOWED_FORMATS).upper()}. '
                f'File hiện tại: {ext.upper() if ext else "không có phần mở rộng"}'
            )
        return ext
    
    def _validate_file_size(self, file_obj):
        """Validate file size according to VNPT eKYC standards (max 5MB)"""
        # Get file size
        file_obj.seek(0, os.SEEK_END)
        file_size = file_obj.tell()
        file_obj.seek(0)  # Reset to beginning
        
        if file_size > self.MAX_FILE_SIZE:
            size_mb = file_size / (1024 * 1024)
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            raise ValueError(
                f'Kích thước file quá lớn ({size_mb:.2f}MB). '
                f'Kích thước tối đa cho phép: {max_mb}MB'
            )
        return file_size
    
    def _validate_image_resolution(self, file_obj, image_type='id_card'):
        """
        Validate image resolution according to VNPT eKYC standards
        
        Args:
            file_obj: File object
            image_type: 'id_card' or 'portrait'
        
        Returns:
            tuple: (width, height) if valid
        """
        if not PIL_AVAILABLE:
            _logger.warning('PIL/Pillow không có sẵn, bỏ qua kiểm tra độ phân giải')
            return None
        
        try:
            # Read image
            file_obj.seek(0)
            img = Image.open(BytesIO(file_obj.read()))
            file_obj.seek(0)  # Reset
            
            width, height = img.size
            
            if image_type == 'id_card':
                min_width, min_height = self.MIN_ID_CARD_RESOLUTION
                resolution_name = 'giấy tờ'
            else:  # portrait
                min_width, min_height = self.MIN_PORTRAIT_RESOLUTION
                resolution_name = 'chân dung'
            
            if width < min_width or height < min_height:
                raise ValueError(
                    f'Độ phân giải ảnh {resolution_name} không đạt yêu cầu. '
                    f'Hiện tại: {width}x{height}px. '
                    f'Tối thiểu: {min_width}x{min_height}px. '
                    f'Khuyến nghị: {self.GOOD_ID_CARD_RESOLUTION[0]}x{self.GOOD_ID_CARD_RESOLUTION[1]}px'
                )
            
            return (width, height)
            
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            _logger.warning('Không thể kiểm tra độ phân giải ảnh: %s', e)
            return None
    
    def _validate_id_card_image(self, file_obj, filename):
        """
        Validate ID card image according to VNPT eKYC technical standards
        
        Requirements:
        - Format: JPG, JPEG, PNG
        - Max size: 5MB
        - Min resolution: 600x900px
        - ID card area should be 1/3 to 4/5 of total image area
        - All 4 corners visible
        - Clear, not blurred or overexposed
        """
        # Validate format
        self._validate_file_format(filename)
        
        # Validate size
        self._validate_file_size(file_obj)
        
        # Validate resolution
        self._validate_image_resolution(file_obj, image_type='id_card')
        
        return True
    
    def _validate_portrait_image(self, file_obj, filename):
        """
        Validate portrait image according to VNPT eKYC technical standards
        
        Requirements:
        - Format: JPG, JPEG, PNG
        - Max size: 5MB
        - Min resolution: 400x400px
        - Face should be 1/4 to 4/5 of image
        - Clear, not blurred
        """
        # Validate format
        self._validate_file_format(filename)
        
        # Validate size
        self._validate_file_size(file_obj)
        
        # Validate resolution
        self._validate_image_resolution(file_obj, image_type='portrait')
        
        return True
    
    def _validate_required_file(self, files, file_key, error_message):
        """Validate required file exists"""
        if file_key not in files:
            raise ValueError(error_message)
        return files[file_key]
    
    def _validate_required_param(self, form_data, param_key, error_message):
        """Validate required parameter exists"""
        value = form_data.get(param_key)
        if not value:
            raise ValueError(error_message)
        return value
    
    def _prepare_ekyc_files(self, request_files):
        """Prepare files for eKYC process"""
        files = {}
        if 'frontID' in request_files:
            files['frontID'] = request_files['frontID']
        
        portrait_images = request_files.getlist('portraitImages')
        if len(portrait_images) != self.REQUIRED_PORTRAIT_COUNT:
            raise ValueError(f'Cần đúng {self.REQUIRED_PORTRAIT_COUNT} ảnh khuôn mặt (3 chỉnh diện, 2 góc trái, 2 góc phải), nhận được {len(portrait_images)}')
        
        if not files.get('frontID'):
            raise ValueError('Thiếu ảnh CCCD mặt trước')
        
        # Prepare files in the correct format
        files_to_send = []
        files_to_send.append(('frontID', (files['frontID'].filename, files['frontID'], files['frontID'].mimetype)))
        
        for i, img in enumerate(portrait_images):
            files_to_send.append(('portraitImages', (f'face_{i+1}.jpg', img, img.mimetype)))
        
        return files_to_send
    
    def _validate_ekyc_results(self, data):
        """Validate eKYC verification results"""
        results = data.get('results', {})
        
        if not results.get('success', False):
            error_msg = results.get('error', 'Xác thực eKYC thất bại.')
            raise ValueError(error_msg)
        
        if not results.get('face_matching', False):
            raise ValueError('Xác thực eKYC thất bại: Khuôn mặt không khớp với CCCD.')
        
        return True
    
    @http.route('/get_countries', type='http', auth='user', methods=['GET'])
    def get_countries(self, **kwargs):
        """Get list of countries from Odoo"""
        try:
            # Get countries from Odoo
            countries = request.env['res.country'].sudo().search([])
            countries_data = []
            
            for country in countries:
                countries_data.append({
                    'id': country.id,
                    'name': country.name,
                    'code': country.code
                })
            
            print(f"📊 Countries loaded: {len(countries_data)} countries")
            
            return request.make_response(
                json.dumps(countries_data),
                headers=[('Content-Type', 'application/json')],
                status=200
            )
            
        except Exception as e:
            print(f"❌ Error loading countries: {e}")
            return request.make_response(
                json.dumps([]),
                headers=[('Content-Type', 'application/json')],
                status=500
            )
    
    @http.route('/ekyc_verification', type='http', auth='user', website=True)
    def ekyc_verification_page(self, **kwargs):
        """Render eKYC verification page"""
        return request.render('investor_profile_management.ekyc_verification_page')
    
    @http.route('/api/ekyc/upload', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_upload_file(self, **kwargs):
        """
        Upload file to VNPT eKYC and get hash
        
        Validates file according to VNPT eKYC technical standards:
        - Format: JPG, JPEG, PNG
        - Max size: 5MB
        - Min resolution: 600x900px (ID card) or 400x400px (portrait)
        """
        try:
            file_obj = self._validate_required_file(
                request.httprequest.files,
                'file',
                'Thiếu file cần upload'
            )
            
            form_data = request.httprequest.form
            title = form_data.get('title', file_obj.filename)
            description = form_data.get('description', '')
            image_type = form_data.get('image_type', 'id_card')  # 'id_card' or 'portrait'
            
            # Validate according to VNPT eKYC standards
            if image_type == 'portrait':
                self._validate_portrait_image(file_obj, file_obj.filename)
            else:
                self._validate_id_card_image(file_obj, file_obj.filename)
            
            files = {'file': (file_obj.filename, file_obj.stream, file_obj.content_type)}
            data = {
                'title': title,
                'description': description
            }
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['upload_file'],
                files=files,
                data=data
            )
            
            # Extract hash from response
            file_hash = response.get('object', {}).get('hash')
            if not file_hash:
                raise Exception('Không nhận được hash từ API upload')
            
            return self._make_success_response({
                'hash': file_hash,
                'file_info': response.get('object', {})
            }, 'Upload file thành công')
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi upload file: {str(e)}', 500)
    
    @http.route('/api/ekyc/frontID', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_front_ocr(self, **kwargs):
        """Process OCR for front CCCD using hash or file"""
        try:
            form_data = request.httprequest.form
            img_hash = form_data.get('img_hash')
            client_session = form_data.get('client_session') or self._generate_client_session()
            doc_type = form_data.get('type', '-1')  # -1: CMT/CCCD, 5: Hộ chiếu, 6: Bằng lái, 7: CM quân đội
            validate_postcode = form_data.get('validate_postcode', 'false').lower() == 'true'
            token = form_data.get('token', 'default_token')
            
            # If no hash provided, try to upload file first
            if not img_hash:
                front_file = self._validate_required_file(
                    request.httprequest.files, 
                    'frontID', 
                    'Thiếu ảnh CCCD mặt trước hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_id_card_image(front_file, front_file.filename)
                
                # Upload file to get hash
                upload_files = {'file': (front_file.filename, front_file.stream, front_file.content_type)}
                upload_data = {'title': 'CCCD mặt trước', 'description': 'OCR front ID'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_hash = upload_response.get('object', {}).get('hash')
                if not img_hash:
                    raise Exception('Không thể upload file để lấy hash')
            
            json_data = {
                'img_front': img_hash,
                'client_session': client_session,
                'type': int(doc_type),
                'validate_postcode': validate_postcode,
                'token': token
            }
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['ocr_front'],
                json_data=json_data
            )
            
            result_data = response.get('object', response)
            return self._make_success_response(result_data)
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi xử lý OCR: {str(e)}', 500)

    @http.route('/api/ekyc/backID', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_back_ocr(self, **kwargs):
        """Process OCR for back CCCD using hash or file"""
        try:
            form_data = request.httprequest.form
            img_hash = form_data.get('img_hash')
            client_session = form_data.get('client_session') or self._generate_client_session()
            doc_type = form_data.get('type', '-1')
            token = form_data.get('token', 'default_token')
            
            # If no hash provided, try to upload file first
            if not img_hash:
                back_file = self._validate_required_file(
                    request.httprequest.files, 
                    'backID', 
                    'Thiếu ảnh CCCD mặt sau hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_id_card_image(back_file, back_file.filename)
                
                # Upload file to get hash
                upload_files = {'file': (back_file.filename, back_file.stream, back_file.content_type)}
                upload_data = {'title': 'CCCD mặt sau', 'description': 'OCR back ID'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_hash = upload_response.get('object', {}).get('hash')
                if not img_hash:
                    raise Exception('Không thể upload file để lấy hash')
            
            json_data = {
                'img_back': img_hash,
                'client_session': client_session,
                'type': int(doc_type),
                'token': token
            }
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['ocr_back'],
                json_data=json_data
            )
            
            result_data = response.get('object', response)
            return self._make_success_response(result_data)
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi xử lý OCR: {str(e)}', 500)

    @http.route('/api/ekyc/classify', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_classify_id(self, **kwargs):
        """Classify ID card type (old/new CMT, passport, driver license, etc.)"""
        try:
            form_data = request.httprequest.form
            img_hash = form_data.get('img_hash')
            client_session = form_data.get('client_session') or self._generate_client_session()
            token = form_data.get('token', 'default_token')
            
            # If no hash, upload file first
            if not img_hash:
                img_file = self._validate_required_file(
                    request.httprequest.files,
                    'img_card',
                    'Thiếu ảnh giấy tờ hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_id_card_image(img_file, img_file.filename)
                
                upload_files = {'file': (img_file.filename, img_file.stream, img_file.content_type)}
                upload_data = {'title': 'Classify ID', 'description': 'Classify ID card type'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_hash = upload_response.get('object', {}).get('hash')
                if not img_hash:
                    raise Exception('Không thể upload file để lấy hash')
            
            json_data = {
                'img_card': img_hash,
                'client_session': client_session,
                'token': token
            }
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['classify_id'],
                json_data=json_data
            )
            
            return self._make_success_response(response.get('object', response))
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi phân loại giấy tờ: {str(e)}', 500)

    @http.route('/api/ekyc/card-liveness', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_card_liveness(self, **kwargs):
        """Check if ID card is real (not fake)"""
        try:
            form_data = request.httprequest.form
            img_hash = form_data.get('img_hash')
            client_session = form_data.get('client_session') or self._generate_client_session()
            
            # If no hash, upload file first
            if not img_hash:
                img_file = self._validate_required_file(
                request.httprequest.files, 
                    'img',
                    'Thiếu ảnh giấy tờ hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_id_card_image(img_file, img_file.filename)
                
                upload_files = {'file': (img_file.filename, img_file.stream, img_file.content_type)}
                upload_data = {'title': 'Card Liveness', 'description': 'Check card authenticity'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_hash = upload_response.get('object', {}).get('hash')
                if not img_hash:
                    raise Exception('Không thể upload file để lấy hash')
            
            json_data = {
                'img': img_hash,
                'client_session': client_session
            }
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['card_liveness'],
                json_data=json_data
            )
            
            return self._make_success_response(response.get('object', response))
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi kiểm tra giấy tờ: {str(e)}', 500)

    @http.route('/api/ekyc/face-compare', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_face_compare(self, **kwargs):
        """Compare face on ID card with portrait"""
        try:
            form_data = request.httprequest.form
            img_front_hash = form_data.get('img_front_hash')
            img_face_hash = form_data.get('img_face_hash')
            client_session = form_data.get('client_session') or self._generate_client_session()
            token = form_data.get('token', 'default_token')
            
            # Upload files if hash not provided
            if not img_front_hash:
                front_file = self._validate_required_file(
                    request.httprequest.files,
                    'img_front',
                    'Thiếu ảnh mặt trước giấy tờ hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_id_card_image(front_file, front_file.filename)
                
                upload_files = {'file': (front_file.filename, front_file.stream, front_file.content_type)}
                upload_data = {'title': 'ID Front', 'description': 'ID card front'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_front_hash = upload_response.get('object', {}).get('hash')
            
            if not img_face_hash:
                face_file = self._validate_required_file(
                    request.httprequest.files,
                    'img_face',
                    'Thiếu ảnh chân dung hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_portrait_image(face_file, face_file.filename)
                
                upload_files = {'file': (face_file.filename, face_file.stream, face_file.content_type)}
                upload_data = {'title': 'Portrait', 'description': 'Face portrait'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_face_hash = upload_response.get('object', {}).get('hash')
            
            json_data = {
                'img_front': img_front_hash,
                'img_face': img_face_hash,
                'client_session': client_session,
                'token': token
            }
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['face_compare'],
                json_data=json_data
            )
            
            return self._make_success_response(response.get('object', response))
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi so sánh khuôn mặt: {str(e)}', 500)

    @http.route('/api/ekyc/face-liveness', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_face_liveness(self, **kwargs):
        """Check if face is real (not photo/video)"""
        try:
            form_data = request.httprequest.form
            img_hash = form_data.get('img_hash')
            client_session = form_data.get('client_session') or self._generate_client_session()
            token = form_data.get('token', 'default_token')
            
            # If no hash, upload file first
            if not img_hash:
                img_file = self._validate_required_file(
                    request.httprequest.files,
                    'img',
                    'Thiếu ảnh khuôn mặt hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_portrait_image(img_file, img_file.filename)
                
                upload_files = {'file': (img_file.filename, img_file.stream, img_file.content_type)}
                upload_data = {'title': 'Face Liveness', 'description': 'Check face liveness'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_hash = upload_response.get('object', {}).get('hash')
                if not img_hash:
                    raise Exception('Không thể upload file để lấy hash')
            
            json_data = {
                'img': img_hash,
                'client_session': client_session,
                'token': token
            }
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['face_liveness'],
                json_data=json_data
            )
            
            return self._make_success_response(response.get('object', response))
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi kiểm tra mặt thật: {str(e)}', 500)

    @http.route('/api/ekyc/ocr-full', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_ocr_full(self, **kwargs):
        """Process OCR for both front and back of ID card"""
        try:
            form_data = request.httprequest.form
            img_front_hash = form_data.get('img_front_hash')
            img_back_hash = form_data.get('img_back_hash')
            client_session = form_data.get('client_session') or self._generate_client_session()
            doc_type = form_data.get('type', '-1')
            validate_postcode = form_data.get('validate_postcode', 'false').lower() == 'true'
            crop_param = form_data.get('crop_param', '')
            token = form_data.get('token', 'default_token')
            
            # Upload files if hash not provided
            if not img_front_hash:
                front_file = self._validate_required_file(
                    request.httprequest.files,
                    'img_front',
                    'Thiếu ảnh mặt trước hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_id_card_image(front_file, front_file.filename)
                
                upload_files = {'file': (front_file.filename, front_file.stream, front_file.content_type)}
                upload_data = {'title': 'ID Front', 'description': 'OCR front ID'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_front_hash = upload_response.get('object', {}).get('hash')
            
            if not img_back_hash:
                back_file = self._validate_required_file(
                    request.httprequest.files,
                    'img_back',
                    'Thiếu ảnh mặt sau hoặc hash'
                )
                # Validate according to VNPT eKYC standards
                self._validate_id_card_image(back_file, back_file.filename)
                
                upload_files = {'file': (back_file.filename, back_file.stream, back_file.content_type)}
                upload_data = {'title': 'ID Back', 'description': 'OCR back ID'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data
                )
                img_back_hash = upload_response.get('object', {}).get('hash')
            
            json_data = {
                'img_front': img_front_hash,
                'img_back': img_back_hash,
                'client_session': client_session,
                'type': int(doc_type),
                'validate_postcode': validate_postcode,
                'token': token
            }
            
            if crop_param:
                json_data['crop_param'] = crop_param
            
            response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['ocr_full'],
                json_data=json_data
            )
            
            return self._make_success_response(response.get('object', response))
                
        except ValueError as e:
            return self._make_error_response(str(e), 400)
        except Exception as e:
            return self._make_error_response(f'Lỗi xử lý OCR: {str(e)}', 500)

    @http.route('/api/ekyc-process', type='http', auth='user', methods=['POST'], csrf=False)
    def ekyc_process(self, **kwargs):
        """
        Process complete eKYC verification workflow:
        1. Upload front ID image
        2. Upload back ID image (optional)
        3. Upload portrait images
        4. Perform OCR on ID card
        5. Compare face on ID with portrait
        6. Check face liveness
        """
        try:
            _logger.info('🚀 Starting eKYC process endpoint')
            
            # Get files
            request_files = request.httprequest.files
            front_file = request_files.get('frontID')
            back_file = request_files.get('backID')
            portrait_images = request_files.getlist('portraitImages')
            
            if not front_file:
                return self._make_error_response('Thiếu ảnh CCCD mặt trước', 400)
            
            if not portrait_images or len(portrait_images) < 1:
                return self._make_error_response('Thiếu ảnh chân dung', 400)
            
            # Step 1: Upload front ID image
            _logger.info('📤 Step 1: Uploading front ID image...')
            front_file.seek(0)
            self._validate_id_card_image(front_file, front_file.filename)
            front_file.seek(0)
            
            upload_files = {'file': (front_file.filename, front_file.stream, front_file.content_type)}
            upload_data = {'title': 'CCCD mặt trước', 'description': 'OCR front ID'}
            upload_response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['upload_file'],
                files=upload_files,
                data=upload_data,
                log_api=True
            )
            front_hash = upload_response.get('object', {}).get('hash')
            if not front_hash:
                return self._make_error_response('Không thể upload ảnh mặt trước', 500)
            
            # Step 2: Upload back ID image if provided
            back_hash = None
            if back_file:
                _logger.info('📤 Step 2: Uploading back ID image...')
                back_file.seek(0)
                self._validate_id_card_image(back_file, back_file.filename)
                back_file.seek(0)
                
                upload_files = {'file': (back_file.filename, back_file.stream, back_file.content_type)}
                upload_data = {'title': 'CCCD mặt sau', 'description': 'OCR back ID'}
                upload_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['upload_file'],
                    files=upload_files,
                    data=upload_data,
                    log_api=True
                )
                back_hash = upload_response.get('object', {}).get('hash')
            
            # Step 3: Upload first portrait image for face comparison
            _logger.info('📤 Step 3: Uploading portrait image...')
            portrait_file = portrait_images[0]
            portrait_file.seek(0)
            self._validate_portrait_image(portrait_file, portrait_file.filename or 'portrait.jpg')
            portrait_file.seek(0)
            
            upload_files = {'file': (portrait_file.filename or 'portrait.jpg', portrait_file.stream, portrait_file.content_type)}
            upload_data = {'title': 'Chân dung', 'description': 'Face portrait'}
            upload_response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['upload_file'],
                files=upload_files,
                data=upload_data,
                log_api=True
            )
            portrait_hash = upload_response.get('object', {}).get('hash')
            if not portrait_hash:
                return self._make_error_response('Không thể upload ảnh chân dung', 500)
            
            # Step 4: Perform OCR on front ID
            _logger.info('📤 Step 4: Performing OCR on front ID...')
            client_session = self._generate_client_session()
            ocr_data = {
                'img_front': front_hash,
                'client_session': client_session,
                'type': -1,  # CMT/CCCD
                'validate_postcode': True,
                'token': 'ekyc_process_token'
            }
            
            if back_hash:
                ocr_data['img_back'] = back_hash
                ocr_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['ocr_full'],
                    json_data=ocr_data,
                    log_api=True
                )
            else:
                ocr_response = self._make_ekyc_request(
                    self.EKYC_ENDPOINTS['ocr_front'],
                    json_data=ocr_data,
                    log_api=True
                )
            
            ocr_result = ocr_response.get('object', ocr_response)
            
            # Step 5: Compare face on ID with portrait
            _logger.info('📤 Step 5: Comparing face...')
            compare_data = {
                'img_front': front_hash,
                'img_face': portrait_hash,
                'client_session': client_session,
                'token': 'ekyc_process_token'
            }
            compare_response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['face_compare'],
                json_data=compare_data,
                log_api=True
            )
            compare_result = compare_response.get('object', compare_response)
            
            # Step 6: Check face liveness
            _logger.info('📤 Step 6: Checking face liveness...')
            liveness_data = {
                'img': portrait_hash,
                'client_session': client_session,
                'token': 'ekyc_process_token'
            }
            liveness_response = self._make_ekyc_request(
                self.EKYC_ENDPOINTS['face_liveness'],
                json_data=liveness_data,
                log_api=True
            )
            liveness_result = liveness_response.get('object', liveness_response)
            
            # Combine results
            result = {
                'success': True,
                'message': 'Xác thực eKYC thành công',
                'ocr': ocr_result,
                'face_compare': compare_result,
                'face_liveness': liveness_result,
            }
            
            # Check if face matching is successful
            face_match = compare_result.get('msg') == 'MATCH' or (
                compare_result.get('prob') and 
                isinstance(compare_result.get('prob'), (int, float)) and 
                compare_result.get('prob') >= 80
            )
            
            if not face_match:
                result['success'] = False
                result['message'] = 'Khuôn mặt không khớp với CCCD'
                result['error'] = compare_result.get('result', 'Khuôn mặt không khớp')
            
            # Check if face is real
            face_real = liveness_result.get('liveness') == 'success'
            if not face_real:
                result['success'] = False
                result['message'] = 'Khuôn mặt không phải người thật'
                result['error'] = liveness_result.get('liveness_msg', 'Khuôn mặt không phải người thật')
            
            _logger.info('✅ eKYC process completed: %s', result.get('message'))
            
            return self._make_success_response(result, result.get('message'))
                
        except ValueError as e:
            _logger.exception('Validation error in eKYC process')
            return self._make_error_response(str(e), 400)
        except Exception as e:
            _logger.exception('Error during eKYC verification')
            return self._make_error_response(f'Lỗi xử lý eKYC: {str(e)}', 500)





 