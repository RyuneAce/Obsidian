class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.routes = [];
    this.widgets = [];
    this.dataLake = null;
  }

  initialize(dataLake) {
    this.dataLake = dataLake;
    console.log("PluginManager initialized with DataLake.");
  }

  register(plugin) {
    if (this.plugins.has(plugin.pluginId)) {
      console.warn(`Plugin ${plugin.pluginId} is already registered.`);
      return;
    }

    this.plugins.set(plugin.pluginId, plugin);
    
    // Initialize plugin with DataLake
    if (typeof plugin.initialize === 'function') {
      plugin.initialize(this.dataLake);
    }

    // Collect routes
    if (plugin.routes && Array.isArray(plugin.routes)) {
      this.routes.push(...plugin.routes);
    }

    // Collect widgets for the dashboard
    if (plugin.dashboardWidgets && Array.isArray(plugin.dashboardWidgets)) {
      this.widgets.push(...plugin.dashboardWidgets);
    }

    console.log(`Registered Plugin: ${plugin.name} v${plugin.version}`);
  }

  getRoutes() {
    return this.routes;
  }

  getDashboardWidgets() {
    return this.widgets;
  }
}

// Export a singleton instance of the PluginManager for the Host to use.
const pluginManager = new PluginManager();
export default pluginManager;
