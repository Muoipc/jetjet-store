# Phân Định Khách Vãng Lai & Tài Khoản Người Dùng Kèm Xác Thực OTP (Plan v2)

## Goal
Bổ sung hệ thống xác thực người dùng (User Authentication) cho JetJet Store, phân định rõ ràng giữa khách vãng lai (Guest Checkout) và thành viên đã đăng nhập (Member Checkout), tích hợp xác thực mã OTP qua Email khi Đăng ký tài khoản và Đổi/Quên mật khẩu.

---

## Current Context & Assumptions

### Hiện trạng:
1. **Khách hàng hiện tại 100% là khách vãng lai:** Khi đặt hàng (`POST /api/orders`), chỉ lưu `customer_name`, `customer_email`, `customer_phone` vào bảng `orders`. Không có bảng `users`, không có `user_id`.
2. **Phiên làm việc (Session):** Đã có `express-session` và `cookie-parser` cấu hình sẵn trong `server.js` (hiện dùng cho `req.session.adminId`). Dùng chung session instance này để lưu `req.session.userId`, `req.session.userEmail`, `req.session.userName`.
3. **Mã hóa:** Đã có `bcrypt` cài sẵn trong `package.json`.
4. **Cơ sở dữ liệu:** MySQL (`jetjet_store`), kết nối qua connection pool `database.js`.

### Giả định kiến trúc:
- **Guest Checkout (Khách vãng lai):** Không bắt buộc tạo tài khoản. Khách vẫn có thể bấm mua, nhập tên, email, SĐT và thanh toán bình thường (`user_id = NULL`).
- **Member Checkout (Thành viên):**
  - **Đăng ký:** Phải nhận mã xác thực OTP 6 số qua Email gửi về, nhập đúng OTP thì tài khoản mới được kích hoạt/tạo.
  - **Quên / Đổi mật khẩu:** Phải nhận mã xác thực OTP 6 số qua Email, nhập đúng OTP kèm mật khẩu mới thì mới được cập nhật.
  - **Đặt hàng:** Khi đã đăng nhập, thông tin Họ tên, Email, SĐT tự động điền sẵn vào modal Checkout, đơn hàng gắn `user_id = req.session.userId`, xem được lịch sử đơn hàng tại "Đơn hàng của tôi".
- **Dịch vụ gửi OTP:** Sử dụng `nodemailer` cấu hình SMTP Gmail trong `.env`. Chế độ Local Dev có fallback in mã OTP ra Terminal (`console.log`) để quá trình test tự động không bị phụ thuộc vào mạng hay cấu hình SMTP của người dùng.
- **Admin Dashboard:**
  - Bảng đơn hàng hiển thị nhãn phân biệt rõ: `🚶 Khách vãng lai` vs `⭐ Thành viên: [Tên] ([email])`.
  - Bộ lọc hỗ trợ lọc theo loại khách: Tất cả / Khách vãng lai / Thành viên.

---

## Architecture & Proposed Approach

```
┌────────────────────────────────────────────────────────────────────────┐
│                          public/index.html                             │
│  - Guest: Nút [👤 Đăng nhập / Đăng ký], mua hàng tự do                │
│  - User:  Menu [👤 Tên khách], [📦 Đơn của tôi], [Đăng xuất]          │
│  - Modal Auth:                                                         │
│      Tab 1: Đăng nhập + link [Quên mật khẩu?]                          │
│      Tab 2: Đăng ký (nhập thông tin -> nhận OTP email -> xác nhận)    │
│      Tab 3: Đổi/Quên mật khẩu (nhập email -> nhận OTP -> đổi pass)    │
│  - Checkout: Tự động fill thông tin nếu đã đăng nhập                   │
└────────────────┬───────────────────────────────────────┬───────────────┘
                 │                                       │
                 ▼ /api/auth/*                           ▼ /api/orders
┌───────────────────────────────────────┐ ┌─────────────────────────────┐
│             routes/auth.js            │ │       routes/orders.js      │
│  POST /send-register-otp              │ │  POST /orders               │
│  POST /verify-register                │ │    (lấy req.session.userId) │
│  POST /login                          │ │  GET  /user/orders          │
│  POST /send-reset-otp                 │ │    (lọc theo userId)        │
│  POST /reset-password                 │ └──────────────┬──────────────┘
│  POST /logout & GET /me               │                │
└────────────────┬──────────────────────┘                │
                 │                                       │
                 ▼ services/email.js                     │
         [nodemailer / SMTP]                             │
                 │                                       │
                 └───────────────┬───────────────────────┘
                                 ▼
                 ┌──────────────────────────────┐
                 │        MySQL Database        │
                 │  - users (id, email, hash...)│
                 │  - otp_codes (code, exp...)  │
                 │  - orders (user_id FK NULL)  │
                 └──────────────────────────────┘
```

