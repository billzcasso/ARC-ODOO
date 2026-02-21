import logging
import re
from datetime import datetime, date

import requests
from requests import RequestException, HTTPError

from odoo import models, fields, _
from odoo.exceptions import UserError


_logger = logging.getLogger(__name__)


class Holiday(models.Model):
    _name = "data.holiday"
    _description = "Holiday"

    _FIXED_HOLIDAYS = (
        {"code": "NEW_YEAR", "name": "Tết Dương lịch", "month": 1, "day": 1},
        {"code": "LIBERATION_DAY", "name": "Ngày Giải phóng miền Nam", "month": 4, "day": 30},
        {"code": "LABOUR_DAY", "name": "Ngày Quốc tế Lao động", "month": 5, "day": 1},
        {"code": "NATIONAL_DAY", "name": "Quốc khánh", "month": 9, "day": 2},
    )

    _LUNAR_CONVERSIONS = {
        2024: (
            ("Tết Nguyên đán (Mùng 1)", date(2024, 2, 10)),
            ("Tết Nguyên đán (Mùng 2)", date(2024, 2, 11)),
            ("Tết Nguyên đán (Mùng 3)", date(2024, 2, 12)),
            ("Tết Nguyên đán (Mùng 4)", date(2024, 2, 13)),
            ("Tết Nguyên đán (Mùng 5)", date(2024, 2, 14)),
            ("Giỗ Tổ Hùng Vương", date(2024, 4, 18)),
        ),
        2025: (
            ("Tết Nguyên đán (Mùng 1)", date(2025, 1, 29)),
            ("Tết Nguyên đán (Mùng 2)", date(2025, 1, 30)),
            ("Tết Nguyên đán (Mùng 3)", date(2025, 1, 31)),
            ("Tết Nguyên đán (Mùng 4)", date(2025, 2, 1)),
            ("Tết Nguyên đán (Mùng 5)", date(2025, 2, 2)),
            ("Giỗ Tổ Hùng Vương", date(2025, 4, 8)),
        ),
        2026: (
            ("Tết Nguyên đán (Mùng 1)", date(2026, 2, 17)),
            ("Tết Nguyên đán (Mùng 2)", date(2026, 2, 18)),
            ("Tết Nguyên đán (Mùng 3)", date(2026, 2, 19)),
            ("Tết Nguyên đán (Mùng 4)", date(2026, 2, 20)),
            ("Tết Nguyên đán (Mùng 5)", date(2026, 2, 21)),
            ("Giỗ Tổ Hùng Vương", date(2026, 4, 27)),
        ),
        2027: (
            ("Tết Nguyên đán (Mùng 1)", date(2027, 2, 6)),
            ("Tết Nguyên đán (Mùng 2)", date(2027, 2, 7)),
            ("Tết Nguyên đán (Mùng 3)", date(2027, 2, 8)),
            ("Tết Nguyên đán (Mùng 4)", date(2027, 2, 9)),
            ("Tết Nguyên đán (Mùng 5)", date(2027, 2, 10)),
            ("Giỗ Tổ Hùng Vương", date(2027, 4, 16)),
        ),
        2028: (
            ("Tết Nguyên đán (Mùng 1)", date(2028, 1, 26)),
            ("Tết Nguyên đán (Mùng 2)", date(2028, 1, 27)),
            ("Tết Nguyên đán (Mùng 3)", date(2028, 1, 28)),
            ("Tết Nguyên đán (Mùng 4)", date(2028, 1, 29)),
            ("Tết Nguyên đán (Mùng 5)", date(2028, 1, 30)),
            ("Giỗ Tổ Hùng Vương", date(2028, 4, 4)),
        ),
        2029: (
            ("Tết Nguyên đán (Mùng 1)", date(2029, 2, 13)),
            ("Tết Nguyên đán (Mùng 2)", date(2029, 2, 14)),
            ("Tết Nguyên đán (Mùng 3)", date(2029, 2, 15)),
            ("Tết Nguyên đán (Mùng 4)", date(2029, 2, 16)),
            ("Tết Nguyên đán (Mùng 5)", date(2029, 2, 17)),
            ("Giỗ Tổ Hùng Vương", date(2029, 4, 24)),
        ),
        2030: (
            ("Tết Nguyên đán (Mùng 1)", date(2030, 2, 3)),
            ("Tết Nguyên đán (Mùng 2)", date(2030, 2, 4)),
            ("Tết Nguyên đán (Mùng 3)", date(2030, 2, 5)),
            ("Tết Nguyên đán (Mùng 4)", date(2030, 2, 6)),
            ("Tết Nguyên đán (Mùng 5)", date(2030, 2, 7)),
            ("Giỗ Tổ Hùng Vương", date(2030, 4, 13)),
        ),
    }

    name = fields.Char(string="Tên ngày lễ", required=True)
    code = fields.Char(string="Mã ngày lễ", required=True)
    date = fields.Date(string="Ngày trong năm", required=True)
    value = fields.Char(string="Giá trị trong năm", required=True)
    active = fields.Boolean(string="Kích hoạt", default=True)

    @classmethod
    def _sanitize_country_code(cls, country_code):
        if not country_code:
            return "VN"
        code = country_code.strip().upper()
        if len(code) != 2 or not code.isalpha():
            raise UserError(_("Mã quốc gia không hợp lệ."))
        return code

    @staticmethod
    def _sanitize_year(year):
        if not year:
            return datetime.today().year
        try:
            year_int = int(year)
        except (TypeError, ValueError):
            raise UserError(_("Năm không hợp lệ."))
        if year_int < 1900 or year_int > 2100:
            raise UserError(_("Năm phải nằm trong khoảng từ 1900 đến 2100."))
        return year_int

    @classmethod
    def _build_code(cls, base_name, year):
        raw = f"{base_name}_{year}" if base_name else str(year)
        return re.sub(r"[^A-Z0-9]", "_", raw.upper()).strip("_")

    @staticmethod
    def _day_of_year(date_value):
        return datetime.strptime(date_value.strftime("%Y-%m-%d"), "%Y-%m-%d").timetuple().tm_yday

    def _prepare_holiday_vals(self, entry, year):
        date_str = entry.get("date")
        name = entry.get("localName") or entry.get("name")
        if not date_str or not name:
            return None

        try:
            date_value = fields.Date.from_string(date_str)
        except Exception:  # noqa: BLE001 - guard clause, fallback skip
            _logger.warning("Bỏ qua ngày lễ với định dạng ngày không hợp lệ: %s", date_str)
            return None

        code_base = entry.get("name") or name
        code = self._build_code(code_base, year)
        day_of_year = self._day_of_year(date_value)
        value_text = str(day_of_year)

        return {
            "code": code,
            "name": name,
            "date": date_value,
            "value": value_text,
            "active": True,
        }

    def sync_public_holidays(self, year=None, country_code="VN"):
        year_int = self._sanitize_year(year)
        country = self._sanitize_country_code(country_code)

        url = f"https://date.nager.at/api/v3/PublicHolidays/{year_int}/{country}"
        _logger.info("Đồng bộ ngày lễ: url=%s", url)

        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 404:
                raise UserError(
                    _("Chưa có dữ liệu ngày lễ cho năm %(year)s.", year=year_int)
                )
            response.raise_for_status()
        except HTTPError as exc:
            _logger.warning("HTTP error khi gọi API ngày lễ: %s", exc)
            raise UserError(
                _("Không thể lấy dữ liệu ngày lễ (HTTP %(status)s).", status=exc.response.status_code)
            )
        except RequestException as exc:
            _logger.warning("Không thể gọi API ngày lễ: %s", exc)
            raise UserError(_("Không thể kết nối tới dịch vụ ngày lễ: %s") % exc)

        try:
            payload = response.json()
        except ValueError as exc:  # noqa: BLE001
            _logger.error("Phản hồi API không hợp lệ: %s", exc, exc_info=True)
            raise UserError(_("Dữ liệu trả về từ dịch vụ ngày lễ không hợp lệ."))

        if not isinstance(payload, list):
            raise UserError(_("Cấu trúc dữ liệu ngày lễ không hợp lệ."))

        created = updated = 0
        for entry in payload:
            vals = self._prepare_holiday_vals(entry, year_int)
            if not vals:
                continue

            existing = self.search([("code", "=", vals["code"]), ("date", "=", vals["date"])], limit=1)
            if existing:
                update_vals = {k: v for k, v in vals.items() if existing[k] != v}
                if update_vals:
                    existing.write(update_vals)
                    updated += 1
                continue

            self.create(vals)
            created += 1

        _logger.info(
            "Đồng bộ ngày lễ hoàn tất: year=%s country=%s created=%s updated=%s",
            year_int,
            country,
            created,
            updated,
        )

        return {
            "success": True,
            "created": created,
            "updated": updated,
            "year": year_int,
            "country_code": country,
        }

    def sync_local_holidays(self, year=None):
        year_int = self._sanitize_year(year)

        created = updated = 0
        processed_codes = set()

        for item in self._FIXED_HOLIDAYS:
            try:
                date_value = date(year_int, item["month"], item["day"])
            except ValueError as exc:  # noqa: BLE001
                _logger.warning("Bỏ qua ngày lễ cố định không hợp lệ: %s", exc)
                continue

            code = self._build_code(f"{item['code']}_{year_int}", year_int)
            vals = {
                "code": code,
                "name": item["name"],
                "date": date_value,
                "value": str(self._day_of_year(date_value)),
                "active": True,
            }
            processed_codes.add(code)
            created, updated = self._upsert_holiday(vals, created, updated)

        lunar_entries = self._LUNAR_CONVERSIONS.get(year_int)
        if not lunar_entries:
            raise UserError(
                _(
                    "Chưa khai báo bảng quy đổi Tết/Giỗ Tổ cho năm %(year)s. Vui lòng cập nhật thêm dữ liệu nội bộ.",
                    year=year_int,
                )
            )

        for name, date_value in lunar_entries:
            if not isinstance(date_value, date):
                _logger.warning("Bỏ qua ngày lễ âm lịch vì định dạng sai: %s", name)
                continue

            code = self._build_code(f"{name}_{year_int}", year_int)
            vals = {
                "code": code,
                "name": name,
                "date": date_value,
                "value": str(self._day_of_year(date_value)),
                "active": True,
            }
            if code in processed_codes:
                continue
            processed_codes.add(code)
            created, updated = self._upsert_holiday(vals, created, updated)

        _logger.info(
            "Đồng bộ ngày lễ nội bộ hoàn tất: year=%s created=%s updated=%s",
            year_int,
            created,
            updated,
        )

        return {
            "success": True,
            "created": created,
            "updated": updated,
            "year": year_int,
        }

    def _upsert_holiday(self, vals, created, updated):
        domain = [("code", "=", vals["code"]), ("date", "=", vals["date"])]
        existing = self.search(domain, limit=1)
        if existing:
            update_vals = {
                key: value for key, value in vals.items() if existing[key] != value
            }
            if update_vals:
                existing.write(update_vals)
                updated += 1
        else:
            self.create(vals)
            created += 1
        return created, updated


