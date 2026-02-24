# -*- coding: utf-8 -*-
"""
Tests for fund_management.utils.constants

Validates structural integrity of all Selection lists and mappings:
- No duplicate keys
- Valid (key, label) tuple format
- Mapping values exist in source lists
- Default values are valid selections
"""
import pytest
from fund_management.utils import constants


class TestSelectionListIntegrity:
    """All Odoo Selection fields must have (key, label) tuples with unique keys."""

    SELECTION_LISTS = [
        ('TRANSACTION_TYPES', constants.TRANSACTION_TYPES),
        ('TRANSACTION_STATUSES', constants.TRANSACTION_STATUSES),
        ('INVESTMENT_STATUSES', constants.INVESTMENT_STATUSES),
        ('FUND_STATUSES', constants.FUND_STATUSES),
        ('INVESTMENT_TYPES', constants.INVESTMENT_TYPES),
        ('FUND_INVESTMENT_TYPES', constants.FUND_INVESTMENT_TYPES),
        ('TRANSACTION_SOURCES', constants.TRANSACTION_SOURCES),
        ('CONTRACT_SIGNED_TYPES', constants.CONTRACT_SIGNED_TYPES),
        ('ORDER_MODES', constants.ORDER_MODES),
        ('ORDER_TYPE_DETAILS', constants.ORDER_TYPE_DETAILS),
        ('MARKETS', constants.MARKETS),
        ('EXCHANGE_STATUSES', constants.EXCHANGE_STATUSES),
    ]

    @pytest.mark.parametrize("name,selection_list", SELECTION_LISTS)
    def test_valid_tuple_format(self, name, selection_list):
        """Each item must be a (key, label) tuple"""
        for item in selection_list:
            assert isinstance(item, tuple), f"{name}: item {item} is not a tuple"
            assert len(item) == 2, f"{name}: item {item} doesn't have exactly 2 elements"
            assert isinstance(item[0], str), f"{name}: key {item[0]} is not a string"
            assert isinstance(item[1], str), f"{name}: label {item[1]} is not a string"

    @pytest.mark.parametrize("name,selection_list", SELECTION_LISTS)
    def test_no_duplicate_keys(self, name, selection_list):
        """All keys must be unique"""
        keys = [item[0] for item in selection_list]
        assert len(keys) == len(set(keys)), \
            f"{name}: duplicate keys found: {[k for k in keys if keys.count(k) > 1]}"

    @pytest.mark.parametrize("name,selection_list", SELECTION_LISTS)
    def test_no_empty_keys(self, name, selection_list):
        for item in selection_list:
            assert item[0].strip(), f"{name}: empty key found"

    @pytest.mark.parametrize("name,selection_list", SELECTION_LISTS)
    def test_no_empty_labels(self, name, selection_list):
        for item in selection_list:
            assert item[1].strip(), f"{name}: empty label found for key '{item[0]}'"


class TestMappingConsistency:
    """Mapping values should reference valid constants."""

    def test_fund_type_mapping_values_valid(self):
        """FUND_TYPE_MAPPING values must exist in FUND_INVESTMENT_TYPES"""
        valid_types = [t[0] for t in constants.FUND_INVESTMENT_TYPES]
        for key, value in constants.FUND_TYPE_MAPPING.items():
            assert value in valid_types, \
                f"FUND_TYPE_MAPPING['{key}'] = '{value}' not in FUND_INVESTMENT_TYPES"

    def test_order_types_by_market_valid(self):
        """ORDER_TYPES_BY_MARKET values must exist in ORDER_TYPE_DETAILS"""
        valid_types = [t[0] for t in constants.ORDER_TYPE_DETAILS]
        for market, types in constants.ORDER_TYPES_BY_MARKET.items():
            for t in types:
                assert t in valid_types, \
                    f"ORDER_TYPES_BY_MARKET['{market}'] contains '{t}' not in ORDER_TYPE_DETAILS"

    def test_market_order_types_valid(self):
        """MARKET_ORDER_TYPES must be valid order types"""
        valid_types = [t[0] for t in constants.ORDER_TYPE_DETAILS]
        for t in constants.MARKET_ORDER_TYPES:
            assert t in valid_types, f"MARKET_ORDER_TYPES: '{t}' not in ORDER_TYPE_DETAILS"

    def test_limit_order_types_valid(self):
        valid_types = [t[0] for t in constants.ORDER_TYPE_DETAILS]
        for t in constants.LIMIT_ORDER_TYPES:
            assert t in valid_types

    def test_no_overlap_market_limit_types(self):
        """Market and Limit order types should not overlap"""
        overlap = set(constants.MARKET_ORDER_TYPES) & set(constants.LIMIT_ORDER_TYPES)
        assert len(overlap) == 0, f"Overlapping order types: {overlap}"


class TestDefaultValues:
    """Default values must be valid keys in their selection lists."""

    def test_default_fund_status(self):
        valid = [t[0] for t in constants.FUND_STATUSES]
        assert constants.DEFAULT_FUND_STATUS in valid

    def test_default_investment_status(self):
        valid = [t[0] for t in constants.INVESTMENT_STATUSES]
        assert constants.DEFAULT_INVESTMENT_STATUS in valid

    def test_default_transaction_status(self):
        valid = [t[0] for t in constants.TRANSACTION_STATUSES]
        assert constants.DEFAULT_TRANSACTION_STATUS in valid

    def test_default_transaction_source(self):
        valid = [t[0] for t in constants.TRANSACTION_SOURCES]
        assert constants.DEFAULT_TRANSACTION_SOURCE in valid

    def test_default_investment_type(self):
        valid = [t[0] for t in constants.INVESTMENT_TYPES]
        assert constants.DEFAULT_INVESTMENT_TYPE in valid

    def test_default_order_mode(self):
        valid = [t[0] for t in constants.ORDER_MODES]
        assert constants.DEFAULT_ORDER_MODE in valid

    def test_default_order_type_detail(self):
        valid = [t[0] for t in constants.ORDER_TYPE_DETAILS]
        assert constants.DEFAULT_ORDER_TYPE_DETAIL in valid

    def test_default_exchange_status(self):
        valid = [t[0] for t in constants.EXCHANGE_STATUSES]
        assert constants.DEFAULT_EXCHANGE_STATUS in valid


class TestBusinessConstants:
    """Verify critical business rule constants."""

    def test_fee_thresholds_ascending(self):
        assert constants.FEE_THRESHOLD_1 < constants.FEE_THRESHOLD_2

    def test_fee_rates_descending(self):
        """Higher amounts should have lower fee rates"""
        assert constants.FEE_RATE_1 > constants.FEE_RATE_2 > constants.FEE_RATE_3

    def test_fee_rates_positive(self):
        assert constants.FEE_RATE_1 > 0
        assert constants.FEE_RATE_2 > 0
        assert constants.FEE_RATE_3 > 0

    def test_lot_size_positive(self):
        assert constants.LOT_SIZE > 0
        assert constants.LOT_SIZE == 100

    def test_mround_step_positive(self):
        assert constants.MROUND_STEP > 0
        assert constants.MROUND_STEP == 50

    def test_all_markets_have_order_types(self):
        """Every market in MARKETS should have ORDER_TYPES_BY_MARKET entry"""
        market_keys = [m[0] for m in constants.MARKETS]
        for m in market_keys:
            assert m in constants.ORDER_TYPES_BY_MARKET, \
                f"Market '{m}' missing from ORDER_TYPES_BY_MARKET"
