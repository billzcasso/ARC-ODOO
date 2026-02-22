{
    'name': 'FMS - AI',
    'version': '1.0',
    'category': 'Finance',
    'summary': 'Tích hợp dữ liệu SSI, huấn luyện bằng FinRL để phân tích cổ phiếu & gợi ý giao dịch',
    'description': """
        Module Odoo hỗ trợ:
        - Kết nối API SSI (REST & Streaming) để lấy dữ liệu OHLCV.
        - Tự động train AI model sử dụng Reinforcement Learning (FinRL).
        - Cung cấp Chatbot / Trợ lý ra quyết định Mua/Bán/Nắm giữ trên Odoo.
    """,
    'author': 'Your Company',
    'website': 'https://www.yourcompany.com',
    'depends': ['base', 'mail', 'web'], # mail is used for chatter/bot features if needed
    'data': [
        'data/ssi_api_config.xml',
        'security/ir.model.access.csv',
        'views/stock_ticker_views.xml',
        'views/ssi_config_views.xml',
        'views/ssi_data_fetcher_views.xml',
        'views/ai_training_history_views.xml',
        'views/ai_strategy_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'ai_trading_assistant/static/src/scss/ai_chatbot.scss',
            'ai_trading_assistant/static/src/js/ai_chatbot.js',
            'ai_trading_assistant/static/src/xml/ai_chatbot.xml',
        ],
    },
    'application': True,
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
