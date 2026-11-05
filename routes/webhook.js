const express = require('express');
const router = express.Router();
const db = require('../database');
const { createNotification } = require('../services/notification');

router.post('/casso', async (req, res) => {
  try {
    const secret = process.env.CASSO_WEBHOOK_SECRET;
    const incomingToken = req.headers['secure-token'] || req.headers['x-webhook-secret'];
    if (secret && incomingToken !== secret) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    const txns = req.body.data || [];
    if (!Array.isArray(txns) || !txns.length) return res.json({ success: true, matched: 0 });

    let matched = 0;
    for (const txn of txns) {
      const desc = (txn.description || '').toUpperCase();
      const amount = parseInt(txn.amount, 10) || 0;
      const tid = txn.tid || txn.transaction_id || '';

      const m = desc.match(/(JJ\d{8,12})/i);

      if (m) {
        const code = m[1];
        const [orders] = await db.execute("SELECT id, user_id, order_code, total_price FROM orders WHERE order_code = ? AND status = 'pending'", [code]);

        if (orders.length && amount >= orders[0].total_price) {
          const order = orders[0];
          await db.execute("UPDATE orders SET status = 'paid', payment_confirmed_at = NOW() WHERE id = ?", [order.id]);
          console.log(`💰 Auto-paid ${code}: ${amount.toLocaleString('vi-VN')}đ`);
          matched++;

          if (order.user_id) {
            await createNotification(order.user_id, 'order_paid', 'Đã nhận thanh toán', `Đơn ${order.order_code} thanh toán thành công qua chuyển khoản.`, order.order_code);
          }

          // Kiểm tra và tự động bàn giao sản phẩm số (Zero-Touch Fulfillment)
          const [items] = await db.execute(`
            SELECT oi.product_id, oi.product_name, oi.quantity, p.category, p.auto_delivery_content
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
          `, [order.id]);

          const digitalItems = items.filter(i => i.auto_delivery_content && i.auto_delivery_content.trim());
          const hasManualAcc = items.some(i => 
            !i.auto_delivery_content || 
            !i.auto_delivery_content.trim() || 
            (i.category && i.category.toLowerCase().includes('combo'))
          );

          if (digitalItems.length > 0) {
            const deliveryText = digitalItems.map(i => i.auto_delivery_content.trim()).join('\n\n═══════════════════════════\n\n');

            if (!hasManualAcc) {
              // 100% Khóa học / Sản phẩm số -> Tự động hoàn tất & giao link ngay!
              await db.execute(
                "UPDATE orders SET status = 'completed', delivery_data = ?, delivered_at = NOW() WHERE id = ?",
                [deliveryText, order.id]
              );
              console.log(`🚀 Zero-Touch Fulfillment: Đơn số ${code} đã tự động giao link tài liệu!`);
              if (order.user_id) {
                await createNotification(order.user_id, 'order_completed', 'Đã giao tài liệu số', `Đơn ${order.order_code} đã được tự động bàn giao link tài liệu thành công.`, order.order_code);
              }
            } else {
              // Đơn Combo -> Bàn giao trước link số, chuyển sang 'processing' để Admin cấp tài khoản
              await db.execute(
                "UPDATE orders SET status = 'processing', delivery_data = ? WHERE id = ?",
                [deliveryText, order.id]
              );
              console.log(`📦 Bàn giao trước phần khóa học cho đơn Combo ${code}`);
              if (order.user_id) {
                await createNotification(order.user_id, 'order_processing', 'Đang xử lý tài khoản', `Đơn Combo ${order.order_code} đã nhận tài liệu số, admin đang chuẩn bị tài khoản AI.`, order.order_code);
              }
            }
          }
        }

        await db.execute(
          'INSERT INTO payment_logs (transaction_id, amount, description, bank_ref, matched_order_id, matched_order_code, raw_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [tid, amount, desc, txn.bank_ref || '', orders[0]?.id || null, code, JSON.stringify(txn)]
        );
      } else {
        await db.execute(
          'INSERT INTO payment_logs (transaction_id, amount, description, raw_data) VALUES (?, ?, ?, ?)',
          [tid, amount, desc, JSON.stringify(txn)]
        );
      }
    }

    res.json({ success: true, matched });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

module.exports = router;
