// scripts/test_profile_redesign.js — Test Profile Center Redesign
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

function req(method, pathUrl, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + pathUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookie) opts.headers.Cookie = cookie;

    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          status: res.statusCode,
          data: json,
          cookie: res.headers['set-cookie']
        });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ PROFILE CENTER REDESIGN');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    // 1. Đăng nhập user test
    console.log('[1/5] Đăng nhập tài khoản test (phuc@jetjet.store)...');
    const loginRes = await req('POST', '/api/auth/login', {
      email: 'phuc@jetjet.store',
      password: '123456'
    });
    if (!loginRes.data.success) throw new Error('Đăng nhập thất bại: ' + JSON.stringify(loginRes.data));
    const userCookie = loginRes.cookie[0].split(';')[0];
    console.log('✅ [1/5] Đăng nhập thành công!');

    // 2. Kiểm tra GET /api/auth/profile
    console.log('\n[2/5] Gọi GET /api/auth/profile kiểm tra cấu trúc dữ liệu mới...');
    const profRes = await req('GET', '/api/auth/profile', null, userCookie);
    if (profRes.status !== 200 || !profRes.data.user) {
      throw new Error('API profile lỗi: ' + JSON.stringify(profRes.data));
    }
    const d = profRes.data;
    if (typeof d.stats !== 'object') throw new Error('Thiếu object stats trong profile');
    if (typeof d.stats.total_orders !== 'number') throw new Error('stats.total_orders phải là number');
    if (typeof d.stats.total_spent !== 'number') throw new Error('stats.total_spent phải là number');
    if (!Array.isArray(d.recent_orders)) throw new Error('recent_orders phải là array');
    console.log(`✅ [2/5] Profile data chuẩn xác! (Tên: ${d.user.full_name}, Tổng đơn: ${d.stats.total_orders}, Đã chi: ${d.stats.total_spent.toLocaleString()}đ, Đơn gần đây: ${d.recent_orders.length})`);

    // 3. Kiểm tra PUT /api/auth/profile
    console.log('\n[3/5] Cập nhật họ tên qua PUT /api/auth/profile...');
    const updateRes = await req('PUT', '/api/auth/profile', { full_name: 'Phúc Nguyễn Dev' }, userCookie);
    if (!updateRes.data.success) throw new Error('Cập nhật thất bại: ' + JSON.stringify(updateRes.data));
    // Hoàn nguyên lại
    await req('PUT', '/api/auth/profile', { full_name: 'Phúc' }, userCookie);
    console.log('✅ [3/5] Cập nhật và hoàn nguyên tên thành công!');

    // 4. Kiểm tra đổi mật khẩu trong profile
    console.log('\n[4/5] Đổi mật khẩu và hoàn nguyên qua POST /api/auth/change-password...');
    const cpRes = await req('POST', '/api/auth/change-password', {
      current_password: '123456',
      new_password: 'newpassword123'
    }, userCookie);
    if (!cpRes.data.success) throw new Error('Đổi mật khẩu thất bại: ' + JSON.stringify(cpRes.data));
    // Hoàn nguyên
    await req('POST', '/api/auth/change-password', {
      current_password: 'newpassword123',
      new_password: '123456'
    }, userCookie);
    console.log('✅ [4/5] Đổi mật khẩu và hoàn nguyên mật khẩu thành công!');

    // 5. Kiểm tra DOM các phần tử mới trong public/index.html
    console.log('\n[5/5] Kiểm tra cấu trúc HTML trong public/index.html...');
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const requiredElements = [
      'id="profile-avatar-monogram"',
      'id="profile-card-name"',
      'id="profile-card-email"',
      'id="stat-total-orders"',
      'id="stat-total-spent"',
      'id="stat-pending-orders"',
      'data-tab="tab-prof-info"',
      'data-tab="tab-prof-security"',
      'data-tab="tab-prof-orders"',
      'data-tab="tab-prof-danger"',
      'id="form-profile-info"',
      'id="form-profile-change-pw"',
      'id="profile-recent-orders-list"',
      'id="btn-prof-delete-account"'
    ];

    for (const el of requiredElements) {
      if (!html.includes(el)) {
        throw new Error(`Thiếu element: ${el} trong public/index.html`);
      }
    }

    // Xác nhận không còn chữ "Đã xác thực" mà chỉ có tích xanh
    if (html.includes('✓ Đã xác thực')) {
      throw new Error('Vẫn còn chữ "Đã xác thực" trong HTML!');
    }
    // Xác nhận không có chữ "Hạng thành viên" trong profile header
    if (html.includes('id="profile-card-rank"')) {
      throw new Error('Vẫn còn profile-card-rank trong HTML!');
    }

    console.log('✅ [5/5] Tất cả các elements giao diện Profile Center đều hiện diện đầy đủ và chuẩn xác!');

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('🎉 TẤT CẢ CÁC BƯỚC TEST PROFILE REDESIGN ĐỀU PASS 100%!');
    console.log('═══════════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err.message);
    process.exit(1);
  }
})();
