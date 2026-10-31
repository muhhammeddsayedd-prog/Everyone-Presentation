/** Source-only input validation. No filesystem, configuration, credential or network access. */
import { createHash } from 'node:crypto';

export const FRESH_INPUT_PATH = '.local/m03-english-component/at074-new-english-job-input.json';
export const JOB_ID = '3cf25d3b-c1ec-4347-af3b-fa48f3f0f5e7';
export const WORKSPACE_ID = '86936940-b48d-497d-b1ff-8e0da0913afa';
export const CANDIDATE_WORKFLOW_ID = 'gfhxzvSkprS2CI4o';
const need = value => { if (!value) throw new Error('FRESH_EXECUTION_INPUT_UNCONFIRMED'); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => need(object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
const sha = value => createHash('sha256').update(value).digest('hex');
const terminal = new Set(['succeeded', 'failed', 'waiting_for_input', 'cancelled']);
const historicalExecutions = new Set(['31515', '31520', '31523']);

/** The input is an operator-reviewed correlation plan, not independent proof of
 * job-to-execution binding. Hash matching alone never earns AT-074 acceptance. */
export function validateFreshInput(value, evidenceBytes) {
  exact(value, ['schema_version', 'purpose', 'job_id', 'workspace_id', 'kind', 'job_status', 'durable_observation', 'execution_refs']);
  need(value.schema_version === '1.0' && value.purpose === 'at074-controlled-english-job-metadata');
  need(value.job_id === JOB_ID && value.workspace_id === WORKSPACE_ID && value.kind === 'candidate_scan' && terminal.has(value.job_status));
  const observation = value.durable_observation;
  exact(observation, ['receipt', 'sha256', 'observed_at']);
  need(typeof observation.receipt === 'string' && observation.receipt.length <= 240
    && /^tracking\/evidence\/m0[37]\/[A-Za-z0-9_./-]+\.json$/u.test(observation.receipt)
    && !observation.receipt.split('/').some(part => part === '..' || part === '.'));
  need(typeof observation.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(observation.sha256));
  need(typeof observation.observed_at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|\+00:00)$/u.test(observation.observed_at)
    && Number.isFinite(Date.parse(observation.observed_at)));
  need(evidenceBytes instanceof Uint8Array && evidenceBytes.byteLength > 0 && evidenceBytes.byteLength <= 131072 && sha(evidenceBytes) === observation.sha256);
  need(Array.isArray(value.execution_refs) && value.execution_refs.length >= 1 && value.execution_refs.length <= 2);
  const seen = new Set();
  const cases = value.execution_refs.map((reference, index) => {
    exact(reference, ['execution_id', 'workflow_id', 'attempt']);
    need(typeof reference.execution_id === 'string' && /^[1-9][0-9]{0,15}$/u.test(reference.execution_id)
      && !historicalExecutions.has(reference.execution_id) && !seen.has(reference.execution_id));
    need(reference.workflow_id === CANDIDATE_WORKFLOW_ID && Number.isSafeInteger(reference.attempt) && reference.attempt >= 1);
    seen.add(reference.execution_id);
    return { case_alias: `controlled_english_scan_${index + 1}`, job_id: JOB_ID,
      execution_id: reference.execution_id, workflow_id: reference.workflow_id, attempt: reference.attempt };
  });
  return { input_path: FRESH_INPUT_PATH, job_id: JOB_ID, workspace_id: WORKSPACE_ID,
    declared_job_status: value.job_status, durable_observation: { ...observation }, cases,
    maximum_get_requests: cases.length, includeData: false, automatic_retry: false,
    durable_job_execution_cross_binding_verified_by_helper: false,
    execution_metadata_observed: false, AT074_status: 'partial_pending_actual_durable_binding_and_metadata_read' };
}
