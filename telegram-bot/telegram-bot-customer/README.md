# 🛒 VyaparSync Customer Telegram Bot

> **An enterprise-grade, conversational e-commerce & retail operations bot for Telegram.** Built with TypeScript, [grammY](https://grammy.dev/), and Python Parquet data pipelines.

---

## 📖 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
  - [1. Intelligent Product Catalog & Search](#1-intelligent-product-catalog--search)
  - [2. Interactive Cart & Stock Controls](#2-interactive-cart--stock-controls)
  - [3. Dynamic Pricing & Tiered Loyalty Engine](#3-dynamic-pricing--tiered-loyalty-engine)
  - [4. 5-Step Frictionless Checkout Flow](#4-5-step-frictionless-checkout-flow)
  - [5. Promo Code & Referral Program](#5-promo-code--referral-program)
  - [6. 10-Minute Order Cancellation System](#6-10-minute-order-cancellation-system)
  - [7. Scheduled & Recurring Deliveries](#7-scheduled--recurring-deliveries)
  - [8. 1-Tap Reorder](#8-1-tap-reorder)
  - [9. Refund & Return Workflow](#9-refund--return-workflow)
  - [10. Dual Rating & Feedback System](#10-dual-rating--feedback-system)
- [Bot Commands Reference](#-bot-commands-reference)
- [Data Pipeline & Parquet Analytics](#-data-pipeline--parquet-analytics)
- [Project Structure](#-project-structure)
- [Environment Configuration](#-environment-configuration)
- [Installation & Execution](#-installation--execution)
- [Integration Points](#-integration-points)

---

## 🏗️ Architecture Overview

The Customer Bot serves as the primary storefront and transaction orchestrator in the VyaparSync retail ecosystem. It connects shopping experiences directly with live inventory files, triggers delivery dispatch broadcasts, and syncs order data to a columnar Parquet data lake for business intelligence.

```
┌─────────────────────────────────────────────────────────────┐
│                   Customer Telegram User                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Telegram Bot API (grammY)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Customer Bot (bot.ts)                    │
│   - Catalog & Search (data.ts)                              │
│   - Cart Management (cart.ts)                               │
│   - Checkout & Customer Profiles (customer.ts)              │
│   - Dynamic Pricing & Promo Engine (data.ts)                │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│  Live Inventory Management   │ │ Delivery Bot Dispatch API  │
│  (../inventory/inventory.json│ │ (Instant Order Broadcasts) │
└──────────────┬───────────────┘ └────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Parquet Analytics Pipeline                  │
│       (export_parquet.py -> customer_data.parquet & CSV)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features

### 1. Intelligent Product Catalog & Search
- **Category Filter Tabs:** Products are categorized into `🌾 Staples`, `🍪 Snacks`, `🧈 Dairy`, `🫧 Home Care`, `☕ Beverages`, and `🧹 Personal Care`.
- **Fuzzy Search:** Execute direct searches with `/search <query>` (e.g. `/search maggi`, `/search butter`) or use the interactive search prompt.
- **Stock Badging:** Real-time stock status is fetched from `inventory.json`. Out-of-stock items display `❌ OUT OF STOCK` (unclickable), and low stock items indicate remaining units `(X left!)`.

### 2. Interactive Cart & Stock Controls
- **Per-Item Inline Controls:** Modify quantities directly inside `/cart` using `[ ➖ ]`, `[ ➕ ]`, and `[ 🗑️ ]` buttons.
- **Inventory Limit Enforcement:** Prevents adding more units than currently available in stock.
- **In-Place UI Updates:** Edits message text and reply markup dynamically without spamming the chat.

### 3. Dynamic Pricing & Tiered Loyalty Engine
- **Quantity Tiers:** Bulk discounts (e.g., Buy 3+ Parle-G $\rightarrow$ 15% off).
- **BOGO Deals:** Buy 2 Maggi $\rightarrow$ Get 1 Free.
- **Bundle Combos:** Atta + Tata Salt $\rightarrow$ Flat ₹25 OFF; Chai + Biscuit $\rightarrow$ 10% OFF.
- **Threshold Deals:** Orders ₹500+ receive free delivery + ₹30 instant discount.
- **Customer Tiers:**
  - `🌱 New Customer` (0 orders) $\rightarrow$ 50 welcome points.
  - `🛍️ Returning Customer` (1–2 orders).
  - `⭐ Regular Customer` (3+ orders or ₹800+ spent) $\rightarrow$ ₹15 loyalty discount on every order.
  - `💎 VIP Customer` (5+ orders or ₹2000+ spent) $\rightarrow$ Automatic 10% discount on all orders.

### 4. 5-Step Frictionless Checkout Flow
The checkout flow guides users step-by-step with state persistence:
1. **Payment Mode:** Cash on Delivery (COD) or Dynamic UPI (with generated QR code).
2. **Customer Name:** Auto-populates previous name with 1-tap confirmation or custom text edit.
3. **Phone Number:** Validates contact number for delivery partner communication.
4. **Delivery Address:** Custom address input with quick 1-tap "Use Saved Address".
5. **📝 Order Notes & Instructions:** Option to add notes (*"Leave at the door"*, *"Ring bell twice"*, *"No plastic bags"*).
6. **🎟️ Promo Code:** Apply promo code or skip.
7. **Final Review & Bill Summary:** Complete itemized review with subtotal, deals discounts, promo discounts, and final payable amount.

### 5. Promo Code & Referral Program
- **5 Built-In Promo Codes:**
  | Code | Discount Type | Value / Cap | Condition |
  |:---|:---|:---|:---|
  | `WELCOME50` | Flat | **₹50 OFF** | Welcome offer |
  | `OBSIDIAN20` | Percentage | **20% OFF** (Max ₹100) | Store-wide savings |
  | `FREESHIP` | Flat | **₹30 OFF** | Free delivery waiver |
  | `DIWALI100` | Flat | **₹100 OFF** | Minimum cart ₹500 |
  | `MEGA15` | Percentage | **15% OFF** (Max ₹75) | Mega savings deal |
- **Referral System (`/refer`):** Generates unique referral codes (e.g., `REF-AMIT123`). When entered via `/use_referral <CODE>`, both the referrer and new user earn **+50 bonus loyalty points**.

### 6. 10-Minute Order Cancellation System
- **Command:** `/cancel`
- **Rules:** Cancellations are allowed within **10 minutes** of order placement.
- **Actions:**
  - Marks order status as `Cancelled ❌`.
  - Reverts customer totals and loyalty points.
  - Automatically restores product quantities in `inventory.json`.
  - Broadcasts cancellation alerts to delivery agents in real-time.

### 7. Scheduled & Recurring Deliveries
- **Command:** `/schedule`
- **Recurring Schedule Builder:**
  1. Pick products from existing cart.
  2. Select delivery days using quick presets (*Every Day*, *Weekdays Only*, *Weekends Only*) or individual checkboxes.
  3. Choose delivery time slot:
     - 🌅 *Morning (9-11 AM)*
     - ☀️ *Afternoon (12-2 PM)*
     - 🌇 *Evening (5-7 PM)*
  4. Track and manage active schedules with `/schedule`.

### 8. 1-Tap Reorder
- **Command:** `/reorder`
- Displays the customer's previous 5 completed orders.
- Clicking any order validates live inventory stock and copies all items into the active cart for instant checkout.

### 9. Refund & Return Workflow
- **Command:** `/refund`
- Select items from actual purchase history.
- Choose reasons: *Damaged / Broken*, *Wrong Item*, *Expired / Quality Issue*, *Missing from Package*.
- Attach photo proof directly via Telegram photo uploads.
- Auto-generates trackable refund tickets (e.g., `REF-12345`).

### 10. Dual Rating & Feedback System
- **Step 1:** Rate Store & Product Quality (1–5 ⭐) $\rightarrow$ +10 points.
- **Step 2:** Rate Delivery Partner Performance (1–5 ⭐) $\rightarrow$ +10 points.
- **Step 3:** Optional text feedback captured and pushed to delivery partner profiles.

---

## 🕹️ Bot Commands Reference

| Command | Description |
|:---|:---|
| `/start` | Launch bot, view dynamic welcome banner, active deals, and main menu |
| `/order` | Open product catalog filtered by categories |
| `/search <query>` | Search products by name or category |
| `/cart` | View cart with inline `+`, `-`, and `🗑️` quantity controls |
| `/confirm` | Start the 5-step checkout flow |
| `/cancel` | Cancel an order placed within the last 10 minutes |
| `/reorder` | 1-tap re-order from past purchase history |
| `/schedule` | Set up or manage recurring weekly/daily deliveries |
| `/track` | Live delivery tracking & rider contact card |
| `/profile` | View tier status, loyalty points, and order history |
| `/deals` | View all active dynamic pricing discounts and combos |
| `/refer` | View your unique referral code and share link |
| `/use_referral <code>` | Apply a friend's referral code for +50 points |
| `/refund` | Submit an item refund request with photo proof |
| `/feedback` | Submit dual ratings for store and delivery partner |
| `/location` | Update default delivery address |
| `/phone` | Update customer phone number |
| `/name` | Update customer display name |
| `/help` | Interactive FAQ menu and direct store contact details |

---

## 📊 Data Pipeline & Parquet Analytics

Orders and customer profiles are stored locally in `customers.json` and automatically exported to `customer_data.parquet` and `customer_data.csv` via `export_parquet.py`.

### Parquet Schema (31 Columns):
- **Customer Metadata:** `customer_chat_id`, `customer_name`, `customer_username`, `customer_phone`, `customer_type`, `loyalty_points`, `customer_location`, `first_seen`, `last_seen`, `total_orders`, `total_spent`, `referral_code`, `referred_by`.
- **Order Details:** `order_id`, `order_timestamp`, `items_count`, `items_summary`, `subtotal`, `discount`, `total_cost`, `payment_method`, `delivery_status`.
- **Delivery Partner Info:** `delivery_partner_name`, `delivery_partner_phone`.
- **Ratings & Reviews:** `shop_rating`, `shop_feedback`, `delivery_rating`, `delivery_feedback`.
- **Feature Enhancements:** `order_notes`, `promo_code_applied`, `promo_discount`.

---

## 📁 Project Structure

```
telegram-bot-customer/
├── bot.ts                # Main grammY bot entry point & conversation flows
├── cart.ts               # In-memory cart manager & stock checks
├── customer.ts           # Customer profile management & order history
├── data.ts               # Live inventory sync, categories, deals & promo codes
├── export_parquet.py     # Python ETL script exporting JSON data to Parquet & CSV
├── customers.json        # Persistent JSON store for customer records
├── package.json          # Node.js dependencies & scripts
├── tsconfig.json         # TypeScript compiler configuration
├── .env.example          # Template for environment variables
└── README.md             # This documentation
```

---

## ⚙️ Environment Configuration

Create a `.env` file inside `telegram-bot-customer/` based on `.env.example`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=optional_startup_notification_chat_id
PYTHON_PATH=C:/Users/KIIT/AppData/Local/Python/bin/python.exe
```

---

## 🚀 Installation & Execution

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Install Python Dependencies (for Parquet Export)
```bash
pip install pandas pyarrow
```

### 3. Start the Bot
```bash
npm start
# or directly with tsx:
npx tsx bot.ts
```

---

## 🔗 Integration Points

1. **Inventory Sync:** Reads and writes to `../inventory/inventory.json`.
2. **Delivery Partner Dispatch:** Dispatches real-time order notifications and cancellation broadcasts directly to agents configured in `../telegram-bot-delivery/`.
3. **Data Lake:** Generates `../customer_data.parquet` and `../customer_data.csv` in the root workspace.
