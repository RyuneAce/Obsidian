# 🛒 Team OBSIDIAN — VyaparSync Retail & Delivery Ecosystem

An intelligent, full-stack retail operations and hyper-local delivery management system powered by Telegram bots, live inventory tracking, and data analytics pipelines.

---

## 🏗️ Architecture Overview

```
├── inventory/                    # Live Web Inventory Dashboard & Express API (Port 3500)
│   ├── app.js                   # Frontend dashboard logic & visualizations
│   ├── index.html               # Web UI (stock chart, restock orders, margin analytics)
│   ├── inventory.json           # Live inventory database (stock received, sold, thresholds)
│   ├── server.js                # Express API server for stock & sales
│   └── style.css                # Obsidian Dark theme styles
│
├── telegram-bot-customer/        # Customer Telegram Shopping Bot
│   ├── bot.ts                   # Bot commands, 5-step checkout, interactive cart, search
│   ├── cart.ts                  # Cart management, stock validation, item controls (+/-)
│   ├── customer.ts              # Customer tiering, 10-min cancellation, schedules, referrals
│   ├── data.ts                  # Live inventory sync, categories, 5 promo codes, dynamic deals
│   ├── export_parquet.py        # Analytics pipeline: syncs customer orders to Parquet & CSV
│   └── customers.json           # Customer database & order history
│
├── telegram-bot-delivery/        # Delivery Partner Dispatch Bot
│   ├── bot.ts                   # Live claim pool, active order tracking, customer ratings
│   ├── agents.json              # Delivery agent roster & session store
│   └── parquet_reader.py        # Parquet data bridge for delivery operations
│
├── customer_data.parquet         # High-performance columnar data lake for retail analytics
└── customer_data.csv             # Tabular export for business intelligence
```

---

## ✨ Key Features

### 🛍️ Customer Telegram Bot
- **Interactive Catalog & Categories:** Browse by category (🌾 Staples, 🍪 Snacks, 🧈 Dairy, 🫧 Home Care, ☕ Beverages, 🧹 Personal Care) or search via `/search <query>`.
- **Cart Item Controls:** Inline quantity increments, decrements, and removals (`[➖] [×2] [➕] [🗑️]`) with real-time stock limits.
- **Dynamic Pricing Engine:** Multi-tier bulk discounts, BOGO offers, combo bundles, and customer loyalty perks.
- **5-Step Frictionless Checkout:** Name → Phone → Delivery Address → 📝 Delivery Notes → 🎟️ Promo Code → Final Bill Review.
- **5 Active Promo Codes:** `WELCOME50`, `OBSIDIAN20`, `FREESHIP`, `DIWALI100`, `MEGA15`.
- **10-Minute Order Cancellation:** `/cancel` allows instant cancellation within 10 minutes, automatically restoring inventory and notifying riders.
- **1-Tap Reorder:** `/reorder` instantly re-populates the cart with items from previous orders.
- **Scheduled & Recurring Deliveries:** `/schedule` sets up weekly or daily recurring deliveries with morning, afternoon, or evening time slots.
- **Referral Program:** `/refer` generates unique referral codes granting +50 loyalty points to both users.
- **Refund Flow:** Photo-proof submission for damaged or missing items.
- **Dual Feedback System:** Separate 5-star ratings and reviews for Store Quality and Delivery Rider.

### 🚴 Delivery Agent Bot
- **Broadcast Dispatch:** Instant order broadcasts to all registered riders upon placement.
- **Claim Pool:** Live order claiming (`"✋ Taken"`).
- **In-Transit Management:** 1-tap `"🚀 Start Delivery"` and `"✅ Mark Delivered"`.
- **Customer Notes:** Rider sees special customer instructions (e.g. *"Leave at the door"*, *"Ring bell twice"*).
- **Rider Performance:** Live review feed and aggregate rating scorecards.

### 📊 Inventory Dashboard & API
- **Real-time Stock Tracking:** Ok, Low, and Critical stock indicators.
- **Restock Cost Calculation:** Auto-generates purchase orders with distributor contact details.
- **Profit Margin Analytics:** Per-item margins and overall revenue metrics.
- **Live Sync:** Automatically decrements stock on bot orders and restores stock on cancellations.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- Python (3.9+) with `pandas` and `pyarrow`
- Telegram Bot Tokens (via [@BotFather](https://t.me/botfather))

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in both bot folders and enter your tokens:
```bash
cp telegram-bot-customer/.env.example telegram-bot-customer/.env
cp telegram-bot-delivery/.env.example telegram-bot-delivery/.env
```

### 3. Install Dependencies
```bash
# Inventory server
cd inventory && npm install && cd ..

# Customer bot
cd telegram-bot-customer && npm install && cd ..

# Delivery bot
cd telegram-bot-delivery && npm install && cd ..
```

### 4. Run the Ecosystem
```bash
# Start Inventory Server (Port 3500)
cd inventory && node server.js

# Start Customer Bot
cd telegram-bot-customer && npx tsx bot.ts

# Start Delivery Agent Bot
cd telegram-bot-delivery && npx tsx bot.ts
```

---

## 👥 Team
**Team OBSIDIAN**
