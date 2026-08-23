import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';

// Date Helpers
const DAY_MS = 24 * 60 * 60 * 1000;
const getCutoff = (days) => Date.now() - (days * DAY_MS);

export function useAiInsightsEngine(dataLake) {
  const allLedger = useLiveQuery(() => dataLake.ledger.toArray(), []) || [];
  const inventory = useLiveQuery(() => dataLake.inventory.toArray(), []) || [];

  return useMemo(() => {
    const now = Date.now();
    const last30DaysCutoff = getCutoff(30);
    const last7DaysCutoff = getCutoff(7);
    const previous7DaysCutoff = getCutoff(14);

    // Filter transactions
    const txns30Days = allLedger.filter(t => t.timestamp >= last30DaysCutoff);
    const txns7Days = allLedger.filter(t => t.timestamp >= last7DaysCutoff);
    const txnsPrev7Days = allLedger.filter(t => t.timestamp >= previous7DaysCutoff && t.timestamp < last7DaysCutoff);

    // Basic Money Metrics
    const calcSales = (txns) => txns.filter(t => t.transactionType === 'SALE').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const calcPurch = (txns) => txns.filter(t => t.transactionType === 'PURCHASE').reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const sales7Days = calcSales(txns7Days);
    const purch7Days = calcPurch(txns7Days);
    const salesPrev7Days = calcSales(txnsPrev7Days);
    const net7Days = sales7Days - purch7Days;

    let salesChangePercent = 0;
    if (salesPrev7Days > 0) {
      salesChangePercent = ((sales7Days - salesPrev7Days) / salesPrev7Days) * 100;
    } else if (sales7Days > 0) {
      salesChangePercent = 100;
    }

    // Inventory State Building
    const productMap = new Map();
    inventory.forEach(p => productMap.set(p.productId || p.name, { ...p, calculatedStock: 0 }));
    allLedger.forEach(txn => {
        (txn.items || []).forEach(item => {
            let pid = item.productId;
            if (!pid) {
                const itemName = item.canonicalName || item.name;
                if (itemName) {
                    const invMatch = inventory.find(i => i.name && i.name.toLowerCase() === itemName.toLowerCase());
                    if (invMatch) pid = invMatch.productId;
                }
            }
            if (pid && productMap.has(pid)) {
                const p = productMap.get(pid);
                const qty = Number(item.quantity || 0);
                if (txn.transactionType === 'SALE') {
                    p.calculatedStock -= qty;
                } else if (txn.transactionType === 'PURCHASE') {
                    p.calculatedStock += qty;
                }
            }
        });
    });

    const activeInv = Array.from(productMap.values());
    const outOfStock = activeInv.filter(i => i.calculatedStock <= 0);
    const lowStock = activeInv.filter(i => i.calculatedStock > 0 && i.calculatedStock <= (i.minStock || 5));

    // Product Sales Performance (Last 30 days)
    const productSalesMap = new Map();
    txns30Days.filter(t => t.transactionType === 'SALE').forEach(txn => {
      (txn.items || []).forEach(item => {
         const name = item.canonicalName || item.name || 'Unknown';
         const current = productSalesMap.get(name) || { qty: 0, rev: 0 };
         current.qty += Number(item.quantity || 0);
         current.rev += Number(item.total || 0);
         productSalesMap.set(name, current);
      });
    });
    
    const topProducts = Array.from(productSalesMap.entries())
      .map(([name, stats]) => ({ name, quantitySold: stats.qty, revenue: stats.rev }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    // Anomalies & What I Noticed (Deterministic Rules)
    const notices = [];
    
    // 1. Significant Sales Drop/Increase
    if (salesChangePercent <= -20 && salesPrev7Days > 100) {
       notices.push({ type: 'danger', message: `Sales dropped ${Math.abs(Math.round(salesChangePercent))}% this week compared to last week.` });
    } else if (salesChangePercent >= 20 && salesPrev7Days > 100) {
       notices.push({ type: 'success', message: `Sales are up ${Math.round(salesChangePercent)}% this week!` });
    }

    // 2. Inventory warnings
    if (outOfStock.length > 0) {
       notices.push({ type: 'danger', message: `${outOfStock.length} products are currently out of stock.`, details: outOfStock.map(p => p.name) });
    }
    if (lowStock.length > 0) {
       notices.push({ type: 'warning', message: `${lowStock.length} products are running low.`, details: lowStock.map(p => p.name) });
    }

    // Return structured deterministic data that UI and AI can both use
    return {
      money: {
         last7Days: { sales: sales7Days, purchases: purch7Days, net: net7Days },
         changeVsPrevious7Days: { salesChangePercent }
      },
      inventory: {
         totalActive: activeInv.length,
         outOfStockCount: outOfStock.length,
         lowStockCount: lowStock.length,
         outOfStockItems: outOfStock.map(i => i.name),
         lowStockItems: lowStock.map(i => i.name)
      },
      products: {
         topSellingLast30Days: topProducts
      },
      notices
    };
  }, [allLedger, inventory]);
}
