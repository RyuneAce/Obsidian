import React, { useState, useEffect } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Trash2, X, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import Select from './ui/Select';
import AnimatedCollapse from './ui/AnimatedCollapse';

export default function TransactionReview({ initialTransaction, onConfirm, onCancel, readOnly = false, isEditing = false, isResolving = false, confirmLabel = "Confirm & Save" }) {
    const formatTxn = (inputTxn) => {
        if (!inputTxn) {
            return {
                eventId: crypto.randomUUID(),
                transactionType: 'PURCHASE',
                party: { name: '', phone: '' },
                referenceId: 'REF-' + new Date().toISOString().replace(/\D/g,'').replace(/^(\d{8})(\d{6}).*/, '$1-$2'),
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().slice(0, 5),
                location: '',
                items: [],
                subtotal: 0,
                cgst: 0,
                sgst: 0,
                taxIncluded: true,
                grandTotal: 0,
                notes: ''
            };
        }
        
        const defaultDate = inputTxn.timestamp ? new Date(inputTxn.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const defaultTime = inputTxn.timestamp ? new Date(inputTxn.timestamp).toTimeString().slice(0, 5) : new Date().toTimeString().slice(0, 5);
        
        return {
            ...inputTxn,
            eventId: inputTxn.eventId || crypto.randomUUID(),
            partyName: inputTxn.partyName || inputTxn.party?.name || '',
            partyType: inputTxn.partyType || inputTxn.party?.type || 'CUSTOMER',
            party: inputTxn.party || { name: inputTxn.partyName || '', phone: inputTxn.partyPhone || '' },
            date: inputTxn.date || defaultDate,
            time: inputTxn.time || defaultTime,
            referenceId: inputTxn.referenceId || inputTxn.eventId || ('REF-' + Date.now()),
            location: inputTxn.location || '',
            cgst: inputTxn.cgst || 0,
            sgst: inputTxn.sgst || 0,
            taxIncluded: inputTxn.taxIncluded !== undefined ? inputTxn.taxIncluded : true,
            items: inputTxn.items || [],
        };
    };

    const [txn, setTxn] = useState(() => formatTxn(initialTransaction));
    const [expandedItemIdx, setExpandedItemIdx] = useState(null);

    useEffect(() => {
        if (initialTransaction) {
            setTxn(formatTxn(initialTransaction));
        }
    }, [initialTransaction]);

    // Auto-calculate totals
    useEffect(() => {
        let itemsTotal = 0;
        txn.items.forEach(item => {
            const lineTotal = parseFloat(item.totalPrice) || 0;
            itemsTotal += lineTotal;
        });
        
        const sub = itemsTotal;
        const cgstAmt = parseFloat(txn.cgst) || 0;
        const sgstAmt = parseFloat(txn.sgst) || 0;
        const grand = txn.taxIncluded ? sub : sub + cgstAmt + sgstAmt;
        
        if (grand !== txn.grandTotal || sub !== txn.subtotal) {
            setTxn(prev => ({ ...prev, subtotal: sub, grandTotal: grand }));
        }
    }, [txn.items, txn.cgst, txn.sgst, txn.taxIncluded, txn.grandTotal, txn.subtotal]);

    const handleItemChange = (idx, field, value) => {
        if (readOnly) return;
        const newItems = [...txn.items];
        newItems[idx] = { ...newItems[idx], [field]: value };
        setTxn({ ...txn, items: newItems });
    };

    const handleRemoveItem = (idx, itemName) => {
        if (readOnly || !isEditing) return;
        if (window.confirm(`Are you sure you want to remove ${itemName || 'this item'} from this transaction?`)) {
            const newItems = txn.items.filter((_, i) => i !== idx);
            setTxn({ ...txn, items: newItems });
            if (expandedItemIdx === idx) setExpandedItemIdx(null);
        }
    };

    const handleAddItem = () => {
        if (readOnly) return;
        setTxn({ 
            ...txn, 
            items: [...txn.items, {
                productVariantName: '',
                productFamily: '',
                category: '',
                brand: '',
                packSize: '',
                quantity: 1,
                totalPrice: 0
            }] 
        });
        setExpandedItemIdx(txn.items.length);
    };

    const handleTxnChange = (field, value) => {
        if (readOnly) return;
        setTxn({ ...txn, [field]: value });
    };

    const handlePartyChange = (field, value) => {
        if (readOnly) return;
        setTxn(prev => {
            const newTxn = { ...prev, party: { ...prev.party, [field]: value } };
            if (field === 'name') newTxn.partyName = value;
            if (field === 'type') newTxn.partyType = value;
            return newTxn;
        });
    };

    const handleUseGPS = () => {
        if (readOnly) return;
        if ("geolocation" in navigator) {
            setTxn(prev => ({ ...prev, location: "Locating..." }));
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
                    let displayLoc = city ? `${city}` : `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
                    if (city && data.address.state) {
                        displayLoc += `, ${data.address.state}`;
                    }
                    setTxn(prev => ({ ...prev, location: displayLoc }));
                } catch (e) {
                    setTxn(prev => ({ ...prev, location: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}` }));
                }
            }, (error) => {
                alert("Error getting location: " + error.message);
                setTxn(prev => ({ ...prev, location: "" }));
            });
        } else {
            alert("Geolocation is not supported by your browser");
        }
    };

    const renderItemRow = (item, idx) => {
        const isExpanded = expandedItemIdx === idx;
        
        return (
            <div key={idx} style={{ marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                {/* Compact Row */}
                <div 
                   style={{ display: 'flex', alignItems: 'center', padding: '12px', cursor: 'pointer' }}
                   onClick={() => setExpandedItemIdx(isExpanded ? null : idx)}
                >
                    <div style={{ marginRight: '12px', color: 'var(--accent)' }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                    <div style={{ flex: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.productVariantName || item.name || 'New Item'}
                        {item.resolutionSource === 'ALREADY_KNOWN' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}><CheckCircle2 size={12}/> Already Known</span>
                        )}
                        {item.resolutionSource === 'AI_MADE' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}><AlertCircle size={12}/> AI Made</span>
                        )}
                    </div>
                    <div style={{ width: '100px', textAlign: 'right', fontWeight: 'bold', marginRight: isEditing ? '16px' : '0' }}>
                        ₹{item.totalPrice || 0}
                    </div>
                    {isEditing && !readOnly && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(idx, item.productVariantName || item.name); }}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>

                <AnimatedCollapse isOpen={isExpanded}>
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={labelStyle}>Product Variant Name</label>
                                <input disabled={readOnly} style={inputStyle} value={item.productVariantName || item.name || ''} onChange={e => handleItemChange(idx, 'productVariantName', e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Product Family Grouping</label>
                                <input disabled={readOnly} style={inputStyle} value={item.productFamily || ''} onChange={e => handleItemChange(idx, 'productFamily', e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Category</label>
                                <input disabled={readOnly} style={inputStyle} value={item.category || ''} onChange={e => handleItemChange(idx, 'category', e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Brand</label>
                                <input disabled={readOnly} style={inputStyle} value={item.brand || ''} onChange={e => handleItemChange(idx, 'brand', e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Pack Size</label>
                                <input disabled={readOnly} style={inputStyle} value={item.packSize || ''} onChange={e => handleItemChange(idx, 'packSize', e.target.value)} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Quantity</label>
                                <input disabled={readOnly} type="number" style={inputStyle} value={item.quantity || ''} onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value)||0)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Item Total</label>
                                <input disabled={readOnly} type="number" style={inputStyle} value={item.totalPrice || ''} onChange={e => handleItemChange(idx, 'totalPrice', parseFloat(e.target.value)||0)} />
                            </div>
                        </div>
                    </div>
                </AnimatedCollapse>
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', zIndex: 1100, overflowY: 'auto', padding: '40px 24px' }}>
            <div className="glass" style={{ width: '900px', maxWidth: '100%', margin: '0 auto', padding: '32px', background: 'var(--bg-dark)', opacity: isResolving ? 0.6 : 1, pointerEvents: isResolving ? 'none' : 'auto', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                    <h2 style={{ fontSize: '20px', letterSpacing: '1px' }}>TRANSACTION DETAILS</h2>
                    <button onClick={onCancel} disabled={isResolving} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24}/></button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                    <div>
                        <label style={labelStyle}>Party</label>
                        <input disabled={readOnly} style={inputStyle} value={txn.party?.name || ''} onChange={e => handlePartyChange('name', e.target.value)} placeholder="e.g. ABC Wholesale" />
                    </div>
                    <div>
                        <label style={labelStyle}>Phone</label>
                        <input disabled={readOnly} style={inputStyle} value={txn.party?.phone || ''} onChange={e => handlePartyChange('phone', e.target.value)} placeholder="e.g. 9876543210" />
                    </div>
                    <div>
                        <label style={labelStyle}>Reference ID</label>
                        <input disabled={readOnly || isEditing} style={{...inputStyle, color: 'var(--accent)'}} value={txn.referenceId || ''} onChange={e => handleTxnChange('referenceId', e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Type</label>
                        <Select 
                            disabled={readOnly} 
                            style={{width: '100%'}} 
                            value={txn.transactionType} 
                            onChange={e => handleTxnChange('transactionType', e.target.value)}
                            options={[
                                { value: 'PURCHASE', label: 'PURCHASE' },
                                { value: 'SALE', label: 'SALE' }
                            ]}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Date</label>
                        <input disabled={readOnly} type="date" style={{...inputStyle, colorScheme: 'dark'}} value={txn.date || ''} onChange={e => handleTxnChange('date', e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Time</label>
                        <input disabled={readOnly} type="time" style={{...inputStyle, colorScheme: 'dark'}} value={txn.time || ''} onChange={e => handleTxnChange('time', e.target.value)} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{...labelStyle, display: 'flex', justifyContent: 'space-between'}}>
                            <span>Location</span>
                            {!readOnly && (
                                <button onClick={handleUseGPS} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '12px', padding: 0 }}>
                                    <MapPin size={12} style={{marginRight: '4px'}}/> Use GPS
                                </button>
                            )}
                        </label>
                        <input disabled={readOnly} style={inputStyle} value={txn.location || ''} onChange={e => handleTxnChange('location', e.target.value)} placeholder="e.g. Bhubaneswar" />
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '16px' }}>ITEMS</div>
                    {txn.items && txn.items.length > 0 ? (
                        txn.items.map((item, idx) => renderItemRow(item, idx))
                    ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', marginBottom: '8px' }}>
                            No items added yet.
                        </div>
                    )}
                    {!readOnly && (
                        <button className="btn-tactile" onClick={handleAddItem} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px dashed var(--accent)', color: 'var(--accent)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', marginTop: '8px', width: '100%', justifyContent: 'center', fontWeight: 'bold' }}>
                            + Add Item
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                    <div style={{ width: '350px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '15px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                            <span>₹{txn.subtotal?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', opacity: txn.taxIncluded ? 0.5 : 1 }}>
                            <span style={{ color: 'var(--text-muted)' }}>CGST</span>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                ₹ <input disabled={readOnly || txn.taxIncluded} type="number" style={{...inputStyle, width: '100px', margin: 0, padding: '4px 8px', marginLeft: '8px', textAlign: 'right'}} value={txn.cgst === 0 ? '' : txn.cgst} onChange={e => handleTxnChange('cgst', e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', opacity: txn.taxIncluded ? 0.5 : 1 }}>
                            <span style={{ color: 'var(--text-muted)' }}>SGST</span>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                ₹ <input disabled={readOnly || txn.taxIncluded} type="number" style={{...inputStyle, width: '100px', margin: 0, padding: '4px 8px', marginLeft: '8px', textAlign: 'right'}} value={txn.sgst === 0 ? '' : txn.sgst} onChange={e => handleTxnChange('sgst', e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
                                <input disabled={readOnly} type="checkbox" checked={txn.taxIncluded} onChange={e => handleTxnChange('taxIncluded', e.target.checked)} style={{ marginRight: '8px' }} />
                                Taxes are inclusive
                            </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>GRAND TOTAL</span>
                            <span className={txn.transactionType === 'SALE' ? 'text-green' : 'text-accent'}>₹{txn.grandTotal?.toFixed(2) || '0.00'}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '40px' }}>
                    <button className="btn-tactile" onClick={onCancel} disabled={isResolving} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Cancel
                    </button>
                    {!readOnly && (
                        <button className="btn-tactile" onClick={() => onConfirm(txn)} disabled={isResolving} style={{ background: 'var(--success)', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                            {confirmLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const labelStyle = { display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '13px' };
const inputStyle = { width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white', borderRadius: '6px', fontSize: '14px', outline: 'none' };
