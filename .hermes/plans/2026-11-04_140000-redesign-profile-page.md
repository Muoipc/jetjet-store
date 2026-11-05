# Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store

## Goal
Thiết kế lại giao diện và backend Hồ sơ cá nhân thành Trung tâm Tài khoản (Profile Center) hiện đại, tích hợp thẻ đại diện, số liệu mua sắm (tổng đơn, tổng chi tiêu), quản lý thông tin, đổi mật khẩu và xem nhanh đơn hàng trong cùng một giao diện chuẩn Sepia Minimalist.

---

## Current Context & Assumptions
- **Hiện tại:** Hồ sơ cá nhân nằm trong `#profile-modal` kích thước nhỏ (`max-width: 26rem`), chỉ có 3 ô input đơn điệu (Email, Tên, Ngày tạo) và một mục xóa tài khoản sơ sài.
- **Bất cập:**
  - Tính năng đổi mật khẩu đang nằm ở modal riêng lẻ (`#change-pw-modal`), khiến trải nghiệm phân mảnh.
  - Người dùng không xem được tổng quan tài khoản (tổng số đơn đã mua, tổng tiền đã chi).
  - Không có avatar đại diện hoặc monogram biểu tượng cá nhân.
- **Công nghệ:** Node.js, Express, MySQL (`jetjet_store`), HTML/CSS/JS thuần không dùng thư viện ngoài (Vanilla JS).
- **Màu sắc & UI:** Giữ nguyên chủ đề Sepia (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`), icon SVG nét mảnh chuẩn Lucide, hình khối vuông vắn (`var(--radius-sm)`).

---

## Architecture & Proposed Approach
- **Backend (`routes/auth.js`):** Nâng cấp endpoint `GET /api/auth/profile` để truy vấn thêm các chỉ số thống kê từ bảng `orders` (`total_orders`, `total_spent`, `pending_orders`, `recent_orders`), trả về kèm thông tin người dùng.
- **Frontend (`public/index.html`):** Thay thế `#profile-modal` cũ bằng giao diện Profile Center kích thước rộng (`max-width: 44rem`), bố cục gồm:
  1. **Thẻ Profile Header:** Monogram Avatar hai chữ cái đầu, họ tên, email có icon tích xanh `✓`.
  2. **Thanh thống kê (Stats Grid):** 3 thẻ số liệu (Tổng đơn hàng, Tổng chi tiêu, Đơn đang chờ xử lý).
  3. **Hệ thống Tab nội bộ:**
     - **Tab 1 — Thông tin cá nhân:** Xem email, sửa họ tên hiển thị.
     - **Tab 2 — Bảo mật & Đổi mật khẩu:** Tích hợp trực tiếp form đổi mật khẩu (MK cũ, MK mới, Xác nhận) vào trong cùng modal, loại bỏ sự phụ thuộc vào modal rời.
     - **Tab 3 — Đơn hàng gần đây:** Danh sách 3 đơn hàng mới nhất kèm trạng thái và nút chuyển nhanh sang modal "Đơn của tôi".
     - **Tab 4 — Quản lý tài khoản (Vùng nguy hiểm):** Khu vực xóa tài khoản với cảnh báo rõ ràng và xác thực mật khẩu.

---

## Step-by-Step Tasks

### Phase 1: Nâng cấp Backend API (`routes/auth.js`)

#### Task 1.1: Bổ sung thống kê mua hàng vào `GET /api/auth/profile`
- **File:** `routes/auth.js`
- **Mục tiêu:** Truy vấn tổng đơn hàng, tổng chi tiêu và 3 đơn hàng gần nhất của user.
- **Code thay thế cho endpoint `router.get('/profile', ...)`:**

```javascript
// 8. Xem hồ sơ chi tiết & thống kê người dùng
router.get('/profile', requireUser, async (req, res) => {
  try {
    const [userRows] = await db.execute(
      'SELECT id, email, full_name, created_at FROM users WHERE id = ?',
      [req.session.userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản!' });

    const user = userRows[0];

    // Thống kê đơn hàng của user (chỉ tính đơn không bị hủy)
    const [statRows] = await db.execute(
      `SELECT 
         COUNT(*) as total_orders,
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_price ELSE 0 END), 0) as total_spent,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
       FROM orders WHERE user_id = ?`,
      [user.id]
    );

    // 3 đơn hàng mới nhất
    const [recentOrders] = await db.execute(
      `SELECT order_code, total_price, status, created_at 
       FROM orders WHERE user_id = ? 
       ORDER BY id DESC LIMIT 3`,
      [user.id]
    );

    const stats = statRows[0] || { total_orders: 0, total_spent: 0, pending_orders: 0, completed_orders: 0 };

    res.json({
      user,
      stats: {
        total_orders: Number(stats.total_orders),
        total_spent: Number(stats.total_spent),
        pending_orders: Number(stats.pending_orders),
        completed_orders: Number(stats.completed_orders)
      },
      recent_orders: recentOrders
    });
  } catch (err) {
    console.error('Profile API error:', err);
    res.status(500).json({ error: 'Lỗi tải hồ sơ người dùng!' });
  }
});
```

