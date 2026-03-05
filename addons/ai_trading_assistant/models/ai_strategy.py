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
    
    evaluated_algorithms = fields.Char(string='Các Thuật toán Đã Thử nghiệm (AutoML)', tracking=True)
    epochs = fields.Integer(string='Số Epochs (Timesteps)', tracking=True)
    
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
        """Đồng bộ dữ liệu nến (OHLCV) từ file Backtest ZIP vào Database một cách tối ưu."""
        if not history_data or not isinstance(history_data, list):
            return
            
        from datetime import datetime
        
        # 1. Thu thập tất cả symbol có trong data
        all_symbols = list(set(row.get('tic') for row in history_data if row.get('tic')))
        if not all_symbols:
            return
            
        # 2. Bulk fetch các ticker đã tồn tại
        existing_tickers = self.env['stock.ticker'].search([('name', 'in', all_symbols)])
        ticker_map = {t.name: t.id for t in existing_tickers}
        
        # 3. Tạo các ticker còn thiếu
        missing_symbols = set(all_symbols) - set(ticker_map.keys())
        if missing_symbols:
            new_tickers_vals = [{
                'name': sym,
                'market': 'HOSE',
                'company_name': f'Auto-created from AI Model ({sym})'
            } for sym in missing_symbols]
            new_tickers = self.env['stock.ticker'].create(new_tickers_vals)
            for nt in new_tickers:
                ticker_map[nt.name] = nt.id
                
        # 4. Chuẩn bị dữ liệu nến cho Bulk Upsert
        all_candle_vals = []
        for row in history_data:
            tic = row.get('tic')
            row_date_str = row.get('date')
            ticker_id = ticker_map.get(tic)
            
            if not tic or not row_date_str or not ticker_id:
                continue
                
            try:
                trading_date = datetime.strptime(row_date_str, '%Y-%m-%d').date()
                all_candle_vals.append((
                    ticker_id, 
                    trading_date, 
                    row.get('open', 0.0), 
                    row.get('high', 0.0), 
                    row.get('low', 0.0), 
                    row.get('close', 0.0), 
                    row.get('volume', 0.0)
                ))
            except Exception:
                continue
                
        # 5. Thực hiện Bulk Insert/Update if Conflict
        if all_candle_vals:
            query = """
                INSERT INTO stock_candle (ticker_id, date, "open", high, low, "close", volume)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (ticker_id, date) DO UPDATE SET
                    "open" = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    "close" = EXCLUDED.close,
                    volume = EXCLUDED.volume;
            """
            # Chia nhỏ lô (chunk) nếu dữ liệu quá lớn để tránh lỗi bộ nhớ hoặc giới hạn packet
            chunk_size = 5000
            for i in range(0, len(all_candle_vals), chunk_size):
                batch = all_candle_vals[i:i + chunk_size]
                self.env.cr.executemany(query, batch)

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
                self._sync_metadata(vals)
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
            self._sync_metadata(vals)
        res = super(AIStrategy, self).write(vals)
        
        if vals.get('model_file'):
            for record in self:
                self._create_history_log(record)
        return res

    def _sync_metadata(self, vals):
        """Hàm nội bộ để bốc tách Metadata và đồng bộ vào Fields/Database."""
        metadata = self._parse_model_metadata(vals.get('model_file'))
        if not metadata:
            return
            
        update_vals = {
            'algorithm': metadata.get('algorithm', vals.get('algorithm', 'ppo')),
            'evaluated_algorithms': metadata.get('evaluated_algorithms', ''),
            'epochs': metadata.get('epochs', 0),
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
        
        # Xử lý Ticker Mapping (Tối ưu)
        meta_tickers = metadata.get('ticker_ids', [])
        if meta_tickers and isinstance(meta_tickers, list):
            if "ALL" in [t.upper() for t in meta_tickers]:
                update_vals['ticker_ids'] = [(5, 0, 0)]
            else:
                existing_tickers = self.env['stock.ticker'].search([('name', 'in', meta_tickers)])
                found_names = existing_tickers.mapped('name')
                missing_names = set(meta_tickers) - set(found_names)
                
                all_ids = list(existing_tickers.ids)
                if missing_names:
                    new_tickers_vals = [{
                        'name': name, 'market': 'HOSE', 
                        'company_name': f'Auto-created from AI Model ({name})'
                    } for name in missing_names]
                    new_tickers = self.env['stock.ticker'].create(new_tickers_vals)
                    all_ids.extend(new_tickers.ids)
                
                if all_ids:
                    update_vals['ticker_ids'] = [(6, 0, all_ids)]
                    
        vals.update(update_vals)
        
        # Đồng bộ History Data (Đã được tối ưu ở bước trước)
        if 'history_data' in metadata:
            self._sync_history_data(metadata['history_data'])

    def _create_history_log(self, record):
        """Helper để tạo log lịch sử huấn luyện."""
        self.env['ai.training.history'].create({
            'name': f"Upload: {record.model_filename or 'Unknown.zip'} ({record.name})",
            'algorithm': record.algorithm,
            'evaluated_algorithms': record.evaluated_algorithms,
            'tickers': ", ".join(record.ticker_ids.mapped('name')) if record.ticker_ids else "ALL",
            'epochs': record.epochs,
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
        Inference nhẹ (Lightweight): Chỉ dùng dữ liệu của MÃ CẦN PREDICT duy nhất.
        Tránh tái tạo toàn bộ môi trường multi-stock (2000+ mã) gây tràn RAM.
        Thay vào đó, tạo môi trường 1-stock, load model, và lấy tín hiệu hướng.
        """
        self.ensure_one()
        if not self.model_file:
            return 0.0, None
            
        import base64
        import tempfile
        import os
        import logging
        import pandas as pd
        import numpy as np
        _logger = logging.getLogger(__name__)
        
        # 1. Kiểm tra thư viện
        try:
            from stable_baselines3 import PPO, A2C, DDPG
        except ImportError as e:
            return -999.0, f"Thiếu thư viện 'stable-baselines3': {e}"
            
        try:
            from finrl.meta.env_stock_trading.env_stocktrading import StockTradingEnv
        except ImportError as e:
            return -999.0, f"Thiếu thư viện 'finrl': {e}"

        try:
            try:
                from finrl.meta.preprocessor.preprocessors import FeatureEngineer
            except ImportError:
                from finrl.meta.preprocessor.feature_engineer import FeatureEngineer
        except ImportError as e:
            return -999.0, f"Thiếu modules trong thư viện 'finrl': {e}"

        # 2. Chỉ load dữ liệu của MÃ CẦN PREDICT (tiết kiệm RAM x2000 lần)
        metadata = self._parse_model_metadata(self.model_file)
        INDICATORS = metadata.get('indicators', ["macd", "boll_ub", "boll_lb", "rsi_30", "cci_30", "dx_30", "close_30_sma", "close_60_sma"])
        
        candles = self.env['stock.candle'].sudo().search([
            ('ticker_id', '=', ticker_to_predict.id)
        ], order='date desc', limit=150)
        
        if not candles:
            return 0.0, None
        
        data_list = [{
            'date': c.date.strftime('%Y-%m-%d'),
            'tic': ticker_to_predict.name,
            'open': float(c.open), 'high': float(c.high),
            'low': float(c.low), 'close': float(c.close),
            'volume': float(c.volume)
        } for c in candles]
        
        df = pd.DataFrame(data_list).sort_values(['date', 'tic'], ignore_index=True)
        if df.empty:
            return 0.0, None
        
        # 3. Ghi model file ra file tạm
        tmp_model_path = ""
        try:
            fd, tmp_model_path = tempfile.mkstemp(suffix=".zip")
            with os.fdopen(fd, 'wb') as f:
                f.write(base64.b64decode(self.model_file))
                
            # 4. Feature Engineering cho 1 mã duy nhất
            fe = FeatureEngineer(
                use_technical_indicator=True,
                tech_indicator_list=INDICATORS,
                use_vix=True,
                use_turbulence=False,
                user_defined_feature=False
            )
            processed_df = fe.preprocess_data(df)
            processed_df = processed_df.sort_values(['date', 'tic'], ignore_index=True)
            processed_df.index = processed_df.date.factorize()[0]
            
            # 5. Tạo Environment SINGLE-STOCK (stock_dim = 1)
            stock_dimension = 1
            state_space = int(1 + 2 * stock_dimension + len(INDICATORS) * stock_dimension)
            
            env_kwargs = {
                "hmax": 10000,
                "initial_amount": 1000000000,
                "num_stock_shares": [0],
                "buy_cost_pct": [0.0015],
                "sell_cost_pct": [0.0025],
                "state_space": state_space,
                "stock_dim": stock_dimension,
                "tech_indicator_list": INDICATORS,
                "action_space": stock_dimension,
                "reward_scaling": 1e-4
            }
            
            env = StockTradingEnv(df=processed_df, **env_kwargs)
            obs = env.reset()
            if isinstance(obs, tuple): obs = obs[0]
            
            # 6. Load Model và lấy tín hiệu hướng bằng Policy Network
            algo = self.algorithm or 'ppo'
            model_class = PPO if algo == 'ppo' else (A2C if algo == 'a2c' else DDPG)
            loaded_model = model_class.load(tmp_model_path)
            
            # Lấy observation đã chuẩn hóa rồi đưa qua Policy Network
            # Dù model train multi-stock, policy network vẫn là MLP nên ta có thể
            # truyền observation khác dimension rồi lấy giá trị mean action
            import torch
            obs_tensor = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
            
            with torch.no_grad():
                # Trích xuất giá trị trung bình từ policy distribution
                policy = loaded_model.policy
                features = policy.extract_features(obs_tensor, policy.features_extractor)
                latent_pi = policy.mlp_extractor.forward_actor(features)
                mean_actions = policy.action_net(latent_pi)
                pred_action = float(mean_actions.mean().item())
            
            # Normalize action về khoảng [-1, 1] để giữ logic signal phía sau
            pred_action = max(min(pred_action, 1.0), -1.0)
            return pred_action, None

        except Exception as e:
            _logger.error(f"Lỗi Inference Model: {e}")
            return 0.0, f"Lỗi khi Predict: {e}"
        finally:
            if tmp_model_path and os.path.exists(tmp_model_path):
                os.remove(tmp_model_path)
