# -*- coding: utf-8 -*-
"""
Manifest and Structure Audit Tests for all ARC-ODOO modules.

Validates:
- __manifest__.py exists and has required keys
- __init__.py exists in every module
- All files referenced in manifest data[] and assets{} exist on disk
- security/ir.model.access.csv exists if referenced
- No circular dependencies (basic check)
"""
import os
import ast
import pytest

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_local = os.path.join(_PROJECT_ROOT, 'addons')
_docker = '/mnt/extra-addons'
ADDONS_DIR = os.environ.get('ADDONS_DIR') or (_local if os.path.isdir(_local) else (_docker if os.path.isdir(_docker) else _local))

EXPECTED_MODULES = [
    'ai_trading_assistant',
    'arc_core',
    'asset_management',
    'custom_auth',
    'fund_management',
    'fund_management_control',
    'fund_management_dashboard',
    'investor_list',
    'investor_profile_management',
    'nav_management',
    'order_matching',
    'overview_fund_management',
    'payos_gateway',
    'report_list',
    'stock_data',
    'stock_trading',
    'transaction_management',
    'user_permission_management',
]

REQUIRED_MANIFEST_KEYS = ['name', 'version', 'depends']
RECOMMENDED_MANIFEST_KEYS = ['license', 'author', 'summary', 'installable']


def _load_manifest(module_name):
    """Load __manifest__.py as a Python dict."""
    manifest_path = os.path.join(ADDONS_DIR, module_name, '__manifest__.py')
    with open(manifest_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return ast.literal_eval(content.split('# -*- coding: utf-8 -*-')[-1].strip()
                            if '# -*- coding: utf-8 -*-' in content
                            else content.strip())


def _safe_load_manifest(module_name):
    """Load manifest with fallback for files that have encoding header."""
    manifest_path = os.path.join(ADDONS_DIR, module_name, '__manifest__.py')
    with open(manifest_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove encoding declaration and comments before the dict
    lines = content.split('\n')
    dict_lines = []
    in_dict = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('{'):
            in_dict = True
        if in_dict:
            dict_lines.append(line)

    return ast.literal_eval('\n'.join(dict_lines))


class TestModuleExistence:
    """Verify all expected modules exist."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_module_directory_exists(self, module):
        path = os.path.join(ADDONS_DIR, module)
        assert os.path.isdir(path), f"Module directory '{module}' not found"

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_init_py_exists(self, module):
        path = os.path.join(ADDONS_DIR, module, '__init__.py')
        assert os.path.isfile(path), f"__init__.py missing in '{module}'"

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_manifest_exists(self, module):
        path = os.path.join(ADDONS_DIR, module, '__manifest__.py')
        assert os.path.isfile(path), f"__manifest__.py missing in '{module}'"


class TestManifestRequiredKeys:
    """Every manifest must have required keys."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_required_keys(self, module):
        manifest = _safe_load_manifest(module)
        for key in REQUIRED_MANIFEST_KEYS:
            assert key in manifest, f"'{module}': missing required key '{key}'"

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_name_not_empty(self, module):
        manifest = _safe_load_manifest(module)
        assert manifest.get('name', '').strip(), f"'{module}': 'name' is empty"

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_version_format(self, module):
        manifest = _safe_load_manifest(module)
        version = manifest.get('version', '')
        assert version, f"'{module}': version is empty"

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_depends_is_list(self, module):
        manifest = _safe_load_manifest(module)
        depends = manifest.get('depends', [])
        assert isinstance(depends, list), f"'{module}': 'depends' is not a list"

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_depends_includes_base(self, module):
        """Most modules should depend on 'base'"""
        manifest = _safe_load_manifest(module)
        depends = manifest.get('depends', [])
        # arc_core is an aggregator and may have indirect base dep
        if depends:
            all_deps = set(depends)
            assert 'base' in all_deps, \
                f"'{module}': missing 'base' in depends (has: {depends})"


class TestManifestRecommendedKeys:
    """Check recommended manifest keys (warnings, not failures)."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_has_license(self, module):
        manifest = _safe_load_manifest(module)
        assert 'license' in manifest, f"'{module}': missing 'license' (recommended)"

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_installable_is_true(self, module):
        manifest = _safe_load_manifest(module)
        assert manifest.get('installable', True) is True, \
            f"'{module}': installable should be True"


class TestManifestDataFiles:
    """All files referenced in manifest data[] must exist on disk."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_data_files_exist(self, module):
        manifest = _safe_load_manifest(module)
        data_files = manifest.get('data', [])
        module_dir = os.path.join(ADDONS_DIR, module)
        missing = []
        for f in data_files:
            path = os.path.join(module_dir, f.replace('/', os.sep))
            if not os.path.isfile(path):
                missing.append(f)
        assert not missing, \
            f"'{module}': data files missing on disk: {missing}"


class TestManifestAssetFiles:
    """All files referenced in manifest assets{} must exist on disk."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_asset_files_exist(self, module):
        manifest = _safe_load_manifest(module)
        assets = manifest.get('assets', {})
        missing = []

        for bundle, files in assets.items():
            for f in files:
                # Handle glob patterns (e.g., 'stock_data/static/src/**/*.js')
                if '*' in f:
                    continue  # Skip glob patterns

                # Asset paths are relative to addons root: module/path
                path = os.path.join(ADDONS_DIR, f.replace('/', os.sep))
                if not os.path.isfile(path):
                    missing.append(f)

        assert not missing, \
            f"'{module}': asset files missing on disk: {missing}"


class TestSecurityFiles:
    """If security/ir.model.access.csv is referenced, it must exist."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_security_csv_exists_if_referenced(self, module):
        manifest = _safe_load_manifest(module)
        data_files = manifest.get('data', [])
        for f in data_files:
            if 'ir.model.access.csv' in f:
                path = os.path.join(ADDONS_DIR, module, f.replace('/', os.sep))
                assert os.path.isfile(path), \
                    f"'{module}': referenced security file '{f}' not found"


class TestNoDuplicateDependencies:
    """Manifest depends[] should not have duplicates."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_no_duplicate_depends(self, module):
        manifest = _safe_load_manifest(module)
        depends = manifest.get('depends', [])
        if len(depends) != len(set(depends)):
            dupes = [d for d in depends if depends.count(d) > 1]
            pytest.fail(f"'{module}': duplicate dependencies: {set(dupes)}")


class TestNoSelfDependency:
    """A module should not depend on itself."""

    @pytest.mark.parametrize("module", EXPECTED_MODULES)
    def test_no_self_dependency(self, module):
        manifest = _safe_load_manifest(module)
        depends = manifest.get('depends', [])
        assert module not in depends, \
            f"'{module}': module depends on itself!"


class TestDependencyGraph:
    """Basic circular dependency detection."""

    def test_no_immediate_circular_deps(self):
        """Check for A→B→A circular dependencies"""
        dep_map = {}
        for module in EXPECTED_MODULES:
            try:
                manifest = _safe_load_manifest(module)
                dep_map[module] = set(
                    d for d in manifest.get('depends', [])
                    if d in EXPECTED_MODULES
                )
            except Exception:
                continue

        circular = []
        for mod_a, deps_a in dep_map.items():
            for mod_b in deps_a:
                if mod_b in dep_map and mod_a in dep_map.get(mod_b, set()):
                    pair = tuple(sorted([mod_a, mod_b]))
                    if pair not in circular:
                        circular.append(pair)

        assert not circular, f"Circular dependencies found: {circular}"
