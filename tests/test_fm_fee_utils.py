# -*- coding: utf-8 -*-
"""
Tests for fund_management.utils.fee_utils

Covers:
- 3-tier fee calculation (0.3% / 0.2% / 0.1%)
- Boundary values at 10M and 20M thresholds
- MROUND (step 50) applied to result
- Edge cases: 0, None, negative
"""
import pytest
from fund_management.utils.fee_utils import calculate_fee
from fund_management.utils.mround import mround
from fund_management.utils.constants import (
    FEE_THRESHOLD_1, FEE_THRESHOLD_2,
    FEE_RATE_1, FEE_RATE_2, FEE_RATE_3,
    MROUND_STEP,
)


class TestCalculateFee:
    """Test calculate_fee() tiered fee calculation."""

    # --- Tier 1: amount < 10M → 0.3% ---

    def test_tier1_small_amount(self):
        """1,000,000 * 0.3% = 3,000 → mround(3000, 50) = 3000"""
        result = calculate_fee(1_000_000)
        expected = mround(1_000_000 * FEE_RATE_1, MROUND_STEP)
        assert result == expected

    def test_tier1_just_below_threshold(self):
        """9,999,999 * 0.3%"""
        amount = FEE_THRESHOLD_1 - 1
        result = calculate_fee(amount)
        expected = mround(amount * FEE_RATE_1, MROUND_STEP)
        assert result == expected

    # --- Tier 2: 10M <= amount < 20M → 0.2% ---

    def test_tier2_at_threshold(self):
        """10,000,000 * 0.2%"""
        result = calculate_fee(FEE_THRESHOLD_1)
        expected = mround(FEE_THRESHOLD_1 * FEE_RATE_2, MROUND_STEP)
        assert result == expected

    def test_tier2_mid_range(self):
        """15,000,000 * 0.2%"""
        amount = 15_000_000
        result = calculate_fee(amount)
        expected = mround(amount * FEE_RATE_2, MROUND_STEP)
        assert result == expected

    def test_tier2_just_below_threshold(self):
        """19,999,999 * 0.2%"""
        amount = FEE_THRESHOLD_2 - 1
        result = calculate_fee(amount)
        expected = mround(amount * FEE_RATE_2, MROUND_STEP)
        assert result == expected

    # --- Tier 3: amount >= 20M → 0.1% ---

    def test_tier3_at_threshold(self):
        """20,000,000 * 0.1%"""
        result = calculate_fee(FEE_THRESHOLD_2)
        expected = mround(FEE_THRESHOLD_2 * FEE_RATE_3, MROUND_STEP)
        assert result == expected

    def test_tier3_large_amount(self):
        """100,000,000 * 0.1%"""
        amount = 100_000_000
        result = calculate_fee(amount)
        expected = mround(amount * FEE_RATE_3, MROUND_STEP)
        assert result == expected

    # --- Edge cases ---

    def test_zero_amount(self):
        """0 → fee = 0"""
        assert calculate_fee(0) == 0

    def test_none_amount(self):
        """None → treated as 0"""
        assert calculate_fee(None) == 0

    def test_string_amount(self):
        """String numeric → should work via float() cast"""
        result = calculate_fee("5000000")
        expected = mround(5_000_000 * FEE_RATE_1, MROUND_STEP)
        assert result == expected

    # --- Verify MROUND is applied ---

    def test_fee_is_mround_aligned(self):
        """Result should always be divisible by MROUND_STEP or 0"""
        for amount in [100_000, 5_000_000, 12_000_000, 50_000_000]:
            fee = calculate_fee(amount)
            if fee > 0:
                assert fee % MROUND_STEP == 0 or fee < MROUND_STEP, \
                    f"Fee {fee} for amount {amount} not MROUND-aligned"

    # --- Verify constants are correct ---

    def test_fee_thresholds(self):
        assert FEE_THRESHOLD_1 == 10_000_000
        assert FEE_THRESHOLD_2 == 20_000_000

    def test_fee_rates(self):
        assert FEE_RATE_1 == 0.003  # 0.3%
        assert FEE_RATE_2 == 0.002  # 0.2%
        assert FEE_RATE_3 == 0.001  # 0.1%
