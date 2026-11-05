function requireUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Quý dzị vui lòng đăng nhập trước nghen!' });
  }
  next();
}

module.exports = { requireUser };
