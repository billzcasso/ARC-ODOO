# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging
from ..services.streaming_manager import StreamingManager
# from ..utils.ssi_gateway import SSIGateway # Used in other models

_logger = logging.getLogger(__name__)


class SSIApiConfig(models.Model):
    """Configuration for SSI FastConnect Data API"""
    _name = 'ssi.api.config'
    _description = 'SSI API Configuration'
    _rec_name = 'name'

    name = fields.Char('Configuration Name', required=True, default='Default Configuration')
    
    # API Credentials
    consumer_id = fields.Char('Consumer ID', required=True)
    consumer_secret = fields.Char('Consumer Secret', required=True)
    
    # API URLs
    api_url = fields.Char('API URL', required=True, default='https://fc-data.ssi.com.vn/')
    stream_url = fields.Char(
        'Stream URL', 
        default='https://fc-datahub.ssi.com.vn/',
        help='Streaming endpoint URL (use https://, SDK will convert to wss:// automatically)'
    )
    
    # Status
    is_active = fields.Boolean('Is Active', default=True)
    last_sync_date = fields.Datetime('Last Sync Date', readonly=True)
    last_sync_status = fields.Selection([
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('not_synced', 'Not Synced')
    ], string='Last Sync Status', default='not_synced', readonly=True)
    
    # Streaming Configuration
    streaming_enabled = fields.Boolean(
        'Streaming Enabled', 
        default=False,
        help='Enable real-time WebSocket streaming'
    )
    streaming_channel = fields.Selection([
        ('X', 'Best Prices (X) - Recommended'),
        ('B', 'OHLC Data (B)'),
        ('MI', 'Index Data (MI)'),
        ('F', 'Securities Status (F)'),
        ('ALL', 'All Data (High Volume!)')
    ], string='Streaming Channel', default='X')
    
    streaming_status = fields.Selection([
        ('stopped', 'Stopped'),
        ('running', 'Running'),
        ('error', 'Error')
    ], string='Streaming Status', default='stopped', readonly=True)
    
    streaming_symbols = fields.Char(
        'Target Symbols (Legacy)',
        help='Comma-separated symbols to subscribe (e.g., VNM,VIC,VHM). Leave empty for all.'
    )
    
    # Priority Securities (New Way)
    priority_securities_ids = fields.Many2many(
        'ssi.securities', 
        string='Tracked Symbols',
        help='Select specific symbols to prioritize for streaming updates.'
    )
    
    # Advanced Streaming Settings
    streaming_batch_size = fields.Integer(
        'Batch Size', 
        default=5000,
        help='Number of messages to process in one batch for efficiency.'
    )
    streaming_batch_timeout = fields.Float(
        'Batch Timeout (s)', 
        default=5.0,
        digits=(4, 2),
        help='Max time to wait for batch to fill before processing.'
    )
    streaming_queue_size = fields.Integer(
        'Queue Size', 
        default=10000,
        help='Max messages in queue before dropping oldest.'
    )
    streaming_enable_bus = fields.Boolean(
        'Enable Bus Updates',
        default=True,
        help='Push real-time price updates to web clients via bus.bus.'
    )
    streaming_last_error = fields.Text(
        'Last Error',
        readonly=True,
        help='Last streaming error message'
    )
    streaming_started_at = fields.Datetime(
        'Streaming Started At',
        readonly=True
    )

    @api.model
    def get_config(self):
        """Get active configuration"""
        config = self.search([('is_active', '=', True)], limit=1)
        return config

    def action_start_streaming(self):
        """Start WebSocket streaming for real-time data using new Manager."""
        self.ensure_one()
        _logger.info("=== action_start_streaming called ===")
        
        manager = StreamingManager.get_instance()
        
        # ALWAYS force stop first to clear any stale state (fixes F5 reload issue)
        _logger.info("Force stopping any existing streaming connection...")
        manager.stop_streaming()
        manager.callbacks = []  # Clear stale callbacks
        
        import time
        time.sleep(0.5)  # Brief pause for cleanup
        
        # Configure with db_name for proper cursor management
        manager.configure(self, db_name=self.env.cr.dbname)
        
        # Determine symbols
        symbols = []
        if self.priority_securities_ids:
            symbols = [s.symbol for s in self.priority_securities_ids if s.symbol]
        elif self.streaming_symbols:
            symbols = [s.strip().upper() for s in self.streaming_symbols.split(',') if s.strip()]
            
        # Auto-create missing securities if specific symbols are requested
        if symbols:
            self.env['ssi.securities'].ensure_securities_exist(symbols)
        
        channels = [self.streaming_channel or 'X']
        
        # Start streaming
        try:
            success = manager.start_streaming(channels=channels, symbols=symbols)
            
            if success:
                self.write({
                    'streaming_enabled': True,
                    'streaming_status': 'running',
                    'streaming_started_at': fields.Datetime.now(),
                    'streaming_last_error': False,
                })
                
                # Register securities model callback for database updates
                self.env['ssi.securities'].register_streaming_callback()
                
                # Initialize bus publisher if enabled
                if self.streaming_enable_bus:
                    from ..services.streaming_bus import StreamingBusPublisher
                    StreamingBusPublisher.get_instance(self.env.cr.dbname)
                
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': _('Streaming Started'),
                        'message': _('WebSocket streaming is now active on channel %s with %d symbols') % (
                            self.streaming_channel, 
                            len(symbols) if symbols else 'ALL'
                        ),
                        'type': 'success',
                        'sticky': False,
                    }
                }
            else:
                self.write({
                    'streaming_status': 'error',
                    'streaming_last_error': 'Failed to start streaming'
                })
                raise UserError(_('Failed to start streaming. Check logs for details.'))
                
        except Exception as e:
            _logger.exception("Error starting streaming: %s", e)
            self.write({
                'streaming_status': 'error',
                'streaming_last_error': str(e)
            })
            raise UserError(_('Streaming error: %s') % str(e))

    def action_stop_streaming(self):
        """Stop WebSocket streaming gracefully."""
        self.ensure_one()
        
        manager = StreamingManager.get_instance()
        manager.stop_streaming()
        
        self.write({
            'streaming_enabled': False,
            'streaming_status': 'stopped'
        })
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Streaming Stopped'),
                'message': _('WebSocket streaming has been stopped gracefully'),
                'type': 'info',
                'sticky': False,
            }
        }

    def action_check_streaming_status(self):
        """Check streaming health status via Manager."""
        self.ensure_one()
        
        manager = StreamingManager.get_instance()
        health = manager.get_health()
        
        # Build status message
        status_lines = [
            f"State: {health.get('state', 'unknown')}",
            f"Health Score: {health.get('health_score', 0)}/100",
            f"Queue: {health.get('queue_size', 0)}/{health.get('queue_capacity', 0)}",
            f"Messages: {health.get('statistics', {}).get('messages_processed', 0)} processed",
            f"Reconnects: {health.get('reconnect_attempts', 0)}",
        ]
        
        if health.get('issues'):
            status_lines.append(f"Issues: {', '.join(health.get('issues', []))}")
        
        # Update status field based on health
        if health.get('is_healthy'):
            new_status = 'running'
        elif health.get('state') == 'disconnected':
            new_status = 'stopped'
        else:
            new_status = 'error'
        
        self.write({'streaming_status': new_status})
        
        notification_type = 'success' if health.get('is_healthy') else 'warning'
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Streaming Status: %s') % ('Healthy' if health.get('is_healthy') else 'Unhealthy'),
                'message': '\n'.join(status_lines),
                'type': notification_type,
                'sticky': True,
            }
        }
    
    def action_get_streaming_stats(self):
        """Get detailed streaming statistics (for debugging)."""
        self.ensure_one()
        
        manager = StreamingManager.get_instance()
        status = manager.get_status()
        
        # Format for display
        import json
        formatted = json.dumps(status, indent=2, default=str)
        
        return {
            'type': 'ir.actions.act_window',
            'name': _('Streaming Statistics'),
            'res_model': 'ir.ui.view',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_name': 'Streaming Stats',
                'default_arch': f'<pre>{formatted}</pre>',
            }
        }
