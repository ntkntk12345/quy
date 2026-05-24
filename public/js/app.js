// ==========================================================================
// TRẠNG THÁI HỆ THỐNG (APPLICATION STATE)
// ==========================================================================
const state = {
  products: [],
  cart: [],
  user: null,
  activeView: 'home',
  currentProductId: null,
  currentBrandFilter: 'all',
  isTyping: false,
  chatHistory: [
    { sender: 'ai', text: 'Xin chào! Tôi là Trợ lý AI tư vấn của cửa hàng. Bạn cần tôi hỗ trợ tìm điện thoại phù hợp với ngân sách hay nhu cầu sử dụng thế nào ạ?' }
  ]
};

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';

// ==========================================================================
// KHỞI CHẠY (INITIALIZATION)
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadSession();
  initEventListeners();
  await fetchProducts();
  switchView('home');
  renderChat();
});

// ==========================================================================
// TOAST NOTIFICATIONS SYSTEM
// ==========================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconHtml = '';
  if (type === 'success') {
    iconHtml = '<i class="fa-solid fa-circle-check"></i>';
  } else if (type === 'error') {
    iconHtml = '<i class="fa-solid fa-circle-xmark"></i>';
  } else {
    iconHtml = '<i class="fa-solid fa-circle-info"></i>';
  }

  toast.innerHTML = `
    <span class="toast-icon">${iconHtml}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Tự động đóng sau 3.5 giây
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 3500);
}

// Bọc hàm cũ để tương thích hoàn toàn
function showNotification(message, type = 'success') {
  showToast(message, type);
}

// ==========================================================================
// SESSION & STORAGE MANAGEMENT
// ==========================================================================
function saveSession() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
  localStorage.setItem('user', JSON.stringify(state.user));
}

function loadSession() {
  const savedCart = localStorage.getItem('cart');
  const savedUser = localStorage.getItem('user');

  if (savedCart) state.cart = JSON.parse(savedCart);
  if (savedUser) state.user = JSON.parse(savedUser);

  updateCartBadge();
  updateAuthNavBar();
}

function logout() {
  state.user = null;
  saveSession();
  updateAuthNavBar();
  switchView('home');
  showToast('Đã đăng xuất tài khoản thành công!', 'info');
}

function updateAuthNavBar() {
  const authBtn = document.getElementById('navbar-auth-btn');
  const adminLink = document.getElementById('nav-link-admin');
  
  if (state.user) {
    authBtn.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; font-size:13.5px; font-weight:600;">
        <span style="color:var(--text-primary);"><i class="fa-solid fa-user-circle"></i> Hi, ${state.user.fullname.split(' ').pop()}</span>
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:12px;" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
      </div>
    `;
    if (state.user.role === 'admin') {
      adminLink.style.display = 'block';
    } else {
      adminLink.style.display = 'none';
    }
  } else {
    authBtn.innerHTML = `<button class="btn btn-secondary" onclick="switchView('login')"><i class="fa-solid fa-user-lock"></i> Đăng nhập</button>`;
    adminLink.style.display = 'none';
  }
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================
function formatPrice(val) {
  return Number(val).toLocaleString('vi-VN') + ' đ';
}

