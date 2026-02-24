# -*- coding: utf-8 -*-
"""
Tests for nav_management.utils.date_utils

Covers:
- workday(): Excel WORKDAY equivalent (skip weekends + holidays)
- weekday(): Excel WEEKDAY with return_type 1/2/3
- next_weekday(): Jump to next Mon-Fri
"""
import pytest
from datetime import date, datetime, timedelta

from nav_management.utils.date_utils import workday, weekday, next_weekday


class TestWorkday:
    """Test workday() — Excel WORKDAY function."""

    def test_forward_5_from_monday(self):
        """Mon 2024-01-01 + 5 working days = Mon 2024-01-08"""
        start = date(2024, 1, 1)  # Monday
        result = workday(start, 5)
        assert result == date(2024, 1, 8)

    def test_forward_1_from_friday(self):
        """Fri 2024-01-05 + 1 working day = Mon 2024-01-08 (skip weekend)"""
        start = date(2024, 1, 5)  # Friday
        result = workday(start, 1)
        assert result == date(2024, 1, 8)

    def test_forward_with_holidays(self):
        """Mon + 5 days, but Wed is holiday → result shifts 1 day"""
        start = date(2024, 1, 1)  # Monday
        holidays = [date(2024, 1, 3)]  # Wednesday holiday
        result = workday(start, 5, holidays)
        # Without holiday: Mon→Tue→Wed→Thu→Fri→Mon(8th)
        # With Weds holiday: Mon→Tue→[skip Wed]→Thu→Fri→Mon(8th)→Tue(9th)
        assert result == date(2024, 1, 9)

    def test_backward_2_from_wednesday(self):
        """Wed 2024-01-03 - 2 working days = Mon 2024-01-01"""
        start = date(2024, 1, 3)  # Wednesday
        result = workday(start, -2)
        assert result == date(2024, 1, 1)

    def test_backward_skips_weekend(self):
        """Mon 2024-01-08 - 1 = Fri 2024-01-05"""
        start = date(2024, 1, 8)  # Monday
        result = workday(start, -1)
        assert result == date(2024, 1, 5)

    def test_zero_days(self):
        """0 working days → same date"""
        start = date(2024, 1, 1)
        result = workday(start, 0)
        assert result == start

    def test_none_start_returns_none(self):
        assert workday(None, 5) is None

    def test_datetime_input(self):
        """datetime input → date output"""
        start = datetime(2024, 1, 1, 10, 30)
        result = workday(start, 1)
        assert isinstance(result, date)
        assert result == date(2024, 1, 2)

    def test_holiday_as_datetime(self):
        """Holiday as datetime should still work"""
        start = date(2024, 1, 1)
        holidays = [datetime(2024, 1, 2, 0, 0)]
        result = workday(start, 1, holidays)
        assert result == date(2024, 1, 3)

    def test_result_is_always_weekday(self):
        """Result should never be Saturday or Sunday"""
        start = date(2024, 1, 1)
        for days in range(1, 30):
            result = workday(start, days)
            assert result.weekday() < 5, f"workday({start}, {days}) = {result} (weekday {result.weekday()})"


class TestWeekday:
    """Test weekday() — Excel WEEKDAY function."""

    def test_monday_return_type_1(self):
        """Mon, return_type=1: Sunday=1 → Mon=2"""
        mon = date(2024, 1, 1)  # Monday
        assert weekday(mon, return_type=1) == 2  # Mon=2 in Sunday=1 system

    def test_monday_return_type_2(self):
        """Mon, return_type=2 (ISO): Mon=1"""
        mon = date(2024, 1, 1)
        assert weekday(mon, return_type=2) == 1

    def test_monday_return_type_3(self):
        """Mon, return_type=3: Mon=0"""
        mon = date(2024, 1, 1)
        assert weekday(mon, return_type=3) == 0

    def test_sunday_return_type_1(self):
        """Sun, return_type=1: Sunday=1"""
        sun = date(2024, 1, 7)  # Sunday
        assert weekday(sun, return_type=1) == 1

    def test_sunday_return_type_2(self):
        """Sun, return_type=2: Sunday=7"""
        sun = date(2024, 1, 7)
        assert weekday(sun, return_type=2) == 7

    def test_saturday_return_type_2(self):
        """Sat, return_type=2: Saturday=6"""
        sat = date(2024, 1, 6)
        assert weekday(sat, return_type=2) == 6

    def test_none_returns_none(self):
        assert weekday(None) is None

    def test_datetime_input(self):
        dt = datetime(2024, 1, 1, 12, 0)
        assert weekday(dt, return_type=2) == 1

    def test_default_return_type_is_2(self):
        mon = date(2024, 1, 1)
        assert weekday(mon) == 1  # Default ISO = Monday=1

    def test_invalid_return_type_defaults(self):
        """Invalid return_type → defaults to type 2"""
        mon = date(2024, 1, 1)
        assert weekday(mon, return_type=99) == 1


class TestNextWeekday:
    """Test next_weekday() function."""

    def test_weekday_unchanged(self):
        """Tuesday → Tuesday (no change)"""
        tue = date(2024, 1, 2)
        assert next_weekday(tue) == tue

    def test_saturday_to_monday(self):
        """Saturday → next Monday"""
        sat = date(2024, 1, 6)
        result = next_weekday(sat)
        assert result == date(2024, 1, 8)
        assert result.weekday() == 0  # Monday

    def test_sunday_to_monday(self):
        """Sunday → next Monday"""
        sun = date(2024, 1, 7)
        result = next_weekday(sun)
        assert result == date(2024, 1, 8)

    def test_friday_unchanged(self):
        """Friday → Friday (still a weekday)"""
        fri = date(2024, 1, 5)
        assert next_weekday(fri) == fri

    def test_none_returns_none(self):
        assert next_weekday(None) is None

    def test_datetime_input(self):
        sat = datetime(2024, 1, 6, 15, 0)
        result = next_weekday(sat)
        assert isinstance(result, date)
        assert result.weekday() == 0
