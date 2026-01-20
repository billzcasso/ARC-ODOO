import json
import logging
import traceback

from odoo import http, fields, _
from odoo.exceptions import AccessDenied, UserError, ValidationError
from odoo.http import request

from ..utils import mround
from ..utils.timezone_utils import format_datetime_user_tz

_logger = logging.getLogger(__name__)


class MatchedOrdersController(http.Controller):
    """Controller quản lý các cặp lệnh đã khớp"""
    
    def _ensure_json_response(self, func, *args, **kwargs):
        """
        Wrapper để đảm bảo endpoint luôn trả về JSON, ngay cả khi có lỗi
        """
        try:
            # Kiểm tra authentication
            if not request.env.user or request.env.user._name != 'res.users':
                return {
                    'success': False,
                    'message': 'Không có quyền truy cập. Vui lòng đăng nhập lại.',
                    'error_type': 'AuthenticationError'
                }
            return func(*args, **kwargs)
        except (AccessDenied, UserError, ValidationError) as e:
            _logger.error("Error in %s: %s", func.__name__, str(e))
            return {
                'success': False,
                'message': str(e),
                'error_type': type(e).__name__
            }
        except Exception as e:
            _logger.error("Unexpected error in %s: %s", func.__name__, str(e))
            _logger.error(traceback.format_exc())
            return {
                'success': False,
                'message': _('Lỗi hệ thống: %s') % str(e),
                'error_type': 'SystemError'
            }

    @http.route('/api/transaction-list/get-matched-orders', type='json', auth='user')
    def get_matched_orders(self, limit=1000, fund_id=None, date_from=None, date_to=None, ticker=None, **kwargs):
        """
        Trả về danh sách cặp lệnh đã khớp từ transaction.matched.orders
        Luôn trả về JSON, ngay cả khi có lỗi
        """
        try:
            # Kiểm tra authentication
            if not request.env.user or request.env.user._name != 'res.users':
                return {
                    'success': False,
                    'error': 'Không có quyền truy cập. Vui lòng đăng nhập lại.',
                    'message': 'Không thể tải danh sách lệnh khớp thỏa thuận',
                    'data': []
                }
            # Ưu tiên tham số trong body JSON nếu có
            if kwargs:
                limit = kwargs.get('limit', limit)
                fund_id = kwargs.get('fund_id', fund_id)
                date_from = kwargs.get('date_from', date_from)
                date_to = kwargs.get('date_to', date_to)
                ticker = kwargs.get('ticker', ticker)

            return self._list_matched_orders(limit=limit, fund_id=fund_id, date_from=date_from, date_to=date_to, ticker=ticker)
        except (AccessDenied, UserError, ValidationError) as e:
            _logger.error("Error in get_matched_orders: %s", str(e))
            return {
                'success': False,
                'error': str(e),
                'message': 'Không thể tải danh sách lệnh khớp thỏa thuận',
                'data': [],
                'error_type': type(e).__name__
            }
        except Exception as e:
            _logger.error("Unexpected error in get_matched_orders: %s", str(e))
            _logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': _('Lỗi hệ thống: %s') % str(e),
                'message': 'Không thể tải danh sách lệnh khớp thỏa thuận',
                'data': [],
                'error_type': 'SystemError'
            }

    @http.route('/api/transaction-list/persist-matched-pairs', type='json', auth='user', methods=['POST'], csrf=False)
    def persist_matched_pairs(self, **kwargs):
        """Nhận danh sách cặp lệnh từ frontend và lưu vào transaction.matched.orders"""
        try:
            pairs = kwargs.get('pairs') or []
            if not isinstance(pairs, list) or not pairs:
                return {
                    'success': False,
                    'message': 'Không có cặp lệnh để lưu'
                }

            created = 0
            errors = []
            Model = request.env['transaction.matched.orders'].sudo()
            Tx = request.env['portfolio.transaction'].sudo()

            for p in pairs:
                try:
                    buy_id = int(p.get('buy_id'))
                    sell_id = int(p.get('sell_id'))
                    qty = float(p.get('matched_quantity') or p.get('matched_ccq') or 0)
                    price = float(p.get('matched_price') or 0)
                    
                    if not buy_id or not sell_id or qty <= 0 or price <= 0:
                        errors.append(_("Thiếu dữ liệu hợp lệ: %s") % p)
                        continue

                    buy_tx = Tx.browse(buy_id)
                    sell_tx = Tx.browse(sell_id)
                    if not buy_tx.exists() or not sell_tx.exists():
                        errors.append(_("Không tìm thấy giao dịch %s-%s") % (buy_id, sell_id))
                        continue

                    # Tạo matched order: execution luôn được ghi nhận là 'done'
                    mo_status = 'done'
                    
                    # Giá khớp: Luôn lấy giá của sell order (theo chuẩn Stock Exchange)
                    # Nếu price từ frontend không đúng, sử dụng giá sell order
                    matched_price = price
                    if matched_price <= 0 or matched_price != (sell_tx.price or sell_tx.current_nav or 0):
                        matched_price = sell_tx.price or sell_tx.current_nav or 0
                    
                    # QUAN TRỌNG: Không set name thủ công - để sequence tự động tạo format HDC-DDMMYY/STT
                    # Mỗi cặp lệnh sẽ có mã thỏa thuận riêng từ sequence
                    
                    Model.create({
                        # Không set name - để sequence tự động tạo format HDC-DDMMYY/STT
                        'buy_order_id': buy_tx.id,
                        'sell_order_id': sell_tx.id,
                        'matched_quantity': qty,
                        'matched_price': matched_price,  # Giá khớp = giá sell (theo chuẩn Stock Exchange)
                        'status': mo_status
                    })
                    created += 1
                except Exception as cerr:
                    errors.append(str(cerr))
                    continue

            # Cập nhật tồn kho cho các quỹ liên quan
            self._update_inventory_for_touched_funds(pairs)

            return {
                'success': created > 0,
                'created': created,
                'failed': len(errors),
                'errors': errors
            }
        except (AccessDenied, UserError, ValidationError) as e:
            _logger.error("Error in persist_matched_pairs: %s", str(e))
            return {
                'success': False,
                'message': str(e),
                'error_type': type(e).__name__
            }
        except Exception as e:
            _logger.error("Unexpected error in persist_matched_pairs: %s", str(e))
            _logger.error(traceback.format_exc())
            return {
                'success': False,
                'message': _('Lỗi hệ thống: %s') % str(e),
                'error_type': 'SystemError'
            }

    def _list_matched_orders(self, limit=1000, fund_id=None, date_from=None, date_to=None, ticker=None):
        """Trả về danh sách cặp lệnh khớp từ model transaction.matched.orders"""
        try:
            Model = request.env['transaction.matched.orders'].sudo()
            domain = self._build_search_domain(fund_id, date_from, date_to, ticker)
            
            records = Model.search(domain, order='match_date desc', limit=int(limit) if limit else 1000)
            data = [self._format_matched_order_record(rec) for rec in records]

            return {
                'success': True,
                'data': data,
                'total': len(data)
            }
        except Exception as e:
            return {
                'success': False,
                'message': str(e),
                'data': []
            }

    def _build_search_domain(self, fund_id, date_from, date_to, ticker):
        """Xây dựng domain tìm kiếm"""
        domain = []
        
            # Default to today if no date filter provided
        if not date_from and not date_to:
            today = fields.Date.context_today(request.env.user)
            date_from = f"{today} 00:00:00"
            date_to = f"{today} 23:59:59"
        
        if fund_id:
            try:
                fund_id = int(fund_id)
                domain.append(('fund_id', '=', fund_id))
            except Exception:
                pass
        
        if ticker:
            domain.append(('fund_id.ticker', '=', ticker))
        
        if date_from:
            domain.append(('match_date', '>=', date_from))
        
        if date_to:
            domain.append(('match_date', '<=', date_to))

        return domain

    def _format_matched_order_record(self, rec):
        """Định dạng bản ghi matched order"""
        buy_tx = rec.buy_order_id
        sell_tx = rec.sell_order_id
        
        # QUAN TRỌNG: Đảm bảo computed fields được tính lại trước khi lấy giá trị
        # Sử dụng remaining_units computed field thay vì tính thủ công để đảm bảo chính xác
        if buy_tx:
            buy_tx.invalidate_recordset(['matched_units', 'remaining_units'])
            buy_tx = request.env['portfolio.transaction'].browse(buy_tx.id)
        if sell_tx:
            sell_tx.invalidate_recordset(['matched_units', 'remaining_units'])
            sell_tx = request.env['portfolio.transaction'].browse(sell_tx.id)

        return {
            'id': rec.id,
            'reference': rec.name,
            'fund_id': rec.fund_id.id if rec.fund_id else (buy_tx.fund_id.id if buy_tx and buy_tx.fund_id else False),
            'fund_name': rec.fund_id.name if rec.fund_id else (buy_tx.fund_id.name if buy_tx and buy_tx.fund_id else ''),
            'buy_investor': self._get_investor_name(buy_tx) if buy_tx else 'N/A',
            'sell_investor': self._get_investor_name(sell_tx) if sell_tx else 'N/A',
            'buy_units': getattr(rec, 'buy_units', 0) or (buy_tx.units if buy_tx else 0),
            'sell_units': getattr(rec, 'sell_units', 0) or (sell_tx.units if sell_tx else 0),
            # Ưu tiên giá đặt trong transaction (price), fallback current_nav và các trường trong rec
            'buy_price': (buy_tx.price if buy_tx and getattr(buy_tx, 'price', 0) else None) or getattr(rec, 'buy_price', 0) or (buy_tx.current_nav if buy_tx else 0),
            'sell_price': (sell_tx.price if sell_tx and getattr(sell_tx, 'price', 0) else None) or getattr(rec, 'sell_price', 0) or (sell_tx.current_nav if sell_tx else 0),
            'matched_quantity': rec.matched_quantity,
            'matched_ccq': rec.matched_quantity,
            'matched_price': rec.matched_price,
            'total_value': rec.total_value,
            'match_date': format_datetime_user_tz(request.env, rec.match_date) or '',
            'status': rec.status,
            'buy_user_type': rec.buy_user_type,
            'sell_user_type': rec.sell_user_type,
            'fund_ticker': rec.fund_id.ticker if rec.fund_id and hasattr(rec.fund_id, 'ticker') else '',
            # IDs để gửi lên sàn
            'buy_id': buy_tx.id if buy_tx else None,
            'sell_id': sell_tx.id if sell_tx else None,
            # Remaining - tính toán chính xác từ units - matched_units (theo chuẩn Stock Exchange)
            # Sử dụng remaining_units computed field thay vì tính thủ công để đảm bảo chính xác
            'buy_remaining_units': float(buy_tx.remaining_units or 0) if buy_tx else 0,
            'sell_remaining_units': float(sell_tx.remaining_units or 0) if sell_tx else 0,
            # Sources
            'buy_source': getattr(buy_tx, 'source', '') if buy_tx else '',
            'sell_source': getattr(sell_tx, 'source', '') if sell_tx else '',
            # Times from computed fields (if any)
            # Times: Ưu tiên created_at (thời gian đặt lệnh), fallback create_date
            'buy_in_time': format_datetime_user_tz(request.env, buy_tx.created_at if buy_tx and hasattr(buy_tx, 'created_at') and buy_tx.created_at else (buy_tx.create_date if buy_tx and buy_tx.create_date else None)) or '',
            'sell_in_time': format_datetime_user_tz(request.env, sell_tx.created_at if sell_tx and hasattr(sell_tx, 'created_at') and sell_tx.created_at else (sell_tx.create_date if sell_tx and sell_tx.create_date else None)) or '',
            # Out times: Ưu tiên date_end (thời gian khớp), fallback buy_out_time/sell_out_time từ rec
            'buy_out_time': format_datetime_user_tz(request.env, buy_tx.date_end if buy_tx and hasattr(buy_tx, 'date_end') and buy_tx.date_end else (rec.buy_out_time if getattr(rec, 'buy_out_time', False) else None)) or '',
            'sell_out_time': format_datetime_user_tz(request.env, sell_tx.date_end if sell_tx and hasattr(sell_tx, 'date_end') and sell_tx.date_end else (rec.sell_out_time if getattr(rec, 'sell_out_time', False) else None)) or '',
            # Thêm các field gốc để frontend có thể sử dụng
            'buy_created_at': format_datetime_user_tz(request.env, buy_tx.created_at if buy_tx and hasattr(buy_tx, 'created_at') and buy_tx.created_at else (buy_tx.create_date if buy_tx and buy_tx.create_date else None)) or '',
            'sell_created_at': format_datetime_user_tz(request.env, sell_tx.created_at if sell_tx and hasattr(sell_tx, 'created_at') and sell_tx.created_at else (sell_tx.create_date if sell_tx and sell_tx.create_date else None)) or '',
            'buy_date_end': format_datetime_user_tz(request.env, buy_tx.date_end if buy_tx and hasattr(buy_tx, 'date_end') and buy_tx.date_end else None) or '',
            'sell_date_end': format_datetime_user_tz(request.env, sell_tx.date_end if sell_tx and hasattr(sell_tx, 'date_end') and sell_tx.date_end else None) or '',
            # Trạng thái gửi lên sàn
            'sent_to_exchange': getattr(rec, 'sent_to_exchange', False),
            'sent_to_exchange_at': format_datetime_user_tz(request.env, rec.sent_to_exchange_at) if getattr(rec, 'sent_to_exchange_at', False) else '',
            # Fallback: kiểm tra từ buy/sell order
            'buy_sent_to_exchange': getattr(buy_tx, 'sent_to_exchange', False) if buy_tx else False,
            'sell_sent_to_exchange': getattr(sell_tx, 'sent_to_exchange', False) if sell_tx else False,
            # Lãi suất và kỳ hạn từ transaction mua (chỉ hiển thị khi buyer là investor)
            'interest_rate': float(getattr(buy_tx, 'interest_rate', 0.0) or 0.0) if buy_tx else 0.0,
            'buy_interest_rate': float(getattr(buy_tx, 'interest_rate', 0.0) or 0.0) if buy_tx else 0.0,
            'term': getattr(buy_tx, 'term_months', None) or getattr(rec, 'buy_term_months', None) if buy_tx else None,
            'term_months': getattr(buy_tx, 'term_months', None) or getattr(rec, 'buy_term_months', None) if buy_tx else None,
            'buy_term_months': getattr(buy_tx, 'term_months', None) or getattr(rec, 'buy_term_months', None) if buy_tx else None,
        }

    def _get_investor_name(self, tx):
        """Lấy tên nhà đầu tư từ transaction"""
        try:
            if hasattr(tx, 'investor_name') and tx.investor_name:
                return tx.investor_name
            
            # Kiểm tra nếu là Market Maker transaction
            if hasattr(tx, 'source') and tx.source == 'market_maker':
                return 'Market Maker'
            
            # Kiểm tra nếu user là internal user (Market Maker)
            if tx.user_id and tx.user_id.has_group('base.group_system'):
                return 'Market Maker'
            
            # Kiểm tra nếu user là internal user (Market Maker) - kiểm tra thêm
            if tx.user_id and tx.user_id.has_group('base.group_user'):
                return 'Market Maker'
            
            # Lấy tên từ partner hoặc user
            if tx.user_id and tx.user_id.partner_id:
                partner_name = tx.user_id.partner_id.name
                if partner_name and partner_name != 'N/A' and partner_name.strip():
                    return partner_name
            
            if tx.user_id:
                user_name = tx.user_id.name
                if user_name and user_name != 'N/A' and user_name.strip():
                    return user_name
                    
            # Fallback: sử dụng reference hoặc ID
            if hasattr(tx, 'reference') and tx.reference:
                return f"User #{tx.id}"
                
        except Exception as e:
            pass
        return _("User #%s") % (tx.id if hasattr(tx, 'id') else 'N/A')

    def _update_inventory_for_touched_funds(self, pairs):
        """Cập nhật tồn kho cho các quỹ liên quan"""
        try:
            touched_funds = set()
            Tx = request.env['portfolio.transaction'].sudo()
            
            for p in pairs:
                try:
                    b = int(p.get('buy_id')) if p.get('buy_id') else None
                    s = int(p.get('sell_id')) if p.get('sell_id') else None
                    if b:
                        txb = Tx.browse(b)
                        if txb and txb.exists() and txb.fund_id:
                            touched_funds.add(txb.fund_id.id)
                    if s:
                        txs = Tx.browse(s)
                        if txs and txs.exists() and txs.fund_id:
                            touched_funds.add(txs.fund_id.id)
                except Exception:
                    continue
            
            Inventory = request.env['nav.daily.inventory']
            today = fields.Date.context_today(request.env.user)
            for fid in touched_funds:
                inv = Inventory.search([('fund_id', '=', fid), ('inventory_date', '=', today)], limit=1)
                if not inv:
                    inv = Inventory.create_daily_inventory_for_fund(fid, today)
                inv.action_calculate_daily_inventory()
        except Exception:
            # Không chặn quy trình lưu nếu cập nhật tồn kho gặp lỗi
            pass

    # ==== API phục vụ tab Market Maker trong nav_transaction_widget ====
    @http.route('/api/transaction-list/matched-pairs', type='http', auth='user', methods=['POST'], csrf=False)
    def get_matched_pairs_http(self, **kwargs):
        """Trả về danh sách cặp lệnh đã khớp (hỗ trợ lọc theo source_type)."""
        try:
            try:
                payload = json.loads(request.httprequest.data.decode('utf-8') or '{}')
            except Exception:
                payload = {}
            limit = int(payload.get('limit') or 500)
            fund_id = payload.get('fund_id')
            date_from = payload.get('date_from')
            date_to = payload.get('date_to')
            source_type = (payload.get('source_type') or '').strip().lower()

            Model = request.env['transaction.matched.orders'].sudo()
            # Execution hiện chỉ dùng 'done'/'draft'/'cancelled', không còn 'partial'
            domain = [('status', '=', 'done')]
            if fund_id:
                try:
                    domain.append(('fund_id', '=', int(fund_id)))
                except Exception:
                    pass
            if date_from:
                domain.append(('match_date', '>=', date_from))
            if date_to:
                domain.append(('match_date', '<=', date_to))
            # source_type = 'market_maker' => ít nhất một bên là market maker
            if source_type == 'market_maker':
                domain += ['|', ('buy_user_type', '=', 'market_maker'), ('sell_user_type', '=', 'market_maker')]

            recs = Model.search(domain, order='match_date desc', limit=limit)
            data = [self._format_matched_order_record(r) for r in recs]

            return request.make_response(
                json.dumps({
                    'success': True,
                    'matched_pairs': data,
                    'total': len(data)
                }, ensure_ascii=False),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            return request.make_response(
                json.dumps({'success': False, 'message': str(e), 'matched_pairs': [], 'total': 0}, ensure_ascii=False),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    # Alias JSON-RPC để tương thích các nơi gọi cũ: /api/transaction-list/get-matched-pairs
    @http.route('/api/transaction-list/get-matched-pairs', type='json', auth='user', methods=['POST'], csrf=False)
    def get_matched_pairs_json(self, limit=500, fund_id=None, date_from=None, date_to=None, source_type=None, **kwargs):
        """Alias JSON trả về cùng dữ liệu như endpoint HTTP ở trên, tránh 404 từ frontend cũ."""
        try:
            # Ưu tiên tham số trong body JSON-RPC
            params = None
            try:
                params = request.jsonrequest.get('params') if request.jsonrequest else None
            except Exception:
                params = None
            if params:
                limit = int(params.get('limit') or limit or 500)
                fund_id = params.get('fund_id', fund_id)
                date_from = params.get('date_from', date_from)
                date_to = params.get('date_to', date_to)
                source_type = (params.get('source_type') or source_type or '').strip().lower()
            else:
                # fallback với kwargs
                limit = int(kwargs.get('limit') or limit or 500)
                fund_id = kwargs.get('fund_id', fund_id)
                date_from = kwargs.get('date_from', date_from)
                date_to = kwargs.get('date_to', date_to)
                source_type = (kwargs.get('source_type') or source_type or '').strip().lower()

            Model = request.env['transaction.matched.orders'].sudo()
            # Execution hiện chỉ dùng 'done'/'draft'/'cancelled', không còn 'partial'
            domain = [('status', '=', 'done')]
            if fund_id:
                try:
                    domain.append(('fund_id', '=', int(fund_id)))
                except Exception:
                    pass
            if date_from:
                domain.append(('match_date', '>=', date_from))
            if date_to:
                domain.append(('match_date', '<=', date_to))
            if source_type == 'market_maker':
                domain += ['|', ('buy_user_type', '=', 'market_maker'), ('sell_user_type', '=', 'market_maker')]

            recs = Model.search(domain, order='match_date desc', limit=int(limit) if limit else 500)
            data = [self._format_matched_order_record(r) for r in recs]
            return {
                'success': True,
                'matched_pairs': data,
                'total': len(data)
            }
        except (AccessDenied, UserError, ValidationError) as e:
            _logger.error("Error in get_matched_pairs_json: %s", str(e))
            return {
                'success': False,
                'message': str(e),
                'matched_pairs': [],
                'total': 0,
                'error_type': type(e).__name__
            }
        except Exception as e:
            _logger.error("Unexpected error in get_matched_pairs_json: %s", str(e))
            _logger.error(traceback.format_exc())
            return {
                'success': False,
                'message': _('Lỗi hệ thống: %s') % str(e),
                'matched_pairs': [],
                'total': 0,
                'error_type': 'SystemError'
            }

    @http.route('/api/transaction-list/market-maker/handle-one', type='http', auth='user', methods=['POST'], csrf=False)
    def market_maker_handle_one(self, **kwargs):
        """Xử lý 1 giao dịch cho Nhà tạo lập:
        - Nếu giao dịch là SELL (investor bán): NTL mua lại ở giá của investor (tx.price)
        - Nếu giao dịch là PURCHASE/BUY (investor mua): NTL bán lại ở giá (opening_avg_price + capital_cost_amount)
        - Tạo lệnh đối ứng (portfolio.transaction) gắn user hiện tại (internal user) và ghi nhận matched pair.
        - Không cần kiểm tra lãi, xử lý tất cả giao dịch hợp lệ.
        """
        try:
            try:
                payload = json.loads(request.httprequest.data.decode('utf-8') or '{}')
            except Exception:
                payload = {}
            tx_id = payload.get('transaction_id') or kwargs.get('transaction_id')
            if not tx_id:
                return request.make_response(json.dumps({'success': False, 'message': 'Thiếu transaction_id'}, ensure_ascii=False), headers=[('Content-Type', 'application/json')])

            Tx = request.env['portfolio.transaction'].sudo()
            tx = Tx.browse(int(tx_id))
            if not tx.exists():
                return request.make_response(json.dumps({'success': False, 'message': 'Không tìm thấy giao dịch'}, ensure_ascii=False), headers=[('Content-Type', 'application/json')])

            # Guard: chỉ xử lý khi còn remaining > 0
            # Tính toán remaining_units chính xác từ units - matched_units (theo chuẩn Stock Exchange)
            units = float(getattr(tx, 'units', 0.0) or 0.0)
            matched = float(getattr(tx, 'matched_units', 0.0) or 0.0)
            remaining = max(0.0, units - matched)  # Tính toán chính xác từ units - matched_units
            if remaining <= 0:
                return request.make_response(json.dumps({'success': False, 'message': 'Giao dịch đã khớp hết.'}, ensure_ascii=False), headers=[('Content-Type', 'application/json')])

            # Tính giá NTL tham chiếu: opening_avg_price hôm nay + capital cost từ fund.certificate
            mm_ref = self._get_mm_reference_price(tx.fund_id.id if tx.fund_id else None)
            if not mm_ref.get('success'):
                return request.make_response(json.dumps({'success': False, 'message': mm_ref.get('message') or 'Không lấy được giá tham chiếu NTL'}, ensure_ascii=False), headers=[('Content-Type', 'application/json')])
            opening_price = float(mm_ref.get('opening_avg_price') or 0.0)
            opening_with_cap = float(mm_ref.get('opening_price_with_capital_cost') or opening_price)

            tx_price_raw = float(getattr(tx, 'price', 0.0) or (getattr(tx, 'current_nav', 0.0) or 0.0))
            tx_price_mm = mround(tx_price_raw, 50)
            side = (tx.transaction_type or '').lower().strip()

            created_tx = None
            matched_price = None
            # Bỏ kiểm tra lãi - xử lý tất cả giao dịch hợp lệ

            if side == 'sell':
                # Investor SELL → NTL BUY
                # Giá khớp = giá sell order (investor) - theo chuẩn Stock Exchange
                created_tx = self._create_mm_counter_tx(tx, 'buy', remaining, tx_price_mm)
                matched_price = tx_price_raw  # Giá khớp = giá sell order (investor) - theo chuẩn Stock Exchange
            elif side == 'buy':
                # Investor BUY → NTL SELL
                # Giá khớp = giá sell order (NTL) - theo chuẩn Stock Exchange
                opening_with_cap_rounded = mround(opening_with_cap, 50)
                created_tx = self._create_mm_counter_tx(tx, 'sell', remaining, opening_with_cap_rounded)
                matched_price = opening_with_cap_rounded  # Giá khớp = giá sell order (NTL) - theo chuẩn Stock Exchange
            else:
                return request.make_response(json.dumps({'success': False, 'message': 'Loại giao dịch không hỗ trợ'}, ensure_ascii=False), headers=[('Content-Type', 'application/json')])

            if not created_tx:
                return request.make_response(json.dumps({'success': False, 'message': 'Không thể tạo lệnh đối ứng'}, ensure_ascii=False), headers=[('Content-Type', 'application/json')])

            # Ghi nhận matched pair và cập nhật matched_units/status cho cả hai (đặt đúng vai trò BUY/SELL)
            if side == 'sell':
                # Investor SELL ↔ NTL BUY
                pair = self._persist_pair_and_update(created_tx, tx, remaining, matched_price)
            else:
                # Investor BUY ↔ NTL SELL
                pair = self._persist_pair_and_update(tx, created_tx, remaining, matched_price)

            handled = {'buys': [tx.id]} if side == 'buy' else {'sells': [tx.id]}
            return request.make_response(json.dumps({'success': True, 'handled': handled, 'matched_pairs': [pair] if pair else []}, ensure_ascii=False), headers=[('Content-Type', 'application/json')])
        except Exception as e:
            return request.make_response(json.dumps({'success': False, 'message': str(e)}, ensure_ascii=False), headers=[('Content-Type', 'application/json')], status=500)

    @http.route('/api/transaction-list/market-maker/handle-remaining', type='http', auth='user', methods=['POST'], csrf=False)
    def market_maker_handle_remaining(self, **kwargs):
        """Xử lý hàng loạt cho Nhà tạo lập:
        - KHÔNG phụ thuộc UI, KHÔNG xử lý theo từng quỹ
        - Tự động lấy TẤT CẢ các lệnh pending còn lại (mọi quỹ) từ DB, bao gồm cả các lệnh đã tách
        - Với remaining_sells: xem như investor bán → NTL mua ở tx.price
        - Với remaining_buys: investor mua → NTL bán ở opening_with_cap
        - Tạo lệnh đối ứng, matched pair, cập nhật matched_units/status.
        - Không cần kiểm tra lãi, xử lý tất cả giao dịch hợp lệ.
        """
        try:
            try:
                payload = json.loads(request.httprequest.data.decode('utf-8') or '{}')
            except Exception:
                payload = {}

            Tx = request.env['portfolio.transaction'].sudo()
            user = request.env.user
            matched_pairs = []
            handled_buys = []
            handled_sells = []
            errors = []

            # Gom theo fund để lấy opening price 1 lần
            fund_to_ref = {}

            def get_mm_ref(fund_id):
                if not fund_id:
                    return {'success': False, 'message': 'Thiếu fund_id'}
                if fund_id not in fund_to_ref:
                    fund_to_ref[fund_id] = self._get_mm_reference_price(fund_id)
                return fund_to_ref[fund_id]

            # Thu thập TẤT CẢ lệnh pending còn lại cho mọi quỹ trực tiếp từ DB
            remaining_buys = []
            remaining_sells = []
            pending_domain = [
                ('status', '=', 'pending'),
                ('transaction_type', 'in', ['buy', 'sell']),
            ]
            pending_txs = Tx.search(pending_domain)
            for tx in pending_txs:
                # SKIP if order belongs to a Market Maker (prevents self-matching)
                if getattr(tx, 'source', '') in ['market_maker', 'sale']:
                    continue
                if self._is_user_market_maker(tx.user_id):
                    continue
                    
                units = float(getattr(tx, 'units', 0.0) or 0.0)
                matched = float(getattr(tx, 'matched_units', 0.0) or 0.0)
                remaining = max(0.0, units - matched)
                if remaining <= 0:
                    continue
                ttype = (tx.transaction_type or '').lower()
                if ttype == 'buy':
                    remaining_buys.append(tx.id)
                elif ttype == 'sell':
                    remaining_sells.append(tx.id)

            # Xử lý SELL (investor bán) → NTL mua
            for sid in remaining_sells:
                try:
                    with request.env.cr.savepoint():
                        tx = Tx.browse(int(sid))
                        if not tx or not tx.exists():
                            continue
                        # Kiểm tra remaining - tính toán chính xác từ units - matched_units
                        units = float(getattr(tx, 'units', 0.0) or 0.0)
                        matched = float(getattr(tx, 'matched_units', 0.0) or 0.0)
                        remaining = max(0.0, units - matched)  # Tính toán chính xác từ units - matched_units
                        if remaining <= 0 or (tx.transaction_type or '').lower() != 'sell':
                            continue
                        ref = get_mm_ref(tx.fund_id.id if tx.fund_id else None)
                        if not ref.get('success'):
                            errors.append(f"Lỗi lấy giá tham chiếu quỹ {tx.fund_id.name}: {ref.get('message')}")
                            continue
                            
                        opening_with_cap = float(ref.get('opening_price_with_capital_cost') or ref.get('opening_avg_price') or 0.0)
                        opening_with_cap_rounded = mround(opening_with_cap, 50)
                        tx_price_raw = float(getattr(tx, 'price', 0.0) or (tx.current_nav or 0.0))
                        tx_price_mm = mround(tx_price_raw, 50)
                        
                        # Bỏ kiểm tra lãi - xử lý tất cả giao dịch hợp lệ
                        counter = self._create_mm_counter_tx(tx, 'buy', remaining, tx_price_mm)
                        # Investor SELL ↔ NTL BUY
                        # Giá khớp = giá sell order (investor) - theo chuẩn Stock Exchange
                        pair = self._persist_pair_and_update(counter, tx, remaining, tx_price_raw)
                        
                        if pair:
                            matched_pairs.append(pair)
                            handled_sells.append(tx.id)
                        else:
                            # Nếu không tạo được pair, raise exception để rollback counter transaction
                            raise ValueError("Không thể tạo giao dịch khớp lệnh (persist pair failed).")
                except Exception as e:
                    errors.append(f"Lỗi xử lý lệnh SELL #{sid}: {str(e)}")
                    _logger.error(f"Lỗi xử lý lệnh SELL #{sid}: {str(e)}")
                    continue

            # Xử lý BUY (investor mua) → NTL bán
            for bid in remaining_buys:
                try:
                    with request.env.cr.savepoint():
                        tx = Tx.browse(int(bid))
                        if not tx or not tx.exists():
                            continue
                        # Tính toán remaining_units chính xác từ units - matched_units
                        units = float(getattr(tx, 'units', 0.0) or 0.0)
                        matched = float(getattr(tx, 'matched_units', 0.0) or 0.0)
                        remaining = max(0.0, units - matched)  # Tính toán chính xác từ units - matched_units
                        if remaining <= 0 or (tx.transaction_type or '').lower() != 'buy':
                            continue
                        ref = get_mm_ref(tx.fund_id.id if tx.fund_id else None)
                        if not ref.get('success'):
                            errors.append(f"Lỗi lấy giá tham chiếu quỹ {tx.fund_id.name}: {ref.get('message')}")
                            continue
                            
                        opening_with_cap = float(ref.get('opening_price_with_capital_cost') or ref.get('opening_avg_price') or 0.0)
                        opening_with_cap_rounded = mround(opening_with_cap, 50)
                        tx_price_raw = float(getattr(tx, 'price', 0.0) or (tx.current_nav or 0.0))
                        tx_price_mm = mround(tx_price_raw, 50)
                        
                        # Bỏ kiểm tra lãi - xử lý tất cả giao dịch hợp lệ
                        counter = self._create_mm_counter_tx(tx, 'sell', remaining, opening_with_cap_rounded)
                        # Investor BUY ↔ NTL SELL
                        # Giá khớp = giá sell order (NTL) - theo chuẩn Stock Exchange
                        pair = self._persist_pair_and_update(tx, counter, remaining, opening_with_cap_rounded)
                        
                        if pair:
                            matched_pairs.append(pair)
                            handled_buys.append(tx.id)
                        else:
                            # Nếu không tạo được pair, raise exception để rollback counter transaction
                            raise ValueError("Không thể tạo giao dịch khớp lệnh (persist pair failed).")
                except Exception as e:
                    errors.append(f"Lỗi xử lý lệnh BUY #{bid}: {str(e)}")
                    _logger.error(f"Lỗi xử lý lệnh BUY #{bid}: {str(e)}")
                    continue

            total_handled = len(handled_buys) + len(handled_sells)
            
            # Nếu không xử lý được lệnh nào và có lỗi, trả về lỗi
            if total_handled == 0 and errors:
                return request.make_response(json.dumps({
                    'success': False, 
                    'message': 'Có lỗi khi xử lý: ' + '; '.join(errors[:3]) + ('...' if len(errors) > 3 else '')
                }, ensure_ascii=False), headers=[('Content-Type', 'application/json')])

            response = {
                'success': True,
                'handled': {
                    'buys': handled_buys,
                    'sells': handled_sells,
                },
                'matched_pairs': matched_pairs,
                'message': f'Đã xử lý {total_handled} lệnh Nhà tạo lập.' if total_handled > 0 else 'Không tìm thấy lệnh hợp lệ để xử lý.',
                'errors': errors
            }
            return request.make_response(json.dumps(response, ensure_ascii=False), headers=[('Content-Type', 'application/json')])
        except Exception as e:
            _logger.error(f"Lỗi hệ thống Market Maker: {str(e)}")
            _logger.error(traceback.format_exc())
            return request.make_response(json.dumps({'success': False, 'message': str(e)}, ensure_ascii=False), headers=[('Content-Type', 'application/json')], status=500)

    # ===== Helpers =====
    def _get_mm_reference_price(self, fund_id):
        """Lấy opening_avg_price hôm nay và opening_with_capital_cost = opening + opening*capital_cost%.
        Ưu tiên đọc trực tiếp từ models để tránh round-trip HTTP.
        """
        try:
            if not fund_id:
                return {'success': False, 'message': 'Thiếu fund_id'}
            today = fields.Date.context_today(request.env.user)
            Inventory = request.env['nav.daily.inventory'].sudo()
            inv = Inventory.search([('fund_id', '=', fund_id), ('inventory_date', '=', today)], limit=1)
            if not inv:
                inv = Inventory.create_daily_inventory_for_fund(fund_id, today)
                if inv:
                    inv._auto_calculate_inventory()
            opening = float(inv.opening_avg_price or 0.0) if inv else 0.0
            fund = request.env['portfolio.fund'].sudo().browse(int(fund_id))
            cert = fund.certificate_id if fund else None
            cap_percent = float(cert.capital_cost) if cert else 0.0
            cap_amount = opening * cap_percent / 100.0
            opening_with_cap = opening + cap_amount
            return {
                'success': True,
                'opening_avg_price': opening,
                'capital_cost_percent': cap_percent,
                'capital_cost_amount': cap_amount,
                'opening_price_with_capital_cost': opening_with_cap,
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}


    def _is_user_market_maker(self, user):
        """Kiểm tra user có phải là nhà tạo lập không"""
        try:
            if not user:
                return False
            # Check permission management
            if hasattr(user, 'permission_management_ids') and user.permission_management_ids:
                 permission_rec = user.permission_management_ids.filtered(
                    lambda p: p.permission_type == 'investor_user' and p.is_market_maker
                )
                 if permission_rec:
                     return True
            return False
        except Exception:
            return False

    def _get_market_maker_user(self):
        """
        Lấy user nhà tạo lập được phân quyền.
        Ưu tiên user đang đăng nhập nếu họ là nhà tạo lập.
        """
        try:
            # 1. Ưu tiên user hiện tại nếu là Market Maker
            if request.env.user and self._is_user_market_maker(request.env.user):
                return request.env.user

            # 2. Tìm user portal có is_market_maker = True trong permission_management_ids
            PermissionManagement = request.env['user.permission.management'].sudo()
            market_maker_permission = PermissionManagement.search([
                ('permission_type', '=', 'investor_user'),
                ('is_market_maker', '=', True)
            ], limit=1)
            
            if market_maker_permission and market_maker_permission.user_id:
                return market_maker_permission.user_id
            
            # Fallback: Tìm user portal có is_market_maker = True từ res.users
            User = request.env['res.users'].sudo()
            portal_group = request.env.ref('base.group_portal', raise_if_not_found=False)
            if portal_group:
                market_maker_users = User.search([
                    ('active', '=', True),
                    ('groups_id', 'in', [portal_group.id])
                ])
                
                for user in market_maker_users:
                    if hasattr(user, 'permission_management_ids') and user.permission_management_ids:
                        permission_rec = user.permission_management_ids.filtered(
                            lambda p: p.permission_type == 'investor_user' and p.is_market_maker
                        )
                        if permission_rec:
                            return user
            
            # Nếu không tìm thấy, trả về None (sẽ raise error)
            return None
        except Exception as e:
            _logger.error(f"Error getting market maker user: {str(e)}")
            return None

    def _create_mm_counter_tx(self, base_tx, tx_type, units, price):
        """Tạo lệnh đối ứng của Nhà tạo lập (portal user với is_market_maker=True, source='sale') theo fund/term/interest hiện có."""
        # Lấy market maker user từ permission management
        mm_user = self._get_market_maker_user()
        if not mm_user:
            raise ValueError("Không tìm thấy nhà tạo lập được phân quyền. Vui lòng cấu hình nhà tạo lập trong quản lý phân quyền.")
        
        price_value = mround(float(price or 0.0), 50)
        amount_value = mround(float(units) * price_value, 50)

        vals = {
            'user_id': mm_user.id,  # Dùng market maker user từ permission management
            'fund_id': base_tx.fund_id.id if base_tx.fund_id else False,
            'transaction_type': tx_type,
            'status': 'pending',  # duy trì pending để phù hợp flow cập nhật
            'units': float(units),
            'remaining_units': float(units),
            'matched_units': 0.0,
            'is_matched': False,
            'amount': amount_value,
            'price': price_value,
            'current_nav': price_value,
            'term_months': getattr(base_tx, 'term_months', 12) or 12,
            'interest_rate': float(getattr(base_tx, 'interest_rate', 0.0) or 0.0),
            'currency_id': request.env.company.currency_id.id,
            'investment_type': 'fund_certificate',
            'source': 'sale',
            'description': f'Market Maker counter order for TX #{base_tx.id}',
        }
        return request.env['portfolio.transaction'].sudo().create(vals)

    def _persist_pair_and_update(self, buy_tx, sell_tx, qty, matched_price):
        """
        Ghi nhận cặp matched và cập nhật matched_units/remaining/status cho 2 lệnh.
        Theo chuẩn Stock Exchange:
        - Giá khớp: Luôn lấy giá của sell order (matched_price)
        - Tính toán remaining_units chính xác từ units - matched_units
        
        Args:
            buy_tx: record bên mua
            sell_tx: record bên bán
            qty: Số lượng khớp
            matched_price: Giá khớp (theo chuẩn Stock Exchange = giá sell order)
        """
        try:
            qty_f = float(qty or 0.0)
            if qty_f <= 0:
                return None
            
            # Đảm bảo giá khớp = giá sell order (theo chuẩn Stock Exchange)
            if matched_price is None or matched_price <= 0:
                matched_price = float(sell_tx.price or sell_tx.current_nav or 0)
            
            # Tính toán remaining_units chính xác từ units - matched_units
            # Cập nhật BUY
            buy_units = float(buy_tx.units or 0.0)
            buy_current_matched = float(buy_tx.matched_units or 0.0)
            new_buy_matched = buy_current_matched + qty_f
            buy_remaining = max(0.0, buy_units - new_buy_matched)
            
            buy_vals = {
                'matched_units': new_buy_matched,
                'remaining_units': buy_remaining,
                'ccq_remaining_to_match': buy_remaining,  # Cập nhật ccq_remaining_to_match chính xác
                'status': 'completed' if buy_remaining <= 0 else 'pending',
            }
            (buy_tx.sudo().write(buy_vals) if buy_remaining <= 0 else buy_tx.with_context(bypass_investment_update=True).sudo().write(buy_vals))

            # Cập nhật SELL
            sell_units = float(sell_tx.units or 0.0)
            sell_current_matched = float(sell_tx.matched_units or 0.0)
            new_sell_matched = sell_current_matched + qty_f
            sell_remaining = max(0.0, sell_units - new_sell_matched)
            
            sell_vals = {
                'matched_units': new_sell_matched,
                'remaining_units': sell_remaining,
                'ccq_remaining_to_match': sell_remaining,  # Cập nhật ccq_remaining_to_match chính xác
                'status': 'completed' if sell_remaining <= 0 else 'pending',
            }
            (sell_tx.sudo().write(sell_vals) if sell_remaining <= 0 else sell_tx.with_context(bypass_investment_update=True).sudo().write(sell_vals))

            # Lưu matched order
            # Execution luôn được ghi nhận là 'done' khi đã tạo xong
            mo_status = 'done'
            
            # Xác định loại người dùng hai phía để hỗ trợ filter Market Maker ở frontend
            def _detect_user_type(tx_rec):
                try:
                    # Lệnh NTL do chúng ta tạo có source='sale'
                    if getattr(tx_rec, 'source', '') == 'sale':
                        return 'market_maker'
                    # Fallback: nội bộ (base.group_user) xem như market_maker, còn lại investor
                    if tx_rec.user_id and tx_rec.user_id.has_group('base.group_user'):
                        return 'market_maker'
                except Exception:
                    pass
                return 'investor'

            buy_type = _detect_user_type(buy_tx)
            sell_type = _detect_user_type(sell_tx)
            
            # QUAN TRỌNG: Không tạo name thủ công - để sequence tự động tạo format HDC-DDMMYY/STT
            # Mỗi cặp lệnh sẽ có mã thỏa thuận riêng từ sequence
            # Indicators cho lệnh nhỏ sẽ được thêm sau khi tạo record (trong create() method)

            # Đảm bảo giá khớp = giá sell order (theo chuẩn Stock Exchange)
            final_matched_price = float(matched_price or 0.0)
            if final_matched_price <= 0:
                final_matched_price = float(sell_tx.price or sell_tx.current_nav or 0)
            
            mo = request.env['transaction.matched.orders'].sudo().create({
                # Không set name - để sequence tự động tạo format HDC-DDMMYY/STT
                'buy_order_id': buy_tx.id,
                'sell_order_id': sell_tx.id,
                'matched_quantity': qty_f,
                'matched_price': final_matched_price,  # Giá khớp = giá sell order - theo chuẩn Stock Exchange
                'fund_id': (buy_tx.fund_id.id if buy_tx.fund_id else (sell_tx.fund_id.id if sell_tx.fund_id else False)),
                'status': mo_status,
                'buy_user_type': buy_type,
                'sell_user_type': sell_type,
            })

            # Trả dữ liệu pair theo format frontend đang dùng
            return {
                'buy_id': buy_tx.id,
                'buy_nav': float(buy_tx.price or buy_tx.current_nav or 0.0),
                'buy_amount': float(buy_tx.amount or 0.0),
                'buy_units': float(buy_tx.units or 0.0),
                'buy_in_time': format_datetime_user_tz(request.env, buy_tx.created_at if getattr(buy_tx, 'created_at', False) else (buy_tx.create_date if buy_tx.create_date else None)) or '',
                'sell_id': sell_tx.id,
                'sell_nav': float(sell_tx.price or sell_tx.current_nav or 0.0),
                'sell_amount': float(sell_tx.amount or 0.0),
                'sell_units': float(sell_tx.units or 0.0),
                'sell_in_time': format_datetime_user_tz(request.env, sell_tx.created_at if getattr(sell_tx, 'created_at', False) else (sell_tx.create_date if sell_tx.create_date else None)) or '',
                'matched_price': float(final_matched_price or matched_price or 0.0),  # Giá khớp = giá sell order - theo chuẩn Stock Exchange
                'matched_volume': qty_f,
                'matched_ccq': qty_f,
                'match_time': format_datetime_user_tz(request.env, fields.Datetime.now()),
                'algorithm_used': 'Market Maker',
                'fund_name': buy_tx.fund_id.name if buy_tx.fund_id else (sell_tx.fund_id.name if sell_tx.fund_id else 'N/A'),
            }
        except Exception:
            return None