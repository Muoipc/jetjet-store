# Kế hoạch Hoàn thiện & Nâng cấp Toàn diện Chức năng Giỏ hàng — JetJet Store

## Goal
Hoàn thiện và nâng cấp trải nghiệm chức năng Giỏ hàng (Shopping Cart System) của JetJet Store: bổ sung kiểm soát tồn kho (stock limit), nút xóa 1-chạm cho từng món, nút dọn sạch giỏ hàng, hình ảnh thumbnail & chi tiết đơn giá, hiệu ứng nảy badge/toast phản hồi tức thì, và bảng tóm tắt sản phẩm trong màn hình xác nhận chốt đơn.

---

## Current Context & Assumptions
- **Hiện tại:**
  - Giỏ hàng lưu trữ client-side qua `localStorage` (`jetjet_cart`), hiển thị trong drawer trượt từ cạnh phải (`#cart-backdrop`).
  - Hàng giỏ hàng (`.cart-row`) chỉ hiển thị tên sản phẩm và tổng tiền, thiếu ảnh thumbnail, thiếu đơn giá lẻ.
  - Người dùng muốn xóa sản phẩm phải bấm liên tục nút `-` cho tới khi số lượng về 0; không có nút xóa 1-chạm hoặc nút dọn sạch giỏ.
  - Nút `+` trong giỏ hàng không kiểm tra tồn kho (`p.stock`), người dùng có thể tăng số lượng vượt quá số hàng có trong kho.
  - Khi bấm thêm vào giỏ hàng (`addToCart`), drawer tự động mở nhưng thiếu phản hồi nảy badge hoặc toast thông báo trực quan.
  - Trong Modal xác nhận chốt đơn (`#modal-backdrop`), khách hàng chỉ nhìn thấy "Tổng thanh toán: ...đ" mà không thấy danh sách tóm tắt các món hàng mình đang đặt.
- **Công nghệ & Phong cách:**
  - Vanilla JS, HTML5, CSS3 chuẩn Sepia Minimalist.
  - Không thêm thư viện phụ thuộc bên ngoài (YAGNI).
  - Tận dụng hệ thống Floating Toast và Custom Confirm Dialog đã xây dựng.

---

## Architecture & Proposed Approach
1. **Giao diện Drawer Giỏ hàng (`.cart-drawer`)**:
   - Thêm nút "Xóa tất cả" (`#btn-clear-cart`) trên Header giỏ hàng khi có sản phẩm.
   - Nâng cấp cấu trúc hàng giỏ hàng (`.cart-row`):
     - Thumbnail ảnh sản phẩm (hoặc icon AI) kích thước 44×44px, bo góc mềm mại.
     - Tên sản phẩm + Dòng chi tiết đơn giá: `[Đơn giá] × [Số lượng]`.
     - Bộ điều khiển số lượng bo tròn: nút `-`, số lượng, nút `+` (tự động khóa `disabled` khi đạt tối đa `p.stock`).
     - Nút xóa 1-chạm (icon thùng rác nét mảnh `.ui-icon`), xóa ngay khỏi giỏ và hiện Toast phản hồi.
2. **Logic Kiểm soát Tồn kho (Stock Clamping & Safeguard)**:
   - Trong `changeQty(id, delta)`: kiểm tra `p.stock`. Nếu `it.quantity + delta > p.stock`, chặn lại và thông báo toast `Đã đạt giới hạn tồn kho (còn X sản phẩm)`.
   - Trong `updateCart()`: tự động đồng bộ lại tồn kho nếu sản phẩm bị admin giảm stock hoặc hết hàng (`stock <= 0`).
3. **Hiệu ứng Tương tác (Feedback & Animation)**:
   - Thêm CSS `@keyframes cartBadgePulse` làm nảy badge số lượng trên thanh Header khi có thao tác thêm đồ.
   - Bắn Toast thông báo `Đã thêm [Tên sản phẩm] vào giỏ hàng` khi người dùng bấm mua.
4. **Tóm tắt Sản phẩm trong Modal Checkout (`#modal-backdrop`)**:
   - Thêm khối danh sách tóm tắt (`#checkout-items-summary`) trước form nhận tài khoản: hiển thị danh sách món, số lượng, thành tiền nhỏ gọn để khách kiểm tra lại trước khi tạo mã QR.

---

## Step-by-Step Tasks

### Phase 1: Nâng cấp CSS & Animation cho Giỏ hàng (`public/index.html`)

