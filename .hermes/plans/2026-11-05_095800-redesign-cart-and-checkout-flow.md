# Kế Hoạch Tái Cấu Trúc Quy Trình Mua Hàng & Giỏ Hàng Tối Giản (Plan)

## Goal
Tái thiết kế toàn diện quy trình mua hàng (Purchasing Flow) và Giỏ hàng (Cart Drawer) trên JetJet Store theo phong cách tối giản hiện đại (Minimalist & Frictionless), tối ưu hóa trải nghiệm mua sản phẩm số: hỗ trợ "Mua ngay" (1-Click Instant Checkout), giỏ hàng thông minh cho tài liệu số, quy trình thanh toán VietQR tinh gọn không rào cản (cho phép mua vãng lai không bắt buộc SĐT, hoặc đăng nhập lưu đơn), và nhận link Google Drive tức thì.

---

## Current Context & Assumptions

### 1. Hiện trạng và các điểm nghẽn (Pain Points):
- **Trên thẻ sản phẩm:** Chỉ có nút `+ Hốt liền`. Khi bấm vào, giỏ hàng lập tức bung ra che toàn màn hình gây gián đoạn duyệt sản phẩm.
- **Trong giỏ hàng:** Vẫn cho phép bấm `+` tăng số lượng đối với khóa học số (người dùng không có nhu cầu mua 2 bản của cùng 1 đường link Google Drive). Thiếu nút xóa (`✕` / Thùng rác) riêng lẻ cho từng món.
- **Rào cản Checkout:** Khi bấm "Tiến hành thanh toán", nếu khách chưa đăng nhập thì hệ thống điều hướng cưỡng bức sang `/login.html?redirect=/`, làm gián đoạn trải nghiệm của khách vãng lai.
- **Ràng buộc dữ liệu cũ trên Backend (`routes/orders.js`):** Bắt buộc phải có `customer_phone` hợp lệ (10-11 số). Đối với sản phẩm số gửi qua Google Drive, **Email** là yếu tố cốt lõi; số điện thoại chỉ nên là tùy chọn (optional) để giảm tối đa tỷ lệ rớt đơn.
- **Thanh toán VietQR:** Cần tích hợp tóm tắt đơn hàng rõ ràng, mã QR động VietQR với nội dung chuẩn `JJxxxxxxxx`, đồng hồ đếm ngược và màn hình bàn giao link Drive tức thì tại chỗ.

### 2. Giả định kiến trúc (Design Constraints):
- Giữ nguyên triết lý giao diện tối giản của Phúc: Tông màu đen - trắng - xám thanh lịch, bo góc nhẹ (`var(--radius-sm)`), icon SVG nét đơn (`.ui-icon`), typography phân cấp rõ ràng, không hiệu ứng lòe loẹt.
- Sản phẩm số (`is_digital = 1` hoặc danh mục `Khóa học & Tài liệu số`): Mặc định số lượng cố định là 1 (không hiển thị nút tăng số lượng, chỉ có nút gỡ bỏ khỏi giỏ).
- Hỗ trợ song song 2 luồng:
  1. **Khách thành viên:** Tự động điền email & tên từ tài khoản, đơn hàng lưu vào Dashboard cá nhân.
  2. **Khách vãng lai:** Chỉ cần điền Email nhận link Drive (và tên gợi nhớ), không bắt buộc đăng nhập hay số điện thoại.

---

## Architecture & Proposed Approach

