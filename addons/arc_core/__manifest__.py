# -*- coding: utf-8 -*-
{
    'name': 'FMS - Core',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Central dependency aggregator for HDC-FMS system',
    'description': """
FMS - Core (Odoo 18)
====================

Meta-module aggregating all HDC-FMS dependencies for unified installation.

Purpose:
- Single installation point for entire FMS stack
- Reduces circular dependency risks
- Consistent upgrade management
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
        # Auth & Permissions
        'custom_auth',
        'user_permission_management',
        # Data & Integration
        'payos_gateway',
        'stock_data',
        # Investor Domain
        'investor_profile_management',
        'investor_list',
        # Fund Domain
        'fund_management_control',
        'fund_management',
        'asset_management',
        # Trading & Transactions
        'stock_trading',
        'transaction_management',
        'order_matching',
        # NAV & Overview
        'nav_management',
        'overview_fund_management',
        'fund_management_dashboard',
        # Reporting
        'report_list',
        # AI Assistant (chatbot global availability)
        'ai_trading_assistant',
    ],
    'data': [],
    'assets': {},
    'installable': True,
    'application': True,
    'auto_install': False,
}