function parseMarkdown(text) {
  if (!text) return '';
  let html = text;
  
  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Headers: ### text
  html = html.replace(/### (.*?)\n/g, '<h3>$1</h3>');
  html = html.replace(/## (.*?)\n/g, '<h2>$1</h2>');
  
  // Lists: * text hoặc - text
  html = html.replace(/^\s*[\*\-]\s*(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Newlines
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// ==========================================================================
// VIEW NAVIGATION
// ==========================================================================
function switchView(viewName, params = {}) {
  state.activeView = viewName;
  
  // Đóng Mobile Menu nếu đang mở
  document.getElementById('nav-menu').classList.remove('active');
  
  // Ẩn tất cả views
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
  
  // Kích hoạt view
  const activeSection = document.getElementById(`section-${viewName}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }
  
  const menuLink = document.getElementById(`nav-link-${viewName}`);
  if (menuLink) {
    menuLink.classList.add('active');
  }
  
  // Xử lý các nghiệp vụ hiển thị phụ
  if (viewName === 'home') {
    renderProducts();
  } else if (viewName === 'detail') {
    state.currentProductId = params.productId;
    renderProductDetail(params.productId);
  } else if (viewName === 'cart') {
    if (!state.user) {
      showToast('Vui lòng đăng nhập để xem giỏ hàng và thanh toán!', 'warning');
      switchView('login');
    } else {
      renderCart();
    }
  } else if (viewName === 'admin') {
    if (!state.user || state.user.role !== 'admin') {
      showToast('Bạn không có quyền quản trị!', 'error');
      switchView('home');
    } else {
      loadAdminData();
    }
  }
  
  window.scrollTo(0, 0);
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function initEventListeners() {
  // Tìm kiếm
  document.getElementById('search-btn').addEventListener('click', () => {
    const searchVal = document.getElementById('search-input').value;
    fetchProducts(searchVal);
  });
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      fetchProducts(e.target.value);
    }
  });

  // Forms
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('product-form').addEventListener('submit', saveProduct);

  // Chat keyboard
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
}

function toggleMobileMenu() {
  document.getElementById('nav-menu').classList.toggle('active');
}

function scrollToCatalog() {
  const el = document.getElementById('catalog-anchor');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ==========================================================================
// DATA FETCH & RENDERING (CATALOG & SKELETONS)
// ==========================================================================
async function fetchProducts(searchVal = '') {
  const container = document.getElementById('product-grid-container');
  
  // Hiển thị Skeleton loading tuyệt đẹp trước khi tải
  if (container) {
    container.innerHTML = `
      <div class="skeleton-card skeleton"></div>
      <div class="skeleton-card skeleton"></div>
      <div class="skeleton-card skeleton"></div>
      <div class="skeleton-card skeleton"></div>
    `;
  }

  try {
    let url = `${API_BASE}/api/products`;
    if (searchVal) {
      url += `?search=${encodeURIComponent(searchVal)}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    
    // Giả lập độ trễ 500ms để trải nghiệm skeleton loading chuyên nghiệp hơn
    setTimeout(() => {
      state.products = data;
      // Khôi phục filter nếu có
      applyCurrentFilterAndSort();
    }, 500);
    
  } catch (error) {
    console.error('Lỗi tải sản phẩm:', error);
    showToast('Không tải được dữ liệu sản phẩm từ máy chủ!', 'error');
  }
}

function filterByBrand(brand, element) {
  document.querySelectorAll('.brand-chip-item').forEach(chip => chip.classList.remove('active'));
  element.classList.add('active');
  state.currentBrandFilter = brand;
  applyCurrentFilterAndSort();
}

function handleSortChange(select) {
  applyCurrentFilterAndSort();
}

// Hàm gộp chung lọc và sắp xếp
function applyCurrentFilterAndSort() {
  let filtered = [...state.products];
  
  // 1. Lọc theo hãng
  if (state.currentBrandFilter !== 'all') {
    filtered = filtered.filter(p => p.brand.toLowerCase() === state.currentBrandFilter.toLowerCase());
  }
  
  // 2. Sắp xếp
  const sortVal = document.getElementById('sort-select').value;
  if (sortVal === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortVal === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortVal === 'perf-desc') {
    filtered.sort((a, b) => b.rating_performance - a.rating_performance);
  }
  
  renderProducts(filtered);
}

// Render lưới sản phẩm trang chủ
function renderProducts(filteredProducts = state.products) {
  const container = document.getElementById('product-grid-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (filteredProducts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 60px 0;">
        <i class="fa-solid fa-box-open" style="font-size:48px; color:var(--text-muted); margin-bottom:16px;"></i>
        <p style="font-weight:600;">Không tìm thấy điện thoại nào phù hợp yêu cầu!</p>
      </div>
    `;
    return;
  }
  
  filteredProducts.forEach(p => {
    // Tính toán giả lập giá cũ và phần trăm giảm giá (ví dụ: máy nào cũng được giảm ngẫu nhiên từ 10% - 15%)
    const discountPercent = p.id % 2 === 0 ? 12 : 15;
    const oldPrice = Math.round((p.price * (100 + discountPercent) / 100) / 100000) * 100000;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <span class="card-badge-discount">-${discountPercent}% OFF</span>
      <div class="card-img-container" onclick="switchView('detail', {productId: ${p.id}})" style="cursor:pointer;">
        <img src="${p.image_url || 'https://via.placeholder.com/300'}" alt="${p.name}">
      </div>
      <div class="card-details">
        <span class="card-brand">${p.brand}</span>
        <h3 class="card-title" onclick="switchView('detail', {productId: ${p.id}})" style="cursor:pointer;">${p.name}</h3>
        
        <div class="card-rating">
          <i class="fa-solid fa-star"></i>
          <i class="fa-solid fa-star"></i>
          <i class="fa-solid fa-star"></i>
          <i class="fa-solid fa-star"></i>
          <i class="fa-solid fa-star"></i>
          <span>5.0</span>
        </div>

        <div class="card-price-grid">
          <span class="price-current">${formatPrice(p.price)}</span>
          <div class="price-old-row">
            <span class="price-old">${formatPrice(oldPrice)}</span>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn-card-buy" onclick="switchView('detail', {productId: ${p.id}})">Chi tiết</button>
          <button class="btn-card-cart" onclick="addToCart(${p.id})"><i class="fa-solid fa-cart-plus"></i></button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================================================
// CHI TIẾT SẢN PHẨM & TABS & RELATED PRODUCTS
// ==========================================================================
function switchDetailTab(tabId, element) {
  // Gỡ active headers
  document.querySelectorAll('.tab-header-btn').forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');

  // Gỡ active panels
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(`tab-panel-${tabId}`).classList.add('active');
}

function renderProductDetail(productId) {
  const product = state.products.find(p => p.id == productId);
  if (!product) {
    showToast('Sản phẩm không khả dụng!', 'error');
    switchView('home');
    return;
  }

  // Khôi phục Tab mặc định là Description
  const defaultTabBtn = document.querySelector('.tab-header-btn');
  if (defaultTabBtn) switchDetailTab('desc', defaultTabBtn);

  // Nạp thông tin
  document.getElementById('detail-image').src = product.image_url || 'https://via.placeholder.com/500';
  document.getElementById('detail-name').innerText = product.name;
  document.getElementById('detail-brand').innerText = product.brand.toUpperCase();
  document.getElementById('detail-price').innerText = formatPrice(product.price);
  
  // Giả lập giá cũ
  const discountPercent = product.id % 2 === 0 ? 12 : 15;
  const oldPrice = Math.round((product.price * (100 + discountPercent) / 100) / 100000) * 100000;
  document.getElementById('detail-old-price').innerText = formatPrice(oldPrice);

  document.getElementById('detail-promo').innerText = product.promotion || 'Khuyến mãi tặng ốp lưng cao cấp và gói VIP bảo hành vàng.';
  document.getElementById('detail-desc').innerText = product.description || 'Chưa có mô tả chi tiết cho sản phẩm.';

  // Bảng thông số chi tiết
  const table = document.getElementById('detail-specs-table');
  table.innerHTML = `
    <tr><td>Màn hình chính</td><td>${product.screen || 'Đang cập nhật'}</td></tr>
    <tr><td>Bộ vi xử lý (CPU)</td><td>${product.cpu || 'Đang cập nhật'}</td></tr>
    <tr><td>Dung lượng RAM</td><td>${product.ram || 'Đang cập nhật'}</td></tr>
    <tr><td>Bộ nhớ lưu trữ (ROM)</td><td>${product.rom || 'Đang cập nhật'}</td></tr>
    <tr><td>Dung lượng Pin & Sạc</td><td>${product.battery || 'Đang cập nhật'}</td></tr>
    <tr><td>Hệ thống Camera</td><td>${product.camera || 'Đang cập nhật'}</td></tr>
  `;

  // Liên kết nút bấm
  document.getElementById('detail-buy-btn').onclick = () => {
    addToCart(product.id);
    switchView('cart');
  };
  document.getElementById('detail-add-cart-btn').onclick = () => {
    addToCart(product.id);
  };

  // Cấu hình AI DSS Rating Progress bars
  document.getElementById('val-performance').innerText = `${product.rating_performance}/10`;
  document.getElementById('val-camera').innerText = `${product.rating_camera}/10`;
  document.getElementById('val-battery').innerText = `${product.rating_battery}/10`;
  document.getElementById('val-price').innerText = `${product.rating_price}/10`;

  const perfFill = document.getElementById('bar-performance');
  const camFill = document.getElementById('bar-camera');
  const batFill = document.getElementById('bar-battery');
  const priFill = document.getElementById('bar-price');

  // Đặt width về 0 trước khi chạy anim
  perfFill.style.width = '0';
  camFill.style.width = '0';
  batFill.style.width = '0';
  priFill.style.width = '0';

  // Chạy animation giãn thanh đo khi tab DSS mở
  document.getElementById('dss-tab-header').addEventListener('click', () => {
    setTimeout(() => {
      perfFill.style.width = `${(product.rating_performance || 5) * 10}%`;
      camFill.style.width = `${(product.rating_camera || 5) * 10}%`;
      batFill.style.width = `${(product.rating_battery || 5) * 10}%`;
      priFill.style.width = `${(product.rating_price || 5) * 10}%`;
    }, 50);
  });

  // Trợ lý AI liên kết
  document.getElementById('chatbot-suggest-compare').onclick = () => {
    openChatWithQuery(`So sánh điện thoại ${product.name} với các đối thủ cùng tầm giá`);
  };

  // Render sản phẩm tương tự hãng (Related products)
  renderRelatedProducts(product.brand, product.id);
}

function renderRelatedProducts(brand, currentId) {
  const container = document.getElementById('related-grid-container');
  if (!container) return;
  container.innerHTML = '';

  const related = state.products
    .filter(p => p.brand.toLowerCase() === brand.toLowerCase() && p.id != currentId)
    .slice(0, 3); // Lấy tối đa 3 máy

  if (related.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; font-size:13px; color:var(--text-muted);">Không có sản phẩm tương tự cùng hãng.</div>`;
    return;
  }

  related.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="card-img-container" onclick="switchView('detail', {productId: ${p.id}})" style="cursor:pointer; padding: 12px; height: 140px;">
        <img src="${p.image_url}" alt="${p.name}">
      </div>
      <div class="card-details" style="padding: 12px;">
        <h4 class="card-title" onclick="switchView('detail', {productId: ${p.id}})" style="cursor:pointer; font-size:13px; height: 36px;">${p.name}</h4>
        <span class="price-current" style="font-size:14px; margin-top: 8px;">${formatPrice(p.price)}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================================================
// GIỎ HÀNG & ĐẶT HÀNG (CART & CHECKOUT)
// ==========================================================================
function updateCartBadge() {
  const counts = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cart-count-badge');
  if (badge) badge.innerText = counts;
}

function addToCart(productId) {
  if (!state.user) {
    showToast('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!', 'warning');
    switchView('login');
    return;
  }

  const product = state.products.find(p => p.id == productId);
  if (!product) return;

  const exist = state.cart.find(item => item.id == productId);
  if (exist) {
    exist.quantity++;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1
    });
  }

  saveSession();
  updateCartBadge();
  showToast(`Đã thêm ${product.name} vào giỏ hàng thành công!`, 'success');
}

function changeQty(productId, delta) {
  const item = state.cart.find(item => item.id == productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    saveSession();
    renderCart();
    updateCartBadge();
  }
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.id != productId);
  saveSession();
  renderCart();
  updateCartBadge();
  showToast('Đã loại bỏ sản phẩm khỏi giỏ hàng.', 'info');
}

function renderCart() {
  const itemsList = document.getElementById('cart-items-list');
  const summaryBox = document.getElementById('cart-summary-box');
  
  if (!itemsList) return;
  itemsList.innerHTML = '';

  if (state.cart.length === 0) {
    itemsList.innerHTML = `
      <div style="text-align:center; padding: 48px 0; color:var(--text-secondary);">
        <i class="fa-solid fa-basket-shopping" style="font-size: 54px; color:var(--text-muted); margin-bottom: 16px;"></i>
        <p style="font-weight:700;">Giỏ hàng của bạn đang trống!</p>
        <button class="btn btn-primary" style="margin-top:20px;" onclick="switchView('home')">Tiếp tục mua hàng</button>
      </div>
    `;
    if (summaryBox) summaryBox.style.display = 'none';
    return;
  }

  if (summaryBox) summaryBox.style.display = 'block';

  state.cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="cart-item-thumbnail">
        <img src="${item.image_url}" alt="${item.name}">
      </div>
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <span class="cart-item-price">${formatPrice(item.price)}</span>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">-</button>
        <span class="qty-val">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <button class="btn-remove-cart" onclick="removeFromCart(${item.id})"><i class="fa-solid fa-trash-can"></i></button>
    `;
    itemsList.appendChild(row);
  });

  // Cập nhật số tiền
  const totalQty = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  document.getElementById('summary-qty').innerText = totalQty;
  document.getElementById('summary-subtotal').innerText = formatPrice(totalPrice);
  document.getElementById('summary-total').innerText = formatPrice(totalPrice);

  // Autofill nếu đã đăng nhập
  if (state.user) {
    document.getElementById('checkout-name').value = state.user.fullname || '';
    document.getElementById('checkout-phone').value = state.user.phone || '';
    document.getElementById('checkout-email').value = state.user.email || '';
  }
}

async function submitOrder(event) {
  event.preventDefault();

  if (!state.user) {
    showToast('Vui lòng đăng nhập để thực hiện đặt hàng!', 'error');
    switchView('login');
    return;
  }

  const fullname = document.getElementById('checkout-name').value;
  const phone = document.getElementById('checkout-phone').value;
  const email = document.getElementById('checkout-email').value;
  const address = document.getElementById('checkout-address').value;
  const totalPrice = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  if (!fullname || !phone || !email || !address) {
    showToast('Vui lòng điền đủ thông tin bắt buộc!', 'error');
    return;
  }

  const payload = {
    user_id: state.user ? state.user.id : null,
    fullname,
    phone,
    email,
    address,
    cart: state.cart,
    total_price: totalPrice
  };

  try {
    const response = await fetch(`${API_BASE}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (result.success) {
      showToast('Đặt hàng thành công! Cảm ơn quý khách.', 'success');
      state.cart = [];
      saveSession();
      updateCartBadge();

      // Hiển thị giao diện hoàn thành đơn
      const itemsList = document.getElementById('cart-items-list');
      itemsList.innerHTML = `
        <div style="text-align: center; padding: 48px 24px;">
          <i class="fa-solid fa-circle-check" style="font-size: 60px; color: var(--success); margin-bottom: 16px;"></i>
          <h2 style="font-size:24px; font-weight:800; color:var(--text-primary); margin-bottom: 8px;">ĐẶT HÀNG THÀNH CÔNG!</h2>
          <p style="font-size:14px; color:var(--text-secondary); margin-bottom: 24px;">Mã số hóa đơn của bạn là: <strong>#ORD-${result.orderId}</strong>. Chúng tôi sẽ sớm liên hệ xác nhận.</p>
          <button class="btn btn-primary" onclick="switchView('home')">Tiếp tục mua hàng</button>
        </div>
      `;
      document.getElementById('cart-summary-box').style.display = 'none';
    } else {
      showToast(result.error || 'Gặp lỗi trong quá trình xử lý đơn hàng!', 'error');
    }
  } catch (error) {
    console.error('Lỗi đặt hàng:', error);
    showToast('Lỗi đường truyền mạng!', 'error');
  }
}

// ==========================================================================
// TÀI KHOẢN (LOGIN & REGISTER)
// ==========================================================================
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    if (result.success) {
      state.user = result.user;
      saveSession();
      updateAuthNavBar();
      showToast(`Chào mừng quay trở lại, ${result.user.fullname}!`, 'success');
      
      if (result.user.role === 'admin') {
        switchView('admin');
      } else {
        switchView('home');
      }
      document.getElementById('login-form').reset();
    } else {
      showToast(result.error || 'Tài khoản hoặc mật khẩu không chính xác!', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Lỗi kết nối tới máy chủ!', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;
  const fullname = document.getElementById('reg-fullname').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, fullname, email, phone })
    });

    const result = await response.json();
    if (result.success) {
      showToast('Đăng ký tài khoản thành viên mới thành công!', 'success');
      toggleAuthMode('login');
      document.getElementById('login-username').value = username;
      document.getElementById('register-form').reset();
    } else {
      showToast(result.error || 'Lỗi đăng ký tài khoản.', 'error');
    }
  } catch (error) {
    console.error('Register error:', error);
    showToast('Lỗi kết nối mạng!', 'error');
  }
}

