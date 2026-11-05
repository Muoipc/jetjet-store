# Kế Hoạch Chuyển Đổi Sang Mô Hình Sản Phẩm Số & Khóa Học AI (Plan)

## Goal
Chuyển đổi và mở rộng danh mục sản phẩm JetJet Store từ bán tài khoản AI thuần túy sang Hệ sinh thái Sản phẩm số (Khóa học số VSuper, Bộ Prompt Kit, và Combo Công cụ AI + Khóa học thực chiến), tích hợp cơ chế tự động bàn giao link Google Drive tức thì khi thanh toán thành công (Zero-Touch Fulfillment).

---

## Current Context & Assumptions

### Hiện trạng hệ thống:
1. **Danh mục sản phẩm hiện tại:** Chỉ có 7 sản phẩm tài khoản AI (Gemini 18m, ChatGPT Plus, Claude Pro, Cursor Pro, GitHub Copilot, Midjourney Pro, Canva Pro) thuộc 3 danh mục (`Chatbot & Trợ lý`, `Lập trình viên`, `Đồ họa & Thiết kế`).
2. **Quy trình bàn giao hiện tại:** Khi thanh toán thành công qua VietQR/Casso, đơn hàng chuyển sang `paid`. Admin phải vào `admin.html` bấm "Giao tài khoản" và nhập thông tin thủ công thì đơn mới chuyển sang `completed`.
3. **Nguồn tài nguyên mới:** Vừa sở hữu bộ tài liệu khóa học số VSuper gồm 28+ chuyên đề (Python Automation, Lập trình Web Fullstack, Prompt Engineering, Marketing thực chiến, 36 Kế kinh doanh, Chứng khoán...). Toàn bộ tài liệu có thể lưu trữ trên Google Drive và cấp quyền xem vĩnh viễn với chi phí vốn = 0đ.
4. **Cơ sở dữ liệu:** MySQL (`jetjet_store`), bảng `products` hiện chưa có trường lưu nội dung bàn giao tự động (`auto_delivery_content`).

### Giả định kiến trúc:
- Thêm trường `auto_delivery_content TEXT NULL` vào bảng `products`. Nếu sản phẩm có giá trị này (sản phẩm số/khóa học), khi đơn hàng được thanh toán (qua Casso Webhook hoặc duyệt tay), hệ thống sẽ **tự động bàn giao link tải/học ngay lập tức** và chuyển đơn sang `completed` mà không cần Admin can thiệp.
- Bổ sung 2 danh mục mới trên website:
  1. `🎓 Khóa học & Tài liệu số`: Bán lẻ các khóa học/prompt kit giá sinh viên (49k - 99k).
  2. `🔥 Combo AI + Khóa học`: Gói kết hợp tài khoản AI + khóa học tương ứng (giá tiết kiệm).
- Khóa học số không giới hạn số lượng (`stock: 9999`).

---

## Architecture & Proposed Approach

```
┌────────────────────────────────────────────────────────────────────────┐
│                          public/index.html                             │
│  - Danh mục: [Tất cả] [Chatbot] [Dev] [Design] [🎓 Khóa học] [🔥 Combo] │
│  - Thẻ sản phẩm số: Badge "Tự động gửi link ngay sau khi thanh toán"   │
│  - Checkout: Tự động ghi nhận loại đơn hàng                            │
└────────────────┬───────────────────────────────────────┬───────────────┘
                 │                                       │
                 ▼ /api/orders                           ▼ Webhook Casso
┌───────────────────────────────────────┐ ┌─────────────────────────────┐
│           routes/orders.js            │ │       routes/webhook.js     │
│  - Tạo đơn bình thường                │ │  - Khi match thanh toán:    │
│  - Giữ nguyên bảo mật tính giá server │ │  - Check các món trong đơn  │
└────────────────┬──────────────────────┘ │  - Nếu có link tự động:    │
                 │                        │    -> Gán delivery_data     │
                 │                        │    -> status = 'completed'  │
                 │                        │    -> Khách nhận link ngay! │
                 │                        └──────────────┬──────────────┘
                 │                                       │
                 └───────────────┬───────────────────────┘
                                 ▼
                 ┌──────────────────────────────┐
                 │        MySQL Database        │
                 │  - products: +auto_delivery  │
                 │  - orders: +delivery_data    │
                 └──────────────────────────────┘
```

---

## Step-by-Step Tasks

### Phase 1: Database Migration — Thêm Trường Auto Delivery (10 phút)

