# HACQUIRE 2026 

A modular, desktop-first business management platform built for small shopkeepers.

## What is HACQUIRE?
HACQUIRE is designed to replace the traditional pen-and-paper Khata. It serves as a unified **Business Decision System** by tracking finances, inventory, suppliers, and generating actionable insights—all powered by a local-first DataLake and a multimodal AI OCR engine.

## Core Modules
The application is built on a modular plugin architecture:
*   **Ledger (Khata)**: The financial heartbeat. Records all IN and OUT transactions.
*   **Inventory**: Event-sourced stock management. Automatically calculates stock levels purely from Ledger and Purchase Order movements.
*   **Supplier**: Tracks vendor purchases, purchase orders, and outstanding payments.
*   **Bill OCR**: Uses Google Gemini to visually extract complex transactions from physical bills and inject them straight into the Ledger.
*   **Insights**: The analytical brain. Reads the DataLake in real-time to track Profit & Loss, Money Flow, and Best Sellers, and generates actionable alerts.

## Architecture Highlights
*   **Host + PluginManager**: A clean separation of concerns. Modules expose their own UI, Routes, and Dashboard Widgets.
*   **DataLake (Dexie.js / IndexedDB)**: The Single Source of Truth. No duplicate databases.
*   **Event Sourcing**: Stock levels and outstanding balances are derived dynamically from transaction history. A ledger edit instantaneously updates everything!

## Running Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```
   *Access the app at http://localhost:5173*

3. **Build for Production**
   ```bash
   npm run build
   ```

## Environment Variables
To use the Bill OCR functionality, you must configure a Google Gemini API Key.
Create a `.env` file based on `.env.example`:
```
VITE_GEMINI_API_KEY=your_key_here
```
*(Note: You can also enter the key directly in the UI under the Bill OCR tab for localized hackathon setups!)*

## Quick Demo Flow
1. **Initialize**: Open the Dashboard (`/`).
2. **Setup**: Go to `Inventory` and add a product (e.g., Maggi 70g) with a cost and selling price.
3. **Supply**: Go to `Suppliers`, create a vendor, create a Purchase Order for Maggi, and click "Receive Goods". Watch the inventory increase!
4. **The Magic OCR**: Go to `Scan Bill`. Upload a messy handwritten bill. Let Gemini extract the items. Review the structured JSON and hit "Confirm All".
5. **The Cascade**: Go to the Dashboard. Watch your Actionable Insights, Profit Margin, Revenue, and Inventory perfectly reflect the scanned bill!