function toggleAuthMode(mode) {
  const loginCard = document.getElementById('auth-login-card');
  const regCard = document.getElementById('auth-register-card');

  if (mode === 'register') {
    loginCard.style.display = 'none';
    regCard.style.display = 'block';
  } else {
    loginCard.style.display = 'block';
    regCard.style.display = 'none';
  }
}

// ==========================================================================
// ADMIN DASHBOARD
// ==========================================================================
let adminActiveTab = 'products';

function switchAdminTab(tabName) {
  adminActiveTab = tabName;
  document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeTabBtn = document.getElementById(`admin-tab-${tabName}`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  const contentTitle = document.getElementById('admin-content-title');
  const addBtn = document.getElementById('admin-add-product-btn');

  if (tabName === 'products') {
    contentTitle.innerHTML = '<i class="fa-solid fa-boxes-stacked"></i> Danh mục sản phẩm';
    addBtn.style.display = 'block';
    renderAdminProducts();
  } else if (tabName === 'orders') {
    contentTitle.innerHTML = '<i class="fa-solid fa-receipt"></i> Danh sách đơn hàng';
    addBtn.style.display = 'none';
    renderAdminOrders();
  } else if (tabName === 'leads') {
    contentTitle.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Danh sách liên hệ (Leads)';
    addBtn.style.display = 'none';
    renderAdminLeads();
  }
}

async function loadAdminStats() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/stats`);
    const stats = await response.json();
    
    const revenueEl = document.getElementById('admin-stat-revenue');
    const ordersEl = document.getElementById('admin-stat-orders');
    const productsEl = document.getElementById('admin-stat-products');
    const leadsEl = document.getElementById('admin-stat-leads');
    
    if (revenueEl) revenueEl.innerText = formatPrice(stats.revenue || 0);
    if (ordersEl) ordersEl.innerText = `${stats.ordersCount || 0} Đơn`;
    if (productsEl) productsEl.innerText = `${stats.productsCount || 0} Thiết bị`;
    if (leadsEl) leadsEl.innerText = `${stats.leadsCount || 0} Khách`;
  } catch (error) {
    console.error('Lỗi tải thống kê admin:', error);
  }
}

async function loadAdminData() {
  await fetchProducts(); // Reload sản phẩm
  await loadAdminStats(); // Reload thống kê
  switchAdminTab(adminActiveTab);
}

function renderAdminProducts() {
  const container = document.getElementById('admin-table-container');
  if (!container) return;

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th style="width: 50px;">ID</th>
          <th>Tên thiết bị</th>
          <th>Hãng</th>
          <th>Giá bán</th>
          <th>Cấu hình</th>
          <th>Điểm AI DSS</th>
          <th style="text-align:right;">Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${state.products.map(p => `
          <tr>
            <td>${p.id}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.brand}</td>
            <td style="font-weight:700; color:var(--primary);">${formatPrice(p.price)}</td>
            <td style="font-size:12px;">${p.cpu.split('(')[0]} | ROM ${p.rom}</td>
            <td style="font-weight:600; font-size:12px; color:var(--success);">
              Hiệu năng: ${p.rating_performance} | Cam: ${p.rating_camera} | Pin: ${p.rating_battery} | P/P: ${p.rating_price}
            </td>
            <td style="text-align:right;">
              <button class="admin-action-btn edit" onclick="openProductModal(${p.id})"><i class="fa-solid fa-pen-to-square"></i> Sửa</button>
              <button class="admin-action-btn delete" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash-can"></i> Xóa</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderAdminOrders() {
  const container = document.getElementById('admin-table-container');
  if (!container) return;

  container.innerHTML = `<div style="padding: 24px; text-align:center;">Đang đồng bộ hóa hóa đơn...</div>`;

  try {
    const response = await fetch(`${API_BASE}/api/order/list?role=admin`);
    const orders = await response.json();

    if (orders.length === 0) {
      container.innerHTML = `<div style="padding: 30px; text-align:center; color:var(--text-muted);">Chưa ghi nhận đơn hàng nào.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Khách hàng</th>
            <th>Liên hệ</th>
            <th>Địa chỉ giao</th>
            <th>Chi tiết dòng máy</th>
            <th>Tổng tiền</th>
            <th>Trạng thái</th>
            <th style="text-align:right; width:160px;">Hành động</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => {
            const dateStr = new Date(o.created_at).toLocaleString('vi-VN');
            const itemsHtml = o.items.map(i => `• ${i.product_name} (x${i.quantity})`).join('<br>');
            
            let statusHtml = '';
            let actionHtml = '';

            if (o.status === 'completed') {
              statusHtml = `<span class="badge-status completed"><i class="fa-solid fa-circle-check"></i> Đã duyệt</span>`;
            } else if (o.status === 'cancelled') {
              statusHtml = `<span class="badge-status cancelled"><i class="fa-solid fa-circle-xmark"></i> Đã hủy</span>`;
            } else {
              statusHtml = `<span class="badge-status pending"><i class="fa-solid fa-circle-notch fa-spin"></i> Chờ duyệt</span>`;
              actionHtml = `
                <button class="admin-action-btn approve" onclick="updateOrderStatus(${o.id}, 'completed')"><i class="fa-solid fa-check"></i> Duyệt</button>
                <button class="admin-action-btn cancel" onclick="updateOrderStatus(${o.id}, 'cancelled')"><i class="fa-solid fa-xmark"></i> Hủy</button>
              `;
            }

            return `
              <tr>
                <td><strong>#ORD-${o.id}</strong><br><span style="font-size:11px; color:var(--text-muted);">${dateStr}</span></td>
                <td><strong>${o.fullname}</strong></td>
                <td>SĐT: ${o.phone}<br><span style="font-size:11px; color:var(--text-muted);">${o.email}</span></td>
                <td style="max-width:200px; white-space:normal; font-size:12px;">${o.address}</td>
                <td style="font-size:12px;">${itemsHtml}</td>
                <td style="font-weight:700; color:var(--primary);">${formatPrice(o.total_price)}</td>
                <td>${statusHtml}</td>
                <td style="text-align:right;">${actionHtml}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Lỗi orders admin:', error);
    container.innerHTML = `<div style="padding: 24px; text-align:center; color:var(--accent);">Lỗi mạng khi tải hóa đơn!</div>`;
  }
}

