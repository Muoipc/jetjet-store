const express = require('express');
const router = express.Router();
const db = require('../database');
const { sanitize } = require('../middleware/sanitize');
const { orderLimiter } = require('../middleware/rateLimiter');
const { requireUser } = require('../middleware/userAuth');
const { sendOrderEmail } = require('../services/email');
const { createNotification } = require('../services/notification');

// Generate order code: JJ + YYMMDDHHNN (fixes B5)
function generateOrderCode() {
  const d = new Date();
  const parts = [
    String(d.getFullYear()).slice(-2),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(Math.floor(Math.random() * 100)).padStart(2, '0')
  ];
  return 'JJ' + parts.join('');
}

// POST /api/orders
router.post('/orders', orderLimiter, async (req, res) => {
  const userId = (req.session && req.session.userId) ? req.session.userId : null;

  let { customer_name, customer_email, customer_phone, notes, items } = req.body;

  // Lấy thông tin user nếu đã đăng nhập và client không gửi đủ
  if (userId && (!customer_name || !customer_email || !customer_phone)) {
    const [userRows] = await db.execute('SELECT full_name, email, phone FROM users WHERE id = ?', [userId]);
    if (userRows.length) {
      customer_name = customer_name || userRows[0].full_name;
      customer_email = customer_email || userRows[0].email;
      customer_phone = customer_phone || userRows[0].phone;
    }
  }

  // Validate
  const finalName = (customer_name && customer_name.trim()) ? customer_name.trim() : 'Học viên JetJet';
  if (!customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim()))
    return res.status(400).json({ error: 'Email Google nhận tài liệu không hợp lệ' });
  if (customer_phone && customer_phone.trim() && !/^0\d{9,10}$/.test(customer_phone.trim()))
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ (bắt đầu 0, 10-11 số)' });
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Giỏ hàng đang trống' });

  const cleanName = sanitize(finalName);
  const cleanEmail = sanitize(customer_email.trim());
  const cleanPhone = (customer_phone && customer_phone.trim()) ? sanitize(customer_phone.trim()) : '';
  const cleanNotes = sanitize(notes || '');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Fixes B1+B2+B3: lookup DB price, check existence + stock
    let totalPrice = 0;
    const validated = [];

    for (const item of items) {
      const [rows] = await conn.execute(
        'SELECT id, name, price, stock FROM products WHERE id = ? AND is_active = 1 FOR UPDATE',
        [item.id]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(400).json({ error: `Sản phẩm ID ${item.id} không tồn tại hoặc đã ngưng bán` });
      }

      const product = rows[0];
      const qty = Math.max(1, parseInt(item.quantity) || 1);

      // Fixes B3: stock check
      if (product.stock < qty) {
        await conn.rollback();
        return res.status(400).json({
          error: `"${product.name}" chỉ còn ${product.stock} món, quý dzị đặt ${qty} là hổng đủ!`
        });
      }

      // Fixes B1: dùng product.price từ DB, BỎ QUA item.price từ client
      totalPrice += product.price * qty;
      validated.push({ product_id: product.id, product_name: product.name, price: product.price, quantity: qty });
    }

    // Fixes B5: order_code thay orderId
    let orderCode;
    for (let i = 0; i < 10; i++) {
      orderCode = generateOrderCode();
      const [dup] = await conn.execute('SELECT id FROM orders WHERE order_code = ?', [orderCode]);
      if (!dup.length) break;
    }

    // Check if user is logged in
    const userId = (req.session && req.session.userId) ? req.session.userId : null;

    // INSERT order
    const [result] = await conn.execute(
      `INSERT INTO orders (user_id, order_code, customer_name, customer_email, customer_phone, notes, total_price, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, orderCode, cleanName, cleanEmail, cleanPhone, cleanNotes, totalPrice]
    );
    const orderId = result.insertId;

    // Fixes F2: INSERT order_items + deduct stock
    for (const v of validated) {
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderId, v.product_id, v.product_name, v.price, v.quantity]
      );
      await conn.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [v.quantity, v.product_id]);
    }

    await conn.commit();
    console.log(`📦 Đơn ${orderCode} — ${totalPrice.toLocaleString('vi-VN')}đ`);

    // Gửi email xác nhận đơn (fire-and-forget)
    sendOrderEmail(cleanEmail, orderCode, 'created').catch(() => {});

    res.json({
      success: true,
      orderId,
      order_code: orderCode,
      customer_name: cleanName,
      total_price: totalPrice,
      created_at: new Date().toISOString(),
      payment: {
        bankName: 'MB Bank (Ngân hàng Quân Đội)',
        accountNumber: '241620968888',
        accountName: 'NGUYEN SONG HOANG PHUC',
        amount: totalPrice,
        content: `JETJET ${orderCode}`,
        qrUrl: `https://img.vietqr.io/image/mbbank-241620968888-compact2.png?amount=${totalPrice}&addInfo=JETJET%20${orderCode}&accountName=NGUYEN%20SONG%20HOANG%20PHUC`
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Order error:', err);
    res.status(500).json({ error: 'Không thể xử lý đơn hàng lúc này' });
  } finally {
    conn.release();
  }
});

// GET /api/orders/:code — Fixes F1: tra cứu đơn
router.get('/orders/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!/^JJ\d{8,12}$/.test(code))
    return res.status(400).json({ error: 'Mã đơn không hợp lệ (format: JJxxxxxxxx)' });

  try {
    const [orders] = await db.execute(
      'SELECT id, order_code, customer_name, customer_email, customer_phone, total_price, status, delivery_data, delivered_at, payment_confirmed_at, created_at FROM orders WHERE order_code = ?',
      [code]
    );
    if (!orders.length) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    const order = orders[0];
    const [items] = await db.execute('SELECT product_name, price, quantity FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ ...order, items });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

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
      'SELECT id, order_code, status, user_id FROM orders WHERE order_code = ? FOR UPDATE',
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

    if (order.user_id) {
      await createNotification(order.user_id, 'order_cancelled', 'Bạn đã hủy đơn', 'Đơn ' + order.order_code + ' đã hủy thành công.', order.order_code);
    }

    res.json({ success: true, message: 'Đã hủy đơn hàng thành công, số lượng tồn kho đã được hoàn lại!' });
  } catch (err) {
    await conn.rollback();
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Lỗi server khi hủy đơn' });
  } finally {
    conn.release();
  }
});

// GET /api/user/orders — Lịch sử đơn hàng của thành viên
router.get('/user/orders', requireUser, async (req, res) => {
  try {
    const userId = req.session.userId;
    const [orders] = await db.execute(
      'SELECT id, order_code, customer_name, customer_email, customer_phone, total_price, status, delivery_data, delivered_at, payment_confirmed_at, created_at FROM orders WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );

    for (const order of orders) {
      const [items] = await db.execute(
        'SELECT product_name, price, quantity FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (err) {
    console.error('Fetch user orders error:', err);
    res.status(500).json({ error: 'Không thể lấy lịch sử đơn hàng' });
  }
});

module.exports = router;
