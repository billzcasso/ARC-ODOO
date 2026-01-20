from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import random
import string

import secrets

class StatusInfo(models.Model):
    _name = 'status.info'
    _description = 'Investor Status Information'

    partner_id = fields.Many2one('res.partner', string='Partner', required=True, ondelete='cascade')
    account_number = fields.Char(string="Account Number", readonly=True, copy=False)
    referral_code = fields.Char(string="Referral Code", readonly=True, copy=False)
    account_status = fields.Selection([
        ('approved', 'Approved'),
        ('pending', 'Pending'),
        ('rejected', 'Rejected')
    ], string="Account Status", default='pending', required=True)
    profile_status = fields.Selection([
        ('complete', 'Complete'),
        ('incomplete', 'Incomplete')
    ], string="Profile Status", default='incomplete', required=True)
    
    # New Field for Auto-Approval Logic
    ekyc_verified = fields.Boolean(string="eKYC Verified", default=False, readonly=True)
    
    # Relationship Manager
    rm_id = fields.Many2one('res.users', string='Relationship Manager')

    @api.model
    def create(self, vals):
        # Generate random referral code
        if not vals.get('referral_code'):
            while True:
                referral_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
                if not self.search([('referral_code', '=', referral_code)]):
                    vals['referral_code'] = referral_code
                    break

        # Auto-generate account number (HDC + 5 secure random digits)
        if not vals.get('account_number'):
            while True:
                # Use secrets for cryptographically strong random numbers
                random_digits = ''.join(secrets.choice(string.digits) for _ in range(5))
                account_number = f"ARC{random_digits}"
                # Check uniqueness
                if not self.search([('account_number', '=', account_number)]):
                    vals['account_number'] = account_number
                    break

        return super().create(vals)

    @api.constrains('partner_id')
    def _check_unique_partner(self):
        for record in self:
            if record.partner_id:
                duplicate = self.search([
                    ('partner_id', '=', record.partner_id.id),
                    ('id', '!=', record.id)
                ])
                if duplicate:
                    raise ValidationError(_('Each partner can only have one status record.'))



    @api.constrains('account_status', 'profile_status')
    def _check_status_consistency(self):
        for record in self:
            if record.account_status == 'approved' and record.profile_status == 'incomplete':
                raise ValidationError(_('Cannot approve account when profile is incomplete.'))

    @api.model
    def _check_and_update_profile_status(self, partner_id):
        """Check and update profile status based on entered information"""
        status_info = self.search([('partner_id', '=', partner_id)], limit=1)
        if not status_info:
            return

        partner = self.env['res.partner'].browse(partner_id)
        
        # Check personal information
        profile = self.env['investor.profile'].search([
            ('partner_id', '=', partner_id),
            ('name', '!=', False),
            ('birth_date', '!=', False),
            ('gender', '!=', False),
            ('nationality', '!=', False),
            ('id_type', '!=', False),
            ('id_number', '!=', False),
            ('id_issue_date', '!=', False),
            ('id_issue_place', '!=', False),
            ('id_front', '!=', False),
            ('id_back', '!=', False)
        ], limit=1)

        # Check bank account information
        bank_account = self.env['investor.bank.account'].search([
            ('partner_id', '=', partner_id),
            ('bank_name', '!=', False),
            ('account_number', '!=', False),
            ('account_holder', '!=', False),
            ('branch', '!=', False)
        ], limit=1)

        # Check address information
        address = self.env['investor.address'].search([
            ('partner_id', '=', partner_id),
            ('address_type', 'in', ['permanent', 'current']),
            ('street', '!=', False),
            ('district', '!=', False),
            ('ward', '!=', False),
            ('state_id', '!=', False),
            ('country_id', '!=', False)
        ], limit=1)

        # If all information is complete, update profile status
        if profile and bank_account and address:
            status_info.write({'profile_status': 'complete'})
        else:
            status_info.write({'profile_status': 'incomplete'})

    def set_approved(self):
        self.write({'account_status': 'approved', 'profile_status': 'complete'})


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def create(self, vals):
        partner = super(ResPartner, self).create(vals)
        # Only create status info for partner that is a user (not company, not child contact)
        if not partner.parent_id and not partner.is_company:
            status_model = partner.env['status.info']
            # Check if already exists, if not create
            if not status_model.search([('partner_id', '=', partner.id)], limit=1):
                status_model.create({'partner_id': partner.id})
        return partner