#### Task 1.1: Tạo migration script
- **File:** `migrations/add_auto_delivery_to_products.sql`
- **Mục tiêu:** Thêm cột `auto_delivery_content TEXT NULL` vào bảng `products`.

**Nội dung `migrations/add_auto_delivery_to_products.sql`:**
```sql
USE jetjet_store;

SET @exist_auto := (SELECT COUNT(*) FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = 'jetjet_store' 
                      AND TABLE_NAME = 'products' 
                      AND COLUMN_NAME = 'auto_delivery_content');

SET @query_auto := IF(@exist_auto = 0,
    'ALTER TABLE products ADD COLUMN auto_delivery_content TEXT NULL AFTER stock;',
    'SELECT "Column auto_delivery_content already exists"');

PREPARE stmt FROM @query_auto;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

**Lệnh thực thi & kiểm tra:**
```bash
mysql -u root -p123456 < migrations/add_auto_delivery_to_products.sql
mysql -u root -p123456 jetjet_store -e "SHOW COLUMNS FROM products LIKE 'auto_delivery%';"
```
*Kỳ vọng:* Cột `auto_delivery_content` (text) xuất hiện trong bảng `products`.

---

### Phase 2: Seed Danh Mục Sản Phẩm Mới (15 phút)

#### Task 2.1: Cập nhật `seeds/seed_digital_courses.js`
- **File:** `seeds/seed_digital_courses.js`
- **Mục tiêu:** Nạp 7 sản phẩm khóa học số & combo thực chiến được đóng gói từ tài liệu VSuper vào MySQL.

**Nội dung `seeds/seed_digital_courses.js`:**
```js
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
        `UPDATE products SET auto_delivery_content = ?, category = ?, price = ?, description = ?, features = ? WHERE id = ?`,
        [p.auto_delivery_content, p.category, p.price, p.description, p.features, exist[0].id]
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
```

**Lệnh chạy & kiểm tra:**
```bash
node seeds/seed_digital_courses.js
mysql -u root -p123456 jetjet_store -e "SELECT id, name, category, price, stock FROM products WHERE category LIKE '%Khóa học%';"
```

---

### Phase 3: Backend Automation — Zero-Touch Fulfillment (25 phút)

#### Task 3.1: Nâng cấp `routes/webhook.js` để tự động giao link tài liệu số
- **File:** `routes/webhook.js`
- **Mục tiêu:** Khi Casso webhook xác nhận thanh toán thành công:
  - Lấy danh sách sản phẩm trong đơn từ `order_items` JOIN `products`.
  - Nếu tất cả các sản phẩm trong đơn ĐỀU CÓ `auto_delivery_content` (sản phẩm số 100%):
    - Tự động gộp nội dung bàn giao vào `orders.delivery_data`.
    - Đặt trạng thái `status = 'completed'` và `delivered_at = NOW()`.
    - Đơn hàng hoàn tất ngay lập tức mà không cần Admin can thiệp!
  - Nếu đơn hàng là Combo (vừa có link số, vừa có tài khoản cần cấp thủ công):
    - Tự động gán link số vào `delivery_data` trước.
    - Đặt trạng thái `status = 'processing'` để Admin chỉ cần điền thêm tài khoản AI.

**Đoạn code nâng cấp trong `routes/webhook.js`:**
```js
// Kiểm tra và tự động bàn giao sản phẩm số
const [items] = await db.execute(`
  SELECT oi.product_id, oi.product_name, oi.quantity, p.auto_delivery_content
  FROM order_items oi
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = ?
`, [order.id]);

const digitalItems = items.filter(i => i.auto_delivery_content && i.auto_delivery_content.trim());
const hasPhysicalOrManualAcc = items.some(i => !i.auto_delivery_content || !i.auto_delivery_content.trim());