---

## Step-by-Step Tasks

### Phase 1: Database Migration & Email Service Setup (15 phút)

#### Task 1.1: Tạo migration script và cập nhật schema
- **File:** `migrations/add_users_and_otp.sql`
- **Mục tiêu:** Tạo bảng `users`, bảng `otp_codes`, và thêm cột `user_id` vào bảng `orders`.

**Nội dung `migrations/add_users_and_otp.sql`:**
```sql
USE jetjet_store;

-- 1. Bảng tài khoản khách hàng thành viên
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng lưu trữ mã OTP xác thực email (Đăng ký & Đổi mật khẩu)
CREATE TABLE IF NOT EXISTS otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type ENUM('register', 'forgot_password') NOT NULL,
  payload JSON NULL COMMENT 'Lưu tạm dữ liệu đăng ký (name, phone, password_hash)',
  expires_at TIMESTAMP NOT NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_type (email, type),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Thêm cột user_id vào bảng orders (NULL nghĩa là khách vãng lai)
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = 'jetjet_store' 
                 AND TABLE_NAME = 'orders' 
                 AND COLUMN_NAME = 'user_id');

SET @query := IF(@exist = 0,
    'ALTER TABLE orders ADD COLUMN user_id INT NULL AFTER id, ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL, ADD INDEX idx_user_id (user_id);',
    'SELECT "Column user_id already exists"');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

**Lệnh thực thi & kiểm tra:**
```bash
mysql -u root -p123456 < migrations/add_users_and_otp.sql
mysql -u root -p123456 jetjet_store -e "DESCRIBE users; DESCRIBE otp_codes; SHOW COLUMNS FROM orders LIKE 'user_id';"
```
*Kỳ vọng:* Hiển thị cấu trúc của `users`, `otp_codes` và cột `user_id` trong `orders`.

---

#### Task 1.2: Cài đặt `nodemailer` và cấu hình Email Service
- **Command:** `npm install nodemailer`
- **File:** `services/email.js`
- **Mục tiêu:** Cung cấp hàm `sendOtpEmail(email, code, type)` có giao diện HTML phong cách miền Tây; tự động fallback in mã OTP ra console nếu chưa cấu hình mật khẩu email SMTP trong `.env`.

**Nội dung `services/email.js`:**
```js
require('dotenv').config();
const nodemailer = require('nodemailer');

// Khởi tạo transporter nếu có cấu hình SMTP
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: process.env.SMTP_SECURE === 'true' || true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendOtpEmail(email, code, type) {
  const isRegister = type === 'register';
  const subject = isRegister 
    ? `🐴 [JetJet Store] Mã xác thực tạo tài khoản: ${code}`
    : `🔑 [JetJet Store] Mã xác thực đổi mật khẩu: ${code}`;

  const title = isRegister ? 'Mã Xác Thực Đăng Ký Tài Khoản' : 'Mã Xác Thực Đổi Mật Khẩu';
  const actionText = isRegister 
    ? 'Cảm ơn quý dzị đã ghé ủng hộ tiệm tạp hóa AI miền Tây. Dưới đây là mã xác nhận để kích hoạt tài khoản:'
    : 'Tiệm nhận được yêu cầu đổi mật khẩu cho tài khoản này. Dưới đây là mã xác thực:';

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px;background:#ffffff;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:28px;">🐴</span>
        <h2 style="color:#0a0a0a;margin:8px 0 0;font-size:20px;">JetJet Store — Tạp Hóa AI</h2>
      </div>
      <div style="background:#f9f9f9;padding:20px;border-radius:8px;text-align:center;">
        <h3 style="margin-top:0;color:#171717;">${title}</h3>
        <p style="color:#525252;font-size:14px;line-height:1.5;">${actionText}</p>
        <div style="margin:24px 0;">
          <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:6px;color:#0a0a0a;background:#ffffff;padding:12px 24px;border:2px dashed #0a0a0a;border-radius:8px;">${code}</span>
        </div>
        <p style="color:#737373;font-size:12px;margin-bottom:0;">Mã có hiệu lực trong <strong>5 phút</strong>. Quý dzị tuyệt đối hổng chia sẻ mã này cho ai nghen!</p>
      </div>
    </div>
  `;

  // Luôn in ra console khi chạy để thuận tiện test
  console.log(`\n📬 [EMAIL OTP SERVICE] -> ${email} | Type: ${type} | CODE: ${code}\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"JetJet Store" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        html
      });
      console.log(`✅ Đã gửi email thực tế tới: ${email}`);
    } catch (err) {
      console.error('⚠️ Không thể gửi mail qua SMTP (fallback console log):', err.message);
    }
  } else {
    console.log('ℹ️ Chưa cấu hình SMTP_PASS trong .env -> Đã in mã ra console để test.');
  }

  return true;
}

