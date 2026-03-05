# -*- coding: utf-8 -*-
"""
Normal Order Controller - API endpoints for normal order operations

Handles:
- Creating normal orders (order_mode='normal')
- Listing normal orders
- Sending orders to exchange
- Market Maker conversion (normal → negotiated)
"""

import logging
from datetime import datetime
import pytz

from odoo import http, fields, _
from odoo.http import request
from odoo.exceptions import ValidationError, UserError

from ..utils import constants

_logger = logging.getLogger(__name__)


class NormalOrderController(http.Controller):
    """API Controller for Normal Order operations"""

    # ==========================================================================
    # CREATE NORMAL ORDER
    # ==========================================================================
    @http.route('/api/fund/normal-order/create', type='json', auth='user', methods=['POST'])
    def create_normal_order(self, **kwargs):
        """
        Create a normal order (to be sent to exchange)
        
        Required params:
            - fund_id (int): ID of the fund
            - transaction_type (str): 'buy' or 'sell'
            - units (float): Number of CCQ units (must be multiple of 100)
            - price (float): Price per unit
            - order_type_detail (str): 'MTL', 'ATO', 'ATC', or 'LO'
        
        Returns:
            dict: {success: bool, order_id: int, message: str}
        """
        try:
            # === ELIGIBILITY CHECK: eKYC + Trading Account ===
            current_user = request.env.user
            partner = current_user.partner_id

            # Check eKYC verified
            status_info = request.env['status.info'].sudo().search([
                ('partner_id', '=', partner.id)
            ], limit=1)
            if not status_info or status_info.account_status != 'approved':
                return {
                    'success': False,
                    'message': 'Tài khoản của bạn cần được cập nhật thông tin cá nhân trước khi đặt lệnh.',
                    'error_code': 'account_not_approved'
                }

            # Check trading account linked
            trading_config = request.env['trading.config'].sudo().search([
                ('user_id', '=', current_user.id),
                ('active', '=', True)
            ], limit=1)
            if not trading_config:
                return {
                    'success': False,
                    'message': 'Bạn cần liên kết tài khoản chứng khoán trước khi đặt lệnh.',
                    'error_code': 'trading_account_required'
                }

            # Get parameters
            fund_id = kwargs.get('fund_id')
            transaction_type = kwargs.get('transaction_type')
            units = float(kwargs.get('units', 0))
            price = float(kwargs.get('price', 0))
            order_type_detail = kwargs.get('order_type_detail', constants.DEFAULT_ORDER_TYPE_DETAIL)
            amount = float(kwargs.get('amount', 0)) or (units * price)
            
            # Validate required fields
            if not fund_id:
                return {'success': False, 'message': 'Vui lòng chọn quỹ đầu tư'}
            
            if not transaction_type or transaction_type not in ['buy', 'sell']:
                return {'success': False, 'message': 'Loại giao dịch không hợp lệ'}
            
            if units <= 0:
                return {'success': False, 'message': 'Số lượng CCQ phải lớn hơn 0'}
            
            # Removed lot size validation checks
            # if units % constants.LOT_SIZE != 0: ...
            
            # Allow price=0 for Market Orders, require price > 0 for Limit Orders
            is_limit_order = order_type_detail in constants.LIMIT_ORDER_TYPES
            if is_limit_order and price <= 0:
                return {'success': False, 'message': f'Loại lệnh {order_type_detail} yêu cầu nhập giá > 0'}
            
            # Validate order type for market
            fund = request.env['portfolio.fund'].sudo().browse(int(fund_id))
            if not fund.exists():
                return {'success': False, 'message': 'Quỹ không tồn tại'}
            
            market = constants.MARKET_HOSE  # Default
            if fund.certificate_id and hasattr(fund.certificate_id, 'market'):
                market = fund.certificate_id.market or constants.MARKET_HOSE
            
            allowed_types = constants.ORDER_TYPES_BY_MARKET.get(market, [])
            if order_type_detail not in allowed_types:
                return {
                    'success': False,
                    'message': f'Loại lệnh {order_type_detail} không hỗ trợ trên sàn {market}'
                }
            
            # STRICT PRICE VALIDATION (Backend Guardrail)
            debug_mode = kwargs.get('debug', False)
            is_contract_sell = kwargs.get('is_contract_sell', False)
            
            if order_type_detail == 'LO' and not debug_mode and not is_contract_sell:
                # Safe access: use hasattr to check for fields
                ceiling_price = 0
                floor_price = 0
                try:
                    if hasattr(fund, 'certificate_id') and fund.certificate_id:
                        ceiling_price = fund.certificate_id.ceiling_price or 0
                        floor_price = fund.certificate_id.floor_price or 0
                except Exception:
                    pass  # Skip price validation if certificate data unavailable
                
                # If market data is available, enforce it
                if ceiling_price > 0 and price > ceiling_price:
                    return {
                        'success': False, 
                        'message': f'Giá đặt ({price:,.0f}) không được lớn hơn giá trần ({ceiling_price:,.0f})'
                    }
                
                if floor_price > 0 and price < floor_price:
                    return {
                        'success': False, 
                        'message': f'Giá đặt ({price:,.0f}) không được nhỏ hơn giá sàn ({floor_price:,.0f})'
                    }
            elif debug_mode and order_type_detail == 'LO':
                _logger.warning("DEBUG MODE: Skipping Price Validation for LO Order")
            
            # Check purchasing power (for buy orders)
            if transaction_type == 'buy':
                # TODO: Integrate with account balance check from stock_trading module
                pass
            elif transaction_type == 'sell':
                # Get investment with T+2 aware available_units
                investment = request.env['portfolio.investment'].sudo().search([
                    ('user_id', '=', request.env.user.id),
                    ('fund_id', '=', fund.id),
                    ('status', '=', 'active'),
                ], limit=1)
                
                if not investment:
                    return {'success': False, 'message': 'Bạn không sở hữu CCQ của quỹ này'}
                
                # Force T+2 recomputation (stored compute doesn't re-trigger on date change)
                investment._compute_units_breakdown()
                
                # Use T+2 aware available_units from Investment model
                # Route to correct pool based on sell type
                pending_t2 = investment.pending_t2_units
                
                if is_contract_sell:
                    # Contract sell → validate against negotiated pool
                    available = investment.negotiated_available_units
                    pool_label = 'CCQ thỏa thuận khả dụng'
                else:
                    # Normal sell → validate against normal pool
                    available = investment.normal_available_units
                    pool_label = 'CCQ thường khả dụng'
                
                if units > available:
                    if debug_mode:
                         _logger.warning(f"[DEBUG MODE] Bypassing Sell Limit: Selling {units:,.0f} > Available {available:,.0f} ({pool_label})")
                    else:
                        msg = f'Số lượng bán ({units:,.0f}) vượt quá {pool_label} ({available:,.0f}).'
                        if pending_t2 > 0:
                            msg += f' Còn {pending_t2:,.0f} CCQ đang chờ về (T+2).'
                        return {'success': False, 'message': msg}
            
            # Determine Order Session (Reconciliation Guardrail)
            tz = pytz.timezone('Asia/Ho_Chi_Minh')
            now = datetime.now(tz)
            current_time = now.time()
            
            t_9_00 = datetime.strptime("09:00:00", "%H:%M:%S").time()
            t_9_15 = datetime.strptime("09:15:00", "%H:%M:%S").time()
            t_11_30 = datetime.strptime("11:30:00", "%H:%M:%S").time()
            t_13_00 = datetime.strptime("13:00:00", "%H:%M:%S").time()
            t_14_30 = datetime.strptime("14:30:00", "%H:%M:%S").time()
            t_14_45 = datetime.strptime("14:45:00", "%H:%M:%S").time()
            
            order_session = 'unknown'
            
            # Logic based on Time + Order Type
            if order_type_detail == 'ATO':
                order_session = 'ato'
            elif order_type_detail == 'ATC':
                order_session = 'atc'
            else: # LO, MP, MTL...
                if t_9_00 <= current_time < t_9_15:
                    order_session = 'ato'
                elif t_9_15 <= current_time < t_11_30:
                    order_session = 'continuous'
                elif t_13_00 <= current_time < t_14_30:
                    order_session = 'continuous'
                elif t_14_30 <= current_time < t_14_45:
                    order_session = 'atc'
                elif current_time < t_9_00:
                    order_session = 'pre_market'
                else:
                    order_session = 'after_market'
            
            # Create the transaction
            current_user = request.env.user
            current_nav = fund.current_nav or price
            
            transaction_vals = {
                'user_id': current_user.id,
                'fund_id': fund.id,
                'transaction_type': transaction_type,
                'units': units,
                'amount': amount,
                'price': price,
                'current_nav': current_nav,
                'order_mode': constants.ORDER_MODE_NEGOTIATED if is_contract_sell else constants.ORDER_MODE_NORMAL,
                'order_type_detail': order_type_detail,
                'market': market,
                'order_session': order_session,
                'exchange_status': constants.EXCHANGE_STATUS_PENDING,
                'status': constants.STATUS_PENDING,
                'source': constants.SOURCE_PORTAL,
                'created_at': fields.Datetime.now(),
            }
            
            transaction = request.env['portfolio.transaction'].sudo().create(transaction_vals)
            
            _logger.info(
                f"Created normal order: ID={transaction.id}, "
                f"User={current_user.name}, Fund={fund.name}, "
                f"Type={transaction_type}, Units={units}, Price={price}"
            )
            
            return {
                'success': True,
                'order_id': transaction.id,
                'reference': transaction.reference,
                'message': 'Đặt lệnh thành công! Lệnh đang chờ gửi lên sàn.'
            }
            
        except ValidationError as e:
            _logger.warning(f"Validation error creating normal order: {e}")
            return {'success': False, 'message': str(e)}
        except Exception as e:
            _logger.error(f"Error creating normal order: {e}", exc_info=True)
            return {'success': False, 'message': f'Lỗi hệ thống: {str(e)}'}

    # ==========================================================================
    # LIST NORMAL ORDERS
    # ==========================================================================
    @http.route('/api/fund/normal-order/list', type='json', auth='user', methods=['POST'])
    def list_normal_orders(self, **kwargs):
        """
        Get list of normal orders
        
        Optional params:
            - fund_id (int): Filter by fund
            - status (str): Filter by exchange_status ('pending', 'sent', 'filled', etc.)
            - transaction_type (str): Filter by 'buy' or 'sell'
            - limit (int): Max records to return (default 100)
        
        Returns:
            dict: {success: bool, orders: list}
        """
        try:
            fund_id = kwargs.get('fund_id')
            status = kwargs.get('status')
            transaction_type = kwargs.get('transaction_type')
            limit = int(kwargs.get('limit', 100))
            
            # Build domain
            domain = [('order_mode', '=', constants.ORDER_MODE_NORMAL)]
            
            if fund_id:
                domain.append(('fund_id', '=', int(fund_id)))
            
            if status:
                domain.append(('exchange_status', '=', status))
            
            if transaction_type:
                domain.append(('transaction_type', '=', transaction_type))
            
            # Query
            orders = request.env['portfolio.transaction'].sudo().search(
                domain, order='created_at desc', limit=limit
            )
            
            # Format response
            order_list = []
            for order in orders:
                order_list.append({
                    'id': order.id,
                    'reference': order.reference,
                    'fund_id': order.fund_id.id,
                    'fund_name': order.fund_id.name,
                    'fund_ticker': order.fund_id.ticker,
                    'transaction_type': order.transaction_type,
                    'units': order.units,
                    'price': order.price,
                    'amount': order.amount,
                    'order_type_detail': order.order_type_detail,
                    'market': order.market,
                    'exchange_status': order.exchange_status,
                    'exchange_order_id': order.exchange_order_id,
                    'exchange_filled_quantity': order.exchange_filled_quantity,
                    'exchange_filled_price': order.exchange_filled_price,
                    'status': order.status,
                    'user_id': order.user_id.id,
                    'user_name': order.user_id.name,
                    'created_at': order.created_at.isoformat() if order.created_at else None,
                    'exchange_sent_at': order.exchange_sent_at.isoformat() if order.exchange_sent_at else None,
                    'exchange_filled_at': order.exchange_filled_at.isoformat() if order.exchange_filled_at else None,
                })
            
            return {
                'success': True,
                'orders': order_list,
                'total': len(order_list)
            }
            
        except Exception as e:
            _logger.error(f"Error listing normal orders: {e}", exc_info=True)
            return {'success': False, 'message': f'Lỗi hệ thống: {str(e)}'}

    # ==========================================================================
    # SEND TO EXCHANGE
    # ==========================================================================
    @http.route('/api/fund/normal-order/send-to-exchange', type='json', auth='user', methods=['POST'])
    def send_to_exchange(self, **kwargs):
        """
        Send selected normal orders to exchange via stock_trading module
        
        Required params:
            - order_ids (list): List of order IDs to send
        
        Returns:
            dict: {success: bool, sent_count: int, failed: list, message: str}
        """
        try:
            order_ids = kwargs.get('order_ids', [])
            
            if not order_ids:
                return {'success': False, 'message': 'Vui lòng chọn ít nhất 1 lệnh để gửi'}
            
            orders = request.env['portfolio.transaction'].sudo().browse(order_ids)
            
            sent_count = 0
            failed = []
            
            for order in orders:
                try:
                    # Validate order can be sent
                    if order.order_mode != constants.ORDER_MODE_NORMAL:
                        failed.append({
                            'id': order.id,
                            'error': 'Không phải lệnh thường'
                        })
                        continue
                    
                    if order.exchange_status not in [constants.EXCHANGE_STATUS_PENDING]:
                        failed.append({
                            'id': order.id,
                            'error': f'Trạng thái không hợp lệ: {order.exchange_status}'
                        })
                        continue
                    
                    # Create trading.order record
                    trading_order, error_msg = self._create_trading_order(order)
                    
                    if trading_order:
                        # Submit order to exchange immediately
                        trading_order.action_submit_order()
                        
                        # Update transaction status based on trading order state
                        # Map trading.order state to portfolio.transaction exchange_status
                        new_status = constants.EXCHANGE_STATUS_SENT
                        if trading_order.state == 'filled':
                            new_status = constants.EXCHANGE_STATUS_FILLED
                        elif trading_order.state == 'partially_filled':
                           new_status = constants.EXCHANGE_STATUS_PARTIAL
                        elif trading_order.state == 'cancelled':
                            new_status = constants.EXCHANGE_STATUS_CANCELLED
                        elif trading_order.state == 'rejected':
                             new_status = constants.EXCHANGE_STATUS_REJECTED

                        order.write({
                            'exchange_status': new_status,
                            'exchange_order_id': trading_order.name,
                            'exchange_sent_at': fields.Datetime.now(),
                        })
                        sent_count += 1
                        _logger.info(f"Sent order {order.id} to exchange: {trading_order.name} (State: {trading_order.state})")
                        
                        # Send success notification
                        self._send_order_notification(
                            order, 
                            'order_sent_success', 
                            f'Lệnh {order.reference} đã gửi lên sàn thành công. Mã lệnh sàn: {trading_order.name}',
                            success=True
                        )
                    else:
                        error_msg = error_msg or 'Không thể tạo lệnh giao dịch'
                        failed.append({
                            'id': order.id,
                            'error': error_msg
                        })
                        # Send failure notification
                        self._send_order_notification(
                            order, 
                            'order_sent_failed', 
                            f'Gửi lệnh thất bại: {error_msg}',
                            success=False
                        )
                        
                except Exception as e:
                    failed.append({
                        'id': order.id,
                        'error': str(e)
                    })
                    # Send failure notification for exception
                    self._send_order_notification(
                        order, 
                        'order_sent_failed', 
                        f'Lỗi hệ thống khi gửi lệnh: {str(e)}',
                        success=False
                    )
            
            return {
                'success': sent_count > 0,
                'sent_count': sent_count,
                'failed': failed,
                'message': f'Đã gửi {sent_count}/{len(order_ids)} lệnh lên sàn'
            }
            
        except Exception as e:
            _logger.error(f"Error sending orders to exchange: {e}", exc_info=True)
            return {'success': False, 'message': f'Lỗi hệ thống: {str(e)}'}
    
    def _create_trading_order(self, order):
        """Helper to create trading.order record from portfolio.transaction
        
        Returns:
            (trading.order, str): (record, None) if success, (None, error_msg) if failed
        """
        try:
            TradingOrder = request.env['trading.order'].sudo()
            
            _logger.info(f"[CREATE_TRADING_ORDER] Starting for order {order.id} - Fund: {order.fund_id.name if order.fund_id else 'N/A'}")
            
            # Find the instrument (security) from fund
            instrument = None
            symbol = None
            
            if order.fund_id:
                # Try multiple sources for symbol
                if order.fund_id.certificate_id and order.fund_id.certificate_id.symbol:
                    symbol = order.fund_id.certificate_id.symbol
                elif order.fund_id.ticker:
                    symbol = order.fund_id.ticker
                    
                if symbol:
                    _logger.info(f"[CREATE_TRADING_ORDER] Looking for instrument with symbol: {symbol}")
                    instrument = request.env['ssi.securities'].sudo().search([
                        ('symbol', '=', symbol.strip().upper())
                    ], limit=1)
            
            if not instrument:
                msg = f"Không tìm thấy mã chứng khoán cho quỹ {order.fund_id.name} (Symbol: {symbol})"
                _logger.error(f"[CREATE_TRADING_ORDER] {msg}")
                return None, msg
            
            _logger.info(f"[CREATE_TRADING_ORDER] Found instrument: {instrument.symbol} (ID: {instrument.id})")
            
            # Map transaction_type to buy_sell
            buy_sell = 'B' if order.transaction_type == 'buy' else 'S'
            
            # Fetch account from config - REQUIRED
            config = request.env['trading.config'].sudo().search([
                ('user_id', '=', order.user_id.id),
                ('active', '=', True)
            ], limit=1)
            
            if not config:
                msg = f"Người dùng {order.user_id.name} chưa cấu hình tài khoản giao dịch"
                _logger.error(f"[CREATE_TRADING_ORDER] {msg}")
                return None, msg
            
            account = config.account.strip().upper() if config.account else ''
            if not account:
                msg = f"Cấu hình tài khoản giao dịch cho {order.user_id.name} bị thiếu số tài khoản"
                _logger.error(f"[CREATE_TRADING_ORDER] {msg}")
                return None, msg
            
            _logger.info(f"[CREATE_TRADING_ORDER] Using account: {account}")

            trading_vals = {
                'user_id': order.user_id.id,
                'instrument_id': instrument.id,
                'account': account,
                'buy_sell': buy_sell,
                'order_type': 'stock',
                'order_type_detail': order.order_type_detail or 'LO',
                'market': 'VN',
                'quantity': int(order.units),
                'price': float(order.price or 0.0),
                'state': 'draft',
                'notes': f'Source Transaction: {order.id} | {order.reference or ""}',
            }
            
            _logger.info(f"[CREATE_TRADING_ORDER] Creating with vals: {trading_vals}")
            
            trading_order = TradingOrder.create(trading_vals)
            _logger.info(f"[CREATE_TRADING_ORDER] Successfully created trading.order {trading_order.id} ({trading_order.name})")
            return trading_order, None
            
        except Exception as e:
            msg = f"Lỗi tạo lệnh giao dịch: {str(e)}"
            _logger.error(f"[CREATE_TRADING_ORDER] Error creating trading order for {order.id}: {e}", exc_info=True)
            return None, msg

    def _send_order_notification(self, order, notification_type, message, success=True):
        """Helper to send notification via bus"""
        try:
            # Check if order_matching module is installed (model exists)
            if 'transaction.maturity.notification' not in request.env:
                return

            MaturityNotification = request.env['transaction.maturity.notification'].sudo()
            
            # Create notification record
            notification = MaturityNotification.create({
                'transaction_id': order.id,
                'notification_type': notification_type,
                'title': 'Đặt lệnh thành công' if success else 'Đặt lệnh thất bại',
                'message': message,
                'state': 'draft'
            })
            
            # Send it
            notification.action_send_notification()
            
        except Exception as e:
            _logger.warning(f"Failed to send order notification: {e}")

    # ==========================================================================
    # CONVERT TO NEGOTIATED (Market Maker feature)
    # ==========================================================================
    @http.route('/api/fund/normal-order/convert-to-negotiated', type='json', auth='user', methods=['POST'])
    def convert_to_negotiated(self, **kwargs):
        """
        Market Maker converts normal order to negotiated order
        
        Required params:
            - order_id (int): Order ID to convert
            - term_months (int): Term in months
            - interest_rate (float): Interest rate percentage
        
        Returns:
            dict: {success: bool, message: str}
        """
        try:
            order_id = kwargs.get('order_id')
            term_months = int(kwargs.get('term_months', 0))
            interest_rate = float(kwargs.get('interest_rate', 0))
            
            if not order_id:
                return {'success': False, 'message': 'Vui lòng chọn lệnh cần chuyển đổi'}
            
            if term_months <= 0:
                return {'success': False, 'message': 'Kỳ hạn phải lớn hơn 0'}
            
            if interest_rate <= 0:
                return {'success': False, 'message': 'Lãi suất phải lớn hơn 0'}
            
            order = request.env['portfolio.transaction'].sudo().browse(int(order_id))
            
            if not order.exists():
                return {'success': False, 'message': 'Lệnh không tồn tại'}
            
            if order.order_mode != constants.ORDER_MODE_NORMAL:
                return {'success': False, 'message': 'Lệnh không phải lệnh thường'}
            
            if order.exchange_status != constants.EXCHANGE_STATUS_PENDING:
                return {
                    'success': False, 
                    'message': 'Chỉ có thể chuyển đổi lệnh chưa gửi lên sàn'
                }
            
            # Convert to negotiated
            order.write({
                'order_mode': constants.ORDER_MODE_NEGOTIATED,
                'term_months': term_months,
                'interest_rate': interest_rate,
                'exchange_status': False,  # Clear exchange status
            })
            
            # Add to order matching engine
            try:
                engine = request.env['transaction.partial.matching.engine'].sudo()
                if hasattr(engine, 'add_order'):
                    engine.add_order(order.id)
            except Exception as engine_error:
                _logger.warning(f"Could not add to matching engine: {engine_error}")
            
            _logger.info(
                f"Converted order {order.id} to negotiated: "
                f"term={term_months}m, rate={interest_rate}%"
            )
            
            return {
                'success': True,
                'message': 'Đã chuyển đổi thành lệnh thỏa thuận'
            }
            
        except Exception as e:
            _logger.error(f"Error converting order: {e}", exc_info=True)
            return {'success': False, 'message': f'Lỗi hệ thống: {str(e)}'}

    # ==========================================================================
    # GET ORDER TYPES BY MARKET
    # ==========================================================================
    @http.route('/api/fund/normal-order/order-types', type='json', auth='user', methods=['POST'])
    def get_order_types_by_market(self, **kwargs):
        """
        Get available order types for a specific market with TIME VALIDATION
        Re-implemented for STRICT session enforcement.
        """
        try:
            market = kwargs.get('market')
            fund_id = kwargs.get('fund_id')
            
            # Get market from fund if fund_id provided
            if fund_id and not market:
                # Handle fund_id being None or int
                try:
                    f_id = int(fund_id)
                    fund = request.env['portfolio.fund'].sudo().browse(f_id)
                    if fund.exists() and fund.certificate_id:
                        market = getattr(fund.certificate_id, 'market', None)
                except (ValueError, TypeError):
                    pass # Invalid fund_id, ignore
            
            # Default to HOSE
            if not market:
                market = constants.MARKET_HOSE
            
            allowed_types = constants.ORDER_TYPES_BY_MARKET.get(market, [])
            
            # Time Validation Setup
            tz = pytz.timezone('Asia/Ho_Chi_Minh')
            now = datetime.now(tz)
            current_time = now.strftime("%H:%M:%S") # Use string for comparison check
            
            _logger.info(f"Checking Order Types: Market={market}, Time={current_time}")

            def is_time_in_range(start, end):
                return start <= current_time < end

            # Strict Validity Logic
            def check_strict_validity(ot, mkt):
                reason = "Chưa đến phiên"
                
                # Weekend check
                if now.weekday() >= 5: # Sat=5, Sun=6
                    return False, "Thị trường nghỉ cuối tuần"

                if mkt == constants.MARKET_HOSE:
                    if ot == 'ATO':
                        if is_time_in_range("09:00:00", "09:15:00"):
                            return True, ""
                        return False, "Chỉ đặt trong phiên ATO (09:00-09:15)"
                    
                    elif ot == 'LO':
                        # Allow LO in Continuous & ATO & ATC (strictly speaking LO is allowed almost all day, but only MATCHES in sessions)
                        # User wants "Lock", so we allow INPUT during valid sessions.
                        # Morning: 09:00 - 11:30
                        # Afternoon: 13:00 - 14:45
                        if is_time_in_range("09:00:00", "11:30:00") or is_time_in_range("13:00:00", "14:45:00"):
                            return True, ""
                        return False, "Hết giờ giao dịch hoặc nghỉ trưa"

                    elif ot == 'MTL' or ot == 'MP':
                        # Only Continuous
                        # Morning: 09:15 - 11:30
                        # Afternoon: 13:00 - 14:30
                        if is_time_in_range("09:15:00", "11:30:00") or is_time_in_range("13:00:00", "14:30:00"):
                            return True, ""
                        return False, "Chỉ đặt trong phiên khớp lệnh liên tục"

                    elif ot == 'ATC':
                        # STRICT ATC: 14:30 - 14:45
                        if is_time_in_range("14:30:00", "14:45:00"):
                            return True, ""
                        return False, "Chỉ đặt trong phiên ATC (14:30-14:45)"

                elif mkt == constants.MARKET_HNX:
                     # HNX has no ATO.
                     # Continuous: 09:00 - 11:30, 13:00 - 14:30
                     # ATC: 14:30 - 14:45
                     # PLO: 14:45 - 15:00
                    if ot == 'LO' or ot == 'MTL' or ot == 'MAK' or ot == 'MOK' or ot == 'MTL':
                         if is_time_in_range("09:00:00", "11:30:00") or is_time_in_range("13:00:00", "14:30:00"):
                            return True, ""
                         return False, "Thị trường nghỉ"
                    
                    if ot == 'ATC':
                         if is_time_in_range("14:30:00", "14:45:00"):
                            return True, ""
                         return False, "Chỉ đặt trong phiên ATC"
                         
                elif mkt == constants.MARKET_UPCOM:
                    # UPCOM: 09:00 - 11:30, 13:00 - 15:00
                    if is_time_in_range("09:00:00", "11:30:00") or is_time_in_range("13:00:00", "15:00:00"):
                        return True, ""
                    return False, "Thị trường nghỉ"

                return False, "Không loại lệnh / thị trường hỗ trợ"

            # Format response
            order_types = []
            for ot_code, ot_label in constants.ORDER_TYPE_DETAILS:
                if ot_code not in allowed_types:
                    continue
                    
                is_enabled, reason = check_strict_validity(ot_code, market)
                
                order_types.append({
                    'value': ot_code,
                    'label': ot_code,
                    'full_label': ot_label,
                    'enabled': is_enabled,
                    'reason': reason
                })
            
            return {
                'success': True,
                'market': market,
                'order_types': order_types,
                'server_time': current_time
            }
            
        except Exception as e:
            _logger.error(f"Error getting order types: {e}", exc_info=True)
            return {'success': False, 'message': str(e)}

    # ==========================================================================
    # GET MARKET INFO (Funds & Purchasing Power)
    # ==========================================================================
    @http.route('/api/fund/normal-order/market-info', type='json', auth='user', methods=['POST'])
    def get_market_info(self, **kwargs):
        """
        Get market info for normal order form:
        1. List of active funds with NAV and market
        2. User's purchasing power from stock_trading
        
        Optional params:
            - for_sell (bool): If True, only return funds user owns (has holdings > 0)
        
        Returns:
            dict: {success: bool, funds: list, purchasing_power: float}
        """
        try:
            current_user = request.env.user
            partner = current_user.partner_id
            for_sell = kwargs.get('for_sell', False)

            # Eligibility check
            status_info = request.env['status.info'].sudo().search([
                ('partner_id', '=', partner.id)
            ], limit=1)
            account_approved = bool(status_info and status_info.account_status == 'approved')

            trading_config = request.env['trading.config'].sudo().search([
                ('user_id', '=', current_user.id),
                ('active', '=', True)
            ], limit=1)
            has_trading_account = bool(trading_config)
            eligible = account_approved and has_trading_account
            
            # 1. Get Funds
            funds = request.env['portfolio.fund'].sudo().search([])
            fund_list = []
            
            # Get user's holdings for filtering sell orders
            user_holdings = {}
            if for_sell:
                try:
                    investments = request.env['portfolio.investment'].sudo().search([
                        ('user_id', '=', current_user.id),
                        ('status', '=', 'active'),
                        ('units', '>', 0)
                    ])
                    _logger.info(f"[Market Info] Found {len(investments)} active investments for user {current_user.id}")
                    
                    for inv in investments:
                        if inv.fund_id.id not in user_holdings:
                            user_holdings[inv.fund_id.id] = {'units': 0, 'avg_price': 0} # avg_price logic might be complex with multiple investments, using simple valid fallback
                        
                        user_holdings[inv.fund_id.id]['units'] += inv.units
                        _logger.info(f"[Market Info] Investment {inv.id}: Fund {inv.fund_id.name} ({inv.fund_id.id}), Units: {inv.units}")
                        
                    _logger.info(f"[Market Info] User Holdings Fund IDs: {list(user_holdings.keys())}")

                except Exception as e:
                    _logger.warning(f"Could not get user investments: {e}")
            
            for fund in funds:
                # For sell orders, skip funds user doesn't own
                if for_sell and fund.id not in user_holdings:
                    continue
                
                # Determine market
                market = constants.MARKET_HOSE
                if fund.certificate_id and hasattr(fund.certificate_id, 'market'):
                    market = fund.certificate_id.market or constants.MARKET_HOSE
                
                # Get current NAV
                nav = fund.current_nav or 0.0
                if nav <= 0 and fund.certificate_id:
                     # Try to get from last price or par value as fallback
                     nav = fund.certificate_id.current_price or 10000.0
                
                fund_info = {
                    'id': fund.id,
                    'name': fund.name,
                    'ticker': fund.ticker,
                    'market': market,
                    'current_nav': nav,
                    'ceiling_price': fund.high_price or 0.0,
                    'floor_price': fund.low_price or 0.0,
                }
                
                # Add holdings info for sell (use Investment model's T+2 aware fields)
                if for_sell and fund.id in user_holdings:
                    inv = investments.filtered(lambda i: i.fund_id.id == fund.id)[:1]
                    if inv:
                        # Force T+2 recomputation (stored compute doesn't re-trigger on date change)
                        inv._compute_units_breakdown()
                        
                        fund_info['holdings'] = inv.units
                        fund_info['available_units'] = inv.available_units
                        fund_info['pending_t2_units'] = inv.pending_t2_units
                        fund_info['avg_price'] = 0  # TODO: Calculate if needed
                        
                        # NEW: Explicit Normal/Negotiated split using Model Computed Fields
                        fund_info['normal_units'] = inv.normal_order_units
                        fund_info['negotiated_units'] = inv.negotiated_order_units
                        
                        # Use centralized logic from Investment model
                        fund_info['normal_available_units'] = inv.normal_available_units
                
                fund_list.append(fund_info)
            
            # 2. Get Purchasing Power from stock_trading
            purchasing_power = 0.0
            try:
                # Find trading account for user
                trading_account = request.env['trading.account'].sudo().search([
                    ('user_id', '=', current_user.id)
                ], limit=1)
                
                if trading_account:
                    # Sync balance first if possible (optional, maybe slow)
                    # trading_account.action_sync_balance() 
                    
                    # Get latest balance record
                    balance = request.env['trading.account.balance'].sudo().search([
                        ('account_id', '=', trading_account.id)
                    ], order='last_sync desc', limit=1)
                    
                    if balance:
                        purchasing_power = balance.purchasing_power
            except Exception as e:
                _logger.warning(f"Could not get purchasing power: {e}")
            
            return {
                'success': True,
                'funds': fund_list,
                'purchasing_power': purchasing_power,
                'account_approved': account_approved,
                'has_trading_account': has_trading_account,
                'eligible': eligible,
            }
            
        except Exception as e:
            _logger.error(f"Error getting market info: {e}", exc_info=True)
            return {'success': False, 'message': str(e)}
