function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn!' });
  }
  next();
}
module.exports = { requireAdmin };
