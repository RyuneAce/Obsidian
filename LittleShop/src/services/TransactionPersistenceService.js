export class TransactionPersistenceService {
    /**
     * Saves a canonical transaction to the DataLake.
     * Updates Ledger, Inventory (and Movements), and logs to rawEvents.
     * 
     * @param {Object} dataLake - The DataLake (Dexie instance).
     * @param {Object} txn - The canonical transaction object from TransactionReview.
     * @param {String} source - The workflow source (e.g., 'MANUAL', 'SCANNER', 'VOICE', 'QUEUE').
     * @returns {Promise<Object>} The saved transaction.
     */
    static async saveTransaction(dataLake, txn, source = 'MANUAL') {
        if (!dataLake) throw new Error("DataLake is required for persistence.");
        if (!txn) throw new Error("Transaction object is required.");

        try {
            // 1. Ensure eventId & timestamp
            if (!txn.eventId) txn.eventId = crypto.randomUUID();
            if (!txn.timestamp) txn.timestamp = Date.now();

            // 2. Log to rawEvents for auditability
            await dataLake.rawEvents.put({
                eventId: txn.eventId,
                source: source,
                timestamp: txn.timestamp,
                payload: txn
            });

            // 3. Process Inventory Updates (if applicable)
            if (txn.items && txn.items.length > 0 && (txn.transactionType === 'PURCHASE' || txn.transactionType === 'SALE' || txn.transactionType === 'INVENTORY_UPDATE')) {
                const inventory = await dataLake.inventory.toArray();

                for (const item of txn.items) {
                    if (!item.productVariantName && !item.name) continue;
                    const qty = parseFloat(item.quantity) || 0;
                    if (qty <= 0) continue;
                    
                    let targetName = item.productVariantName || item.name;
                    
                    // Match against existing inventory (exact name match)
                    let existing = inventory.find(p => p.name === targetName);
                    
                    let finalProductId = existing ? existing.productId : ('prod_' + crypto.randomUUID());

                    if (!existing) {
                        existing = {
                            productId: finalProductId,
                            name: targetName,
                            category: item.category || 'General',
                            minStock: 5,
                            status: 'ACTIVE',
                            currentStock: 0
                        };
                        inventory.push(existing);
                    }

                    // Determine movement direction based on transaction type
                    let direction = 'IN';
                    if (txn.transactionType === 'SALE') direction = 'OUT';
                    else if (txn.transactionType === 'PURCHASE') direction = 'IN';
                    else if (txn.transactionType === 'INVENTORY_UPDATE') direction = txn.direction || 'IN';
                    
                    // Mutate stock in DB
                    existing.currentStock = (existing.currentStock || 0) + (direction === 'IN' ? qty : -qty);
                    await dataLake.inventory.put(existing);

                    await dataLake.inventoryMovements.put({
                        movementId: crypto.randomUUID(),
                        productId: finalProductId,
                        type: txn.transactionType,
                        direction: direction,
                        quantity: qty,
                        timestamp: Date.now(),
                        notes: txn.notes || `Source: ${source}`,
                        rawInput: item.rawName || item.name
                    });
                }
            }

            // 4. Save to Ledger
            await dataLake.ledger.put({
                ...txn,
                timestamp: txn.timestamp || Date.now(),
                direction: txn.direction || (txn.transactionType === 'SALE' ? 'IN' : 'OUT'),
                partyType: txn.partyType || 'EXTERNAL'
            });

            return txn;
        } catch (e) {
            console.error("[TransactionPersistenceService] Failed to save transaction:", e);
            throw new Error(`Persistence failed: ${e.message}`);
        }
    }
}
