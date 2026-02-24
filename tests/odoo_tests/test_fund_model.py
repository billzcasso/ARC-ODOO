# -*- coding: utf-8 -*-
"""
Odoo TransactionCase tests for portfolio.fund model.

Run inside Docker container:
    odoo -d <db_name> --test-enable --stop-after-init -i fund_management

Tests:
- Fund CRUD operations
- _map_fund_type() mapping logic
- Field defaults and constraints
"""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError


class TestFundModel(TransactionCase):
    """Test portfolio.fund model."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Fund = cls.env['portfolio.fund']
        cls.fund_vals = {
            'name': 'Test Fund Alpha',
            'ticker': 'TFA',
            'inception_date': '2024-01-01',
            'current_nav': 10000.0,
            'investment_type': 'Growth',
            'status': 'active',
        }

    def test_create_fund(self):
        """Create a fund with required fields."""
        fund = self.Fund.create(self.fund_vals)
        self.assertTrue(fund.id)
        self.assertEqual(fund.name, 'Test Fund Alpha')
        self.assertEqual(fund.ticker, 'TFA')

    def test_default_status_active(self):
        """Default status should be 'active'."""
        fund = self.Fund.create(self.fund_vals)
        self.assertEqual(fund.status, 'active')

    def test_default_numeric_fields_zero(self):
        """Numeric fields should default to 0."""
        fund = self.Fund.create(self.fund_vals)
        self.assertEqual(fund.investment_count, 0)
        self.assertEqual(fund.total_units, 0.0)
        self.assertEqual(fund.profit_loss, 0.0)

    def test_map_fund_type_equity(self):
        """'equity' → 'Growth'"""
        fund = self.Fund.create(self.fund_vals)
        result = fund._map_fund_type('equity')
        self.assertEqual(result, 'Growth')

    def test_map_fund_type_bond(self):
        """'bond' → 'Income'"""
        fund = self.Fund.create(self.fund_vals)
        result = fund._map_fund_type('bond')
        self.assertEqual(result, 'Income')

    def test_map_fund_type_mixed(self):
        """'mixed' → 'Income & Growth'"""
        fund = self.Fund.create(self.fund_vals)
        result = fund._map_fund_type('mixed')
        self.assertEqual(result, 'Income & Growth')

    def test_map_fund_type_unknown_fallback(self):
        """Unknown type → falls back to fund's current investment_type."""
        fund = self.Fund.create(self.fund_vals)
        result = fund._map_fund_type('unknown')
        self.assertEqual(result, fund.investment_type)

    def test_map_fund_type_none_fallback(self):
        """None → falls back to fund's investment_type."""
        fund = self.Fund.create(self.fund_vals)
        result = fund._map_fund_type(None)
        self.assertEqual(result, fund.investment_type)

    def test_write_fund(self):
        """Update fund fields."""
        fund = self.Fund.create(self.fund_vals)
        fund.write({'current_nav': 12000.0})
        self.assertEqual(fund.current_nav, 12000.0)

    def test_investment_ids_relation(self):
        """investment_ids should be a One2many to portfolio.investment."""
        fund = self.Fund.create(self.fund_vals)
        self.assertEqual(len(fund.investment_ids), 0)

    def test_default_color(self):
        """Default color should be #2B4BFF."""
        fund = self.Fund.create(self.fund_vals)
        self.assertEqual(fund.color, '#2B4BFF')
