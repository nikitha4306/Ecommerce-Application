/* ==========================================================================
   MINI E-COMMERCE VANILLA JAVASCRIPT APPLICATION
   Uses Standard Browser Fetch API for REST Endpoints
   ========================================================================== */

// Global Application State
let currentProducts = [];
let categoriesList = ['All'];
let cartData = { items: [], subtotal: 0, tax: 0, shippingFee: 0, total: 0, itemCount: 0 };
let currentUser = null;
let selectedCategory = 'All';
let currentSearchTerm = '';
let currentSort = 'newest';
let selectedProductForDetail = null;
let detailQuantity = 1;

// Session ID for Guest Cart Persistence
const getSessionId = () => {
  let sId = localStorage.getItem('ecom_session_id');
  if (!sId) {
    sId = 'guest_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('ecom_session_id', sId);
  }
  return sId;
};

// Generic Fetch API Wrapper Helper Function
async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('ecom_token');
  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': getSessionId(),
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Server request failed');
    }
    return data;
  } catch (err) {
    console.error(`Fetch API Call Failed [${options.method || 'GET'} ${endpoint}]:`, err.message);
    throw err;
  }
}

// --------------------------------------------------------------------------
// 1. INITIALIZATION & SETUP
// --------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  console.log('App starting... Initializing FreshCart frontend...');
  
  // Attach event listeners
  setupEventListeners();

  // Load initial profile, categories, products, and cart
  await checkCurrentUser();
  await loadCategories();
  await loadProducts();
  await loadCart();
});

function setupEventListeners() {
  // Brand Logo Reset
  document.getElementById('brand-logo-btn').addEventListener('click', () => {
    selectedCategory = 'All';
    currentSearchTerm = '';
    document.getElementById('search-input').value = '';
    loadProducts();
  });

  // Search Input Handler
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.trim();
    if (currentSearchTerm) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    loadProducts();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchTerm = '';
    clearSearchBtn.classList.add('hidden');
    loadProducts();
  });

  // Sort Dropdown Selector
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    loadProducts();
  });

  // Reset Filters Button
  document.getElementById('reset-filters-btn').addEventListener('click', () => {
    selectedCategory = 'All';
    currentSearchTerm = '';
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    loadProducts();
  });

  // Open Cart Drawer Button
  document.getElementById('open-cart-btn').addEventListener('click', () => {
    loadCart();
    openModal('cart-drawer-modal');
  });

  // Clear Cart Button
  document.getElementById('clear-cart-btn').addEventListener('click', handleClearCart);

  // Proceed to Checkout Button
  document.getElementById('proceed-checkout-btn').addEventListener('click', () => {
    closeModal('cart-drawer-modal');
    openCheckoutModal();
  });

  // Checkout Form Submission
  document.getElementById('checkout-form').addEventListener('submit', handleCheckoutSubmit);

  // Auth Button (Login / Register Modal)
  document.getElementById('open-auth-btn').addEventListener('click', () => {
    openModal('auth-modal');
  });

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);

  // Admin Panel Button
  document.getElementById('admin-panel-btn').addEventListener('click', () => {
    loadAdminData();
    openModal('admin-modal');
  });

  // Add Product Form in Admin
  document.getElementById('add-product-form').addEventListener('submit', handleAddProductSubmit);

  // Detail Modal Quantity Controls
  document.getElementById('detail-qty-minus').addEventListener('click', () => {
    if (detailQuantity > 1) {
      detailQuantity--;
      document.getElementById('detail-qty-val').innerText = detailQuantity;
    }
  });

  document.getElementById('detail-qty-plus').addEventListener('click', () => {
    if (selectedProductForDetail && detailQuantity < selectedProductForDetail.stock) {
      detailQuantity++;
      document.getElementById('detail-qty-val').innerText = detailQuantity;
    }
  });

  document.getElementById('detail-add-cart-btn').addEventListener('click', () => {
    if (selectedProductForDetail) {
      handleAddToCart(selectedProductForDetail.id, detailQuantity);
      closeModal('product-detail-modal');
    }
  });
}