```
┌────────────────────────────────────────────────────────────────────────┐
│                          STOREFRONT UX                                 │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Thẻ Sản Phẩm / Quick View:                                          │
│    - Nút 1: [⚡ Mua ngay] -> Mở thẳng Modal Thanh toán tức thì          │
│    - Nút 2: [+ Thêm giỏ] -> Cập nhật giỏ + Toast nhẹ, không bung Drawer │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Giỏ Hàng (Cart Drawer) Tinh Giản:                                   │
│    - Hiển thị danh sách khóa học kèm nút Xóa (✕)                       │
│    - Khóa học số: Giữ cố định qty = 1                                  │
│    - Nút [Thanh toán ngay (Tổng tiền)]                                 │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Modal Thanh Toán (Checkout Modal):                                  │
│    - Tóm tắt đơn hàng (Danh sách món + Tổng tiền)                      │
│    - Form nhận link: Email Google Drive (Bắt buộc) + Họ tên (Tùy chọn) │
│    - Khách đã login: Tự điền + Badge "Đã đăng nhập"                    │
│    - Khách vãng lai: Nhập email nhanh, có link "Đăng nhập nếu có nick" │
│    - Nút: [Tạo mã QR thanh toán]                                       │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Màn hình VietQR & Zero-Touch Delivery:                              │
│    - Mã VietQR động + Thông tin MB Bank + Nội dung chuyển khoản        │
│    - Auto-polling 3s -> Nhận tiền -> Hiện nút [Mở Google Drive Học ↗]  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation Tasks

### Task 1: Nới lỏng ràng buộc số điện thoại trên Backend (`routes/orders.js`) (10 phút)
- **File:** `routes/orders.js`
- **Mục tiêu:** Chuyển `customer_phone` thành trường không bắt buộc (optional) khi tạo đơn hàng. Nếu khách có nhập thì kiểm tra regex, nếu không nhập thì lưu chuỗi rỗng `''`.
- **Code thay đổi cụ thể:**
```js
  // Validate: Bắt buộc Tên và Email hợp lệ
  if (!customer_name || !customer_name.trim())
    return res.status(400).json({ error: 'Vui lòng nhập họ và tên' });
  if (!customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim()))
    return res.status(400).json({ error: 'Email Google nhận tài liệu không hợp lệ' });
  
  // Phone là tùy chọn, nếu nhập thì mới kiểm tra format
  if (customer_phone && customer_phone.trim() && !/^0\d{9,10}$/.test(customer_phone.trim()))
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ (bắt đầu 0, 10-11 số)' });
  
  const cleanPhone = customer_phone ? sanitize(customer_phone.trim()) : '';
```
- **Lệnh kiểm tra:** Chạy `node scripts/test_digital_courses_fulfillment.js` để đảm bảo đơn hàng không gửi phone vẫn được chấp nhận.

---

### Task 2: Nâng cấp Nút Mua trên Thẻ Sản phẩm & Quick View (`public/index.html`) (15 phút)
- **File:** `public/index.html`
- **Mục tiêu:**
  - Trên mỗi thẻ sản phẩm (`product-card`): Thay thế 1 nút `+ Hốt liền` bằng cụm 2 nút hành động tối giản:
    1. Nút chính: `⚡ Mua ngay` (gọi hàm `buyNow(productId)` -> mở thẳng checkout modal).
    2. Nút phụ: Biểu tượng giỏ hàng `+` (gọi `addToCart(productId, false)` -> chỉ tăng badge và hiện toast `Đã thêm vào giỏ`, KHÔNG bung drawer phiền toái).
  - Trong Modal Quick View:
    - Bỏ stepper `[-] 1 [+]` đối với sản phẩm số (khóa học).
    - Thêm nút `⚡ Mua ngay` bên cạnh nút `+ Thêm vào giỏ`.
- **Code mẫu:**
```html
<div class="card-action-btns" style="display:flex; align-items:center; gap:0.4rem;">
  <button class="btn-buy-now" onclick="buyNow(${p.id})">⚡ Mua ngay</button>
  <button class="btn-add-cart-icon" onclick="addToCart(${p.id}, false)" title="Thêm vào giỏ hàng">
    <svg class="ui-icon" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
  </button>
</div>
```

---

### Task 3: Tinh Chỉnh Giỏ Hàng Thông Minh (Cart Drawer) (`public/index.html`) (20 phút)
- **File:** `public/index.html`
- **Mục tiêu:**
  - Với sản phẩm khóa học số (`is_digital = 1`):
    - Khóa số lượng ở mức 1 (`qty = 1`).
    - Thay thế bộ tăng giảm `[-] 1 [+]` bằng nhãn `1 bản số` kèm nút Xóa `✕` màu xám tinh tế.
  - Thêm nút "Xóa tất cả giỏ hàng" nhỏ gọn khi giỏ có từ 2 món trở lên.
  - Cập nhật thông báo Empty State: *"Giỏ hàng đang trống. Chọn tài liệu hoặc khóa học để bắt đầu học ngay!"*
  - Khi bấm `Tiến hành thanh toán →`: Không điều hướng sang trang login nữa, mà mở trực tiếp Modal Checkout chung cho cả khách thành viên và khách vãng lai.

---

### Task 4: Thiết Kế Lại Modal Checkout Tối Giản & Siêu Tốc (`public/index.html`) (25 phút)
- **File:** `public/index.html`
- **Mục tiêu:** Tái thiết kế `#modal-backdrop` thành giao diện chốt đơn hiện đại gồm 2 phần:
  1. **Bảng tóm tắt đơn hàng (Mini Summary):**
     - Liệt kê các khóa học đang mua kèm giá tiền.
     - Dòng tổng cộng to, rõ ràng (`var(--black)`, `1.25rem`, bold).
  2. **Khu vực Thông tin Nhận Tài liệu:**
     - **Nếu đã đăng nhập:**
       - Hiển thị thẻ thông tin gọn gàng: *"Khách hàng: [Họ tên] • Email: [email]"*.
       - Kèm checkbox hoặc ô phụ: *"Gửi vào email Google khác (nếu cần)"*.
     - **Nếu là khách vãng lai (Chưa đăng nhập):**
       - Trường 1: **Email Google Drive nhận tài liệu** (Bắt buộc, placeholder: `ban@gmail.com`).
       - Trường 2: **Họ và tên của bạn** (Tùy chọn, mặc định: "Học viên JetJet").
       - Không còn trường số điện thoại bắt buộc.
       - Dòng text nhỏ: *"Đã có tài khoản? [Đăng nhập lẹ ↗] để lưu vào Dashboard."*
  3. **Nút Chốt đơn:**
     - Nút to, đen tuyền: `Tiến hành thanh toán VietQR →`.

