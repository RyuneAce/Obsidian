# Team OBSIDIAN — Little Shop / VyaparSync

An intelligent, AI-assisted retail operations and hyper-local delivery ecosystem.

The system combines:

- A local-first shop management application
- Unified inventory and transaction management
- AI-powered product information resolution
- Memory / PKDB-backed knowledge
- Offline processing through a Queue
- Document scanning
- Voice Commerce
- AI business insights
- A shared Data Lake
- Telegram customer commerce
- Telegram delivery-partner operations
- Live inventory synchronization
- Retail analytics pipelines

> **Capture information once, resolve it intelligently, store it reliably, and let every part of the ecosystem work from the same source of truth.**

---

# 1. Ecosystem Overview

At a high level:

```text
                         USER / SHOPKEEPER
                                |
              +-----------------+-----------------+
              |                 |                 |
              v                 v                 v
          Inventory          Ledger          Dashboard
              |                 |                 |
              +-----------------+-----------------+
                                |
                                v
                         +-------------+
                         |  Info Gate  |
                         +------+------+
                                |
              +-----------------+-----------------+
              |                                   |
              v                                   v
        Memory / PKDB                         Internet?
              |                              /         \
              |                           YES           NO
              |                            |              |
              |                         Gemini         Queue
              |                            |
              +-------------+--------------+
                            |
                            v
                    Unified Transaction UI
                            |
                            v
                 +----------+-----------+
                 |          |           |
                 v          v           v
              Ledger    Inventory   Data Lake
                 |          |           |
                 +----------+-----------+
                            |
                            v
                       AI Insights


                     EXTERNAL COMMERCE
                            |
             +--------------+--------------+
             |                             |
             v                             v
      Telegram Customer              Telegram Delivery
             |                             |
             v                             v
        Customer Orders              Rider Operations
             |                             |
             +--------------+--------------+
                            |
                            v
                     Live Inventory
                            |
                            v
                    Data Lake / Analytics
```

The central architectural principle is that modules should share common systems instead of becoming isolated mini-applications.

---

# 2. Core Little Shop Architecture

## 2.1 Info Gate

Info Gate is the shared information-resolution layer.

Modules should not implement independent Gemini resolution loops.

```text
User input
   |
   v
Exact Memory / PKDB lookup
   |
   +-- Found --> use existing information
   |
   +-- Not found
           |
           v
     Check internet
           |
      +----+----+
      |         |
    Offline   Online
      |         |
      v         v
    Queue     Gemini
                |
                v
        Correct / normalize
                |
                v
        Search Memory again
                |
          +-----+-----+
          |           |
        Found       Not found
          |           |
          v           v
       Use it     Gemini enrichment
                       |
                       v
                Return resolved data
                       |
                       v
                 Transaction UI
```

### Important rules

- Exact Memory / PKDB lookup happens before AI enrichment.
- Internet connectivity is checked before using Gemini.
- If internet is unavailable, the operation goes to Queue.
- Gemini is an interpretation/enrichment mechanism, not the source of truth.
- Existing Memory / PKDB knowledge has priority.
- Gemini may resolve missing product information such as:
  - corrected product name
  - product family
  - product category
- The resolved information is then passed into the shared Transaction UI.

---

# 3. Memory / PKDB

Memory / PKDB stores product knowledge and relationships independently from current inventory.

```text
Removing an item from inventory
            !=
Deleting product knowledge
```

The system distinguishes between:

- Current inventory state
- Product knowledge
- Historical transactions

If a product is moved or corrected, the knowledge relationship should be updated rather than creating contradictory relationships.

Known information should be reused instead of repeatedly asking Gemini to rediscover it.

---

# 4. Unified Transaction UI

The Transaction UI is the common transaction representation used throughout the ecosystem.

It can be used by:

- Inventory
- Ledger
- Scanner
- Voice Commerce
- Other transaction-producing workflows

A transaction can contain:

