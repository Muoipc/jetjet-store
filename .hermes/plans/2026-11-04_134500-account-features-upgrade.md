# Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store

## Goal
Bổ sung 7 tính năng còn thiếu: Dropdown menu tài khoản, Trang hồ sơ cá nhân, Đổi mật khẩu khi đã đăng nhập, Xóa tài khoản, Email thông báo đơn hàng, Remember me, Icon thông báo (notification bell).

## Current Context
- **Stack:** Node.js + Express + MySQL (mysql2) + bcrypt + express-session + nodemailer
- **Files chính:** `server.js`, `routes/auth.js`, `routes/orders.js`, `services/email.js`, `public/index.html`
- **Session:** cookie `maxAge: 24h`, `httpOnly: true`, `sameSite: lax`
- **Auth endpoints:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/send-register-otp`, `/api/auth/verify-register`, `/api/auth/send-reset-otp`, `/api/auth/reset-password`
- **Header hiện tại:** Khi đăng nhập hiển thị `Chào, [tên]!` + nút Đơn hàng + nút Đăng xuất (icon). Không có dropdown, không có lối vào hồ sơ.

## Architecture
Thêm 3 endpoint backend mới (`/api/auth/profile`, `/api/auth/change-password`, `/api/auth/delete-account`). Mở rộng `services/email.js` thêm hàm `sendOrderNotification()`. Sửa `routes/orders.js` gọi email khi tạo đơn + khi deliver. Frontend: thay header account bằng dropdown menu, thêm modal hồ sơ. Sửa session cookie `maxAge` dựa trên checkbox Remember me.

---

## Phase 1: Backend — Profile, Change Password, Delete Account (routes/auth.js)

### Task 1.1: Thêm endpoint GET/PUT /api/auth/profile

**File:** `routes/auth.js`

Thêm sau dòng `router.get('/me', ...)` (sau line 248):

```javascript
// 8. Xem hồ sơ (chi tiết hơn /me)
router.get('/profile', requireUser, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, email, full_name, created_at FROM users WHERE id = ?',
      [req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản!' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải hồ sơ!' });
  }
});

// 9. Cập nhật hồ sơ (tên)
router.put('/profile', requireUser, async (req, res) => {
  const { full_name } = req.body;
  if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'Tên không được để trống!' });

  const cleanName = sanitize(full_name.trim());
  try {
    await db.execute('UPDATE users SET full_name = ? WHERE id = ?', [cleanName, req.session.userId]);
    req.session.userName = cleanName;
    res.json({ success: true, message: 'Cập nhật hồ sơ thành công!', full_name: cleanName });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật hồ sơ!' });
  }
});
```

**Cần thêm middleware `requireUser`** ở đầu file `routes/auth.js` (sau line 6):

```javascript
function requireUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập!' });
  }
  next();
}
```

**Verify:**
```bash
# Đăng nhập trước
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"phuc@jetjet.store","password":"123456"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).success'
# Expected: true

# Xem profile
curl -s -b cookies.txt http://localhost:3000/api/auth/profile | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).user.email'
# Expected: phuc@jetjet.store

# Sửa tên
curl -s -b cookies.txt -X PUT http://localhost:3000/api/auth/profile \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Phúc Nguyễn"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).full_name'
# Expected: Phúc Nguyễn
```

### Task 1.2: Thêm endpoint POST /api/auth/change-password

**File:** `routes/auth.js`

Thêm sau endpoint PUT /profile:

```javascript
// 10. Đổi mật khẩu (đã đăng nhập, nhập MK cũ + MK mới)
router.post('/change-password', requireUser, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Vui lòng nhập đủ mật khẩu cũ và mới!' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải từ 6 ký tự trở lên!' });
  }
  if (current_password === new_password) {
    return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu cũ!' });
  }

  try {
    const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tài khoản không tồn tại!' });

    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng!' });

    const newHash = await bcrypt.hash(new_password, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.session.userId]);

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đổi mật khẩu!' });
  }
});
```

**Verify:**
```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"123456","new_password":"654321"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).success'
# Expected: true

# Đổi lại cho test sau
curl -s -b cookies.txt -X POST http://localhost:3000/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"654321","new_password":"123456"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).success'
# Expected: true
```

### Task 1.3: Thêm endpoint POST /api/auth/delete-account

**File:** `routes/auth.js`

```javascript
// 11. Xóa tài khoản (xác nhận bằng mật khẩu)
router.post('/delete-account', requireUser, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Vui lòng nhập mật khẩu để xác nhận xóa!' });

  try {
    const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tài khoản không tồn tại!' });

    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Mật khẩu không chính xác!' });

    // Soft: set orders.user_id = NULL (giữ lịch sử đơn)
    await db.execute('UPDATE orders SET user_id = NULL WHERE user_id = ?', [req.session.userId]);
    await db.execute('DELETE FROM users WHERE id = ?', [req.session.userId]);

    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Đã xóa tài khoản. Tạm biệt!' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa tài khoản!' });
  }
});
```

**Verify:**
```bash
# Tạo user test trước (qua OTP console)
# Sau đó test xóa:
curl -s -b cookies.txt -X POST http://localhost:3000/api/auth/delete-account \
  -H 'Content-Type: application/json' \
  -d '{"password":"wrong"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).error'
