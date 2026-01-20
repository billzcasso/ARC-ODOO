# -*- coding: utf-8 -*-
{
    'name': 'FMS - NAV',
    'version': '18.0.1.0.0',
    'category': 'Finance',
    'summary': 'NAV session and monthly NAV management',
    'description': """
FMS - NAV (Odoo 18)
===================

Net Asset Value management for fund certificates.

Key Features:
- Session NAV: Trading session NAV values with export
- Term rate configuration
- Upper/lower cap configuration
- Daily CCQ inventory tracking with cron automation
    """,
    'author': 'https://github.com/billzcasso',
    'license': 'LGPL-3',
    'depends': [
        # Odoo Core
        'base',
        'mail',
        'portal',
        'web',
        # FMS Modules
        'fund_management',          # Fund base models
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',
        # Data
        'data/nav_seed_data.xml',
        'data/nav_daily_cron.xml',
        # Backend Views
        'views/menu_views.xml',
        'views/nav_term_rate_views.xml',
        'views/nav_cap_config_views.xml',
        'views/nav_daily_inventory_views.xml',
        # Frontend Pages
        'views/nav_transaction/nav_transaction_page.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            # Styles (load order: variables -> mixins -> main)
            'nav_management/static/src/scss/_variables.scss',
            'nav_management/static/src/scss/_mixins.scss',
            'nav_management/static/src/scss/style.scss',
            # NAV Transaction Widget
            'nav_management/static/src/js/nav_transaction/nav_transaction_widget.js',
            'nav_management/static/src/js/nav_transaction/entrypoint.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
