from odoo import models, fields, api

class ReportBalance(models.Model):
    _inherit = 'portfolio.investment'
    
    # --- REPORT SPECIFIC FIELDS (Computed) ---
    
    report_account_number = fields.Char(string="Số tài khoản", compute='_compute_report_fields', store=True)
    report_investor_name = fields.Char(string="Nhà đầu tư", compute='_compute_report_fields', store=True)
    report_phone_number = fields.Char(string="Số điện thoại", compute='_compute_report_fields', store=True)
    report_id_number = fields.Char(string="ĐKSH", compute='_compute_report_fields', store=True)
    report_email = fields.Char(string="Email", compute='_compute_report_fields', store=True)

    report_fund_name = fields.Char(string="Quỹ", related='fund_id.name', store=True)
    report_program_name = fields.Char(string="Chương trình", related='fund_id.name', store=True)
    report_program_ticker = fields.Char(string="Mã CCQ", related='fund_id.ticker', store=True)
    report_ccq_quantity = fields.Float(string="Số lượng CCQ", related='units', store=True)
    
    report_print_date = fields.Date(string="Ngày in", compute='_compute_print_date')
    
    def _compute_print_date(self):
        today = fields.Date.today()
        for rec in self:
            rec.report_print_date = today
    
    @api.depends('user_id', 'user_id.partner_id', 'fund_id')
    def _compute_report_fields(self):
        for rec in self:
            partner = rec.user_id.partner_id if rec.user_id else False
            
            # 1. Account Number
            account_number = ''
            status_info = False
            profile = False
            
            if partner:
                status_info = self.env['status.info'].sudo().search([('partner_id', '=', partner.id)], limit=1)
                profile = self.env['investor.profile'].sudo().search([('partner_id', '=', partner.id)], limit=1)
                
                if status_info and status_info.account_number:
                    account_number = status_info.account_number
                elif partner.ref:
                    account_number = partner.ref
                else:
                    account_number = partner.name
            
            rec.report_account_number = account_number
            rec.report_investor_name = partner.name if partner else (rec.user_id.name if rec.user_id else '')
            rec.report_phone_number = partner.phone if partner else ''
            rec.report_email = partner.email if partner else ''
            rec.report_id_number = profile.id_number if profile and profile.id_number else '-'
