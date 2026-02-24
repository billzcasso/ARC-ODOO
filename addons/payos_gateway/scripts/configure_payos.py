"""
Script để cấu hình PayOS credentials vào Odoo
Chạy script này trong Odoo shell để tự động cấu hình PayOS credentials
"""
import odoo
from odoo import api, SUPERUSER_ID

def configure_payos_credentials():
    """
    Cấu hình PayOS credentials vào ir.config_parameter
    """
    # PayOS credentials
    import os
    CLIENT_ID = os.getenv('PAYOS_CLIENT_ID', 'placeholder_client_id')
    API_KEY = os.getenv('PAYOS_API_KEY', 'placeholder_api_key')
    CHECKSUM_KEY = os.getenv('PAYOS_CHECKSUM_KEY', 'placeholder_checksum_key')
    
    # Khởi tạo Odoo registry
    env = odoo.api.Environment(odoo.registry(odoo.tools.config['db_name']), SUPERUSER_ID, {})
    
    # Lấy ir.config_parameter
    params = env['ir.config_parameter'].sudo()
    
    # Cấu hình PayOS credentials
    params.set_param('payos.client_id', CLIENT_ID)
    params.set_param('payos.api_key', API_KEY)
    params.set_param('payos.checksum_key', CHECKSUM_KEY)
    
    print("✅ Đã cấu hình PayOS credentials thành công!")
    print(f"   Client ID: {CLIENT_ID}")
    print(f"   API Key: {API_KEY[:20]}...")
    print(f"   Checksum Key: {CHECKSUM_KEY[:20]}...")

if __name__ == '__main__':
    configure_payos_credentials()

