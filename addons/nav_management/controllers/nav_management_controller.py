from odoo import http, fields, _
from odoo.http import request
import json
import csv
import io
import logging
from datetime import datetime
from odoo.addons.user_permission_management.utils.permission_checker import require_module_access

_logger = logging.getLogger(__name__)

class NavManagementController(http.Controller):
    
    @http.route('/nav_management', type='http', auth='user', website=True)
    @require_module_access('nav_management')
    def nav_management_page(self, **kwargs):
        """Trang chính NAV Management"""
        # Lấy danh sách quỹ
        funds = request.env['portfolio.fund'].search([])
        
        # Lấy dữ liệu NAV phiên giao dịch
        nav_transactions = request.env['nav.transaction'].search([])
        
        values = {
            'funds': funds,
            'nav_transactions': nav_transactions,
        }
        
        return request.render('nav_management.nav_management_page', values)
    
    @http.route('/nav_management/nav_transaction', type='http', auth='user', website=True)
    def nav_transaction_page(self, **kwargs):
        """Trang NAV phiên giao dịch"""
        # Lấy danh sách quỹ
        funds = request.env['portfolio.fund'].search([])
        
        # Lấy quỹ được chọn từ parameter
        selected_fund_id = kwargs.get('fund_id')
        try:
            selected_fund_id = int(selected_fund_id) if selected_fund_id else None
        except Exception:
            selected_fund_id = None
        nav_transactions = []
        
        if selected_fund_id:
            nav_transactions = request.env['nav.transaction'].search([
                ('fund_id', '=', int(selected_fund_id))
            ])
        
        values = {
            'funds': funds,
            'funds_json': json.dumps(funds.read(['id', 'name', 'ticker'])),
            'selected_fund_id': selected_fund_id,
            'selected_fund_id_json': json.dumps(selected_fund_id),
            'nav_transactions': nav_transactions,
        }
        
        return request.render('nav_management.nav_transaction_page', values)
    
    
    @http.route('/nav_management/api/funds', type='json', auth='user', methods=['POST'])
    def get_funds(self):
        """API lấy danh sách quỹ từ portfolio.fund"""
        try:
            # Sử dụng portfolio.fund trực tiếp như fund_management
            funds = request.env['portfolio.fund'].search([])
            return {
                'funds': [{
                    'id': fund.id,
                    'name': fund.name,
                    'ticker': fund.ticker,
                    'description': fund.description or '',
                } for fund in funds]
            }
        except Exception as e:
            _logger.error(f"Error in get_funds: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    @http.route('/nav_management/api/nav_transaction', type='json', auth='user', methods=['POST'])
    def get_nav_transactions(self, fund_id=None, from_date=None, to_date=None, status_filter='pending'):
        """API lấy dữ liệu NAV phiên giao dịch từ portfolio.transaction (transaction_list)."""
        try:
            # Đọc tham số từ JSON-RPC
            try:
                params = request.jsonrequest.get('params') if request.jsonrequest else None
                if params:
                    fund_id = params.get('fund_id', fund_id)
                    from_date = params.get('from_date', from_date)
                    to_date = params.get('to_date', to_date)
                    status_filter = params.get('status_filter', status_filter)
            except Exception:
                pass

            # Gọi model để lấy dữ liệu theo đúng logic đã tái sử dụng
            data = request.env['nav.transaction'].sudo().get_nav_transactions_via_portfolio(
                fund_id=fund_id,
                from_date=from_date,
                to_date=to_date,
                status_filter=status_filter,
            )

            return { 'nav_transactions': data }
        except Exception as e:
            _logger.error(f"Error in get_nav_transactions: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    
    
    @http.route('/nav_management/export_nav_transaction/<int:fund_id>', type='http', auth='user')
    def export_nav_transaction(self, fund_id):
        """Xuất file CSV NAV phiên giao dịch"""
        nav_transactions = request.env['nav.transaction'].search([
            ('fund_id', '=', fund_id)
        ])
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['No', 'Phiên giao dịch', 'Giá trị NAV', 'Ngày tạo'])
        
        # Data
        for i, nav in enumerate(nav_transactions, 1):
            writer.writerow([
                i,
                nav.transaction_session,
                nav.nav_value,
                nav.create_date.strftime('%d/%m/%Y, %H:%M') if nav.create_date else ''
            ])
        
        output.seek(0)
        
        response = request.make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename="nav_phiên_giao_dịch_{fund_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        
        return response
    
    
    @http.route('/nav_management/api/term_rates', type='http', auth='user', methods=['GET'])
    def get_term_rates(self):
        """Trả về bảng lãi suất theo kỳ hạn từ model nav.term.rate (active)."""
        try:
            TermRate = request.env['nav.term.rate'].sudo()
            rates = TermRate.search([('active', '=', True)], order='term_months asc')
            payload = {
                'success': True,
                'rates': [{'term_months': r.term_months, 'interest_rate': r.interest_rate} for r in rates],
                'rate_map': {str(r.term_months): r.interest_rate for r in rates},
            }
            return request.make_json_response(payload)
        except Exception as e:
            return request.make_json_response({'success': False, 'message': str(e)}, status=500)

    @http.route('/nav_management/api/calc_metrics', type='json', auth='user', methods=['POST'])
    def calc_metrics(self):
        """Tính toán các trường NAV (sell_value, price1, price2, interest_rate_new, interest_delta).

        Body JSON-RPC:
        { params: { items: [ { nav_value, interest_rate, units, remaining_units, amount/trade_price, term_months, days }, ... ] } }
        """
        try:
            params = request.jsonrequest.get('params') if request.jsonrequest else None
            items = (params or {}).get('items') if params else None
            if not items or not isinstance(items, list):
                return {'success': False, 'message': 'Thiếu danh sách items'}

            calc = request.env['nav.transaction.calculator']
            results = []
            for it in items:
                try:
                    base = it or {}
                    # Đảm bảo các field đầu vào tối thiểu có mặt để UI hiển thị được
                    if 'trade_price' not in base:
                        # nếu thiếu, cho phép calculator tự fallback dựa vào units*nav_value
                        base['trade_price'] = base.get('amount') or 0
                    metrics = calc.compute_transaction_metrics(base)
                    enriched = {}
                    enriched.update(base)
                    enriched.update(metrics)
                    results.append(enriched)
                except Exception as _:
                    results.append(it or {})
            return { 'success': True, 'items': results }
        except Exception as e:
            return { 'success': False, 'message': str(e) }

    @http.route('/nav_management/api/cap_config', type='http', auth='user', methods=['GET'])
    def get_cap_config(self):
        """Trả về cấu hình chặn trên / chặn dưới đang active (bản ghi mới nhất)."""
        try:
            cfg = request.env['nav.transaction'].sudo().get_active_cap_config()
            if cfg.get('success'):
                return request.make_json_response({
                    'success': True,
                    'cap_upper': cfg.get('cap_upper'),
                    'cap_lower': cfg.get('cap_lower'),
                })
            # Trả về success=True nhưng kèm message để frontend có thể hiển thị
            return request.make_json_response({
                'success': True,
                'cap_upper': None,
                'cap_lower': None,
                'message': cfg.get('message')
            })
        except Exception as e:
            return request.make_json_response({'success': False, 'message': str(e)}, status=500)

    @http.route('/nav_management/api/calculate_nav_transaction', type='json', auth='user', methods=['POST'])
    def calculate_nav_transaction(self, fund_id=None, from_date=None, to_date=None, cap_upper=None, cap_lower=None):
        """API tính toán NAV phiên giao dịch + lọc theo chênh lệch lãi suất dựa trên giá bán 2.

        Quy ước:
        - Giá trị bán = Giá trị lệnh * lãi suất / 365 * Số ngày + Giá trị lệnh
        - Giá bán 1 = ROUND(Giá trị bán / Số lượng CCQ, 0)
        - Giá bán 2 = MROUND(Giá bán 1, 50)
        - LS quy đổi = (Giá bán 2 / Giá mua/bán - 1) * 365 / Số ngày * 100
        - Chênh lệch lãi suất: delta = LS quy đổi - interest_rate
        - Lãi nếu cap_lower <= delta <= cap_upper (lấy từ cấu hình nav.cap.config)
        """
        try:
            # Hỗ trợ đọc tham số dạng JSON-RPC
            try:
                params = request.jsonrequest.get('params') if request.jsonrequest else None
                if params:
                    fund_id = params.get('fund_id', fund_id)
                    from_date = params.get('from_date', from_date)
                    to_date = params.get('to_date', to_date)
                    cap_upper = params.get('cap_upper', cap_upper)
                    cap_lower = params.get('cap_lower', cap_lower)
                    
                    # Convert to float if not None
                    if cap_upper is not None:
                        cap_upper = float(cap_upper)
                    if cap_lower is not None:
                        cap_lower = float(cap_lower)
            except Exception:
                pass

            # Luôn đọc cap từ model helper trước, sau đó cho phép client override
            try:
                cfg = request.env['nav.transaction'].sudo().get_active_cap_config()
                if cfg.get('success'):
                    if cap_upper is None:
                        cap_upper = float(cfg.get('cap_upper') or 0.0)
                    if cap_lower is None:
                        cap_lower = float(cfg.get('cap_lower') or 0.0)
                else:
                    return {'success': False, 'message': cfg.get('message') or 'Không tìm thấy cấu hình chặn trên/chặn dưới.'}
            except Exception as e:
                return {'success': False, 'message': f'Lỗi đọc cấu hình chặn trên/chặn dưới: {str(e)}'}

            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}
            # Lấy dữ liệu phiên giao dịch từ portfolio.transaction qua model nav.transaction helper
            # Áp dụng filter ngày từ frontend
            raw_list = request.env['nav.transaction'].sudo().get_nav_transactions_via_portfolio(
                fund_id=fund_id,
                from_date=from_date,
                to_date=to_date,
                status_filter='pending_remaining',  # Chỉ lấy pending có remaining units > 0
            )

            profitable = []
            calculator = request.env['nav.transaction.calculator']
            for item in raw_list:
                # Bỏ qua item thiếu dữ liệu cơ bản
                if float(item.get('nav_value') or 0) <= 0:
                    continue
                if float(item.get('remaining_units') or item.get('units') or 0) <= 0:
                    continue

                metrics = calculator.compute_transaction_metrics(item)
                # Gộp kết quả vào item để trả về UI
                item.update(metrics)
                delta = float(metrics.get('interest_delta') or 0)

                if delta >= float(cap_lower) and delta <= float(cap_upper):
                    profitable.append(item)

            return {
                'success': True,
                'message': 'Đã tính và lọc giao dịch có lãi',
                'data': {
                    'total': len(raw_list),
                    'profitable': len(profitable),
                },
                'transactions': profitable,
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': str(e)
            }
    
    
    @http.route('/nav_management/api/daily_inventory/list', type='json', auth='user', methods=['POST'])
    def get_daily_inventory(self, fund_id=None, from_date=None, to_date=None):
        """API lấy dữ liệu tồn kho CCQ hàng ngày"""
        try:
            # Hỗ trợ đọc tham số dạng JSON-RPC
            params = request.jsonrequest.get('params') if request.jsonrequest else None
            if params:
                fund_id = params.get('fund_id', fund_id)
                from_date = params.get('from_date', from_date)
                to_date = params.get('to_date', to_date)
            
            domain = []
            if fund_id:
                domain.append(('fund_id', '=', fund_id))
            if from_date:
                domain.append(('inventory_date', '>=', from_date))
            if to_date:
                domain.append(('inventory_date', '<=', to_date))
            
            inventories = request.env['nav.daily.inventory'].search(domain, order='inventory_date desc')
            return {
                'success': True,
                'inventories': [{
                    'id': inv.id,
                    'fund_id': inv.fund_id.id,
                    'fund_name': inv.fund_id.name,
                    'inventory_date': inv.inventory_date.isoformat() if inv.inventory_date else '',
                    'opening_ccq': inv.opening_ccq,
                    'closing_ccq': inv.closing_ccq,
                    'opening_avg_price': inv.opening_avg_price,
                    'closing_avg_price': inv.closing_avg_price,
                    'opening_value': inv.opening_value,
                    'closing_value': inv.closing_value,
                    'ccq_change': inv.ccq_change,
                    'price_change': inv.price_change,
                    'value_change': inv.value_change,
                    'status': inv.status,
                    'description': inv.description or '',
                } for inv in inventories]
            }
        except Exception as e:
            return {
                'success': False,
                'message': str(e)
            }

    @http.route('/nav_management/api/nav_stat_card', type='json', auth='user', methods=['POST'])
    def nav_stat_card(self, fund_id=None, inventory_date=None):
        """Trả về NAV trung bình (closing_avg_price) và auto tạo bản ghi nếu thiếu"""
        try:
            params = request.jsonrequest.get('params') if request.jsonrequest else None
            if params:
                fund_id = params.get('fund_id', fund_id)
                inventory_date = params.get('inventory_date', inventory_date)
            if not inventory_date:
                inventory_date = fields.Date.today()

            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}

            Inventory = request.env['nav.daily.inventory']
            inv = Inventory.search([('fund_id', '=', fund_id), ('inventory_date', '=', inventory_date)], limit=1)
            if not inv:
                # tạo bản ghi từ ngày trước rồi tính
                inv = Inventory.create_daily_inventory_for_fund(fund_id, inventory_date)
                inv.action_calculate_daily_inventory()

            data = {
                'fund_id': inv.fund_id.id,
                'fund_name': inv.fund_id.name,
                'date': inv.inventory_date.isoformat(),
                'opening_ccq': inv.opening_ccq,
                'closing_ccq': inv.closing_ccq,
                'opening_avg_price': inv.opening_avg_price,
                'closing_avg_price': inv.closing_avg_price,
                'closing_value': inv.closing_value,
            }
            return {'success': True, 'data': data}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    # Legacy route /nav_management/api/nav_opening_price has been removed. Use /nav_management/api/opening_price_today instead.
    
    @http.route('/nav_management/api/nav_average_price', type='json', auth='user', methods=['POST'])
    def get_nav_average_price(self, fund_id=None, inventory_date=None):
        """Lấy giá trị NAV trung bình từ tồn kho cuối ngày"""
        try:
            # Xử lý params từ request body (JSON-RPC format)
            params = None
            if hasattr(request, 'jsonrequest') and request.jsonrequest:
                params = request.jsonrequest.get('params')
            if params:
                fund_id = params.get('fund_id', fund_id)
                inventory_date = params.get('inventory_date', inventory_date)
            
            # Fallback: nếu không có params từ JSON-RPC, thử lấy từ request body trực tiếp
            if not params and hasattr(request, 'jsonrequest') and request.jsonrequest:
                # Trường hợp request.jsonrequest là dict trực tiếp
                if isinstance(request.jsonrequest, dict):
                    fund_id = request.jsonrequest.get('fund_id', fund_id)
                    inventory_date = request.jsonrequest.get('inventory_date', inventory_date)
            if not inventory_date:
                inventory_date = fields.Date.today()

            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}

            # Log để debug
            print(f"Getting NAV average price for fund_id={fund_id}, date={inventory_date}")
            print(f"Request jsonrequest: {request.jsonrequest if hasattr(request, 'jsonrequest') else 'None'}")

            Inventory = request.env['nav.daily.inventory']
            inv = Inventory.search([('fund_id', '=', fund_id), ('inventory_date', '=', inventory_date)], limit=1)
            
            if not inv:
                print(f"No inventory found for fund {fund_id} on {inventory_date}, creating new one...")
                # Tạo bản ghi mới cho ngày hiện tại (luôn tạo mới để cập nhật realtime)
                inv = Inventory.create_daily_inventory_for_fund(fund_id, inventory_date)
                if not inv:
                    return {'success': False, 'message': 'Không thể tạo bản ghi tồn kho'}
                # Tự động tính toán ngay sau khi tạo
                inv._auto_calculate_inventory()
            else:
                print(f"Found existing inventory for fund {fund_id} on {inventory_date}")
                # Nếu đã có bản ghi, tính lại để cập nhật realtime
                inv._auto_calculate_inventory()

            # Lấy giá trị NAV trung bình từ tồn kho cuối ngày (cho statcard)
            average_nav_price = inv.closing_avg_price or 0
            
            print(f"Returning average_nav_price: {average_nav_price}")
            
            return {
                'success': True, 
                'average_nav_price': average_nav_price,
                'fund_id': inv.fund_id.id,
                'fund_name': inv.fund_id.name,
                'date': inv.inventory_date.isoformat(),
                'debug_info': {
                    'opening_ccq': inv.opening_ccq,
                    'closing_ccq': inv.closing_ccq,
                    'opening_avg_price': inv.opening_avg_price,
                    'closing_avg_price': inv.closing_avg_price,
                    'status': inv.status
                }
            }
        except Exception as e:
            print(f"Error in get_nav_average_price: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'message': str(e)}
    
    @http.route('/nav_management/api/recalculate_inventory', type='json', auth='user', methods=['POST'])
    def recalculate_inventory_after_transaction_change(self, fund_id=None, inventory_date=None):
        """Tính lại tồn kho sau khi có thay đổi giao dịch (xóa/sửa)"""
        try:
            params = request.jsonrequest.get('params') if request.jsonrequest else None
            if params:
                fund_id = params.get('fund_id', fund_id)
                inventory_date = params.get('inventory_date', inventory_date)
            if not inventory_date:
                inventory_date = fields.Date.today()

            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}

            # Gọi method tính lại tồn kho
            result = request.env['nav.daily.inventory'].refresh_inventory_after_transaction_change(
                fund_id, inventory_date
            )
            
            return result
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    @http.route('/nav_management/api/refresh_all_inventories', type='json', auth='user', methods=['POST'])
    def refresh_all_inventories(self):
        """Refresh tất cả tồn kho để đảm bảo dữ liệu mới nhất"""
        try:
            result = request.env['nav.daily.inventory'].auto_refresh_all_inventories()
            return result
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    @http.route('/nav_management/api/daily_inventory/create', type='json', auth='user', methods=['POST'])
    def create_daily_inventory(self, fund_id, inventory_date, opening_ccq, opening_avg_price, description=''):
        """API tạo tồn kho CCQ hàng ngày mới"""
        try:
            inventory = request.env['nav.daily.inventory'].create({
                'fund_id': fund_id,
                'inventory_date': inventory_date,
                'opening_ccq': opening_ccq,
                'opening_avg_price': opening_avg_price,
                'description': description
            })
            
            return {
                'success': True,
                'message': 'Tạo tồn kho CCQ thành công',
                'data': {
                    'id': inventory.id,
                    'fund_name': inventory.fund_id.name,
                    'inventory_date': inventory.inventory_date.isoformat(),
                    'opening_ccq': inventory.opening_ccq,
                    'opening_avg_price': inventory.opening_avg_price,
                }
            }
        except Exception as e:
            return {
                'success': False,
                'message': str(e)
            }
    
    @http.route('/nav_management/api/daily_inventory/auto_create', type='json', auth='user', methods=['POST'])
    def auto_create_daily_inventory(self, fund_id=None, inventory_date=None):
        """API tự động tạo tồn kho CCQ hàng ngày với dữ liệu từ ngày trước"""
        try:
            if not inventory_date:
                inventory_date = fields.Date.today()
            
            if fund_id:
                # Tạo cho một quỹ cụ thể
                inventory = request.env['nav.daily.inventory'].create_daily_inventory_for_fund(fund_id, inventory_date)
                return {
                    'success': True,
                    'message': 'Tạo tồn kho CCQ tự động thành công',
                    'data': {
                        'id': inventory.id,
                        'fund_name': inventory.fund_id.name,
                        'inventory_date': inventory.inventory_date.isoformat(),
                        'opening_ccq': inventory.opening_ccq,
                        'opening_avg_price': inventory.opening_avg_price,
                    }
                }
            else:
                # Tạo cho tất cả quỹ
                inventories = request.env['nav.daily.inventory'].auto_create_today_inventory()
                return {
                    'success': True,
                    'message': f'Tạo tồn kho CCQ tự động cho {len(inventories)} quỹ thành công',
                    'data': [{
                        'id': inv.id,
                        'fund_name': inv.fund_id.name,
                        'inventory_date': inv.inventory_date.isoformat(),
                        'opening_ccq': inv.opening_ccq,
                        'opening_avg_price': inv.opening_avg_price,
                    } for inv in inventories]
                }
        except Exception as e:
            return {
                'success': False,
                'message': str(e)
            }

    @http.route('/nav_management/api/inventory/recalc_after_match', type='json', auth='user', methods=['POST'])
    def recalc_inventory_after_match(self, fund_id=None, inventory_date=None):
        """Recalc tồn kho sau khi có lệnh khớp với nhà tạo lập.

        - Không tạo logic tính mới; tái sử dụng NavDailyInventory:
          - Đảm bảo có bản ghi cho ngày (auto create nếu thiếu từ ngày trước)
          - Tính lại closing_ccq/closing_avg_price theo các giao dịch completed trong ngày
        - Trả về dữ liệu stat card để frontend cập nhật ngay.
        """
        try:
            # Guard clause
            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}

            if not inventory_date:
                inventory_date = fields.Date.today()

            Inventory = request.env['nav.daily.inventory']
            # Đảm bảo có record cho ngày
            inv = Inventory.search([('fund_id', '=', fund_id), ('inventory_date', '=', inventory_date)], limit=1)
            if not inv:
                inv = Inventory.create_daily_inventory_for_fund(fund_id, inventory_date)

            # Tính lại theo giao dịch completed trong ngày
            inv.action_calculate_daily_inventory()

            data = {
                'fund_id': inv.fund_id.id,
                'fund_name': inv.fund_id.name,
                'date': inv.inventory_date.isoformat() if inv.inventory_date else '',
                'opening_ccq': inv.opening_ccq,
                'closing_ccq': inv.closing_ccq,
                'opening_avg_price': inv.opening_avg_price,
                'closing_avg_price': inv.closing_avg_price,
                'opening_value': inv.opening_value,
                'closing_value': inv.closing_value,
                'ccq_change': inv.ccq_change,
                'price_change': inv.price_change,
                'value_change': inv.value_change,
                'status': inv.status,
            }
            return {'success': True, 'message': 'Đã tính lại tồn kho cuối ngày', 'data': data}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    @http.route('/nav_management/api/inventory/confirm_end_of_day', type='json', auth='user', methods=['POST'])
    def confirm_end_of_day_inventory(self, fund_id=None, inventory_date=None):
        """Chốt tồn kho cuối ngày để làm giá tồn kho đầu ngày cho ngày mới.

        - Recalc trước khi chốt để đảm bảo số liệu mới nhất
        - Đặt trạng thái record = confirmed
        """
        try:
            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}

            if not inventory_date:
                inventory_date = fields.Date.today()

            Inventory = request.env['nav.daily.inventory']
            inv = Inventory.search([('fund_id', '=', fund_id), ('inventory_date', '=', inventory_date)], limit=1)
            if not inv:
                inv = Inventory.create_daily_inventory_for_fund(fund_id, inventory_date)

            # Tính lại rồi chốt
            inv.action_calculate_daily_inventory()
            inv.action_confirm()

            return {
                'success': True,
                'message': 'Đã chốt tồn kho cuối ngày',
                'data': {
                    'id': inv.id,
                    'fund_id': inv.fund_id.id,
                    'fund_name': inv.fund_id.name,
                    'inventory_date': inv.inventory_date.isoformat() if inv.inventory_date else '',
                    'closing_ccq': inv.closing_ccq,
                    'closing_avg_price': inv.closing_avg_price,
                    'closing_value': inv.closing_value,
                    'status': inv.status,
                }
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}


    @http.route('/nav_management/api/opening_price_today', type='json', auth='user', methods=['POST'])
    def get_opening_price_today(self, fund_id=None):
        """Trả về opening_avg_price hôm nay của quỹ. Nếu chưa có bản ghi hôm nay, fallback về:
        - nếu có bản ghi gần nhất trước đó: dùng closing_avg_price của bản ghi gần nhất
        - nếu không có: dùng initial_nav_price từ cấu hình quỹ
        """
        try:
            try:
                params = request.jsonrequest.get('params') if request.jsonrequest else None
                if params:
                    fund_id = params.get('fund_id', fund_id)
            except Exception:
                pass

            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}

            today = fields.Date.today()
            Inventory = request.env['nav.daily.inventory'].sudo()
            # Hôm nay
            inv_today = Inventory.search([
                ('fund_id', '=', fund_id),
                ('inventory_date', '=', today)
            ], limit=1)
            if inv_today and inv_today.opening_avg_price:
                opening = float(inv_today.opening_avg_price)
                # Lấy chi phí vốn từ fund.certificate
                fund = request.env['portfolio.fund'].sudo().browse(fund_id)
                cert = fund.certificate_id if fund else None
                cap_percent = float(cert.capital_cost) if cert else 0.0
                cap_amount = opening * cap_percent / 100.0
                opening_with_cap = opening + cap_amount
                return {'success': True, 'data': {
                    'opening_avg_price': opening,
                    'capital_cost_percent': cap_percent,
                    'capital_cost_amount': cap_amount,
                    'opening_price_with_capital_cost': opening_with_cap,
                }}

            # Gần nhất trước hôm nay
            inv_prev = Inventory.search([
                ('fund_id', '=', fund_id),
                ('inventory_date', '<', today)
            ], order='inventory_date desc', limit=1)
            if inv_prev and inv_prev.closing_avg_price:
                opening = float(inv_prev.closing_avg_price)
                # Lấy chi phí vốn từ fund.certificate
                fund = request.env['portfolio.fund'].sudo().browse(fund_id)
                cert = fund.certificate_id if fund else None
                cap_percent = float(cert.capital_cost) if cert else 0.0
                cap_amount = opening * cap_percent / 100.0
                opening_with_cap = opening + cap_amount
                return {'success': True, 'data': {
                    'opening_avg_price': opening,
                    'capital_cost_percent': cap_percent,
                    'capital_cost_amount': cap_amount,
                    'opening_price_with_capital_cost': opening_with_cap,
                }}

            # Fallback: lấy từ fund.certificate
            fund = request.env['portfolio.fund'].sudo().browse(fund_id)
            cert = fund.certificate_id if fund else None
            if cert:
                opening = float(cert.initial_certificate_price or 0.0)
                cap_percent = float(cert.capital_cost or 0.0)
                cap_amount = opening * cap_percent / 100.0
                opening_with_cap = opening + cap_amount
                return {'success': True, 'data': {
                    'opening_avg_price': opening,
                    'capital_cost_percent': cap_percent,
                    'capital_cost_amount': cap_amount,
                    'opening_price_with_capital_cost': opening_with_cap,
                }}

            return {'success': False, 'message': 'Không tìm thấy dữ liệu opening cho quỹ'}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def _safe_get_capital_cost(self, cert):
        """Safely get capital_cost from certificate, returns 0.0 if field doesn't exist."""
        try:
            if cert and cert.exists():
                return float(getattr(cert, 'capital_cost', 0) or 0)
        except Exception:
            pass
        return 0.0

    def _build_opening_price_response(self, opening, cert):
        """Build a standard opening price response dict."""
        cap_percent = self._safe_get_capital_cost(cert)
        cap_amount = opening * cap_percent / 100.0
        opening_with_cap = opening + cap_amount
        return {
            'success': True,
            'data': {
                'opening_avg_price': opening,
                'capital_cost_percent': cap_percent,
                'capital_cost_amount': cap_amount,
                'opening_price_with_capital_cost': opening_with_cap,
            }
        }

    @http.route('/nav_management/api/opening_price_today_http', type='http', auth='user', methods=['GET'])
    def get_opening_price_today_http(self, fund_id=None):
        """Endpoint HTTP trả JSON đơn giản để frontend dễ tiêu thụ, tránh JSON-RPC."""
        try:
            from odoo import http as _http
            # Lấy fund_id từ query nếu chưa có
            if not fund_id:
                fund_id = request.params.get('fund_id')
            if not fund_id:
                return _http.Response(json.dumps({'success': False, 'message': 'Thiếu fund_id'}), status=400, content_type='application/json')

            fund_id_int = int(fund_id)
            today = fields.Date.today()
            Inventory = request.env['nav.daily.inventory'].sudo()

            # Lấy cert 1 lần duy nhất
            fund = request.env['portfolio.fund'].sudo().browse(fund_id_int)
            cert = fund.certificate_id if fund and fund.exists() else None

            inv_today = Inventory.search([('fund_id', '=', fund_id_int), ('inventory_date', '=', today)], limit=1)
            if inv_today and inv_today.opening_avg_price:
                opening = float(inv_today.opening_avg_price)
                payload = self._build_opening_price_response(opening, cert)
                return _http.Response(json.dumps(payload), content_type='application/json')

            inv_prev = Inventory.search([('fund_id', '=', fund_id_int), ('inventory_date', '<', today)], order='inventory_date desc', limit=1)
            if inv_prev and inv_prev.closing_avg_price:
                opening = float(inv_prev.closing_avg_price)
                payload = self._build_opening_price_response(opening, cert)
                return _http.Response(json.dumps(payload), content_type='application/json')

            # Fallback: lấy từ fund.certificate
            if cert and cert.exists():
                opening = float(getattr(cert, 'initial_certificate_price', 0) or 0)
                payload = self._build_opening_price_response(opening, cert)
                return _http.Response(json.dumps(payload), content_type='application/json')

            return _http.Response(json.dumps({'success': False, 'message': 'Không tìm thấy dữ liệu opening cho quỹ'}), status=404, content_type='application/json')
        except Exception as e:
            from odoo import http as _http
            _logger.error(f"Error in get_opening_price_today_http: {e}", exc_info=True)
            return _http.Response(json.dumps({'success': False, 'message': str(e)}), status=500, content_type='application/json')
    
    @http.route('/nav_management/api/auto_create_inventory', type='json', auth='user', methods=['POST'])
    def auto_create_inventory(self):
        """API tự động tạo tồn kho cho tất cả quỹ"""
        try:
            params = request.jsonrequest.get('params') if request.jsonrequest else {}
            target_date = params.get('target_date')
            
            if not target_date:
                target_date = fields.Date.today()
            
            # Tạo tồn kho cho ngày cụ thể
            result = request.env['nav.daily.inventory'].auto_create_inventory_for_date(target_date)
            
            return {
                'success': result.get('success', False),
                'message': f"Đã tạo tồn kho cho {result.get('created', 0)}/{result.get('total', 0)} quỹ ngày {target_date}",
                'data': result
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}

    @http.route('/nav_management/api/fund_config', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def get_fund_config(self, fund_id=None):
        """Trả về cấu hình quỹ NAV (nav.fund.config) cho fund_id."""
        try:
            if not fund_id:
                fund_id = request.params.get('fund_id')
            if not fund_id:
                return request.make_json_response(
                    {'success': False, 'message': 'Thiếu fund_id'}, status=400)

            config = request.env['nav.fund.config'].sudo().search([
                ('fund_id', '=', int(fund_id)),
                ('active', '=', True),
            ], limit=1)

            if not config:
                return request.make_json_response({
                    'success': False,
                    'message': 'Không tìm thấy cấu hình quỹ NAV cho fund_id này',
                })

            return request.make_json_response({
                'success': True,
                'data': {
                    'id': config.id,
                    'fund_id': config.fund_id.id,
                    'fund_name': config.fund_id.name,
                    'initial_nav_price': config.initial_nav_price,
                    'initial_ccq_quantity': config.initial_ccq_quantity,
                    'capital_cost_percent': config.capital_cost_percent,
                    'description': config.description or '',
                    'active': config.active,
                },
            })
        except Exception as e:
            return request.make_json_response(
                {'success': False, 'message': str(e)}, status=500)