# Tái Cấu Trúc Bố Cục Trang Cá Nhân (User Profile Modal Redesign)

## Goal
Tái thiết kế toàn diện bố cục modal Trang cá nhân (`#profile-modal`) từ dạng xếp tầng rời rạc sang bố cục 2 cột (Sidebar thông tin & menu điều hướng bên trái, Khu vực nội dung chuyên biệt bên phải), đưa các chỉ số đơn hàng vào đúng ngữ cảnh, loại bỏ dữ liệu trùng lặp và chuẩn hóa ngôn ngữ thiết kế tối giản.

---

## Current Context & Assumptions

### Phân tích vấn đề hiện tại (từ ảnh thực tế):
1. **Bố cục xếp tầng 4 lớp chồng chéo:**
   - Lớp 1: Khung Header to gồm Avatar `PH`, Tên `Phúc`, Email `phuc@jetjet.store`.
   - Lớp 2: Hàng 3 thẻ thống kê `TỔNG ĐƠN HÀNG`, `TỔNG CHI TIÊU`, `ĐANG CHỜ XỬ LÝ` chiếm ngang màn hình.
   - Lớp 3: Thanh tab ngang (`Thông tin`, `Mật khẩu & Bảo mật`, `Đơn gần đây`, và tab màu đỏ kỳ lạ tên `Tài khoản`).
   - Lớp 4: Nội dung form lặp lại Email (bị disable), lặp lại Họ tên, và 1 nút bấm lệch trái để lại khoảng trống lớn vô nghĩa.
2. **Sai lệch ngữ cảnh hiển thị:**
   - 3 thẻ thống kê đơn hàng và chi tiêu nằm chắn giữa danh tính người dùng và form cài đặt tên, gây rối mắt khi người dùng chỉ muốn chỉnh sửa thông tin hoặc đổi mật khẩu.
3. **Tab màu đỏ gây hiểu nhầm:**
   - Tab ngoài cùng bên phải ghi chữ `Tài khoản` bằng chữ đỏ. Trong khi đây là modal "Trang cá nhân/Tài khoản", người dùng không thể biết tab này là Đăng xuất hay Xóa tài khoản vĩnh viễn.
4. **Nút đóng `✕` đặt lệch:**
   - Đặt `position: absolute; top: 1rem; right: 1rem;` nổi tự do trên header card, không có khung tiêu đề chuẩn mực của một modal ứng dụng.

---

## Architecture & Proposed Approach

Chuyển đổi `#profile-modal` sang cấu trúc **2 cột Dashboard Profile** (phong cách Linear / Vercel / Stripe Account Settings):
- **Cột trái (Sidebar ~ 15rem):**
  - Card định danh: Avatar Monogram tròn tinh tế, Tên người dùng, Email kèm badge `✓ Đã xác thực`.
  - Danh mục điều hướng dọc (Vertical Nav Items với SVG icon nét mảnh):
    - `Thông tin cá nhân` (Icon người dùng)
    - `Đơn hàng của tôi` (Icon gói hàng kèm badge số đơn hàng)
    - `Đổi mật khẩu` (Icon ổ khóa)
    - `Xóa tài khoản` (Icon thùng rác, màu đỏ nhạt ở dưới cùng)
  - Nút Đăng xuất (`Đăng xuất`) ở chân sidebar.
- **Cột phải (Main Content Area - flex 1):**
  - Tiêu đề tab rõ ràng + mô tả ngắn.
  - **Tab Thông tin (`tab-prof-info`):** Khung tóm tắt Email (readonly có icon khóa), Form sửa Họ tên, Form sửa SĐT (tùy chọn) và nút Lưu chỉn chu.
  - **Tab Đơn hàng (`tab-prof-orders`):** Đưa 3 thẻ thống kê (`Tổng đơn`, `Tổng chi tiêu`, `Chờ xử lý`) vào ĐÂY — đúng ngữ cảnh! Danh sách các đơn gần nhất kèm badge trạng thái, số tiền và nút xem tất cả.
  - **Tab Bảo mật (`tab-prof-security`):** Form đổi mật khẩu (hiện tại, mới, xác nhận).
  - **Tab Xóa tài khoản (`tab-prof-danger`):** Cảnh báo vùng nguy hiểm màu đỏ và xác thực mật khẩu để hủy tài khoản.

---

## Step-by-Step Tasks

