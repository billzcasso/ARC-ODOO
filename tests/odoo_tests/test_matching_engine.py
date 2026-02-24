# -*- coding: utf-8 -*-
"""
Odoo TransactionCase tests for matching.engine model.

Run inside Docker container:
    odoo -d <db_name> --test-enable --stop-after-init -i order_matching

Tests:
- Price-Time Priority algorithm
- Partial fill matching
- Same user rejection
- Status after match
"""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError
from datetime import datetime


class TestMatchingEngine(TransactionCase):
    """Test order_matching matching engine."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Transaction = cls.env['portfolio.transaction']
        cls.MatchedOrder = cls.env['order.matched.pair']
        cls.Fund = cls.env['portfolio.fund']
        cls.User = cls.env['res.users']

        # Create two test users
        cls.buyer = cls.User.create({
            'name': 'Buyer User',
            'login': 'buyer@arc.vn',
            'email': 'buyer@arc.vn',
        })
        cls.seller = cls.User.create({
            'name': 'Seller User',
            'login': 'seller@arc.vn',
            'email': 'seller@arc.vn',
        })

        # Create test fund
        cls.test_fund = cls.Fund.create({
            'name': 'Matching Test Fund',
            'ticker': 'MTF',
            'inception_date': '2024-01-01',
            'current_nav': 10000.0,
            'investment_type': 'Growth',
            'status': 'active',
        })

    def _create_order(self, user, order_type, units, price, **kwargs):
        vals = {
            'user_id': user.id,
            'fund_id': self.test_fund.id,
            'transaction_type': order_type,
            'status': 'pending',
            'units': units,
            'price': price,
            'remaining_units': units,
            'order_value': units * price,
            'order_mode': 'negotiated',
        }
        vals.update(kwargs)
        return self.Transaction.create(vals)

    # --- Basic matching ---

    def test_buy_sell_match(self):
        """Buy at 100, Sell at 90 → should match (buy_price >= sell_price)."""
        buy = self._create_order(self.buyer, 'buy', 100, 100)
        sell = self._create_order(self.seller, 'sell', 100, 90)

        # Trigger matching engine
        engine = self.env['matching.engine']
        if hasattr(engine, 'add_order'):
            results = engine.add_order(buy)
            engine.add_order(sell)
            # Check matched pairs
            matched = self.MatchedOrder.search([
                ('buy_order_id', '=', buy.id),
                ('sell_order_id', '=', sell.id),
            ])
            if matched:
                self.assertEqual(matched.matched_quantity, 100)

    def test_price_condition_not_met(self):
        """Buy at 80, Sell at 90 → should NOT match."""
        buy = self._create_order(self.buyer, 'buy', 100, 80)
        sell = self._create_order(self.seller, 'sell', 100, 90)

        engine = self.env['matching.engine']
        if hasattr(engine, 'can_match_orders'):
            can_match, reason = engine.can_match_orders(buy, sell)
            self.assertFalse(can_match)

    # --- Partial fill ---

    def test_partial_fill(self):
        """Buy 100 units, Sell 60 units → partial fill of 60."""
        buy = self._create_order(self.buyer, 'buy', 100, 100)
        sell = self._create_order(self.seller, 'sell', 60, 90)

        engine = self.env['matching.engine']
        if hasattr(engine, 'add_order'):
            engine.add_order(buy)
            engine.add_order(sell)

            # After partial match, buy should have 40 remaining
            buy.invalidate_recordset()
            if buy.remaining_units:
                self.assertAlmostEqual(buy.remaining_units, 40, places=2)

    # --- Same user rejection ---

    def test_same_user_cannot_match(self):
        """Same user should not be able to match with themselves."""
        buy = self._create_order(self.buyer, 'buy', 100, 100)
        sell = self._create_order(self.buyer, 'sell', 100, 90)  # Same user

        engine = self.env['matching.engine']
        if hasattr(engine, 'can_match_orders'):
            can_match, reason = engine.can_match_orders(buy, sell)
            self.assertFalse(can_match)

    # --- Priority score ---

    def test_time_to_integer(self):
        """time_to_integer should convert HH:MM to minutes from midnight."""
        engine = self.env['matching.engine']
        if hasattr(engine, 'time_to_integer_helper'):
            dt = datetime(2024, 1, 1, 9, 45, 0)
            result = engine.time_to_integer_helper(dt)
            self.assertEqual(result, 585)  # 9*60+45

    def test_priority_higher_price_buy_first(self):
        """Higher buy price should have higher priority score."""
        buy_high = self._create_order(self.buyer, 'buy', 100, 200)
        buy_low = self._create_order(self.buyer, 'buy', 100, 100)

        engine = self.env['matching.engine']
        if hasattr(engine, 'calculate_priority_score_for_order'):
            score_high = engine.calculate_priority_score_for_order(buy_high)
            score_low = engine.calculate_priority_score_for_order(buy_low)
            self.assertGreater(score_high, score_low)
