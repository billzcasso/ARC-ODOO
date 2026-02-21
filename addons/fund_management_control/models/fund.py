from odoo import models, fields, api
from odoo.exceptions import UserError
import json
import logging
import requests

_logger = logging.getLogger(__name__)

# Chứng chỉ quỹ
class FundCertificate(models.Model):
    _name = 'fund.certificate'
    _description = 'Fund Certificate'
    _order = 'symbol asc'
    _rec_name = 'symbol'

    # === Stock Data Fields (Primary) ===
    symbol = fields.Char(string="Mã chứng khoán", required=True, index=True)
    market = fields.Selection([
        ('HOSE', 'HOSE'),
        ('HNX', 'HNX'),
        ('UPCOM', 'UPCOM')
    ], string='Sàn giao dịch', required=True, index=True)
    # Bổ sung các trường được sử dụng trong đồng bộ/auto-creation
    floor_code = fields.Char(string='Mã sàn', default='')
    security_type = fields.Char(string='Loại chứng khoán', default='')
    
    short_name_vn = fields.Char(string='Tên viết tắt (VN)')
    short_name_en = fields.Char(string='Tên viết tắt (EN)')
    
    # Price Information
    reference_price = fields.Float(string='Giá tham chiếu', digits=(12, 0))
    ceiling_price = fields.Float(string='Giá trần', digits=(12, 0))
    floor_price = fields.Float(string='Giá sàn', digits=(12, 0))
    last_trading_date = fields.Date(string='Ngày giao dịch cuối')
    
    # Current Price Data
    current_price = fields.Float(string='Giá hiện tại', digits=(12, 0))
    high_price = fields.Float(string='Giá cao nhất', digits=(12, 0))
    low_price = fields.Float(string='Giá thấp nhất', digits=(12, 0))
    # Bỏ field volume trực tiếp, thay bằng mapping từ số lượng tồn kho ban đầu
    volume = fields.Float(string='Khối lượng', compute='_compute_volume', store=True, readonly=True)
    total_value = fields.Float(string='Tổng giá trị', digits=(20, 0))
    change = fields.Float(string='Thay đổi', digits=(12, 0))
    change_percent = fields.Float(string='Thay đổi (%)', digits=(12, 2))
    last_price = fields.Float(string='Giá cuối', digits=(12, 0))
    
    # Status
    is_active = fields.Boolean(string='Đang hoạt động', default=True)
    last_update = fields.Datetime(string='Cập nhật lần cuối', default=fields.Datetime.now)
    # Currency (để hiển thị định dạng tiền tệ ở list/form views)
    currency_id = fields.Many2one('res.currency', string='Tiền tệ', default=lambda self: self.env.company.currency_id)
    
    # === Fund Management Fields ===
    fund_color = fields.Char(string="Màu quỹ", default='#4A90E2')
    inception_date = fields.Datetime(string="Thời gian đóng sổ lệnh")
    closure_date = fields.Date(string="Ngày đóng sổ lệnh")
    receive_money_time = fields.Datetime(string="Thời điểm ghi nhận tiền vào quỹ")
    payment_deadline = fields.Integer(string="Thời hạn thanh toán bán (ngày)", default=3)
    redemption_time = fields.Integer(string="Thời gian ghi nhận lệnh Mua hoán đổi (ngày)", default=2)
    report_website = fields.Char(string="Website báo cáo quỹ")
    fund_type = fields.Selection([
        ('equity', 'Quỹ Cổ phiếu'),
        ('bond', 'Quỹ Trái phiếu'),
        ('mixed', 'Quỹ Hỗn hợp'),
    ], string='Chọn loại quỹ', default='equity')
    risk_level = fields.Selection([
        ('1', '1 - Thấp nhất'),
        ('2', '2 - Thấp'),
        ('3', '3 - Trung bình'),
        ('4', '4 - Cao'),
        ('5', '5 - Rất cao'),
    ], string='Mức độ rủi ro', default='3')
    product_type = fields.Selection([
        ('open_ended', 'Quỹ mở'),
        ('close_ended', 'Quỹ đóng'),
    ], string="Loại sản phẩm", default='open_ended')
    product_status = fields.Selection([
        ('active', 'Đang hoạt động'),
        ('inactive', 'Ngừng hoạt động')
    ], string="Trạng thái sản phẩm", default='active')
    fund_description = fields.Text(string="Mô tả quỹ")
    fund_image = fields.Binary(string="Hình ảnh của Quỹ")
    
    # Trường cho quỹ đóng
    initial_certificate_quantity = fields.Integer(string="Số lượng tồn kho ban đầu")
    initial_certificate_price = fields.Float(string="Giá tồn kho ban đầu")
    capital_cost = fields.Float(string="Chi phí vốn (%)", digits=(5, 2))

    # Trading Days
    monday = fields.Boolean(string="Thứ hai", default=True)
    tuesday = fields.Boolean(string="Thứ ba", default=True)
    wednesday = fields.Boolean(string="Thứ tư", default=True)
    thursday = fields.Boolean(string="Thứ năm", default=True)
    friday = fields.Boolean(string="Thứ sáu", default=True)
    saturday = fields.Boolean(string="Thứ bảy")
    sunday = fields.Boolean(string="Chủ nhật")

    # Tham chiếu chứng khoán từ stock_data để áp dữ liệu nhanh
    security_ref_id = fields.Many2one(
        'ssi.securities',
        string='Chọn chứng khoán (có Daily OHLC)',
        domain="[('daily_ohlc_ids','!=',False)]",
        help='Chọn từ danh sách chứng khoán đã có Daily OHLC để tự động áp dữ liệu.'
    )

    def _get_latest_close_price_from_ohlc(self, security):
        """Lấy close_price từ Daily OHLC mới nhất của security"""
        if not security:
            return 0.0
        try:
            daily_ohlc_model = self.env['ssi.daily.ohlc'].sudo()
            latest_ohlc = daily_ohlc_model.search([
                ('security_id', '=', security.id)
            ], order='date desc', limit=1)
            if latest_ohlc and latest_ohlc.close_price:
                return latest_ohlc.close_price
        except Exception:
            pass
        return 0.0

    @api.onchange('security_ref_id')
    def _onchange_security_ref_id(self):
        for rec in self:
            sec = rec.security_ref_id
            if not sec:
                continue
            # Áp các trường chính từ securities - lấy trực tiếp, không fallback
            rec.symbol = sec.symbol
            rec.market = sec.market
            rec.floor_code = sec.floor_code
            rec.security_type = sec.security_type
            rec.short_name_vn = sec.stock_name_vn
            rec.short_name_en = sec.stock_name_en
            rec.reference_price = sec.reference_price
            rec.ceiling_price = sec.ceiling_price
            rec.floor_price = sec.floor_price
            # Note: last_trading_date removed - not in ssi.securities
            rec.current_price = sec.current_price
            rec.high_price = sec.high_price
            rec.low_price = sec.low_price
            # Map volume từ securities sang số lượng tồn kho ban đầu
            rec.initial_certificate_quantity = int(sec.volume) if sec.volume else 0
            rec.total_value = sec.total_value
            rec.change = sec.change
            rec.change_percent = sec.change_percent
            # Note: last_price removed - not in ssi.securities
            rec.last_update = fields.Datetime.now()
            rec.is_active = True
            rec.product_status = 'active'
            # Mô tả
            if not rec.fund_description:
                rec.fund_description = f"{rec.symbol} - {rec.market}"

            # Lấy giá tồn kho ban đầu từ open_price của Daily OHLC mới nhất hoặc today_open_price
            if sec.today_open_price > 0:
                rec.initial_certificate_price = sec.today_open_price
            else:
                # Fallback to OHLC Open Price
                latest_ohlc = self.env['ssi.daily.ohlc'].sudo().search([
                    ('security_id', '=', sec.id)
                ], order='date desc', limit=1)
                if latest_ohlc and latest_ohlc.open_price:
                    rec.initial_certificate_price = latest_ohlc.open_price

    @api.depends('initial_certificate_quantity')
    def _compute_volume(self):
        for rec in self:
            rec.volume = float(rec.initial_certificate_quantity) if rec.initial_certificate_quantity is not None else 0.0

    # ==== Propagate changes to portfolio.fund (fund_management) ====


    def _propagate_to_portfolio_fund(self):
        PortfolioFund = self.env['portfolio.fund'].sudo()
        for rec in self:
            try:
                # Use the richer mapping method
                vals = rec._map_to_portfolio_fund_vals()
                
                # Prefer link by certificate_id, fallback by ticker (symbol)
                funds = PortfolioFund.search(['|', ('certificate_id', '=', rec.id), ('ticker', '=', rec.symbol)])
                
                if funds:
                    for fund in funds:
                        wvals = dict(vals)
                        if not fund.certificate_id:
                            wvals['certificate_id'] = rec.id
                        fund.write(wvals)
                else:
                    # CREATION LOGIC: Auto-create portfolio fund if not found
                    cvals = dict(vals)
                    cvals['certificate_id'] = rec.id
                    # Ensure status and default type if not set
                    if 'status' not in cvals:
                        cvals['status'] = 'active'
                    if 'investment_type' not in cvals:
                         cvals['investment_type'] = 'Growth'
                    
                    PortfolioFund.create(cvals)
                    _logger.info(f"Auto-created Portfolio Fund for {rec.symbol}")
                
                # After propagating to PortfolioFund, sync to NAV and Inventory
                # This logic was previously in the shadowed write method
                rec._sync_to_nav_fund_config()
                rec._sync_to_daily_inventory()

            except Exception:
                # Do not block certificate write on propagation errors
                _logger.debug('Skip fund propagation for %s', rec.symbol, exc_info=True)

    @api.model
    def create(self, vals):
        rec = super().create(vals)
        try:
            rec._propagate_to_portfolio_fund()
        except Exception:
            _logger.debug('Skip portfolio fund propagation on create', exc_info=True)
        # Auto-add symbol to streaming
        try:
            rec._auto_add_to_streaming()
        except Exception:
            _logger.debug('Skip auto-add to streaming on create for %s', rec.symbol, exc_info=True)
        return rec

    def write(self, vals):
        res = super().write(vals)
        try:
            self._propagate_to_portfolio_fund()
        except Exception:
            _logger.debug('Skip portfolio fund propagation on write', exc_info=True)
        return res

    _sql_constraints = [
        ('symbol_market_unique', 'unique(symbol, market)', 'Sự kết hợp Mã chứng khoán và Sàn giao dịch phải duy nhất!')
    ]

    def _auto_add_to_streaming(self):
        """Tự động thêm mã CCQ vào danh sách streaming sau khi tạo mới."""
        for rec in self:
            if not rec.symbol:
                continue
            try:
                Securities = self.env['ssi.securities'].sudo()
                # Tìm security record theo symbol
                security = Securities.search([('symbol', '=', rec.symbol)], limit=1)
                if not security:
                    # Tạo mới security record từ thông tin CCQ
                    security = Securities.create({
                        'symbol': rec.symbol,
                        'market': rec.market or 'HOSE',
                        'floor_code': rec.floor_code or rec.market or '',
                        'security_type': rec.security_type or '',
                        'stock_name_vn': rec.short_name_vn or rec.symbol,
                        'stock_name_en': rec.short_name_en or rec.symbol,
                        'reference_price': rec.reference_price or 0.0,
                        'ceiling_price': rec.ceiling_price or 0.0,
                        'floor_price': rec.floor_price or 0.0,
                        'current_price': rec.current_price or 0.0,
                        'is_active': True,
                    })
                    _logger.info("Auto-created ssi.securities for symbol %s", rec.symbol)

                # Thêm vào priority streaming list
                ApiConfig = self.env['ssi.api.config'].sudo()
                config = ApiConfig.search([('is_active', '=', True)], limit=1)
                if config and security:
                    config.add_priority_securities_safely([security.id])
                    _logger.info("Auto-added symbol %s to streaming priority list", rec.symbol)
            except Exception as e:
                _logger.warning("Failed to auto-add %s to streaming: %s", rec.symbol, e)

    @api.model
    def sync_from_stock_data(self, market=None, page_size=200):
        """Đồng bộ dữ liệu từ ssi.securities (realtime streaming) vào fund.certificate.
        Sử dụng current_price từ streaming thay vì Daily OHLC.
        """
        _logger = logging.getLogger(__name__)
        
        Securities = self.env['ssi.securities'].sudo()
        
        # Build domain filter
        domain = [('is_active', '=', True)]
        if market:
            domain.append(('market', '=', market))
        
        # Get all active securities
        fields_to_read = ['symbol', 'market', 'floor_code', 'security_type', 
                          'stock_name_vn', 'stock_name_en', 'reference_price', 
                          'ceiling_price', 'floor_price', 'current_price', 
                          'high_price', 'low_price', 'volume', 'total_value', 
                          'change', 'change_percent', 'today_open_price']
                          
        _logger.info("Fields to read: %s", fields_to_read)
        securities_data = Securities.search_read(domain, fields_to_read, limit=page_size if page_size else None)
        
        _logger.info("Đang đồng bộ %d chứng khoán từ ssi.securities (realtime)", len(securities_data))
        
        if len(securities_data) > 0:
            _logger.info("DEBUG: First record data: %s", securities_data[0])
        
        total_created = 0
        total_updated = 0
        total_skipped = 0
        total_updated = 0
        total_skipped = 0
        
        for data in securities_data:
            symbol = data.get('symbol')
            market = data.get('market')
            
            if not symbol:
                if total_skipped < 10:
                    _logger.warning("SKIP: Missing Symbol for ID %s. Data: %s", data.get('id'), data)
                total_skipped += 1
                continue
                
            # If market is missing but symbol exists, try to infer or default? 
            # For now just log it.
            if not market:
                if total_skipped < 10:
                    _logger.warning("SKIP: Missing Market for Symbol %s (ID %s). Data: %s", symbol, data.get('id'), data)
                total_skipped += 1
                continue
            
            # Use today_open_price from streaming, fallback to reference_price
            initial_price = data.get('today_open_price') or data.get('reference_price') or 0.0
            
            vals = {
                'symbol': symbol,
                'market': market,
                'floor_code': data.get('floor_code') or '',
                'security_type': data.get('security_type') or '',
                'short_name_vn': data.get('stock_name_vn') or '',
                'short_name_en': data.get('stock_name_en') or '',
                'reference_price': data.get('reference_price') or 0.0,
                'ceiling_price': data.get('ceiling_price') or 0.0,
                'floor_price': data.get('floor_price') or 0.0,
                'current_price': data.get('current_price') or 0.0,
                'high_price': data.get('high_price') or 0.0,
                'low_price': data.get('low_price') or 0.0,
                'initial_certificate_quantity': int(data.get('volume') or 0),
                'initial_certificate_price': initial_price,
                'total_value': data.get('total_value') or 0.0,
                'change': data.get('change') or 0.0,
                'change_percent': data.get('change_percent') or 0.0,
                'is_active': True,
                'last_update': fields.Datetime.now(),
                'product_status': 'active',
                'fund_description': f"{symbol} - {data.get('security_type') or 'Stock'} - {market}",
            }
            
            existing = self.search([('symbol', '=', symbol), ('market', '=', market)], limit=1)
            if existing:
                # Remove skip_fund_sync=True to allow propagation to portfolio.fund
                existing.write(vals)
                total_updated += 1
            else:
                self.create(vals)
                total_created += 1
        
        _logger.info("Đồng bộ hoàn thành: %d tạo mới, %d cập nhật, %d bỏ qua", total_created, total_updated, total_skipped)
        return {'created': total_created, 'updated': total_updated, 'skipped': total_skipped}

    # Deprecated sync methods removed in favor of selecting securities via security_ref_id

    @api.model
    def cron_sync_from_stock_data(self):
        """Cron job để tự động đồng bộ chứng khoán từ module stock_data.
        CHỈ đồng bộ các symbol đã có Daily OHLC data.
        Chạy mỗi 5 phút để giữ chứng chỉ quỹ luôn được cập nhật với dữ liệu thị trường real-time.
        """
        _logger = logging.getLogger(__name__)
        
        # Pre-fetch from stock_data if needed
        try:
            sec_model = self.env['ssi.securities'].sudo()
            ohlc_model = self.env['ssi.daily.ohlc'].sudo()
            sec_count = sec_model.search_count([])
            ohlc_count = ohlc_model.search_count([])
            if sec_count == 0:
                try:
                    self.env['wizard.fetch.market.data'].sudo().cron_fetch_securities_all()
                except Exception:
                    pass
            if ohlc_count == 0:
                try:
                    self.env['wizard.fetch.market.data'].sudo().cron_fetch_all_ohlc()
                except Exception:
                    pass
        except Exception:
            # ignore prefetch errors
            pass

        # Đồng bộ tất cả các sàn
        try:
            markets = ['HOSE', 'HNX', 'UPCOM']
            total_created = 0
            total_updated = 0
            total_skipped = 0
            
            for market in markets:
                try:
                    result = self.sync_from_stock_data(market=market, page_size=500)
                    total_created += result.get('created', 0)
                    total_updated += result.get('updated', 0)
                    total_skipped += result.get('skipped', 0)
                except Exception as e:
                    _logger.error("Lỗi khi đồng bộ sàn %s: %s", market, str(e), exc_info=True)
            
            result_summary = {
                'created': total_created,
                'updated': total_updated,
                'skipped': total_skipped,
                'markets': markets
            }
            _logger.info("Cron đồng bộ hoàn thành: %d đã tạo, %d đã cập nhật, %d đã bỏ qua (không có Daily OHLC)", 
                         total_created, total_updated, total_skipped)
            return result_summary
        except Exception as e:
            _logger.error("Lỗi trong cron_sync_from_stock_data: %s", str(e), exc_info=True)
            return {'created': 0, 'updated': 0, 'skipped': 0, 'error': str(e)}

    @api.model
    def action_sync_from_stock_data(self):
        """Button action để đồng bộ từ Stock Data.
        Hiển thị thông báo kết quả cho user.
        """
        try:
            result = self.cron_sync_from_stock_data()
            if not result:
                result = {}
            created = int(result.get('created')) if result.get('created') is not None else 0
            updated = int(result.get('updated')) if result.get('updated') is not None else 0
            skipped = int(result.get('skipped')) if result.get('skipped') is not None else 0
            
            message = f"Đồng bộ hoàn thành!\n" \
                     f"• Đã tạo mới: {created} bản ghi\n" \
                     f"• Đã cập nhật: {updated} bản ghi\n" \
                     f"• Đã bỏ qua: {skipped} bản ghi"
            
            if result.get('error'):
                message += f"\n\nLỗi: {result.get('error')}"
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': 'Đồng bộ hoàn thành (có lỗi)',
                        'message': message,
                        'type': 'warning',
                        'sticky': False,
                    }
                }
            else:
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': 'Đồng bộ thành công',
                        'message': message,
                        'type': 'success',
                        'sticky': False,
                    }
                }
        except Exception as e:
            _logger.error("Lỗi khi đồng bộ từ button: %s", str(e), exc_info=True)
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Lỗi đồng bộ',
                    'message': f'Đã xảy ra lỗi khi đồng bộ: {str(e)}',
                    'type': 'danger',
                    'sticky': True,
                }
            }

    # --- Đồng bộ sang portfolio.fund (fund_management) ---
    def _map_to_portfolio_fund_vals(self):
        self.ensure_one()
        vals = {}
        # Tên / Ticker / Mô tả
        if self.short_name_vn:
            vals['name'] = self.short_name_vn
        elif self.symbol:
            vals['name'] = self.symbol
            
        if self.symbol:
            vals['ticker'] = self.symbol
            
        if self.fund_description:
            vals['description'] = self.fund_description
        elif self.security_type:
            vals['description'] = f"{self.symbol} - {self.security_type} - {self.market}"

        # Ánh xạ ngày: inception_date (Datetime) -> Date, nếu không thì dùng closure_date
        if self.inception_date:
            vals['inception_date'] = fields.Date.to_date(self.inception_date)
        elif self.closure_date:
            vals['inception_date'] = self.closure_date

        # NAV / Giá phát hành
        if self.current_price is not None:
            vals['current_nav'] = self.current_price
        elif self.reference_price is not None:
            vals['current_nav'] = self.reference_price
            
        if self.initial_certificate_price is not None:
            vals['launch_price'] = self.initial_certificate_price

        # Ánh xạ loại đầu tư
        mapping = {
            'equity': 'Growth',
            'bond': 'Income',
            'mixed': 'Income & Growth',
        }
        if self.fund_type:
            vals['investment_type'] = mapping.get(self.fund_type)

        # Ánh xạ trạng thái
        if self.product_status in ('active', 'inactive'):
            vals['status'] = self.product_status
        elif self.is_active:
            vals['status'] = 'active'
        else:
            vals['status'] = 'inactive'

        return vals






    
    def _sync_to_nav_fund_config(self):
        """Đồng bộ 3 field quan trọng từ fund.certificate sang nav.fund.config"""
        # Guard: skip nếu model chưa được cài đặt trong registry
        if 'nav.fund.config' not in self.env:
            return

        for cert in self:
            # Dùng savepoint để lỗi DB (vd bảng chưa tồn tại) không phá huỷ
            # transaction cha – tránh "current transaction is aborted"
            try:
                with self.env.cr.savepoint():
                    _logger.debug("Bắt đầu đồng bộ cho fund.certificate %s (%s)", cert.id, cert.symbol)

                    # Tìm portfolio.fund tương ứng
                    portfolio_fund = self.env['portfolio.fund'].search([
                        ('certificate_id', '=', cert.id)
                    ], limit=1)

                    if not portfolio_fund:
                        _logger.debug("Không tìm thấy portfolio.fund cho certificate %s", cert.id)
                        continue

                    # Tìm hoặc tạo nav.fund.config
                    nav_config = self.env['nav.fund.config'].search([
                        ('fund_id', '=', portfolio_fund.id)
                    ], limit=1)

                    vals = {
                        'initial_nav_price': cert.initial_certificate_price if cert.initial_certificate_price is not None else 0.0,
                        'initial_ccq_quantity': cert.initial_certificate_quantity if cert.initial_certificate_quantity is not None else 0.0,
                        'capital_cost_percent': getattr(cert, 'capital_cost', 0) or 0.0,
                    }

                    if not nav_config:
                        vals.update({
                            'fund_id': portfolio_fund.id,
                            'description': f"Tự động đồng bộ từ {cert.symbol}",
                            'active': True,
                        })
                        self.env['nav.fund.config'].create(vals)
                    else:
                        nav_config.with_context(
                            skip_certificate_sync=True,
                            skip_fund_sync=True,
                            skip_nav_config_sync=True,
                        ).write(vals)

            except Exception as e:
                _logger.warning("Lỗi khi đồng bộ fund.certificate %s sang nav.fund.config: %s", cert.id, e)
    
    def _sync_to_daily_inventory(self):
        """Đồng bộ dữ liệu từ fund.certificate sang tồn kho CCQ hàng ngày"""
        if 'nav.daily.inventory' not in self.env:
            return

        for cert in self:
            try:
                with self.env.cr.savepoint():
                    # Tìm portfolio.fund tương ứng
                    portfolio_fund = self.env['portfolio.fund'].search([
                        ('certificate_id', '=', cert.id)
                    ], limit=1)

                    if not portfolio_fund:
                        continue

                    # Tìm tất cả bản ghi tồn kho của quỹ này
                    daily_inventories = self.env['nav.daily.inventory'].search([
                        ('fund_id', '=', portfolio_fund.id)
                    ])

                    if not daily_inventories:
                        continue

                    # Sử dụng method sync_from_fund_certificate để cập nhật tất cả bản ghi
                    certificate_data = {
                        'initial_certificate_quantity': cert.initial_certificate_quantity if cert.initial_certificate_quantity is not None else 0.0,
                        'initial_certificate_price': cert.initial_certificate_price if cert.initial_certificate_price is not None else 0.0,
                    }

                    self.env['nav.daily.inventory'].sync_from_fund_certificate(
                        portfolio_fund.id,
                        certificate_data
                    )

            except Exception as e:
                _logger.warning("Lỗi khi đồng bộ fund.certificate %s sang tồn kho hàng ngày: %s", cert.id, e)

    @api.model
    def sync_batch(self, market_selection='all', sync_option='both'):
        """
        Thực hiện đồng bộ hàng loạt từ Securities -> Fund Certificate.
        Logic này được chia sẻ giữa Wizard và Controller.
        :param market_selection: 'all', 'HOSE', 'HNX', 'UPCOM'
        :param sync_option: 'create', 'update', 'both'
        :return: Dict stats {'created': int, 'updated': int, 'skipped': int}
        """
        Securities = self.env['ssi.securities'].sudo()
        FundCert = self.env['fund.certificate'].sudo()

        domain = [('is_active', '=', True)]
        if market_selection and market_selection != 'all':
            domain.append(('market', '=', market_selection))

        # Sử dụng ORM iteration
        securities = Securities.search(domain)
        
        stats = {'created': 0, 'updated': 0, 'skipped': 0}
        
        for sec in securities:
            if not sec.symbol or not sec.market:
                stats['skipped'] += 1
                continue

            # Check existence
            existing = FundCert.search([
                ('symbol', '=', sec.symbol),
                ('market', '=', sec.market)
            ], limit=1)

            should_process = False
            if sync_option == 'both':
                should_process = True
            elif sync_option == 'create' and not existing:
                should_process = True
            elif sync_option == 'update' and existing:
                should_process = True

            if not should_process:
                continue

            # Prepare values from SECURITY record directly
            vals = {
                'symbol': sec.symbol,
                'market': sec.market,
                'floor_code': sec.floor_code or '',
                # 'security_type': sec.security_type or '', # Field removed from form
                'short_name_vn': sec.stock_name_vn or '',
                'short_name_en': sec.stock_name_en or '',
                'reference_price': sec.reference_price or 0.0,
                'ceiling_price': sec.ceiling_price or 0.0,
                'floor_price': sec.floor_price or 0.0,
                'current_price': sec.current_price or 0.0,
                'high_price': sec.high_price or 0.0,
                'low_price': sec.low_price or 0.0,
                'total_value': sec.total_value or 0.0,
                'change': sec.change or 0.0,
                'change_percent': sec.change_percent or 0.0,
                'last_update': fields.Datetime.now(),
                'is_active': True,
                'product_status': 'active'
            }
            
            # Additional values for CREATE only
            if not existing:
                vals['initial_certificate_quantity'] = int(sec.volume) if sec.volume else 0
                vals['initial_certificate_price'] = sec.current_price or sec.reference_price or 0.0
                vals['fund_description'] = f"{sec.symbol} - {sec.security_type or 'Stock'} - {sec.market}"

            try:
                if existing:
                    existing.write(vals)
                    stats['updated'] += 1
                else:
                    FundCert.create(vals)
                    stats['created'] += 1
            except Exception as e:
                _logger.error(f"Error syncing {sec.symbol}: {e}")
                stats['skipped'] += 1
                
        return stats

    def update_from_security_data(self, security):
        """Called by ssi.securities when data changes (Realtime propagation)"""
        for rec in self:
            vals = {}
            
            # Map fields safely
            if security.floor_code and rec.floor_code != security.floor_code:
                vals['floor_code'] = security.floor_code
            if security.security_type and rec.security_type != security.security_type:
                vals['security_type'] = security.security_type
            if security.stock_name_vn and rec.short_name_vn != security.stock_name_vn:
                vals['short_name_vn'] = security.stock_name_vn
            if security.stock_name_en and rec.short_name_en != security.stock_name_en:
                vals['short_name_en'] = security.stock_name_en
                
            # Prices & Market Data
            if rec.reference_price != security.reference_price:
                vals['reference_price'] = security.reference_price
            if rec.ceiling_price != security.ceiling_price:
                vals['ceiling_price'] = security.ceiling_price
            if rec.floor_price != security.floor_price:
                vals['floor_price'] = security.floor_price
            if rec.current_price != security.current_price:
                vals['current_price'] = security.current_price
            if rec.high_price != security.high_price:
                vals['high_price'] = security.high_price
            if rec.low_price != security.low_price:
                vals['low_price'] = security.low_price
            if rec.total_value != security.total_value:
                vals['total_value'] = security.total_value
            if rec.change != security.change:
                vals['change'] = security.change
            if rec.change_percent != security.change_percent:
                vals['change_percent'] = security.change_percent
            
            # Always update timestamp if anything changed or just to show liveness
            if vals:
                vals['last_update'] = fields.Datetime.now()
                # Remove skip_fund_sync=True context so it propagates to portfolio.fund
                rec.write(vals)

    @api.model
    def sync_all_certificates_to_portfolio(self):
        """
        Manually trigger sync from ALL Fund Certificates to Portfolio Funds.
        Used by the 'Sync Funds from Master' menu action.
        """
        _logger = logging.getLogger(__name__)
        _logger.info("Starting manual sync from Fund Certificates to Portfolio Funds...")
        
        certificates = self.search([])
        synced_count = 0
        
        for cert in certificates:
            try:
                # 1. Update existing linked funds OR create new one via propagation
                # The existing _propagate_to_portfolio_fund method handles finding by ID or Ticker and updating/creating
                # But let's check if it creates new funds if not found.
                # Looking at _propagate_to_portfolio_fund in this file:
                # It searches PortfolioFund. If found, it writes. If NOT found, it does nothing?
                # Let's check the code: 
                # funds = PortfolioFund.search(...)
                # for fund in funds: ...
                # It seems it Only Updates.
                
                # So we need to handle creation here if propagation doesn't do it.
                
                PortfolioFund = self.env['portfolio.fund'].sudo()
                funds = PortfolioFund.search(['|', ('certificate_id', '=', cert.id), ('ticker', '=', cert.symbol)])
                
                if funds:
                    cert._propagate_to_portfolio_fund()
                    synced_count += 1
                else:
                    # Create new Portfolio Fund
                    # Map values
                    vals = {
                        'certificate_id': cert.id,
                        'ticker': cert.symbol,
                        'name': cert.short_name_vn or cert.short_name_en or cert.symbol,
                        'current_nav': cert.current_price if cert.current_price is not None else 0.0,
                        'description': cert.fund_description or f"{cert.symbol} - {cert.market}",
                        'inception_date': cert.closure_date or fields.Date.context_today(self),
                        # Map other fields as needed, simplified for now to ensure creation
                        'investment_type': 'Growth', # Default
                        'status': 'active' if cert.is_active else 'inactive',
                        # Add extended fields
                        'low_price': cert.low_price if cert.low_price is not None else 0.0,
                        'high_price': cert.high_price if cert.high_price is not None else 0.0,
                        'open_price': cert.initial_certificate_price if cert.initial_certificate_price else (cert.reference_price if cert.reference_price else 0.0),
                    }
                    
                    # Mapping investment type
                    mapping = {
                        'equity': 'Growth',
                        'bond': 'Income',
                        'mixed': 'Income & Growth',
                    }
                    if cert.fund_type:
                        vals['investment_type'] = mapping.get(cert.fund_type, 'Growth')
                        
                    PortfolioFund.create(vals)
                    synced_count += 1
                    
            except Exception as e:
                _logger.error(f"Error syncing certificate {cert.symbol}: {e}")
                
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Đồng bộ hoàn tất',
                'message': f'Đã đồng bộ {synced_count}/{len(certificates)} chứng chỉ quỹ sang danh mục.',
                'type': 'success',
                'sticky': False,
            }
        }


