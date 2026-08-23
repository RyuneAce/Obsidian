import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, AlertTriangle, ChevronDown, ChevronRight, CheckCircle, ArrowRight, Trash2, Camera } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useNavigate } from 'react-router-dom';
import InfoGate from '../../components/InfoGate';
import { QueueService } from '../queue/QueueService';
import { TransactionPersistenceService } from '../../services/TransactionPersistenceService';

// --- PROMPT ---
const SCANNER_PROMPT = `You are a universal business data extraction AI for a shopkeeper's application (HACQUIRE).
Analyze this image as a business/financial document. Determine whether it contains useful shop/business information. If it is unrelated, reject it. If it is relevant, identify the document type and extract structured business entities, transactions, items, quantities, prices, parties, suppliers, customers, payments, inventory information, dates, and other useful information. Do not invent information that is not visible or reasonably supported by the document. Preserve relationships and grouping. Return strictly structured JSON according to the provided schema.

Rules:
1. Determine if this is a valid business/financial document. If it's a random photo (selfie, landscape, etc.), set "valid": false.
2. Identify "documentType". Examples: BILL, INVOICE, RECEIPT, HANDWRITTEN_LEDGER, TRANSACTION_LIST, SALES_LIST, PURCHASE_LIST, INVENTORY_LIST, STOCK_SHEET, STOCK_COUNT, SUPPLIER_LIST, CUSTOMER_LIST, PRICE_LIST, SUPPLIER_PRICE_LIST, PAYMENT_RECORD, EXPENSE_RECORD, ACCOUNT_SUMMARY.
3. Extract records. A record groups related information.
4. NEVER HALLUCINATE FINANCIAL MEANING. 
5. NO FAKE GRAND TOTALS. 
6. EVIDENCE-BASED EXTRACTION. 
7. Group items under their respective party/transaction. 
8. Return STRICT JSON only, matching the schema. NO Markdown wrapping.

Schema:
{
  "valid": boolean,
  "reason": "String (if invalid, why?)",
  "documentType": "String",
  "records": [
    {
      "party": {
        "name": "String | null",
        "type": "CUSTOMER | SUPPLIER | null"
      },
      "transaction": {
        "direction": "IN | OUT | null",
        "type": "SALE | PURCHASE | PAYMENT | EXPENSE | null",
        "amount": "Number | null"
      },
      "items": [
        {
          "name": "String",
          "quantity": "Number | null",
          "unitPrice": "Number | null",
          "lineTotal": "Number | null",
          "value": "Number | null"
        }
      ]
    }
  ]
}`;

function ApiKeyManager({ apiKey, setApiKey }) {
  const [editing, setEditing] = useState(!apiKey);
  const [input, setInput] = useState(apiKey || '');

  const save = () => {
    localStorage.setItem('gemini_api_key', input);
    setApiKey(input);
    setEditing(false);
  };

  if (!editing && apiKey) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--success)' }}><CheckCircle size={16}/> Gemini API Key Configured</div>
        <button className="btn-tactile" onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>Edit Key</button>
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: '16px', marginBottom: '24px', border: '1px solid var(--warning)' }}>
      <h4 style={{ marginBottom: '8px', color: 'var(--warning)' }}><AlertTriangle size={16} style={{display:'inline', verticalAlign:'middle'}}/> Configure Gemini API</h4>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Provide your Google Gemini API key to enable visual extraction. It is stored securely in your browser's LocalStorage.</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input type="password" value={input} onChange={e => setInput(e.target.value)} placeholder="AIzaSy..." style={{ width: '100%', padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px', fontSize: '14px', flex: 1 }} />
        <button className="btn btn-tactile" onClick={save}>Save Key</button>
      </div>
    </div>
  );
}

