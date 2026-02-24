# 🧪 ARC-ODOO Test Suite

> **530 tests** | Python 3.11+ (local) & 3.12 (Docker) | pytest + coverage

---

## Cấu trúc

```
tests/
├── conftest.py                      # Mock layer (auto-detect local/Docker)
├── run_tests.py                     # Helper script
├── test_fm_*.py                     # Fund Management utils
├── test_nav_date_utils.py           # NAV date utilities
├── test_om_*.py                     # Order Matching utils
├── test_manifest_audit.py           # 18 module manifest audit
├── test_integration_controllers.py  # API controller tests
└── odoo_tests/                      # Tier 2 — cần Odoo server
    ├── test_fund_model.py
    ├── test_transaction_model.py
    ├── test_matching_engine.py
    ├── test_nav_model.py
    └── test_payos_service.py
```

### Phân loại test

| Tier       | Loại                                                  | Cần Odoo? | Số tests |
| ---------- | ----------------------------------------------------- | --------- | -------- |
| **Tier 1** | Utility functions, constants, validators, controllers | ❌        | ~530     |
| **Tier 2** | ORM models, services (TransactionCase)                | ✅        | ~30      |

---

## 🖥️ Chạy trên Local (Windows/macOS/Linux)

### Yêu cầu

```bash
pip install pytest pytest-cov pytz
```

### Chạy nhanh

```bash
python -m pytest tests/ --ignore=tests/odoo_tests -v
```

### Chạy với coverage report

```bash
python -m pytest tests/ --ignore=tests/odoo_tests \
  --cov=addons --cov-report=term-missing
```

### Chạy 1 file cụ thể

```bash
python -m pytest tests/test_fm_mround.py -v
```

### Chạy theo keyword

```bash
python -m pytest tests/ -k "fee" -v
```

---

## 🐳 Chạy trên Docker

### Yêu cầu

- Docker containers đang chạy (`docker compose up -d`)
- `docker-compose.yml` đã mount `./tests:/mnt/tests`

### Cài pytest (chỉ cần 1 lần)

```bash
docker exec arc-odoo-odoo18-1 pip3 install pytest pytest-cov
```

### Chạy nhanh

```bash
docker exec -w /mnt arc-odoo-odoo18-1 \
  python3 -m pytest tests/ --ignore=tests/odoo_tests -v --tb=short
```

### Chạy với coverage

```bash
docker exec -w /mnt arc-odoo-odoo18-1 \
  python3 -m pytest tests/ --ignore=tests/odoo_tests \
  --cov=/mnt/extra-addons --cov-report=term-missing
```

### Chạy Tier 2 (ORM tests — cần DB)

```bash
docker exec -w /mnt arc-odoo-odoo18-1 \
  python3 -m pytest tests/odoo_tests/ -v --tb=short
```

---

## ⚙️ CI/CD (GitHub Actions)

File: `.github/workflows/test.yml`

Tự động chạy khi push/PR vào `main` hoặc `develop`:

- **Tier 1 tests** trên Python 3.11 + 3.12
- **Coverage report** upload lên Codecov
- **Manifest audit** kiểm tra 18 modules

---

## 🔧 Pre-commit Hooks

### Setup (1 lần)

```bash
pip install pre-commit
pre-commit install
```

### Hooks bao gồm

| Hook       | Khi nào    | Làm gì            |
| ---------- | ---------- | ----------------- |
| **black**  | pre-commit | Format code       |
| **isort**  | pre-commit | Sắp xếp imports   |
| **flake8** | pre-commit | Lint lỗi          |
| **pytest** | pre-push   | Chạy Tier 1 tests |

---

## 🏗️ Cách conftest.py hoạt động

`conftest.py` tạo mock layer cho toàn bộ `odoo.*` package, cho phép import module Odoo mà không cần server:

```
Local:  tests/conftest.py → ADDONS_DIR = ./addons
Docker: tests/conftest.py → ADDONS_DIR = /mnt/extra-addons (auto-detect)
```

Có thể override bằng env var:

```bash
ADDONS_DIR=/custom/path python -m pytest tests/ -v
```

---

## 📝 Viết test mới

### Tier 1 — Utility test (không cần Odoo)

```python
# tests/test_my_utils.py
from my_module.utils.helper import my_function

class TestMyFunction:
    def test_basic(self):
        assert my_function(1, 2) == 3

    def test_edge_case(self):
        assert my_function(0, 0) == 0
```

### Tier 2 — ORM test (cần Odoo Docker)

```python
# tests/odoo_tests/test_my_model.py
from odoo.tests.common import TransactionCase

class TestMyModel(TransactionCase):
    def test_create(self):
        record = self.env['my.model'].create({'name': 'Test'})
        self.assertEqual(record.name, 'Test')
```
