import logging
import re
from datetime import datetime

import requests
from requests import RequestException, HTTPError

from odoo import models, fields, _
from odoo.exceptions import UserError


_logger = logging.getLogger(__name__)


class Holiday(models.Model):
    _name = "data.holiday"
    _description = "Holiday"



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

    _sql_constraints = [
        ("bank_code_unique", "UNIQUE(bank_id, code)", "Chi nhánh đã tồn tại cho ngân hàng này."),
    ]
    address = fields.Char(string="Địa chỉ")

    def _fetch_provinces(self):
        """Lấy danh sách tỉnh/thành phố Việt Nam từ API."""
        url = "https://provinces.open-api.vn/api/?depth=1"
        _logger.info("Lấy danh sách tỉnh/thành phố từ: %s", url)

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except RequestException as exc:
            _logger.warning("Không thể gọi API tỉnh/thành: %s", exc)
            raise UserError(_("Không thể kết nối tới API tỉnh/thành phố: %s") % exc)

        try:
            payload = response.json()
        except ValueError as exc:
            _logger.error("Payload tỉnh/thành không hợp lệ: %s", exc, exc_info=True)
            raise UserError(_("Dữ liệu tỉnh/thành phố trả về không hợp lệ."))

        if not isinstance(payload, list) or not payload:
            raise UserError(_("Không tìm thấy dữ liệu tỉnh/thành phố."))

        regions = []
        for province in payload:
            province_name = (province.get("name") or "").strip()
            codename = (province.get("codename") or "").strip()
            if not province_name or not codename:
                continue

            # Tạo tên chi nhánh: bỏ prefix "Tỉnh " / "Thành phố "
            short_name = province_name
            for prefix in ("Tỉnh ", "Thành phố "):
                if short_name.startswith(prefix):
                    short_name = short_name[len(prefix):]
                    break

            branch_name = f"Chi nhánh {short_name}"
            region_code = codename.upper()
            address = province_name

            regions.append((branch_name, region_code, address))

        return regions

    def sync_basic_branches(self):
        """Đồng bộ chi nhánh ngân hàng toàn quốc từ API tỉnh/thành phố."""
        Bank = self.env["data.bank"].sudo()
        banks = Bank.search([])

        if not banks:
            raise UserError(_("Chưa có dữ liệu ngân hàng. Vui lòng đồng bộ VietQR trước."))

        regions = self._fetch_provinces()

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
            "Đồng bộ chi nhánh toàn quốc hoàn tất: created=%s updated=%s (%d tỉnh/thành × %d ngân hàng)",
            created, updated, len(regions), len(banks),
        )
        return {"success": True, "created": created, "updated": updated}