# Expected: Mật khẩu không chính xác!
```

---

## Phase 2: Backend — Remember Me (server.js + routes/auth.js)

### Task 2.1: Sửa login endpoint hỗ trợ remember_me

**File:** `routes/auth.js` — Sửa endpoint `POST /login` (line 123)

Thêm sau `req.session.userPhone = user.phone;` (line 144):

```javascript
    // Remember me: kéo dài session 30 ngày
    if (req.body.remember_me) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 ngày
    }
```

**Verify:**
```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"phuc@jetjet.store","password":"123456","remember_me":true}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).success'
# Expected: true
# Cookie file sẽ có expiry ~30 ngày thay vì session
```

---

## Phase 3: Backend — Email thông báo đơn hàng (services/email.js + routes/orders.js)

### Task 3.1: Thêm hàm sendOrderEmail vào services/email.js

**File:** `services/email.js`

Thêm trước `module.exports`:

```javascript
async function sendOrderEmail(email, orderCode, type, extra = {}) {
  const isCreated = type === 'created';
  const subject = isCreated
    ? `[JetJet Store] Đơn hàng ${orderCode} đã được tạo`
    : `[JetJet Store] Đơn hàng ${orderCode} đã hoàn thành — Nhận tài khoản`;

  const title = isCreated ? 'Xác nhận đơn hàng' : 'Đơn hàng hoàn thành';
  const body = isCreated
    ? `Đơn hàng <strong>${orderCode}</strong> đã được tạo thành công. Vui lòng thanh toán qua mã QR để hoàn tất.`
    : `Đơn hàng <strong>${orderCode}</strong> đã được giao. ${extra.delivery_info ? '<br><br><strong>Thông tin tài khoản:</strong><br><pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:13px;">' + extra.delivery_info + '</pre>' : ''}`;

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px;background:#fff;">
      <div style="text-align:center;margin-bottom:16px;">
        <h2 style="color:#0a0a0a;font-size:18px;margin:0;">JetJet Store</h2>
      </div>
      <div style="background:#f9f9f9;padding:20px;border-radius:8px;">
        <h3 style="margin-top:0;color:#171717;">${title}</h3>
        <p style="color:#525252;font-size:14px;line-height:1.6;">${body}</p>
        <p style="color:#a3a3a3;font-size:11px;margin-bottom:0;">Mã tra cứu: <strong>${orderCode}</strong></p>
      </div>
    </div>`;

  console.log(`\n📧 [ORDER EMAIL] -> ${email} | ${type} | ${orderCode}\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"JetJet Store" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        html
      });
    } catch (err) {
      console.error('⚠️ Order email send failed:', err.message);
    }
  }
}
```

Sửa `module.exports`:
```javascript
module.exports = { sendOtpEmail, sendOrderEmail };
```

### Task 3.2: Gọi sendOrderEmail khi tạo đơn

**File:** `routes/orders.js`

Thêm import ở đầu file:
```javascript
const { sendOrderEmail } = require('../services/email');
```

Sau khi tạo đơn thành công (sau dòng `res.json({ ... order_code ... })`), thêm:
```javascript
    // Gửi email xác nhận đơn (fire-and-forget)
    sendOrderEmail(customer_email, orderCode, 'created').catch(() => {});
```

### Task 3.3: Gọi sendOrderEmail khi admin deliver

**File:** `routes/admin.js`

Thêm import ở đầu file:
```javascript
const { sendOrderEmail } = require('../services/email');
```

Trong endpoint `PATCH /orders/:id/deliver` (line 124), sau khi UPDATE thành công, thêm:
```javascript
    // Gửi email thông báo giao hàng
    const [orderRows] = await db.execute('SELECT customer_email, order_code FROM orders WHERE id = ?', [req.params.id]);
    if (orderRows.length > 0 && orderRows[0].customer_email) {
      sendOrderEmail(orderRows[0].customer_email, orderRows[0].order_code, 'delivered', {
        delivery_info: req.body.delivery_info
      }).catch(() => {});
    }
