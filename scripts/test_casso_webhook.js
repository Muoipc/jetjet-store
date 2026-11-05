// scripts/test_casso_webhook.js
// Automated test script for Casso Webhook integration (Phase 5)
require('dotenv').config();
const assert = require('assert');
const db = require('../database');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  console.log('🚀 Bắt đầu test tự động luồng Casso Webhook...');

  try {
    // 1. Lấy sản phẩm active đầu tiên để tạo đơn hàng
    console.log('[1/4] Tạo đơn hàng thử nghiệm qua POST /api/orders...');
    const [prods] = await db.execute('SELECT id FROM products WHERE is_active = 1 LIMIT 1');
    const testProdId = prods[0]?.id || 8;

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Khách Test Casso',
        customer_email: 'test_casso@jetjet.vn',
        customer_phone: '0988889999',
        notes: 'Đơn test tự động Casso Webhook Phase 5',
        items: [{ id: testProdId, quantity: 1 }]
      })
    });

    const orderData = await orderRes.json();
    assert.strictEqual(orderRes.status, 200, `Tạo đơn thất bại: ${JSON.stringify(orderData)}`);
    assert(orderData.order_code, 'Không có order_code trong response');
    assert(orderData.total_price > 0, 'total_price phải lớn hơn 0');

    const orderCode = orderData.order_code;
    const totalPrice = orderData.total_price;
    console.log(`✅ Tạo đơn thành công! Mã đơn: ${orderCode}, Tổng tiền: ${totalPrice.toLocaleString('vi-VN')}đ`);

    // 2. Giả lập Casso bắn webhook về POST /api/webhook/casso
    console.log('\n[2/4] Gửi mock webhook Casso tới POST /api/webhook/casso...');
    const tid = `TEST_${Date.now()}`;
    const bankRef = 'MB_TEST_REF';
    const webhookHeaders = { 'Content-Type': 'application/json' };
    if (process.env.CASSO_WEBHOOK_SECRET) {
      webhookHeaders['x-webhook-secret'] = process.env.CASSO_WEBHOOK_SECRET;
      webhookHeaders['secure-token'] = process.env.CASSO_WEBHOOK_SECRET;
    }

    const webhookRes = await fetch(`${BASE_URL}/api/webhook/casso`, {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        data: [
          {
            description: `JETJET ${orderCode}`,
            amount: totalPrice,
            tid: tid,
            bank_ref: bankRef
          }
        ]
      })
    });

    const webhookData = await webhookRes.json();
    assert.strictEqual(webhookRes.status, 200, `Webhook call failed: ${JSON.stringify(webhookData)}`);
    assert.strictEqual(webhookData.success, true, 'Webhook success không phải true');
    assert.strictEqual(webhookData.matched, 1, `Webhook matched phải là 1 nhưng nhận được: ${webhookData.matched}`);
    console.log(`✅ Webhook phản hồi thành công: matched = ${webhookData.matched}`);

    // 3. Kiểm tra trạng thái đơn hàng qua GET /api/orders/:code
    console.log(`\n[3/4] Kiểm tra trạng thái đơn hàng qua GET /api/orders/${orderCode}...`);
    const checkRes = await fetch(`${BASE_URL}/api/orders/${orderCode}`);
    const checkData = await checkRes.json();

    assert.strictEqual(checkRes.status, 200, `Lấy thông tin đơn thất bại: ${JSON.stringify(checkData)}`);
    assert(['paid', 'completed'].includes(checkData.status), `Status đơn phải là 'paid' hoặc 'completed', thực tế: '${checkData.status}'`);
    assert(checkData.payment_confirmed_at, 'payment_confirmed_at chưa được cập nhật');
    console.log(`✅ Trạng thái đơn hàng: ${checkData.status} (Xác nhận lúc: ${checkData.payment_confirmed_at})`);

    // 4. Kiểm tra bản ghi payment_logs trong cơ sở dữ liệu
    console.log('\n[4/4] Kiểm tra bản ghi payment_logs trong database...');
    const [logs] = await db.execute(
      'SELECT * FROM payment_logs WHERE matched_order_code = ? ORDER BY id DESC LIMIT 1',
      [orderCode]
    );

    assert(logs.length > 0, `Không tìm thấy payment_log cho đơn ${orderCode}`);
    const log = logs[0];
    assert.strictEqual(log.transaction_id, tid, `transaction_id không khớp: ${log.transaction_id} vs ${tid}`);
    assert.strictEqual(log.amount, totalPrice, `amount không khớp: ${log.amount} vs ${totalPrice}`);
    assert.strictEqual(log.bank_ref, bankRef, `bank_ref không khớp: ${log.bank_ref} vs ${bankRef}`);
    assert.strictEqual(log.matched_order_code, orderCode, `matched_order_code không khớp: ${log.matched_order_code} vs ${orderCode}`);
    console.log(`✅ Payment log ghi nhận chính xác: ID ${log.id}, TID: ${log.transaction_id}, Tiền: ${log.amount.toLocaleString('vi-VN')}đ, Ref: ${log.bank_ref}`);

    console.log('\n🎉 TẤT CẢ CÁC BƯỚC TEST ĐỀU PASS! Hệ thống Casso Webhook hoạt động hoàn hảo.\n');
  } catch (err) {
    console.error('\n❌ TEST THẤT BẠI:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

run();
