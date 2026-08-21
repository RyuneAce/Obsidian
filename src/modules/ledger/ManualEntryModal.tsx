import React, { useState } from 'react';
import type { LedgerEntry } from './types';

interface ManualEntryModalProps {
  initialData?: Partial<LedgerEntry>;
  onSave: (entry: Omit<LedgerEntry, 'id'>) => void;
  onCancel: () => void;
}

export function ManualEntryModal({ initialData, onSave, onCancel }: ManualEntryModalProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    item: initialData?.item || '',
    amount: initialData?.amount ? initialData.amount.toString() : '',
    timestamp: initialData?.timestamp ? new Date(initialData.timestamp).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      item: formData.item,
      amount: Number(formData.amount),
      timestamp: new Date(formData.timestamp).toISOString()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="form-group">
        <label>Name / Buyer</label>
        <input 
          required 
          className="input-field" 
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          placeholder="e.g. Alice"
        />
      </div>
      <div className="form-group">
        <label>Item</label>
        <input 
          required 
          className="input-field" 
          value={formData.item}
          onChange={e => setFormData({...formData, item: e.target.value})}
          placeholder="e.g. Groceries"
        />
      </div>
      <div className="form-group">
        <label>Amount ($)</label>
        <input 
          required 
          type="number" 
          step="0.01"
          className="input-field" 
          value={formData.amount}
          onChange={e => setFormData({...formData, amount: e.target.value})}
          placeholder="0.00"
        />
      </div>
      <div className="form-group">
        <label>Date</label>
        <input 
          required 
          type="datetime-local" 
          className="input-field" 
          value={formData.timestamp}
          onChange={e => setFormData({...formData, timestamp: e.target.value})}
        />
      </div>
      
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn">
          Save Entry
        </button>
      </div>
    </form>
  );
}
