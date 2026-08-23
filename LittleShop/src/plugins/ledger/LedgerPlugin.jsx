import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Search, Filter, Trash2, Edit2, Plus, X, User, ChevronDown, ChevronUp, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import TransactionReview from '../../components/TransactionReview';
import InfoGate from '../../components/InfoGate';
import { TransactionPersistenceService } from '../../services/TransactionPersistenceService';
import { QueueService } from '../queue/QueueService';
import Select from '../../components/ui/Select';
import AnimatedCollapse from '../../components/ui/AnimatedCollapse';
/**
 * Party Khata / Customer/Supplier History Modal
 */
function PartyKhataModal({ partyName, partyType, allTransactions, onClose }) {
  if (!partyName) return null;

  // Filter transactions exactly for this party
  const partyHistory = allTransactions.filter(t => t.partyName === partyName).sort((a,b) => b.timestamp - a.timestamp);
  
  const totalIn = partyHistory.filter(t => t.direction === 'IN').reduce((sum, t) => sum + t.amount, 0);
  const totalOut = partyHistory.filter(t => t.direction === 'OUT').reduce((sum, t) => sum + t.amount, 0);
  const net = totalIn - totalOut;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div className="glass" style={{ width: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: 'var(--bg-dark)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User /> {partyName}
            </h2>
            <div style={{ color: 'var(--text-muted)' }}>{partyType} HISTORY</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', color: 'white', border: 'none', cursor: 'pointer' }}><X size={24}/></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="glass" style={{ padding: '16px', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Money In (Purchases/Payments)</div>
            <div className="text-green" style={{ fontSize: '20px', fontWeight: 'bold' }}>+₹{totalIn}</div>
          </div>
          <div className="glass" style={{ padding: '16px', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Money Out (Refunds/Sales)</div>
            <div className="text-red" style={{ fontSize: '20px', fontWeight: 'bold' }}>-₹{totalOut}</div>
          </div>
          <div className="glass" style={{ padding: '16px', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Net Balance</div>
            <div className={net >= 0 ? 'text-green' : 'text-red'} style={{ fontSize: '20px', fontWeight: 'bold' }}>
              {net >= 0 ? '+' : '-'}₹{Math.abs(net)}
            </div>
          </div>
        </div>

        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Date</th>
              <th style={{ width: '25%' }}>Type</th>
              <th style={{ width: '25%' }}>Reference</th>
              <th style={{ width: '25%', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {partyHistory.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>No history found.</td></tr>
            ) : (
              partyHistory.map(txn => (
                <tr key={txn.eventId}>
                  <td>{new Date(txn.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{txn.transactionType}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{txn.referenceId || '—'}</td>
                  <td className={txn.direction === 'IN' ? 'text-green' : 'text-red'} style={{ textAlign: 'right', fontWeight: '600' }}>
                    {txn.direction === 'IN' ? '+' : '-'}₹{txn.amount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Compact Row
 */
function ExpandableItem({ item }) {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <div style={{ marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-elevated)' }}>
            <div 
               style={{ display: 'flex', alignItems: 'center', padding: '12px', cursor: 'pointer' }}
               onClick={() => setIsExpanded(!isExpanded)}
            >
                <div style={{ marginRight: '12px', color: 'var(--accent)' }}>
                    <ChevronDown size={18} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </div>
                <div style={{ flex: 1, fontWeight: 'bold' }}>{item.productVariantName || item.name}</div>
                <div style={{ width: '100px', textAlign: 'right', fontWeight: 'bold' }}>
                    ₹{item.totalPrice || 0}
                </div>
            </div>

            <AnimatedCollapse isOpen={isExpanded}>
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                        <div><span style={{color: 'var(--text-muted)'}}>Product Variant:</span> {item.productVariantName || item.name || '—'}</div>
                        <div><span style={{color: 'var(--text-muted)'}}>Product Family:</span> {item.productFamily || '—'}</div>
                        <div><span style={{color: 'var(--text-muted)'}}>Category:</span> {item.category || '—'}</div>
                        <div><span style={{color: 'var(--text-muted)'}}>Brand:</span> {item.brand || '—'}</div>
                        <div><span style={{color: 'var(--text-muted)'}}>Pack Size:</span> {item.packSize || '—'}</div>
                        <div><span style={{color: 'var(--text-muted)'}}>Quantity:</span> {item.quantity || 0}</div>
                        <div><span style={{color: 'var(--text-muted)'}}>Total Price:</span> ₹{item.totalPrice || 0}</div>
                    </div>
                </div>
            </AnimatedCollapse>
        </div>
    );
}

function TransactionRow({ txn, onEdit, onDelete, onPartyClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalPhysicalItems = txn.items?.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0) || 0;

  return (
    <React.Fragment>
      <tr style={{ cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td>
          {new Date(txn.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </td>
        <td style={{ fontWeight: '500' }}>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => { e.stopPropagation(); onPartyClick(txn.partyName || txn.party?.name, txn.partyType); }}>
            {txn.direction === 'IN' ? <ArrowDownCircle size={14} className="text-green" style={{marginRight:'4px'}} /> : <ArrowUpCircle size={14} className="text-red" style={{marginRight:'4px'}} />}
            <span style={{ textDecoration: 'underline dotted' }}>{txn.partyName || txn.party?.name}</span>
          </span>
        </td>
        <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{txn.transactionType}</td>
        <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{totalPhysicalItems > 0 ? `${totalPhysicalItems} items` : '—'}</td>
        <td className={txn.direction === 'IN' ? 'text-green' : 'text-red'} style={{ fontWeight: '600', textAlign: 'right' }}>
          {txn.direction === 'IN' ? '+' : '-'}₹{txn.amount || txn.grandTotal}
        </td>
        <td style={{ textAlign: 'right' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(txn); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px', marginRight: '4px' }}>
            <Edit2 size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(txn); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}>
            <Trash2 size={16} />
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan="6" style={{ padding: 0 }}>
          <AnimatedCollapse isOpen={isExpanded}>
             <div style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border)', padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px', fontSize: '14px' }}>
                    <div>
                        <div style={{color: 'var(--text-muted)'}}>Party: <span style={{color: 'white', fontWeight: 'bold'}}>{txn.partyName || txn.party?.name || '—'}</span></div>
                        <div style={{color: 'var(--text-muted)'}}>Phone: <span style={{color: 'white'}}>{txn.partyPhone || txn.party?.phone || '—'}</span></div>
                        <div style={{color: 'var(--text-muted)', marginTop: '8px'}}>Reference: <span style={{color: 'var(--accent)'}}>{txn.referenceId || '—'}</span></div>
                    </div>
                    <div>
                        <div style={{color: 'var(--text-muted)'}}>Date: <span style={{color: 'white'}}>{txn.date || new Date(txn.timestamp).toLocaleDateString()}</span></div>
                        <div style={{color: 'var(--text-muted)'}}>Time: <span style={{color: 'white'}}>{txn.time || new Date(txn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                        <div style={{color: 'var(--text-muted)', marginTop: '8px'}}>Location: <span style={{color: 'white'}}>{txn.location || '—'}</span></div>
                    </div>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '16px' }}>ITEMS</div>
                
                {txn.items && txn.items.length > 0 ? (
                    txn.items.map((item, idx) => <ExpandableItem key={idx} item={item} />)
                ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                        No items in this transaction.
                    </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }}>
                    <div style={{ width: '300px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                            <span>₹{txn.subtotal || txn.amount || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Tax</span>
                            <span>₹{(parseFloat(txn.cgst)||0) + (parseFloat(txn.sgst)||0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '18px', fontWeight: 'bold' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Grand Total</span>
                            <span className={txn.direction === 'IN' ? 'text-green' : 'text-accent'}>₹{txn.grandTotal || txn.amount || 0}</span>
                        </div>
                    </div>
                </div>
             </div>
          </AnimatedCollapse>
        </td>
      </tr>
    </React.Fragment>
  );
}

/**
 * Main Ledger View
 */
function LedgerView({ dataLake }) {
  const allTransactions = useLiveQuery(() => dataLake.ledger.toArray(), []) || [];
  const queueService = useMemo(() => new QueueService(dataLake), [dataLake]);
  const [newTxnTemplate, setNewTxnTemplate] = useState(null);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDirection, setFilterDirection] = useState('ALL');
  const [filterPartyType, setFilterPartyType] = useState('ALL');
  const [filterTxnType, setFilterTxnType] = useState('ALL');
  const [filterDate, setFilterDate] = useState('ALL'); // ALL, TODAY, WEEK, MONTH
  
  // Sort State
  const [sortBy, setSortBy] = useState('NEWEST'); // NEWEST, OLDEST, AMOUNT_DESC, AMOUNT_ASC, PARTY

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [khataParty, setKhataParty] = useState(null);

  // Filtering & Sorting Logic
  const filteredAndSorted = useMemo(() => {
    let result = allTransactions.filter(txn => {
      // 1. Search
      const searchMatch = searchTerm === '' || 
        txn.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        txn.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.eventId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.referenceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.items?.some(i => (i.name || i.productVariantName || '').toLowerCase().includes(searchTerm.toLowerCase()));
        
      // 2. Direction Filter
      const dirMatch = filterDirection === 'ALL' || txn.direction === filterDirection;

      // 3. Party Type Filter
      const partyMatch = filterPartyType === 'ALL' || txn.partyType === filterPartyType;

      // 4. Transaction Type Filter
      const txnTypeMatch = filterTxnType === 'ALL' || txn.transactionType === filterTxnType;

      // 5. Date Filter
      let dateMatch = true;
      if (filterDate !== 'ALL') {
        const now = Date.now();
        const txnDate = txn.timestamp;
        const oneDay = 24 * 60 * 60 * 1000;
        if (filterDate === 'TODAY') dateMatch = (now - txnDate) <= oneDay;
        if (filterDate === 'WEEK') dateMatch = (now - txnDate) <= oneDay * 7;
        if (filterDate === 'MONTH') dateMatch = (now - txnDate) <= oneDay * 30;
      }
      
      return searchMatch && dirMatch && partyMatch && txnTypeMatch && dateMatch;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'NEWEST': return b.timestamp - a.timestamp;
        case 'OLDEST': return a.timestamp - b.timestamp;
        case 'AMOUNT_DESC': return b.amount - a.amount;
        case 'AMOUNT_ASC': return a.amount - b.amount;
        case 'PARTY': return a.partyName.localeCompare(b.partyName);
        default: return b.timestamp - a.timestamp;
      }
    });

    return result;
  }, [allTransactions, searchTerm, filterDirection, filterPartyType, filterTxnType, filterDate, sortBy]);

  // Summaries
  const moneyIn = filteredAndSorted.filter(t => t.direction === 'IN').reduce((s,t) => s + (t.amount || t.grandTotal || 0), 0);
  const moneyOut = filteredAndSorted.filter(t => t.direction === 'OUT').reduce((s,t) => s + (t.amount || t.grandTotal || 0), 0);

  const reverseTransactionInventory = async (txnToReverse) => {
    if (!txnToReverse.items || txnToReverse.items.length === 0) return;
    
    const revDirection = txnToReverse.transactionType === 'PURCHASE' ? 'OUT' : 'IN';
    const inventory = await dataLake.inventory.toArray();
    
    for (const item of txnToReverse.items) {
      if (item.productId) {
         const existing = inventory.find(p => p.productId === item.productId);
         if (existing) {
             const qty = parseFloat(item.quantity) || 0;
             existing.currentStock = (existing.currentStock || 0) + (revDirection === 'IN' ? qty : -qty);
             await dataLake.inventory.put(existing);
         }

         await dataLake.inventoryMovements.put({
            movementId: crypto.randomUUID(),
            productId: item.productId,
            type: 'MANUAL_ADJUSTMENT',
            direction: revDirection,
            quantity: parseFloat(item.quantity) || 0,
            timestamp: Date.now(),
            notes: `Reversed from edited/deleted transaction ${txnToReverse.referenceId}`,
            rawInput: item.rawName || item.name
         });
      }
    }
  };

  const saveTransaction = async (resultOrData) => {
    const txnData = resultOrData.transaction || resultOrData;
    const type = txnData.transactionType;
    const dir = (type === 'SALE' || type === 'PAYMENT_IN') ? 'IN' : 'OUT';
    const party = (type === 'SALE' || type === 'PAYMENT_IN') ? 'CUSTOMER' : 'SUPPLIER';
    
    const finalTxn = {
       ...txnData,
       direction: dir,
       partyType: party
    };

    finalTxn.items = finalTxn.items?.filter(i => i.name || i.productVariantName || i.canonicalName) || [];

    try {
        if (editingTxn) {
            const oldTxn = await dataLake.ledger.get(txnData.eventId);
            if (oldTxn) {
                await reverseTransactionInventory(oldTxn);
            }
        }
        
        await TransactionPersistenceService.saveTransaction(dataLake, finalTxn, 'LEDGER_MANUAL');
        setModalOpen(false);
    } catch (e) {
        console.error("Failed to save ledger transaction", e);
        alert("Failed to save transaction: " + e.message);
    }
  };

  const deleteTransaction = async (txnToDelete) => {
    if (window.confirm("Delete this transaction?")) {
        if (window.confirm("Are you sure? This will remove the historical transaction and reverse its inventory effects.")) {
            await reverseTransactionInventory(txnToDelete);
            await dataLake.ledger.delete(txnToDelete.eventId);
        }
    }
  };

  const openNew = () => {
    setEditingTxn(null);
    setNewTxnTemplate({
        eventId: crypto.randomUUID(),
        transactionType: 'SALE',
        party: { name: '', phone: '' },
        referenceId: 'TXN-' + new Date().toISOString().replace(/\D/g,'').replace(/^(\d{8})(\d{6}).*/, '$1-$2'),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        location: '',
        items: [{
            productVariantName: '', productFamily: '', category: '', brand: '', packSize: '', quantity: 1, totalPrice: 0
        }],
        subtotal: 0, cgst: 0, sgst: 0, taxIncluded: true, grandTotal: 0, notes: ''
    });
    setModalOpen(true);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Digital Ledger</h2>
        <button className="btn btn-tactile" onClick={openNew}><Plus size={18} /> Add Transaction</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="glass" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Money In</div>
          <div className="text-green" style={{ fontSize: '24px', fontWeight: 'bold' }}>+₹{moneyIn}</div>
        </div>
        <div className="glass" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Money Out</div>
          <div className="text-red" style={{ fontSize: '24px', fontWeight: 'bold' }}>-₹{moneyOut}</div>
        </div>
        <div className="glass" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Net</div>
          <div className={moneyIn >= moneyOut ? 'text-green' : 'text-red'} style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {moneyIn >= moneyOut ? '+' : '-'}₹{Math.abs(moneyIn - moneyOut)}
          </div>
        </div>
      </div>

      <div className="glass">
        {/* Advanced Filters */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', flex: 1, border: '1px solid var(--border)' }}>
              <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <input 
                placeholder="Search party, item, notes, or Reference ID..." 
                style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)}
              options={[
                { value: 'NEWEST', label: 'Sort: Newest First' },
                { value: 'OLDEST', label: 'Sort: Oldest First' },
                { value: 'AMOUNT_DESC', label: 'Sort: Amount (High-Low)' },
                { value: 'AMOUNT_ASC', label: 'Sort: Amount (Low-High)' },
                { value: 'PARTY', label: 'Sort: Party Name (A-Z)' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Select 
              value={filterDirection} 
              onChange={e => setFilterDirection(e.target.value)}
              options={[
                { value: 'ALL', label: 'Direction: All' },
                { value: 'IN', label: 'Direction: Money In' },
                { value: 'OUT', label: 'Direction: Money Out' },
              ]}
            />
            <Select 
              value={filterPartyType} 
              onChange={e => setFilterPartyType(e.target.value)}
              options={[
                { value: 'ALL', label: 'Party: All' },
                { value: 'CUSTOMER', label: 'Party: Customers' },
                { value: 'SUPPLIER', label: 'Party: Suppliers' },
              ]}
            />
            <Select 
              value={filterTxnType} 
              onChange={e => setFilterTxnType(e.target.value)}
              options={[
                { value: 'ALL', label: 'Type: All' },
                { value: 'SALE', label: 'Type: Sales' },
                { value: 'PURCHASE', label: 'Type: Purchases' },
                { value: 'PAYMENT_IN', label: 'Type: Payments Received' },
                { value: 'PAYMENT_OUT', label: 'Type: Payments Sent' },
                { value: 'ADJUSTMENT', label: 'Type: Adjustments' },
                { value: 'CREDIT', label: 'Type: Credit' },
              ]}
            />
            <Select 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)}
              options={[
                { value: 'ALL', label: 'Date: All Time' },
                { value: 'TODAY', label: 'Date: Last 24 Hours' },
                { value: 'WEEK', label: 'Date: Last 7 Days' },
                { value: 'MONTH', label: 'Date: Last 30 Days' },
              ]}
            />
          </div>
        </div>

        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Date</th>
              <th style={{ width: '25%' }}>Party</th>
              <th style={{ width: '15%' }}>Type</th>
              <th style={{ width: '15%' }}>Items</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Amount</th>
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  {allTransactions.length === 0 ? (
                    <div>
                      <div style={{ marginBottom: '8px' }}>No transactions yet.</div>
                      <div style={{ fontSize: '14px' }}>Start by adding a transaction or scan a bill on the dashboard.</div>
                    </div>
                  ) : 'No transactions match your search and filter criteria.'}
                </td>
              </tr>
            ) : (
              filteredAndSorted.map(txn => (
                <TransactionRow 
                  key={txn.eventId} 
                  txn={txn} 
                  onEdit={(t) => { setEditingTxn(t); setModalOpen(true); }}
                  onDelete={deleteTransaction}
                  onPartyClick={(name, type) => setKhataParty({ name, type })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && editingTxn && (
        <TransactionReview 
          isOpen={modalOpen} 
          onCancel={() => setModalOpen(false)} 
          onConfirm={saveTransaction}
          initialTransaction={editingTxn}
          isEditing={true}
          key={editingTxn.eventId} 
        />
      )}

      {modalOpen && !editingTxn && newTxnTemplate && (
        <InfoGate
          initialTransaction={newTxnTemplate}
          dataLake={dataLake}
          queueService={queueService}
          onComplete={saveTransaction}
          onCancel={() => setModalOpen(false)}
        />
      )}

      {khataParty && (
        <PartyKhataModal 
          partyName={khataParty.name} 
          partyType={khataParty.type}
          allTransactions={allTransactions}
          onClose={() => setKhataParty(null)} 
        />
      )}
    </div>
  );
}

const LedgerPlugin = {
  pluginId: 'ledger',
  name: 'Digital Ledger',
  version: '2.5.0',
  initialize: (dataLake) => {},
  routes: [{ path: '/ledger', component: ({ dataLake }) => <LedgerView dataLake={dataLake} /> }],
  dashboardWidgets: []
};

export default LedgerPlugin;
