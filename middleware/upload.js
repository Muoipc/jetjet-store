const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ai_${Date.now()}_${Math.round(Math.random()*1e5)}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'].includes(file.mimetype);
    cb(ok ? null : new Error('Chỉ cho phép ảnh JPG/PNG/WEBP/GIF/SVG!'), ok);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${Date.now()}_${Math.round(Math.random()*1e5)}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Chỉ cho phép ảnh JPG/PNG/WEBP/GIF!'), ok);
  },
  limits: { fileSize: 3 * 1024 * 1024 }
});

upload.uploadAvatar = uploadAvatar;
module.exports = upload;
