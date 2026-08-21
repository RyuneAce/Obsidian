import React, { useState } from 'react';
import { useLedger } from './modules/ledger/useLedger';
import { LedgerDashboard } from './modules/ledger/LedgerDashboard';
import { LedgerTable } from './modules/ledger/LedgerTable';
import { ManualEntryModal } from './modules/ledger/ManualEntryModal';
import { GeminiUpload } from './modules/ledger/GeminiUpload';
import type { LedgerEntry } from './modules/ledger/types';
import { Plus, Camera, Wallet } from 'lucide-react';

function App() {
  const { entries, addEntry, updateEntry, deleteEntry } = useLedger();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'manual' | 'edit' | 'scan'>('manual');
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | undefined>();

  const handleOpenManual = () => {
    setModalMode('manual');
    setEditingEntry(undefined);
    setIsModalOpen(true);
  };

  const handleOpenScan = () => {
    setModalMode('scan');
    setEditingEntry(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (entry: LedgerEntry) => {
    setEditingEntry(entry);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveEntry = (entryData: Omit<LedgerEntry, 'id'>) => {
    if (modalMode === 'edit' && editingEntry) {
      updateEntry(editingEntry.id, entryData);
    } else {
      addEntry(entryData);
    }
    setIsModalOpen(false);
  };

  const handleScanSuccess = (extractedData: Omit<LedgerEntry, 'id'>) => {
    // When scan is successful, open manual mode with pre-filled data to verify
    setEditingEntry({ ...extractedData, id: 'temp' } as LedgerEntry);
    setModalMode('manual');
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-accent p-3 rounded-xl shadow-lg shadow-blue-500/20">
            <Wallet size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Smart Ledger</h1>
            <p className="text-secondary">AI-Powered Shared Expense Tracker</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button className="btn btn-outline" onClick={handleOpenScan}>
            <Camera size={20} />
            Scan Receipt
          </button>
          <button className="btn" onClick={handleOpenManual}>
            <Plus size={20} />
            Add Entry
          </button>
        </div>
      </header>

      <main>
        <LedgerDashboard entries={entries} />
        
        <LedgerTable 
          entries={entries} 
          onEdit={handleEdit} 
          onDelete={deleteEntry} 
        />
      </main>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2 className="text-2xl mb-6">
              {modalMode === 'scan' ? 'Smart Scan Receipt' : 
               modalMode === 'edit' ? 'Edit Entry' : 
               editingEntry ? 'Review Scanned Entry' : 'New Manual Entry'}
            </h2>
            
            {modalMode === 'scan' ? (
              <GeminiUpload 
                onDataExtracted={handleScanSuccess} 
                onCancel={() => setIsModalOpen(false)} 
              />
            ) : (
              <ManualEntryModal 
                initialData={editingEntry}
                onSave={handleSaveEntry}
                onCancel={() => setIsModalOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