class Bank(models.Model):
    _name = "data.bank"
    _description = "Bank"

    name = fields.Char(string="Tên ngân hàng", required=True)
    english_name = fields.Char(string="Tiếng Tiếng Anh", required=True)
    short_name = fields.Char(string="Tên viết tắt", required=True)
    code = fields.Char(string="Mã giao dịch", required=True)
    swift_code = fields.Char(string="Swift Code", required=True)
    website = fields.Char(string="Website", required=True)
    active = fields.Boolean(string="Kích hoạt", default=True)

    def _sanitize_bank_payload(self, payload):
        if not isinstance(payload, dict):
            return None

        name = (payload.get("name") or "").strip()
        short_name = (payload.get("code") or "").strip()
        bin_code = (payload.get("bin") or "").strip()
        english_name = (payload.get("shortName") or "").strip()

        if not name or not short_name or not bin_code:
            return None

        swift_code = (
            (payload.get("swift_code") or "").strip()
            or (payload.get("swiftCode") or "").strip()
            or short_name
        )

        return {
            "name": name,
            "english_name": english_name or short_name,
            "short_name": short_name,
            "code": bin_code,
            "swift_code": swift_code,
            "website": (payload.get("logo") or payload.get("website") or "").strip(),
            "active": bool(payload.get("transferSupported", 0)),
        }

    def sync_vietqr_banks(self):
        url = "https://api.vietqr.io/v2/banks"
        _logger.info("Đồng bộ ngân hàng từ VietQR: %s", url)

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except RequestException as exc:
            _logger.warning("Không thể gọi API VietQR: %s", exc)
            raise UserError(_("Không thể kết nối tới VietQR: %s") % exc)

        try:
            payload = response.json()
        except ValueError as exc:  # noqa: BLE001
            _logger.error("Payload VietQR không hợp lệ: %s", exc, exc_info=True)
            raise UserError(_("Dữ liệu VietQR trả về không hợp lệ."))

        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, list):
            raise UserError(_("Cấu trúc dữ liệu VietQR không hợp lệ."))

        created = updated = skipped = 0
        for record in data:
            vals = self._sanitize_bank_payload(record)
            if not vals:
                skipped += 1
                continue

            existing = self.search([("code", "=", vals["code"])], limit=1)
            if existing:
                diff = {k: v for k, v in vals.items() if existing[k] != v}
                if diff:
                    existing.write(diff)
                    updated += 1
                continue

            self.create(vals)
            created += 1

        _logger.info(
            "Đồng bộ VietQR hoàn tất: created=%s updated=%s skipped=%s",
            created,
            updated,
            skipped,
        )

        return {
            "success": True,
            "created": created,
            "updated": updated,
            "skipped": skipped,
        }


