#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARC-ODOO Test Runner
Usage:
    python run_tests.py              # Run all Tier 1 tests
    python run_tests.py -v           # Verbose
    python run_tests.py -k mround    # Run specific tests by keyword
"""
import sys
import os
import subprocess

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(TESTS_DIR)

def main():
    args = [sys.executable, '-m', 'pytest', TESTS_DIR, '--tb=short'] + sys.argv[1:]
    result = subprocess.run(args, cwd=PROJECT_ROOT)
    sys.exit(result.returncode)

if __name__ == '__main__':
    main()
