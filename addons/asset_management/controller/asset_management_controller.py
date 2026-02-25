from odoo import http
from odoo.http import request
import json
from markupsafe import Markup
from datetime import datetime, timedelta
from odoo.addons.user_permission_management.utils.permission_checker import require_module_access

class AssetManagementController(http.Controller):
    @http.route('/asset-management', type='http', auth='user', website=True)
    @require_module_access('asset_management')
    def asset_management(self, **kwargs):
        # MROUND helper (step=50)
        def mround(value, step=50):
            try:
                v = float(value or 0.0)
                s = float(step or 1.0)
                return int(round(v / s) * s)
            except Exception:
                return 0
        # Hàm parse_date để chuyển string sang date
        def parse_date(s):
            try:
                return datetime.strptime(s, '%Y-%m-%d').date()
            except Exception:
                return None
        # Lấy danh sách các khoản đầu tư CCQ đang hoạt động của user hiện tại
        investments = request.env['portfolio.investment'].sudo().search([
            ('investment_type', '=', 'fund_certificate'),
            ('status', '=', 'active'),
            ('user_id', '=', request.env.user.id)
        ])

        # Lấy danh sách quỹ có investment (phục vụ chart và summary)
        fund_ids_with_investment = list(set(inv.fund_id.id for inv in investments if inv.fund_id))
        funds = request.env['portfolio.fund'].sudo().search([
            ('status', '=', 'active'),
            ('id', 'in', fund_ids_with_investment)
        ])

        # Tính tổng tài sản từ total_value (computed từ transactions)
        total_assets = sum(inv.total_value for inv in investments)
        
        # Danh sách màu mặc định
        default_colors = [
            '#2B4BFF', '#FF5733', '#33FF57', '#FF33EE', '#33B5FF', '#FFD700',
            '#8A2BE2', '#DC143C', '#00CED1', '#FF8C00', '#4B0082', '#228B22',
            '#FF1493', '#20B2AA', '#FF6347', '#4682B4', '#B8860B', '#9932CC',
            '#008080', '#B22222', '#5F9EA0', '#D2691E', '#7FFF00', '#FF4500'
        ]
        used_colors = {}
        color_pool = default_colors.copy()

        fund_certificates_data = []
        seen_funds = set()
        for fund in funds:
            key = (fund.name, fund.ticker)
            if key in seen_funds:
                continue
            seen_funds.add(key)
            
            # Lấy investment cho quỹ này
            user_investments = request.env['portfolio.investment'].sudo().search([
                ('user_id', '=', request.env.user.id),
                ('fund_id', '=', fund.id),
                ('status', '=', 'active')
            ])
            
            # Dùng computed fields từ investment model
            user_total_ccq = sum(user_investments.mapped('total_ccq'))
            user_available = sum(user_investments.mapped('available_units'))
            user_pending_t2 = sum(user_investments.mapped('pending_t2_units'))
            user_total_value = sum(user_investments.mapped('total_value'))
            # Breakdown by order type
            user_normal_units = sum(user_investments.mapped('normal_order_units'))
            user_negotiated_units = sum(user_investments.mapped('negotiated_order_units'))
            
            # Chỉ hiển thị nếu user có CCQ
            if user_total_ccq <= 0:
                continue
            
            # Calculate T0/T1/T2 breakdown for pending orders
            # T0 = settles today, T1 = settles tomorrow, T2 = settles in 2+ days
            # For BUY: Lệnh đã khớp (completed) nhưng hàng chưa về (t2_date >= today)
            today = datetime.now().date()
            
            # Buy orders already matched (completed) but not yet settled
            # Include t2_date >= today to catch orders settling today (T0)
            pending_buy_txs = request.env['portfolio.transaction'].sudo().search([
                ('user_id', '=', request.env.user.id),
                ('fund_id', '=', fund.id),
                ('transaction_type', '=', 'buy'),
                ('status', '=', 'completed'),
                ('t2_date', '>=', today)  # Lấy lệnh có hàng về từ hôm nay trở đi
            ])
            
            # Calculate pending buy T0/T1/T2 based on days until t2_date
            pending_buy_t0 = 0
            pending_buy_t1 = 0
            pending_buy_t2 = 0
            for tx in pending_buy_txs:
                tx_t2_date = tx.t2_date
                if tx_t2_date:
                    days_until_settle = (tx_t2_date - today).days
                    if days_until_settle == 0:
                        pending_buy_t2 += tx.units or 0  # Settles today (T2)
                    elif days_until_settle == 1:
                        pending_buy_t1 += tx.units or 0  # Settles tomorrow (T1)
                    else:
                        pending_buy_t0 += tx.units or 0  # Settles in 2+ days (T0)
            
            # Sell orders already matched (completed) but not yet settled
            pending_sell_txs = request.env['portfolio.transaction'].sudo().search([
                ('user_id', '=', request.env.user.id),
                ('fund_id', '=', fund.id),
                ('transaction_type', '=', 'sell'),
                ('status', '=', 'completed'),
                ('t2_date', '>=', today)  # Lấy lệnh có tiền về từ hôm nay trở đi
            ])
            
            # Calculate pending sell T0/T1/T2 based on days until t2_date
            # T0 = Sold Today, T2 = Money Arriving Today
            pending_sell_t0 = 0
            pending_sell_t1 = 0
            pending_sell_t2 = 0
            for tx in pending_sell_txs:
                tx_t2_date = tx.t2_date
                if tx_t2_date:
                    days_until_settle = (tx_t2_date - today).days
                    if days_until_settle == 0:
                        pending_sell_t2 += tx.units or 0  # Settles today (T2)
                    elif days_until_settle == 1:
                        pending_sell_t1 += tx.units or 0  # Settles tomorrow (T1)
                    else:
                        pending_sell_t0 += tx.units or 0  # Settles in 2+ days (T0)
            
            # Calculate average sell price from recent sell orders
            recent_sell_txs = request.env['portfolio.transaction'].sudo().search([
                ('user_id', '=', request.env.user.id),
                ('fund_id', '=', fund.id),
                ('transaction_type', '=', 'sell'),
                ('status', '=', 'completed')
            ], limit=1, order='create_date desc')
            sell_price = recent_sell_txs[0].price if recent_sell_txs else fund.current_nav or 0.0
                
            # Gán màu cho từng cặp (name, ticker)
            if key not in used_colors:
                # Lấy màu từ fund.certificate trong fund_management_control
                fund_sudo = fund.sudo()
                fund_color = fund_sudo.color or "#2B4BFF"  # Màu mặc định
                try:
                    # Defensive coding for certificate_id access
                    if 'certificate_id' in fund_sudo._fields and fund_sudo.certificate_id:
                         # Check if it's a valid record
                         if fund_sudo.certificate_id.id:
                            cert_color = fund_sudo.certificate_id.fund_color
                            if cert_color:
                                fund_color = cert_color
                except Exception as e:
                    # Fallback to fund color already set
                    pass
                color = fund_color or (color_pool.pop(0) if color_pool else '#2B4BFF')
                used_colors[key] = color
            else:
                color = used_colors[key]
            
            pl_pct = fund.profit_loss_percentage or 0.0
            
            fund_certificates_data.append({
                'name': fund.name,
                'code': fund.ticker,
                'quantity': user_total_ccq,
                'availableQuantity': user_available,
                'pendingT2Units': user_pending_t2,
                'totalValue': user_total_value,
                'navPrice': fund.current_nav or 0.0,
                'avgPrice': (user_total_value / user_total_ccq) if user_total_ccq > 0 else 0.0,
                'currentPrice': fund.current_nav or 0.0,
                'sellPrice': sell_price,
                # Order type breakdown
                'normalUnits': user_normal_units,
                'negotiatedUnits': user_negotiated_units,
                # Pending buy T0/T1/T2
                'pendingBuyT0': pending_buy_t0,
                'pendingBuyT1': pending_buy_t1,
                'pendingBuyT2': pending_buy_t2,
                # Pending sell T0/T1/T2
                'pendingSellT0': pending_sell_t0,
                'pendingSellT1': pending_sell_t1,
                'pendingSellT2': pending_sell_t2,
                # Can sell when available > 0
                'canSell': user_available > 0,
                'change': pl_pct,
                'isProfit': pl_pct >= 0,
                'color': color
            })
        
        # Hàm chuyển đổi loại giao dịch
        def get_transaction_type_display(type):
            type_map = {
                'buy': 'Mua',
                'sell': 'Bán'
            }
            return type_map.get(type, type)

        # Lấy danh sách holdings từ transactions (chỉ lệnh mua đã khớp)
        tx_domain_holdings = [
            ('user_id', '=', request.env.user.id),
            ('transaction_type', '=', 'buy'),
            ('status', '=', 'completed')
        ]
        tx_holdings = request.env['portfolio.transaction'].sudo().search(tx_domain_holdings, order='create_date desc')

        holdings_data = []
        for tx in tx_holdings:
            partner = request.env.user.partner_id
            so_tk = ''
            if partner:
                status_info = request.env['status.info'].sudo().search([('partner_id', '=', partner.id)], limit=1)
                so_tk = status_info.account_number if status_info else ''
            tx_date = (tx.date_end if hasattr(tx, 'date_end') and tx.date_end else None) or (tx.created_at if hasattr(tx, 'created_at') and tx.created_at else None) or tx.create_date
            tx_date_str = tx_date.strftime('%Y-%m-%d') if tx_date else ''
            tx_date_display = tx_date.strftime('%d/%m/%Y') if tx_date else ''
            unit_price = (tx.price or (tx.current_nav or (tx.fund_id.current_nav if tx.fund_id else 0.0)))
            unit_price = mround(unit_price, 50)
            investment_value = mround((tx.units or 0.0) * unit_price, 50)
            holdings_data.append({
                'accountNumber': so_tk,
                'fund': tx.fund_id.name if tx.fund_id else '',
                'ticker': tx.fund_id.ticker if tx.fund_id else '',
                'tradingDate': tx_date_display,
                'transactionDate': tx_date_str,
                'buyPrice': f"{unit_price:,.0f}",
                'quantity': f"{(tx.units or 0.0):,.0f}",
                'investmentValue': investment_value,
                'previousNav': self._get_previous_nav_price(tx.fund_id.id) if tx.fund_id else 0.0,
                'currentValue': tx.amount or investment_value,
                'profitLossPercent': '0.00',  # đơn giản hóa, tránh phụ thuộc investment
                'profitLossAmount': 0.0,
                'isProfit': False,
                'transactionType': 'Mua'
            })
        # Lấy tất cả giao dịch (chỉ lệnh MUA đã khớp) cho bảng hoán đổi/đơn giản
        transactions = request.env['portfolio.transaction'].sudo().search([
            ('user_id', '=', request.env.user.id),
            ('transaction_type', '=', 'buy'),
            ('status', '=', 'completed')
        ], order='create_date desc')
        # Hàm chuyển đổi trạng thái
        def get_status_display(status):
            status_map = {
                'pending': {
                    'text': 'Chờ khớp lệnh',
                    'color': 'text-yellow-500'
                },
                'completed': {
                    'text': 'Đã khớp lệnh',
                    'color': 'text-green-500'
                },
                'cancelled': {
                    'text': 'Đã hủy',
                    'color': 'text-red-500'
                }
            }
            return status_map.get(status, {
                'text': status,
                'color': 'text-gray-500'
            })
        # Lọc swap_orders theo date_end/created_at
        swap_orders_data = []
        for transaction in transactions:
            partner = request.env.user.partner_id
            so_tk = ''
            if partner:
                status_info = request.env['status.info'].sudo().search([('partner_id', '=', partner.id)], limit=1)
                so_tk = status_info.account_number if status_info else ''
            transaction_date_obj = (transaction.date_end if hasattr(transaction, 'date_end') and transaction.date_end else None) or (transaction.created_at if hasattr(transaction, 'created_at') and transaction.created_at else None) or transaction.create_date
            transaction_date_str = transaction_date_obj.strftime('%Y-%m-%d') if transaction_date_obj else ''
            status_info_dict = get_status_display(transaction.status)
            # Số tiền hiển thị cho lệnh: loại phí mua nếu có, ưu tiên dùng units * price
            unit_price = getattr(transaction, 'price', 0.0) or 0.0
            # MROUND 50 cho unit_price
            unit_price = mround(unit_price, 50)
            amount_ex_fee = (transaction.units or 0.0) * unit_price
            if not amount_ex_fee:
                fee_val = getattr(transaction, 'fee', 0.0) or 0.0
                amount_ex_fee = max((transaction.amount or 0.0) - fee_val, 0.0)
            # MROUND 50 cho số tiền hiển thị
            amount_ex_fee = mround(amount_ex_fee, 50)

            swap_orders_data.append({
                'accountNumber': so_tk,
                'fund': transaction.fund_id.name,
                'ticker': transaction.fund_id.ticker,
                'tradingDate': transaction_date_obj.strftime('%d/%m/%Y') if transaction_date_obj else '',
                'transactionDate': transaction_date_str,
                'amount': amount_ex_fee,
                'status': status_info_dict['text'],
                'statusColor': status_info_dict['color'],
                'transactionType': get_transaction_type_display(transaction.transaction_type),
                'units': f"{(transaction.units or 0.0):,.0f}",
                'description': transaction.description or ''
            })
        
        # Chuẩn bị dữ liệu cho biểu đồ sử dụng giá trị thực tế từ investment
        chart_data = {
            'labels': [inv.fund_id.name for inv in investments],
            'datasets': [{
                'data': [inv.amount for inv in investments],  # Sử dụng giá trị thực tế từ form thay vì current_nav
                'backgroundColor': [self._get_fund_color(inv.fund_id) for inv in investments] # Lấy màu từ fund.certificate
            }]
        }

        # Tabs hiển thị dựa trên các quỹ thực sự có giao dịch (không dựa vào investment)
        tx_fund_tabs = []
        seen_tab_keys = set()
        first_tab = True
        for tx in tx_holdings:
            if not tx.fund_id:
                continue
            key = (tx.fund_id.name, tx.fund_id.ticker)
            if key in seen_tab_keys:
                continue
            seen_tab_keys.add(key)
            tx_fund_tabs.append({
                'name': tx.fund_id.name,
                'code': tx.fund_id.ticker,
                'isActive': first_tab
            })
            first_tab = False

        # Server không cắt dữ liệu; client sẽ phân trang
        page_size = 10
        current_page = 1
        total_items = len(holdings_data)
        start_item = 0
        end_item = min(page_size, total_items)
        has_previous = False
        has_next = total_items > page_size
        total_pages = (total_items + page_size - 1) // page_size
        pages = [{'number': i, 'is_current': i == current_page} for i in range(1, total_pages + 1)]
        
        # Tạo dictionary chứa tất cả dữ liệu
        asset_data = {
            'totalAssets': total_assets,
            'fundCertificates': fund_certificates_data,
            'holdings': holdings_data,
            'swapOrders': {
                'items': swap_orders_data,
                'total': len(swap_orders_data)
            },
            'chartData': json.dumps(chart_data),
            # Active tab theo quỹ có giao dịch
            'activeTab': (tx_fund_tabs[0]['code'] if tx_fund_tabs else ''),
            'currentPage': current_page,
            'pageSize': page_size,
            'pagination_total': total_items,
            'pagination_start': start_item + 1,
            'pagination_end': end_item,
            'hasPrevious': has_previous,
            'hasNext': has_next,
            'pages': pages,
            'selectedFund': {
                'name': (tx_fund_tabs[0]['name'] if tx_fund_tabs else ''),
                'ticker': (tx_fund_tabs[0]['code'] if tx_fund_tabs else '')
            },
            'fundTabs': tx_fund_tabs
        }
        
        # Loại bỏ trường transactionDateObj (kiểu date) trước khi trả về
        for h in holdings_data:
            if 'transactionDateObj' in h:
                del h['transactionDateObj']
        for o in swap_orders_data:
            if 'transactionDateObj' in o:
                del o['transactionDateObj']

        return request.render('asset_management.asset_management_page', {
            'asset_data': Markup(json.dumps(asset_data))
        })
    
    def _get_previous_nav_price(self, fund_id):
        """Lấy giá tồn kho đầu ngày hôm trước từ nav_management, nếu chưa có thì lấy giá tồn kho ban đầu"""
        try:
            # Lấy giá tồn kho đầu ngày hôm trước từ nav.daily.inventory
            yesterday = datetime.now().date() - timedelta(days=1)
            
            # Tìm tồn kho ngày hôm trước
            previous_inventory = request.env['nav.daily.inventory'].sudo().search([
                ('fund_id', '=', fund_id),
                ('inventory_date', '=', yesterday)
            ], limit=1)
            
            if previous_inventory and previous_inventory.opening_avg_price > 0:
                return previous_inventory.opening_avg_price
            
            # Nếu không có tồn kho ngày hôm trước, tìm tồn kho gần nhất trước đó
            nearest_inventory = request.env['nav.daily.inventory'].sudo().search([
                ('fund_id', '=', fund_id),
                ('inventory_date', '<', yesterday),
                ('opening_avg_price', '>', 0)
            ], order='inventory_date desc', limit=1)
            
            if nearest_inventory:
                return nearest_inventory.opening_avg_price
            
            # Nếu không có tồn kho nào, lấy giá tồn kho ban đầu từ nav.fund.config
            fund_config = request.env['nav.fund.config'].sudo().search([
                ('fund_id', '=', fund_id),
                ('active', '=', True)
            ], limit=1)
            
            if fund_config and fund_config.initial_nav_price > 0:
                return fund_config.initial_nav_price
            
            # Không fallback về current_nav, chỉ trả về 0.0 nếu không có dữ liệu tồn kho
            return 0.0
            
        except Exception as e:
            # Không fallback về current_nav, chỉ trả về 0.0 nếu có lỗi
            return 0.0
    
    def _calculate_profit_loss_percentage(self, investment):
        """Tính phần trăm lời/lỗ dựa trên giá tồn kho đầu ngày hiện tại"""
        try:
            if not investment or investment.amount <= 0 or investment.units <= 0:
                return 0.0
            
            # Lấy giá tồn kho đầu ngày hiện tại
            current_nav_price = self._get_current_nav_price(investment.fund_id.id)
            if current_nav_price <= 0:
                return 0.0
            # MROUND 50 cho current_nav_price
            current_nav_price = mround(current_nav_price, 50)
            
            # Tính giá trị hiện tại dựa trên giá tồn kho đầu ngày
            current_value = investment.units * current_nav_price
            profit_loss = current_value - investment.amount
            profit_loss_percentage = (profit_loss / investment.amount) * 100
            
            return f"{profit_loss_percentage:,.2f}"
            
        except Exception as e:
            return "0.00"
    
    def _calculate_profit_loss_amount(self, investment):
        """Tính số tiền lời/lỗ dựa trên giá tồn kho đầu ngày hiện tại"""
        try:
            if not investment or investment.amount <= 0 or investment.units <= 0:
                return 0.0
            
            # Lấy giá tồn kho đầu ngày hiện tại
            current_nav_price = self._get_current_nav_price(investment.fund_id.id)
            if current_nav_price <= 0:
                return 0.0
            # MROUND 50 cho current_nav_price
            current_nav_price = mround(current_nav_price, 50)
            
            # Tính giá trị hiện tại dựa trên giá tồn kho đầu ngày
            current_value = investment.units * current_nav_price
            profit_loss = current_value - investment.amount
            
            return profit_loss
            
        except Exception as e:
            return 0.0
    
    def _get_current_nav_price(self, fund_id):
        """Lấy giá tồn kho đầu ngày hiện tại từ nav_management"""
        try:
            # Lấy giá tồn kho đầu ngày hiện tại từ nav.daily.inventory
            today = datetime.now().date()
            current_inventory = request.env['nav.daily.inventory'].sudo().search([
                ('fund_id', '=', fund_id),
                ('inventory_date', '=', today)
            ], limit=1)
            
            if current_inventory and current_inventory.opening_avg_price > 0:
                return current_inventory.opening_avg_price
            
            # Nếu không có tồn kho hôm nay, tìm tồn kho gần nhất
            nearest_inventory = request.env['nav.daily.inventory'].sudo().search([
                ('fund_id', '=', fund_id),
                ('opening_avg_price', '>', 0)
            ], order='inventory_date desc', limit=1)
            
            if nearest_inventory:
                return nearest_inventory.opening_avg_price
            
            # Nếu không có tồn kho nào, lấy giá tồn kho ban đầu từ nav.fund.config
            fund_config = request.env['nav.fund.config'].sudo().search([
                ('fund_id', '=', fund_id),
                ('active', '=', True)
            ], limit=1)
            
            if fund_config and fund_config.initial_nav_price > 0:
                return fund_config.initial_nav_price
            
            # Không fallback về current_nav, chỉ trả về 0.0 nếu không có dữ liệu tồn kho
            return 0.0
            
        except Exception as e:
            # Không fallback về current_nav, chỉ trả về 0.0 nếu có lỗi
            return 0.0
    
    def _get_fund_color(self, fund):
        """Lấy màu từ fund.certificate trong fund_management_control"""
        try:
            if not fund:
                return "#2B4BFF"
            
            # Lấy màu từ fund.certificate trong fund_management_control (sudo để tránh lỗi quyền)
            fund_sudo = fund.sudo()
            fund_color = fund_sudo.color or "#2B4BFF"  # Màu mặc định
            if hasattr(fund_sudo, 'certificate_id') and fund_sudo.certificate_id:
                fund_color = fund_sudo.certificate_id.fund_color or fund_sudo.color or "#2B4BFF"
                print(f"DEBUG: Fund {fund_sudo.ticker} color from certificate: {fund_sudo.certificate_id.fund_color}, final: {fund_color}")
            else:
                print(f"DEBUG: Fund {fund_sudo.ticker} no certificate, using fund.color: {fund_sudo.color}")
            
            return fund_color
        except Exception as e:
            print(f"DEBUG: Error getting fund color for {fund.ticker if fund else 'None'}: {e}")
            return "#2B4BFF" 