#### Task 1.1: Bổ sung CSS cho hàng giỏ hàng mới, badge bounce, nút xóa
- **File:** `public/index.html`
- **Vị trí:** Trong thẻ `<style>`, cập nhật phần `/* Cart Drawer */`:

```css
    /* Enhanced Cart Drawer Styles */
    .cart-clear-btn {
      background: none;
      border: none;
      font-size: 0.75rem;
      color: var(--text-subtle);
      cursor: pointer;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      transition: color 0.15s, background 0.15s;
      margin-left: auto;
      margin-right: 0.5rem;
      text-decoration: underline;
    }
    .cart-clear-btn:hover {
      color: #dc2626;
      background: #fef2f2;
    }

    .cart-item-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 1rem;
      background: var(--surface);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      transition: border-color 0.15s;
    }
    .cart-item-thumb {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--radius-sm);
      object-fit: cover;
      background: #ffffff;
      border: 1px solid var(--border);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }
    .cart-item-info {
      flex: 1;
      min-width: 0;
    }
    .cart-item-name {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.15rem;
    }
    .cart-item-subprice {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .cart-item-total {
      font-size: 0.875rem;
      font-weight: 800;
      color: var(--text);
      margin-top: 0.15rem;
    }

    .cart-item-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.45rem;
      flex-shrink: 0;
    }
    .btn-cart-remove {
      background: none;
      border: none;
      color: var(--text-subtle);
      cursor: pointer;
      padding: 0.2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      transition: color 0.15s;
    }
    .btn-cart-remove:hover {
      color: #dc2626;
    }

    /* Badge Bounce Animation */
    .cart-badge-bounce {
      animation: cartBadgeBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes cartBadgeBounce {
      0% { transform: scale(1); }
      50% { transform: scale(1.4); background: var(--black); }
      100% { transform: scale(1); }
    }

    /* Checkout Modal Items Summary */
    .checkout-items-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      max-height: 9rem;
      overflow-y: auto;
    }
    .checkout-item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-block: 0.35rem;
      font-size: 0.825rem;
      border-bottom: 1px dashed var(--border);
    }
    .checkout-item-row:last-child {
      border-bottom: none;
    }
```

---

### Phase 2: Cập nhật Cấu trúc HTML Giỏ hàng & Checkout Modal (`public/index.html`)

#### Task 2.1: Thêm nút "Xóa tất cả" trong Drawer Header
- **File:** `public/index.html`
- **Vị trí:** Trong `.drawer-header` (dòng ~895):
```html
      <div class="drawer-header">
        <h3 class="drawer-title" style="display:flex;align-items:center;gap:0.5rem;">
          <svg class="ui-icon" viewBox="0 0 24 24"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          <span>Giỏ hàng</span>
        </h3>
        <button type="button" class="cart-clear-btn" id="btn-clear-cart" style="display:none;">Xóa tất cả</button>
        <button class="btn-icon-close" id="btn-close-cart" aria-label="Đóng">
          <svg class="ui-icon" style="width:1.1rem;height:1.1rem;" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
```

#### Task 2.2: Bổ sung Bảng tóm tắt món hàng trong Checkout Modal
- **File:** `public/index.html`
- **Vị trí:** Trong `<form id="checkout-form">` (ngay trước khối thông tin khách hàng):
```html
      <!-- Customer Form -->
      <form id="checkout-form">
        <!-- Cart Items Summary in Checkout -->
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem; letter-spacing:0.04em;">
          Sản phẩm đặt mua
        </div>
        <div class="checkout-items-box" id="checkout-items-summary">
          <!-- Rendered dynamically via JS -->
        </div>
```

---

### Phase 3: Nâng cấp Toàn bộ Logic JavaScript Giỏ hàng (`public/index.html`)

#### Task 3.1: Hoàn thiện `addToCart(id)` kèm Animation & Toast
- **File:** `public/index.html`
- **Code nâng cấp:**
```javascript
    function triggerCartBadgeAnimation() {
      const badge = document.getElementById('cart-count-badge');
      if (!badge) return;
      badge.classList.remove('cart-badge-bounce');
      void badge.offsetWidth; // Trigger reflow
      badge.classList.add('cart-badge-bounce');
    }

    function addToCart(id) {
      const p = products.find(x => x.id === id);
      if (!p) return;
      if (p.stock <= 0) {
        showToast(`Sản phẩm "${p.name}" hiện đang hết hàng!`, 'error');
        return;
      }

      const exist = cart.find(x => x.id === id);
      if (exist) {
        if (exist.quantity >= p.stock) {
          showToast(`Sản phẩm "${p.name}" chỉ còn ${p.stock} tài khoản trong kho!`, 'error');
          return;
        }
        exist.quantity++;
      } else {
        cart.push({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.image || null,
          category: p.category || '',
          quantity: 1
        });
      }

      saveCart();
      updateCart();
      triggerCartBadgeAnimation();
      showToast(`Đã thêm "${p.name}" vào giỏ hàng!`, 'success');
      openCart();
    }
```