# Loại chương trình



# === AUTO FUND CERTIFICATE CREATION ===
class AutoFundCertificateCreator(models.Model):
    """Tự động tạo fund certificate từ symbols có OHLC data"""
    _name = 'auto.fund.certificate.creator'
    _description = 'Auto Fund Certificate Creator'
    
    @api.model
    def auto_create_fund_certificates_from_ohlc(self):
        """Tạo/cập nhật CCQ trực tiếp từ danh sách Daily OHLC (menu Daily OHLC Data).
        Lấy unique security_id từ `ssi.daily.ohlc`, dùng `ssi.securities` để map sang `fund.certificate`.
        """
        try:
            ohlc_model = self.env['ssi.daily.ohlc'].sudo()
            sec_model = self.env['ssi.securities'].sudo()
            fund_model = self.env['fund.certificate'].sudo()

            ohlc_records = ohlc_model.search([])
            unique_sec_ids = set([r.security_id.id for r in ohlc_records if r.security_id])

            if not unique_sec_ids:
                msg = "Auto Fund Certificate Creation Completed:\n• Created: 0 certificates\n• Updated: 0 certificates\n• Skipped: 0 symbols\n• Total processed: 0 symbols"
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': 'Auto Fund Certificate Creation',
                        'message': msg,
                        'type': 'warning',
                        'sticky': False,
                    }
                }

            created = 0
            updated = 0
            skipped = 0

            securities = sec_model.browse(list(unique_sec_ids))
            for sec in securities:
                try:
                    if not sec.symbol or not sec.market:
                        skipped += 1
                        continue
                    existing = fund_model.search([('symbol', '=', sec.symbol), ('market', '=', sec.market)], limit=1)
                    
                    # Lấy open_price từ Daily OHLC mới nhất
                    latest_ohlc = ohlc_model.search([
                        ('security_id', '=', sec.id)
                    ], order='date desc', limit=1)
                    initial_price = latest_ohlc.open_price if latest_ohlc and latest_ohlc.open_price else 0.0
                    
                    vals = {
                        'symbol': sec.symbol,
                        'market': sec.market,
                        'floor_code': sec.floor_code,
                        'security_type': sec.security_type,
                        'short_name_vn': sec.stock_name_vn,
                        'short_name_en': sec.stock_name_en,
                        'reference_price': sec.reference_price,
                        'ceiling_price': sec.ceiling_price,
                        'floor_price': sec.floor_price,
                        'last_trading_date': sec.last_trading_date,
                        'current_price': sec.current_price,
                        'high_price': sec.high_price,
                        'low_price': sec.low_price,
                        'initial_certificate_quantity': int(sec.volume) if sec.volume else 0,
                        'initial_certificate_price': initial_price,
                        'last_price': sec.last_price,
                        'is_active': True,
                        'last_update': fields.Datetime.now(),
                        'product_status': 'active',
                        'fund_description': f"{sec.symbol} - {sec.security_type} - {sec.market}",
                    }
                    if existing:
                        existing.with_context(skip_fund_sync=True).write(vals)
                        updated += 1
                    else:
                        fund_model.with_context(skip_fund_sync=True).create(vals)
                        created += 1
                except Exception:
                    skipped += 1
                    continue

            total = created + updated + skipped
            message = (
                "Auto Fund Certificate Creation Completed:\n"
                f"• Created: {created} certificates\n"
                f"• Updated: {updated} certificates\n"
                f"• Skipped: {skipped} symbols\n"
                f"• Total processed: {total} symbols"
            )
            _logger.info(message)
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Auto Fund Certificate Creation',
                    'message': message,
                    'type': 'success',
                    'sticky': True,
                }
            }
        except Exception as e:
            _logger.error("Error in auto_create_fund_certificates_from_ohlc: %s", str(e), exc_info=True)
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Auto Fund Certificate Creation Error',
                    'message': f'Error: {str(e)}',
                    'type': 'danger',
                    'sticky': True,
                }
            }
    
    @api.model
    def cron_auto_create_fund_certificates(self):
        """Cron job để tự động tạo fund certificate mỗi ngày"""
        _logger.info("Starting cron job: auto_create_fund_certificates")
        self.auto_create_fund_certificates_from_ohlc()
    
    @api.model
    def action_auto_create_fund_certificates(self):
        """Action để gọi từ button hoặc menu"""
        return self.auto_create_fund_certificates_from_ohlc()
    
    @api.model
    def get_ohlc_statistics(self):
        """Lấy thống kê về symbols có OHLC data"""
        try:
            daily_ohlc_model = self.env['ssi.daily.ohlc']
            securities_model = self.env['ssi.securities']
            fund_cert_model = self.env['fund.certificate']
            
            # Đếm symbols có Daily OHLC
            daily_ohlc_count = daily_ohlc_model.search_count([])
            
            # Đếm unique symbols có OHLC
            daily_ohlc_records = daily_ohlc_model.search([])
            symbols_with_ohlc = set()
            for ohlc in daily_ohlc_records:
                if ohlc.security_id and ohlc.security_id.symbol and ohlc.security_id.market:
                    symbols_with_ohlc.add((ohlc.security_id.symbol, ohlc.security_id.market))
            
            # Đếm fund certificates hiện có
            fund_cert_count = fund_cert_model.search_count([])
            
            # Đếm securities tổng cộng
            securities_count = securities_model.search_count([])
            
            stats = {
                'daily_ohlc_records': daily_ohlc_count,
                'symbols_with_ohlc': len(symbols_with_ohlc),
                'fund_certificates': fund_cert_count,
                'securities_total': securities_count,
                'coverage_percent': round((len(symbols_with_ohlc) / securities_count * 100) if securities_count > 0 else 0, 2)
            }
            
            return stats
            
        except Exception as e:
            _logger.error("Error getting OHLC statistics: %s", str(e))
            return {}