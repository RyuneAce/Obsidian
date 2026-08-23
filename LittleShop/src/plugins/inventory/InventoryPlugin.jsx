import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, AlertTriangle, Edit2, CheckCircle, Trash2, ArrowRight, X, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { ProductKnowledgeGate } from '../../datalake/ProductKnowledgeGate';
import InfoGate from '../../components/InfoGate';
import { QueueService } from '../queue/QueueService';
import { TransactionPersistenceService } from '../../services/TransactionPersistenceService';

// Reusable Styles
const labelStyle = { display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px' };
const inputStyle = { width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' };
const actionBtnStyle = { background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' };

/**
 * Add / Adjust Inventory Flow (Replaces AddInventoryModal)
 */
function AddInventoryFlow({ isOpen, onClose, dataLake }) {
  const [transaction, setTransaction] = useState(null);
  
  const queueService = useMemo(() => new QueueService(dataLake), [dataLake]);

  useEffect(() => {
    if (isOpen) {
       setTransaction({
          eventId: crypto.randomUUID(),
          transactionType: 'PURCHASE',
          party: { name: '', phone: '' },
          referenceId: 'INV-' + new Date().toISOString().replace(/\D/g,'').replace(/^(\d{8})(\d{6}).*/, '$1-$2'),
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          location: '',
          items: [{
              productVariantName: '',
              productFamily: '',
              category: '',
              brand: '',
              packSize: '',
              quantity: 1,
              totalPrice: 0
          }],
          subtotal: 0,
          cgst: 0,
          sgst: 0,
          taxIncluded: true,
          grandTotal: 0,
          notes: ''
       });
    }
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const handleCommitTxn = async (result) => {
      const txn = result.transaction;
      try {
         await TransactionPersistenceService.saveTransaction(dataLake, txn, 'INVENTORY_MANUAL');
         alert("Transaction Successfully Committed.");
         onClose();
      } catch (e) {
         alert("Commit Failed: " + e.message);
      }
  };

  return (
      <InfoGate
          initialTransaction={transaction}
          dataLake={dataLake}
          queueService={queueService}
          onComplete={handleCommitTxn}
          onCancel={onClose}
      />
  );
}


/**
 * Expandable Product Breakdown (Level 2) Component inside the Row
 */
function FamilyBreakdown({ products, onEditProduct, onDeleteProduct }) {
    if (!products || products.length === 0) return null;
    
    return (
        <div style={{ padding: '16px 24px 24px 48px', background: 'rgba(0,0,0,0.3)', borderLeft: '4px solid var(--accent)' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 'bold' }}>PRODUCT VARIANTS IN STOCK</div>
           {products.map(p => (
             <div key={p.productId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                <div>
                   <div style={{ fontWeight: '500', fontSize: '15px' }}>{p.computedName}</div>
                   <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {p.productId}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ fontWeight: 'bold', fontSize: '16px', color: p.currentStock <= p.minStock ? 'var(--warning)' : 'var(--success)' }}>
                      {p.currentStock} pcs
                   </div>
                   <div style={{ display: 'flex', gap: '8px' }}>
                       <button style={actionBtnStyle} onClick={() => onEditProduct(p)}><Edit2 size={14} color="var(--text-muted)"/></button>
                       <button style={actionBtnStyle} onClick={() => onDeleteProduct(p)}><Trash2 size={14} color="var(--danger)"/></button>
                   </div>
                </div>
             </div>
           ))}
        </div>
    );
}


/**
 * Main Inventory View
 */
function InventoryView({ dataLake }) {
  const rawProducts = useLiveQuery(() => dataLake.inventory.toArray(), []) || [];
  const allLedgerTxns = useLiveQuery(() => dataLake.ledger.toArray(), []) || [];
  const allMovements = useLiveQuery(() => dataLake.inventoryMovements.toArray(), []) || [];
  const unresolved = useLiveQuery(() => dataLake.unresolvedInventory.toArray(), []) || [];
  const families = useLiveQuery(() => dataLake.productFamilies.toArray(), []) || [];
  const categories = useLiveQuery(() => dataLake.productCategories.toArray(), []) || [];
  const canonicalProducts = useLiveQuery(() => dataLake.canonicalProducts.toArray(), []) || [];
  
  const apiKey = localStorage.getItem('gemini_api_key');
  const gate = useMemo(() => new ProductKnowledgeGate(dataLake, apiKey), [dataLake, apiKey]);
  const products = useMemo(() => {
    return rawProducts.filter(p => p.status !== 'DELETED').map(p => ({
        ...p,
        currentStock: p.currentStock || 0
    }));
  }, [rawProducts]);

  // Aggregate by Category -> Family -> Product
  const groupedInventory = useMemo(() => {
     const catGroups = {}; 
     
     products.forEach(p => {
        const canonical = canonicalProducts.find(c => c.id === p.productId);
        const fam = canonical ? families.find(f => f.id === canonical.familyId) : families.find(f => f.id === p.productId || f.name.toLowerCase() === p.name.toLowerCase());
        
        const productName = p.overrideName || (canonical ? canonical.name : p.name);
        const familyName = p.overrideFamily || (fam ? fam.name : p.name);
        
        let catName = p.overrideCategory || 'General';
        if (!p.overrideCategory) {
            if (fam) {
                const c = categories.find(c => c.id === fam.categoryId);
                if (c) catName = c.name;
            } else {
                catName = p.category || 'General';
            }
        }
        
        p.computedName = productName;
        p.computedFamily = familyName;
        p.computedCategory = catName;

        if (!catGroups[catName]) catGroups[catName] = { catName, totalStock: 0, families: {} };
        
        const cg = catGroups[catName];
        if (!cg.families[familyName]) cg.families[familyName] = { familyName, totalStock: 0, products: [] };
        
        cg.families[familyName].products.push(p);
        cg.families[familyName].totalStock += p.currentStock;
        cg.totalStock += p.currentStock;
     });
     
     return Object.values(catGroups).sort((a,b) => a.catName.localeCompare(b.catName)).map(cg => ({
         ...cg,
         families: Object.values(cg.families).sort((a,b) => a.familyName.localeCompare(b.familyName))
     }));
  }, [products, families, categories, canonicalProducts]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [expandedFams, setExpandedFams] = useState({});

  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [conflictState, setConflictState] = useState(null);

  const toggleCat = (catName) => setExpandedCats(prev => ({...prev, [catName]: !prev[catName]}));
  const toggleFam = (famName) => setExpandedFams(prev => ({...prev, [famName]: !prev[famName]}));

  const startEdit = (type, data) => {
      setEditingItem({ type, ...data });
      if (type === 'CATEGORY') setEditForm({ name: data.catName });
      if (type === 'FAMILY') setEditForm({ name: data.familyName, category: data.catName });
      if (type === 'PRODUCT') setEditForm({ name: data.product.computedName, family: data.product.computedFamily, quantity: data.product.currentStock });
  };
  
  const startDelete = (type, data) => setDeletingItem({ type, ...data });

  const handleSaveEdit = () => {
      if (editingItem.type === 'PRODUCT') {
          const p = editingItem.product;
          const canonical = canonicalProducts.find(c => c.id === p.productId);
          if (canonical) {
              const memFam = families.find(f => f.id === canonical.familyId);
              const memName = canonical.name;
              
              const familyChanged = editForm.family !== p.computedFamily;
              const nameChanged = editForm.name !== p.computedName;
              
              if (familyChanged && memFam && memFam.name !== editForm.family) {
                  setConflictState({
                      description: `This product is currently remembered as:\n${memName} → ${memFam.name}\n\nYour inventory correction says:\n${editForm.name} → ${editForm.family}`,
                      pendingEdit: { ...editForm, p }
                  });
                  return;
              }
              
              if (nameChanged && memName !== editForm.name) {
                  setConflictState({
                      description: `This product is currently remembered as:\n${memName}\n\nYour inventory correction says:\n${editForm.name}`,
                      pendingEdit: { ...editForm, p }
                  });
                  return;
              }
          }
      }
      
      executeSaveEdit('DEFAULT');
  };

  const executeSaveEdit = async (strategy = 'DEFAULT', overrideForm = null) => {
      const formToUse = overrideForm || editForm;
      try {
          if (editingItem.type === 'CATEGORY') {
              const oldCat = editingItem.catName;
              let newCat = formToUse.name;
              
              const existingCat = categories.find(c => gate.isCategoryEquivalent(c.name, newCat));
              
              if (existingCat && existingCat.name !== oldCat) {
                  newCat = existingCat.name;
                  const oldCatEntity = categories.find(c => c.name === oldCat);
                  if (oldCatEntity) {
                      await gate.dispatchKnowledgeAction({
                          type: 'KNOWLEDGE_MERGE', entityType: 'CATEGORY', entityId: oldCatEntity.id, targetId: existingCat.id,
                          previousValue: oldCat, newValue: newCat, source: 'INVENTORY_MANUAL_EDIT', reason: 'User merged category in UI'
                      });
                  }
              } else if (newCat !== oldCat) {
                  const oldCatEntity = categories.find(c => c.name === oldCat);
                  if (oldCatEntity) {
                      await gate.dispatchKnowledgeAction({
                          type: 'KNOWLEDGE_CORRECTION', entityType: 'CATEGORY', entityId: oldCatEntity.id,
                          previousValue: oldCat, newValue: newCat, source: 'INVENTORY_MANUAL_EDIT', reason: 'User renamed category in UI'
                      });
                  }
              }

              if (oldCat !== newCat) {
                  const productsToUpdate = products.filter(p => p.computedCategory === oldCat);
                  for (let p of productsToUpdate) await dataLake.inventory.update(p.productId, { overrideCategory: newCat });
              }
          } else if (editingItem.type === 'FAMILY') {
              const oldFam = editingItem.familyName;
              const newFam = formToUse.name;
              
              const familiesForCat = families.filter(f => {
                  const cat = categories.find(c => c.id === f.categoryId);
                  return cat && cat.name === editingItem.catName;
              });
              const existingFam = familiesForCat.find(f => gate.isCategoryEquivalent(f.name, newFam));
              
              let finalFam = newFam;
              if (existingFam && existingFam.name !== oldFam) {
                  finalFam = existingFam.name;
                  const oldFamEntity = familiesForCat.find(f => f.name === oldFam);
                  if (oldFamEntity) {
                      await gate.dispatchKnowledgeAction({
                          type: 'KNOWLEDGE_MERGE', entityType: 'FAMILY', entityId: oldFamEntity.id, targetId: existingFam.id,
                          previousValue: oldFam, newValue: finalFam, source: 'INVENTORY_MANUAL_EDIT', reason: 'User merged family in UI'
                      });
                  }
              } else if (newFam !== oldFam) {
                  const oldFamEntity = familiesForCat.find(f => f.name === oldFam);
                  if (oldFamEntity) {
                      await gate.dispatchKnowledgeAction({
                          type: 'KNOWLEDGE_CORRECTION', entityType: 'FAMILY', entityId: oldFamEntity.id,
                          previousValue: oldFam, newValue: newFam, source: 'INVENTORY_MANUAL_EDIT', reason: 'User renamed family in UI'
                      });
                  }
              }
              
              let newCat = formToUse.category;
              const existingCat = categories.find(c => gate.isCategoryEquivalent(c.name, newCat));
              if (existingCat) newCat = existingCat.name;

              const productsToUpdate = products.filter(p => p.computedFamily === oldFam && p.computedCategory === editingItem.catName);
              for (let p of productsToUpdate) {
                  const updates = {};
                  if (oldFam !== finalFam) updates.overrideFamily = finalFam;
                  if (editingItem.catName !== newCat) updates.overrideCategory = newCat;
                  if (Object.keys(updates).length > 0) await dataLake.inventory.update(p.productId, updates);
              }
          } else if (editingItem.type === 'PRODUCT') {
              const p = editingItem.product;
              
              let targetProductId = p.productId;
              
              if (strategy === 'KEEP_SEPARATE') {
                   let newFam = families.find(f => f.name.toLowerCase() === formToUse.family.toLowerCase());
                   if (!newFam) {
                       const memCat = categories.find(c => c.name === p.computedCategory);
                       const fid = 'fam_' + crypto.randomUUID();
                       await dataLake.productFamilies.put({ id: fid, categoryId: memCat ? memCat.id : null, name: formToUse.family });
                       newFam = { id: fid };
                   }
                   
                   const newProdId = 'prod_' + crypto.randomUUID();
                   targetProductId = newProdId;
                   await dataLake.canonicalProducts.put({
                       id: newProdId,
                       familyId: newFam.id,
                       name: formToUse.name
                   });
                   
                   const oldInv = await dataLake.inventory.get(p.productId);
                   await dataLake.inventory.delete(p.productId);
                   await dataLake.inventory.put({
                       ...oldInv,
                       productId: newProdId,
                       overrideName: undefined,
                       overrideFamily: undefined
                   });
              } else {
                  const updates = {};
                  if (p.computedName !== formToUse.name) updates.overrideName = formToUse.name;
                  if (p.computedFamily !== formToUse.family) updates.overrideFamily = formToUse.family;
                  if (Object.keys(updates).length > 0) await dataLake.inventory.update(p.productId, updates);
                  
                  if (strategy === 'UPDATE_MEMORY') {
                       const canonical = canonicalProducts.find(c => c.id === p.productId);
                       if (canonical) {
                           if (p.computedName !== formToUse.name) {
                               await gate.dispatchKnowledgeAction({
                                   type: 'KNOWLEDGE_CORRECTION', entityType: 'PRODUCT', entityId: p.productId,
                                   previousValue: canonical.name, newValue: formToUse.name, source: 'INVENTORY_MANUAL_EDIT'
                               });
                           }
                           if (p.computedFamily !== formToUse.family) {
                               let newFam = families.find(f => f.name.toLowerCase() === formToUse.family.toLowerCase());
                               if (!newFam) {
                                   const memCat = categories.find(c => c.name === p.computedCategory);
                                   const fid = 'fam_' + crypto.randomUUID();
                                   await dataLake.productFamilies.put({ id: fid, categoryId: memCat ? memCat.id : null, name: formToUse.family });
                                   newFam = { id: fid };
                               }
                               await dataLake.canonicalProducts.update(p.productId, { familyId: newFam.id });
                           }
                       }
                  }
              }
              
              const newQty = parseFloat(formToUse.quantity);
              if (newQty !== p.currentStock) {
                  const diff = newQty - p.currentStock;
                  
                  // Update mutable stock property
                  await dataLake.inventory.update(p.productId, {
                      currentStock: newQty
                  });
                  
                  await dataLake.inventoryMovements.put({
                       movementId: crypto.randomUUID(),
                       productId: targetProductId,
                       type: 'MANUAL_ADJUSTMENT',
                       direction: diff > 0 ? 'IN' : 'OUT',
                       quantity: Math.abs(diff),
                       timestamp: Date.now(),
                       notes: 'Manual inventory edit'
                  });
              }
          }
          setEditingItem(null);
          setConflictState(null);
      } catch (e) {
          alert("Failed to save: " + e.message);
      }
  };

  const handleConfirmDelete = async () => {
      try {
          if (deletingItem.type === 'CATEGORY') {
              const productsToUpdate = products.filter(p => p.computedCategory === deletingItem.catName);
              for (let p of productsToUpdate) await dataLake.inventory.update(p.productId, { status: 'DELETED' });
          } else if (deletingItem.type === 'FAMILY') {
              const productsToUpdate = products.filter(p => p.computedFamily === deletingItem.familyName && p.computedCategory === deletingItem.catName);
              for (let p of productsToUpdate) await dataLake.inventory.update(p.productId, { status: 'DELETED' });
          } else if (deletingItem.type === 'PRODUCT') {
              await dataLake.inventory.update(deletingItem.product.productId, { status: 'DELETED' });
          }
          setDeletingItem(null);
      } catch (e) {
          alert("Failed to delete: " + e.message);
      }
  };

  // Filtering
  const filteredGroups = useMemo(() => {
     if (!searchTerm) return groupedInventory;
     const term = searchTerm.toLowerCase();
     
     return groupedInventory.map(cg => {
         const matchCat = cg.catName.toLowerCase().includes(term);
         const matchingFams = cg.families.filter(f => 
             matchCat || 
             f.familyName.toLowerCase().includes(term) || 
             f.products.some(p => p.name.toLowerCase().includes(term))
         );
         return matchingFams.length > 0 ? { ...cg, families: matchingFams } : null;
     }).filter(Boolean);
  }, [groupedInventory, searchTerm]);

  const handleRetryUnresolved = async (u) => {
     setResolvingId(u.id);
     try {
        const resolution = await gate.resolveProduct(u.rawName);
        if (resolution && resolution.confidence === 1.0) {
            const existingInv = await dataLake.inventory.get(resolution.productId);
            if (existingInv) {
                await dataLake.inventory.update(resolution.productId, {
                    currentStock: (existingInv.currentStock || 0) + u.quantity
                });
            }

            await dataLake.inventoryMovements.put({
               movementId: crypto.randomUUID(),
               productId: resolution.productId,
               type: 'MANUAL_ADJUSTMENT',
               direction: 'IN',
               quantity: u.quantity,
               timestamp: Date.now(),
               notes: 'Resolved from offline queue',
               rawInput: u.rawName
            });
            await dataLake.unresolvedInventory.delete(u.id);
            alert(`Successfully resolved ${u.rawName} to ${resolution.canonicalName}`);
        } else {
            alert(`AI needs review for "${u.rawName}". Please open Add Inventory, enter the product, and review it to clear it.`);
            await dataLake.unresolvedInventory.delete(u.id);
            setModalOpen(true);
        }
     } catch (e) {
        alert("Failed to resolve: " + e.message);
     } finally {
        setResolvingId(null);
     }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Digital Inventory</h2>
        <button className="btn" onClick={() => setModalOpen(true)}><Plus size={18} /> Add Inventory</button>
      </div>

      {unresolved.length > 0 && (
         <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: 'var(--warning)', marginBottom: '8px' }}><AlertTriangle size={16} style={{display:'inline', verticalAlign:'middle'}}/> Unresolved Entries (Offline Queue)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {unresolved.map((u, i) => (
                  <div key={u.id} className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderLeft: '4px solid var(--warning)' }}>
                     <div>
                        <div style={{ fontWeight: 'bold' }}>Unresolved #{i + 1}: {u.rawName}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Quantity: {u.quantity}</div>
                     </div>
                     <button className="btn" style={{ background: 'transparent', border: '1px solid var(--success)', color: 'var(--success)' }} onClick={() => handleRetryUnresolved(u)}>
                        {resolvingId === u.id ? <RefreshCw size={16} className="spin" /> : <CheckCircle size={16} style={{marginRight:'4px'}} />}
                        Retry
                     </button>
                  </div>
               ))}
            </div>
         </div>
      )}

      <div className="glass" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
          <input 
            placeholder="Search category, product, or brand..." 
            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            No inventory found. Start by adding stock!
          </div>
        ) : (
          filteredGroups.map(cg => {
              const isCatExpanded = expandedCats[cg.catName] ?? false; // Default closed
              return (
                  <div key={cg.catName} style={{ marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div 
                         style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                         onClick={() => toggleCat(cg.catName)}
                      >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                             {isCatExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                             <div>
                                 <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '1px' }}>CATEGORY</div>
                                 <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{cg.catName}</div>
                             </div>
                             <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                                 <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); startEdit('CATEGORY', { catName: cg.catName }); }}><Edit2 size={16} color="var(--text-muted)"/></button>
                                 <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); startDelete('CATEGORY', { catName: cg.catName }); }}><Trash2 size={16} color="var(--danger)"/></button>
                             </div>
                         </div>
                         <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--success)' }}>
                             {cg.totalStock} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-muted)' }}>pcs</span>
                         </div>
                      </div>
                      
                      {isCatExpanded && cg.families.map(fam => {
                          const isFamExpanded = expandedFams[fam.familyName] ?? false; 
                          return (
                              <React.Fragment key={fam.familyName}>
                                 <div 
                                    style={{ padding: '12px 16px 12px 24px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onClick={() => toggleFam(fam.familyName)}
                                 >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '16px' }}>
                                        {isFamExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        {fam.familyName}
                                        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                                            <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); startEdit('FAMILY', { catName: cg.catName, familyName: fam.familyName }); }}><Edit2 size={14} color="var(--text-muted)"/></button>
                                            <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); startDelete('FAMILY', { catName: cg.catName, familyName: fam.familyName }); }}><Trash2 size={14} color="var(--danger)"/></button>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>{fam.totalStock}</div>
                                 </div>
                                 {isFamExpanded && <FamilyBreakdown products={fam.products} onEditProduct={(p) => startEdit('PRODUCT', { product: p })} onDeleteProduct={(p) => startDelete('PRODUCT', { product: p })} />}
                              </React.Fragment>
                          );
                      })}
                  </div>
              );
          })
        )}
      </div>

      <AddInventoryFlow 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        dataLake={dataLake}
        key={modalOpen ? 'open' : 'closed'} 
      />

      {editingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
           <div className="glass" style={{ width: '400px', padding: '24px', background: 'var(--bg-dark)' }}>
               <h3 style={{ marginBottom: '16px' }}>Edit {editingItem.type === 'CATEGORY' ? 'Category' : editingItem.type === 'FAMILY' ? 'Product Family' : 'Product'}</h3>
               
               {editingItem.type === 'CATEGORY' && (
                   <div style={{ marginBottom: '16px' }}>
                       <label style={labelStyle}>Category Name</label>
                       <input style={inputStyle} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                   </div>
               )}
               
               {editingItem.type === 'FAMILY' && (
                   <>
                       <div style={{ marginBottom: '16px' }}>
                           <label style={labelStyle}>Family Name</label>
                           <input style={inputStyle} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                       </div>
                       <div style={{ marginBottom: '16px' }}>
                           <label style={labelStyle}>Category</label>
                           <input style={inputStyle} value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} />
                       </div>
                   </>
               )}
               
               {editingItem.type === 'PRODUCT' && (
                   <>
                       <div style={{ marginBottom: '16px' }}>
                           <label style={labelStyle}>Product Variant Name</label>
                           <input style={inputStyle} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                       </div>
                       <div style={{ marginBottom: '16px' }}>
                           <label style={labelStyle}>Product Family</label>
                           <input style={inputStyle} value={editForm.family} onChange={e => setEditForm({...editForm, family: e.target.value})} />
                       </div>
                       <div style={{ marginBottom: '16px' }}>
                           <label style={labelStyle}>Quantity in Stock</label>
                           <input type="number" style={inputStyle} value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: e.target.value})} />
                       </div>
                   </>
               )}
               
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                   <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)' }} onClick={() => setEditingItem(null)}>Cancel</button>
                   <button className="btn" style={{ background: 'var(--success)', color: '#000' }} onClick={handleSaveEdit}>Save Changes</button>
               </div>
           </div>
        </div>
      )}

      {deletingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
           <div className="glass" style={{ width: '400px', padding: '24px', background: 'var(--bg-dark)', borderLeft: '4px solid var(--danger)' }}>
               <h3 style={{ marginBottom: '16px', color: 'var(--danger)' }}>Confirm Deletion</h3>
               <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                   Are you sure you want to remove <strong>{deletingItem.type === 'CATEGORY' ? deletingItem.catName : deletingItem.type === 'FAMILY' ? deletingItem.familyName : deletingItem.product.computedName}</strong> from your current inventory?
                   <br/><br/>
                   <em>Note: This only removes the item from your active stock view. Historical data and Product Knowledge records are never destroyed.</em>
               </p>
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                   <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)' }} onClick={() => setDeletingItem(null)}>Cancel</button>
                   <button className="btn" style={{ background: 'var(--danger)', color: '#fff' }} onClick={handleConfirmDelete}>Delete</button>
               </div>
           </div>
        </div>
      )}
    {conflictState && (
         <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
            <div className="glass" style={{ width: '500px', padding: '24px', background: 'var(--bg-dark)', borderLeft: '4px solid var(--accent)' }}>
                <h3 style={{ marginBottom: '16px' }}>Memory Conflict</h3>
                <div style={{ color: 'var(--text-muted)', marginBottom: '24px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {conflictState.description}
                </div>
                <p style={{ marginBottom: '16px', fontWeight: 'bold' }}>What would you like to do?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => executeSaveEdit('KEEP_MEMORY', conflictState.pendingEdit)}>Keep Memory (Update local inventory only)</button>
                    <button className="btn" style={{ background: 'var(--accent)', color: '#000', justifyContent: 'flex-start' }} onClick={() => executeSaveEdit('UPDATE_MEMORY', conflictState.pendingEdit)}>Update Memory (Correct the knowledge base)</button>
                    <button className="btn" style={{ background: 'transparent', border: '1px solid var(--success)', color: 'var(--success)', justifyContent: 'flex-start' }} onClick={() => executeSaveEdit('KEEP_SEPARATE', conflictState.pendingEdit)}>Keep Separate (Create a distinct product)</button>
                    <button className="btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', marginTop: '8px' }} onClick={() => setConflictState(null)}>Cancel</button>
                </div>
            </div>
         </div>
       )}

    </div>
  );
}

const InventoryPlugin = {
  pluginId: 'inventory',
  name: 'Stock Management',
  version: '4.0.0',
  initialize: async (dataLake) => {
     window.addEventListener('PROPOSE_ALIAS', async (e) => {
       const { productId, alias, source } = e.detail;
       if (!productId || !alias) return;
       const normalizedAlias = alias.toLowerCase().trim();
       const existingAliases = await dataLake.productAliases.toArray();
       const isDuplicate = existingAliases.some(a => a.normalizedAlias === normalizedAlias && a.targetId === productId);
       if (isDuplicate) return;
       
       await dataLake.productAliases.put({
         id: crypto.randomUUID(),
         alias: alias,
         normalizedAlias,
         targetType: 'PRODUCT',
         targetId: productId,
         confidence: 'USER_CONFIRMED',
         source: source || 'PLUGIN_PROPOSAL'
       });
     });
  },
  routes: [{ path: '/inventory', component: ({ dataLake }) => <InventoryView dataLake={dataLake} /> }],
  dashboardWidgets: []
};

export default InventoryPlugin;