### Task 1: Cập nhật CSS bố cục 2 cột cho Profile Modal
- **File:** `public/index.html`
- **Vị trí:** Thay thế toàn bộ khối CSS từ `.profile-modal-box` đến `.profile-tab-pane.active` (khoảng dòng 478 - 581).

**CSS mới (Copy-pasteable):**
```css
    /* Profile Center 2-Column Redesign */
    .profile-modal-box {
      max-width: 46rem !important;
      width: 95vw;
      max-height: 86vh;
      display: flex;
      flex-direction: column;
      padding: 0 !important;
      overflow: hidden;
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .profile-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: #ffffff;
    }
    .profile-modal-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text);
    }
    .profile-modal-body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    @media (max-width: 640px) {
      .profile-modal-body {
        flex-direction: column;
        overflow-y: auto;
      }
    }
    /* Left Sidebar */
    .profile-sidebar {
      width: 14.5rem;
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 1.25rem 0.85rem;
      overflow-y: auto;
    }
    @media (max-width: 640px) {
      .profile-sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border);
        padding: 1rem;
      }
    }
    .profile-user-summary {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 1.25rem;
      margin-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .profile-avatar-circle {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 50%;
      background: var(--black);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }
    .profile-sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }
    .profile-nav-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--text-muted);
      border: 1px solid transparent;
      background: transparent;
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .profile-nav-item:hover {
      background: #ffffff;
      color: var(--text);
      border-color: var(--border);
    }
    .profile-nav-item.active {
      background: #ffffff;
      color: var(--black);
      border-color: var(--border);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      font-weight: 700;
    }
    .profile-nav-item.danger-nav {
      color: #dc2626;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--border);
    }
    .profile-nav-item.danger-nav:hover {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .profile-nav-item.danger-nav.active {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }
    /* Right Content Area */
    .profile-main-content {
      flex: 1;
      padding: 1.5rem 1.75rem;
      overflow-y: auto;
      background: #ffffff;
    }
    .profile-pane-header {
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .profile-pane-title {
      font-size: 1.1rem;
      font-weight: 800;
      margin: 0 0 0.25rem;
      color: var(--text);
    }
    .profile-pane-subtitle {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin: 0;
    }
    /* Stat Cards inside Orders Tab */
    .profile-stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .profile-stat-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 0.75rem 0.85rem;
    }
    .profile-stat-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-subtle);
    }
    .profile-stat-value {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--text);
      margin-top: 0.25rem;
    }
```

---

### Task 2: Cập nhật cấu trúc HTML của `#profile-modal`
- **File:** `public/index.html`
- **Vị trí:** Thay thế khối `<div class="modal-backdrop" id="profile-modal">...</div>` (khoảng dòng 957 - 1085).

