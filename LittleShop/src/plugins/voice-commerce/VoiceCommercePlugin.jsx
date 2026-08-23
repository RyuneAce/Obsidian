import React from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceCommercePage from './VoiceCommercePage';
import { MessageSquare, Mic } from 'lucide-react';

function VoiceCommerceWidget() {
  const navigate = useNavigate();
  
  return (
    <div className="glass widget-card" style={{ border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} /> Voice Commerce
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>Quick voice entry</p>
        </div>
        <button onClick={() => navigate('/voice-commerce?record=true')} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mic size={16} /> Record
        </button>
      </div>
    </div>
  );
}

const VoiceCommercePlugin = {
  pluginId: 'voice-commerce',
  name: 'Voice Commerce',
  version: '2.0.0',
  initialize: () => {},
  routes: [{ path: '/voice-commerce', label: 'Voice Commerce', component: ({ dataLake }) => <VoiceCommercePage dataLake={dataLake} /> }],
  dashboardWidgets: []
};

export default VoiceCommercePlugin;
