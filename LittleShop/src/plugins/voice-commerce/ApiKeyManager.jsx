import React, { useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function ApiKeyManager({ geminiKey, setGeminiKey, elevenLabsKey, setElevenLabsKey }) {
  const [editing, setEditing] = useState(!geminiKey || !elevenLabsKey);
  const [geminiInput, setGeminiInput] = useState(geminiKey || '');
  const [elevenLabsInput, setElevenLabsInput] = useState(elevenLabsKey || '');

  const save = () => {
    localStorage.setItem('gemini_api_key', geminiInput);
    localStorage.setItem('elevenlabs_api_key', elevenLabsInput);
    setGeminiKey(geminiInput);
    setElevenLabsKey(elevenLabsInput);
    setEditing(false);
  };

  if (!editing && geminiKey && elevenLabsKey) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--success)' }}><CheckCircle size={16}/> Voice AI Keys Configured</div>
        <button className="btn-tactile" onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>Edit Keys</button>
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: '16px', marginBottom: '24px', border: '1px solid var(--warning)' }}>
      <h4 style={{ marginBottom: '8px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertTriangle size={16} /> Configure Voice AI
      </h4>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Provide your API keys for speech transcription (ElevenLabs) and business context extraction (Gemini).</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gemini API Key</label>
        <input type="password" value={geminiInput} onChange={e => setGeminiInput(e.target.value)} placeholder="Gemini Key: AIzaSy..." style={{ width: '100%', padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px', fontSize: '14px' }} />
        
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ElevenLabs API Key</label>
        <input type="password" value={elevenLabsInput} onChange={e => setElevenLabsInput(e.target.value)} placeholder="ElevenLabs Key: sk_..." style={{ width: '100%', padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px', fontSize: '14px' }} />
        
        <button className="btn btn-tactile" onClick={save} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>Save Keys</button>
      </div>
    </div>
  );
}
