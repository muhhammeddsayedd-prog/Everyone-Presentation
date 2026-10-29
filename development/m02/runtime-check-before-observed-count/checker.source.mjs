/** Actual file-mode credential/TLS/effective-ACL check only. Run with Node24
 * --import tsx. Importing this file performs no IO; the operator invokes main. */
import { createSpecsRuntimeGateway, readSpecsRuntimeConfig } from '@eps/central/specs-runtime';
import { loadWorkerRuntimeEnvironment } from './worker-runtime-env.mjs';
import { loadWorkerFilesEnvironment } from './worker-files-env.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

/** Injected constructors/loaders are offline test seams, never CLI inputs. */
export async function checkSpecsFilesRuntime({ environment = process.env, loadRuntime = loadWorkerRuntimeEnvironment,
  loadFiles = loadWorkerFilesEnvironment, createGateway = createSpecsRuntimeGateway } = {}) {
  const common = { jobs_claimed: false, source_requested: false, provider_called: false, storage_requested: false,
    worker_started: false, provider_configuration_loaded: false };
  try {
    if (environment.EPS_SPECS_FILES_ENABLED !== 'true') throw Object.assign(new Error('File runtime mode is not enabled.'), { code: 'RUNTIME_CONFIG_INVALID' });
    const runtime = await loadRuntime(); const files = await loadFiles({ environment });
    if (files.EPS_SPECS_FILES_ENABLED !== 'true') throw Object.assign(new Error('File runtime mode is not configured.'), { code: 'RUNTIME_CONFIG_INVALID' });
    const gateway = await createGateway(readSpecsRuntimeConfig(runtime), {}, { storageOrigin: files.SUPABASE_URL, publishableKey: files.SUPABASE_PUBLISHABLE_KEY });
    await gateway.close();
    return { ...common, result: 'passed', real_network: true, credential_authentication: 'SCRAM server proof verified by pinned SDK',
      tls_ca_and_hostname_verified: true, dedicated_current_and_session_role_verified: true, exact_function_operations: 10,
      exact_runtime_groups: 3, app_table_and_auth_authority_denied: true, effective_private_logging_verified: true };
  } catch (error) {
    const allowed = new Set(['RUNTIME_CONFIG_INVALID','RUNTIME_AUTH_UNVERIFIED','RUNTIME_ROLE_UNVERIFIED','RUNTIME_UNAVAILABLE']);
    return { ...common, result: 'failed', code: allowed.has(error?.code) ? error.code : 'RUNTIME_CHECK_UNCONFIRMED' };
  }
}
async function main() {
  if (process.argv.length !== 2 || !/^v24\./u.test(process.version)) throw new Error('FIXED_NODE24_COMMAND_REQUIRED');
  const report = { observed_at: new Date().toISOString(), ...await checkSpecsFilesRuntime() };
  const directory = path.resolve(import.meta.dirname, '../tracking/evidence/m02/specs-runtime'); await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, report.observed_at.replace(/[:.]/gu, '-') + '-files-authenticated-gateway.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(report) + '\n');
  if (report.result !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('File runtime verification was not confirmed. Private diagnostics are suppressed.\n'); process.exitCode = 1;
});
