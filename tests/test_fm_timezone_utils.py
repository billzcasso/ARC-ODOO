# -*- coding: utf-8 -*-
"""
Tests for fund_management.utils.timezone_utils

Covers:
- Vietnam timezone conversion (UTC ↔ Asia/Ho_Chi_Minh)
- calculate_date_end month addition with overflow handling
- Formatting functions
- None/edge case handling
"""
import pytest
from datetime import datetime, date
import pytz

from fund_management.utils.timezone_utils import (
    get_vietnam_now,
    get_vietnam_now_utc,
    to_vietnam_tz,
    to_utc,
    calculate_date_end,
    format_vietnam_datetime,
    format_vietnam_date,
    set_created_at_vietnam,
    set_date_end_vietnam,
    VIETNAM_TIMEZONE,
    UTC_TIMEZONE,
)


class TestGetVietnamNow:
    def test_returns_vietnam_timezone(self):
        result = get_vietnam_now()
        assert result.tzinfo is not None
        assert str(result.tzinfo) == 'Asia/Ho_Chi_Minh'

    def test_returns_datetime(self):
        result = get_vietnam_now()
        assert isinstance(result, datetime)


class TestGetVietnamNowUtc:
    def test_returns_naive_utc(self):
        result = get_vietnam_now_utc()
        assert result.tzinfo is None

    def test_is_7_hours_behind_vietnam(self):
        vn = get_vietnam_now()
        utc = get_vietnam_now_utc()
        # UTC should be ~7 hours behind Vietnam
        diff = vn.replace(tzinfo=None) - utc
        # Allow for small execution time difference
        assert 6 * 3600 < diff.total_seconds() < 8 * 3600


class TestToVietnamTz:
    def test_none_returns_none(self):
        assert to_vietnam_tz(None) is None

    def test_naive_utc_assumed(self):
        """Naive datetime is assumed UTC → converts to +7"""
        naive_utc = datetime(2024, 1, 1, 0, 0, 0)
        result = to_vietnam_tz(naive_utc)
        assert result.hour == 7  # UTC 00:00 → VN 07:00

    def test_aware_utc_converts(self):
        aware_utc = UTC_TIMEZONE.localize(datetime(2024, 6, 15, 10, 0, 0))
        result = to_vietnam_tz(aware_utc)
        assert result.hour == 17  # UTC 10:00 → VN 17:00

    def test_already_vietnam_unchanged(self):
        vn_dt = VIETNAM_TIMEZONE.localize(datetime(2024, 1, 1, 12, 0, 0))
        result = to_vietnam_tz(vn_dt)
        assert result.hour == 12


class TestToUtc:
    def test_none_returns_none(self):
        assert to_utc(None) is None

    def test_naive_assumed_vietnam(self):
        """Naive datetime is assumed Vietnam → converts to UTC-7"""
        naive_vn = datetime(2024, 1, 1, 7, 0, 0)
        result = to_utc(naive_vn)
        assert result.hour == 0  # VN 07:00 → UTC 00:00
        assert result.tzinfo is None  # Returns naive for Odoo

    def test_aware_vietnam_converts(self):
        vn_dt = VIETNAM_TIMEZONE.localize(datetime(2024, 1, 1, 14, 0, 0))
        result = to_utc(vn_dt)
        assert result.hour == 7  # VN 14:00 → UTC 07:00
        assert result.tzinfo is None


class TestCalculateDateEnd:
    def test_none_start_returns_none(self):
        assert calculate_date_end(None, 12) is None

    def test_zero_term_returns_none(self):
        assert calculate_date_end(datetime(2024, 1, 1), 0) is None

    def test_none_term_returns_none(self):
        assert calculate_date_end(datetime(2024, 1, 1), None) is None

    def test_12_months(self):
        """Jan 1 + 12 months = Jan 1 next year"""
        start = datetime(2024, 1, 1, 0, 0, 0)
        result = calculate_date_end(start, 12)
        assert result is not None
        # Result is UTC naive
        assert result.tzinfo is None
        # Should be Jan 2025 in Vietnam time
        result_vn = to_vietnam_tz(result)
        assert result_vn.year == 2025
        assert result_vn.month == 1

    def test_month_overflow_handling(self):
        """Jan 31 + 1 month → Feb 28/29 (handles day overflow)"""
        start = datetime(2024, 1, 31, 0, 0, 0)  # 2024 is leap year
        result = calculate_date_end(start, 1)
        result_vn = to_vietnam_tz(result)
        assert result_vn.month == 2
        assert result_vn.day <= 29  # Feb 2024 has 29 days

    def test_year_overflow(self):
        """Nov 2024 + 3 months → Feb 2025"""
        start = datetime(2024, 11, 1, 0, 0, 0)
        result = calculate_date_end(start, 3)
        result_vn = to_vietnam_tz(result)
        assert result_vn.year == 2025
        assert result_vn.month == 2

    def test_result_is_naive_utc(self):
        """Return value should be naive datetime for Odoo storage"""
        start = datetime(2024, 6, 1, 0, 0, 0)
        result = calculate_date_end(start, 6)
        assert result.tzinfo is None


class TestFormatVietnamDatetime:
    def test_none_returns_dash(self):
        assert format_vietnam_datetime(None) == '--'

    def test_formats_correctly(self):
        utc_dt = datetime(2024, 1, 1, 0, 0, 0)
        result = format_vietnam_datetime(utc_dt)
        assert '01/01/2024' in result
        assert '07:00:00' in result  # UTC 00:00 → VN 07:00

    def test_custom_format(self):
        utc_dt = datetime(2024, 6, 15, 10, 30, 0)
        result = format_vietnam_datetime(utc_dt, fmt='%Y-%m-%d')
        assert result == '2024-06-15'


class TestFormatVietnamDate:
    def test_none_returns_dash(self):
        assert format_vietnam_date(None) == '--'

    def test_date_object(self):
        d = date(2024, 3, 15)
        result = format_vietnam_date(d)
        assert result == '15/03/2024'

    def test_datetime_object(self):
        dt = datetime(2024, 3, 15, 0, 0, 0)
        result = format_vietnam_date(dt)
        assert '15/03/2024' in result


class TestConvenienceFunctions:
    def test_set_created_at_vietnam_returns_naive_utc(self):
        result = set_created_at_vietnam()
        assert isinstance(result, datetime)
        assert result.tzinfo is None

    def test_set_date_end_vietnam_delegates(self):
        start = datetime(2024, 1, 1, 0, 0, 0)
        result = set_date_end_vietnam(start, 6)
        expected = calculate_date_end(start, 6)
        assert result == expected
