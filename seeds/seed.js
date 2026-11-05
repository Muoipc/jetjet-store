// seeds/seed.js — Migrate exact data from SQLite + create admin user
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const pool = require('../database');

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute('TRUNCATE TABLE order_items');
    await conn.execute('TRUNCATE TABLE payment_logs');
    await conn.execute('TRUNCATE TABLE orders');
    await conn.execute('TRUNCATE TABLE products');
    await conn.execute('TRUNCATE TABLE admin_users');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    const products = [
      {
        name: 'Link Gemini 18 tháng offer',
        category: 'Chatbot & Trợ lý',
        price: 50000,
        duration: '18 Tháng',
        description: 'Link nhận offer Gemini 18 tháng. Đăng nhập Google, bấm link nhận offer và kích hoạt ngay sau khi mua.',
        features: JSON.stringify(['Step 1: Log in to your Google account', 'Step 2: Click link from bot & receive offer', 'After purchasing, please use immediately']),
        badge: 'Offer 50k cực hot',
        image: '/uploads/gemini.svg',
        stock: 50
      },
      {
        name: 'ChatGPT Plus (Con AI dẻo miệng)',
        category: 'Chatbot & Trợ lý',
        price: 199000,
        duration: '1 Tháng',
        description: 'Hỏi gì đáp nấy, dạ thưa ngọt xớt như mía lùi. Model GPT-4o với o1 thông minh số dách, có giọng nói tâm sự đêm khuya.',
        features: JSON.stringify(['Model GPT-4o & o1 khôn hết phần thiên hạ', 'Nói chuyện chân thực như bồ nhí', 'Đọc tài liệu, giải bài tập cái rẹt', 'Bảo hành 1 đổi 1 như đổi bánh tráng nướng']),
        badge: 'Bán chạy xỉu',
        image: '/uploads/chatgpt.svg',
        stock: 20
      },
      {
        name: 'Claude Pro (Thầy giáo AI siêu đỉnh)',
        category: 'Chatbot & Trợ lý',
        price: 249000,
        duration: '1 Tháng',
        description: 'Văn chương lai láng như nước sông Tiền. Bản Claude 3.7 Sonnet kèm tính năng suy nghĩ sâu xa và gõ code trực tiếp không cãi câu nào.',
        features: JSON.stringify(['Claude 3.7 Sonnet siêu cấp thông minh', 'Nhớ dai 200k tokens hổng quên gì hết', 'Tạo web app, viết báo cáo vèo vèo', 'Kích hoạt chính chủ email của bà con']),
        badge: 'Bao khôn bao bén',
        image: '/uploads/claude.svg',
        stock: 15
      },
      {
        name: 'Cursor Pro (Vũ khí đắc lực dân IT)',
        category: 'Lập trình viên',
        price: 180000,
        duration: '1 Tháng',
        description: 'Bấm Tab cái là code tự chạy ra, phẻ re đi nhậu với anh em. Composer tự sửa một nùi file trong nháy mắt.',
        features: JSON.stringify(['Không giới hạn Fast Premium Requests', 'Agent tự sửa lỗi code không cần nhức đầu', 'Tích hợp Claude 3.7 & GPT-4o', 'Cài vô VS Code xài liền cho nóng']),
        badge: 'Dân dev mê mẩn',
        image: '/uploads/cursor.svg',
        stock: 20
      },
      {
        name: 'GitHub Copilot (Thằng bạn nhắc bài)',
        category: 'Lập trình viên',
        price: 89000,
        duration: '1 Tháng',
        description: 'Gõ trước 1 chữ nó nhắc nguyên đoạn, cứu cánh mấy mùa deadline dí chạy tụt quần.',
        features: JSON.stringify(['Nhắc code mượt mà như bôi mỡ bò', 'Copilot Chat giải thích bug cặn kẽ', 'Cân từ Java, C++, Python tới JS', 'Kích hoạt thẳng vô GitHub chính chủ']),
        badge: 'Giá mềm xèo',
        image: '/uploads/copilot.svg',
        stock: 30
      },
      {
        name: 'Midjourney Pro (Họa sĩ AI miền Tây)',
        category: 'Đồ họa & Thiết kế',
        price: 220000,
        duration: '1 Tháng',
        description: 'Kêu vẽ con cá lóc mặc áo bà ba đi chèo xuồng nó cũng vẽ ra đẹp như tranh bảo tàng Louvre.',
        features: JSON.stringify(['Fast Hours tạo ảnh thần tốc', 'Stealth Mode giấu ảnh hổng cho ai dòm', 'Chất lượng ảnh v6.1 nét căng đét', 'Dân thiết kế xài là ghiền liền']),
        badge: 'Đẹp bá cháy',
        image: '/uploads/midjourney.svg',
        stock: 10
      },
      {
        name: 'Canva Pro (Thiết kế hổng cần não)',
        category: 'Đồ họa & Thiết kế',
        price: 69000,
        duration: '1 Năm',
        description: 'Làm thiệp mời tân gia, poster, menu đám giỗ bao đẹp trong 1 nốt nhạc, xóa phông 1 click.',
        features: JSON.stringify(['Xóa phông nền ảnh/video cái rẹt', 'Kho 100M+ hình ảnh bản quyền bao xài', 'Magic AI Studio sửa ảnh thần kỳ', 'Bảo hành trọn vẹn 365 ngày']),
        badge: 'Rẻ rúng mình',
        image: '/uploads/canva.svg',
        stock: 100
      }
    ];

    const insertProduct = `INSERT INTO products (name,category,price,duration,description,features,badge,image,stock) VALUES (?,?,?,?,?,?,?,?,?)`;
    for (const p of products) {
      await conn.execute(insertProduct, [p.name, p.category, p.price, p.duration, p.description, p.features, p.badge, p.image, p.stock]);
    }
    console.log(`✅ ${products.length} products inserted`);

    const adminPw = process.env.ADMIN_KEY || 'phucdeptrai123';
    const hash = await bcrypt.hash(adminPw, 10);
    await conn.execute('INSERT INTO admin_users (username, password_hash, display_name) VALUES (?,?,?)', ['admin', hash, 'Phúc Admin']);
    console.log('✅ Admin user created: admin / <ADMIN_KEY>');

    // Seed default member user
    const userHash = await bcrypt.hash('123456', 10);
    await conn.execute(
      'INSERT INTO users (email, password_hash, full_name, phone) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
      ['phuc@jetjet.store', userHash, 'Nguyễn Song Hoàng Phúc', '0912345678']
    );
    console.log('✅ Default member user created: phuc@jetjet.store / 123456');

    await conn.execute(`INSERT INTO orders (order_code,customer_name,customer_email,customer_phone,notes,total_price,status) VALUES (?,?,?,?,?,?,?)`,
      ['JJ26110401', 'Nguyen Song Hoang Phuc', 'nguyensonghoangphuc0125@gmail.com', '0912345678', 'Kích hoạt bằng email chính chủ', 379000, 'paid']);
    const [[{id: orderId}]] = await conn.execute('SELECT LAST_INSERT_ID() as id');
    await conn.execute('INSERT INTO order_items (order_id,product_id,product_name,price,quantity) VALUES (?,?,?,?,?)', [orderId, 2, 'ChatGPT Plus', 199000, 1]);
    await conn.execute('INSERT INTO order_items (order_id,product_id,product_name,price,quantity) VALUES (?,?,?,?,?)', [orderId, 4, 'Cursor Pro', 180000, 1]);
    console.log('✅ 1 sample order with 2 items');

    console.log('\n🎉 Seed done!');
  } finally {
    conn.release();
    process.exit(0);
  }
}
seed().catch(e => { console.error('❌', e); process.exit(1); });
