// scripts/test_avatar_upload.js — Test Avatar Upload & Delete
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

function postLogin(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: JSON.parse(body),
          cookie: res.headers['set-cookie']
        });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function uploadAvatar(cookie, buffer, filename = 'avatar_test.png') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    let payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const req = http.request(`${BASE}/api/auth/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        'Cookie': cookie
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: JSON.parse(body) });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function deleteAvatar(cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}/api/auth/avatar`, {
      method: 'DELETE',
      headers: { 'Cookie': cookie }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function getProfile(cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}/api/auth/profile`, {
      method: 'GET',
      headers: { 'Cookie': cookie }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TÍNH NĂNG ĐỔI ẢNH ĐẠI DIỆN (AVATAR)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    // 1. Login
    console.log('[1/5] Đăng nhập user test (phuc@jetjet.store)...');
    const login = await postLogin('phuc@jetjet.store', '123456');
    if (!login.data.success) throw new Error('Đăng nhập thất bại');
    const cookie = login.cookie[0].split(';')[0];
    console.log('✅ [1/5] Đăng nhập thành công!');

    // 2. Upload avatar (tạo buffer 1x1 png mẫu)
    console.log('\n[2/5] Upload ảnh đại diện qua POST /api/auth/avatar...');
    // 1x1 pixel transparent PNG
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const upRes = await uploadAvatar(cookie, pngBuffer, 'test_avatar.png');
    if (upRes.status !== 200 || !upRes.data.success) {
      throw new Error('Upload thất bại: ' + JSON.stringify(upRes.data));
    }
    const avatarUrl = upRes.data.avatar;
    console.log(`✅ [2/5] Upload thành công! URL: ${avatarUrl}`);

    // Kiểm tra file trên đĩa
    const filePath = path.join(__dirname, '..', 'public', avatarUrl.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại trên đĩa: ${filePath}`);
    }
    console.log(`✅ File đã được lưu an toàn tại: ${filePath}`);

    // 3. Kiểm tra GET /api/auth/profile trả về avatar
    console.log('\n[3/5] Kiểm tra GET /api/auth/profile trả về avatar mới...');
    const profRes = await getProfile(cookie);
    if (profRes.data.user.avatar !== avatarUrl) {
      throw new Error(`Avatar không khớp: expected ${avatarUrl}, got ${profRes.data.user.avatar}`);
    }
    console.log('✅ [3/5] Profile API trả về chính xác avatar URL!');

    // 4. Xóa avatar
    console.log('\n[4/5] Gỡ ảnh đại diện qua DELETE /api/auth/avatar...');
    const delRes = await deleteAvatar(cookie);
    if (!delRes.data.success) throw new Error('Xóa avatar thất bại: ' + JSON.stringify(delRes.data));
    const profAfterDel = await getProfile(cookie);
    if (profAfterDel.data.user.avatar !== null) {
      throw new Error('Avatar sau khi xóa phải là null');
    }
    console.log('✅ [4/5] Gỡ ảnh đại diện thành công, user chuyển sang null!');

    // Dọn dẹp file test
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // 5. Kiểm tra DOM elements
    console.log('\n[5/5] Kiểm tra DOM elements trong public/index.html...');
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const required = [
      'id="btn-change-avatar"',
      'id="avatar-file-input"',
      'id="btn-remove-avatar"',
      'id="profile-avatar-monogram"'
    ];
    for (const id of required) {
      if (!html.includes(id)) throw new Error(`Thiếu element: ${id}`);
    }
    console.log('✅ [5/5] Giao diện chứa đầy đủ các nút đổi ảnh, input chọn file và gỡ ảnh!');

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('🎉 TẤT CẢ 5/5 BƯỚC TEST TÍNH NĂNG ĐỔI ẢNH ĐẠI DIỆN ĐỀU PASS 100%!');
    console.log('═══════════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err.message);
    process.exit(1);
  }
})();