function ScannerView({ dataLake }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const fileInputRef = useRef(null);
  
  // { id, imageBase64, status, transaction, error, isExpanded }
  const [reviewTasks, setReviewTasks] = useState([]);
  
  const queueService = useMemo(() => new QueueService(dataLake), [dataLake]);

  const handleFile = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    Promise.all(files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    })).then(base64Arr => {
       const newTasks = base64Arr.map(b64 => ({
           id: crypto.randomUUID(),
           imageBase64: b64,
           status: 'PENDING',
           transaction: null,
           error: null,
           isExpanded: true
       }));
       
       setReviewTasks(prev => [...prev, ...newTasks]);
       
       newTasks.forEach(task => extractDocument(task.id, task.imageBase64));
    });
    
    e.target.value = '';
  };
  
  const updateTask = (id, updates) => {
      setReviewTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  
  const extractDocument = async (taskId, imageBase64) => {
      const currentApiKey = localStorage.getItem('gemini_api_key');
      if (!currentApiKey) {
          updateTask(taskId, { status: 'ERROR', error: "Please configure your Gemini API Key first." });
          return;
      }
      
      updateTask(taskId, { status: 'EXTRACTING', error: null });
      
      try {
          const genAI = new GoogleGenerativeAI(currentApiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

          const imagePart = {
            inlineData: {
              data: imageBase64.split(',')[1],
              mimeType: 'image/jpeg' 
            }
          };

          const result = await model.generateContent([SCANNER_PROMPT, imagePart]);
          let responseText = result.response.text();
          responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          let parsed;
          try {
             parsed = JSON.parse(responseText);
          } catch (err) {
             throw new Error("Failed to parse Gemini response structure.");
          }

          if (!parsed.valid) {
            throw new Error(parsed.reason || "The AI determined this is not a valid business document.");
          }
          
          const record = parsed.records && parsed.records.length > 0 ? parsed.records[0] : null;
          if (!record) throw new Error("No data extracted from document.");
          
          const now = Date.now();
          const items = (record.items || []).map(i => ({
               name: i.name || '',
               quantity: i.quantity || i.value || 1,
               unitPrice: i.unitPrice || 0,
               total: i.lineTotal || ((i.quantity||i.value||1) * (i.unitPrice||0)),
               rawName: i.name || '',
          }));
          
          const docType = parsed.documentType;
          let txnType = record.transaction?.type || 'SALE';
          if (docType === 'SUPPLIER_INVOICE' || docType === 'PURCHASE_LIST') txnType = 'PURCHASE';

          const mappedTxn = {
             eventId: crypto.randomUUID(),
             partyName: record.party?.name || 'Unknown Party',
             transactionType: txnType,
             direction: record.transaction?.direction || (txnType === 'SALE' ? 'IN' : 'OUT'),
             amount: record.transaction?.amount || 0,
             items: items,
             source: 'SCANNER',
             documentType: docType,
             sourceDocumentId: taskId,
             timestamp: now,
             referenceId: String(now)
          };
          
          updateTask(taskId, { status: 'INFO_GATE_PROCESSING', transaction: mappedTxn, isExpanded: false });

      } catch (err) {
          updateTask(taskId, { status: 'ERROR', error: err.message || "Failed to extract document." });
      }
  };
  
  const handleInfoGateComplete = async (taskId, finalResult) => {
      const txn = finalResult.transaction;
      try {
          await TransactionPersistenceService.saveTransaction(dataLake, txn, 'SCANNER');
          
          setReviewTasks(prev => prev.filter(t => t.id !== taskId));
          alert("Transaction saved successfully!");
          
      } catch (e) {
          alert("Failed to save transaction: " + e.message);
      }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px' }}>
      <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Camera size={28}/> Universal Scanner</h2>
      <ApiKeyManager apiKey={apiKey} setApiKey={setApiKey} />

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* LEFT: CONTINUOUS UPLOAD AREA */}
        <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>1. Document Intake</h3>
          
          <div 
             style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center', cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}
             onClick={() => fileInputRef.current?.click()}
          >
             <Upload size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
             <h3 style={{ color: 'var(--accent)' }}>Scan Business Document</h3>
             <p style={{ color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto' }}>
                Capture or upload multiple documents at once. Processing happens seamlessly in the background.
             </p>
             <input type="file" accept="image/*" multiple capture="environment" ref={fileInputRef} onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>

        {/* RIGHT: REVIEW TASKS */}
        <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '16px', margin: 0 }}>2. Active Review Tasks</h3>

          {reviewTasks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px' }}>
                 Upload documents to see them processing here.
              </div>
          ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {reviewTasks.map(task => (
                    <ReviewCard 
                        key={task.id} 
                        task={task} 
                        dataLake={dataLake} 
                        queueService={queueService}
                        onToggle={() => updateTask(task.id, { isExpanded: !task.isExpanded })}
                        onRemove={() => setReviewTasks(prev => prev.filter(t => t.id !== task.id))}
                        onComplete={(res) => handleInfoGateComplete(task.id, res)}
                        onRetry={() => extractDocument(task.id, task.imageBase64)}
                        onStatusChange={(status) => {
                            if (status === 'REVIEW' && task.status !== 'READY') {
                                updateTask(task.id, { status: 'READY', isExpanded: true });
                            }
                            if (status === 'QUEUED' && task.status !== 'ERROR') {
                                updateTask(task.id, { error: 'Processing queued — waiting for internet' });
                            }
                        }}
                    />
                 ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ task, dataLake, queueService, onToggle, onRemove, onComplete, onRetry, onStatusChange }) {
    
    let icon, color, title;
    
    if (task.status === 'PENDING') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: 'grey'}}/>;
        color = 'grey';
        title = "Waiting to process...";
    } else if (task.status === 'EXTRACTING') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#facc15'}}/>;
        color = '#facc15';
        title = "Extracting document...";
    } else if (task.status === 'INFO_GATE_PROCESSING') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#facc15'}}/>;
        color = '#facc15';
        title = `${task.transaction?.partyName || 'Processing'} • ₹${task.transaction?.amount || 0}`;
    } else if (task.status === 'READY') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#4ade80'}}/>;
        color = '#4ade80';
        title = `${task.transaction?.partyName || 'Unknown'} • ₹${task.transaction?.amount || 0}`;
    } else if (task.status === 'ERROR') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#f87171'}}/>;
        color = '#f87171';
        title = "Processing Failed";
    }

    return (
       <div style={{ background: 'var(--bg-dark)', border: `1px solid ${color}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div 
             style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
             onClick={onToggle}
          >
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {task.isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                {icon}
                <span style={{ fontWeight: 'bold' }}>{title}</span>
             </div>
             
             <div style={{ display: 'flex', gap: '8px' }}>
                {task.status === 'ERROR' && (
                    <button onClick={(e) => { e.stopPropagation(); onRetry(); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Retry</button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                   <Trash2 size={16}/>
                </button>
             </div>
          </div>
          
          {task.isExpanded && (
              <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {task.imageBase64 && (
                      <div style={{ maxHeight: '150px', overflow: 'hidden', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          <img src={task.imageBase64} alt="Scanned Document" style={{ width: '100%', objectFit: 'cover' }} />
                      </div>
                  )}

                  {task.status === 'ERROR' && (
                      <div style={{ color: 'var(--danger)', fontSize: '14px' }}>
                          <AlertTriangle size={16} style={{display:'inline', marginRight:'8px'}}/> {task.error}
                      </div>
                  )}
                  
                  {task.status === 'EXTRACTING' && (
                      <div style={{ color: 'var(--accent)', fontSize: '14px', textAlign: 'center', padding: '24px' }}>
                          Using Gemini to read document structure...
                      </div>
                  )}

                  {(task.status === 'INFO_GATE_PROCESSING' || task.status === 'READY') && task.transaction && (
                      <div style={{ flex: 1 }}>
                         <InfoGate 
                             initialTransaction={task.transaction}
                             dataLake={dataLake}
                             queueService={queueService}
                             autoStart={true}
                             onStatusChange={onStatusChange}
                             onComplete={onComplete}
                             onCancel={onRemove}
                         />
                      </div>
                  )}
              </div>
          )}
       </div>
    );
}

function ScannerWidget() {
  const navigate = useNavigate();
  return (
    <div className="glass widget-card" style={{ border: '1px solid var(--accent)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><Camera size={20}/> Scanner</h3>
          <p style={{ color: 'var(--text-muted)' }}>Turn business documents into structured data automatically.</p>
        </div>
        <button onClick={() => navigate('/scanner')} className="btn btn-tactile">Scan Document</button>
      </div>
    </div>
  );
}

const ScannerPlugin = {
  pluginId: 'scanner',
  name: 'Universal Scanner',
  version: '2.0.0',
  initialize: () => {},
  routes: [{ path: '/scanner', component: ({ dataLake }) => <ScannerView dataLake={dataLake} /> }],
  dashboardWidgets: []
};

export default ScannerPlugin;