```text
Party
Phone
Reference ID
Type
Date
Time
Location

Items
 ├── Product name
 ├── Product family
 ├── Category
 ├── Brand
 ├── Quantity
 └── Item total

Subtotal
Taxes
Grand Total
```

Items are expandable.

A multi-item purchase or sale remains **one transaction** and therefore one Ledger entry.

The Transaction UI is the review layer, not the source of truth.

---

# 5. Inventory

Inventory manages current stock.

The inventory workflow uses the shared Info Gate instead of maintaining its own Gemini loop.

```text
Add Inventory
      |
      v
Transaction / Info Gate
      |
      v
Resolve every item
      |
      v
User review
      |
      v
Accept
      |
      +----------+-----------+
      |          |           |
      v          v           v
 Inventory    Ledger      Data Lake
      |
      v
 Memory / PKDB update
```

Inventory should primarily retain what is necessary for stock management, while the broader transaction and product information is preserved by the shared data architecture.

---

# 6. Ledger

The Ledger stores business transactions.

A transaction can contain:

- Party
- Phone
- Reference ID
- Transaction type
- Date
- Time
- Location
- Items
- Product name
- Product family
- Category
- Brand
- Quantity
- Item totals
- Subtotal
- Taxes
- Grand total

## Ledger behavior

- Multi-item transactions remain one Ledger row.
- Sales / money received are positive.
- Purchases / money spent are negative.
- Transactions are expandable.
- Transactions can be edited.
- Transactions can be deleted.
- Reference IDs remain immutable when editing.
- Deletion should require confirmation.

---

# 7. Queue

Queue is a separate processing plugin.

It exists for operations that cannot currently complete, especially external AI/API operations requiring internet access.

```text
Info Gate needs Gemini
        |
        v
Check internet
        |
   +----+----+
   |         |
Online     Offline
   |         |
   v         v
 Gemini     Queue
             |
             v
      Resume when played
```

## Queue behavior

Queued operations:

- Preserve enough state to resume safely.
- Process sequentially.
- Do not launch all tasks simultaneously.
- Inform the user when a workflow has been queued.
- Are not manually editable.

Controls:

- Play
- Pause
- Delete
- Play all
- Pause all
- Delete all

Queue items should expose meaningful progress/state information.

---

# 8. Scanner

The Scanner turns business documents into structured transactions.

## Workflow

```text
Dashboard
   |
Scan Document
   |
Camera / image selection
   |
Capture / confirm
   |
Scanner screen
   |
Upload
   |
Gemini extracts document information
   |
Transaction UI
   |
Info Gate
   |
Review
   |
Save
```

Multiple documents can be processed while earlier ones are still being resolved.

Review tasks can collapse so the scanner is immediately available for another document.

## Processing indicators

Two-stage status:

- **Amber / yellow:** first-stage document processing is complete/in progress.
- **Green / teal:** full information resolution is complete and ready for review/save.

If Queue is triggered, the review task should clearly state that processing has been queued.

---

# 9. Voice Commerce

Voice Commerce turns spoken shop information into structured transactions.

## Workflow

```text
Record
   |
ElevenLabs transcription
   |
Gemini interpretation
   |
Transaction information
   |
Info Gate
   |
Transaction UI internally
   |
Review
   |
Save
```

The Transaction UI is used internally during processing rather than unnecessarily interrupting the recording workflow.

A saved voice record can retain:

- Original recording
- ElevenLabs transcription
- Gemini's interpreted meaning
- Final structured transaction

Example:

```text
Transcription:
"lays chips, bought, 20, swadesh dutta, 20 rs each"

Gemini interpretation:
"Bought 20 Lay's Chips from Swadesh Dutta for ₹20 each."
```

Multiple recordings can be processed while earlier recordings are still being resolved.

---

# 10. Dashboard

The Dashboard is the operational home screen.

It should remain lightweight and primarily deterministic.

