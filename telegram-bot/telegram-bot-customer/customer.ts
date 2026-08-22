import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { CartItem } from './cart';

export interface CustomerOrderRecord {
  orderId: string;
  items: {
    productId: string;
    name: string;
    price: number;
    emoji: string;
    quantity: number;
  }[];
  subtotal: number;
  discount: number;
  totalCost: number;
  paymentMethod: string;
  timestamp: string;
  location: string;
  deliveryBoy: {
    name: string;
    phone: string;
  };
  deliveryStatus?: 'Pending Claim ⏳' | 'Assigned' | 'Out for Delivery 🚀' | 'Delivered ✅' | 'Cancelled ❌' | string;
  shopRating?: number; // 1-5
  shopFeedback?: string;
  deliveryRating?: number; // 1-5
  deliveryFeedback?: string;
  // ─── NEW FIELDS ───
  orderNotes?: string;
  promoCode?: string;
  promoDiscount?: number;
}

export type CustomerType = 'New Customer 🌱' | 'Returning Customer 🛍️' | 'Regular Customer ⭐' | 'VIP Customer 💎';

export interface ScheduledOrder {
  id: string;
  items: CartItem[];
  schedule: {
    days: string[];    // e.g. ['Monday', 'Wednesday', 'Friday']
    time: string;      // e.g. 'Morning (9-11 AM)'
  };
  address: string;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerProfile {
  chatId: number;
  name: string;
  username?: string;
  phone?: string;
  location: string;
  firstSeen: string;
  lastSeen: string;
  totalOrders: number;
  totalSpent: number;
  customerType: CustomerType;
  loyaltyPoints: number;
  orders: CustomerOrderRecord[];
  // ─── NEW FIELDS ───
  referralCode: string;
  referredBy?: string;
  scheduledOrders: ScheduledOrder[];
}

const CUSTOMERS_FILE = path.join(__dirname, 'customers.json');
const EXPORT_SCRIPT = path.join(__dirname, 'export_parquet.py');

// In-memory customer map: chatId -> CustomerProfile
const customers = new Map<number, CustomerProfile>();

function getPythonPath(): string {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const defaultWinPython = "C:/Users/KIIT/AppData/Local/Python/bin/python.exe";
  if (fs.existsSync(defaultWinPython)) {
    return defaultWinPython;
  }
  return "py";
}

// ─── Generate Referral Code ───────────────────────────────────────────────────
function generateReferralCode(name: string, chatId: number): string {
  const clean = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) || 'USER';
  const suffix = chatId.toString().slice(-3);
  return `REF-${clean}${suffix}`;
}

