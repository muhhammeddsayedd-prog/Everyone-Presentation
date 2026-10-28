import type { JobEvent, JobEventReceipt, StageClaim, StageLease } from '@eps/jobs';
import type { StageReadyEnvelope } from '@eps/integrations';

export type SpecsStage = 'prepare_document' | 'extract_specs' | 'apply_specs';
export interface StageWorkOrder {
  schema_version: '1.0';
  event_id: string; job_id: string; kind: 'specs_extract'; stage: SpecsStage; input_hash: string; correlation_id: string;
  workflow_execution_id: string;
  handler: 'native.prepare_document' | 'openai.extract_specs' | 'domain.apply_specs';
}
/** Construct only after the adapter has verified its authenticated narrow LOGIN.
 * No user JWT, SET ROLE, public endpoint or connection target comes from a job. */
export interface StageRuntimeGateway {
  claimOutbox(limit: number, signal?: AbortSignal): Promise<unknown>;
  finishOutbox(id: string, leaseToken: string, accepted: boolean, signal?: AbortSignal): Promise<unknown>;
  claim(input: StageClaim, signal?: AbortSignal): Promise<StageLease>;
  getInput(scope: { job_id: string; attempt_id: string; lease_token: string }, signal: AbortSignal): Promise<unknown>;
  recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt>;
  recover(limit: number, signal?: AbortSignal): Promise<unknown>;
  close?(): Promise<void>;
}
export interface SpecsStageRouter {
  route(envelope: StageReadyEnvelope, signal?: AbortSignal): Promise<StageWorkOrder>;
}
export interface WorkerNotice {
  event: 'idle' | 'stage_callback_committed' | 'stage_unconfirmed' | 'dispatch_rejected' | 'dispatch_unconfirmed' | 'recovery_completed' | 'recovery_unconfirmed';
  job_id?: string;
  stage?: SpecsStage;
  code?: string;
}
