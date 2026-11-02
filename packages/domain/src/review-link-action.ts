import { DomainError } from './types.ts';
import { guestInteger, guestRecord } from './guest.ts';
import type { ReviewLinkAction } from './guest-types.ts';

/** ArchiveRequest has no text-length limit. HTTP owns its existing 64 KiB body
 * limit; retain the exact optional reason in the canonical replay/MAC input. */
export function parseReviewLinkAction(value: unknown): ReviewLinkAction {
  const row = guestRecord(value, ['row_version', 'reason'], ['row_version']);
  const result: ReviewLinkAction = { row_version: guestInteger(row.row_version) };
  if (Object.hasOwn(row, 'reason')) {
    if (row.reason !== null) {
      if (typeof row.reason !== 'string') invalid();
      // PostgreSQL JSONB cannot represent NUL or an unpaired UTF-16 surrogate.
      for (const character of row.reason as string) {
        const point = character.codePointAt(0)!;
        if (point === 0 || point >= 0xd800 && point <= 0xdfff) invalid();
      }
    }
    result.reason = row.reason as string | null;
  }
  return result;
}
function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Review data does not match the supported contract.', 400); }
