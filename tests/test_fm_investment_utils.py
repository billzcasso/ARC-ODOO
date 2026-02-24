# -*- coding: utf-8 -*-
"""
Tests for fund_management.utils.investment_utils.InvestmentHelper

Covers static methods only (no Odoo dependency):
- compute_days: term_months → days conversion
- compute_sell_value: interest rate calculation
"""
import pytest
from fund_management.utils.investment_utils import InvestmentHelper
from fund_management.utils.constants import DEFAULT_DAYS_PER_MONTH


class TestComputeDays:
    """Test InvestmentHelper.compute_days()"""

    def test_from_term_months(self):
        """12 months * 30 days = 360"""
        assert InvestmentHelper.compute_days(term_months=12) == 360

    def test_from_term_months_1(self):
        assert InvestmentHelper.compute_days(term_months=1) == 30

    def test_from_days(self):
        """Direct days input takes priority"""
        assert InvestmentHelper.compute_days(days=5) == 5

    def test_days_priority_over_months(self):
        """When both given, days wins"""
        assert InvestmentHelper.compute_days(term_months=12, days=5) == 5

    def test_none_both_returns_1(self):
        """Fallback minimum is 1"""
        assert InvestmentHelper.compute_days(None, None) == 1

    def test_zero_term_returns_1(self):
        assert InvestmentHelper.compute_days(term_months=0) == 1

    def test_negative_term_returns_1(self):
        assert InvestmentHelper.compute_days(term_months=-5) == 1

    def test_zero_days_fallback_to_months(self):
        """days=0 is falsy, falls through to months check"""
        assert InvestmentHelper.compute_days(term_months=6, days=0) == 180

    def test_default_days_per_month(self):
        """Verify the constant is 30"""
        assert DEFAULT_DAYS_PER_MONTH == 30


class TestComputeSellValue:
    """Test InvestmentHelper.compute_sell_value()"""

    def test_basic_calculation(self):
        """1,000,000 * 8% / 365 * 360 + 1,000,000"""
        result = InvestmentHelper.compute_sell_value(
            order_value=1_000_000,
            interest_rate_percent=8.0,
            term_months=12,
        )
        expected = 1_000_000 * (8.0 / 100.0) / 365.0 * 360 + 1_000_000
        assert abs(result - expected) < 0.01

    def test_zero_interest(self):
        """0% interest → return original value"""
        result = InvestmentHelper.compute_sell_value(
            order_value=1_000_000,
            interest_rate_percent=0,
            term_months=12,
        )
        assert result == 1_000_000

    def test_zero_value(self):
        result = InvestmentHelper.compute_sell_value(0, 8.0, term_months=12)
        assert result == 0

    def test_none_values(self):
        result = InvestmentHelper.compute_sell_value(None, None)
        assert result == 0

    def test_with_days_parameter(self):
        """Use direct days instead of months"""
        result = InvestmentHelper.compute_sell_value(
            order_value=1_000_000,
            interest_rate_percent=10.0,
            days=30,
        )
        expected = 1_000_000 * (10.0 / 100.0) / 365.0 * 30 + 1_000_000
        assert abs(result - expected) < 0.01

    def test_interest_compounds_linearly(self):
        """Verify it's simple interest (linear), not compound"""
        val_6m = InvestmentHelper.compute_sell_value(1_000_000, 12.0, term_months=6)
        val_12m = InvestmentHelper.compute_sell_value(1_000_000, 12.0, term_months=12)
        interest_6m = val_6m - 1_000_000
        interest_12m = val_12m - 1_000_000
        # 12 month interest should be ~2x 6 month interest
        ratio = interest_12m / interest_6m
        assert abs(ratio - 2.0) < 0.01
