const db = require('../database');

async function createNotification(userId, type, title, message, orderCode = null) {
  if (!userId) return;
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
