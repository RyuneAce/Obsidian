import dataLake from '../datalake/Database';

class SyncManager {
   constructor(db) {
       this.dataLake = db;
       this.isSyncing = false;
       this.syncStatus = 'SYNCED'; // 'SYNCED', 'SYNCING', 'WARNINGS', 'FAILED', 'COOLDOWN'
       
       this.burstCount = 0;
       this.cooldownSeconds = 5;
       this.cooldownEndTime = 0;
       this.lastAbuseTime = 0;
       
       this.listeners = new Set();
   }

   subscribe(listener) {
       this.listeners.add(listener);
       // Immediately invoke with current state
       listener(this.getState());
       return () => this.listeners.delete(listener);
   }

   notify() {
       const state = this.getState();
       this.listeners.forEach(l => l(state));
   }

   getState() {
       return {
           isSyncing: this.isSyncing,
           status: this.syncStatus,
           cooldownEndTime: this.cooldownEndTime,
           burstCount: this.burstCount
       };
   }
   
   async triggerSync() {
       // Cooldown check
       if (Date.now() < this.cooldownEndTime) {
           return; // Ignore clicks during cooldown
       }

       // Lock check
       if (this.isSyncing) {
           return;
       }
       
       // Abuse reset logic (10 min of good behavior)
       if (this.lastAbuseTime && (Date.now() - this.lastAbuseTime > 10 * 60 * 1000)) {
           this.cooldownSeconds = 5;
           this.lastAbuseTime = 0;
           this.burstCount = 0;
       }

       this.burstCount++;

       if (this.burstCount > 5) {
           // Abuse event!
           this.syncStatus = 'COOLDOWN';
           this.cooldownEndTime = Date.now() + (this.cooldownSeconds * 1000);
           this.lastAbuseTime = Date.now();
           
           // Escalate cooldown for next time (cap at 3600)
           this.cooldownSeconds = Math.min(this.cooldownSeconds * 2, 3600);
           
           this.notify();
           
           // Automatically restore status after cooldown
           setTimeout(() => {
               // Only reset if we are still in COOLDOWN and timer expired
               if (this.syncStatus === 'COOLDOWN' && Date.now() >= this.cooldownEndTime) {
                   this.syncStatus = 'SYNCED';
                   this.burstCount = 0; // reset burst for the next round
                   this.notify();
               }
           }, this.cooldownEndTime - Date.now());
           
           return;
       }

       this.isSyncing = true;
       this.syncStatus = 'SYNCING';
       this.notify();

       try {
           await this.performReconciliation();
           this.syncStatus = 'SYNCED';
       } catch (err) {
           console.error("Sync failed:", err);
           this.syncStatus = 'FAILED';
       } finally {
           this.isSyncing = false;
           this.notify();
       }
   }

   async performReconciliation() {
       // Data Lake Integrity Check: Ensure inventory items exist for all movements
       const movements = await this.dataLake.inventoryMovements.toArray();
       const inventory = await this.dataLake.inventory.toArray();
       const knownIds = new Set(inventory.map(p => p.productId));
       
       let fixCount = 0;
       for (const mov of movements) {
          if (!knownIds.has(mov.productId)) {
             await this.dataLake.inventory.put({
                 productId: mov.productId,
                 name: mov.rawInput || 'Unknown Product',
                 category: 'General',
                 minStock: 5,
                 status: 'ACTIVE'
             });
             knownIds.add(mov.productId);
             fixCount++;
          }
       }
       
       if (fixCount > 0) {
           console.warn(`Sync Reconciled ${fixCount} missing inventory records.`);
       }
       
       // Force a full read of Ledger and PKDB to verify access
       await this.dataLake.ledger.toArray();
       await this.dataLake.productKnowledgeRegistry.toArray();
       
       // UI feedback delay
       await new Promise(r => setTimeout(r, 600));
   }
}

const globalSyncManager = new SyncManager(dataLake);
export default globalSyncManager;
