# JetJet Store — Bổ Sung Hoàn Chỉnh Các Chức Năng Còn Thiếu (Plan v1)

## Goal
Bổ sung toàn diện 6 chức năng kinh doanh cốt lõi còn thiếu cho JetJet Store: Bàn giao thông tin tài khoản số (Digital Account Fulfillment), Tìm kiếm & Sắp xếp sản phẩm, Xem chi tiết sản phẩm (Quick View Modal), Tự động kiểm tra thanh toán thời gian thực (Auto-polling QR), Khách tự hủy đơn hàng chưa thanh toán, và Chính sách bảo hành & FAQ.

---

## Current Context & Assumptions

### Hiện trạng hệ thống:
1. **Bàn giao tài khoản:** Bảng `orders` hiện chỉ có trạng thái `completed`. Admin bấm "Giao tài khoản" chỉ đổi trạng thái sang `completed`, không có trường lưu thông tin tài khoản giao cho khách (`delivery_data`). Khách hàng tra cứu đơn chỉ thấy chữ "Đã giao acc" mà không nhận được email/mật khẩu tài khoản đã mua.
2. **Khám phá sản phẩm:** Hiện chỉ có bộ lọc danh mục (`filter-chip`), thiếu thanh tìm kiếm theo từ khóa (live search) và bộ chọn sắp xếp theo giá/độ phổ biến.
3. **Trải nghiệm mua hàng:** Khách bấm thẻ sản phẩm chỉ có nút "+ Hốt liền", không có modal xem chi tiết hướng dẫn sử dụng, điều khoản bảo hành riêng cho từng con AI.
4. **Thanh toán VietQR:** Khách quét QR xong phải tự đóng modal hoặc chờ thủ công; thiếu cơ chế tự động thăm dò (auto-poll) để chuyển sang màn hình "Thanh toán thành công" ngay khi Casso webhook khớp tiền.
5. **Hủy đơn:** Chỉ Admin mới hủy được đơn. Khách đặt nhầm đơn `pending` không thể tự hủy để giải phóng tồn kho.
6. **Môi trường:** MySQL (`jetjet_store`), Node.js Express 5, port 3000, macOS arm64.

---

## Architecture & Proposed Approach

```
┌────────────────────────────────────────────────────────────────────────┐
│                          public/index.html                             │
│  - Thanh tìm kiếm live search + Dropdown sắp xếp giá                   │
│  - Modal xem chi tiết sản phẩm (Quick View & Policy)                   │
│  - Modal QR có Countdown 15 phút + Auto-poll kiểm tra trạng thái       │
│  - Modal "Đơn hàng của tôi": Hiển thị tài khoản đã nhận + nút Hủy đơn  │
│  - Modal Chính sách bảo hành & FAQ ở footer                            │
└────────────────┬───────────────────────────────────────┬───────────────┘
                 │                                       │
                 ▼ /api/orders/*                         ▼ /api/admin/*
┌───────────────────────────────────────┐ ┌─────────────────────────────┐
│           routes/orders.js            │ │       routes/admin.js       │
│  - GET /orders/:code (kèm delivery)   │ │  - PATCH /orders/:id/deliver│
│  - POST /orders/:code/cancel (tự hủy) │ │    (nhập email/pass giao)   │
│  - GET /orders/:code/check-status     │ │  - Polling đơn mới realtime │
└────────────────┬──────────────────────┘ └──────────────┬──────────────┘
                 │                                       │
                 └───────────────┬───────────────────────┘
                                 ▼
                 ┌──────────────────────────────┐
                 │        MySQL Database        │
                 │  - orders.delivery_data      │
                 │  - orders.delivered_at       │
                 └──────────────────────────────┘
```

---

## Step-by-Step Tasks

### Phase 1: Database Migration — Bổ Sung Trường Bàn Giao Tài Khoản (10 phút)

