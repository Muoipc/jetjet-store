const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 150,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu, vui lòng đợi 15 phút.' }
});

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: parseInt(process.env.ORDER_LIMIT_MAX, 10) || 50,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Quý dzị đặt đơn lẹ quá rồi nè, đợi 10 phút!' }
});

module.exports = { globalLimiter, orderLimiter };
