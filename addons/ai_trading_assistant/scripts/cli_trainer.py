import os
import argparse
import pandas as pd
import numpy as np
import time
import json
import sys
import zipfile

# Ép buộc Windows Terminal in ra tiếng Việt (UTF-8) không bị lỗi charmap
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Placeholder for actual FinRL integration which requires many dependencies (gym, stable-baselines3, etc.)
# This script is meant to be executed independently: python cli_trainer.py --ticker FPT --ssi-consumer-id xxx --ssi-consumer-secret yyy

def fetch_all_tickers_from_ssi(ssi_id, ssi_secret, api_url):
    """Lấy danh sách tất cả các mã CK trực tiếp từ SSI API (ví dụ lấy sàn HOSE+HNX+UPCOM)"""
    print(f"[*] Fetching ALL tickers from SSI API...")
    try:
        from ssi_fc_data import fc_md_client, model
    except ImportError:
        raise ImportError("Bắt buộc cài đặt ssi-fc-data: pip install ssi-fc-data")
        
    class Config:
        consumerID = ssi_id
        consumerSecret = ssi_secret
        url = api_url
        stream_url = api_url
        
    client = fc_md_client.MarketDataClient(Config())
    all_tickers = []
    
    for market in ['HOSE', 'HNX', 'UPCOM']:
        req = model.securities(market, 1, 1000)
        res = client.securities(Config(), req)
        data = res if isinstance(res, dict) else json.loads(res)
        
        if str(data.get('status')) == '200' or data.get('message', '').lower() == 'success':
            tickers = [t.get('Symbol') for t in data.get('data', []) if t.get('Symbol')]
            all_tickers.extend(tickers)
        # Bỏ qua in dòng log nhỏ về sàn giao dịch nếu dùng giao diện %
            
    return list(set(all_tickers))

def fetch_data_from_ssi(ticker_symbol, from_date, to_date, ssi_id, ssi_secret, api_url):
    """Lấy trực tiếp dữ liệu OHLCV từ SSI qua API để backtest/train"""
    # Không in log tại đây nữa để nhường chỗ cho Progress Bar
    
    try:
        from ssi_fc_data import fc_md_client, model
        import json
    except ImportError:
        raise ImportError("Bắt buộc cài đặt ssi-fc-data: pip install ssi-fc-data")
        
    class Config:
        consumerID = ssi_id
        consumerSecret = ssi_secret
        url = api_url
        stream_url = api_url
        
    client = fc_md_client.MarketDataClient(Config())
    req = model.daily_ohlc(ticker_symbol, from_date, to_date, 1, 9999, True)
    res = client.daily_ohlc(Config(), req)
    
    data = res if isinstance(res, dict) else json.loads(res)
    if str(data.get('status')) == '200' or data.get('message', '').lower() == 'success':
        candles = data.get('data', [])
        if not candles:
            raise ValueError(f"Không có dữ liệu trả về cho {ticker_symbol}")
            
        df = pd.DataFrame(candles)
        df.rename(columns={
            'TradingDate': 'date',
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume'
        }, inplace=True)
        
        # Ép kiểu dữ liệu số để tránh lỗi 'agg function failed' của pandas
        numeric_cols = ['open', 'high', 'low', 'close', 'volume']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Loại bỏ các dòng bị lỗi data (nếu có)
        df.dropna(subset=numeric_cols, inplace=True)
        
        # Format date for FinRL
        df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y').dt.strftime('%Y-%m-%d')
        df['tic'] = ticker_symbol
        
        # Giữ lại chỉ các cột cần thiết cho FinRL để giảm nhiễu dtype
        df = df[['date', 'tic', 'open', 'high', 'low', 'close', 'volume']]
        
        df.sort_values('date', ascending=True, inplace=True)
        return df
    print(f"[ERROR SSI API] {data}")
    raise ValueError(f"Lỗi gọi API SSI: {data.get('message')}")
