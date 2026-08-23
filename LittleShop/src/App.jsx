import React from 'react';
import pluginManager from './host/PluginManager';
import AppShell from './host/AppShell';
import dataLake from './datalake/Database';

// Import Plugins
import LedgerPlugin from './plugins/ledger/LedgerPlugin';
import AiInsightsPlugin from './plugins/insights/AiInsightsPlugin';
import ScannerPlugin from './plugins/scanner/ScannerPlugin';
import InventoryPlugin from './plugins/inventory/InventoryPlugin';
import VoiceCommercePlugin from './plugins/voice-commerce/VoiceCommercePlugin';
import QueuePlugin from './plugins/queue/QueuePlugin';

import { seedKnowledgeBase } from './datalake/seedKnowledge';

// Initialize PluginManager
pluginManager.initialize(dataLake);
seedKnowledgeBase(dataLake);

// Register Plugins
pluginManager.register(LedgerPlugin);
pluginManager.register(InventoryPlugin);
pluginManager.register(AiInsightsPlugin);
pluginManager.register(ScannerPlugin);
pluginManager.register(VoiceCommercePlugin);
pluginManager.register(QueuePlugin);

function App() {
  return <AppShell />;
}

export default App;
