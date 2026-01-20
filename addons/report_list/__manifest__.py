# -*- coding: utf-8 -*-
{
    'name': 'FMS - Reports',
    'version': '18.0.1.0.26',
    'category': 'Finance',
    'summary': 'Comprehensive balance, transaction and investor reports',
    'description': """
FMS - Reports (Odoo 18)
=======================

Comprehensive reporting module for fund management.

Report Types:
- Balance reports (Tài sản)
- Transaction reports (Giao dịch)
- Investor reports (Nhà đầu tư)
- Tenors and interest rates list (Lãi suất)

Features:
- XLSX export for all report types
- Frontend report pages
- Backend report views
    """,
    'author': 'https://github.com/billzcasso',
    'license': 'LGPL-3',
    'depends': [
        # Odoo Core
        'base',
        'web',
        # FMS Modules
        'fund_management',  # Portfolio investment model
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',
        # Backend Views
        'views/report_list_backend_views.xml',
        # Balance Report
        'views/report_balance/report_balance_page.xml',
        # Transaction Report
        'views/report_transaction/report_transaction_page.xml',
        # Investor Report
        'views/investor_report/investor_report_page.xml',
        # Tenors Interest Rates
        'views/list_tenors_interest_rates/list_tenors_interest_rates_page.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            # Styles
            'report_list/static/src/scss/report_list.scss',
            # Report Widgets
            'report_list/static/src/js/report_balance/report_balance_widget.js',
            'report_list/static/src/js/report_balance/entrypoint.js',
            'report_list/static/src/js/report_transaction/report_transaction_widget.js',
            'report_list/static/src/js/report_transaction/entrypoint.js',
            'report_list/static/src/js/investor_report/investor_report_widget.js',
            'report_list/static/src/js/investor_report/entrypoint.js',
            'report_list/static/src/js/list_tenors_interest_rates/list_tenors_interest_rates_widget.js',
            'report_list/static/src/js/list_tenors_interest_rates/entrypoint.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}