from odoo import models, fields, api

import logging

_logger = logging.getLogger(__name__)

# Cache toàn cục để giữ Model trên RAM (Tránh load lại từ Disk gây chậm)
# { strategy_id: { 'model': model_obj, 'write_date': date } }
_MODEL_CACHE = {}

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
    debug_report = fields.Text(string='Báo cáo Kỹ thuật', readonly=True)
    
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
            # Odoo Binary field trả về bytes, không cần decode nếu đã là bytes ZIP (bắt đầu bằng PK)
            # Tuy nhiên để chắc chắn, ta thử decode. Nếu lỗi thì dùng bản gốc.
            content = model_binary
            if isinstance(model_binary, str):
                try:
                    content = base64.b64decode(model_binary)
                except: pass
            elif isinstance(model_binary, bytes) and not model_binary.startswith(b'PK'):
                try:
                    content = base64.b64decode(model_binary)
                except: pass

            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                if 'metadata.json' in zf.namelist():
                    with zf.open('metadata.json') as f:
                        return json.loads(f.read().decode('utf-8'))
        except Exception as e:
            _logger.warning(f"Metadata parsing failed: {e}")
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

    def action_debug_model(self):
        """Action để debug cấu trúc file model trực tiếp từ giao diện Odoo."""
        self.ensure_one()
        if not self.model_file:
            raise models.ValidationError("Không có file model để debug!")
            
        import zipfile
        import io
        import base64
        
        _logger.info(f"--- START DEBUG MODEL: {self.name} ---")
        report = []
        report.append(f"Algorithm field: {self.algorithm}")
        
        # Kiểm tra kiểu dữ liệu Odoo trả về
        raw_data = self.model_file
        report.append(f"Data Type from Odoo: {type(raw_data)}")
        
        # Thử giải mã an toàn
        content = raw_data
        if isinstance(raw_data, str):
            try:
                content = base64.b64decode(raw_data)
                report.append("Content handling: Decoded from String (B64)")
            except Exception as e:
                report.append(f"Content handling: Failed to decode String ({e})")
        elif isinstance(raw_data, bytes):
            if raw_data.startswith(b'PK'):
                report.append("Content handling: Raw ZIP bytes detected (PK header)")
            else:
                try:
                    content = base64.b64decode(raw_data)
                    report.append("Content handling: Decoded from Bytes (B64)")
                except Exception as e:
                    report.append(f"Content handling: Bytes detected, but not ZIP and B64 decode failed ({e})")

        report.append(f"Total size: {len(content)} bytes")
        if len(content) > 0:
            report.append(f"First 20 bytes (Hex): {content[:20].hex()}")
        
        # Kiểm tra cấu trúc ZIP
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                files = zf.namelist()
                report.append(f"ZIP Contents: {', '.join(files)}")
                if 'metadata.json' in files:
                    with zf.open('metadata.json') as f:
                        meta = f.read().decode('utf-8')
                        report.append(f"Metadata JSON (preview): {meta[:200]}...")
                else:
                    report.append("CHECK: No metadata.json found (Expected for FinRL/ARC format)")
        except Exception as e:
            report.append(f"ZIP INTEGRITY ERROR: {e}")

        for line in report:
            _logger.info(f"AI DEBUG: {line}")
        _logger.info(f"--- END DEBUG MODEL ---")
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Debug Model Result',
                'message': f"Check Odoo Logs for 'AI DEBUG'. ZIP: {'OK' if 'ZIP Contents' in str(report) else 'FAILED'}",
                'sticky': True,
            }
        }

    def get_inference_action(self, ticker_to_predict):
        """
        Thực hiện Inference (Dự đoán) thực sự dựa trên file mô hình .zip đã load.
        Đảm bảo số lượng mã chứng khoán (stock_dim) khớp với khi training.
        Args:
           ticker_to_predict (browse_record): Record của mã stock.ticker cần lấy action.
        Returns:
           tuple: (float action, str error_msg)
        """
        self.ensure_one()
        if not self.model_file:
            return 0.0, ""
            
        import base64
        import tempfile
        import os
        import logging
        import pandas as pd
        import numpy as np
        _logger = logging.getLogger(__name__)
        
        # 1. Kiểm tra Cache trước khi Load từ Disk
        global _MODEL_CACHE
        cache_entry = _MODEL_CACHE.get(self.id)
        if cache_entry and cache_entry['write_date'] == self.write_date:
            loaded_model = cache_entry['model']
        else:
            # 1.1 Kiểm tra thư viện từng bước với LOG chi tiết
            import sys
            import traceback
            _logger.info(f"AI DIAGNOSTIC: Python Executable: {sys.executable}")
            _logger.info(f"AI DIAGNOSTIC: Python Path: {sys.path}")
            
            try:
                from stable_baselines3 import PPO, A2C, DDPG
            except Exception as e:
                _logger.error(f"LỖI HỆ THỐNG AI: Không thể import 'stable-baselines3'. Chi tiết: {e}")
                _logger.error(traceback.format_exc())
                return 0.0, "Thiếu stable-baselines3"
                
            try:
                from stockstats import StockDataFrame
            except Exception as e:
                _logger.error(f"LỖI HỆ THỐNG AI: Không thể import 'stockstats'. Chi tiết: {e}")
                _logger.error(traceback.format_exc())
                return 0.0, "Thiếu stockstats"

            # 3. Ghi model file ra một file tạm để Load
            tmp_model_path = ""
            try:
                fd, tmp_model_path = tempfile.mkstemp(suffix=".zip")
                
                # Giải mã an toàn: Odoo Binary thường trả về bytes trực tiếp
                model_data = self.model_file
                if isinstance(model_data, str):
                    try:
                        model_data = base64.b64decode(model_data)
                    except: pass
                elif isinstance(model_data, bytes) and not model_data.startswith(b'PK'):
                    # Nếu là bytes nhưng không có header ZIP 'PK', thử decode b64
                    try:
                        model_data = base64.b64decode(model_data)
                    except: pass

                with os.fdopen(fd, 'wb') as f:
                    f.write(model_data)
                
                # Chốt chặn thuật toán: Thử đúng loại, nếu fail thì thử các loại khác (AUTO-DETECT)
                algo = self.algorithm or 'ppo'
                model_classes = [PPO, A2C, DDPG]
                # Đưa class ưu tiên lên đầu
                preferred = PPO if algo == 'ppo' else (A2C if algo == 'a2c' else DDPG)
                model_classes.remove(preferred)
                model_classes.insert(0, preferred)
                
                loaded_model = None
                last_err = ""
                for m_cls in model_classes:
                    try:
                        loaded_model = m_cls.load(tmp_model_path, device='cpu')
                        if loaded_model:
                            _logger.info(f"AI Model [{self.name}] nạp thành công bằng {m_cls.__name__}")
                            break
                    except Exception as le:
                        last_err = str(le)
                        continue
                
                if not loaded_model:
                    peek = model_data[:10].hex() if model_data else "Empty"
                    _logger.error(f"SB3 LOAD FAILED: Peek: {peek}. Last error: {last_err}")
                    return 0.0, "Model ko khớp"
                
                # Lưu vào Cache
                _MODEL_CACHE[self.id] = {
                    'model': loaded_model,
                    'write_date': self.write_date
                }
                _logger.info(f"AI Model [{self.name}] đã được Cache vào RAM.")
            except Exception as e:
                _logger.error(f"Lỗi File System: {e}")
                _logger.error(traceback.format_exc())
                return 0.0, "Lỗi File Model"
            finally:
                if tmp_model_path and os.path.exists(tmp_model_path):
                    try:
                        os.remove(tmp_model_path)
                    except: pass

        # 2. Xây dựng Observation Vector (Thực hiện nhanh trên RAM)
        try:
            target_tickers = self.ticker_ids
            if not target_tickers:
               target_tickers = ticker_to_predict
               
            INDICATORS = ["macd", "boll_ub", "boll_lb", "rsi_30", "cci_30", "dx_30", "close_30_sma", "close_60_sma"]
            processed_dfs = []
            
            # Sắp xếp ticker để khớp dimension
            sorted_tickers = target_tickers.sorted(key=lambda r: r.name)
            
            for tic in sorted_tickers:
                candles = self.env['stock.candle'].sudo().search([
                    ('ticker_id', '=', tic.id)
                ], order='date desc', limit=150)
                
                if not candles: continue
                
                cand_list = []
                for c in reversed(candles):
                    cand_list.append({
                        'close': float(c.close), 'open': float(c.open), 'high': float(c.high), 
                        'low': float(c.low), 'volume': float(c.volume)
                    })
                
                if not cand_list: continue
                
                sdf = StockDataFrame.retype(pd.DataFrame(cand_list))
                # Trigger calculations
                for ind in INDICATORS: sdf[ind]
                processed_dfs.append(sdf.iloc[-1:])
            
            if not processed_dfs: return 0.0, "Thiếu dữ liệu"
            
            stock_dimension = len(processed_dfs)
            initial_balance = 1000000.0
            shares = [0.0] * stock_dimension
            prices = [float(df['close'].iloc[0]) for df in processed_dfs]
            
            obs = [initial_balance]
            obs.extend(prices)
            obs.extend(shares)
            for df in processed_dfs:
                for ind in INDICATORS: obs.append(float(df[ind].iloc[0]))
            
            obs = np.array([obs], dtype=np.float32)
            
            # Predict (Rất nhanh vì model đã ở trên RAM)
            action, _states = loaded_model.predict(obs, deterministic=True)
            
            sorted_tics = [t.name for t in sorted_tickers]
            try:
                tic_idx = sorted_tics.index(ticker_to_predict.name)
                pred_action = action[0][tic_idx]
                return float(pred_action), ""
            except Exception:
                return (float(action[0][0]), "") if len(action[0]) > 0 else (0.0, "")

        except Exception as e:
            _logger.error(f"Lỗi Inference Model: {e}")
            return 0.0, "Lỗi n.mạng"
