# -*- coding: utf-8 -*-
"""
Pytest configuration for ARC-ODOO standalone tests.

Problem: Odoo module __init__.py files import models that depend on 'odoo'.
Solution: Mock 'odoo' and related submodules BEFORE any addon imports,
then use importlib to load utility submodules directly.
"""
import sys
import os
import types
import importlib.util

# ===========================================================================
# 1. Add addons/ to sys.path
# ===========================================================================
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADDONS_DIR = os.path.join(PROJECT_ROOT, 'addons')
if ADDONS_DIR not in sys.path:
    sys.path.insert(0, ADDONS_DIR)

# ===========================================================================
# 2. Mock 'odoo' and its submodules to prevent ImportError during collection
# ===========================================================================
_odoo_mock = types.ModuleType('odoo')
_odoo_mock.__path__ = []  # Make it a package

# Common Odoo submodules used in models/controllers
_sub_modules = [
    'odoo.api', 'odoo.fields', 'odoo.models', 'odoo.exceptions',
    'odoo.http', 'odoo.tools', 'odoo.addons', 'odoo.release',
    'odoo.tests', 'odoo.tests.common',
]

# Set up mock attributes
class _MockModel:
    """Mock for odoo.models.Model and TransactionCase etc."""
    _name = ''
    _description = ''
    _inherit = []
    def __init_subclass__(cls, **kw): pass
    @classmethod
    def __class_getitem__(cls, item): return cls

class _MockField:
    """Mock for odoo.fields.Char, Float, etc."""
    now = None  # fields.Datetime.now
    today = None  # fields.Date.today
    def __init__(self, *a, **kw): pass
    def __call__(self, *a, **kw): return self
    def __getattr__(self, name): return None  # Catch-all for unknown attributes

# Create mock modules
for mod_name in _sub_modules:
    mod = types.ModuleType(mod_name)
    sys.modules[mod_name] = mod

sys.modules['odoo'] = _odoo_mock

# Populate odoo attributes
_odoo_mock.api = sys.modules['odoo.api']
_odoo_mock.fields = sys.modules['odoo.fields']
_odoo_mock.models = sys.modules['odoo.models']
_odoo_mock.exceptions = sys.modules['odoo.exceptions']
_odoo_mock.http = sys.modules['odoo.http']
_odoo_mock.tools = sys.modules['odoo.tools']
_odoo_mock._ = lambda s, *a: s % a if a else s

# Fields mock
for field_type in ['Char', 'Text', 'Integer', 'Float', 'Boolean',
                   'Date', 'Datetime', 'Selection', 'Many2one',
                   'One2many', 'Many2many', 'Html', 'Binary',
                   'Monetary', 'Reference', 'Json', 'Image',
                   'Properties', 'PropertiesDefinition']:
    setattr(sys.modules['odoo.fields'], field_type, _MockField)

# Models mock
sys.modules['odoo.models'].Model = _MockModel
sys.modules['odoo.models'].TransientModel = _MockModel
sys.modules['odoo.models'].AbstractModel = _MockModel

# Api mock
_noop_decorator = lambda *a, **kw: (lambda f: f)
sys.modules['odoo.api'].depends = _noop_decorator
sys.modules['odoo.api'].depends_context = _noop_decorator
sys.modules['odoo.api'].model = lambda f: f
sys.modules['odoo.api'].onchange = _noop_decorator
sys.modules['odoo.api'].constrains = _noop_decorator
sys.modules['odoo.api'].model_create_multi = lambda f: f
sys.modules['odoo.api'].autovacuum = lambda f: f
sys.modules['odoo.api'].returns = _noop_decorator

# Exceptions mock
class _ValidationError(Exception): pass
class _UserError(Exception): pass
class _AccessDenied(Exception): pass
class _AccessError(Exception): pass
sys.modules['odoo.exceptions'].ValidationError = _ValidationError
sys.modules['odoo.exceptions'].UserError = _UserError
sys.modules['odoo.exceptions'].AccessDenied = _AccessDenied
sys.modules['odoo.exceptions'].AccessError = _AccessError

# Http mock
sys.modules['odoo.http'].Controller = type('Controller', (), {})
sys.modules['odoo.http'].route = lambda *a, **kw: lambda f: f

# Create a stub request that won't crash when permission_checker accesses request.env.user
from unittest.mock import MagicMock as _MagicMock

class _StubPermRecord:
    """Mimics an Odoo p.m. record — supports [:1] → returns self (not a list)."""
    permission_type = 'system_admin'
    is_market_maker = False

