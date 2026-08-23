import React, { useState, useEffect } from 'react';
import TransactionReview from './TransactionReview';
import { ProductKnowledgeGate } from '../datalake/ProductKnowledgeGate';

export default function InfoGate({ initialTransaction, onComplete, onCancel, dataLake, queueService, queueJobId, startFromIndex = 0, autoStart = false, onStatusChange }) {
    const [status, setStatus] = useState('ENTRY'); // ENTRY -> RESOLVING -> REVIEW -> QUEUED
    const [activeTxn, setActiveTxn] = useState(initialTransaction);
    
    // Auto-start if it's resuming from queue OR autoStart prop is true
    useEffect(() => {
        if ((queueJobId && startFromIndex >= 0) || autoStart) {
            handleConfirm(initialTransaction);
        }
    }, [autoStart, queueJobId, startFromIndex]);

    useEffect(() => {
        if (onStatusChange) onStatusChange(status);
    }, [status, onStatusChange]);

    const handleConfirm = async (updatedTxn) => {
        if (status === 'ENTRY' || queueJobId) {
            setStatus('RESOLVING');
            setActiveTxn(updatedTxn);
            
            const apiKey = localStorage.getItem('gemini_api_key');
            const resolver = new ProductKnowledgeGate(dataLake, apiKey);
            
            let currentTxn = { ...updatedTxn };
            const newItems = [...currentTxn.items];
            
            for (let i = startFromIndex; i < newItems.length; i++) {
                const item = newItems[i];
                if (!item.productVariantName && !item.name) continue;
                if (item.resolutionSource === 'ALREADY_KNOWN' || item.resolutionSource === 'AI_MADE') continue;
                
                const rawName = item.productVariantName || item.name;
                const result = await resolver.resolveSingleItem(rawName);
                
                if (result.resolutionMethod === 'AI_REQUIRED_BUT_UNAVAILABLE') {
                    // Stop processing and push to Queue
                    if (queueService) {
                        if (queueJobId) {
                            await queueService.updateCheckpoint(queueJobId, {
                                currentItemIndex: i,
                                transaction: currentTxn,
                                status: 'WAITING_FOR_NETWORK'
                            });
                        } else {
                            await queueService.enqueue({
                                transaction: currentTxn,
                                currentItemIndex: i,
                                requiredOperation: 'resolveProduct'
                            });
                        }
                    }
                    setStatus('QUEUED');
                    return;
                }
                
                newItems[i] = {
                    ...item,
                    productVariantName: result.proposedCanonicalName || rawName,
                    productFamily: result.proposedFamily || '',
                    category: result.proposedCategory || '',
                    brand: result.brand || '',
                    packSize: result.packSize || '',
                    resolutionSource: result.resolutionSource,
                };
                
                currentTxn = { ...currentTxn, items: [...newItems] };
                setActiveTxn(currentTxn);
            }
            
            if (queueJobId && queueService) {
                 await queueService.deleteJob(queueJobId);
            }
            setStatus('REVIEW');
        } else if (status === 'REVIEW') {
            onComplete({
                transaction: updatedTxn,
                status: 'resolved'
            });
        }
    };

    return (
        <>
            {status !== 'QUEUED' && (
                <TransactionReview 
                    initialTransaction={activeTxn}
                    onConfirm={handleConfirm}
                    onCancel={onCancel}
                    isResolving={status === 'RESOLVING'}
                    confirmLabel={status === 'REVIEW' ? 'Review & Save' : 'Confirm & Save'}
                />
            )}
            
            {status === 'RESOLVING' && (
               <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                  <div className="glass" style={{ background: 'var(--bg-dark)', padding: '32px', borderRadius: '12px', border: '1px solid var(--accent)', maxWidth: '400px', textAlign: 'center', pointerEvents: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      <h3 style={{ color: 'var(--accent)', marginBottom: '16px', letterSpacing: '1px' }}>Resolving Information...</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                         Checking existing memory and resolving unclear product information.
                      </p>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'left', lineHeight: '1.5' }}>
                         <strong>Note:</strong> AI may be used to resolve unclear product information.<br/><br/>
                         Accepted corrections or new product knowledge may be saved to memory to make future entries easier.
                      </div>
                  </div>
               </div>
            )}

            {status === 'QUEUED' && (
               <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.85)' }}>
                  <div className="glass" style={{ background: 'var(--bg-dark)', padding: '32px', borderRadius: '12px', border: '1px solid var(--accent)', maxWidth: '400px', textAlign: 'center' }}>
                      <h3 style={{ color: 'var(--accent)', marginBottom: '16px', letterSpacing: '1px' }}>Waiting for Internet</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                         Your transaction has been safely queued because the external AI requires an internet connection.<br/><br/>
                         It will continue when resumed from the Queue.
                      </p>
                      <button onClick={onCancel} style={{ padding: '10px 24px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                         Close
                      </button>
                  </div>
               </div>
            )}
        </>
    );
}