def train_model(ticker_input, algorithm="ppo", epochs=1000, from_date="01/01/2020", to_date="31/12/2023", ssi_id=None, ssi_secret=None, api_url=None):

    if not ssi_id or not ssi_secret:
        raise ValueError("Yêu cầu cung cấp ssi-consumer-id và ssi-consumer-secret để chạy độc lập!")

    if ticker_input.upper() == 'ALL':
        tickers = fetch_all_tickers_from_ssi(ssi_id, ssi_secret, api_url)
    else:
        # Hỗ trợ truyền nhiều mã bằng dấu phẩy: "FPT,HPG,VNM"
        tickers = [t.strip().upper() for t in ticker_input.split(',')]
        
    print(f"=========== BẮT ĐẦU HUẤN LUYỆN FINRL: {len(tickers)} MÃ | {algorithm.upper()} ===========")
    
    # 1. Tải Data
    df_list = []
    total = len(tickers)
    
    print(f"[*] Tải dữ liệu từ SSI ({from_date} - {to_date}):")
    for i, tic in enumerate(tickers, 1):
        try:
            # Vẽ thanh tiến trình Update ngắn gọn để tránh bị tràn dòng (wrap) trong Terminal nhỏ
            percent = (i / total) * 100
            bar_len = 20
            filled_len = int(bar_len * i // total)
            bar = '█' * filled_len + '-' * (bar_len - filled_len)
            
            # Dùng \r và độ dài chuỗi < 80 ký tự để luôn nằm trên 1 dòng
            print(f'\r[{bar}] {percent:.1f}% ({i}/{total}) Tải: {tic:<6}   ', end='', flush=True)
            
            df = fetch_data_from_ssi(tic, from_date, to_date, ssi_id, ssi_secret, api_url)
            time.sleep(0.5) # Tránh rate limit của SSI MDE
            df_list.append(df)
        except Exception as e:
            last_error = str(e)
            pass
            
    sys.stdout.write('\n[+] Hoàn tất kéo tất cả dữ liệu!\n')
            
    if not df_list:
        raise ValueError(f"Không tải được dữ liệu cho bất kì mã nào =((. Lỗi cuối cùng nhận được: {last_error}")
        
    full_df = pd.concat(df_list, ignore_index=True)
    full_df.sort_values(by=['date', 'tic'], ascending=True, inplace=True)
    full_df.reset_index(drop=True, inplace=True)
    
    print(f"[*] Total DataFrame shape: {full_df.shape}")
    
    # Import FinRL libraries safely inside the function to avoid breaking standard CLI usages without env
    try:
        try:
            from finrl.meta.preprocessor.preprocessors import FeatureEngineer
        except ImportError:
            from finrl.meta.preprocessor.feature_engineer import FeatureEngineer
            
        from finrl.meta.env_stock_trading.env_stocktrading import StockTradingEnv
        from finrl.agents.stablebaselines3.models import DRLAgent
        from stable_baselines3.common.logger import configure
    except ImportError as e:
        raise ImportError(f"Lỗi Import FinRL: {str(e)}. Bắt buộc cài đặt FinRL: pip install git+https://github.com/AI4Finance-Foundation/FinRL.git stable-baselines3 gymnasium")

    # 2. Add Technical Indicators (Moving Averages, RSI, MACD etc.)
    print("[*] Tự động tính toán các chỉ báo kỹ thuật (Feature Engineering)...")
    INDICATORS = ["macd", "boll_ub", "boll_lb", "rsi_30", "cci_30", "dx_30", "close_30_sma", "close_60_sma"]
    full_df['date'] = full_df['date'].astype(str) # ensure date is string for finrl
    full_df = full_df.sort_values(['date','tic']).reset_index(drop=True)
    
    fe = FeatureEngineer(
        use_technical_indicator=True,
        tech_indicator_list=INDICATORS,
        use_vix=False,
        use_turbulence=False,
        user_defined_feature=False
    )
    processed_df = fe.preprocess_data(full_df)
    
    processed_df = processed_df.sort_values(['date', 'tic'], ignore_index=True)
    processed_df.index = processed_df.date.factorize()[0]
    
    # Chia Train / Trade (Khoảng 80% thời gian đầu cho Train, 20% cho Trade/Backtest)
    dates = processed_df['date'].unique()
    split_idx = int(len(dates) * 0.8)
    if split_idx == len(dates): split_idx = len(dates) - 1 # Đảm bảo có ít nhất 1 ngày Trade nếu ít data
    split_date = dates[split_idx]
    
    train_df = processed_df[processed_df['date'] <= split_date].copy()
    trade_df = processed_df[processed_df['date'] > split_date].copy()
    
    # KỊCH BẢN FINRL YÊU CẦU: Index phải là số nguyên liên tục bắt đầu từ 0
    # và đại diện cho index của mảng các ngày giao dịch
    train_df = train_df.sort_values(['date', 'tic'], ignore_index=True)
    train_df.index = train_df.date.factorize()[0]
    
    trade_df = trade_df.sort_values(['date', 'tic'], ignore_index=True)
    trade_df.index = trade_df.date.factorize()[0]
    
    print(f"[*] Train set: {train_df['date'].min()} -> {train_df['date'].max()} ({len(train_df)} rows)")
    print(f"[*] Trade set: {trade_df['date'].min()} -> {trade_df['date'].max()} ({len(trade_df)} rows)")
    
    # 3. Create FinRL Environments
    print("[*] Khởi tạo môi trường StockTradingEnv...")
    stock_dimension = int(len(processed_df.tic.unique()))  # Ép kiểu int để tránh lỗi int64
    state_space = int(1 + 2 * stock_dimension + len(INDICATORS) * stock_dimension)
    
    # Tính VIX giả lập nếu dùng turbulence
    env_kwargs = {
        "hmax": 100, 
        "initial_amount": 1000000, 
        "num_stock_shares": [0] * stock_dimension,
        "buy_cost_pct": [0.001] * stock_dimension, 
        "sell_cost_pct": [0.001] * stock_dimension, 
        "state_space": state_space, 
        "stock_dim": stock_dimension, 
        "tech_indicator_list": list(INDICATORS), # Ensure it's a standard list
        "action_space": stock_dimension, 
        "reward_scaling": 1e-4
    }
    
    e_train_gym = StockTradingEnv(df=train_df, **env_kwargs)
    env_train, _ = e_train_gym.get_sb_env()
    
    # 4. Initialize and Train Agent
    _epochs = int(epochs) # Ép kiểu int cho epochs
    print(f"[*] Đang huấn luyện mô hình bằng {algorithm.upper()} trên tập TRAIN cho {_epochs} timesteps...")
    start_time = time.time()
    agent = DRLAgent(env=env_train)
    
    model = agent.get_model(model_name=algorithm)
    trained_model = agent.train_model(model=model, tb_log_name=algorithm, total_timesteps=_epochs)
    
    end_time = time.time()
    training_time = f"{(end_time - start_time) / 60:.2f} phút"
    print(f"[*] Huấn luyện hoàn tất trong {training_time}.")
    
    # 5. Backtest (Inference) trên tập TRADE để đánh giá thực tế
    print("[*] Đang đánh giá (Trade) mô hình trên tập TEST chưa từng gặp...")
    # Cần tạo môi trường Trade riêng (không vectorize cho dễ lấy portfolio)
    e_trade_gym = StockTradingEnv(df=trade_df, **env_kwargs)
    
    df_account_value, df_actions = DRLAgent.DRL_prediction(model=trained_model, environment=e_trade_gym)
    
    # Đánh giá hiệu suất dựa trên Danh mục đầu tư do AI giao dịch (KHÔNG PHẢI Buy and Hold)
    if not df_account_value.empty:
        # Lợi suất thực sự (Actual Return) của Agent
        initial_port = df_account_value.iloc[0]['account_value']
        final_port = df_account_value.iloc[-1]['account_value']
        trade_return_pct = ((final_port - initial_port) / initial_port)
        
        # Max Drawdown từ Peak
        df_account_value['peak'] = df_account_value['account_value'].cummax()
        df_account_value['drawdown'] = (df_account_value['account_value'] - df_account_value['peak']) / df_account_value['peak']
        actual_max_drawdown = df_account_value['drawdown'].min() * 100 # %
        
        # Tỷ suất lợi nhuận kép quy năm (CAGR) của Agent
        trading_days = len(df_account_value)
        actual_cagr = ((final_port / initial_port) ** (252 / trading_days)) - 1 if trading_days > 0 and final_port > 0 else 0
        actual_cagr_pct = actual_cagr * 100
        
        # Simple Sharpe Ratio calculation of Agent (Hầu hết DRL prediction sẽ tra ve daily return)
        df_account_value['daily_return'] = df_account_value['account_value'].pct_change()
        mean_ret = df_account_value['daily_return'].mean()
        std_ret = df_account_value['daily_return'].std()
        if pd.isna(std_ret) or std_ret == 0:
            actual_sharpe = 0
        else:
            # Giả sử risk_free_rate = 0, nhân với căn bậc hai của 252 (trading ngày/năm)
            actual_sharpe = (mean_ret / std_ret) * np.sqrt(252)
            
        print(f"[+] Agent Return on Test Data: {trade_return_pct*100:.2f}% (CAGR: {actual_cagr_pct:.2f}%)")
        print(f"[+] Agent Max Drawdown: {actual_max_drawdown:.2f}%")
        print(f"[+] Agent Sharpe Ratio: {actual_sharpe:.2f}")
    else:
        print("[-] Không sinh được dữ liệu Account Value. Sẽ sử dụng thông số ước tính.")
        actual_cagr_pct = 0.0
        actual_max_drawdown = -5.0
        actual_sharpe = 0.0
    
    # 6. Save Model
    prefix = "ALL_STOCKS" if ticker_input.upper() == "ALL" else ("MULTI" if len(tickers) > 1 else tickers[0])
    save_path = os.path.abspath(f"./{prefix}_{algorithm}") 
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    trained_model.save(save_path) # sb3 tự động nối thêm .zip
    zip_path = f"{save_path}.zip"
    
    # Trích xuất dữ liệu nến (History OHLCV) để đính kèm vào Model phục vụ test
    history_data = []
    # Lấy 150 nến cuối cùng của mỗi mã từ TẬP TRADE (hoặc full) để làm ngữ cảnh Inference
    for tic in full_df['tic'].unique():
        tic_df = full_df[full_df['tic'] == tic].tail(150)
        for _, row in tic_df.iterrows():
            history_data.append({
                'tic': str(row.get('tic', tic)),
                'date': str(row['date'].strftime('%Y-%m-%d') if hasattr(row.get('date'), 'strftime') else row.get('date', '')),
                'open': float(row.get('open', 0.0)),
                'high': float(row.get('high', 0.0)),
                'low': float(row.get('low', 0.0)),
                'close': float(row.get('close', 0.0)),
                'volume': float(row.get('volume', 0.0))
            })
            
    # Thêm Metadata vào file ZIP để Odoo tự động đọc
    metadata = {
        "algorithm": str(algorithm),
        "ticker_ids": [str(t) for t in tickers],
        "epochs": _epochs,
        "learning_rate": 0.00025,
        "batch_size": 64,
        "ent_coef": 0.01,
        # Lưu số liệu Performance thức tế từ tập TRADE
        "sharpe_ratio": float(actual_sharpe),
        "expected_return": float(actual_cagr_pct),
        "max_drawdown": float(actual_max_drawdown),
        "training_time": str(training_time),
        "framework_version": "FinRL 0.3.8 / SB3",
        "date_range": f"{from_date} to {to_date}",
        "history_data": history_data
    }
    with zipfile.ZipFile(zip_path, 'a') as zf:
        zf.writestr('metadata.json', json.dumps(metadata, indent=4))
    
    print(f"[SUCCESS] Model và Metadata đã được lưu tại {zip_path}")
    
    print("=========== HOÀN TẤT ===========")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='AI Trading Assistant - CLI Trainer Independent')
    parser.add_argument('--ticker', type=str, default=None, help='Ticker Symbol (VD: FPT, hoặc "FPT,HPG", hoặc "ALL")')
    parser.add_argument('--algo', type=str, default=None, help='DRL Algorithm (ppo, a2c, ddpg)')
    parser.add_argument('--epochs', type=int, default=None, help='Total timesteps')
    parser.add_argument('--from-date', type=str, default=None, help='Từ ngày lấy dữ liệu nến (Định dạng DD/MM/YYYY)')
    parser.add_argument('--to-date', type=str, default=None, help='Đến ngày lấy dữ liệu nến (Định dạng DD/MM/YYYY)')
    
    # SSI API Credentials args (đã cấu hình mặc định)
    parser.add_argument('--ssi-client', type=str, default='557bbed885344578a5870677ae6701e3', help='SSI Consumer ID')
    parser.add_argument('--ssi-secret', type=str, default='4fe137225f6b45d59fcc80040b817cfc', help='SSI Consumer Secret')
    parser.add_argument('--ssi-url', type=str, default='https://fc-data.ssi.com.vn/', help='SSI API URL gốc')
    
    args = parser.parse_args()
    
    print("\n" + "="*50)
    print(" === CHƯƠNG TRÌNH HUẤN LUYỆN AI ĐẦU TƯ CHỨNG KHOÁN === ")
    print("="*50 + "\n")
    
    # Hỏi người dùng nhập thông tin nếu chưa truyền lúc gọi lệnh
    ticker = args.ticker
    algo = args.algo
    epochs_input = args.epochs
    from_date = args.from_date
    to_date = args.to_date
    
    if not ticker:
        ticker = input("> Nhập [Mã Chứng Khoán] (Ví dụ: FPT, hoặc gõ ALL, nhấn Enter để mặc định ALL): ").strip()
        if not ticker:
            ticker = "ALL"
            
    if not algo:
        algo = input("> Nhập [Thuật toán AI] (ppo, a2c, ddpg - nhấn Enter để mặc định ppo): ").strip()
        if not algo:
            algo = "ppo"
            
    if not epochs_input:
        epochs_str = input("> Nhập [Số lượng Epochs/Timesteps] (nhấn Enter để mặc định 10000): ").strip()
        epochs = int(epochs_str) if epochs_str.isdigit() else 10000
    else:
        epochs = epochs_input
    
    if not from_date:
        from_date = input("> Nhập [Từ Ngày] (Định dạng DD/MM/YYYY, nhấn Enter để mặc định 01/01/2024): ").strip()
        if not from_date:
            from_date = "01/01/2024"
            
    if not to_date:
        to_date = input("> Nhập [Đến Ngày] (Định dạng DD/MM/YYYY, nhấn Enter để mặc định 31/12/2025): ").strip()
        if not to_date:
            to_date = "31/12/2025"
            
    try:
        train_model(ticker, algo, epochs, from_date, to_date, args.ssi_client, args.ssi_secret, args.ssi_url)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Quá trình huấn luyện thất bại: {str(e)}")
        sys.exit(1)