async function updateOrderStatus(orderId, status) {
  const confirmMsg = status === 'completed' 
    ? 'Bạn có chắc chắn muốn duyệt đơn hàng này?' 
    : 'Bạn có chắc chắn muốn hủy đơn hàng này?';

  if (!confirm(confirmMsg)) return;

  try {
    const response = await fetch(`${API_BASE}/api/order/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast(status === 'completed' ? 'Đã duyệt đơn hàng thành công!' : 'Đã hủy đơn hàng thành công!', 'success');
      loadAdminData();
    } else {
      showToast(result.error || 'Lỗi cập nhật trạng thái đơn hàng!', 'error');
    }
  } catch (error) {
    console.error('Lỗi cập nhật đơn hàng:', error);
    showToast('Lỗi kết nối server!', 'error');
  }
}

async function renderAdminLeads() {
  const container = document.getElementById('admin-table-container');
  if (!container) return;

  container.innerHTML = `<div style="padding: 24px; text-align:center;">Đang tải danh sách liên hệ...</div>`;

  try {
    const response = await fetch(`${API_BASE}/api/lead/list`);
    const leads = await response.json();

    if (leads.length === 0) {
      container.innerHTML = `<div style="padding: 30px; text-align:center; color:var(--text-muted);">Chưa có yêu cầu liên hệ nào.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 80px;">ID</th>
            <th>Email</th>
            <th>Số điện thoại</th>
            <th>Nguồn đăng ký</th>
            <th>Ngày gửi</th>
            <th style="text-align:right; width: 100px;">Hành động</th>
          </tr>
        </thead>
        <tbody>
          ${leads.map(l => {
            const dateStr = new Date(l.created_at).toLocaleString('vi-VN');
            return `
              <tr>
                <td><strong>#LEAD-${l.id}</strong></td>
                <td>${l.email || '<span style="color:var(--text-muted); font-style:italic;">Không cung cấp</span>'}</td>
                <td><strong>${l.phone || '<span style="color:var(--text-muted); font-style:italic;">Không cung cấp</span>'}</strong></td>
                <td><span class="badge-status" style="background-color: var(--primary-light); color: var(--primary); font-size:10px; border-radius:4px; padding:2px 6px;">${l.source}</span></td>
                <td>${dateStr}</td>
                <td style="text-align:right;">
                  <button class="admin-action-btn delete" onclick="deleteLead(${l.id})"><i class="fa-solid fa-trash-can"></i> Xóa</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Lỗi tải danh sách lead:', error);
    container.innerHTML = `<div style="padding: 24px; text-align:center; color:var(--accent);">Lỗi mạng khi tải danh sách liên hệ!</div>`;
  }
}

async function deleteLead(leadId) {
  if (!confirm('Bạn có chắc chắn muốn xóa liên hệ này?')) return;

  try {
    const response = await fetch(`${API_BASE}/api/lead/${leadId}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (result.success) {
      showToast('Đã xóa thông tin liên hệ thành công.', 'success');
      loadAdminData();
    } else {
      showToast(result.error || 'Lỗi khi xóa liên hệ!', 'error');
    }
  } catch (error) {
    console.error('Lỗi xóa lead:', error);
    showToast('Lỗi kết nối server!', 'error');
  }
}


function openProductModal(productId = null) {
  const modal = document.getElementById('admin-product-modal');
  const form = document.getElementById('product-form');
  const title = document.getElementById('modal-title');
  
  form.reset();

  if (productId) {
    title.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Cập Nhật Điện Thoại';
    const p = state.products.find(p => p.id == productId);
    if (p) {
      document.getElementById('form-product-id').value = p.id;
      document.getElementById('form-name').value = p.name;
      document.getElementById('form-brand').value = p.brand;
      document.getElementById('form-price').value = p.price;
      document.getElementById('form-screen').value = p.screen;
      document.getElementById('form-cpu').value = p.cpu;
      document.getElementById('form-ram').value = p.ram;
      document.getElementById('form-rom').value = p.rom;
      document.getElementById('form-battery').value = p.battery;
      document.getElementById('form-camera').value = p.camera;
      document.getElementById('form-image-url').value = p.image_url;
      document.getElementById('form-description').value = p.description;
      document.getElementById('form-promotion').value = p.promotion;
      document.getElementById('form-rating-perf').value = p.rating_performance;
      document.getElementById('form-rating-cam').value = p.rating_camera;
      document.getElementById('form-rating-bat').value = p.rating_battery;
      document.getElementById('form-rating-price').value = p.rating_price;
    }
  } else {
    title.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm Điện Thoại Mới';
    document.getElementById('form-product-id').value = '';
  }

  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('admin-product-modal').classList.remove('active');
}

async function saveProduct(event) {
  event.preventDefault();

  const id = document.getElementById('form-product-id').value;
  const payload = {
    name: document.getElementById('form-name').value,
    brand: document.getElementById('form-brand').value,
    price: Number(document.getElementById('form-price').value),
    screen: document.getElementById('form-screen').value,
    cpu: document.getElementById('form-cpu').value,
    ram: document.getElementById('form-ram').value,
    rom: document.getElementById('form-rom').value,
    battery: document.getElementById('form-battery').value,
    camera: document.getElementById('form-camera').value,
    image_url: document.getElementById('form-image-url').value,
    description: document.getElementById('form-description').value,
    promotion: document.getElementById('form-promotion').value,
    rating_performance: Number(document.getElementById('form-rating-perf').value || 5),
    rating_camera: Number(document.getElementById('form-rating-cam').value || 5),
    rating_battery: Number(document.getElementById('form-rating-bat').value || 5),
    rating_price: Number(document.getElementById('form-rating-price').value || 5)
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_BASE}/api/products/${id}` : `${API_BASE}/api/products`;

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      showToast(id ? 'Đã cập nhật cấu hình điện thoại thành công!' : 'Đã thêm dòng điện thoại mới vào cơ sở dữ liệu!', 'success');
      closeProductModal();
      loadAdminData();
    } else {
      showToast(result.error || 'Không ghi nhận được thông số!', 'error');
    }
  } catch (error) {
    console.error('Lỗi lưu sản phẩm:', error);
    showToast('Lỗi kết nối máy chủ!', 'error');
  }
}

async function deleteProduct(productId) {
  // Đồng bộ Confirm dialog phong cách
  if (!confirm('Bạn có chắc chắn muốn gỡ bỏ dòng điện thoại này khỏi cơ sở dữ liệu? AI tư vấn cũng sẽ xóa máy này khỏi phân tích.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/products/${productId}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (result.success) {
      showToast('Đã xóa thành công sản phẩm khỏi cơ sở dữ liệu.', 'success');
      loadAdminData();
    } else {
      showToast(result.error || 'Lỗi khi gỡ sản phẩm!', 'error');
    }
  } catch (error) {
    console.error('Lỗi xóa sản phẩm:', error);
    showToast('Lỗi kết nối server!', 'error');
  }
}

// ==========================================================================
// TRỢ LÝ AI CHATBOT (AI CLIENT LOGIC)
// ==========================================================================
function toggleChat() {
  const win = document.getElementById('chatbot-window');
  win.classList.toggle('active');
  
  if (win.classList.contains('active')) {
    scrollToChatBottom();
    document.getElementById('chat-input').focus();
  }
}

function scrollToChatBottom() {
  const body = document.getElementById('chat-body-container');
  if (body) body.scrollTop = body.scrollHeight;
}

function renderChat() {
  const container = document.getElementById('chat-body-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  state.chatHistory.forEach((msg, idx) => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${msg.sender}`;
    bubble.innerHTML = parseMarkdown(msg.text);
    container.appendChild(bubble);

    // Kèm form Lead nếu cần thu thập liên hệ N8N
    if (msg.showLeadForm) {
      const leadBox = document.createElement('div');
      leadBox.className = 'chat-lead-box';
      leadBox.innerHTML = `
        <p><i class="fa-solid fa-gift"></i> Đăng ký thông tin nhận Voucher 100K & Tư vấn:</p>
        <div class="chat-lead-form">
          <input type="text" id="chat-lead-phone-${idx}" placeholder="SĐT hoặc Email của bạn...">
          <button onclick="submitChatLead(${idx})">Gửi</button>
        </div>
      `;
      container.appendChild(leadBox);
    }
  });

  // Hiển thị bong bóng typing động từ state
  if (state.isTyping) {
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-typing-container';
    typingBubble.style.display = 'block';
    typingBubble.innerHTML = `
      <div class="chat-typing-dots">
        <span class="chat-typing-dot"></span>
        <span class="chat-typing-dot"></span>
        <span class="chat-typing-dot"></span>
      </div>
    `;
    container.appendChild(typingBubble);
  }
  
  scrollToChatBottom();
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  state.chatHistory.push({ sender: 'user', text });
  state.isTyping = true;
  renderChat();
  input.value = '';

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(0, -1)
      })
    });

    const result = await response.json();
    state.isTyping = false;

    if (result.reply) {
      state.chatHistory.push({
        sender: 'ai',
        text: result.reply,
        showLeadForm: !!result.showLeadForm && !state.user
      });
      renderChat();
    } else {
      state.chatHistory.push({ sender: 'ai', text: 'Xin lỗi, hệ thống AI đang quá tải. Bạn hãy đặt câu hỏi khác nhé!' });
      renderChat();
    }
  } catch (error) {
    console.error('Chat error:', error);
    state.isTyping = false;
    state.chatHistory.push({ sender: 'ai', text: 'Mất kết nối máy chủ tư vấn. Xin vui lòng kiểm tra lại mạng!' });
    renderChat();
  }
}

