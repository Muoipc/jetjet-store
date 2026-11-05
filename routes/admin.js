const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendOrderEmail } = require('../services/email');
const { createNotification } = require('../services/notification');

// ══ AUTH (Fixes F6) ══

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Thiếu username hoặc password' });

  try {
    const [rows] = await db.execute('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu!' });

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu!' });

    req.session.adminId = admin.id;
    req.session.adminName = admin.display_name || admin.username;
    res.json({ success: true, admin: { id: admin.id, username: admin.username, display_name: admin.display_name } });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ adminId: req.session.adminId, adminName: req.session.adminName });
});

// ══ STATS (Fixes F8) ══

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [[{ totalOrders }]] = await db.execute('SELECT COUNT(*) as totalOrders FROM orders');
    const [[{ pendingOrders }]] = await db.execute("SELECT COUNT(*) as pendingOrders FROM orders WHERE status = 'pending'");
    const [[{ revenue }]] = await db.execute("SELECT COALESCE(SUM(total_price), 0) as revenue FROM orders WHERE status IN ('paid','processing','completed')");
    const [[{ activeProducts }]] = await db.execute('SELECT COUNT(*) as activeProducts FROM products WHERE is_active = 1');
    const [[{ cancelledOrders }]] = await db.execute("SELECT COUNT(*) as cancelledOrders FROM orders WHERE status = 'cancelled'");
    const [[{ totalUsers }]] = await db.execute('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ memberOrdersCount }]] = await db.execute('SELECT COUNT(*) as memberOrdersCount FROM orders WHERE user_id IS NOT NULL');
    const [[{ guestOrdersCount }]] = await db.execute('SELECT COUNT(*) as guestOrdersCount FROM orders WHERE user_id IS NULL');

    const [dailyOrders] = await db.execute(`
      SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue
      FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at) ORDER BY date ASC
    `);

    res.json({ totalOrders, pendingOrders, revenue, activeProducts, cancelledOrders, totalUsers, memberOrdersCount, guestOrdersCount, dailyOrders });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thống kê' });
  }
});

// ══ ORDERS (Fixes F3: thêm processing/cancelled, F7: filter) ══

router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    if (req.query.status && req.query.status !== 'all') {
      conditions.push('o.status = ?');
      params.push(req.query.status);
    }
    if (req.query.customer_type === 'guest') {
      conditions.push('o.user_id IS NULL');
    } else if (req.query.customer_type === 'member') {
      conditions.push('o.user_id IS NOT NULL');
    }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    const [orders] = await db.execute(`
      SELECT o.*, u.email as member_email, u.full_name as member_name, IF(o.user_id IS NULL, 1, 0) as is_guest,
             GROUP_CONCAT(CONCAT(oi.product_name, ' (x', oi.quantity, ')') SEPARATOR ', ') as items_summary
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${where} GROUP BY o.id ORDER BY o.id DESC
    `, params);

    for (const o of orders) {
      const [items] = await db.execute('SELECT product_name, price, quantity FROM order_items WHERE order_id = ?', [o.id]);
      o.items = items;
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn đơn' });
  }
});

