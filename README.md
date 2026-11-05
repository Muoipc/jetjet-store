# 🌾 JetJet Store — Tiệm Tạp Hóa AI Miền Tây (Production-Ready)

Hệ thống bán tài khoản / license công cụ AI (ChatGPT Plus, Claude Pro, Cursor Pro, Copilot, Midjourney, Canva...) với cơ chế thanh toán VietQR & webhook xác nhận tự động Casso.

---

## 🚀 Tính Năng Chính

- **Storefront & Giỏ hàng**:
  - Lưu giỏ hàng bền vững (`localStorage`), không lo mất dữ liệu khi reload (F5).
  - Quản lý số lượng tồn kho trực tiếp (`stock`), cảnh báo sắp hết và tự động khóa mua khi hết hàng.
  - Tra cứu trạng thái đơn hàng thời gian thực qua mã `JJxxxxxxxx`.
  - Hỗ trợ mã VietQR tự động khớp nội dung `JETJET <order_code>`.

- **Admin Dashboard**:
  - Xác thực bảo mật Session Cookie qua `bcrypt` (không dùng plaintext key hay header dễ lộ).
  - Bảng thống kê doanh thu, đơn hàng & biểu đồ trực quan 7 ngày vẽ bằng HTML5 Canvas 2D.
  - Quản lý tồn kho trực tiếp (`+` / `-` stock nhanh) và soft-delete sản phẩm.
  - Bộ lọc đơn hàng đa trạng thái: Chờ chuyển khoản, Đã nhận tiền, Đang xử lý, Hoàn thành, Đã hủy (tự động hoàn tồn kho).
  - Nhật ký thanh toán webhook Casso chi tiết (`payment_logs`).

- **Bảo Mật & Kiến Trúc**:
  - Cơ sở dữ liệu: MySQL 8+ / 26+ (`jetjet_store`), liên kết khóa ngoại & transaction ACID.
  - Giá và số lượng được xác thực 100% phía server (chống hacker gửi giá âm hay sai lệch).
  - Chống XSS (HTML entity sanitizer), Rate Limiting (chống DoS / spam đặt hàng).

---

## 🛠 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Khởi tạo cơ sở dữ liệu MySQL:
```bash
mysql -u root -p123456 < schema.sql
npm run seed
```

### 2. Cài đặt dependencies:
```bash
npm install
```

### 3. Cấu hình biến môi trường (`.env`):
```env
PORT=3000
ADMIN_KEY=phucdeptrai123
DB_HOST=localhost
DB_USER=root
DB_PASS=123456
DB_NAME=jetjet_store
SESSION_SECRET=jetjet-mien-tay-session-2026
CASSO_API_KEY=
CASSO_WEBHOOK_SECRET=
```

### 4. Chạy hệ thống:
```bash
npm start
```
- Storefront: `http://localhost:3000`
- Admin Dashboard: `http://localhost:3000/admin.html` (Đăng nhập: `admin` / mật khẩu trong `.env` - mặc định `phucdeptrai123`)

---

## 🧪 Kiểm Thử Webhook Tự Động

Chạy script mô phỏng toàn bộ chu trình đặt hàng -> nhận webhook Casso -> xác nhận tiền -> ghi log:
```bash
npm run test:webhook
```

---

## 📖 Tài Liệu Casso Webhook
Xem chi tiết hướng dẫn liên kết tài khoản ngân hàng MB Bank và thiết lập webhook thật tại [`docs/CASSO_SETUP.md`](docs/CASSO_SETUP.md).
