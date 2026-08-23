import Dexie from 'dexie';

/**
 * ShopkeeperDatabase is the single local source of truth (DataLake).
 * All plugins write to and read from this central IndexedDB instance.
 */
class ShopkeeperDatabase extends Dexie {
  constructor() {
    super('ShopkeeperDataLake');
    
    // Define the schema for the database.
    // & = unique primary key, ++ = auto-increment
    this.version(1).stores({
      ledger: 'eventId, partyName, partyType, transactionType, direction, timestamp',
      inventory: 'productId, name, category, stock',
      suppliers: 'supplierId, name',
      bills: 'billId, timestamp, valid'
    });
    
    this.version(2).stores({
      ledger: 'eventId, partyName, partyType, transactionType, direction, timestamp',
    });

    this.version(3).stores({
      inventory: 'productId, name, category, status', // updated schema
      inventoryMovements: 'movementId, productId, type, direction, timestamp'
    });

    this.version(4).stores({
      suppliers: 'supplierId, name, status', // updated schema
      purchaseOrders: 'orderId, supplierId, status, timestamp'
    });

    this.version(5).stores({
      productCategories: 'id, name',
      productFamilies: 'id, categoryId, name',
      brands: 'id, name, *categoryIds',
      canonicalProducts: 'id, familyId, brandId, name',
      productAliases: 'id, alias, normalizedAlias, targetType, targetId, confidence, source'
    });
    this.version(6).stores({
      productKnowledgeRegistry: 'productId, canonicalName, brand, category, subcategory, *aliases, version, updatedAt, source'
    });
    this.version(7).stores({
      productKnowledgeLog: '++id, productId, type, timestamp'
    });
    this.version(8).stores({
      unresolvedInventory: '++id, rawName, quantity, unit, timestamp, status'
    });
    this.version(9).stores({
      knowledgeActions: 'id, type, entityType, entityId, timestamp, source'
    });
    this.version(10).stores({
      rawEvents: 'eventId, source, timestamp'
    });
    this.version(11).stores({
      queueJobs: 'queueJobId, transactionReferenceId, status, createdAt'
    });
  }
}

const db = new ShopkeeperDatabase();
export default db;