#### Task 3.2: Hoàn thiện `updateCart()` với Card Thumbnail, Đơn giá, Nút Xóa & Nút Clear All
- **File:** `public/index.html`
- **Code nâng cấp:**
```javascript
    function updateCart() {
      const badge = document.getElementById('cart-count-badge');
      const totalCount = cart.reduce((s, i) => s + i.quantity, 0);
      badge.textContent = totalCount;

      const body = document.getElementById('cart-body');
      const totalEl = document.getElementById('drawer-total');
      const btnCheckout = document.getElementById('btn-checkout-start');
      const btnClearCart = document.getElementById('btn-clear-cart');

      if (cart.length === 0) {
        body.innerHTML = `
          <div style="text-align:center; padding:3.5rem 1.5rem; color:var(--text-muted);">
            <svg class="ui-icon" style="width:3rem;height:3rem;margin-bottom:0.75rem;color:var(--text-subtle);" viewBox="0 0 24 24"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            <div style="font-weight:700; font-size:1rem; color:var(--text); margin-bottom:0.35rem;">Giỏ hàng của bạn đang trống</div>
            <div style="font-size:0.825rem; line-height:1.5;">Hãy chọn tài khoản AI phù hợp để thêm vào giỏ hàng nhé!</div>
          </div>
        `;
        totalEl.textContent = '0đ';
        if (btnCheckout) {
          btnCheckout.disabled = true;
          btnCheckout.style.opacity = '0.45';
          btnCheckout.style.cursor = 'not-allowed';
        }
        if (btnClearCart) btnClearCart.style.display = 'none';
        return;
      }

      if (btnClearCart) btnClearCart.style.display = 'inline-block';
      if (btnCheckout) {
        btnCheckout.disabled = false;
        btnCheckout.style.opacity = '1';
        btnCheckout.style.cursor = 'pointer';
      }

      const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
      totalEl.textContent = total.toLocaleString('vi-VN') + 'đ';

      body.innerHTML = cart.map(item => {
        const p = products.find(x => x.id === item.id) || item;
        const currentStock = typeof p.stock === 'number' ? p.stock : 999;
        const isMaxStock = item.quantity >= currentStock;

        const thumbHtml = item.image
          ? `<img src="${item.image}" class="cart-item-thumb" alt="${escapeHtml(item.name)}" />`
          : `<div class="cart-item-thumb"><svg class="ui-icon" style="width:1.25rem;height:1.25rem;color:var(--text-subtle);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></div>`;

        return `
          <div class="cart-item-card">
            ${thumbHtml}
            <div class="cart-item-info">
              <div class="cart-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
              <div class="cart-item-subprice">${item.price.toLocaleString('vi-VN')}đ × ${item.quantity}</div>
              <div class="cart-item-total">${(item.price * item.quantity).toLocaleString('vi-VN')}đ</div>
            </div>
            <div class="cart-item-actions">
              <button type="button" class="btn-cart-remove" onclick="removeFromCart(${item.id})" title="Xóa món này">
                <svg class="ui-icon" style="width:0.95rem;height:0.95rem;" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
              <div class="qty-controls">
                <button type="button" class="btn-step" onclick="changeQty(${item.id}, -1)">-</button>
                <span style="font-weight:700; font-size:0.8125rem; min-width:1.2rem; text-align:center;">${item.quantity}</span>
                <button type="button" class="btn-step" onclick="changeQty(${item.id}, 1)" ${isMaxStock ? 'disabled style="opacity:0.35; cursor:not-allowed;"' : ''}>+</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
```