Core dashboard widgets include:

- Action / Attention panel
- Today's business snapshot
- Inventory snapshot
- Recent activity
- Scanner shortcut
- Voice Commerce shortcut

The scanner and voice actions use a compact capsule-style control.

The dashboard is not intended to duplicate the full AI Insights engine.

---

# 11. AI Insights

AI Insights is the unified business intelligence layer.

There are intentionally no separate Sales / Inventory / Money / Trends AI tabs.

The user can ask the AI questions about the entire business.

Examples:

- What are my best-selling products?
- Which products should I restock?
- How much did I spend this week?
- Why did profit change?
- Compare this month with last month.
- Which products are barely selling?
- What looks unusual?
- What should I pay attention to?
- What would happen if I changed a price?

## AI flow

```text
User question
      |
      v
Understand intent
      |
      v
Determine required business data
      |
      v
Read real application data
      |
      v
Perform deterministic calculations
      |
      v
Gemini interpretation
      |
      v
Answer
```

Gemini must not invent business facts.

The application should provide actual business data to the AI before interpretation.

The chat interface should preserve conversational context.

---

# 12. Global Sync

The global Sync control synchronizes important application data.

A force-sync should reconcile:

- Main application data
- Data Lake
- Memory / PKDB
- Inventory
- Ledger
- Other required persistent stores

Sync must not create duplicate records.

Repeated sync attempts are rate-limited using progressively increasing cooldowns.

---

# 13. External Commerce Ecosystem

Little Shop is also designed to support the wider VyaparSync retail and delivery ecosystem.

The ecosystem includes:

```text
Little Shop
    |
    +---- Live Inventory
    |
    +---- Customer Telegram Bot
    |
    +---- Delivery Telegram Bot
    |
    +---- Data Lake
    |
    +---- Analytics
```

---

# 14. Telegram Customer Bot

The customer bot provides an interactive shopping experience.

## Catalog

Customers can:

- Browse categories
- Search products
- Add items to carts
- Change quantities
- Remove items
- See real-time stock limits

Example categories include:

- Staples
- Snacks
- Dairy
- Home Care
- Beverages
- Personal Care

## Cart

Cart controls include:

- Increase quantity
- Decrease quantity
- Remove item
- Real-time stock validation

## Dynamic pricing

The ecosystem supports:

- Multi-tier bulk discounts
- BOGO offers
- Combo bundles
- Customer loyalty perks

## Checkout

The checkout flow includes:

```text
Name
  ↓
Phone
  ↓
Delivery Address
  ↓
Delivery Notes
  ↓
Promo Code
  ↓
Final Bill Review
```

## Promotions

The existing ecosystem defines five promo codes:

```text
WELCOME50
OBSIDIAN20
FREESHIP
DIWALI100
MEGA15
```

## Other customer features

- 10-minute order cancellation
- Automatic inventory restoration after cancellation
- 1-tap reorder
- Scheduled deliveries
- Recurring deliveries
- Referral program
- Refund flow with photo proof
- Store quality ratings
- Delivery rider ratings

---

# 15. Telegram Delivery Agent Bot

The delivery bot manages delivery-partner operations.

## Dispatch

Orders can be broadcast to registered delivery agents.

Agents can claim available orders through the claim pool.

## Delivery lifecycle

```text
Order
  |
Broadcast
  |
Claim
  |
Start Delivery
  |
Delivered
```

The rider can also see customer notes such as delivery instructions.

## Rider performance

The system supports:

- Customer review feeds
- Aggregate rider ratings
- Delivery performance information

---

# 16. Live Inventory Integration

The external commerce layer uses live inventory information.

Inventory supports:

- Real-time stock tracking
- OK / Low / Critical stock indicators
- Restock cost calculation
- Purchase-order generation
- Distributor contact information
- Per-item margins
- Overall revenue metrics

Customer orders can automatically decrement stock.

Cancellations can restore stock.

