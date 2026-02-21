# -*- coding: utf-8 -*-
"""
SSI Streaming Manager - Production Ready Implementation
Features:
- Singleton pattern with thread-safe access
- Exponential backoff reconnection
- Message queue with batch processing
- Connection state tracking
- Graceful shutdown
- Health monitoring
"""
import logging
import threading
import time
import json
from datetime import datetime
from enum import Enum
from queue import Queue, Empty, Full

try:
    from ssi_fc_data import fc_md_client, fc_md_stream
    SSI_AVAILABLE = True
except ImportError:
    SSI_AVAILABLE = False

_logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================
HEARTBEAT_INTERVAL = 30  # seconds - max time without message before reconnect
RECONNECT_DELAYS = [1, 2, 5, 10, 30, 60, 120]  # Exponential backoff delays
DEFAULT_QUEUE_SIZE = 10000
DEFAULT_BATCH_SIZE = 5           # Small batch for near real-time
DEFAULT_BATCH_TIMEOUT = 0.1      # seconds - process quickly


class ConnectionState(Enum):
    """Connection state enumeration"""
    DISCONNECTED = 'disconnected'
    CONNECTING = 'connecting'
    CONNECTED = 'connected'
    RECONNECTING = 'reconnecting'
    ERROR = 'error'


# =============================================================================
# StreamingManager - Singleton
# =============================================================================
class StreamingManager:
    """
    Production-Ready Singleton Manager for SSI WebSocket Streaming.
    
    Features:
    - Daemon thread for WebSocket connection
    - Message queue with batch processing
    - Heartbeat monitor thread
    - Exponential backoff auto-reconnect
    - Thread-safe singleton access
    - Graceful shutdown
    - Health status reporting
    """
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        if not SSI_AVAILABLE:
            _logger.error("SSI SDK not available. StreamingManager disabled.")
            return
        
        # Core state
        self._state = ConnectionState.DISCONNECTED
        self._state_changed_at = None
        self._streaming = False
        
        # SSI clients
        self._stream_client = None
        self._stream_listener = None
        self._config = None
        
        # Timing
        self._last_msg_time = None
        self._connected_at = None
        
        # Reconnection
        self._reconnect_attempt = 0
        self._max_reconnect_attempts = 50
        
        # Threading
        self._stop_event = threading.Event()
        self._monitor_thread = None
        self._processor_thread = None
        
        # Message queue
        self._message_queue = None
        self._queue_size = DEFAULT_QUEUE_SIZE
        self._batch_size = DEFAULT_BATCH_SIZE
        self._batch_timeout = DEFAULT_BATCH_TIMEOUT
        
        # Callbacks and channels
        self.callbacks = []
        self.active_channels = {}
        
        # Statistics
        self._stats = {
            'messages_received': 0,
            'messages_processed': 0,
            'messages_dropped': 0,
            'reconnect_count': 0,
            'errors': 0,
        }
        
        # Database info (for cursor management)
        self._db_name = None
        self._enable_bus = False

    @classmethod
    def get_instance(cls):
        """Thread-safe Singleton Access"""
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """Reset singleton (for testing)"""
        with cls._lock:
            if cls._instance:
                cls._instance.stop_streaming()
            cls._instance = None

    # =========================================================================
    # Configuration
    # =========================================================================
    def configure(self, app_config, db_name=None):
        """
        Configure the stream with credentials from ssi.api.config
        
        Args:
            app_config: Odoo config record with consumer_id, consumer_secret, etc.
            db_name: Odoo database name for cursor management
        """
        class Config:
            pass
        
        self._config = Config()
        self._config.consumerID = app_config.consumer_id
        self._config.consumerSecret = app_config.consumer_secret
        self._config.url = app_config.api_url
        
        # Normalize stream_url: negotiate step needs https://, SDK will convert to wss:// for WebSocket
        stream_url = app_config.stream_url or 'https://fc-datahub.ssi.com.vn/'
        if stream_url.startswith('wss://'):
            stream_url = stream_url.replace('wss://', 'https://', 1)
        elif stream_url.startswith('ws://'):
            stream_url = stream_url.replace('ws://', 'http://', 1)
        self._config.stream_url = stream_url
        
        self._config.auth_type = 'Bearer'
        
        # Optional advanced settings
        if hasattr(app_config, 'streaming_batch_size') and app_config.streaming_batch_size:
            self._batch_size = app_config.streaming_batch_size
        if hasattr(app_config, 'streaming_batch_timeout') and app_config.streaming_batch_timeout:
            self._batch_timeout = app_config.streaming_batch_timeout
        if hasattr(app_config, 'streaming_queue_size') and app_config.streaming_queue_size:
            self._queue_size = app_config.streaming_queue_size
        if hasattr(app_config, 'streaming_enable_bus'):
            self._enable_bus = app_config.streaming_enable_bus
        
        self._db_name = db_name
        
        # Initialize message queue
        self._message_queue = Queue(maxsize=self._queue_size)
        
        _logger.info("StreamingManager configured: batch_size=%d, queue_size=%d", 
                     self._batch_size, self._queue_size)

    # =========================================================================
    # Start / Stop
    # =========================================================================
    def start_streaming(self, channels=None, symbols=None):
        """
        Start the streaming connection.
        
        Args:
            channels: list of channel codes ['X', 'B', 'MI', 'F']
            symbols: list of symbols ['VNM', 'VIC'] - empty for all
            
        Returns:
            bool: True if started successfully
        """
        if not SSI_AVAILABLE:
            _logger.error("SSI SDK not available")
            return False
            
        if not self._config:
            _logger.error("StreamingManager not configured. Call configure() first.")
            return False

        if self._streaming:
            _logger.warning("Streaming already running. Stopping first...")
            self.stop_streaming()
            time.sleep(1)

        self._set_state(ConnectionState.CONNECTING)
        self._stop_event.clear()
        self._reconnect_attempt = 0
        
        # Initialize queue if not done
        if not self._message_queue:
            self._message_queue = Queue(maxsize=self._queue_size)
        
        try:
            # Initialize SSI Clients
            self._stream_client = fc_md_client.MarketDataClient(self._config)
            self._stream_listener = fc_md_stream.MarketDataStream(
                self._config, 
                self._stream_client,
                on_close=self._on_close,
                on_open=self._on_open
            )
            
            # Prepare channel string
            # Format: "X:VNM,VIC" or "X" for all
            selected_channel = self._build_channel_string(channels, symbols)
            self.active_channels = {'channels': channels, 'symbols': symbols, 'string': selected_channel}
            
            _logger.info("Starting SSI Stream on channel: %s", selected_channel)
            
            # Start background threads FIRST
            self._start_monitor_thread()
            self._start_processor_thread()
            
            # Start Stream Connection in a separate thread (as SDK start might be blocking)
            # Use the full selected channel string immediately
            _logger.info("Initializing connection with channel: %s", selected_channel)
            
            self._streaming = True
            self._connected_at = datetime.now()
            self._last_msg_time = datetime.now()
            self._set_state(ConnectionState.CONNECTING)
            
            self._connection_thread = threading.Thread(target=self._run_stream_connection, args=(selected_channel,))
            self._connection_thread.daemon = True
            self._connection_thread.start()
            
            _logger.info("SSI Streaming background thread started")
            return True
            
        except Exception as e:
            _logger.exception("Failed to start streaming: %s", e)
            self._streaming = False
            self._set_state(ConnectionState.ERROR)
            self._stats['errors'] += 1
            return False

    def _run_stream_connection(self, channel):
        """Run SSI SDK start in a thread because it might be blocking"""
        if not self._stream_listener:
            return
            
        try:
            # Note: This might block forever depending on SDK implementation
            self._stream_listener.start(
                self._on_message,
                self._on_error,
                channel
            )
        except Exception as e:
            _logger.error("Stream connection thread failed: %s", e)
            self._set_state(ConnectionState.DISCONNECTED)

    def stop_streaming(self):
        """Gracefully stop streaming"""
        _logger.info("Graceful shutdown initiated...")
        
        self._stop_event.set()
        self._streaming = False
        self._set_state(ConnectionState.DISCONNECTED)
        
        # Wait for queue to drain (max 5 seconds)
        if self._message_queue:
            drain_deadline = time.time() + 5
            while not self._message_queue.empty() and time.time() < drain_deadline:
                time.sleep(0.1)
            
            # Clear remaining
            while not self._message_queue.empty():
                try:
                    self._message_queue.get_nowait()
                    self._stats['messages_dropped'] += 1
                except Empty:
                    break
        
        # Close WebSocket connection
        if self._stream_listener:
            try:
                if hasattr(self._stream_listener, 'connection'):
                    self._stream_listener.connection.close()
            except Exception as e:
                _logger.warning("Error closing stream connection: %s", e)
        
        # Wait for threads to finish
        if self._monitor_thread and self._monitor_thread.is_alive():
            self._monitor_thread.join(timeout=2)
        if self._processor_thread and self._processor_thread.is_alive():
            self._processor_thread.join(timeout=2)
        
        self._stream_listener = None
        self._stream_client = None
        
        _logger.info("Streaming stopped. Stats: %s", self._stats)

    # =========================================================================
    # Callbacks Registration
    # =========================================================================
    def register_callback(self, callback):
        """Register a function to be called on new data"""
        if callback not in self.callbacks:
            self.callbacks.append(callback)
            _logger.debug("Callback registered: %s", callback.__name__)

    def unregister_callback(self, callback):
        """Unregister a callback"""
        if callback in self.callbacks:
            self.callbacks.remove(callback)

    # =========================================================================
    # WebSocket Event Handlers
    # =========================================================================
    def _on_message(self, message):
        """Handle incoming WebSocket message"""
        # Debug: Log every message received -- DISABLED for performance
        # _logger.info("SSI Message Received: %s", str(message)[:200])
        
        self._last_msg_time = datetime.now()
        self._stats['messages_received'] += 1
        
        # Reset reconnect counter on successful message
        if self._reconnect_attempt > 0:
            self._reconnect_attempt = 0
        
        # Put message in queue
        try:
            self._message_queue.put_nowait(message)
        except Full:
            # Queue full - drop oldest message
            try:
                self._message_queue.get_nowait()
                self._stats['messages_dropped'] += 1
            except Empty:
                pass
            try:
                self._message_queue.put_nowait(message)
            except Full:
                self._stats['messages_dropped'] += 1
                _logger.warning("Message queue full, message dropped")

    def _on_error(self, error):
        """Handle WebSocket error"""
        _logger.error("SSI Stream Error: %s", error)
        self._stats['errors'] += 1
        
        if self._state == ConnectionState.CONNECTED:
            self._set_state(ConnectionState.ERROR)

    def _on_open(self):
        """Handle WebSocket connection opened"""
        _logger.info("WebSocket connection opened")
        self._set_state(ConnectionState.CONNECTED)
        self._connected_at = datetime.now()
        self._reconnect_attempt = 0

    def _on_close(self):
        """Handle WebSocket connection closed"""
        _logger.warning("WebSocket connection closed")
        if self._streaming and not self._stop_event.is_set():
            self._set_state(ConnectionState.RECONNECTING)

    # =========================================================================
    # Background Threads
    # =========================================================================
    def _start_monitor_thread(self):
        """Start the heartbeat monitor thread"""
        self._monitor_thread = threading.Thread(
            target=self._monitor_connection, 
            daemon=True,
            name="SSI-StreamMonitor"
        )
        self._monitor_thread.start()

    def _start_processor_thread(self):
        """Start the message processor thread"""
        self._processor_thread = threading.Thread(
            target=self._process_queue, 
            daemon=True,
            name="SSI-StreamProcessor"
        )
        self._processor_thread.start()

    def _monitor_connection(self):
        """
        Background thread to monitor connection health.
        Triggers reconnection if no message received for HEARTBEAT_INTERVAL.
        """
        _logger.info("Heartbeat Monitor Started")
        
        while not self._stop_event.is_set():
            time.sleep(5)  # Check every 5 seconds
            
            if not self._streaming:
                continue
            
            # Check last message time
            if self._last_msg_time:
                delta = (datetime.now() - self._last_msg_time).total_seconds()
                
                if delta > HEARTBEAT_INTERVAL:
                    _logger.warning("No data for %.1f seconds. Possible disconnect.", delta)
                    
                    # Check if we should reconnect
                    if self._is_trading_hours():
                        _logger.info("Trading hours active, triggering reconnect...")
                        self._reconnect()
                    else:
                        _logger.debug("Outside trading hours, skipping reconnect")
        
        _logger.info("Heartbeat Monitor Stopped")

    def _process_queue(self):
        """
        Background thread to process message queue in batches.
        Uses batch processing for efficiency.
        """
        _logger.info("Message Processor Started (batch_size=%d, timeout=%.2fs)", 
                     self._batch_size, self._batch_timeout)
        
        while not self._stop_event.is_set():
            batch = []
            
            # Get first message (block with timeout)
            try:
                msg = self._message_queue.get(timeout=0.05)  # Short timeout for responsiveness
                batch.append(msg)
            except Empty:
                continue
            
            # Quickly grab any additional messages without waiting
            while len(batch) < self._batch_size:
                try:
                    msg = self._message_queue.get_nowait()
                    batch.append(msg)
                except Empty:
                    break  # No more messages available, process what we have
            
            # Process batch immediately
            if batch:
                self._process_batch(batch)
        
        _logger.info("Message Processor Stopped")

    def _process_batch(self, batch):
        """Process a batch of messages"""
        if not batch:
            return
            
        # Pass the ENTIRE batch to callbacks to enable bulk processing
        for callback in self.callbacks:
            try:
                callback(batch)
                self._stats['messages_processed'] += len(batch)
            except Exception as e:
                _logger.error("Callback error: %s", e)
                self._stats['errors'] += 1

    # =========================================================================
    # Reconnection Logic
    # =========================================================================
    def _reconnect(self):
        """
        Attempt to restart the stream with exponential backoff.
        """
        if self._reconnect_attempt >= self._max_reconnect_attempts:
            _logger.error("Max reconnect attempts (%d) reached. Giving up.", 
                         self._max_reconnect_attempts)
            self._set_state(ConnectionState.ERROR)
            return False
        
        self._set_state(ConnectionState.RECONNECTING)
        self._stats['reconnect_count'] += 1
        
        # Calculate delay with exponential backoff
        delay_index = min(self._reconnect_attempt, len(RECONNECT_DELAYS) - 1)
        delay = RECONNECT_DELAYS[delay_index]
        
        _logger.info("Reconnect attempt %d/%d (delay: %ds)", 
                     self._reconnect_attempt + 1, self._max_reconnect_attempts, delay)
        
        self._reconnect_attempt += 1
        
        # Stop current connection
        if self._stream_listener:
            try:
                if hasattr(self._stream_listener, 'connection'):
                    self._stream_listener.connection.close()
            except:
                pass
        
        # Wait before reconnecting
        time.sleep(delay)
        
        if self._stop_event.is_set():
            return False
        
        # Attempt restart
        channels = self.active_channels.get('channels')
        symbols = self.active_channels.get('symbols')
        
        try:
            # Reinitialize clients
            self._stream_client = fc_md_client.MarketDataClient(self._config)
            self._stream_listener = fc_md_stream.MarketDataStream(
                self._config, 
                self._stream_client,
                on_close=self._on_close,
                on_open=self._on_open
            )
            
            selected_channel = self._build_channel_string(channels, symbols)
            
            self._stream_listener.start(
                self._on_message,
                self._on_error,
                selected_channel
            )
            
            self._last_msg_time = datetime.now()
            self._set_state(ConnectionState.CONNECTED)
            _logger.info("Reconnection successful")
            return True
            
        except Exception as e:
            _logger.error("Reconnection failed: %s", e)
            self._stats['errors'] += 1
            return False

    # =========================================================================
    # Helpers
    # =========================================================================
    def _set_state(self, state):
        """Update connection state with timestamp"""
        self._state = state
        self._state_changed_at = datetime.now()
        _logger.debug("State changed to: %s", state.value)

    def _build_channel_string(self, channels, symbols):
        """Build SSI channel subscription string"""
        if not channels:
            # Don't default to X (ALL). Fail if no channel provided.
            _logger.warning("_build_channel_string called without channels")
            return None
            
        chan_str = channels[0] if isinstance(channels, list) else channels
        selected_channel = chan_str
        
        if symbols:
            # Handle special case for ALL
            if symbols == 'ALL' or (isinstance(symbols, list) and 'ALL' in symbols):
                 selected_channel = f"{chan_str}:ALL"
            elif isinstance(symbols, list):
                # Check for empty strings in list and STRIP whitespace
                valid_symbols = [str(s).strip().upper() for s in symbols if s and str(s).strip()]
                if valid_symbols:
                     # USER FIX: Use hyphen '-' as separator instead of comma ','
                     selected_channel = f"{chan_str}:{'-'.join(valid_symbols)}"
            else:
                selected_channel = f"{chan_str}:{str(symbols).strip()}"
        
        return selected_channel

    def _is_trading_hours(self):
        """
        Check if current time is within trading hours.
        Vietnam stock market: 9:00 - 15:00, Mon-Fri
        """
        now = datetime.now()
        
        # Weekend check
        if now.weekday() > 4:  # Saturday=5, Sunday=6
            return False
        
        # Hour check (9:00 - 15:00)
        hour = now.hour
        minute = now.minute
        
        # Before 9:00
        if hour < 9:
            return False
        
        # After 15:00
        if hour > 15 or (hour == 15 and minute > 0):
            return False
        
        return True

    # =========================================================================
    # Status & Health
    # =========================================================================
    def get_status(self):
        """
        Get comprehensive status of the streaming connection.
        
        Returns:
            dict: Status information including state, timing, queue, stats
        """
        queue_size = 0
        if self._message_queue:
            queue_size = self._message_queue.qsize()
        
        return {
            'state': self._state.value,
            'streaming': self._streaming,
            'connected_at': self._connected_at.isoformat() if self._connected_at else None,
            'state_changed_at': self._state_changed_at.isoformat() if self._state_changed_at else None,
            'last_message_at': self._last_msg_time.isoformat() if self._last_msg_time else None,
            'queue_size': queue_size,
            'queue_capacity': self._queue_size,
            'reconnect_attempts': self._reconnect_attempt,
            'active_channels': self.active_channels,
            'statistics': self._stats.copy(),
            'is_trading_hours': self._is_trading_hours(),
            'callbacks_count': len(self.callbacks),
        }

    def get_health(self):
        """
        Get health status with score.
        
        Returns:
            dict: Health information with score (0-100)
        """
        status = self.get_status()
        
        # Calculate health score
        score = 100
        issues = []
        
        # State check
        if status['state'] != 'connected':
            score -= 40
            issues.append(f"State is {status['state']}")
        
        # Reconnect attempts
        if status['reconnect_attempts'] > 0:
            penalty = min(status['reconnect_attempts'] * 10, 30)
            score -= penalty
            issues.append(f"{status['reconnect_attempts']} reconnect attempts")
        
        # Queue backlog
        if status['queue_size'] > status['queue_capacity'] * 0.5:
            score -= 20
            issues.append(f"Queue at {status['queue_size']}/{status['queue_capacity']}")
        elif status['queue_size'] > status['queue_capacity'] * 0.2:
            score -= 10
        
        # Error rate
        if status['statistics']['errors'] > 10:
            score -= 10
            issues.append(f"{status['statistics']['errors']} errors")
        
        # Message processing
        received = status['statistics']['messages_received']
        processed = status['statistics']['messages_processed']
        if received > 0 and processed / received < 0.9:
            score -= 10
            issues.append(f"Processing rate: {processed}/{received}")
        
        return {
            'is_healthy': score >= 50,
            'health_score': max(score, 0),
            'issues': issues,
            **status
        }