if (digitalItems.length > 0) {
  const deliveryText = digitalItems.map(i => i.auto_delivery_content.trim()).join('\n\n═══════════════════════════\n\n');
  
  if (!hasPhysicalOrManualAcc) {
    // 100% Sản phẩm số -> Hoàn tất tức thì!
    await db.execute(
      "UPDATE orders SET status = 'completed', delivery_data = ?, delivered_at = NOW() WHERE id = ?",
      [deliveryText, order.id]
    );
    console.log(`🚀 Zero-Touch Fulfillment thành công cho đơn số ${code}`);
  } else {
    // Đơn Combo -> Bàn giao trước phần tài liệu số, để processing cho admin cấp acc
    await db.execute(
      "UPDATE orders SET status = 'processing', delivery_data = ? WHERE id = ?",
      [deliveryText, order.id]
    );
    console.log(`📦 Bàn giao trước khóa học cho đơn Combo ${code}`);
  }
}
```

---

#### Task 3.2: Cập nhật `routes/admin.js` cho phép chỉnh sửa `auto_delivery_content`
- **File:** `routes/admin.js`
- **Mục tiêu:**
  - Trong `GET /api/admin/products`: Trả về trường `auto_delivery_content`.
  - Trong `POST /api/admin/products` và `PUT /api/admin/products/:id`: Nhận và lưu `auto_delivery_content`.

---

### Phase 4: Frontend Storefront (`public/index.html`) (30 phút)

#### Task 4.1: Thêm bộ lọc danh mục Khóa học & Combo
- **File:** `public/index.html`
- **Mục tiêu:** Thêm 2 chip danh mục vào thanh filter hero:
```html
<button class="filter-chip" data-cat="Khóa học & Tài liệu số">🎓 Khóa học &amp; Tài liệu số</button>
<button class="filter-chip" data-cat="Combo AI + Khóa học">🔥 Combo Siêu Hời</button>
```

#### Task 4.2: Huy hiệu nổi bật trên Product Card
- **File:** `public/index.html`
- **Mục tiêu:**
  - Với sản phẩm có danh mục `Khóa học & Tài liệu số`: Hiển thị badge xanh `⚡ Nhận link học tức thì`.
  - Với sản phẩm có danh mục `Combo AI + Khóa học`: Hiển thị badge cam `🎁 Tặng kèm Khóa học`.

---

### Phase 5: Frontend Admin (`public/admin.html`) (20 phút)

#### Task 5.1: Bổ sung trường "Nội dung tự động bàn giao" vào form Sản phẩm
- **File:** `public/admin.html`
- **Mục tiêu:**
  - Trong modal Thêm / Sửa sản phẩm: Thêm trường Textarea `auto_delivery_content`:
    `Nội dung tự động bàn giao (Link Google Drive / Hướng dẫn / Key): Gửi tự động cho khách ngay sau khi thanh toán.`
  - Thêm lựa chọn danh mục `Khóa học & Tài liệu số` và `Combo AI + Khóa học` vào dropdown danh mục.

---

## Tests & Validation Plan (TDD)

Tạo test script tự động: `scripts/test_digital_courses_fulfillment.js`

### Kịch bản kiểm thử:
1. **Test 1: Kiểm tra danh mục và sản phẩm số trên API:**
   - Gọi `GET /api/products` -> Xác nhận có ít nhất 2 sản phẩm thuộc `Khóa học & Tài liệu số` và 2 sản phẩm `Combo AI + Khóa học`.
2. **Test 2: Kiểm tra Zero-Touch Fulfillment (Đặt khóa học số):**
   - Đặt 1 đơn hàng với sản phẩm khóa học số (VD: Khóa Prompt Engineering).
   - Mock webhook Casso gửi thanh toán đúng số tiền cho mã đơn hàng đó.
   - Kiểm tra DB: Đơn hàng tự động chuyển sang `status = 'completed'` (không dừng lại ở `paid`).
   - Kiểm tra `orders.delivery_data` chứa chính xác link Google Drive khóa học.
3. **Test 3: Kiểm tra Combo Fulfillment:**
   - Đặt đơn hàng Combo (ChatGPT Plus + Khóa Prompt).
   - Mock webhook Casso.
   - Kiểm tra DB: Đơn hàng tự động có link khóa học trong `delivery_data` và chuyển sang `status = 'processing'` để Admin cấp tài khoản.
4. **Test 4: Kiểm tra giao diện hiển thị cho khách:**
   - Tra cứu đơn hàng Test 2 qua `GET /api/orders/:code` -> Trả về đầy đủ link tải tài liệu và hướng dẫn học.

**Lệnh chạy kiểm thử:**
```bash
node scripts/test_digital_courses_fulfillment.js
```

---

## Risks, Tradeoffs & Open Questions

1. **Bảo mật Link Google Drive:**
   - Link Drive nên được đặt ở chế độ "Người xem" (Viewer) để tránh khách hàng vô tình xóa hoặc sửa file gốc trong khóa học.
2. **Khách hàng không biết tìm link ở đâu:**
   - Khi thanh toán thành công, màn hình ăn mừng QR hiển thị ngay nút "Tải tài liệu / Xem khóa học ngay", đồng thời link được lưu bền vững trong modal "Đơn hàng của tôi".
