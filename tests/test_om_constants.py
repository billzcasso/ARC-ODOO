# -*- coding: utf-8 -*-
"""
Tests for order_matching.utils.const

Validates structural integrity of order matching constants.
"""
import pytest
from order_matching.utils import const


class TestOrderStatuses:
    def test_has_pending(self):
        keys = [s[0] for s in const.ORDER_STATUSES]
        assert 'pending' in keys

    def test_has_completed(self):
        keys = [s[0] for s in const.ORDER_STATUSES]
        assert 'completed' in keys

    def test_has_cancelled(self):
        keys = [s[0] for s in const.ORDER_STATUSES]
        assert 'cancelled' in keys

    def test_no_duplicate_keys(self):
        keys = [s[0] for s in const.ORDER_STATUSES]
        assert len(keys) == len(set(keys))


class TestStatusTransitions:
    def test_all_statuses_have_transition_rules(self):
        """Every status in ORDER_STATUSES must have an entry in VALID_STATUS_TRANSITIONS"""
        status_keys = [s[0] for s in const.ORDER_STATUSES]
        for key in status_keys:
            assert key in const.VALID_STATUS_TRANSITIONS, \
                f"Status '{key}' missing from VALID_STATUS_TRANSITIONS"

    def test_terminal_states_have_no_transitions(self):
        """completed and cancelled should not transition to anything"""
        assert const.VALID_STATUS_TRANSITIONS.get('completed') == []
        assert const.VALID_STATUS_TRANSITIONS.get('cancelled') == []

    def test_pending_can_transition(self):
        transitions = const.VALID_STATUS_TRANSITIONS.get('pending', [])
        assert 'completed' in transitions
        assert 'cancelled' in transitions

    def test_transition_targets_are_valid_statuses(self):
        valid_keys = [s[0] for s in const.ORDER_STATUSES]
        for source, targets in const.VALID_STATUS_TRANSITIONS.items():
            for target in targets:
                assert target in valid_keys, \
                    f"Transition target '{target}' from '{source}' not in ORDER_STATUSES"


class TestMatchingRules:
    def test_min_match_quantity_positive(self):
        assert const.MIN_MATCH_QUANTITY > 0

    def test_max_match_quantity_positive(self):
        assert const.MAX_MATCH_QUANTITY > 0

    def test_min_less_than_max(self):
        assert const.MIN_MATCH_QUANTITY < const.MAX_MATCH_QUANTITY

    def test_priority_score_weights_positive(self):
        assert const.PRIORITY_SCORE_PRICE_WEIGHT > 0
        assert const.PRIORITY_SCORE_TIME_WEIGHT > 0

    def test_price_weight_greater_than_time(self):
        """Price should be more important than time"""
        assert const.PRIORITY_SCORE_PRICE_WEIGHT > const.PRIORITY_SCORE_TIME_WEIGHT

    def test_queue_limits_positive(self):
        assert const.QUEUE_MAX_ITERATIONS > 0
        assert const.QUEUE_BATCH_SIZE > 0

    def test_decimal_places_non_negative(self):
        assert const.PRICE_DECIMAL_PLACES >= 0
        assert const.QUANTITY_DECIMAL_PLACES >= 0
        assert const.AMOUNT_DECIMAL_PLACES >= 0


class TestTransactionTypes:
    def test_buy_and_sell_exist(self):
        keys = [t[0] for t in const.TRANSACTION_TYPES]
        assert 'buy' in keys
        assert 'sell' in keys

    def test_order_types_match(self):
        """ORDER_TYPES should mirror TRANSACTION_TYPES"""
        order_keys = set(t[0] for t in const.ORDER_TYPES)
        tx_keys = set(t[0] for t in const.TRANSACTION_TYPES)
        assert order_keys == tx_keys


class TestUserTypes:
    def test_has_investor(self):
        keys = [t[0] for t in const.USER_TYPES]
        assert 'investor' in keys

    def test_has_market_maker(self):
        keys = [t[0] for t in const.USER_TYPES]
        assert 'market_maker' in keys

    def test_no_duplicate_keys(self):
        keys = [t[0] for t in const.USER_TYPES]
        assert len(keys) == len(set(keys))
