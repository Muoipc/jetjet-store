# Hướng Dẫn Tích Hợp Casso Webhook & MB Bank Cho JetJet Store

Tài liệu hướng dẫn chi tiết từng bước kết nối tài khoản ngân hàng MB Bank với Casso và cấu hình webhook tự động cập nhật trạng thái đơn hàng trên hệ thống JetJet Store.

---

## 1. Nguyên Lý Hoạt Động

```
[Khách Quét Mã QR VietQR] 
       │ (Nội dung: JETJET JJxxxxxxxx, STK: 241620968888)
       ▼
[Ngân hàng MB Bank]
       │ (Phát sinh biến động số dư)
       ▼
[Casso.vn] ──(POST /api/webhook/casso)──▶ [JetJet Store Backend]
                                                │
                                                ├─ Match Regex: JETJET JJxxxxxxxx
                                                ├─ Kiểm tra số tiền >= total_price
                                                ├─ Update orders status = 'paid'
                                                └─ Ghi log vào bảng payment_logs
```

---

## 2. Bước 1: Đăng Ký Tài Khoản Casso

1. Truy cập: [https://app.casso.vn](https://app.casso.vn)
2. Bấm **Đăng ký** bằng Google hoặc Email.
3. Tạo **Tổ chức (Organization)** mới (ví dụ: `JetJet Store`).

---

## 3. Bước 2: Liên Kết Tài Khoản MB Bank

1. Tại Dashboard Casso, chọn mục **Tài khoản ngân hàng** -> **Thêm tài khoản**.
2. Chọn ngân hàng **MB Bank (Ngân hàng Quân Đội)**.
3. Nhập thông tin đăng nhập ngân hàng số MB Bank:
   - **Số tài khoản:** `241620968888`
   - **Chủ tài khoản:** `NGUYEN SONG HOANG PHUC`
   - Điền thông tin đăng nhập Internet Banking MB Bank và mã OTP xác thực theo hướng dẫn của Casso.
4. Sau khi kết nối thành công, kiểm tra trạng thái tài khoản hiển thị: **Đang hoạt động (Active)**.

---

## 4. Bước 3: Public Localhost Ra Internet (Môi Trường Phát Triển)

Casso cần một URL HTTPS công khai trên Internet để gửi webhook về máy local (port 3000). Bạn có thể chọn 1 trong 2 cách sau:

### Cách A: Dùng ngrok (Khuyên dùng)
```bash
npx ngrok http 3000
```
Kết quả hiển thị URL Forwarding dạng:
```
Forwarding   https://abc1-234-56-78.ngrok-free.app -> http://localhost:3000
```

### Cách B: Dùng Cloudflare Tunnel (Miễn phí, không timeout)
```bash
# Cài đặt cloudflared nếu chưa có
brew install cloudflare/cloudflare/cloudflared

# Chạy tunnel tạm thời
cloudflared tunnel --url http://localhost:3000
```
Kết quả hiển thị URL dạng:
```
https://random-subdomain.trycloudflare.com
```

---

## 5. Bước 4: Cấu Hình Webhook Trên Casso

1. Trên Casso Dashboard, vào mục **Tích hợp** -> **Webhook** -> chọn **Thêm Webhook**.
2. Điền các thông tin:
   - **Webhook URL:** `https://<domain_cua_ban>/api/webhook/casso`  
     *(Ví dụ: `https://abc1-234-56-78.ngrok-free.app/api/webhook/casso`)*
   - **Tài khoản ngân hàng:** Chọn tài khoản MB Bank `241620968888`.
   - **Bảo mật (Secret Token / Secure-Token):** Nhập chuỗi bí mật ngẫu nhiên (ví dụ: `jetjet_casso_secret_key_2026`).
3. Bấm **Lưu Webhook**.

---

## 6. Bước 5: Cấu Hình Biến Môi Trường `.env`

Mở file `.env` trong thư mục gốc của dự án `ai-account-store` và bổ sung/cập nhật:

```env
# Secret token khớp với mã bí mật đã cấu hình trên Casso
CASSO_WEBHOOK_SECRET=jetjet_casso_secret_key_2026
```

> **Lưu ý bảo mật:**  
> Hệ thống backend tự động đối chiếu header `Secure-Token` hoặc `x-webhook-secret` từ request tới `CASSO_WEBHOOK_SECRET`. Nếu không khớp, backend sẽ trả về mã `403 Forbidden` để ngăn chặn request giả mạo.

Khởi động lại server backend sau khi cập nhật `.env`:
```bash
node server.js
```

---

## 7. Bước 6: Chạy Script Test Tự Động

Dự án đã tích hợp sẵn script kiểm thử tự động toàn diện tại `scripts/test_casso_webhook.js`. Script sẽ thực hiện:
1. Tạo đơn hàng mẫu qua `POST /api/orders` và nhận `order_code`.
2. Gửi request giả lập Webhook của Casso với đúng cú pháp `JETJET <order_code>`.
3. Kiểm tra đơn hàng được chuyển trạng thái sang `paid` và có thời gian thanh toán.
4. Kiểm tra bản ghi giao dịch đã được lưu chính xác vào bảng `payment_logs`.

Chạy lệnh test:
```bash
node scripts/test_casso_webhook.js
```

Khi thành công, màn hình sẽ hiển thị:
```
🚀 Bắt đầu test tự động luồng Casso Webhook...
[1/4] Tạo đơn hàng thử nghiệm qua POST /api/orders...
✅ Tạo đơn thành công! Mã đơn: JJxxxxxxxx, Tổng tiền: 50.000đ
[2/4] Gửi mock webhook Casso tới POST /api/webhook/casso...
✅ Webhook phản hồi thành công: matched = 1
[3/4] Kiểm tra trạng thái đơn hàng qua GET /api/orders/JJxxxxxxxx...
✅ Trạng thái đơn hàng: paid
[4/4] Kiểm tra bản ghi payment_logs trong database...
✅ Payment log ghi nhận chính xác: ID x, TID: TEST_xxxx, Tiền: 50.000đ, Ref: MB_TEST_REF

🎉 TẤT CẢ CÁC BƯỚC TEST ĐỀU PASS! Hệ thống Casso Webhook hoạt động hoàn hảo.
```

---

## 8. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Webhook trả về 403 Forbidden | `CASSO_WEBHOOK_SECRET` trong `.env` khác với secret trên Casso | Đồng bộ giá trị secret giữa `.env` và dashboard Casso, sau đó restart server |
| Đơn không cập nhật thành `paid` | Cú pháp chuyển khoản thiếu prefix `JETJET` hoặc sai mã đơn | Kiểm tra nội dung chuyển khoản phải đúng format `JETJET JJxxxxxxxx` |
| Số tiền thanh toán chưa đủ | Khách chuyển thiếu so với `total_price` | Backend chỉ cập nhật `paid` khi `amount >= total_price`. Bản ghi vẫn được lưu vào `payment_logs` để admin đối soát |
| Ngrok bị đổi URL sau khi restart | Dùng bản free của ngrok | Cập nhật lại Webhook URL trên dashboard Casso với URL mới |
