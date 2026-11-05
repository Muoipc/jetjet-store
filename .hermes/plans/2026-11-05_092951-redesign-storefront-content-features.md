# Kế Hoạch Tái Thiết Kế Nội Dung & Tinh Chỉnh Chức Năng Cửa Hàng Số JetJet (Plan)

## Goal
Tái thiết kế toàn bộ nội dung (copywriting), quy trình hướng dẫn, chính sách hỗ trợ và tinh chỉnh các tính năng (Quick View, Checkout, Lịch sử đơn hàng, Mở link Drive 1-chạm) trên website JetJet Store cho phù hợp 100% với mô hình kinh doanh Khóa học & Sản phẩm số, đồng thời giữ vững phong cách giao diện tối giản hiện đại (Minimalist UI).

---

## Current Context & Assumptions

### 1. Hiện trạng:
- Đã chuyển đổi hoàn toàn danh mục sang 7 sản phẩm số và combo (Prompt AI, Python Automation, 36 Kế kinh doanh, Marketing quán nhỏ, Kho báu VIP, Combo ChatGPT Plus, Combo Cursor Pro).
- Đã hoàn thành cơ chế bàn giao tự động Zero-Touch qua Webhook Casso.
- **Vấn đề còn tồn đọng về mặt nội dung & trải nghiệm:**
  - Tagline thương hiệu trên header vẫn là `Tiệm AI Miền Tây`.
  - Hộp thông tin trong Modal Quick View (`#product-detail-modal`) và Modal FAQ (`#faq-modal`) vẫn nói về "bảo hành tài khoản AI 1 đổi 1", "mất gói Pro do nhà mạng".
  - Màn hình thanh toán VietQR (`#checkout-modal`) vẫn ghi "Admin cấp tài khoản trong 5-15 phút" thay vì nhấn mạnh "Nhận link Drive tự động tức thì".
  - Trong Modal Đơn hàng của tôi (`#orders-history-modal`), link bàn giao vẫn hiển thị dạng chuỗi text thô trong ô xám, chưa có nút bấm "Mở Google Drive ↗" trực quan 1-chạm.

### 2. Định hướng phong cách (Style Constraints):
- Giữ nguyên bộ nhận diện tối giản: Gam màu đen - trắng - xám thanh lịch, bo góc nhẹ (`var(--radius-sm)`), icon SVG nét đơn (`.ui-icon`), không dùng icon lòe loẹt hay emoji rườm rà.
- Giữ giọng văn thân thiện, tin cậy, mộc mạc đặc trưng của kỹ sư HCMUTE nhưng chuẩn mực thương mại số.

---

## Architecture & Proposed Approach

```
┌────────────────────────────────────────────────────────────────────────┐
│                        public/index.html                               │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Header & Hero:                                                      │
│    - Brand Tag: "Kho Tri Thức & Tài Liệu Số"                           │
│    - Cam kết: "Tự động gửi link Google Drive tức thì sau 3 giây"        │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Modal Quick View (Xem Chi Tiết):                                    │
│    - Bổ sung Badge & Hộp thông tin động:                              │
│      + Sản phẩm số: [⚡ Tự động gửi link Google Drive trọn đời]       │
│      + Combo: [🎁 Giao link khóa học ngay + Bàn giao tài khoản AI]     │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Modal Thanh Toán & VietQR:                                          │
│    - Thông điệp chuyển khoản: Tự động hoàn tất & hiện link tại chỗ     │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Modal Đơn Hàng Của Tôi & Trang Cá Nhân:                             │
│    - Bóc tách link Google Drive từ delivery_data                       │
│    - Thêm nút hành động: [🚀 Mở Google Drive Học Ngay ↗]               │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Modal FAQ & Chính Sách Khóa Học:                                    │
│    - Đổi sang: Chính sách bảo lưu link trọn đời, hỗ trợ giải đáp 1:1,  │
│      hướng dẫn tải source code và cập nhật tài liệu miễn phí.          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation Tasks

### Task 1: Cập nhật Brand Tagline & Header (`public/index.html`) (5 phút)
- **File:** `public/index.html`
- **Mục tiêu:** Cập nhật nhãn phụ thương hiệu và tiêu đề trang cho đúng định vị "Kho Tri Thức Số".
- **Thay đổi cụ thể:**
  - Thẻ `<title>`: `Kho Khóa Học & Tài Liệu Số JetJet — Tự Động Giao Link Drive`
  - `.brand-tag`: Đổi từ `Tiệm AI Miền Tây` thành `Kho Tri Thức & Khóa Học Số`.
- **Xác minh:** Kiểm tra header trang chủ hiển thị đúng nhãn mới.

---

### Task 2: Tinh chỉnh Modal Quick View theo loại sản phẩm (`public/index.html`) (15 phút)
- **File:** `public/index.html`
- **Mục tiêu:** Cập nhật hàm `openProductDetail(id)` để hiển thị hộp cam kết phù hợp từng loại sản phẩm:
  - Nếu là **Khóa học & Tài liệu số**:
    - Hiển thị hộp cam kết màu xanh lá nhẹ:
      - `⚡ Bàn giao tự động tức thì`: Link Google Drive hiển thị ngay trên màn hình và gửi qua email.
      - `🛡️ Quyền truy cập trọn đời`: Tải tài liệu, video và mã nguồn không giới hạn.
      - `🔄 Cập nhật miễn phí`: Tự động nhận các bài giảng, tài liệu bổ sung mới.
  - Nếu là **Combo AI + Khóa học**:
    - Hiển thị cam kết song hành:
      - `⚡ Khóa học`: Giao link Drive ngay khi thanh toán thành công.
      - `🛡️ Tài khoản AI`: Bảo hành 1 đổi 1 trong 30 ngày, kích hoạt trong 5-15 phút.
- **Code mẫu tinh chỉnh:**
```js
const isCourse = p.category === 'Khóa học & Tài liệu số' || p.is_digital;
const isCombo = p.category === 'Combo AI + Khóa học';

