import "dotenv/config";
import { Bot, InlineKeyboard, Api } from "grammy";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// =============================================
// PATHS
// =============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENTS_JSON = path.join(__dirname, "agents.json");
const PYTHON_PATH = "C:/Users/KIIT/AppData/Local/Python/bin/python.exe";
const PARQUET_READER = path.join(__dirname, "parquet_reader.py");

// =============================================
// DELIVERY AGENTS (Roster)
// =============================================
const AGENTS = [
  { name: "Ramesh Kumar", phone: "+919988776655", vehicleNumber: "KA01 AB 1234", vehicleType: "Bike 🏍️" },
  { name: "Suresh Singh", phone: "+919988771122", vehicleNumber: "KA03 CD 5678", vehicleType: "Bike 🏍️" },
  { name: "Ankit Rao", phone: "+919977665544", vehicleNumber: "KA05 EF 9012", vehicleType: "Scooter 🛵" },
];

// =============================================
// TYPES
// =============================================
interface AgentSession {
  chatId: number;
  agentName: string;
  agentPhone: string;
  vehicleNumber: string;
  vehicleType: string;
}

interface AgentStore {
  [chatId: string]: AgentSession;
}

// =============================================
// AGENT SESSIONS
// =============================================
function loadAgents(): AgentStore {
  if (!fs.existsSync(AGENTS_JSON)) return {};
  try { return JSON.parse(fs.readFileSync(AGENTS_JSON, "utf8")); } catch { return {}; }
}
function saveAgents(data: AgentStore) {
  fs.writeFileSync(AGENTS_JSON, JSON.stringify(data, null, 2));
}

function getPythonCmd(): string {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const defaultWinPython = "C:/Users/KIIT/AppData/Local/Python/bin/python.exe";
  if (fs.existsSync(defaultWinPython)) {
    return defaultWinPython;
  }
  return "py";
}

// =============================================
// PARQUET DATA BRIDGE
// =============================================
function fetchOrdersFromParquet(agentName?: string): any[] {
  try {
    const py = getPythonCmd();
    const cmd = py.includes("/") || py.includes("\\")
      ? `powershell -Command "& '${py}' '${PARQUET_READER}' orders ${agentName ? `'${agentName}'` : "''"}"`
      : `${py} "${PARQUET_READER}" orders ${agentName ? `"${agentName}"` : ""}`;
    const output = execSync(cmd, { encoding: "utf8", timeout: 10000 });
    return JSON.parse(output.trim() || "[]");
  } catch (err: any) {
    console.warn("⚠️ Parquet reader fallback:", err.message);
    return [];
  }
}

function fetchCustomerProfileFromParquet(chatId: string | number): any {
  try {
    const py = getPythonCmd();
    const cmd = py.includes("/") || py.includes("\\")
      ? `powershell -Command "& '${py}' '${PARQUET_READER}' profile '${chatId}'"`
      : `${py} "${PARQUET_READER}" profile "${chatId}"`;
    const output = execSync(cmd, { encoding: "utf8", timeout: 10000 });
    const clean = output.trim();
    if (!clean) return null;
    return JSON.parse(clean);
  } catch (err: any) {
    console.warn("⚠️ Parquet profile error:", err.message);
    // Direct JSON fallback if parquet read fails
    try {
      const custFile = path.join(__dirname, "..", "telegram-bot-customer", "customers.json");
      if (fs.existsSync(custFile)) {
        const raw = JSON.parse(fs.readFileSync(custFile, "utf8"));
        const cust = raw.find((c: any) => String(c.chatId) === String(chatId));
        if (cust) {
          return {
            profile: {
              customer_chat_id: cust.chatId,
              customer_name: cust.name,
              customer_username: cust.username || "",
              customer_phone: cust.phone || "",
              customer_type: cust.customerType,
              loyalty_points: cust.loyaltyPoints,
              customer_location: cust.location,
              first_seen: cust.firstSeen,
              last_seen: cust.lastSeen,
              total_orders: cust.totalOrders,
              total_spent: cust.totalSpent
            },
            orders: cust.orders || []
          };
        }
      }
    } catch {}
    return null;
  }
}

