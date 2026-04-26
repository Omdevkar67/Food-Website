/* ── Config ─────────────────────────────────────── */
const API = 'http://localhost:5000';

const emojiMap = {
  pizza: '🍕',
  burger: '🍔',
  biryani: '🍛'
};

/* ── State ─────────────────────────────────────── */
let cart = {};          // { menu_id: { item, qty } }
let menuData = [];
let currentCategory = 'All';
let user = null;
let token = null;

/* ── Init ───────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('qb_user');
  const savedToken = localStorage.getItem('qb_token');
  if (saved && savedToken) {
    user = JSON.parse(saved);
    token = savedToken;
    onLoggedIn();
  } else {
    showPage('auth');
  }
});

/* ── Auth helpers ───────────────────────────────── */
function switchAuth(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'))
  );
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  try {
    const data = await apiFetch('/login', 'POST', { email, password });
    if (data.error) { showError(errEl, data.error); return; }
    saveSession(data);
    onLoggedIn();
  } catch {
    showError(errEl, 'Connection failed. Is the server running?');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  try {
    const data = await apiFetch('/register', 'POST', { name, email, password });
    if (data.error) { showError(errEl, data.error); return; }
    saveSession(data);
    onLoggedIn();
  } catch {
    showError(errEl, 'Connection failed. Is the server running?');
  }
}

function saveSession(data) {
  user = data.user;
  token = data.token;
  localStorage.setItem('qb_user', JSON.stringify(user));
  localStorage.setItem('qb_token', token);
}

function onLoggedIn() {
  document.getElementById('navbar').classList.remove('hidden');
  document.getElementById('nav-user').textContent = `👤 ${user.name}`;
  if (user.role === 'admin') {
    document.getElementById('nav-admin').classList.remove('hidden');
  }
  showPage('menu');
  loadMenu();
}

function logout() {
  localStorage.removeItem('qb_user');
  localStorage.removeItem('qb_token');
  user = null; token = null; cart = {};
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('nav-admin').classList.add('hidden');
  updateCartBadge();
  showPage('auth');
}

/* ── Page routing ───────────────────────────────── */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById(`nav-${name}`);
  if (nb) nb.classList.add('active');

  if (name === 'cart') renderCart();
  if (name === 'orders') loadOrders();
  if (name === 'admin') loadAdminOrders();
}

/* ── Menu ───────────────────────────────────────── */
async function loadMenu() {
  try {
    menuData = await apiFetch('/menu');
    renderCategoryFilters();
    renderMenu();
  } catch {
    document.getElementById('menu-grid').innerHTML =
      '<p style="color:var(--error)">Could not load menu. Is the server running?</p>';
  }
}

function renderCategoryFilters() {
  const cats = ['All', ...new Set(menuData.map(m => m.category))];
  const el = document.getElementById('category-filters');
  el.innerHTML = cats.map(c =>
    `<button class="cat-pill ${c === currentCategory ? 'active' : ''}" onclick="filterCat('${c}')">${c}</button>`
  ).join('');
}

function filterCat(cat) {
  currentCategory = cat;
  renderCategoryFilters();
  renderMenu();
}

