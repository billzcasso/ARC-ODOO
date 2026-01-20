# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging
from datetime import datetime, timedelta, timezone
import time
from ..utils.ssi_gateway import SSIGateway, SSIConnectionError, SSIDataError
from ..services.streaming_manager import StreamingManager

_logger = logging.getLogger(__name__)

# Vietnam timezone (UTC+7)
VN_TIMEZONE = timezone(timedelta(hours=7))

def vn_now():
    """Get current datetime in Vietnam timezone"""
    return datetime.now(VN_TIMEZONE)

class Securities(models.Model):
    """Securities/Market Data Table"""
    _name = 'ssi.securities'
    _description = 'Securities Master Data'
    _order = 'symbol asc'
    _rec_name = 'symbol'
    
    # Cache for rate limiting Intraday inserts
    _last_tick_save = {}

    # Identity
    symbol = fields.Char('Symbol', required=True, index=True)
    market = fields.Selection([
        ('HOSE', 'HOSE'),
        ('HNX', 'HNX'),
        ('UPCOM', 'UPCOM')
    ], string='Market', required=True, index=True)
    
    # Details
    floor_code = fields.Char('Floor Code')
    security_type = fields.Char('Security Type')
    stock_name_vn = fields.Char('StockName (VN)')
    stock_name_en = fields.Char('StockEnName (EN)')
    
    # Price Info (Board View)
    reference_price = fields.Float('Ref Price', digits=(12, 3))
    ceiling_price = fields.Float('Ceiling', digits=(12, 3))
    floor_price = fields.Float('Floor', digits=(12, 3))
    
    # Live Data
    today_open_price = fields.Float('Open Price', digits=(12, 3))
    current_price = fields.Float('Current Price', digits=(12, 3))
    avg_price = fields.Float('Avg Price', digits=(12, 3))
    high_price = fields.Float('High', digits=(12, 3))
    low_price = fields.Float('Low', digits=(12, 3))
    volume = fields.Float('Volume')
    total_value = fields.Float('Total Value', digits=(20, 3))
    last_volume = fields.Float('Last Volume')
    est_match_price = fields.Float('Est. Match Price', digits=(12, 3))
    
    # Best Bid/Ask (Top 3)
    bid_price_1 = fields.Float('Bid Price 1', digits=(12, 3))
    bid_vol_1 = fields.Float('Bid Vol 1')
    bid_price_2 = fields.Float('Bid Price 2', digits=(12, 3))
    bid_vol_2 = fields.Float('Bid Vol 2')
    bid_price_3 = fields.Float('Bid Price 3', digits=(12, 3))
    bid_vol_3 = fields.Float('Bid Vol 3')
    
    ask_price_1 = fields.Float('Ask Price 1', digits=(12, 3))
    ask_vol_1 = fields.Float('Ask Vol 1')
    ask_price_2 = fields.Float('Ask Price 2', digits=(12, 3))
    ask_vol_2 = fields.Float('Ask Vol 2')
    ask_price_3 = fields.Float('Ask Price 3', digits=(12, 3))
    ask_vol_3 = fields.Float('Ask Vol 3')
    
    change = fields.Float('Change', digits=(12, 3), compute='_compute_change', store=True)
    change_percent = fields.Float('Change %', digits=(12, 3), compute='_compute_change', store=True)
    
    last_update = fields.Datetime('Last Update', default=fields.Datetime.now)
    is_active = fields.Boolean('Active', default=True)

    # Relations
    currency_id = fields.Many2one('res.currency', string='Currency', default=lambda self: self.env.ref('base.VND'))
    daily_ohlc_ids = fields.One2many('ssi.daily.ohlc', 'security_id', string='Daily OHLC')
    intraday_ohlc_ids = fields.One2many('ssi.intraday.ohlc', 'security_id', string='Intraday OHLC')

    _sql_constraints = [
        ('symbol_market_unique', 'unique(symbol, market)', 'Symbol must be unique per market!')
    ]
    
    @api.model
    def ensure_securities_exist(self, symbols):
        """
        Verify symbols exist in DB. If not, try to fetch and create them from SSI API.
        Args:
            symbols (list): List of symbol strings (e.g. ['VNM', 'VIC'])
        """
        if not symbols:
            return
            
        # Normalize
        symbols = [s.upper() for s in symbols]
        
        # Check what we already have
        existing = self.search([('symbol', 'in', symbols)])
        existing_symbols = set(existing.mapped('symbol'))
        
        missing = set(symbols) - existing_symbols
        if not missing:
            return
        
        _logger.info("Auto-creating missing securities: %s", missing)
        
        # Try to find missing symbols
        try:
            gateway = self._get_gateway()
            
            # We don't know the market for missing symbols, so we might need to try markets.
            # But get_securities_details usually requires market. 
            # Optimization: Try 'HOSE' first, then 'HNX', 'UPCOM'.
            markets = ['HOSE', 'HNX', 'UPCOM']
            
            for symbol in missing:
                found = False
                for market in markets:
                    try:
                        data = gateway.get_securities_details(market, symbol)
                        if data:
                            items = data if isinstance(data, list) else data.get('items', [])
                            if items:
                                item = items[0]
                                # Create Security
                                self.create({
                                    'symbol': symbol,
                                    'market': market,
                                    'stock_name_vn': item.get('StockName') or item.get('stockName'),
                                    'stock_name_en': item.get('StockEnName') or item.get('stockEnName'),
                                    'floor_code': item.get('floorCode'),
                                    'security_type': item.get('securityType'),
                                    'is_active': True 
                                })
                                found = True
                                self.env.cr.commit() # Commit immediately so streaming thread can see it
                                break
                    except Exception as e:
                        # Ignore error per market/symbol and continue
                        pass
                
                if not found:
                    _logger.warning("Could not auto-create symbol: %s (Not found on any market)", symbol)
                    
        except Exception as e:
            _logger.error("Error in ensure_securities_exist: %s", e)

    @api.depends('current_price', 'reference_price')
    def _compute_change(self):
        for rec in self:
            if rec.current_price and rec.reference_price:
                rec.change = rec.current_price - rec.reference_price
                if rec.reference_price != 0:
                    rec.change_percent = (rec.change / rec.reference_price) * 100
                else:
                    rec.change_percent = 0.0
            else:
                rec.change = 0.0
                rec.change_percent = 0.0

    # -------------------------------------------------------------------------
    # GATEWAY HELPERS
    # -------------------------------------------------------------------------
    def _get_gateway(self):
        """Helper to get initialized gateway"""
        config = self.env['ssi.api.config'].get_config()
        if not config:
            raise UserError(_("No active SSI API Configuration found."))
        return SSIGateway(config.consumer_id, config.consumer_secret, config.api_url)

    # -------------------------------------------------------------------------
    # ACTIONS (BUTTONS)
    # -------------------------------------------------------------------------
    def action_fetch_securities_details(self):
        """Fetch static details like Name, Type"""
        try:
            gateway = self._get_gateway()
            data = gateway.get_securities_details(self.market, self.symbol)
            if data:
                items = data if isinstance(data, list) else data.get('items', [])
                if items:
                    item = items[0]
                    self.write({
                        'stock_name_vn': item.get('StockName') or item.get('stockName'),
                        'stock_name_en': item.get('StockEnName') or item.get('stockEnName'),
                        'floor_code': item.get('floorCode'),
                        'security_type': item.get('securityType'),
                    })
            return self._notify_success("Updated details for %s" % self.symbol)
        except Exception as e:
            return self._notify_error(str(e))

    def action_fetch_latest_price(self):
        """Fetch Snapshot from Daily Stock Price API (Ref/Ceil/Floor)"""
        try:
            gateway = self._get_gateway()
            today = fields.Date.today()
            # Fetch for today
            data = gateway.get_daily_stock_price(self.symbol, today, today, self.market)
            if data:
                # Find latest
                items = []
                if isinstance(data, list):
                    items = data
                else:
                     items = data.get('dataList', []) or data.get('items', [])
                
                if items:
                    # Sort or pick last? Usually items is list of 1 if query single day
                    latest = items[0]
                    
                    # Logic: Try various keys for Prices because API is inconsistent
                    def _get(dct, keys, default=0.0):
                        for k in keys:
                             if k in dct: return float(dct[k] or 0)
                        return default

                    ref_keys = ['ReferencePrice', 'RefPrice', 'refPrice', 'Ref', 'ref']
                    ceil_keys = ['CeilingPrice', 'Ceiling', 'ceiling']
                    floor_keys = ['FloorPrice', 'Floor', 'floor']

                    ref = _get(latest, ref_keys, self.reference_price)
                    ceil = _get(latest, ceil_keys, self.ceiling_price)
                    floor = _get(latest, floor_keys, self.floor_price)
                    
                    # Calculate if 0
                    if ref > 0 and (ceil == 0 or floor == 0):
                         # Simple rule
                         ratio = 0.07 if self.market == 'HOSE' else 0.10 if self.market == 'HNX' else 0.15
                         if ceil == 0: ceil = ref * (1 + ratio)
                         if floor == 0: floor = ref * (1 - ratio)

                    self.write({
                        'reference_price': ref,
                        'ceiling_price': ceil,
                        'floor_price': floor,
                        'current_price': float(latest.get('LastPrice') or latest.get('lastPrice') or self.current_price),
                        'last_update': fields.Datetime.now()
                    })
            
            return self._notify_success("Updated price for %s" % self.symbol)
        except Exception as e:
            return self._notify_error(str(e))

    def action_fetch_daily_ohlc_today(self):
        """Action for smart button - Fetch today's OHLC"""
        try:
             gateway = self._get_gateway()
             today = fields.Date.today()
             # Fetch last 30 days just in case to fill gaps
             from_date = today - timedelta(days=30)
             
             data = gateway.get_daily_ohlc(self.symbol, from_date, today, page_size=100)
             count = 0
             if data:
                 items = data if isinstance(data, list) else data.get('data', [])
                 for item in items:
                     if not item: continue
                     self.env['ssi.daily.ohlc'].create_or_update_from_gateway(self, item)
                     count += 1
             return self._notify_success("Fetched %s daily OHLC records" % count)
        except Exception as e:
             return self._notify_error(str(e))

    # -------------------------------------------------------------------------
    # STREAMING LOGIC - Production Ready
    # -------------------------------------------------------------------------
    
    # Symbol cache for performance (class-level)
    _symbol_cache = {}
    _symbol_cache_time = None
    SYMBOL_CACHE_TTL = 300  # 5 minutes
    
    # Daily OHLC cache: (security_id, date_str) -> record_id
    _daily_ohlc_cache = {}
    
    @classmethod
    def _refresh_symbol_cache(cls, env):
        """Refresh the symbol -> security_id cache"""
        try:
            securities = env['ssi.securities'].sudo().search([('is_active', '=', True)])
            cls._symbol_cache = {s.symbol: s.id for s in securities}
            cls._symbol_cache_time = vn_now()
            _logger.debug("Symbol cache refreshed: %d entries", len(cls._symbol_cache))
        except Exception as e:
            _logger.error("Failed to refresh symbol cache: %s", e)
    
    @classmethod
    def _get_security_id_from_cache(cls, env, symbol):
        """Get security ID from cache, refresh if stale"""
        now = vn_now()
        
        # Check if cache needs refresh
        if (not cls._symbol_cache_time or 
            (now - cls._symbol_cache_time).total_seconds() > cls.SYMBOL_CACHE_TTL):
            cls._refresh_symbol_cache(env)
        
        return cls._symbol_cache.get(symbol)
    
    @api.model
    def register_streaming_callback(self):
        """Register model method as callback for Streaming Connection"""
        manager = StreamingManager.get_instance()
        manager.register_callback(self._process_streaming_message)
        _logger.info("Securities streaming callback registered")

    @api.model
    def _process_streaming_message(self, message):
        """
        Process streaming message from SSI WebSocket.
        Uses new cursor for thread safety and symbol cache for performance.
        
        SSI Message format:
        {'DataType': 'X', 'Content': '{"Symbol":"VNM","LastPrice":71300.0,...}'}
        """
        if not message:
            return
        
        # Parse batch or single message
        items = []
        try:
            import json
            
            # Normalize input to list
            batch = message if isinstance(message, list) else [message]
            
            for raw in batch:
                # 1. Parse JSON string if needed
                if isinstance(raw, str):
                    try:
                        raw = json.loads(raw)
                    except:
                        continue
                
                if not raw: continue
                
                # 2. Extract Data from SSI Format
                # Standard SSI: {'type': 'X', 'data': {...}} or just {...}
                # Also handling 'Content' key seen in comments
                content = None
                if isinstance(raw, dict):
                    if raw.get('Content'): # SSI Content Wrapper
                        try:
                            content = json.loads(raw['Content'])
                        except:
                            content = raw['Content']
                    elif raw.get('data'): # Generic Data Wrapper
                        content = raw['data']
                    else:
                        content = raw
                else:
                    content = raw
                
                # 3. Add to items list
                if isinstance(content, list):
                    items.extend(content)
                elif content:
                    items.append(content)
                    
        except Exception as e:
            _logger.warning("Failed to parse batch: %s", e)
            return

        if not items:
            return
        
        # We need a new cursor because this is called from a background thread
        new_cr = None
        try:
            new_cr = self.pool.cursor()
            env = api.Environment(new_cr, 1, {})  # SUPERUSER_ID = 1
            
            # Collect updates
            updates = {}  # security_id -> vals
            bus_updates = {}  # symbol -> price_data (for bus publishing)
            intraday_buffer = {}
            daily_updates = {}
            today_str = vn_now().strftime('%Y-%m-%d')
            
            for item in items:
                if not item:
                    continue
                    
                symbol = item.get('Symbol') or item.get('symbol')
                if not symbol:
                    continue
                
                
                # Get security ID from cache
                security_id = self._get_security_id_from_cache(env, symbol)
                
                # Fallback: If not in cache, try to find in DB (maybe created recently)
                if not security_id:
                     sec = env['ssi.securities'].search([('symbol', '=', symbol)], limit=1)
                     if sec:
                         security_id = sec.id
                         # Update cache for next time
                         self._symbol_cache[symbol] = security_id
                
                if not security_id:
                    # Optional: Could auto-create here, but better to do it in pre-hook or separate task
                    # because creating inside this high-frequency loop might slow down streaming.
                    # For now, just log debug.
                    if self._symbol_cache_time: # Only log if we have initialized cache
                         _logger.debug("Skipping unknown symbol in stream: %s", symbol)
                    continue
                
                # Extract price values
                vals = self._extract_streaming_vals(item)
                if not vals:
                    continue
                
                if vals:
                    updates[security_id] = vals
                    
                    bus_updates[symbol] = {
                        'current_price': vals.get('current_price'),
                        'change': vals.get('change'),
                        'change_percent': vals.get('change_percent'),
                        'high_price': vals.get('high_price'),
                        'low_price': vals.get('low_price'),
                        'volume': vals.get('volume'),
                        'reference_price': vals.get('reference_price'),
                        'ceiling_price': vals.get('ceiling_price'),
                        'floor_price': vals.get('floor_price'),
                        'today_open_price': vals.get('today_open_price'),
                        'avg_price': vals.get('avg_price'),
                        'last_update': vals.get('last_update').isoformat() if vals.get('last_update') else None,
                        'bid_price_1': vals.get('bid_price_1'),
                        'bid_vol_1': vals.get('bid_vol_1'),
                        'ask_price_1': vals.get('ask_price_1'),
                        'ask_vol_1': vals.get('ask_vol_1'),
                    }
                    
                    # --- Buffer Intraday OHLC (Sampled 1s) ---
                    now_ts = time.time()
                    last_ts = self._last_tick_save.get(security_id, 0)
                    if vals.get('current_price') and (now_ts - last_ts >= 1.0):
                        time_str = vn_now().strftime('%H:%M:%S')
                        intraday_buffer[(security_id, time_str)] = {
                            'security_id': security_id,
                            'date': today_str,
                            'time': time_str,
                            'close_price': vals.get('current_price'),
                            'volume': vals.get('volume'),
                            'high_price': vals.get('high_price'),
                            'low_price': vals.get('low_price'),
                            'open_price': vals.get('today_open_price'),
                        }
                        self._last_tick_save[security_id] = now_ts
                    
                    # --- Prepare Daily OHLC Upsert ---
                    ohlc_vals = {
                        'security_id': security_id,
                        'date': today_str,
                        'last_update': fields.Datetime.now(),
                        'open_price': vals.get('today_open_price'),
                        'high_price': vals.get('high_price'),
                        'low_price': vals.get('low_price'),
                        'close_price': vals.get('current_price'),
                        'volume': vals.get('volume')
                    }
                    # Filter None
                    ohlc_clean = {k: v for k, v in ohlc_vals.items() if v is not None}
                    if len(ohlc_clean) > 3: # Has data beyond id/date/last_update
                         daily_updates[(security_id, today_str)] = ohlc_clean
            
            # --- EXECUTE BATCHES ---

            # 1. Flush Intraday Buffer (Create)
            if intraday_buffer:
                try:
                    env['ssi.intraday.ohlc'].create(list(intraday_buffer.values()))
                except Exception as e:
                    _logger.warning("Batch Intraday Create Failed: %s", e)

            # 2. Batch Update Securities (Raw SQL)
            if updates:
                try:
                    self._raw_batch_update(env, updates)
                except Exception as e:
                    _logger.error("Raw batch update failed: %s", e)
            
            # 3. Batch Upsert Daily OHLC (Raw SQL)
            if daily_updates:
                try:
                    self._raw_daily_batch_upsert(env, daily_updates.values())
                except Exception as e:
                     _logger.error("Raw Daily batch upsert failed: %s", e)

            # 4. Commit DB Transaction
            if updates or intraday_buffer or daily_updates:
                new_cr.commit()
            
            # 5. Publish to Bus (Batch Message)
            if bus_updates:
                try:
                    from ..services.streaming_bus import StreamingBusPublisher
                    publisher = StreamingBusPublisher.get_instance()
                    if publisher:
                        publisher.publish_batch_update(bus_updates)
                except Exception as e:
                    pass
            
            # 6. Hook for extensions (e.g. Fund Management)
            # This allows other modules to react to updates even though we used Raw SQL
            try:
                # Use env['ssi.securities'] to ensure we use the 'new_cr' context
                env['ssi.securities']._streaming_update_hook(bus_updates)
            except Exception as e:
                _logger.error("Streaming update hook failed: %s", e)
            
        except Exception as e:
            _logger.exception("Error processing streaming message")
        finally:
            if new_cr:
                new_cr.close()

    @api.model
    def _streaming_update_hook(self, bus_updates):
        """
        Hook called after processing a batch of streaming updates.
        Args:
            bus_updates (dict): {symbol: {field: value, ...}}
        To be overridden by other modules.
        """
        pass
    
    def _raw_daily_batch_upsert(self, env, updates_list):
        """Optimized Upsert for Daily OHLC"""
        if not updates_list: return
        
        # Columns to handle
        cols = ['security_id', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume', 'last_update']
        
        val_list = []
        for vals in updates_list:
            row = []
            for c in cols:
                row.append(vals.get(c)) # Can be None
            val_list.append(tuple(row))
            
        query = f"""
            INSERT INTO ssi_daily_ohlc ({", ".join(cols)})
            VALUES {", ".join(["%s"] * len(val_list))}
            ON CONFLICT (security_id, date) DO UPDATE SET
                open_price = COALESCE(EXCLUDED.open_price, ssi_daily_ohlc.open_price),
                high_price = COALESCE(EXCLUDED.high_price, ssi_daily_ohlc.high_price),
                low_price = COALESCE(EXCLUDED.low_price, ssi_daily_ohlc.low_price),
                close_price = COALESCE(EXCLUDED.close_price, ssi_daily_ohlc.close_price),
                volume = COALESCE(EXCLUDED.volume, ssi_daily_ohlc.volume),
                last_update = EXCLUDED.last_update
        """
        # Note: VALUES placeholder for bulk insert needs strictly formatted args or execute_values
        # Using execute_values from psycopg2.extras is best, but access might be limited inside Odoo cursor logic?
        # Odoo uses psycopg2.
        
        # Simpler approach: manual string construction for values is risky for SQLi?
        # But here inputs are float/date/int processed.
        # Safe approach without extras:
        # Use mogrify? No.
        
        # Fallback to single UPSERT loop if batch is too hard?
        # No, user wants PERFORMANCE.
        
        # We construct VALUES string: (%s, %s, ...), (%s, ...)
        placeholder_row = "(" + ", ".join(["%s"] * len(cols)) + ")"
        values_placeholder = ", ".join([placeholder_row] * len(val_list))
        
        sql = f"""
            INSERT INTO ssi_daily_ohlc ({", ".join(cols)})
            VALUES {values_placeholder}
            ON CONFLICT (security_id, date) DO UPDATE SET
                open_price = COALESCE(EXCLUDED.open_price, ssi_daily_ohlc.open_price),
                high_price = COALESCE(EXCLUDED.high_price, ssi_daily_ohlc.high_price),
                low_price = COALESCE(EXCLUDED.low_price, ssi_daily_ohlc.low_price),
                close_price = COALESCE(EXCLUDED.close_price, ssi_daily_ohlc.close_price),
                volume = COALESCE(EXCLUDED.volume, ssi_daily_ohlc.volume),
                last_update = EXCLUDED.last_update
        """
        
        # Flatten params
        params = []
        for row in val_list:
            params.extend(row)
            
        env.cr.execute(sql, params)
    
    def _raw_batch_update(self, env, updates):
        """
        Execute raw SQL updates to bypass ORM overhead for high-frequency data.
        Grouping by field keys to handle varying update structures.
        """
        if not updates:
            return
            
        table = self._table
        
        # Group by keys tuple ensures consistent columns for VALUES
        grouped = {}
        for rid, vals in updates.items():
            keys = tuple(sorted(vals.keys()))
            if not keys: continue
            if keys not in grouped: grouped[keys] = []
            grouped[keys].append((rid, vals))
            
        for keys, rows in grouped.items():
            # Build SET clause
            set_clauses = []
            for k in keys:
                # Basic casting based on field type if needed (mostly not needed for psycopg2 params)
                # But safer to cast specifically for Postgres
                col_type = self._fields[k].type
                cast = ""
                if col_type == 'float' or col_type == 'monetary': cast = "::float8"
                elif col_type == 'integer': cast = "::int4"
                elif col_type == 'datetime': cast = "::timestamp"
                elif col_type == 'date': cast = "::date"
                
                set_clauses.append(f'"{k}" = v."{k}"{cast}')
                
            set_str = ", ".join(set_clauses)
            
            # Build Column List for Alias
            # v(id, col1, col2...)
            columns = ['id'] + list(keys)
            columns_str = ", ".join([f'"{c}"' for c in columns])
            
            # Build VALUES
            val_placeholders = []
            query_params = []
            
            for rid, vals in rows:
                row_args = [rid]
                ph = ["%s"] # id
                for k in keys:
                    row_args.append(vals[k])
                    ph.append("%s")
                
                val_placeholders.append(f"({', '.join(ph)})")
                query_params.extend(row_args)
                
            values_str = ", ".join(val_placeholders)
            
            sql = f'UPDATE "{table}" as t SET {set_str} FROM (VALUES {values_str}) AS v({columns_str}) WHERE t.id = v.id'
            
            env.cr.execute(sql, query_params)
    
    @staticmethod
    def _extract_streaming_vals(item):
        """
        Extract Odoo field values from SSI streaming message.
        Handles various SSI field naming conventions.
        """
        vals = {}
        
        # Helper to safely convert to float
        def _to_float(value):
            if value in (None, '', False):
                return None
            try:
                return float(str(value).replace(',', ''))
            except (TypeError, ValueError):
                return None
        
        # Map SSI fields to Odoo fields
        field_mapping = {
            'current_price': ['LastPrice', 'lastPrice', 'Close', 'close'],
            'volume': ['TotalVol', 'totalVol', 'TotalVolume'],
            'high_price': ['High', 'high', 'Highest'],
            'low_price': ['Low', 'low', 'Lowest'],
            'reference_price': ['RefPrice', 'refPrice', 'ReferencePrice'],
            'ceiling_price': ['Ceiling', 'ceiling', 'CeilingPrice'],
            'floor_price': ['Floor', 'floor', 'FloorPrice'],
            'total_value': ['TotalVal', 'totalVal', 'TotalValue'],
            'change': ['Change', 'change'],
            'change_percent': ['RatioChange', 'ratioChange', 'PerChange'],
            'today_open_price': ['Open', 'open', 'OpenPrice'],
            'avg_price': ['AvgPrice', 'avgPrice', 'AveragePrice'],
            'last_volume': ['LastVol', 'lastVol'],
            'est_match_price': ['EstMatchedPrice'],
            'bid_price_1': ['BidPrice1'],
            'bid_vol_1': ['BidVol1'],
            'bid_price_2': ['BidPrice2'],
            'bid_vol_2': ['BidVol2'],
            'bid_price_3': ['BidPrice3'],
            'bid_vol_3': ['BidVol3'],
            'ask_price_1': ['AskPrice1'],
            'ask_vol_1': ['AskVol1'],
            'ask_price_2': ['AskPrice2'],
            'ask_vol_2': ['AskVol2'],
            'ask_price_3': ['AskPrice3'],
            'ask_vol_3': ['AskVol3'],
        }
        
        for odoo_field, ssi_keys in field_mapping.items():
            for key in ssi_keys:
                if key in item:
                    value = _to_float(item[key])
                    if value is not None:
                        vals[odoo_field] = value
                        break
        
        # Only return if we have meaningful updates
        if vals:
            vals['last_update'] = fields.Datetime.now()
        
        return vals
    
    @api.model_create_multi
    def create(self, vals_list):
        """Override create to invalidate symbol cache for streaming"""
        records = super().create(vals_list)
        # Invalidate cache so streaming can pick up new symbols immediately
        self.invalidate_symbol_cache()
        return records
    
    @api.model
    def invalidate_symbol_cache(self):
        """Force symbol cache to refresh on next access"""
        self.__class__._symbol_cache_time = None
        _logger.info("Symbol cache invalidated")


    # -------------------------------------------------------------------------
    # CRON JOBS
    # -------------------------------------------------------------------------
    @api.model
    def cron_fetch_priority_data(self):
        """Revised Cron: Sync Priority Data using Gateway"""
        config = self.env['ssi.api.config'].get_config()
        if not config or not config.priority_securities_ids:
            return

        gateway = None
        try:
             gateway = SSIGateway(config.consumer_id, config.consumer_secret, config.api_url)
        except Exception as e:
             _logger.error("Cron aborted: %s", e)
             return

        for security in config.priority_securities_ids:
            try:
                # 1. Update Details (Name etc)
                details = gateway.get_securities_details(security.market, security.symbol)
                if details:
                    items = details if isinstance(details, list) else details.get('items', [])
                    if items:
                        item = items[0]
                        security.write({
                            'stock_name_vn': item.get('StockName') or item.get('stockName'),
                            'stock_name_en': item.get('StockEnName') or item.get('stockEnName'),
                            'floor_code': item.get('floorCode'),
                            'security_type': item.get('securityType'),
                        })

                # 2. Update Price
                today = fields.Date.today()
                price_data = gateway.get_daily_stock_price(security.symbol, today, today, security.market)
                if price_data:
                    items = []
                    if isinstance(price_data, list):
                        items = price_data
                    else:
                        items = price_data.get('dataList', []) or price_data.get('items', [])

                    if items:
                        latest = items[0]
                        security.write({
                            'current_price': float(latest.get('LastPrice') or latest.get('lastPrice') or security.current_price),
                            'last_update': fields.Datetime.now()
                        })

                # 3. Fetch Intraday OHLC (New Requirement)
                # Fetch last 3 days to cover weekend gaps if any
                from_date = today - timedelta(days=3)
                to_date = today
                intraday_data = gateway.get_intraday_ohlc(security.symbol, from_date, to_date, page_size=1000)
                if intraday_data:
                    i_items = intraday_data if isinstance(intraday_data, list) else intraday_data.get('data', [])
                    for item in i_items:
                        if not item: continue
                        self.env['ssi.intraday.ohlc'].create_or_update_from_gateway(security, item)

                # 4. Fetch Daily OHLC (Create records)
                ohlc_data = gateway.get_daily_ohlc(security.symbol, today, today)
                if ohlc_data:
                    ohlc_items = ohlc_data if isinstance(ohlc_data, list) else (ohlc_data.get('data', []) if isinstance(ohlc_data, dict) else [])
                    for item in ohlc_items:
                        if not item: continue
                        self.env['ssi.daily.ohlc'].create_or_update_from_gateway(security, item)

                self.env.cr.commit() # Commit per security
                
            except Exception as e:
                _logger.error("Error syncing %s: %s", security.symbol, e)
                
    def action_fetch_all_intraday_ohlc(self):
        """Button action to fetch intraday OHLC for this security"""
        try:
             gateway = self._get_gateway()
             today = fields.Date.today()
             from_date = today - timedelta(days=7) # Fetch last 7 days
             
             data = gateway.get_intraday_ohlc(self.symbol, from_date, today, page_size=5000)
             count = 0
             if data:
                 items = data if isinstance(data, list) else data.get('data', [])
                 for item in items:
                     self.env['ssi.intraday.ohlc'].create_or_update_from_gateway(self, item)
                     count += 1
             return self._notify_success("Fetched %s intraday records" % count)
        except Exception as e:
             return self._notify_error(str(e))


    # -------------------------------------------------------------------------
    # GLOBAL ACTIONS (SERVER ACTIONS)
    # -------------------------------------------------------------------------
    @api.model
    def action_global_fetch_securities_list(self):
        """Fetch/Sync list of securities from all markets"""
        gateway = self._get_gateway()
        markets = ['HOSE', 'HNX', 'UPCOM']
        total = 0
        for m in markets:
            page = 1
            while True:
                data = gateway.get_securities(m, page_index=page, page_size=1000)
                items = data.get('items', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                if not items: break
                
                for item in items:
                    symbol = item.get('Symbol') or item.get('symbol')
                    if not symbol: continue
                    
                    val = {
                        'symbol': symbol,
                        'market': m,
                        'stock_name_vn': item.get('StockName') or item.get('stockName'),
                        'stock_name_en': item.get('StockEnName') or item.get('stockEnName'),
                        # 'exchange': m, # exchange field does not exist, use market
                        'is_active': True 
                    }
                    
                    existing = self.search([('symbol','=',symbol), ('market','=',m)], limit=1)
                    if existing:
                        existing.write(val)
                    else:
                        self.create(val)
                    total += 1
                
                page += 1
                if len(items) < 1000: break
                self.env.cr.commit()
                
        return self._notify_success("Synced %s securities" % total)

    @api.model
    def action_global_fetch_securities_details(self):
        """Fetch details for ALL active securities"""
        active_secs = self.search([('is_active','=',True)])
        gateway = self._get_gateway()
        count = 0
        for rec in active_secs:
            try:
                data = gateway.get_securities_details(rec.market, rec.symbol)
                if data:
                    items = data if isinstance(data, list) else data.get('items', [])
                    if items:
                         item = items[0]
                         rec.write({
                            'stock_name_vn': item.get('StockName') or item.get('stockName'),
                            'stock_name_en': item.get('StockEnName') or item.get('stockEnName'),
                            'floor_code': item.get('floorCode'),
                            'security_type': item.get('securityType'),
                         })
                         count += 1
            except Exception:
                pass
        return self._notify_success("Updated details for %s securities" % count)

    @api.model
    def action_global_fetch_latest_price(self):
        """Fetch latest prices for ALL active securities"""
        active_secs = self.search([('is_active','=',True)])
        gateway = self._get_gateway()
        count = 0
        
        # Optimization: Fetch by market if API supports it?
        # Gateway `get_daily_stock_price` takes symbol.
        # But `daily_stock_price` API usually supports fetching by market if symbol is empty!
        # Let's try fetching by market for efficiency.
        
        markets = ['HOSE', 'HNX', 'UPCOM']
        today = fields.Date.today()
        
        for m in markets:
            page = 1
            while True:
                # Pass symbol='' to fetch all?
                # Check gateway behavior: `req = model.daily_stock_price(symbol, ...)`
                # If symbol is '', it might return all.
                try:
                    data = gateway.get_daily_stock_price('', today, today, m, page_index=page, page_size=100)
                    items = data if isinstance(data, list) else data.get('dataList', []) or data.get('items', [])
                    
                    if not items: break
                    
                    for item in items:
                        sym = item.get('Symbol') or item.get('symbol')
                        if not sym: continue
                        
                        security = self.search([('symbol','=',sym), ('market','=',m)], limit=1)
                        if not security: continue
                        
                        vals = {}
                        # Map fields carefully
                        if 'LastPrice' in item: vals['current_price'] = float(item['LastPrice'])
                        if 'TotalVolume' in item: vals['volume'] = float(item['TotalVolume'])
                        if 'RefPrice' in item: vals['reference_price'] = float(item['RefPrice'])
                        if 'CeilingPrice' in item: vals['ceiling_price'] = float(item['CeilingPrice'])
                        if 'FloorPrice' in item: vals['floor_price'] = float(item['FloorPrice'])
                        if 'Highest' in item: vals['high_price'] = float(item['Highest'])
                        if 'Lowest' in item: vals['low_price'] = float(item['Lowest'])
                        
                        if vals:
                            vals['last_update'] = fields.Datetime.now()
                            security.write(vals)
                            count += 1
                            
                    page += 1
                    if len(items) < 100: break
                    self.env.cr.commit()
                    
                except Exception as e:
                    _logger.error("Bulk price fetch error set %s: %s", m, e)
                    break

        return self._notify_success("Updated prices for %s securities" % count)

    @api.model
    def action_global_fetch_daily_ohlc(self):
        """Fetch Daily OHLC for ALL active securities (Last 7 days)"""
        active_secs = self.search([('is_active','=',True)])
        gateway = self._get_gateway()
        today = fields.Date.today()
        from_date = today - timedelta(days=7)
        count = 0
        
        for rec in active_secs:
            try:
                data = gateway.get_daily_ohlc(rec.symbol, from_date, today)
                if data:
                    items = data if isinstance(data, list) else data.get('data', [])
                    for item in items:
                        if not item: continue
                        self.env['ssi.daily.ohlc'].create_or_update_from_gateway(rec, item)
                    count += 1
                    if count % 10 == 0: self.env.cr.commit()
            except Exception:
                pass
        return self._notify_success("Updated Daily OHLC for %s securities" % count)

    @api.model
    def action_global_fetch_intraday_ohlc(self):
        """Fetch Intraday OHLC for ALL active securities (Last 1 day)"""
        active_secs = self.search([('is_active','=',True)])
        gateway = self._get_gateway()
        today = fields.Date.today()
        # Only fetch today/yesterday for bulk to avoid massive lag
        from_date = today - timedelta(days=1)
        count = 0
        
        for rec in active_secs:
            try:
                data = gateway.get_intraday_ohlc(rec.symbol, from_date, today, page_size=1000)
                if data:
                    items = data if isinstance(data, list) else data.get('data', [])
                    for item in items:
                        if not item: continue
                        self.env['ssi.intraday.ohlc'].create_or_update_from_gateway(rec, item)
                    count += 1
                    if count % 10 == 0: self.env.cr.commit()
            except Exception:
                pass
                pass
        return self._notify_success("Updated Intraday OHLC for %s securities" % count)

    def action_fetch_single_intraday(self, from_date=None, to_date=None):
        """Fetch Intraday OHLC for this security only"""
        self.ensure_one()
        gateway = self._get_gateway()
        if not from_date:
            from_date = fields.Date.today()
        if not to_date:
            to_date = fields.Date.today()
            
        try:
            data = gateway.get_intraday_ohlc(self.symbol, from_date, to_date, page_size=1000)
            if data:
                items = data if isinstance(data, list) else data.get('data', [])
                count = 0
                for item in items:
                    if not item: continue
                    self.env['ssi.intraday.ohlc'].create_or_update_from_gateway(self, item)
                    count += 1
                if count > 0:
                    self.env.cr.commit()
                return True
        except Exception as e:
            _logger.error(f"Failed to fetch intraday for {self.symbol}: {e}")
        return False

    # -------------------------------------------------------------------------
    # UTILS
    # -------------------------------------------------------------------------
    def _notify_success(self, msg):
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {'title': 'Success', 'message': msg, 'type': 'success', 'sticky': False}
        }
        
    def _notify_error(self, msg):
         return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {'title': 'Error', 'message': msg, 'type': 'danger', 'sticky': True}
        }