function updateOrderStatusInParquet(orderId: string, status: string): boolean {
  try {
    const py = getPythonCmd();
    const cmd = py.includes("/") || py.includes("\\")
      ? `powershell -Command "& '${py}' '${PARQUET_READER}' update_status '${orderId}' '${status}'"`
      : `${py} "${PARQUET_READER}" update_status "${orderId}" "${status}"`;
    const output = execSync(cmd, { encoding: "utf8", timeout: 10000 });
    const res = JSON.parse(output.trim() || "{}");
    return !!res.success;
  } catch (err: any) {
    console.warn("⚠️ Parquet status update error:", err.message);
    return false;
  }
}

function claimOrderInParquet(orderId: string, agentName: string, agentPhone: string): any {
  try {
    const py = getPythonCmd();
    const cmd = py.includes("/") || py.includes("\\")
      ? `powershell -Command "& '${py}' '${PARQUET_READER}' claim '${orderId}' '${agentName}' '${agentPhone}'"`
      : `${py} "${PARQUET_READER}" claim "${orderId}" "${agentName}" "${agentPhone}"`;
    const output = execSync(cmd, { encoding: "utf8", timeout: 10000 });
    return JSON.parse(output.trim() || "{}");
  } catch (err: any) {
    console.warn("⚠️ Parquet claim error:", err.message);
    return { success: false, error: err.message };
  }
}

// =============================================
// FORMATTING HELPERS
// =============================================
function starsStr(n: number) {
  return "⭐".repeat(Math.min(5, Math.max(1, Math.round(n)))) + "☆".repeat(Math.max(0, 5 - Math.min(5, Math.max(1, Math.round(n)))));
}

function formatOrderCard(order: any): string {
  const isDelivered = order.delivery_status === "Delivered ✅" || order.delivery_status === "Delivered";
  const isOut = order.delivery_status === "Out for Delivery 🚀";
  const statusEmoji = isDelivered ? "✅" : isOut ? "🚀" : "📦";
  
  const paymentDesc = String(order.payment_method || "").toLowerCase().includes("upi")
    ? "📱 UPI (Prepaid) — No cash collection needed"
    : `💵 Cash on Delivery — Collect ₹${order.total_cost}`;
  const notesLine = order.order_notes ? `\n📝 *Customer Instructions:* _"${order.order_notes}"_\n` : "";
  const promoLine = order.promo_code_applied ? ` (Promo \`${order.promo_code_applied}\` applied)` : "";

  return (
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *Order:* \`${order.order_id}\`\n` +
    `🕒 *Time:* ${order.order_timestamp || "Just now"}\n` +
    `${statusEmoji} *Delivery Status:* *${order.delivery_status || "Assigned"}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Customer Profile Data (Parquet):*\n` +
    `▪ *Name:* *${order.customer_name || "Valued Customer"}*\n` +
    `▪ *Customer Tier:* *${order.customer_type || "New Customer 🌱"}*\n` +
    `▪ *Total Orders Placed:* ${order.total_orders || 1}\n` +
    `▪ *Loyalty Tier Points:* ${order.loyalty_points || 0} pts\n` +
    `▪ *📍 Delivery Address:* ${order.customer_location || "Not specified"}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *Items (${order.items_count || 1}):*\n` +
    `  ${order.items_summary || "Products in cart"}\n\n` +
    `💰 *Bill Amount:* *₹${order.total_cost}* (Subtotal: ₹${order.subtotal}${order.discount > 0 ? `, Discount: -₹${order.discount}` : ""}${promoLine})\n` +
    `💳 *Payment:* ${paymentDesc}\n` +
    notesLine +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );
}

// =============================================
// BOT SETUP
// =============================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new Bot(TOKEN);
const sessions = loadAgents();

async function safeAnswer(ctx: any, opts?: { text?: string; show_alert?: boolean }) {
  try { await ctx.answerCallbackQuery(opts ?? {}); } catch {}
}

// Customer notification helper — sends updates directly into the customer's store chat
function getCustomerBotApi(): Api | null {
  try {
    const custEnvPath = path.join(__dirname, '..', 'telegram-bot-customer', '.env');
    if (fs.existsSync(custEnvPath)) {
      const content = fs.readFileSync(custEnvPath, 'utf8');
      const match = content.match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
      if (match && match[1] && !match[1].includes('PASTE_')) {
        return new Api(match[1].trim());
      }
    }
  } catch {}
  return null;
}

const customerApi = getCustomerBotApi();