---

### Task 5: Hoàn Thiện Màn Hình VietQR & Bàn Giao Tức Thì (`public/index.html`) (15 phút)
- **File:** `public/index.html`
- **Mục tiêu:**
  - Khi submit checkout:
    - Tạo đơn qua `POST /api/orders`.
    - Sinh mã QR VietQR (`https://img.vietqr.io/image/MB-241620968888-compact2.png?amount=...&addInfo=...`).
    - Hiển thị bảng chi tiết chuyển khoản rõ ràng kèm nút sao chép nhanh số tài khoản và nội dung CK.
  - Khi thanh toán thành công (Webhook Casso đẩy về):
    - Đổi trạng thái modal sang ăn mừng nhẹ nhàng.
    - Hiển thị ngay nút lớn màu đen: `🚀 Mở Google Drive Học Ngay ↗`.
    - Hiển thị hộp text hướng dẫn học tập và liên hệ hỗ trợ.

---

## Tests & Validation Plan (TDD)

### 1. Backend Automation Tests:
Cập nhật hoặc viết script kiểm thử mới: `scripts/test_streamlined_checkout.js`
- **Test 1:** Tạo đơn hàng thành công khi KHÔNG truyền `customer_phone` (đảm bảo tính linh hoạt cho sản phẩm số).
- **Test 2:** Tạo đơn hàng qua hàm mua ngay (1 sản phẩm) và qua giỏ hàng (nhiều sản phẩm).
- **Test 3:** Giả lập thanh toán Casso -> Đơn hàng tự động `completed` và trả về link Google Drive chuẩn xác.

**Lệnh chạy:**
```bash
node scripts/test_streamlined_checkout.js
npm run test:webhook
node scripts/test_user_otp_flow.js
node scripts/test_complete_features_flow.js
node scripts/test_digital_courses_fulfillment.js
```
*Kỳ vọng:* Toàn bộ 5 test suites đều exit code 0 (PASS 100%).

### 2. Browser Visual & User Journey QA:
Sử dụng `browser_exec` và `vision_analyze`:
1. Mở trang chủ: Kiểm tra mỗi thẻ sản phẩm có đủ nút `⚡ Mua ngay` và icon `+` thêm giỏ.
2. Bấm icon `+`: Badge giỏ hàng tăng lên `1`, xuất hiện toast thông báo, drawer không tự bung.
3. Bấm `⚡ Mua ngay`: Modal checkout mở ra ngay lập tức với đúng sản phẩm đó.
4. Mở Cart Drawer: Sản phẩm số hiển thị cố định số lượng 1, có nút xóa `✕`.
5. Checkout với tư cách khách vãng lai: Chỉ cần nhập email Google là bấm tạo mã VietQR thành công.

---

## Risks, Tradeoffs & Open Questions

1. **Email Google Drive không chính xác:**
   - Cần thêm dòng chú thích nhỏ dưới ô Email: *"Vui lòng nhập chính xác Gmail để được cấp quyền mở thư mục Google Drive."*
2. **Khách vô tình bấm Mua Ngay khi đang có hàng trong giỏ:**
   - Logic `buyNow(productId)`: Tạo đơn trực tiếp cho riêng sản phẩm đó mà không làm mất các món đang lưu trong giỏ hàng hiện tại của khách.
