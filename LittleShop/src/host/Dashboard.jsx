import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Mic, AlertTriangle, Package, ArrowRight, ArrowLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import voiceDb from '../plugins/voice-commerce/VoiceDatabase';

const formatCurrency = (amount) => `₹${Number(amount).toLocaleString('en-IN')}`;

// --- Data Helpers ---
function getLocalDayStartEnd() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000 - 1;
    return { start, end };
}

// --- Action / Attention Widget ---
function ActionAttentionWidget({ dataLake }) {
    const navigate = useNavigate();
    
    const inventory = useLiveQuery(() => dataLake.inventory.toArray(), []) || [];
    const queueJobs = useLiveQuery(() => dataLake.queueJobs.toArray(), []) || [];
    const voiceRecordings = useLiveQuery(() => voiceDb.recordings.toArray(), []) || [];
    const activeInv = inventory.filter(i => i.status !== 'DELETED').map(i => ({
        ...i,
        calculatedStock: i.currentStock || 0
    }));
    
    const actions = [];
    const realOutOfStock = activeInv.filter(i => i.calculatedStock <= 0);
    const realLowStock = activeInv.filter(i => i.calculatedStock > 0 && i.calculatedStock <= (i.minStock || 5));

    if (realOutOfStock.length > 0) {
        actions.push({ text: `${realOutOfStock.length} products are out of stock`, icon: <AlertTriangle size={16}/>, color: 'var(--danger)', link: '/inventory' });
    } else if (realLowStock.length > 0) {
        actions.push({ text: `${realLowStock.length} products low on stock`, icon: <Package size={16}/>, color: 'var(--warning)', link: '/inventory' });
    }

    const pendingQueue = queueJobs.filter(j => j.status === 'PENDING' || j.status === 'ERROR');
    if (pendingQueue.length > 0) {
        actions.push({ text: `${pendingQueue.length} items waiting in Queue`, icon: <Clock size={16}/>, color: 'var(--accent)', link: '/queue' });
    }

    const pendingVoice = voiceRecordings.filter(v => v.status !== 'SAVED' && v.status !== 'ERROR');
    if (pendingVoice.length > 0) {
        actions.push({ text: `${pendingVoice.length} voice entries processing or ready`, icon: <Mic size={16}/>, color: 'var(--accent)', link: '/voice-commerce' });
    }

    if (actions.length === 0) {
        return (
            <div className="glass widget-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--success)' }}>
                <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>All caught up!</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nothing requires your immediate attention.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass widget-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Requires Attention</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {actions.map((act, i) => (
                    <div key={i} onClick={() => navigate(act.link)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: i < actions.length - 1 ? '1px solid var(--border)' : 'none', background: 'rgba(255,255,255,0.02)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                        <div style={{ color: act.color }}>{act.icon}</div>
                        <div style={{ fontSize: '14px', flex: 1 }}>{act.text}</div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Today's Business Snapshot Widget ---
function TodaySnapshotWidget({ dataLake }) {
    const [viewIndex, setViewIndex] = useState(0);
    const allLedger = useLiveQuery(() => dataLake.ledger.toArray(), []) || [];
    
    const { start, end } = getLocalDayStartEnd();
    const todaysTxns = allLedger.filter(t => t.timestamp >= start && t.timestamp <= end);
    
    const sales = todaysTxns.filter(t => t.transactionType === 'SALE').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const purchases = todaysTxns.filter(t => t.transactionType === 'PURCHASE').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const net = sales - purchases;

    const views = [
        { label: 'SALES', value: formatCurrency(sales), color: 'var(--success)' },
        { label: 'PURCHASES', value: formatCurrency(purchases), color: 'var(--danger)' },
        { label: 'NET', value: formatCurrency(net), color: net >= 0 ? 'var(--success)' : 'var(--danger)' }
    ];

    const handleNext = () => setViewIndex((prev) => (prev + 1) % views.length);
    const handlePrev = () => setViewIndex((prev) => (prev - 1 + views.length) % views.length);

    const currentView = views[viewIndex];

    return (
        <div className="glass widget-card" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px' }}>TODAY</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '1px' }}>{currentView.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentView.color, margin: '8px 0 16px 0' }}>{currentView.value}</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button className="btn" onClick={handlePrev} style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}><ArrowLeft size={16} /></button>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {views.map((_, i) => (
                        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === viewIndex ? 'var(--accent)' : 'var(--border)' }} />
                    ))}
                </div>
                <button className="btn" onClick={handleNext} style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}><ArrowRight size={16} /></button>
            </div>
        </div>
    );
}

// --- Inventory Snapshot Widget ---
function InventorySnapshotWidget({ dataLake }) {
    const [viewIndex, setViewIndex] = useState(0);
    const inventory = useLiveQuery(() => dataLake.inventory.toArray(), []) || [];
    const activeInv = inventory.filter(i => i.status !== 'DELETED').map(i => ({
        ...i,
        calculatedStock: i.currentStock || 0
    }));
    
    const totalProducts = activeInv.length;
    const outOfStock = activeInv.filter(i => i.calculatedStock <= 0).length;
    const lowStock = activeInv.filter(i => i.calculatedStock > 0 && i.calculatedStock <= (i.minStock || 5)).length;
    const totalQuantity = activeInv.reduce((sum, i) => sum + Math.max(0, i.calculatedStock), 0);

    const views = [
        { label: 'OUT OF STOCK', value: outOfStock, color: outOfStock > 0 ? 'var(--danger)' : 'var(--success)' },
        { label: 'LOW STOCK', value: lowStock, color: lowStock > 0 ? 'var(--warning)' : 'var(--success)' },
        { label: 'TOTAL PRODUCTS', value: totalProducts, color: 'white' },
        { label: 'STOCK QUANTITY', value: totalQuantity, color: 'white' }
    ];

    const handleNext = () => setViewIndex((prev) => (prev + 1) % views.length);
    const handlePrev = () => setViewIndex((prev) => (prev - 1 + views.length) % views.length);

    const currentView = views[viewIndex];

    return (
        <div className="glass widget-card" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px' }}>INVENTORY</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '1px' }}>{currentView.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentView.color, margin: '8px 0 16px 0' }}>{currentView.value}</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button className="btn" onClick={handlePrev} style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}><ArrowLeft size={16} /></button>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {views.map((_, i) => (
                        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === viewIndex ? 'var(--accent)' : 'var(--border)' }} />
                    ))}
                </div>
                <button className="btn" onClick={handleNext} style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}><ArrowRight size={16} /></button>
            </div>
        </div>
    );
}

