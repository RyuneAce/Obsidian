/**
 * ShopkeeperPlugin conceptually defines the contract for all plugins.
 * Since JavaScript doesn't have strict interfaces, we document it here.
 * 
 * @typedef {Object} ShopkeeperPlugin
 * @property {string} pluginId - Unique identifier for the plugin (e.g., "ledger").
 * @property {string} name - Human-readable name.
 * @property {string} version - Plugin version.
 * @property {function(import("../datalake/Database").default): void} initialize - Called on boot with the DataLake instance.
 * @property {Array<{path: string, component: React.ComponentType}>} routes - Optional UI routes the plugin provides.
 * @property {Array<{id: string, component: React.ComponentType, gridArea?: string}>} dashboardWidgets - Optional widgets to render on the dashboard.
 */

export {};
