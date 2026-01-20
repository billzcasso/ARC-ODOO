# -*- coding: utf-8 -*-
{
    'name': 'FMS - Configs',
    'version': '18.0.1.0.0',
    'category': 'Finance',
    'summary': 'Fund certificates, schemes, fees and master data configuration',
    'description': """
FMS - Fund Certificate Configs (Odoo 18)
=======================================

Administrative module for managing fund certificates, schemes, fees and master data.

Key Features:
- Fund certificate management with sync
- Scheme and scheme type configuration
- Fee schedule management
- SIP (Systematic Investment Plan) settings
- Tax settings configuration
- Master data: holidays, banks, branches, countries, cities, wards
    """,
    'author': 'https://github.com/billzcasso',
    'license': 'LGPL-3',
    'depends': [
        # Odoo Core
        'base',
        'bus',
        'mail',
        'web',
        # FMS Modules
        'fund_management_dashboard',  # Dashboard integration
        'investor_list',              # Investor data
        'stock_data',                 # Market data
        'nav_management'
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',
        # Data
        'data/cron_data.xml',
        # Wizard (must load before menu_views.xml for action reference)
        'wizard/wizard_sync_fund_view.xml',
        # Fund Certificate
        'views/fund_certificate/sync_action.xml',
        # Menu
        'views/menu_views.xml',
        'views/fund_certificate/fund_certificate_page.xml',
        'views/fund_certificate/fund_certificate_form.xml',
        'views/fund_certificate/fund_certificate_edit_form.xml',
        # Master Data
        'views/holiday/holiday_page.xml',
        'views/holiday/holiday_form.xml',
        'views/bank/bank_page.xml',
        'views/bank/bank_form.xml',
        'views/bank_branch/bank_branch_page.xml',
        'views/bank_branch/bank_branch_form.xml',
        # Term Rate
        'views/term_rate/term_rate_page.xml',
    ],
    'assets': {
        'web.assets_backend': [
            # Styles
            'fund_management_control/static/src/scss/style.scss',
            # Widget Mounting Service
            'fund_management_control/static/src/js/widget_mounting_service.js',
            # Sidebar Entrypoint (Centralized)
            'fund_management_control/static/src/js/sidebar/sidebar_entrypoint.js',
            # Fund Certificate Widget
            'fund_management_control/static/src/js/fund_certificate/fund_certificate_widget.js',
            'fund_management_control/static/src/js/fund_certificate/entrypoint.js',
            # Master Data Widgets
            'fund_management_control/static/src/js/holiday/holiday_widget.js',
            'fund_management_control/static/src/js/holiday/entrypoint.js',
            'fund_management_control/static/src/js/bank/bank_widget.js',
            'fund_management_control/static/src/js/bank/entrypoint.js',
            'fund_management_control/static/src/js/bank_branch/bank_branch_widget.js',
            'fund_management_control/static/src/js/bank_branch/entrypoint.js',
            # Term Rate Widget
            'fund_management_control/static/src/js/term_rate/term_rate_widget.js',
            'fund_management_control/static/src/js/term_rate/entrypoint.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