- **Verify Command:**
```bash
curl -s -b cookies.txt http://localhost:3000/api/auth/profile | node -pe 'const d = JSON.parse(require("fs").readFileSync(0, "utf8")); ({ email: d.user.email, orders: d.stats.total_orders })'
```
- **Expected Output:**
`{ email: 'phuc@jetjet.store', orders: ... }`

---

### Phase 2: Thiết kế lại giao diện Profile Center (`public/index.html`)

#### Task 2.1: Cập nhật CSS cho Profile Center
- **File:** `public/index.html`
- **Mục tiêu:** Thêm styles cho Avatar monogram, Stats card, Tab switcher.
- **CSS bổ sung:**

```css
/* Profile Center Redesign */
.profile-modal-box {
  max-width: 44rem !important;
  width: 95vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  overflow: hidden;
  border-radius: var(--radius-sm);
}
.profile-header-card {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  position: relative;
}
.profile-avatar-circle {
  width: 4.25rem;
  height: 4.25rem;
  border-radius: 50%;
  background: var(--primary, #0a0a0a);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  border: 3px solid var(--border);
}
.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.profile-stat-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  text-align: center;
}
.profile-stat-value {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text);
  margin-top: 0.2rem;
}
.profile-stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  font-weight: 600;
}
.profile-tabs-nav {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  padding: 0 1rem;
  gap: 0.5rem;
}
.profile-tab-btn {
  background: none;
  border: none;
  padding: 0.75rem 0.85rem;
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.15s ease;
}
.profile-tab-btn:hover {
  color: var(--text);
}
.profile-tab-btn.active {
  color: var(--text);
  border-bottom-color: var(--text);
}
.profile-body-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}
.profile-tab-pane {
  display: none;
}
.profile-tab-pane.active {
  display: block;
}
```

#### Task 2.2: Thay thế cấu trúc HTML của `#profile-modal`
- **File:** `public/index.html`
- **Mục tiêu:** Cấu trúc 4 tab: Thông tin, Bảo mật, Đơn gần đây, Vùng nguy hiểm.