async function notifyCustomer(customerChatId: number | string, message: string, replyMarkup?: InlineKeyboard) {
  if (!customerChatId) return;
  
  // Try sending via customer bot first (where customer placed the order)
  if (customerApi) {
    try {
      await customerApi.sendMessage(customerChatId, message, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup
      });
      console.log(`📨 Sent customer update to chat ${customerChatId} via Customer Bot`);
      return;
    } catch (err: any) {
      console.warn(`⚠️ Customer bot dispatch fallback:`, err.message);
    }
  }

  // Fallback to delivery bot
  try {
    await bot.api.sendMessage(customerChatId, message, {
      parse_mode: "Markdown",
      reply_markup: replyMarkup
    });
    console.log(`📨 Sent customer update to chat ${customerChatId} via Delivery Bot`);
  } catch (err: any) {
    console.warn(`⚠️ Could not send notification to customer ${customerChatId}:`, err.message);
  }
}

function mainMenu() {
  return new InlineKeyboard()
    .text("🚨 Available Orders Pool (Take Order)", "cmd_pool").row()
    .text("📦 My Active Deliveries", "cmd_active").row()
    .text("📜 All Assigned Deliveries", "cmd_all").row()
    .text("⭐ Customer Ratings & Reviews", "cmd_ratings").row()
    .text("👤 My Agent Profile", "cmd_profile").row();
}

