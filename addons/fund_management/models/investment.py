from odoo import api, fields, models

from ..utils import constants, investment_utils


class Investment(models.Model):
    _name = "portfolio.investment"
    _description = "Investment"
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string="Name", compute='_compute_name', store=True)
    user_id = fields.Many2one("res.users", string="User", required=True, tracking=True)
    fund_id = fields.Many2one("portfolio.fund", string="Fund", required=True, tracking=True)
    
    # ============ DEPRECATED FIELDS (kept for backwards compatibility) ============
    investment_type = fields.Selection(
        constants.INVESTMENT_TYPES,
        string="Investment Type",
        default=constants.DEFAULT_INVESTMENT_TYPE
    )
    units = fields.Float(string="Units")
    amount = fields.Float(string="Amount")
    currency_id = fields.Many2one('res.currency', string='Currency', default=lambda self: self.env.company.currency_id)
    current_value = fields.Float(string="Current Value", default=0.0)
    profit_loss = fields.Float(string="Profit/Loss", default=0.0)
    profit_loss_percentage = fields.Float(string="Profit/Loss %", default=0.0)
    
    status = fields.Selection(
        constants.INVESTMENT_STATUSES,
        string='Status',
        default=constants.DEFAULT_INVESTMENT_STATUS,
        tracking=True
    )
    
    # ============ NEW FIELDS - T+2 & Holdings Breakdown ============
    
    # Related transactions (for holdings notebook view)
    transaction_ids = fields.One2many(
        'portfolio.transaction',
        compute='_compute_transaction_ids',
        string='Giao dịch liên quan'
    )
    
    # Separate fields for normal vs negotiated (domain filter doesn't work on computed One2many)
    normal_transaction_ids = fields.One2many(
        'portfolio.transaction',
        compute='_compute_transaction_ids',
        string='Giao dịch lệnh thường'
    )
    negotiated_transaction_ids = fields.One2many(
        'portfolio.transaction',
        compute='_compute_transaction_ids',
        string='Giao dịch lệnh thỏa thuận'
    )
    
    # Units breakdown by order mode
    normal_order_units = fields.Float(
        string='Lệnh thường',
        compute='_compute_units_breakdown',
        store=True,
        readonly=False,
        help='Tổng CCQ từ các lệnh thường đã khớp'
    )
    negotiated_order_units = fields.Float(
        string='Lệnh thỏa thuận',
        compute='_compute_units_breakdown',
        store=True,
        readonly=False,
        help='Tổng CCQ từ các lệnh thỏa thuận đã khớp'
    )
    
    # T+2 aware units
    pending_t2_units = fields.Float(
        string='CCQ chờ về (T+2)',
        compute='_compute_units_breakdown',
        store=True,
        readonly=False,
        help='CCQ từ lệnh thường đã mua nhưng chưa về tài khoản (T+2 chưa qua)'
    )
    available_units = fields.Float(
        string='CCQ khả dụng',
        compute='_compute_units_breakdown',
        store=True,
        readonly=False,
        help='CCQ có thể bán (đã qua T+2 hoặc từ lệnh thỏa thuận)'
    )
    total_ccq = fields.Float(
        string='Tổng CCQ',
        compute='_compute_units_breakdown',
        store=True,
        readonly=False,
        help='Tổng CCQ từ tất cả giao dịch mua đã hoàn thành'
    )
    
    # Granular Available Units
    normal_available_units = fields.Float(
        string='CCQ Khả dụng (Lệnh thường)',
        compute='_compute_units_breakdown',
        store=True,
        readonly=False,
        help='CCQ lệnh thường đã về và chưa đặt bán'
    )
    negotiated_available_units = fields.Float(
        string='CCQ Khả dụng (Thỏa thuận)',
        compute='_compute_units_breakdown',
        store=True,
        readonly=False,
        help='CCQ thỏa thuận đã về và chưa đặt bán'
    )
    
    # Total value from transactions
    total_value = fields.Monetary(
        string='Tổng giá trị',
        compute='_compute_total_value',
        store=True,
        readonly=False,
        currency_field='currency_id'
    )

    @api.depends('user_id', 'fund_id', 'units')
    def _compute_name(self):
        for rec in self:
            parts = []
            if rec.user_id:
                parts.append(rec.user_id.name)
            if rec.fund_id:
                parts.append(rec.fund_id.name)
            if rec.units:
                parts.append(f"{rec.units} units")
            rec.name = " - ".join(parts) if parts else "Investment"

    # ============ COMPUTE METHODS FOR NEW FIELDS ============
    
    def _compute_transaction_ids(self):
        """Get related buy transactions for this investment, split by order_mode"""
        Transaction = self.env['portfolio.transaction'].sudo()
        for rec in self:
            if not rec.user_id or not rec.fund_id:
                rec.transaction_ids = Transaction
                rec.normal_transaction_ids = Transaction
                rec.negotiated_transaction_ids = Transaction
                continue
            
            # All completed buy transactions
            all_txs = Transaction.search([
                ('user_id', '=', rec.user_id.id),
                ('fund_id', '=', rec.fund_id.id),
                ('transaction_type', '=', 'buy'),
                ('status', '=', 'completed')
            ])
            rec.transaction_ids = all_txs
            
            # Filter by order_mode
            rec.normal_transaction_ids = all_txs.filtered(lambda t: t.order_mode == 'normal')
            rec.negotiated_transaction_ids = all_txs.filtered(lambda t: t.order_mode == 'negotiated')

    @api.depends('user_id', 'fund_id', 'units', 'amount')
    def _compute_units_breakdown(self):
        """Compute units breakdown by order mode and T+2 status"""
        Transaction = self.env['portfolio.transaction'].sudo()
        today = fields.Date.today()
        
        for rec in self:
            if not rec.user_id or not rec.fund_id:
                rec.normal_order_units = 0
                rec.negotiated_order_units = 0
                rec.pending_t2_units = 0
                rec.available_units = 0
                rec.total_ccq = 0
                continue
            
            # Get all completed buy transactions
            txs = Transaction.search([
                ('user_id', '=', rec.user_id.id),
                ('fund_id', '=', rec.fund_id.id),
                ('transaction_type', '=', 'buy'),
                ('status', '=', 'completed')
            ])
            
            normal_cleared = 0.0
            negotiated_cleared = 0.0
            normal_units = 0.0
            negotiated_units = 0.0
            pending_t2 = 0.0
            
            for tx in txs:
                units = float(getattr(tx, 'matched_units', 0) or tx.units or 0)
                order_mode = getattr(tx, 'order_mode', 'negotiated') or 'negotiated'
                
                # Check T+2 status
                t2_date = getattr(tx, 't2_date', None)
                is_cleared = False
                if t2_date and t2_date <= today:
                    is_cleared = True
                
                # Count by order mode
                if order_mode == 'negotiated':
                    negotiated_units += units
                    if is_cleared:
                        negotiated_cleared += units
                else:  # normal
                    normal_units += units
                    if is_cleared:
                        normal_cleared += units
                    else:
                        pending_t2 += units # Only count T+2 pending for normal for display? 
                        # Or if Negotiated also has T+2, we should track it?
                        # Existing logic only tracked pending_t2 for display.
                        # Let's assume pending_t2_units field is aggregate or mainly for Normal.
                        # Logic in line 178 (original) added to pending_t2 regardless of type if else branch taken?
                        # Re-reading original: "else: pending_t2 += units". It was inside the loop, unaware of mode?
                        # Actually Step 689 Line 178 "pending_t2 += units" was outside the if/else of order_mode.
                        # So it counted Pending T2 for BOTH.
                        if not is_cleared and order_mode == 'negotiated':
                             pass # We can add to pending_t2 if we want total pending t2.
            
            # To preserve original pending_t2 logic (Total Pending T2):
            # But line 178 was inside loop.
            # Let's replicate exact T2 logic but split the "Available/Cleared" buckets.
            
            # Re-loop or refine loop above:
            # Reset counters
            normal_units = 0.0
            negotiated_units = 0.0
            normal_cleared = 0.0
            negotiated_cleared = 0.0
            pending_t2 = 0.0
            
            for tx in txs:
                units = float(getattr(tx, 'matched_units', 0) or tx.units or 0)
                order_mode = getattr(tx, 'order_mode', 'negotiated') or 'negotiated'
                t2_date = getattr(tx, 't2_date', None)
                
                is_cleared = t2_date and t2_date <= today
                
                if order_mode == 'negotiated':
                    negotiated_units += units
                    if is_cleared: negotiated_cleared += units
                    else: pending_t2 += units
                else:
                    normal_units += units
                    if is_cleared: normal_cleared += units
                    else: pending_t2 += units

            # Subtract pending sell orders from available buckets
            pending_sells = Transaction.search([
                ('user_id', '=', rec.user_id.id),
                ('fund_id', '=', rec.fund_id.id),
                ('transaction_type', '=', 'sell'),
                ('status', '=', 'pending')
            ])
            
            pending_normal_sells = sum(float(tx.units or 0) for tx in pending_sells.filtered(lambda t: t.order_mode == 'normal'))
            pending_negotiated_sells = sum(float(tx.units or 0) for tx in pending_sells.filtered(lambda t: t.order_mode == 'negotiated'))
            
            rec.normal_available_units = max(0.0, normal_cleared - pending_normal_sells)
            rec.negotiated_available_units = max(0.0, negotiated_cleared - pending_negotiated_sells)
            
            rec.available_units = rec.normal_available_units + rec.negotiated_available_units
            
            rec.normal_order_units = normal_units
            rec.negotiated_order_units = negotiated_units
            rec.pending_t2_units = pending_t2
            rec.total_ccq = normal_units + negotiated_units

    @api.depends('user_id', 'fund_id', 'amount')
    def _compute_total_value(self):
        """Compute total value from transactions"""
        Transaction = self.env['portfolio.transaction'].sudo()
        for rec in self:
            if not rec.user_id or not rec.fund_id:
                rec.total_value = 0.0
                continue
            txs = Transaction.search([
                ('user_id', '=', rec.user_id.id),
                ('fund_id', '=', rec.fund_id.id),
                ('transaction_type', '=', 'buy'),
                ('status', '=', 'completed')
            ])
            total = 0.0
            for tx in txs:
                units = float(getattr(tx, 'matched_units', 0) or tx.units or 0)
                price = float(tx.price or 0)
                total += units * price
            rec.total_value = total

    # ===== Basic calculation methods =====
    def _compute_days(self, term_months=None, days=None):
        """Calculate days from term_months or days"""
        return investment_utils.InvestmentHelper.compute_days(term_months, days)

    def compute_sell_value(self, order_value, interest_rate_percent, term_months=None, days=None):
        """Calculate sell value based on interest rate and term"""
        return investment_utils.InvestmentHelper.compute_sell_value(
            order_value, interest_rate_percent, term_months, days
        )