```html
<!-- Redesigned Profile Modal -->
<div class="modal-backdrop" id="profile-modal">
  <div class="modal-box profile-modal-box">
    <!-- Header Card -->
    <div class="profile-header-card">
      <div class="profile-avatar-circle" id="profile-avatar-monogram">PN</div>
      <div style="flex:1; min-width:0;">
        <div>
          <h2 style="font-size:1.2rem; font-weight:800; margin:0;" id="profile-card-name">Tên người dùng</h2>
        </div>
        <div style="font-size:0.825rem; color:var(--text-muted); margin-top:0.25rem; display:flex; align-items:center; gap:0.4rem;">
          <span id="profile-card-email">email@domain.com</span>
          <span style="color:#16a34a; font-size:0.85rem; font-weight:700;" title="Đã xác thực">✓</span>
        </div>
      </div>
      <button class="btn-icon-close" id="btn-close-profile" aria-label="Đóng" style="position:absolute; top:1rem; right:1rem;">
        <svg class="ui-icon" style="width:1.1rem;height:1.1rem;" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <!-- Quick Stats Grid -->
    <div class="profile-stats-grid">
      <div class="profile-stat-box">
        <div class="profile-stat-label">Tổng đơn hàng</div>
        <div class="profile-stat-value" id="stat-total-orders">0</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-label">Tổng chi tiêu</div>
        <div class="profile-stat-value" id="stat-total-spent">0đ</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-label">Đang chờ xử lý</div>
        <div class="profile-stat-value" id="stat-pending-orders">0</div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="profile-tabs-nav">
      <button class="profile-tab-btn active" data-tab="tab-prof-info">
        <svg class="ui-icon" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Thông tin</span>
      </button>
      <button class="profile-tab-btn" data-tab="tab-prof-security">
        <svg class="ui-icon" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>Mật khẩu & Bảo mật</span>
      </button>
      <button class="profile-tab-btn" data-tab="tab-prof-orders">
        <svg class="ui-icon" viewBox="0 0 24 24"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
        <span>Đơn gần đây</span>
      </button>
      <button class="profile-tab-btn" data-tab="tab-prof-danger" style="margin-left:auto; color:#dc2626;">
        <svg class="ui-icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
        <span>Tài khoản</span>
      </button>
    </div>

    <!-- Body Content -->
    <div class="profile-body-content">
      <div id="profile-alert-box" style="display:none; margin-bottom:1rem; padding:0.65rem 0.85rem; border-radius:var(--radius-sm); font-size:0.825rem; line-height:1.4;"></div>

      <!-- Tab 1: Info -->
      <div class="profile-tab-pane active" id="tab-prof-info">
        <form id="form-profile-info">
          <div class="form-field">
            <label for="prof-info-email">Địa chỉ Email</label>
            <input type="email" id="prof-info-email" disabled readonly style="opacity:0.65; cursor:not-allowed;" />
            <small style="color:var(--text-subtle); font-size:0.75rem; margin-top:0.25rem;">Email định danh tài khoản không thể chỉnh sửa</small>
          </div>
          <div class="form-field">
            <label for="prof-info-name">Họ và tên hiển thị</label>
            <input type="text" id="prof-info-name" required placeholder="Họ và tên" />
          </div>
          <button type="submit" class="btn-buy" id="btn-save-prof-info" style="padding:0.7rem 1.4rem; justify-content:center; margin-top:0.5rem;">
            Lưu thay đổi thông tin
          </button>
        </form>
      </div>

      <!-- Tab 2: Security & Change Password -->
      <div class="profile-tab-pane" id="tab-prof-security">
        <form id="form-profile-change-pw">
          <div class="form-field">
            <label for="prof-pw-current">Mật khẩu hiện tại</label>
            <input type="password" id="prof-pw-current" required placeholder="Nhập mật khẩu đang dùng" />
          </div>
          <div class="form-field">
            <label for="prof-pw-new">Mật khẩu mới</label>
            <input type="password" id="prof-pw-new" minlength="6" required placeholder="Tối thiểu 6 ký tự" />
          </div>
          <div class="form-field">
            <label for="prof-pw-confirm">Xác nhận lại mật khẩu mới</label>
            <input type="password" id="prof-pw-confirm" minlength="6" required placeholder="Nhập lại mật khẩu mới" />
          </div>
          <button type="submit" class="btn-buy" id="btn-save-prof-pw" style="padding:0.7rem 1.4rem; justify-content:center; margin-top:0.5rem;">
            Cập nhật mật khẩu mới
          </button>
        </form>
      </div>

      <!-- Tab 3: Recent Orders -->
      <div class="profile-tab-pane" id="tab-prof-orders">
        <div id="profile-recent-orders-list" style="display:flex; flex-direction:column; gap:0.65rem;">
          <!-- Injected via JS -->
        </div>
        <div style="text-align:center; margin-top:1.25rem;">
          <button type="button" class="cart-btn" id="btn-prof-view-all-orders" style="width:100%; justify-content:center; padding:0.65rem;">
            Xem toàn bộ lịch sử đơn hàng
          </button>
        </div>
      </div>

      <!-- Tab 4: Danger Zone -->
      <div class="profile-tab-pane" id="tab-prof-danger">
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:var(--radius-sm); padding:1rem; margin-bottom:1rem;">
          <div style="font-weight:700; color:#b91c1c; font-size:0.875rem; margin-bottom:0.35rem;">Cảnh báo: Hành động không thể hoàn tác</div>
          <p style="font-size:0.8rem; color:#7f1d1d; margin:0; line-height:1.4;">
            Khi xóa tài khoản, tất cả quyền truy cập thành viên sẽ bị chấm dứt. Lịch sử đơn hàng cũ vẫn được tiệm lưu trữ theo quy định bảo hành nhưng sẽ không còn liên kết với tài khoản này.
          </p>
        </div>
        <div class="form-field">
          <label for="prof-delete-pw">Xác nhận bằng mật khẩu của bạn</label>
          <input type="password" id="prof-delete-pw" placeholder="Nhập mật khẩu để xác nhận xóa" />
        </div>
        <button type="button" class="btn-buy" id="btn-prof-delete-account" style="background:#dc2626; border-color:#dc2626; color:#fff; width:100%; justify-content:center; padding:0.65rem;">
          Tôi hiểu và đồng ý xóa vĩnh viễn tài khoản này
        </button>
      </div>
    </div>
  </div>
</div>
```