// =============================================
// /start — AGENT ONBOARDING & WELCOME
// =============================================
bot.command("start", async (ctx) => {
  const chatId = ctx.chat.id;
  const existing = sessions[String(chatId)];

  if (existing) {
    const orders = fetchOrdersFromParquet(existing.agentName);
    const active = orders.filter(o => o.delivery_status !== "Delivered ✅" && o.delivery_status !== "Delivered" && o.order_id).length;
    await ctx.reply(
      `👋 Welcome back, *${existing.agentName}*!\n\n` +
      `🚗 *Vehicle:* ${existing.vehicleType} | ${existing.vehicleNumber}\n` +
      `📞 *Phone:* ${existing.agentPhone}\n` +
      `📦 *Active Deliveries:* *${active}*\n\n` +
      `⚡ _Instant order broadcast & live customer delivery notifications are active._\n\n` +
      `Select an option below to manage your deliveries:`,
      { parse_mode: "Markdown", reply_markup: mainMenu() }
    );
    return;
  }

  const kb = new InlineKeyboard();
  AGENTS.forEach((a, i) => kb.text(`${a.vehicleType} ${a.name}`, `login_${i}`).row());

  await ctx.reply(
    `🚴 *VyaparSync Delivery Agent Bot*\n\n` +
    `Welcome! Please select your delivery partner profile to get started:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

// =============================================
// LOGIN CALLBACK
// =============================================
bot.callbackQuery(/^login_(\d+)$/, async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const idx = parseInt(ctx.match[1], 10);
  const agent = AGENTS[idx];
  if (!agent) return;

  sessions[String(chatId)] = {
    chatId,
    agentName: agent.name,
    agentPhone: agent.phone,
    vehicleNumber: agent.vehicleNumber,
    vehicleType: agent.vehicleType,
  };
  saveAgents(sessions);

  await ctx.editMessageText(
    `✅ *Logged in successfully as ${agent.name}!*\n\n` +
    `🚗 *Vehicle:* ${agent.vehicleType} (${agent.vehicleNumber})\n` +
    `📞 *Contact:* ${agent.phone}\n\n` +
    `You are now connected to the store dispatch system. You can now claim available orders, start deliveries, and mark orders as delivered!`,
    { parse_mode: "Markdown", reply_markup: mainMenu() }
  );
});

// =============================================
// AVAILABLE ORDERS POOL (Claim / Taken)
// =============================================
bot.callbackQuery("cmd_pool", async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const session = sessions[String(chatId)];
  if (!session) { await loginPrompt(ctx); return; }

  const all = fetchOrdersFromParquet();
  // Find orders that are unassigned or assigned to nobody / pending claim
  const available = all.filter(o =>
    o.order_id &&
    (!o.delivery_partner_name || o.delivery_status === "Pending Claim ⏳" || o.delivery_status === "Unassigned") &&
    o.delivery_status !== "Delivered ✅" && o.delivery_status !== "Delivered"
  );

  if (available.length === 0) {
    await ctx.reply(
      `🎉 *No unclaimed orders waiting in the pool!*\n\nAll current orders have already been claimed by delivery partners. Use *My Active Deliveries* to view your assigned orders.`,
      { parse_mode: "Markdown", reply_markup: mainMenu() }
    );
    return;
  }

  for (const order of available) {
    const kb = new InlineKeyboard()
      .text("✋ Taken (Claim This Order)", `take_order_${order.order_id}`).row()
      .text(`👤 View ${order.customer_name}'s Profile`, `view_cust_${order.customer_chat_id}`).row();

    await ctx.reply(
      `🚨 *NEW ORDER READY FOR PICKUP!*\n\n` +
      formatOrderCard(order) +
      `\n\n👇 _Tap Taken to claim this delivery:_`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
  }
});

// =============================================
// TAKE ORDER (CLAIM) CALLBACK
// =============================================
bot.callbackQuery(/^take_order_(.+)$/, async (ctx) => {
  const orderId = ctx.match[1];
  const chatId = ctx.chat!.id;
  const session = sessions[String(chatId)];
  if (!session) { await safeAnswer(ctx); await loginPrompt(ctx); return; }

  const claimRes = claimOrderInParquet(orderId, session.agentName, session.agentPhone);

  if (!claimRes.success) {
    await safeAnswer(ctx, { text: `⚠️ ${claimRes.error || "Order already taken!"}`, show_alert: true });
    return;
  }

  await safeAnswer(ctx, { text: `✅ You took order ${orderId}!` });

  const kb = new InlineKeyboard()
    .text("🚀 Start Delivery", `start_delivery_${orderId}`).row()
    .text("✅ Mark as Delivered", `mark_delivered_${orderId}`).row()
    .text("👤 Customer Profile", `view_cust_${claimRes.customer_chat_id}`).row();

  await ctx.reply(
    `✅ *Order \`${orderId}\` CLAIMED by ${session.agentName}!*\n\n` +
    `You are now assigned to this delivery. Head to the store for pickup.\n\n` +
    `When you are on your way, click *Start Delivery*. When delivered to customer, click *Mark as Delivered*.`,
    { parse_mode: "Markdown", reply_markup: kb }
  );

  // Notify customer immediately on spot!
  if (claimRes.customer_chat_id) {
    await notifyCustomer(
      claimRes.customer_chat_id,
      `🚚 *Delivery Partner Assigned!*\n\n` +
      `Great news! Delivery partner *${session.agentName}* (${session.vehicleType} | \`${session.vehicleNumber}\`, 📞 \`${session.agentPhone}\`) has accepted your order \`${orderId}\`!\n\n` +
      `Your items are being packed and will be dispatched shortly.`
    );
  }
});

// =============================================
// ACTIVE DELIVERIES
// =============================================
bot.callbackQuery("cmd_active", async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const session = sessions[String(chatId)];
  if (!session) { await loginPrompt(ctx); return; }

  const all = fetchOrdersFromParquet(session.agentName);
  const pending = all.filter(o => o.delivery_status !== "Delivered ✅" && o.delivery_status !== "Delivered" && o.order_id);

  if (pending.length === 0) {
    await ctx.reply(
      `🎉 *No active deliveries in your queue!*\n\nCheck *Available Orders Pool* to take new customer orders.`,
      { parse_mode: "Markdown", reply_markup: mainMenu() }
    );
    return;
  }

  for (const order of pending) {
    const isOut = order.delivery_status === "Out for Delivery 🚀";
    const kb = new InlineKeyboard();
    if (isOut) {
      kb.text("✅ Mark as Delivered", `mark_delivered_${order.order_id}`).row();
    } else {
      kb.text("🚀 Start Delivery", `start_delivery_${order.order_id}`).row();
    }
    kb.text(`👤 View ${order.customer_name}'s Full Profile`, `view_cust_${order.customer_chat_id}`).row();

    await ctx.reply(formatOrderCard(order), { parse_mode: "Markdown", reply_markup: kb });
  }
});

