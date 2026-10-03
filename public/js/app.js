let products = [], categories = ['All'], cart = { items: [], total: 0, subtotal: 0, tax: 0, shippingFee: 0 };
let selCat = 'All', search = '', sort = 'newest', detailProd = null;

const getSessionId = () => {
  let s = localStorage.getItem('ecom_session_id');
  if (!s) { s = 'guest_' + Math.random().toString(36).substring(2, 9); localStorage.setItem('ecom_session_id', s); }
  return s;
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-session-id': getSessionId(), ...(options.headers || {}) };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

document.addEventListener('DOMContentLoaded', async () => {
  setupUI();
  await loadCats();
  await loadProds();
  await loadCart();
});

function setupUI() {
  document.getElementById('brand-logo').onclick = () => { selCat = 'All'; search = ''; document.getElementById('search-input').value = ''; loadProds(); };
  document.getElementById('search-input').oninput = (e) => { search = e.target.value.trim(); loadProds(); };
  document.getElementById('sort-select').onchange = (e) => { sort = e.target.value; loadProds(); };
  document.getElementById('open-cart-btn').onclick = () => { loadCart(); openModal('cart-modal'); };
  document.getElementById('clear-cart-btn').onclick = async () => { await api('/api/cart', { method: 'DELETE' }); loadCart(); };
  document.getElementById('proceed-btn').onclick = () => { closeModal('cart-modal'); openCheckout(); };
  document.getElementById('checkout-form').onsubmit = handleCheckout;
}

async function loadCats() {
  categories = await api('/api/categories');
  const box = document.getElementById('categories-box');
  box.innerHTML = '';
  categories.forEach(c => {
    const b = document.createElement('button');
    b.className = `cat-btn ${c === selCat ? 'active' : ''}`;
    b.innerText = c;
    b.onclick = () => { selCat = c; loadCats(); loadProds(); };
    box.appendChild(b);
  });
}

async function loadProds() {
  const q = new URLSearchParams();
  if (search) q.append('search', search);
  if (selCat !== 'All') q.append('category', selCat);
  if (sort) q.append('sort', sort);

  products = await api(`/api/products?${q.toString()}`);
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';

  products.forEach(p => {
    const isOut = p.stock <= 0;
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div>
        <div class="card-img-wrapper" onclick="openDetail(${p.id})">
          <img src="${p.image_url}">
          <span class="category-tag">${p.category}</span>
          <span class="stock-badge ${isOut ? 'stock-out' : 'stock-in'}">${isOut ? 'Out of Stock' : 'Stock: ' + p.stock}</span>
        </div>
        <div class="card-content">
          <h3 class="product-title" onclick="openDetail(${p.id})">${p.name}</h3>
          <p class="product-desc">${p.description}</p>
        </div>
      </div>
      <div class="card-footer">
        <span class="price-amount">$${p.price.toFixed(2)}</span>
        <button class="btn btn-green" ${isOut ? 'disabled' : ''} onclick="addToCart(${p.id})">${isOut ? 'Sold Out' : 'Add to Cart'}</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.openDetail = function(id) {
  detailProd = products.find(p => p.id === id);
  if (!detailProd) return;
  document.getElementById('d-img').src = detailProd.image_url;
  document.getElementById('d-title').innerText = detailProd.name;
  document.getElementById('d-price').innerText = `$${detailProd.price.toFixed(2)}`;
  document.getElementById('d-desc').innerText = detailProd.description;
  document.getElementById('d-add-btn').disabled = detailProd.stock <= 0;
  document.getElementById('d-add-btn').onclick = () => { addToCart(detailProd.id); closeModal('detail-modal'); };
  openModal('detail-modal');
};

async function loadCart() {
  cart = await api('/api/cart');
  document.getElementById('cart-badge').innerText = cart.items ? cart.items.reduce((a, b) => a + b.quantity, 0) : 0;
  const list = document.getElementById('cart-items');
  list.innerHTML = '';

  if (!cart.items || !cart.items.length) {
    list.innerHTML = '<p style="text-align:center;padding:2rem;color:#94a3b8;">Cart is empty</p>';
  } else {
    cart.items.forEach(i => {
      const d = document.createElement('div');
      d.className = 'cart-item';
      d.innerHTML = `
        <img src="${i.image_url}">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.85rem;">${i.name}</div>
          <div style="color:#16a34a;font-weight:800;">$${i.price.toFixed(2)}</div>
          <div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.3rem;">
            <button onclick="updateQty(${i.id}, ${i.quantity - 1})" style="width:22px;">-</button>
            <span style="font-weight:800;font-size:0.8rem;">${i.quantity}</span>
            <button onclick="updateQty(${i.id}, ${i.quantity + 1})" style="width:22px;" ${i.quantity >= i.stock ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <button onclick="removeCart(${i.id})" style="color:#ef4444;background:none;border:none;cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
      `;
      list.appendChild(d);
    });
  }

  document.getElementById('c-subtotal').innerText = `$${(cart.subtotal || 0).toFixed(2)}`;
  document.getElementById('c-tax').innerText = `$${(cart.tax || 0).toFixed(2)}`;
  document.getElementById('c-shipping').innerText = cart.shippingFee === 0 ? 'FREE' : `$${cart.shippingFee.toFixed(2)}`;
  document.getElementById('c-total').innerText = `$${(cart.total || 0).toFixed(2)}`;
}

window.addToCart = async function(id) {
  try {
    await api('/api/cart', { method: 'POST', body: JSON.stringify({ productId: id, quantity: 1 }) });
    toast('Added to cart!');
    loadCart();
  } catch (e) { toast(e.message); }
};

window.updateQty = async function(id, qty) {
  if (qty < 1) return;
  try {
    await api(`/api/cart/${id}`, { method: 'PUT', body: JSON.stringify({ quantity: qty }) });
    loadCart();
  } catch (e) { toast(e.message); }
};

window.removeCart = async function(id) {
  await api(`/api/cart/${id}`, { method: 'DELETE' });
  loadCart();
};

function openCheckout() {
  if (!cart.items || !cart.items.length) return toast('Cart is empty');
  document.getElementById('chk-total').innerText = `$${cart.total.toFixed(2)}`;
  openModal('checkout-modal');
}

async function handleCheckout(e) {
  e.preventDefault();
  const body = {
    customer_name: document.getElementById('cust-name').value,
    customer_email: document.getElementById('cust-email').value,
    customer_phone: document.getElementById('cust-phone').value,
    shipping_address: document.getElementById('cust-address').value
  };

  try {
    const res = await api('/api/orders', { method: 'POST', body: JSON.stringify(body) });
    closeModal('checkout-modal');
    loadCart();
    loadProds();

    document.getElementById('receipt-code').innerText = res.order.order_code;
    document.getElementById('receipt-total').innerText = `$${res.order.total.toFixed(2)}`;
    openModal('receipt-modal');
  } catch (e) { alert(e.message); }
}

window.openModal = function(id) { document.getElementById(id).classList.remove('hidden'); };
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); };

function toast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}