// --- Recent Activity Widget ---
function RecentActivityWidget({ dataLake }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const allLedger = useLiveQuery(() => dataLake.ledger.orderBy('timestamp').reverse().toArray(), []) || [];
    
    // Recent finalized transactions only
    const recentTxns = allLedger.slice(0, 3);
    const expandedTxns = allLedger.slice(0, 15);

    return (
        <>
            <div className="glass widget-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recent Activity</span>
                   {allLedger.length > 3 && (
                       <button onClick={() => setIsExpanded(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>View More</button>
                   )}
                </div>
                
                {recentTxns.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No recent activity</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {recentTxns.map((txn, i) => (
                            <div key={txn.eventId || i} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < recentTxns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{txn.partyName || 'Unknown'}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{txn.transactionType}</div>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: txn.transactionType === 'PURCHASE' ? 'var(--danger)' : 'var(--success)' }}>
                                    {txn.transactionType === 'PURCHASE' ? '-' : '+'}{formatCurrency(txn.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Expansion Modal Overlay */}
            {isExpanded && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }} onClick={() => setIsExpanded(false)}>
                    <div className="glass" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Recent Transactions</h3>
                            <button onClick={() => setIsExpanded(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            {expandedTxns.map((txn, i) => (
                                <div key={txn.eventId || i} style={{ padding: '12px', marginBottom: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{txn.partyName || 'Unknown'}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {txn.transactionType} &bull; {new Date(txn.timestamp).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: txn.transactionType === 'PURCHASE' ? 'var(--danger)' : 'var(--success)' }}>
                                        {txn.transactionType === 'PURCHASE' ? '-' : '+'}{formatCurrency(txn.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// --- Floating Capture Capsule ---
function CaptureCapsule() {
    const navigate = useNavigate();

    return (
        <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', zIndex: 900, display: 'flex', background: 'var(--bg-dark)', borderRadius: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid var(--accent)', overflow: 'hidden' }}>
            <button 
                onClick={() => navigate('/scanner')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <Camera size={18} /> Scan Document
            </button>
            <button 
                onClick={() => navigate('/voice-commerce?record=true')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <Mic size={18} /> Voice Record
            </button>
        </div>
    );
}

// --- Main Dashboard Layout ---
export default function Dashboard({ dataLake }) {
  return (
    <div className="page-container" style={{ paddingBottom: '100px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 className="page-title">Dashboard</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Row: Attention */}
          <ActionAttentionWidget dataLake={dataLake} />

          {/* Middle Row: Snapshots (2 columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <TodaySnapshotWidget dataLake={dataLake} />
              <InventorySnapshotWidget dataLake={dataLake} />
          </div>

          {/* Bottom Row: Recent Activity */}
          <RecentActivityWidget dataLake={dataLake} />
      </div>

      <CaptureCapsule />
    </div>
  );
}
