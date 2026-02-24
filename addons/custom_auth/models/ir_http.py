import logging
from odoo import models
from odoo.http import request

_logger = logging.getLogger(__name__)

class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    @classmethod
    def _dispatch(cls, endpoint):
        response = super(IrHttp, cls)._dispatch(endpoint)
        
        # Ensure response exists and has headers attribute
        if response and hasattr(response, 'headers'):
            _logger.debug("Injecting global security headers")
            
            # Content Security Policy (CSP)
            # Restrict sources to self, inline scripts for UI, and specific domains if needed
            if 'Content-Security-Policy' not in response.headers:
                csp_rules = [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://code.jquery.com https://cdn.jsdelivr.net",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                    "img-src 'self' data: https:",
                    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                    "connect-src 'self' wss: https: http:",
                    "frame-src 'self' https://pay.payos.vn",
                    "frame-ancestors 'self'",
                    "object-src 'none'",
                ]
                response.headers['Content-Security-Policy'] = "; ".join(csp_rules)
            
            # HTTP Strict Transport Security (HSTS)
            if 'Strict-Transport-Security' not in response.headers:
                # Require HTTPS for 1 year, including subdomains
                response.headers['Strict-Transport-Security'] = "max-age=31536000; includeSubDomains; preload"
            
            # X-Frame-Options (prevent clickjacking, though CSP frame-ancestors is present)
            if 'X-Frame-Options' not in response.headers:
                response.headers['X-Frame-Options'] = "SAMEORIGIN"
                
            # X-Content-Type-Options (prevent MIME-sniffing)
            if 'X-Content-Type-Options' not in response.headers:
                response.headers['X-Content-Type-Options'] = "nosniff"
                
            # Referrer-Policy
            if 'Referrer-Policy' not in response.headers:
                response.headers['Referrer-Policy'] = "strict-origin-when-cross-origin"
                
        return response
