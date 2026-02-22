from odoo import models, fields, api, exceptions
from datetime import datetime
import json
import logging

_logger = logging.getLogger(__name__)

class SSIDataFetcher(models.TransientModel):
    _name = 'ssi.data.fetcher'
    _description = 'SSI Data Fetcher Logic'
    
    # Fields cho chức năng lấy dữ liệu nến
    ticker_id = fields.Many2one('stock.ticker', string='Mã Chứng Khoán')
    from_date = fields.Date(string='Từ ngày', default=lambda self: fields.Date.context_today(self).replace(year=fields.Date.context_today(self).year - 1))
    to_date = fields.Date(string='Đến ngày', default=fields.Date.context_today)
    
    def action_fetch_ohlcv(self):
        if not self.ticker_id or not self.from_date or not self.to_date:
            raise exceptions.UserError('Vui lòng nhập đầy đủ Mã CK, Từ ngày và Đến ngày!')
            
        from_str = self.from_date.strftime('%d/%m/%Y')
        to_str = self.to_date.strftime('%d/%m/%Y')
        
        count = self.fetch_daily_ohlcv(self.ticker_id.name, from_str, to_str)
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Hoàn tất Đồng bộ',
                'message': f'Đã cập nhật {count} cây nến giá cho mã {self.ticker_id.name}.',
                'sticky': False,
                'type': 'success',
            }
        }

    
    def _get_ssi_client(self):
        """Helper để khởi tạo ssi-fc-data client với thông tin cấu hình"""
        try:
            from ssi_fc_data import fc_md_client
        except ImportError:
            raise exceptions.UserError('Thư viện ssi_fc_data chưa được cài đặt. Vui lòng chạy pip install ssi-fc-data')
            
        consumer_id = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_id')
        consumer_secret = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_secret')
        api_url = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_api_url', 'https://fc-data.ssi.com.vn/')
        
        if not consumer_id or not consumer_secret:
            raise exceptions.UserError('Chưa cấu hình SSI Consumer ID hoặc Secret trong phần Cài đặt!')
            
        class Config:
            pass
        config = Config()
        config.consumerID = consumer_id
        config.consumerSecret = consumer_secret
        config.url = api_url
        config.stream_url = api_url
        
        return fc_md_client.MarketDataClient(config), config
        
    def fetch_tickers(self, market=None, page=1, size=1000):
        """Lấy danh sách mã chứng khoán từ sàn và lưu vào stock.ticker"""
        market = market or self.env.context.get('default_market', 'HNX')
        client, config = self._get_ssi_client()
        from ssi_fc_data import model
        req = model.securities(market, page, size)
        res = client.securities(config, req)
        
        try:
            data = res if isinstance(res, dict) else json.loads(res)
            # SSI status can be 200 (int), "200" (string), or message="Success" depending on endpoint
            if str(data.get('status')) == '200' or data.get('message', '').lower() == 'success':
                tickers = data.get('data', [])
                count = 0
                for t in tickers:
                    symbol = t.get('Symbol')
                    if symbol:
                        existing = self.env['stock.ticker'].search([('name', '=', symbol)], limit=1)
                        if not existing:
                            self.env['stock.ticker'].create({
                                'name': symbol,
                                'market': market,
                                'company_name': t.get('StockName', ''),
                            })
                            count += 1
                return f"Đã thêm mới {count} mã chứng khoán trên sàn {market}"
            else:
                raise exceptions.UserError(f"API Error: {data.get('message')}")
        except json.JSONDecodeError:
            raise exceptions.UserError("Không thể parse dữ liệu trả về từ SSI")
            
    def fetch_daily_ohlcv(self, ticker_symbol, from_date_str, to_date_str):
        """Lấy dữ liệu OHLCV hàng ngày"""
        client, config = self._get_ssi_client()
        from ssi_fc_data import model
        
        ticker = self.env['stock.ticker'].search([('name', '=', ticker_symbol)], limit=1)
        if not ticker:
            raise exceptions.UserError(f'Mã chứng khoán {ticker_symbol} chưa có trong hệ thống.')
            
        # SSI API format is DD/MM/YYYY
        req = model.daily_ohlc(ticker_symbol, from_date_str, to_date_str, 1, 1000, True)
        res = client.daily_ohlc(config, req)
        
        try:
            data = res if isinstance(res, dict) else json.loads(res)
            if str(data.get('status')) == '200' or data.get('message', '').lower() == 'success':
                candles = data.get('data', [])
                count = 0
                for c in candles:
                    # Parse trading date string from 'DD/MM/YYYY' to Odoo Date
                    trading_date_str = c.get('TradingDate')
                    if trading_date_str:
                        trading_date = datetime.strptime(trading_date_str, '%d/%m/%Y').date()
                        
                        existing = self.env['stock.candle'].search([
                            ('ticker_id', '=', ticker.id),
                            ('date', '=', trading_date)
                        ], limit=1)
                        
                        vals = {
                            'ticker_id': ticker.id,
                            'date': trading_date,
                            'open': c.get('Open', 0.0),
                            'high': c.get('High', 0.0),
                            'low': c.get('Low', 0.0),
                            'close': c.get('Close', 0.0),
                            'volume': c.get('Volume', 0.0),
                        }
                        
                        if existing:
                            existing.write(vals)
                        else:
                            self.env['stock.candle'].create(vals)
                            count += 1
                return count
            else:
                _logger.error(f"API Error fetching OHLCV for {ticker_symbol}: {data.get('message')}")
                return 0
        except json.JSONDecodeError:
            raise exceptions.UserError("Không thể parse dữ liệu trả về từ SSI")
