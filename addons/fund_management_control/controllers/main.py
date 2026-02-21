from odoo import http
from odoo.http import request, Response
import json
import logging
import base64

_logger = logging.getLogger(__name__)


class FundManagementProduct(http.Controller):
    # Route của chứng chỉ quỹ
    @http.route("/fund_certificate_list", type="http", auth="user", website=True)
    def fund_certificate_list_page(self, **kwargs):
        """Hiển thị trang danh sách Chứng chỉ quỹ."""
        return request.render(
            "fund_management_control.fund_certificate_list",
            {"active_page": "fund_certificate"},
        )

    @http.route(
        "/get_fund_certificate_data",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
        cors="*",
    )
    def get_fund_certificate_data(self, page=1, limit=10, search="", **kwargs):
        """
        API endpoint để lấy danh sách Chứng chỉ quỹ có phân trang và tìm kiếm.
        """
        _logger.info(f">>> API được gọi: page={page}, limit={limit}, search='{search}'")

        try:
            # Xây dựng domain động cho tìm kiếm
            domain = []
            if search:
                # Tìm kiếm trong các trường symbol, short_name_vn, short_name_en
                domain = [
                    "|",
                    "|",
                    ("symbol", "ilike", search),
                    ("short_name_vn", "ilike", search),
                    ("short_name_en", "ilike", search),
                ]

            total_records = request.env["fund.certificate"].search_count(domain)
            offset = (int(page) - 1) * int(limit)
            fund_certificates = request.env["fund.certificate"].search(
                domain, limit=int(limit), offset=offset
            )

            data = []
            for cert in fund_certificates:
                data.append(
                    {
                        "id": cert.id,
                        "symbol": cert.symbol or "",
                        "short_name_vn": cert.short_name_vn or "",
                        "short_name_en": cert.short_name_en or "",
                        "fund_color": cert.fund_color or "#FFFFFF",
                        "current_price": cert.current_price or 0.0,
                        "reference_price": cert.reference_price or 0.0,
                        "product_type": dict(
                            cert._fields["product_type"].selection
                        ).get(cert.product_type, ""),
                        "product_status": dict(
                            cert._fields["product_status"].selection
                        ).get(cert.product_status, ""),
                        "inception_time": (
                            cert.inception_date.strftime("%H:%M")
                            if cert.inception_date
                            else ""
                        ),
                        "report_website": cert.report_website or "#",
                        # FIX: Đường dẫn hình ảnh fallback đúng trong module này
                        "fund_image": (
                            f"/web/image?model=fund.certificate&field=fund_image&id={cert.id}"
                            if cert.fund_image
                            else "/fund_management_control/static/src/img/placeholder.png"
                        ),
                    }
                )

            response_data = {"records": data, "total_records": total_records}

            return Response(json.dumps(response_data), content_type="application/json")

        except Exception as e:
            _logger.error(
                f"!!! Lỗi trong /get_fund_certificate_data: {str(e)}", exc_info=True
            )
            return Response(
                json.dumps({"error": str(e)}),
                content_type="application/json",
                status=500,
            )

    @http.route("/fund_certificate/new", type="http", auth="user", website=True)
    def fund_certificate_form_page(self, **kwargs):
        """
        Hiển thị trang form để tạo mới Chứng chỉ quỹ.
        Cũng lấy các tùy chọn từ các trường Selection trong model.
        """
        # Lấy model 'fund.certificate'
        FundCertificate = request.env["fund.certificate"]

        # Lấy các tùy chọn từ các trường Selection trong model
        selection_options = {
            "fund_types": FundCertificate._fields["fund_type"].selection,
            "risk_levels": FundCertificate._fields["risk_level"].selection,
            "product_types": FundCertificate._fields["product_type"].selection,
            "product_statuses": FundCertificate._fields["product_status"].selection,
            "active_page": "fund_certificate",  # Truyền biến 'active_page'
        }

        # Truyền các tùy chọn này vào template
        return request.render(
            "fund_management_control.fund_certificate_form", selection_options
        )

    # Thêm route này để xử lý việc tạo mới
    @http.route(
        "/fund_certificate/create",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
        cors="*",
    )
    def create_fund_certificate(self, **post):
        """
        API endpoint để nhận dữ liệu form và tạo mới Chứng chỉ quỹ.
        """
        try:
            _logger.info("Nhận dữ liệu cho chứng chỉ quỹ mới: %s", post)

            # Xử lý các trường boolean (ngày trong tuần)
            weekdays = {
                "monday": post.get("monday") == "on",
                "tuesday": post.get("tuesday") == "on",
                "wednesday": post.get("wednesday") == "on",
                "thursday": post.get("thursday") == "on",
                "friday": post.get("friday") == "on",
                "saturday": post.get("saturday") == "on",
                "sunday": post.get("sunday") == "on",
            }

            # Xử lý hình ảnh (nếu có)
            fund_image_data = False
            if "fund_image" in request.httprequest.files:
                image_file = request.httprequest.files.get("fund_image")
                if image_file:
                    fund_image_data = image_file.read()

            # Chuẩn bị dữ liệu để tạo bản ghi
            vals = {
                "symbol": post.get("symbol"),
                "market": post.get("market") or "HOSE",
                "short_name_vn": post.get("short_name_vn"),
                "short_name_en": post.get("short_name_en"),
                "fund_color": post.get("fund_color"),
                "fund_type": post.get("fund_type") or "equity",
                "risk_level": post.get("risk_level") or "3",
                "fund_description": post.get("fund_description"),
                "fund_image": fund_image_data,
                # Trường tồn kho ban đầu
                "initial_certificate_quantity": int(post.get("initial_certificate_quantity") or 0),
                "initial_certificate_price": float(post.get("initial_certificate_price") or 0),
                "capital_cost": float(post.get("capital_cost") or 0),
                **weekdays,
            }

            # Tạo bản ghi mới
            new_cert = request.env["fund.certificate"].sudo().create(vals)
            _logger.info(
                "Tạo thành công chứng chỉ quỹ mới với ID: %s", new_cert.id
            )

            # Chuyển hướng về trang danh sách sau khi tạo thành công
            return request.redirect("/fund_certificate_list")

        except Exception as e:
            _logger.error(
                "!!! Lỗi khi tạo chứng chỉ quỹ: %s", str(e), exc_info=True
            )
            # Nếu có lỗi, có thể trả về một trang lỗi hoặc quay lại form với thông báo
            # Tạm thời chuyển hướng về trang danh sách
            return request.redirect("/fund_certificate_list")

    @http.route(
        "/fund_certificate/edit/<int:cert_id>", type="http", auth="user", website=True
    )
    def fund_certificate_edit_page(self, cert_id, **kwargs):
        """
        Hiển thị trang để chỉnh sửa Chứng chỉ quỹ đã tồn tại.
        """
        try:
            # Lấy bản ghi chứng chỉ quỹ cụ thể
            certificate = request.env["fund.certificate"].sudo().browse(cert_id)
            if not certificate.exists():
                _logger.warning(
                    f"Thử chỉnh sửa chứng chỉ quỹ không tồn tại với ID: {cert_id}"
                )
                return request.redirect("/fund_certificate_list")

            # Lấy các tùy chọn Selection từ model
            FundCertificate = request.env["fund.certificate"]
            render_values = {
                "cert": certificate,  # Truyền bản ghi vào template
                "fund_types": FundCertificate._fields["fund_type"].selection,
                "risk_levels": FundCertificate._fields["risk_level"].selection,
                "product_types": FundCertificate._fields["product_type"].selection,
                "product_statuses": FundCertificate._fields["product_status"].selection,
                "active_page": "fund_certificate",
            }

            return request.render(
                "fund_management_control.fund_certificate_edit_form", render_values
            )
        except Exception as e:
            _logger.error(
                f"!!! Lỗi khi hiển thị trang chỉnh sửa cho chứng chỉ quỹ ID {cert_id}: {str(e)}",
                exc_info=True,
            )
            return request.redirect("/fund_certificate_list")

    @http.route(
        "/fund_certificate/sync_stock_data",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
        cors="*",
    )
    def sync_stock_data(self, **kwargs):
        """
        API endpoint to sync Fund Certificates from Stock Data.
        Receives JSON: { "market_selection": "all"|"HOSE"..., "sync_option": "both"|"create"... }
        """
        try:
            data = json.loads(request.httprequest.data)
            market_selection = data.get("market_selection", "all")
            sync_option = data.get("sync_option", "both")

            _logger.info(f"Received sync request: market={market_selection}, option={sync_option}")

            # Call the shared sync batch method
            stats = request.env["fund.certificate"].sudo().sync_batch(market_selection, sync_option)

            return Response(
                json.dumps({"success": True, "stats": stats}),
                content_type="application/json"
            )

        except Exception as e:
            _logger.error(f"Error in /fund_certificate/sync_stock_data: {e}", exc_info=True)
            return Response(
                json.dumps({"success": False, "error": str(e)}),
                content_type="application/json",
                status=500,
            )

    # === NEW: Route để xử lý logic cập nhật ===
    @http.route(
        "/fund_certificate/update",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
        cors="*",
    )
    def update_fund_certificate(self, **post):
        """
        API endpoint để nhận dữ liệu form và cập nhật Chứng chỉ quỹ đã tồn tại.
        """
        cert_id = post.get("cert_id")
        if not cert_id:
            _logger.error("!!! Cập nhật thất bại: cert_id không được cung cấp trong dữ liệu POST.")
            return request.redirect("/fund_certificate_list")

        try:
            _logger.info(
                f"Nhận dữ liệu để cập nhật chứng chỉ quỹ ID {cert_id}: {post}"
            )
            certificate = request.env["fund.certificate"].sudo().browse(int(cert_id))
            if not certificate.exists():
                _logger.error(
                    f"!!! Cập nhật thất bại: Không tìm thấy Chứng chỉ quỹ với ID {cert_id}."
                )
                return request.redirect("/fund_certificate_list")

            weekdays = {
                "monday": post.get("monday") == "on",
                "tuesday": post.get("tuesday") == "on",
                "wednesday": post.get("wednesday") == "on",
                "thursday": post.get("thursday") == "on",
                "friday": post.get("friday") == "on",
                "saturday": post.get("saturday") == "on",
                "sunday": post.get("sunday") == "on",
            }

            vals = {
                "symbol": post.get("symbol"),
                "market": post.get("market") or "HOSE",
                "short_name_vn": post.get("short_name_vn"),
                "short_name_en": post.get("short_name_en"),
                "fund_color": post.get("fund_color"),
                "current_price": float(post.get("current_price", 0)),
                "reference_price": float(post.get("reference_price", 0)),
                "ceiling_price": float(post.get("ceiling_price", 0)),
                "floor_price": float(post.get("floor_price", 0)),
                "inception_date": (
                    post.get("inception_date") if post.get("inception_date") else None
                ),
                "closure_date": (
                    post.get("closure_date") if post.get("closure_date") else None
                ),
                "receive_money_time": (
                    post.get("receive_money_time")
                    if post.get("receive_money_time")
                    else None
                ),
                "payment_deadline": int(post.get("payment_deadline", 0)),
                "redemption_time": int(post.get("redemption_time", 0)),
                "report_website": post.get("report_website"),
                "fund_type": post.get("fund_type"),
                "risk_level": post.get("risk_level"),
                "product_type": post.get("product_type"),
                "product_status": post.get("product_status"),
                "fund_description": post.get("fund_description"),
                # Trường tồn kho ban đầu (quỹ đóng)
                "initial_certificate_quantity": int(post.get("initial_certificate_quantity", 0)),
                "initial_certificate_price": float(post.get("initial_certificate_price", 0)),
                "capital_cost": float(post.get("capital_cost", 1.09)),
                **weekdays,
            }

            # Chỉ cập nhật hình ảnh nếu có hình mới được upload
            if "fund_image" in request.httprequest.files:
                image_file = request.httprequest.files.get("fund_image")
                if image_file and image_file.filename:
                    vals["fund_image"] = base64.b64encode(image_file.read())

            certificate.write(vals)
            _logger.info(f"Cập nhật thành công chứng chỉ quỹ với ID: {cert_id}")
            return request.redirect("/fund_certificate_list")

        except Exception as e:
            _logger.error(
                f"!!! Lỗi khi cập nhật chứng chỉ quỹ ID {cert_id}: {str(e)}",
                exc_info=True,
            )
            return request.redirect(
                f"/fund_certificate/edit/{cert_id}"
            )  # Chuyển hướng về trang chỉnh sửa khi có lỗi

    @http.route(
        "/fund_certificate/delete",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
        cors="*",
    )
    def delete_fund_certificate(self, **kwargs):
        """
        API endpoint để xóa Chứng chỉ quỹ.
        Sử dụng type='http' để trả về JSON response mà frontend có thể xử lý dễ dàng.
        """
        try:
            # Lấy dữ liệu từ body của request HTTP
            data = json.loads(request.httprequest.data)
            cert_id = data.get("cert_id")

            if not cert_id:
                _logger.error("!!! Xóa thất bại: cert_id không được cung cấp trong dữ liệu JSON.")
                error_payload = json.dumps(
                    {"success": False, "error": "ID Chứng chỉ quỹ không được cung cấp."}
                )
                return Response(
                    error_payload, content_type="application/json", status=400
                )

            _logger.info(f"Đang thử xóa chứng chỉ quỹ với ID: {cert_id}")

            certificate = request.env["fund.certificate"].sudo().browse(int(cert_id))

            if not certificate.exists():
                _logger.warning(
                    f"Thử xóa chứng chỉ quỹ không tồn tại với ID: {cert_id}"
                )
                error_payload = json.dumps(
                    {"success": False, "error": "Không tìm thấy bản ghi để xóa."}
                )
                return Response(
                    error_payload, content_type="application/json", status=404
                )

            cert_name = certificate.short_name_vn or certificate.symbol or f"ID: {cert_id}"

            certificate.unlink()

            _logger.info(f"Xóa thành công chứng chỉ quỹ: {cert_name}")
            success_payload = json.dumps(
                {"success": True, "message": f"Đã xóa thành công {cert_name}"}
            )
            return Response(success_payload, content_type="application/json")

        except ValueError as ve:
            _logger.error(f"!!! ValueError khi xóa chứng chỉ quỹ: {str(ve)}")
            error_payload = json.dumps({"success": False, "error": "ID không hợp lệ."})
            return Response(error_payload, content_type="application/json", status=400)
        except Exception as e:
            _logger.error(
                f"!!! Lỗi khi xóa chứng chỉ quỹ: {str(e)}", exc_info=True
            )
            error_payload = json.dumps(
                {"success": False, "error": f"Lỗi máy chủ: {str(e)}"}
            )
            return Response(error_payload, content_type="application/json", status=500)

    # Route của loại chương trình



    # Route của Kỳ hạn / Lãi suất (Term Rate)
    @http.route("/term_rate_list", type="http", auth="user", website=True)
    def term_rate_list_page(self, **kwargs):
        """Renders the page layout for the Term Rate list."""
        return request.render(
            "fund_management_control.term_rate_list", {"active_page": "term_rate"}
        )

    @http.route(
        "/get_term_rate_data",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
        cors="*",
    )
    def get_term_rate_data(self, page=1, limit=10, search="", **kwargs):
        """
        API endpoint to fetch a paginated and searchable list of Term Rates.
        """
        _logger.info(
            f">>> API Term Rate called: page={page}, limit={limit}, search='{search}'"
        )
        try:
            domain = []
            if search:
                # Tìm kiếm theo số tháng (chuyển đổi sang số nếu có thể) hoặc mô tả
                if search.isdigit():
                    domain = ["|", ("term_months", "=", int(search)), ("description", "ilike", search)]
                else:
                    domain = [("description", "ilike", search)]

            TermRate = request.env["nav.term.rate"]
            total_records = TermRate.search_count(domain)
            offset = (int(page) - 1) * int(limit)
            rates = TermRate.search(
                domain, limit=int(limit), offset=offset, order="term_months asc"
            )

            data = []
            for r in rates:
                data.append(
                    {
                        "id": r.id,
                        "term_months": r.term_months,
                        "interest_rate": r.interest_rate,
                        "effective_date": r.effective_date.strftime("%Y-%m-%d") if r.effective_date else None,
                        "end_date": r.end_date.strftime("%Y-%m-%d") if r.end_date else None,
                        "active": r.active,
                        "description": r.description or "",
                    }
                )

            response_data = {"records": data, "total_records": total_records}
            return Response(json.dumps(response_data), content_type="application/json")
        except Exception as e:
            _logger.error(f"!!! Error in /get_term_rate_data: {str(e)}", exc_info=True)
            return Response(
                json.dumps({"error": str(e)}),
                content_type="application/json",
                status=500,
            )

    @http.route("/term_rate/delete", type="http", auth="user", methods=["POST"], csrf=False)
    def delete_term_rate(self, **kwargs):
        try:
            data = json.loads(request.httprequest.data)
            record_id = data.get("id")
            if not record_id:
                return Response(json.dumps({"success": False, "error": "Missing ID"}), status=400)
            
            record = request.env["nav.term.rate"].sudo().browse(int(record_id))
            if record.exists():
                record.unlink()
                return Response(json.dumps({"success": True}), content_type="application/json")
            else:
                 return Response(json.dumps({"success": False, "error": "Not Found"}), status=404)
        except Exception as e:
             return Response(json.dumps({"success": False, "error": str(e)}), status=500)
    
    @http.route("/term_rate/new", type="http", auth="user", website=True)
    def term_rate_form_page(self, **kwargs):
         return request.render("fund_management_control.term_rate_form", {"active_page": "term_rate"})

    @http.route("/term_rate/create", type="http", auth="user", methods=["POST"], csrf=False)
    def create_term_rate(self, **post):
        try:
            vals = {
                "term_months": int(post.get("term_months")),
                "interest_rate": float(post.get("interest_rate")),
                "effective_date": post.get("effective_date"),
                "end_date": post.get("end_date") or False,
                "active": post.get("active") == "on",
                "description": post.get("description"),
            }
            request.env["nav.term.rate"].sudo().create(vals)
            return request.redirect("/term_rate_list")
        except Exception as e:
            _logger.error(f"Create error: {e}")
            return request.redirect("/term_rate_list")

    @http.route("/term_rate/edit/<int:id>", type="http", auth="user", website=True)
    def term_rate_edit_page(self, id, **kwargs):
        record = request.env["nav.term.rate"].sudo().browse(id)
        return request.render("fund_management_control.term_rate_edit_form", {
            "rate": record,
            "active_page": "term_rate"
        })

    @http.route("/term_rate/update", type="http", auth="user", methods=["POST"], csrf=False)
    def update_term_rate(self, **post):
        try:
            record_id = int(post.get("id"))
            record = request.env["nav.term.rate"].sudo().browse(record_id)
            vals = {
                "term_months": int(post.get("term_months")),
                "interest_rate": float(post.get("interest_rate")),
                "effective_date": post.get("effective_date"),
                "end_date": post.get("end_date") or False,
                "active": post.get("active") == "on",
                "description": post.get("description"),
            }
            record.write(vals)
            return request.redirect("/term_rate_list")
        except Exception as e:
             _logger.error(f"Update error: {e}")
             return request.redirect(f"/term_rate/edit/{post.get('id')}")
