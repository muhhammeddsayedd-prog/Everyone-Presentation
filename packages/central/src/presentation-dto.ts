import { DomainError } from '@eps/domain';
import { parsePresentationVersion } from '../../domain/src/presentation.ts';
import type { PresentationVersion } from '../../domain/src/presentation-types.ts';
export function presentationResponseInvalid(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central presentation data did not match its fixed contract.', 503); }
export function presentationRecord(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) presentationResponseInvalid();
  return value as Record<string, unknown>;
}
export function presentationVersionDto(value: unknown): PresentationVersion {
  try { return parsePresentationVersion(value); } catch { return presentationResponseInvalid(); }
}
