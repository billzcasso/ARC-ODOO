# -*- coding: utf-8 -*-
"""
Odoo TransactionCase tests for NAV management models.

Run inside Docker container:
    odoo -d <db_name> --test-enable --stop-after-init -i nav_management

Tests:
- NAV daily inventory CRUD
- NAV session management
"""
from odoo.tests.common import TransactionCase
from datetime import date


class TestNavDailyInventory(TransactionCase):
    """Test nav.daily.inventory model."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Inventory = cls.env['nav.daily.inventory']
        cls.Fund = cls.env['portfolio.fund']

        cls.test_fund = cls.Fund.create({
            'name': 'NAV Test Fund',
            'ticker': 'NTF',
            'inception_date': '2024-01-01',
            'current_nav': 10000.0,
            'investment_type': 'Growth',
            'status': 'active',
        })

    def test_create_inventory(self):
        """Create daily NAV inventory record."""
        inv = self.Inventory.create({
            'fund_id': self.test_fund.id,
            'inventory_date': date.today(),
            'opening_avg_price': 10000.0,
        })
        self.assertTrue(inv.id)
        self.assertEqual(inv.opening_avg_price, 10000.0)

    def test_inventory_linked_to_fund(self):
        """Inventory should be linked to fund."""
        inv = self.Inventory.create({
            'fund_id': self.test_fund.id,
            'inventory_date': date.today(),
            'opening_avg_price': 10000.0,
        })
        self.assertEqual(inv.fund_id.id, self.test_fund.id)