// =============================================
// VIEW CUSTOMER PROFILE FROM PARQUET
// =============================================
bot.callbackQuery(/^view_cust_(\d+)$/, async (ctx) => {
  await safeAnswer(ctx);
  const targetChatId = ctx.match[1];
  const data = fetchCustomerProfileFromParquet(targetChatId);

  if (!data || !data.profile) {
    await ctx.reply("ℹ️ Customer profile data not found in parquet file.", { reply_markup: mainMenu() });
    return;
  }

  const p = data.profile;
  const orders = data.orders || [];
  const validOrders = orders.filter((o: any) => o.order_id);

  const profileText =
    `👤 *Customer Profile Card (Extracted from Parquet)*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `▪ *Name:* *${p.customer_name}* ${p.customer_username ? `(@${p.customer_username})` : ""}\n` +
    `▪ *Customer Segment:* *${p.customer_type}*\n` +
    `▪ *Total Orders:* *${p.total_orders}*\n` +
    `▪ *Total Lifetime Spent:* *₹${p.total_spent}*\n` +
    `▪ *Loyalty Points:* *${p.loyalty_points} pts*\n` +
    `▪ *Registered Location:* ${p.customer_location || "Not set"}\n` +
    `▪ *First Seen:* ${p.first_seen || "N/A"}\n` +
    `▪ *Last Active:* ${p.last_seen || "N/A"}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Order History (${validOrders.length} records):*\n` +
    validOrders.slice(-3).map((o: any) => `▪ \`${o.order_id}\` (${o.order_timestamp}) → ₹${o.total_cost} [${o.delivery_status}]`).join("\n") +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.reply(profileText, { parse_mode: "Markdown", reply_markup: mainMenu() });
});

// =============================================
// START DELIVERY & MARK DELIVERED
// =============================================
bot.callbackQuery(/^start_delivery_(.+)$/, async (ctx) => {
  await safeAnswer(ctx);
  const orderId = ctx.match[1];
  const session = sessions[String(ctx.chat!.id)];
  updateOrderStatusInParquet(orderId, "Out for Delivery 🚀");

  await ctx.reply(
    `🚀 *Order \`${orderId}\` is now OUT FOR DELIVERY!*\n\nThe customer has been notified that you are on your way with their package.`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text("✅ Mark as Delivered", `mark_delivered_${orderId}`)
    }
  );

  // Find customer chat ID to notify
  const all = fetchOrdersFromParquet();
  const order = all.find(o => o.order_id === orderId);
  if (order && order.customer_chat_id) {
    await notifyCustomer(
      order.customer_chat_id,
      `🚀 *Your Order is Out for Delivery!*\n\n` +
      `Delivery partner *${session?.agentName || "Partner"}* is on the way to your address with order \`${orderId}\`!\n` +
      `📍 *Delivering to:* ${order.customer_location || "Your address"}\n` +
      `📞 Delivery Contact: \`${session?.agentPhone || ""}\``
    );
  }
});

bot.callbackQuery(/^mark_delivered_(.+)$/, async (ctx) => {
  await safeAnswer(ctx);
  const orderId = ctx.match[1];
  const session = sessions[String(ctx.chat!.id)];
  updateOrderStatusInParquet(orderId, "Delivered ✅");

  await ctx.reply(
    `✅ *Order \`${orderId}\` marked as DELIVERED!*\n\n` +
    `Great job! The delivery confirmation and rating survey have been sent to the customer.`,
    { parse_mode: "Markdown", reply_markup: mainMenu() }
  );

  // Find customer to notify & prompt for ratings!
  const all = fetchOrdersFromParquet();
  const order = all.find(o => o.order_id === orderId);
  if (order && order.customer_chat_id) {
    const ratingKb = new InlineKeyboard()
      .text("⭐ 1", `rateshop_${orderId}_1`)
      .text("⭐⭐ 2", `rateshop_${orderId}_2`)
      .text("⭐⭐⭐ 3", `rateshop_${orderId}_3`)
      .text("⭐⭐⭐⭐ 4", `rateshop_${orderId}_4`)
      .text("⭐⭐⭐⭐⭐ 5", `rateshop_${orderId}_5`).row();

    await notifyCustomer(
      order.customer_chat_id,
      `🎉 *Order Delivered!*\n\n` +
      `Your order \`${orderId}\` has been successfully delivered by *${session?.agentName || "our delivery partner"}*!\n\n` +
      `🙏 Thank you for shopping with *Obsidian Retail Store*!\n\n` +
      `🌟 *How was your product and delivery experience?*\n` +
      `Tap a rating below to earn *+20 Bonus Loyalty Points*:`,
      ratingKb
    );
  }
});

