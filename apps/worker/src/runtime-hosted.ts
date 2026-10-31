import { holdHostedWorker, hostedWorkerEnvironment } from './runtime-hosted-config.ts';
import { assertNativeSandboxIdle, nativeImageIdentity, nativeSandboxCleanupUnconfirmed, nativeSandboxConfiguration } from './native-sandbox.ts';
import { startSpecsWorker } from './runtime-main.ts';

// No private file is baked, loaded or accepted as an argument. Keep the OIDC
// token file in the credentialed daemon; SDK reads it afresh for scoped auth.
async function main() {
  if (process.platform !== 'linux' || process.argv.length !== 2 || !/^v24\./u.test(process.version)) throw new Error('HOSTED_WORKER_CONFIGURATION_INVALID');
  const environment = hostedWorkerEnvironment(process.env);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, environment);
  const native = nativeSandboxConfiguration(); if (!native) throw new Error('HOSTED_WORKER_CONFIGURATION_INVALID');
  // A restart never adopts/resumes a VM left by a prior process. Owner must
  // reconcile its exact identity before a fresh credentialed poller may start.
  await assertNativeSandboxIdle();
  for (const key of ['EPS_MEDIA_IMAGE_ID', 'EPS_FRAME_IMAGE_ID', 'EPS_PDF_RASTER_IMAGE_ID']) process.env[key] = nativeImageIdentity(native);
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  const checkExpiry = () => { const remaining = Date.parse(environment.EPS_PILOT_EXPIRES_AT) - Date.now(); if (remaining <= 0) { process.stdout.write('{"event":"hosted_worker_pilot_expired"}\n'); controller.abort(); } else timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647)); };
  if (environment.EPS_PILOT_OWNER_CONTROLLED !== 'true') checkExpiry();
  try {
    await startSpecsWorker({ signal: controller.signal });
    if (nativeSandboxCleanupUnconfirmed()) {
      process.stderr.write('{"event":"hosted_worker_paused","code":"NATIVE_CLEANUP_UNCONFIRMED"}\n');
      await holdHostedWorker(controller.signal);
    }
  } finally { clearTimeout(timer); }
}
main().catch(() => { process.stderr.write('{"event":"hosted_worker_unconfirmed"}\n'); process.exitCode = 1; });
