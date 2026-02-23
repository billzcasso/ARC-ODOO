from odoo import models, fields, api

class AIStrategy(models.Model):
    _name = 'ai.strategy'
    _description = 'AI Trading Strategy (FinRL Model)'
    
    name = fields.Char(string='Tên Chiến lược', required=True)
    description = fields.Text(string='Mô tả chiến lược')
    
    ticker_ids = fields.Many2many(
        'stock.ticker', 
        string='Áp dụng cho Mã CK', 
        help='Nếu để trống, chiến lược này áp dụng chung cho mọi mã. Nếu chọn mã cụ thể, Chatbot sẽ ưu tiên dùng chiến lược này cho các mã tương ứng.'
    )
    
    algorithm = fields.Selection([
        ('ppo', 'PPO (Proximal Policy Optimization)'),
        ('a2c', 'A2C (Advantage Actor Critic)'),
        ('ddpg', 'DDPG')
    ], string='Thuật toán (Algorithm)', required=True, default='ppo')
    
    status = fields.Selection([
        ('draft', 'Mới tạo'),
        ('training', 'Đang huấn luyện'),
        ('trained', 'Đã huấn luyện xong'),
        ('active', 'Đang sử dụng')
    ], string='Trạng thái', default='draft')
    
    model_file = fields.Binary(string='File Mô hình AI (.zip)', attachment=True, help='Upload file .zip chứa model weights')
    model_filename = fields.Char(string='Tên File')
    
    # Hyperparameters
    learning_rate = fields.Float(string='Learning Rate', default=0.00025, tracking=True)
    batch_size = fields.Integer(string='Batch Size', default=64, tracking=True)
    ent_coef = fields.Float(string='Entropy Coefficient', default=0.01, tracking=True)
    
    # metrics
    sharpe_ratio = fields.Float(string='Sharpe Ratio (Backtest)', tracking=True)
    expected_return = fields.Float(string='Return (%)', tracking=True)
    max_drawdown = fields.Float(string='Max Drawdown (%)', tracking=True)
    
    # Môi trường
    framework_version = fields.Char(string='FinRL/SB3 Version')
    training_time = fields.Char(string='Thời gian huấn luyện')
    
    # Tracking / Security
    user_id = fields.Many2one('res.users', string='Người phụ trách', default=lambda self: self.env.user)
    
    def _parse_model_metadata(self, model_binary):
        """Mở file ZIP, đọc metadata.json và trả về dict các giá trị."""
        import zipfile
        import json
        import io
        import base64
        
        if not model_binary:
            return {}
            
        try:
            content = base64.b64decode(model_binary)
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                if 'metadata.json' in zf.namelist():
                    with zf.open('metadata.json') as f:
                        return json.loads(f.read().decode('utf-8'))
        except Exception:
            pass
        return {}
        
    def _sync_history_data(self, history_data):
        """Đồng bộ dữ liệu nến (OHLCV) từ file Backtest ZIP vào Database."""
        if not history_data or not isinstance(history_data, list):
            return
            
        from datetime import datetime
        
        # Nhóm dữ liệu theo mã chứng khoán để xử lý Bulk Insert
        tickers_data = {}
        for row in history_data:
            tic = row.get('tic')
            if tic:
                if tic not in tickers_data:
                    tickers_data[tic] = []
                tickers_data[tic].append(row)
                
        for tic_symbol, lines in tickers_data.items():
            ticker_record = self.env['stock.ticker'].search([('name', '=', tic_symbol)], limit=1)
            # Tự động tạo mã nếu chưa có
            if not ticker_record:
                ticker_record = self.env['stock.ticker'].create({
                    'name': tic_symbol,
                    'market': 'HOSE',
                    'company_name': f'Auto-created from AI Model ({tic_symbol})'
                })
                
            # Lấy các nến đã tồn tại để tránh duplicate
            dates = [datetime.strptime(row['date'], '%Y-%m-%d').date() for row in lines if row.get('date')]
            if not dates: continue
            
            existing_candles = self.env['stock.candle'].search([
                ('ticker_id', '=', ticker_record.id),
                ('date', 'in', dates)
            ])
            existing_dates = {c.date: c for c in existing_candles}
            
            new_vals = []
            for row in lines:
                row_date_str = row.get('date')
                if not row_date_str: continue
                
                trading_date = datetime.strptime(row_date_str, '%Y-%m-%d').date()
                vals = {
                    'ticker_id': ticker_record.id,
                    'date': trading_date,
                    'open': row.get('open', 0.0),
                    'high': row.get('high', 0.0),
                    'low': row.get('low', 0.0),
                    'close': row.get('close', 0.0),
                    'volume': row.get('volume', 0.0),
                }
                
                existing = existing_dates.get(trading_date)
                if existing:
                    existing.write(vals)
                else:
                    new_vals.append(vals)
                    
            if new_vals:
                self.env['stock.candle'].create(new_vals)

    def action_activate(self):
        # Tắt các chiến lược active khác có CÙNG mã chứng khoán
        domain = [('status', '=', 'active'), ('id', '!=', self.id)]
        
        if self.ticker_ids:
            # Nếu có gán mã, chỉ tắt các strategy đang active có chứa ít nhất 1 mã trùng
            domain += [('ticker_ids', 'in', self.ticker_ids.ids)]
        else:
            # Nếu áp dụng chung toàn thị trường, chỉ tắt các strategy chung khác
            domain += [('ticker_ids', '=', False)]
            
        active_conflicts = self.search(domain)
        if active_conflicts:
            active_conflicts.write({'status': 'trained'})
            
        self.status = 'active'
        
    def action_draft(self):
        self.status = 'draft'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('model_file'):
                metadata = self._parse_model_metadata(vals['model_file'])
                if metadata:
                    # Tự động điền các field từ metadata nếu có
                    update_vals = {
                        'algorithm': metadata.get('algorithm', vals.get('algorithm', 'ppo')),
                        'learning_rate': metadata.get('learning_rate', 0.00025),
                        'batch_size': metadata.get('batch_size', 64),
                        'ent_coef': metadata.get('ent_coef', 0.01),
                        'sharpe_ratio': metadata.get('sharpe_ratio', 0.0),
                        'expected_return': metadata.get('expected_return', 0.0),
                        'max_drawdown': metadata.get('max_drawdown', 0.0),
                        'training_time': metadata.get('training_time', ''),
                        'framework_version': metadata.get('framework_version', ''),
                        'status': 'trained'
                    }
                    
                    # Xử lý Ticker Mapping
                    meta_tickers = metadata.get('ticker_ids', [])
                    if meta_tickers and isinstance(meta_tickers, list):
                        if "ALL" in [t.upper() for t in meta_tickers]:
                            update_vals['ticker_ids'] = [(5, 0, 0)] # Xóa hết để áp dụng Toàn thị trường
                        else:
                            # Tìm ID của các mã tương ứng trong CSDL
                            found_tickers = self.env['stock.ticker'].search([('name', 'in', meta_tickers)])
                            if found_tickers:
                                update_vals['ticker_ids'] = [(6, 0, found_tickers.ids)]
                                
                    vals.update(update_vals)
                    
                    # Đồng bộ History Data
                    if 'history_data' in metadata:
                        self._sync_history_data(metadata['history_data'])
                        
                elif vals.get('status', 'draft') == 'draft':
                    vals['status'] = 'trained'
                    
        records = super().create(vals_list)
        
        # Tạo Training History sau khi tạo record thành công
        for record in records:
            if record.model_file:
                self._create_history_log(record)
        return records

    def write(self, vals):
        if vals.get('model_file'):
            metadata = self._parse_model_metadata(vals['model_file'])
            if metadata:
                 update_vals = {
                    'algorithm': metadata.get('algorithm', self.algorithm),
                    'learning_rate': metadata.get('learning_rate', self.learning_rate),
                    'batch_size': metadata.get('batch_size', self.batch_size),
                    'ent_coef': metadata.get('ent_coef', self.ent_coef),
                    'sharpe_ratio': metadata.get('sharpe_ratio', self.sharpe_ratio),
                    'expected_return': metadata.get('expected_return', self.expected_return),
                    'max_drawdown': metadata.get('max_drawdown', self.max_drawdown),
                    'training_time': metadata.get('training_time', self.training_time),
                    'framework_version': metadata.get('framework_version', self.framework_version),
                    'status': 'trained'
                }
                 
                 # Xử lý Ticker Mapping
                 meta_tickers = metadata.get('ticker_ids', [])
                 if meta_tickers and isinstance(meta_tickers, list):
                     if "ALL" in [t.upper() for t in meta_tickers]:
                         update_vals['ticker_ids'] = [(5, 0, 0)]
                     else:
                         found_tickers = self.env['stock.ticker'].search([('name', 'in', meta_tickers)])
                         if found_tickers:
                             update_vals['ticker_ids'] = [(6, 0, found_tickers.ids)]
                             
                 vals.update(update_vals)
                 
                 # Đồng bộ History Data
                 if 'history_data' in metadata:
                     self._sync_history_data(metadata['history_data'])
                     
            else:
                vals['status'] = 'trained'
            
        res = super(AIStrategy, self).write(vals)
        
        if vals.get('model_file'):
            for record in self:
                self._create_history_log(record)
        return res

    def _create_history_log(self, record):
        """Helper để tạo log lịch sử huấn luyện."""
        self.env['ai.training.history'].create({
            'name': f"Upload: {record.model_filename or 'Unknown.zip'} ({record.name})",
            'algorithm': record.algorithm,
            'tickers': ", ".join(record.ticker_ids.mapped('name')) if record.ticker_ids else "ALL",
            'learning_rate': record.learning_rate,
            'batch_size': record.batch_size,
            'ent_coef': record.ent_coef,
            'sharpe_ratio': record.sharpe_ratio,
            'max_drawdown': record.max_drawdown,
            'training_time': record.training_time,
            'model_file': record.model_file,
            'model_filename': record.model_filename,
            'log_text': f"Mô hình được tải lên cho chiến lược [{record.name}].\n"
                       f"Thuật toán: {record.algorithm}\n"
                       f"Sharpe Ratio: {record.sharpe_ratio}\n"
                       f"Framework: {record.framework_version}",
        })
