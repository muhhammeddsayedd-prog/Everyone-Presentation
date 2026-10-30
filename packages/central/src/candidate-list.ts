import { createHash } from 'node:crypto';
import { DomainError, type Page } from '@eps/domain';

export interface CandidateListOptions { cursor?: string; limit?: number }
interface CandidateListContext { operation: 'candidate_media' | 'duplicate_matches'; principalId: string; candidateId: string }
interface CandidateListPosition { limit: number; after: string | null; scope: string }
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Use a bounded page size and the cursor returned for this candidate list.', 400); };

/** A cursor selects a position, never authority. The scoped RPC runs again on
 * every page, including when a caller has lost access since the first page. */
export function parseCandidateListOptions(value: CandidateListOptions, context: CandidateListContext): CandidateListPosition {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['cursor', 'limit'].includes(key))) invalid();
  const limit = value.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) invalid();
  const scope = createHash('sha256').update(JSON.stringify([context.operation, context.principalId, context.candidateId])).digest('hex');
  if (value.cursor === undefined) return { limit, after: null, scope };
  if (typeof value.cursor !== 'string' || value.cursor.length < 1 || value.cursor.length > 2000 || !/^[A-Za-z0-9_-]+$/u.test(value.cursor)) invalid();
  try {
    const bytes = Buffer.from(value.cursor, 'base64url');
    if (bytes.toString('base64url') !== value.cursor) invalid();
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid();
    const cursor = parsed as Record<string, unknown>;
    if (Object.keys(cursor).length !== 3 || cursor.v !== 1 || cursor.scope !== scope
      || typeof cursor.after !== 'string' || !cursor.after || cursor.after.length > 200) invalid();
    return { limit, after: cursor.after as string, scope };
  } catch { return invalid(); }
}

/** Adapt the existing authorized array RPCs without modifying released SQL.
 * ID keyset ordering survives RPC reorder/removal; it is not a frozen snapshot.
 * A future additive SQL port can use this same external cursor contract. */
export function candidateListPage<T>(rows: T[], position: CandidateListPosition, identifier: (row: T) => string): { data: T[]; page: Page } {
  const identities = rows.map(identifier);
  if (new Set(identities).size !== identities.length) throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central candidate data did not match its published contract.', 503);
  const remaining = rows.filter(row => position.after === null || identifier(row) > position.after)
    .sort((left, right) => identifier(left) < identifier(right) ? -1 : identifier(left) > identifier(right) ? 1 : 0);
  const data = remaining.slice(0, position.limit);
  return { data, page: { next_cursor: remaining.length > position.limit
    ? Buffer.from(JSON.stringify({ v: 1, scope: position.scope, after: identifier(data[data.length - 1]) })).toString('base64url') : null } };
}
