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
        return f"""
        <div class="ai-general-chat">
            <div style="background-color: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 10px 15px; border-radius: 4px; margin-bottom: 10px;">
                <i class="fa fa-line-chart" style="color: #3b82f6; margin-right: 5px;"></i>
                <b>Nhận định Toàn cảnh từ ARC</b>
            </div>
            <div style="color: #e2e8f0; line-height: 1.6; font-size: 14px; padding: 0 5px;">
                {response_text}
            </div>
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
                              expert_comment):
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
        Logic xử lý tin nhắn: Nếu có mã CK -> Phân tích dữ liệu. Nếu không -> Chat tự do chuyên nghiệp.
        """
        # 1. Trích xuất mã chứng khoán (3 chữ cái in hoa)
        query = message.upper()
        match = re.search(r'\b[A-Z]{3}\b', query)
        symbol = match.group(0) if match else None
        
        if not symbol:
            # Nếu không có mã CK, dùng AI trả lời tư vấn Vĩ mô / Toàn cảnh thị trường hoặc Khuyến nghị danh mục
            system_prompt = """Bạn là ARC Intelligence - Giám đốc Phân tích và Chuyên gia Tư vấn Đầu tư Chứng khoán cấp cao của hệ thống ARC-ODOO.
Người dùng đang hỏi các câu hỏi chung về thị trường (VD: Hôm nay mua gì? Nên đầu tư ngành nào? Biến động thị trường, Xu hướng VNI...).
Nhiệm vụ của bạn:
1. Đưa ra nhận định chuyên sâu, sắc bén về bối cảnh vĩ mô và xu hướng dòng tiền hiện tại.
2. NẾU người dùng hỏi "Nên mua gì / đầu tư mã nào?": HÃY MẠNH DẠN ĐỀ XUẤT 3-5 mã cổ phiếu tiềm năng thuộc các nhóm ngành đang dẫn dắt sóng (VD: Ngân hàng, Chứng khoán, Công nghệ, Bán lẻ...). Kèm theo luận điểm đầu tư (Kỹ thuật hoặc Cơ bản) ngắn gọn cho từng mã.
3. Phân tích phải có cấu trúc rõ ràng, sử dụng dấu hoa thị (*) hoặc gạch đầu dòng, và in đậm (**) các ý chính, tên mã cổ phiếu để trình bày chuyên nghiệp.
4. Trả lời bằng tiếng Việt cực kỳ chuyên nghiệp, tự tin, quyết đoán mang đúng phong thái của một Giám đốc Phân tích. Không trả lời gượng ép, dè dặt hay thoái thác trách nhiệm.
5. Luôn kết thúc bằng một câu gọi mở: "Bạn có thể nhập trực tiếp một mã cổ phiếu (VD: FPT, HPG, TCB) để ARC chạy mô hình AI FinRL và Phân tích kỹ thuật chi tiết nhé."."""
            
            response = self._call_openrouter(message, system_prompt)
            # Render response in a styled UI card instead of just text
            html_response = self._render_general_chat_html(response)
            
            return {
                'status': 'success',
                'response_html': html_response
            }
            
        ticker = self.sudo().search([('name', '=', symbol)], limit=1)
        if not ticker:
            ticker = self.sudo().create({'name': symbol, 'company_name': f'Mã {symbol}', 'market': 'HOSE', 'is_active': True})
            
        # 2. Tự động đồng bộ chuẩn dữ liệu lịch sử vào Database
        try:
            latest_candle = self.env['stock.candle'].sudo().search(
                [('ticker_id', '=', ticker.id)], 
                order='date desc', 
                limit=1
            )
            
            to_date_str = datetime.now().strftime('%d/%m/%Y')
            
            if latest_candle:
                # Nếu đã có dữ liệu, chỉ lấy bù khoảng bị thiếu (lùi 2 ngày phòng sai lệch)
                from_date = latest_candle.date - timedelta(days=2)
                from_date_str = from_date.strftime('%d/%m/%Y')
            else:
                # Nếu mã hoàn toàn mới chưa có dữ liệu, tải mặc định 150 ngày cũ
                from_date_str = (datetime.now() - timedelta(days=150)).strftime('%d/%m/%Y')
                
            fetcher = self.env['ssi.data.fetcher'].sudo().create({})
            fetcher.fetch_daily_ohlcv(symbol, from_date_str, to_date_str)
        except Exception:
            pass
            
        # Lấy dữ liệu 150 nến gần nhất từ Database
        df = pd.DataFrame()
        local_candles = self.env['stock.candle'].sudo().search([('ticker_id', '=', ticker.id)], order='date desc', limit=150)
        if local_candles:
            data_list = [{'Close': float(c.close), 'Volume': float(c.volume), 'TradingDate': c.date.strftime('%d/%m/%Y')} for c in local_candles]
            df = pd.DataFrame(data_list).sort_values('TradingDate', ascending=True)
            
        if df.empty:
            return {
                'status': 'error',
                'response_html': f'<p>Mã <b>{symbol}</b> hiện không có đủ dữ liệu lịch sử để Robot thực hiện phân tích kỹ thuật. Vui lòng thử mã khác.</p>'
            }
            
        real_latest_price = None
        real_latest_date = None
        
        # Cố gắng lấy giá intraday của ngày CHÍNH XÁC HÔM NAY từ API (Ưu tiên số 1)
        ssi_id = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_id', '')
        ssi_secret = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_consumer_secret', '')
        api_url = self.env['ir.config_parameter'].sudo().get_param('ai_trading.ssi_api_url', 'https://fc-data.ssi.com.vn/')
        
        if ssi_id and ssi_secret:
            try:
                from ssi_fc_data import fc_md_client, model as ssi_model
                class Config:
                    consumerID = ssi_id
                    consumerSecret = ssi_secret
                    url = api_url
                    stream_url = api_url
                client = fc_md_client.MarketDataClient(Config())
                
                to_date_str = datetime.now().strftime('%d/%m/%Y')
                req_today = ssi_model.daily_stock_price(symbol, to_date_str, to_date_str, 1, 1, ticker.market.lower())
                res_today = client.daily_stock_price(Config(), req_today)
                data_today = res_today if isinstance(res_today, dict) else json.loads(res_today)
                if str(data_today.get('status')) == '200' and data_today.get('data'):
                    today_data = data_today['data'][0]
                    match_price = today_data.get('MatchPrice')
                    close_price = today_data.get('ClosePrice')
                    price_val = match_price if match_price else close_price
                    if price_val:
                        real_latest_price = float(price_val)
                        real_latest_date_str = str(today_data.get('TradingDate', to_date_str))
                        real_latest_date = real_latest_date_str
                        
                        # --- Cập nhật trực tiếp nến Hôm nay vào Database để View nhìn thấy ngay ---
                        try:
                            trading_date = datetime.strptime(real_latest_date_str, '%d/%m/%Y').date()
                            existing = self.env['stock.candle'].sudo().search([
                                ('ticker_id', '=', ticker.id),
                                ('date', '=', trading_date)
                            ], limit=1)
                            
                            vals = {
                                'ticker_id': ticker.id,
                                'date': trading_date,
                                'close': real_latest_price,
                                'open': float(today_data.get('OpenPrice') or real_latest_price),
                                'high': float(today_data.get('HighestPrice') or real_latest_price),
                                'low': float(today_data.get('LowestPrice') or real_latest_price),
                                'volume': float(today_data.get('TotalVolumn') or today_data.get('TotalVolume') or 0),
                            }
                            if existing:
                                existing.sudo().write(vals)
                            else:
                                self.env['stock.candle'].sudo().create(vals)
                        except Exception:
                            pass
            except Exception: pass
            
        # Nếu API lỗi, lấy giá mới nhất toàn cục từ DB (Ưu tiên 2)
        if not real_latest_price:
            real_latest_candle = self.env['stock.candle'].sudo().search([('ticker_id', '=', ticker.id)], order='date desc', limit=1)
            real_latest_price = float(real_latest_candle.close) if real_latest_candle else float(df.iloc[-1]['Close'])
            real_latest_date = str(real_latest_candle.date) if real_latest_candle else str(df.iloc[-1].get('TradingDate', 'N/A'))

        # Đồng bộ Dữ liệu: Cập nhật DataFrame trước khi tính Pandas Indicators
        last_date_in_df = str(df.iloc[-1].get('TradingDate', 'N/A'))
        if last_date_in_df == real_latest_date:
            df.loc[df.index[-1], 'Close'] = real_latest_price
        else:
            new_row = pd.DataFrame([{'TradingDate': real_latest_date, 'Close': real_latest_price, 'Volume': 0}])
            df = pd.concat([df, new_row], ignore_index=True)
            
        # 3. Tính toán Chỉ báo
        df['sma20'] = df['Close'].rolling(window=20).mean()
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        exp1 = df['Close'].ewm(span=12, adjust=False).mean()
        exp2 = df['Close'].ewm(span=26, adjust=False).mean()
        df['macd'] = exp1 - exp2
        df['signal_line'] = df['macd'].ewm(span=9, adjust=False).mean()
        
        latest_row = df.iloc[-1]
        latest_price = float(latest_row['Close'])
        latest_date = str(latest_row.get('TradingDate', 'N/A'))
        rsi_val = float(latest_row['rsi']) if not np.isnan(latest_row['rsi']) else 50
        sma_val = float(latest_row['sma20']) if not np.isnan(latest_row['sma20']) else latest_price
        macd_val = float(latest_row['macd'])
        macd_signal = float(latest_row['signal_line'])
        
        # Kiểm tra xem mã này đã được gán vào chiến lược AI (FinRL model) nào chưa
        active_strategy = self.env['ai.strategy'].sudo().search([
            ('status', '=', 'active'),
            '|',
            ('ticker_ids', '=', False),
            ('ticker_ids', 'in', ticker.id)
        ], limit=1, order='id desc')
        
        # Nếu chưa có model backtest cho mã này
        if not active_strategy:
            html_no_model = self._render_no_model_html(symbol, latest_price, sma_val, rsi_val, latest_date)
            return {'status': 'success', 'response_html': html_no_model}
        
        # 3. Tính toán Chỉ báo (Chỉ chạy khi có model AI)
        # Tích hợp số liệu thực tế từ FinRL Backtest để có độ chính xác cao nhất
        ai_return = active_strategy.expected_return or 15.0
        ai_drawdown = abs(active_strategy.max_drawdown or 5.0)
        
        # Vùng mua động: Tính rủi ro theo Max Drawdown của model
        buy_zone_low = sma_val * (1 - (ai_drawdown * 0.3 / 100))
        buy_zone_high = sma_val * 1.01
        
        # Mục tiêu linh hoạt theo Lãi kỳ vọng (Expected Return) của model
        target_1 = latest_price * (1 + (ai_return * 0.5 / 100))
        target_2 = latest_price * (1 + (ai_return / 100))
        
        # Chốt chặn an toàn nếu model cho ra return quá thấp
        if target_1 <= latest_price * 1.02: target_1 = latest_price * 1.04
        if target_2 <= latest_price * 1.02: target_2 = latest_price * 1.08
        
        tech_signal = "TRUNG TÍNH"
        if rsi_val > 70: tech_signal = "QUÁ MUA (CẨN TRỌNG)"
        elif rsi_val < 30: tech_signal = "QUÁ BÁN (CƠ HỘI)"
        elif macd_val > macd_signal and rsi_val > 50: tech_signal = "TÍCH CỰC (MUA)"
        elif macd_val < macd_signal: tech_signal = "TIÊU CỰC (BÁN/HOLD)"
        
        # 4. LLM API
        expert_comment = self._get_llm_expert_analysis(
            symbol, latest_price, latest_date, tech_signal, buy_zone_low, buy_zone_high, target_1, target_2, rsi_val, sma_val, macd_val,
            active_strategy.algorithm or 'ppo',
            active_strategy.sharpe_ratio or 0.0,
            active_strategy.expected_return or 0.0,
            active_strategy.max_drawdown or 0.0
        )
        
        # 5. HTML Response & Advanced Metrics Calculation
        def fmt(v): return f"{v/1000:,.2f}"
        
        action_color = "#00d084" if "MUA" in tech_signal or "CƠ HỘI" in tech_signal else ("#e74c3c" if "BÁN" in tech_signal else "#f39c12")
        stars_label = "RẤT MẠNH" if rsi_val < 40 and macd_val > macd_signal else ("MẠNH" if macd_val > macd_signal else "KHÁ")
        
        # Logic Lãi kỳ vọng / Rủi ro và Vùng hỗ trợ / Vùng mua / Chốt lời / Cắt lỗ
        is_negative = "BÁN" in tech_signal or "TIÊU CỰC" in tech_signal
        if is_negative:
            zone_label = "Vùng canh bán"
            zone_value = f"{fmt(buy_zone_low)} - {fmt(buy_zone_high)}"
            target_label = "Ngưỡng cắt lỗ"
            target_value = f"{fmt(sma_val * 0.95)}"
            target_color = "#e74c3c"
            profit_label = "Rủi ro sụt giảm"
            drawdown = ((sma_val * 0.95 - latest_price) / latest_price * 100)
            display_profit = f"{drawdown:.2f}%"
        else:
            zone_label = "Vùng canh mua"
            zone_value = f"{fmt(buy_zone_low)} - {fmt(buy_zone_high)}"
            target_label = "Mục tiêu chốt lời"
            target_value = f"{fmt(target_1)} - {fmt(target_2)}"
            target_color = "#10b981"
            profit_label = "Lãi kỳ vọng"
            display_profit = f"+{((target_2 - latest_price) / latest_price * 100):.2f}%"

        # Calculate Gauge Score & Star Ratings (1-5)
        overall_score = min(max(int(rsi_val * 0.8 + (20 if macd_val > macd_signal else 0)), 10), 95)
        khq_color = "#10b981" if overall_score > 60 else ("#f59e0b" if overall_score > 40 else "#ef4444")
        khq_label = "Khả quan" if overall_score > 60 else ("Trung lập" if overall_score > 40 else "Kém khả quan")
        
        latest_vol = float(latest_row['Volume'])
        sma20_vol = df['Volume'].rolling(window=20).mean().iloc[-1] if 'Volume' in df else 1
        
        price_stars = 5 if latest_price > sma_val * 1.05 else (4 if latest_price > sma_val else 3)
        trend_stars = 5 if macd_val > macd_signal and macd_val > 0 else (4 if macd_val > macd_signal else 3)
        pos_stars = 4 if 40 < rsi_val < 70 else (3 if rsi_val >= 70 else 2)
        flow_stars = 5 if latest_vol > sma20_vol * 1.5 else (4 if latest_vol > sma20_vol else 3)
        volat_stars = 4
        base_stars = 4

        html = self._render_analysis_html(
            symbol, latest_price, sma_val, rsi_val, latest_date,
            action_color, tech_signal, display_profit, profit_label,
            zone_label, zone_value, target_label, target_color, target_value,
            stars_label, overall_score, khq_color, khq_label,
            price_stars, trend_stars, pos_stars, flow_stars, volat_stars, base_stars,
            expert_comment
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
    def _get_llm_expert_analysis(self, symbol, price, date, signal, buy_low, buy_high, t1, t2, rsi, sma, macd, algo, sharpe, return_pct, drawdown):
        def f(v): return f"{v/1000:,.2f}"
        fallback = f"Mã {symbol} đang giao dịch tại mức {f(price)}. Dữ liệu kỹ thuật cho thấy tín hiệu {signal} với vùng hỗ trợ quanh {f(buy_low)}."
        
        # Lấy năm từ date để AI có ngữ cảnh thời gian (nếu date là 2024-xx-xx)
        year_context = date[:4] if date and len(date) >= 4 else "hiện tại"
        
        prompt = f"""
NGỮ CẢNH THỊ TRƯỜNG & KẾT QUẢ AI BACKTEST:
- Mã cổ phiếu: {symbol} (Dữ liệu ngày {date} - Năm {year_context})
- Giá: {f(price)} | SMA20: {f(sma)} | RSI: {rsi:.1f} | MACD: {macd:.2f}
- Thuật toán AI: {algo.upper()} | Sharpe Ratio: {sharpe:.2f}
- Hiệu suất Backtest: Lãi kỳ vọng {return_pct:.2f}% | Sụt giảm tối đa (Max Drawdown): {drawdown:.2f}%
- Tín hiệu Robot: {signal}
- Vùng giá AI khuyến nghị: Mua {f(buy_low)}-{f(buy_high)} | Chốt lời T+: {f(t1)}-{f(t2)}

YÊU CẦU:
1. Tổng hợp dữ liệu kỹ thuật và kết quả Backtest AI ở trên để đưa ra LỜI KHUYÊN CHÍNH XÁC NHẤT.
2. Dùng kiến thức của bạn về doanh nghiệp {symbol} và bối cảnh ngành trong năm {year_context} để giải thích tại sao mức Lãi kỳ vọng ({return_pct:.2f}%) này là hợp lý hay rủi ro.
3. Đưa ra chiến lược giải ngân cụ thể (VD: chia vốn mua tại vùng hỗ trợ, cắt lỗ nếu thủng đáy).
4. Trình bày súc tích (3-4 câu), phong thái Giám đốc Phân tích, chuyên nghiệp và quyết đoán.
"""
        system_content = "Bạn là ARC Intelligence - Chuyên gia Chiến lược Đầu tư. Nhiệm vụ của bạn là biến những con số kỹ thuật khô khan thành các nhận định có chiều sâu về doanh nghiệp và thị trường. Phân tích phải có tính thời sự, am hiểu đặc tính của từng mã cổ phiếu (Bluechip, Midcap, đầu cơ...) và sử dụng thuật ngữ tài chính chuẩn xác."
        
        analysis = self._call_openrouter(prompt, system_content)
        if "Kết nối AI" in analysis:
            return fallback
        return analysis.replace('\n', '<br/>')