```

**Verify:**
```bash
# Tạo đơn test, xem console in ra:
# 📧 [ORDER EMAIL] -> phuc@jetjet.store | created | JJ2611040XXX
```

---

## Phase 4: Frontend — Dropdown Menu + Modal Hồ sơ (public/index.html)

### Task 4.1: Thay header account bằng dropdown menu

**File:** `public/index.html`

Thay đổi hàm `renderAccountHeader()` trong JS — khi `currentUser != null`, render:

```html
<div style="position:relative;" id="account-dropdown-wrap">
  <button class="cart-btn" id="btn-account-dropdown" style="gap:0.4rem;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    <span>${currentUser.full_name.split(' ').pop()}</span>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  <div id="account-dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 6px); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); min-width:180px; box-shadow:0 4px 12px rgba(0,0,0,0.08); z-index:999; overflow:hidden;">
    <button class="dropdown-item" id="dd-profile">Hồ sơ cá nhân</button>
    <button class="dropdown-item" id="dd-orders">Đơn hàng của tôi</button>
    <button class="dropdown-item" id="dd-change-pw">Đổi mật khẩu</button>
    <hr style="margin:0; border:none; border-top:1px solid var(--border);">
    <button class="dropdown-item" id="dd-logout" style="color:#dc2626;">Đăng xuất</button>
  </div>
</div>
```

CSS cho dropdown item:
```css
.dropdown-item {
  display: block; width: 100%; text-align: left; padding: 0.6rem 1rem;
  background: none; border: none; font-size: 0.825rem; color: var(--text);
  cursor: pointer; font-family: inherit;
}
.dropdown-item:hover { background: var(--bg-hover, #f5f5f5); }
```

JS toggle:
```javascript
const btnDd = document.getElementById('btn-account-dropdown');
const menuDd = document.getElementById('account-dropdown-menu');
btnDd.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDd.style.display = menuDd.style.display === 'none' ? 'block' : 'none';
});
document.addEventListener('click', () => menuDd.style.display = 'none');
```

### Task 4.2: Thêm modal Hồ sơ cá nhân

**File:** `public/index.html`

Thêm modal HTML (sau `my-orders-modal`):

```html
<div class="modal-backdrop" id="profile-modal">
  <div class="modal-box" style="max-width:26rem; padding:1.75rem;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
      <h2 style="font-size:1.15rem; font-weight:700; margin:0;">Hồ sơ cá nhân</h2>
      <button class="btn-icon-close" id="btn-close-profile" aria-label="Đóng">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="profile-msg" style="display:none; margin-bottom:1rem; padding:0.65rem 0.85rem; border-radius:var(--radius-sm); font-size:0.825rem;"></div>

    <form id="form-profile">
      <div class="form-field">
        <label>Email</label>
        <input type="email" id="profile-email" disabled style="opacity:0.6;" />
      </div>
      <div class="form-field">
        <label>Tên</label>
        <input type="text" id="profile-name" required />
      </div>
      <div class="form-field">
        <label style="color:var(--text-muted); font-size:0.75rem;">Ngày tạo tài khoản</label>
        <input type="text" id="profile-created" disabled style="opacity:0.6;" />
      </div>
      <button type="submit" class="btn-buy" style="width:100%; padding:0.7rem; justify-content:center; margin-top:0.5rem;">Lưu thay đổi</button>
    </form>

    <hr style="margin:1.25rem 0; border:none; border-top:1px solid var(--border);">

    <details style="font-size:0.825rem;">
      <summary style="cursor:pointer; color:#dc2626; font-weight:600;">Xóa tài khoản vĩnh viễn</summary>
      <div style="margin-top:0.75rem;">
        <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:0.5rem;">Nhập mật khẩu để xác nhận. Thao tác này không thể hoàn tác.</p>
        <input type="password" id="delete-account-pw" placeholder="Mật khẩu xác nhận" style="width:100%; margin-bottom:0.5rem;" />
        <button type="button" id="btn-delete-account" class="btn-buy" style="width:100%; padding:0.6rem; justify-content:center; background:#dc2626; border-color:#dc2626; color:#fff;">Xóa tài khoản</button>
      </div>
    </details>
  </div>
</div>
```

JS cho modal hồ sơ:
```javascript
// Mở profile modal
document.getElementById('dd-profile').addEventListener('click', async () => {
  const modal = document.getElementById('profile-modal');
  const res = await fetch('/api/auth/profile', { credentials: 'include' });
  const data = await res.json();
  if (data.user) {
    document.getElementById('profile-email').value = data.user.email;
    document.getElementById('profile-name').value = data.user.full_name;
    document.getElementById('profile-created').value = new Date(data.user.created_at).toLocaleDateString('vi-VN');
  }
  modal.classList.add('open');
});

