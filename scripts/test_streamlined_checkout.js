const pool = require('../database');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ QUY TRÌNH MUA HÀNG & GIỎ HÀNG STREAMLINED\n');
  let passed = 0;

  // Lấy sản phẩm active đầu tiên
  const [prods] = await pool.execute('SELECT id, name, price FROM products WHERE is_active = 1 LIMIT 1');
  const targetProduct = prods[0];
  console.log(`Sản phẩm thử nghiệm: #${targetProduct.id} ${targetProduct.name} (${targetProduct.price.toLocaleString('vi-VN')}đ)`);

  // Test 1: Đặt hàng KHÔNG có phone (Khách vãng lai mua khóa học số)
  console.log('\n--- Test 1: Đặt hàng vãng lai không cần số điện thoại ---');
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Nguyễn Văn Không Cần Phone',
      customer_email: 'khongcanphone@gmail.com',
      // customer_phone cố tình để trống
      items: [{ id: targetProduct.id, quantity: 1 }]
    })
  });

  const orderData = await orderRes.json();
  if (!orderRes.ok || !orderData.success) {
    throw new Error('Test 1 thất bại: Không tạo được đơn hàng khi thiếu phone: ' + JSON.stringify(orderData));
  }
  console.log(`✅ Test 1 PASS: Tạo đơn thành công không cần phone: ${orderData.order_code}`);
  passed++;

  // Test 2: Đặt hàng vãng lai KHÔNG có tên (Tự lấy tên mặc định)
  console.log('\n--- Test 2: Đặt hàng vãng lai không truyền họ tên (Lấy mặc định) ---');
  const orderRes2 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_email: 'khongcanten@gmail.com',
      items: [{ id: targetProduct.id, quantity: 1 }]
    })
  });

  const orderData2 = await orderRes2.json();
  if (!orderRes2.ok || !orderData2.success) {
    throw new Error('Test 2 thất bại: ' + JSON.stringify(orderData2));
  }

  const [dbOrder2] = await pool.execute('SELECT customer_name FROM orders WHERE order_code = ?', [orderData2.order_code]);
  if (dbOrder2[0].customer_name !== 'Học viên JetJet') {
    throw new Error(`Expected 'Học viên JetJet', got '${dbOrder2[0].customer_name}'`);
  }
  console.log(`✅ Test 2 PASS: Tên khách hàng tự gán mặc định là '${dbOrder2[0].customer_name}'`);
  passed++;

  // Test 3: Giả lập thanh toán qua Casso và kiểm tra bàn giao link tức thì
  console.log('\n--- Test 3: Thanh toán Casso & Nhận link Drive Zero-Touch ---');
  const webhookRes = await fetch(`${BASE_URL}/api/webhook/casso`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'secure-token': process.env.CASSO_SECURE_TOKEN || 'jetjet_casso_secret_token_2026'
    },
    body: JSON.stringify({
      error: 0,
      data: [{
        id: 999905,
        tid: 'TEST_STREAMLINED_TID_01',
        description: `JETJET ${orderData.order_code}`,
        amount: orderData.total_price,
        cusum_balance: 50000000,
        when: '2026-11-05 10:15:00'
      }]
    })
  });

  const [dbOrder] = await pool.execute('SELECT status, delivery_data FROM orders WHERE order_code = ?', [orderData.order_code]);
  if (dbOrder[0].status === 'completed' && dbOrder[0].delivery_data && dbOrder[0].delivery_data.includes('https://drive.google.com/')) {
    console.log(`✅ Test 3 PASS: Đơn tự động hoàn tất và có link Drive: ${dbOrder[0].delivery_data.substring(0, 60)}...`);
    passed++;
  } else {
    throw new Error(`Test 3 thất bại: status = ${dbOrder[0]?.status}`);
  }

  console.log(`\n🎉 TẤT CẢ ${passed}/3 BÀI TEST QUY TRÌNH MUA HÀNG STREAMLINED ĐỀU ĐẠT!`);
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err.message);
  process.exit(1);
});
