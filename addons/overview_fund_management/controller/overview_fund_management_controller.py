from odoo import http
from odoo.http import request
import json
from markupsafe import Markup
import pytz
from datetime import datetime, timedelta
from odoo.addons.user_permission_management.utils.permission_checker import require_module_access


class OverviewFundManagementController(http.Controller):
    
    def _get_safe_timezone(self, user_tz=None):
        """
        Lấy timezone an toàn cho user
        Args:
            user_tz: timezone của user
        Returns:
            pytz timezone object
        """
        if not user_tz:
            user_tz = 'Asia/Ho_Chi_Minh'
        
        # Kiểm tra và sửa timezone không hợp lệ
        if user_tz == 'Asia/Saigon':
            user_tz = 'Asia/Ho_Chi_Minh'
        
        # Validate timezone và sử dụng timezone mặc định nếu không hợp lệ
        try:
            return pytz.timezone(user_tz)
        except pytz.exceptions.UnknownTimeZoneError:
            # Fallback về timezone mặc định nếu timezone không hợp lệ
            return pytz.timezone('Asia/Ho_Chi_Minh')
    
    @http.route('/investment_dashboard', type='http', auth='user', website=True)
    @require_module_access('overview_fund_management')
    def investment_dashboard_page(self, **kwargs):
        # MROUND helper (step=50)
        def mround(value, step=50):
            try:
                v = float(value or 0.0)
                s = float(step or 1.0)
                return int(round(v / s) * s)
            except Exception:
                return 0
        # Lấy dữ liệu quỹ đầu tư chỉ có investment của user hiện tại
        user_investments = request.env['portfolio.investment'].sudo().search([
            ('user_id', '=', request.env.user.id),
            ('status', '=', 'active')
        ])
        
        # Debug: Log số lượng investment
        print(f"DEBUG: User {request.env.user.id} has {len(user_investments)} active investments")
        
        # Lấy các fund mà user hiện tại đã đầu tư
        user_funds = user_investments.mapped('fund_id').sudo().filtered(lambda f: f.status == 'active')
        
        # Debug: Log số lượng fund
        print(f"DEBUG: User has {len(user_funds)} active funds")
        
        # Lọc các fund có ít nhất 1 investment của user hiện tại (kiểm tra trực tiếp)
        funds_with_investment = user_funds.filtered(lambda f: len(f.sudo().investment_ids.filtered(lambda inv: inv.user_id.id == request.env.user.id and inv.status == 'active')) > 0)
        
        # Debug: Log số lượng fund với investment
        print(f"DEBUG: User has {len(funds_with_investment)} funds with investments")
        fund_data = []
        
        # Gộp các fund có cùng ticker
        merged_funds = {}
        for fund in funds_with_investment:
            ticker = fund.ticker
            # Lấy investment của user hiện tại cho fund này
            user_investments = request.env['portfolio.investment'].sudo().search([
                ('user_id', '=', request.env.user.id),
                ('fund_id', '=', fund.id),
                ('status', '=', 'active')
            ])
            
            # Chỉ hiển thị fund nếu user có investment thực sự
            if not user_investments:
                continue
                
            # Tổng đầu tư không gồm phí: sum(units * average_price)
            user_total_investment = sum([mround((inv.units or 0.0) * (inv.average_price or 0.0), 50) for inv in user_investments])
            user_total_units = sum(user_investments.mapped('units'))
            user_current_value = sum(user_investments.mapped('current_value'))
            
            # Chỉ hiển thị fund nếu user có investment với số lượng > 0
            if user_total_units <= 0:
                continue
            # Lấy giao dịch mua/bán gần nhất của fund này
            last_transaction = request.env['portfolio.transaction'].sudo().search([
                ('fund_id', '=', fund.id),
                ('user_id', '=', request.env.user.id),
                ('status', 'in', ['pending', 'completed', 'cancelled']),
                ('transaction_type', 'in', ['buy', 'sell'])
            ], order='created_at desc', limit=1)
            last_update_str = last_transaction.created_at.strftime('%d/%m/%Y') if last_transaction and last_transaction.created_at else ""
            
            # Lấy màu từ fund.certificate trong fund_management_control
            fund_sudo = fund.sudo()
            fund_color = fund_sudo.color or "#2B4BFF"  # Màu mặc định
            try:
                # Defensive coding for certificate_id access
                if 'certificate_id' in fund_sudo._fields and fund_sudo.certificate_id:
                     # Check if it's a valid record by accessing explicit field or id
                     if fund_sudo.certificate_id.id:
                        cert_color = fund_sudo.certificate_id.fund_color
                        if cert_color:
                            fund_color = cert_color
                        print(f"DEBUG: Fund {fund.ticker} color from certificate: {cert_color}, final: {fund_color}")
            except Exception as e:
                print(f"DEBUG: Error getting certificate color for {fund.ticker}: {e}")
                # Fallback to fund color already set
                pass
            
            if ticker not in merged_funds:
                merged_funds[ticker] = {
                    'name': fund.name,
                    'ticker': fund.ticker,
                    'total_units': user_total_units,
                    'total_investment': user_total_investment,
                    'current_nav': fund.current_nav or 0,
                    'low_price': getattr(fund, 'low_price', 0.0) or 0.0,
                    'high_price': getattr(fund, 'high_price', 0.0) or 0.0,
                    'open_price': getattr(fund, 'open_price', 0.0) or 0.0,
                    'current_value': user_current_value,
                    'profit_loss_percentage': 0.0,  # sẽ tính lại phía dưới
                    'flex_sip_percentage': 0.0,     # sẽ tính lại phía dưới
                    'color': fund_color,
                    'investment_type': fund.investment_type,
                    # current_ytd đã bỏ
                    'last_update': last_update_str,
                    'flex_units': 0.0,  # sẽ tính lại phía dưới
                    'sip_units': 0.0    # sẽ tính lại phía dưới
                }
            else:
                merged = merged_funds[ticker]
                merged['total_units'] += user_total_units
                merged['total_investment'] += user_total_investment
                merged['current_value'] += user_current_value
                # Lấy ngày cập nhật mới nhất giữa các fund cùng ticker
                if last_update_str and (not merged['last_update'] or last_update_str > merged['last_update']):
                    merged['last_update'] = last_update_str
