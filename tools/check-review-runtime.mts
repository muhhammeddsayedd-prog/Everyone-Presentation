/** Fixed authenticated startup probe; never claims work or calls a provider. */
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { loadWorkerPrivateEnvironment } from './worker-private-env.mjs';
import { loadWorkerRuntimeEnvironment, createSpecsWorkerEnvironment } from './worker-runtime-env.mjs';
import { loadWorkerFilesEnvironment } from './worker-files-env.mjs';
import { loadCandidateRuntimeEnvironment } from './candidate-runtime-env.mjs';
import { loadPdfVisionEnvironment } from './pdf-vision-env.mjs';
import { loadFrameRuntimeEnvironment } from './frame-runtime-env.mjs';
import { loadReviewRuntimeEnvironment } from './review-runtime-env.mjs';
import { verifySpecsWorkerStartup } from '../apps/worker/src/runtime-main.ts';

let result = 'failed';
try {
  const provider = await loadWorkerPrivateEnvironment();
  const runtime = await loadWorkerRuntimeEnvironment();
  const files = await loadWorkerFilesEnvironment({ environment: { EPS_SPECS_FILES_ENABLED: 'true' } });
  const environment = { ...createSpecsWorkerEnvironment(provider, runtime, {}, files),
    ...await loadCandidateRuntimeEnvironment(), ...await loadPdfVisionEnvironment(),
    ...await loadFrameRuntimeEnvironment(), ...await loadReviewRuntimeEnvironment() };
  const checked = await verifySpecsWorkerStartup(environment);
  try {
    if (!checked.review || !checked.fit || !checked.candidate || !checked.frames || !checked.fileConfiguration) throw new Error('Incomplete startup');
    result = 'passed';
  } finally { await checked.gateway.close(); }
} catch { /* Only fixed metadata is exposed. */ }
const report = { observed_at: new Date().toISOString(), result,
  scope: 'Actual complete review-enabled private startup and exact narrow database gateway verification',
  real_network: true, jobs_claimed: false, provider_invoked: false, workflows_executed: false,
  credentials_printed: false, hosting_deferred: true };
const directory = path.resolve(import.meta.dirname, '../tracking/evidence/m04/review-runtime');
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, report.observed_at.replace(/[:.]/gu, '-') + '-' + randomUUID().slice(0, 8) + '.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(report) + '\n');
if (result !== 'passed') process.exitCode = 1;