function sendSuggestedMessage(text) {
  const win = document.getElementById('chatbot-window');
  if (!win.classList.contains('active')) {
    win.classList.add('active');
  }
  document.getElementById('chat-input').value = text;
  sendChatMessage();
}

function openChatWithQuery(message) {
  sendSuggestedMessage(message);
}

// Gửi thông tin Lead từ chatbot
async function submitChatLead(idx) {
  const input = document.getElementById(`chat-lead-phone-${idx}`);
  if (!input) return;

  const val = input.value.trim();
  if (!val) {
    showToast('Vui lòng điền địa chỉ liên hệ của bạn!', 'error');
    return;
  }

  const isEmail = val.includes('@');
  const payload = {
    email: isEmail ? val : '',
    phone: !isEmail ? val : '',
    source: 'chatbot'
  };

  try {
    const response = await fetch(`${API_BASE}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (result.success) {
      showToast('Đăng ký nhận tư vấn thành công!', 'success');
      
      const leadBoxes = document.querySelectorAll('.chat-lead-box');
      leadBoxes.forEach(box => {
        box.innerHTML = `<span style="color:var(--success); font-weight:700; font-size:12px;"><i class="fa-solid fa-circle-check"></i> Đã ghi nhận thông tin đăng ký!</span>`;
      });
      
      state.chatHistory.push({
        sender: 'ai',
        text: 'Cảm ơn bạn! Thông tin đăng ký của bạn đã được lưu lại. Nhân viên tư vấn của SmartPhone AI sẽ liên hệ lại qua điện thoại/email sớm nhất.'
      });
      renderChat();
    } else {
      showToast(result.error || 'Lỗi gửi thông tin.', 'error');
    }
  } catch (error) {
    console.error('Lead error:', error);
    showToast('Lỗi kết nối mạng!', 'error');
  }
}
