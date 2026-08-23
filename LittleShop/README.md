# Little Shop

A modular, desktop-first business management platform built for small shopkeepers.

## What is Little Shop?
Little Shop serves as a unified Business Decision System, replacing the traditional pen-and-paper Khata. It tracks finances and inventory using a local-first DataLake, integrating multimodal AI tools (like Voice Commerce and receipt scanning) for seamless data entry.

## Major Modules
The application uses a modular architecture containing:

*   **Info Gate**: The primary entry point for AI understanding.
*   **Memory / PKDB**: Product Knowledge Database containing aliases and standardized product entries.
*   **Transaction UI**: The user interface for confirming and managing transactions before they are finalized.
*   **Queue**: A staging area for background tasks and asynchronous processing.
*   **Inventory**: Event-sourced stock management derived from transactions.
*   **Ledger**: Records all IN and OUT financial/inventory transactions.
*   **Scanner**: Extracts transaction structured data visually from receipts.
*   **Voice Commerce**: Extracts strict JSON intents from spoken transcripts (Hindi/English).
*   **AI Insights**: Analyzes the DataLake in real-time to generate actionable business intelligence.
*   **Data Lake**: The single source of truth (IndexedDB/Dexie.js).
*   **Sync**: Synchronization capabilities for cross-device state management.

*(Note: External commerce components may only be partially mocked for demonstration purposes depending on active plugins)*

## Running Locally

1. **Prerequisites**
   Ensure you have Node.js and npm installed.

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Copy `.env.example` to `.env` and fill in your API keys (e.g., Gemini API Key for Scanner and Voice Commerce).
   ```bash
   cp .env.example .env
   ```
   *(Alternatively, keys can be entered safely via the application UI and are stored securely in browser LocalStorage)*

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   *Access the app at http://localhost:5173*

5. **Build for Production**
   ```bash
   npm run build
   ```
