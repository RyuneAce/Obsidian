/* ─── STATE ──────────────────────────────────────────────────────────────────── */
const API = 'http://localhost:3500/api/inventory';
let inventoryData = null;
let activeFilter = 'all';

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadInventory();
  // Auto-refresh every 60 seconds
  setInterval(loadInventory, 60_000);
});

/* ─── LOAD INVENTORY ─────────────────────────────────────────────────────────── */
async function loadInventory() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('Server error');
    inventoryData = await res.json();
    renderDashboard(inventoryData);
    document.getElementById('last-updated').textContent =
      new Date(inventoryData.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    showToast('⚠️ Could not reach server. Make sure the inventory server is running.', 'error', 6000);
    // Fallback: load from embedded JSON for offline preview
    loadFallbackData();
  }
}

/* ─── OFFLINE FALLBACK ────────────────────────────────────────────────────────── */
async function loadFallbackData() {
  try {
    const res = await fetch('inventory.json');
    const rawData = await res.json();
    // Compute stock client-side
    inventoryData = computeClientSide(rawData);
    renderDashboard(inventoryData);
    document.getElementById('last-updated').textContent = 'Offline';
  } catch (e) {
    console.error('Could not load inventory.json', e);
  }
}

function computeClientSide(data) {
  const { lowStockThreshold = 10, criticalStockThreshold = 5 } = data;
  const alerts = [];

  const products = data.products.map(p => {
    const currentStock = p.stockReceived - p.stockSold;
    const profitPerUnit = p.sellingPrice - p.distributorPrice;
    const profitPct = +((profitPerUnit / p.distributorPrice) * 100).toFixed(1);
    const totalRevenue = p.stockSold * p.sellingPrice;
    const totalCost = p.stockSold * p.distributorPrice;
    const totalProfit = totalRevenue - totalCost;
    const restockCost = p.restockQty * p.distributorPrice;

    let status = 'ok';
    if (currentStock <= criticalStockThreshold) status = 'critical';
    else if (currentStock <= lowStockThreshold) status = 'low';

    if (status !== 'ok') {
      alerts.push({ id: p.id, name: p.name, emoji: p.emoji, currentStock, status, restockQty: p.restockQty, restockCost });
    }

    return { ...p, currentStock, profitPerUnit, profitPct, totalRevenue, totalCost, totalProfit, restockCost, status };
  });

  const totalRestockCost = products.filter(p => p.status !== 'ok').reduce((s, p) => s + p.restockCost, 0);
  const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
  const totalProfit = products.reduce((s, p) => s + p.totalProfit, 0);
  const totalItemsSold = products.reduce((s, p) => s + p.stockSold, 0);

  return { ...data, products, alerts, totalRestockCost, totalRevenue, totalProfit, totalItemsSold };
}

/* ─── RENDER DASHBOARD ───────────────────────────────────────────────────────── */
function renderDashboard(data) {
  renderStats(data);
  renderStockChart(data.products);
  renderProductsTable(data.products, activeFilter);
  renderLowStockAlerts(data.alerts);
  renderRestockOrder(data);
  renderPricingTable(data.products);
  updateBadge(data.alerts);
  checkAndShowBanner(data.alerts);
  populateRestockModal(data.products);
}

/* ─── STATS ──────────────────────────────────────────────────────────────────── */
function renderStats(data) {
  const lowCount = data.alerts.length;
  animateCounter('stat-total-items', data.products.length);
  animateCounter('stat-low-count', lowCount);
  document.getElementById('stat-total-revenue').textContent = `₹${fmt(data.totalRevenue)}`;
  document.getElementById('stat-total-profit').textContent = `₹${fmt(data.totalProfit)}`;
  document.getElementById('stat-restock-cost').textContent = `₹${fmt(data.totalRestockCost)}`;
  animateCounter('stat-items-sold', data.totalItemsSold);
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.round(start + (target - start) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ─── STOCK CHART ────────────────────────────────────────────────────────────── */
function renderStockChart(products) {
  const maxStock = Math.max(...products.map(p => p.stockReceived));
  const container = document.getElementById('stock-chart');
  container.innerHTML = products.map(p => {
    const pct = maxStock > 0 ? Math.min((p.currentStock / maxStock) * 100, 100) : 0;
    return `
      <div class="stock-bar-row">
        <div class="stock-bar-name" title="${p.name}">${p.emoji} ${p.name}</div>
        <div class="stock-bar-track">
          <div class="stock-bar-fill ${p.status}" style="width:0%" data-pct="${pct.toFixed(1)}"></div>
        </div>
        <div class="stock-bar-value ${p.status}">${p.currentStock} ${p.unit}s</div>
      </div>
    `;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.stock-bar-fill').forEach(bar => {
      setTimeout(() => { bar.style.width = bar.dataset.pct + '%'; }, 80);
    });
  });
}