// --------------------------------------------------------------------------
// 2. PRODUCT BROWSING, SEARCH, FILTER, AND SORT (Fetch API Endpoints)
// --------------------------------------------------------------------------

async function loadCategories() {
  try {
    categoriesList = await fetchAPI('/api/categories');
    renderCategoryButtons();
  } catch (err) {
    console.error('Failed to load categories', err);
  }
}

function renderCategoryButtons() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';

  categoriesList.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `cat-btn ${cat === selectedCategory ? 'active' : ''}`;
    btn.innerText = cat;
    btn.onclick = () => {
      selectedCategory = cat;
      renderCategoryButtons();
      loadProducts();
    };
    container.appendChild(btn);
  });
}

async function loadProducts() {
  try {
    const query = new URLSearchParams();
    if (currentSearchTerm) query.append('search', currentSearchTerm);
    if (selectedCategory && selectedCategory !== 'All') query.append('category', selectedCategory);
    if (currentSort) query.append('sort', currentSort);

    currentProducts = await fetchAPI(`/api/products?${query.toString()}`);
    renderProducts();
  } catch (err) {
    showToast('Failed to load products from server');
  }
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  const emptyState = document.getElementById('empty-state');
  grid.innerHTML = '';

  if (currentProducts.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  currentProducts.forEach(product => {
    const isOut = product.stock <= 0;
    const isLow = product.stock > 0 && product.stock <= 5;

    let stockBadgeHTML = `<span class="stock-badge stock-in">In Stock (${product.stock})</span>`;
    if (isOut) {
      stockBadgeHTML = `<span class="stock-badge stock-out">Out of Stock</span>`;
    } else if (isLow) {
      stockBadgeHTML = `<span class="stock-badge stock-low">Only ${product.stock} Left</span>`;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div>
        <div class="card-img-wrapper" onclick="openProductDetail(${product.id})">
          <img src="${product.image_url}" alt="${product.name}" loading="lazy">
          <span class="category-tag">${product.category}</span>
          ${stockBadgeHTML}
        </div>
        <div class="card-content">
          <h3 class="product-title" onclick="openProductDetail(${product.id})">${product.name}</h3>
          <p class="product-desc">${product.description}</p>
        </div>
      </div>
      <div class="card-footer">
        <div class="price-box">
          <span class="price-label">Price</span>
          <span class="price-amount">$${product.price.toFixed(2)}</span>
        </div>
        <div class="card-actions">
          <button class="btn-icon" onclick="openProductDetail(${product.id})" title="View Details">
            <i class="fa-regular fa-eye"></i>
          </button>
          <button class="btn-add-cart" ${isOut ? 'disabled' : ''} onclick="handleAddToCart(${product.id}, 1)">
            <i class="fa-solid fa-cart-plus"></i> ${isOut ? 'Sold Out' : 'Add'}
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function openProductDetail(productId) {
  const prod = currentProducts.find(p => p.id === productId);
  if (!prod) return;

  selectedProductForDetail = prod;
  detailQuantity = 1;

  document.getElementById('detail-img').src = prod.image_url;
  document.getElementById('detail-category').innerText = prod.category;
  document.getElementById('detail-title').innerText = prod.name;
  document.getElementById('detail-price').innerText = `$${prod.price.toFixed(2)}`;
  document.getElementById('detail-desc').innerText = prod.description;
  document.getElementById('detail-qty-val').innerText = '1';

  const stockBadge = document.getElementById('detail-stock-badge');
  if (prod.stock <= 0) {
    stockBadge.className = 'stock-badge stock-out';
    stockBadge.innerText = 'Out of Stock';
    document.getElementById('detail-add-cart-btn').disabled = true;
  } else {
    stockBadge.className = 'stock-badge stock-in';
    stockBadge.innerText = `In Stock: ${prod.stock} items`;
    document.getElementById('detail-add-cart-btn').disabled = false;
  }

  openModal('product-detail-modal');
}

// --------------------------------------------------------------------------
// 3. CART MANAGEMENT APIs (Add, Update, Remove, Calculate Subtotal/Total)
// --------------------------------------------------------------------------

async function loadCart() {
  try {
    cartData = await fetchAPI('/api/cart');
    renderCart();
  } catch (err) {
    console.error('Error fetching cart', err);
  }
}

function renderCart() {
  // Update Header Cart Badge
  document.getElementById('cart-badge').innerText = cartData.itemCount || 0;

  // Render Drawer Items
  const container = document.getElementById('cart-items-container');
  container.innerHTML = '';

  if (!cartData.items || cartData.items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <i class="fa-solid fa-bag-shopping" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
        <h4 style="font-weight: 700; color: #334155;">Your Cart is Empty</h4>
        <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">Explore our catalog and add products!</p>
      </div>
    `;
    document.getElementById('proceed-checkout-btn').disabled = true;
  } else {
    document.getElementById('proceed-checkout-btn').disabled = false;

    cartData.items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.innerHTML = `
        <img src="${item.image_url}" alt="${item.name}">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          <div class="qty-controls" style="margin-top: 0.4rem;">
            <button class="qty-btn" onclick="updateCartItemQty(${item.id}, ${item.quantity - 1})">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartItemQty(${item.id}, ${item.quantity + 1})" ${item.quantity >= item.stock ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 0.9rem;">$${(item.price * item.quantity).toFixed(2)}</div>
          <button onclick="removeCartItem(${item.id})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem; margin-top: 0.5rem;" title="Remove">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      container.appendChild(itemEl);
    });
  }

  // Update Summary Numbers
  document.getElementById('cart-subtotal').innerText = `$${(cartData.subtotal || 0).toFixed(2)}`;
  document.getElementById('cart-tax').innerText = `$${(cartData.tax || 0).toFixed(2)}`;
  document.getElementById('cart-shipping').innerText = cartData.shippingFee === 0 ? 'FREE' : `$${cartData.shippingFee.toFixed(2)}`;
  document.getElementById('cart-total').innerText = `$${(cartData.total || 0).toFixed(2)}`;
}

async function handleAddToCart(productId, quantity = 1) {
  try {
    const res = await fetchAPI('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity })
    });
    showToast(res.message || 'Item added to cart!');
    await loadCart();
  } catch (err) {
    showToast(err.message || 'Could not add to cart');
  }
}

async function updateCartItemQty(cartItemId, quantity) {
  if (quantity < 1) return;
  try {
    await fetchAPI(`/api/cart/${cartItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    });
    await loadCart();
  } catch (err) {
    showToast(err.message || 'Failed to update quantity');
  }
}

async function removeCartItem(cartItemId) {
  try {
    await fetchAPI(`/api/cart/${cartItemId}`, { method: 'DELETE' });
    await loadCart();
    showToast('Item removed from cart');
  } catch (err) {
    showToast('Failed to remove item');
  }
}

async function handleClearCart() {
  try {
    await fetchAPI('/api/cart', { method: 'DELETE' });
    await loadCart();
    showToast('Cart cleared');
  } catch (err) {
    showToast('Failed to clear cart');
  }
}

// --------------------------------------------------------------------------
// 4. CHECKOUT FORM & STOCK VALIDATION & PLACE ORDER
// --------------------------------------------------------------------------

function openCheckoutModal() {
  if (!cartData.items || cartData.items.length === 0) {
    showToast('Your cart is empty');
    return;
  }

  // Autofill user details if logged in
  if (currentUser) {
    document.getElementById('cust-name').value = currentUser.name;
    document.getElementById('cust-email').value = currentUser.email;
  }

  document.getElementById('checkout-total-val').innerText = `$${cartData.total.toFixed(2)}`;
  document.getElementById('checkout-error-alert').classList.add('hidden');
  openModal('checkout-modal');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const customer_name = document.getElementById('cust-name').value.trim();
  const customer_email = document.getElementById('cust-email').value.trim();
  const customer_phone = document.getElementById('cust-phone').value.trim();
  const shipping_address = document.getElementById('cust-address').value.trim();

  const errorAlert = document.getElementById('checkout-error-alert');
  const errorText = document.getElementById('checkout-error-text');

  try {
    const placeBtn = document.getElementById('place-order-btn');
    placeBtn.disabled = true;
    placeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Validating Stock & Placing Order...`;

    // POST /api/orders validates stock on server & deducts DB stock
    const result = await fetchAPI('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ customer_name, customer_email, customer_phone, shipping_address })
    });

    placeBtn.disabled = false;
    placeBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Validate Stock & Place Order`;

    closeModal('checkout-modal');
    await loadCart();
    await loadProducts(); // Refresh stock in product cards

    // Display Order Success Modal with Receipt
    showOrderSuccessReceipt(result);
  } catch (err) {
    document.getElementById('place-order-btn').disabled = false;
    document.getElementById('place-order-btn').innerHTML = `<i class="fa-solid fa-lock"></i> Validate Stock & Place Order`;
    errorText.innerText = err.message || 'Order failed. Please check stock.';
    errorAlert.classList.remove('hidden');
  }
}

function showOrderSuccessReceipt(orderResult) {
  const { order, items } = orderResult;

  document.getElementById('order-code-display').innerText = order.order_code;

  const custDetails = document.getElementById('order-customer-details');
  custDetails.innerHTML = `
    <div><strong>Customer:</strong> ${order.customer_name} (${order.customer_phone})</div>
    <div><strong>Email:</strong> ${order.customer_email}</div>
    <div><strong>Address:</strong> ${order.shipping_address}</div>
  `;

  const itemsList = document.getElementById('order-receipt-items');
  itemsList.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'receipt-item-row';
    div.style.cssText = 'display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;';
    div.innerHTML = `
      <div>
        <div style="font-weight: 700;">${item.product_name}</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">${item.quantity} x $${item.unit_price.toFixed(2)}</div>
      </div>
      <div style="font-weight: 800; color: #0f172a;">$${item.subtotal.toFixed(2)}</div>
    `;
    itemsList.appendChild(div);
  });

  document.getElementById('order-receipt-total').innerText = `$${order.total.toFixed(2)}`;
  openModal('order-success-modal');
}

// --------------------------------------------------------------------------
// 5. USER AUTHENTICATION & JWT (Login, Register, Admin Role)
// --------------------------------------------------------------------------

async function checkCurrentUser() {
  const token = localStorage.getItem('ecom_token');
  if (!token) {
    updateUserUI(null);
    return;
  }
  try {
    const res = await fetchAPI('/api/auth/me');
    currentUser = res.user;
    updateUserUI(currentUser);
  } catch (err) {
    localStorage.removeItem('ecom_token');
    updateUserUI(null);
  }
}

function updateUserUI(user) {
  const profileSection = document.getElementById('user-profile-section');
  const adminBtn = document.getElementById('admin-panel-btn');

  if (user) {
    profileSection.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; background: #f1f5f9; padding: 0.35rem 0.85rem; border-radius: 9999px;">
        <span style="width: 28px; height: 28px; background: #16a34a; color: white; border-radius: 9999px; font-weight: 800; font-size: 0.75rem; display: flex; align-items: center; justify-content: center;">
          ${user.name.charAt(0).toUpperCase()}
        </span>
        <span style="font-size: 0.8rem; font-weight: 700;">${user.name}</span>
        <button onclick="handleLogout()" style="background: none; border: none; color: #ef4444; cursor: pointer; margin-left: 0.3rem;" title="Logout">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    `;
    if (user.role === 'admin') {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  } else {
    profileSection.innerHTML = `
      <button id="open-auth-btn" class="btn btn-outline-green" onclick="openModal('auth-modal')">
        <i class="fa-solid fa-user"></i>
        <span>Login / Register</span>
      </button>
    `;
    adminBtn.classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const data = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('ecom_token', data.token);
    currentUser = data.user;
    updateUserUI(currentUser);
    closeModal('auth-modal');
    showToast(`Welcome back, ${currentUser.name}!`);
    await loadCart();
  } catch (err) {
    alert(err.message || 'Login failed');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  try {
    const data = await fetchAPI('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    localStorage.setItem('ecom_token', data.token);
    currentUser = data.user;
    updateUserUI(currentUser);
    closeModal('auth-modal');
    showToast('Account registered successfully!');
  } catch (err) {
    alert(err.message || 'Registration failed');
  }
}

function handleLogout() {
  localStorage.removeItem('ecom_token');
  currentUser = null;
  updateUserUI(null);
  showToast('Logged out');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login-btn');
  const tabReg = document.getElementById('tab-register-btn');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
  }
}

function fillDemoLogin(email, password) {
  switchAuthTab('login');
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
}

// --------------------------------------------------------------------------
// 6. ADMIN DASHBOARD PANEL (Add/Edit Products, Manage Order Status)
// --------------------------------------------------------------------------

async function loadAdminData() {
  await loadAdminProducts();
  await loadAdminOrders();
}

async function loadAdminProducts() {
  try {
    const products = await fetchAPI('/api/products');
    const tbody = document.getElementById('admin-products-tbody');
    tbody.innerHTML = '';

    products.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><img src="${p.image_url}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;"></td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category}</td>
        <td>$${p.price.toFixed(2)}</td>
        <td>
          <input type="number" value="${p.stock}" style="width: 60px; padding: 2px 4px; font-weight: bold;" onchange="updateAdminStock(${p.id}, this.value)">
        </td>
        <td>
          <button onclick="deleteAdminProduct(${p.id})" style="color: #ef4444; border: none; background: none; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading admin products', err);
  }
}

async function handleAddProductSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('admin-p-name').value;
  const price = document.getElementById('admin-p-price').value;
  const category = document.getElementById('admin-p-cat').value;
  const stock = document.getElementById('admin-p-stock').value;
  const image_url = document.getElementById('admin-p-img').value;
  const description = document.getElementById('admin-p-desc').value;

  try {
    await fetchAPI('/api/products', {
      method: 'POST',
      body: JSON.stringify({ name, price, category, stock, image_url, description })
    });
    showToast('New product created!');
    document.getElementById('add-product-form').reset();
    await loadAdminProducts();
    await loadProducts();
    await loadCategories();
  } catch (err) {
    alert(err.message || 'Failed to add product');
  }
}

async function updateAdminStock(id, newStock) {
  try {
    await fetchAPI(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ stock: parseInt(newStock, 10) })
    });
    showToast('Stock updated!');
    await loadProducts();
  } catch (err) {
    alert('Failed to update stock');
  }
}

