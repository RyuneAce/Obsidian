const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3500;
const INVENTORY_FILE = path.join(__dirname, 'inventory.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── Read inventory ────────────────────────────────────────────────────────────
function readInventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf-8'));
}

// ─── Write inventory ───────────────────────────────────────────────────────────
function writeInventory(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(data, null, 2));
}

// ─── Compute stock & alerts ────────────────────────────────────────────────────
function computeStock(data) {
  const { lowStockThreshold, criticalStockThreshold } = data;
  const alerts = [];

  const products = data.products.map(p => {
    const currentStock = p.stockReceived - p.stockSold;
    const profitPerUnit = p.sellingPrice - p.distributorPrice;
    const profitPct = ((profitPerUnit / p.distributorPrice) * 100).toFixed(1);
    const totalRevenue = p.stockSold * p.sellingPrice;
    const totalCost = p.stockSold * p.distributorPrice;
    const totalProfit = totalRevenue - totalCost;
    const restockCost = p.restockQty * p.distributorPrice;

    let status = 'ok';
    if (currentStock <= criticalStockThreshold) status = 'critical';
    else if (currentStock <= lowStockThreshold) status = 'low';

    if (status === 'critical' || status === 'low') {
      alerts.push({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        currentStock,
        status,
        restockQty: p.restockQty,
        restockCost
      });
    }

    return {
      ...p,
      currentStock,
      profitPerUnit,
      profitPct: Number(profitPct),
      totalRevenue,
      totalCost,
      totalProfit,
      restockCost,
      status
    };
  });

  // Summary stats
  const totalRestockCost = products
    .filter(p => p.status !== 'ok')
    .reduce((sum, p) => sum + p.restockCost, 0);

  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalProfit = products.reduce((sum, p) => sum + p.totalProfit, 0);
  const totalItemsSold = products.reduce((sum, p) => sum + p.stockSold, 0);

  return { products, alerts, totalRestockCost, totalRevenue, totalProfit, totalItemsSold };
}

// ─── GET /api/inventory ────────────────────────────────────────────────────────
app.get('/api/inventory', (req, res) => {
  try {
    const data = readInventory();
    const computed = computeStock(data);
    res.json({ ...data, ...computed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/inventory/sale ──────────────────────────────────────────────────
// Body: { productId, qty }
app.post('/api/inventory/sale', (req, res) => {
  const { productId, qty } = req.body;
  const data = readInventory();
  const product = data.products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const currentStock = product.stockReceived - product.stockSold;
  if (qty > currentStock) return res.status(400).json({ error: 'Insufficient stock' });
  product.stockSold += qty;
  writeInventory(data);
  res.json({ success: true, product });
});

// ─── POST /api/inventory/restock ──────────────────────────────────────────────
// Body: { productId, qty }
app.post('/api/inventory/restock', (req, res) => {
  const { productId, qty } = req.body;
  const data = readInventory();
  const product = data.products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  product.stockReceived += qty;
  writeInventory(data);
  res.json({ success: true, product });
});

// ─── GET /api/inventory/alerts ────────────────────────────────────────────────
app.get('/api/inventory/alerts', (req, res) => {
  const data = readInventory();
  const { alerts } = computeStock(data);
  res.json({ alerts, count: alerts.length });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏪 Inventorary Dashboard running at: http://localhost:${PORT}`);
  console.log(`📊 API at: http://localhost:${PORT}/api/inventory`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
