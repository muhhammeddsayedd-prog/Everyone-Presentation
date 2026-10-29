import type { JobEvent, JobEventReceipt } from '@eps/jobs';

interface CallbackPort { recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt> }
interface CallbackOptions {
  signal: AbortSignal; timeoutMs: number; leaseDeadlineMs: number;
  /** Offline scheduling seams, never fields from a work order or uploaded file. */
  now?: () => number; sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}
export class CandidateCallbackError extends Error {
  constructor(readonly code: 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') {
    super('The candidate callback could not be confirmed. Durable state determines recovery.'); this.name = 'CandidateCallbackError';
  }
}
const transport = new Set(['CONNECT_TIMEOUT', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'EPIPE',
  '08000', '08001', '08003', '08004', '08006', '08007', '53300', '57P01', '57P02', '57P03']);
const transaction = new Set(['55P03', '57014', '40001', '40P01']);
const phases = new Set(['connect', 'begin', 'role_verification', 'operation', 'commit']);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function parseReceipt(value: unknown, eventId: string): JobEventReceipt | undefined {
  try {
    if (!object(value) || Object.keys(value).length !== 5) return;
    const parsed = { event_id: value.event_id, applied: value.applied, duplicate: value.duplicate, stale: value.stale, job_status: value.job_status };
    if (parsed.event_id !== eventId || typeof parsed.applied !== 'boolean' || typeof parsed.duplicate !== 'boolean' || typeof parsed.stale !== 'boolean'
      || typeof parsed.job_status !== 'string' || !['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'].includes(parsed.job_status)
      || !parsed.applied && !parsed.duplicate && !parsed.stale) return;
    return parsed as JobEventReceipt;
  } catch { return; }
}
function transient(error: unknown): boolean {
  try {
    if (!object(error)) return false;
    const code = error.code; const outcome = error.outcome; const phase = error.gateway_phase; const reason = error.transport_code;
    if (outcome !== 'known' && outcome !== 'unknown' || typeof phase !== 'string' || !phases.has(phase) || typeof reason !== 'string') return false;
    return code === 'RUNTIME_UNAVAILABLE' && transport.has(reason) || code === 'DEPENDENCY_UNAVAILABLE' && outcome === 'known' && transaction.has(reason);
  } catch { return false; }
}
function unconfirmed(): never { throw new CandidateCallbackError('CALLBACK_UNCONFIRMED'); }
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, deadline: number, now: () => number, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new CandidateCallbackError('PROCESSING_CANCELLED');
  const remaining = Math.ceil(deadline - now()); if (remaining <= 0) unconfirmed();
  const controller = new AbortController(); let rejectWait!: (error: CandidateCallbackError) => void;
  const stopped = new Promise<never>((_resolve, reject) => { rejectWait = reject; });
  const cancel = () => { controller.abort(); rejectWait(new CandidateCallbackError('PROCESSING_CANCELLED')); };
  const timer = setTimeout(() => { controller.abort(); rejectWait(new CandidateCallbackError('CALLBACK_UNCONFIRMED')); }, remaining);
  signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel();
  try { return await Promise.race([stopped, Promise.resolve().then(() => { if (controller.signal.aborted) return stopped; return operation(controller.signal); })]); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}
function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new CandidateCallbackError('PROCESSING_CANCELLED')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
  });
}
/** Retry only a database callback: exact same event ID, sequence and private
 * payload. No computation/provider/asset operation is accepted by this port.
 * An unresolved final send stays unknown; it never emits a competing event. */
export async function deliverCandidateCallback(event: JobEvent, port: CallbackPort, options: CallbackOptions): Promise<{ receipt: JobEventReceipt; firstSentAt: number }> {
  const now = options.now ?? Date.now; const firstSentAt = now();
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 10 || options.timeoutMs > 15_000 || !Number.isFinite(options.leaseDeadlineMs)) unconfirmed();
  if (options.signal.aborted) throw new CandidateCallbackError('PROCESSING_CANCELLED');
  if (options.leaseDeadlineMs - 1000 <= firstSentAt) throw new CandidateCallbackError('LEASE_STALE');
  const deadline = Math.min(firstSentAt + options.timeoutMs, options.leaseDeadlineMs - 1000);
  let snapshot: JobEvent; try { snapshot = structuredClone(event); } catch { return unconfirmed(); }
  for (let attempt = 0; attempt < 3; attempt++) {
    let receipt: unknown;
    try { receipt = await bounded(signal => port.recordEvent(structuredClone(snapshot), signal), deadline, now, options.signal); }
    catch (error) {
      if (options.signal.aborted) throw new CandidateCallbackError('PROCESSING_CANCELLED');
      if (!transient(error) || attempt === 2) return unconfirmed();
      const wait = attempt === 0 ? 250 : 750;
      if (deadline - now() <= wait) return unconfirmed();
      try { await bounded(signal => (options.sleep ?? pause)(wait, signal), deadline, now, options.signal); }
      catch { if (options.signal.aborted) throw new CandidateCallbackError('PROCESSING_CANCELLED'); return unconfirmed(); }
      continue;
    }
    const confirmed = parseReceipt(receipt, snapshot.event_id); if (!confirmed) return unconfirmed();
    if (confirmed.stale) throw new CandidateCallbackError('LEASE_STALE');
    return { receipt: confirmed, firstSentAt };
  }
  return unconfirmed();
}