function renderMenu() {
  const items = currentCategory === 'All'
    ? menuData
    : menuData.filter(m => m.category === currentCategory);
  const grid = document.getElementById('menu-grid');
  if (!items.length) {
    grid.innerHTML = '<p style="color:var(--text-muted)">No items in this category.</p>';
    return;
  }
  grid.innerHTML = items.map(item => {
    const inCart = cart[item.id];
    return `
    <div class="menu-card" id="card-${item.id}">
      <div class="menu-card-emoji">
        <span>${item.image_emoji || '🍽️'}</span>
        <span class="menu-card-category">${item.category}</span>
      </div>
      <div class="menu-card-body">
        <div class="menu-card-name">${item.item_name}</div>
        <div class="menu-card-desc">${item.description || ''}</div>
        <div class="menu-card-footer">
          <div class="menu-price">₹${parseFloat(item.price).toFixed(0)}</div>
          ${inCart ? `
          <div class="qty-control" id="qc-${item.id}">
            <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
            <span class="qty-num" id="qty-${item.id}">${inCart.qty}</span>
            <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
          </div>` : `
          <button class="add-btn" onclick="addToCart(${item.id})">Add +</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── Cart logic ─────────────────────────────────── */
function addToCart(id) {
  const item = menuData.find(m => m.id === id);
  if (!item) return;
  cart[id] = { item, qty: 1 };
  updateCartBadge();
  renderMenu();
  showToast(`${item.item_name} added to cart!`);
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) {
    delete cart[id];
    renderMenu();
  } else {
    const qEl = document.getElementById(`qty-${id}`);
    if (qEl) qEl.textContent = cart[id].qty;
  }
  updateCartBadge();
}

function updateCartBadge() {
  const total = Object.values(cart).reduce((s, v) => s + v.qty, 0);
  const badge = document.getElementById('cart-count');
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
}

function renderCart() {
  const items = Object.values(cart);
  const container = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  const empty = document.getElementById('cart-empty');

  if (!items.length) {
    container.innerHTML = '';
    summary.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  summary.classList.remove('hidden');

  container.innerHTML = items.map(({ item, qty }) => `
    <div class="cart-item">
      <div class="cart-item-emoji">${item.image_emoji || '🍽️'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.item_name}</div>
        <div class="cart-item-price">₹${parseFloat(item.price).toFixed(0)} × ${qty} = ₹${(item.price * qty).toFixed(0)}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="cartQty(${item.id}, -1)">−</button>
        <span class="qty-num">${qty}</span>
        <button class="qty-btn" onclick="cartQty(${item.id}, 1)">+</button>
      </div>
      <button class="cart-remove" onclick="removeFromCart(${item.id})" title="Remove">✕</button>
    </div>`).join('');

  const subtotal = items.reduce((s, { item, qty }) => s + item.price * qty, 0);
  document.getElementById('cart-subtotal').textContent = `₹${subtotal.toFixed(0)}`;
  document.getElementById('cart-total').textContent = `₹${(subtotal + 30).toFixed(0)}`;
}

function cartQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  updateCartBadge();
  renderCart();
  renderMenu();
}

function removeFromCart(id) {
  delete cart[id];
  updateCartBadge();
  renderCart();
  renderMenu();
}

/* ── Place order ────────────────────────────────── */
async function placeOrder() {
  const items = Object.entries(cart).map(([id, { qty }]) => ({
    menu_id: parseInt(id), quantity: qty
  }));
  if (!items.length) return;

  try {
    const data = await apiFetch('/order', 'POST', { items });
    if (data.error) { showToast(data.error, 'error'); return; }
    cart = {};
    updateCartBadge();
    renderMenu();
    showToast(`🎉 Order #${data.order_id} placed! Total ₹${data.total}`, 'success');
    showPage('orders');
  } catch {
    showToast('Failed to place order. Try again.', 'error');
  }
}

/* ── Orders ─────────────────────────────────────── */
async function loadOrders() {
  const el = document.getElementById('orders-list');
  el.innerHTML = '<p style="color:var(--text-muted)">Loading...</p>';
  try {
    const orders = await apiFetch('/orders');
    if (!orders.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No orders yet</p>
        <button class="btn-secondary" onclick="showPage('menu')">Start ordering</button>
      </div>`;
      return;
    }
    el.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-id">Order #${o.id}</div>
            <div class="order-date">${new Date(o.created_at).toLocaleString('en-IN')}</div>
          </div>
          <span class="status-badge status-${o.status.replace(/ /g, '-')}">${statusDot(o.status)} ${o.status}</span>
        </div>
        <div class="order-items-text">${o.items}</div>
        <div class="order-footer">
          <span class="order-amount">₹${parseFloat(o.total_amount).toFixed(0)}</span>
        </div>
      </div>`).join('');
  } catch {
    el.innerHTML = '<p style="color:var(--error)">Failed to load orders.</p>';
  }
}

/* ── Admin ─────────────────────────────────────── */
async function adminAddItem(e) {
  e.preventDefault();
  const body = {
    item_name: document.getElementById('a-name').value,
    price: document.getElementById('a-price').value,
    category: document.getElementById('a-category').value,
    image_emoji: document.getElementById('a-emoji').value || '🍽️',
    description: document.getElementById('a-desc').value,
  };
  try {
    const data = await apiFetch('/menu', 'POST', body);
    if (data.error) { showToast(data.error, 'error'); return; }
    showToast(`✓ "${data.item_name}" added to menu!`, 'success');
    e.target.reset();
    await loadMenu();
  } catch {
    showToast('Failed to add item.', 'error');
  }
}

async function loadAdminOrders() {
  const el = document.getElementById('admin-orders');
  el.innerHTML = '<p style="color:var(--text-muted)">Loading orders...</p>';
  try {
    const orders = await apiFetch('/orders');
    if (!orders.length) { el.innerHTML = '<p style="color:var(--text-muted)">No orders yet.</p>'; return; }
    el.innerHTML = orders.map(o => `
      <div class="admin-order-row">
        <div class="admin-order-top">
          <span class="admin-order-customer">Order #${o.id} — ${o.customer_name || 'Customer'}</span>
          <span class="status-badge status-${o.status.replace(/ /g, '-')}">${statusDot(o.status)} ${o.status}</span>
        </div>
        <div class="admin-order-meta">
          ${new Date(o.created_at).toLocaleString('en-IN')} · ${o.email}
        </div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.6rem">${o.items}</div>
        <div class="admin-order-actions">
          <strong style="font-size:.85rem">₹${parseFloat(o.total_amount).toFixed(0)}</strong>
          <select onchange="updateOrderStatus(${o.id}, this.value)">
            ${['Pending','Confirmed','Preparing','Out for Delivery','Delivered']
              .map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>`).join('');
  } catch {
    el.innerHTML = '<p style="color:var(--error)">Failed to load orders.</p>';
  }
}

async function updateOrderStatus(id, status) {
  try {
    await apiFetch(`/orders/${id}/status`, 'PATCH', { status });
    showToast(`Order #${id} → ${status}`, 'success');
  } catch {
    showToast('Failed to update status.', 'error');
  }
}

/* ── API helper ─────────────────────────────────── */
async function apiFetch(path, method = 'GET', body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  };
  const res = await fetch(API + path, opts);
  return res.json();
}

/* ── Helpers ────────────────────────────────────── */
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function statusDot(status) {
  const dots = {
    'Pending': '⏳', 'Confirmed': '✅', 'Preparing': '👨‍🍳',
    'Out for Delivery': '🛵', 'Delivered': '🎉'
  };
  return dots[status] || '•';
}
