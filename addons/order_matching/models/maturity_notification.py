# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from datetime import datetime, timedelta
import logging
import json

_logger = logging.getLogger(__name__)


class MaturityNotification(models.Model):
    _name = 'transaction.maturity.notification'
    _description = 'Thông báo đáo hạn lệnh giao dịch'
    _order = 'maturity_date desc, create_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Mã thông báo', required=True, readonly=True, default=lambda self: _('New'))
    transaction_id = fields.Many2one('portfolio.transaction', string='Lệnh giao dịch', required=False, ondelete='cascade', tracking=True)
    trading_order_id = fields.Many2one('trading.order', string='Lệnh đặt', required=False, ondelete='cascade', tracking=True)
    user_id = fields.Many2one('res.users', string='Nhà đầu tư', compute='_compute_user_info', store=True, readonly=True)
    partner_id = fields.Many2one('res.partner', string='Đối tác', compute='_compute_user_info', store=True, readonly=True)
    fund_id = fields.Many2one('portfolio.fund', string='Quỹ', compute='_compute_fund_info', store=True, readonly=True)
    
    @api.depends('transaction_id', 'trading_order_id')
    def _compute_user_info(self):
        for record in self:
            if record.transaction_id:
                record.user_id = record.transaction_id.user_id
                record.partner_id = record.transaction_id.user_id.partner_id
            elif record.trading_order_id:
                record.user_id = record.trading_order_id.user_id
                record.partner_id = record.trading_order_id.user_id.partner_id
            else:
                record.user_id = False
                record.partner_id = False

    @api.depends('transaction_id')
    def _compute_fund_info(self):
         for record in self:
            if record.transaction_id:
                record.fund_id = record.transaction_id.fund_id
            else:
                record.fund_id = False
    
    maturity_date = fields.Date(string='Ngày đáo hạn', required=False, tracking=True, help='Ngày mà lệnh đến hạn và cần xác nhận bán')
    units = fields.Float(string='Số lượng CCQ', related='transaction_id.units', store=True, readonly=True, digits=(16, 2))
    remaining_units = fields.Float(string='Số lượng còn lại', related='transaction_id.remaining_units', store=True, readonly=True, digits=(16, 2))
    notification_sent = fields.Boolean(string='Đã gửi thông báo', default=False, tracking=True)
    notification_sent_at = fields.Datetime(string='Thời gian gửi thông báo', readonly=True)
    investor_response = fields.Selection([
        ('pending', 'Chờ phản hồi'),
        ('confirmed', 'Đồng ý bán'),
        ('rejected', 'Từ chối bán'),
        ('expired', 'Hết hạn')
    ], string='Phản hồi nhà đầu tư', default='pending', tracking=True)
    investor_response_at = fields.Datetime(string='Thời gian phản hồi', readonly=True)
    sell_order_id = fields.Many2one('portfolio.transaction', string='Lệnh bán đã tạo', readonly=True, help='Lệnh bán tự động được tạo khi nhà đầu tư xác nhận')
    state = fields.Selection([
        ('draft', 'Nháp'),
        ('sent', 'Đã gửi'),
        ('confirmed', 'Đã xác nhận'),
        ('rejected', 'Đã từ chối'),
        ('expired', 'Hết hạn'),
        ('done', 'Hoàn thành')
    ], string='Trạng thái', default='draft', tracking=True, compute='_compute_state', store=True)
    term_months = fields.Integer(string='Kỳ hạn (tháng)', related='transaction_id.term_months', store=True, readonly=True)
    interest_rate = fields.Float(string='Lãi suất (%)', related='transaction_id.interest_rate', store=True, readonly=True, digits=(16, 2))
    current_nav = fields.Float(string='Giá NAV hiện tại', related='transaction_id.current_nav', store=True, readonly=True, digits=(16, 2))
    confirmation_token = fields.Char(string='Token xác nhận', readonly=True, copy=False, help='Token để xác thực khi nhà đầu tư xác nhận qua link')
    
    notification_type = fields.Selection([
        ('maturity', 'Đáo hạn'),
        ('order_filled', 'Khớp lệnh'),
        ('order_cancelled', 'Hủy lệnh/Hết hạn'),
        ('order_sent_success', 'Đặt lệnh thành công'),
        ('order_sent_failed', 'Đặt lệnh thất bại'),
    ], string='Loại thông báo', default='maturity', required=True)
    
    # Custom message fields
    title = fields.Char(string='Tiêu đề')
    message = fields.Text(string='Nội dung')
    
    # Lịch sử gửi thông báo
    notification_log_ids = fields.One2many(
        'maturity.notification.log',
        'maturity_notification_id',
        string='Lịch sử gửi thông báo',
        readonly=True
    )
    notification_log_count = fields.Integer(string='Số lần gửi', compute='_compute_notification_log_count', store=False)

    @api.depends('notification_log_ids')
    def _compute_notification_log_count(self):
        for record in self:
            try:
                # Kiểm tra xem model có tồn tại không (bảng đã được tạo chưa)
                if 'maturity.notification.log' in self.env:
                    record.notification_log_count = len(record.notification_log_ids)
                else:
                    record.notification_log_count = 0
            except Exception:
                # Nếu có lỗi (bảng chưa tồn tại), trả về 0
                record.notification_log_count = 0

    def unlink(self):
        """Override unlink để xử lý trường hợp bảng log chưa tồn tại"""
        try:
            return super(MaturityNotification, self).unlink()
        except Exception as e:
            # Nếu lỗi do bảng log chưa tồn tại, thử xóa mà không fetch field One2many
            if 'maturity_notification_log' in str(e) or 'does not exist' in str(e):
                _logger.warning(f"Bảng maturity_notification_log chưa tồn tại, xóa record mà không fetch log: {str(e)}")
                # Xóa trực tiếp từ database
                self._cr.execute("DELETE FROM transaction_maturity_notification WHERE id IN %s", (tuple(self.ids),))
                return True
            raise

    @api.depends('notification_sent', 'investor_response', 'sell_order_id')
    def _compute_state(self):
        for record in self:
            if record.investor_response == 'confirmed' and record.sell_order_id:
                record.state = 'done'
            elif record.investor_response == 'confirmed':
                record.state = 'confirmed'
            elif record.investor_response == 'rejected':
                record.state = 'rejected'
            elif record.investor_response == 'expired':
                record.state = 'expired'
            elif record.notification_sent:
                record.state = 'sent'
            else:
                record.state = 'draft'

    @api.model
    def create(self, vals):
        try:
            if vals.get('name', _('New')) == _('New'):
                try:
                    sequence = self.env['ir.sequence'].next_by_code('transaction.maturity.notification')
                    if sequence:
                        vals['name'] = sequence
                    else:
                        # Fallback nếu sequence không tìm thấy
                        today = fields.Date.today()
                        vals['name'] = f"MAT/{today.strftime('%Y%m%d')}/NEW"
                        _logger.warning("Sequence 'transaction.maturity.notification' không tìm thấy, sử dụng fallback")
                except Exception as seq_error:
                    # Fallback nếu có lỗi khi gọi sequence
                    today = fields.Date.today()
                    vals['name'] = f"MAT/{today.strftime('%Y%m%d')}/FALLBACK"
                    _logger.warning(f"Lỗi khi gọi sequence: {str(seq_error)}, sử dụng fallback")
        except Exception as e:
            _logger.error(f"Lỗi khi tạo name cho notification: {str(e)}")
            # Đảm bảo có name trước khi create
            if not vals.get('name') or vals.get('name') == _('New'):
                today = fields.Date.today()
                vals['name'] = f"MAT/{today.strftime('%Y%m%d')}/ERROR"
        
        if not vals.get('confirmation_token'):
            try:
                import secrets
                vals['confirmation_token'] = secrets.token_urlsafe(32)
            except Exception as token_error:
                _logger.warning(f"Lỗi khi tạo confirmation_token: {str(token_error)}")
                # Fallback: dùng timestamp và random
                import time
                import random
                vals['confirmation_token'] = f"{int(time.time())}{random.randint(1000, 9999)}"
        
        try:
            return super(MaturityNotification, self).create(vals)
        except Exception as create_error:
            _logger.error(f"Lỗi khi tạo notification record: {str(create_error)}", exc_info=True)
            raise

    def action_send_notification(self):
        self.ensure_one()
        if not self.user_id:
            raise ValidationError(_('Nhà đầu tư không tồn tại.'))
        
        # Đảm bảo có partner_id
        partner_id = self.partner_id.id if self.partner_id else None
        if not partner_id:
            if self.user_id.partner_id:
                partner_id = self.user_id.partner_id.id
                # Cập nhật partner_id vào record
                self.write({'partner_id': partner_id})
            else:
                raise ValidationError(_('Nhà đầu tư không có thông tin đối tác (partner).'))
        
        try:
            # Chuẩn bị dữ liệu thông báo
            transaction = self.transaction_id
            fund_name = transaction.fund_id.name if transaction and transaction.fund_id else 'N/A'
            maturity_date_str = self.maturity_date.strftime('%d/%m/%Y') if self.maturity_date else 'N/A'
            
            # Helper to get units/nav
            units = 0
            if transaction:
                units = transaction.remaining_units if transaction.remaining_units > 0 else transaction.units
                nav = transaction.current_nav or transaction.price or 0
                transaction_name = transaction.name
            elif self.trading_order_id:
                transaction_name = self.trading_order_id.name
                if self.notification_type == 'order_filled':
                     units = self.trading_order_id.filled_quantity
                else:
                     units = self.trading_order_id.quantity
                nav = 0 # Not relevant for stock order notification usually
                fund_name = "Thị trường cơ sở" # Fallback for stock
            else:
                 transaction_name = 'N/A'
                 nav = 0

            estimated_value = units * nav

            # Chuẩn bị payload để gửi qua websocket/bus
            payload = {
                'type': self.notification_type,
                'notification_id': self.id,
                'user_id': self.user_id.id,
                'partner_id': self.partner_id.id,
                'transaction_id': transaction.id if transaction else False,
                'transaction_name': transaction_name,
                'fund_name': fund_name,
                'maturity_date': maturity_date_str,
                'units': units,
                'nav': nav,
                'estimated_value': estimated_value,
                'title': self.title or f'Thông báo đáo hạn - Lệnh {transaction_name}',
                'message': self.message or f'Lệnh {transaction_name} của quỹ {fund_name} đã đến ngày đáo hạn ({maturity_date_str}). Số lượng: {units:,.2f} CCQ.',
                'timestamp': fields.Datetime.now().isoformat()
            }
            
            # Gửi qua bus đến partner cụ thể
            # Format channel: (dbname, 'res.partner', partner_id)
            channel = (self.env.cr.dbname, 'res.partner', partner_id)
            channel_name = f"{self.env.cr.dbname},res.partner,{partner_id}"
            
            try:
                self.env['bus.bus']._sendone(channel, payload)
                sent_status = 'success'
                error_message = None
                _logger.info(f"Đã gửi thông báo đáo hạn qua websocket cho lệnh {self.transaction_id.name} đến user {self.user_id.name} (partner_id: {partner_id})")
            except Exception as send_error:
                sent_status = 'failed'
                error_message = str(send_error)
                _logger.error(f"Lỗi khi gửi thông báo qua bus: {str(send_error)}", exc_info=True)
                raise  # Re-raise để method fail
            
            # Lưu lịch sử gửi thông báo (chỉ khi model đã tồn tại)
            try:
                if 'maturity.notification.log' in self.env:
                    log_vals = {
                        'maturity_notification_id': self.id,
                        'notification_type': 'maturity_notification',
                        'partner_id': partner_id,
                        'transaction_id': transaction.id,
                        'fund_id': transaction.fund_id.id if transaction.fund_id else False,
                        'title': payload['title'],
                        'message': payload['message'],
                        'sent_at': fields.Datetime.now(),
                        'sent_status': sent_status,
                        'error_message': error_message,
                        'channel_name': channel_name,
                        'payload_data': json.dumps(payload, ensure_ascii=False, default=str),
                    }
                    self.env['maturity.notification.log'].create(log_vals)
                    _logger.info(f"Đã lưu lịch sử gửi thông báo cho lệnh {transaction.name}")
                else:
                    _logger.warning(f"Model maturity.notification.log chưa tồn tại, bỏ qua lưu log")
            except Exception as log_error:
                _logger.warning(f"Không thể lưu lịch sử gửi thông báo: {str(log_error)}", exc_info=True)
                # Không raise error vì thông báo đã gửi thành công qua bus
            
            self.write({
                'notification_sent': True,
                'notification_sent_at': fields.Datetime.now(),
                'state': 'sent'
            })
        except Exception as e:
            _logger.error(f"Lỗi khi gửi thông báo đáo hạn: {str(e)}", exc_info=True)
            raise ValidationError(_('Không thể gửi thông báo: %s') % str(e))

    def action_confirm_sell(self):
        self.ensure_one()
        if self.investor_response != 'pending':
            raise ValidationError(_('Thông báo này đã được xử lý.'))
        if not self.transaction_id:
            raise ValidationError(_('Lệnh không tồn tại.'))
        # Kiểm tra số lượng để bán: ưu tiên remaining_units, nếu = 0 thì dùng units (vì khi khớp thành công remaining_units = 0)
        units_to_sell = self.transaction_id.remaining_units if self.transaction_id.remaining_units > 0 else self.transaction_id.units
        if units_to_sell <= 0:
            raise ValidationError(_('Lệnh không còn số lượng để bán.'))
        sell_order = self._create_sell_order()
        self.write({
            'investor_response': 'confirmed',
            'investor_response_at': fields.Datetime.now(),
            'sell_order_id': sell_order.id,
            'state': 'confirmed'
        })
        self._send_confirmation_email()
        _logger.info(f"Nhà đầu tư {self.user_id.name} đã xác nhận bán lệnh {self.transaction_id.name}, đã tạo lệnh bán {sell_order.name}")
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Thành công'),
                'message': _('Đã tạo lệnh bán thành công. Lệnh sẽ được đưa vào sổ lệnh để khớp.'),
                'sticky': False,
            }
        }

    def action_reject_sell(self):
        self.ensure_one()
        if self.investor_response != 'pending':
            raise ValidationError(_('Thông báo này đã được xử lý.'))
        self.write({
            'investor_response': 'rejected',
            'investor_response_at': fields.Datetime.now(),
            'state': 'rejected'
        })
        _logger.info(f"Nhà đầu tư {self.user_id.name} đã từ chối bán lệnh {self.transaction_id.name}")
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Đã từ chối'),
                'message': _('Bạn đã từ chối bán lệnh này.'),
                'sticky': False,
            }
        }

    def _create_sell_order(self):
        transaction = self.transaction_id
        fund_id = transaction.fund_id.id if transaction.fund_id else False
        
        # Lấy giá CCQ từ tồn kho đầu ngày (fund_buy), không phải giá NAV của quỹ
        try:
            from odoo.addons.fund_management.utils import investment_utils
            ccq_price = investment_utils.InvestmentHelper._get_ccq_price_from_inventory(self.env, fund_id)
            if ccq_price <= 0:
                # Fallback về current_nav nếu không lấy được giá CCQ từ tồn kho
                ccq_price = transaction.current_nav or transaction.price or 0
                _logger.warning(f"Không lấy được giá CCQ từ tồn kho cho fund_id={fund_id}, dùng giá NAV: {ccq_price}")
            else:
                _logger.info(f"Đã lấy giá CCQ từ tồn kho đầu ngày: {ccq_price} cho fund_id={fund_id}")
        except Exception as e:
            _logger.error(f"Lỗi khi lấy giá CCQ từ tồn kho: {str(e)}, dùng giá NAV làm fallback")
            ccq_price = transaction.current_nav or transaction.price or 0
        
        # Làm tròn giá CCQ theo bội số 50 (MROUND)
        try:
            from odoo.addons.order_matching.utils import mround
            sell_price = mround(ccq_price, 50)
        except Exception as e:
            # Fallback nếu không import được mround
            _logger.warning(f"Không import được mround: {str(e)}, dùng công thức làm tròn thủ công")
            sell_price = round(ccq_price / 50) * 50
        
        # Số lượng để bán: ưu tiên remaining_units, nếu = 0 thì dùng units (vì khi khớp thành công remaining_units = 0)
        units_to_sell = transaction.remaining_units if transaction.remaining_units > 0 else transaction.units
        if units_to_sell <= 0:
            raise ValidationError(_('Lệnh không còn số lượng để bán.'))
        
        # Tạo lệnh bán với status 'pending' để có thể đưa vào sổ lệnh để khớp
        sell_order_vals = {
            'user_id': transaction.user_id.id,
            'fund_id': fund_id,
            'transaction_type': 'sell',
            'status': 'pending',  # Để có thể khớp lệnh sau này
            'units': units_to_sell,
            'remaining_units': units_to_sell,
            'matched_units': 0.0,
            'is_matched': False,
            'amount': units_to_sell * sell_price,
            'price': sell_price,  # Giá CCQ từ tồn kho đầu ngày (đã làm tròn)
            'current_nav': sell_price,
            'term_months': transaction.term_months or 0,
            'interest_rate': transaction.interest_rate or 0.0,
            'currency_id': transaction.currency_id.id if transaction.currency_id else self.env.company.currency_id.id,
            'investment_type': transaction.investment_type or 'fund_certificate',
            'source': 'portfolio',
            'description': f'Lệnh bán tự động từ đáo hạn - Lệnh mua #{transaction.name}',
        }
        try:
            sell_order = self.env['portfolio.transaction'].sudo().create(sell_order_vals)
            _logger.info(f"Đã tạo lệnh bán {sell_order.name} từ thông báo đáo hạn {self.name} với giá CCQ {sell_price} (từ tồn kho đầu ngày)")
            return sell_order
        except Exception as e:
            _logger.error(f"Lỗi khi tạo lệnh bán từ thông báo đáo hạn {self.name}: {str(e)}")
            raise ValidationError(_('Không thể tạo lệnh bán: %s') % str(e))

    def _send_confirmation_email(self):
        """Gửi thông báo xác nhận qua websocket"""
        try:
            if not self.user_id or not self.partner_id:
                _logger.warning(f"Không thể gửi thông báo xác nhận: thiếu user_id hoặc partner_id")
                return
            
            payload = {
                'type': 'maturity_confirmation',
                'notification_id': self.id,
                'user_id': self.user_id.id,
                'partner_id': self.partner_id.id,
                'transaction_id': self.transaction_id.id,
                'transaction_name': self.transaction_id.name,
                'sell_order_id': self.sell_order_id.id if self.sell_order_id else False,
                'sell_order_name': self.sell_order_id.name if self.sell_order_id else 'Đang xử lý...',
                'title': 'Xác nhận bán thành công',
                'message': f'Bạn đã xác nhận đồng ý bán lệnh {self.transaction_id.name}. Lệnh bán đã được tạo và sẽ được đưa vào sổ lệnh để khớp.',
                'timestamp': fields.Datetime.now().isoformat()
            }
            
            # Gửi qua bus đến partner cụ thể
            # Format channel: (dbname, 'res.partner', partner_id)
            channel = (self.env.cr.dbname, 'res.partner', self.partner_id.id)
            channel_name = f"{self.env.cr.dbname},res.partner,{self.partner_id.id}"
            
            try:
                self.env['bus.bus']._sendone(channel, payload)
                sent_status = 'success'
                error_message = None
                _logger.info(f"Đã gửi thông báo xác nhận qua websocket cho partner_id: {self.partner_id.id}")
            except Exception as send_error:
                sent_status = 'failed'
                error_message = str(send_error)
                _logger.error(f"Lỗi khi gửi thông báo xác nhận qua bus: {str(send_error)}", exc_info=True)
                # Không raise vì đây là thông báo phụ
            
            # Lưu lịch sử gửi thông báo xác nhận (chỉ khi model đã tồn tại)
            try:
                if 'maturity.notification.log' in self.env:
                    log_vals = {
                        'maturity_notification_id': self.id,
                        'notification_type': 'maturity_confirmation',
                        'partner_id': self.partner_id.id,
                        'transaction_id': self.transaction_id.id,
                        'fund_id': self.fund_id.id if self.fund_id else False,
                        'title': payload['title'],
                        'message': payload['message'],
                        'sent_at': fields.Datetime.now(),
                        'sent_status': sent_status,
                        'error_message': error_message,
                        'channel_name': channel_name,
                        'payload_data': json.dumps(payload, ensure_ascii=False, default=str),
                        'sell_order_id': self.sell_order_id.id if self.sell_order_id else False,
                    }
                    self.env['maturity.notification.log'].create(log_vals)
                    _logger.info(f"Đã lưu lịch sử gửi thông báo xác nhận cho lệnh {self.transaction_id.name}")
                else:
                    _logger.warning(f"Model maturity.notification.log chưa tồn tại, bỏ qua lưu log")
            except Exception as log_error:
                _logger.warning(f"Không thể lưu lịch sử gửi thông báo xác nhận: {str(log_error)}", exc_info=True)
        except Exception as e:
            _logger.warning(f"Không thể gửi thông báo xác nhận: {str(e)}", exc_info=True)

    def _create_default_email_template(self):
        return False

    @api.model
    def check_maturity_dates(self):
        today = fields.Date.today()
        transactions = self.env['portfolio.transaction'].search([
            ('transaction_type', '=', 'buy'),
            ('status', '=', 'completed'),
            ('term_months', '>', 0)
        ])
        notifications_created = 0
        notifications_sent = 0
        for transaction in transactions:
            # Kiểm tra user_id
            if not transaction.user_id:
                continue
            
            maturity_date = self._calculate_maturity_date(transaction)
            if not maturity_date:
                continue
            if maturity_date == today:
                # Luôn tạo và gửi thông báo mới, không kiểm tra existing notification
                # Cho phép gửi lại nhiều lần
                notification = self.create({
                    'transaction_id': transaction.id,
                    'maturity_date': maturity_date,
                    'state': 'draft'
                })
                notifications_created += 1
                try:
                    notification.action_send_notification()
                    notifications_sent += 1
                except Exception as e:
                    _logger.error(f"Không thể gửi thông báo cho lệnh {transaction.name}: {str(e)}")
        _logger.info(f"Đã kiểm tra đáo hạn: Tạo {notifications_created} thông báo, gửi {notifications_sent} thông báo")
        return {
            'notifications_created': notifications_created,
            'notifications_sent': notifications_sent
        }

    @api.model
    def _calculate_maturity_date(self, transaction):
        if not transaction.term_months or transaction.term_months <= 0:
            return False
        start_date = transaction.date_end or transaction.create_date
        if not start_date:
            return False
        if isinstance(start_date, datetime):
            start_date = start_date.date()
        elif isinstance(start_date, fields.Datetime):
            start_date = start_date.date()
        try:
            days_to_add = transaction.term_months * 30
            maturity_date = start_date + timedelta(days=days_to_add)
        except Exception:
            return False
        return maturity_date

    @api.model
    def action_expire_notification(self):
        expired_days = 7
        cutoff_date = fields.Date.today() - timedelta(days=expired_days)
        expired_notifications = self.search([
            ('maturity_date', '<=', cutoff_date),
            ('investor_response', '=', 'pending'),
            ('state', '=', 'sent')
        ])
        expired_notifications.write({
            'investor_response': 'expired',
            'state': 'expired'
        })
        _logger.info(f"Đã đánh dấu {len(expired_notifications)} thông báo hết hạn")
        return len(expired_notifications)

    @api.model
    def send_maturity_notifications_manual(self):
        """
        Method cho nút bấm thủ công (DEMO MODE): 
        Gửi thông báo đáo hạn cho TẤT CẢ lệnh mua đã hoàn thành có kỳ hạn,
        bất kể ngày đáo hạn thực tế.
        """
        transactions = self.env['portfolio.transaction'].search([
            ('transaction_type', '=', 'buy'),
            ('status', '=', 'completed'),
            ('term_months', '>', 0)
        ])
        
        _logger.info(f"[MANUAL-DEMO] Tìm thấy {len(transactions)} lệnh mua đã hoàn thành có term_months > 0")
        
        notifications_created = 0
        notifications_sent = 0
        skipped_no_user = 0
        
        for transaction in transactions:
            if not transaction.user_id:
                skipped_no_user += 1
                continue
            
            maturity_date = self._calculate_maturity_date(transaction)
            if not maturity_date:
                maturity_date = fields.Date.today()
            
            try:
                # Tạo notification
                notification = self.create({
                    'transaction_id': transaction.id,
                    'maturity_date': maturity_date,
                    'state': 'draft'
                })
                notifications_created += 1
                
                # Gửi ngay lập tức
                try:
                    notification.action_send_notification()
                    notifications_sent += 1
                except Exception as e:
                    _logger.error(f"[MANUAL-DEMO] Không thể gửi thông báo cho lệnh {transaction.name}: {str(e)}")
            except Exception as e:
                _logger.error(f"[MANUAL-DEMO] Không thể tạo notification cho lệnh {transaction.name}: {str(e)}")
        
        _logger.info(f"[MANUAL-DEMO] Hoàn tất: Tạo {notifications_created}, Gửi {notifications_sent}")
        
        return {
            'notifications_created': notifications_created,
            'notifications_sent': notifications_sent,
            'total_transactions': len(transactions),
            'skipped_no_user': skipped_no_user
        }