---

# 17. Data Lake & Analytics

The ecosystem includes a columnar analytics Data Lake.

Current documented exports include:

```text
customer_data.parquet
customer_data.csv
```

The customer commerce pipeline can synchronize customer order information into Parquet / CSV for analytics and business intelligence.

The Data Lake should remain distinct from operational UI state while still serving as a shared analytical source.

---

# 18. Project Structure

The documented ecosystem contains the following major areas:

```text
├── LittleShop/             # Main VyaparSync/Little Shop application
│   ├── src/
│   ├── index.html
│   └── vite.config.js
│
├── customer-app/           # Secondary customer application
│   ├── src/
│   ├── index.html
│   └── vite.config.ts
│
├── inventory/              # Legacy inventory server
│   ├── app.js
│   ├── index.html
│   ├── inventory.json
│   ├── server.js
│   └── style.css
│
├── telegram-bot/           # External commerce bots
│   ├── telegram-bot-customer/
│   │   ├── bot.ts
│   │   ├── cart.ts
│   │   ├── customer.ts
│   │   ├── data.ts
│   │   ├── export_parquet.py
│   │   └── customers.json
│   │
│   └── telegram-bot-delivery/
│       ├── bot.ts
│       ├── agents.json
│       └── parquet_reader.py
│
├── customer_data.parquet
└── customer_data.csv
```

The current Little Shop application additionally contains shared concepts/modules such as:

```text
Dashboard
Ledger
Inventory
AI Insights
Scanner
Voice Commerce
Queue
Info Gate
Transaction UI
Memory / PKDB
Data Lake / Sync
```

The exact physical folder structure may evolve as the application is developed.

---

# 19. Data Flow Across the Ecosystem

```text
                    +----------------------+
                    |      Dashboard       |
                    +----------+-----------+
                               |
             +-----------------+-----------------+
             |                 |                 |
             v                 v                 v
         Inventory          Scanner        Voice Commerce
             |                 |                 |
             +-----------------+-----------------+
                               |
                               v
                         +-----------+
                         | Info Gate |
                         +-----+-----+
                               |
                    +----------+----------+
                    |                     |
                    v                     v
               Memory / PKDB          Internet
                                          |
                              +-----------+-----------+
                              |                       |
                              v                       v
                           Gemini                   Queue
                              |
                              v
                      Transaction UI
                              |
                            Accept
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
       Ledger            Inventory            Data Lake
          |                   |                   |
          +-------------------+-------------------+
                              |
                              v
                         Memory / PKDB


              Telegram Customer Bot
                       |
                       v
                 Customer Order
                       |
                       v
                 Live Inventory
                       |
                       +-------> Data Lake
                       |
                       v
             Telegram Delivery Bot
                       |
                       v
                  Rider Delivery
```

---

# 20. Data Integrity Principles

1. **AI is not the source of truth.**
   Databases, operational records, and Memory / PKDB are authoritative.

2. **Existing knowledge has priority.**
   Do not call AI unnecessarily when known information exists.

3. **Exact lookup comes before AI enrichment.**

4. **Offline AI work is queued.**

5. **Multi-item transactions remain atomic.**
   One purchase/sale containing several products is one transaction.

6. **Inventory and knowledge are different.**
   Removing stock does not automatically erase product knowledge.

7. **Customer cancellation must restore stock safely.**

8. **Synchronization must not create duplicates.**

9. **AI-generated interpretations must be reviewable before final persistence when the workflow requires user confirmation.**

10. **Shared business logic belongs in shared systems.**
    Avoid creating independent implementations of Info Gate, Queue, Transaction UI, or synchronization.

---

# 21. UI / Design System

The application uses a cohesive dark professional design.

Primary palette:

**Deep Teal + Warm Amber + Cream + White**

The interface should feel:

- Professional
- Modern
- Polished
- Restrained
- Responsive
- Tactile
- Cohesive

