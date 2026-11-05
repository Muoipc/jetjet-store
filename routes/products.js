const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/products — chỉ lấy sản phẩm active
router.get('/products', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, category, price, duration, description, features, badge, image, stock, IF(auto_delivery_content IS NOT NULL AND auto_delivery_content != "", 1, 0) as is_digital FROM products WHERE is_active = 1 ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Products error:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách sản phẩm' });
  }
});

// GET /api/products/:id
router.get('/products/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, category, price, duration, description, features, badge, image, stock, IF(auto_delivery_content IS NOT NULL AND auto_delivery_content != "", 1, 0) as is_digital FROM products WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
