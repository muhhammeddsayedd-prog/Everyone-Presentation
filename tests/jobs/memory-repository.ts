import type { IdempotencyRecord, JobRecord, JobRepository, JobTransaction, OutboxRecord, StoredEvent } from '../../packages/jobs/src/types.ts';
import { JobError } from '../../packages/jobs/src/types.ts';

/** TEST FIXTURE ONLY. This deliberately has no production package export. */
export class MemoryJobRepository implements JobRepository<MemoryTransaction> {
  private state = { jobs: [] as JobRecord[], events: [] as StoredEvent[], outbox: [] as OutboxRecord[], idempotency: [] as IdempotencyRecord[], applied: [] as string[] };
  private tail: Promise<void> = Promise.resolve();
  failNextCommit = false;
  async transaction<R>(operation: (tx: MemoryTransaction) => Promise<R>): Promise<R> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(done => { release = done; });
    await previous;
    try {
      const draft = structuredClone(this.state);
      const result = await operation(new MemoryTransaction(draft));
      if (this.failNextCommit) { this.failNextCommit = false; throw new Error('injected transaction commit failure'); }
      this.state = draft;
      return structuredClone(result);
    } finally { release(); }
  }
  inspect() { return structuredClone(this.state); }
}
type State = ReturnType<MemoryJobRepository['inspect']>;
export class MemoryTransaction implements JobTransaction {
  private state: State;
  constructor(state: State) { this.state = state; }
  async getJobForUpdate(id: string) { return structuredClone(this.state.jobs.find(x => x.id === id) ?? null); }
  async findJobByDedupeKey(key: string) { return structuredClone(this.state.jobs.find(x => x.dedupe_key === key) ?? null); }
  async insertJob(job: JobRecord) { if (this.state.jobs.some(x => x.id === job.id || x.dedupe_key === job.dedupe_key)) throw new JobError('DUPLICATE_JOB', 'Duplicate job.'); this.state.jobs.push(structuredClone(job)); }
  async saveJob(job: JobRecord, expected: number) { const index = this.state.jobs.findIndex(x => x.id === job.id); if (index < 0 || this.state.jobs[index]!.row_version !== expected) throw new JobError('STALE_RESOURCE_VERSION', 'Stale job.'); this.state.jobs[index] = structuredClone(job); }
  async findEventById(job: string, attempt: string, event: string) { return structuredClone(this.state.events.find(x => x.job_id === job && x.attempt_id === attempt && x.event_id === event) ?? null); }
  async findEventBySequence(job: string, attempt: string, sequence: number) { return structuredClone(this.state.events.find(x => x.job_id === job && x.attempt_id === attempt && x.sequence === sequence) ?? null); }
  async insertEvent(event: StoredEvent) { if (await this.findEventById(event.job_id, event.attempt_id, event.event_id) || await this.findEventBySequence(event.job_id, event.attempt_id, event.sequence)) throw new JobError('DUPLICATE_EVENT', 'Duplicate event.'); this.state.events.push(structuredClone(event)); }
  async getIdempotency(scope: string, key: string) { return structuredClone(this.state.idempotency.find(x => x.scope === scope && x.key === key) ?? null); }
  async putIdempotency(record: IdempotencyRecord) { if (await this.getIdempotency(record.scope, record.key)) throw new JobError('DUPLICATE_IDEMPOTENCY', 'Duplicate idempotency record.'); this.state.idempotency.push(structuredClone(record)); }
  async insertOutbox(event: OutboxRecord) { if (!this.state.jobs.some(x => x.id === event.job_id)) throw new Error('outbox job foreign key missing'); if (this.state.outbox.some(x => x.id === event.id || x.dedupe_key === event.dedupe_key)) throw new JobError('DUPLICATE_OUTBOX', 'Duplicate dispatch.'); this.state.outbox.push(structuredClone(event)); }
  async getOutboxForUpdate(id: string) { return structuredClone(this.state.outbox.find(x => x.id === id) ?? null); }
  async saveOutbox(event: OutboxRecord) { const index = this.state.outbox.findIndex(x => x.id === event.id); if (index < 0) throw new Error('missing outbox'); this.state.outbox[index] = structuredClone(event); }
  async listDispatchableOutbox(now: string, limit: number) { return structuredClone(this.state.outbox.filter(x => x.status === 'pending' && x.available_at <= now || x.status === 'leased' && x.lease_expires_at !== null && x.lease_expires_at <= now).sort((a, b) => a.available_at.localeCompare(b.available_at) || a.id.localeCompare(b.id)).slice(0, limit)); }
  async listExpiredJobs(now: string, limit: number) { return structuredClone(this.state.jobs.filter(x => x.status === 'running' && x.lease_expires_at !== null && x.lease_expires_at <= now).sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit)); }
  async applyResource(id: string) { this.state.applied.push(id); }
}
