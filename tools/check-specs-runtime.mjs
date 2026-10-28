/** Actual credential/TLS/ACL check. No job claim, source or provider request. */
import { createSpecsRuntimeGateway, readSpecsRuntimeConfig } from '@eps/central/specs-runtime';
import { loadWorkerRuntimeEnvironment } from './worker-runtime-env.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
let report;
try {
  const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(await loadWorkerRuntimeEnvironment()));
  await gateway.close();
  report = { result: 'passed', real_network: true, credential_authentication: 'SCRAM server proof verified by pinned SDK',
    tls_ca_and_hostname_verified: true, dedicated_current_and_session_role_verified: true, exact_function_membership_table_denial_verified: true,
    effective_private_logging_verified: true };
} catch (error) {
  const allowed = new Set(['RUNTIME_CONFIG_INVALID','RUNTIME_AUTH_UNVERIFIED','RUNTIME_ROLE_UNVERIFIED','RUNTIME_UNAVAILABLE']);
  report = { result: 'failed', code: allowed.has(error?.code) ? error.code : 'RUNTIME_CHECK_UNCONFIRMED' };
}
report = { observed_at: new Date().toISOString(), ...report, jobs_claimed: false, source_or_provider_data_sent: false };
const directory = path.resolve(import.meta.dirname, '../tracking/evidence/m02/specs-runtime'); await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, report.observed_at.replace(/[:.]/gu, '-') + '-authenticated-gateway.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
if (report.result !== 'passed') process.exitCode = 1;
