require('dotenv').config();
const pool = require('../database');

async function seedDigitalProducts() {
  const newProducts = [
    // ── 1. KHÓA HỌC & TÀI LIỆU SỐ ĐỘC LẬP ──
    {
      name: 'Khóa Học: Bí Kíp Prompt Engineering & Tự Động Hóa AI',
      category: 'Khóa học & Tài liệu số',
      price: 69000,
      duration: 'Sở hữu vĩnh viễn',
      description: 'Làm chủ ChatGPT, Claude & Midjourney. Tặng kèm kho 1.000+ Prompt độc quyền cho Marketing, Lập trình và Viết lách kiếm tiền.',
      features: JSON.stringify([
        'Công thức viết Prompt P.A.S.T & S.V.C đỉnh cao',
        'Kho 1.000+ Prompt ứng dụng kiếm tiền đa ngành',
        'Tự động hóa công việc văn phòng tiết kiệm 4h/ngày',
        'Tặng link Google Drive tải trọn bộ tài liệu + video'
      ]),
      badge: 'Bestseller Số 1',
      image: '/uploads/gemini.svg',
      stock: 9999,
      auto_delivery_content: '🎓 KHÓA HỌC: PROMPT ENGINEERING & TỰ ĐỘNG HÓA AI\n- Link Google Drive: https://drive.google.com/drive/folders/vsuper-prompt-engineering\n- Thư viện 1000+ Prompt Kit: https://docs.google.com/document/d/1cda5Zz3qwaouM2mPC_sRsypFgMm7HaWHOc_VVOUD4nY\n- Hỗ trợ học tập Zalo: 0912345678 (Nguyễn Song Hoàng Phúc)'
    },
    {
      name: 'Khóa Học: Lập Trình Python & Web Automation từ Zero',
      category: 'Khóa học & Tài liệu số',
      price: 89000,
      duration: 'Sở hữu vĩnh viễn',
      description: 'Lộ trình từ người mới bắt đầu đến tự viết bot cào dữ liệu, làm web tự động hóa và ứng dụng AI vào dự án phần mềm thực chiến.',
      features: JSON.stringify([
        'Cơ bản đến nâng cao: Python, HTML/CSS, React & Node',
        'Xây dựng Tool tự động hóa và Bot cào data mạng xã hội',
        'Full Source Code các dự án thực tế kèm video hướng dẫn',
        'Cập nhật tài liệu mới miễn phí trọn đời'
      ]),
      badge: 'Dành cho Dân IT',
      image: '/uploads/cursor.svg',
      stock: 9999,
      auto_delivery_content: '🎓 KHÓA HỌC: PYTHON & WEB AUTOMATION\n- Link Google Drive Full Source Code & Video: https://drive.google.com/drive/folders/vsuper-python-web-dev\n- Tài liệu giáo trình: https://docs.google.com/document/d/119s-4h6Rt6OtuEoifsrWbaRnVHHgDSkT_gqEAxg5q1g\n- Hỗ trợ kỹ thuật: 0912345678'
    },
    {
      name: 'Ebook & Khóa: 36 Kế Binh Pháp Tôn Tử Trong Kinh Doanh',
      category: 'Khóa học & Tài liệu số',
      price: 59000,
      duration: 'Sở hữu vĩnh viễn',
      description: 'Ứng dụng chiến lược quân sự cổ xưa vào kinh doanh thời đại số. Đọc vị đối thủ, chốt deal đàm phán và tối ưu doanh thu bán lẻ.',
      features: JSON.stringify([
        'Cấu trúc 8 phần thực chiến kèm ví dụ case-study',
        'Nghệ thuật Up-selling & Cross-selling kéo khách',
        'Kỹ năng đàm phán chốt deal không cần giảm giá',
        'Đọc trực tiếp trên điện thoại / máy tính'
      ]),
      badge: 'Gối đầu giường',
      image: '/uploads/canva.svg',
      stock: 9999,
      auto_delivery_content: '📚 EBOOK & BÀI GIẢNG: 36 KẾ BINH PHÁP TRONG KINH DOANH\n- Link Google Drive đọc và tải trọn bộ: https://drive.google.com/drive/folders/vsuper-36-ke-kinh-doanh\n- Bản tóm tắt Mindmap chốt deal: https://docs.google.com/document/d/1VMkyoW1YhU_jL6xZy9fWNcWrkmfySWGFDEuvAgKPvr8'
    },
    {
      name: 'Khóa Học: Kéo Khách Quán Nhỏ & TikTok / Shopee Ads',
      category: 'Khóa học & Tài liệu số',
      price: 79000,
      duration: 'Sở hữu vĩnh viễn',
      description: 'Vận hành và marketing tổng hợp cho quán ăn, tiệm cafe, spa và shop online. Tối ưu GrabFood, ShopeeFood và chạy quảng cáo chuyển đổi.',
      features: JSON.stringify([
        'Tối ưu gian hàng GrabFood, ShopeeFood lên top tìm kiếm',
        'Chạy Ads TikTok & Facebook chi phí thấp ra đơn liền',
        'Thiết kế Menu & Content viral bằng Canva và CapCut',
        'Tặng bộ template menu và kịch bản video mẫu'
      ]),
      badge: 'Thực Chiến 100%',
      image: '/uploads/canva.svg',
      stock: 9999,
      auto_delivery_content: '🎓 KHÓA HỌC: MARKETING QUÁN NHỎ & ADS BÁN HÀNG\n- Link Google Drive tài liệu và video hướng dẫn: https://drive.google.com/drive/folders/vsuper-marketing-quan-nho\n- Kịch bản mẫu CapCut & Canva: https://docs.google.com/document/d/1VMkyoW1YhU_jL6xZy9fWNcWrkmfySWGFDEuvAgKPvr8'
    },
    {
      name: 'Gói Kho Báu VIP: Mở Khóa Trọn Bộ 28+ Khóa Học Số',
      category: 'Khóa học & Tài liệu số',
      price: 199000,
      duration: 'VIP Trọn đời',
      description: 'Sở hữu toàn bộ thư viện khóa học VSuper: Lập trình, Ngoại ngữ, Thiết kế, AI, Kinh doanh, Đầu tư chứng khoán và Phát triển bản thân.',
      features: JSON.stringify([
        'Toàn quyền truy cập 28+ khóa học chuyên sâu',
        'Tặng kèm toàn bộ Prompt Kit và Source Code mẫu',
        'Tự động nhận các khóa học cập nhật mới hàng tháng',
        'Hỗ trợ giải đáp thắc mắc 1:1 từ Admin'
      ]),
      badge: 'Tiết Kiệm 80%',
      image: '/uploads/gemini.svg',
      stock: 9999,
      auto_delivery_content: '👑 KHO BÁU VIP TRỌN ĐỜI VSUPER\n- Link Tổng Folder Google Drive VIP (Toàn bộ 28+ chuyên đề): https://drive.google.com/drive/folders/vsuper-kho-bau-vip-tron-doi\n- Quyền lợi thành viên VIP đã kích hoạt. Cần hỗ trợ nhắn Zalo Phúc: 0912345678'
    },

    // ── 2. COMBO TIẾT KIỆM (TÀI KHOẢN + KHÓA HỌC) ──
    {
      name: 'Combo: ChatGPT Plus + Khóa Học Prompt Engineering VIP',
      category: 'Combo AI + Khóa học',
      price: 249000,
      duration: '1 Tháng + Khóa trọn đời',
      description: 'Sở hữu tài khoản ChatGPT Plus chính chủ GPT-4o & o1 kèm khóa học làm chủ Prompt và bộ 1000+ câu lệnh viết content, làm việc siêu tốc.',
      features: JSON.stringify([
        '01 Tài khoản ChatGPT Plus (GPT-4o, o1, Voice mode)',
        'Khóa học Prompt Engineering & bộ 1000+ Prompt',
        'Giao link khóa học ngay tức thì sau khi chuyển khoản',
        'Tài khoản Plus được bảo hành 1 đổi 1 trọn 30 ngày'
      ]),
      badge: 'Combo Siêu Lời',
      image: '/uploads/chatgpt.svg',
      stock: 50,
      auto_delivery_content: '🎓 [PHẦN KHÓA HỌC TẶNG KÈM COMBO]\n- Link Google Drive khóa học Prompt Kit: https://drive.google.com/drive/folders/vsuper-prompt-engineering\n👉 [PHẦN TÀI KHOẢN CHATGPT PLUS]: Admin đang kích hoạt và gửi email/pass cho bạn trong 5 phút!'
    },
    {
      name: 'Combo: Cursor Pro + Khóa Học Python & Web Automation',
      category: 'Combo AI + Khóa học',
      price: 239000,
      duration: '1 Tháng + Khóa trọn đời',
      description: 'Vũ khí tối thượng cho Developer: Trình soạn thảo Cursor Pro không giới hạn Claude 3.7 & GPT-4o, đi kèm giáo trình lập trình và tự động hóa.',
      features: JSON.stringify([
        '01 Tài khoản Cursor Pro chính chủ gói Fast Requests',
        'Trọn bộ khóa học Python, React, Web Automation',
        'Full Source Code các dự án cào data và AI Agent',
        'Tiết kiệm ngay 30.000đ so với mua lẻ từng món'
      ]),
      badge: 'Dân Dev Phải Có',
      image: '/uploads/cursor.svg',
      stock: 30,
      auto_delivery_content: '🎓 [PHẦN KHÓA HỌC TẶNG KÈM COMBO]\n- Link Google Drive Python & Web Dev: https://drive.google.com/drive/folders/vsuper-python-web-dev\n👉 [PHẦN TÀI KHOẢN CURSOR PRO]: Admin đang chuẩn bị và bàn giao tài khoản cho bạn trong 5 phút!'
    }
  ];

  for (const p of newProducts) {
    const [exist] = await pool.execute('SELECT id FROM products WHERE name = ?', [p.name]);
    if (exist.length === 0) {
      await pool.execute(
        `INSERT INTO products (name, category, price, duration, description, features, badge, image, stock, auto_delivery_content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.name, p.category, p.price, p.duration, p.description, p.features, p.badge, p.image, p.stock, p.auto_delivery_content]
      );
      console.log(`✅ Đã thêm sản phẩm: ${p.name}`);
    } else {
      await pool.execute(
        `UPDATE products SET auto_delivery_content = ?, category = ?, price = ?, description = ?, features = ?, stock = ? WHERE id = ?`,
        [p.auto_delivery_content, p.category, p.price, p.description, p.features, p.stock, exist[0].id]
      );
      console.log(`🔄 Đã cập nhật sản phẩm: ${p.name}`);
    }
  }

  console.log('🎉 Seed sản phẩm số & Combo hoàn tất!');
  process.exit(0);
}

seedDigitalProducts().catch(err => {
  console.error('❌ Lỗi seed sản phẩm số:', err);
  process.exit(1);
});
