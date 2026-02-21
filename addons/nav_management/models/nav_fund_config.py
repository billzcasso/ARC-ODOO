# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class NavFundConfig(models.Model):
    """NAV Fund Configuration – stores initial NAV price, CCQ quantity and
    capital-cost percentage per fund.  Referenced by daily-inventory
    fallback logic, fund_management_control sync, overview_fund_management,
    asset_management, and fund_management controllers."""

    _name = 'nav.fund.config'
    _description = 'Cấu hình quỹ NAV'
    _order = 'id desc'

    fund_id = fields.Many2one(
        'portfolio.fund',
        string='Quỹ',
        required=True,
        index=True,
    )
    initial_nav_price = fields.Float(
        string='Giá NAV ban đầu',
        digits=(16, 2),
        default=0.0,
    )
    initial_ccq_quantity = fields.Float(
        string='Số lượng CCQ ban đầu',
        digits=(16, 2),
        default=0.0,
    )
    capital_cost_percent = fields.Float(
        string='Chi phí vốn (%)',
        digits=(16, 4),
        default=0.0,
    )
    description = fields.Char(string='Mô tả')
    active = fields.Boolean(string='Kích hoạt', default=True)

    _sql_constraints = [
        ('uniq_fund', 'unique(fund_id)',
         'Mỗi quỹ chỉ được có một cấu hình NAV!'),
    ]

    @api.constrains('initial_nav_price', 'initial_ccq_quantity', 'capital_cost_percent')
    def _check_positive(self):
        for rec in self:
            if rec.initial_nav_price < 0:
                raise ValidationError(_('Giá NAV ban đầu không được âm.'))
            if rec.initial_ccq_quantity < 0:
                raise ValidationError(_('Số lượng CCQ ban đầu không được âm.'))
            if rec.capital_cost_percent < 0 or rec.capital_cost_percent > 100:
                raise ValidationError(_('Chi phí vốn phải nằm trong khoảng 0% đến 100%.'))