module.exports = { sendOtpEmail };
```

---

### Phase 2: Backend Auth with OTP & Orders Association (35 phút)

#### Task 2.1: Middleware xác thực User (`middleware/userAuth.js`)
```js
function requireUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Quý dzị vui lòng đăng nhập trước nghen!' });
  }
  next();
}

module.exports = { requireUser };
```

---

#### Task 2.2: Router Xác Thực Khách Hàng Với OTP (`routes/auth.js`)
- **File:** `routes/auth.js`
- **Endpoints:**
  1. `POST /api/auth/send-register-otp`: Validate email, password, name, phone. Check trùng email. Tạo OTP 6 số, lưu vào `otp_codes` (hạn 5 phút) cùng payload thông tin đăng ký (password đã hash). Gửi email OTP.
  2. `POST /api/auth/verify-register`: Nhận email + code. Kiểm tra code khớp & còn hạn. Lấy payload ra insert vào bảng `users`. Tự động gán session đăng nhập.
  3. `POST /api/auth/login`: Đăng nhập bằng email + mật khẩu.
  4. `POST /api/auth/send-reset-otp`: Nhận email, kiểm tra tài khoản tồn tại. Tạo OTP 6 số loại `forgot_password`, gửi email OTP.
  5. `POST /api/auth/reset-password`: Nhận email, code, new_password. Kiểm tra OTP khớp, hash new_password, cập nhật `password_hash` trong bảng `users`.
  6. `POST /api/auth/logout`: Xóa session.
  7. `GET /api/auth/me`: Trả về thông tin user hiện tại nếu có session.

**Nội dung `routes/auth.js`:**
```js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');
const { sanitize } = require('../middleware/sanitize');
const { sendOtpEmail } = require('../services/email');

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// 1. Gửi OTP Đăng Ký
router.post('/send-register-otp', async (req, res) => {
  const { email, password, full_name, phone } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Email không đúng định dạng!' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải từ 6 ký tự trở lên nha!' });
  }
  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập họ và tên đầy đủ!' });
  }
  if (!phone || !/^0\d{9,10}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)!' });
  }

  const cleanEmail = sanitize(email.trim().toLowerCase());
  const cleanName = sanitize(full_name.trim());
  const cleanPhone = sanitize(phone.trim());

  try {
    const [exist] = await db.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (exist.length > 0) {
      return res.status(409).json({ error: 'Email này đã có người đăng ký rồi bà con ơi!' });
    }

    const code = generateOTP();
    const hash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    const payload = JSON.stringify({
      email: cleanEmail,
      password_hash: hash,
      full_name: cleanName,
      phone: cleanPhone
    });

    await db.execute(
      'INSERT INTO otp_codes (email, code, type, payload, expires_at) VALUES (?, ?, "register", ?, ?)',
      [cleanEmail, code, payload, expiresAt]
    );

    await sendOtpEmail(cleanEmail, code, 'register');

    res.json({ success: true, message: 'Mã xác thực đã được gửi tới email của bạn!' });
  } catch (err) {
    console.error('Send register OTP error:', err);
    res.status(500).json({ error: 'Không thể gửi mã xác thực lúc này!' });
  }
});

