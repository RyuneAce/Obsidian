import React, { useMemo } from 'react';
import type { LedgerEntry } from './types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, parseISO } from 'date-fns';

interface LedgerDashboardProps {
  entries: LedgerEntry[];
}

export function LedgerDashboard({ entries }: LedgerDashboardProps) {
  const totalSpent = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.amount, 0);
  }, [entries]);

  const chartData = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const date = format(parseISO(entry.timestamp), 'MMM dd');
      if (!acc[date]) acc[date] = 0;
      acc[date] += entry.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([date, amount]) => ({ date, amount }))
      .reverse(); // assuming entries are newest first, we want chronological for chart
  }, [entries]);

  const topBuyers = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      if (!acc[entry.name]) acc[entry.name] = 0;
      acc[entry.name] += entry.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [entries]);

  return (
    <div className="flex flex-col gap-6 mb-6">
      <div className="glass-card flex flex-col items-center justify-center py-8">
        <h2 className="text-secondary mb-2 uppercase tracking-wider text-sm font-semibold">Total Ledger Balance</h2>
        <div className="text-4xl font-bold text-accent">${totalSpent.toFixed(2)}</div>
      </div>

      <div className="flex gap-6 flex-wrap md:flex-nowrap">
        <div className="glass-card flex-1 min-w-[300px]" style={{ height: 300 }}>
          <h3 className="mb-4 text-lg font-medium">Spending Over Time</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Area type="monotone" dataKey="amount" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAmount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card flex-1 min-w-[300px]" style={{ height: 300 }}>
          <h3 className="mb-4 text-lg font-medium">Top Contributors</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topBuyers} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