class BankBranch(models.Model):
    _name = "data.bank.branch"
    _description = "Bank Branch"

    name = fields.Char(string="Tên chi nhánh ngân hàng", required=True)
    bank_id = fields.Many2one("data.bank", string="Trực thuộc ngân hàng", required=True)
    code = fields.Char(string="Mã hành chính")
    active = fields.Boolean(string="Kích hoạt", default=True)
    address = fields.Char(string="Địa chỉ")

    def sync_basic_branches(self):
        """Đồng bộ chi nhánh ngân hàng toàn quốc (63 tỉnh/thành phố)."""
        Bank = self.env["data.bank"].sudo()
        banks = Bank.search([])

        if not banks:
            raise UserError(_("Chưa có dữ liệu ngân hàng. Vui lòng đồng bộ VietQR trước."))

        # Danh sách 63 tỉnh/thành phố Việt Nam
        regions = [
            # 5 thành phố trực thuộc trung ương
            ("Chi nhánh Hà Nội", "HN", "Hà Nội"),
            ("Chi nhánh TP. Hồ Chí Minh", "HCM", "TP. Hồ Chí Minh"),
            ("Chi nhánh Đà Nẵng", "DN", "Đà Nẵng"),
            ("Chi nhánh Hải Phòng", "HP", "Hải Phòng"),
            ("Chi nhánh Cần Thơ", "CT", "Cần Thơ"),
            # Đồng bằng sông Hồng
            ("Chi nhánh Bắc Ninh", "BN", "Bắc Ninh"),
            ("Chi nhánh Hà Nam", "HNA", "Hà Nam"),
            ("Chi nhánh Hải Dương", "HD", "Hải Dương"),
            ("Chi nhánh Hưng Yên", "HY", "Hưng Yên"),
            ("Chi nhánh Nam Định", "ND", "Nam Định"),
            ("Chi nhánh Ninh Bình", "NB", "Ninh Bình"),
            ("Chi nhánh Thái Bình", "TB", "Thái Bình"),
            ("Chi nhánh Vĩnh Phúc", "VP", "Vĩnh Phúc"),
            # Đông Bắc
            ("Chi nhánh Bắc Giang", "BG", "Bắc Giang"),
            ("Chi nhánh Bắc Kạn", "BK", "Bắc Kạn"),
            ("Chi nhánh Cao Bằng", "CB", "Cao Bằng"),
            ("Chi nhánh Hà Giang", "HG", "Hà Giang"),
            ("Chi nhánh Lạng Sơn", "LS", "Lạng Sơn"),
            ("Chi nhánh Phú Thọ", "PT", "Phú Thọ"),
            ("Chi nhánh Quảng Ninh", "QN", "Quảng Ninh"),
            ("Chi nhánh Thái Nguyên", "TN", "Thái Nguyên"),
            ("Chi nhánh Tuyên Quang", "TQ", "Tuyên Quang"),
            ("Chi nhánh Yên Bái", "YB", "Yên Bái"),
            # Tây Bắc
            ("Chi nhánh Điện Biên", "DB", "Điện Biên"),
            ("Chi nhánh Hòa Bình", "HB", "Hòa Bình"),
            ("Chi nhánh Lai Châu", "LC", "Lai Châu"),
            ("Chi nhánh Lào Cai", "LCA", "Lào Cai"),
            ("Chi nhánh Sơn La", "SL", "Sơn La"),
            # Bắc Trung Bộ
            ("Chi nhánh Hà Tĩnh", "HT", "Hà Tĩnh"),
            ("Chi nhánh Nghệ An", "NA", "Nghệ An"),
            ("Chi nhánh Quảng Bình", "QB", "Quảng Bình"),
            ("Chi nhánh Quảng Trị", "QT", "Quảng Trị"),
            ("Chi nhánh Thanh Hóa", "TH", "Thanh Hóa"),
            ("Chi nhánh Thừa Thiên Huế", "TTH", "Thừa Thiên Huế"),
            # Duyên hải Nam Trung Bộ
            ("Chi nhánh Bình Định", "BD", "Bình Định"),
            ("Chi nhánh Bình Thuận", "BTH", "Bình Thuận"),
            ("Chi nhánh Khánh Hòa", "KH", "Khánh Hòa"),
            ("Chi nhánh Ninh Thuận", "NT", "Ninh Thuận"),
            ("Chi nhánh Phú Yên", "PY", "Phú Yên"),
            ("Chi nhánh Quảng Nam", "QNA", "Quảng Nam"),
            ("Chi nhánh Quảng Ngãi", "QNG", "Quảng Ngãi"),
            # Tây Nguyên
            ("Chi nhánh Đắk Lắk", "DL", "Đắk Lắk"),
            ("Chi nhánh Đắk Nông", "DNO", "Đắk Nông"),
            ("Chi nhánh Gia Lai", "GL", "Gia Lai"),
            ("Chi nhánh Kon Tum", "KT", "Kon Tum"),
            ("Chi nhánh Lâm Đồng", "LD", "Lâm Đồng"),
            # Đông Nam Bộ
            ("Chi nhánh Bà Rịa - Vũng Tàu", "VT", "Bà Rịa - Vũng Tàu"),
            ("Chi nhánh Bình Dương", "BDU", "Bình Dương"),
            ("Chi nhánh Bình Phước", "BP", "Bình Phước"),
            ("Chi nhánh Đồng Nai", "DNA", "Đồng Nai"),
            ("Chi nhánh Tây Ninh", "TNI", "Tây Ninh"),
            # Đồng bằng sông Cửu Long
            ("Chi nhánh An Giang", "AG", "An Giang"),
            ("Chi nhánh Bạc Liêu", "BL", "Bạc Liêu"),
            ("Chi nhánh Bến Tre", "BT", "Bến Tre"),
            ("Chi nhánh Cà Mau", "CM", "Cà Mau"),
            ("Chi nhánh Đồng Tháp", "DT", "Đồng Tháp"),
            ("Chi nhánh Hậu Giang", "HGI", "Hậu Giang"),
            ("Chi nhánh Kiên Giang", "KG", "Kiên Giang"),
            ("Chi nhánh Long An", "LA", "Long An"),
            ("Chi nhánh Sóc Trăng", "ST", "Sóc Trăng"),
            ("Chi nhánh Tiền Giang", "TG", "Tiền Giang"),
            ("Chi nhánh Trà Vinh", "TV", "Trà Vinh"),
            ("Chi nhánh Vĩnh Long", "VL", "Vĩnh Long"),
        ]

        created = updated = 0
        for bank in banks:
            for region_name, region_code, address in regions:
                name = f"{bank.short_name or bank.name} - {region_name}"
                code = f"{(bank.short_name or bank.name).upper()}_{region_code}"

                existing = self.search([("bank_id", "=", bank.id), ("code", "=", code)], limit=1)
                vals = {
                    "name": name,
                    "bank_id": bank.id,
                    "code": code,
                    "address": address,
                    "active": True,
                }
                if existing:
                    diff = {k: v for k, v in vals.items() if existing[k] != v}
                    if diff:
                        existing.write(diff)
                        updated += 1
                else:
                    self.create(vals)
                    created += 1

        _logger.info(
            "Đồng bộ chi nhánh toàn quốc hoàn tất: created=%s updated=%s (63 tỉnh/thành × %d ngân hàng)",
            created, updated, len(banks),
        )
        return {"success": True, "created": created, "updated": updated}