#### Task 3.3: Thêm các hàm `removeFromCart(id)`, `changeQty(id, delta)` (có stock validation) và Xóa sạch giỏ
- **File:** `public/index.html`
- **Code bổ sung:**
```javascript
    function removeFromCart(id) {
      const it = cart.find(x => x.id === id);
      if (!it) return;
      cart = cart.filter(x => x.id !== id);
      saveCart();
      updateCart();
      triggerCartBadgeAnimation();
      showToast(`Đã xóa "${it.name}" khỏi giỏ hàng!`, 'info');
    }

    function changeQty(id, delta) {
      const it = cart.find(x => x.id === id);
      if (!it) return;

      const p = products.find(x => x.id === id);
      const stock = p && typeof p.stock === 'number' ? p.stock : 999;

      if (delta > 0 && it.quantity >= stock) {
        showToast(`Sản phẩm này chỉ còn tối đa ${stock} tài khoản trong kho!`, 'error');
        return;
      }

      it.quantity += delta;
      if (it.quantity <= 0) {
        cart = cart.filter(x => x.id !== id);
        showToast(`Đã xóa "${it.name}" khỏi giỏ hàng!`, 'info');
      }

      saveCart();
      updateCart();
      triggerCartBadgeAnimation();
    }

    // Clear All Cart Action
    const btnClearCart = document.getElementById('btn-clear-cart');
    if (btnClearCart) {
      btnClearCart.addEventListener('click', async () => {
        if (cart.length === 0) return;
        const confirmed = await showConfirmDialog({
          title: 'Dọn sạch giỏ hàng',
          message: 'Quý khách có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng không?',
          confirmText: 'Xóa toàn bộ',
          cancelText: 'Giữ lại',
          type: 'danger'
        });
        if (!confirmed) return;

        cart = [];
        saveCart();
        updateCart();
        triggerCartBadgeAnimation();
        showToast('Đã dọn sạch giỏ hàng!', 'info');
      });
    }
```

#### Task 3.4: Hiển thị tóm tắt món hàng trong Checkout Modal
- **File:** `public/index.html`
- **Vị trí:** Trong sự kiện `btn-checkout-start` click:
```javascript
    function renderCheckoutItemsSummary() {
      const box = document.getElementById('checkout-items-summary');
      if (!box) return;
      box.innerHTML = cart.map(item => `
        <div class="checkout-item-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span style="color:var(--text-muted); font-size:0.75rem;"> × ${item.quantity}</span>
          </div>
          <div style="font-weight:700;">${(item.price * item.quantity).toLocaleString('vi-VN')}đ</div>
        </div>
      `).join('');
    }
```
Gọi `renderCheckoutItemsSummary()` khi mở Modal Checkout.

---

### Phase 4: Kiểm thử Tự động (Automated Test Suite)

#### Task 4.1: Tạo test script `scripts/test_cart_enhancements.js`
- **File:** `scripts/test_cart_enhancements.js`
- **Nội dung kiểm thử:**
  1. Kiểm tra DOM elements mới trong `public/index.html`:
     - `#btn-clear-cart`
     - `#checkout-items-summary`
     - `.cart-item-card`, `.btn-cart-remove`
     - `@keyframes cartBadgeBounce`
  2. Mô phỏng luồng giỏ hàng (Cart Unit Tests):
     - Thêm sản phẩm vào giỏ (`addToCart`).
     - Tăng số lượng vượt quá `stock` -> xác nhận bị chặn.
     - Xóa 1 sản phẩm bằng `removeFromCart`.
     - Xóa sạch giỏ hàng.
  3. Kiểm tra cú pháp JavaScript không có lỗi syntax (`new Function(code)`).

- **Verify Command:**
```bash
node scripts/test_cart_enhancements.js
```
- **Expected Output:**
`🎉 TẤT CẢ CÁC BƯỚC TEST GIỎ HÀNG ĐỀU PASS 100%!`

---

## Risks, Tradeoffs & Mitigations

| Rủi ro / Vấn đề | Đánh giá | Giải pháp |
|-----------------|----------|-----------|
| Người dùng thêm hàng vượt quá tồn kho thực tế | Khách đặt nhiều hơn số shop có | Chặn ngay tại nút `+` của giỏ hàng và validate lần 2 tại backend `/api/orders` bằng transaction |
| Giỏ hàng trong `localStorage` bị lưu dữ liệu sản phẩm cũ | Giá hoặc tên sản phẩm bị thay đổi ở DB | Khi nạp trang (`init`), đồng bộ lại `price` và `stock` từ danh sách `products` mới nhất của server |
| Xóa nhầm giỏ hàng | Khách vô tình bấm "Xóa tất cả" | Tích hợp hộp thoại `showConfirmDialog` xác nhận trước khi làm rỗng giỏ |

---

## Execution Estimate
- **Phase 1 (CSS & Animation):** ~5 phút
- **Phase 2 (HTML Drawer & Checkout):** ~5 phút
- **Phase 3 (JavaScript Cart Logic):** ~15 phút
- **Phase 4 (Automated Tests & Regression Check):** ~5 phút
- **Tổng thời gian thực thi:** ~30 phút (hoặc ~15 phút qua subagent-driven development).