// 2. Xác thực OTP & Hoàn tất Đăng Ký
router.post('/verify-register', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Thiếu email hoặc mã OTP!' });

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  try {
    const [rows] = await db.execute(
      'SELECT * FROM otp_codes WHERE email = ? AND type = "register" AND is_used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn!' });
    }

    const otpRecord = rows[0];
    if (otpRecord.code !== cleanCode) {
      await db.execute('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [otpRecord.id]);
      return res.status(400).json({ error: 'Mã OTP không chính xác!' });
    }

    const data = typeof otpRecord.payload === 'string' ? JSON.parse(otpRecord.payload) : otpRecord.payload;

    // Insert user
    const [result] = await db.execute(
      'INSERT INTO users (email, password_hash, full_name, phone) VALUES (?, ?, ?, ?)',
      [data.email, data.password_hash, data.full_name, data.phone]
    );

    // Đánh dấu OTP đã dùng
    await db.execute('UPDATE otp_codes SET is_used = 1 WHERE id = ?', [otpRecord.id]);

    const userId = result.insertId;
    req.session.userId = userId;
    req.session.userEmail = data.email;
    req.session.userName = data.full_name;
    req.session.userPhone = data.phone;

    res.json({
      success: true,
      user: { id: userId, email: data.email, full_name: data.full_name, phone: data.phone },
      message: 'Tạo tài khoản thành công rực rỡ!'
    });
  } catch (err) {
    console.error('Verify register error:', err);
    res.status(500).json({ error: 'Không thể kích hoạt tài khoản lúc này!' });
  }
});

// 3. Đăng nhập
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu!' });

  const cleanEmail = email.trim().toLowerCase();

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu hổng chính xác!' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu hổng chính xác!' });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.full_name;
    req.session.userPhone = user.phone;

    res.json({
      success: true,
      user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone }
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đăng nhập hệ thống!' });
  }
});

// 4. Gửi OTP Quên/Đổi Mật Khẩu
router.post('/send-reset-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Vui lòng nhập email!' });

  const cleanEmail = email.trim().toLowerCase();

  try {
    const [users] = await db.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Hổng tìm thấy tài khoản nào khớp với email này!' });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.execute(
      'INSERT INTO otp_codes (email, code, type, expires_at) VALUES (?, ?, "forgot_password", ?)',
      [cleanEmail, code, expiresAt]
    );

    await sendOtpEmail(cleanEmail, code, 'forgot_password');

    res.json({ success: true, message: 'Đã gửi mã xác nhận đổi mật khẩu tới email của bạn!' });
  } catch (err) {
    console.error('Send reset OTP error:', err);
    res.status(500).json({ error: 'Lỗi gửi mã OTP đổi mật khẩu!' });
  }
});

// 5. Xác thực OTP & Cập nhật Mật Khẩu Mới
router.post('/reset-password', async (req, res) => {
  const { email, code, new_password } = req.body;
  if (!email || !code || !new_password) {
    return res.status(400).json({ error: 'Vui lòng điền đủ email, mã OTP và mật khẩu mới!' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải từ 6 ký tự trở lên nha!' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  try {
    const [rows] = await db.execute(
      'SELECT * FROM otp_codes WHERE email = ? AND type = "forgot_password" AND is_used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn!' });
    }

    const otpRecord = rows[0];
    if (otpRecord.code !== cleanCode) {
      await db.execute('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [otpRecord.id]);
      return res.status(400).json({ error: 'Mã OTP không chính xác!' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE email = ?', [newHash, cleanEmail]);
    await db.execute('UPDATE otp_codes SET is_used = 1 WHERE id = ?', [otpRecord.id]);

    res.json({ success: true, message: 'Đổi mật khẩu thành công! Giờ quý dzị có thể đăng nhập.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Lỗi cập nhật mật khẩu!' });
  }
});

// 6. Đăng xuất
router.post('/logout', (req, res) => {
  req.session.userId = null;
  req.session.userEmail = null;
  req.session.userName = null;
  req.session.userPhone = null;
  res.json({ success: true, message: 'Đã đăng xuất thành công!' });
});

// 7. Thông tin phiên hiện tại
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      loggedIn: true,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        full_name: req.session.userName,
        phone: req.session.userPhone
      }
    });
  }
  res.json({ loggedIn: false });
});

