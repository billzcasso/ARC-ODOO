# -*- coding: utf-8 -*-
{
    'name': 'FMS - Funds',
    'version': '18.0.1.1.0',
    'category': 'Assets',
    'summary': 'Core fund management with buy/sell transactions',
    'description': """
FMS - Funds (Odoo 18)
===============================

Core module for managing investment funds with complete transaction lifecycle.

Key Features:
- Fund certificate management
- Investment buy/sell workflows with OTP verification
- Digital signature integration
- Account balance tracking
- Balance history and comparison views
- Signed contract management
- Frontend investor portal
    """,
    'author': 'https://github.com/billzcasso',
    'license': 'LGPL-3',
    'depends': [
        # Odoo Core
        'base',
        'bus',
        'mail',
        'portal',
        'web',
        'stock_data',
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',
        # Data
        'data/fund_sync_cron.xml',
        # Core Views
        'views/fund/fund.xml',
        'views/investment/investment_views.xml',
        'views/transaction/transaction_views.xml',
        'views/fund/fund_action.xml',
        'views/fund/fund_menu.xml',
        # Account & Balance
        'views/account_balance/account_balance_views.xml',
        'views/account_balance/account_balance_page.xml',
        'views/balance_history/balance_history_views.xml',
        'views/comparison/comparison_views.xml',
        'views/signed_contract/signed_contract_views.xml',
        # Frontend Pages
        'views/fund/fund_page.xml',
        'views/fund/fund_compare.xml',
        # Buy Flow
        'views/fund/fund_buy/fund_buy.xml',
        'views/fund/fund_buy/fund_confirm.xml',
        'views/fund/fund_buy/fund_result.xml',
        'views/fund/fund_buy/fee_template.xml',
        'views/fund/fund_buy/terms_modal_template.xml',
        'views/fund/fund_buy/signature_modal_template.xml',
        # Sell Flow
        'views/fund/fund_sell/fund_sell.xml',
        'views/fund/fund_sell/fund_sell_confirm.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            # SCSS Design System
            'fund_management/static/src/scss/fm_variables.scss',
            'fund_management/static/src/scss/smart_otp.scss',
            'fund_management/static/src/scss/fund_management.scss',
            'fund_management/static/src/scss/fund_result.scss',
            'fund_management/static/src/scss/normal_order_form.scss',
            # OTP Module
            'fund_management/static/src/js/otp/smart_otp_modal.js',
            # Fund Widget
            'fund_management/static/src/js/fund/entry_fund.js',
            'fund_management/static/src/js/fund/fund_widget.js',
            # Buy Flow
            'fund_management/static/src/js/fund/fund_buy/fund_buy.js',
            'fund_management/static/src/js/fund/fund_buy/fund_confirm.js',
            'fund_management/static/src/js/fund/fund_buy/normal_order_form.js',
            'fund_management/static/src/js/fund/fund_buy/entry_normal_order.js',
            'fund_management/static/src/js/fund/fund_buy/fund_result.js',
            # Signature Module
            'fund_management/static/src/js/fund/signature/signature_sign.js',
            # Sell Flow
            'fund_management/static/src/js/fund/fund_sell/fund_sell.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
