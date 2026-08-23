# HACQUIRE 2026 - Architecture Documentation

HACQUIRE relies on a strictly modular architecture. It is built to ensure the core logic scales safely without coupling the user interface to isolated data stores.

## 1. The Core Layers

### The Host (`AppShell.jsx`, `Dashboard.jsx`)
The Host application does **not** contain business logic. Its sole responsibilities are:
1. Bootstrapping the application.
2. Initializing the DataLake.
3. Providing the visual shell (Sidebar, Theme).
4. Calling `PluginManager` to dynamically load registered routes and dashboard widgets.

### The PluginManager (`PluginManager.js`)
A lightweight registry that handles plugin lifecycles.
*   **Contract**: Every plugin must export `pluginId`, `name`, `version`, `initialize(dataLake)`, `routes`, and `dashboardWidgets`.
*   **Decoupling**: If you delete a plugin file and remove its registration in `App.jsx`, the Host survives without crashing.

### The DataLake (`Database.js`)
The Single Source of Truth, powered by `Dexie.js` over IndexedDB.
*   **Persistence**: Data survives browser refreshes and application restarts.
*   **Schema (v6)**: Defines `ledger`, `inventory`, `inventoryMovements`, `suppliers`, `purchaseOrders`, `pluginSettings`, and `productKnowledgeRegistry`.
*   **No Duplicates**: A product in the Ledger is the exact same concept as a product in Inventory.

---

## 2. Event Sourcing & Cross-Module Communication

To prevent state drift (e.g., Inventory saying you have 10 items, but Ledger says you sold 15), HACQUIRE uses reactive event sourcing:

*   **Ledger is the Master**: Financial events and item movements are stored as immutable arrays inside `Ledger` transactions or `Purchase Orders`.
*   **Inventory is Derived**: The `InventoryPlugin` does not store a hardcoded "stock quantity" integer in a database table that requires manual syncing. Instead, it uses a `useMemo` calculation over a live query of `dataLake.ledger`. It dynamically adds Purchase quantities and subtracts Sale quantities. **If a Ledger transaction is edited or deleted, the Inventory instantly self-corrects.**
*   **Insights is Read-Only**: The Insights Engine only aggregates existing data. It does not store "monthly revenue". It calculates it dynamically based on the current Date Range filter.

---

## 3. Bill OCR Integration

The OCR Engine (`BillOcrPlugin.jsx`) connects the physical world to the DataLake.
1. **Extraction**: Gemini 3.5 Flash Lite accepts an image and a strict JSON schema.
2. **Parsing**: The backend ensures it identifies multiple unique parties and line-items.
3. **Review**: The User intercepts the payload and corrects edge cases in a split-screen UI.
4. **Commitment**: Upon confirmation, the plugin maps the JSON directly into standard Ledger transactions. 
5. **Cascade**: Because of the Event Sourced architecture, committing an OCR bill automatically updates the Insights Engine and Inventory stock levels without any extra code!

---

## 4. Extending the Application (Adding a Plugin)

To add a new plugin (e.g., `LoyaltyPlugin`):
1. Create `src/plugins/loyalty/LoyaltyPlugin.jsx`.
2. Adhere to the Plugin Contract (export routes, widgets, etc).
3. Import and `pluginManager.register(LoyaltyPlugin)` inside `App.jsx`.
5. Ensure it only queries the `dataLake` and doesn't build a disconnected database.

---

## 5. Product Knowledge Registry & Synchronization

To support advanced product identification (like AI-based alias matching) without tightly coupling plugins, HACQUIRE implements a synchronized Product Knowledge Registry.

1. **Inventory Plugin Ownership**: The `Inventory` plugin is the **authoritative owner** of product hierarchies, categories, families, brands, and aliases. It stores these in its own private, isolated database (`InventoryDatabase.js`).
2. **Synchronization**: Whenever the Inventory plugin is seeded or a new alias is proposed, it performs a one-way synchronization to the `DataLake`. It projects its internal relational data into a flattened `productKnowledgeRegistry` table.
3. **Shared Consumption**: Other plugins (like `Voice Commerce` and `Scanner`) consume this knowledge purely through the DataLake via `SharedProductResolver.js`. They do not import Inventory's internal databases.
4. **Alias Proposals**: If a plugin (e.g., Voice Commerce) wants to add an alias after user confirmation, it emits a `PROPOSE_ALIAS` event. The Inventory plugin listens, updates its authoritative database, and re-syncs to the DataLake, maintaining strict data flow architecture.
