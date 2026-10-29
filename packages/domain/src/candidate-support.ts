import type { MediaAsset } from './types.ts';
/** Explicit library attachment. It is never an extracted frame or a new person. */
export interface CandidateSupport {
  id: string; row_version: number; candidate_id: string; asset: MediaAsset; created_at: string;
}
/** Version-only association archival. A reason or asset-deletion flag is not accepted. */
export interface CandidateSupportArchive { row_version: number }
