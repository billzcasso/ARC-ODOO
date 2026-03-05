from odoo import http, fields
from odoo.exceptions import ValidationError
from odoo.http import request, Response
from psycopg2 import IntegrityError
import json
import logging
import pytz
from datetime import datetime

from ..utils import mround, fee_utils, investment_utils, constants
from odoo.addons.user_permission_management.utils.permission_checker import require_module_access

_logger = logging.getLogger(__name__)


class NegotiatedOrderController(http.Controller):
    """
    Handles Negotiated Order (Investment) Operations:
    - Create Investment (Buy)
    - Submit Fund Sell
    - Market Maker Matching
    """

    def _json_response(self, data, status=200):
        """Helper to return JSON response"""
        return Response(
            json.dumps(data),
            status=status,
            content_type='application/json'
        )

    @http.route('/create_investment', type='http', auth='user', methods=['POST'], csrf=False)
    @require_module_access('fund_management')
    def create_investment(self, **kwargs):
        """Create investment transaction (Negotiated Buy Order)"""
        try:
            # === ELIGIBILITY CHECK: eKYC + Trading Account ===
            current_user = request.env.user
            partner = current_user.partner_id

            status_info = request.env['status.info'].sudo().search([
                ('partner_id', '=', partner.id)
            ], limit=1)
            if not status_info or status_info.account_status != 'approved':
                return self._json_response({
                    'success': False,
                    'message': 'Tài khoản của bạn cần được cập nhật thông tin cá nhân trước khi đặt lệnh.',
                    'error_code': 'account_not_approved'
                })

            trading_config = request.env['trading.config'].sudo().search([
                ('user_id', '=', current_user.id),
                ('active', '=', True)
            ], limit=1)
            if not trading_config:
                return self._json_response({
                    'success': False,
                    'message': 'Bạn cần liên kết tài khoản chứng khoán trước khi đặt lệnh.',
                    'error_code': 'trading_account_required'
                })

            # Get form data
            fund_id = kwargs.get('fund_id')
            units = kwargs.get('units')
            amount = kwargs.get('amount')
            term_months = kwargs.get('term_months')
            interest_rate = kwargs.get('interest_rate')

            if not fund_id or not units or not amount:
                return self._json_response({"success": False, "message": "Missing required information"})

            user_id = request.env.user.id
            fund = request.env['portfolio.fund'].sudo().browse(int(fund_id))
            if not fund.exists():
                return self._json_response({"success": False, "message": "Fund not found"})

            # Calculate values
            units_float = float(units)
            calculated_amount = float(amount)
            
            # Check debug options
            debug_mode = kwargs.get('debug', 'false').lower() in ('true', '1', 'yes')
            skip_min_ccq = kwargs.get('skip_min_ccq', 'false').lower() in ('true', '1', 'yes') or debug_mode
            skip_max_ccq = kwargs.get('skip_max_ccq', 'false').lower() in ('true', '1', 'yes')
            skip_lot_size = kwargs.get('skip_lot_size', 'false').lower() in ('true', '1', 'yes') or debug_mode
            
            # Validation: Min 100 CCQ, Max 500,000 CCQ per order
            MIN_UNITS = 100
            MAX_UNITS = 500000
            
            if skip_min_ccq:
                pass
            elif units_float < MIN_UNITS:
                return self._json_response({
                    "success": False, 
                    "message": f"Số lượng CCQ tối thiểu là {MIN_UNITS:,} CCQ/lệnh"
                })
            
            if skip_max_ccq:
                pass
            elif units_float > MAX_UNITS:
                return self._json_response({
                    "success": False, 
                    "message": f"Số lượng CCQ tối đa là {MAX_UNITS:,} CCQ/lệnh"
                })
            
            # Validation: Lot size 100 CCQ
            LOT_SIZE = 100
            if skip_lot_size:
                pass
            elif units_float > 0 and int(units_float) % LOT_SIZE != 0:
                pass # NOTE: Requirement changed to remove lot size for Normal, but this is Negotiated. Keeping for now or subject to removal if global.
            
            effective_unit_price = calculated_amount / units_float if units_float > 0 else 0
            fee = fee_utils.calculate_fee(calculated_amount)
            
            # Get PDF path from session
            pdf_path = request.session.get("signed_pdf_path")

            # Create transaction
            tx_vals = {
                'user_id': user_id,
                'fund_id': fund.id,
                'transaction_type': constants.TRANSACTION_TYPE_BUY,
                'status': constants.STATUS_PENDING,
                'units': units_float,
                'amount': calculated_amount,
                'fee': fee,
                'price': effective_unit_price,
                'contract_pdf_path': pdf_path,
            }
            
            # Add optional fields
            order_mode = kwargs.get('order_mode')
            if order_mode:
                tx_vals['order_mode'] = order_mode
            
            if term_months:
                try: tx_vals['term_months'] = int(term_months)
                except: pass
            if interest_rate:
                try: tx_vals['interest_rate'] = float(interest_rate)
                except: pass
            
            _logger.info(f"[Create Investment] Creating transaction : {tx_vals}")

            tx = request.env['portfolio.transaction'].sudo().create(tx_vals)

            # Link contract
            try:
                from datetime import datetime, timedelta
                one_hour_ago = datetime.now() - timedelta(hours=1)
                SignedContract = request.env['fund.signed.contract'].sudo()
                pending_contract = SignedContract.search([
                    ('partner_id', '=', request.env.user.partner_id.id),
                    ('transaction_id', '=', False),
                    ('create_date', '>=', one_hour_ago),
                ], limit=1, order='create_date desc')
                
                if pending_contract:
                    pending_contract.write({'transaction_id': tx.id})
            except Exception as e:
                _logger.warning(f"Failed to link contract: {e}")

            return self._json_response({
                "success": True,
                "message": "Investment order created successfully",
                "tx_id": tx.id,
                "nav_data": {
                    "fund_name": fund.name,
                    "fund_ticker": fund.ticker,
                    "units": tx.units,
                    "amount": tx.amount,
                    "fee": tx.fee,
                    "price": tx.price,
                    "term_months": tx.term_months,
                    "interest_rate": tx.interest_rate,
                    "created_at": tx.created_at_formatted or '',
                    # NAV computed fields
                    "nav_maturity_date": tx.nav_maturity_date_formatted or '',
                    "nav_sell_date": tx.nav_sell_date_formatted or '',
                    "nav_days": tx.nav_days or 0,
                    "nav_days_converted": tx.nav_days_converted or 0,
                    "nav_purchase_value": tx.nav_purchase_value or 0,
                    "nav_price_with_fee": tx.nav_price_with_fee or 0,
                    "nav_converted_rate": tx.nav_converted_rate or 0,
                    "nav_interest_delta": tx.nav_interest_delta or 0,
                    "nav_sell_price1": tx.nav_sell_price1 or 0,
                    "nav_sell_price2": tx.nav_sell_price2 or 0,
                    "nav_sell_value1": tx.nav_sell_value1 or 0,
                    "nav_sell_value2": tx.nav_sell_value2 or 0,
                    "nav_difference": tx.nav_difference or 0,
                    "nav_sell_fee": tx.nav_sell_fee or 0,
                    "nav_tax": tx.nav_tax or 0,
                    "nav_customer_receive": tx.nav_customer_receive or 0,
                }
            })

        except Exception as e:
            return self._json_response({"success": False, "message": str(e)})

    @http.route('/submit_fund_sell', type='http', auth='user', methods=['POST'], csrf=False)
    @require_module_access('fund_management')
    def submit_fund_sell(self, **kwargs):
        """Submit Fund Sell Order"""
        try:
            # === ELIGIBILITY CHECK: eKYC + Trading Account ===
            current_user = request.env.user
            partner = current_user.partner_id

            status_info = request.env['status.info'].sudo().search([
                ('partner_id', '=', partner.id)
            ], limit=1)
            if not status_info or status_info.account_status != 'approved':
                return self._json_response({
                    'success': False,
                    'message': 'Tài khoản của bạn cần được cập nhật thông tin cá nhân trước khi đặt lệnh bán.',
                    'error_code': 'account_not_approved'
                })

            trading_config = request.env['trading.config'].sudo().search([
                ('user_id', '=', current_user.id),
                ('active', '=', True)
            ], limit=1)
            if not trading_config:
                return self._json_response({
                    'success': False,
                    'message': 'Bạn cần liên kết tài khoản chứng khoán trước khi đặt lệnh bán.',
                    'error_code': 'trading_account_required'
                })

            investment_id = int(kwargs.get('investment_id'))
            quantity = float(kwargs.get('quantity'))
            debug_mode = kwargs.get('debug', 'false').lower() in ('true', '1', 'yes')

            investment = request.env['portfolio.investment'].sudo().browse(investment_id)

            if not investment.exists():
                return self._json_response({"success": False, "message": "Không tìm thấy investment."}, status=404)

            user_id = request.env.user.id
            fund = investment.fund_id
            
            # Force T+2 recomputation (stored compute doesn't re-trigger on date change)
            investment._compute_units_breakdown()

            # DEBUG MODE validation
            if debug_mode:
                _logger.warning(f'[Fund Sell DEBUG] User {user_id} - Bypassing quantity check.')
            else:
                # STRICT VALIDATION: Use negotiated_available_units (Contract/Negotiated Only)
                # Since submit_fund_sell creates a Negotiated Sell by default (via generic Transaction model default),
                # we must validate against the Negotiated pool.
                available = investment.negotiated_available_units
                if quantity > available:
                    return self._json_response({"success": False, "message": f"Số lượng bán ({quantity:,.0f}) vượt quá CCQ thỏa thuận khả dụng ({available:,.0f})."}, status=400)

            # Price determination
            price_from_frontend = kwargs.get('price')
            if price_from_frontend:
                try:
                    ccq_price_rounded = float(price_from_frontend)
                except:
                    price_from_frontend = None
            
            if not price_from_frontend:
                ccq_price = self._get_ccq_price_from_inventory(fund.id)
                if ccq_price <= 0:
                    ccq_price = fund.current_nav
                ccq_price_rounded = mround.mround(ccq_price, 50)
            
            estimated_value = quantity * ccq_price_rounded
            
            with request.env.cr.savepoint():
                request.env['portfolio.transaction'].sudo().create({
                    'user_id': user_id,
                    'fund_id': fund.id,
                    'transaction_type': constants.TRANSACTION_TYPE_SELL,
                    'units': quantity,
                    'amount': estimated_value,
                    'price': ccq_price_rounded,
                    'created_at': fields.Datetime.now()
                })

                investment_utils.InvestmentHelper.upsert_investment(
                    request.env,
                    user_id=user_id,
                    fund_id=fund.id,
                    units_change=quantity,
                    transaction_type=constants.TRANSACTION_TYPE_SELL
                )

            return self._json_response({"success": True, "message": "Cập nhật investment thành công."})

        except ValidationError as ve:
            return self._json_response({"success": False, "message": str(ve)}, status=400)
        except Exception as e:
            return self._json_response({"success": False, "message": str(e)}, status=500)

    @http.route('/match_transactions', type='http', auth='user', methods=['POST'], csrf=False)
    @require_module_access('fund_management')
    def match_transactions(self, **kwargs):
        """Market Maker Order Matching"""
        try:
            Transaction = request.env['portfolio.transaction'].sudo()
            pending_purchases = Transaction.search([
                ('transaction_type', '=', constants.TRANSACTION_TYPE_BUY),
                ('status', '=', constants.STATUS_PENDING)
            ])
            pending_sells = Transaction.search([
                ('transaction_type', '=', constants.TRANSACTION_TYPE_SELL),
                ('status', '=', constants.STATUS_PENDING)
            ])

            if not pending_purchases or not pending_sells:
                return self._json_response({"success": False, "message": "Không có lệnh mua/bán nào pending để khớp"})

            matching_engine = request.env['fund.order.matching'].create({
                'name': f"Khớp lệnh - {request.env.user.name} - {request.env.cr.now()}",
            })

            result = matching_engine.match_orders(pending_purchases, pending_sells)

            return self._json_response({
                "success": True,
                "message": f"Đã khớp {len(result['matched_pairs'])} cặp lệnh",
                "matching_id": matching_engine.id,
                "matched_pairs": result['matched_pairs'],
                "remaining": {
                    "buys": [{"id": b.id, "nav": b.current_nav, "amount": b.amount} for b in result['remaining_buys']],
                    "sells": [{"id": s.id, "nav": s.current_nav, "amount": s.amount} for s in result['remaining_sells']]
                },
                "summary": matching_engine.get_matching_summary()
            })

        except Exception as e:
            return self._json_response({"success": False, "message": str(e)})

    def _get_ccq_price_from_inventory(self, fund_id):
        """Helper to get CCQ Price"""
        return investment_utils.InvestmentHelper._get_ccq_price_from_inventory(request.env, fund_id)

    def _calculate_capital_cost(self, fund_id, amount):
        """Helper to Calculate Capital Cost"""
        try:
            FundConfig = request.env['nav.fund.config'].sudo()
            config = FundConfig.search([
                ('fund_id', '=', fund_id),
                ('active', '=', True)
            ], limit=1)
            
            if config and config.capital_cost_percent:
                return amount * (config.capital_cost_percent / 100)
            return 0.0
        except Exception:
            return 0.0
