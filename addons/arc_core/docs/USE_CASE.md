# HDC Core - Use Cases

## Tổng quan

Module HDC Core đóng vai trò là **điểm cài đặt trung tâm** cho toàn bộ hệ thống HDC-FMS. Thay vì cài đặt từng module riêng lẻ, quản trị viên chỉ cần cài đặt module này để triển khai toàn bộ hệ thống.

## Actors

| Actor                | Mô tả                                |
| -------------------- | ------------------------------------ |
| System Administrator | Người quản trị hệ thống Odoo         |
| DevOps Engineer      | Người triển khai và bảo trì hệ thống |

## Use Cases

### UC-01: Cài đặt toàn bộ hệ thống HDC-FMS

**Actor**: System Administrator  
**Precondition**:

- Odoo 18.0 đã được cài đặt
- Tất cả module HDC-FMS đã có trong thư mục addons

**Flow**:

1. Truy cập Odoo Settings → Apps
2. Click "Update App List"
3. Tìm kiếm "HDC Core"
4. Click "Install"
5. Hệ thống tự động cài đặt tất cả dependencies theo thứ tự phụ thuộc

**Postcondition**:

- Toàn bộ 19 modules của HDC-FMS được cài đặt
- Hệ thống sẵn sàng sử dụng

---

### UC-02: Nâng cấp hệ thống HDC-FMS

**Actor**: DevOps Engineer  
**Precondition**:

- Hệ thống HDC-FMS đang chạy
- Có phiên bản mới của các modules

**Flow**:

1. Cập nhật source code các modules
2. Truy cập Odoo Settings → Apps
3. Click "Update App List"
4. Tìm "HDC Core" → Click "Upgrade"
5. Hệ thống tự động nâng cấp tất cả dependencies

**Postcondition**:

- Tất cả modules được nâng cấp lên phiên bản mới
- Dữ liệu được migrate an toàn

---

### UC-03: Kiểm tra dependencies

**Actor**: System Administrator  
**Precondition**: Hệ thống đang hoạt động

**Flow**:

1. Mở file `__manifest__.py` của module `hdc_core`
2. Xem danh sách `depends` để biết tất cả modules trong hệ thống
3. Kiểm tra trạng thái từng module trong Odoo Apps

**Postcondition**:

- Xác nhận được tất cả modules đã được cài đặt đúng cách

## Dependency Graph

```
hdc_core
├── Odoo Core (base, bus, mail, portal, web)
├── Auth Layer
│   ├── custom_auth
│   └── user_permission_management
├── Data Layer
│   ├── payos_gateway
│   └── stock_data
├── Investor Layer
│   ├── investor_profile_management
│   └── investor_list
├── Fund Layer
│   ├── fund_management_control
│   ├── fund_management
│   └── asset_management
├── Trading Layer
│   ├── stock_trading
│   ├── transaction_management
│   ├── order_matching
│   └── transaction_list
├── NAV Layer
│   ├── nav_management
│   ├── overview_fund_management
│   └── fund_management_dashboard
└── Report Layer
    └── report_list
```
