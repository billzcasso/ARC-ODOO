from odoo import http
from odoo.http import request, Response
import json
import logging
import pytz
from datetime import datetime
from ..utils import mround, fee_utils, investment_utils, constants
from ..utils.timezone_utils import format_date_user_tz
from odoo.addons.user_permission_management.utils.permission_checker import require_module_access

_logger = logging.getLogger(__name__)


class TransactionController(http.Controller):
    """
    Handles Generic Transaction Operations:
    - Cancel Orders
    - List User Investments
    - List User Contracts
    - Check Profitability
    """

    def _json_response(self, data, status=200):
        return Response(
            json.dumps(data, ensure_ascii=False),
            status=status,
            content_type='application/json'
        )

    @http.route('/cancel_transaction', type='http', auth='user', methods=['POST'], csrf=False)
    @require_module_access('fund_management')
    def cancel_transaction(self, **kwargs):
        """Cancel a pending transaction"""
        try:
            # GUARDRAIL: Block Cancel/Update during ATC (14:30 - 14:45)
            # STRICT: No mock data, usage of real server time
            tz = pytz.timezone('Asia/Ho_Chi_Minh')
            now = datetime.now(tz)
            current_time = now.time()
            t_14_30 = datetime.strptime("14:30:00", "%H:%M:%S").time()
            t_14_45 = datetime.strptime("14:45:00", "%H:%M:%S").time()
            
            if t_14_30 <= current_time < t_14_45:
                return self._json_response({
                    "success": False, 
                    "message": "Không thể hủy lệnh trong phiên ATC (14:30 - 14:45)"
                }, status=403)

            transaction_id = kwargs.get('transaction_id')
            if not transaction_id:
                return self._json_response({"success": False, "message": "Thiếu ID giao dịch"})

            tx = request.env['portfolio.transaction'].sudo().browse(int(transaction_id))
            if not tx.exists():
                return self._json_response({"success": False, "message": "Không tìm thấy giao dịch"})

            if tx.user_id.id != request.env.user.id:
                return self._json_response({"success": False, "message": "Bạn không có quyền hủy giao dịch này"})

            if tx.status != constants.STATUS_PENDING:
                status_display = {
                    constants.STATUS_COMPLETED: 'Đã hoàn thành',
                    constants.STATUS_CANCELLED: 'Đã huỷ',
                    constants.STATUS_MATCHED: 'Đã khớp lệnh',
                }.get(tx.status, tx.status)
                return self._json_response({
                    "success": False, 
                    "message": f"Không thể huỷ lệnh đã {status_display}. Chỉ có thể huỷ lệnh đang chờ xử lý."
                })

            tx_id = tx.id
            tx.unlink()

            return self._json_response({
                "success": True,
                "message": "Đã xoá lệnh khỏi hệ thống thành công",
                "transaction_id": tx_id
            })

        except Exception as e:
            _logger.error(f"Error cancelling transaction: {e}")
            return self._json_response({"success": False, "message": str(e)})

    @http.route('/api/contract/get', type='http', auth='user', methods=['GET'], csrf=False)
    @require_module_access('fund_management')
    def get_contract_by_transaction(self, **kwargs):
        """Get signed contract by transaction_id"""
        try:
            transaction_id = kwargs.get('transaction_id')
            if not transaction_id:
                return self._json_response({"success": False, "message": "Thiếu transaction_id"})
            
            transaction_id = int(transaction_id)
            SignedContract = request.env['fund.signed.contract'].sudo()
            contract = SignedContract.search([
                ('transaction_id', '=', transaction_id)
            ], limit=1, order='create_date desc')
            
            if not contract:
                return self._json_response({"success": False, "message": "Không tìm thấy hợp đồng"})
            
            tx = request.env['portfolio.transaction'].sudo().browse(transaction_id)
            if tx.user_id.id != request.env.user.id:
                return self._json_response({"success": False, "message": "Bạn không có quyền xem hợp đồng này"})
            
            return self._json_response({
                "success": True,
                "contract": {
                    "id": contract.id,
                    "name": contract.name,
                    "filename": contract.filename,
                    "signed_type": contract.signed_type,
                    "signed_on": contract.signed_on.isoformat() if contract.signed_on else None,
                    "view_url": f"/web/content/{contract.id}?model=fund.signed.contract&field=file_data&filename_field=filename&download=false",
                    "download_url": f"/web/content/{contract.id}?model=fund.signed.contract&field=file_data&filename_field=filename&download=true"
                }
            })
        except Exception as e:
            _logger.error(f"Error getting contract: {e}")
            return self._json_response({"success": False, "message": "Lỗi khi lấy hợp đồng"})

    @http.route('/data_investment', type='http', auth='user', cors='*')
    @require_module_access('fund_management')
    def get_user_investments(self):
        """Get user investments"""
        try:
            user_id = request.env.user.id
            investments = request.env['portfolio.investment'].sudo().search([
                ('user_id', '=', user_id)
            ])

            result = [
                {
                    "id": inv.id,
                    "fund_id": inv.fund_id.id,
                    "fund_name": inv.fund_id.name,
                    "fund_ticker": inv.fund_id.ticker,
                    "units": inv.units,
                    "amount": inv.amount,
                    "current_nav": inv.fund_id.current_nav,
                    "investment_type": inv.fund_id.investment_type,
                }
                for inv in investments
            ]
            return self._json_response(result)
        except Exception as e:
            return self._json_response({"success": False, "error": str(e)})

    @http.route('/data_contracts', type='http', auth='user', cors='*')
    @require_module_access('fund_management')
    def get_user_contracts(self):
        """Get user contracts (buy transactions) for selling"""
        try:
            user_id = request.env.user.id
            transactions = request.env['portfolio.transaction'].sudo().search([
                ('user_id', '=', user_id),
                ('transaction_type', '=', constants.TRANSACTION_TYPE_BUY),
                ('status', '=', constants.STATUS_COMPLETED),
                ('order_mode', '=', constants.ORDER_MODE_NEGOTIATED),
            ], order='created_at desc')

            result = []
            for tx in transactions:
                investment = request.env['portfolio.investment'].sudo().search([
                    ('user_id', '=', user_id),
                    ('fund_id', '=', tx.fund_id.id),
                ], limit=1)
                
                # Force T+2 recomputation (stored compute doesn't re-trigger on date change)
                if investment:
                    investment._compute_units_breakdown()
                
                remaining_units = investment.units if investment else 0
                if remaining_units <= 0:
                    continue
                
                maturity_sell_price = tx.nav_sell_price2 or 0
                if maturity_sell_price <= 0:
                    ccq_price = investment_utils.InvestmentHelper._get_ccq_price_from_inventory(request.env, tx.fund_id.id)
                    if ccq_price <= 0:
                        ccq_price = tx.fund_id.current_nav or 0
                    maturity_sell_price = mround.mround(ccq_price, 50)
                
                maturity_date_str = tx.nav_maturity_date.strftime('%d/%m/%Y') if tx.nav_maturity_date else ''
                
                # Use centralized logic from Investment model to get Negotiated Available
                # (already recomputed above with _compute_units_breakdown)
                negotiated_available_total = investment.negotiated_available_units
                
                # Available for THIS Contract = min(Contract Size, Total Negotiated Available)
                # This ensures we don't sell more than the contract size, AND supports the global negotiated limit.
                contract_available = min(tx.units, negotiated_available_total)
                
                result.append({
                    "id": tx.id,
                    "investment_id": investment.id if investment else None,
                    "contract_name": tx.name or f"HĐ #{tx.id}",
                    "fund_id": tx.fund_id.id,
                    "fund_name": tx.fund_id.name,
                    "fund_ticker": tx.fund_id.ticker,
                    "units": tx.units, # CORRECTED: Show Contract Size as "Owned" for this record
                    "available_units": contract_available, # Contract Specific Available
                    "original_units": tx.units,
                    "amount": tx.amount,
                    "current_nav": tx.fund_id.current_nav,
                    "maturity_sell_price": maturity_sell_price,
                    "interest_rate": tx.interest_rate or 0,
                    "term_months": tx.term_months or 0,
                    "maturity_date": maturity_date_str,
                    "nav_sell_date": tx.nav_sell_date.strftime('%d/%m/%Y') if tx.nav_sell_date else '',
                    "created_at": format_date_user_tz(request.env, tx.created_at, '%d/%m/%Y') if tx.created_at else '',
                    "investment_type": tx.fund_id.investment_type,
                })

            return self._json_response(result)
        except Exception as e:
            _logger.error(f"Error getting contracts: {e}")
            return self._json_response({"success": False, "error": str(e)})

    @http.route('/api/check_profitability', type='json', auth='user', methods=['POST'])
    @require_module_access('fund_management')
    def check_profitability(self, **kwargs):
        """API endpoint to check profitability"""
        try:
            fund_id = kwargs.get('fund_id')
            amount = float(kwargs.get('amount', 0))
            units = float(kwargs.get('units', 0))
            interest_rate = float(kwargs.get('interest_rate', 0))
            term_months = int(kwargs.get('term_months', 0))
            
            if not fund_id or amount <= 0 or units <= 0:
                return {'success': False, 'message': 'Thiếu thông tin cần thiết'}
            
            fund = request.env['portfolio.fund'].sudo().browse(int(fund_id))
            if not fund.exists():
                return {'success': False, 'message': 'Fund không tồn tại'}
            
            nav_value = float(fund.current_nav or 0.0)
            if nav_value <= 0:
                return {'success': False, 'message': 'Không có NAV hiện tại'}
            
            days = max(1, int(term_months * 30))
            sell_value = amount * (interest_rate / 100.0) / 365.0 * days + amount
            price1 = round(sell_value / units) if units > 0 else 0
            price2 = round(price1 / 50) * 50 if price1 > 0 else 0
            r_new = ((price2 / nav_value - 1) * 365 / days * 100) if nav_value > 0 and days > 0 and price2 > 0 else 0
            delta = r_new - interest_rate
            
            cap_config = request.env['nav.cap.config'].sudo().search([('active', '=', True)], limit=1)
            cap_upper = float(cap_config.cap_upper or 2.0) if cap_config else 2.0
            cap_lower = float(cap_config.cap_lower or 0.1) if cap_config else 0.1
            
            return {
                'success': True,
                'data': {
                    'sell_value': sell_value,
                    'price1': price1,
                    'price2': price2,
                    'interest_rate_new': r_new,
                    'interest_delta': delta,
                    'days_effective': days,
                    'is_profitable': cap_lower <= delta <= cap_upper,
                    'cap_upper': cap_upper,
                    'cap_lower': cap_lower
                }
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}

    @http.route('/api/transaction/detail', type='http', auth='user', methods=['GET'], csrf=False)
    @require_module_access('fund_management')
    def get_transaction_detail(self, **kwargs):
        """Get full transaction detail by ID for Result Page"""
        try:
            transaction_id = kwargs.get('transaction_id')
            if not transaction_id:
                return self._json_response({"success": False, "message": "Thiếu transaction_id"})
            
            tx = request.env['portfolio.transaction'].sudo().browse(int(transaction_id))
            if not tx.exists():
                return self._json_response({"success": False, "message": "Không tìm thấy giao dịch"})
            
            if tx.user_id.id != request.env.user.id:
                return self._json_response({"success": False, "message": "Bạn không có quyền xem lệnh này"})
            
            # Basic Data
            data = {
                "id": tx.id,
                "name": tx.name,
                "fund_name": tx.fund_id.name,
                "fund_ticker": tx.fund_id.ticker,
                "transaction_type": tx.transaction_type,
                "order_mode": tx.order_mode,
                "status": tx.status,
                "created_at": tx.created_at_formatted or '',
                "units": tx.units,
                "amount": tx.amount,
                "fee": tx.fee,
                "price": tx.price,
                
                # Normal Order Fields
                "order_type_detail": tx.order_type_detail,
                "market": tx.market,
                
                # Negotiated Order Fields
                "term_months": tx.term_months,
                "interest_rate": tx.interest_rate,
                
                # NAV Calculations (fields from Form View)
                "nav_days": tx.nav_days,
                "nav_purchase_value": tx.nav_purchase_value,
                "nav_maturity_date": tx.nav_maturity_date_formatted or '',
                "nav_sell_date": tx.nav_sell_date_formatted or '',
                "nav_sell_value1": tx.nav_sell_value1 or 0, # Giá trị sau đáo hạn
            }
            
            return self._json_response({"success": True, "data": data})
            
        except Exception as e:
            _logger.error(f"Error getting transaction detail: {e}")
            return self._json_response({"success": False, "message": str(e)})
