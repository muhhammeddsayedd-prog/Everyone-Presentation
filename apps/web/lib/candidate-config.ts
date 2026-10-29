import { DomainError } from '@eps/domain';
import { readCentralConfig, type CentralStudioOptions } from '@eps/central';

function unavailable(): never {
  throw new DomainError('CANDIDATE_STORAGE_CONFIGURATION_REQUIRED', 'Configure a verified candidate upload limit for this environment.', 503);
}

/** Server-only explicit environment capability, separately bounded by the
 * 256MiB application/native target. This never changes provider configuration. */
export function readCentralCandidateOptions(env: Readonly<Record<string, string | undefined>> = process.env): CentralStudioOptions['candidate'] {
  if (typeof window !== 'undefined') unavailable();
  if (!env.CENTRAL_CANDIDATE_UPLOADS_ENABLED || env.CENTRAL_CANDIDATE_UPLOADS_ENABLED === 'false') return undefined;
  if (env.CENTRAL_CANDIDATE_UPLOADS_ENABLED !== 'true') unavailable();
  const value = env.CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES;
  if (!value || !/^[1-9][0-9]*$/u.test(value)) unavailable();
  const maximumBytes = Number(value);
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes > 256 * 1024 * 1024) unavailable();
  return { storageOrigin: readCentralConfig(env).url, maximumBytes };
}
