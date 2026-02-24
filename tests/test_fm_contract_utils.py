# -*- coding: utf-8 -*-
"""
Tests for fund_management.utils.contract_utils

Covers:
- ContractCodeGenerator: code generation, filename
- ContractHashGenerator: SHA256 hashing, base64 decoding
- Edge cases: empty data, invalid base64
"""
import pytest
import hashlib
import base64
from unittest.mock import patch

from fund_management.utils.contract_utils import (
    ContractCodeGenerator,
    ContractHashGenerator,
)


class TestContractCodeGenerator:

    def test_generate_code_hand(self):
        code = ContractCodeGenerator.generate_code('hand')
        assert code.startswith('SC-H-')

    def test_generate_code_digital(self):
        code = ContractCodeGenerator.generate_code('digital')
        assert code.startswith('SC-D-')

    def test_generate_code_default_is_hand(self):
        code = ContractCodeGenerator.generate_code()
        assert code.startswith('SC-H-')

    def test_generate_code_unknown_type_is_hand(self):
        code = ContractCodeGenerator.generate_code('unknown')
        assert code.startswith('SC-H-')

    def test_generate_code_contains_timestamp(self):
        """Code should contain a YYYYMMDDHHMMSS timestamp"""
        code = ContractCodeGenerator.generate_code('hand')
        parts = code.split('-', 2)
        assert len(parts) == 3
        timestamp = parts[2]
        assert len(timestamp) == 14  # YYYYMMDDHHMMSS
        assert timestamp.isdigit()

    def test_generate_code_unique(self):
        """Two codes generated should be different (unless in same second)"""
        code1 = ContractCodeGenerator.generate_code('hand')
        code2 = ContractCodeGenerator.generate_code('digital')
        # At minimum, prefix differs
        assert code1[:4] != code2[:4]

    def test_generate_filename(self):
        assert ContractCodeGenerator.generate_filename('SC-H-20240101120000') == 'SC-H-20240101120000.pdf'

    def test_generate_filename_empty(self):
        assert ContractCodeGenerator.generate_filename('') == '.pdf'

    def test_prefix_constants(self):
        assert ContractCodeGenerator.PREFIX_DIGITAL == 'SC-D'
        assert ContractCodeGenerator.PREFIX_HAND == 'SC-H'


class TestContractHashGenerator:

    def test_compute_hash_basic(self):
        data = b'Hello World'
        result = ContractHashGenerator.compute_hash(data)
        expected = hashlib.sha256(data).hexdigest()
        assert result == expected

    def test_compute_hash_empty(self):
        result = ContractHashGenerator.compute_hash(b'')
        expected = hashlib.sha256(b'').hexdigest()
        assert result == expected

    def test_compute_hash_is_sha256_hex(self):
        result = ContractHashGenerator.compute_hash(b'test')
        assert len(result) == 64  # SHA256 hex = 64 chars
        assert all(c in '0123456789abcdef' for c in result)

    def test_compute_hash_from_base64_valid(self):
        original = b'contract data 123'
        b64 = base64.b64encode(original).decode()
        result = ContractHashGenerator.compute_hash_from_base64(b64)
        expected = hashlib.sha256(original).hexdigest()
        assert result == expected

    def test_compute_hash_from_base64_invalid(self):
        """Invalid base64 → empty string"""
        result = ContractHashGenerator.compute_hash_from_base64('not-valid-base64!@#')
        assert result == ''

    def test_compute_hash_from_base64_empty(self):
        """Empty string base64 → should decode to empty bytes"""
        result = ContractHashGenerator.compute_hash_from_base64('')
        # base64.b64decode('') = b'' → sha256(b'').hexdigest()
        expected = hashlib.sha256(b'').hexdigest()
        assert result == expected

    def test_compute_hash_deterministic(self):
        """Same input → same hash"""
        data = b'identical data'
        r1 = ContractHashGenerator.compute_hash(data)
        r2 = ContractHashGenerator.compute_hash(data)
        assert r1 == r2

    def test_compute_hash_different_input(self):
        """Different input → different hash"""
        r1 = ContractHashGenerator.compute_hash(b'data1')
        r2 = ContractHashGenerator.compute_hash(b'data2')
        assert r1 != r2