async function deleteAdminProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await fetchAPI(`/api/products/${id}`, { method: 'DELETE' });
    showToast('Product deleted');
    await loadAdminProducts();
    await loadProducts();
  } catch (err) {
    alert('Failed to delete product');
  }
}

async function loadAdminOrders() {
  try {
    const orders = await fetchAPI('/api/orders');
    const tbody = document.getElementById('admin-orders-tbody');
    tbody.innerHTML = '';

    orders.forEach(o => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="font-family: monospace;">${o.order_code}</strong></td>
        <td>${o.customer_name}</td>
        <td>${o.customer_phone}</td>
        <td><strong>$${o.total.toFixed(2)}</strong></td>
        <td><span style="font-weight: 800; color: #16a34a;">${o.status.toUpperCase()}</span></td>
        <td>
          <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding: 2px 6px; font-size: 0.75rem;">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load admin orders', err);
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await fetchAPI(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showToast('Order status updated');
    await loadAdminOrders();
  } catch (err) {
    alert('Failed to update order status');
  }
}

function switchAdminTab(tab) {
  const prodSec = document.getElementById('admin-section-products');
  const ordSec = document.getElementById('admin-section-orders');
  const tabP = document.getElementById('admin-tab-products');
  const tabO = document.getElementById('admin-tab-orders');

  if (tab === 'products') {
    prodSec.classList.remove('hidden');
    ordSec.classList.add('hidden');
    tabP.classList.add('active');
    tabO.classList.remove('active');
  } else {
    prodSec.classList.add('hidden');
    ordSec.classList.remove('hidden');
    tabP.classList.remove('active');
    tabO.classList.add('active');
  }
}

// --------------------------------------------------------------------------
// 7. UTILITY HELPERS (Modal Open/Close & Toast)
// --------------------------------------------------------------------------

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  toastMsg.innerText = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}
