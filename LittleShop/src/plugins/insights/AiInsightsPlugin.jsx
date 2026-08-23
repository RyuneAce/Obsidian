import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Brain, MessageSquare, AlertTriangle, TrendingUp, Package, DollarSign, WifiOff, Send, X, ChevronUp, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAiInsightsEngine } from './AiInsightsEngine';
import { AiChatService } from './AiChatService';

// --- Internet Connection Hook ---
function useInternetStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}

// --- Modals ---
function OfflineModal() {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass widget-card" style={{ padding: '32px', textAlign: 'center', maxWidth: '400px' }}>
        <WifiOff size={48} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
        <h2 style={{ marginBottom: '8px' }}>Internet connection required</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
          AI Insights needs an internet connection to analyze your business data and generate responses.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );
}

// --- What I Noticed Section ---
function WhatINoticed({ notices }) {
  if (!notices || notices.length === 0) return null;
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>What I Noticed</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {notices.map((n, i) => (
          <div key={i} className="glass" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: `4px solid var(--${n.type})`, borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
            {n.type === 'danger' ? <AlertTriangle size={20} style={{ color: 'var(--danger)' }} /> : 
             n.type === 'warning' ? <Package size={20} style={{ color: 'var(--warning)' }} /> : 
             <TrendingUp size={20} style={{ color: 'var(--success)' }} />}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{n.message}</div>
              {n.details && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{n.details.slice(0, 3).join(', ')}{n.details.length > 3 ? ` + ${n.details.length - 3} more` : ''}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Chat Drawer ---
function AiChatDrawer({ chatService, engineData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);

  const starters = [
    "What's happening in my shop?",
    "Which products should I restock?",
    "Why did my profit change?",
    "Show me unusual activity."
  ];

  const handleSend = async (text) => {
    if (!text.trim() || isThinking) return;
    
    const question = text.trim();
    setInput('');
    setHistory(prev => [...prev, { role: 'user', text: question }]);
    setIsOpen(true);
    setIsThinking(true);

    try {
       const answer = await chatService.askQuestion(question, engineData);
       setHistory(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (e) {
       setHistory(prev => [...prev, { role: 'ai', text: e.message || "An error occurred." }]);
    } finally {
       setIsThinking(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isThinking, isOpen]);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '260px', right: 0, zIndex: 1000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none'
    }}>
      <div style={{
        width: '100%', maxWidth: '800px', pointerEvents: 'auto',
        background: 'var(--bg-dark)', borderTop: '1px solid var(--accent)',
        borderLeft: '1px solid var(--accent)', borderRight: '1px solid var(--accent)',
        borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', transition: 'height 0.3s ease',
        display: 'flex', flexDirection: 'column',
        height: isOpen ? '60vh' : '64px',
        overflow: 'hidden'
      }}>
        {/* Header Toggle */}
        <div 
          onClick={() => setIsOpen(!isOpen)}
          style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold' }}>
            <MessageSquare size={20} style={{ color: 'var(--accent)' }}/> Ask AI Insights anything...
          </div>
          {isOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </div>

        {/* Expanded Chat Area */}
        {isOpen && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {history.length === 0 ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                   <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Suggested questions:</div>
                   {starters.map((s, i) => (
                     <button key={i} onClick={() => handleSend(s)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '16px', padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: '13px' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                       {s}
                     </button>
                   ))}
                 </div>
               ) : (
                 history.map((msg, i) => (
                   <div key={i} className="markdown-body" style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', maxWidth: '80%', fontSize: '14px', lineHeight: '1.5' }}>
                     {msg.role === 'ai' && <Brain size={14} style={{ marginBottom: '8px', color: 'var(--accent)' }}/>}
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                   </div>
                 ))
               )}
               {isThinking && (
                 <div style={{ alignSelf: 'flex-start', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', padding: '12px', fontStyle: 'italic' }}>
                   Analyzing your shop...
                 </div>
               )}
               <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              <form onSubmit={e => { e.preventDefault(); handleSend(input); }} style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  placeholder="Ask a question..." 
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'white', outline: 'none' }}
                />
                <button type="submit" disabled={!input.trim() || isThinking} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !isThinking ? 'pointer' : 'not-allowed', opacity: input.trim() && !isThinking ? 1 : 0.5 }}>
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---
function AiInsightsPage({ dataLake }) {
  const isOnline = useInternetStatus();
  const engineData = useAiInsightsEngine(dataLake);
  const geminiKey = localStorage.getItem('gemini_api_key');
  const chatService = useMemo(() => new AiChatService(geminiKey), [geminiKey]);



  if (!isOnline) {
    return <OfflineModal />;
  }

  return (
    <div className="page-container" style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
        <Brain size={32} style={{ color: 'var(--accent)' }} />
        <h2 className="page-title" style={{ margin: 0 }}>AI Insights</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Understand what's happening in your shop.</p>


      <div>
        <div>
          <WhatINoticed notices={engineData.notices} />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
             <div className="glass widget-card" style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase' }}>Last 7 Days - Money</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span>Sales</span><span style={{ color: 'var(--success)' }}>₹{engineData.money.last7Days.sales}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                   <span>Purchases</span><span style={{ color: 'var(--danger)' }}>₹{engineData.money.last7Days.purchases}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                   <span>Net Flow</span><span>₹{engineData.money.last7Days.net}</span>
                </div>
             </div>
             
             <div className="glass widget-card" style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase' }}>Current Inventory</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span>Total Products Active</span><span>{engineData.inventory.totalActive}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span>Out of Stock</span><span style={{ color: 'var(--danger)' }}>{engineData.inventory.outOfStockCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span>Low Stock</span><span style={{ color: 'var(--warning)' }}>{engineData.inventory.lowStockCount}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      <AiChatDrawer chatService={chatService} engineData={engineData} />
    </div>
  );
}

const AiInsightsPlugin = {
  pluginId: 'ai-insights',
  name: 'AI Insights',
  version: '3.0.0',
  icon: Brain,
  initialize: () => {},
  routes: [
    { path: '/insights', label: 'AI Insights', component: AiInsightsPage }
  ],
  dashboardWidgets: []
};

export default AiInsightsPlugin;
