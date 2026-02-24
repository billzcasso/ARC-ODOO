# -*- coding: utf-8 -*-
"""
Tests for fund_management.utils.mround

Covers:
- Custom MROUND rounding logic (threshold < 25 → down, >= 25 → up for step=50)
- Edge cases: zero, None, negative, non-default step
- Backward compatibility alias mround25
"""
import pytest
from fund_management.utils.mround import mround, mround25


class TestMround:
    """Test mround() custom rounding function."""

    # --- Core rounding logic (step=50) ---

    def test_below_threshold_rounds_down(self):
        """24 < 25 → round down: 1024 → 1000"""
        assert mround(1024) == 1000

    def test_at_threshold_rounds_up(self):
        """25 >= 25 → round up: 1025 → 1050"""
        assert mround(1025) == 1050

    def test_above_threshold_rounds_up(self):
        """49 >= 25 → round up: 1049 → 1050"""
        assert mround(1049) == 1050

    def test_exact_step_boundary(self):
        """Exact multiples stay the same: 1050 → 1050"""
        assert mround(1050) == 1050

    def test_just_above_step(self):
        """1051 → remainder 1 < 25 → 1050"""
        assert mround(1051) == 1050

    def test_zero(self):
        assert mround(0) == 0

    def test_small_value_below_step(self):
        """24 < 25 → 0"""
        assert mround(24) == 0

    def test_small_value_at_threshold(self):
        """25 >= 25 → 50"""
        assert mround(25) == 50

    # --- Edge cases ---

    def test_none_input(self):
        """None → treated as 0"""
        assert mround(None) == 0

    def test_string_numeric(self):
        """String that can be float-converted"""
        assert mround("1025") == 1050

    def test_invalid_string_returns_original(self):
        """Non-numeric string → returns original value"""
        result = mround("abc")
        assert result == "abc"

    def test_negative_step_returns_value(self):
        """step <= 0 → return num as-is"""
        assert mround(1024, -1) == 1024.0

    def test_zero_step_uses_default(self):
        """step=0 → falls back to default step=50 via (step or 50)"""
        assert mround(1024, 0) == 1000  # Same as mround(1024, 50)

    # --- Custom step ---

    def test_custom_step_100(self):
        """step=100, threshold=50: 149 → remainder 49 < 50 → 100"""
        assert mround(149, 100) == 100

    def test_custom_step_100_at_threshold(self):
        """step=100, threshold=50: 150 → remainder 50 >= 50 → 200"""
        assert mround(150, 100) == 200

    # --- Large values ---

    def test_large_value(self):
        """10,000,024 → 10,000,000"""
        assert mround(10000024) == 10000000

    def test_large_value_rounded_up(self):
        """10,000,025 → 10,000,050"""
        assert mround(10000025) == 10000050

    # --- Alias ---

    def test_mround25_is_alias(self):
        """mround25 should be the same function as mround"""
        assert mround25 is mround

    def test_mround25_works(self):
        assert mround25(1025) == 1050