**HTML mới (Copy-pasteable):**
```html
  <!-- Profile Center Modal (2-Column Redesign) -->
  <div class="modal-backdrop" id="profile-modal">
    <div class="modal-box profile-modal-box">
      <!-- Modal Top Bar -->
      <div class="profile-modal-header">
        <h3 class="profile-modal-title">
          <svg class="ui-icon" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Trang cá nhân thành viên</span>
        </h3>
        <button class="btn-icon-close" id="btn-close-profile" aria-label="Đóng">
          <svg class="ui-icon" style="width:1.1rem;height:1.1rem;" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <!-- Modal Body (2-Column Flex) -->
      <div class="profile-modal-body">
        <!-- Left Sidebar -->
        <aside class="profile-sidebar">
          <div class="profile-user-summary">
            <div class="profile-avatar-circle" id="profile-avatar-monogram">PH</div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:800; font-size:0.925rem; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" id="profile-card-name">Tên thành viên</div>
              <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:0.25rem; margin-top:2px;">
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" id="profile-card-email">email@domain.com</span>
                <span style="color:#16a34a; font-weight:800;" title="Đã xác thực">✓</span>
              </div>
            </div>
          </div>

          <!-- Sidebar Vertical Navigation -->
          <nav class="profile-sidebar-nav">
            <button type="button" class="profile-nav-item active" data-tab="tab-prof-info">
              <svg class="ui-icon" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Thông tin cá nhân</span>
            </button>
            <button type="button" class="profile-nav-item" data-tab="tab-prof-orders">
              <svg class="ui-icon" viewBox="0 0 24 24"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
              <span>Đơn hàng của tôi</span>
            </button>
            <button type="button" class="profile-nav-item" data-tab="tab-prof-security">
              <svg class="ui-icon" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Đổi mật khẩu</span>
            </button>
            <button type="button" class="profile-nav-item danger-nav" data-tab="tab-prof-danger">
              <svg class="ui-icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
              <span>Xóa tài khoản</span>
            </button>
          </nav>
        </aside>

        <!-- Right Content Area -->
        <main class="profile-main-content">
          <div id="profile-alert-box" style="display:none; margin-bottom:1rem; padding:0.65rem 0.85rem; border-radius:var(--radius-sm); font-size:0.825rem; line-height:1.4;"></div>

          <!-- TAB 1: THÔNG TIN CÁ NHÂN -->
          <div class="profile-tab-pane active" id="tab-prof-info">
            <div class="profile-pane-header">
              <h4 class="profile-pane-title">Thông tin tài khoản</h4>
              <p class="profile-pane-subtitle">Quản lý tên hiển thị và thông tin liên hệ của bạn tại JetJet Store.</p>
            </div>
            <form id="form-profile-info">
              <div class="form-field">
                <label for="prof-info-email">Địa chỉ Email</label>
                <div style="position:relative; display:flex; align-items:center;">
                  <input type="email" id="prof-info-email" disabled readonly style="background:var(--surface); opacity:0.8; cursor:not-allowed; padding-right:6rem;" />
                  <span style="position:absolute; right:0.75rem; font-size:0.75rem; color:#16a34a; font-weight:700; display:flex; align-items:center; gap:0.25rem;">
                    ✓ Đã xác thực
                  </span>
                </div>
                <small style="color:var(--text-subtle); font-size:0.75rem; margin-top:0.25rem;">Email định danh tài khoản không thể chỉnh sửa</small>
              </div>

              <div class="form-field">
                <label for="prof-info-name">Họ và tên hiển thị</label>
                <input type="text" id="prof-info-name" required placeholder="Nhập họ và tên của bạn" />
              </div>

              <button type="submit" class="btn-buy" id="btn-save-prof-info" style="padding:0.65rem 1.4rem; justify-content:center; margin-top:0.5rem;">
                Lưu thay đổi thông tin
              </button>
            </form>
          </div>

          <!-- TAB 2: ĐƠN HÀNG CỦA TÔI (CHUYỂN STATS VÀO ĐÂY) -->
          <div class="profile-tab-pane" id="tab-prof-orders" style="display:none;">
            <div class="profile-pane-header">
              <h4 class="profile-pane-title">Lịch sử đơn hàng</h4>
              <p class="profile-pane-subtitle">Thống kê mua sắm và các đơn hàng gần đây của bạn.</p>
            </div>

            <!-- Stats Row -->
            <div class="profile-stats-row">
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

            <div style="font-size:0.8rem; font-weight:700; color:var(--text); margin-bottom:0.65rem;">Đơn hàng gần đây:</div>
            <div id="profile-recent-orders-list" style="display:flex; flex-direction:column; gap:0.65rem;">
              <!-- Injected via JS -->
            </div>

            <div style="text-align:center; margin-top:1.25rem;">
              <button type="button" class="cart-btn" id="btn-prof-view-all-orders" style="width:100%; justify-content:center; padding:0.65rem;">
                Xem chi tiết tất cả đơn hàng
              </button>
            </div>
          </div>

          <!-- TAB 3: ĐỔI MẬT KHẨU -->
          <div class="profile-tab-pane" id="tab-prof-security" style="display:none;">
            <div class="profile-pane-header">
              <h4 class="profile-pane-title">Bảo mật & Đổi mật khẩu</h4>
              <p class="profile-pane-subtitle">Cập nhật mật khẩu định kỳ để bảo vệ tài khoản của bạn.</p>
            </div>
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
              <button type="submit" class="btn-buy" id="btn-save-prof-pw" style="padding:0.65rem 1.4rem; justify-content:center; margin-top:0.5rem;">
                Cập nhật mật khẩu mới
              </button>
            </form>
          </div>

          <!-- TAB 4: XÓA TÀI KHOẢN -->
          <div class="profile-tab-pane" id="tab-prof-danger" style="display:none;">
            <div class="profile-pane-header">
              <h4 class="profile-pane-title" style="color:#b91c1c;">Xóa tài khoản thành viên</h4>
              <p class="profile-pane-subtitle">Hành động này mang tính vĩnh viễn và không thể khôi phục.</p>
            </div>
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:var(--radius-sm); padding:1rem; margin-bottom:1.25rem;">
              <p style="font-size:0.8rem; color:#7f1d1d; margin:0; line-height:1.5;">
                Khi xóa tài khoản, toàn bộ phiên đăng nhập của quý dzị sẽ bị hủy ngay lập tức. Các đơn hàng cũ vẫn được tiệm lưu trữ theo quy định bảo hành nhưng sẽ gỡ liên kết với email này.
              </p>
            </div>
            <div class="form-field">
              <label for="prof-delete-pw">Nhập mật khẩu hiện tại để xác nhận</label>
              <input type="password" id="prof-delete-pw" placeholder="Mật khẩu của bạn" />
            </div>
            <button type="button" class="btn-buy" id="btn-prof-delete-account" style="background:#dc2626; border-color:#dc2626; color:#fff; width:100%; justify-content:center; padding:0.65rem;">
              Xác nhận xóa vĩnh viễn tài khoản
            </button>
          </div>
        </main>
      </div>
    </div>
  </div>
```

