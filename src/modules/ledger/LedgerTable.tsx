import React, { useState } from 'react';
import type { LedgerEntry } from './types';
import { format, parseISO } from 'date-fns';
import { Edit2, Trash2 } from 'lucide-react';

interface LedgerTableProps {
  entries: LedgerEntry[];
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (id: string) => void;
}

export function LedgerTable({ entries, onEdit, onDelete }: LedgerTableProps) {
  const [filterName, setFilterName] = useState('');
  const [filterDateStr, setFilterDateStr] = useState('');

  const filteredEntries = entries.filter(entry => {
    let matchName = true;
    let matchDate = true;

    if (filterName) {
      matchName = entry.name.toLowerCase().includes(filterName.toLowerCase());
    }
    
    if (filterDateStr) {
      const entryDate = entry.timestamp.split('T')[0];
      matchDate = entryDate === filterDateStr;
    }

    return matchName && matchDate;
  });

  return (
    <div className="glass-card flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-[rgba(255,255,255,0.1)] pb-4 mb-2">
        <h3 className="text-xl">Ledger Entries</h3>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Filter by name..." 
            className="input-field max-w-[200px]"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
          <input 
            type="date" 
            className="input-field max-w-[200px]"
            value={filterDateStr}
            onChange={(e) => setFilterDateStr(e.target.value)}
          />
          {(filterName || filterDateStr) && (
            <button 
              className="btn btn-outline" 
              onClick={() => { setFilterName(''); setFilterDateStr(''); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        {filteredEntries.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Buyer</th>
                <th>Item</th>
                <th>Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr key={entry.id}>
                  <td className="text-secondary">{format(parseISO(entry.timestamp), 'MMM dd, yyyy HH:mm')}</td>
                  <td className="font-medium">{entry.name}</td>
                  <td>{entry.item}</td>
                  <td className="font-bold text-accent">${entry.amount.toFixed(2)}</td>
                  <td className="text-right">
                    <button 
                      className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-md transition-colors mr-2"
                      onClick={() => onEdit(entry)}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this entry?')) {
                          onDelete(entry.id);
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-secondary">
            No entries found. Adjust your filters or add a new entry.
          </div>
        )}
      </div>
    </div>
  );
}