// Submit profile form
document.getElementById('form-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('profile-name').value.trim();
  const res = await fetch('/api/auth/profile', {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: name })
  });
  const data = await res.json();
  const msg = document.getElementById('profile-msg');
  msg.style.display = 'block';
  if (data.success) {
    msg.style.background = '#f0fdf4'; msg.style.color = '#166534';
    msg.textContent = data.message;
    currentUser.full_name = data.full_name;
    renderAccountHeader();
  } else {
    msg.style.background = '#fef2f2'; msg.style.color = '#dc2626';
    msg.textContent = data.error;
  }
});

// Xóa tài khoản
document.getElementById('btn-delete-account').addEventListener('click', async () => {
  const pw = document.getElementById('delete-account-pw').value;
  if (!pw) return alert('Nhập mật khẩu!');
  if (!confirm('Bạn chắc chắn muốn xóa tài khoản? Thao tác này KHÔNG THỂ hoàn tác!')) return;
  const res = await fetch('/api/auth/delete-account', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  });
  const data = await res.json();
  if (data.success) {
    alert('Tài khoản đã xóa. Tạm biệt!');
    currentUser = null;
    renderAccountHeader();
    document.getElementById('profile-modal').classList.remove('open');
  } else {
    alert(data.error);
  }
});

// Close profile modal
document.getElementById('btn-close-profile').addEventListener('click', () => {
  document.getElementById('profile-modal').classList.remove('open');
});
```

### Task 4.3: Thêm modal Đổi mật khẩu

**File:** `public/index.html`

```html
<div class="modal-backdrop" id="change-pw-modal">
  <div class="modal-box" style="max-width:26rem; padding:1.75rem;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
      <h2 style="font-size:1.15rem; font-weight:700; margin:0;">Đổi mật khẩu</h2>
      <button class="btn-icon-close" id="btn-close-change-pw" aria-label="Đóng">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="change-pw-msg" style="display:none; margin-bottom:1rem; padding:0.65rem 0.85rem; border-radius:var(--radius-sm); font-size:0.825rem;"></div>
    <form id="form-change-pw">
      <div class="form-field">
        <label>Mật khẩu hiện tại</label>
        <input type="password" id="cpw-current" required />
      </div>
      <div class="form-field">
        <label>Mật khẩu mới</label>
        <input type="password" id="cpw-new" minlength="6" required placeholder="Tối thiểu 6 ký tự" />
      </div>
      <div class="form-field">
        <label>Nhập lại mật khẩu mới</label>
        <input type="password" id="cpw-confirm" minlength="6" required />
      </div>
      <button type="submit" class="btn-buy" style="width:100%; padding:0.7rem; justify-content:center;">Đổi mật khẩu</button>
    </form>
  </div>
</div>
```

JS:
```javascript
document.getElementById('dd-change-pw').addEventListener('click', () => {
  document.getElementById('change-pw-modal').classList.add('open');
});
document.getElementById('btn-close-change-pw').addEventListener('click', () => {
  document.getElementById('change-pw-modal').classList.remove('open');
});

document.getElementById('form-change-pw').addEventListener('submit', async (e) => {
  e.preventDefault();
  const current = document.getElementById('cpw-current').value;
  const newPw = document.getElementById('cpw-new').value;
  const confirm = document.getElementById('cpw-confirm').value;
  const msg = document.getElementById('change-pw-msg');

  if (newPw !== confirm) {
    msg.style.display = 'block'; msg.style.background = '#fef2f2'; msg.style.color = '#dc2626';
    msg.textContent = 'Mật khẩu mới không khớp!';
    return;
  }

  const res = await fetch('/api/auth/change-password', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: current, new_password: newPw })
  });
  const data = await res.json();
  msg.style.display = 'block';
  if (data.success) {
    msg.style.background = '#f0fdf4'; msg.style.color = '#166534';
    msg.textContent = data.message;
    document.getElementById('form-change-pw').reset();
  } else {
    msg.style.background = '#fef2f2'; msg.style.color = '#dc2626';
    msg.textContent = data.error;
  }
});
```

### Task 4.4: Thêm checkbox Remember me vào form login

**File:** `public/index.html`

Trong `#tab-login`, trước nút submit, thêm:

```html
<div style="display:flex; align-items:center; gap:0.5rem; margin:0.5rem 0;">
  <input type="checkbox" id="login-remember" style="width:auto; margin:0;" />
  <label for="login-remember" style="font-size:0.8rem; color:var(--text-muted); cursor:pointer; margin:0;">Nhớ đăng nhập 30 ngày</label>
</div>
```

Sửa JS login fetch body thêm `remember_me`:
```javascript
body: JSON.stringify({ email, password, remember_me: document.getElementById('login-remember').checked })
```

---

## Phase 5: Verify toàn bộ

