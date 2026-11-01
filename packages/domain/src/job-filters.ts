import { DomainError } from './types.ts';

export const JOB_STATUSES = ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'] as const;
export interface JobListOptions {
  workspace_id?: string; status?: typeof JOB_STATUSES[number]; cursor?: string; limit?: number; batch_id?: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const boundedId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
function invalid(): never { throw new DomainError('INVALID_REQUEST', 'Provide supported job filters and a bounded page size.', 400); }

/** A batch identifies a group, never a principal or an authorization scope. */
export function parseJobListOptions(value: unknown): JobListOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !['workspace_id', 'status', 'cursor', 'limit', 'batch_id'].includes(key)) invalid();
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.hasOwn(descriptor, 'value')) invalid();
    const field = descriptor.value;
    if (field === undefined) continue;
    if (key === 'batch_id' && (typeof field !== 'string' || !UUID.test(field))
      || ['workspace_id', 'cursor'].includes(key) && !boundedId(field)
      || key === 'status' && !JOB_STATUSES.includes(field)
      || key === 'limit' && (typeof field !== 'number' || !Number.isSafeInteger(field) || field < 1 || field > 100)) invalid();
    result[key] = field;
  }
  return result as JobListOptions;
}
