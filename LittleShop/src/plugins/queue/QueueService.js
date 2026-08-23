export class QueueService {
  constructor(dataLake) {
    this.dataLake = dataLake;
  }

  async enqueue(checkpoint) {
    const queueJobId = checkpoint.queueJobId || crypto.randomUUID();
    const now = Date.now();
    
    const job = {
      queueJobId,
      transactionReferenceId: checkpoint.transaction.referenceId,
      status: 'WAITING_FOR_NETWORK',
      createdAt: checkpoint.createdAt || now,
      updatedAt: now,
      currentStage: checkpoint.currentStage || 'RESOLVING',
      currentItemIndex: checkpoint.currentItemIndex || 0,
      totalItems: checkpoint.transaction.items.length,
      completedItems: checkpoint.currentItemIndex || 0,
      checkpoint: checkpoint.transaction,
      requiredOperation: checkpoint.requiredOperation || 'resolveProduct',
      pausedAt: now
    };

    await this.dataLake.queueJobs.put(job);
    return queueJobId;
  }

  async updateCheckpoint(queueJobId, checkpointProps) {
    const job = await this.dataLake.queueJobs.get(queueJobId);
    if (!job) return;

    const updatedJob = {
      ...job,
      ...checkpointProps,
      updatedAt: Date.now()
    };
    await this.dataLake.queueJobs.put(updatedJob);
  }

  async getJob(queueJobId) {
    return await this.dataLake.queueJobs.get(queueJobId);
  }

  async getAllJobs() {
    const jobs = await this.dataLake.queueJobs.toArray();
    return jobs.sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteJob(queueJobId) {
    await this.dataLake.queueJobs.delete(queueJobId);
  }

  async setJobStatus(queueJobId, status) {
    const job = await this.dataLake.queueJobs.get(queueJobId);
    if (job) {
      job.status = status;
      job.updatedAt = Date.now();
      await this.dataLake.queueJobs.put(job);
    }
  }

  async clearAll() {
    await this.dataLake.queueJobs.clear();
  }
}
