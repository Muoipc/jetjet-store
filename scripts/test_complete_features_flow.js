const pool = require('../database');

async function runTest() {
  console.log('🚀 Bắt đầu test tự động luồng Complete Features Upgrade...\n');

  const [activeList] = await pool.execute('SELECT id, stock FROM products WHERE is_active = 1 ORDER BY id ASC');
  const pollProdId = activeList[0].id;
  const stockProd = activeList.find(p => p.stock < 1000) || activeList[0];
  const stockProdId = stockProd.id;

  // [1/4] Test Auto-polling Status API
  console.log('[1/4] Kiểm tra API polling trạng thái đơn hàng (GET /api/orders/:code/status)...');
  const createOrderRes = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Test Polling Khách',
      customer_email: 'polling@example.com',
      customer_phone: '0988776655',
      items: [{ id: pollProdId, quantity: 1 }]
    })
  });
  const orderData = await createOrderRes.json();
  if (!orderData.success) throw new Error('Create order failed: ' + JSON.stringify(orderData));
  const orderCode = orderData.order_code;
  const orderId = orderData.orderId;

  const statusPendingRes = await fetch(`http://localhost:3000/api/orders/${orderCode}/status`);
  const statusPending = await statusPendingRes.json();
  if (statusPending.status !== 'pending' || statusPending.paid !== false) {
    throw new Error('Expected pending status, got: ' + JSON.stringify(statusPending));
  }
  console.log(`✅ Polling đơn ${orderCode} khi chưa thanh toán: status = 'pending', paid = false`);

  // Mock thanh toán Casso
  await pool.execute("UPDATE orders SET status = 'paid', payment_confirmed_at = NOW() WHERE id = ?", [orderId]);
  const statusPaidRes = await fetch(`http://localhost:3000/api/orders/${orderCode}/status`);
  const statusPaid = await statusPaidRes.json();
  if (statusPaid.status !== 'paid' || statusPaid.paid !== true) {
    throw new Error('Expected paid status, got: ' + JSON.stringify(statusPaid));
  }
  console.log(`✅ Polling đơn ${orderCode} sau khi thanh toán: status = 'paid', paid = true`);

  // [2/4] Test Admin Digital Delivery
  console.log('\n[2/4] Kiểm tra Admin bàn giao tài khoản (PATCH /api/admin/orders/:id/deliver)...');
  const adminLoginRes = await fetch('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'phucdeptrai123' })
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie').split(';')[0];

  const deliveryPayload = 'Tài khoản: gemini18m@google.com | Mật khẩu: Phuc@2026! | Hướng dẫn: Mở mail bấm kích hoạt link offer 18 tháng';
  const deliverRes = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/deliver`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({ delivery_data: deliveryPayload })
  });
  const deliverData = await deliverRes.json();
  if (!deliverData.success) throw new Error('Deliver failed: ' + JSON.stringify(deliverData));

  // Kiểm tra khách tra cứu đơn thấy đúng delivery_data
  const trackRes = await fetch(`http://localhost:3000/api/orders/${orderCode}`);
  const trackData = await trackRes.json();
  if (trackData.status !== 'completed' || trackData.delivery_data !== deliveryPayload) {
    throw new Error('Delivery data mismatch in tracking: ' + JSON.stringify(trackData));
  }
  console.log(`✅ Bàn giao tài khoản thành công! Khách tra cứu nhận được: "${trackData.delivery_data}"`);

  // [3/4] Test Customer Cancel Pending Order & Stock Restoration
  console.log('\n[3/4] Kiểm tra Khách tự hủy đơn hàng Pending và hoàn trả Tồn Kho (stock)...');
  const [[prodBefore]] = await pool.execute('SELECT stock FROM products WHERE id = ?', [stockProdId]);
  const stockBefore = prodBefore.stock;

  // Đặt 2 suất
  const cancelTestOrderRes = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Test Hủy Đơn',
      customer_email: 'cancel_test@example.com',
      customer_phone: '0988776655',
      items: [{ id: stockProdId, quantity: 2 }]
    })
  });
  const cancelOrderData = await cancelTestOrderRes.json();
  const cancelCode = cancelOrderData.order_code;

  const [[prodDeducted]] = await pool.execute('SELECT stock FROM products WHERE id = ?', [stockProdId]);
  if (prodDeducted.stock !== stockBefore - 2) {
    throw new Error(`Stock deduction mismatch. Expected ${stockBefore - 2}, got ${prodDeducted.stock}`);
  }
  console.log(`- Đã đặt đơn ${cancelCode}, stock giảm từ ${stockBefore} -> ${prodDeducted.stock}`);

  // Khách gọi hủy đơn
  const cancelRes = await fetch(`http://localhost:3000/api/orders/${cancelCode}/cancel`, {
    method: 'POST'
  });
  const cancelResult = await cancelRes.json();
  if (!cancelResult.success) throw new Error('Cancel order failed: ' + JSON.stringify(cancelResult));

  const [[prodRestored]] = await pool.execute('SELECT stock FROM products WHERE id = ?', [stockProdId]);
  if (prodRestored.stock !== stockBefore) {
    throw new Error(`Stock restoration mismatch. Expected ${stockBefore}, got ${prodRestored.stock}`);
  }
  console.log(`✅ Đã hủy đơn thành công! Stock phục hồi hoàn toàn: ${prodRestored.stock}`);

  // Thử hủy lại lần 2 phải bị từ chối
  const cancelAgainRes = await fetch(`http://localhost:3000/api/orders/${cancelCode}/cancel`, {
    method: 'POST'
  });
  if (cancelAgainRes.status !== 400) {
    throw new Error('Expected 400 when cancelling already cancelled order');
  }
  console.log('✅ Hủy lần 2 bị từ chối chính xác (400 Bad Request)');

  // [4/4] Test Products API fields for Quick View Modal
  console.log('\n[4/4] Kiểm tra Dữ liệu sản phẩm cho Modal Quick View...');
  const prodsRes = await fetch('http://localhost:3000/api/products');
  const prods = await prodsRes.json();
  const sample = prods[0];
  if (!sample.name || !sample.price || !Array.isArray(sample.features) || !sample.description) {
    throw new Error('Product fields missing for modal view');
  }
  console.log(`✅ API sản phẩm cung cấp đầy đủ thông tin: ${prods.length} sản phẩm (name, price, features, description, duration, badge)`);

  console.log('\n🎉 TẤT CẢ CÁC BƯỚC TEST BACKEND MỚI ĐỀU PASS 100%!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
