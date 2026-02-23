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
    learning_rate = fields.Float(string='Learning Rate', digits=(16, 6), default=0.00025, tracking=True)
    batch_size = fields.Integer(string='Batch Size', default=64, tracking=True)
    ent_coef = fields.Float(string='Entropy Coefficient', digits=(16, 4), default=0.01, tracking=True)
    
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

    def get_inference_action(self, ticker_to_predict):
        """
        Thực hiện Inference (Dự đoán) thực sự dựa trên file mô hình .zip đã load.
        Đảm bảo số lượng mã chứng khoán (stock_dim) khớp với khi training.
        Args:
           ticker_to_predict (browse_record): Record của mã stock.ticker cần lấy action.
        Returns:
           float: Hành động được agent đề xuất
        """
        self.ensure_one()
        if not self.model_file:
            return 0.0
            
        import base64
        import tempfile
        import os
        import logging
        import pandas as pd
        import numpy as np
        _logger = logging.getLogger(__name__)
        
        # 1. Kiểm tra thư viện từng bước để chẩn đoán chính xác
        try:
            from stable_baselines3 import PPO, A2C, DDPG
        except ImportError as e:
            _logger.error(f"LỖI HỆ THỐNG AI: Thiếu thư viện 'stable-baselines3'. Chi tiết: {e}")
            return -999.0
            
        try:
            from finrl.meta.env_stock_trading.env_stocktrading import StockTradingEnv
        except ImportError as e:
            _logger.error(f"LỖI HỆ THỐNG AI: Thiếu thư viện 'finrl'. Chi tiết: {e}")
            return -999.0

        try:
            try:
                from finrl.meta.preprocessor.preprocessors import FeatureEngineer
            except ImportError:
                from finrl.meta.preprocessor.feature_engineer import FeatureEngineer
        except ImportError as e:
            _logger.error(f"LỖI HỆ THỐNG AI: Thiếu FeatureEngineer của FinRL. Chi tiết: {e}")
            return -999.0

        # 2. Chuẩn bị Dữ liệu cho TOÀN BỘ các mã trong Model (bắt buộc để khớp Dimension NN)
        # Nếu model là MULTI-STOCK, ta phải load tất cả các mã nó từng train
        target_tickers = self.ticker_ids
        if not target_tickers:
           # Nếu model ALL, ta tạm thời lấy mã hiện tại (đây là giới hạn của mode ALL nếu không lưu list cũ)
           target_tickers = ticker_to_predict
           
        INDICATORS = ["macd", "boll_ub", "boll_lb", "rsi_30", "cci_30", "dx_30", "close_30_sma", "close_60_sma"]
        full_data_list = []
        
        for tic in target_tickers:
            # Lấy 150 nến gần nhất để tính technical indicators
            candles = self.env['stock.candle'].sudo().search([
                ('ticker_id', '=', tic.id)
            ], order='date desc', limit=150)
            
            if not candles: continue
            
            for c in candles:
                full_data_list.append({
                    'date': c.date.strftime('%Y-%m-%d'),
                    'tic': tic.name,
                    'open': float(c.open),
                    'high': float(c.high),
                    'low': float(c.low),
                    'close': float(c.close),
                    'volume': float(c.volume)
                })
        
        df = pd.DataFrame(full_data_list)
        if df.empty: return 0.0
        
        # Sắp xếp và xử lý giống train
        df = df.sort_values(['date', 'tic'], ignore_index=True)
        
        # 3. Ghi model file ra một file tạm
        tmp_model_path = ""
        try:
            fd, tmp_model_path = tempfile.mkstemp(suffix=".zip")
            with os.fdopen(fd, 'wb') as f:
                f.write(base64.b64decode(self.model_file))
                
            # Preprocess
            fe = FeatureEngineer(
                use_technical_indicator=True,
                tech_indicator_list=INDICATORS,
                use_vix=False,
                use_turbulence=False,
                user_defined_feature=False
            )
            processed_df = fe.preprocess_data(df)
            processed_df = processed_df.sort_values(['date', 'tic'], ignore_index=True)
            processed_df.index = processed_df.date.factorize()[0]
            
            # 4. Tạo Environment đồng nhất Dimension
            stock_dimension = int(len(processed_df.tic.unique()))
            state_space = int(1 + 2 * stock_dimension + len(INDICATORS) * stock_dimension)
            
            env_kwargs = {
                "hmax": 100,
                "initial_amount": 1000000,
                "num_stock_shares": [0] * stock_dimension,
                "buy_cost_pct": [0.001] * stock_dimension,
                "sell_cost_pct": [0.001] * stock_dimension,
                "state_space": state_space,
                "stock_dim": stock_dimension,
                "tech_indicator_list": INDICATORS,
                "action_space": stock_dimension,
                "reward_scaling": 1e-4
            }
            
            env = StockTradingEnv(df=processed_df, **env_kwargs)
            obs = env.reset()
            if isinstance(obs, tuple): obs = obs[0]
               
            # 5. Load và Predict
            algo = self.algorithm or 'ppo'
            model_class = PPO if algo == 'ppo' else (A2C if algo == 'a2c' else DDPG)
            
            loaded_model = model_class.load(tmp_model_path)
            action, _states = loaded_model.predict(obs, deterministic=True)
            
            # Action là một mảng ứng với danh sách TIC đã sort
            # Tìm vị trí của ticker_to_predict trong danh sách đã sort của processed_df
            sorted_tics = sorted(processed_df.tic.unique())
            try:
                tic_idx = sorted_tics.index(ticker_to_predict.name)
                pred_action = action[tic_idx]
                return float(pred_action)
            except Exception:
                # Nếu không tìm thấy mã trong list (hy hữu), lấy trung bình hoặc 0
                return float(action[0]) if len(action) > 0 else 0.0

        except Exception as e:
            _logger.error(f"Lỗi Inference Model (Có thể do Dimension Mismatch): {e}")
            return 0.0
        finally:
            if tmp_model_path and os.path.exists(tmp_model_path):
                os.remove(tmp_model_path)
