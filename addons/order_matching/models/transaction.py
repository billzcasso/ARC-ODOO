from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
import json
import logging
from datetime import datetime
from ..utils import mround
from ..utils import const, validators
from ..utils.timezone_utils import format_datetime_user_tz, format_date_user_tz

_logger = logging.getLogger(__name__)


class PortfolioTransaction(models.Model):
    _inherit = "portfolio.transaction"
    _description = "Portfolio Transaction Extension for Order Matching"

    # Thêm các trường mới cho transaction list mà không ảnh hưởng đến model gốc
    source = fields.Selection([
        ('portal', 'Portal'),
        ('sale', 'Sale Portal'),
        ('portfolio', 'Portfolio')
    ], string="Source", default='portfolio', tracking=True)
    
    approved_by = fields.Many2one("res.users", string="Approved By", tracking=True)
    approved_at = fields.Datetime(string="Approved At", tracking=True)
    contract_pdf_path = fields.Char(string="Contract PDF Path")
    # Computed field for account number
    account_number = fields.Char(string="Số tài khoản", compute='_compute_account_number', store=True)
    
    # Computed field for investor name
    investor_name = fields.Char(string="Tên nhà đầu tư", compute='_compute_investor_name', store=True)
    
    # Computed field for investor phone
    investor_phone = fields.Char(string="Số điện thoại", compute='_compute_investor_phone', store=True)
    
    # Field for current NAV/unit price
    current_nav = fields.Float(string="Giá NAV hiện tại", digits=(16, 2), help="Giá NAV hiện tại của quỹ tại thời điểm giao dịch")
    
    # Field for transaction price per unit
    price = fields.Monetary(string="Giá đơn vị", required=True, tracking=True, help="Giá đơn vị cho giao dịch này")
    
    # Fields for order matching
    # QUAN TRỌNG: matched_units là computed field tính từ executions để đảm bảo không sai số
    matched_units = fields.Float(
        string="Số lượng khớp", 
        digits=(16, 2), 
        compute='_compute_matched_units',
        store=True,
        help="Số lượng CCQ đã được khớp lệnh (tính từ tổng matched_quantity của tất cả executions)"
    )
    is_matched = fields.Boolean(string="Đã khớp lệnh", default=False, help="Lệnh đã được khớp")
    matched_order_ids = fields.One2many('transaction.matched.orders', 'buy_order_id', string="Lệnh mua đã khớp")
    matched_sell_order_ids = fields.One2many('transaction.matched.orders', 'sell_order_id', string="Lệnh bán đã khớp")
    # Field để tương thích với các view khác (nếu cần)
    matched_order_id = fields.Many2one(
        'transaction.matched.orders',
        string='Lệnh khớp (tương thích)',
        compute='_compute_matched_order_id',
        store=False,
        help='Field tương thích - sử dụng matched_order_ids hoặc matched_sell_order_ids thay thế'
    )
    # Field để tương thích với các view khác (nếu cần)
    split_quantity = fields.Float(
        string='Số lượng tách',
        compute='_compute_split_quantity',
        store=False,
        help='Field tương thích - số lượng CCQ được tách ra từ lệnh gốc'
    )
    # Field để tương thích với các view khác (nếu cần)
    split_date = fields.Datetime(
        string='Ngày tách',
        compute='_compute_split_date',
        store=False,
        help='Field tương thích - ngày tách lệnh (dùng create_date của lệnh con đầu tiên)'
    )
    # Field để tương thích với các view khác (nếu cần)
    match_date = fields.Datetime(
        string='Ngày khớp',
        compute='_compute_match_date',
        store=False,
        help='Field tương thích - ngày khớp lệnh đầu tiên (từ matched_order_ids hoặc matched_sell_order_ids)'
    )
    remaining_units = fields.Float(string="Số lượng còn lại", compute='_compute_remaining_units', store=True)
    
    @api.constrains('status')
    def _check_status_transition(self):
        """Kiểm tra chuyển đổi trạng thái"""
        for record in self:
            if record._origin and record._origin.status and record.status != record._origin.status:
                try:
                    validators.OrderValidator.validate_status_transition(record._origin.status, record.status)
                except ValidationError as e:
                    raise ValidationError(_("Lỗi chuyển đổi trạng thái cho lệnh %s: %s") % (record.name or record.id, str(e)))
    
    # Field cho khớp lệnh liên tục
    ccq_remaining_to_match = fields.Float(
        string="CCQ còn lại cần khớp", 
        digits=(16, 2),
        compute='_compute_ccq_remaining_to_match', 
        store=True,
        help="Số lượng CCQ còn lại cần khớp lệnh"
    )
    
    # Fields để theo dõi tách lệnh tự động
    parent_order_id = fields.Many2one(
        'portfolio.transaction',
        string='Lệnh gốc',
        help='Lệnh gốc nếu đây là lệnh được tách ra từ lệnh khác',
        ondelete='cascade'
    )
    split_order_ids = fields.One2many(
        'portfolio.transaction',
        'parent_order_id',
        string='Lệnh con',
        help='Các lệnh được tách ra từ lệnh này'
    )
    is_split_order = fields.Boolean(
        string='Lệnh được tách',
        compute='_compute_is_split_order',
        store=True,
        help='Đánh dấu đây là lệnh được tách tự động từ lệnh gốc'
    )
    
    # Field sequence để tương thích với Odoo form view (nếu cần)
    sequence = fields.Integer(
        string='Sequence',
        default=10,
        help='Thứ tự hiển thị (nếu cần)'
    )

    # Số liệu dựa trên các cặp lệnh đã ghi nhận (transaction.matched.orders)
    pair_matched_units = fields.Float(
        string="Số lượng đã khớp (cặp)",
        compute='_compute_pair_based_quantities',
        store=False,
        digits=(16, 2),
    )
    pair_remaining_units = fields.Float(
        string="Số lượng còn lại (cặp)",
        compute='_compute_pair_based_quantities',
        store=False,
        digits=(16, 2),
    )
    is_partial_pair = fields.Boolean(
        string="Khớp một phần (cặp)",
        compute='_compute_is_partial_pair',
        search='_search_is_partial_pair',
        store=False,
    )

    # Bổ sung trường kỳ hạn/lãi suất để đồng bộ fund_management
    term_months = fields.Integer(string="Kỳ hạn (tháng)")
    interest_rate = fields.Float(string="Lãi suất (%)", digits=(16, 2))
    
    # Field để lưu trạng thái gửi lên sàn
    sent_to_exchange = fields.Boolean(string="Đã gửi lên sàn", default=False, help="Giao dịch đã được gửi lên sàn")
    sent_to_exchange_at = fields.Datetime(string="Thời gian gửi lên sàn", help="Thời điểm giao dịch được gửi lên sàn")
    
    # Computed field cho ngày đáo hạn
    maturity_date = fields.Date(
        string='Ngày đáo hạn',
        compute='_compute_maturity_date',
        store=True,
        help='Ngày đáo hạn được tính từ date_end hoặc create_date + term_months'
    )
    
    # One2many để liên kết với thông báo đáo hạn
    maturity_notification_ids = fields.One2many(
        'transaction.maturity.notification',
        'transaction_id',
        string='Thông báo đáo hạn'
    )
    maturity_notification_count = fields.Integer(
        string='Số thông báo đáo hạn',
        compute='_compute_maturity_notification_count'
    )

    @api.depends('matched_order_ids.matched_quantity', 'matched_sell_order_ids.matched_quantity')
    def _compute_matched_units(self):
        """
        Tính toán matched_units từ tổng matched_quantity của tất cả executions (chuẩn quốc tế)
        Không bao giờ sai số vì tính trực tiếp từ execution records (immutable)
        """
        for record in self:
            matched_total = 0.0
            if record.transaction_type == 'buy':
                # Lệnh mua: tính từ matched_order_ids
                matched_total = sum(record.matched_order_ids.mapped('matched_quantity'))
            elif record.transaction_type == 'sell':
                # Lệnh bán: tính từ matched_sell_order_ids
                matched_total = sum(record.matched_sell_order_ids.mapped('matched_quantity'))
            record.matched_units = float(matched_total or 0)

    @api.depends('units', 'matched_units')
    def _compute_remaining_units(self):
        """
        Tính toán remaining_units chính xác từ units - matched_units (theo chuẩn Stock Exchange)
        matched_units đã được tính từ executions nên không bao giờ sai số
        """
        for record in self:
            units_total = float(record.units or 0)
            matched_total = float(record.matched_units or 0)
            remaining = max(0.0, units_total - matched_total)
            record.remaining_units = remaining
            # Đồng bộ trạng thái: nếu đã khớp hết (remaining = 0) và đã có matched_units
            # mà status vẫn đang pending thì tự động chuyển sang completed.
            # Điều này xử lý cả các trường hợp execution được tạo ở nơi khác
            # nhưng chưa gọi logic cập nhật status thủ công.
            try:
                if record.status == 'pending' and matched_total > 0 and remaining <= 0:
                    record.status = 'completed'
                # Cập nhật cờ is_matched để tiện filter/report
                record.is_matched = remaining <= 0
            except Exception:
                # Không để compute bị vỡ vì lỗi nhỏ khi sync status
                pass
    
    @api.depends('matched_order_ids', 'matched_sell_order_ids')
    def _compute_matched_order_id(self):
        """Compute matched_order_id để tương thích với các view khác"""
        for record in self:
            # Lấy matched order đầu tiên từ matched_order_ids hoặc matched_sell_order_ids
            matched_order = False
            if record.transaction_type == 'buy' and record.matched_order_ids:
                matched_order = record.matched_order_ids[0]
            elif record.transaction_type == 'sell' and record.matched_sell_order_ids:
                matched_order = record.matched_sell_order_ids[0]
            record.matched_order_id = matched_order.id if matched_order else False
    
    @api.depends('split_order_ids', 'units', 'matched_units')
    def _compute_split_quantity(self):
        """Compute split_quantity để tương thích với các view khác"""
        for record in self:
            # Tính tổng số lượng của các lệnh con được tách ra
            if record.split_order_ids:
                record.split_quantity = sum(record.split_order_ids.mapped('units'))
            else:
                # Nếu là lệnh con, số lượng tách = units của lệnh này
                record.split_quantity = record.units if record.is_split_order else 0.0
    
    @api.depends('split_order_ids', 'create_date', 'is_split_order')
    def _compute_split_date(self):
        """Compute split_date để tương thích với các view khác"""
        for record in self:
            # Nếu là lệnh gốc có lệnh con, lấy create_date của lệnh con đầu tiên
            if record.split_order_ids:
                first_split = record.split_order_ids.sorted('create_date')[0]
                record.split_date = first_split.create_date if first_split.create_date else False
            # Nếu là lệnh con, lấy create_date của chính nó
            elif record.is_split_order:
                record.split_date = record.create_date if record.create_date else False
            else:
                record.split_date = False
    
    @api.depends('matched_order_ids', 'matched_sell_order_ids')
    def _compute_match_date(self):
        """Compute match_date để tương thích với các view khác"""
        for record in self:
            # Lấy match_date từ matched order đầu tiên
            matched_order = False
            if record.transaction_type == 'buy' and record.matched_order_ids:
                matched_order = record.matched_order_ids.sorted('match_date')[0]
            elif record.transaction_type == 'sell' and record.matched_sell_order_ids:
                matched_order = record.matched_sell_order_ids.sorted('match_date')[0]
            
            if matched_order and matched_order.match_date:
                record.match_date = matched_order.match_date
            else:
                record.match_date = False

    @api.depends('units', 'matched_units', 'status')
    def _compute_ccq_remaining_to_match(self):
        """Tính số lượng CCQ còn lại cần khớp lệnh"""
        for record in self:
            # Chỉ tính cho các lệnh còn đang chờ khớp (pending)
            # và còn số lượng chưa khớp (remaining_units > 0)
            if record.status == 'pending' and record.remaining_units > 0:
                record.ccq_remaining_to_match = record.remaining_units
            else:
                record.ccq_remaining_to_match = 0.0

    def _compute_pair_based_quantities(self):
        """Tính matched/remaining dựa trên transaction.matched.orders theo vai trò của lệnh.
        - Nếu lệnh là BUY: chỉ cộng các bản ghi có buy_order_id = id.
        - Nếu lệnh là SELL: chỉ cộng các bản ghi có sell_order_id = id.
        """
        Matched = self.env['transaction.matched.orders'].sudo()
        for rec in self:
            try:
                if not rec.id:
                    rec.pair_matched_units = 0.0
                    rec.pair_remaining_units = rec.units or 0.0
                    continue
                units_total = float(rec.units or 0.0)
                if rec.transaction_type == 'buy':
                    domain = [('buy_order_id', '=', rec.id), ('status', '=', 'done')]
                elif rec.transaction_type == 'sell':
                    domain = [('sell_order_id', '=', rec.id), ('status', '=', 'done')]
                else:
                    domain = [('id', '=', 0)]
                # Tổng matched theo vai trò
                total = sum(Matched.search(domain).mapped('matched_quantity'))
                rec.pair_matched_units = min(float(total or 0.0), units_total)
                rec.pair_remaining_units = max(units_total - rec.pair_matched_units, 0.0)
            except Exception:
                rec.pair_matched_units = 0.0
                rec.pair_remaining_units = float(rec.units or 0.0)

    def _compute_is_partial_pair(self):
        for rec in self:
            try:
                rec.is_partial_pair = (rec.status == 'pending' and rec.pair_matched_units > 0 and rec.pair_remaining_units > 0)
            except Exception:
                rec.is_partial_pair = False

    def _search_is_partial_pair(self, operator, value):
        """Custom search cho is_partial_pair dựa trên bảng matched orders.
        Hỗ trợ tìm True/False.
        """
        if operator not in ('=', '=='):
            # Không hỗ trợ toán tử khác
            return [('id', 'in', [])]
        want_true = bool(value)
        cr = self.env.cr
        try:
            cr.execute(
                """
                SELECT t.id
                FROM portfolio_transaction t
                JOIN (
                    SELECT buy_order_id AS tx_id, SUM(matched_quantity) AS qty FROM transaction_matched_orders
                    WHERE status = 'done' AND buy_order_id IS NOT NULL
                    GROUP BY buy_order_id
                    UNION ALL
                    SELECT sell_order_id AS tx_id, SUM(matched_quantity) AS qty FROM transaction_matched_orders
                    WHERE status = 'done' AND sell_order_id IS NOT NULL
                    GROUP BY sell_order_id
                ) m ON m.tx_id = t.id
                GROUP BY t.id, t.status, t.units
                HAVING t.status = 'pending' AND SUM(m.qty) > 0 AND SUM(m.qty) < COALESCE(t.units, 0)
                """
            )
            ids = [row[0] for row in cr.fetchall()]
        except Exception:
            ids = []
        if want_true:
            return [('id', 'in', ids)]
        # False: lấy các bản ghi không thuộc danh sách trên
        return [('id', 'not in', ids)]

    # Computed field để hiển thị số lượng matched orders
    matched_orders_count = fields.Integer(
        string="Số lần khớp lệnh",
        compute='_compute_matched_orders_count',
        store=False,
        help="Số lượng lần khớp lệnh"
    )

    @api.depends('matched_order_ids', 'matched_sell_order_ids', 'transaction_type')
    def _compute_matched_orders_count(self):
        """Tính số lượng matched orders"""
        for record in self:
            if record.transaction_type == 'buy':
                record.matched_orders_count = len(record.matched_order_ids)
            elif record.transaction_type == 'sell':
                record.matched_orders_count = len(record.matched_sell_order_ids)
            else:
                record.matched_orders_count = 0

    @api.depends('user_id', 'user_id.partner_id')
    def _compute_account_number(self):
        """Compute account number from status_info"""
        for record in self:
            try:
                if record.user_id and record.user_id.partner_id:
                    # Check if status.info model exists
                    if 'status.info' in self.env:
                        status_info = self.env['status.info'].sudo().search([('partner_id', '=', record.user_id.partner_id.id)], limit=1)
                        record.account_number = status_info.account_number if status_info and status_info.account_number else ''
                    else:
                        record.account_number = ''
                else:
                    record.account_number = ''
            except Exception as e:
                record.account_number = ''

    @api.depends('user_id', 'user_id.partner_id')
    def _compute_investor_name(self):
        """Compute investor name"""
        for record in self:
            try:
                if record.user_id and record.user_id.partner_id:
                    record.investor_name = record.user_id.partner_id.name or ''
                elif record.user_id:
                    record.investor_name = record.user_id.name or ''
                else:
                    record.investor_name = ''
            except Exception as e:
                record.investor_name = ''

    @api.depends('user_id', 'user_id.partner_id')
    def _compute_investor_phone(self):
        """Compute investor phone"""
        for record in self:
            try:
                if record.user_id and record.user_id.partner_id:
                    record.investor_phone = record.user_id.partner_id.phone or ''
                else:
                    record.investor_phone = ''
            except Exception as e:
                record.investor_phone = ''
    
    @api.depends('fund_id', 'transaction_type', 'units', 'created_at', 'is_split_order', 'parent_order_id')
    def _compute_name(self):
        """Override _compute_name để thêm indicator [S] cho lệnh nhỏ"""
        # Gọi method gốc từ parent
        super()._compute_name()
        
        # Thêm indicator [S] cho lệnh nhỏ
        for record in self:
            if record.name and getattr(record, 'is_split_order', False):
                # Kiểm tra xem đã có indicator chưa (tránh duplicate)
                if '[S]' not in record.name:
                    record.name = "%s [S]" % record.name

    @api.depends('date_end', 'create_date', 'term_months')
    def _compute_maturity_date(self):
        """Tính ngày đáo hạn từ date_end hoặc create_date + term_months"""
        for record in self:
            if not record.term_months or record.term_months <= 0:
                record.maturity_date = False
                continue
            
            # Ưu tiên dùng date_end nếu có, nếu không dùng create_date
            start_date = record.date_end or record.create_date
            
            if not start_date:
                record.maturity_date = False
                continue
            
            # Chuyển sang date nếu là datetime
            if isinstance(start_date, datetime):
                start_date = start_date.date()
            elif hasattr(start_date, 'date'):
                start_date = start_date.date()
            
            # Tính ngày đáo hạn: start_date + term_months (30 ngày/tháng)
            try:
                from datetime import timedelta
                days_to_add = record.term_months * 30
                record.maturity_date = start_date + timedelta(days=days_to_add)
            except Exception:
                record.maturity_date = False

    @api.depends('maturity_notification_ids')
    def _compute_maturity_notification_count(self):
        """Đếm số thông báo đáo hạn"""
        for record in self:
            record.maturity_notification_count = len(record.maturity_notification_ids)
    
    @api.depends('parent_order_id')
    def _compute_is_split_order(self):
        """Tính toán xem đây có phải là lệnh được tách không"""
        for record in self:
            record.is_split_order = bool(record.parent_order_id)
    

    @api.onchange('status')
    def _onchange_status(self):
        """Auto update approved_by and approved_at when status changes to completed"""
        for record in self:
            if record.status == 'completed' and not record.approved_by:
                record.approved_by = self.env.user
                record.approved_at = fields.Datetime.now()

    @api.model_create_multi
    def create(self, vals_list):
        """Override create to validate: nhà đầu tư không thể đặt lệnh mua nếu đang có lệnh bán pending và ngược lại"""
        for vals in vals_list:
            # Chỉ validate cho lệnh mua/bán, không validate cho các loại khác
            transaction_type = vals.get('transaction_type')
            user_id = vals.get('user_id')
            fund_id = vals.get('fund_id')
            
            if transaction_type in ['buy', 'sell'] and user_id and fund_id:
                # SKIP validation cho Market Maker hoặc user internal
                source = vals.get('source')
                user_rec = self.env['res.users'].browse(user_id)
                # Market maker thường có source='sale' hoặc 'market_maker'
                # Hoặc user internal có quyền market maker
                if source in ['sale', 'market_maker']:
                    continue
                # Kiểm tra quyền Market Maker từ permission management
                is_mm = False
                try:
                    if hasattr(user_rec, 'permission_management_ids'):
                         permission_rec = user_rec.permission_management_ids.filtered(
                            lambda p: p.permission_type == 'investor_user' and p.is_market_maker
                        )
                         if permission_rec:
                             is_mm = True
                except Exception:
                    pass
                
                if is_mm:
                    continue

                # RÀNG BUỘC: User không thể có cả lệnh mua và bán pending cùng lúc cho cùng một quỹ
                # Chỉ kiểm tra xung đột trên cùng một quỹ
                existing_orders = self.env['portfolio.transaction'].search([
                    ('user_id', '=', user_id),
                    ('status', '=', 'pending'),
                    ('transaction_type', 'in', ['buy', 'sell']),
                    ('remaining_units', '>', 0),  # Chỉ tính lệnh còn số lượng cần khớp
                    ('fund_id', '=', fund_id),
                ])
                
                fund_name = self.env['portfolio.fund'].browse(fund_id).name or _('quỹ này')
                # Nếu đang tạo lệnh mua, kiểm tra xem có lệnh bán pending cùng quỹ không
                if transaction_type == 'buy':
                    existing_sell = existing_orders.filtered(lambda o: o.transaction_type == 'sell')
                    if existing_sell:
                        sell_count = len(existing_sell)
                        raise ValidationError(_(
                            'Không thể thực hiện đặt lệnh mua. '
                            'Nhà đầu tư này đang có %d lệnh bán đang chờ xử lý tại quỹ %s. '
                            'Vui lòng đợi lệnh bán được xử lý xong hoặc hủy lệnh bán trước khi đặt lệnh mua mới.'
                        ) % (sell_count, fund_name))
                
                # Nếu đang tạo lệnh bán, kiểm tra xem có lệnh mua pending cùng quỹ không
                elif transaction_type == 'sell':
                    existing_buy = existing_orders.filtered(lambda o: o.transaction_type == 'buy')
                    if existing_buy:
                        buy_count = len(existing_buy)
                        raise ValidationError(_(
                            'Không thể thực hiện đặt lệnh bán. '
                            'Nhà đầu tư này đang có %d lệnh mua đang chờ xử lý tại quỹ %s. '
                            'Vui lòng đợi lệnh mua được xử lý xong hoặc hủy lệnh mua trước khi đặt lệnh bán mới.'
                        ) % (buy_count, fund_name))
        
        return super(PortfolioTransaction, self).create(vals_list)

    def write(self, vals):
        """Override write to handle status change và validate ràng buộc xung đột lệnh."""
        # QUAN TRỌNG: Validate ràng buộc xung đột trước khi write
        # Nếu user đang thay đổi transaction_type hoặc fund_id, cần kiểm tra lại ràng buộc
        if 'transaction_type' in vals or 'fund_id' in vals:
            for record in self:
                new_transaction_type = vals.get('transaction_type', record.transaction_type)
                new_fund_id = vals.get('fund_id', record.fund_id.id if record.fund_id else False)
                user_id = record.user_id.id if record.user_id else False
                
                # Chỉ validate nếu là lệnh buy/sell và có user_id, fund_id
                if new_transaction_type in ['buy', 'sell'] and user_id and new_fund_id:
                    # SKIP validation cho Market Maker
                    source = record.source
                    if source in ['sale', 'market_maker']:
                        continue
                    
                    user_rec = record.user_id
                    is_mm = False
                    try:
                        if hasattr(user_rec, 'permission_management_ids'):
                             permission_rec = user_rec.permission_management_ids.filtered(
                                lambda p: p.permission_type == 'investor_user' and p.is_market_maker
                            )
                             if permission_rec:
                                 is_mm = True
                    except Exception:
                        pass
                    
                    if is_mm:
                        continue

                    # Tìm các lệnh pending khác của cùng user, cùng fund
                    existing_orders = self.env['portfolio.transaction'].search([
                        ('id', '!=', record.id),  # Loại trừ chính record đang được update
                        ('user_id', '=', user_id),
                        ('status', '=', 'pending'),
                        ('transaction_type', 'in', ['buy', 'sell']),
                        ('remaining_units', '>', 0),
                        ('fund_id', '=', new_fund_id),
                    ])
                    
                    fund_name = self.env['portfolio.fund'].browse(new_fund_id).name or _('quỹ này')
                    
                    # Nếu đang chuyển sang lệnh mua, kiểm tra xem có lệnh bán pending cùng quỹ không
                    if new_transaction_type == 'buy':
                        existing_sell = existing_orders.filtered(lambda o: o.transaction_type == 'sell')
                        if existing_sell:
                            sell_count = len(existing_sell)
                            raise ValidationError(_(
                                'Không thể chuyển sang lệnh mua. '
                                'Nhà đầu tư này đang có %d lệnh bán đang chờ xử lý tại quỹ %s. '
                                'Vui lòng đợi lệnh bán được xử lý xong hoặc hủy lệnh bán trước khi đặt lệnh mua mới.'
                            ) % (sell_count, fund_name))
                    
                    # Nếu đang chuyển sang lệnh bán, kiểm tra xem có lệnh mua pending cùng quỹ không
                    elif new_transaction_type == 'sell':
                        existing_buy = existing_orders.filtered(lambda o: o.transaction_type == 'buy')
                        if existing_buy:
                            buy_count = len(existing_buy)
                            raise ValidationError(_(
                                'Không thể chuyển sang lệnh bán. '
                                'Nhà đầu tư này đang có %d lệnh mua đang chờ xử lý tại quỹ %s. '
                                'Vui lòng đợi lệnh mua được xử lý xong hoặc hủy lệnh mua trước khi đặt lệnh bán mới.'
                            ) % (buy_count, fund_name))
        
        res = super().write(vals)
        
        for record in self:
            if 'status' in vals and vals['status'] == 'completed' and record.status == 'completed':
                # Auto set approved_by and approved_at if not provided
                if not record.approved_by:
                    record.approved_by = self.env.user
                if not record.approved_at:
                    record.approved_at = fields.Datetime.now()
                # Set date_end = thời điểm khớp/hoàn tất nếu chưa có
                if not getattr(record, 'date_end', False):
                    try:
                        record.date_end = fields.Datetime.now()
                    except Exception:
                        pass

                # Không cập nhật Investment ở transaction_list; ủy quyền cho fund_management

                # Try to match orders when status changes to completed
                if record.transaction_type in ['buy', 'sell'] and not record.is_matched:
                    self.with_context(bypass_match_check=True).action_match_orders()
            
        
        return res
    
    def _update_parent_order_when_split_completed(self, parent_order=None):
        """
        DEPRECATED: Method này không còn được sử dụng vì không còn tách order nữa.
        Giữ lại để tránh lỗi nếu có code cũ gọi method này.
        """
        _logger.warning("[DEPRECATED] _update_parent_order_when_split_completed called but split orders are no longer used")
        return
        """
        Cập nhật lệnh gốc khi lệnh con khớp đủ hoặc matched_units thay đổi
        Tính tổng matched_units từ TẤT CẢ lệnh con (không chỉ completed)
        và remaining_units từ tổng remaining của các lệnh con chưa khớp đủ
        
        Args:
            parent_order: Lệnh gốc cần cập nhật (nếu None, dùng self)
        """
        try:
            # Nếu không có parent_order, dùng self (cho trường hợp gọi từ instance method)
            if parent_order is None:
                parent_order = self
                
            if not parent_order or not parent_order.exists():
                return
            
            # Refresh để lấy dữ liệu mới nhất từ database
            parent_order.invalidate_recordset(['split_order_ids', 'matched_units', 'remaining_units', 'units'])
            
            # Tính tổng matched_units từ TẤT CẢ lệnh con (không chỉ completed)
            # Vì lệnh con có thể khớp một phần (matched_units > 0 nhưng chưa completed)
            all_split_orders = parent_order.split_order_ids
            total_matched_from_splits = sum(all_split_orders.mapped('matched_units'))
            
            # Tính tổng remaining_units từ các lệnh con chưa khớp đủ (status = pending)
            pending_split_orders = all_split_orders.filtered(lambda o: o.status == 'pending')
            total_remaining_from_splits = sum(pending_split_orders.mapped('remaining_units'))
            
            # Cập nhật lệnh gốc
            parent_units = float(parent_order.units or 0)
            
            # Tính tổng units của lệnh con
            split_total_units = sum(all_split_orders.mapped('units'))
            
            # Phần đã khớp trực tiếp (trước khi tách) = units gốc - tổng units lệnh con
            # Vì lệnh con đại diện cho phần còn lại chưa khớp đã được tách ra
            if split_total_units > 0:
                # Có lệnh con: phần khớp trực tiếp = units gốc - tổng units lệnh con
                direct_matched = max(0, parent_units - split_total_units)
            else:
                # Không có lệnh con: phần khớp trực tiếp = matched_units hiện tại
                direct_matched = float(parent_order.matched_units or 0)
            
            # Tổng matched = phần khớp trực tiếp + tổng matched từ lệnh con
            total_matched = direct_matched + total_matched_from_splits
            total_matched = min(total_matched, parent_units)  # Không vượt quá units gốc
            
            # remaining_units = tổng remaining từ lệnh con chưa khớp đủ
            total_remaining = total_remaining_from_splits
            
            # Đảm bảo: matched + remaining <= units
            if total_matched + total_remaining > parent_units:
                # Điều chỉnh: remaining = units - matched
                total_remaining = max(0, parent_units - total_matched)
            
            # Kiểm tra tất cả lệnh con đã completed chưa
            all_completed = all_split_orders and all(o.status == 'completed' for o in all_split_orders)
            
            # Nếu tất cả lệnh con đã completed và tổng matched >= units gốc
            if all_completed and total_matched >= parent_units:
                parent_order.sudo().write({
                    'matched_units': parent_units,
                    'remaining_units': 0,
                    'ccq_remaining_to_match': 0,
                    'status': 'completed',
                    'is_matched': True,
                })
                _logger.info(f"[UPDATE PARENT] Lệnh gốc {parent_order.id}: Tất cả lệnh con đã khớp đủ, status = completed. Matched={total_matched}, Units={parent_units}")
            else:
                # Cập nhật matched_units và remaining_units dựa trên tổng từ lệnh con
                parent_order.sudo().write({
                    'matched_units': total_matched,
                    'remaining_units': total_remaining,
                    'ccq_remaining_to_match': total_remaining,
                    'status': 'pending' if total_remaining > 0 else 'completed',
                    'is_matched': total_remaining <= 0,
                })
                _logger.info("[UPDATE PARENT] Lệnh gốc %s: matched_units=%s (direct=%s, from_splits=%s), remaining_units=%s (from_splits=%s)",
                             parent_order.id, total_matched, direct_matched, total_matched_from_splits,
                             total_remaining, total_remaining_from_splits)
        except Exception as e:
            _logger.error("[UPDATE PARENT ERROR] Lỗi khi cập nhật lệnh gốc: %s", str(e), exc_info=True)

    def action_approve(self):
        """Custom approve action for transaction list (không xử lý Investment)."""
        for record in self:
            if record.status != 'pending':
                raise ValidationError(_("Only pending transactions can be approved."))
            record.status = 'completed'
            record.approved_by = self.env.user
            record.approved_at = fields.Datetime.now()
            # Set date_end tại thời điểm phê duyệt (coi như khớp)
            try:
                record.date_end = fields.Datetime.now()
            except Exception:
                pass

    def action_close_partial(self):
        """
        Đóng phần còn lại của lệnh khớp một phần: đặt remaining_units = 0 và chuyển completed.
        Dùng khi cần kết thúc lệnh để tránh tồn đọng trong quy trình khớp liên tục.
        Tính toán remaining_units chính xác từ units - matched_units (theo chuẩn Stock Exchange)
        """
        for record in self.sudo():
            # Tính toán remaining_units chính xác từ units - matched_units
            units_total = float(record.units or 0)
            matched_total = float(record.matched_units or 0)
            remaining = max(0.0, units_total - matched_total)
            
            # Chỉ áp dụng cho lệnh đang pending và đã khớp một phần
            if record.status != 'pending' or matched_total <= 0 or remaining <= 0:
                raise ValidationError(_("Chỉ có thể đóng lệnh đang khớp một phần (pending, matched > 0, remaining > 0)."))

            # Đặt matched_units = units để remaining_units = 0 (theo chuẩn Stock Exchange)
            vals = {
                'matched_units': units_total,  # Đặt matched_units = units để remaining = 0
                'status': 'completed',
                'approved_by': self.env.user,
                'approved_at': fields.Datetime.now(),
            }
            # remaining_units sẽ tự động tính lại = 0 sau khi matched_units = units

            # Bỏ cập nhật Investment phía fund_management (tránh duplicate)
            record.with_context(bypass_investment_update=True).write(vals)

        return True

    def action_cancel_list(self):
        """Custom cancel action for transaction list (không xử lý Investment)."""
        for record in self:
            record.status = 'cancelled'

    # ===================== Investment helpers (deprecated) =====================
    def _get_effective_matched_units(self):
        """Xác định số CCQ hiệu lực để cập nhật investment"""
        self.ensure_one()
        matched = float(getattr(self, 'matched_units', 0) or 0)
        if matched > 0:
            return matched
        units = float(getattr(self, 'units', 0) or 0)
        return max(units, 0.0)

    def action_match_orders(self):
        """Deprecated: Logic khớp lệnh đã được chuyển sang OrderMatchingEngine trong controller"""
        _logger.warning("action_match_orders is deprecated. Use OrderMatchingEngine in controller instead.")
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _("Information"),
                'message': _("Order matching is now handled by the OrderMatchingEngine. Please use the API endpoint."),
                'sticky': False,
                'type': 'info',
            }
        }

    @api.model
    def get_transaction_data(self, status_filter=None, source_filter=None):
        """Get transaction data for the frontend"""
        domain = []
        
        
        if status_filter and status_filter.strip():
            status_filter = status_filter.lower().strip()
            # Map status from frontend to database
            frontend_to_db_mapping = {
                'pending': ['pending'],
                'completed': ['completed'],
                'approved': ['completed'],  # Approved tab should show completed transactions
                'cancelled': ['cancelled']
            }
            
            mapped_statuses = frontend_to_db_mapping.get(status_filter, [status_filter])
            if len(mapped_statuses) == 1:
                domain.append(('status', '=', mapped_statuses[0]))
            else:
                domain.append(('status', 'in', mapped_statuses))
            
        
        if source_filter and source_filter.strip():
            domain.append(('source', '=', source_filter))
        
        # Chỉ hiển thị lệnh gốc cho nhà đầu tư (không hiển thị lệnh con đã tách)
        # Lệnh gốc là lệnh không có parent_order_id (parent_order_id = False)
        domain.append(('parent_order_id', '=', False))
        
        transactions = self.search(domain)
        
        result = []
        for trans in transactions:
            def _amount_ex_fee(tx):
                try:
                    fee_val = getattr(tx, 'fee', 0) or 0
                    amt_val = tx.amount or 0
                    return max(amt_val - fee_val, 0)
                except Exception:
                    return tx.amount or 0
            # Kiểm tra xem có hợp đồng không
            has_contract = bool(trans.contract_pdf_path)
            contract_url = ''
            contract_download_url = ''
            if has_contract:
                contract_url = "/transaction-list/contract/%s" % trans.id
                contract_download_url = "/transaction-list/contract/%s?download=1" % trans.id
            
            # Map status trước khi thêm vào result
            frontend_status = trans.status  # Use status as-is since mapping is in domain already
            
            result.append({
                'id': trans.id,
                'name': trans.name,
                'user_id': trans.user_id.id,
                'account_number': trans.account_number or '',
                'investor_name': trans.investor_name or '',
                'investor_phone': trans.investor_phone or '',
                'fund_id': trans.fund_id.id if trans.fund_id else None,
                'fund_name': trans.fund_id.name if trans.fund_id else '',
                'fund_ticker': trans.fund_id.ticker if trans.fund_id else '',
                'transaction_code': trans.reference or '',
                'transaction_type': trans.transaction_type,
                'target_fund': trans.destination_fund_id.name if trans.destination_fund_id else '',
                'target_fund_ticker': trans.destination_fund_id.ticker if trans.destination_fund_id else '',
                'units': trans.units,
                'price': trans.price if hasattr(trans, 'price') and trans.price else 0.0,
                'destination_units': trans.destination_units or 0,
                'amount': _amount_ex_fee(trans),
                'calculated_amount': _amount_ex_fee(trans),
                # Giá đơn vị: ưu tiên price (giá giao dịch), fallback current_nav/fund.current_nav
                'current_nav': trans.price or (trans.current_nav or (trans.fund_id.current_nav if trans.fund_id else 0.0)),
                'unit_price': (trans.price or (trans.current_nav or (trans.fund_id.current_nav if trans.fund_id else 0.0))),
                'matched_units': trans.matched_units if hasattr(trans, 'matched_units') and trans.matched_units else 0,  # Số lượng CCQ đã khớp
                'ccq_remaining_to_match': trans.ccq_remaining_to_match if hasattr(trans, 'ccq_remaining_to_match') else 0,  # CCQ còn lại cần khớp
                'currency': trans.currency_id.symbol if trans.currency_id else '',
                'status': frontend_status,
                'original_status': trans.status,  # Thêm trường này để debug
                'source': trans.source,
                'investment_type': trans.investment_type,
                'created_at': format_datetime_user_tz(self.env, trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date) or '',
                'date_end': format_datetime_user_tz(self.env, trans.date_end if hasattr(trans, 'date_end') and trans.date_end else None) or '',
                # transaction_date: Ưu tiên date_end (thời gian khớp), nếu không có thì dùng created_at (thời gian vào)
                'transaction_date': format_date_user_tz(self.env, trans.date_end if hasattr(trans, 'date_end') and trans.date_end else (trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date)) or '',
                # Thời gian vào/ra để frontend hiển thị In/Out
                # first_in_time và in_time: Dùng created_at (thời gian vào lệnh)
                'first_in_time': format_datetime_user_tz(self.env, trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date) or '',
                'in_time': format_datetime_user_tz(self.env, trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date) or '',
                # out_time: Dùng date_end (thời gian khớp lệnh)
                'out_time': format_datetime_user_tz(self.env, trans.date_end if hasattr(trans, 'date_end') and trans.date_end else None) or '',
                'approved_by': trans.approved_by.name if trans.approved_by else '',
                'approved_at': format_datetime_user_tz(self.env, trans.approved_at) or '',
                'description': trans.description or '',
                'has_contract': has_contract,
                'contract_url': contract_url,
                'contract_download_url': contract_download_url,
                'is_split_order': getattr(trans, 'is_split_order', False),
                'parent_order_id': trans.parent_order_id.id if getattr(trans, 'parent_order_id', False) and trans.parent_order_id else None,
                'parent_order_name': trans.parent_order_id.name if getattr(trans, 'parent_order_id', False) and trans.parent_order_id else '',
                'split_order_count': len(trans.split_order_ids) if hasattr(trans, 'split_order_ids') else 0,
            })
        
        return result

    def _map_status_to_frontend(self, status):
        """Map status to frontend format"""
        if not status:
            return ''
        # Chuẩn hóa status về lowercase
        status = status.lower()
        # Map status từ database sang frontend
        status_mapping = {
            'pending': 'pending',
            'completed': 'completed',
            'approved': 'completed',
            'cancelled': 'cancelled'
        }
        mapped_status = status_mapping.get(status, status)
        return mapped_status

    @api.model
    def get_transaction_stats(self):
        """Get transaction statistics"""
        total_pending = self.search_count([('status', '=', 'pending')])
        total_approved = self.search_count([('status', '=', 'completed')])
        total_cancelled = self.search_count([('status', '=', 'cancelled')])
        
        portal_pending = self.search_count([('status', '=', 'pending'), ('source', '=', 'portal')])
        sale_pending = self.search_count([('status', '=', 'pending'), ('source', '=', 'sale')])
        portfolio_pending = self.search_count([('status', '=', 'pending'), ('source', '=', 'portfolio')])
        
        return {
            'total_pending': total_pending,
            'total_approved': total_approved,
            'total_cancelled': total_cancelled,
            'portal_pending': portal_pending,
            'sale_pending': sale_pending,
            'portfolio_pending': portfolio_pending,
            'portfolio_approved': total_approved,
            'portfolio_cancelled': total_cancelled,
            'list_total': total_pending + total_approved + total_cancelled,
            'portfolio_total': total_pending + total_approved + total_cancelled,
        }

    @api.model
    def get_matched_orders(self, transaction_id=None):
        """Get matched orders information - simplified version"""
        domain = []
        if transaction_id:
            domain = ['|', 
                ('buy_order_id', '=', transaction_id),
                ('sell_order_id', '=', transaction_id)
            ]
        
        MatchedOrders = self.env['transaction.matched.orders']
        matched_orders = MatchedOrders.search(domain, order='match_date desc')
        
        result = []
        for match in matched_orders:
            result.append({
                'id': match.id,
                'reference': match.name,
                'match_date': match.match_date.strftime('%Y-%m-%d %H:%M:%S') if match.match_date else '',
                'status': match.status,
                'matched_quantity': match.matched_quantity,
                'matched_price': match.matched_price,
                'total_value': match.total_value,
            })
        
        return result




    # ===================== Investment helpers (deprecated) =====================
    def _get_effective_matched_units(self):

        """Xác định số CCQ hiệu lực để cập nhật investment"""
        self.ensure_one()

        matched = float(getattr(self, 'matched_units', 0) or 0)

        if matched > 0:

            return matched

        units = float(getattr(self, 'units', 0) or 0)

        return max(units, 0.0)



    def action_match_orders(self):
        """Deprecated: Logic khớp lệnh đã được chuyển sang OrderMatchingEngine trong controller"""
        _logger.warning("action_match_orders is deprecated. Use OrderMatchingEngine in controller instead.")
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _("Information"),
                'message': _("Order matching is now handled by the OrderMatchingEngine. Please use the API endpoint."),
                'sticky': False,
                'type': 'info',
            }
        }



    @api.model

    def get_transaction_data(self, status_filter=None, source_filter=None):

        """Get transaction data for the frontend"""

        domain = []

        


        

        if status_filter and status_filter.strip():

            status_filter = status_filter.lower().strip()

            # Map status from frontend to database

            frontend_to_db_mapping = {

                'pending': ['pending'],

                'completed': ['completed'],

                'approved': ['completed'],  # Approved tab should show completed transactions

                'cancelled': ['cancelled']

            }

            

            mapped_statuses = frontend_to_db_mapping.get(status_filter, [status_filter])

            if len(mapped_statuses) == 1:

                domain.append(('status', '=', mapped_statuses[0]))

            else:

                domain.append(('status', 'in', mapped_statuses))

            


        

        if source_filter and source_filter.strip():

            domain.append(('source', '=', source_filter))


        

        transactions = self.search(domain)

        

        result = []

        for trans in transactions:

            def _amount_ex_fee(tx):

                try:

                    fee_val = getattr(tx, 'fee', 0) or 0

                    amt_val = tx.amount or 0

                    return max(amt_val - fee_val, 0)

                except Exception:

                    return tx.amount or 0

            # Kiểm tra xem có hợp đồng không

            has_contract = bool(trans.contract_pdf_path)

            contract_url = ''

            contract_download_url = ''

            if has_contract:
                contract_url = "/transaction-list/contract/%s" % trans.id
                contract_download_url = "/transaction-list/contract/%s?download=1" % trans.id

            

            # Map status trước khi thêm vào result

            frontend_status = trans.status  # Use status as-is since mapping is in domain already


            

            result.append({

                'id': trans.id,

                'name': trans.name,

                'user_id': trans.user_id.id,

                'account_number': trans.account_number or '',

                'investor_name': trans.investor_name or '',

                'investor_phone': trans.investor_phone or '',

                'fund_id': trans.fund_id.id if trans.fund_id else None,

                'fund_name': trans.fund_id.name if trans.fund_id else '',

                'fund_ticker': trans.fund_id.ticker if trans.fund_id else '',

                'transaction_code': trans.reference or '',

                'transaction_type': trans.transaction_type,

                'target_fund': trans.destination_fund_id.name if trans.destination_fund_id else '',

                'target_fund_ticker': trans.destination_fund_id.ticker if trans.destination_fund_id else '',

                'units': trans.units,

                'price': trans.price if hasattr(trans, 'price') and trans.price else 0.0,

                'destination_units': trans.destination_units or 0,

                'amount': _amount_ex_fee(trans),

                'calculated_amount': _amount_ex_fee(trans),

                # Giá đơn vị: ưu tiên price (giá giao dịch), fallback current_nav/fund.current_nav

                'current_nav': trans.price or (trans.current_nav or (trans.fund_id.current_nav if trans.fund_id else 0.0)),

                'unit_price': (trans.price or (trans.current_nav or (trans.fund_id.current_nav if trans.fund_id else 0.0))),

                'matched_units': trans.matched_units if hasattr(trans, 'matched_units') and trans.matched_units else 0,  # Số lượng CCQ đã khớp

                'ccq_remaining_to_match': trans.ccq_remaining_to_match if hasattr(trans, 'ccq_remaining_to_match') else 0,  # CCQ còn lại cần khớp

                'currency': trans.currency_id.symbol if trans.currency_id else '',

                'status': frontend_status,

                'original_status': trans.status,  # Thêm trường này để debug

                'source': trans.source,

                'investment_type': trans.investment_type,

                'created_at': format_datetime_user_tz(self.env, trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date) or '',

                'transaction_date': format_date_user_tz(self.env, trans.date_end if hasattr(trans, 'date_end') and trans.date_end else (trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date)) or '',

                # Thời gian vào/ra để frontend hiển thị In/Out

                'first_in_time': format_datetime_user_tz(self.env, trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date) or '',

                'in_time': format_datetime_user_tz(self.env, trans.created_at if hasattr(trans, 'created_at') and trans.created_at else trans.create_date) or '',

                'out_time': format_datetime_user_tz(self.env, trans.approved_at) or '',

                'approved_by': trans.approved_by.name if trans.approved_by else '',

                'approved_at': format_datetime_user_tz(self.env, trans.approved_at) or '',

                'description': trans.description or '',

                'has_contract': has_contract,

                'contract_url': contract_url,

                'contract_download_url': contract_download_url,

            })

        

        return result



    def _map_status_to_frontend(self, status):

        """Map status to frontend format"""

        if not status:

            return ''

        # Chuẩn hóa status về lowercase

        status = status.lower()

        # Map status từ database sang frontend

        status_mapping = {

            'pending': 'pending',

            'completed': 'completed',

            'approved': 'completed',

            'cancelled': 'cancelled'

        }

        mapped_status = status_mapping.get(status, status)


        return mapped_status



    @api.model

    def get_transaction_stats(self):

        """Get transaction statistics"""

        total_pending = self.search_count([('status', '=', 'pending')])

        total_approved = self.search_count([('status', '=', 'completed')])

        total_cancelled = self.search_count([('status', '=', 'cancelled')])

        

        portal_pending = self.search_count([('status', '=', 'pending'), ('source', '=', 'portal')])

        sale_pending = self.search_count([('status', '=', 'pending'), ('source', '=', 'sale')])

        portfolio_pending = self.search_count([('status', '=', 'pending'), ('source', '=', 'portfolio')])

        

        return {

            'total_pending': total_pending,

            'total_approved': total_approved,

            'total_cancelled': total_cancelled,

            'portal_pending': portal_pending,

            'sale_pending': sale_pending,

            'portfolio_pending': portfolio_pending,

            'portfolio_approved': total_approved,

            'portfolio_cancelled': total_cancelled,

            'list_total': total_pending + total_approved + total_cancelled,

            'portfolio_total': total_pending + total_approved + total_cancelled,

        }



    @api.model

    def get_matched_orders(self, transaction_id=None):

        """Get matched orders information - simplified version"""
        domain = []

        if transaction_id:

            domain = ['|', 

                ('buy_order_id', '=', transaction_id),

                ('sell_order_id', '=', transaction_id)

            ]

        

        MatchedOrders = self.env['transaction.matched.orders']

        matched_orders = MatchedOrders.search(domain, order='match_date desc')

        

        result = []

        for match in matched_orders:

            result.append({

                'id': match.id,

                'reference': match.name,

                'match_date': match.match_date.strftime('%Y-%m-%d %H:%M:%S') if match.match_date else '',

                'status': match.status,

                'matched_quantity': match.matched_quantity,

                'matched_price': match.matched_price,

                'total_value': match.total_value,

            })

        

        return result

    def action_view_parent_order(self):
        """
        Mở form view của parent order từ split order.
        Sử dụng cho button trong list view và form view.
        """
        self.ensure_one()
        if not self.parent_order_id:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Lỗi',
                    'message': 'Lệnh này không có lệnh gốc.',
                    'type': 'danger',
                    'sticky': False,
                }
            }
        
        return {
            'type': 'ir.actions.act_window',
            'name': 'Lệnh gốc',
            'res_model': 'portfolio.transaction',
            'res_id': self.parent_order_id.id,
            'view_mode': 'form',
            'target': 'current',
            'context': {'form_view_initial_mode': 'readonly'},
        }




