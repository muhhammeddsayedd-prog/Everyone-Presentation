/** Explicit local worker launcher. No SQL setup, feature flag, workflow publish
 * or credential provisioning. Root coordinates actual execution separately. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
import { loadWorkerPrivateEnvironment } from './worker-private-env.mjs';
import { loadWorkerRuntimeEnvironment, createSpecsWorkerEnvironment } from './worker-runtime-env.mjs';
import { loadWorkerFilesEnvironment } from './worker-files-env.mjs';
import { loadCandidateRuntimeEnvironment } from './candidate-runtime-env.mjs';
import { loadPdfVisionEnvironment } from './pdf-vision-env.mjs';
import { loadFrameRuntimeEnvironment } from './frame-runtime-env.mjs';
import { loadReviewRuntimeEnvironment } from './review-runtime-env.mjs';
import { loadPresentationRuntimeEnvironment } from './presentation-runtime-env.mjs';

async function main() {
  if (process.argv.length !== 2 || !/^v24\./u.test(process.version)) throw new Error('FIXED_WORKER_NODE24_COMMAND_REQUIRED');
  const provider = await loadWorkerPrivateEnvironment(); const runtime = await loadWorkerRuntimeEnvironment();
  const files = await loadWorkerFilesEnvironment();
  const candidate = await loadCandidateRuntimeEnvironment();
  const pdfVision = await loadPdfVisionEnvironment();
  const frames = await loadFrameRuntimeEnvironment();
  const review = await loadReviewRuntimeEnvironment();
  const presentation = await loadPresentationRuntimeEnvironment();
  const environment = { ...createSpecsWorkerEnvironment(provider, runtime, process.env, files), ...candidate, ...pdfVision, ...frames, ...review, ...presentation };
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/worker/src/runtime-main.ts'], {
    cwd: path.resolve(import.meta.dirname, '..'), env: environment, windowsHide: true, shell: false,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  let timer; let stopping = false;
  const stop = () => { if (stopping) return; stopping = true;
    if (child.connected) child.send({ type: 'shutdown' }, () => {});
    timer = setTimeout(() => child.kill(), 30_000);
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  await new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('WORKER_PROCESS_UNAVAILABLE')));
    child.once('exit', code => { if (code !== 0 && !stopping) process.exitCode = 1; resolve(); });
  });
  if (timer) clearTimeout(timer); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('Specs worker could not start. Check the protected worker configuration and authenticated runtime access.\n'); process.exitCode = 1;
});
