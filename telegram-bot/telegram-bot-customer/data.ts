// =============================================
// STORE DATA — Live Inventory Sync + Deals + Promos
// =============================================
import fs from 'fs';
import path from 'path';

export const SHOP = {
  name: "Obsidian Retail Store",
  phone: "+919876500000",
  upiId: "9876500000@upi",
  address: "MG Road, Bengaluru",
  praise:
    "Your trusted neighborhood store on MG Road, Bengaluru — known for fresh groceries, " +
    "honest prices, and lightning-fast delivery. From daily essentials to special treats, " +
    "we hand-pick every product with care so your family always gets the very best!",
};

// =============================================
// PRODUCT CATEGORIES
// =============================================
export const CATEGORIES: Record<string, { emoji: string; label: string }> = {
  "Staples": { emoji: "🌾", label: "Staples" },
  "Snacks": { emoji: "🍪", label: "Snacks" },
  "Dairy": { emoji: "🧈", label: "Dairy" },
  "Home Care": { emoji: "🫧", label: "Home Care" },
  "Beverages": { emoji: "☕", label: "Beverages" },
  "Personal Care": { emoji: "🧹", label: "Personal Care" },
};

// =============================================
// HARDCODED FALLBACK PRODUCTS
// =============================================
const FALLBACK_PRODUCTS = [
  { id: "P01", name: "Aashirvaad Atta 5kg", price: 210, emoji: "🌾", category: "Staples", stock: 99 },
  { id: "P02", name: "Tata Salt 1kg", price: 25, emoji: "🧂", category: "Staples", stock: 99 },
  { id: "P03", name: "Parle-G 100g", price: 10, emoji: "🍪", category: "Snacks", stock: 99 },
  { id: "P04", name: "Amul Butter 500g", price: 260, emoji: "🧈", category: "Dairy", stock: 99 },
  { id: "P05", name: "Maggi Noodles 70g", price: 14, emoji: "🍜", category: "Snacks", stock: 99 },
  { id: "P06", name: "Surf Excel 1kg", price: 180, emoji: "🫧", category: "Home Care", stock: 99 },
  { id: "P07", name: "Tata Tea Gold 250g", price: 95, emoji: "🍵", category: "Beverages", stock: 99 },
  { id: "P08", name: "Colgate Toothpaste 200g", price: 85, emoji: "🪥", category: "Personal Care", stock: 99 },
];

export interface Product {
  id: string;
  name: string;
  price: number;
  emoji: string;
  category: string;
  stock: number;
}

// =============================================
// LIVE INVENTORY SYNC
// =============================================
function findInventoryPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'inventory', 'inventory.json'),
    path.join(__dirname, '..', '..', 'inventory', 'inventory.json'),
    path.join(__dirname, '..', '..', '..', 'inventory', 'inventory.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}
const INVENTORY_PATH = findInventoryPath();

export function getProducts(): Product[] {
  try {
    if (fs.existsSync(INVENTORY_PATH)) {
      const raw = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
      return raw.products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.sellingPrice,
        emoji: p.emoji,
        category: p.category || "Staples",
        stock: Math.max(0, (p.stockReceived || 0) - (p.stockSold || 0)),
      }));
    }
  } catch (err: any) {
    console.warn("⚠️ Could not read inventory.json, using fallback:", err.message);
  }
  return FALLBACK_PRODUCTS;
}

/** Decrement stock in inventory.json after a sale */
export function decrementInventoryStock(productId: string, qty: number): boolean {
  try {
    if (!fs.existsSync(INVENTORY_PATH)) return false;
    const raw = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    const product = raw.products.find((p: any) => p.id === productId);
    if (!product) return false;
    const currentStock = (product.stockReceived || 0) - (product.stockSold || 0);
    if (currentStock < qty) return false;
    product.stockSold += qty;
    raw.lastUpdated = new Date().toISOString();
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(raw, null, 2));
    return true;
  } catch {
    return false;
  }
}

/** Restore stock in inventory.json after a cancellation */
export function restoreInventoryStock(productId: string, qty: number): boolean {
  try {
    if (!fs.existsSync(INVENTORY_PATH)) return false;
    const raw = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    const product = raw.products.find((p: any) => p.id === productId);
    if (!product) return false;
    product.stockSold = Math.max(0, (product.stockSold || 0) - qty);
    raw.lastUpdated = new Date().toISOString();
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(raw, null, 2));
    return true;
  } catch {
    return false;
  }
}

/** Get available stock for a product */
export function getProductStock(productId: string): number {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  return p ? p.stock : 0;
}

/** Search products by name (fuzzy) */
export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const products = getProducts();
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.emoji.includes(q)
  );
}

/** Get products by category */
export function getProductsByCategory(category: string): Product[] {
  const products = getProducts();
  return products.filter(p => p.category === category);
}

/** Get all unique categories from current products */
export function getAvailableCategories(): string[] {
  const products = getProducts();
  return [...new Set(products.map(p => p.category))];
}

// =============================================
// BACKWARD-COMPATIBLE PRODUCTS EXPORT
// =============================================
// For code that still references PRODUCTS directly
export const PRODUCTS = getProducts();

// =============================================
// DELIVERY BOYS
// =============================================
export const DELIVERY_BOYS = [
  {
    name: "Ramesh Kumar",
    phone: "+919988776655",
    vehicleNumber: "KA01 AB 1234",
    vehicleType: "Bike 🏍️",
    rating: "⭐ 4.8"
  },
  {
    name: "Suresh Singh",
    phone: "+919988771122",
    vehicleNumber: "KA03 CD 5678",
    vehicleType: "Bike 🏍️",
    rating: "⭐ 4.6"
  },
  {
    name: "Ankit Rao",
    phone: "+919977665544",
    vehicleNumber: "KA05 EF 9012",
    vehicleType: "Scooter 🛵",
    rating: "⭐ 4.9"
  }
];