// =============================================
// ALL DELIVERIES
// =============================================
bot.callbackQuery("cmd_all", async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const session = sessions[String(chatId)];
  if (!session) { await loginPrompt(ctx); return; }

  const all = fetchOrdersFromParquet(session.agentName).filter(o => o.order_id);
  if (all.length === 0) {
    await ctx.reply("📭 No deliveries assigned to you yet in the dataset.", { reply_markup: mainMenu() });
    return;
  }

  const delivered = all.filter(o => o.delivery_status === "Delivered ✅" || o.delivery_status === "Delivered");
  const pending = all.filter(o => o.delivery_status !== "Delivered ✅" && o.delivery_status !== "Delivered");

  let summary =
    `📋 *Delivery Portfolio — ${session.agentName}*\n\n` +
    `✅ Completed Deliveries: *${delivered.length}*\n` +
    `📦 Active / Pending: *${pending.length}*\n` +
    `📊 Total Handled: *${all.length}*\n\n` +
    `*Recent Orders:*\n`;

  const recent = [...all].reverse().slice(0, 5);
  for (const o of recent) {
    const icon = (o.delivery_status === "Delivered ✅" || o.delivery_status === "Delivered") ? "✅" : "🚀";
    summary += `${icon} \`${o.order_id}\` — *${o.customer_name}* (₹${o.total_cost}) — _${o.delivery_status}_\n`;
  }

  await ctx.reply(summary, { parse_mode: "Markdown", reply_markup: mainMenu() });
});

