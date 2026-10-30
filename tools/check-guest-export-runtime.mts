/** Fixed authenticated startup probe; never claims work or calls a provider. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { loadWorkerPrivateEnvironment } from './worker-private-env.mjs';
import { loadWorkerRuntimeEnvironment, createSpecsWorkerEnvironment } from './worker-runtime-env.mjs';
import { loadWorkerFilesEnvironment } from './worker-files-env.mjs';
import { loadCandidateRuntimeEnvironment } from './candidate-runtime-env.mjs';
import { loadPdfVisionEnvironment } from './pdf-vision-env.mjs';
import { loadFrameRuntimeEnvironment } from './frame-runtime-env.mjs';
import { loadReviewRuntimeEnvironment } from './review-runtime-env.mjs';
import { loadPresentationRuntimeEnvironment } from './presentation-runtime-env.mjs';
import { verifySpecsWorkerStartup } from '../apps/worker/src/runtime-main.ts';

const harness = 'tools/check-guest-export-runtime.mts';
const root = path.resolve(import.meta.dirname, '..');
const sourceFiles = [harness, 'tools/start-specs-worker.mjs', 'tools/worker-private-env.mjs', 'tools/worker-runtime-env.mjs',
  'tools/worker-files-env.mjs', 'tools/candidate-runtime-env.mjs', 'tools/pdf-vision-env.mjs', 'tools/frame-runtime-env.mjs',
  'tools/review-runtime-env.mjs', 'tools/presentation-runtime-env.mjs', 'apps/worker/src/runtime-main.ts',
  'apps/worker/src/runtime.ts', 'apps/worker/src/runtime-types.ts', 'apps/worker/src/n8n-orchestrator.ts',
  'apps/worker/src/presentation-export-executor.ts', 'apps/worker/src/presentation-assets.ts', 'apps/worker/src/presentation-stage-executor.ts', 'apps/worker/src/presentation-pdf.ts',
  'apps/worker/src/presentation-pdf-inspect-process.mjs', 'apps/worker/src/native-browser.ts',
  'packages/central/src/specs-runtime-gateway.ts', 'packages/central/src/presentation-runtime-assets.ts',
  'packages/integrations/src/n8n-dispatch.ts'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file =>
  [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));
let result = 'failed'; let gatewayAttempted = false; let before: Record<string, string> = {}; let stable = false;
try {
  before = await sourceHashes();
  const provider = await loadWorkerPrivateEnvironment();
  const runtime = await loadWorkerRuntimeEnvironment();
  const files = await loadWorkerFilesEnvironment({ environment: { EPS_SPECS_FILES_ENABLED: 'true' } });
  const environment = { ...createSpecsWorkerEnvironment(provider, runtime, {}, files),
    ...await loadCandidateRuntimeEnvironment(), ...await loadPdfVisionEnvironment(),
    ...await loadFrameRuntimeEnvironment(), ...await loadReviewRuntimeEnvironment(), ...await loadPresentationRuntimeEnvironment(), EPS_GUEST_EXPORTS_ENABLED: 'true' };
  const checked = await verifySpecsWorkerStartup(environment);
  gatewayAttempted = true;
  try {
    if (checked.gateway.verifiedFunctionOperations !== 12 || typeof checked.gateway.mintReviewMediaGrant !== 'function' || !checked.presentationExport || !checked.presentation || !checked.review || !checked.fit || !checked.candidate || !checked.frames || !checked.fileConfiguration) throw new Error('Incomplete startup');
  } finally { await checked.gateway.close(); }
  stable = JSON.stringify(before) === JSON.stringify(await sourceHashes());
  if (stable) result = 'passed';
} catch (error) {
  gatewayAttempted ||= typeof error === 'object' && error !== null && 'attempts' in error && typeof error.attempts === 'number' && error.attempts > 0;
}
const report = { observed_at: new Date().toISOString(), result,
  harness_path: harness, harness_sha256: before[harness] ?? null, source_sha256: before, sources_stable: stable,
  scope: 'Actual complete guest-export-enabled private startup and exact twelve-operation narrow database gateway verification',
  gateway_attempted: gatewayAttempted, authenticated_gateway_verified: result === 'passed', verified_function_operations: result === 'passed' ? 12 : null, jobs_claimed: false, provider_invoked: false, workflows_executed: false,
  credentials_printed: false, hosting_deferred: true };
const directory = path.resolve(import.meta.dirname, '../tracking/evidence/m06/guest-export-runtime');
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, report.observed_at.replace(/[:.]/gu, '-') + '-' + randomUUID().slice(0, 8) + '.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(report) + '\n');
if (result !== 'passed') process.exitCode = 1;
