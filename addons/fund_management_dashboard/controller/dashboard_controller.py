# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
import json
import logging
from datetime import datetime, timedelta
from odoo import fields
from odoo.addons.user_permission_management.utils.permission_checker import require_module_access

_logger = logging.getLogger(__name__)


class FundManagementDashboardController(http.Controller):
    """Controller cho dashboard tổng quan quản lý quỹ"""

    @http.route('/fund-management-dashboard', type='http', auth='user', website=True)
    @require_module_access('fund_management_dashboard')
    def dashboard_page(self, **kwargs):
        """Render trang dashboard tổng quan"""
        try:
            # Lấy dữ liệu tổng quan
            dashboard_data = self._get_dashboard_data()
            
            # Lưu dữ liệu vào model fund.dashboard.daily
            try:
                request.env['fund.dashboard.daily'].sudo().update_today_dashboard(dashboard_data)
            except Exception as save_error:
                # Log lỗi nhưng không chặn hiển thị dashboard
                _logger.warning(f"Không thể lưu dữ liệu dashboard: {str(save_error)}")
            
            return request.render('fund_management_dashboard.dashboard_page', {
                'dashboard_data': json.dumps(dashboard_data)
            })
        except Exception as e:
            return request.render('web.http_error', {
                'error': str(e),
                'error_title': 'Lỗi',
                'error_message': 'Không thể tải trang dashboard'
            })

    @http.route('/api/fund-management-dashboard/data', type='json', auth='user')
    def get_dashboard_data(self, **kwargs):
        """API endpoint để lấy dữ liệu dashboard"""
        try:
            # Kiểm tra xem có muốn lấy từ database không
            use_cached = kwargs.get('use_cached', False)
            
            if use_cached:
                # Lấy từ database nếu có
                cached_data = request.env['fund.dashboard.daily'].sudo().get_today_data()
                if cached_data:
                    # Cập nhật lại dữ liệu real-time
                    real_data = self._get_dashboard_data()
                    # Lưu lại
                    request.env['fund.dashboard.daily'].sudo().update_today_dashboard(real_data)
                    return {
                        'success': True,
                        'data': real_data,
                        'message': 'Dữ liệu được tải thành công',
                        'cached': False
                    }
            
            # Lấy dữ liệu real-time
            data = self._get_dashboard_data()
            
            # Lưu vào database
            try:
                request.env['fund.dashboard.daily'].sudo().update_today_dashboard(data)
            except Exception as save_error:
                import logging
                _logger = logging.getLogger(__name__)
                _logger.warning(f"Không thể lưu dữ liệu dashboard: {str(save_error)}")
            
            return {
                'success': True,
                'data': data,
                'message': 'Dữ liệu được tải thành công',
                'cached': False
            }
        except Exception as e:
            return {
                'success': False,
                'data': {},
                'message': f'Lỗi: {str(e)}'
            }

    @http.route('/api/fund-management-dashboard/historical', type='json', auth='user')
    def get_historical_data(self, days=7, **kwargs):
        """API endpoint để lấy dữ liệu dashboard lịch sử"""
        try:
            days = int(kwargs.get('days', 7))
            days = max(1, min(days, 30))  # Giới hạn từ 1 đến 30 ngày
            
            historical_data = request.env['fund.dashboard.daily'].sudo().get_historical_data(days)
            
            return {
                'success': True,
                'data': historical_data,
                'message': f'Đã lấy {len(historical_data)} bản ghi lịch sử'
            }
        except Exception as e:
            _logger.error(f"Error getting historical data: {str(e)}")
            return {
                'success': False,
                'data': [],
                'message': f'Lỗi: {str(e)}'
            }

    @http.route('/api/fund-management-dashboard/today', type='json', auth='user')
    def get_today_data(self, **kwargs):
        """API endpoint để lấy dữ liệu dashboard hôm nay từ database"""
        try:
            today_data = request.env['fund.dashboard.daily'].sudo().get_today_data()
            
            if not today_data:
                # Nếu chưa có, lấy real-time và tạo mới
                dashboard_data = self._get_dashboard_data()
                request.env['fund.dashboard.daily'].sudo().update_today_dashboard(dashboard_data)
                today_data = request.env['fund.dashboard.daily'].sudo().get_today_data()
            
            return {
                'success': True,
                'data': today_data,
                'message': 'Dữ liệu được tải thành công'
            }
        except Exception as e:
            _logger.error(f"Error getting today data: {str(e)}")
            return {
                'success': False,
                'data': {},
                'message': f'Lỗi: {str(e)}'
            }

    def _get_dashboard_data(self):
        """Lấy tất cả dữ liệu cho dashboard - LẤY DỮ LIỆU TÍCH LŨY VÀ GẦN ĐÂY"""
        today = fields.Date.today()
        # Mở rộng khoảng thời gian mặc định để dashboard không bị trống vào đầu ngày mới
        # Sử dụng 30 ngày gần đây cho các thống kê biến động
        date_start = fields.Datetime.to_datetime(today - timedelta(days=30))
        date_end = fields.Datetime.to_datetime(today) + timedelta(days=1) - timedelta(seconds=1)
        
        _logger.info(f"Dashboard data filter broadened: start={date_start}, end={date_end}")
        
        return {
            'summary': self._get_summary_stats(date_start, date_end),
            'transactions': self._get_recent_transactions(limit=100),
            'accounts': self._get_accounts_stats(),
            'fund_movements': self._get_fund_movements_recent(date_start, date_end),
            'top_transactions': self._get_top_transactions_recent(date_start, date_end),
            'nav_opening_data': self._get_nav_latest_data(),
            'transaction_trend': self._get_transaction_trend_recent(days=7),
            'product_stats': self._get_product_status_stats(),
        }

    def _get_summary_stats(self, date_start, date_end):
        """Lấy thống kê tổng quan - LẤY TRONG KHOẢNG THỜI GIAN GẦN ĐÂY"""
        # Tổng số tài khoản (bao gồm cả chưa xác thực) - Tổng số không phụ thuộc ngày
        total_accounts = request.env['investor.list'].search_count([])
        
        # Tổng số tiền đầu tư (từ portfolio.investment) - Tổng tất cả investment active
        # Lưu ý: Đây là tổng đầu tư tổng thể, không filter theo ngày
        investments = request.env['portfolio.investment'].search([
            ('status', '=', 'active')
        ])
        total_investment = sum(investments.mapped('amount'))
        total_current_value = sum(investments.mapped('current_value'))
        
        # Giao dịch hôm nay - CHỈ LẤY GIAO DỊCH TẠO HÔM NAY
        today_transactions = request.env['portfolio.transaction'].search([
            ('create_date', '>=', date_start),
            ('create_date', '<=', date_end),
            ('parent_order_id', '=', False),  # Chỉ lấy lệnh gốc
            ('status', 'in', ['pending', 'completed'])
        ])
        
        today_pending = today_transactions.filtered(lambda t: t.status == 'pending')
        today_completed = today_transactions.filtered(lambda t: t.status == 'completed')
        
        # Tổng giá trị giao dịch hôm nay
        today_total_amount = sum(today_transactions.mapped('amount'))
        
        # Số lượng giao dịch mua/bán hôm nay
        today_buy = today_transactions.filtered(
            lambda t: t.transaction_type == 'buy'
        )
        today_sell = today_transactions.filtered(
            lambda t: t.transaction_type == 'sell'
        )
        
        return {
            'total_accounts': total_accounts,
            'total_investment': total_investment,
            'total_current_value': total_current_value,
            'total_profit_loss': total_current_value - total_investment,
            'total_profit_loss_percentage': (
                ((total_current_value - total_investment) / total_investment * 100)
                if total_investment > 0 else 0
            ),
            'today_transactions_count': len(today_transactions),
            'today_pending_count': len(today_pending),
            'today_completed_count': len(today_completed),
            'today_total_amount': today_total_amount,
            'today_buy_count': len(today_buy),
            'today_sell_count': len(today_sell),
            'today_buy_amount': sum(today_buy.mapped('amount')),
            'today_sell_amount': sum(today_sell.mapped('amount')),
        }

    def _get_recent_transactions(self, limit=50):
        """Lấy danh sách giao dịch gần đây nhất"""
        transactions = request.env['portfolio.transaction'].search([
            ('parent_order_id', '=', False)  # Chỉ lấy lệnh gốc
        ], order='create_date desc', limit=limit)
        
        result = []
        for tx in transactions:
            result.append({
                'id': tx.id,
                'name': tx.name or '',
                'investor_name': getattr(tx, 'investor_name', '') or '',
                'account_number': getattr(tx, 'account_number', '') or '',
                'fund_name': tx.fund_id.name if tx.fund_id else '',
                'fund_ticker': tx.fund_id.ticker if tx.fund_id else '',
                'transaction_type': tx.transaction_type,
                'units': tx.units,
                'price': getattr(tx, 'price', 0) or (tx.current_nav or 0),
                'amount': tx.amount,
                'status': tx.status,
                'source': getattr(tx, 'source', '') or '',
                'created_at': tx.create_date.strftime('%Y-%m-%d %H:%M:%S') if tx.create_date else '',
                'matched_units': getattr(tx, 'matched_units', 0) or 0,
                'remaining_units': getattr(tx, 'remaining_units', 0) or 0,
            })
        
        return result

    def _get_accounts_stats(self):
        """Lấy thống kê tài khoản"""
        accounts = request.env['investor.list'].search([])
        
        status_counts = {
            'pending': 0,
            'kyc': 0,
            'vsd': 0,
            'incomplete': 0,
        }
        
        for account in accounts:
            status = account.status or 'incomplete'
            if status in status_counts:
                status_counts[status] += 1
        
        return {
            'total': len(accounts),
            'by_status': status_counts,
        }

    def _get_fund_movements_recent(self, date_start, date_end):
        """Lấy biến động mua/bán của từng CCQ trong khoảng thời gian gần đây"""
        # Lấy tất cả giao dịch trong khoảng thời gian
        transactions = request.env['portfolio.transaction'].search([
            ('create_date', '>=', date_start),
            ('create_date', '<=', date_end),
            ('parent_order_id', '=', False)  # Chỉ lấy lệnh gốc
        ])
        
        # Nhóm theo fund_id
        fund_movements = {}
        
        for tx in transactions:
            if not tx.fund_id:
                continue
            
            fund_id = tx.fund_id.id
            fund_ticker = tx.fund_id.ticker or ''
            fund_name = tx.fund_id.name or ''
            
            if fund_id not in fund_movements:
                fund_movements[fund_id] = {
                    'fund_id': fund_id,
                    'fund_ticker': fund_ticker,
                    'fund_name': fund_name,
                    'buy_count': 0,
                    'sell_count': 0,
                    'buy_units': 0.0,
                    'sell_units': 0.0,
                    'buy_amount': 0.0,
                    'sell_amount': 0.0,
                    'net_units': 0.0,
                    'net_amount': 0.0,
                }
            
            movement = fund_movements[fund_id]
            
            if tx.transaction_type == 'buy':
                movement['buy_count'] += 1
                movement['buy_units'] += tx.units or 0.0
                movement['buy_amount'] += tx.amount or 0.0
            elif tx.transaction_type == 'sell':
                movement['sell_count'] += 1
                movement['sell_units'] += tx.units or 0.0
                movement['sell_amount'] += tx.amount or 0.0
            
            # Tính net
            movement['net_units'] = movement['buy_units'] - movement['sell_units']
            movement['net_amount'] = movement['buy_amount'] - movement['sell_amount']
        
        # Chuyển thành list và sắp xếp theo net_amount giảm dần
        result = list(fund_movements.values())
        result.sort(key=lambda x: abs(x['net_amount']), reverse=True)
        
        return result

    def _get_product_status_stats(self):
        """Thống kê trạng thái sản phẩm/quỹ đang theo dõi"""
        try:
            Fund = request.env['portfolio.fund'].sudo()
            active_count = Fund.search_count([('status', '=', 'active')])
            pending_count = Fund.search_count([('status', '!=', 'active')])
            return {
                'active': active_count,
                'pending': pending_count,
                'total': active_count + pending_count,
            }
        except Exception as e:
            _logger.error(f"Error getting product status stats: {str(e)}")
            return {
                'active': 0,
                'pending': 0,
                'total': 0,
            }

    def _get_top_transactions_recent(self, date_start, date_end, limit=10):
        """Lấy top giao dịch lớn nhất trong khoảng thời gian gần đây"""
        transactions = request.env['portfolio.transaction'].search([
            ('create_date', '>=', date_start),
            ('create_date', '<=', date_end),
            ('parent_order_id', '=', False)  # Chỉ lấy lệnh gốc
        ], order='amount desc', limit=limit)
        
        result = []
        for tx in transactions:
            result.append({
                'id': tx.id,
                'name': tx.name or '',
                'investor_name': getattr(tx, 'investor_name', '') or '',
                'fund_name': tx.fund_id.name if tx.fund_id else '',
                'fund_ticker': tx.fund_id.ticker if tx.fund_id else '',
                'transaction_type': tx.transaction_type,
                'units': tx.units,
                'amount': tx.amount,
                'status': tx.status,
                'created_at': tx.create_date.strftime('%Y-%m-%d %H:%M:%S') if tx.create_date else '',
            })
        
        return result

    def _get_nav_latest_data(self):
        """Lấy dữ liệu NAV mới nhất (tổng CCQ và giá CCQ từng quỹ)"""
        try:
            # Lấy ngày có dữ liệu gần nhất
            latest_inv = request.env['nav.daily.inventory'].search([], order='inventory_date desc', limit=1)
            if not latest_inv:
                return {'total_opening_ccq': 0.0, 'funds': []}
            
            target_date = latest_inv.inventory_date
            
            # Lấy tất cả inventory của ngày đó
            inventories = request.env['nav.daily.inventory'].search([
                ('inventory_date', '=', target_date)
            ])
            
            total_opening_ccq = 0.0
            fund_nav_data = []
            
            for inv in inventories:
                if inv.fund_id:
                    opening_ccq = float(inv.opening_ccq or 0.0)
                    opening_price = float(inv.opening_avg_price or 0.0)
                    total_opening_ccq += opening_ccq
                    
                    opening_value = opening_ccq * opening_price
                    
                    # Debug log để kiểm tra giá trị
                    _logger.info(f"Fund {inv.fund_id.ticker}: CCQ={opening_ccq}, Price={opening_price}, Value={opening_value}")
                    
                    fund_nav_data.append({
                        'fund_id': inv.fund_id.id,
                        'fund_name': inv.fund_id.name or '',
                        'fund_ticker': inv.fund_id.ticker or '',
                        'opening_ccq': opening_ccq,
                        'opening_price': opening_price,
                        'opening_value': opening_value,
                    })
            
            # Sắp xếp theo giá giảm dần
            fund_nav_data.sort(key=lambda x: x['opening_price'], reverse=True)
            
            return {
                'total_opening_ccq': total_opening_ccq,
                'funds': fund_nav_data,
            }
        except Exception as e:
            _logger.error(f"Error getting NAV opening data: {str(e)}")
            return {
                'total_opening_ccq': 0.0,
                'funds': [],
            }

    def _get_transaction_trend_recent(self, days=7):
        """Lấy thống kê số lệnh mua/bán theo ngày trong khoảng thời gian gần đây"""
        try:
            today = fields.Date.today()
            date_start = fields.Datetime.to_datetime(today - timedelta(days=days))
            
            transactions = request.env['portfolio.transaction'].search([
                ('create_date', '>=', date_start),
                ('parent_order_id', '=', False)  # Chỉ lấy lệnh gốc
            ], order='create_date asc')
            
            # Khởi tạo dữ liệu theo ngày
            day_stats = {}
            for i in range(days + 1):
                d = today - timedelta(days=days-i)
                day_stats[d] = {
                    'buy_count': 0,
                    'sell_count': 0,
                    'buy_amount': 0.0,
                    'sell_amount': 0.0
                }
            
            for tx in transactions:
                if not tx.create_date:
                    continue
                
                tx_date = tx.create_date.date()
                if tx_date in day_stats:
                    tx_type = tx.transaction_type or ''
                    if tx_type == 'buy':
                        day_stats[tx_date]['buy_count'] += 1
                        day_stats[tx_date]['buy_amount'] += (tx.amount or 0.0)
                    elif tx_type == 'sell':
                        day_stats[tx_date]['sell_count'] += 1
                        day_stats[tx_date]['sell_amount'] += (tx.amount or 0.0)
            
            # Tạo mảng dữ liệu
            result = {
                'labels': [],
                'buy_data': [],
                'sell_data': [],
                'buy_amounts': [],
                'sell_amounts': []
            }
            
            for d in sorted(day_stats.keys()):
                result['labels'].append(d.strftime('%d/%m'))
                result['buy_data'].append(day_stats[d]['buy_count'])
                result['sell_data'].append(day_stats[d]['sell_count'])
                result['buy_amounts'].append(day_stats[d]['buy_amount'])
                result['sell_amounts'].append(day_stats[d]['sell_amount'])
            
            return result
        except Exception as e:
            _logger.error(f"Error getting transaction trend: {str(e)}")
            # Return empty data - không có giờ cố định
            return {
                'labels': [],
                'buy_data': [],
                'sell_data': [],
                'buy_amounts': [],
                'sell_amounts': []
            }

