import Dexie from 'dexie';

class VoiceCommerceDatabase extends Dexie {
  constructor() {
    super('VoiceCommerceDataLake');
    
    // Schema definition for local voice records
    this.version(1).stores({
      recordings: 'id, createdAt, status, committed'
    });
    
    this.version(2).stores({
      recordings: 'id, createdAt, status'
    });
  }
}

const voiceDb = new VoiceCommerceDatabase();
export default voiceDb;