// =============================================
// DEALS (Dynamic Pricing)
// =============================================
export const DEALS = [
  // ─── 1. Quantity Tiers ───
  { id: "D01", name: "Parle-G Bulk Savings", description: "Buy 3+ Parle-G → Get 15% Off! 🍪", productId: "P03", minQty: 3, discountPct: 15, tag: "Quantity Tier" },
  { id: "D02", name: "Maggi 2+1 Offer", description: "Buy 2 Maggi Noodles → Get 1 Free! 🍜", productId: "P05", minQty: 2, freeQty: 1, tag: "BOGO Offer" },

  // ─── 2. Bundle / Combo Pricing ───
  { id: "D03", name: "Kitchen Staples Combo", description: "Bundle (Atta 5kg + Tata Salt 1kg) → Flat ₹25 OFF! 🌾🧂", bundleProducts: ["P01", "P02"], bundleDiscount: 25, tag: "Bundle Combo" },
  { id: "D04", name: "Evening Chai Combo", description: "Bundle (Tata Tea Gold + Parle-G) → Extra 10% OFF! 🍵🍪", bundleProducts: ["P07", "P03"], discountPct: 10, tag: "Bundle Combo" },

  // ─── 3. Cart Threshold & Free Delivery ───
  { id: "D05", name: "Super Saver Cart", description: "Orders ₹500+ → Free Delivery + ₹30 Instant Discount! 🚚", type: "free_delivery", minAmount: 500, flatDiscount: 30, tag: "Threshold Deal" },

  // ─── 4. Happy Hour / Flash Deal ───
  { id: "D06", name: "Happy Hour Special", description: "Flash Deal: Extra 5% OFF on Dairy (Amul Butter)! 🧈⚡", productId: "P04", minQty: 1, discountPct: 5, tag: "Flash Deal" }
];

// =============================================
// PROMO CODES
// =============================================
export interface PromoCode {
  code: string;
  type: 'flat' | 'percent';
  value: number;        // flat amount in ₹ or percentage
  maxDiscount?: number; // cap for percent-type
  minCart?: number;     // minimum cart amount to apply
  description: string;
  emoji: string;
}

export const PROMO_CODES: Record<string, PromoCode> = {
  "WELCOME50": {
    code: "WELCOME50",
    type: "flat",
    value: 50,
    description: "₹50 flat off — Welcome offer for new customers!",
    emoji: "🎉"
  },
  "OBSIDIAN20": {
    code: "OBSIDIAN20",
    type: "percent",
    value: 20,
    maxDiscount: 100,
    description: "20% off (max ₹100) — Store-wide savings!",
    emoji: "💎"
  },
  "FREESHIP": {
    code: "FREESHIP",
    type: "flat",
    value: 30,
    description: "₹30 off — Free delivery equivalent!",
    emoji: "🚚"
  },
  "DIWALI100": {
    code: "DIWALI100",
    type: "flat",
    value: 100,
    minCart: 500,
    description: "₹100 flat off on orders ₹500+ — Festival special!",
    emoji: "🪔"
  },
  "MEGA15": {
    code: "MEGA15",
    type: "percent",
    value: 15,
    maxDiscount: 75,
    description: "15% off (max ₹75) — Mega savings deal!",
    emoji: "🔥"
  },
};

/** Validate and compute promo discount */
export function applyPromoCode(code: string, cartTotal: number): { valid: boolean; discount: number; promo?: PromoCode; error?: string } {
  const upper = code.trim().toUpperCase();
  const promo = PROMO_CODES[upper];
  if (!promo) {
    return { valid: false, discount: 0, error: "❌ Invalid promo code. Please check and try again." };
  }
  if (promo.minCart && cartTotal < promo.minCart) {
    return { valid: false, discount: 0, error: `❌ Minimum cart of ₹${promo.minCart} required for code ${promo.code}.` };
  }
  let discount = 0;
  if (promo.type === 'flat') {
    discount = promo.value;
  } else {
    discount = Math.round(cartTotal * promo.value / 100);
    if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  }
  return { valid: true, discount, promo };
}


// =============================================
// FAQs
// =============================================
export const FAQS = [
  { id: "F01", question: "📦 Where is my order?", answer: "Your order is being prepared and will be dispatched soon. You'll receive a delivery update message when it's on the way!" },
  { id: "F02", question: "💰 How do I pay?", answer: "We accept Cash on Delivery (COD) and UPI payments. You can pay the delivery partner directly when your order arrives." },
  { id: "F03", question: "↩️ Can I cancel my order?", answer: "Orders can be cancelled within 10 minutes of placing them using /cancel command." },
  { id: "F04", question: "🔁 What is the return policy?", answer: "We accept returns within 24 hours for damaged or incorrect items. Please keep the original packaging and contact our shop." },
  { id: "F05", question: "⏰ What are your delivery hours?", answer: "We deliver from 9:00 AM to 9:00 PM every day, including weekends and holidays!" },
  { id: "F06", question: "📍 What is your delivery range?", answer: "We currently deliver within a 10 km radius of our store. Enter your address during checkout to check availability." },
  { id: "F07", question: "🎟️ How do I apply a promo code?", answer: "During checkout, after entering your delivery address, you'll be asked if you have a promo code. Type your code to apply the discount!" },
  { id: "F08", question: "🔄 How do scheduled orders work?", answer: "Use /schedule to set up recurring deliveries. Pick your items, choose delivery days and time slot, and we'll prepare your order automatically!" },
];
