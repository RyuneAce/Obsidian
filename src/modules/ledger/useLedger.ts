import { useState } from 'react';
import type { LedgerEntry } from './types';

const STORAGE_KEY = 'smart_ledger_data';

const initialSampleData: LedgerEntry[] = [
  { id: '1', name: 'Alice', item: 'Office Supplies', amount: 45.99, timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: '2', name: 'Bob', item: 'Team Lunch', amount: 120.50, timestamp: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: '3', name: 'Charlie', item: 'Software License', amount: 299.00, timestamp: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: '4', name: 'Alice', item: 'Coffee Run', amount: 15.75, timestamp: new Date(Date.now() - 86400000 * 1).toISOString() }
];

export function useLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored ledger data", e);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSampleData));
    return initialSampleData;
  });

  const saveEntries = (newEntries: LedgerEntry[]) => {
    setEntries(newEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
  };

  const addEntry = (entry: Omit<LedgerEntry, 'id'>) => {
    const newEntry: LedgerEntry = {
      ...entry,
      id: crypto.randomUUID()
    };
    saveEntries([newEntry, ...entries]);
  };

  const updateEntry = (id: string, updatedData: Partial<LedgerEntry>) => {
    const updatedEntries = entries.map(entry =>
      entry.id === id ? { ...entry, ...updatedData } : entry
    );
    saveEntries(updatedEntries);
  };

  const deleteEntry = (id: string) => {
    const updatedEntries = entries.filter(entry => entry.id !== id);
    saveEntries(updatedEntries);
  };

  return {
    entries,
    addEntry,
    updateEntry,
    deleteEntry
  };
}
