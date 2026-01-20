"""
API TẠO RANDOM TRANSACTION - FILE TẠM THỜI
==========================================
File này chứa API tạo dữ liệu test ngẫu nhiên.
CHỈ DÙNG CHO MÔI TRƯỜNG PHÁT TRIỂN/TEST.

ĐỂ XÓA FILE NÀY:
1. Xóa file này: random_transaction_controller.py
2. Xóa import trong __init__.py: from . import random_transaction_controller
3. Xóa route '/api/transaction-list/create-random' khỏi frontend nếu có
"""

from odoo import http
from odoo.http import request
import json
import random
from odoo import fields
from ..utils import mround
import logging

_logger = logging.getLogger(__name__)


class RandomTransactionController(http.Controller):
    """
    Controller tạm thời để tạo dữ liệu test ngẫu nhiên
    CHỈ DÙNG CHO MÔI TRƯỜNG PHÁT TRIỂN/TEST
    """

    def _make_secure_response(self, data, status=200):
        """Tạo response với security headers"""
        headers = [
            ('Content-Type', 'application/json'),
            ('X-Content-Type-Options', 'nosniff'),
            ('Cache-Control', 'no-cache, no-store, must-revalidate'),
            ('Pragma', 'no-cache'),
            ('Expires', '0')
        ]
        return request.make_response(
            json.dumps(data, ensure_ascii=False),
            headers=headers,
            status=status
        )

    @http.route('/api/order-matching/create-random', type='http', auth='user', methods=['POST'], csrf=False)
    def create_random_transactions(self, **kwargs):
        """
        Tạo dữ liệu test: Tạo transaction ngẫu nhiên để test
        Luôn trả về JSON, ngay cả khi có lỗi
        
        CHỈ DÙNG CHO MÔI TRƯỜNG PHÁT TRIỂN/TEST
        """
        try:
            # Kiểm tra authentication
            if not request.env.user or request.env.user._name != 'res.users':
                return self._make_secure_response({
                    'success': False,
                    'message': 'Không có quyền truy cập. Vui lòng đăng nhập lại.',
                    'created_count': 0
                }, status=401)
            
            # Lấy số lượng transaction muốn tạo (mặc định 10)
            try:
                data = json.loads(request.httprequest.data.decode('utf-8') or '{}')
                count = int(data.get('count', 10))
            except Exception:
                count = 10
            
            # Giới hạn số lượng tối đa để tránh tạo quá nhiều
            count = min(max(1, count), 50)
            
            # Lấy danh sách quỹ có sẵn
            funds = request.env['portfolio.fund'].search([], limit=10)
            if not funds:
                return self._make_secure_response({
                    'success': False,
                    'message': 'Không tìm thấy quỹ nào. Vui lòng tạo quỹ trước.',
                    'created_count': 0
                }, status=400)
            
            # Lấy currency mặc định
            currency = request.env.company.currency_id
            
            # Lấy kỳ hạn và lãi suất từ nav_management
            term_rates = {}
            try:
                if 'nav.term.rate' in request.env:
                    TermRate = request.env['nav.term.rate'].sudo()
                    # get_all_current_rates() trả về list các rate records
                    all_rates_list = TermRate.get_all_current_rates()
                    if all_rates_list:
                        term_rates = {rate.term_months: rate.interest_rate for rate in all_rates_list}
            except Exception as e:
                _logger.warning(f"Không thể lấy kỳ hạn/lãi suất từ nav_management: {str(e)}")
            
            # Fallback nếu không có dữ liệu từ nav_management
            if not term_rates:
                # Thử lấy trực tiếp từ model nav.term.rate
                try:
                    if 'nav.term.rate' in request.env:
                        TermRate = request.env['nav.term.rate'].sudo()
                        rates = TermRate.search([('active', '=', True)])
                        if rates:
                            # Nhóm theo term_months và lấy rate mới nhất (theo effective_date)
                            term_rates_dict = {}
                            for rate in rates:
                                term = rate.term_months
                                if term not in term_rates_dict or rate.effective_date > term_rates_dict[term].effective_date:
                                    term_rates_dict[term] = rate
                            term_rates = {term: rate.interest_rate for term, rate in term_rates_dict.items()}
                except Exception as e:
                    _logger.warning(f"Không thể lấy kỳ hạn/lãi suất trực tiếp: {str(e)}")
                
                # Fallback cuối cùng
                if not term_rates:
                    term_rates = {6: 6.0, 12: 7.5, 18: 8.5, 24: 9.5}
            
            # Lấy danh sách user nhà đầu tư (portal users, không phải market maker)
            # Chỉ lấy các user có group portal và không có group system/user
            # Và không có is_market_maker = True trong permission_management_ids
            investor_users = request.env['res.users'].sudo().search([
                ('partner_id', '!=', False),
                ('active', '=', True)
            ])
            
            # Lọc các user portal không phải market maker
            valid_investor_users = []
            for user in investor_users:
                try:
                    # Bỏ qua các user internal (system/user group)
                    if user.has_group('base.group_system') or user.has_group('base.group_user'):
                        continue
                    
                    # Chỉ lấy portal users
                    if not user.has_group('base.group_portal'):
                        continue
                    
                    # Kiểm tra is_market_maker từ permission_management_ids
                    is_market_maker = False
                    if hasattr(user, 'permission_management_ids') and user.permission_management_ids:
                        permission_rec = user.permission_management_ids.filtered(
                            lambda p: p.permission_type == 'investor_user'
                        )
                        if permission_rec and hasattr(permission_rec[0], 'is_market_maker'):
                            is_market_maker = permission_rec[0].is_market_maker or False
                    
                    # Bỏ qua nếu là market maker
                    if is_market_maker:
                        continue
                    
                    valid_investor_users.append(user)
                except Exception:
                    # Nếu không kiểm tra được, bỏ qua user này
                    continue
            
            # Nếu không có investor user nào, trả về lỗi
            if not valid_investor_users:
                return self._make_secure_response({
                    'success': False,
                    'message': 'Không tìm thấy nhà đầu tư nào (portal users không phải market maker). Vui lòng tạo nhà đầu tư trước.',
                    'created_count': 0
                }, status=400)
            
            # Tạo các transaction ngẫu nhiên - CHỈ CHO NHÀ ĐẦU TƯ
            # Tuân thủ ràng buộc: không thể tạo lệnh mua nếu đang có lệnh bán pending và ngược lại
            # Đảm bảo luôn có cả lệnh mua và lệnh bán (từ các user khác nhau)
            created_count = 0
            investor_sources = ['portal', 'portfolio']  # Loại bỏ 'sale' vì đó là market maker
            Transaction = request.env['portfolio.transaction'].sudo()
            
            # Chia users thành 2 nhóm: một nhóm tạo mua, một nhóm tạo bán
            # Đảm bảo có ít nhất 2 users để có thể tạo cả mua và bán
            if len(valid_investor_users) < 2:
                return self._make_secure_response({
                    'success': False,
                    'message': 'Cần ít nhất 2 nhà đầu tư để tạo cả lệnh mua và lệnh bán',
                    'created_count': 0
                }, status=400)
            
            # Xáo trộn danh sách users
            shuffled_users = valid_investor_users.copy()
            random.shuffle(shuffled_users)
            
            # Chia thành 2 nhóm: một nửa tạo mua, một nửa tạo bán
            mid_point = len(shuffled_users) // 2
            buy_users = shuffled_users[:mid_point]
            sell_users = shuffled_users[mid_point:]
            
            # Đảm bảo mỗi nhóm có ít nhất 1 user
            if not buy_users:
                buy_users = [shuffled_users[0]]
            if not sell_users:
                sell_users = [shuffled_users[-1]] if len(shuffled_users) > 1 else [shuffled_users[0]]
            
            # Tạo lệnh xen kẽ giữa mua và bán để đảm bảo có cả hai loại
            buy_index = 0
            sell_index = 0
            max_retries = 5  # Số lần thử tối đa để tìm user phù hợp
            
            for i in range(count):
                try:
                    # Chọn ngẫu nhiên fund và source
                    fund = random.choice(funds)
                    source = random.choice(investor_sources)
                    
                    # Xen kẽ giữa mua và bán (ưu tiên tạo cả hai loại)
                    if i % 2 == 0:
                        # Ưu tiên tạo lệnh mua
                        intended_type = 'buy'
                        primary_users = buy_users
                        secondary_users = sell_users
                        primary_index = buy_index
                    else:
                        # Ưu tiên tạo lệnh bán
                        intended_type = 'sell'
                        primary_users = sell_users
                        secondary_users = buy_users
                        primary_index = sell_index
                    
                    # Tìm user có thể tạo loại lệnh dự định
                    investor_user = None
                    transaction_type = None
                    
                    # Thử tìm trong danh sách chính
                    for retry in range(max_retries):
                        if primary_users:
                            current_user = primary_users[primary_index % len(primary_users)]
                            primary_index += 1
                        elif secondary_users:
                            # Nếu danh sách chính hết, thử danh sách phụ
                            current_user = secondary_users[0]
                        else:
                            break
                        
                        # Kiểm tra lệnh pending của nhà đầu tư này
                        existing_orders = Transaction.search([
                            ('user_id', '=', current_user.id),
                            ('status', '=', 'pending'),
                            ('transaction_type', 'in', ['buy', 'sell']),
                            ('remaining_units', '>', 0)
                        ])
                        
                        # Xác định loại lệnh có thể tạo (tuân thủ ràng buộc)
                        can_create_intended = False
                        if existing_orders:
                            # Nếu có lệnh pending, chỉ tạo cùng loại
                            existing_buy = existing_orders.filtered(lambda o: o.transaction_type == 'buy')
                            existing_sell = existing_orders.filtered(lambda o: o.transaction_type == 'sell')
                            
                            if existing_buy:
                                # Đang có lệnh mua pending, chỉ có thể tạo lệnh mua
                                can_create_intended = (intended_type == 'buy')
                            elif existing_sell:
                                # Đang có lệnh bán pending, chỉ có thể tạo lệnh bán
                                can_create_intended = (intended_type == 'sell')
                        else:
                            # Không có lệnh pending, có thể tạo loại dự định
                            can_create_intended = True
                        
                        if can_create_intended:
                            investor_user = current_user
                            transaction_type = intended_type
                            # Cập nhật index
                            if intended_type == 'buy':
                                buy_index = primary_index
                            else:
                                sell_index = primary_index
                            break
                    
                    # Nếu không tìm được user phù hợp trong danh sách chính, thử danh sách phụ
                    if not investor_user and secondary_users:
                        for current_user in secondary_users:
                            existing_orders = Transaction.search([
                                ('user_id', '=', current_user.id),
                                ('status', '=', 'pending'),
                                ('transaction_type', 'in', ['buy', 'sell']),
                                ('remaining_units', '>', 0)
                            ])
                            
                            if existing_orders:
                                existing_buy = existing_orders.filtered(lambda o: o.transaction_type == 'buy')
                                existing_sell = existing_orders.filtered(lambda o: o.transaction_type == 'sell')
                                
                                if existing_buy and intended_type == 'buy':
                                    investor_user = current_user
                                    transaction_type = 'buy'
                                    break
                                elif existing_sell and intended_type == 'sell':
                                    investor_user = current_user
                                    transaction_type = 'sell'
                                    break
                            else:
                                # Không có lệnh pending, có thể tạo loại dự định
                                investor_user = current_user
                                transaction_type = intended_type
                                break
                    
                    # Nếu không tìm được user phù hợp, bỏ qua lần này
                    if not investor_user or not transaction_type:
                        continue
                    
                    # Chọn kỳ hạn ngẫu nhiên từ danh sách có sẵn
                    term_months = random.choice(list(term_rates.keys()))
                    interest_rate = term_rates[term_months]
                    
                    # Lấy giá CCQ từ tồn kho đầu ngày (opening_avg_price * chi phí vốn)
                    # Đây là giá fund_buy (giá tồn kho đầu ngày * chi phí vốn)
                    price_raw = 0.0
                    nav = 0.0
                    try:
                        today = fields.Date.context_today(request.env.user)
                        Inventory = request.env['nav.daily.inventory'].sudo()
                        inv = Inventory.search([('fund_id', '=', fund.id), ('inventory_date', '=', today)], limit=1)
                        if not inv:
                            inv = Inventory.create_daily_inventory_for_fund(fund.id, today)
                            if inv:
                                inv._auto_calculate_inventory()
                        opening = float(inv.opening_avg_price or 0.0) if inv else 0.0
                        if opening > 0:
                            # Lấy chi phí vốn từ certificate
                            cert = fund.certificate_id if fund else None
                            cap_percent = float(cert.capital_cost) if cert else 0.0
                            cap_amount = opening * cap_percent / 100.0
                            price_raw = opening + cap_amount  # Giá CCQ = opening_avg_price + chi phí vốn
                            nav = price_raw  # Dùng giá CCQ làm NAV
                    except Exception as e:
                        _logger.warning(f"Không lấy được giá CCQ từ tồn kho cho fund_id={fund.id}: {str(e)}, dùng current_nav")
                    
                    # Fallback về current_nav nếu không lấy được giá từ inventory
                    if price_raw <= 0:
                        nav = float(fund.current_nav or 0.0)
                        if nav <= 0:
                            nav = 10000.0  # Fallback cuối cùng
                        price_raw = nav
                    
                    # Làm tròn giá về bội số của 50
                    price = mround(price_raw, 50)
                    # Đảm bảo price tối thiểu là 50
                    if price < 50:
                        price = 50
                    
                    units_raw = random.randint(100, 1000)  # Số lượng từ 100 đến 1000 CCQ
                    # Làm tròn số lượng CCQ về bội số của 100 (Lô 100)
                    units = mround(units_raw, 100)
                    # Đảm bảo units tối thiểu là 100
                    if units < 100:
                        units = 100
                    amount = mround(units * price, 50)  # Amount làm tròn theo 50đ (tiền tệ)
                    
                    # Tạo transaction - CHỈ CHO NHÀ ĐẦU TƯ
                    transaction = Transaction.create({
                        'user_id': investor_user.id,  # Dùng investor user, không phải current user
                        'fund_id': fund.id,
                        'transaction_type': transaction_type,
                        'status': 'pending',
                        'units': units,
                        'remaining_units': units,
                        'matched_units': 0.0,
                        'is_matched': False,
                        'amount': amount,
                        'price': price,
                        'current_nav': nav,
                        'term_months': term_months,  # Lấy từ nav_management
                        'interest_rate': interest_rate,  # Lấy từ nav_management
                        'currency_id': currency.id,
                        'investment_type': 'fund_certificate',
                        'source': source,  # Chỉ dùng portal hoặc portfolio (không dùng 'sale')
                        'description': f'Transaction test ngẫu nhiên #{i+1} (Nhà đầu tư)',
                    })
                    
                    created_count += 1
                except Exception as e:
                    # Log lỗi nhưng tiếp tục tạo các transaction khác
                    error_msg = str(e)
                    # Nếu lỗi do validation (ràng buộc), log thông tin chi tiết
                    if 'lệnh' in error_msg.lower() and 'pending' in error_msg.lower():
                        _logger.warning(f"Lỗi validation khi tạo transaction test {i+1} cho user {investor_user.id}: {error_msg}")
                    else:
                        _logger.warning(f"Lỗi khi tạo transaction test {i+1}: {error_msg}")
                    continue
            
            return self._make_secure_response({
                'success': True,
                'message': f'Đã tạo thành công {created_count} giao dịch ngẫu nhiên',
                'created_count': created_count,
                'requested_count': count
            })
            
        except Exception as e:
            import traceback
            _logger.error(f"Error in create_random_transactions: {str(e)}")
            _logger.error(traceback.format_exc())
            return self._make_secure_response({
                'success': False,
                'message': f'Lỗi hệ thống: {str(e)}',
                'created_count': 0
            }, status=500)

