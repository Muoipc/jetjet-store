const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');
const { sanitize } = require('../middleware/sanitize');
const { sendOtpEmail } = require('../services/email');
const upload = require('../middleware/upload');

function requireUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập!' });
  }
  next();
}

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
  if (phone && !/^0\d{9,10}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)!' });
  }

  const cleanEmail = sanitize(email.trim().toLowerCase());
  const cleanName = sanitize(full_name.trim());
  const cleanPhone = phone ? sanitize(phone.trim()) : '';

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

    const isSmtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({
      success: true,
      message: isSmtpConfigured
        ? 'Mã xác thực đã được gửi tới email của bạn!'
        : `Mã OTP xác thực của bạn là: ${code}`,
      dev_otp: isSmtpConfigured ? null : code
    });
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

    // Double-check exist
    const [exist] = await db.execute('SELECT id FROM users WHERE email = ?', [data.email]);
    if (exist.length > 0) {
      return res.status(409).json({ error: 'Tài khoản đã tồn tại!' });
    }

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
    req.session.userAvatar = user.avatar || null;
    req.session.userPhone = user.phone;

    // Remember me: kéo dài session 30 ngày
    if (req.body.remember_me) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 ngày
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar: user.avatar || null,
        phone: user.phone
      }
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

    const isSmtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({
      success: true,
      message: isSmtpConfigured
        ? 'Đã gửi mã xác nhận đổi mật khẩu tới email của bạn!'
        : `Mã OTP đổi mật khẩu của bạn là: ${code}`,
      dev_otp: isSmtpConfigured ? null : code
    });
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
  req.session.userAvatar = null;
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
        avatar: req.session.userAvatar || null,
        phone: req.session.userPhone
      }
    });
  }
  res.json({ loggedIn: false });
});

// 8. Xem hồ sơ chi tiết & thống kê người dùng
router.get('/profile', requireUser, async (req, res) => {
  try {
    const [userRows] = await db.execute(
      'SELECT id, email, full_name, avatar, created_at FROM users WHERE id = ?',
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

// 12. Cập nhật ảnh đại diện
router.post('/avatar', requireUser, upload.uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng chọn file ảnh đại diện!' });
  }
  const avatarUrl = `/uploads/${req.file.filename}`;
  try {
    await db.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.session.userId]);
    req.session.userAvatar = avatarUrl;
    res.json({
      success: true,
      avatar: avatarUrl,
      message: 'Đổi ảnh đại diện thành công!'
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Lỗi cập nhật ảnh đại diện!' });
  }
});

// 13. Xóa ảnh đại diện (quay về dùng chữ cái đầu)
router.delete('/avatar', requireUser, async (req, res) => {
  try {
    await db.execute('UPDATE users SET avatar = NULL WHERE id = ?', [req.session.userId]);
    req.session.userAvatar = null;
    res.json({
      success: true,
      message: 'Đã xóa ảnh đại diện, chuyển sang dùng chữ cái đầu!'
    });
  } catch (err) {
    console.error('Avatar delete error:', err);
    res.status(500).json({ error: 'Lỗi xóa ảnh đại diện!' });
  }
});

module.exports = router;