/* ─── PRODUCTS TABLE ─────────────────────────────────────────────────────────── */
function renderProductsTable(products, filter = 'all') {
  const filtered = filter === 'all' ? products : products.filter(p => p.status === filter);
  const tbody = document.getElementById('products-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No products match this filter.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>
        <div class="product-cell">
          <span class="product-emoji">${p.emoji}</span>
          <div>
            <div class="product-info-name">${p.name}</div>
            <div class="product-info-id">${p.id}</div>
          </div>
        </div>
      </td>
      <td><span class="category-tag">${p.category}</span></td>
      <td class="money neutral">${p.stockReceived}</td>
      <td class="money neutral">${p.stockSold}</td>
      <td class="money ${p.status === 'ok' ? 'positive' : p.status === 'low' ? '' : 'negative'}" style="${p.status === 'low' ? 'color:var(--yellow)' : ''}">${p.currentStock}</td>
      <td>${statusBadge(p.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-ghost" onclick="openSaleModal('${p.id}','${escHtml(p.name)}')">− Sale</button>
          <button class="btn btn-sm btn-primary" onclick="quickRestock('${p.id}')">+ Restock</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterProducts(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (inventoryData) renderProductsTable(inventoryData.products, filter);
}

/* ─── LOW STOCK ALERTS ───────────────────────────────────────────────────────── */
function renderLowStockAlerts(alerts) {
  const container = document.getElementById('low-stock-list');
  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="no-alerts">
        <div class="no-alerts-icon">✅</div>
        <div>All items are well-stocked. No action needed.</div>
      </div>`;
    return;
  }
  container.innerHTML = alerts.map(a => `
    <div class="alert-card ${a.status}">
      <div class="alert-card-top">
        <span class="alert-card-emoji">${a.emoji}</span>
        <div>
          <div class="alert-card-name">${a.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${a.id}</div>
        </div>
        <div class="alert-card-badge">${statusBadge(a.status)}</div>
      </div>
      <div class="alert-card-stats">
        <div>
          <div class="alert-stat-label">Current Stock</div>
          <div class="alert-stat-value ${a.status}">${a.currentStock}</div>
        </div>
        <div>
          <div class="alert-stat-label">Suggested Reorder</div>
          <div class="alert-stat-value" style="color:var(--blue)">${a.restockQty}</div>
        </div>
        <div>
          <div class="alert-stat-label">Restock Cost</div>
          <div class="alert-stat-value" style="color:var(--text)">₹${fmt(a.restockCost)}</div>
        </div>
      </div>
      <div class="alert-card-footer">
        <span>${a.status === 'critical' ? '🔴 CRITICAL — Order immediately!' : '🟡 Low — Reorder soon'}</span>
        <button class="btn btn-sm btn-primary" onclick="quickRestock('${a.id}')">Order Now</button>
      </div>
    </div>
  `).join('');
}

/* ─── RESTOCK ORDER ──────────────────────────────────────────────────────────── */
function renderRestockOrder(data) {
  const lowItems = data.products.filter(p => p.status !== 'ok');
  const distInfo = document.getElementById('distributor-info');
  distInfo.innerHTML = `
    <span class="dist-icon">🏭</span>
    <div>
      <div class="dist-name">${data.distributor.name}</div>
      <div class="dist-detail">📞 ${data.distributor.phone} &nbsp;·&nbsp; ✉️ ${data.distributor.email}</div>
      <div class="dist-detail">📍 ${data.distributor.address}</div>
    </div>
  `;

  const tbody = document.getElementById('restock-tbody');
  const tfoot = document.getElementById('restock-tfoot');

  if (lowItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">✅ No items need restocking right now.</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  let grandTotal = 0;
  tbody.innerHTML = lowItems.map(p => {
    grandTotal += p.restockCost;
    return `
      <tr>
        <td>
          <div class="product-cell">
            <span class="product-emoji">${p.emoji}</span>
            <div>
              <div class="product-info-name">${p.name}</div>
              <div class="product-info-id">${p.id}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--text-dim)">${p.distributor}</td>
        <td class="money highlight">${p.restockQty} ${p.unit}s</td>
        <td class="money neutral">₹${fmt(p.distributorPrice)}</td>
        <td class="money positive">₹${fmt(p.restockCost)}</td>
      </tr>
    `;
  }).join('');

  tfoot.innerHTML = `
    <tr>
      <td colspan="3">Total Restock Cost</td>
      <td></td>
      <td class="money positive" style="font-size:16px">₹${fmt(grandTotal)}</td>
    </tr>
  `;
}

/* ─── PRICING TABLE ──────────────────────────────────────────────────────────── */
function renderPricingTable(products) {
  const tbody = document.getElementById('pricing-tbody');
  const tfoot = document.getElementById('pricing-tfoot');

  let totRev = 0, totProfit = 0, totSold = 0;

  tbody.innerHTML = products.map(p => {
    totRev += p.totalRevenue;
    totProfit += p.totalProfit;
    totSold += p.stockSold;
    const marginColor = p.profitPct >= 25 ? 'var(--green)' : p.profitPct >= 15 ? 'var(--yellow)' : 'var(--orange)';
    return `
      <tr>
        <td>
          <div class="product-cell">
            <span class="product-emoji">${p.emoji}</span>
            <div>
              <div class="product-info-name">${p.name}</div>
              <div class="product-info-id">${p.category}</div>
            </div>
          </div>
        </td>
        <td class="money neutral">₹${fmt(p.distributorPrice)}</td>
        <td class="money highlight">₹${fmt(p.sellingPrice)}</td>
        <td class="money positive">₹${fmt(p.profitPerUnit)}</td>
        <td>
          <span style="color:${marginColor};font-family:var(--mono);font-weight:700">${p.profitPct}%</span>
          <div style="margin-top:4px;height:4px;width:80px;background:var(--bg3);border-radius:2px;overflow:hidden">
            <div style="width:${Math.min(p.profitPct * 2, 100)}%;height:100%;background:${marginColor};border-radius:2px;transition:width 0.8s ease"></div>
          </div>
        </td>
        <td class="money neutral">${p.stockSold}</td>
        <td class="money highlight">₹${fmt(p.totalRevenue)}</td>
        <td class="money positive">₹${fmt(p.totalProfit)}</td>
      </tr>
    `;
  }).join('');

  const totalMargin = totRev > 0 ? +((totProfit / (totRev - totProfit)) * 100).toFixed(1) : 0;
  tfoot.innerHTML = `
    <tr>
      <td colspan="5">Grand Total &nbsp;<span style="font-weight:400;color:var(--text-muted)">(Avg margin: ${totalMargin}%)</span></td>
      <td class="money neutral">${totSold}</td>
      <td class="money highlight">₹${fmt(totRev)}</td>
      <td class="money positive">₹${fmt(totProfit)}</td>
    </tr>
  `;
}

/* ─── ALERT BANNER ───────────────────────────────────────────────────────────── */
function checkAndShowBanner(alerts) {
  const banner = document.getElementById('alert-banner');
  const text = document.getElementById('alert-text');
  const critical = alerts.filter(a => a.status === 'critical');
  const low = alerts.filter(a => a.status === 'low');

  if (critical.length > 0) {
    text.textContent = `🔴 CRITICAL: ${critical.map(a => a.name).join(', ')} — stock dangerously low! Reorder immediately.`;
    banner.classList.remove('hidden');
  } else if (low.length > 0) {
    text.textContent = `🟡 Low stock: ${low.map(a => a.name).join(', ')} — consider reordering soon.`;
    banner.style.background = 'linear-gradient(90deg, #78350f, #92400e)';
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function updateBadge(alerts) {
  const badge = document.getElementById('low-stock-badge');
  badge.textContent = alerts.length;
  badge.classList.toggle('zero', alerts.length === 0);
}

function dismissBanner() {
  document.getElementById('alert-banner').classList.add('hidden');
}

/* ─── PING OWNER ─────────────────────────────────────────────────────────────── */
function sendOwnerAlert() {
  if (!inventoryData) return;
  const alerts = inventoryData.alerts;
  if (alerts.length === 0) {
    showToast('✅ All items are well-stocked. No alert needed.', 'success');
    return;
  }

  const criticalItems = alerts.filter(a => a.status === 'critical');
  const lowItems = alerts.filter(a => a.status === 'low');

  let msg = `📦 INVENTORY ALERT — ${inventoryData.shop.name}\n\n`;
  if (criticalItems.length > 0) {
    msg += `🔴 CRITICAL (order NOW):\n`;
    criticalItems.forEach(a => { msg += `  • ${a.emoji} ${a.name}: only ${a.currentStock} left\n`; });
    msg += '\n';
  }
  if (lowItems.length > 0) {
    msg += `🟡 LOW STOCK:\n`;
    lowItems.forEach(a => { msg += `  • ${a.emoji} ${a.name}: only ${a.currentStock} left\n`; });
    msg += '\n';
  }
  msg += `💰 Total restock cost: ₹${fmt(inventoryData.totalRestockCost)}\n`;
  msg += `📞 Distributor: ${inventoryData.distributor.phone}`;

  // In a real app, this would POST to Telegram/WhatsApp API
  console.log('\n📲 OWNER ALERT MESSAGE:\n', msg);
  showToast(`📲 Alert sent to owner (${inventoryData.shop.ownerPhone}). Check console for message.`, 'success', 5000);
}

/* ─── RESTOCK MODAL ──────────────────────────────────────────────────────────── */
function populateRestockModal(products) {
  const sel = document.getElementById('modal-product');
  sel.innerHTML = products.map(p =>
    `<option value="${p.id}">${p.emoji} ${p.name} (stock: ${p.currentStock})</option>`
  ).join('');
}

function openRestockModal() {
  document.getElementById('restock-modal').classList.remove('hidden');
}
function closeRestockModal() {
  document.getElementById('restock-modal').classList.add('hidden');
}

async function submitRestock() {
  const productId = document.getElementById('modal-product').value;
  const qty = parseInt(document.getElementById('modal-qty').value);
  if (!qty || qty < 1) { showToast('Enter a valid quantity.', 'error'); return; }

  await callApi('/api/inventory/restock', { productId, qty });
  closeRestockModal();
  await loadInventory();
  showToast(`✅ Restock logged successfully!`, 'success');
}

function quickRestock(productId) {
  document.getElementById('modal-product').value = productId;
  document.getElementById('modal-qty').value = 1;
  openRestockModal();
}

/* ─── SALE MODAL ─────────────────────────────────────────────────────────────── */
function openSaleModal(productId, productName) {
  document.getElementById('sale-product-id').value = productId;
  document.getElementById('sale-product-name').textContent = productName;
  document.getElementById('sale-qty').value = 1;
  document.getElementById('sale-modal').classList.remove('hidden');
}
function closeSaleModal() {
  document.getElementById('sale-modal').classList.add('hidden');
}

async function submitSale() {
  const productId = document.getElementById('sale-product-id').value;
  const qty = parseInt(document.getElementById('sale-qty').value);
  if (!qty || qty < 1) { showToast('Enter a valid quantity.', 'error'); return; }

  const result = await callApi('/api/inventory/sale', { productId, qty });
  if (result && result.error) {
    showToast(`❌ ${result.error}`, 'error');
    return;
  }
  closeSaleModal();
  await loadInventory();
  showToast(`✅ Sale of ${qty} unit(s) logged!`, 'success');
}

/* ─── API HELPER ─────────────────────────────────────────────────────────────── */
async function callApi(endpoint, body) {
  try {
    const res = await fetch(`http://localhost:3500${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    showToast('⚠️ Server not reachable. Start the inventory server.', 'error', 5000);
    return null;
  }
}

/* ─── NAV ────────────────────────────────────────────────────────────────────── */
function setActive(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
}

/* ─── TOAST ──────────────────────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, type = '', duration = 3500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

/* ─── HELPERS ────────────────────────────────────────────────────────────────── */
function fmt(n) {
  return Number(n).toLocaleString('en-IN');
}

function statusBadge(status) {
  const labels = { ok: '✅ In Stock', low: '🟡 Low', critical: '🔴 Critical' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function escHtml(str) {
  return str.replace(/'/g, "\\'");
}
