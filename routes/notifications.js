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