router.patch('/orders/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'paid', 'processing', 'completed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  try {
    const [orderRows] = await db.execute('SELECT user_id, order_code FROM orders WHERE id = ?', [req.params.id]);
    if (!orderRows.length) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    const order = orderRows[0];

    // Fixes F3: hủy đơn → hoàn stock
    if (status === 'cancelled') {
      const [items] = await db.execute('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [req.params.id]);
      for (const item of items) {
        if (item.product_id) await db.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }

    let extra = status === 'paid' ? ', payment_confirmed_at = NOW()' : '';
    await db.execute(`UPDATE orders SET status = ?${extra} WHERE id = ?`, [status, req.params.id]);

    if (status === 'paid' && order.user_id) {
      await createNotification(order.user_id, 'order_paid', 'Đã nhận thanh toán', `Đơn ${order.order_code} đã xác nhận thanh toán thành công.`, order.order_code);
    }
    if (status === 'cancelled' && order.user_id) {
      await createNotification(order.user_id, 'order_cancelled', 'Đơn hàng đã hủy', `Đơn ${order.order_code} đã bị hủy.`, order.order_code);
    }

    res.json({ success: true, orderId: req.params.id, newStatus: status });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật' });
  }
});

// PATCH /api/admin/orders/:id/deliver — Bàn giao tài khoản/license cho khách
router.patch('/orders/:id/deliver', requireAdmin, async (req, res) => {
  const { delivery_data } = req.body;
  if (!delivery_data || !delivery_data.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập thông tin tài khoản hoặc license bàn giao cho khách!' });
  }

  try {
    const [orderRows] = await db.execute('SELECT user_id, order_code, customer_email FROM orders WHERE id = ?', [req.params.id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }
    const order = orderRows[0];

    const [result] = await db.execute(
      `UPDATE orders SET status = 'completed', delivery_data = ?, delivered_at = NOW() WHERE id = ?`,
      [delivery_data.trim(), req.params.id]
    );

    if (order.user_id) {
      await createNotification(order.user_id, 'order_delivered', 'Đã giao tài khoản', `Đơn ${order.order_code} đã được giao. Vào "Đơn hàng của tôi" để xem chi tiết.`, order.order_code);
    }

    if (order.customer_email) {
      sendOrderEmail(order.customer_email, order.order_code, 'delivered', {
        delivery_info: delivery_data.trim()
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Đã bàn giao tài khoản thành công cho khách!' });
  } catch (err) {
    console.error('Deliver order error:', err);
    res.status(500).json({ error: 'Lỗi server khi bàn giao tài khoản' });
  }
});

// ══ PRODUCTS CRUD (Fixes F4: stock, F5: soft delete) ══

router.get('/products', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM products ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải sản phẩm' });
  }
});

router.post('/products', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, category, price, duration, description, features, badge, stock, auto_delivery_content } = req.body;
  if (!name || !price || !category) return res.status(400).json({ error: 'Thiếu Tên, Giá, hoặc Danh mục' });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.image || '');
  let featuresJson = '[]';
  try {
    if (Array.isArray(features)) featuresJson = JSON.stringify(features);
    else if (typeof features === 'string') featuresJson = features.startsWith('[') ? features : JSON.stringify(features.split('\n').filter(Boolean));
  } catch(e) {}

  try {
    const [r] = await db.execute(
      'INSERT INTO products (name, category, price, duration, description, features, badge, image, stock, auto_delivery_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), category.trim(), parseInt(price, 10), (duration || '1 Tháng').trim(), description || '', featuresJson, badge || '', imageUrl, parseInt(stock, 10) || 10, (auto_delivery_content || '').trim() || null]
    );
    res.json({ success: true, id: r.insertId, image: imageUrl });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thêm sản phẩm' });
  }
});

router.put('/products/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, category, price, duration, description, features, badge, stock, auto_delivery_content } = req.body;
  if (!name || !price || !category) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  let featuresJson = '[]';
  try {
    if (Array.isArray(features)) featuresJson = JSON.stringify(features);
    else if (typeof features === 'string') featuresJson = features.startsWith('[') ? features : JSON.stringify(features.split('\n').filter(Boolean));
  } catch(e) {}

  try {
    let q, p;
    const cleanAuto = (auto_delivery_content || '').trim() || null;
    if (req.file) {
      q = 'UPDATE products SET name = ?, category = ?, price = ?, duration = ?, description = ?, features = ?, badge = ?, image = ?, stock = ?, auto_delivery_content = ? WHERE id = ?';
      p = [name.trim(), category.trim(), parseInt(price, 10), (duration || '1 Tháng').trim(), description || '', featuresJson, badge || '', `/uploads/${req.file.filename}`, parseInt(stock, 10) || 0, cleanAuto, req.params.id];
    } else {
      q = 'UPDATE products SET name = ?, category = ?, price = ?, duration = ?, description = ?, features = ?, badge = ?, stock = ?, auto_delivery_content = ? WHERE id = ?';
      p = [name.trim(), category.trim(), parseInt(price, 10), (duration || '1 Tháng').trim(), description || '', featuresJson, badge || '', parseInt(stock, 10) || 0, cleanAuto, req.params.id];
    }
    const [r] = await db.execute(q, p);
    if (!r.affectedRows) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật' });
  }
});

// Fixes F5: soft delete
router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const [r] = await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, message: 'Đã ẩn sản phẩm!' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa' });
  }
});

// Fixes F4: cập nhật tồn kho nhanh
router.patch('/products/:id/stock', requireAdmin, async (req, res) => {
  const { stock } = req.body;
  if (stock === undefined || stock < 0) return res.status(400).json({ error: 'Stock không hợp lệ' });
  try {
    const [r] = await db.execute('UPDATE products SET stock = ? WHERE id = ?', [parseInt(stock, 10), req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ success: true, newStock: parseInt(stock, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật stock' });
  }
});

// Fixes F9: payment logs
router.get('/payment-logs', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT pl.*, o.order_code FROM payment_logs pl
      LEFT JOIN orders o ON pl.matched_order_id = o.id
      ORDER BY pl.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi payment logs' });
  }
});

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

module.exports = router;