#### Task 1.1: Tạo migration script
- **File:** `migrations/add_delivery_data_to_orders.sql`
- **Mục tiêu:** Thêm 2 cột vào bảng `orders`:
  - `delivery_data TEXT NULL`: Nội dung bàn giao tài khoản (Email, Mật khẩu, Link kích hoạt, Lưu ý đăng nhập).
  - `delivered_at TIMESTAMP NULL`: Thời điểm bàn giao.

**Nội dung `migrations/add_delivery_data_to_orders.sql`:**
```sql
USE jetjet_store;

SET @exist_delivery := (SELECT COUNT(*) FROM information_schema.COLUMNS 
                        WHERE TABLE_SCHEMA = 'jetjet_store' 
                          AND TABLE_NAME = 'orders' 
                          AND COLUMN_NAME = 'delivery_data');

SET @query_delivery := IF(@exist_delivery = 0,
    'ALTER TABLE orders ADD COLUMN delivery_data TEXT NULL AFTER status, ADD COLUMN delivered_at TIMESTAMP NULL AFTER delivery_data;',
    'SELECT "Columns delivery_data and delivered_at already exist"');

PREPARE stmt FROM @query_delivery;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

**Lệnh thực thi & kiểm tra:**
```bash
mysql -u root -p123456 < migrations/add_delivery_data_to_orders.sql
mysql -u root -p123456 jetjet_store -e "SHOW COLUMNS FROM orders LIKE 'delivery%';"
```
*Kỳ vọng:* Cột `delivery_data` (text) và `delivered_at` (timestamp) xuất hiện trong bảng `orders`.

---

### Phase 2: Backend APIs — Bàn Giao Tài Khoản, Tự Hủy Đơn & Check Status (30 phút)

#### Task 2.1: Bổ sung API bàn giao tài khoản số cho Admin
- **File:** `routes/admin.js`
- **Mục tiêu:** Endpoint `PATCH /api/admin/orders/:id/deliver` nhận `{ delivery_data }`, lưu vào DB, cập nhật `status = 'completed'` và `delivered_at = NOW()`.

**Đoạn code bổ sung trong `routes/admin.js`:**
```js
// PATCH /api/admin/orders/:id/deliver — Bàn giao tài khoản/license cho khách
router.patch('/orders/:id/deliver', requireAdmin, async (req, res) => {
  const { delivery_data } = req.body;
  if (!delivery_data || !delivery_data.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập thông tin tài khoản hoặc license bàn giao cho khách!' });
  }

  try {
    const [result] = await db.execute(
      `UPDATE orders SET status = 'completed', delivery_data = ?, delivered_at = NOW() WHERE id = ?`,
      [delivery_data.trim(), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    res.json({ success: true, message: 'Đã bàn giao tài khoản thành công cho khách!' });
  } catch (err) {
    console.error('Deliver order error:', err);
    res.status(500).json({ error: 'Lỗi server khi bàn giao tài khoản' });
  }
});
```

---

#### Task 2.2: Cập nhật API lấy chi tiết đơn hàng cho khách (kèm delivery_data nếu completed)
- **File:** `routes/orders.js`
- **Mục tiêu:**
  1. Trong `GET /api/orders/:code`: Bổ sung trả về trường `delivery_data` và `delivered_at` khi `status === 'completed'`.
  2. Trong `GET /api/user/orders`: Bổ sung trả về `delivery_data` và `delivered_at`.
  3. Thêm endpoint `GET /api/orders/:code/status`: Trả về trạng thái nhanh (phục vụ auto-polling màn hình thanh toán).
  4. Thêm endpoint `POST /api/orders/:code/cancel`: Cho phép khách hàng tự hủy đơn hàng khi đơn còn ở trạng thái `pending`.

**Đoạn code bổ sung trong `routes/orders.js`:**
```js
// GET /api/orders/:code/status — Thăm dò nhanh trạng thái thanh toán (polling)
router.get('/orders/:code/status', async (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const [rows] = await db.execute('SELECT status, payment_confirmed_at FROM orders WHERE order_code = ?', [code]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    res.json({ status: rows[0].status, paid: ['paid', 'processing', 'completed'].includes(rows[0].status) });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// POST /api/orders/:code/cancel — Khách hàng tự hủy đơn pending
router.post('/orders/:code/cancel', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id, status, user_id FROM orders WHERE order_code = ? FOR UPDATE',
      [code]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const order = rows[0];
    if (order.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ error: 'Chỉ có thể hủy đơn hàng khi đang ở trạng thái Chờ thanh toán!' });
    }

    // Nếu đơn thuộc về user đăng nhập, kiểm tra đúng chủ sở hữu
    if (order.user_id && (!req.session || req.session.userId !== order.user_id)) {
      await conn.rollback();
      return res.status(403).json({ error: 'Bạn không có quyền hủy đơn hàng này!' });
    }

    // Hoàn lại stock
    const [items] = await conn.execute('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      if (item.product_id) {
        await conn.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }

    await conn.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
    await conn.commit();

    res.json({ success: true, message: 'Đã hủy đơn hàng thành công, số lượng tồn kho đã được hoàn lại!' });
  } catch (err) {
    await conn.rollback();
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Lỗi server khi hủy đơn' });
  } finally {
    conn.release();
  }
});
```

---

### Phase 3: Frontend Storefront (`public/index.html`) (45 phút)

#### Task 3.1: Thanh Tìm Kiếm Trực Tiếp (Live Search) & Sắp Xếp Sản Phẩm (Sorting)
- **File:** `public/index.html`
- **Giao diện:**
  - Ngay dưới thanh danh mục (category chips): Thêm hàng công cụ:
    - Input Search: `<input type="text" id="search-input" placeholder="Tìm kiếm AI (ChatGPT, Claude, Cursor, Canva...)" />` kèm icon kính lúp.
    - Select Sort: `<select id="sort-select">` với các tùy chọn:
      - `default`: Phổ biến nhất (Mặc định)
      - `price-asc`: Giá: Thấp đến cao
      - `price-desc`: Giá: Cao đến thấp
      - `name-asc`: Tên A - Z
- **Logic JS:**
  - Tạo hàm `filterAndSortProducts()` kết hợp: Danh mục đang chọn + Từ khóa tìm kiếm + Tiêu chí sắp xếp -> gọi `render(filteredList)`.

---

#### Task 3.2: Modal Xem Chi Tiết Sản Phẩm (Product Quick View Modal)
- **File:** `public/index.html`
- **Giao diện `#product-detail-modal`:**
  - Bấm vào tên, ảnh hoặc mô tả sản phẩm (ngoại trừ nút "+ Hốt liền") sẽ mở modal chi tiết:
    - Hình ảnh lớn, huy hiệu nổi bật, tên đầy đủ, danh mục, giá tiền & thời hạn.
    - Thông tin chi tiết: Mô tả sản phẩm, danh sách tính năng đầy đủ.
    - **Chính sách bảo hành & Hướng dẫn sử dụng:**
      - Hướng dẫn nhận tài khoản (qua email/web).
      - Cam kết 1 đổi 1 trong suốt thời gian bảo hành.
      - Lưu ý kỹ thuật (không đổi mật khẩu nếu là tài khoản cấp sẵn, đăng nhập đúng thiết bị).
    - Bộ chọn số lượng `[-] [1] [+]` và nút `+ Thêm vào giỏ hàng`.

---

#### Task 3.3: Hiển Thị Thông Tin Tài Khoản Bàn Giao & Nút Copy 1-Chạm
- **File:** `public/index.html`
- **Nơi hiển thị:**
  1. Trong modal **"Tra cứu đơn hàng"** (`#track-modal`).
  2. Trong modal **"Đơn hàng của tôi"** (`#my-orders-modal`).
- **Nội dung hiển thị:**
  - Khi đơn hàng có `status === 'completed'` và `delivery_data`:
    - Khối nổi bật màu xanh lá (`#f0fdf4`, viền `#bbf7d0`):
      - Tiêu đề: `Thông tin tài khoản bàn giao:`
      - Nội dung tài khoản: hiển thị trong thẻ `<pre>` hoặc `<code>` dễ đọc.
      - Nút bấm: `<button class="btn-copy">📋 Sao chép tài khoản</button>` (bấm vào copy ngay vào clipboard, hiện toast "Đã sao chép!").
  - Nếu đơn hàng còn `pending`: Hiển thị nút `✕ Hủy đơn hàng này` gọi `POST /api/orders/:code/cancel`.

---

#### Task 3.4: Tự Động Kiểm Tra Thanh Toán QR Code (Auto-Polling & Success Screen)
- **File:** `public/index.html`
- **Cơ chế:**
  - Khi tạo đơn hàng thành công và mở màn hình QR VietQR:
    - Hiển thị đồng hồ đếm ngược thanh toán (15:00 phút).
    - Kích hoạt vòng lặp `setInterval` mỗi 4 giây gọi `GET /api/orders/${orderCode}/status`.
    - Khi nhận được `{ paid: true }`:
      - Dừng interval polling.
      - Tự động chuyển màn hình QR sang giao diện:
        `🎉 ĐÃ NHẬN ĐƯỢC TIỀN THANH TOÁN!`
        `Thằng Phúc đang chuẩn bị tài khoản và sẽ gửi ngay cho quý dzị trong ít phút!`
      - Kèm nút bấm "Xem trạng thái đơn hàng ngay".

---

#### Task 3.5: Modal Chính Sách Bảo Hành & Câu Hỏi Thường Gặp (FAQ)
- **File:** `public/index.html`
- **Giao diện `#faq-modal`:**
  - Link kích hoạt ở footer: `Chính sách bảo hành & FAQ`.
  - Các mục câu hỏi thường gặp:
    1. *Bảo hành 1 đổi 1 như thế nào?* -> Cam kết đổi tài khoản mới hoặc hoàn tiền tương ứng thời gian chưa sử dụng nếu lỗi do hệ thống.
    2. *Bao lâu thì nhận được tài khoản sau khi chuyển khoản?* -> Từ 2 - 15 phút.
    3. *Tài khoản dùng chung hay dùng riêng chính chủ?* -> Nêu rõ từng loại sản phẩm.
    4. *Cần hỗ trợ gấp thì liên hệ ai?* -> Hotline Zalo: `0912345678` (Nguyễn Song Hoàng Phúc).

---

### Phase 4: Frontend Admin Dashboard (`public/admin.html`) (30 phút)

#### Task 4.1: Modal Bàn Giao Tài Khoản Cho Khách Khi Đổi Sang Completed
- **File:** `public/admin.html`
- **Cơ chế:**
  - Trong danh sách đơn hàng, khi Admin bấm nút "Giao tài khoản":
    - Mở modal `#modal-deliver-account`:
      - Hiển thị tên khách, mã đơn, danh sách các món mua.
      - Ô nhập textarea: Thông tin tài khoản/license key bàn giao (có các nút gợi ý mẫu: "Mẫu ChatGPT", "Mẫu Gemini", "Mẫu Cursor").
      - Nút "Xác nhận gửi tài khoản & Hoàn tất đơn" gọi `PATCH /api/admin/orders/:id/deliver`.
  - Đơn hàng đã bàn giao hiển thị trường `delivery_data` ngay trên thẻ đơn hàng để Admin tiện đối soát lại khi cần bảo hành.

---

#### Task 4.2: Tự Động Làm Mới Đơn Hàng & Chuông Cảnh Báo Đơn Mới (Real-Time Polling)
- **File:** `public/admin.html`
- **Cơ chế:**
  - Tự động chạy polling mỗi 20 giây gọi `loadOrders(currentFilter, false)`.
  - Nếu phát hiện có đơn hàng mới chuyển sang trạng thái `paid`:
    - Hiển thị notification toast góc dưới màn hình: `"🔔 Đơn hàng mới thanh toán: [Mã đơn] - [Số tiền]đ"`.
    - Cập nhật số badge trên tab "Đơn hàng" để Admin biết ngay mà không cần tải lại trang.

---

## Tests & Validation Plan (TDD)

Tạo test script tự động: `scripts/test_complete_features_flow.js`

### Kịch bản kiểm thử:
1. **Test 1: Search & Sort API / Client logic:**
   - Kiểm tra lọc sản phẩm theo từ khóa "ChatGPT" -> trả về đúng sản phẩm ChatGPT.
   - Kiểm tra sắp xếp theo giá tăng dần -> sản phẩm giá rẻ nhất (Link Gemini 50k) đứng đầu.
2. **Test 2: Auto-poll Status API:**
   - Tạo đơn test -> gọi `GET /api/orders/:code/status` -> trả về `{ status: 'pending', paid: false }`.
   - Giả lập thanh toán qua Casso webhook -> gọi lại API status -> trả về `{ status: 'paid', paid: true }`.
3. **Test 3: Customer Cancel Pending Order:**
   - Tạo 1 đơn mới với sản phẩm ID 1 (số lượng 2).
   - Kiểm tra tồn kho trước khi hủy.
   - Gửi `POST /api/orders/:code/cancel` -> trả về `success: true`.
   - Kiểm tra tồn kho sản phẩm ID 1 -> đã được cộng bù lại 2.
   - Thử hủy lại lần 2 -> báo lỗi 400 (vì đơn đã hủy rồi).
4. **Test 4: Admin Digital Delivery:**
   - Admin gửi `PATCH /api/admin/orders/:id/deliver` với `delivery_data: 'Email: test@ai.com | Pass: 123456'`.
   - Kiểm tra trong DB: `status = 'completed'` và `delivery_data` đã được lưu.
   - Gọi `GET /api/orders/:code` -> trả về đầy đủ `delivery_data` cho khách.

**Lệnh chạy kiểm thử:**
```bash
node scripts/test_complete_features_flow.js
```

---

## Risks, Tradeoffs & Open Questions

1. **Bảo mật dữ liệu bàn giao tài khoản (`delivery_data`):**
   - *Rủi ro:* Thông tin mật khẩu tài khoản lưu trong database.
   - *Biện pháp:* Chỉ gửi `delivery_data` qua API khi đơn đã `completed`. Với API tra cứu công khai, yêu cầu đúng mã đơn `JJxxxxxxxx` (mỗi mã gồm 10 ký tự ngẫu nhiên khó đoán).
2. **Auto-polling trên Storefront:**
   - *Rủi ro:* Nhiều khách mở màn hình QR cùng lúc gây tải server nếu poll quá dày.
   - *Biện pháp:* Chu kỳ poll đặt là 4-5 giây/lần và tự động ngắt sau 15 phút (timeout) hoặc khi khách đóng modal.
3. **Gửi tài khoản tự động hoàn toàn (Auto-delivery từ kho key có sẵn):**
   - *Tradeoff:* Hiện tại mỗi tài khoản có thể là tài khoản cấp sẵn hoặc link mời chính chủ cần thao tác linh hoạt. Giao diện modal nhập tài khoản cho Admin mang tính linh động cao nhất (hỗ trợ cả link, acc riêng, acc share, key). Sau này nếu muốn tự động 100% có thể bổ sung thêm kho Key pool sau.

---

## File Tree Changes Summary

| File | Hành động | Mô tả |
|------|-----------|-------|
| `migrations/add_delivery_data_to_orders.sql` | **TẠO MỚI** | Thêm cột `delivery_data` và `delivered_at` vào bảng `orders` |
| `routes/orders.js` | **CẬP NHẬT** | Thêm endpoint `status`, `cancel` đơn, trả về `delivery_data` |
| `routes/admin.js` | **CẬP NHẬT** | Thêm endpoint `deliver` bàn giao tài khoản |
| `public/index.html` | **CẬP NHẬT** | Live Search, Sort, Quick View Modal, Bàn giao tài khoản & copy, Auto-polling QR, FAQ Modal |
| `public/admin.html` | **CẬP NHẬT** | Modal bàn giao tài khoản, Polling & Toast đơn mới |
| `scripts/test_complete_features_flow.js` | **TẠO MỚI** | Kịch bản kiểm thử tự động toàn bộ 4 chu trình tính năng mới |
