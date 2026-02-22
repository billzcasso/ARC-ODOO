from odoo import models, fields, api

class StockCandle(models.Model):
    _name = 'stock.candle'
    _description = 'Stock Candle (Dữ liệu OHLCV)'
    _order = 'date desc'
    
    ticker_id = fields.Many2one('stock.ticker', string='Mã CK', required=True, ondelete='cascade', index=True)
    date = fields.Date(string='Ngày giao dịch', required=True, index=True)
    
    open = fields.Float(string='Mở cửa (Open)', digits=(16, 2))
    high = fields.Float(string='Cao nhất (High)', digits=(16, 2))
    low = fields.Float(string='Thấp nhất (Low)', digits=(16, 2))
    close = fields.Float(string='Đóng cửa (Close)', digits=(16, 2))
    volume = fields.Float(string='Khối lượng (Volume)', digits=(16, 2))
    
    _sql_constraints = [
        ('unique_candle', 'unique(ticker_id, date)', 'Dữ liệu của mã chứng khoán trong ngày này đã tồn tại!')
    ]
