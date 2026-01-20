# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
import json
import logging

_logger = logging.getLogger(__name__)


class MaturityNotificationController(http.Controller):
    """Controller xử lý thông báo đáo hạn và xác nhận của nhà đầu tư"""

    @http.route('/maturity-notification/confirm/<int:notification_id>/<string:token>', 
                type='http', auth='public', website=True, csrf=False)
    def confirm_sell(self, notification_id, token, **kwargs):
        """
        Nhà đầu tư xác nhận đồng ý bán qua link trong email
        URL: /maturity-notification/confirm/<notification_id>/<token>
        """
        try:
            notification = request.env['transaction.maturity.notification'].sudo().browse(notification_id)
            
            if not notification.exists():
                return request.render('web.http_error', {
                    'error': 'Không tìm thấy thông báo',
                    'error_title': 'Lỗi',
                    'error_message': 'Thông báo không tồn tại hoặc đã bị xóa.'
                })
            
            # Kiểm tra token
            if notification.confirmation_token != token:
                return request.render('web.http_error', {
                    'error': 'Token không hợp lệ',
                    'error_title': 'Lỗi',
                    'error_message': 'Link xác nhận không hợp lệ hoặc đã hết hạn.'
                })
            
            # Kiểm tra trạng thái
            if notification.investor_response != 'pending':
                return request.render('order_matching.maturity_notification_response', {
                    'notification': notification,
                    'message': 'Thông báo này đã được xử lý.',
                    'success': False
                })
            
            # Xác nhận bán
            try:
                notification.action_confirm_sell()
                return request.render('order_matching.maturity_notification_response', {
                    'notification': notification,
                    'message': 'Bạn đã xác nhận đồng ý bán. Lệnh bán đã được tạo và sẽ được đưa vào sổ lệnh để khớp.',
                    'success': True
                })
            except Exception as e:
                _logger.error(f"Lỗi khi xác nhận bán: {str(e)}")
                return request.render('order_matching.maturity_notification_response', {
                    'notification': notification,
                    'message': f'Có lỗi xảy ra: {str(e)}',
                    'success': False
                })
                
        except Exception as e:
            _logger.error(f"Lỗi trong confirm_sell: {str(e)}")
            return request.render('web.http_error', {
                'error': str(e),
                'error_title': 'Lỗi',
                'error_message': 'Đã có lỗi xảy ra khi xử lý yêu cầu.'
            })

    @http.route('/maturity-notification/reject/<int:notification_id>/<string:token>', 
                type='http', auth='public', website=True, csrf=False)
    def reject_sell(self, notification_id, token, **kwargs):
        """
        Nhà đầu tư từ chối bán qua link trong email
        URL: /maturity-notification/reject/<notification_id>/<token>
        """
        try:
            notification = request.env['transaction.maturity.notification'].sudo().browse(notification_id)
            
            if not notification.exists():
                return request.render('web.http_error', {
                    'error': 'Không tìm thấy thông báo',
                    'error_title': 'Lỗi',
                    'error_message': 'Thông báo không tồn tại hoặc đã bị xóa.'
                })
            
            # Kiểm tra token
            if notification.confirmation_token != token:
                return request.render('web.http_error', {
                    'error': 'Token không hợp lệ',
                    'error_title': 'Lỗi',
                    'error_message': 'Link từ chối không hợp lệ hoặc đã hết hạn.'
                })
            
            # Kiểm tra trạng thái
            if notification.investor_response != 'pending':
                return request.render('order_matching.maturity_notification_response', {
                    'notification': notification,
                    'message': 'Thông báo này đã được xử lý rồi.',
                    'success': False
                })
            
            # Từ chối bán
            try:
                notification.action_reject_sell()
                return request.render('order_matching.maturity_notification_response', {
                    'notification': notification,
                    'message': 'Bạn đã từ chối bán lệnh này.',
                    'success': True
                })
            except Exception as e:
                _logger.error(f"Lỗi khi từ chối bán: {str(e)}")
                return request.render('order_matching.maturity_notification_response', {
                    'notification': notification,
                    'message': f'Có lỗi xảy ra: {str(e)}',
                    'success': False
                })
                
        except Exception as e:
            _logger.error(f"Lỗi trong reject_sell: {str(e)}")
            return request.render('web.http_error', {
                'error': str(e),
                'error_title': 'Lỗi',
                'error_message': 'Đã có lỗi xảy ra khi xử lý yêu cầu.'
            })

    @http.route('/api/transaction-list/maturity-notifications', type='json', auth='user')
    def get_maturity_notifications(self, **kwargs):
        """API lấy danh sách thông báo đáo hạn của nhà đầu tư hiện tại"""
        try:
            # Portal user chỉ có thể đọc thông báo của chính họ
            notifications = request.env['transaction.maturity.notification'].sudo().search([
                ('user_id', '=', request.env.user.id)
            ], order='maturity_date desc')
            
            result = []
            for notif in notifications:
                result.append({
                    'id': notif.id,
                    'name': notif.name,
                    'transaction_id': notif.transaction_id.id,
                    'transaction_name': notif.transaction_id.name,
                    'fund_name': notif.fund_id.name if notif.fund_id else '',
                    'maturity_date': notif.maturity_date.strftime('%Y-%m-%d') if notif.maturity_date else notif.create_date.strftime('%Y-%m-%d'),
                    'units': notif.units,
                    'remaining_units': notif.remaining_units,
                    'state': notif.state,
                    'investor_response': notif.investor_response,
                    'notification_sent': notif.notification_sent,
                    'sell_order_id': notif.sell_order_id.id if notif.sell_order_id else False,
                    'notification_type': notif.notification_type,
                    'title': notif.title or '',
                    'message': notif.message or '',
                    'created_at': notif.create_date.strftime('%Y-%m-%d %H:%M:%S'),
                })
            
            return {
                'success': True,
                'notifications': result
            }
        except Exception as e:
            _logger.error(f"Lỗi khi lấy danh sách thông báo đáo hạn: {str(e)}")
            return {
                'success': False,
                'message': str(e)
            }

    @http.route('/api/transaction-list/send-maturity-notifications', type='http', auth='user', methods=['POST'], csrf=False)
    def send_maturity_notifications(self, **kwargs):
        """API gửi thông báo đáo hạn cho các lệnh đến ngày đáo hạn"""
        try:
            # Parse JSON từ request body
            try:
                payload = json.loads(request.httprequest.data.decode('utf-8') or '{}')
            except Exception:
                payload = {}
            
            # Gọi method send_maturity_notifications_manual để demo gửi tất cả
            result = request.env['transaction.maturity.notification'].sudo().send_maturity_notifications_manual()
            
            response_data = {
                'success': True,
                'message': f'Đã tạo {result.get("notifications_created", 0)} thông báo và gửi {result.get("notifications_sent", 0)} thông báo thành công.',
                'notifications_created': result.get('notifications_created', 0),
                'notifications_sent': result.get('notifications_sent', 0)
            }
            return request.make_response(
                json.dumps(response_data, ensure_ascii=False),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            _logger.error(f"Lỗi khi gửi thông báo đáo hạn: {str(e)}", exc_info=True)
            response_data = {
                'success': False,
                'message': f'Lỗi khi gửi thông báo đáo hạn: {str(e)}',
                'notifications_created': 0,
                'notifications_sent': 0
            }
            return request.make_response(
                json.dumps(response_data, ensure_ascii=False),
                headers=[('Content-Type', 'application/json')],
                status=500
            )



    @http.route('/api/transaction-list/delete-maturity-notification', type='json', auth='user')
    def delete_maturity_notification(self, notification_id, **kwargs):
        """API xóa thông báo đáo hạn"""
        try:
            notification = request.env['transaction.maturity.notification'].sudo().search([
                ('id', '=', notification_id),
                ('user_id', '=', request.env.user.id)
            ], limit=1)
            
            if not notification.exists():
                return {
                    'success': False,
                    'message': 'Không tìm thấy thông báo hoặc bạn không có quyền xóa'
                }
            
            notification_name = notification.name
            notification.unlink()
            
            _logger.info(f"User {request.env.user.name} đã xóa thông báo {notification_name}")
            
            return {
                'success': True,
                'message': 'Đã xóa thông báo thành công'
            }
        except Exception as e:
            _logger.error(f"Lỗi khi xóa thông báo đáo hạn: {str(e)}")
            return {
                'success': False,
                'message': f'Lỗi khi xóa thông báo: {str(e)}'
            }

    @http.route('/api/transaction-list/delete-maturity-notifications', type='json', auth='user')
    def delete_maturity_notifications(self, notification_ids, **kwargs):
        """API xóa nhiều thông báo đáo hạn cùng lúc"""
        try:
            if not notification_ids or not isinstance(notification_ids, list):
                return {
                    'success': False,
                    'message': 'Danh sách thông báo không hợp lệ'
                }
            
            notifications = request.env['transaction.maturity.notification'].sudo().search([
                ('id', 'in', notification_ids),
                ('user_id', '=', request.env.user.id)
            ])
            
            if not notifications:
                return {
                    'success': False,
                    'message': 'Không tìm thấy thông báo hoặc bạn không có quyền xóa'
                }
            
            deleted_count = len(notifications)
            notification_names = [n.name for n in notifications]
            notifications.unlink()
            
            _logger.info(f"User {request.env.user.name} đã xóa {deleted_count} thông báo: {', '.join(notification_names)}")
            
            return {
                'success': True,
                'message': f'Đã xóa {deleted_count} thông báo thành công',
                'deleted_count': deleted_count
            }
        except Exception as e:
            _logger.error(f"Lỗi khi xóa thông báo đáo hạn: {str(e)}")
            return {
                'success': False,
                'message': f'Lỗi khi xóa thông báo: {str(e)}'
            }

    @http.route('/api/transaction-list/get-transaction-details/<int:transaction_id>', type='json', auth='user')
    def get_transaction_details(self, transaction_id, **kwargs):
        """API lấy chi tiết transaction"""
        try:
            transaction = request.env['portfolio.transaction'].sudo().search([
                ('id', '=', transaction_id),
                ('user_id', '=', request.env.user.id)
            ], limit=1)
            
            if not transaction.exists():
                return {
                    'success': False,
                    'message': 'Không tìm thấy giao dịch hoặc bạn không có quyền xem'
                }
            
            # Lấy giá CCQ từ tồn kho đầu ngày (fund_buy), không phải giá NAV của quỹ
            fund_id = transaction.fund_id.id if transaction.fund_id else False
            ccq_price = 0
            try:
                from odoo.addons.fund_management.utils import investment_utils
                ccq_price = investment_utils.InvestmentHelper._get_ccq_price_from_inventory(request.env, fund_id)
                if ccq_price <= 0:
                    # Fallback về current_nav nếu không lấy được giá CCQ từ tồn kho
                    ccq_price = transaction.current_nav or transaction.price or 0
                    _logger.warning(f"Không lấy được giá CCQ từ tồn kho cho fund_id={fund_id}, dùng giá NAV: {ccq_price}")
                else:
                    # Làm tròn giá CCQ theo bội số 50 (MROUND)
                    try:
                        from odoo.addons.order_matching.utils import mround
                        ccq_price = mround(ccq_price, 50)
                    except Exception:
                        ccq_price = round(ccq_price / 50) * 50
                    _logger.info(f"Đã lấy giá CCQ từ tồn kho đầu ngày: {ccq_price} cho fund_id={fund_id}")
            except Exception as e:
                _logger.error(f"Lỗi khi lấy giá CCQ từ tồn kho: {str(e)}, dùng giá NAV làm fallback")
                ccq_price = transaction.current_nav or transaction.price or 0
            
            # Tính giá trị ước tính từ giá CCQ và số lượng
            units = transaction.remaining_units if transaction.remaining_units > 0 else transaction.units
            estimated_value = units * ccq_price if units > 0 and ccq_price > 0 else 0
            
            return {
                'success': True,
                'transaction': {
                    'id': transaction.id,
                    'name': transaction.name,
                    'fund_name': transaction.fund_id.name if transaction.fund_id else '',
                    'fund_ticker': transaction.fund_id.ticker if transaction.fund_id else '',
                    'units': transaction.units,
                    'remaining_units': transaction.remaining_units,
                    'price': transaction.price or 0,
                    'current_nav': transaction.current_nav or transaction.price or 0,
                    'ccq_price': ccq_price,  # Giá CCQ từ tồn kho đầu ngày (đã làm tròn)
                    'amount': transaction.amount or 0,
                    'estimated_value': estimated_value,  # Giá trị ước tính từ giá CCQ
                    'transaction_type': transaction.transaction_type,
                    'status': transaction.status,
                    'term_months': transaction.term_months or 0,
                    'interest_rate': transaction.interest_rate or 0,
                    'created_at': transaction.created_at.strftime('%Y-%m-%d') if hasattr(transaction, 'created_at') and transaction.created_at else '',
                    'date_end': transaction.date_end.strftime('%Y-%m-%d') if hasattr(transaction, 'date_end') and transaction.date_end else '',
                }
            }
        except Exception as e:
            _logger.error(f"Lỗi khi lấy chi tiết transaction: {str(e)}")
            return {
                'success': False,
                'message': f'Lỗi khi lấy chi tiết: {str(e)}'
            }

    @http.route('/api/transaction-list/confirm-maturity-notification/<int:notification_id>', type='http', auth='user', methods=['POST'], csrf=False)
    def confirm_maturity_notification(self, notification_id, **kwargs):
        """API xác nhận đồng ý bán từ notification"""
        try:
            # Parse JSON từ request body nếu có
            try:
                payload = json.loads(request.httprequest.data.decode('utf-8') or '{}')
            except Exception:
                payload = {}
            
            notification = request.env['transaction.maturity.notification'].sudo().search([
                ('id', '=', notification_id),
                ('user_id', '=', request.env.user.id)
            ], limit=1)
            
            if not notification.exists():
                response_data = {
                    'success': False,
                    'message': 'Không tìm thấy thông báo hoặc bạn không có quyền xử lý'
                }
                return request.make_response(
                    json.dumps(response_data, ensure_ascii=False),
                    headers=[('Content-Type', 'application/json')],
                    status=404
                )
            
            if notification.investor_response != 'pending':
                response_data = {
                    'success': False,
                    'message': 'Thông báo này đã được xử lý rồi'
                }
                return request.make_response(
                    json.dumps(response_data, ensure_ascii=False),
                    headers=[('Content-Type', 'application/json')],
                    status=400
                )
            
            # Gọi method xác nhận bán
            try:
                notification.action_confirm_sell()
            except Exception as confirm_error:
                _logger.error(f"Lỗi khi gọi action_confirm_sell: {str(confirm_error)}", exc_info=True)
                response_data = {
                    'success': False,
                    'message': f'Lỗi khi xác nhận bán: {str(confirm_error)}'
                }
                return request.make_response(
                    json.dumps(response_data, ensure_ascii=False),
                    headers=[('Content-Type', 'application/json')],
                    status=500
                )
            
            # Đọc lại record từ database để lấy thông tin mới nhất (bao gồm sell_order_id)
            notification.invalidate_recordset(['sell_order_id', 'investor_response', 'state'])
            notification = request.env['transaction.maturity.notification'].sudo().browse(notification_id)
            
            # Lấy thông tin sell_order
            sell_order_id = False
            sell_order_name = ''
            if notification.sell_order_id:
                sell_order_id = notification.sell_order_id.id
                sell_order_name = notification.sell_order_id.name
            
            response_data = {
                'success': True,
                'message': 'Đã xác nhận bán thành công',
                'sell_order_id': sell_order_id,
                'sell_order_name': sell_order_name
            }
            return request.make_response(
                json.dumps(response_data, ensure_ascii=False),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            _logger.error(f"Lỗi khi xác nhận thông báo đáo hạn: {str(e)}", exc_info=True)
            response_data = {
                'success': False,
                'message': f'Lỗi khi xác nhận: {str(e)}'
            }
            return request.make_response(
                json.dumps(response_data, ensure_ascii=False),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    @http.route('/api/transaction-list/reject-maturity-notification/<int:notification_id>', type='json', auth='user')
    def reject_maturity_notification(self, notification_id, **kwargs):
        """API từ chối bán từ notification"""
        try:
            notification = request.env['transaction.maturity.notification'].sudo().search([
                ('id', '=', notification_id),
                ('user_id', '=', request.env.user.id)
            ], limit=1)
            
            if not notification.exists():
                return {
                    'success': False,
                    'message': 'Không tìm thấy thông báo hoặc bạn không có quyền xử lý'
                }
            
            if notification.investor_response != 'pending':
                return {
                    'success': False,
                    'message': 'Thông báo này đã được xử lý rồi'
                }
            
            # Gọi method từ chối bán
            notification.action_reject_sell()
            
            return {
                'success': True,
                'message': 'Đã từ chối bán thành công'
            }
        except Exception as e:
            _logger.error(f"Lỗi khi từ chối thông báo đáo hạn: {str(e)}")
            return {
                'success': False,
                'message': f'Lỗi khi từ chối: {str(e)}'
            }
