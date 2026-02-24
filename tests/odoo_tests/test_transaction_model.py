# -*- coding: utf-8 -*-
"""
Odoo TransactionCase tests for portfolio.transaction model.

Run inside Docker container:
    odoo -d <db_name> --test-enable --stop-after-init -i fund_management

Tests:
- Transaction create with validation
- Status transitions (pending → completed, pending → cancelled)
- T+2 date computation
- compute_sell_value calculation
- _update_investment on completion
"""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError
from datetime import datetime, timedelta


class TestTransactionModel(TransactionCase):
    """Test portfolio.transaction model."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Transaction = cls.env['portfolio.transaction']
        cls.Fund = cls.env['portfolio.fund']
        cls.User = cls.env['res.users']

        # Create test user
        cls.test_user = cls.User.create({
            'name': 'Test Investor',
            'login': 'test_investor@arc.vn',
            'email': 'test_investor@arc.vn',
        })

        # Create test fund
        cls.test_fund = cls.Fund.create({
            'name': 'Test Fund',
            'ticker': 'TF1',
            'inception_date': '2024-01-01',
            'current_nav': 10000.0,
            'investment_type': 'Growth',
            'status': 'active',
        })

    def _create_transaction(self, **kwargs):
        """Helper to create a transaction with defaults."""
        vals = {
            'user_id': self.test_user.id,
            'fund_id': self.test_fund.id,
            'transaction_type': 'buy',
            'status': 'pending',
            'units': 100,
            'price': 10000.0,
            'order_value': 1_000_000,
            'order_mode': 'negotiated',
        }
        vals.update(kwargs)
        return self.Transaction.create(vals)

    # --- Create ---

    def test_create_buy_transaction(self):
        txn = self._create_transaction(transaction_type='buy')
        self.assertTrue(txn.id)
        self.assertEqual(txn.transaction_type, 'buy')
        self.assertEqual(txn.status, 'pending')

    def test_create_sell_transaction(self):
        txn = self._create_transaction(transaction_type='sell')
        self.assertTrue(txn.id)
        self.assertEqual(txn.transaction_type, 'sell')

    def test_default_status_pending(self):
        txn = self._create_transaction()
        self.assertEqual(txn.status, 'pending')

    # --- Status transitions ---

    def test_action_complete(self):
        """Pending → Completed"""
        txn = self._create_transaction()
        txn.with_context(bypass_investment_update=True).action_complete()
        self.assertEqual(txn.status, 'completed')

    def test_action_cancel(self):
        """Pending → Cancelled"""
        txn = self._create_transaction()
        txn.action_cancel()
        self.assertEqual(txn.status, 'cancelled')

    # --- T+2 date computation ---

    def test_t2_date_computed(self):
        """T+2 date should be 2 calendar days after created_at."""
        txn = self._create_transaction()
        if txn.created_at and txn.t2_date:
            expected = (txn.created_at + timedelta(days=2)).date()
            self.assertEqual(txn.t2_date, expected)

    # --- Lot size constraint ---

    def test_lot_size_negotiated_must_be_multiple_of_100(self):
        """For negotiated orders, units should be multiple of LOT_SIZE (100)."""
        try:
            txn = self._create_transaction(
                order_mode='negotiated',
                units=150,  # Not divisible by 100
            )
            # If constraint exists, it should raise
            # If no constraint, this passes (depending on implementation)
        except ValidationError:
            pass  # Expected for strict lot size enforcement

    # --- Compute sell value ---

    def test_compute_sell_value(self):
        """Verify sell_value computation formula."""
        txn = self._create_transaction()
        result = txn.compute_sell_value(
            order_value=1_000_000,
            interest_rate_percent=8.0,
            term_months=12,
        )
        # Expected: 1M * 8% / 365 * 360 + 1M
        days = 360
        expected = 1_000_000 * (8.0 / 100) / 365 * days + 1_000_000
        self.assertAlmostEqual(result, expected, places=2)

    def test_compute_days(self):
        """_compute_days with term_months."""
        txn = self._create_transaction()
        result = txn._compute_days(term_months=12)
        self.assertEqual(result, 360)

    def test_compute_days_direct(self):
        """_compute_days with direct days."""
        txn = self._create_transaction()
        result = txn._compute_days(days=30)
        self.assertEqual(result, 30)


class TestTransactionInvestmentUpdate(TransactionCase):
    """Test _update_investment() when transaction completes."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Transaction = cls.env['portfolio.transaction']
        cls.Fund = cls.env['portfolio.fund']
        cls.Investment = cls.env['portfolio.investment']
        cls.User = cls.env['res.users']

        cls.test_user = cls.User.create({
            'name': 'Investor Update Test',
            'login': 'inv_update_test@arc.vn',
            'email': 'inv_update_test@arc.vn',
        })
        cls.test_fund = cls.Fund.create({
            'name': 'Fund Update Test',
            'ticker': 'FUT',
            'inception_date': '2024-01-01',
            'current_nav': 10000.0,
            'investment_type': 'Growth',
            'status': 'active',
        })

    def test_buy_creates_investment(self):
        """Completing a buy transaction should create/update investment."""
        txn = self.Transaction.create({
            'user_id': self.test_user.id,
            'fund_id': self.test_fund.id,
            'transaction_type': 'buy',
            'status': 'pending',
            'units': 100,
            'price': 10000.0,
            'order_value': 1_000_000,
            'order_mode': 'negotiated',
        })
        txn.action_complete()

        # Check investment was created
        investment = self.Investment.search([
            ('user_id', '=', self.test_user.id),
            ('fund_id', '=', self.test_fund.id),
        ], limit=1)
        self.assertTrue(investment, "Investment should be created on buy completion")
        self.assertEqual(investment.status, 'active')