module.exports = router;
```

---

#### Task 2.3: Gắn `user_id` vào `routes/orders.js` và thêm API Lịch sử đơn hàng
- **File:** `routes/orders.js`
- **Thay đổi:**
  1. Trong `POST /orders`:
     ```js
     const userId = (req.session && req.session.userId) ? req.session.userId : null;
     // INSERT kèm user_id
     ```
  2. Thêm `GET /api/user/orders` (bảo vệ bởi `requireUser`).

---

#### Task 2.4: Cập nhật `routes/admin.js`
- Bổ sung `is_guest` (1 nếu `user_id IS NULL`), `member_name`, `member_email`.
- Bộ lọc `?customer_type=guest` hoặc `?customer_type=member`.

---

#### Task 2.5: Đăng ký router trong `server.js`
- Thêm `app.use('/api/auth', require('./routes/auth'));`

---

### Phase 3: Frontend Storefront (`public/index.html`) (35 phút)

#### Task 3.1: Modal Xác Thực 3 Chế Độ (Đăng Nhập / Đăng Ký OTP / Đổi Pass OTP)
- **File:** `public/index.html`
- **Giao diện Modal `#auth-modal`:**
  - **Tab Đăng nhập:** Email, Mật khẩu, nút Đăng nhập, link `Quên mật khẩu?`.
  - **Tab Đăng ký (2 bước):**
    - Bước 1: Nhập Họ tên, SĐT, Email, Mật khẩu -> Nút `Nhận mã OTP qua Email`.
    - Bước 2: Hiển thị ô nhập mã xác thực (6 số) + Đếm ngược 5 phút -> Nút `Xác nhận & Tạo tài khoản`.
  - **Tab Quên / Đổi mật khẩu (2 bước):**
    - Bước 1: Nhập Email -> Nút `Gửi mã OTP`.
    - Bước 2: Nhập mã OTP 6 số + Mật khẩu mới -> Nút `Đổi mật khẩu`.

#### Task 3.2: Modal Lịch Sử Đơn Hàng Của Tôi (`#user-orders-modal`)
- Khi đăng nhập, header hiện tên khách. Bấm vào menu mở modal danh sách các đơn hàng của user, trạng thái, ngày đặt, mã đơn, và tổng tiền.

#### Task 3.3: Tự Động Điền & Phân Biệt Tại Checkout Modal
- Nếu đã đăng nhập: Tự điền họ tên, email, phone, hiện badge xanh `⭐ Thành viên: [Tên]`.
- Nếu chưa đăng nhập: Hiện badge xám `🚶 Mua hàng nhanh (Khách vãng lai)` kèm nút `[Đăng nhập]`.

---

### Phase 4: Frontend Admin Dashboard (`public/admin.html`) (20 phút)

#### Task 4.1: Nhãn Phân Loại & Bộ Lọc Khách Vãng Lai vs Thành Viên
- Card đơn hàng: Hiển thị badge `🚶 Khách vãng lai` hoặc `⭐ Thành viên: [Tên] ([email])`.
- Bộ lọc: Nút chuyển lọc `[Tất cả]` `[🚶 Vãng lai]` `[⭐ Thành viên]`.

---

## Tests & Validation Plan (TDD)

Tạo test script tự động: `scripts/test_user_otp_flow.js`

### Kịch bản kiểm thử:
1. **Test 1: Guest Checkout (Vãng lai):** Đặt đơn không session -> `orders.user_id IS NULL`.
2. **Test 2: Register with OTP:**
   - Gửi `POST /send-register-otp` với email `phuc_test@hcmute.edu.vn`.
   - Đọc mã OTP vừa sinh trong database `otp_codes`.
   - Gửi `POST /verify-register` với mã OTP đó -> Kích hoạt tài khoản, nhận session cookie.
3. **Test 3: Member Checkout:** Đặt đơn với session cookie -> `orders.user_id` khớp với user vừa tạo.
4. **Test 4: User Orders History:** Gọi `GET /user/orders` -> Trả về danh sách đơn của chính user đó.
5. **Test 5: Password Reset with OTP:**
   - Gửi `POST /send-reset-otp` cho email trên.
   - Lấy OTP từ DB.
   - Gửi `POST /reset-password` với mật khẩu mới.
   - Đăng nhập thử với mật khẩu mới -> Thành công 200 OK.
6. **Test 6: Admin Distinction:** Admin lọc đơn theo `guest` và `member` chính xác.

**Lệnh chạy kiểm thử:**
```bash
node scripts/test_user_otp_flow.js
```

---

## Risks & Tradeoffs

1. **SMTP Rate Limit / Gmail Spam Folder:**
   - Trong quá trình phát triển dev trên local, hệ thống luôn log OTP ra Terminal console. Khi deploy production chỉ cần điền `SMTP_PASS` (Gmail App Password) vào `.env` là tự động gửi email thật.
2. **Brute Force OTP:**
   - Cột `attempts` đếm số lần nhập sai. Hạn OTP 5 phút giúp hạn chế tối đa tấn công vét cạn.