let guaranteeHtml = '';
if (isCourse) {
  guaranteeHtml = `
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius-sm); padding:0.9rem 1rem; font-size:0.8125rem; color:#166534; line-height:1.55;">
      <div style="font-weight:700; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem;">
        <svg class="ui-icon" style="width:1rem;height:1rem;stroke:#166534;" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Cam kết chất lượng & Bàn giao tài liệu:</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.3rem;">
        <div>• <strong>Nhận link Google Drive tức thì</strong> ngay sau khi thanh toán thành công.</div>
        <div>• <strong>Sở hữu và truy cập vĩnh viễn</strong>, tải video & tài liệu học tập không giới hạn.</div>
        <div>• <strong>Cập nhật bài giảng & source code</strong> miễn phí trọn đời khi có phiên bản mới.</div>
      </div>
    </div>`;
} else if (isCombo) {
  guaranteeHtml = `
    <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:var(--radius-sm); padding:0.9rem 1rem; font-size:0.8125rem; color:#c2410c; line-height:1.55;">
      <div style="font-weight:700; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem;">
        <svg class="ui-icon" style="width:1rem;height:1rem;stroke:#c2410c;" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Đặc quyền Gói Combo Siêu Tiết Kiệm:</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.3rem;">
        <div>• <strong>Khóa học & Tài liệu số:</strong> Nhận link Google Drive tức thì sau khi quét mã.</div>
        <div>• <strong>Tài khoản AI chính chủ:</strong> Admin kích hoạt và gửi thông tin đăng nhập trong 5-15 phút.</div>
        <div>• <strong>Bảo hành 1 đổi 1:</strong> Cam kết bảo hành uy tín suốt thời hạn tài khoản.</div>
      </div>
    </div>`;
}
```

---

### Task 3: Tối ưu Trải nghiệm Mở Link Học 1-Chạm (`public/index.html`) (20 phút)
- **File:** `public/index.html`
- **Mục tiêu:** Trong modal tra cứu đơn hàng (`#tracking-result`) và modal lịch sử đơn hàng cá nhân (`#orders-history-modal`):
  - Khi đơn hàng có trạng thái `completed` hoặc có `delivery_data`:
    - Quét tìm đường dẫn `https://drive.google.com/...` trong nội dung bàn giao.
    - Render nút bấm to rõ, nổi bật:
      `<a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="btn-solid-black" style="display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none; margin-top:0.75rem;">🚀 Mở Thư Mục Google Drive Học Ngay ↗</a>`
    - Phía dưới giữ ô văn bản chi tiết hướng dẫn học tập và liên hệ hỗ trợ.
- **Xác minh:** Kiểm tra tra cứu đơn hàng khóa học đã hoàn tất có xuất hiện nút mở Google Drive trực tiếp.

---

