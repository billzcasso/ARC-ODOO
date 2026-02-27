from odoo import models, fields, api
import json
import requests
import re
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class StockTicker(models.Model):
    _name = 'stock.ticker'
    _description = 'Stock Ticker (Mã chứng khoán)'
    
    name = fields.Char(string='Mã CK (Symbol)', required=True, index=True)
    market = fields.Selection([
        ('HOSE', 'HOSE'),
        ('HNX', 'HNX'),
        ('UPCOM', 'UPCOM'),
    ], string='Sàn Giao Dịch', required=True, default='HOSE')
    company_name = fields.Char(string='Tên Công Ty')
    sector = fields.Char(string='Ngành nghề')
    is_active = fields.Boolean(string='Đang giao dịch', default=True)
    
    candle_ids = fields.One2many(
        'stock.candle', 'ticker_id', string='Dữ liệu Lịch sử (OHLCV)'
    )
    
    _sql_constraints = [
        ('unique_ticker', 'unique(name)', 'Ma chung khoan nay da ton tai!')
    ]

    def _render_general_chat_html(self, response_text):
        html_content = str(response_text)
        
        # 1. Style Bold text
        html_content = re.sub(r'\*\*(.*?)\*\*', r'<strong style="color: #60a5fa; font-size: 15px;">\1</strong>', html_content)
        # 2. Style Italic text
        html_content = re.sub(r'\*(.*?)\*', r'<em style="color: #94a3b8;">\1</em>', html_content)
        
        return f"""
        <div class="ai-general-chat">
            <div style="background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0) 100%); border-left: 3px solid #3b82f6; padding: 12px 15px; border-radius: 4px; margin-bottom: 15px;">
                <i class="fa fa-line-chart" style="color: #60a5fa; margin-right: 8px;"></i>
                <b style="color: #60a5fa; font-size: 15px; text-transform: uppercase;">Nhận định Toàn cảnh từ ARC</b>
            </div>
            <div style="color: #f8fafc; line-height: 1.7; font-size: 14.5px; padding: 0 5px; white-space: pre-wrap; word-wrap: break-word;">{html_content}</div>
        </div>
        """

    def _render_no_model_html(self, symbol, latest_price, sma_val, rsi_val, latest_date):
        def fmt(v): return f"{v/1000:,.2f}"
        return f"""
        <div class="ai-chat-recommendation">
            <div class="rc-header">
                <h2>{symbol}</h2>
            </div>
            <div class="rc-metrics" style="margin-top: 10px;">
                <div>
                    <div class="rc-label">Giá hiện tại / SMA20</div>
                    <div class="rc-value">{fmt(latest_price)} / {fmt(sma_val)} <span style="font-size: 0.8em; opacity: 0.8;">(RSI: {rsi_val:.1f})</span></div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">Cập nhật: {latest_date}</div>
                </div>
            </div>
            <div style="margin-top: 15px; padding: 10px; background-color: rgba(243, 156, 18, 0.1); border-left: 3px solid #f39c12; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                <i class="fa fa-exclamation-triangle" style="color: #f39c12; margin-right: 5px;"></i>
                Hệ thống ARC chưa có mô hình Thuật toán AI (Backtest) nào được huấn luyện riêng cho mã <b>{symbol}</b>. Để đảm bảo an toàn đầu tư, chuyên gia ARC từ chối đưa ra tín hiệu Mua/Bán hoặc dự phóng Lãi/Lỗ. Bạn vui lòng liên hệ Admin để Train Model cho mã này.
            </div>
        </div>
        """

    def _render_analysis_html(self, symbol, latest_price, sma_val, rsi_val, latest_date, 
                              action_color, tech_signal, display_profit, profit_label, 
                              zone_label, zone_value, target_label, target_color, target_value,
                              stars_label, overall_score, khq_color, khq_label, 
                              price_stars, trend_stars, pos_stars, flow_stars, volat_stars, base_stars,
                              expert_comment, ai_confidence):
        def render_stars(n):
            return " ".join(['<i class="fa fa-star" style="color: #f59e0b;"></i>' for _ in range(n)])
        def fmt(v): return f"{v/1000:,.2f}"
            
        return f"""
        <div class="ai-chat-recommendation">
            <div class="rc-header">
                <div>
                    <h2>{symbol}</h2>
                    <div class="rc-stars">Biên độ: {stars_label}</div>
                </div>
                <div class="rc-action-box" style="border-color: {action_color};">
                    <div class="rc-action" style="color: {action_color};">{tech_signal}</div>
                    <div class="rc-profit" style="color: {action_color};">{display_profit}</div>
                    <div class="rc-profit-label">{profit_label}</div>
                </div>
            </div>
            
            <div class="rc-metrics" style="margin-bottom: 5px;">
                <div>
                    <div class="rc-label">Giá hiện tại / SMA20</div>
                    <div class="rc-value">{fmt(latest_price)} / {fmt(sma_val)} <span style="font-size: 0.8em; opacity: 0.8;">(RSI: {rsi_val:.2f})</span></div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">Cập nhật: {latest_date}</div>
                </div>
                <div style="text-align: right;">
                    <div class="rc-label">{zone_label}</div>
                    <div class="rc-value" style="color: #10b981;">{zone_value}</div>
                </div>
            </div>
            
            <div class="rc-metrics" style="padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.05);">
                <div>
                    <div class="rc-label" style="color: #cbd5e1; font-weight: 500;">Chiến lược hành động</div>
                </div>
                <div style="text-align: right;">
                    <div class="rc-label">{target_label}</div>
                    <div class="rc-value" style="color: {target_color}; font-weight: bold;">{target_value}</div>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.2) linear-gradient(180deg, rgba(30,41,59,0) 0%, rgba(15,23,42,0.4) 100%); border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
                <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color: white;">Phân tích chi tiết</div>
                <div style="text-align:center;">
                    <svg width="180" height="95" viewBox="0 0 200 110">
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#334155" stroke-width="12" stroke-linecap="round"/>
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gradient)" stroke-width="12" stroke-linecap="round" stroke-dasharray="251.2" stroke-dashoffset="{251.2 * (1 - overall_score/100)}"/>
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#ef4444" />
                                <stop offset="50%" stop-color="#f59e0b" />
                                <stop offset="100%" stop-color="#10b981" />
                            </linearGradient>
                        </defs>
                        <g transform="translate(100, 100) rotate({-90 + (overall_score/100)*180})">
                            <polygon points="-3,0 3,0 0,-60" fill="#cbd5e1" />
                            <circle cx="0" cy="0" r="6" fill="#f8fafc" />
                            <circle cx="0" cy="0" r="3" fill="#1e293b" />
                        </g>
                    </svg>
                    <div style="font-size: 14px; font-weight: bold; color: {khq_color}; margin-top: -5px; margin-bottom: 12px;">{khq_label} ({overall_score}/100)</div>
                </div>
                
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #cbd5e1; border-bottom: 1px dashed rgba(255,255,255,0.05);">
                    <span>Sức mạnh giá</span>
                    <span>{price_stars} {render_stars(price_stars)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #cbd5e1; border-bottom: 1px dashed rgba(255,255,255,0.05);">
                    <span>Sức mạnh xu hướng</span>
                    <span>{trend_stars} {render_stars(trend_stars)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #cbd5e1; border-bottom: 1px dashed rgba(255,255,255,0.05);">
                    <span>Vị thế ngắn hạn</span>
                    <span>{pos_stars} {render_stars(pos_stars)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #cbd5e1; border-bottom: 1px dashed rgba(255,255,255,0.05);">
                    <span>Dòng tiền</span>
                    <span>{flow_stars} {render_stars(flow_stars)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #cbd5e1; border-bottom: 1px dashed rgba(255,255,255,0.05);">
                    <span>Độ biến động</span>
                    <span>{volat_stars} {render_stars(volat_stars)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #cbd5e1;">
                    <span>Biên nền giá</span>
                    <span>{base_stars} {render_stars(base_stars)}</span>
                </div>
            </div>
            
            <h3 style="margin-top: 20px; font-size: 13px; color: white; border-left: 2px solid #3b82f6; padding-left: 6px;">Nhận xét từ ARC</h3>
            <div class="rc-expert-comment">{expert_comment}</div>
        </div>
        """

    @api.model
    def ai_chat(self, message):
        """
        Logic xử lý tin nhắn ĐA NĂNG: Hỗ trợ phân tích nhiều mã cùng lúc và nhận định vĩ mô real-time.
        """
        # 1. Trích xuất CÁC mã chứng khoán bằng LLM (OpenRouter)
        system_prompt_extract = """Bạn là một chuyên gia nhận diện thực thể tài chính.
Nhiệm vụ của bạn là đọc câu hỏi của người dùng và trích xuất DANH SÁCH CÁC MÃ CHỨNG KHOÁN (ticker symbol) mà họ đang muốn phân tích.
- Nếu người dùng nhắc đến 1 hoặc nhiều mã (Ví dụ: FPT, ACB, HPG...), hãy trả về các mã đó cách nhau bởi dấu phẩy (Ví dụ: FPT, ACB, HPG).
- Nếu người dùng CHỈ hỏi chung chung, hãy trả về chữ: NONE.
KHÔNG giải thích, KHÔNG nói gì thêm. Chỉ trả về danh sách mã cách nhau bởi dấu phẩy hoặc NONE."""
        
        extract_response = self._call_openrouter(message, system_prompt_extract).strip().upper()
        
        symbols = []
        if "NONE" not in extract_response:
            # Tìm tất các mã 3 chữ cái trong response
            symbols = re.findall(r'\b[A-Z0-9]{3,}\b', extract_response)
            # Loại bỏ các từ khóa không phải mã như SSI, T+1... nếu cần (ở đây SSI là mã nên cứ để)
            symbols = list(set(symbols)) # Duy nhất

        if not symbols:
            # --- XỬ LÝ NHẬN ĐỊNH VĨ MÔ TOÀN CẢNH ---
            market_context = "Hiện chưa lấy được dữ liệu thị trường mới nhất."
            latest_vni_price = 1100.0
            
            ssi_id = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_id', '')
            ssi_secret = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_secret', '')
            api_url = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_api_url', 'https://fc-data.ssi.com.vn/')
            
            if ssi_id and ssi_secret:
                try:
                    from ssi_fc_data import fc_md_client, model as ssi_model
                    class Config: pass
                    conf = Config()
                    conf.consumerID, conf.consumerSecret, conf.url = ssi_id, ssi_secret, api_url
                    client = fc_md_client.MarketDataClient(conf)
                    
                    # Lấy data VNINDEX rất gần (3 ngày đổ lại) để đảm bảo tươi mới
                    end_d = datetime.now()
                    start_d = end_d - timedelta(days=5)
                    req = ssi_model.daily_ohlc('VNINDEX', start_d.strftime('%d/%m/%Y'), end_d.strftime('%d/%m/%Y'), 1, 10, True)
                    res = client.daily_ohlc(conf, req)
                    
                    import json
                    data = res if isinstance(res, dict) else json.loads(res)
                    if str(data.get('status')) == '200' and data.get('data'):
                        candles = data.get('data', [])
                        if candles:
                            latest = candles[0]
                            latest_vni_price = float(latest.get('Close', 1100))
                            market_context = f"VN-Index phiên mới nhất ({latest.get('TradingDate')}): Đóng cửa tại {latest.get('Close')} điểm. Khối lượng: {latest.get('Volume', 0):,} cp."
                except Exception as e:
                    market_context = f"Lỗi dữ liệu vĩ mô: {e}"

            system_prompt = f"""Bạn là ARC Intelligence - Giám đốc Phân tích.
Người dùng đang hỏi về vĩ mô/toàn cảnh thị trường.
[DỮ LIỆU VN-INDEX MỚI NHẤT]: {market_context}
Hãy cung cấp nhận định chuyên sâu dựa trên số điểm {latest_vni_price} này. Đề xuất các nhóm ngành hot và 3 mã tiềm năng."""
            
            response = self._call_openrouter(message, system_prompt)
            return {'status': 'success', 'response_html': self._render_general_chat_html(response)}
            
        # --- XỬ LÝ PHÂN TÍCH NHIỀU MÃ CHỨNG KHOÁN ---
        final_html = ""
        for sym in symbols:
            try:
                result = self._analyze_ticker_to_html(sym)
                if result.get('status') == 'success':
                    final_html += result.get('response_html', '')
                else:
                    final_html += f"<div class='alert alert-warning'>Mã {sym}: {result.get('response_html', 'Không tìm thấy dữ liệu')}</div>"
            except Exception as e:
                final_html += f"<div class='alert alert-danger'>Lỗi khi phân tích {sym}: {str(e)}</div>"

        return {
            'status': 'success', 
            'response_html': f"<div class='ai-multi-analysis'>{final_html}</div>"
        }

    def _analyze_ticker_to_html(self, symbol):
        """Hàm nội bộ thực hiện trọn vẹn quy trình: Fetch -> AI Inference -> Render Card cho 1 mã."""
        ticker = self.sudo().search([('name', '=', symbol)], limit=1)
        if not ticker:
            ticker = self.sudo().create({'name': symbol, 'company_name': f'Mã {symbol}', 'market': 'HOSE', 'is_active': True})
            
        # 1. Sync Data (Tối ưu: Chỉ sync nếu dữ liệu cũ hơn 15 phút)
        try:
            to_date_str = datetime.now().strftime('%d/%m/%Y')
            latest_c = self.env['stock.candle'].sudo().search([('ticker_id', '=', ticker.id)], order='date desc', limit=1)
            
            # Kiểm tra thời gian cập nhật cuối cùng để tránh spam API SSI
            # Odoo tự động lưu write_date khi bản ghi bị thay đổi
            should_sync = True
            if latest_c:
                diff = datetime.now() - latest_c.write_date
                if diff.total_seconds() < 200: 
                    should_sync = False
            
            if should_sync:
                from_date_str = (latest_c.date - timedelta(days=2)).strftime('%d/%m/%Y') if latest_c else (datetime.now() - timedelta(days=150)).strftime('%d/%m/%Y')
                fetcher = self.env['ssi.data.fetcher'].sudo().create({})
                fetcher.fetch_daily_ohlcv(symbol, from_date_str, to_date_str)
        except Exception: pass
            
        # 2. Chuẩn bị DataFrame
        local_candles = self.env['stock.candle'].sudo().search([('ticker_id', '=', ticker.id)], order='date desc', limit=150)
        if not local_candles:
            return {'status': 'error', 'response_html': f'Mã {symbol} thiếu dữ liệu.'}
            
        data_list = []
        for c in local_candles:
            data_list.append({
                'date': c.date.strftime('%Y-%m-%d'), 'tic': symbol,
                'open': float(c.open), 'high': float(c.high), 'low': float(c.low), 'close': float(c.close), 'volume': float(c.volume)
            })
        df = pd.DataFrame(data_list).sort_values('date', ascending=True)
        df['Close'] = df['close']
        df['TradingDate'] = df['date']
        
        # 3. Lấy giá Real-time SSI (để card luôn tươi mới nhất ngay giây phút này)
        real_latest_price = None
        real_latest_date = None
        ssi_id = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_id', '')
        ssi_secret = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_secret', '')
        if ssi_id and ssi_secret:
            try:
                from ssi_fc_data import fc_md_client, model as ssi_model
                class Conf: pass
                conf = Conf(); conf.consumerID, conf.consumerSecret, conf.url = ssi_id, ssi_secret, self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_api_url', 'https://fc-data.ssi.com.vn/')
                client = fc_md_client.MarketDataClient(conf)
                res_t = client.daily_stock_price(conf, ssi_model.daily_stock_price(symbol, datetime.now().strftime('%d/%m/%Y'), datetime.now().strftime('%d/%m/%Y'), 1, 1, ticker.market.lower()))
                d_t = res_t if isinstance(res_t, dict) else json.loads(res_t)
                if str(d_t.get('status')) == '200' and d_t.get('data'):
                    today = d_t['data'][0]
                    real_latest_price = float(today.get('MatchPrice') or today.get('ClosePrice'))
                    real_latest_date = str(today.get('TradingDate', datetime.now().strftime('%d/%m/%Y')))
                    # Cập nhật DB
                    t_date = datetime.strptime(real_latest_date, '%d/%m/%Y').date()
                    ex = self.env['stock.candle'].sudo().search([('ticker_id', '=', ticker.id), ('date', '=', t_date)], limit=1)
                    vals = {'ticker_id': ticker.id, 'date': t_date, 'close': real_latest_price, 'open': float(today.get('OpenPrice', real_latest_price)), 'high': float(today.get('HighestPrice', real_latest_price)), 'low': float(today.get('LowestPrice', real_latest_price)), 'volume': float(today.get('TotalVolumn', 0))}
                    if ex: ex.sudo().write(vals)
                    else: self.env['stock.candle'].sudo().create(vals)
            except Exception: pass

        if not real_latest_price:
            real_latest_price = df.iloc[-1]['close']
            real_latest_date = df.iloc[-1]['date']

        # Update DF with latest price
        if str(df.iloc[-1]['date']) == real_latest_date: df.loc[df.index[-1], 'close'] = real_latest_price
        else: df = pd.concat([df, pd.DataFrame([{'date': real_latest_date, 'tic': symbol, 'close': real_latest_price, 'Close': real_latest_price}])], ignore_index=True)
        
        # 4. Tech Indicators
        df['sma20'] = df['close'].rolling(window=20).mean()
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        df['rsi'] = 100 - (100 / (1 + (gain / loss)))
        exp1, exp2 = df['close'].ewm(span=12).mean(), df['close'].ewm(span=26).mean()
        df['macd'] = exp1 - exp2
        df['signal_line'] = df['macd'].ewm(span=9).mean()
        
        latest_row = df.iloc[-1]
        l_price, l_date = float(latest_row['close']), str(latest_row['date'])
        rsi_v, sma_v = float(latest_row['rsi']), float(latest_row['sma20'])
        macd_v, sig_v = float(latest_row['macd']), float(latest_row['signal_line'])
        
        # 5. Inference
        active_strategy = self.env['ai.strategy'].sudo().search([('status', '=', 'active'), '|', ('ticker_ids', '=', False), ('ticker_ids', 'in', ticker.id)], limit=1, order='id desc')
        if not active_strategy:
            return {'status': 'success', 'response_html': self._render_no_model_html(symbol, l_price, sma_v, rsi_v, l_date)}
            
        pred_action, lib_error = active_strategy.get_inference_action(ticker)
        
        # 6. Logic Signals & Dynamic Metrics (Tối ưu độ nhạy & Loại bỏ Hardcode)
        tech_signal = "NẮM GIỮ"
        ai_conf = 0.0
        if lib_error: 
            tech_signal = lib_error
        else:
            ai_conf = min(abs(pred_action * 100), 100)
            # Giảm ngưỡng kích hoạt tín hiệu từ 0.1 xuống 0.05 để nhạy hơn với thay đổi nhỏ của Model
            if pred_action > 0.05: tech_signal = "MUA MẠNH" if pred_action > 0.4 else "CANH MUA"
            elif pred_action < -0.05: tech_signal = "BÁN MẠNH" if pred_action < -0.4 else "CANH BÁN"

        # Tính toán các star metrics (1-5)
        # 1. Sức mạnh giá (RSI)
        price_s = min(max(int(rsi_v / 20) + 1, 1), 5)
        # 2. Sức mạnh xu hướng (SMA)
        diff_sma = (l_price - sma_v) / sma_v * 100
        trend_s = 5 if diff_sma > 5 else (4 if diff_sma > 2 else (3 if diff_sma > -2 else (2 if diff_sma > -5 else 1)))
        # 3. Vị thế ngắn hạn (MACD)
        pos_s = 5 if macd_v > sig_v and macd_v > 0 else (4 if macd_v > sig_v else (3 if macd_v > 0 else 2))
        # 4. Dòng tiền (Volume vs Avg 20)
        vol_avg = df['volume'].tail(20).mean() or 1.0
        vol_ratio = latest_row['volume'] / vol_avg
        flow_s = min(max(int(vol_ratio * 2) + 1, 1), 5)
        # 5. Độ biến động (Standard Deviation - Căn cứ để tính Reward/Risk)
        returns = df['close'].pct_change().dropna()
        volatility_7d = returns.tail(7).std() * 100 # Độ biến động % hàng ngày
        volat_s = min(max(5 - int(volatility_7d * 2), 1), 5)
        # 6. Biên nền giá (Distance from 20-day low)
        low_20 = df['low'].tail(20).min() or 1.0
        base_s = min(max(int((l_price - low_20) / (low_20 * 0.02 or 1)) + 1, 1), 5)

        # Tỷ lệ lãi lỗ chiết khấu từ model KẾT HỢP với biến động thực tế (Volatility Adaptive)
        ai_ret = active_strategy.expected_return or 15.0
        ai_dd = abs(active_strategy.max_drawdown or 5.0)
        
        # Công thức mới: Căn cứ hoàn toàn vào hiệu suất mô hình và biến động (Real-time Adaptive)
        model_monthly_ret = (ai_ret / 252) * 21
        model_monthly_dd = (ai_dd / 252) * 21
        
        # Kiểm tra lỗi thư viện (lib_error) để tránh tính toán sai lệch cực lớn
        is_lib_error = bool(lib_error)
        valid_action = 0.0 if is_lib_error else abs(pred_action)

        # Swing profit target: Bỏ hoàn toàn floor 2%, tính theo (Monthly Return * Action Strength) + Volatility Offset
        # Giúp số liệu phản ánh đúng kỳ vọng tương lai của mô hình
        swing_ret = (model_monthly_ret * valid_action * 3) + (volatility_7d * 0.8)
        swing_ret = min(swing_ret, 35.0) if not is_lib_error else 0.0
        
        # Risk buffer: Tương tự, linh hoạt theo volatility và drawdown
        risk_buf = (model_monthly_dd * 0.5) + (volatility_7d * 1.5)
        risk_buf = min(risk_buf, 15.0) if not is_lib_error else 0.0
        
        # LOGIC CỐ ĐỊNH: Vùng Mua/Bán linh hoạt theo biến động thực tế
        anchor_buy = min(l_price, sma_v)
        # Vùng mua/bán mở rộng theo volatility
        range_width = max(volatility_7d * 0.3, 0.1)
        b_low, b_high = anchor_buy * (1 - risk_buf/200), anchor_buy * (1 + range_width/100)
        
        anchor_target = max(l_price, b_high)
        t1, t2 = anchor_target * (1 + swing_ret*0.7/100), anchor_target * (1 + swing_ret/100)

        expert_comment = self._get_llm_expert_analysis(
            symbol, l_price, l_date, tech_signal, b_low, b_high, t1, t2, rsi_v, sma_v, macd_v,
            active_strategy.algorithm or 'ppo', active_strategy.sharpe_ratio or 0.0, ai_ret, ai_dd, pred_action
        )
        
        def fmt(v): return f"{v/1000:,.2f}"
        action_c = "#00d084" if "MUA" in tech_signal else ("#e74c3c" if "BÁN" in tech_signal else "#f39c12")
        score = min(max(int(rsi_v * 0.8 + (20 if macd_v > sig_v else 0)), 10), 95)
        khq_c = "#10b981" if score > 60 else ("#f59e0b" if score > 40 else "#ef4444")
        khq_l = "Khả quan" if score > 60 else ("Trung lập" if score > 40 else "Kém khả quan")

        is_neg = "BÁN" in tech_signal
        if is_neg:
            # Ngưỡng vùng bán cũng linh hoạt theo volatility
            z_label, z_val = "Vùng canh bán", f"{fmt(l_price)} - {fmt(l_price * (1 + range_width/100))}"
            t_label, t_val, t_color = "Ngưỡng cắt lỗ", f"{fmt(anchor_buy * (1 + risk_buf/100))}", "#e74c3c"
            p_label, p_val = "Rủi ro sụt giảm", f"-{risk_buf:.2f}%"
        else:
            z_label, z_val = "Vùng canh mua", f"{fmt(b_low)} - {fmt(b_high)}"
            t_label, t_val, t_color = "Mục tiêu chốt lời", f"{fmt(t1)} - {fmt(t2)}", "#10b981"
            p_label, p_val = "Lãi kỳ vọng", f"+{swing_ret:.2f}%"

        html = self._render_analysis_html(
            symbol, l_price, sma_v, rsi_v, l_date, action_c, tech_signal, p_val, p_label,
            z_label, z_val, t_label, t_color, t_val,
            "MẠNH", score, khq_c, khq_l, price_s, trend_s, pos_s, flow_s, volat_s, base_s, expert_comment, ai_confidence=f"{ai_conf:.1f}"
        )
        return {'status': 'success', 'response_html': html}

    @api.model
    def _call_openrouter(self, prompt, system_content=""):
        api_key = self.env['ir.config_parameter'].sudo().get_param('ai_trading.llm_api_key')
        if not api_key:
            return "Vui lòng cấu hình OpenRouter API Key để sử dụng tính năng này."
        
        try:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            messages = []
            if system_content:
                messages.append({"role": "system", "content": system_content})
            messages.append({"role": "user", "content": prompt})
            
            data = {
                "model": "arcee-ai/trinity-large-preview:free",
                "messages": messages,
                "extra_body": {"reasoning": {"enabled": True}}
            }
            response = requests.post(url, headers=headers, json=data, timeout=20)
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
        except Exception:
            pass
        return "Kết nối AI đang bận, vui lòng thử lại sau."

    @api.model
    def _get_llm_expert_analysis(self, symbol, price, date, signal, buy_low, buy_high, t1, t2, rsi, sma, macd, algo, sharpe, return_pct, drawdown, pred_action):
        def f(v): return f"{v/1000:,.2f}"
        fallback = f"Mã {symbol} đang giao dịch tại mức {f(price)}. Dữ liệu kỹ thuật cho thấy tín hiệu {signal} với vùng hỗ trợ quanh {f(buy_low)}."
        
        # Lấy năm từ date để AI có ngữ cảnh thời gian (nếu date là 2024-xx-xx)
        year_context = date[:4] if date and len(date) >= 4 else "hiện tại"
        
        prompt = f"""
NGỮ CẢNH THỊ TRƯỜNG & KẾT QUẢ AI DỰ ĐOÁN:
- Mã cổ phiếu: {symbol} (Dữ liệu ngày {date} - Năm {year_context})
- Giá: {f(price)} | SMA20: {f(sma)} | RSI: {rsi:.1f} | MACD: {macd:.2f}
- Thuật toán AI FinRL: {algo.upper()} | Sharpe Ratio (Test Set): {sharpe:.2f}
- Tín hiệu Mạng Nơ-ron (Agent Action): {pred_action:.3f} (Khoảng từ -1.0 BÁN MẠNH đến +1.0 MUA MẠNH) -> KL: {signal}
- Vùng giá Khuyến nghị: Mua {f(buy_low)}-{f(buy_high)} | Chốt lời T+: {f(t1)}-{f(t2)}

YÊU CẦU:
1. Tổng hợp dữ liệu kỹ thuật và kết quả Backtest AI ở trên để đưa ra CHIẾN LƯỢC ĐẦU TƯ CHUẨN QUỐC TẾ.
2. Tuyệt đối KHÔNG nhắc lại các con số cụ thể về giá, RSI, SMA hay MACD trong nội dung nhận xét (vì người dùng đã nhìn thấy trên biểu đồ).
3. Tập trung giải thích bối cảnh ngành, chu kỳ kinh tế và vị thế của doanh nghiệp {symbol} trong năm {year_context}.
4. Đưa ra chiến lược hành động cụ thể (VD: Chia tỷ trọng giải ngân, điểm cắt lỗ/chốt lời theo xu hướng thị trường chung).
5. Trình bày súc tích (3-4 câu), phong thái Giám đốc Chiến lược tại các ngân hàng đầu tư lớn, chuyên nghiệp và quyết đoán.
"""
        system_content = "Bạn là ARC Intelligence - Chuyên gia Chiến lược Đầu tư. Nhiệm vụ của bạn là biến những con số kỹ thuật khô khan thành các nhận định có chiều sâu về doanh nghiệp và thị trường. Phân tích phải có tính thời sự, am hiểu đặc tính của từng mã cổ phiếu (Bluechip, Midcap, đầu cơ...) và sử dụng thuật ngữ tài chính chuẩn xác."
        
        analysis = self._call_openrouter(prompt, system_content)
        if "Kết nối AI" in analysis:
            return fallback
        return analysis.replace('\n', '<br/>')
