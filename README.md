# Đồ án Tốt nghiệp: Hệ thống ARC (Advanced Resource & Control)
## Thiết kế và xây dựng hệ thống quản lý giao dịch và tư vấn đầu tư thông minh chứng chỉ quỹ tích hợp trí tuệ nhân tạo

**Sinh viên thực hiện:**
- **Trần Nguyễn Trường Phát** - 2274802010640
- **Võ Văn Nhân** - 2274802010602

---

## 1. Tổng quan dự án
Dự án tập trung vào việc hiện đại hóa quy trình quản lý và giao dịch chứng chỉ quỹ (Fund Certificates) thông qua hệ thống **ARC**. Hệ thống không chỉ dừng lại ở các nghiệp vụ quản trị truyền thống mà còn tích hợp các công nghệ tiên tiến như Trí tuệ nhân tạo (AI) để hỗ trợ ra quyết định và các giao thức bảo mật hiện đại (Digital Signature, KYC).

**Mục tiêu chính:**
- Tự động hóa vòng đời giao dịch chứng chỉ quỹ.
- Cung cấp trải nghiệm đầu tư minh bạch và an toàn cho nhà đầu tư.
- Ứng dụng AI (Deep Reinforcement Learning) trong việc phân tích thị trường và tư vấn chiến lược đầu tư.

---

## 2. Kiến trúc hệ thống ARC
Hệ thống được thiết kế theo kiến trúc Layered Module trên nền tảng Odoo 18, đảm bảo tính mở rộng và khả năng bảo mật cao:

### A. Layer Lõi (Core Layer)
- **`arc_core`**: Module hạt nhân đóng vai trò bộ tổng hợp phụ thuộc (dependency aggregator), giúp quản lý tập trung và giảm thiểu rủi ro xung đột giữa các thành phần.
- **`user_permission_management` & `custom_auth`**: Hệ thống phân quyền chi tiết và xác thực đa lớp (2FA/OTP), đảm bảo an toàn dữ liệu nhà đầu tư.

### B. Layer Nghiệp vụ (Domain Layer)
- **`fund_management`**: Quản lý thông tin quỹ, danh mục đầu tư và quy trình Mua/Bán (Subscription/Redemption).
- **`transaction_management`**: Cổng thông tin cho phép nhà đầu tư theo dõi trạng thái lệnh, lịch sử giao dịch và kế hoạch đầu tư định kỳ (SIP).
- **`nav_management`**: Tính toán giá trị tài sản ròng (NAV/Unit) theo thời gian thực hoặc định kỳ dựa trên biến động thị trường.

### C. Layer Tích hợp (Integration Layer)
- **`stock_data`**: Đồng bộ dữ liệu thị trường (Index, OHLC) từ SSI và các đối tác tài chính.
- **`stock_trading`**: Kết nối trực tiếp với **SSI FastConnect API**, cho phép đặt lệnh thực trên thị trường chứng khoán Việt Nam (HOSE, HNX, UPCOM).
- **`payos_gateway`**: Tích hợp thanh toán QR-Code nhanh chóng và tiện lợi.

### D. Layer Thông minh (AI Layer)
- **`ai_trading_assistant`**: "Bộ não" của hệ thống ARC.
    - **DRL Algorithms**: Sử dụng các thuật toán Học sâu tăng cường (PPO, A2C, SAC, TD3, DDPG) từ thư viện FinRL để tối ưu hóa danh mục đầu tư.
    - **Technical Analysis**: Tích hợp các chỉ báo kỹ thuật (RSI, MACD, Bollinger Bands) để làm đầu vào cho mô hình AI.
    - **AI Chatbot**: Trợ lý ảo hỗ trợ giải đáp thắc mắc và vẽ biểu đồ phân tích kỹ thuật theo yêu cầu của người dùng.

---

## 3. Các đặc điểm kỹ thuật nổi bật
- **Quy trình giao dịch an toàn**: Tích hợp chữ ký số (Digital Signature) và Smart OTP ngay trên giao diện web giúp giảm thiểu rủi ro giả mạo.
- **Real-time Monitoring**: Sử dụng **Odoo Bus Service** và **SignalR** để cập nhật giá chứng khoán và trạng thái lệnh tức thời mà không cần tải lại trang.
- **Phân tích hiệu suất**: Hệ thống Dashboard trực quan (module `overview_fund_management`) giúp người quản lý theo dõi tốc độ tăng trưởng và hiệu suất từng quỹ.
- **Hạ tầng hiện đại**: Triển khai trên nền tảng **Docker**, giúp hệ thống hoạt động ổn định và dễ dàng mở rộng khi lưu lượng truy cập tăng cao.

---

## 4. Công nghệ sử dụng
- **Ngôn ngữ**: Python 11+, JavaScript (ESnext).
- **Backend Framework**: Odoo 18, FastAPI (cho xử lý AI nặng).
- **Frontend Framework**: OWL (Odoo Web Library), SCSS thời thượng.
- **AI Libraries**: FinRL, Stable Baselines 3, Gymnasium, PyTorch.
- **Database**: PostgreSQL 15+.
- **Data Integration**: SSI FastConnect SDK, PayOS SDK.

---

## 5. Hướng dẫn khởi chạy hệ thống

### Yêu cầu tiên quyết
- Đã cài đặt **Docker** và **Docker Compose**.
- Cấu hình file `.env` (nếu có) để thiết lập các API Key (SSI, PayOS).

### Các bước thực hiện
1. **Khởi động các container:**
   ```bash
   docker-compose up -d
   ```
2. **Kiểm tra trạng thái hệ thống:**
   ```bash
   docker-compose ps
   ```
3. **Truy cập ứng dụng:**
   - Mở trình duyệt và truy cập: `http://localhost:8069`
   - Tài khoản đăng nhập mặc định: `admin` / `admin`.

4. **Cập nhật module (khi có thay đổi code):**
   ```bash
   docker-compose restart odoo
   # Sau đó vào Apps -> Update App List -> Upgrade module 'arc_core'
   ```

---

## 6. Các lỗi thường gặp và cách xử lý

| Lỗi | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| **Port 8069 already in use** | Có ứng dụng khác đang chiếm dụng cổng 8069. | Đổi cổng trong file `docker-compose.yml` (ví dụ: `8070:8069`). |
| **Database Connection Error** | Container PostgreSQL chưa khởi động kịp hoặc sai thông số cấu hình. | Kiểm tra logs bằng `docker-compose logs db`. Đảm bảo các biến ENV về DB khớp nhau. |
| **Module not found** | Đường dẫn `addons` trong cấu hình chưa chính xác. | Kiểm tra tham số `addons_path` trong file `etc/odoo.conf` hoặc volumes trong `docker-compose.yml`. |
| **Internal Server Error (500)** | Lỗi logic Python hoặc thiếu thư viện phụ thuộc. | Kiểm tra logs bằng `docker-compose logs -f odoo` để tìm traceback chi tiết. |
| **AI Model không load được** | Thiếu tài nguyên RAM hoặc thư viện `torch/finrl` chưa cài đặt đúng. | Đảm bảo server có tối thiểu 4GB RAM và kiểm tra `external_dependencies` trong manifest. |

---
*Hệ thống ARC - Giải pháp chuyển đổi số toàn diện cho ngành quản lý quỹ.*