---

### Task 3: Cập nhật JavaScript xử lý Tab trong Profile Modal
- **File:** `public/index.html`
- **Mục tiêu:** Cập nhật hàm `switchProfileTab` và event listeners để tương thích với selector `.profile-nav-item` và các tab mới:
  - Selector thay đổi từ `.profile-tab-btn` sang `.profile-nav-item`.
  - Giữ nguyên các ID: `tab-prof-info`, `tab-prof-orders`, `tab-prof-security`, `tab-prof-danger`.
  - Hiển thị / ẩn đúng tab pane (`display: block` hoặc `display: none`).

**JavaScript cập nhật (trong `<script>`):**
```js
    function switchProfileTab(targetTabId) {
      document.querySelectorAll('.profile-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === targetTabId);
      });
      document.querySelectorAll('.profile-tab-pane').forEach(pane => {
        pane.style.display = pane.id === targetTabId ? 'block' : 'none';
      });
      setProfileAlert(null);
    }

    document.querySelectorAll('.profile-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab) switchProfileTab(btn.dataset.tab);
      });
    });
```

---

## Tests & Validation Plan

### 1. Kiểm tra hiển thị qua Browser Harness & Vision Analyze:
- Mở `http://localhost:3000`, đăng nhập bằng `User lẹ` (`phuc@jetjet.store`).
- Mở modal Profile.
- Chụp screenshot và gọi `vision_analyze` để kiểm tra:
  - [ ] Bố cục 2 cột cân đối, Sidebar bên trái và Content bên phải.
  - [ ] Không còn hàng 3 stat box to chèn ngang giữa Header và Form.
  - [ ] Thống kê nằm gọn gàng bên trong tab "Đơn hàng của tôi".
  - [ ] Tab xóa tài khoản ghi rõ ràng `Xóa tài khoản` thay vì chữ `Tài khoản` màu đỏ gây nhầm lẫn.
  - [ ] Nút đóng `✕` nằm góc trên bên phải thanh header modal chuẩn mực.

### 2. Kiểm tra tương tác:
- Bấm chuyển qua lại giữa 4 tabs (`Thông tin`, `Đơn hàng của tôi`, `Đổi mật khẩu`, `Xóa tài khoản`): Nội dung đổi mượt mà.
- Kiểm tra sửa họ tên thành công và lưu lại.
- Kiểm tra xem danh sách đơn hàng gần đây và bấm "Xem chi tiết tất cả đơn hàng".

---

## Risks, Tradeoffs & Open Questions

- **Responsive trên màn hình điện thoại (< 640px):**
  - Đã tích hợp Media Query: Trên màn hình nhỏ, Sidebar tự động chuyển thành hàng ngang hoặc xếp phía trên Content một cách tự nhiên mà không làm tràn khung hình.
- **Dữ liệu thống kê không bị mất:**
  - Toàn bộ dữ liệu từ API `/api/auth/profile` (`stats.total_orders`, `stats.total_spent`, `stats.pending_orders`) vẫn được gán đầy đủ vào các ID tương ứng, nhưng hiển thị trong tab Đơn hàng để tăng tính mạch lạc.