class _StubRecordset:
    """Odoo recordset mock: r[:1] returns the first record, not a list."""
    def __init__(self, rec):
        self._rec = rec
    def __getitem__(self, key):
        if isinstance(key, slice):
            return self._rec  # [:1] → record (Odoo behaviour)
        return self._rec
    def __bool__(self):
        return True

_stub_request = _MagicMock()
_stub_request.env.user.id = 1
_stub_request.env.user.login = 'admin_stub'
_stub_request.env.user.permission_management_ids = _StubRecordset(_StubPermRecord())
_stub_request.env.user.groups_id.ids = []
_stub_request.env.ref = _MagicMock(return_value=_MagicMock(id=1))
sys.modules['odoo.http'].request = _stub_request

sys.modules['odoo.http'].Response = type('Response', (), {'__init__': lambda self, *a, **kw: None})
sys.modules['odoo.http'].content_disposition = lambda *a, **kw: ''

# Tools mock
sys.modules['odoo.tools'].config = type('Config', (), {
    'get': lambda self, key, default='': default,
    '__getitem__': lambda self, key: '',
    '__contains__': lambda self, key: False,
})()
sys.modules['odoo.tools'].float_round = lambda value, **kw: round(value, 2)
sys.modules['odoo.tools'].float_compare = lambda a, b, **kw: (a > b) - (a < b)
sys.modules['odoo.tools'].float_is_zero = lambda value, **kw: abs(value) < 0.01

# Tests mock
sys.modules['odoo.tests.common'].TransactionCase = type('TransactionCase', (), {})

# ===========================================================================
# Odoo addons dynamic package - handles 'from odoo.addons.X import Y'
# ===========================================================================
class _AddonsImporter:
    """Makes odoo.addons.* resolve to actual addon packages in ADDONS_DIR."""
    def find_module(self, fullname, path=None):
        if fullname.startswith('odoo.addons.'):
            return self
        return None

    def load_module(self, fullname):
        if fullname in sys.modules:
            return sys.modules[fullname]
        # odoo.addons.X.Y.Z → X/Y/Z under ADDONS_DIR
        parts = fullname.split('.')
        rel_parts = parts[2:]  # strip 'odoo', 'addons'
        candidate_dir = os.path.join(ADDONS_DIR, *rel_parts)
        candidate_file = os.path.join(ADDONS_DIR, *rel_parts) + '.py'

        if os.path.isdir(candidate_dir):
            init_py = os.path.join(candidate_dir, '__init__.py')
            mod = types.ModuleType(fullname)
            mod.__path__ = [candidate_dir]
            mod.__file__ = init_py
            mod.__package__ = fullname
            sys.modules[fullname] = mod
            if os.path.isfile(init_py):
                code = open(init_py, 'r', encoding='utf-8').read()
                exec(compile(code, init_py, 'exec'), mod.__dict__)
            return mod
        elif os.path.isfile(candidate_file):
            spec = importlib.util.spec_from_file_location(fullname, candidate_file)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[fullname] = mod
            spec.loader.exec_module(mod)
            return mod
        else:
            # Create a mock module as last resort
            mod = types.ModuleType(fullname)
            mod.__path__ = []
            mod.__package__ = fullname
            sys.modules[fullname] = mod
            return mod

_odoo_addons = sys.modules['odoo.addons']
_odoo_addons.__path__ = [ADDONS_DIR]
sys.meta_path.insert(0, _AddonsImporter())

# psycopg2 mock (if not installed locally)
if 'psycopg2' not in sys.modules:
    _psycopg2 = types.ModuleType('psycopg2')
    _psycopg2.IntegrityError = type('IntegrityError', (Exception,), {})
    sys.modules['psycopg2'] = _psycopg2

# ===========================================================================
# 3. Helper to load utility modules bypassing __init__.py
# ===========================================================================
def load_util_module(module_dotpath: str):
    """
    Load a Python module by dotpath from ADDONS_DIR, bypassing __init__.py.
    Example: load_util_module('fund_management.utils.mround')
    """
    parts = module_dotpath.split('.')
    file_path = os.path.join(ADDONS_DIR, *parts) + '.py'
    if not os.path.isfile(file_path):
        raise ImportError(f"Cannot find {file_path}")
    
    spec = importlib.util.spec_from_file_location(module_dotpath, file_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_dotpath] = mod
    spec.loader.exec_module(mod)
    return mod
