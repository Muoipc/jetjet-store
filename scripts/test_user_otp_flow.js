const pool = require('../database');

async function runTest() {
  console.log('🚀 Bắt đầu test tự động luồng User Auth & OTP...\n');

  const testEmail = `phuc_test_${Date.now()}@example.com`;
  const testPassword = 'Password123';
  const newPassword = 'NewSecretPassword456';
  const testName = 'Nguyễn Hoàng Phúc Test';
  const testPhone = '0912345678';

  // Lấy sản phẩm active để test
  const [activeProds] = await pool.execute('SELECT id FROM products WHERE is_active = 1 LIMIT 2');
  const pId1 = activeProds[0]?.id || 8;
  const pId2 = activeProds[1]?.id || pId1;

  // [1/6] Test Guest Checkout
  console.log('[1/6] Kiểm tra đặt hàng Khách Vãng Lai (Guest Checkout)...');
  const guestRes = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Khách Vãng Lai Test',
      customer_email: 'guest_test@example.com',
      customer_phone: '0988776655',
      items: [{ id: pId1, quantity: 1 }]
    })
  });
  const guestData = await guestRes.json();
  if (!guestData.success) throw new Error('Guest order failed: ' + JSON.stringify(guestData));

  const [[guestOrderInDb]] = await pool.execute('SELECT user_id, order_code FROM orders WHERE order_code = ?', [guestData.order_code]);
  if (guestOrderInDb.user_id !== null) throw new Error('Expected guest order user_id to be NULL, got: ' + guestOrderInDb.user_id);
  console.log(`✅ Khách vãng lai đặt đơn thành công: ${guestData.order_code} (user_id = NULL)`);

  // [2/6] Test Register with OTP
  console.log('\n[2/6] Kiểm tra Đăng Ký Tài Khoản nhận mã OTP qua Email...');
  const sendOtpRes = await fetch('http://localhost:3000/api/auth/send-register-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      full_name: testName,
      phone: testPhone
    })
  });
  const sendOtpData = await sendOtpRes.json();
  if (!sendOtpData.success) throw new Error('Send register OTP failed: ' + JSON.stringify(sendOtpData));

  // Lấy mã OTP trong DB
  const [otpRows] = await pool.execute(
    'SELECT code FROM otp_codes WHERE email = ? AND type = "register" AND is_used = 0 ORDER BY id DESC LIMIT 1',
    [testEmail]
  );
  if (!otpRows.length) throw new Error('Không tìm thấy OTP trong database');
  const otpCode = otpRows[0].code;
  console.log(`✅ Đã gửi OTP thành công! Mã OTP thu được từ DB: ${otpCode}`);

  // Xác thực OTP để hoàn tất đăng ký
  const verifyRes = await fetch('http://localhost:3000/api/auth/verify-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, code: otpCode })
  });
  const cookieHeader = verifyRes.headers.get('set-cookie');
  const verifyData = await verifyRes.json();
  if (!verifyData.success) throw new Error('Verify OTP failed: ' + JSON.stringify(verifyData));
  const userCookie = cookieHeader ? cookieHeader.split(';')[0] : '';
  console.log(`✅ Xác thực OTP thành công! User ID: ${verifyData.user.id}, Session Cookie: ${userCookie.slice(0, 25)}...`);

  // [3/6] Test Member Checkout
  console.log('\n[3/6] Kiểm tra đặt hàng với tư cách Thành Viên (Member Checkout)...');
  const memberOrderRes = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userCookie
    },
    body: JSON.stringify({
      customer_name: testName,
      customer_email: testEmail,
      customer_phone: testPhone,
      items: [{ id: pId2, quantity: 1 }]
    })
  });
  const memberOrderData = await memberOrderRes.json();
  if (!memberOrderData.success) throw new Error('Member order failed: ' + JSON.stringify(memberOrderData));

  const [[memberOrderInDb]] = await pool.execute('SELECT user_id, order_code FROM orders WHERE order_code = ?', [memberOrderData.order_code]);
  if (memberOrderInDb.user_id !== verifyData.user.id) {
    throw new Error(`Expected order user_id = ${verifyData.user.id}, got: ${memberOrderInDb.user_id}`);
  }
  console.log(`✅ Thành viên đặt đơn thành công: ${memberOrderData.order_code} (gắn đúng user_id = ${verifyData.user.id})`);

  // [4/6] Test User Order History
  console.log('\n[4/6] Kiểm tra API Lịch sử đơn hàng của tôi (/api/user/orders)...');
  const myOrdersRes = await fetch('http://localhost:3000/api/user/orders', {
    headers: { 'Cookie': userCookie }
  });
  const myOrders = await myOrdersRes.json();
  if (!Array.isArray(myOrders) || myOrders.length === 0) throw new Error('Không lấy được danh sách đơn của user');
  const foundOrder = myOrders.find(o => o.order_code === memberOrderData.order_code);
  if (!foundOrder) throw new Error('Đơn vừa đặt không xuất hiện trong lịch sử của user');
  console.log(`✅ Lấy thành công ${myOrders.length} đơn hàng của thành viên, có đủ danh sách món đồ`);

  // [5/6] Test Password Reset with OTP
  console.log('\n[5/6] Kiểm tra Đổi / Quên Mật Khẩu qua mã OTP Email...');
  const resetOtpRes = await fetch('http://localhost:3000/api/auth/send-reset-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });
  const resetOtpData = await resetOtpRes.json();
  if (!resetOtpData.success) throw new Error('Send reset OTP failed: ' + JSON.stringify(resetOtpData));

  const [resetRows] = await pool.execute(
    'SELECT code FROM otp_codes WHERE email = ? AND type = "forgot_password" AND is_used = 0 ORDER BY id DESC LIMIT 1',
    [testEmail]
  );
  const resetCode = resetRows[0].code;
  console.log(`✅ Đã gửi OTP đổi pass! Mã OTP từ DB: ${resetCode}`);

  const updatePassRes = await fetch('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: resetCode,
      new_password: newPassword
    })
  });
  const updatePassData = await updatePassRes.json();
  if (!updatePassData.success) throw new Error('Reset password failed: ' + JSON.stringify(updatePassData));
  console.log(`✅ Đổi mật khẩu thành công!`);

  // Thử đăng nhập bằng mật khẩu mới
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: newPassword })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error('Đăng nhập bằng mật khẩu mới thất bại!');
  console.log(`✅ Đăng nhập với mật khẩu mới thành công rực rỡ!`);

  // [6/6] Test Admin Distinction
  console.log('\n[6/6] Kiểm tra Admin phân biệt Khách Vãng Lai và Thành Viên...');
  // Đăng nhập admin
  const adminLoginRes = await fetch('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'phucdeptrai123' })
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie').split(';')[0];

  const adminGuestRes = await fetch('http://localhost:3000/api/admin/orders?customer_type=guest', {
    headers: { 'Cookie': adminCookie }
  });
  const adminGuestOrders = await adminGuestRes.json();
  const allGuestAreNull = adminGuestOrders.every(o => o.user_id === null && o.is_guest === 1);
  if (!allGuestAreNull) throw new Error('Filter customer_type=guest trả về cả thành viên!');

  const adminMemberRes = await fetch('http://localhost:3000/api/admin/orders?customer_type=member', {
    headers: { 'Cookie': adminCookie }
  });
  const adminMemberOrders = await adminMemberRes.json();
  const allMemberHaveId = adminMemberOrders.every(o => o.user_id !== null && o.is_guest === 0);
  if (!allMemberHaveId) throw new Error('Filter customer_type=member trả về cả khách vãng lai!');

  console.log(`✅ Admin lọc chính xác: ${adminGuestOrders.length} đơn vãng lai, ${adminMemberOrders.length} đơn thành viên`);

  console.log('\n🎉 TẤT CẢ 6 BƯỚC TEST USER AUTH & OTP ĐỀU PASS 100%!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