// =============================================
// RATINGS & REVIEWS
// =============================================
bot.callbackQuery("cmd_ratings", async (ctx) => {
  await safeAnswer(ctx);
  const chatId = ctx.chat!.id;
  const session = sessions[String(chatId)];
  if (!session) { await loginPrompt(ctx); return; }

  const all = fetchOrdersFromParquet(session.agentName);
  const rated = all.filter(o => o.delivery_rating != null && o.delivery_rating !== "" && o.delivery_rating > 0);

  if (rated.length === 0) {
    await ctx.reply(
      `⭐ *Customer Ratings & Reviews*\n\n` +
      `No customer ratings recorded for ${session.agentName} yet.\n` +
      `Keep delivering with care — ratings will appear here as customers rate your service!`,
      { parse_mode: "Markdown", reply_markup: mainMenu() }
    );
    return;
  }

  const avg = rated.reduce((sum, r) => sum + Number(r.delivery_rating), 0) / rated.length;
  let text =
    `⭐ *Delivery Performance & Customer Ratings*\n\n` +
    `👤 *Agent:* ${session.agentName}\n` +
    `📊 *Average Rating:* *${avg.toFixed(1)} / 5.0* ${starsStr(avg)}\n` +
    `🗳️ *Total Customer Reviews:* *${rated.length}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const r of [...rated].reverse()) {
    text += `📦 *Order:* \`${r.order_id}\` — ${starsStr(r.delivery_rating)} (*${r.delivery_rating}/5*)\n`;
    text += `👤 *Customer:* ${r.customer_name} | 🕒 ${r.order_timestamp || "Recent"}\n`;
    if (r.delivery_feedback) {
      text += `💬 *Customer Note:* _"${r.delivery_feedback}"_\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: mainMenu() });
});

// =============================================
// AGENT ROSTER & ALPHABETICAL PROFILES
// =============================================

function getAllAgentsAlphabetical(): { name: string; phone: string; vehicleNumber: string; vehicleType: string }[] {
  const map = new Map<string, { name: string; phone: string; vehicleNumber: string; vehicleType: string }>();

  // 1. Add predefined roster agents
  for (const a of AGENTS) {
    map.set(a.name.toLowerCase(), a);
  }

  // 2. Add any registered agents from agents.json
  const store = loadAgents();
  for (const session of Object.values(store)) {
    if (session.agentName) {
      const key = session.agentName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: session.agentName,
          phone: session.agentPhone,
          vehicleNumber: session.vehicleNumber || "KA01 AB 1234",
          vehicleType: session.vehicleType || "Bike 🏍️"
        });
      }
    }
  }

  // 3. Sort strictly in alphabetical order by name
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function showAgentRoster(ctx: any) {
  const agents = getAllAgentsAlphabetical();
  const session = sessions[String(ctx.chat!.id)];

  const kb = new InlineKeyboard();
  agents.forEach((agent) => {
    const isYou = session && session.agentName.toLowerCase() === agent.name.toLowerCase();
    const label = isYou
      ? `👤 ${agent.name} (You ✅)`
      : `👤 ${agent.name} — ${agent.vehicleType}`;
    kb.text(label, `view_agent_${agent.name}`).row();
  });
  kb.text("🏠 Main Menu", "cmd_main_menu").row();

  const text =
    `👥 *Delivery Partner Directory (Alphabetical Order)*\n\n` +
    `Select any delivery partner below to inspect their full profile, assigned orders, delivery stats, and customer ratings:\n\n` +
    agents.map((a, idx) => `  ${idx + 1}. *${a.name}* — ${a.vehicleType} (\`${a.phone}\`)`).join("\n") +
    `\n\n👉 *Tap an agent below to open their profile:*`;

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
}

async function showAgentProfile(ctx: any, agentName: string) {
  const agents = getAllAgentsAlphabetical();
  const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase()) || {
    name: agentName,
    phone: "+919876500000",
    vehicleNumber: "KA01 AB 1234",
    vehicleType: "Bike 🏍️"
  };

  const all = fetchOrdersFromParquet(agent.name).filter(o => o.order_id);
  const delivered = all.filter(o => o.delivery_status === "Delivered ✅" || o.delivery_status === "Delivered");
  const pending = all.filter(o => o.delivery_status !== "Delivered ✅" && o.delivery_status !== "Delivered");
  const rated = all.filter(o => o.delivery_rating != null && o.delivery_rating !== "" && Number(o.delivery_rating) > 0);

  const avg = rated.length > 0
    ? (rated.reduce((sum, r) => sum + Number(r.delivery_rating), 0) / rated.length).toFixed(1)
    : null;

  const session = sessions[String(ctx.chat!.id)];
  const isCurrent = session && session.agentName.toLowerCase() === agent.name.toLowerCase();

  const recentReviews = rated.slice(-3).reverse().map(r => {
    const stars = starsStr(Number(r.delivery_rating));
    const feedback = r.delivery_feedback ? `\n    💬 _"${r.delivery_feedback}"_` : "";
    return `  ▪ \`${r.order_id}\` (${r.order_timestamp || "Recent"}): ${stars} (*${r.delivery_rating}/5*)${feedback}`;
  }).join("\n");

  const text =
    `👤 *Delivery Agent Profile — ${agent.name}* ${isCurrent ? "(Your Profile ✅)" : ""}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `▪ *Full Name:* *${agent.name}*\n` +
    `▪ *Contact Phone:* \`${agent.phone}\`\n` +
    `▪ *Vehicle Type:* ${agent.vehicleType}\n` +
    `▪ *Vehicle Number:* \`${agent.vehicleNumber}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Performance Metrics:*\n` +
    `▪ *Total Assigned Orders:* *${all.length}*\n` +
    `▪ *Completed Deliveries:* *${delivered.length}*\n` +
    `▪ *Active / In-Transit Deliveries:* *${pending.length}*\n` +
    `▪ *Customer Rating:* *${avg ? `${avg}/5.0 ${starsStr(Number(avg))}` : "No ratings yet"}*\n` +
    `▪ *Total Customer Reviews:* *${rated.length}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    (recentReviews ? `⭐ *Recent Customer Feedback:*\n${recentReviews}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : "");

  const kb = new InlineKeyboard()
    .text("⬅️ Back to All Delivery Agents", "cmd_profile").row();

  if (!isCurrent) {
    kb.text(`🔄 Switch to ${agent.name}`, `select_agent_${agent.name}`).row();
  }

  kb.text("🏠 Main Menu", "cmd_main_menu").row();

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
}

bot.callbackQuery("cmd_profile", async (ctx) => {
  await safeAnswer(ctx);
  await showAgentRoster(ctx);
});

bot.callbackQuery(/^view_agent_(.+)$/, async (ctx) => {
  await safeAnswer(ctx);
  const agentName = ctx.match[1];
  await showAgentProfile(ctx, agentName);
});

