import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Filter, AlertTriangle, MessageSquare, Mic, Square, Trash2, ChevronDown, ChevronRight, Play, Upload, CheckCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import voiceDb from './VoiceDatabase';
import { VoiceService } from './VoiceService';
import ApiKeyManager from './ApiKeyManager';
import InfoGate from '../../components/InfoGate';
import { QueueService } from '../queue/QueueService';

export default function VoiceCommercePage({ dataLake }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const autoStart = searchParams.get('record') === 'true';

  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [elevenLabsKey, setElevenLabsKey] = useState(localStorage.getItem('elevenlabs_api_key') || '');
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const voiceService = useMemo(() => new VoiceService(geminiKey, elevenLabsKey), [geminiKey, elevenLabsKey]);
  const queueService = useMemo(() => new QueueService(dataLake), [dataLake]);

  const recordings = useLiveQuery(
    () => voiceDb.recordings.orderBy('createdAt').reverse().toArray(),
    []
  ) || [];

  useEffect(() => {
    if (autoStart) {
       startRecording();
       setSearchParams({});
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [autoStart]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleNewRecording(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (err) {
      alert("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) handleNewRecording(file);
    event.target.value = '';
  };

  const handleNewRecording = async (audioBlob) => {
    const id = crypto.randomUUID();
    const newRecord = {
      id,
      createdAt: Date.now(),
      status: 'TRANSCRIBING',
      audioBlob,
      transcription: null,
      interpretation: null,
      transaction: null,
      isExpanded: true
    };
    await voiceDb.recordings.put(newRecord);
    processRecording(id, newRecord);
  };

  const updateTask = async (id, updates) => {
      const rec = await voiceDb.recordings.get(id);
      if (rec) await voiceDb.recordings.put({ ...rec, ...updates });
  };

  const processRecording = async (id, recordData) => {
    try {
      let currentRecord = recordData || await voiceDb.recordings.get(id);

      // 1. Transcribe (AUDIO -> TEXT)
      if (currentRecord.status === 'TRANSCRIBING') {
        if (!navigator.onLine) throw new Error("Offline");
        const transcript = await voiceService.transcribeAudio(currentRecord.audioBlob);
        currentRecord = { ...currentRecord, transcription: transcript, status: 'INTERPRETING', error: null };
        await voiceDb.recordings.put(currentRecord);
      }

      // 2. Interpret (TEXT -> TRANSACTION JSON)
      if (currentRecord.status === 'INTERPRETING' && currentRecord.transcription) {
        if (!navigator.onLine) throw new Error("Offline");
        const data = await voiceService.interpretTransaction(currentRecord.transcription);
        
        const now = Date.now();
        const mappedTxn = {
             eventId: crypto.randomUUID(),
             partyName: data.transaction?.partyName || 'Unknown Party',
             transactionType: data.transaction?.transactionType || 'SALE',
             direction: data.transaction?.direction || 'IN',
             amount: data.transaction?.amount || 0,
             items: data.transaction?.items || [],
             source: 'VOICE_COMMERCE',
             documentType: 'VOICE_TRANSCRIPT',
             sourceDocumentId: id,
             timestamp: now,
             referenceId: String(now)
        };

        currentRecord = { 
            ...currentRecord, 
            interpretation: data.interpretation, 
            transaction: mappedTxn,
            status: 'INFO_GATE_PROCESSING', 
            error: null,
            isExpanded: false 
        };
        await voiceDb.recordings.put(currentRecord);
      }
    } catch (err) {
      if (err.message === "Offline") {
          await updateTask(id, { error: 'Processing queued — waiting for internet', status: 'QUEUED' });
      } else {
          await updateTask(id, { error: err.message, status: 'ERROR' });
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInfoGateComplete = async (taskId, finalResult) => {
      const txn = finalResult.transaction;
      try {
          await dataLake.ledger.put(txn);
          
          if (txn.items && txn.items.length > 0 && (txn.transactionType === 'PURCHASE' || txn.transactionType === 'SALE')) {
              for (const item of txn.items) {
                 if (!item.productId && !item.name) continue;
                 const qty = item.quantity || 0;
                 if (qty <= 0) continue;
                 
                 const direction = txn.transactionType === 'PURCHASE' ? 'IN' : 'OUT';
                 
                 let productId = item.productId;
                 const canonical = item.canonicalName || item.productVariantName || item.name;
                 
                 if (!productId) {
                     const products = await dataLake.inventory.toArray();
                     const existing = products.find(p => p.name.toLowerCase() === canonical.toLowerCase());
                     if (existing) {
                         productId = existing.productId;
                     } else {
                         productId = crypto.randomUUID();
                         await dataLake.inventory.put({
                             productId,
                             name: canonical,
                             category: item.category || 'General',
                             minStock: 5,
                             status: 'ACTIVE'
                         });
                     }
                 }
                 
                 await dataLake.inventoryMovements.put({
                     movementId: crypto.randomUUID(),
                     productId: productId,
                     type: txn.transactionType,
                     direction: direction,
                     quantity: qty,
                     timestamp: Date.now(),
                     notes: `Voice: ${txn.partyName}`
                 });
              }
          }
          
          await updateTask(taskId, { status: 'SAVED', isExpanded: false });
          
      } catch (e) {
          alert("Failed to save transaction: " + e.message);
      }
  };

  return (
    <div className="page-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MessageSquare size={24} /> Voice Commerce
      </h2>

      <ApiKeyManager 
        geminiKey={geminiKey} setGeminiKey={setGeminiKey}
        elevenLabsKey={elevenLabsKey} setElevenLabsKey={setElevenLabsKey}
      />

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {!isRecording ? (
          <button className="btn" onClick={startRecording} style={{ background: 'var(--success)', color: 'black', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mic size={18} /> Record Voice Entry
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255, 0, 0, 0.1)', border: '1px solid var(--danger)', padding: '8px 16px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)' }}></span>
              Recording... {formatTime(recordingDuration)}
            </span>
            <button className="btn" onClick={stopRecording} style={{ background: 'var(--danger)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px' }}>
              <Square size={14} /> Stop & Process
            </button>
          </div>
        )}

        <label className="btn" style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Upload size={18} /> Upload Audio
          <input type="file" accept="audio/*" onChange={handleFileUpload} style={{ display: 'none' }} ref={fileInputRef} />
        </label>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
         {recordings.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px' }}>No voice tasks yet. Start recording!</div>
         ) : (
            recordings.map(task => (
                <VoiceReviewCard 
                   key={task.id}
                   task={task}
                   dataLake={dataLake}
                   queueService={queueService}
                   onToggle={() => updateTask(task.id, { isExpanded: !task.isExpanded })}
                   onRemove={() => voiceDb.recordings.delete(task.id)}
                   onRetry={() => {
                       updateTask(task.id, { status: task.transcription ? 'INTERPRETING' : 'TRANSCRIBING', error: null });
                       processRecording(task.id);
                   }}
                   onComplete={(res) => handleInfoGateComplete(task.id, res)}
                   onStatusChange={(status) => {
                       if (status === 'REVIEW' && task.status !== 'READY' && task.status !== 'SAVED') {
                           updateTask(task.id, { status: 'READY', isExpanded: true });
                       }
                       if (status === 'QUEUED' && task.status !== 'ERROR' && task.status !== 'SAVED') {
                           updateTask(task.id, { error: 'Processing queued — waiting for internet' });
                       }
                   }}
                />
            ))
         )}
      </div>
    </div>
  );
}

function VoiceReviewCard({ task, dataLake, queueService, onToggle, onRemove, onRetry, onComplete, onStatusChange }) {
    let icon, color;
    
    if (task.status === 'TRANSCRIBING' || task.status === 'INTERPRETING' || task.status === 'INFO_GATE_PROCESSING') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#facc15'}}/>;
        color = '#facc15';
    } else if (task.status === 'READY') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#4ade80'}}/>;
        color = '#4ade80';
    } else if (task.status === 'SAVED') {
        icon = <CheckCircle size={14} style={{ color: '#4ade80' }}/>;
        color = '#4ade80';
    } else if (task.status === 'QUEUED') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#facc15'}}/>;
        color = '#facc15';
    } else if (task.status === 'ERROR') {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: '#f87171'}}/>;
        color = '#f87171';
    } else {
        icon = <div style={{width: 12, height: 12, borderRadius: '50%', background: 'grey'}}/>;
        color = 'grey';
    }

    const titleTime = new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const titleDate = new Date(task.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    let title = `Voice Entry • ${titleDate}, ${titleTime}`;

    const audioUrl = React.useMemo(() => task.audioBlob ? URL.createObjectURL(task.audioBlob) : null, [task.audioBlob]);

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
                {task.status === 'SAVED' && <span style={{ fontSize: '12px', color: 'var(--success)' }}>(Saved)</span>}
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
                  
                  {audioUrl && (
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Original Recording</div>
                          <audio controls src={audioUrl} style={{ width: '100%', height: '36px' }} />
                      </div>
                  )}

                  {task.status === 'ERROR' && (
                      <div style={{ color: 'var(--danger)', fontSize: '14px' }}>
                          <AlertTriangle size={16} style={{display:'inline', marginRight:'8px'}}/> {task.error}
                      </div>
                  )}
                  
                  {task.status === 'TRANSCRIBING' && (
                      <div style={{ color: 'var(--accent)', fontSize: '14px', textAlign: 'center', padding: '16px' }}>
                          Transcribing audio with ElevenLabs...
                      </div>
                  )}

                  {task.transcription && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Transcription</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic' }}>"{task.transcription}"</div>
                      </div>
                  )}

                  {task.status === 'INTERPRETING' && (
                      <div style={{ color: 'var(--accent)', fontSize: '14px', textAlign: 'center', padding: '16px' }}>
                          Interpreting meaning with Gemini...
                      </div>
                  )}

                  {task.interpretation && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Gemini Interpretation</div>
                          <div style={{ fontSize: '14px' }}>{task.interpretation}</div>
                      </div>
                  )}

                  {(task.status === 'INFO_GATE_PROCESSING' || task.status === 'READY' || task.status === 'SAVED') && task.transaction && (
                      <div style={{ flex: 1, marginTop: '8px' }}>
                         <InfoGate 
                             initialTransaction={task.transaction}
                             dataLake={dataLake}
                             queueService={queueService}
                             autoStart={true}
                             onStatusChange={onStatusChange}
                             onComplete={(res) => {
                                 if (task.status !== 'SAVED') onComplete(res);
                             }}
                             onCancel={() => {}}
                         />
                      </div>
                  )}
              </div>
          )}
       </div>
    );
}