# Sau khi gộp xong, tính lại các trường phụ thuộc
        for fund in merged_funds.values():
            # Tính flex_units, sip_units cho user hiện tại
            flex_units = 0.0
            sip_units = 0.0
            user_investments = request.env['portfolio.investment'].search([
                ('user_id', '=', request.env.user.id),
                ('fund_id.ticker', '=', fund['ticker']),
                ('status', '=', 'active')
            ])
            for inv in user_investments:
                if inv.investment_type == 'flex':
                    flex_units += inv.units
                elif inv.investment_type == 'sip':
                    sip_units += inv.units
            fund['flex_units'] = flex_units
            fund['sip_units'] = sip_units
            # Tính lại % lợi/lỗ dựa trên giá tồn kho đầu ngày hiện tại
            if fund['total_investment'] > 0 and fund['total_units'] > 0:
                # Lấy giá tồn kho đầu ngày hiện tại từ nav_management
                current_nav_price = self._get_current_nav_price(fund['ticker'])
                if current_nav_price > 0:
                    # MROUND 50 cho current_nav_price
                    current_nav_price = mround(current_nav_price, 50)
                    # Tính giá trị hiện tại dựa trên giá tồn kho đầu ngày
                    current_value = fund['total_units'] * current_nav_price
                    profit_loss = current_value - fund['total_investment']
                    fund['profit_loss_percentage'] = (profit_loss / fund['total_investment']) * 100
                    fund['current_value'] = current_value  # Cập nhật giá trị hiện tại
                else:
                    # Fallback về logic cũ nếu không có giá tồn kho
                    profit_loss = fund['current_value'] - fund['total_investment']
                    fund['profit_loss_percentage'] = (profit_loss / fund['total_investment']) * 100
            else:
                fund['profit_loss_percentage'] = 0.0
            # Tính flex_sip_percentage
            if fund['total_units'] > 0:
                fund['flex_sip_percentage'] = (fund['sip_units'] / fund['total_units']) * 100
            else:
                fund['flex_sip_percentage'] = 0.0
        
        fund_data = list(merged_funds.values())

        # Lấy dữ liệu giao dịch gần nhất với thời gian chính xác
        transactions = request.env['portfolio.transaction'].sudo().search([
            ('user_id', '=', request.env.user.id),
            ('status', 'in', ['pending', 'completed', 'cancelled'])
        ], order='created_at desc', limit=5)
        
        transaction_data = []
        status_map = {
            'pending': 'Chờ Khớp lệnh',
            'completed': 'Đã Khớp lệnh',
            'cancelled': 'Đã Hủy',
        }
        transaction_type_map = {
            'buy': 'mua',
            'sell': 'bán',
        }
        # Xử lý timezone an toàn
        tz = self._get_safe_timezone(request.env.user.tz)
        for trans in transactions:
            local_dt = trans.created_at.astimezone(tz) if trans.created_at else None
            transaction_type_display = transaction_type_map.get(trans.transaction_type.lower(), trans.transaction_type.lower())
            # Amount hiển thị: ưu tiên units * price; nếu không có thì amount - fee
            unit_price = getattr(trans, 'price', 0.0) or 0.0
            # MROUND 50 cho unit_price
            unit_price = mround(unit_price, 50)
            display_amount = (trans.units or 0.0) * unit_price
            if not display_amount:
                fee_val = getattr(trans, 'fee', 0.0) or 0.0
                display_amount = max((trans.amount or 0.0) - fee_val, 0.0)
            display_amount = mround(display_amount, 50)

            transaction_data.append({
                'date': local_dt.strftime('%d/%m/%Y') if local_dt else '',
                'time': local_dt.strftime('%H:%M:%S') if local_dt else '',
                'description': f"Lệnh {transaction_type_display} {trans.fund_id.name} - {trans.fund_id.ticker}",
                'status': status_map.get(trans.status, trans.status),
                'status_raw': trans.status,
                'amount': display_amount,
                'is_units': trans.transaction_type == 'sell',
                'investment_type': trans.investment_type,
                'currency_symbol': trans.currency_id.symbol if trans.currency_id else ''
            })

        # Lấy dữ liệu tổng quan tài sản từ model Investment
        investments = request.env['portfolio.investment'].sudo().search([
            ('user_id', '=', request.env.user.id),
            ('status', '=', 'active')
        ])
        
        total_investment = sum(investments.mapped('amount'))
        total_current_value = sum(investments.mapped('current_value'))
        total_profit_loss = total_current_value - total_investment
        total_profit_loss_percentage = (total_profit_loss / total_investment * 100) if total_investment else 0

        # Lấy dữ liệu so sánh từ model Comparison
        comparisons = request.env['portfolio.comparison'].search([
            ('user_id', '=', request.env.user.id),
            ('status', '=', 'active')
        ], limit=5)
        
        comparison_data = []
        for comp in comparisons:
            comparison_data.append({
                'name': comp.name,
                'total_investment': comp.total_investment,
                'total_return': comp.total_return,
                'return_percentage': comp.return_percentage,
                'comparison_type': comp.comparison_type,
                'last_update': comp.last_update.strftime('%d/%m/%Y %H:%M') if comp.last_update else False
            })

        # Tạo dữ liệu cho biểu đồ với thông tin chi tiết từng quỹ
        chart_data = {
            'labels': [fund['name'] for fund in fund_data],
            'tickers': [fund['ticker'] for fund in fund_data],
            'datasets': [{
                'data': [fund['current_value'] for fund in fund_data],
                'backgroundColor': [fund['color'] for fund in fund_data]
            }]
        }

        all_dashboard_data = {
            'funds': fund_data,
            'transactions': transaction_data,
            'total_investment': total_investment,
            'total_current_value': total_current_value,
            'total_profit_loss': total_profit_loss,
            'total_profit_loss_percentage': total_profit_loss_percentage,
            'chart_data': json.dumps(chart_data),
            'comparisons': comparison_data
        }

        return request.render('overview_fund_management.overview_fund_management_page', {
            'all_dashboard_data': Markup(json.dumps(all_dashboard_data))
        })
    
    def _get_current_nav_price(self, ticker):
        """Lấy giá tồn kho đầu ngày hiện tại từ nav_management"""
        try:
            # Tìm quỹ theo ticker
            fund = request.env['portfolio.fund'].search([
                ('ticker', '=', ticker),
                ('active', '=', True)
            ], limit=1)
            
            if not fund:
                return 0.0
            
            # Lấy giá tồn kho đầu ngày hiện tại từ nav.daily.inventory
            today = datetime.now().date()
            current_inventory = request.env['nav.daily.inventory'].search([
                ('fund_id', '=', fund.id),
                ('inventory_date', '=', today)
            ], limit=1)
            
            if current_inventory and current_inventory.opening_avg_price > 0:
                return current_inventory.opening_avg_price
            
            # Nếu không có tồn kho hôm nay, tìm tồn kho gần nhất
            nearest_inventory = request.env['nav.daily.inventory'].search([
                ('fund_id', '=', fund.id),
                ('opening_avg_price', '>', 0)
            ], order='inventory_date desc', limit=1)
            
            if nearest_inventory:
                return nearest_inventory.opening_avg_price
            
            # Nếu không có tồn kho nào, lấy giá tồn kho ban đầu từ nav.fund.config
            fund_config = request.env['nav.fund.config'].search([
                ('fund_id', '=', fund.id),
                ('active', '=', True)
            ], limit=1)
            
            if fund_config and fund_config.initial_nav_price > 0:
                return fund_config.initial_nav_price
            
            # Không fallback về current_nav, chỉ trả về 0.0 nếu không có dữ liệu tồn kho
            return 0.0
            
        except Exception as e:
            # Không fallback về current_nav, chỉ trả về 0.0 nếu có lỗi
            return 0.0 
    
    @http.route('/api/overview/realtime-data', type='json', auth='user', methods=['POST'])
    def get_realtime_data(self, **kwargs):
        """API endpoint for realtime fund data updates"""
        try:
            # MROUND helper (step=50)
            def mround(value, step=50):
                try:
                    v = float(value or 0.0)
                    s = float(step or 1.0)
                    return int(round(v / s) * s)
                except Exception:
                    return 0
            
            user_investments = request.env['portfolio.investment'].sudo().search([
                ('user_id', '=', request.env.user.id),
                ('status', '=', 'active')
            ])
            
            user_funds = user_investments.mapped('fund_id').sudo().filtered(lambda f: f.status == 'active')
            funds_with_investment = user_funds.filtered(
                lambda f: len(f.sudo().investment_ids.filtered(
                    lambda inv: inv.user_id.id == request.env.user.id and inv.status == 'active'
                )) > 0
            )
            
            funds_data = []
            
            for fund in funds_with_investment:
                user_invs = request.env['portfolio.investment'].sudo().search([
                    ('user_id', '=', request.env.user.id),
                    ('fund_id', '=', fund.id),
                    ('status', '=', 'active')
                ])
                
                if not user_invs:
                    continue
                    
                user_total_investment = sum([mround((inv.units or 0.0) * (inv.average_price or 0.0), 50) for inv in user_invs])
                user_total_units = sum(user_invs.mapped('units'))
                user_current_value = sum(user_invs.mapped('current_value'))
                
                if user_total_units <= 0:
                    continue
                
                # Get current NAV price
                current_nav_price = self._get_current_nav_price(fund.ticker)
                
                # Calculate profit/loss
                if user_total_investment > 0:
                    profit_loss = user_current_value - user_total_investment
                    profit_loss_percentage = (profit_loss / user_total_investment) * 100
                else:
                    profit_loss = 0.0
                    profit_loss_percentage = 0.0
                
                fund_color = fund.color or "#2B4BFF"
                if hasattr(fund, 'certificate_id') and fund.certificate_id:
                    fund_color = fund.certificate_id.fund_color or fund.color or "#2B4BFF"
                
                funds_data.append({
                    'ticker': fund.ticker,
                    'name': fund.name,
                    'total_units': user_total_units,
                    'total_investment': user_total_investment,
                    'current_value': user_current_value,
                    'current_nav': current_nav_price,
                    'profit_loss': profit_loss,
                    'profit_loss_percentage': round(profit_loss_percentage, 2),
                    'color': fund_color,
                    'reference_price': getattr(fund, 'reference_price', 0.0),
                    'ceiling_price': getattr(fund, 'ceiling_price', 0.0),
                    'floor_price': getattr(fund, 'floor_price', 0.0),
                })
            
            return {'funds': funds_data}
            
        except Exception as e:
            return {'error': str(e), 'funds': []}