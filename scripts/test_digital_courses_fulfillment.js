const pool = require('../database');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ SẢN PHẨM SỐ & ZERO-TOUCH FULFILLMENT\n');
  let passed = 0;

  // Test 1: Lấy danh sách sản phẩm
  console.log('--- Test 1: Kiểm tra API Products & Danh mục mới ---');
  const prodRes = await fetch(`${BASE_URL}/api/products`);
  const products = await prodRes.json();
  console.log(`Tìm thấy ${products.length} sản phẩm active.`);

  const courseProds = products.filter(p => p.category === 'Khóa học & Tài liệu số');
  const comboProds = products.filter(p => p.category === 'Combo AI + Khóa học');

  if (courseProds.length >= 4 && comboProds.length >= 2) {
    console.log(`✅ Test 1 PASS: ${courseProds.length} khóa học số, ${comboProds.length} combo.`);
    passed++;
  } else {
    throw new Error(`❌ Test 1 FAIL: Không đủ sản phẩm danh mục mới (${courseProds.length} courses, ${comboProds.length} combos)`);
  }

  // Test 2: Đặt đơn khóa học số -> Giả lập Webhook Casso -> Kiểm tra Zero-Touch Fulfillment
  console.log('\n--- Test 2: Đặt Khóa học số & Zero-Touch Bàn giao tức thì ---');
  const promptCourse = courseProds[0];
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Nguyễn Văn Test Số',
      customer_email: 'testso@jetjet.store',
      customer_phone: '0988776655',
      items: [{ id: promptCourse.id, quantity: 1 }]
    })
  });

  const orderData = await orderRes.json();
  const orderCode = orderData.order_code;
  const totalPrice = orderData.total_price;
  console.log(`Tạo đơn số thành công: ${orderCode} (${totalPrice.toLocaleString('vi-VN')}đ)`);

  // Giả lập Webhook Casso bắn về
  const webhookRes = await fetch(`${BASE_URL}/api/webhook/casso`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'secure-token': process.env.CASSO_SECURE_TOKEN || 'jetjet_casso_secret_token_2026'
    },
    body: JSON.stringify({
      error: 0,
      data: [{
        id: 999901,
        tid: 'TEST_DIGITAL_TID_01',
        description: `CHUYEN KHOAN JETJET STORE ${orderCode}`,
        amount: totalPrice,
        cusum_balance: 50000000,
        when: '2026-11-05 10:00:00'
      }]
    })
  });

  const webhookJson = await webhookRes.json();
  console.log('Webhook response:', webhookJson);

  // Kiểm tra trạng thái đơn trong database
  const [dbOrder] = await pool.execute('SELECT status, delivery_data, delivered_at FROM orders WHERE order_code = ?', [orderCode]);
  if (dbOrder.length > 0 && dbOrder[0].status === 'completed' && dbOrder[0].delivery_data && dbOrder[0].delivery_data.includes('https://drive.google.com/')) {
    console.log('✅ Test 2 PASS: Đơn khóa học số tự động chuyển COMPLETED và giao link Drive tức thì!');
    console.log(`Link giao hàng: ${dbOrder[0].delivery_data.substring(0, 80)}...`);
    passed++;
  } else {
    throw new Error(`❌ Test 2 FAIL: Đơn không tự động completed hoặc thiếu link Drive. Status: ${dbOrder[0]?.status}`);
  }

  // Test 3: Đặt đơn Combo (ChatGPT Plus + Khóa học) -> Chuyển sang 'processing' và giao trước link khóa học
  console.log('\n--- Test 3: Đặt đơn Combo -> Bàn giao trước Khóa học, chờ cấp acc AI ---');
  const combo = comboProds[0];
  const comboOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Trần Văn Combo',
      customer_email: 'combo@jetjet.store',
      customer_phone: '0911223344',
      items: [{ id: combo.id, quantity: 1 }]
    })
  });

  const comboOrderData = await comboOrderRes.json();
  const comboOrderCode = comboOrderData.order_code;
  const comboPrice = comboOrderData.total_price;
  console.log(`Tạo đơn Combo thành công: ${comboOrderCode} (${comboPrice.toLocaleString('vi-VN')}đ)`);

  await fetch(`${BASE_URL}/api/webhook/casso`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'secure-token': process.env.CASSO_SECURE_TOKEN || 'jetjet_casso_secret_token_2026'
    },
    body: JSON.stringify({
      error: 0,
      data: [{
        id: 999902,
        tid: 'TEST_COMBO_TID_02',
        description: `THANH TOAN DON COMBO ${comboOrderCode}`,
        amount: comboPrice,
        cusum_balance: 50000000,
        when: '2026-11-05 10:05:00'
      }]
    })
  });

  const [dbComboOrder] = await pool.execute('SELECT status, delivery_data FROM orders WHERE order_code = ?', [comboOrderCode]);
  if (dbComboOrder.length > 0 && dbComboOrder[0].status === 'processing' && dbComboOrder[0].delivery_data && dbComboOrder[0].delivery_data.includes('PHẦN KHÓA HỌC TẶNG KÈM COMBO')) {
    console.log('✅ Test 3 PASS: Đơn Combo tự động bàn giao trước khóa học và chuyển PROCESSING chờ admin cấp tài khoản!');
    passed++;
  } else {
    throw new Error(`❌ Test 3 FAIL: Combo không đúng quy trình. Status: ${dbComboOrder[0]?.status}`);
  }

  // Test 4: Tra cứu đơn hàng từ phía khách hàng
  console.log('\n--- Test 4: Khách hàng tra cứu đơn hàng nhận link tài liệu ---');
  const lookupRes = await fetch(`${BASE_URL}/api/orders/${orderCode}`);
  const lookupData = await lookupRes.json();
  if (lookupData.status === 'completed' && lookupData.delivery_data) {
    console.log('✅ Test 4 PASS: Khách hàng tra cứu thấy ngay nội dung khóa học và link tải!');
    passed++;
  } else {
    throw new Error('❌ Test 4 FAIL: Tra cứu không thấy link bàn giao');
  }

  console.log(`\n🎉 TẤT CẢ ${passed}/4 BÀI TEST ĐỀU ĐẠT CHUẨN XUẤT SẮC!`);
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err.message);
  process.exit(1);
});