#### Task 2.3: Viết lại JS điều khiển Profile Center
- **File:** `public/index.html`
- **Logic:**
  1. Khi mở modal (`#dd-profile` click): Gọi `GET /api/auth/profile`, render monogram (2 chữ cái in hoa), tên, email, 3 số liệu thống kê, và danh sách đơn gần đây.
  2. Xử lý chuyển tab trong Profile (`.profile-tab-btn`).
  3. Xử lý submit lưu tên (`#form-profile-info`): gọi `PUT /api/auth/profile`, cập nhật lại UI tức thì không cần reload.
  4. Xử lý đổi mật khẩu (`#form-profile-change-pw`): gọi `POST /api/auth/change-password`, reset form sau khi thành công.
  5. Xử lý xóa tài khoản (`#btn-prof-delete-account`): xác nhận confirm prompt, gọi `POST /api/auth/delete-account`.
  6. Nút "Xem toàn bộ lịch sử đơn hàng": đóng profile modal và mở `#my-orders-modal`.

---

### Phase 3: Kiểm thử tự động (Test Suite)

#### Task 3.1: Viết test script `scripts/test_profile_redesign.js`
- **File:** `scripts/test_profile_redesign.js`
- **Các ca kiểm thử:**
  1. Đăng nhập user thành viên.
  2. Gọi `GET /api/auth/profile` và kiểm tra cấu trúc JSON:
     - `user.id`, `user.email`, `user.full_name`, `user.created_at`
     - `stats.total_orders` (number), `stats.total_spent` (number), `stats.pending_orders`
     - `recent_orders` (array, length <= 3)
  3. Cập nhật tên qua `PUT /api/auth/profile` và kiểm tra phản hồi.
  4. Đổi mật khẩu qua `POST /api/auth/change-password` và hoàn nguyên lại.
  5. Kiểm thử DOM trong file `public/index.html` chứa đầy đủ các element IDs mới (`#profile-avatar-monogram`, `#stat-total-spent`, `#profile-tabs-nav`, `#tab-prof-security`).
- **Command verify:**
```bash
node scripts/test_profile_redesign.js
```
- **Expected Output:**
`🎉 TẤT CẢ CÁC BƯỚC TEST PROFILE REDESIGN ĐỀU PASS!`

---

## Risks, Tradeoffs & Mitigations

| Rủi ro / Tradeoff | Đánh giá | Giải pháp |
|-------------------|----------|-----------|
| Gộp Đổi mật khẩu vào Profile làm thừa modal cũ | Có thể gây trùng lặp nếu modal cũ vẫn còn | Xóa bỏ hoặc ẩn modal `#change-pw-modal` cũ, dropdown menu chuyển hướng thẳng vào Tab Bảo mật của Profile Center |
| Monogram Avatar tên ngắn/dài | Tên có 1 từ ("Phúc") hoặc nhiều từ ("Nguyễn Song Hoàng Phúc") | Lấy ký tự đầu từ đầu và cuối ("NP"), nếu 1 từ lấy 2 ký tự đầu ("PH") |
| Trải nghiệm trên điện thoại | Giao diện rộng 44rem có thể bị tràn trên mobile | Sử dụng `max-width: 44rem`, `width: 95vw`, stats grid co giãn tự động |

---

## Open Questions & Decisions
1. **Có cần trường tải ảnh đại diện (upload avatar) không?**
   - *Khuyến nghị:* Chưa cần (YAGNI). Dùng Monogram Avatar hai chữ cái đầu tạo phong cách tối giản, sạch sẽ, không tốn tài nguyên upload.

---

## Execution Estimate
- **Backend Task 1.1:** ~10 phút
- **Frontend Task 2.1 - 2.3:** ~25 phút
- **Test Suite Task 3.1 & Verify:** ~10 phút
- **Tổng cộng:** ~45 phút (hoặc ~25 phút chạy bằng subagent-driven development).