### Task 4: Viết lại Modal Chính Sách & FAQ Phù Hợp Sản Phẩm Số (`public/index.html`) (15 phút)
- **File:** `public/index.html`
- **Mục tiêu:** Thay thế toàn bộ nội dung cũ của modal FAQ (`#faq-modal`):
  - **Mục 1: Nhận tài liệu học tập như thế nào?**
    - Trả lời: Hệ thống quét mã VietQR tự động 24/7. Ngay khi chuyển khoản thành công, link Google Drive sẽ hiện trực tiếp trên màn hình và gửi qua email.
  - **Mục 2: Thời hạn truy cập và tải file?**
    - Trả lời: Sở hữu vĩnh viễn (Trọn đời). Bạn có thể xem trực tuyến trên điện thoại, máy tính bảng hoặc tải toàn bộ video/source code về máy.
  - **Mục 3: Có được cập nhật khi có bài giảng mới không?**
    - Trả lời: Có. Toàn bộ tài liệu bổ sung, fix bug code hoặc prompt mới sẽ được cập nhật thẳng vào thư mục Google Drive bạn đã nhận mà không tính thêm phí.
  - **Mục 4: Gói Combo hoạt động ra sao?**
    - Trả lời: Bạn nhận link học ngay lập tức, phần tài khoản AI (ChatGPT Plus/Cursor) sẽ được gửi riêng qua email và hiển thị trong đơn hàng trong 5-15 phút.
  - **Mục 5: Kênh giải đáp thắc mắc và hỗ trợ kỹ thuật?**
    - Trả lời: Hỗ trợ trực tiếp từ Phúc qua Zalo: `0912345678` và Email: `hotro@jetjet.store`.
- **Xác minh:** Mở modal FAQ ở chân trang kiểm tra nội dung hiển thị sạch đẹp.

---

### Task 5: Tinh chỉnh Giao diện Checkout VietQR (`public/index.html`) (15 phút)
- **File:** `public/index.html`
- **Mục tiêu:**
  - Trên màn hình tạo đơn và mã QR:
    - Sửa dòng thông báo: *"Chuyển khoản đúng số tiền và nội dung. Hệ thống tự động kiểm tra và mở link tải tài liệu ngay sau 3 giây!"*
  - Khi auto-polling phát hiện đơn `completed` (thanh toán xong):
    - Đổi thông báo ăn mừng: *"🎉 Thanh toán thành công! Link khóa học của bạn đã sẵn sàng bên dưới."*
    - Hiển thị ngay nút *"Mở Google Drive Ngay ↗"* kèm nút sao chép link.

---

## Tests & Validation Plan

### 1. Automated Script Verification:
Chạy bộ test tổng hợp để đảm bảo không gãy logic backend:
```bash
npm run test:webhook && node scripts/test_user_otp_flow.js && node scripts/test_complete_features_flow.js && node scripts/test_digital_courses_fulfillment.js
```
*Kỳ vọng:* Toàn bộ 4 test suites đều exit code 0.

### 2. Browser Visual QA:
Sử dụng `browser_exec` và `vision_analyze` kiểm tra:
1. Header: Brand tag hiển thị `Kho Tri Thức & Khóa Học Số`.
2. Modal Quick View: Bấm vào 1 sản phẩm khóa học -> Hiển thị hộp cam kết bàn giao Drive trọn đời.
3. Modal FAQ: Bấm nút FAQ -> Hiển thị 5 câu hỏi đáp chuẩn mô hình khóa học số.
4. Tra cứu đơn: Nhập mã đơn đã thanh toán -> Hiển thị nút bấm `🚀 Mở Thư Mục Google Drive Học Ngay ↗`.

---

## Risks, Tradeoffs & Open Questions

1. **Tradeoff về quyền riêng tư Google Drive:**
   - Link trong nội dung demo hiện tại là các URL mẫu (`https://drive.google.com/drive/folders/vsuper-...`). Khi Phúc upload tư liệu thật lên Drive của mình, chỉ cần vào `admin.html` bấm sửa sản phẩm và dán link Drive thực tế vào ô `Nội dung tự động bàn giao`.
2. **Khách hàng chặn popup trình duyệt:**
   - Khi bấm nút `Mở Google Drive ↗`, dùng thuộc tính `target="_blank" rel="noopener noreferrer"` và luôn kèm nút sao chép link phụ phòng trường hợp trình duyệt chặn mở tab mới.
