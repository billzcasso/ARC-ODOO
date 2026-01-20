from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import re
import base64
import logging
import os

_logger = logging.getLogger(__name__)

class InvestorProfile(models.Model):
    _name = 'investor.profile'
    _description = 'Personal Information'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'name'

    name = fields.Char(string='Họ và tên', required=True)
    partner_id = fields.Many2one('res.partner', string='Partner', required=True, ondelete='cascade')
    user_id = fields.Many2one('res.users', string='User', compute='_compute_user_id', store=True, index=True)
    birth_date = fields.Date(string='Ngày sinh', required=True)
    gender = fields.Selection([
        ('male', 'Nam'),
        ('female', 'Nữ'),
        ('other', 'Khác')
    ], string='Giới tính', required=True)
    nationality = fields.Many2one('res.country', string='Quốc tịch', required=True)
    id_type = fields.Selection([
        ('id_card', 'CMND/CCCD'),
        ('passport', 'Hộ chiếu'),
        ('other', 'Khác')
    ], string='Loại giấy tờ', required=True)
    id_number = fields.Char(string='Số giấy tờ', required=True)
    id_issue_date = fields.Date(string='Ngày cấp', required=True)
    id_issue_place = fields.Char(string='Nơi cấp', required=True)
    id_front = fields.Binary(string='ID Front:', attachment=True)
    id_front_filename = fields.Char(string='ID Mặt Trước Filename')
    id_front_path = fields.Char(string='ID Front Path', help='Path to front ID image in filesystem')
    id_back = fields.Binary(string='ID Back:', attachment=True)
    id_back_filename = fields.Char(string='ID Mặt Sau Filename')
    id_back_path = fields.Char(string='ID Back Path', help='Path to back ID image in filesystem')
    phone = fields.Char(string='Phone Number:')
    email = fields.Char(string='Email:')

    # Bank account information
    bank_account_ids = fields.One2many('investor.bank.account', 'investor_id', string='Tài khoản ngân hàng')

    # Address information
    address_ids = fields.One2many('investor.address', 'investor_id', string='Địa chỉ')

    # Status information
    status_info_ids = fields.One2many('status.info', 'partner_id', string='Thông tin trạng thái')

    @api.depends('partner_id')
    def _compute_user_id(self):
        for record in self:
            if record.partner_id:
                user = self.env['res.users'].search([('partner_id', '=', record.partner_id.id)], limit=1)
                record.user_id = user.id if user else False
            else:
                record.user_id = False

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        if self.partner_id:
            self.name = self.partner_id.name
            self.phone = self.partner_id.phone
            self.email = self.partner_id.email

    @api.constrains('phone')
    def _check_phone(self):
        for record in self:
            if record.phone:
                # Remove all non-digit characters for validation
                phone_digits = re.sub(r'[^0-9]', '', record.phone)
                if len(phone_digits) != 10:
                    raise ValidationError(_('Số điện thoại phải có đúng 10 chữ số.'))

    @api.constrains('email')
    def _check_email(self):
        for record in self:
            if record.email:
                if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', record.email):
                    raise ValidationError(_('Email không hợp lệ.'))

    @api.constrains('birth_date')
    def _check_birth_date(self):
        for record in self:
            if record.birth_date:
                if record.birth_date > fields.Date.today():
                    raise ValidationError(_('Ngày sinh không thể lớn hơn ngày hiện tại.'))

    @api.constrains('id_number', 'id_type')
    def _check_id_number(self):
        for record in self:
            if record.id_type == 'id_card' and record.id_number:
                # Remove any spaces or dashes
                clean_number = re.sub(r'[\s\-]', '', record.id_number)
                # CCCD mới: đúng 12 chữ số, CMND cũ: 9 chữ số
                if len(clean_number) == 12:
                    if not re.match(r'^[0-9]{12}$', clean_number):
                        raise ValidationError(_('Số CCCD phải có đúng 12 chữ số.'))
                elif len(clean_number) == 9:
                    if not re.match(r'^[0-9]{9}$', clean_number):
                        raise ValidationError(_('Số CMND phải có đúng 9 chữ số.'))
                else:
                    raise ValidationError(_('Số CMND/CCCD không hợp lệ. CCCD mới có 12 chữ số, CMND cũ có 9 chữ số.'))
            elif record.id_type == 'passport' and record.id_number:
                if not re.match(r'^[A-Z][0-9]{7}$', record.id_number):
                    raise ValidationError(_('Số hộ chiếu không hợp lệ. Vui lòng nhập theo định dạng: 1 chữ cái in hoa + 7 chữ số.'))

    @api.constrains('id_issue_date')
    def _check_id_issue_date(self):
        for record in self:
            if record.id_issue_date:
                if record.id_issue_date > fields.Date.today():
                    raise ValidationError(_('Ngày cấp không thể lớn hơn ngày hiện tại.'))
                if record.birth_date and record.id_issue_date < record.birth_date:
                    raise ValidationError(_('Ngày cấp không thể nhỏ hơn ngày sinh.'))

    @api.constrains('partner_id')
    def _check_unique_partner(self):
        """Ensure one profile per partner"""
        for record in self:
            if record.partner_id:
                existing = self.search([
                    ('partner_id', '=', record.partner_id.id),
                    ('id', '!=', record.id)
                ])
                if existing:
                    raise ValidationError(_('Đã tồn tại hồ sơ cho đối tác này.'))

    def _get_thread_with_access(self, thread_id, **kwargs):
        """Override mail.thread method for Odoo 18 compatibility"""
        return self.browse(thread_id).exists()

    def write(self, vals):
        # Xử lý filename cho CCCD images nếu có
        if 'id_front' in vals and vals['id_front']:
            if 'id_front_filename' not in vals:
                vals['id_front_filename'] = 'cccd_front.jpg'
            # Nếu có id_front_path, cập nhật nó thành binary
            if vals.get('id_front_path'):
                try:
                    with open(vals['id_front_path'], 'rb') as f:
                        vals['id_front'] = base64.b64encode(f.read())
                except Exception as e:
                    _logger.error('Error reading front ID image: %s', str(e))

        if 'id_back' in vals and vals['id_back']:
            if 'id_back_filename' not in vals:
                vals['id_back_filename'] = 'cccd_back.jpg'
            # Nếu có id_back_path, cập nhật nó thành binary
            if vals.get('id_back_path'):
                try:
                    with open(vals['id_back_path'], 'rb') as f:
                        vals['id_back'] = base64.b64encode(f.read())
                except Exception as e:
                    _logger.error('Error reading back ID image: %s', str(e))
        
        res = super().write(vals)
        if self.partner_id:
            self.env['status.info']._check_and_update_profile_status(self.partner_id.id)
        return res

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            if record.partner_id:
                self.env['status.info']._check_and_update_profile_status(record.partner_id.id)
        return records

    @api.onchange('id_front')
    def _onchange_id_front(self):
        """Auto-set filename when id_front is uploaded"""
        if self.id_front and not self.id_front_filename:
            self.id_front_filename = 'cccd_front.jpg'

    @api.onchange('id_back')
    def _onchange_id_back(self):
        """Auto-set filename when id_back is uploaded"""
        if self.id_back and not self.id_back_filename:
            self.id_back_filename = 'cccd_back.jpg'

    def get_id_front_url(self):
        """Get URL for front ID image"""
        if self.id_front_path and os.path.exists(self.id_front_path):
            return f"/id_images/{os.path.basename(self.id_front_path)}"
        elif self.id_front:
            return f"/web/image?model=investor.profile&field=id_front&id={self.id}"
        return False

    def get_id_back_url(self):
        """Get URL for back ID image"""
        if self.id_back_path and os.path.exists(self.id_back_path):
            return f"/id_images/{os.path.basename(self.id_back_path)}"
        elif self.id_back:
            return f"/web/image?model=investor.profile&field=id_back&id={self.id}"
        return False

    def download_id_front(self):
        """Download front ID image"""
        if self.id_front:
            return {
                'type': 'ir.actions.act_url',
                'url': self.get_id_front_url(),
                'target': 'new',
            }
        return False

    def download_id_back(self):
        """Download back ID image"""
        if self.id_back:
            return {
                'type': 'ir.actions.act_url',
                'url': self.get_id_back_url(),
                'target': 'new',
            }
        return False

