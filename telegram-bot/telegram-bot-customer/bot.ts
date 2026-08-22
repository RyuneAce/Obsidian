import { Bot, InlineKeyboard, Api } from 'grammy';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getProducts, DELIVERY_BOYS, DEALS, FAQS, SHOP, CATEGORIES, searchProducts, getProductsByCategory, getAvailableCategories, decrementInventoryStock, restoreInventoryStock, getProductStock, applyPromoCode, PROMO_CODES, Product } from './data';
import { getCart, addToCart, removeFromCart, clearCart, getCartTotal, recordPurchase, getPurchasedItems, PurchasedItem, decrementFromCart, deleteFromCart, setQuantity, CartItem } from './cart';
import { getOrCreateCustomer, recordCustomerOrder, updateCustomerLocation, updateCustomerPhone, updateCustomerName, recordShopRating, recordDeliveryRating, CustomerProfile, cancelOrder, addScheduledOrder, getScheduledOrders, removeScheduledOrder, applyReferral } from './customer';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
if (!TOKEN || TOKEN === 'your_bot_token_here') {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new Bot(TOKEN);

// =============================================
// DELIVERY BOT BROADCAST DISPATCHER
// =============================================
function getDeliveryBotApi(): { api: Api; targets: number[] } | null {
  try {
    const candidateDirs = [
      path.join(__dirname, '..', 'telegram-bot-delivery'),
      path.join(__dirname, '..', 'delivery'),
      path.join(__dirname, '..', '..', 'telegram-bot-delivery'),
      path.join(__dirname, '..', '..', 'telegram-bot', 'telegram-bot-delivery'),
      path.join(__dirname, '..', '..', 'telegram-bot', 'delivery'),
    ];
    let deliveryDir = candidateDirs[0];
    for (const d of candidateDirs) {
      if (fs.existsSync(path.join(d, '.env')) || fs.existsSync(path.join(d, 'agents.json'))) {
        deliveryDir = d;
        break;
      }
    }
    const envFile = path.join(deliveryDir, '.env');
    const agentsFile = path.join(deliveryDir, 'agents.json');

    if (!fs.existsSync(envFile)) return null;
    const envContent = fs.readFileSync(envFile, 'utf8');
    const match = envContent.match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
    if (!match || !match[1] || match[1].includes('PASTE_')) return null;

    const deliveryToken = match[1].trim();
    const deliveryApi = new Api(deliveryToken);

    const targetSet = new Set<number>();
    const chatMatch = envContent.match(/TELEGRAM_CHAT_ID=([^\r\n]+)/);
    if (chatMatch && chatMatch[1]) {
      const cid = parseInt(chatMatch[1].trim(), 10);
      if (!isNaN(cid)) targetSet.add(cid);
    }

    if (fs.existsSync(agentsFile)) {
      try {
        const agents = JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
        for (const a of Object.values(agents) as any[]) {
          if (a.chatId) targetSet.add(Number(a.chatId));
        }
      } catch {}
    }

    return { api: deliveryApi, targets: Array.from(targetSet) };
  } catch (err: any) {
    console.warn("⚠️ Could not load delivery bot config:", err.message);
    return null;
  }
}

async function broadcastOrderToDeliveryAgents(orderData: {
  orderId: string;
  customerName: string;
  customerType: string;
  location: string;
  items: { emoji: string; name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  totalCost: number;
  paymentMethod: string;
}) {
  const delivery = getDeliveryBotApi();
  if (!delivery || delivery.targets.length === 0) {
    console.warn("⚠️ No delivery agents registered to receive order broadcast.");
    return;
  }

  const itemLines = orderData.items
    .map(i => `  • ${i.emoji} ${i.name} × ${i.quantity} (₹${i.price * i.quantity})`)
    .join('\n');

  const broadcastMsg =
    `🚨 *NEW ORDER READY FOR PICKUP!*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *Order ID:* \`${orderData.orderId}\`\n` +
    `👤 *Customer:* *${orderData.customerName}* (*${orderData.customerType}*)\n` +
    `📍 *Delivery Address:* ${orderData.location}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *Items (${orderData.items.length}):*\n${itemLines}\n\n` +
    `💰 *Bill Total:* *₹${orderData.totalCost}*\n` +
    `💳 *Payment:* ${orderData.paymentMethod}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👇 _Tap below to claim and pick up this order:_`;

  const kb = new InlineKeyboard()
    .text("✋ Taken (Claim This Order)", `take_order_${orderData.orderId}`).row();

  for (const chatId of delivery.targets) {
    try {
      await delivery.api.sendMessage(chatId, broadcastMsg, {
        parse_mode: "Markdown",
        reply_markup: kb,
      });
      console.log(`📢 Broadcasted order ${orderData.orderId} to delivery agent ${chatId}`);
    } catch (err: any) {
      console.warn(`⚠️ Failed to broadcast order to agent ${chatId}:`, err.message);
    }
  }
}

async function broadcastCancellationToDeliveryAgents(orderId: string, customerName: string) {
  const delivery = getDeliveryBotApi();
  if (!delivery || delivery.targets.length === 0) return;

  const msg = `❌ *ORDER CANCELLED*\n\nOrder \`${orderId}\` by *${customerName}* has been cancelled by the customer.\n\n_If you already claimed this order, please disregard it._`;

  for (const chatId of delivery.targets) {
    try {
      await delivery.api.sendMessage(chatId, msg, { parse_mode: "Markdown" });
    } catch {}
  }
}

// =============================================
// STATE & SESSIONS
// =============================================

interface RefundSession {
  item: PurchasedItem;
  reason?: string;
  step: 'WAITING_FOR_REASON' | 'WAITING_FOR_PROOF';
}
const activeRefundSessions = new Map<number, RefundSession>();
const activeLocationSessions = new Map<number, boolean>();
const activePhoneSessions = new Map<number, boolean>();
const activeNameSessions = new Map<number, boolean>();
const activeFeedbackSessions = new Map<number, { orderId: string; rating: number }>();
const activeSearchSessions = new Map<number, boolean>();

interface CheckoutSession {
  paymentType: 'cod' | 'upi';
  step: 'NAME' | 'PHONE' | 'ADDRESS' | 'NOTES' | 'PROMO' | 'CONFIRM';
  tempName?: string;
  tempPhone?: string;
  tempAddress?: string;
  tempNotes?: string;
  tempPromoCode?: string;
  tempPromoDiscount?: number;
}
const activeCheckoutSessions = new Map<number, CheckoutSession>();

interface ScheduleSession {
  step: 'SELECT_DAYS' | 'SELECT_TIME' | 'CONFIRM';
  selectedDays: string[];
  selectedTime?: string;
}
const activeScheduleSessions = new Map<number, ScheduleSession>();

const REFUND_REASONS: Record<string, string> = {
  damaged: "Damaged / Broken Packaging",
  wrong: "Wrong Item Delivered",
  quality: "Expired / Poor Quality",
  missing: "Missing from Package",
  other: "Other Issue",
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  { id: 'morning', label: '🌅 Morning (9-11 AM)' },
  { id: 'afternoon', label: '☀️ Afternoon (12-2 PM)' },
  { id: 'evening', label: '🌇 Evening (5-7 PM)' },
];

// =============================================
// HELPERS
// =============================================

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function buildDealsBanner(): string {
  const dealsList = DEALS.map(d => `▪ *${d.name}* (${d.tag})\n  ${d.description}`).join('\n\n');
  return (
    `🎯 *Active Dynamic Pricing Deals & Offers (Pillar 5):*\n\n` +
    `${dealsList}\n\n` +
    `⭐ *Customer Tier Perks:*\n` +
    `▪ *Regular Shopper (3+ orders):* Automatic ₹15 Discount on every order!\n` +
    `▪ *VIP Shopper (5+ orders):* Automatic 10% OFF on all orders!`
  );
}

function buildStartupMessage(): string {
  const greeting = getTimeGreeting();
  return (
    `${greeting}! ☀️\n\n` +
    `Welcome to *${SHOP.name}* 🛒\n\n` +
    `${SHOP.praise}\n\n` +
    `📍 ${SHOP.address} | 📞 ${SHOP.phone}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `${buildDealsBanner()}\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Ready to shop? Tap */start* below to browse our catalog, check your profile, and place your order.\n\n` +
    `Thank you for choosing us! 🙏`
  );
}

async function sendStartupWelcome() {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn("⚠️ TELEGRAM_CHAT_ID not set in .env — skipping startup welcome message.");
    return;
  }

  const kb = new InlineKeyboard().text("▶️ /start", "trigger_start");
  await bot.api.sendMessage(chatId, buildStartupMessage(), {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
  console.log(`📨 Startup welcome sent to chat ${chatId}`);
}

function getRandomDeliveryBoy() {
  return DELIVERY_BOYS[Math.floor(Math.random() * DELIVERY_BOYS.length)];
}

function getRandomETA() {
  const distance = (Math.random() * 8 + 1.5).toFixed(1);
  const eta = Math.round(Number(distance) / 20 * 60);
  return { distance, eta };
}

function applyDeals(chatId: number): { dealsText: string; discount: number } {
  const cart = getCart(chatId);
  const subtotal = getCartTotal(chatId);
  let discount = 0;
  const appliedDeals: string[] = [];

  for (const deal of DEALS as any[]) {
    if (deal.minAmount && subtotal >= deal.minAmount) {
      if (deal.flatDiscount) {
        discount += deal.flatDiscount;
        appliedDeals.push(`✅ ${deal.description} (Saved ₹${deal.flatDiscount})`);
      } else {
        appliedDeals.push(`✅ ${deal.description}`);
      }
    }
    else if (deal.productId) {
      const item = cart.items.find(i => i.productId === deal.productId);
      if (item && deal.minQty && item.quantity >= deal.minQty) {
        if (deal.discountPct) {
          const itemDiscount = Math.round(item.price * item.quantity * deal.discountPct / 100);
          discount += itemDiscount;
          appliedDeals.push(`✅ ${deal.description} → −₹${itemDiscount}`);
        } else if (deal.freeQty) {
          appliedDeals.push(`✅ ${deal.description}`);
        }
      }
    }
    else if (deal.bundleProducts && Array.isArray(deal.bundleProducts)) {
      const hasAll = deal.bundleProducts.every((pid: string) => cart.items.some(i => i.productId === pid));
      if (hasAll) {
        if (deal.bundleDiscount) {
          discount += deal.bundleDiscount;
          appliedDeals.push(`✅ ${deal.description} → −₹${deal.bundleDiscount}`);
        } else if (deal.discountPct) {
          const bundleTotal = cart.items
            .filter(i => deal.bundleProducts.includes(i.productId))
            .reduce((sum, i) => sum + i.price * i.quantity, 0);
          const bundleDiscount = Math.round(bundleTotal * deal.discountPct / 100);
          discount += bundleDiscount;
          appliedDeals.push(`✅ ${deal.description} → −₹${bundleDiscount}`);
        }
      }
    }
  }

  // Customer Membership Privilege Discount
  const profile = getOrCreateCustomer(chatId, "Customer");
  if (profile.customerType === 'VIP Customer 💎') {
    const vipDiscount = Math.round(subtotal * 0.10);
    if (vipDiscount > 0) {
      discount += vipDiscount;
      appliedDeals.push(`💎 VIP 10% Loyalty Privilege → −₹${vipDiscount}`);
    }
  } else if (profile.customerType === 'Regular Customer ⭐') {
    if (subtotal >= 100) {
      discount += 15;
      appliedDeals.push(`⭐ Regular Customer Loyalty Reward → −₹15`);
    }
  }

  return {
    dealsText: appliedDeals.length > 0 ? appliedDeals.join('\n') : "No active deals apply to your current cart.",
    discount
  };
}

// =============================================
// PRODUCT CATALOG WITH CATEGORIES & STOCK
// =============================================

function buildCategoryKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const categories = getAvailableCategories();
  categories.forEach(cat => {
    const catInfo = CATEGORIES[cat] || { emoji: "📦", label: cat };
    kb.text(`${catInfo.emoji} ${catInfo.label}`, `cat_${cat}`).row();
  });
  kb.text("📋 Show All Products", "cat_all").row();
  kb.text("🔍 Search Products", "search_products").row();
  kb.text("🛒 View Cart", "view_cart").text("✅ Confirm Order", "confirm_order").row();
  return kb;
}

function buildProductKeyboard(chatId: number, products?: Product[]): InlineKeyboard {
  const cart = getCart(chatId);
  const kb = new InlineKeyboard();
  const productList = products || getProducts();

  productList.forEach(p => {
    const inCart = cart.items.find(i => i.productId === p.id);
    const stockLabel = p.stock <= 0 ? " ❌ OUT OF STOCK" : p.stock <= 5 ? ` (${p.stock} left!)` : "";
    const label = inCart
      ? `${p.emoji} ${p.name} ₹${p.price} [×${inCart.quantity}]${stockLabel}`
      : `${p.emoji} ${p.name} ₹${p.price}${stockLabel}`;

    if (p.stock > 0) {
      kb.text(label, `add_${p.id}`).row();
    } else {
      kb.text(label, `outofstock_${p.id}`).row();
    }
  });

  kb.text("📂 Categories", "show_categories").text("🔍 Search", "search_products").row();
  kb.text("🛒 View Cart", "view_cart").text("✅ Confirm Order", "confirm_order").row();
  kb.text("🗑️ Clear Cart", "clear_cart").row();
  return kb;
}

function buildCartMessage(chatId: number): string {
  const cart = getCart(chatId);
  if (cart.items.length === 0) return "🛒 Your cart is empty\\. Use /order to add items\\!";

  const itemLines = cart.items.map(i =>
    `  ${i.emoji} ${i.name}: ₹${i.price} × ${i.quantity} = ₹${i.price * i.quantity}`
  ).join('\n');

  const subtotal = getCartTotal(chatId);
  const { dealsText, discount } = applyDeals(chatId);
  const finalTotal = subtotal - discount;

  return `🛒 *Your Cart:*\n\n${itemLines}\n\n` +
    `─────────────────\n` +
    `Subtotal: ₹${subtotal}\n\n` +
    `🎯 *Active Deals:*\n${dealsText}\n` +
    (discount > 0 ? `💸 Discount: −₹${discount}\n` : '') +
    `─────────────────\n` +
    `💰 *Total: ₹${finalTotal}*`;
}

function buildCartWithControls(chatId: number): InlineKeyboard {
  const cart = getCart(chatId);
  const kb = new InlineKeyboard();

  cart.items.forEach(item => {
    kb.text(`➖`, `cart_dec_${item.productId}`)
      .text(`${item.emoji} ${item.name} ×${item.quantity}`, `cart_info_${item.productId}`)
      .text(`➕`, `cart_inc_${item.productId}`)
      .text(`🗑️`, `cart_del_${item.productId}`)
      .row();
  });

  kb.text("✅ Confirm Order", "confirm_order").row();
  kb.text("🛍️ Continue Shopping", "continue_shopping").row();
  kb.text("🗑️ Clear Entire Cart", "clear_cart").row();
  return kb;
}

// =============================================
// COMMANDS & MENUS
// =============================================

async function showStartMenu(ctx: { reply: (text: string, options?: object) => Promise<unknown>; from?: { first_name?: string; username?: string }; chat: { id: number } }) {
  const name = ctx.from?.first_name || "there";
  const profile = getOrCreateCustomer(ctx.chat.id, name, ctx.from?.username);

  const kb = new InlineKeyboard()
    .text("🛍️ Browse Catalog", "trigger_order")
    .text("🛒 View Cart", "view_cart").row()
    .text("📦 Track Order", "track_order")
    .text("🎯 View Deals", "trigger_deals").row()
    .text("👤 My Profile", "view_profile")
    .text("🔄 Request Refund", "request_refund").row()
    .text("🔁 Reorder Past Order", "trigger_reorder")
    .text("❌ Cancel Order", "trigger_cancel").row()
    .text("📅 Scheduled Orders", "trigger_schedule")
    .text("🎟️ Referral Code", "trigger_refer").row()
    .text("❓ Help & FAQs", "show_help").row();

  const dealsSummary = DEALS.map(d => `▪ *${d.name}*: ${d.description}`).join('\n');

  await ctx.reply(
    `👋 Hello *${name}*! Welcome to *${SHOP.name}* 🛒\n\n` +
    `🎖️ *Membership:* *${profile.customerType}* | 🪙 Points: *${profile.loyaltyPoints}*\n` +
    `📍 *Delivery Location:* ${profile.location}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Today's Dynamic Pricing Deals & Offers:*\n` +
    `${dealsSummary}\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `*Commands:*\n` +
    `🛍️ /order — Browse & add items to cart\n` +
    `🛒 /cart — View your current cart\n` +
    `📦 /track — Track your order & delivery rider\n` +
    `✅ /confirm — Place your order\n` +
    `👤 /profile — View orders, tier & points\n` +
    `📍 /location — Set/update delivery address\n` +
    `📱 /phone — Set contact phone number\n` +
    `🎯 /deals — View all active discounts & combos\n` +
    `⭐ /feedback — Rate your order & share feedback\n` +
    `🔄 /refund — Request item return / refund\n` +
    `❌ /cancel — Cancel a recent order (10 min)\n` +
    `🔁 /reorder — Reorder a past order\n` +
    `🔍 /search — Search products by name\n` +
    `📅 /schedule — Set up recurring deliveries\n` +
    `🎟️ /refer — Your referral code & share\n` +
    `❓ /help — Support & FAQs`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

async function showCustomerProfile(chatId: number, ctx: any) {
  const name = ctx.from?.first_name || "Customer";
  const profile = getOrCreateCustomer(chatId, name, ctx.from?.username);

  const recentOrders = profile.orders.slice(-3).reverse();
  const orderSummary = recentOrders.length > 0
    ? recentOrders.map(o => {
        const dateStr = new Date(o.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const shopRatingStr = o.shopRating ? `🏪 Shop: ⭐ ${o.shopRating}/5` : '🏪 Shop: unrated';
        const delivRatingStr = o.deliveryRating ? `🚚 Delivery: ⭐ ${o.deliveryRating}/5` : '🚚 Delivery: unrated';
        const itemsList = o.items.map(i => `${i.emoji} ${i.name} x${i.quantity}`).join(', ');
        const statusIcon = o.deliveryStatus === 'Cancelled ❌' ? '❌' : '';
        return `▪ \`${o.orderId}\` (${dateStr}) ${statusIcon}\n  🛒 ${itemsList}\n  💰 ₹${o.totalCost}\n  ${shopRatingStr} | ${delivRatingStr}`;
      }).join('\n\n')
    : "No past orders yet. Use /order to start shopping!";

  const activeSchedules = getScheduledOrders(chatId);

  const kb = new InlineKeyboard()
    .text("📍 Update Address", "edit_location")
    .text("📱 Update Phone", "edit_phone").row()
    .text("👤 Update Name", "edit_name");
  if (profile.orders.length > 0) {
    kb.text("📦 Track Order", "track_order").row();
  } else {
    kb.row();
  }
  kb.text("⭐ Rate Latest Order", "trigger_feedback")
    .text("🔁 Reorder", "trigger_reorder").row()
    .text("🛍️ Browse Catalog", "trigger_order")
    .text("🔄 Request Refund", "request_refund").row()
    .text("🎟️ My Referral Code", "trigger_refer").row();

  const phoneLine = profile.phone ? `▪ *Phone:* \`${profile.phone}\`\n` : `▪ *Phone:* _Not set (Tap Update Phone)_\n`;

  const scheduleLine = activeSchedules.length > 0
    ? `\n📅 *Active Schedules:* *${activeSchedules.length}* (use /schedule to manage)`
    : '';

  const msg =
    `👤 *Customer Profile — ${SHOP.name}*\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `▪ *Name:* ${profile.name} ${profile.username ? `(@${profile.username})` : ''}\n` +
    phoneLine +
    `▪ *Customer Status:* *${profile.customerType}*\n` +
    `▪ *Total Orders:* *${profile.totalOrders}*\n` +
    `▪ *Total Spent:* *₹${profile.totalSpent}*\n` +
    `▪ *🪙 Loyalty Points:* *${profile.loyaltyPoints}*\n` +
    `▪ *📍 Delivery Address:* ${profile.location}\n` +
    `▪ *🎟️ Referral Code:* \`${profile.referralCode}\`\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `📦 *Recent Orders & Ratings:*\n${orderSummary}\n${scheduleLine}\n\n` +
    `💡 _Membership Perks:_\n` +
    `▪ *3+ orders:* Regular Shopper (₹15 off every order)\n` +
    `▪ *5+ orders / ₹2000+:* VIP Shopper (10% off all orders + priority delivery)`;

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
}

async function promptFeedback(chatId: number, ctx: any, orderId: string) {
  const kb = new InlineKeyboard()
    .text("⭐ 1", `rateshop_${orderId}_1`)
    .text("⭐⭐ 2", `rateshop_${orderId}_2`)
    .text("⭐⭐⭐ 3", `rateshop_${orderId}_3`)
    .text("⭐⭐⭐⭐ 4", `rateshop_${orderId}_4`)
    .text("⭐⭐⭐⭐⭐ 5", `rateshop_${orderId}_5`).row();

  await ctx.reply(
    `🏪 *Rate Store & Product Experience (Step 1/2)*\n` +
    `How was your order \`${orderId}\` product quality and service?\n` +
    `Tap a star rating below (+10 loyalty points):`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

// =============================================
// COMMANDS
// =============================================

bot.command("start", async (ctx) => {
  await showStartMenu(ctx);
});

bot.callbackQuery("trigger_start", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Welcome! 🛒" });
  await showStartMenu(ctx);
});

bot.command("profile", async (ctx) => {
  await showCustomerProfile(ctx.chat.id, ctx);
});

bot.callbackQuery("view_profile", async (ctx) => {
  await safeAnswer(ctx);
  await showCustomerProfile(ctx.chat!.id, ctx);
});

bot.command(["location", "address"], async (ctx) => {
  activeLocationSessions.set(ctx.chat.id, true);
  await ctx.reply(
    `📍 *Update Delivery Location / Address*\n\n` +
    `Please send your delivery address, flat number, street or landmark in Bengaluru (e.g. _"Flat 302, Palm Meadows, Whitefield, Bengaluru"_):\n\n` +
    `_(Type your address below or send /cancel_location)_`,
    { parse_mode: "Markdown" }
  );
});

bot.callbackQuery("edit_location", async (ctx) => {
  await safeAnswer(ctx);
  activeLocationSessions.set(ctx.chat!.id, true);
  await ctx.reply(
    `📍 *Update Delivery Location / Address*\n\n` +
    `Please type your delivery address / street in Bengaluru below:\n\n` +
    `_(Send /cancel_location to abort)_`,
    { parse_mode: "Markdown" }
  );
});

bot.command(["phone", "setphone"], async (ctx) => {
  activePhoneSessions.set(ctx.chat.id, true);
  await ctx.reply(
    `📱 *Update Phone Number*\n\n` +
    `Please type your contact phone number below (e.g. \`+91 98765 43210\`):\n\n` +
    `_(Send /cancel_location to abort)_`,
    { parse_mode: "Markdown" }
  );
});

bot.callbackQuery("edit_phone", async (ctx) => {
  await safeAnswer(ctx);
  activePhoneSessions.set(ctx.chat!.id, true);
  await ctx.reply(
    `📱 *Update Phone Number*\n\n` +
    `Please type your contact phone number below:\n\n` +
    `_(Send /cancel_location to abort)_`,
    { parse_mode: "Markdown" }
  );
});

bot.command(["name", "setname"], async (ctx) => {
  activeNameSessions.set(ctx.chat.id, true);
  await ctx.reply(
    `👤 *Update Full Name*\n\n` +
    `Please type your full name below:\n\n` +
    `_(Send /cancel_location to abort)_`,
    { parse_mode: "Markdown" }
  );
});

bot.callbackQuery("edit_name", async (ctx) => {
  await safeAnswer(ctx);
  activeNameSessions.set(ctx.chat!.id, true);
  await ctx.reply(
    `👤 *Update Full Name*\n\n` +
    `Please type your full name below:\n\n` +
    `_(Send /cancel_location to abort)_`,
    { parse_mode: "Markdown" }
  );
});

bot.command("feedback", async (ctx) => {
  const profile = getOrCreateCustomer(ctx.chat.id, "Customer");
  if (profile.orders.length === 0) {
    await ctx.reply("ℹ️ You haven't placed an order yet. Use /order to start shopping!");
    return;
  }
  const lastOrder = profile.orders[profile.orders.length - 1];
  await promptFeedback(ctx.chat.id, ctx, lastOrder.orderId);
});

bot.callbackQuery("trigger_feedback", async (ctx) => {
  await safeAnswer(ctx);
  const profile = getOrCreateCustomer(ctx.chat!.id, "Customer");
  if (profile.orders.length === 0) {
    await ctx.reply("ℹ️ You haven't placed an order yet. Use /order to start shopping!");
    return;
  }
  const lastOrder = profile.orders[profile.orders.length - 1];
  await promptFeedback(ctx.chat!.id, ctx, lastOrder.orderId);
});

// =============================================
// PRODUCT CATALOG WITH CATEGORIES
// =============================================

bot.command("order", async (ctx) => {
  await ctx.reply(
    `🛍️ *Product Catalog — ${SHOP.name}*\n\nBrowse by category or view all products:`,
    { parse_mode: "Markdown", reply_markup: buildCategoryKeyboard() }
  );
});

bot.callbackQuery("trigger_order", async (ctx) => {
  await safeAnswer(ctx);
  await ctx.reply(
    `🛍️ *Product Catalog — ${SHOP.name}*\n\nBrowse by category or view all products:`,
    { parse_mode: "Markdown", reply_markup: buildCategoryKeyboard() }
  );
});

bot.callbackQuery("show_categories", async (ctx) => {
  await safeAnswer(ctx);
  await ctx.reply(
    `📂 *Select a Category:*`,
    { parse_mode: "Markdown", reply_markup: buildCategoryKeyboard() }
  );
});

bot.callbackQuery(/^cat_/, async (ctx) => {
  await safeAnswer(ctx);
  const category = ctx.callbackQuery.data.replace('cat_', '');

  if (category === 'all') {
    await ctx.reply(
      `🛍️ *All Products*\n\nTap any item to add to cart:`,
      { parse_mode: "Markdown", reply_markup: buildProductKeyboard(ctx.chat!.id) }
    );
  } else {
    const products = getProductsByCategory(category);
    const catInfo = CATEGORIES[category] || { emoji: "📦", label: category };
    if (products.length === 0) {
      await ctx.reply(`No products found in ${catInfo.emoji} ${catInfo.label}.`);
      return;
    }
    await ctx.reply(
      `${catInfo.emoji} *${catInfo.label}* (${products.length} items)\n\nTap to add to cart:`,
      { parse_mode: "Markdown", reply_markup: buildProductKeyboard(ctx.chat!.id, products) }
    );
  }
});

// =============================================
// SEARCH
// =============================================

bot.command("search", async (ctx) => {
  const query = ctx.message.text.replace(/^\/search\s*/i, '').trim();
  if (!query) {
    activeSearchSessions.set(ctx.chat.id, true);
    await ctx.reply(
      `🔍 *Product Search*\n\nType the name of a product you're looking for (e.g. "Maggi", "tea", "butter"):`,
      { parse_mode: "Markdown" }
    );
    return;
  }
  await handleSearch(ctx.chat.id, ctx, query);
});

bot.callbackQuery("search_products", async (ctx) => {
  await safeAnswer(ctx);
  activeSearchSessions.set(ctx.chat!.id, true);
  await ctx.reply(
    `🔍 *Product Search*\n\nType the product name below (e.g. "Maggi", "atta", "butter"):`,
    { parse_mode: "Markdown" }
  );
});

async function handleSearch(chatId: number, ctx: any, query: string) {
  activeSearchSessions.delete(chatId);
  const results = searchProducts(query);

  if (results.length === 0) {
    const kb = new InlineKeyboard()
      .text("📋 Show All Products", "cat_all").row()
      .text("🔍 Search Again", "search_products").row();
    await ctx.reply(
      `🔍 No products found matching "*${query}*".\n\nTry a different search or browse all products.`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return;
  }

  await ctx.reply(
    `🔍 *Search Results for "${query}":* (${results.length} found)\n\nTap to add to cart:`,
    { parse_mode: "Markdown", reply_markup: buildProductKeyboard(chatId, results) }
  );
}

// =============================================
// CART COMMANDS
// =============================================

bot.command("cart", async (ctx) => {
  const cart = getCart(ctx.chat.id);
  if (cart.items.length > 0) {
    await ctx.reply(buildCartMessage(ctx.chat.id), { parse_mode: "Markdown", reply_markup: buildCartWithControls(ctx.chat.id) });
  } else {
    await ctx.reply(buildCartMessage(ctx.chat.id), { parse_mode: "Markdown" });
  }
});

bot.command("deals", async (ctx) => {
  await ctx.reply(buildDealsBanner(), { parse_mode: "Markdown" });
});

bot.callbackQuery("trigger_deals", async (ctx) => {
  await safeAnswer(ctx);
  await ctx.reply(buildDealsBanner(), { parse_mode: "Markdown" });
});

bot.command("confirm", async (ctx) => {
  const cart = getCart(ctx.chat.id);
  if (cart.items.length === 0) {
    await ctx.reply("🛒 Your cart is empty\\! Use /order to add some items first\\.", { parse_mode: "MarkdownV2" });
    return;
  }
  const kb = new InlineKeyboard()
    .text("💵 Cash on Delivery", "pay_cod").row()
    .text("📱 UPI", "pay_upi").row();
  await ctx.reply("💳 *Select Payment Method:*", { parse_mode: "Markdown", reply_markup: kb });
});

bot.command("refund", async (ctx) => {
  await showRefundMenu(ctx.chat.id, ctx);
});

bot.command("help", async (ctx) => {
  await showHelpMenu(ctx);
});

bot.command(["track", "status", "orderstatus", "whereismyorder"], async (ctx) => {
  await showOrderTracking(ctx.chat.id, ctx);
});

// =============================================
// CANCEL ORDER (10 min window)
// =============================================

bot.command("cancel", async (ctx) => {
  await showCancelMenu(ctx.chat.id, ctx);
});

bot.callbackQuery("trigger_cancel", async (ctx) => {
  await safeAnswer(ctx);
  await showCancelMenu(ctx.chat!.id, ctx);
});

async function showCancelMenu(chatId: number, ctx: any) {
  const profile = getOrCreateCustomer(chatId, "Customer");
  const now = Date.now();

  // Find orders that are potentially cancellable (not delivered/cancelled)
  const activeOrders = profile.orders.filter(o =>
    o.deliveryStatus !== 'Delivered ✅' &&
    o.deliveryStatus !== 'Delivered' &&
    o.deliveryStatus !== 'Cancelled ❌'
  );

  if (activeOrders.length === 0) {
    await ctx.reply(
      `ℹ️ *No Active Orders to Cancel*\n\nYou don't have any active orders that can be cancelled.\n\n🛍️ Use /order to place a new order!`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const kb = new InlineKeyboard();

  for (const order of activeOrders.reverse().slice(0, 5)) {
    const orderTime = new Date(order.timestamp).getTime();
    const elapsedMin = Math.floor((now - orderTime) / (1000 * 60));
    const canCancel = elapsedMin <= 10;
    const timeLabel = canCancel
      ? `⏳ ${10 - elapsedMin} min left to cancel`
      : `⏰ Window expired (${elapsedMin} min ago)`;

    const itemPreview = order.items.map(i => `${i.emoji}`).join(' ');
    const label = `${canCancel ? '❌' : '⛔'} ${order.orderId} — ₹${order.totalCost} ${itemPreview}`;

    if (canCancel) {
      kb.text(label, `cancel_order_${order.orderId}`).row();
    } else {
      kb.text(`${label} (expired)`, `cancel_expired`).row();
    }
  }

  await ctx.reply(
    `❌ *Cancel Order*\n\n` +
    `Orders can be cancelled within *10 minutes* of placing.\n\n` +
    `Select an order to cancel:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

bot.callbackQuery("cancel_expired", async (ctx) => {
  await safeAnswer(ctx, { text: "⏰ Cancellation window has expired for this order!", show_alert: true });
});

bot.callbackQuery(/^cancel_order_/, async (ctx) => {
  await safeAnswer(ctx);
  const orderId = ctx.callbackQuery.data.replace('cancel_order_', '');

  const result = cancelOrder(ctx.chat!.id, orderId, 10);

  if (!result.success) {
    await ctx.reply(`⚠️ ${result.error}`, { parse_mode: "Markdown" });
    return;
  }

  // Restore inventory stock
  if (result.order) {
    for (const item of result.order.items) {
      restoreInventoryStock(item.productId, item.quantity);
    }
  }

  // Notify delivery agents
  const profile = getOrCreateCustomer(ctx.chat!.id, "Customer");
  broadcastCancellationToDeliveryAgents(orderId, profile.name).catch(() => {});

  const itemsList = result.order!.items.map(i => `  ${i.emoji} ${i.name} ×${i.quantity}`).join('\n');
  await ctx.reply(
    `✅ *Order Cancelled Successfully!*\n\n` +
    `🆔 *Order ID:* \`${orderId}\`\n` +
    `🛒 *Items Cancelled:*\n${itemsList}\n\n` +
    `💰 *Refund Amount:* ₹${result.order!.totalCost}\n` +
    `🪙 *Loyalty Points Reverted:* −${Math.floor(result.order!.totalCost / 10)} pts\n` +
    `📦 *Inventory:* Stock restored ✅\n\n` +
    `_Delivery agents have been notified. Refund will be processed within 24 hours._`,
    { parse_mode: "Markdown" }
  );
});

// =============================================
// REORDER
// =============================================

bot.command("reorder", async (ctx) => {
  await showReorderMenu(ctx.chat.id, ctx);
});

bot.callbackQuery("trigger_reorder", async (ctx) => {
  await safeAnswer(ctx);
  await showReorderMenu(ctx.chat!.id, ctx);
});

async function showReorderMenu(chatId: number, ctx: any) {
  const profile = getOrCreateCustomer(chatId, "Customer");
  const completedOrders = profile.orders.filter(o =>
    o.deliveryStatus !== 'Cancelled ❌' && o.items && o.items.length > 0
  );

  if (completedOrders.length === 0) {
    await ctx.reply(
      `ℹ️ *No Past Orders to Reorder*\n\nPlace your first order using /order!`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const recent = completedOrders.slice(-5).reverse();
  const kb = new InlineKeyboard();

  for (const order of recent) {
    const itemPreview = order.items.map(i => `${i.emoji}`).join(' ');
    const dateStr = new Date(order.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    kb.text(`🔁 ${order.orderId} (${dateStr}) — ₹${order.totalCost} ${itemPreview}`, `reorder_${order.orderId}`).row();
  }

  await ctx.reply(
    `🔁 *Reorder a Past Order*\n\n` +
    `Select an order below to add all its items to your current cart:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

bot.callbackQuery(/^reorder_/, async (ctx) => {
  await safeAnswer(ctx);
  const orderId = ctx.callbackQuery.data.replace('reorder_', '');
  const chatId = ctx.chat!.id;
  const profile = getOrCreateCustomer(chatId, "Customer");
  const order = profile.orders.find(o => o.orderId === orderId);

  if (!order) {
    await ctx.reply("⚠️ Order not found.");
    return;
  }

  let addedCount = 0;
  let outOfStock: string[] = [];
  const products = getProducts();

  for (const item of order.items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) continue;

    for (let i = 0; i < item.quantity; i++) {
      const result = addToCart(chatId, { id: product.id, name: product.name, price: product.price, emoji: product.emoji });
      if (result.success) {
        addedCount++;
      } else {
        if (!outOfStock.includes(item.name)) outOfStock.push(item.name);
        break;
      }
    }
  }

  let msg = `✅ *Reorder Complete!*\n\nAdded *${addedCount} items* from order \`${orderId}\` to your cart.`;
  if (outOfStock.length > 0) {
    msg += `\n\n⚠️ *Out of stock / limited:* ${outOfStock.join(', ')}`;
  }

  const kb = new InlineKeyboard()
    .text("🛒 View Cart", "view_cart")
    .text("✅ Confirm Order", "confirm_order").row();

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
});

// =============================================
// REFERRAL
// =============================================

bot.command("refer", async (ctx) => {
  await showReferralInfo(ctx.chat.id, ctx);
});

bot.callbackQuery("trigger_refer", async (ctx) => {
  await safeAnswer(ctx);
  await showReferralInfo(ctx.chat!.id, ctx);
});

async function showReferralInfo(chatId: number, ctx: any) {
  const profile = getOrCreateCustomer(chatId, ctx.from?.first_name || "Customer", ctx.from?.username);

  await ctx.reply(
    `🎟️ *Your Referral Code*\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Code:* \`${profile.referralCode}\`\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Share this code with friends! When they sign up and place their first order, *both of you get 50 bonus loyalty points!* 🎁\n\n` +
    `📤 *Share this message:*\n` +
    `_Hey! Shop at ${SHOP.name} on Telegram and use my referral code_ \`${profile.referralCode}\` _to earn bonus points! 🛒_\n\n` +
    (profile.referredBy ? `✅ *You were referred by:* \`${profile.referredBy}\`` : `💡 _Have a referral code? Send /use_referral <code> to apply._`),
    { parse_mode: "Markdown" }
  );
}

bot.command("use_referral", async (ctx) => {
  const code = ctx.message.text.replace(/^\/use_referral\s*/i, '').trim().toUpperCase();
  if (!code) {
    await ctx.reply("ℹ️ Usage: `/use_referral REF-CODE`", { parse_mode: "Markdown" });
    return;
  }
  const result = applyReferral(ctx.chat.id, code);
  if (result.success) {
    await ctx.reply(
      `🎉 *Referral Applied!*\n\n` +
      `Referred by: *${result.referrerName}*\n` +
      `🪙 *+50 Bonus Points* added to both your accounts!`,
      { parse_mode: "Markdown" }
    );
  } else {
    await ctx.reply(`⚠️ ${result.error}`);
  }
});

// =============================================
// SCHEDULED ORDERS
// =============================================

bot.command("schedule", async (ctx) => {
  await showScheduleMenu(ctx.chat.id, ctx);
});

bot.callbackQuery("trigger_schedule", async (ctx) => {
  await safeAnswer(ctx);
  await showScheduleMenu(ctx.chat!.id, ctx);
});

async function showScheduleMenu(chatId: number, ctx: any) {
  const existing = getScheduledOrders(chatId);

  const kb = new InlineKeyboard()
    .text("📅 Create New Schedule", "schedule_new").row();

  if (existing.length > 0) {
    kb.text("📋 View My Schedules", "schedule_list").row();
  }

  let msg = `📅 *Scheduled / Recurring Orders*\n\n` +
    `Set up automatic recurring deliveries! We'll prepare your order on your chosen days and time.\n\n`;

  if (existing.length > 0) {
    msg += `📊 *Active Schedules:* ${existing.length}\n`;
    for (const s of existing) {
      const itemNames = s.items.map(i => `${i.emoji} ${i.name}`).join(', ');
      msg += `▪ \`${s.id}\`: ${s.schedule.days.join(', ')} at ${s.schedule.time}\n  Items: ${itemNames}\n`;
    }
    msg += `\n`;
  }

  msg += `👇 *Choose an option below:*`;

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
}

bot.callbackQuery("schedule_new", async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const cart = getCart(chatId);

  if (cart.items.length === 0) {
    await ctx.reply(
      `ℹ️ *Add items to cart first!*\n\nYour cart is currently empty. Use /order to add products, then come back to /schedule to set up recurring delivery.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Start schedule creation — step 1: select days
  activeScheduleSessions.set(chatId, { step: 'SELECT_DAYS', selectedDays: [] });
  await showDayPicker(chatId, ctx, []);
});

async function showDayPicker(chatId: number, ctx: any, selectedDays: string[]) {
  const kb = new InlineKeyboard();

  // Quick presets
  kb.text("📅 Every Day", "sched_preset_everyday")
    .text("🏢 Weekdays Only", "sched_preset_weekdays").row();
  kb.text("🌴 Weekends Only", "sched_preset_weekends").row();

  // Individual day toggles
  for (const day of DAYS_OF_WEEK) {
    const isSelected = selectedDays.includes(day);
    kb.text(`${isSelected ? '✅' : '☐'} ${day}`, `sched_day_${day}`).row();
  }

  if (selectedDays.length > 0) {
    kb.text(`➡️ Next: Choose Time (${selectedDays.length} days selected)`, "sched_next_time").row();
  }
  kb.text("❌ Cancel", "sched_cancel").row();

  await ctx.reply(
    `📅 *Step 1/2: Select Delivery Days*\n\n` +
    `Which days should your order be delivered?\n` +
    `Tap days to toggle, or use a quick preset:\n\n` +
    `*Selected:* ${selectedDays.length > 0 ? selectedDays.join(', ') : '_None yet_'}`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

bot.callbackQuery("sched_preset_everyday", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeScheduleSessions.get(ctx.chat!.id);
  if (!session) return;
  session.selectedDays = [...DAYS_OF_WEEK];
  await showDayPicker(ctx.chat!.id, ctx, session.selectedDays);
});

bot.callbackQuery("sched_preset_weekdays", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeScheduleSessions.get(ctx.chat!.id);
  if (!session) return;
  session.selectedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  await showDayPicker(ctx.chat!.id, ctx, session.selectedDays);
});

bot.callbackQuery("sched_preset_weekends", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeScheduleSessions.get(ctx.chat!.id);
  if (!session) return;
  session.selectedDays = ['Saturday', 'Sunday'];
  await showDayPicker(ctx.chat!.id, ctx, session.selectedDays);
});

bot.callbackQuery(/^sched_day_/, async (ctx) => {
  await safeAnswer(ctx);
  const day = ctx.callbackQuery.data.replace('sched_day_', '');
  const session = activeScheduleSessions.get(ctx.chat!.id);
  if (!session) return;

  if (session.selectedDays.includes(day)) {
    session.selectedDays = session.selectedDays.filter(d => d !== day);
  } else {
    session.selectedDays.push(day);
  }
  await showDayPicker(ctx.chat!.id, ctx, session.selectedDays);
});

bot.callbackQuery("sched_next_time", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeScheduleSessions.get(ctx.chat!.id);
  if (!session || session.selectedDays.length === 0) return;

  session.step = 'SELECT_TIME';

  const kb = new InlineKeyboard();
  TIME_SLOTS.forEach(slot => {
    kb.text(slot.label, `sched_time_${slot.id}`).row();
  });
  kb.text("⬅️ Back to Days", "sched_back_days").row();
  kb.text("❌ Cancel", "sched_cancel").row();

  await ctx.reply(
    `⏰ *Step 2/2: Select Delivery Time Slot*\n\n` +
    `📅 *Days:* ${session.selectedDays.join(', ')}\n\n` +
    `When should your order be delivered?`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery("sched_back_days", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeScheduleSessions.get(ctx.chat!.id);
  if (!session) return;
  session.step = 'SELECT_DAYS';
  await showDayPicker(ctx.chat!.id, ctx, session.selectedDays);
});

bot.callbackQuery(/^sched_time_/, async (ctx) => {
  await safeAnswer(ctx);
  const timeId = ctx.callbackQuery.data.replace('sched_time_', '');
  const session = activeScheduleSessions.get(ctx.chat!.id);
  if (!session) return;

  const timeSlot = TIME_SLOTS.find(t => t.id === timeId);
  if (!timeSlot) return;

  session.selectedTime = timeSlot.label;
  session.step = 'CONFIRM';

  const chatId = ctx.chat!.id;
  const cart = getCart(chatId);
  const profile = getOrCreateCustomer(chatId, "Customer");
  const itemsList = cart.items.map(i => `  ${i.emoji} *${i.name}* ×${i.quantity} (₹${i.price * i.quantity})`).join('\n');
  const total = getCartTotal(chatId);

  const kb = new InlineKeyboard()
    .text("✅ Confirm Schedule", "sched_confirm").row()
    .text("⬅️ Change Time", "sched_next_time").row()
    .text("❌ Cancel", "sched_cancel").row();

  await ctx.reply(
    `📋 *Schedule Review*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📅 *Delivery Days:* ${session.selectedDays.join(', ')}\n` +
    `⏰ *Time Slot:* ${session.selectedTime}\n` +
    `📍 *Address:* ${profile.location}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🛒 *Items to be Delivered:*\n${itemsList}\n\n` +
    `💰 *Estimated Order Total:* ₹${total}\n\n` +
    `👉 Tap *Confirm Schedule* to activate this recurring order.`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery("sched_confirm", async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const session = activeScheduleSessions.get(chatId);
  if (!session || !session.selectedTime) return;

  const cart = getCart(chatId);
  const profile = getOrCreateCustomer(chatId, "Customer");

  const schedule = addScheduledOrder(chatId, {
    items: cart.items.map(i => ({ ...i })),
    schedule: {
      days: session.selectedDays,
      time: session.selectedTime,
    },
    address: profile.location,
    isActive: true,
  });

  activeScheduleSessions.delete(chatId);

  await ctx.reply(
    `✅ *Scheduled Order Created!*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *Schedule ID:* \`${schedule.id}\`\n` +
    `📅 *Days:* ${session.selectedDays.join(', ')}\n` +
    `⏰ *Time:* ${session.selectedTime}\n` +
    `📍 *Address:* ${profile.location}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔔 _Your order will be prepared automatically on scheduled days._\n` +
    `Use /schedule to view or cancel your schedules.`,
    { parse_mode: "Markdown" }
  );
});

bot.callbackQuery("sched_cancel", async (ctx) => {
  await safeAnswer(ctx);
  activeScheduleSessions.delete(ctx.chat!.id);
  await ctx.reply("❌ Schedule creation cancelled.");
});

bot.callbackQuery("schedule_list", async (ctx) => {
  await safeAnswer(ctx);
  const schedules = getScheduledOrders(ctx.chat!.id);

  if (schedules.length === 0) {
    await ctx.reply("📭 No active scheduled orders. Use /schedule to create one!");
    return;
  }

  const kb = new InlineKeyboard();
  for (const s of schedules) {
    kb.text(`🗑️ Cancel ${s.id}`, `sched_remove_${s.id}`).row();
  }

  let msg = `📋 *Your Active Schedules:*\n\n`;
  for (const s of schedules) {
    const itemNames = s.items.map(i => `${i.emoji} ${i.name} ×${i.quantity}`).join(', ');
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🆔 \`${s.id}\`\n`;
    msg += `📅 ${s.schedule.days.join(', ')}\n`;
    msg += `⏰ ${s.schedule.time}\n`;
    msg += `📍 ${s.address}\n`;
    msg += `🛒 ${itemNames}\n`;
  }

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
});

bot.callbackQuery(/^sched_remove_/, async (ctx) => {
  await safeAnswer(ctx);
  const schedId = ctx.callbackQuery.data.replace('sched_remove_', '');
  const removed = removeScheduledOrder(ctx.chat!.id, schedId);
  if (removed) {
    await ctx.reply(`✅ Schedule \`${schedId}\` has been cancelled.`, { parse_mode: "Markdown" });
  } else {
    await ctx.reply("⚠️ Schedule not found.");
  }
});

// =============================================
// ORDER TRACKING & DELIVERY PARTNER HELPER
// =============================================

function getDeliveryPartnerDetails(name: string) {
  const partner = DELIVERY_BOYS.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (partner) return partner;

  try {
    const agentsFile = path.join(__dirname, '..', 'telegram-bot-delivery', 'agents.json');
    if (fs.existsSync(agentsFile)) {
      const agents = JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
      for (const a of Object.values(agents) as any[]) {
        if (a.agentName && a.agentName.toLowerCase() === name.toLowerCase()) {
          return {
            name: a.agentName,
            phone: a.agentPhone,
            vehicleNumber: a.vehicleNumber || 'KA01 AB 1234',
            vehicleType: a.vehicleType || 'Bike 🏍️',
            rating: '⭐ 4.9'
          };
        }
      }
    }
  } catch {}

  return null;
}

async function showOrderTracking(chatId: number, ctx: any, specificOrderId?: string) {
  const profile = getOrCreateCustomer(chatId, "Customer");

  if (!profile.orders || profile.orders.length === 0) {
    const kb = new InlineKeyboard()
      .text("🛍️ Browse Catalog & Order", "trigger_order").row()
      .text("🏷️ View Active Deals", "trigger_deals").row()
      .text("❓ Help & FAQs", "show_help");

    await ctx.reply(
      `📦 *No Active Orders Found*\n\n` +
      `You haven't placed any orders yet with *${SHOP.name}*!\n\n` +
      `🛒 Add items to your cart and place an order to get live delivery updates, real-time tracking, and loyalty rewards.\n\n` +
      `Use /order to start shopping now!`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return;
  }

  const order = specificOrderId
    ? profile.orders.find(o => o.orderId === specificOrderId) || profile.orders[profile.orders.length - 1]
    : profile.orders[profile.orders.length - 1];

  const orderDate = new Date(order.timestamp).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const itemsList = order.items.map(i => `  ▪ ${i.emoji} ${i.name} × ${i.quantity} (₹${i.price * i.quantity})`).join('\n');

  // Delivery Partner info
  let deliveryInfo = "";
  const partnerName = order.deliveryBoy?.name;
  const isAssigned = partnerName && partnerName !== "Assigning Partner..." && !partnerName.includes("Assigning");

  if (isAssigned) {
    const partnerExtra = getDeliveryPartnerDetails(partnerName);
    const phone = order.deliveryBoy.phone || partnerExtra?.phone || "+919988776655";
    const vehicle = partnerExtra ? ` (${partnerExtra.vehicleType} • ${partnerExtra.vehicleNumber})` : " (Delivery Bike 🏍️)";
    const rating = partnerExtra?.rating ? ` [${partnerExtra.rating}]` : "";

    deliveryInfo =
      `🚴 *Delivery Partner Information:*\n` +
      `▪ *Partner Name:* *${partnerName}*${rating}\n` +
      `▪ *Contact Phone:* \`${phone}\`\n` +
      `▪ *Vehicle:* ${vehicle}\n`;
  } else {
    deliveryInfo =
      `🚴 *Delivery Partner Information:*\n` +
      `▪ *Status:* ⏳ _Assigning nearest delivery partner in Bengaluru..._\n` +
      `▪ _You will receive an instant notification as soon as a rider is assigned._\n`;
  }

  const statusLabel = order.deliveryStatus === 'Delivered ✅' || order.deliveryStatus === 'Delivered'
    ? '✅ Delivered'
    : order.deliveryStatus === 'Out for Delivery 🚀'
    ? '🚀 Out for Delivery'
    : order.deliveryStatus === 'Assigned'
    ? '📦 Order Packed & Assigned to Rider'
    : order.deliveryStatus === 'Cancelled ❌'
    ? '❌ Cancelled'
    : '⏳ Preparing Order / Pending Rider Pickup';

  const notesLine = order.orderNotes ? `\n📝 *Order Notes:* _${order.orderNotes}_` : '';
  const promoLine = order.promoCode ? `\n🎟️ *Promo Applied:* \`${order.promoCode}\` (−₹${order.promoDiscount || 0})` : '';

  const kb = new InlineKeyboard();
  kb.text("🔄 Refresh Status", `track_${order.orderId}`).row();
  if (profile.orders.length > 1) {
    kb.text("📋 View All Past Orders", "view_profile").row();
  }
  kb.text("🛍️ Order Again", "trigger_order")
    .text("❓ Help & Support", "show_help").row();

  const msg =
    `📦 *Live Order Tracking — ${SHOP.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *Tracking ID:* \`${order.orderId}\`\n` +
    `🕒 *Order Placed:* ${orderDate}\n` +
    `🚦 *Current Status:* *${statusLabel}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🛒 *Items in Order:*\n${itemsList}\n\n` +
    `💰 *Total Cost:* *₹${order.totalCost}* (${order.paymentMethod})${promoLine}${notesLine}\n` +
    `📍 *Delivery Address:* ${order.location || profile.location}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `${deliveryInfo}\n` +
    `🏪 *Store Contact Information:*\n` +
    `▪ *Shop Name:* ${SHOP.name}\n` +
    `▪ *Shop Phone:* \`${SHOP.phone}\`\n` +
    `▪ *Shop Address:* ${SHOP.address}\n` +
    `━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
}

// =============================================
// CONFIRM ORDER (with new checkout steps)
// =============================================

async function handleConfirmOrder(
  chatId: number,
  ctx: any,
  paymentType: 'cod' | 'upi',
  details?: { name?: string; phone?: string; address?: string; notes?: string; promoCode?: string; promoDiscount?: number }
) {
  const cart = getCart(chatId);
  if (cart.items.length === 0) {
    await ctx.reply("🛒 Your cart is empty\\! Use /order to add some items first\\.", { parse_mode: "MarkdownV2" });
    return;
  }

  // Decrement inventory stock for each item
  for (const item of cart.items) {
    decrementInventoryStock(item.productId, item.quantity);
  }

  const deliveryBoy = getRandomDeliveryBoy();
  const { distance, eta } = getRandomETA();
  const subtotal = getCartTotal(chatId);
  const { dealsText, discount } = applyDeals(chatId);
  const promoDiscount = details?.promoDiscount || 0;
  const totalDiscount = discount + promoDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);
  const orderId = `ORD-${Date.now().toString().slice(-5)}`;

  const orderLines = cart.items.map(i =>
    `  ${i.emoji} ${i.name}: ₹${i.price} × ${i.quantity} = ₹${i.price * i.quantity}`
  ).join('\n');

  const paymentText = paymentType === 'upi'
    ? `UPI (QR Code / ${SHOP.phone})`
    : `Cash on Delivery`;

  const customerName = details?.name || ctx.from?.first_name || "Valued Customer";
  const customerUser = ctx.from?.username;
  const profile = getOrCreateCustomer(chatId, customerName, customerUser, details?.phone);

  if (details?.name) profile.name = details.name;
  if (details?.phone) profile.phone = details.phone;
  if (details?.address) profile.location = details.address;

  recordCustomerOrder(chatId, {
    orderId,
    items: cart.items.map(i => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      emoji: i.emoji,
      quantity: i.quantity
    })),
    subtotal,
    discount: totalDiscount,
    totalCost: finalTotal,
    paymentMethod: paymentText,
    location: profile.location,
    deliveryStatus: 'Pending Claim ⏳',
    deliveryBoy: {
      name: "Assigning Partner...",
      phone: SHOP.phone
    },
    orderNotes: details?.notes || undefined,
    promoCode: details?.promoCode || undefined,
    promoDiscount: promoDiscount || undefined,
  });

  // Trigger Instant Broadcast to Delivery Agents
  broadcastOrderToDeliveryAgents({
    orderId,
    customerName: profile.name,
    customerType: profile.customerType,
    location: profile.location,
    items: cart.items,
    subtotal,
    discount: totalDiscount,
    totalCost: finalTotal,
    paymentMethod: paymentText,
  }).catch(err => console.warn("Broadcast error:", err));

  const promoLine = details?.promoCode
    ? `  🎟️ Promo Code: \`${details.promoCode}\` → −₹${promoDiscount}\n`
    : '';
  const notesLine = details?.notes
    ? `\n📝 *Delivery Notes:* _${details.notes}_\n`
    : '';

  const message =
    `✅ *Order Placed!* Order ID: \`${orderId}\`\n\n` +
    `👤 *Customer:* ${profile.name} (*${profile.customerType}*)\n` +
    `📍 *Delivery Address:* ${profile.location}\n` +
    `🪙 *Points Earned:* +${Math.floor(finalTotal / 10)} pts (Total: ${profile.loyaltyPoints + Math.floor(finalTotal / 10)})${notesLine}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🚚 *Delivery Partner:* 🔍 _Finding nearby partner (Ramesh / Suresh / Ankit)..._\n` +
    `  _You will receive a notification as soon as a partner claims your order!_\n\n` +
    `📍 *Delivery Info:*\n` +
    `  📏 Distance: *${distance} km*\n` +
    `  ⏱️ Estimated Time: *~${eta} mins*\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *Your Order:*\n${orderLines}\n\n` +
    `─────────────────\n` +
    `  Subtotal: ₹${subtotal}\n` +
    (discount > 0 ? `  Deals Discount: −₹${discount}\n` : '') +
    promoLine +
    `  💰 *Final Total: ₹${finalTotal}*\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Deals Applied:*\n${dealsText}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💳 Payment: *${paymentText}*\n\n` +
    `_Thank you for shopping with ${SHOP.name}!_ 🙏\n` +
    `❓ Help: /help | 👤 Profile: /profile | 🔄 Return: /refund`;

  await ctx.reply(message, { parse_mode: "Markdown" });

  if (paymentType === 'upi') {
    const upiPayload = `upi://pay?pa=${SHOP.upiId}&pn=${encodeURIComponent(SHOP.name)}&am=${finalTotal}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiPayload)}`;

    const qrCaption =
      `📸 *Scan & Pay via UPI (₹${finalTotal})*\n\n` +
      `▪ *Store:* ${SHOP.name}\n` +
      `▪ *Phone Number:* \`${SHOP.phone}\`\n` +
      `▪ *UPI ID:* \`${SHOP.upiId}\`\n` +
      `▪ *Total Amount:* *₹${finalTotal}*\n\n` +
      `📲 _Scan with Google Pay, PhonePe, Paytm, BHIM, or any UPI app._\n` +
      `_You can also pay the delivery partner on arrival._`;

    try {
      await ctx.replyWithPhoto(qrUrl, {
        caption: qrCaption,
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error("Failed to send QR code photo:", err);
      await ctx.reply(
        `📱 *UPI Payment Details:*\n` +
        `▪ Store: ${SHOP.name}\n` +
        `▪ Phone: \`${SHOP.phone}\`\n` +
        `▪ UPI ID: \`${SHOP.upiId}\`\n` +
        `▪ Total Amount: *₹${finalTotal}*`,
        { parse_mode: "Markdown" }
      );
    }
  }

  // Record purchased items for future refund eligibility
  recordPurchase(chatId, orderId, cart.items);

  clearCart(chatId);
}

// =============================================
// HELP MENU
// =============================================

async function showHelpMenu(ctx: any) {
  const kb = new InlineKeyboard();
  FAQS.forEach(f => kb.text(f.question, `faq_${f.id}`).row());
  kb.text("👤 My Profile & History", "view_profile")
    .text("📍 Update Address", "edit_location").row();
  kb.text("🎯 View Active Deals", "trigger_deals")
    .text("🔄 Request Refund", "request_refund").row();
  kb.text("📞 Contact Shop Directly", "contact_shop").row();

  await ctx.reply(
    `❓ *Help & Support — ${SHOP.name}*\n\nWhat can I help you with? Tap an option below:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

// =============================================
// CALLBACK QUERY HANDLERS
// =============================================

bot.callbackQuery(/^add_/, async (ctx) => {
  const productId = ctx.callbackQuery.data.replace('add_', '');
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) {
    await safeAnswer(ctx, { text: "Product not found!" });
    return;
  }

  const result = addToCart(ctx.chat!.id, product);
  if (!result.success) {
    await safeAnswer(ctx, { text: result.error || "Cannot add to cart!", show_alert: true });
    return;
  }

  await safeAnswer(ctx, { text: `✅ ${product.name} added!` });
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: buildProductKeyboard(ctx.chat!.id) });
  } catch (err: any) {
    if (!err?.message?.includes("message is not modified")) {
      console.warn("⚠️ Warning on editMessageReplyMarkup:", err.message);
    }
  }
});

bot.callbackQuery(/^outofstock_/, async (ctx) => {
  await safeAnswer(ctx, { text: "❌ This item is out of stock!", show_alert: true });
});

bot.callbackQuery("view_cart", async (ctx) => {
  await safeAnswer(ctx);
  const cart = getCart(ctx.chat!.id);
  if (cart.items.length > 0) {
    await ctx.reply(buildCartMessage(ctx.chat!.id), { parse_mode: "Markdown", reply_markup: buildCartWithControls(ctx.chat!.id) });
  } else {
    await ctx.reply(buildCartMessage(ctx.chat!.id), { parse_mode: "Markdown" });
  }
});

// Cart quantity controls
bot.callbackQuery(/^cart_inc_/, async (ctx) => {
  const productId = ctx.callbackQuery.data.replace('cart_inc_', '');
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) { await safeAnswer(ctx); return; }

  const result = addToCart(ctx.chat!.id, product);
  if (!result.success) {
    await safeAnswer(ctx, { text: result.error || "Cannot add more!", show_alert: true });
    return;
  }

  await safeAnswer(ctx, { text: `+1 ${product.name}` });
  try {
    await ctx.editMessageText(buildCartMessage(ctx.chat!.id), { parse_mode: "Markdown", reply_markup: buildCartWithControls(ctx.chat!.id) });
  } catch {}
});

bot.callbackQuery(/^cart_dec_/, async (ctx) => {
  const productId = ctx.callbackQuery.data.replace('cart_dec_', '');
  decrementFromCart(ctx.chat!.id, productId);
  await safeAnswer(ctx, { text: "−1 removed" });

  const cart = getCart(ctx.chat!.id);
  if (cart.items.length > 0) {
    try {
      await ctx.editMessageText(buildCartMessage(ctx.chat!.id), { parse_mode: "Markdown", reply_markup: buildCartWithControls(ctx.chat!.id) });
    } catch {}
  } else {
    try {
      await ctx.editMessageText("🛒 Your cart is now empty. Use /order to add items!");
    } catch {}
  }
});

bot.callbackQuery(/^cart_del_/, async (ctx) => {
  const productId = ctx.callbackQuery.data.replace('cart_del_', '');
  deleteFromCart(ctx.chat!.id, productId);
  await safeAnswer(ctx, { text: "🗑️ Item removed" });

  const cart = getCart(ctx.chat!.id);
  if (cart.items.length > 0) {
    try {
      await ctx.editMessageText(buildCartMessage(ctx.chat!.id), { parse_mode: "Markdown", reply_markup: buildCartWithControls(ctx.chat!.id) });
    } catch {}
  } else {
    try {
      await ctx.editMessageText("🛒 Your cart is now empty. Use /order to add items!");
    } catch {}
  }
});

bot.callbackQuery(/^cart_info_/, async (ctx) => {
  await safeAnswer(ctx);
  // Just an info button, do nothing
});

bot.callbackQuery("continue_shopping", async (ctx) => {
  await safeAnswer(ctx);
  await ctx.reply(
    `🛍️ *Product Catalog*\n\nBrowse by category or view all:`,
    { parse_mode: "Markdown", reply_markup: buildCategoryKeyboard() }
  );
});

bot.callbackQuery("clear_cart", async (ctx) => {
  clearCart(ctx.chat!.id);
  await safeAnswer(ctx, { text: "🗑️ Cart cleared!" });
  await ctx.reply("🗑️ Cart cleared! Use /order to start fresh.");
});

bot.callbackQuery("confirm_order", async (ctx) => {
  const cart = getCart(ctx.chat!.id);
  if (cart.items.length === 0) {
    await safeAnswer(ctx, { text: "Your cart is empty!" });
    return;
  }
  await safeAnswer(ctx);
  const kb = new InlineKeyboard()
    .text("💵 Cash on Delivery", "pay_cod").row()
    .text("📱 UPI", "pay_upi").row();
  await ctx.reply("💳 *Select Payment Method:*", { parse_mode: "Markdown", reply_markup: kb });
});

// ─── STEP-BY-STEP CHECKOUT FLOW (with notes + promo) ───

function startCheckoutFlow(chatId: number, ctx: any, paymentType: 'cod' | 'upi') {
  const profile = getOrCreateCustomer(chatId, ctx.from?.first_name || "Customer", ctx.from?.username);
  activeCheckoutSessions.set(chatId, {
    paymentType,
    step: 'NAME',
    tempName: profile.name && profile.name !== "Customer" ? profile.name : ctx.from?.first_name || "Customer",
    tempPhone: profile.phone || "",
    tempAddress: profile.location && !profile.location.includes("Default") ? profile.location : ""
  });
  return askCheckoutName(chatId, ctx);
}

async function askCheckoutName(chatId: number, ctx: any) {
  const session = activeCheckoutSessions.get(chatId);
  if (!session) return;
  session.step = 'NAME';

  const profile = getOrCreateCustomer(chatId, "Customer");
  const savedName = session.tempName || (profile.name !== "Customer" ? profile.name : ctx.from?.first_name || "Customer");

  const kb = new InlineKeyboard()
    .text(`✅ Use: "${savedName}"`, "chk_use_name").row()
    .text("❌ Cancel Checkout", "chk_cancel").row();

  await ctx.reply(
    `👤 *Step 1/5: Customer & Recipient Name*\n\n` +
    `Please confirm the name for this order.\n\n` +
    `Current Name: *${savedName}*\n\n` +
    `👉 Tap *Use "${savedName}"* or **type a new full name** below:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

async function askCheckoutPhone(chatId: number, ctx: any) {
  const session = activeCheckoutSessions.get(chatId);
  if (!session) return;
  session.step = 'PHONE';

  const profile = getOrCreateCustomer(chatId, "Customer");
  const savedPhone = session.tempPhone || profile.phone;

  const kb = new InlineKeyboard();
  if (savedPhone) {
    kb.text(`✅ Use Saved Phone: ${savedPhone}`, "chk_use_phone").row();
  }
  kb.text("⬅️ Back to Name", "chk_back_name")
    .text("❌ Cancel", "chk_cancel").row();

  await ctx.reply(
    `📱 *Step 2/5: Contact Phone Number*\n\n` +
    `Please provide your mobile number so our delivery partner can contact you when arriving at your location:\n\n` +
    (savedPhone
      ? `Saved Phone: \`${savedPhone}\`\n\n👉 Tap *Use Saved Phone* or **type a new mobile number** below (e.g. \`+91 98765 43210\`):`
      : `👉 Please **type your mobile / WhatsApp number** below (e.g. \`+91 98765 43210\`):`),
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

async function askCheckoutAddress(chatId: number, ctx: any) {
  const session = activeCheckoutSessions.get(chatId);
  if (!session) return;
  session.step = 'ADDRESS';

  const profile = getOrCreateCustomer(chatId, "Customer");
  const savedAddress = session.tempAddress || profile.location;
  const hasSaved = savedAddress && !savedAddress.includes("Default") && savedAddress !== "Not set";

  const kb = new InlineKeyboard();
  if (hasSaved) {
    kb.text(`✅ Use Saved: ${savedAddress.slice(0, 32)}${savedAddress.length > 32 ? '…' : ''}`, "chk_use_address").row();
  }
  kb.text("⬅️ Back to Phone", "chk_back_phone")
    .text("❌ Cancel", "chk_cancel").row();

  await ctx.reply(
    `📍 *Step 3/5: Delivery Address*\n\n` +
    `Where should we deliver your order in Bengaluru?\n\n` +
    (hasSaved
      ? `Saved Delivery Address:\n_${savedAddress}_\n\n👉 Tap *Use Saved* to deliver here, or **type your new complete address** below (flat/house no., street, landmark, city):`
      : `👉 Please **type your full delivery address** below (flat/house no., street, landmark, city):\n_Example: Flat 302, Palm Meadows, Whitefield, Bengaluru_`),
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

async function askCheckoutNotes(chatId: number, ctx: any) {
  const session = activeCheckoutSessions.get(chatId);
  if (!session) return;
  session.step = 'NOTES';

  const kb = new InlineKeyboard()
    .text("⏭️ Skip (No Notes)", "chk_skip_notes").row()
    .text("⬅️ Back to Address", "chk_back_address")
    .text("❌ Cancel", "chk_cancel").row();

  await ctx.reply(
    `📝 *Step 4/5: Delivery Notes & Instructions (Optional)*\n\n` +
    `Add any special instructions for the delivery partner:\n\n` +
    `💡 _Examples:_\n` +
    `▪ "Leave at the door"\n` +
    `▪ "Ring bell twice"\n` +
    `▪ "No plastic bags please"\n` +
    `▪ "Call before arriving"\n\n` +
    `👉 *Type your note below* or tap *Skip* if none:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

async function askCheckoutPromo(chatId: number, ctx: any) {
  const session = activeCheckoutSessions.get(chatId);
  if (!session) return;
  session.step = 'PROMO';

  const kb = new InlineKeyboard()
    .text("✅ Yes, I have a promo code", "chk_has_promo").row()
    .text("❌ No, skip promo code", "chk_skip_promo").row()
    .text("⬅️ Back to Notes", "chk_back_notes")
    .text("❌ Cancel", "chk_cancel").row();

  await ctx.reply(
    `🎟️ *Step 5/5: Apply Promo Code?*\n\n` +
    `Do you have a promo code or coupon to apply?\n\n` +
    `🏷️ *Available Promo Codes:*\n` +
    `▪ \`WELCOME50\` — ₹50 flat off\n` +
    `▪ \`OBSIDIAN20\` — 20% off (max ₹100)\n` +
    `▪ \`FREESHIP\` — ₹30 off\n` +
    `▪ \`DIWALI100\` — ₹100 off (min ₹500 cart)\n` +
    `▪ \`MEGA15\` — 15% off (max ₹75)\n\n` +
    `👉 Tap *Yes* to enter a code, or *No* to skip:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

async function showCheckoutReview(chatId: number, ctx: any) {
  const session = activeCheckoutSessions.get(chatId);
  if (!session) return;
  session.step = 'CONFIRM';

  const cart = getCart(chatId);
  if (cart.items.length === 0) {
    await ctx.reply("🛒 Your cart is empty! Use /order to start shopping.");
    activeCheckoutSessions.delete(chatId);
    return;
  }

  const subtotal = getCartTotal(chatId);
  const { dealsText, discount } = applyDeals(chatId);
  const promoDiscount = session.tempPromoDiscount || 0;
  const totalDiscount = discount + promoDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);

  const itemsSummary = cart.items.map(i =>
    `▪ ${i.emoji} *${i.name}* × ${i.quantity} → ₹${i.price * i.quantity}`
  ).join('\n');

  const payLabel = session.paymentType === 'cod'
    ? '💵 Cash on Delivery (COD)'
    : `📱 UPI Payment (${SHOP.upiId})`;

  const notesLine = session.tempNotes ? `📝 *Delivery Notes:* _${session.tempNotes}_\n` : '📝 *Delivery Notes:* _None_\n';
  const promoLine = session.tempPromoCode
    ? `🎟️ *Promo Code:* \`${session.tempPromoCode}\` → −₹${promoDiscount}\n`
    : '🎟️ *Promo Code:* _None applied_\n';

  const kb = new InlineKeyboard()
    .text(`✅ Confirm & Place Order (₹${finalTotal})`, "chk_place_order").row()
    .text("✏️ Edit Name", "chk_edit_name")
    .text("✏️ Edit Phone", "chk_edit_phone").row()
    .text("✏️ Edit Address", "chk_edit_address").row()
    .text("📝 Edit Notes", "chk_edit_notes")
    .text("🎟️ Change Promo", "chk_edit_promo").row()
    .text("❌ Cancel Order", "chk_cancel").row();

  const reviewMsg =
    `📋 *Order & Delivery Details Review*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Recipient Name:* *${session.tempName || "Customer"}*\n` +
    `📱 *Contact Phone:* \`${session.tempPhone || "Not set"}\`\n` +
    `📍 *Delivery Address:* _${session.tempAddress || "MG Road, Bengaluru"}_\n` +
    `💳 *Payment Mode:* *${payLabel}*\n` +
    notesLine +
    promoLine +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🛒 *Cart Items (${cart.items.length}):*\n${itemsSummary}\n\n` +
    `──────────────────────────\n` +
    `Subtotal: ₹${subtotal}\n` +
    (discount > 0 ? `🎯 Deals Discount: −₹${discount}\n` : '') +
    (promoDiscount > 0 ? `🎟️ Promo Discount: −₹${promoDiscount}\n` : '') +
    `💰 *Final Total Payable:* *₹${finalTotal}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👉 *Review your information above.* Tap *Confirm & Place Order* to proceed!`;

  await ctx.reply(reviewMsg, { parse_mode: "Markdown", reply_markup: kb });
}

// ─── CHECKOUT CALLBACK HANDLERS ───

bot.callbackQuery("pay_cod", async (ctx) => {
  await safeAnswer(ctx);
  await startCheckoutFlow(ctx.chat!.id, ctx, "cod");
});

bot.callbackQuery("pay_upi", async (ctx) => {
  await safeAnswer(ctx);
  await startCheckoutFlow(ctx.chat!.id, ctx, "upi");
});

bot.callbackQuery("chk_use_name", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeCheckoutSessions.get(ctx.chat!.id);
  if (!session) return;
  await askCheckoutPhone(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_use_phone", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeCheckoutSessions.get(ctx.chat!.id);
  if (!session) return;
  await askCheckoutAddress(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_use_address", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeCheckoutSessions.get(ctx.chat!.id);
  if (!session) return;
  await askCheckoutNotes(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_skip_notes", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeCheckoutSessions.get(ctx.chat!.id);
  if (!session) return;
  session.tempNotes = undefined;
  await askCheckoutPromo(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_has_promo", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeCheckoutSessions.get(ctx.chat!.id);
  if (!session) return;
  session.step = 'PROMO';
  await ctx.reply(
    `🎟️ *Enter Promo Code*\n\nPlease type your promo code below:`,
    { parse_mode: "Markdown" }
  );
});

bot.callbackQuery("chk_skip_promo", async (ctx) => {
  await safeAnswer(ctx);
  const session = activeCheckoutSessions.get(ctx.chat!.id);
  if (!session) return;
  session.tempPromoCode = undefined;
  session.tempPromoDiscount = 0;
  await showCheckoutReview(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_back_name", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutName(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_back_phone", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutPhone(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_back_address", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutAddress(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_back_notes", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutNotes(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_edit_name", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutName(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_edit_phone", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutPhone(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_edit_address", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutAddress(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_edit_notes", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutNotes(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_edit_promo", async (ctx) => {
  await safeAnswer(ctx);
  await askCheckoutPromo(ctx.chat!.id, ctx);
});

bot.callbackQuery("chk_cancel", async (ctx) => {
  await safeAnswer(ctx);
  activeCheckoutSessions.delete(ctx.chat!.id);
  await ctx.reply("❌ Order checkout cancelled. Your cart items are still saved — use /cart to review or resume.");
});

bot.callbackQuery("chk_place_order", async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const session = activeCheckoutSessions.get(chatId);
  if (!session) {
    await ctx.reply("⚠️ Checkout session expired. Please type /confirm to review your cart.");
    return;
  }
  const paymentType = session.paymentType;
  const details = {
    name: session.tempName,
    phone: session.tempPhone,
    address: session.tempAddress,
    notes: session.tempNotes,
    promoCode: session.tempPromoCode,
    promoDiscount: session.tempPromoDiscount,
  };
  activeCheckoutSessions.delete(chatId);

  if (paymentType === 'cod') {
    await ctx.reply("⏳ Placing your order with Cash on Delivery...");
  } else {
    await ctx.reply("⏳ Generating UPI QR & placing your order...");
  }

  await handleConfirmOrder(chatId, ctx, paymentType, details);
});

bot.callbackQuery("track_order", async (ctx) => {
  await safeAnswer(ctx);
  await showOrderTracking(ctx.chat!.id, ctx);
});

bot.callbackQuery(/^track_/, async (ctx) => {
  const orderId = ctx.callbackQuery.data.replace('track_', '');
  await safeAnswer(ctx, { text: "Refreshing order status..." });
  await showOrderTracking(ctx.chat!.id, ctx, orderId);
});

bot.callbackQuery(/^faq_/, async (ctx) => {
  const faqId = ctx.callbackQuery.data.replace('faq_', '');
  await safeAnswer(ctx);

  if (faqId === 'F01') {
    await showOrderTracking(ctx.chat!.id, ctx);
    return;
  }

  const faq = FAQS.find(f => f.id === faqId);
  if (!faq) return;

  const kb = new InlineKeyboard()
    .text("❓ Ask Another Question", "show_help").row()
    .text("📞 Contact Shop", "contact_shop").row();
  await ctx.reply(
    `${faq.question}\n\n${faq.answer}\n\n─────────────────\n_Was this helpful? If not, contact us below:_\n📞 ${SHOP.phone}`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery("show_help", async (ctx) => {
  await safeAnswer(ctx);
  await showHelpMenu(ctx);
});

bot.callbackQuery("contact_shop", async (ctx) => {
  await safeAnswer(ctx);
  await ctx.reply(
    `📞 *Contact ${SHOP.name}*\n\n` +
    `📱 Phone/WhatsApp: *${SHOP.phone}*\n` +
    `📍 Address: ${SHOP.address}\n` +
    `⏰ Hours: 9:00 AM – 9:00 PM\n\n` +
    `_Our team will be happy to assist you!_ 🙏`,
    { parse_mode: "Markdown" }
  );
});

// =============================================
// REFUND WORKFLOW HELPERS & HANDLERS
// =============================================

async function showRefundMenu(chatId: number, ctx: any) {
  const purchased = getPurchasedItems(chatId);
  if (purchased.length === 0) {
    await ctx.reply(
      `ℹ️ *No Eligible Items for Refund*\n\n` +
      `You haven't placed any orders yet or have no purchased items on record.\n\n` +
      `🛍️ Type /order to browse products and place an order!`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const kb = new InlineKeyboard();
  const recent = [...purchased].reverse().slice(0, 8);
  recent.forEach((item) => {
    kb.text(`${item.emoji} ${item.name} (₹${item.price}) [${item.orderId}]`, `refitem_${item.orderId}_${item.productId}`).row();
  });
  kb.text("❌ Cancel", "cancel_refund").row();

  await ctx.reply(
    `🔄 *Item Refund / Return Request*\n\n` +
    `Please select the item you actually purchased that you'd like to return or refund:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

async function finalizeRefund(chatId: number, ctx: any, proofType: string) {
  const session = activeRefundSessions.get(chatId);
  if (!session) return;

  const refundTicket = `REF-${Date.now().toString().slice(-5)}`;
  const item = session.item;

  const message =
    `✅ *Refund Request Submitted!* (Ticket: \`${refundTicket}\`)\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Item to Refund:* ${item.emoji} *${item.name}*\n` +
    `📋 *Order ID:* \`${item.orderId}\`\n` +
    `💰 *Refund Amount:* *₹${item.price}*\n` +
    `❓ *Reason:* ${session.reason}\n` +
    `📸 *Proof:* ${proofType}\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🕒 *Status:* Under Review by Store Manager\n` +
    `💳 *Refund Mode:* Direct UPI (${SHOP.upiId}) or Cash upon pickup\n\n` +
    `_Our team will review your proof and process your refund within 24 hours._\n` +
    `📞 Need direct assistance? Contact ${SHOP.phone}`;

  activeRefundSessions.delete(chatId);
  await ctx.reply(message, { parse_mode: "Markdown" });
}

bot.callbackQuery("request_refund", async (ctx) => {
  await safeAnswer(ctx);
  await showRefundMenu(ctx.chat!.id, ctx);
});

bot.callbackQuery(/^refitem_/, async (ctx) => {
  await safeAnswer(ctx);
  const data = ctx.callbackQuery.data.replace('refitem_', '');
  const parts = data.split('_');
  const orderId = parts[0];
  const productId = parts.slice(1).join('_');

  const purchased = getPurchasedItems(ctx.chat!.id);
  const item = purchased.find(p => p.orderId === orderId && p.productId === productId) || purchased.find(p => p.productId === productId);

  if (!item) {
    await ctx.reply("❌ Item not found in your purchase history. Use /refund to see eligible items.");
    return;
  }

  activeRefundSessions.set(ctx.chat!.id, {
    item,
    step: 'WAITING_FOR_REASON',
  });

  const kb = new InlineKeyboard()
    .text("📦 Damaged / Broken Item", "refreason_damaged").row()
    .text("❌ Wrong Item Delivered", "refreason_wrong").row()
    .text("⏳ Expired / Quality Issue", "refreason_quality").row()
    .text("⚠️ Missing from Package", "refreason_missing").row()
    .text("📝 Other Issue", "refreason_other").row()
    .text("🔙 Back to Purchases", "request_refund").row();

  await ctx.reply(
    `🔄 *Refund Request:* ${item.emoji} *${item.name}*\n` +
    `📋 *Order ID:* \`${item.orderId}\` | 💰 *Amount:* ₹${item.price}\n\n` +
    `❓ *Please select the reason for refunding:*`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery(/^refreason_/, async (ctx) => {
  await safeAnswer(ctx);
  const code = ctx.callbackQuery.data.replace('refreason_', '');
  const reasonText = REFUND_REASONS[code] || "General Issue";
  const session = activeRefundSessions.get(ctx.chat!.id);

  if (!session) {
    await ctx.reply("Session expired. Please type /refund to start again.");
    return;
  }

  session.reason = reasonText;
  session.step = 'WAITING_FOR_PROOF';

  const kb = new InlineKeyboard()
    .text("⏭️ Skip Photo & Submit", "refund_skip_photo").row()
    .text("❌ Cancel", "cancel_refund").row();

  await ctx.reply(
    `📸 *Submit Proof for Refund*\n\n` +
    `▪ *Item:* ${session.item.emoji} *${session.item.name}*\n` +
    `▪ *Reason:* *${session.reason}*\n\n` +
    `📷 *Please send a PHOTO of the item* (showing damage, expiry, or packaging) or type any explanation below.\n\n` +
    `_You can also tap below to submit without attaching a photo:_`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery("refund_skip_photo", async (ctx) => {
  await safeAnswer(ctx);
  await finalizeRefund(ctx.chat!.id, ctx, "No photo attached (Skipped)");
});

bot.callbackQuery("cancel_refund", async (ctx) => {
  activeRefundSessions.delete(ctx.chat!.id);
  await safeAnswer(ctx, { text: "Refund request cancelled." });
  await ctx.reply("❌ Refund request cancelled. Use /order to shop or /help for assistance.");
});

bot.callbackQuery(/^rateshop_/, async (ctx) => {
  await safeAnswer(ctx);
  const data = ctx.callbackQuery.data.replace('rateshop_', '');
  const parts = data.split('_');
  const orderId = parts[0];
  const rating = parseInt(parts[1], 10) || 5;

  recordShopRating(ctx.chat!.id, orderId, rating);

  const profile = getOrCreateCustomer(ctx.chat!.id, "Customer");
  const ord = profile.orders.find(o => o.orderId === orderId) || profile.orders[profile.orders.length - 1];
  const agentName = ord?.deliveryBoy?.name || "Delivery Partner";

  const kb = new InlineKeyboard()
    .text("⭐ 1", `ratedeliv_${orderId}_1`)
    .text("⭐⭐ 2", `ratedeliv_${orderId}_2`)
    .text("⭐⭐⭐ 3", `ratedeliv_${orderId}_3`)
    .text("⭐⭐⭐⭐ 4", `ratedeliv_${orderId}_4`)
    .text("⭐⭐⭐⭐⭐ 5", `ratedeliv_${orderId}_5`).row();

  await ctx.reply(
    `✅ *Store Rating Saved (${rating}/5 ⭐)*\n\n` +
    `🚚 *Rate Your Delivery Partner (${agentName}) (Step 2/2)*\n` +
    `How was the delivery partner's speed, communication, and packaging handoff?\n` +
    `Tap a star rating below (+10 loyalty points):`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery(/^ratedeliv_/, async (ctx) => {
  await safeAnswer(ctx);
  const data = ctx.callbackQuery.data.replace('ratedeliv_', '');
  const parts = data.split('_');
  const orderId = parts[0];
  const rating = parseInt(parts[1], 10) || 5;

  recordDeliveryRating(ctx.chat!.id, orderId, rating);
  activeFeedbackSessions.set(ctx.chat!.id, { orderId, rating });

  const stars = "⭐".repeat(rating);
  await ctx.reply(
    `🌟 *Thank you for rating both Store & Delivery Partner (${stars})!*\n\n` +
    `🎁 *+20 Total Bonus Loyalty Points* added to your profile!\n\n` +
    `💬 *Would you like to share any feedback or comments for the delivery partner or shop?*\n` +
    `Type your message below, or send /skip_feedback if done.`,
    { parse_mode: "Markdown" }
  );
});

bot.command("skip_feedback", async (ctx) => {
  activeFeedbackSessions.delete(ctx.chat.id);
  await ctx.reply("👍 Ratings saved! Thank you for choosing Obsidian Retail Store.");
});

bot.command("cancel_location", async (ctx) => {
  activeLocationSessions.delete(ctx.chat.id);
  await ctx.reply("❌ Location update cancelled.");
});

bot.on("message:photo", async (ctx) => {
  const session = activeRefundSessions.get(ctx.chat.id);
  if (session && session.step === 'WAITING_FOR_PROOF') {
    await finalizeRefund(ctx.chat.id, ctx, "Photo proof attached ✅");
  }
});

// =============================================
// TEXT MESSAGE HANDLER (all session-based inputs)
// =============================================

bot.on("message:text", async (ctx, next) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  // 1. Refund proof text
  const refundSession = activeRefundSessions.get(chatId);
  if (refundSession && refundSession.step === 'WAITING_FOR_PROOF') {
    if (!text.startsWith('/')) {
      await finalizeRefund(chatId, ctx, `Note: "${text}"`);
      return;
    }
  }

  // 2. Search input
  if (activeSearchSessions.has(chatId)) {
    if (!text.startsWith('/')) {
      await handleSearch(chatId, ctx, text.trim());
      return;
    } else {
      activeSearchSessions.delete(chatId);
    }
  }

  // 3. Phone update
  if (activePhoneSessions.has(chatId)) {
    if (text === '/cancel_location' || text === '/cancel') {
      activePhoneSessions.delete(chatId);
      await ctx.reply("❌ Phone update cancelled.");
      return;
    }
    if (!text.startsWith('/')) {
      const profile = updateCustomerPhone(chatId, text.trim());
      activePhoneSessions.delete(chatId);
      await ctx.reply(
        `✅ *Phone Number Updated & Saved to Parquet!*\n\n` +
        `📱 *Contact Phone:* \`${profile.phone}\`\n\n` +
        `📊 *Status:* Your profile and Parquet customer dataset have been updated.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
  }

  // 4. Name update
  if (activeNameSessions.has(chatId)) {
    if (text === '/cancel_location' || text === '/cancel') {
      activeNameSessions.delete(chatId);
      await ctx.reply("❌ Name update cancelled.");
      return;
    }
    if (!text.startsWith('/')) {
      const profile = updateCustomerName(chatId, text.trim());
      activeNameSessions.delete(chatId);
      await ctx.reply(
        `✅ *Name Updated & Saved to Parquet!*\n\n` +
        `👤 *Name:* ${profile.name}\n\n` +
        `📊 *Status:* Your profile and Parquet customer dataset have been updated.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
  }

  // 5. Location update
  if (activeLocationSessions.has(chatId)) {
    if (text === '/cancel_location' || text === '/cancel') {
      activeLocationSessions.delete(chatId);
      await ctx.reply("❌ Location update cancelled.");
      return;
    }
    if (!text.startsWith('/')) {
      const profile = updateCustomerLocation(chatId, text.trim());
      activeLocationSessions.delete(chatId);
      await ctx.reply(
        `✅ *Delivery Address Updated & Saved to Parquet!*\n\n` +
        `📍 *New Address:* ${profile.location}\n\n` +
        `📊 *Status:* Parquet dataset synchronized. All future orders will be delivered here.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
  }

  // 6. Checkout step-by-step responses (Name -> Phone -> Address -> Notes -> Promo -> Review)
  const checkoutSession = activeCheckoutSessions.get(chatId);
  if (checkoutSession && !text.startsWith('/')) {
    if (checkoutSession.step === 'NAME') {
      checkoutSession.tempName = text.trim();
      updateCustomerName(chatId, text.trim());
      await askCheckoutPhone(chatId, ctx);
      return;
    }
    if (checkoutSession.step === 'PHONE') {
      checkoutSession.tempPhone = text.trim();
      updateCustomerPhone(chatId, text.trim());
      await askCheckoutAddress(chatId, ctx);
      return;
    }
    if (checkoutSession.step === 'ADDRESS') {
      checkoutSession.tempAddress = text.trim();
      updateCustomerLocation(chatId, text.trim());
      await askCheckoutNotes(chatId, ctx);
      return;
    }
    if (checkoutSession.step === 'NOTES') {
      checkoutSession.tempNotes = text.trim();
      await askCheckoutPromo(chatId, ctx);
      return;
    }
    if (checkoutSession.step === 'PROMO') {
      // Validate promo code
      const cartTotal = getCartTotal(chatId);
      const { dealsText, discount: dealsDiscount } = applyDeals(chatId);
      const effectiveTotal = cartTotal - dealsDiscount;
      const result = applyPromoCode(text.trim(), effectiveTotal);

      if (result.valid) {
        checkoutSession.tempPromoCode = result.promo!.code;
        checkoutSession.tempPromoDiscount = result.discount;

        await ctx.reply(
          `✅ *Promo Code Applied!*\n\n` +
          `${result.promo!.emoji} *${result.promo!.code}*: ${result.promo!.description}\n` +
          `💸 *Promo Discount:* −₹${result.discount}\n\n` +
          `_Proceeding to order review..._`,
          { parse_mode: "Markdown" }
        );
        await showCheckoutReview(chatId, ctx);
      } else {
        const kb = new InlineKeyboard()
          .text("🔄 Try Another Code", "chk_has_promo").row()
          .text("❌ Skip Promo Code", "chk_skip_promo").row();

        await ctx.reply(
          `${result.error}\n\nTap *Try Another Code* or *Skip*:`,
          { parse_mode: "Markdown", reply_markup: kb }
        );
      }
      return;
    }
  }

  // 7. Feedback / Review comment
  const feedbackSession = activeFeedbackSessions.get(chatId);
  if (feedbackSession) {
    if (text === '/skip_feedback') {
      activeFeedbackSessions.delete(chatId);
      await ctx.reply("👍 Feedback recorded! Thank you for shopping with us.");
      return;
    }
    if (!text.startsWith('/')) {
      recordDeliveryRating(chatId, feedbackSession.orderId, feedbackSession.rating, text.trim());
      recordShopRating(chatId, feedbackSession.orderId, feedbackSession.rating, text.trim());
      activeFeedbackSessions.delete(chatId);
      await ctx.reply(
        `🙏 *Review Received!*\n\n` +
        `Thank you for sharing your feedback: _"${text.trim()}"_\n` +
        `Your review has been shared with the store manager & delivery partner!`,
        { parse_mode: "Markdown" }
      );
      return;
    }
  }

  await next();
});

// =============================================
// HELPER: safe answerCallbackQuery
// =============================================
async function safeAnswer(ctx: any, opts?: { text?: string; show_alert?: boolean }) {
  try {
    await ctx.answerCallbackQuery(opts ?? {});
  } catch (err: any) {
    if (!err?.message?.includes("query is too old") && !err?.message?.includes("query ID is invalid")) {
      console.warn("⚠️ answerCallbackQuery failed:", err.message);
    }
  }
}

// =============================================
// ERROR HANDLING & START
// =============================================
bot.catch((err) => {
  const e = err.error;
  const msg = e instanceof Error ? e.message : String(e);
  const harmless = [
    "message is not modified",
    "query is too old",
    "query ID is invalid",
  ];
  if (harmless.some(h => msg.includes(h))) return;
  console.error(`❌ Error on update ${err.ctx.update.update_id}: ${msg}`);
});

bot.start({
  onStart: async () => {
    console.log("🤖 VyaparSync Bot is running... Press Ctrl+C to stop.");
    try {
      await sendStartupWelcome();
    } catch (error) {
      console.error("❌ Failed to send startup welcome:", error);
    }
  },
});
