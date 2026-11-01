import { guestResponseInvalid } from './guest.ts';
import { PRESENTATION_MAXIMUM_SLIDES } from './presentation.ts';
import { DomainError } from './types.ts';

export interface FeedbackCounts {
  preferred: number; maybe: number; not_preferred: number;
  comment_count: number; unresolved_count: number;
}
export interface FeedbackSummary {
  version_id: string;
  per_slide: (FeedbackCounts & { version_slide_id: string })[];
  totals: FeedbackCounts;
}
const KEYS = ['preferred', 'maybe', 'not_preferred', 'comment_count', 'unresolved_count'] as const;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
export function parseFeedbackSummaryVersionId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new DomainError('VALIDATION_FAILED', 'Provide a valid feedback version identifier.', 400);
  return value;
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) guestResponseInvalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== keys.length || Object.keys(descriptors).length !== keys.length
    || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) guestResponseInvalid();
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) guestResponseInvalid();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) guestResponseInvalid();
  return value;
}
function counts(value: unknown, slide = false): FeedbackCounts {
  const row = record(value, slide ? ['version_slide_id', ...KEYS] : KEYS);
  const result = Object.fromEntries(KEYS.map(key => [key, count(row[key])])) as unknown as FeedbackCounts;
  if (result.unresolved_count > result.comment_count) guestResponseInvalid();
  return result;
}
/** Counts only. Unknown fields never become a comment/identity disclosure path. */
export function feedbackSummaryDto(value: unknown): FeedbackSummary {
  try {
    const row = record(value, ['version_id', 'per_slide', 'totals']);
    const version_id = id(row.version_id);
    if (!Array.isArray(row.per_slide) || row.per_slide.length > PRESENTATION_MAXIMUM_SLIDES
      || Object.keys(row.per_slide).length !== row.per_slide.length) guestResponseInvalid();
    const seen = new Set<string>();
    const sums: FeedbackCounts = { preferred: 0, maybe: 0, not_preferred: 0, comment_count: 0, unresolved_count: 0 };
    const per_slide = row.per_slide.map(value => {
      const fields = record(value, ['version_slide_id', ...KEYS]);
      const version_slide_id = id(fields.version_slide_id);
      if (seen.has(version_slide_id)) guestResponseInvalid();
      seen.add(version_slide_id);
      const result = counts(fields, true);
      for (const key of KEYS) sums[key] = count(sums[key] + result[key]);
      return { version_slide_id, ...result };
    });
    const totals = counts(row.totals);
    if (KEYS.some(key => totals[key] !== sums[key])) guestResponseInvalid();
    return { version_id, per_slide, totals };
  } catch { return guestResponseInvalid(); }
}
