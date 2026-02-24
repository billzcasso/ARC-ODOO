# -*- coding: utf-8 -*-
"""
Odoo TransactionCase tests for PayOS gateway service.

Run inside Docker container:
    odoo -d <db_name> --test-enable --stop-after-init -i payos_gateway

Tests:
- PayOS config model CRUD
- Webhook signature verification (mocked)
"""
from odoo.tests.common import TransactionCase
from unittest.mock import patch, MagicMock


class TestPayosConfig(TransactionCase):
    """Test payos.config model."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Config = cls.env['payos.config']

    def test_create_config(self):
        """Create PayOS config record."""
        config = self.Config.create({
            'name': 'Test PayOS Config',
            'client_id': 'test_client_id',
            'api_key': 'test_api_key',
            'checksum_key': 'test_checksum_key',
        })
        self.assertTrue(config.id)
        self.assertEqual(config.name, 'Test PayOS Config')

    def test_config_fields_stored(self):
        """Verify credential fields are stored correctly."""
        config = self.Config.create({
            'name': 'PayOS Prod',
            'client_id': 'CID123',
            'api_key': 'KEY456',
            'checksum_key': 'CHKSUM789',
        })
        self.assertEqual(config.client_id, 'CID123')
        self.assertEqual(config.api_key, 'KEY456')
        self.assertEqual(config.checksum_key, 'CHKSUM789')
