import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import pluginManager from './PluginManager';
import Dashboard from './Dashboard';
import dataLake from '../datalake/Database';
import globalSyncManager from '../services/SyncManager';
function Sidebar() {
  const location = useLocation();
  const routes = pluginManager.getRoutes();

  return (
    <div className="sidebar">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Menu size={24} /> Little Shop
      </h1>
      <nav className="nav-links">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          Dashboard
        </Link>
        {routes.map(r => {
          const label = r.label || r.path.replace('/', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          return (
          <Link 
            key={r.path} 
            to={r.path} 
            className={`nav-link ${location.pathname === r.path ? 'active' : ''}`}
          >
            {label}
          </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Topbar() {
  const [syncState, setSyncState] = useState(globalSyncManager.getState());
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
      return globalSyncManager.subscribe(setSyncState);
  }, []);

  useEffect(() => {
     let t;
     if (syncState.status === 'COOLDOWN') {
        t = setInterval(() => setNow(Date.now()), 1000);
     }
     return () => clearInterval(t);
  }, [syncState.status]);

  let statusText = 'Synced';
  let dotColor = 'var(--accent)'; 
  
  if (syncState.status === 'SYNCING') { statusText = 'Syncing...'; dotColor = '#facc15'; }
  else if (syncState.status === 'FAILED') { statusText = 'Sync failed'; dotColor = '#f87171'; }
  else if (syncState.status === 'WARNINGS') { statusText = 'Sync completed with warnings'; dotColor = '#fb923c'; }
  else if (syncState.status === 'COOLDOWN') {
      const left = Math.ceil((syncState.cooldownEndTime - Date.now())/1000);
      statusText = left > 0 ? `Sync cooling down (${left}s)` : 'Synced';
      dotColor = '#9ca3af';
  }

  return (
    <div className="topbar glass">
      <div 
         className="status" 
         onClick={() => globalSyncManager.triggerSync()}
         style={{ 
             cursor: syncState.status === 'COOLDOWN' || syncState.isSyncing ? 'not-allowed' : 'pointer',
             opacity: syncState.status === 'COOLDOWN' ? 0.7 : 1,
             transition: 'all 0.2s',
             userSelect: 'none'
         }}
      >
        <div className="status-dot" style={{ backgroundColor: dotColor }}></div>
        {statusText}
      </div>
    </div>
  );
}

export default function AppShell() {
  const pluginRoutes = pluginManager.getRoutes();

  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        
        <div className="main-content">
          <Topbar />
          
          <Routes>
            <Route path="/" element={<Dashboard dataLake={dataLake} />} />
            
            {/* Mount all plugin routes dynamically */}
            {pluginRoutes.map(r => {
              const PluginComponent = r.component;
              return (
                <Route 
                  key={r.path} 
                  path={r.path} 
                  element={<PluginComponent dataLake={dataLake} />} 
                />
              );
            })}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