### Test script: `scripts/test_account_features.js`

```javascript
const BASE = 'http://localhost:3000';
const http = require('http');
const https = require('https');

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method, hostname: url.hostname, port: url.port, path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let d = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d), cookie: setCookie }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  console.log('=== Test Account Features ===\n');

  // 1. Login
  const login = await req('POST', '/api/auth/login', { email: 'phuc@jetjet.store', password: '123456', remember_me: true });
  const cookie = login.cookie?.[0]?.split(';')[0];
  console.log(`[1] Login: ${login.data.success ? 'PASS' : 'FAIL'}`);

  // 2. Get profile
  const profile = await req('GET', '/api/auth/profile', null, cookie);
  console.log(`[2] Profile: ${profile.data.user?.email === 'phuc@jetjet.store' ? 'PASS' : 'FAIL'}`);

  // 3. Update name
  const update = await req('PUT', '/api/auth/profile', { full_name: 'Phúc Test' }, cookie);
  console.log(`[3] Update name: ${update.data.success ? 'PASS' : 'FAIL'}`);

  // 4. Restore name
  await req('PUT', '/api/auth/profile', { full_name: 'Phúc' }, cookie);

  // 5. Change password
  const cp = await req('POST', '/api/auth/change-password', { current_password: '123456', new_password: '654321' }, cookie);
  console.log(`[4] Change password: ${cp.data.success ? 'PASS' : 'FAIL'}`);

  // 6. Change back
  await req('POST', '/api/auth/change-password', { current_password: '654321', new_password: '123456' }, cookie);

  // 7. Wrong password change
  const wp = await req('POST', '/api/auth/change-password', { current_password: 'wrong', new_password: 'newpw1' }, cookie);
  console.log(`[5] Wrong pw rejected: ${wp.status === 401 ? 'PASS' : 'FAIL'}`);

  // 8. Delete account (wrong pw)
  const del = await req('POST', '/api/auth/delete-account', { password: 'wrong' }, cookie);
  console.log(`[6] Delete wrong pw rejected: ${del.status === 401 ? 'PASS' : 'FAIL'}`);

  console.log('\n✅ All account feature tests done!');
})();
```

**Chạy:**
```bash
node scripts/test_account_features.js
# Expected:
# [1] Login: PASS
# [2] Profile: PASS
# [3] Update name: PASS
# [4] Change password: PASS
# [5] Wrong pw rejected: PASS
# [6] Delete wrong pw rejected: PASS
# ✅ All account feature tests done!
```

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|-----------|
| Xóa tài khoản = mất hết | Soft-delete: chỉ xóa user row, orders giữ lại (user_id = NULL) |
| Remember me = session dài | Cookie httpOnly + sameSite lax, không lộ token |
| Email send fail = đơn vẫn tạo | Fire-and-forget `.catch(() => {})`, không block flow |
| Session maxAge thay đổi runtime | express-session hỗ trợ per-session maxAge natively |

## Open Questions
1. Có cần thêm avatar/ảnh đại diện? → YAGNI, bỏ qua
2. Có cần admin xem danh sách users? → Phase sau nếu cần
3. Email template có cần custom logo? → Dùng text thuần, YAGNI

## Execution
- **Phase 1-2 (Backend):** ~20 phút, chạy tuần tự
- **Phase 3 (Email):** ~10 phút
- **Phase 4 (Frontend):** ~25 phút, chạy song song với Phase 3
- **Phase 5 (Test):** ~5 phút
- **Phase 6 (Notification Bell):** ~15 phút
- **Tổng:** ~55 phút (hoặc ~35 phút với parallel subagents)

---

## Phase 6: Icon Thông báo (Notification Bell) — Backend + Frontend

### Mô tả
Thêm icon chuông 🔔 trên header (cạnh giỏ hàng), hiển thị badge đỏ số thông báo chưa đọc. Click mở dropdown danh sách thông báo. Chỉ hiện khi đã đăng nhập.

**Loại thông báo tự động tạo:**
- Đơn hàng được xác nhận thanh toán (`order_paid`)
- Đơn hàng được giao tài khoản (`order_delivered`)
- Đơn hàng bị hủy (`order_cancelled`)
- **Admin gửi broadcast khuyến mãi / giảm giá (`promo`) → tới tất cả user đã đăng ký**