bot.callbackQuery("cmd_main_menu", async (ctx) => {
  await safeAnswer(ctx);
  const session = sessions[String(ctx.chat!.id)];
  if (!session) { await loginPrompt(ctx); return; }
  await ctx.reply("🏠 *Main Menu:*", { parse_mode: "Markdown", reply_markup: mainMenu() });
});

// =============================================
// COMMAND SHORTCUTS
// =============================================
bot.command("orders", async (ctx) => {
  const session = sessions[String(ctx.chat.id)];
  if (!session) { await loginPrompt(ctx); return; }
  const all = fetchOrdersFromParquet(session.agentName);
  const pending = all.filter(o => o.delivery_status !== "Delivered ✅" && o.delivery_status !== "Delivered" && o.order_id);
  if (pending.length === 0) {
    await ctx.reply("🎉 No active deliveries right now! Check /pool for available orders.", { reply_markup: mainMenu() });
    return;
  }
  for (const order of pending) {
    const isOut = order.delivery_status === "Out for Delivery 🚀";
    const kb = new InlineKeyboard();
    if (isOut) {
      kb.text("✅ Mark as Delivered", `mark_delivered_${order.order_id}`).row();
    } else {
      kb.text("🚀 Start Delivery", `start_delivery_${order.order_id}`).row();
    }
    kb.text(`👤 View ${order.customer_name}'s Profile`, `view_cust_${order.customer_chat_id}`).row();
    await ctx.reply(formatOrderCard(order), { parse_mode: "Markdown", reply_markup: kb });
  }
});

bot.command("pool", async (ctx) => {
  const session = sessions[String(ctx.chat.id)];
  if (!session) { await loginPrompt(ctx); return; }
  const all = fetchOrdersFromParquet();
  const available = all.filter(o =>
    o.order_id &&
    (!o.delivery_partner_name || o.delivery_status === "Pending Claim ⏳" || o.delivery_status === "Unassigned") &&
    o.delivery_status !== "Delivered ✅" && o.delivery_status !== "Delivered"
  );
  if (available.length === 0) {
    await ctx.reply("🎉 No unclaimed orders waiting in the pool!", { reply_markup: mainMenu() });
    return;
  }
  for (const order of available) {
    const kb = new InlineKeyboard()
      .text("✋ Taken (Claim This Order)", `take_order_${order.order_id}`).row();
    await ctx.reply(
      `🚨 *NEW ORDER READY FOR PICKUP!*\n\n` +
      formatOrderCard(order),
      { parse_mode: "Markdown", reply_markup: kb }
    );
  }
});

bot.command("ratings", async (ctx) => {
  const session = sessions[String(ctx.chat.id)];
  if (!session) { await loginPrompt(ctx); return; }
  const all = fetchOrdersFromParquet(session.agentName);
  const rated = all.filter(o => o.delivery_rating != null && o.delivery_rating > 0);
  if (rated.length === 0) { await ctx.reply("No customer ratings yet!"); return; }
  const avg = rated.reduce((sum, r) => sum + Number(r.delivery_rating), 0) / rated.length;
  await ctx.reply(`⭐ Your average rating: *${avg.toFixed(1)}/5.0* across *${rated.length}* customer reviews!`, { parse_mode: "Markdown" });
});

bot.command(["profile", "agents", "roster"], async (ctx) => {
  await showAgentRoster(ctx);
});

bot.command("logout", async (ctx) => {
  delete sessions[String(ctx.chat.id)];
  saveAgents(sessions);
  await ctx.reply("👋 Logged out. Run /start to pick an agent profile.");
});

async function loginPrompt(ctx: any) {
  const kb = new InlineKeyboard();
  AGENTS.forEach((a, i) => kb.text(`${a.vehicleType} ${a.name}`, `login_${i}`).row());
  await ctx.reply("⚠️ You are not logged in. Please select your agent profile:", { parse_mode: "Markdown", reply_markup: kb });
}

// =============================================
// ERROR BOUNDARY & START
// =============================================
bot.catch((err) => {
  const msg = err.error instanceof Error ? err.error.message : String(err.error);
  if (msg.includes("message is not modified") || msg.includes("query is too old")) return;
  console.error("Delivery bot error:", msg);
});

console.log("🚴 VyaparSync Delivery Agent Bot starting...");
bot.start();
