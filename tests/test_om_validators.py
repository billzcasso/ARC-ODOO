# -*- coding: utf-8 -*-
"""
Tests for order_matching.utils.validators

Uses unittest.mock to simulate Odoo record objects.
Tests OrderValidator static methods for:
- Status transition validation
- Match quantity validation

Note: conftest.py handles odoo mocking automatically.
"""
import pytest
import sys
from unittest.mock import MagicMock

# ValidationError comes from the conftest odoo mock
MockValidationError = sys.modules['odoo.exceptions'].ValidationError

from order_matching.utils import const
from order_matching.utils.validators import OrderValidator, UserValidator


class TestOrderValidatorStatusTransition:
    """Test OrderValidator.validate_status_transition()"""

    def test_pending_to_completed(self):
        assert OrderValidator.validate_status_transition('pending', 'completed') is True

    def test_pending_to_cancelled(self):
        assert OrderValidator.validate_status_transition('pending', 'cancelled') is True

    def test_same_status_always_valid(self):
        for status in ['pending', 'completed', 'cancelled']:
            assert OrderValidator.validate_status_transition(status, status) is True

    def test_completed_to_pending_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_status_transition('completed', 'pending')

    def test_completed_to_cancelled_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_status_transition('completed', 'cancelled')

    def test_cancelled_to_pending_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_status_transition('cancelled', 'pending')

    def test_cancelled_to_completed_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_status_transition('cancelled', 'completed')


class TestOrderValidatorMatchQuantity:
    """Test OrderValidator.validate_match_quantity()"""

    def test_valid_quantity(self):
        result = OrderValidator.validate_match_quantity(50, 100, 100)
        assert result == 50

    def test_match_exact_min(self):
        """Match exactly min(buy, sell)"""
        result = OrderValidator.validate_match_quantity(80, 80, 100)
        assert result == 80

    def test_zero_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_match_quantity(0, 100, 100)

    def test_negative_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_match_quantity(-1, 100, 100)

    def test_exceeds_buy_remaining_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_match_quantity(200, 100, 300)

    def test_exceeds_sell_remaining_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_match_quantity(200, 300, 100)

    def test_below_min_quantity_raises(self):
        """Quantity below MIN_MATCH_QUANTITY should raise"""
        tiny = const.MIN_MATCH_QUANTITY / 2
        if tiny > 0:
            with pytest.raises(MockValidationError):
                OrderValidator.validate_match_quantity(tiny, 100, 100)

    def test_none_values_raises(self):
        with pytest.raises(MockValidationError):
            OrderValidator.validate_match_quantity(None, 100, 100)


class TestOrderValidatorMatchingConditions:
    """Test OrderValidator.validate_matching_conditions() with mock records."""

    def _make_order(self, user_id, status, price, remaining_units):
        order = MagicMock()
        order.user_id.id = user_id
        order.status = status
        order.price = price
        order.remaining_units = remaining_units
        return order

    def test_valid_match(self):
        buy = self._make_order(1, 'pending', 100, 50)
        sell = self._make_order(2, 'pending', 90, 30)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is True

    def test_same_user_rejected(self):
        buy = self._make_order(1, 'pending', 100, 50)
        sell = self._make_order(1, 'pending', 90, 30)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is False

    def test_buy_not_pending_rejected(self):
        buy = self._make_order(1, 'completed', 100, 50)
        sell = self._make_order(2, 'pending', 90, 30)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is False

    def test_sell_not_pending_rejected(self):
        buy = self._make_order(1, 'pending', 100, 50)
        sell = self._make_order(2, 'completed', 90, 30)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is False

    def test_buy_price_below_sell_rejected(self):
        """buy_price < sell_price → cannot match"""
        buy = self._make_order(1, 'pending', 80, 50)
        sell = self._make_order(2, 'pending', 90, 30)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is False

    def test_buy_price_equals_sell_accepted(self):
        """buy_price == sell_price → can match"""
        buy = self._make_order(1, 'pending', 100, 50)
        sell = self._make_order(2, 'pending', 100, 30)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is True

    def test_zero_buy_remaining_rejected(self):
        buy = self._make_order(1, 'pending', 100, 0)
        sell = self._make_order(2, 'pending', 90, 30)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is False

    def test_zero_sell_remaining_rejected(self):
        buy = self._make_order(1, 'pending', 100, 50)
        sell = self._make_order(2, 'pending', 90, 0)
        can_match, reason = OrderValidator.validate_matching_conditions(buy, sell)
        assert can_match is False


class TestOrderValidatorOrderBeforeMatch:
    """Test validate_order_before_match() with mock records."""

    def _make_order(self, status, price, units, remaining_units):
        order = MagicMock()
        order.status = status
        order.price = price
        order.units = units
        order.remaining_units = remaining_units
        return order

    def test_valid_order(self):
        order = self._make_order('pending', 100, 50, 50)
        assert OrderValidator.validate_order_before_match(order) is True

    def test_not_pending_raises(self):
        order = self._make_order('completed', 100, 50, 50)
        with pytest.raises(MockValidationError):
            OrderValidator.validate_order_before_match(order)

    def test_zero_remaining_raises(self):
        order = self._make_order('pending', 100, 50, 0)
        with pytest.raises(MockValidationError):
            OrderValidator.validate_order_before_match(order)

    def test_zero_price_raises(self):
        order = self._make_order('pending', 0, 50, 50)
        with pytest.raises(MockValidationError):
            OrderValidator.validate_order_before_match(order)

    def test_zero_units_raises(self):
        order = self._make_order('pending', 100, 0, 50)
        with pytest.raises(MockValidationError):
            OrderValidator.validate_order_before_match(order)


class TestUserValidator:
    """Test UserValidator static methods."""

    def test_validate_permission_with_user(self):
        user = MagicMock()
        assert UserValidator.validate_user_permission(user, 'create_order') is True

    def test_validate_permission_none_raises(self):
        with pytest.raises(MockValidationError):
            UserValidator.validate_user_permission(None, 'create_order')

    def test_validate_user_type_with_user(self):
        user = MagicMock()
        assert UserValidator.validate_user_type(user, 'investor') is True

    def test_validate_user_type_none_raises(self):
        with pytest.raises(MockValidationError):
            UserValidator.validate_user_type(None, 'investor')