### Task 6.1: Tạo bảng `notifications` trong MySQL

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('order_paid','order_delivered','order_cancelled','promo') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  order_code VARCHAR(20),
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_unread (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Task 6.2: Tạo backend routes — `routes/notifications.js`

```javascript
const express = require('express');
const router = express.Router();
const db = require('../database');

function requireUser(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Chưa đăng nhập!' });
  next();
}

// Lấy danh sách thông báo (mới nhất trước, tối đa 20)
router.get('/', requireUser, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, type, title, message, order_code, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.session.userId]
    );
    const [countRows] = await db.execute(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.session.userId]
    );
    res.json({ notifications: rows, unread_count: countRows[0].unread });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải thông báo!' });
  }
});

// Đánh dấu đã đọc 1 thông báo
router.patch('/:id/read', requireUser, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi!' });
  }
});

// Đánh dấu tất cả đã đọc
router.post('/read-all', requireUser, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi!' });
  }
});

module.exports = router;
```

### Task 6.3: Mount route trong server.js

Thêm sau dòng `app.use('/api/webhook', ...)`:
```javascript
app.use('/api/notifications', require('./routes/notifications'));
```

### Task 6.4: Tạo helper tạo thông báo — `services/notification.js`

```javascript
const db = require('../database');

async function createNotification(userId, type, title, message, orderCode) {
  if (!userId) return; // Khách vãng lai không có notification
  try {
    await db.execute(
      'INSERT INTO notifications (user_id, type, title, message, order_code) VALUES (?, ?, ?, ?, ?)',
      [userId, type, title, message, orderCode]
    );
  } catch (err) {
    console.error('Notification create error:', err.message);
  }
}

module.exports = { createNotification };
```

### Task 6.5: Gọi createNotification trong routes/orders.js và routes/admin.js

**File: `routes/admin.js`**

Import ở đầu:
```javascript
const { createNotification } = require('../services/notification');
```

Trong `PATCH /orders/:id/status` — khi status chuyển sang `paid`:
```javascript
if (status === 'paid' && order.user_id) {
  createNotification(order.user_id, 'order_paid', 'Đã nhận thanh toán', `Đơn ${order.order_code} đã xác nhận thanh toán thành công.`, order.order_code);
}
if (status === 'cancelled' && order.user_id) {
  createNotification(order.user_id, 'order_cancelled', 'Đơn hàng đã hủy', `Đơn ${order.order_code} đã bị hủy.`, order.order_code);
}
```

Trong `PATCH /orders/:id/deliver` — khi giao tài khoản:
```javascript
if (order.user_id) {
  createNotification(order.user_id, 'order_delivered', 'Đã giao tài khoản', `Đơn ${order.order_code} đã được giao. Vào "Đơn hàng của tôi" để xem chi tiết.`, order.order_code);
}
```

**File: `routes/webhook.js`** — Khi Casso auto-match `paid`:
```javascript
const { createNotification } = require('../services/notification');
// Sau khi UPDATE orders SET status = 'paid':
if (order.user_id) {
  createNotification(order.user_id, 'order_paid', 'Đã nhận thanh toán', `Đơn ${order.order_code} thanh toán thành công qua chuyển khoản.`, order.order_code);
}
```

**File: `routes/orders.js`** — Khi khách tự hủy đơn pending:
```javascript
const { createNotification } = require('../services/notification');
// Trong POST /orders/:code/cancel, sau UPDATE:
if (order.user_id) {
  createNotification(order.user_id, 'order_cancelled', 'Bạn đã hủy đơn', `Đơn ${order.order_code} đã hủy thành công.`, order.order_code);
}
```

### Task 6.6: Frontend — Icon chuông + dropdown thông báo (public/index.html)

**HTML** — Thêm vào header, trước icon giỏ hàng:

```html
<!-- Notification Bell (chỉ hiện khi đăng nhập) -->
<div id="notif-bell-wrap" style="display:none; position:relative;">
  <button class="cart-btn" id="btn-notif-bell" style="position:relative; padding:0.5rem 0.6rem;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
    <span id="notif-badge" style="display:none; position:absolute; top:2px; right:2px; background:#dc2626; color:#fff; font-size:0.6rem; font-weight:700; min-width:16px; height:16px; border-radius:999px; display:flex; align-items:center; justify-content:center; line-height:1;">0</span>
  </button>
  <div id="notif-dropdown" style="display:none; position:absolute; right:0; top:calc(100% + 6px); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); width:320px; max-height:380px; overflow-y:auto; box-shadow:0 4px 16px rgba(0,0,0,0.1); z-index:999;">
    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; border-bottom:1px solid var(--border);">
      <span style="font-weight:700; font-size:0.875rem;">Thông báo</span>
      <button id="btn-notif-read-all" style="background:none; border:none; font-size:0.75rem; color:var(--text-muted); cursor:pointer; text-decoration:underline;">Đọc tất cả</button>
    </div>
    <div id="notif-list"></div>
    <div id="notif-empty" style="display:none; padding:2rem; text-align:center; color:var(--text-muted); font-size:0.825rem;">Chưa có thông báo nào</div>
  </div>
</div>
```

**CSS:**
```css
.notif-item {
  display: flex; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);
  cursor: pointer; font-size: 0.8rem; line-height: 1.4; transition: background 0.15s;
}
.notif-item:hover { background: var(--bg-hover, #f5f5f5); }
.notif-item.unread { background: #fefce8; }
.notif-item .notif-dot { width: 8px; height: 8px; border-radius: 999px; background: #dc2626; flex-shrink: 0; margin-top: 4px; }
.notif-item.read .notif-dot { background: transparent; }
.notif-time { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
```

**JS:**
```javascript
let notifPollTimer = null;

async function loadNotifications() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/notifications', { credentials: 'include' });
    const data = await res.json();
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    const empty = document.getElementById('notif-empty');

    // Badge
    if (data.unread_count > 0) {
      badge.textContent = data.unread_count > 9 ? '9+' : data.unread_count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }

    // List
    if (data.notifications.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    const typeIcon = { order_paid: '💳', order_delivered: '📦', order_cancelled: '❌' };
    list.innerHTML = data.notifications.map(n => {
      const ago = timeAgo(n.created_at);
      return `<div class="notif-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}" data-code="${n.order_code || ''}">
        <div class="notif-dot"></div>
        <div style="flex:1;">
          <div><strong>${typeIcon[n.type] || ''} ${n.title}</strong></div>
          <div style="color:var(--text-muted);">${n.message || ''}</div>
          <div class="notif-time">${ago}</div>
        </div>
      </div>`;
    }).join('');

    // Click để đánh dấu đã đọc
    list.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        if (el.classList.contains('unread')) {
          await fetch(`/api/notifications/${el.dataset.id}/read`, { method: 'PATCH', credentials: 'include' });
          el.classList.remove('unread');
          el.classList.add('read');
          loadNotifications(); // refresh badge
        }
      });
    });
  } catch (err) { /* silent */ }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

// Toggle dropdown
document.getElementById('btn-notif-bell').addEventListener('click', (e) => {
  e.stopPropagation();
  const dd = document.getElementById('notif-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  if (dd.style.display === 'block') loadNotifications();
});
document.addEventListener('click', () => {
  document.getElementById('notif-dropdown').style.display = 'none';
});

// Read all
document.getElementById('btn-notif-read-all').addEventListener('click', async (e) => {
  e.stopPropagation();
  await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
  loadNotifications();
});

// Poll mỗi 30s khi đăng nhập
function startNotifPoll() {
  if (notifPollTimer) clearInterval(notifPollTimer);
  if (!currentUser) {
    document.getElementById('notif-bell-wrap').style.display = 'none';
    return;
  }
  document.getElementById('notif-bell-wrap').style.display = 'block';
  loadNotifications();
  notifPollTimer = setInterval(loadNotifications, 30000);
}
```

Gọi `startNotifPoll()` trong `renderAccountHeader()` sau khi render xong.

### Task 6.7: Verify

```bash
# 1. Tạo notification test
curl -s -b cookies.txt -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"id":1,"quantity":1}],"customer_name":"Test","customer_email":"phuc@jetjet.store"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).order_code'
# -> JJ26110413XX

# 2. Admin confirm paid (triggers notification)
# Vào admin dashboard, chuyển đơn sang "paid"

# 3. Check notifications
curl -s -b cookies.txt http://localhost:3000/api/notifications \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).unread_count'
# Expected: 1 (hoặc nhiều hơn)
```

### Task 6.8: Backend — Admin gửi broadcast khuyến mãi (`routes/admin.js`)

Thêm endpoint mới vào `routes/admin.js`:

```javascript
const { createNotification } = require('../services/notification');

// Gửi thông báo khuyến mãi broadcast tới TẤT CẢ user
router.post('/broadcast', requireAdmin, async (req, res) => {
  const { title, message } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Tiêu đề không được để trống!' });
  if (!message || !message.trim()) return res.status(400).json({ error: 'Nội dung không được để trống!' });

  const cleanTitle = title.trim().substring(0, 100);
  const cleanMsg = message.trim().substring(0, 500);

  try {
    const [users] = await db.execute('SELECT id FROM users');
    if (users.length === 0) return res.json({ success: true, sent: 0, message: 'Chưa có thành viên nào!' });

    // Batch insert thông báo cho tất cả users
    const values = users.map(u => [u.id, 'promo', cleanTitle, cleanMsg, null]);
    const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const flat = values.flat();

    await db.execute(
      `INSERT INTO notifications (user_id, type, title, message, order_code) VALUES ${placeholders}`,
      flat
    );

    res.json({ success: true, sent: users.length, message: `Đã gửi thông báo tới ${users.length} thành viên!` });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'Lỗi gửi thông báo!' });
  }
});
```

**Verify:**
```bash
# Login admin
curl -s -c admin_cookies.txt -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"phucdeptrai123"}'

# Gửi broadcast
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/admin/broadcast \
  -H 'Content-Type: application/json' \
  -d '{"title":"🔥 Flash Sale hôm nay!","message":"Giảm 30% tất cả gói ChatGPT Plus. Chỉ trong 24h!"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).sent'
# Expected: số lượng users (ví dụ: 1)

# Kiểm tra user nhận được
curl -s -b cookies.txt http://localhost:3000/api/notifications \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).notifications[0].title'
# Expected: 🔥 Flash Sale hôm nay!
```

### Task 6.9: Admin Dashboard UI — Tab/Nút gửi thông báo khuyến mãi (`public/admin.html`)

Thêm nút "Gửi thông báo" vào admin header hoặc tab mới:

**HTML** — Thêm tab button cạnh các tab hiện có:
```html
<button class="tab-btn" id="tab-broadcast-btn">📢 Gửi thông báo</button>
```

**HTML** — Thêm view panel:
```html
<div id="tab-broadcast-view" class="tab-view" style="display:none;">
  <h3 style="font-size:1rem; font-weight:700; margin-bottom:1rem;">Gửi thông báo khuyến mãi tới tất cả thành viên</h3>
  <div id="broadcast-msg" style="display:none; margin-bottom:1rem; padding:0.65rem 0.85rem; border-radius:6px; font-size:0.825rem;"></div>
  <form id="form-broadcast">
    <div class="form-field">
      <label>Tiêu đề (tối đa 100 ký tự)</label>
      <input type="text" id="bc-title" maxlength="100" required placeholder="Ví dụ: 🔥 Flash Sale cuối tuần!" />
    </div>
    <div class="form-field">
      <label>Nội dung (tối đa 500 ký tự)</label>
      <textarea id="bc-message" maxlength="500" required rows="3" placeholder="Ví dụ: Giảm 30% tất cả gói ChatGPT Plus. Chỉ trong 24h!" style="width:100%; resize:vertical; font-family:inherit; font-size:0.875rem; padding:0.5rem 0.75rem; border:1px solid var(--border); border-radius:6px;"></textarea>
    </div>
    <button type="submit" class="btn-buy" style="width:100%; padding:0.7rem; justify-content:center;" id="btn-send-broadcast">Gửi tới tất cả thành viên</button>
  </form>
</div>
```

**JS:**
```javascript
// Tab switching — thêm broadcast tab vào logic switch hiện có
document.getElementById('tab-broadcast-btn').addEventListener('click', () => {
  // Ẩn tất cả tab views khác, hiện broadcast view
  document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');
  document.getElementById('tab-broadcast-view').style.display = 'block';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-broadcast-btn').classList.add('active');
});

// Submit broadcast
document.getElementById('form-broadcast').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('bc-title').value.trim();
  const message = document.getElementById('bc-message').value.trim();
  const msgBox = document.getElementById('broadcast-msg');
  const btn = document.getElementById('btn-send-broadcast');

  if (!confirm(`Gửi thông báo "${title}" tới TẤT CẢ thành viên?`)) return;

  btn.disabled = true;
  btn.textContent = 'Đang gửi...';

  try {
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message })
    });
    const data = await res.json();
    msgBox.style.display = 'block';
    if (data.success) {
      msgBox.style.background = '#f0fdf4'; msgBox.style.color = '#166534';
      msgBox.textContent = data.message;
      document.getElementById('form-broadcast').reset();
    } else {
      msgBox.style.background = '#fef2f2'; msgBox.style.color = '#dc2626';
      msgBox.textContent = data.error;
    }
  } catch (err) {
    msgBox.style.display = 'block';
    msgBox.style.background = '#fef2f2'; msgBox.style.color = '#dc2626';
    msgBox.textContent = 'Lỗi kết nối!';
  }
  btn.disabled = false;
  btn.textContent = 'Gửi tới tất cả thành viên';
});
```

### Task 6.10: Frontend — Cập nhật icon thông báo cho type `promo`

Sửa JS trong `public/index.html`, trong hàm `loadNotifications()`:

```javascript
const typeIcon = { order_paid: '💳', order_delivered: '📦', order_cancelled: '❌', promo: '🏷️' };
```

**Verify:**
```bash
# 1. Mở admin dashboard, vào tab "📢 Gửi thông báo"
# 2. Nhập tiêu đề + nội dung, bấm gửi
# 3. Mở storefront, đăng nhập user, bấm icon chuông
# 4. Thấy thông báo khuyến mãi với icon 🏷️ và badge đỏ
```