Visual design should use centralized design tokens rather than arbitrary per-component styling.

## Motion

The shared motion system covers:

- Dropdown expansion
- Arrow rotation
- Modal opening/closing
- Accordion expansion/collapse
- Button press feedback
- Card elevation
- Page transitions
- Loading indicators
- AI processing states
- Queue states
- Scanner states
- Voice states

Animations should be fast, subtle, intentional, and consistent.

Reduced-motion preferences should be respected.

---

# 22. Development Guidelines

1. Inspect the existing architecture before changing it.
2. Reuse shared components.
3. Avoid duplicated business logic.
4. Keep AI workflows centralized.
5. Do not bypass Info Gate.
6. Do not bypass Queue when offline processing is required.
7. Do not make Gemini the source of truth.
8. Preserve transaction atomicity.
9. Preserve existing data relationships.
10. Do not create duplicate Ledger entries for individual items in one transaction.
11. Keep operational data separate from analytical data where appropriate.
12. Prefer small, coordinated changes over large rewrites.
13. Avoid mock implementations in production paths.
14. Keep UI changes separate from business-logic changes where possible.
15. Preserve synchronization integrity between operational modules and the Data Lake.

## Architecture rule

Before implementing a new workflow, ask:

> **Should this be another isolated module, or should it use an existing shared system?**

Prefer existing shared systems:

- Transaction UI
- Info Gate
- Queue
- Memory / PKDB
- Data Lake
- Synchronization layer

---

# 23. Quick Start — Documented Legacy Ecosystem

The original VyaparSync documentation specifies the following prerequisites:

- Node.js v18+
- Python 3.9+
- `pandas`
- `pyarrow`
- Telegram Bot Tokens

## Environment

Copy `.env.example` into both Telegram bot directories and configure the required tokens.

```bash
cp telegram-bot/telegram-bot-customer/.env.example telegram-bot/telegram-bot-customer/.env
cp telegram-bot/telegram-bot-delivery/.env.example telegram-bot/telegram-bot-delivery/.env
```

## Install dependencies

```bash
# Inventory server
cd inventory && npm install && cd ..

# Customer bot
cd telegram-bot/telegram-bot-customer && npm install && cd ../..

# Delivery bot
cd telegram-bot/telegram-bot-delivery && npm install && cd ../..
```

## Run the documented ecosystem

```bash
# Inventory server
cd inventory && node server.js

# Customer bot
cd telegram-bot/telegram-bot-customer && npx tsx bot.ts

# Delivery agent bot
cd telegram-bot/telegram-bot-delivery && npx tsx bot.ts
```

The inventory server was documented on port `3500`.

> These commands describe the previously documented VyaparSync ecosystem. The current Little Shop application may use a different development server and folder structure.

---

# 24. Project Philosophy

Little Shop / VyaparSync is intended to behave like a coherent retail operating system rather than a collection of unrelated forms and scripts.

The core Little Shop loop is:

```text
INPUT
  |
RESOLVE
  |
REVIEW
  |
CONFIRM
  |
STORE
  |
SYNC
  |
UNDERSTAND
```

The wider commerce loop is:

```text
CUSTOMER
   |
ORDER
   |
INVENTORY
   |
DISPATCH
   |
DELIVERY
   |
FEEDBACK
   |
ANALYTICS
```

Together:

```text
                  RETAIL ECOSYSTEM
                         |
        +----------------+----------------+
        |                                 |
   SHOP OPERATIONS                  CUSTOMER COMMERCE
        |                                 |
   Info Gate                         Telegram Bot
        |                                 |
   Transaction UI                    Order
        |                                 |
   Ledger / Inventory               Inventory
        |                                 |
   Data Lake <----------------------+
        |
   AI Insights
        |
   Business Decisions
```

The goal is simple:

> **One ecosystem, one shared understanding of the business, many ways to interact with it.**

---

# Team

**Team OBSIDIAN**
