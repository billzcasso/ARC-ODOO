# Fund Management System

**HDC-FMS** là bộ giải pháp quản lý quỹ đầu tư toàn diện xây dựng trên nền tảng Odoo, cung cấp các công cụ mạnh mẽ để quản lý giao dịch chứng chỉ quỹ (CCQ), theo dõi tài sản, khớp lệnh tự động và tích hợp dữ liệu thị trường thực.

Hệ thống được thiết kế theo kiến trúc module hóa, dễ dàng mở rộng và tùy biến cho các công ty quản lý quỹ chuyên nghiệp.

---

## 🚀 Tính Năng Chính

- **Quản Lý Quỹ & NAV**: Theo dõi Net Asset Value (NAV) realtime, quản lý danh mục đầu tư đa dạng.
- **Giao Dịch Thông Minh**: Hỗ trợ đặt lệnh (LO, ATO, ATC, MTL), khớp lệnh tự động và sổ lệnh điện tử.
- **AI Trading Assistant**: Tích hợp trợ lý ảo AI hỗ trợ phân tích dữ liệu và gợi ý đầu tư.
- **Cổng Thanh Toán**: Tích hợp cổng thanh toán PayOS và các phương thức chuyển khoản ngân hàng.
- **Dữ Liệu Thị Trường**: Đồng bộ dữ liệu chứng khoán (OHLC, Index) từ các nguồn uy tín (SSI, Vietstock).
- **Minh Bạch & Bảo Mật**: Hệ thống phân quyền chi tiết, xác thực đa lớp (2FA, Custom Auth) và lưu vết giao dịch.

---

## 📦 Danh Sách Module

Hệ thống bao gồm các module chính được chia theo nhóm chức năng:

### 1. Quản Trị Quỹ & Tài Sản

- `fund_management`: Core module quản lý thông tin quỹ, nguyên tắc đầu tư và quy trình nghiệp vụ.
- `fund_management_control`: Các công cụ kiểm soát, cấu hình hạn mức và quy tắc tuân thủ.
- `fund_management_dashboard`: Bảng điều khiển trực quan dành cho người quản lý (Admin Dashboard).
- `nav_management`: Tính toán và quản lý giá trị tài sản ròng (NAV) hàng ngày/định kỳ.
- `asset_management`: Quản lý danh mục tài sản chi tiết của từng quỹ.
- `overview_fund_management`: Tổng quan hiệu suất hoạt động của các quỹ.

### 2. Giao Dịch & Khớp Lệnh

- `transaction_management`: Quản lý dòng đời giao dịch, trạng thái lệnh và lịch sử.
- `transaction_list`: Danh sách và báo cáo chi tiết các giao dịch.
- `stock_trading`: Module giao dịch chứng khoán cơ sở (Stocks/Etfs).
- `order_matching`: Engine khớp lệnh nội bộ và đối ứng với thị trường.

### 3. Nhà Đầu Tư & Phân Quyền

- `investor_profile_management`: Quản lý hồ sơ KYC, thông tin cá nhân và tài khoản nhà đầu tư.
- `investor_list`: Danh sách và phân nhóm nhà đầu tư.
- `user_permission_management`: Phân quyền người dùng nội bộ chi tiết theo vai trò.
- `custom_auth`: Tùy biến quy trình đăng nhập, xác thực và bảo mật.

### 4. Dữ Liệu & Tiện Ích Mở Rộng

- `stock_data`: Cập nhật và lưu trữ dữ liệu thị trường chứng khoán.
- `ai_trading_assistant`: Chatbot/Assistant hỗ trợ ra quyết định đầu tư.
- `payos_gateway`: Cổng thanh toán tích hợp PayOS.
- `report_list`: Hệ thống báo cáo định kỳ và tùy chỉnh.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Python (Odoo 18 Framework).
- **Frontend**: OWL (Odoo Web Library), JavaScript (ES6+), SCSS.
- **Database**: PostgreSQL 13+.
- **Infrastructure**: Docker & Docker Compose.
- **Integration**: RESTful APIs, Webhooks.

---

## ⚙️ Hướng Dẫn Cài Đặt (Docker)

### Yêu Cầu

- Docker & Docker Compose đã được cài đặt.
- Cấu hình file `docker-compose.yml` phù hợp với môi trường (Port, Volume).

### Khởi Chạy

Để khởi động toàn bộ hệ thống HDC-FMS:

```bash
# 1. Khởi động các services
docker compose up -d

# 2. Theo dõi logs (tùy chọn)
docker compose logs -f odoo
```

### Truy Cập

- **URL**: `http://localhost:8069`
- **Tài khoản mặc định**: `admin` / `admin` (hoặc cấu hình trong file conf).

### Cập Nhật Ứng Dụng

Để cập nhật code mới nhất cho các module:

```bash
# Restart container để Odoo nhận code mới
docker compose restart odoo

# Update module trong giao diện Odoo (Apps -> Update App List -> Upgrade)
# Hoặc dùng command line (nếu có script hỗ trợ)
```

---

## 🔌 API Endpoints Cơ Bản

Hệ thống cung cấp các API để tích hợp với Mobile App hoặc Web Portal:

### Fund Operations

- `POST /api/fund/normal-order/market-info`: Lấy thông tin thị trường/quỹ để đặt lệnh.
- `POST /api/fund/normal-order/order-types`: Lấy danh sách loại lệnh hợp lệ.
- `POST /submit_fund_sell`: Gửi lệnh bán.
- `POST /create_investment`: Tạo khoản đầu tư mới.

### Signatures

- `POST /api/append_signature`: Tích hợp ký tay vào file PDF hợp đồng.
- `POST /api/sign`: Ký số văn bản.

### Market Data

- `GET /ssi/api/ohlc/daily`: Dữ liệu nến ngày.
- `GET /ssi/api/index/daily`: Chỉ số thị trường.

---

## 📁 Cấu Trúc Thư Mục

```plaintext
HDC-FMS/
├── addons/                     # Chứa source code các module Odoo
│   ├── fund_management/        # Module lõi
│   ├── stock_data/             # Module dữ liệu
│   └── ...                     # Các module khác
├── etc/                        # File cấu hình Odoo (odoo.conf)
├── docker-compose.yml          # Định nghĩa container
└── README.md                   # Tài liệu dự án
```

---

**© 2024 - 2025 HDC Fund Management System. All rights reserved.**
Dự án nội bộ - Vui lòng không chia sẻ mã nguồn ra bên ngoài.
