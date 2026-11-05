const http = require('http');
const assert = require('assert');
const bcrypt = require('bcrypt');
const db = require('../database');

const BASE_HOST = '127.0.0.1';
const BASE_PORT = process.env.PORT || 3000;

function request(options, data) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const reqOptions = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      ...options,
      headers: defaultHeaders
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = body ? JSON.parse(body) : {};
        } catch (e) {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          rawBody: body
        });
      });
    });

    req.on('error', reject);
    if (data !== undefined && data !== null) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function extractCookie(res) {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie || !setCookie.length) return null;
  return setCookie[0].split(';')[0];
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TÍNH NĂNG TÀI KHOẢN & BROADCAST NOTIF');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const testEmail = `test_acc_${Date.now()}@jetjet.store`;
  const initPassword = 'password123';
  const newPassword = 'newpassword456';
  const initName = 'Nguyễn Văn Test';
  const updatedName = 'Nguyễn Văn Test VIP';

  // [Setup] Tạo user thử nghiệm trực tiếp trong DB
  const passHash = await bcrypt.hash(initPassword, 10);
  const [insertUser] = await db.execute(
    'INSERT INTO users (email, password_hash, full_name, phone) VALUES (?, ?, ?, ?)',
    [testEmail, passHash, initName, '0987654321']
  );
  const userId = insertUser.insertId;
  console.log(`[Setup] Tạo user test ID: ${userId}, Email: ${testEmail}\n`);

  let userCookie = null;
  let adminCookie = null;
  let broadcastPromoId = null;

  try {
    // 1. User login with remember_me: true
    console.log('[1/10] User login với remember_me: true...');
    const loginRes = await request({
      path: '/api/auth/login',
      method: 'POST'
    }, {
      email: testEmail,
      password: initPassword,
      remember_me: true
    });

    assert.strictEqual(loginRes.status, 200, `Login failed: ${loginRes.rawBody}`);
    assert.strictEqual(loginRes.data.success, true);
    userCookie = extractCookie(loginRes);
    assert(userCookie, 'Phải có session cookie trong phản hồi login');

    const setCookieHeader = (loginRes.headers['set-cookie'] || []).join('; ');
    assert(
      setCookieHeader.toLowerCase().includes('expires=') || setCookieHeader.toLowerCase().includes('max-age='),
      'Cookie phải chứa thuộc tính Expires hoặc Max-Age khi remember_me: true'
    );
    console.log('✅ [1/10] User login with remember_me: true thành công!');

    // 2. GET /api/auth/profile
    console.log('\n[2/10] GET /api/auth/profile...');
    const profRes = await request({
      path: '/api/auth/profile',
      method: 'GET',
      headers: { 'Cookie': userCookie }
    });

    assert.strictEqual(profRes.status, 200, `Get profile failed: ${profRes.rawBody}`);
    assert(profRes.data.user, 'Đối tượng user phải tồn tại');
    assert.strictEqual(profRes.data.user.id, userId);
    assert.strictEqual(profRes.data.user.email, testEmail);
    assert.strictEqual(profRes.data.user.full_name, initName);
    assert(profRes.data.user.created_at, 'Phải có trường created_at');
    console.log(`✅ [2/10] GET /api/auth/profile: PASS (${profRes.data.user.email} - ${profRes.data.user.full_name})`);

    // 3. PUT /api/auth/profile (update name and verify)
    console.log('\n[3/10] PUT /api/auth/profile (cập nhật tên và kiểm tra lại)...');
    const putProfRes = await request({
      path: '/api/auth/profile',
      method: 'PUT',
      headers: { 'Cookie': userCookie }
    }, { full_name: updatedName });

    assert.strictEqual(putProfRes.status, 200, `Update profile failed: ${putProfRes.rawBody}`);
    assert.strictEqual(putProfRes.data.success, true);
    assert.strictEqual(putProfRes.data.full_name, updatedName);

    // Verify qua GET profile
    const verifyProfRes = await request({
      path: '/api/auth/profile',
      method: 'GET',
      headers: { 'Cookie': userCookie }
    });
    assert.strictEqual(verifyProfRes.data.user.full_name, updatedName);
    console.log(`✅ [3/10] PUT /api/auth/profile: PASS (Đã đổi tên thành "${updatedName}")`);

    // 4. POST /api/auth/change-password (change & revert)
    console.log('\n[4/10] POST /api/auth/change-password (đổi và hoàn nguyên)...');
    const changePwRes = await request({
      path: '/api/auth/change-password',
      method: 'POST',
      headers: { 'Cookie': userCookie }
    }, {
      current_password: initPassword,
      new_password: newPassword
    });

    assert.strictEqual(changePwRes.status, 200, `Change password failed: ${changePwRes.rawBody}`);
    assert.strictEqual(changePwRes.data.success, true);

    // Kiểm tra login được với mật khẩu mới
    const loginNewRes = await request({
      path: '/api/auth/login',
      method: 'POST'
    }, {
      email: testEmail,
      password: newPassword
    });
    assert.strictEqual(loginNewRes.status, 200, 'Phải login được bằng mật khẩu mới');
    userCookie = extractCookie(loginNewRes);

    // Hoàn nguyên về initPassword
    const revertPwRes = await request({
      path: '/api/auth/change-password',
      method: 'POST',
      headers: { 'Cookie': userCookie }
    }, {
      current_password: newPassword,
      new_password: initPassword
    });
    assert.strictEqual(revertPwRes.status, 200, `Revert password failed: ${revertPwRes.rawBody}`);
    assert.strictEqual(revertPwRes.data.success, true);
    console.log('✅ [4/10] POST /api/auth/change-password (change & revert): PASS');

    // 5. Verify wrong password rejected on change-password
    console.log('\n[5/10] Kiểm tra từ chối sai mật khẩu cũ trên change-password...');
    const wrongPwRes = await request({
      path: '/api/auth/change-password',
      method: 'POST',
      headers: { 'Cookie': userCookie }
    }, {
      current_password: 'definitely_wrong_pwd',
      new_password: 'validNewPassword123'
    });

    assert.strictEqual(wrongPwRes.status, 401, 'Sai mật khẩu phải trả về 401');
    assert(wrongPwRes.data.error, 'Phải có thông báo lỗi');
    console.log(`✅ [5/10] Verify wrong password rejected on change-password: PASS (${wrongPwRes.data.error})`);

    // 6. Admin login & POST /api/admin/broadcast
    console.log('\n[6/10] Admin login & POST /api/admin/broadcast...');
    const adminLoginRes = await request({
      path: '/api/admin/login',
      method: 'POST'
    }, {
      username: 'admin',
      password: 'phucdeptrai123'
    });

    assert.strictEqual(adminLoginRes.status, 200, `Admin login failed: ${adminLoginRes.rawBody}`);
    adminCookie = extractCookie(adminLoginRes);
    assert(adminCookie, 'Phải có admin cookie');

    const promoTitle = `🔥 Flash Sale Đặc Biệt #${Date.now()}`;
    const promoMessage = 'Giảm giá 50% tất cả gói tài khoản AI trong 24h!';
    const broadcastRes = await request({
      path: '/api/admin/broadcast',
      method: 'POST',
      headers: { 'Cookie': adminCookie }
    }, {
      title: promoTitle,
      message: promoMessage
    });

    assert.strictEqual(broadcastRes.status, 200, `Broadcast failed: ${broadcastRes.rawBody}`);
    assert.strictEqual(broadcastRes.data.success, true);
    assert(broadcastRes.data.sent >= 1, 'Số lượng thông báo đã gửi phải >= 1');
    console.log(`✅ [6/10] Admin login & POST /api/admin/broadcast: PASS (sent: ${broadcastRes.data.sent})`);

    // 7. User GET /api/notifications (verify broadcast promo notification received, unread_count >= 1)
    console.log('\n[7/10] User GET /api/notifications (kiểm tra nhận được broadcast promo, unread_count >= 1)...');
    const notifRes = await request({
      path: '/api/notifications',
      method: 'GET',
      headers: { 'Cookie': userCookie }
    });

    assert.strictEqual(notifRes.status, 200, `Get notifications failed: ${notifRes.rawBody}`);
    assert(Array.isArray(notifRes.data.notifications), 'Danh sách thông báo phải là mảng');
    assert(notifRes.data.unread_count >= 1, 'unread_count phải >= 1');

    const promoNotif = notifRes.data.notifications.find(n => n.title === promoTitle);
    assert(promoNotif, `Phải tìm thấy thông báo "${promoTitle}"`);
    assert.strictEqual(promoNotif.type, 'promo');
    broadcastPromoId = promoNotif.id;
    console.log(`✅ [7/10] User GET /api/notifications: PASS (Tìm thấy promo ID ${broadcastPromoId}, unread_count: ${notifRes.data.unread_count})`);

    // 8. User PATCH /api/notifications/:id/read
    console.log(`\n[8/10] User PATCH /api/notifications/${broadcastPromoId}/read...`);
    const markReadRes = await request({
      path: `/api/notifications/${broadcastPromoId}/read`,
      method: 'PATCH',
      headers: { 'Cookie': userCookie }
    });

    assert.strictEqual(markReadRes.status, 200, `Mark read failed: ${markReadRes.rawBody}`);
    assert.strictEqual(markReadRes.data.success, true);

    const checkReadRes = await request({
      path: '/api/notifications',
      method: 'GET',
      headers: { 'Cookie': userCookie }
    });
    const updatedNotif = checkReadRes.data.notifications.find(n => n.id === broadcastPromoId);
    assert.strictEqual(updatedNotif.is_read, 1, 'is_read phải bằng 1 sau khi patch');
    console.log(`✅ [8/10] User PATCH /api/notifications/:id/read: PASS (is_read: ${updatedNotif.is_read})`);

    // 9. User POST /api/notifications/read-all
    console.log('\n[9/10] User POST /api/notifications/read-all...');
    const readAllRes = await request({
      path: '/api/notifications/read-all',
      method: 'POST',
      headers: { 'Cookie': userCookie }
    });

    assert.strictEqual(readAllRes.status, 200, `Read all failed: ${readAllRes.rawBody}`);
    assert.strictEqual(readAllRes.data.success, true);

    const checkAllRes = await request({
      path: '/api/notifications',
      method: 'GET',
      headers: { 'Cookie': userCookie }
    });
    assert.strictEqual(checkAllRes.data.unread_count, 0, 'unread_count phải bằng 0 sau khi read-all');
    console.log('✅ [9/10] User POST /api/notifications/read-all: PASS (unread_count = 0)');

    // 10. POST /api/auth/delete-account with wrong password rejected
    console.log('\n[10/10] POST /api/auth/delete-account with wrong password rejected...');
    const wrongDelRes = await request({
      path: '/api/auth/delete-account',
      method: 'POST',
      headers: { 'Cookie': userCookie }
    }, {
      password: 'wrong_password_cannot_delete'
    });

    assert.strictEqual(wrongDelRes.status, 401, 'Sai mật khẩu xóa tài khoản phải trả về 401');
    assert(wrongDelRes.data.error, 'Phải có thông báo lỗi');

    // Kiểm tra tài khoản vẫn còn nguyên
    const verifyStillAlive = await request({
      path: '/api/auth/profile',
      method: 'GET',
      headers: { 'Cookie': userCookie }
    });
    assert.strictEqual(verifyStillAlive.status, 200);
    assert.strictEqual(verifyStillAlive.data.user.email, testEmail);
    console.log(`✅ [10/10] POST /api/auth/delete-account with wrong password rejected: PASS (${wrongDelRes.data.error})`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('🎉 TẤT CẢ 10/10 BƯỚC TEST TÍNH NĂNG TÀI KHOẢN & NOTIFICATIONS PASS!');
    console.log('═══════════════════════════════════════════════════════════════════\n');
  } finally {
    // Dọn dẹp test data
    try {
      await db.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM users WHERE id = ?', [userId]);
      console.log(`[Cleanup] Đã dọn dẹp user test ${testEmail} và dữ liệu liên quan.`);
    } catch (e) {
      console.error('[Cleanup Error]:', e);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ TEST THẤT BẠI:', err);
    process.exit(1);
  });
