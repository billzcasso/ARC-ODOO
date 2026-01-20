# HDC Core - Hướng Dẫn Sử Dụng

## Giới thiệu

**HDC Core** là module lõi của hệ thống HDC-FMS, có nhiệm vụ gom và quản lý toàn bộ dependencies của dự án. Module này đảm bảo việc cài đặt và nâng cấp các module được thực hiện thống nhất, giảm rủi ro vòng lặp khi cấu hình riêng lẻ.

## Yêu cầu

- **Odoo version**: 18.0
- **License**: LGPL-3

## Dependencies

Module này phụ thuộc vào tất cả các module trong hệ thống HDC-FMS:

### Odoo Core

- `base`, `bus`, `mail`, `portal`, `web`

### Shared Auth/Portal

- `custom_auth` - Xác thực tùy chỉnh
- `user_permission_management` - Quản lý phân quyền

### Data & Integration

- `payos_gateway` - Cổng thanh toán PayOS
- `stock_data` - Dữ liệu chứng khoán

### Investor Domain

- `investor_profile_management` - Quản lý hồ sơ nhà đầu tư
- `investor_list` - Danh sách nhà đầu tư

### Fund Domain

- `fund_management_control` - Kiểm soát quản lý quỹ
- `fund_management` - Quản lý quỹ chính
- `asset_management` - Quản lý tài sản

### Trading & Transactions

- `stock_trading` - Giao dịch chứng khoán
- `transaction_management` - Quản lý giao dịch
- `order_matching` - Khớp lệnh
- `transaction_list` - Danh sách giao dịch

### NAV & Overview

- `nav_management` - Quản lý NAV
- `overview_fund_management` - Tổng quan quỹ
- `fund_management_dashboard` - Dashboard quỹ

### Reporting

- `report_list` - Báo cáo

## Cài đặt

1. Đảm bảo tất cả các module dependencies đã có trong thư mục `addons`
2. Cập nhật danh sách module trong Odoo
3. Cài đặt module `hdc_core` - hệ thống sẽ tự động cài đặt tất cả dependencies

```
Odoo Settings → Apps → Update App List → Search "HDC Core" → Install
```

## Lưu ý

- Đây là module **tập trung** (umbrella module) - không cung cấp chức năng nghiệp vụ riêng
- Khi cài đặt module này, toàn bộ hệ thống HDC-FMS sẽ được cài đặt
- Sử dụng module này để đảm bảo tính nhất quán của hệ thống