// ─── Trigger Parquet Sync ──────────────────────────────────────────────────────
export function syncToParquet() {
  const py = getPythonPath();
  const cmd = py.includes('/') || py.includes('\\')
    ? `powershell -Command "& '${py}' '${EXPORT_SCRIPT}'"`
    : `${py} "${EXPORT_SCRIPT}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      // Fallback attempt with py launcher
      exec(`py "${EXPORT_SCRIPT}"`, (err2, stdout2) => {
        if (err2) {
          console.warn("⚠️ Parquet sync error:", err2.message);
        } else if (stdout2) {
          console.log(stdout2.trim());
        }
      });
    } else {
      if (stdout) console.log(stdout.trim());
    }
  });
}

// ─── Load from Disk ────────────────────────────────────────────────────────────
export function loadCustomers() {
  try {
    if (fs.existsSync(CUSTOMERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
      for (const item of data) {
        // Ensure new fields have defaults for legacy data
        if (!item.referralCode) {
          item.referralCode = generateReferralCode(item.name || 'USER', item.chatId);
        }
        if (!item.scheduledOrders) {
          item.scheduledOrders = [];
        }
        customers.set(item.chatId, item);
      }
      console.log(`📂 Loaded ${customers.size} customer profiles from customers.json`);
    }
    syncToParquet();
  } catch (err) {
    console.error("⚠️ Error loading customers.json:", err);
  }
}

// ─── Save to Disk ──────────────────────────────────────────────────────────────
export function saveCustomers() {
  try {
    const list = Array.from(customers.values());
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(list, null, 2), 'utf8');
    syncToParquet();
  } catch (err) {
    console.error("⚠️ Error saving customers.json:", err);
  }
}

// ─── Compute Customer Classification ──────────────────────────────────────────
export function computeCustomerType(orderCount: number, totalSpent: number): CustomerType {
  if (orderCount >= 5 || totalSpent >= 2000) return 'VIP Customer 💎';
  if (orderCount >= 3 || totalSpent >= 800) return 'Regular Customer ⭐';
  if (orderCount >= 1) return 'Returning Customer 🛍️';
  return 'New Customer 🌱';
}

// ─── Get or Create Profile ─────────────────────────────────────────────────────
export function getOrCreateCustomer(chatId: number, name: string, username?: string, phone?: string): CustomerProfile {
  const now = new Date().toISOString();
  if (!customers.has(chatId)) {
    const newProfile: CustomerProfile = {
      chatId,
      name: name || "Customer",
      username: username || undefined,
      phone: phone || undefined,
      location: "MG Road, Bengaluru (Default)",
      firstSeen: now,
      lastSeen: now,
      totalOrders: 0,
      totalSpent: 0,
      customerType: 'New Customer 🌱',
      loyaltyPoints: 50, // Welcome bonus
      orders: [],
      referralCode: generateReferralCode(name || "Customer", chatId),
      scheduledOrders: [],
    };
    customers.set(chatId, newProfile);
    saveCustomers();
    return newProfile;
  }

  const profile = customers.get(chatId)!;
  let updated = false;
  if (name && name !== "Customer" && profile.name !== name) {
    profile.name = name;
    updated = true;
  }
  if (username !== undefined && profile.username !== username) {
    profile.username = username;
    updated = true;
  }
  if (phone !== undefined && profile.phone !== phone) {
    profile.phone = phone;
    updated = true;
  }
  // Ensure referral code exists for legacy profiles
  if (!profile.referralCode) {
    profile.referralCode = generateReferralCode(profile.name, chatId);
    updated = true;
  }
  if (!profile.scheduledOrders) {
    profile.scheduledOrders = [];
    updated = true;
  }
  profile.lastSeen = now;
  profile.customerType = computeCustomerType(profile.totalOrders, profile.totalSpent);

  if (updated) {
    saveCustomers();
  }
  return profile;
}

// ─── Record Completed Order ───────────────────────────────────────────────────
export function recordCustomerOrder(
  chatId: number,
  orderData: Omit<CustomerOrderRecord, 'timestamp'>
): CustomerProfile {
  const profile = getOrCreateCustomer(chatId, "Customer");
  const now = new Date().toISOString();

  const record: CustomerOrderRecord = {
    ...orderData,
    deliveryStatus: orderData.deliveryStatus || 'Pending Claim ⏳',
    timestamp: now
  };

  profile.orders.push(record);
  profile.totalOrders += 1;
  profile.totalSpent += record.totalCost;
  // Earn 1 loyalty point per ₹10 spent
  profile.loyaltyPoints += Math.floor(record.totalCost / 10);
  profile.customerType = computeCustomerType(profile.totalOrders, profile.totalSpent);
  profile.lastSeen = now;

  saveCustomers();
  return profile;
}

// ─── Cancel Order (within time window) ─────────────────────────────────────────
export function cancelOrder(chatId: number, orderId: string, windowMinutes: number = 10): { success: boolean; error?: string; order?: CustomerOrderRecord } {
  const profile = customers.get(chatId);
  if (!profile) return { success: false, error: "Profile not found." };

  const order = profile.orders.find(o => o.orderId === orderId);
  if (!order) return { success: false, error: "Order not found." };

  // Check if already delivered or cancelled
  if (order.deliveryStatus === 'Delivered ✅' || order.deliveryStatus === 'Delivered') {
    return { success: false, error: "This order has already been delivered and cannot be cancelled." };
  }
  if (order.deliveryStatus === 'Cancelled ❌') {
    return { success: false, error: "This order has already been cancelled." };
  }

  // Check time window
  const orderTime = new Date(order.timestamp).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - orderTime) / (1000 * 60);

  if (elapsedMinutes > windowMinutes) {
    const remaining = Math.ceil(elapsedMinutes - windowMinutes);
    return { success: false, error: `⏰ Cancellation window expired! Orders can only be cancelled within ${windowMinutes} minutes of placing. This order was placed ${Math.floor(elapsedMinutes)} minutes ago.` };
  }

  // Cancel the order
  order.deliveryStatus = 'Cancelled ❌';

  // Revert totals
  profile.totalOrders = Math.max(0, profile.totalOrders - 1);
  profile.totalSpent = Math.max(0, profile.totalSpent - order.totalCost);
  profile.loyaltyPoints = Math.max(0, profile.loyaltyPoints - Math.floor(order.totalCost / 10));
  profile.customerType = computeCustomerType(profile.totalOrders, profile.totalSpent);

  saveCustomers();
  return { success: true, order };
}

// ─── Update Customer Location ──────────────────────────────────────────────────
export function updateCustomerLocation(chatId: number, location: string): CustomerProfile {
  const profile = getOrCreateCustomer(chatId, "Customer");
  profile.location = location;
  // Also update location in recent open orders if unassigned or pending
  for (const ord of profile.orders) {
    if (ord.deliveryStatus === 'Pending Claim ⏳' || ord.deliveryStatus === 'Assigned') {
      ord.location = location;
    }
  }
  saveCustomers();
  return profile;
}

// ─── Update Customer Phone Number ──────────────────────────────────────────────
export function updateCustomerPhone(chatId: number, phone: string): CustomerProfile {
  const profile = getOrCreateCustomer(chatId, "Customer");
  profile.phone = phone;
  saveCustomers();
  return profile;
}

// ─── Update Customer Name ──────────────────────────────────────────────────────
export function updateCustomerName(chatId: number, name: string): CustomerProfile {
  const profile = getOrCreateCustomer(chatId, "Customer");
  profile.name = name;
  saveCustomers();
  return profile;
}

// ─── Save Shop Rating & Feedback ───────────────────────────────────────────────
export function recordShopRating(chatId: number, orderId: string, rating: number, feedback?: string): boolean {
  const profile = customers.get(chatId);
  if (!profile) return false;

  const order = profile.orders.find(o => o.orderId === orderId) || profile.orders[profile.orders.length - 1];
  if (order) {
    order.shopRating = rating;
    if (feedback) order.shopFeedback = feedback;
    profile.loyaltyPoints += 15; // Bonus loyalty points for feedback
    saveCustomers();
    return true;
  }
  return false;
}

// ─── Save Delivery Partner Rating & Feedback ──────────────────────────────────
export function recordDeliveryRating(chatId: number, orderId: string, rating: number, feedback?: string): boolean {
  const profile = customers.get(chatId);
  if (!profile) return false;

  const order = profile.orders.find(o => o.orderId === orderId) || profile.orders[profile.orders.length - 1];
  if (order) {
    order.deliveryRating = rating;
    if (feedback) order.deliveryFeedback = feedback;
    profile.loyaltyPoints += 15; // Bonus loyalty points for feedback
    saveCustomers();
    return true;
  }
  return false;
}

// ─── Scheduled Orders ──────────────────────────────────────────────────────────
export function addScheduledOrder(chatId: number, schedule: Omit<ScheduledOrder, 'id' | 'createdAt'>): ScheduledOrder {
  const profile = getOrCreateCustomer(chatId, "Customer");
  const newSchedule: ScheduledOrder = {
    ...schedule,
    id: `SCH-${Date.now().toString().slice(-5)}`,
    createdAt: new Date().toISOString(),
  };
  profile.scheduledOrders.push(newSchedule);
  saveCustomers();
  return newSchedule;
}

export function getScheduledOrders(chatId: number): ScheduledOrder[] {
  const profile = customers.get(chatId);
  return profile?.scheduledOrders?.filter(s => s.isActive) || [];
}

export function removeScheduledOrder(chatId: number, scheduleId: string): boolean {
  const profile = customers.get(chatId);
  if (!profile) return false;
  const schedule = profile.scheduledOrders.find(s => s.id === scheduleId);
  if (schedule) {
    schedule.isActive = false;
    saveCustomers();
    return true;
  }
  return false;
}

// ─── Referral Tracking ─────────────────────────────────────────────────────────
export function applyReferral(chatId: number, referralCode: string): { success: boolean; referrerName?: string; error?: string } {
  const profile = getOrCreateCustomer(chatId, "Customer");
  if (profile.referredBy) {
    return { success: false, error: "You've already used a referral code!" };
  }
  // Find referrer
  for (const cust of customers.values()) {
    if (cust.referralCode === referralCode && cust.chatId !== chatId) {
      profile.referredBy = referralCode;
      profile.loyaltyPoints += 50; // Reward for using referral
      cust.loyaltyPoints += 50;    // Reward for referrer
      saveCustomers();
      return { success: true, referrerName: cust.name };
    }
  }
  return { success: false, error: "Invalid referral code." };
}

// ─── Fetch All Orders (for Delivery Agent Bot) ─────────────────────────────────
export function getAllCustomerOrders(): { customerName: string; customerChatId: number; order: CustomerOrderRecord }[] {
  const all: { customerName: string; customerChatId: number; order: CustomerOrderRecord }[] = [];
  for (const cust of customers.values()) {
    for (const ord of cust.orders) {
      all.push({
        customerName: cust.name,
        customerChatId: cust.chatId,
        order: ord
      });
    }
  }
  return all;
}

// ─── Claim Order (Delivery Agent Takes Order) ─────────────────────────────────
export function claimOrder(
  orderId: string,
  agent: { name: string; phone: string; vehicleNumber?: string; vehicleType?: string }
): { success: boolean; error?: string; customerChatId?: number; order?: CustomerOrderRecord } {
  for (const cust of customers.values()) {
    const ord = cust.orders.find(o => o.orderId === orderId);
    if (ord) {
      if (ord.deliveryStatus === 'Cancelled ❌') {
        return { success: false, error: `Order ${orderId} has been cancelled by the customer.` };
      }
      if (ord.deliveryBoy && ord.deliveryBoy.name && ord.deliveryBoy.name !== agent.name && ord.deliveryStatus !== 'Pending Claim ⏳') {
        return { success: false, error: `Order ${orderId} has already been claimed by ${ord.deliveryBoy.name}!` };
      }
      ord.deliveryBoy = {
        name: agent.name,
        phone: agent.phone
      };
      ord.deliveryStatus = 'Assigned';
      saveCustomers();
      return { success: true, customerChatId: cust.chatId, order: ord };
    }
  }
  return { success: false, error: "Order not found!" };
}

// ─── Update Delivery Status ────────────────────────────────────────────────────
export function updateOrderStatus(
  orderId: string,
  status: 'Assigned' | 'Out for Delivery 🚀' | 'Delivered ✅' | string
): { success: boolean; customerChatId?: number; order?: CustomerOrderRecord } {
  for (const cust of customers.values()) {
    const ord = cust.orders.find(o => o.orderId === orderId);
    if (ord) {
      ord.deliveryStatus = status as any;
      saveCustomers();
      return { success: true, customerChatId: cust.chatId, order: ord };
    }
  }
  return { success: false };
}

// Load on module initialisation
loadCustomers();
