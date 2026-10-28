/** PREPARATION: fixed local10 proof only. Missing reviewed seals fail before
 * Docker, role creation or SQL. No cloud/provider/credential discovery exists.
 */
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { lstat, mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { clearTimeout, setTimeout } from 'node:timers';
import { restartOwnedLocalTarget } from './local-postgres.mjs';
import { createNativeSpecsLocalTransport, nativeSpecsTransportFailure, verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';
import { executeNativeSpecsFixture, NativeSpecsScenarioError } from './lib/native-specs-executor-scenario.mjs';
import { createNativeSpecsLocalLogin, inspectNativeSpecsLocalLogin, probeNativeSpecsLocalLogin, dropNativeSpecsLocalLogin,
  readNativeSpecsLocalHba } from './lib/native-specs-local-login.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const SYSTEM_ID = '7701520506262638626';
const HBA_SHA256 = '05a3001844d0d4c02690e4a7091f0cb73dcd29d8b5c5df940f493901f9eca40d';
const ENDPOINT = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const MIGRATION = 'supabase/migrations/20261028222030_m02_specs_pipeline.sql';
const VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515',
  '20261028162702','20261028162800','20261028172320','20261028184145','20261028222030'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
const check = (value, code) => { if (!value) fail(code); };

// Exact source/proof seals configured after root's successful local10 and
// synthetic sentinel evidence. Execution belongs exclusively to root.
const SEALS = Object.freeze({
  "migration": {
    "path": "supabase/migrations/20261028222030_m02_specs_pipeline.sql",
    "sha256": "1e5319bb81be1f12896f7efb5a2cb7706653b79eb440a4dc1aaaca4ed9556895"
  },
  "local10Proof": {
    "path": "tracking/evidence/m02/specs-pipeline-local/2026-10-28T22-41-11-276Z-491d3795-rollback.json",
    "sha256": "26bc74c0e75e1b512f47e557d8ffe68489bc51abd73e324b90973bc572d663e5"
  },
  "loggingProof": {
    "path": "tracking/evidence/m02/native-logging/2026-10-28T22-52-38-127Z-5128e4cc.json",
    "sha256": "d9ced31185b50f063e2757fd43c98cf6b1526aefe5a262ba7d7ee8122b5f40d0"
  },
  "sourceFiles": [
    {
      "path": "tools/lib/native-specs-local-transport.mjs",
      "sha256": "57f2b5dca8ea6e04542366c93283a2bf22a63c8d918918a0b00561b3b31758d9"
    },
    {
      "path": "tools/lib/native-specs-local-login.mjs",
      "sha256": "c48e0e71c2b75b7ed76b506acf2585ade86079947b66cdf72a50853a18b58d87"
    },
    {
      "path": "tools/sql/local-native-specs-login-create.sql",
      "sha256": "c666593d7122dccec120bfdaa3ded384b9c2fdeaf14638c4949fb0ac8b40e665"
    },
    {
      "path": "tools/sql/local-native-specs-login-drop.sql",
      "sha256": "db4a4e74022bc559a6204af4addb21d0870579989223404b6891c43913a9f4bd"
    },
    {
      "path": "tools/lib/native-specs-executor-scenario.mjs",
      "sha256": "469f4c474168f0ff0fd5ce8665a6fc788f453791e1d689714e90c4e756ee6dc1"
    },
    {
      "path": "tools/local-postgres.mjs",
      "sha256": "49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de"
    },
    {
      "path": "tools/test-m02-native-logging.mjs",
      "sha256": "772de70ea9d2fafad7b0080e8c8dec08b73eb4632534fcd7bb2f210cfaca282c"
    },
    {
      "path": "tools/test-m02-specs-pipeline-local.mjs",
      "sha256": "3068f85833be3b9331d16816c55812542abd39460d4b87ba8f18d180553a1c2f"
    },
    {
      "path": "development/m02/specs-pipeline-candidate.sql",
      "sha256": "bf1fdb9e0de61098a17fbec91ae53eaa7265dcbad5796cb73c936d67a09e552e"
    },
    {
      "path": "tests/db/m02-specs-pipeline-candidate.sql",
      "sha256": "0a6449957c40d1dd925b22903884b1c46478730329531e6e2c054f162d26846e"
    },
    {
      "path": "development/local-db/reviewed.json",
      "sha256": "001d5e7992a2a475a2213f56eaac7a3d5d98da0fd720687ae8380c0c7eda6e81"
    },
    {
      "path": "apps/worker/src/specs-executor.ts",
      "sha256": "2f637a484acae5aae556964ab07432b2c8f800eb6bccf5c7d9141cd1b6413fb0"
    },
    {
      "path": "apps/worker/src/pasted-text.ts",
      "sha256": "3924006774b171ce939cd829bd47370a967e3ab6c1cdc100c9ded27e195361ad"
    },
    {
      "path": "apps/worker/src/prepare.ts",
      "sha256": "dea867f4953b854cb2cb63ddc96d908299767df1effd8f4c31cffea93894aef9"
    },
    {
      "path": "apps/worker/src/process.ts",
      "sha256": "fc9cc0c32b65dc59d44715381258090d0619f8b079aac9d20767d99651417fb5"
    },
    {
      "path": "apps/worker/src/prepare-process.mjs",
      "sha256": "2e52f76a0bcac3fb50f4f49fb52164193833586ecc07e52ed61030978afff973"
    },
    {
      "path": "apps/worker/src/storage.ts",
      "sha256": "5b10229c54b62db5b6b4870a8dbd6248ae0fc8fec8e51052d6a526aa36e8c186"
    },
    {
      "path": "apps/worker/src/types.ts",
      "sha256": "9e3a7397b9e3a9c33b10e9e1b83497ba1b764dc7f0b7a86cebeb11b01d4e986a"
    },
    {
      "path": "apps/worker/src/docx.ts",
      "sha256": "e7a89f5fb9fb48b852fd912e89301ee1f3bb05f79d4ac71ff408ef904cd7bbfc"
    },
    {
      "path": "apps/worker/src/pdf.ts",
      "sha256": "a410c584c30f2d21d92be906c67a854c8055474c2961d4b26a3f9d3f244bab0c"
    },
    {
      "path": "packages/integrations/src/index.ts",
      "sha256": "a52d825d872c59b403126850f101b42a11bc123a72ffd035461e1943aef01e35"
    },
    {
      "path": "packages/integrations/src/openai-specs.ts",
      "sha256": "6d5ae9440075c95adaf6b24954b30ccca63b5aac613e37b85a9e532ad58f44b4"
    },
    {
      "path": "packages/integrations/src/errors.ts",
      "sha256": "ac02c36b535879e439752eeda0518c2d84389a16af97175d004f8fa7c61d4da2"
    },
    {
      "path": "packages/integrations/src/specs-schema.ts",
      "sha256": "389c36f8cca115f46390024170071851e8a974befdde19476771a20cbc63569c"
    },
    {
      "path": "packages/integrations/src/specs-types.ts",
      "sha256": "64b0d7ab2d5bc02d7a171d1a5ccb1c976a32889625394c727936c9e2b89011ee"
    },
    {
      "path": "packages/integrations/src/job-errors.ts",
      "sha256": "6c248fd9a586464fd69ee182823e6510b062ddedd19884c80478fa12f207cd7c"
    },
    {
      "path": "packages/integrations/src/n8n-dispatch.ts",
      "sha256": "96487a2a0d8769056c4fd3600478b0464e956c591af6b777b0cce92c91e057d7"
    },
    {
      "path": "packages/integrations/src/prompts/specs-v1.ts",
      "sha256": "719e7e9225cc2f939df279ff2b8bfc325f68ce0b03d30d4f3ef7ede2820e7033"
    },
    {
      "path": "contracts/json-schema/document-preparation.schema.json",
      "sha256": "87bab05dac2abe9dd39483d8a1bacac35f02baa51eb28e99bcbda190e8a80a73"
    },
    {
      "path": "contracts/json-schema/specs-extraction.schema.json",
      "sha256": "c55e758da1b71119a3a8d7cc408340e502088c8ab88a89c81da7effb85a8809d"
    },
    {
      "path": "apps/worker/package.json",
      "sha256": "075bdb2d32d93f22f02272f41162eef5f00df494ddbc3c1b5c2815bbea4036b4"
    },
    {
      "path": "packages/integrations/package.json",
      "sha256": "9c43cf24f929e4df17dc7eb19b20383c4b67bfcbd697d12b09984cd632751671"
    },
    {
      "path": "package.json",
      "sha256": "abbb70f60e2eb6004f2000c0fa487bebebf94053a78bdb32cb15538d403afad2"
    },
    {
      "path": "package-lock.json",
      "sha256": "e0c824aec458cf47a18a3698cca701efd10bfeb0c7ef4a748f3bfc8488878840"
    },
    {
      "path": "tsconfig.json",
      "sha256": "e781feac1f7efc7b73024b47c37cd00b722cb6dc989948326c15376e6560728a"
    }
  ],
  "fixtures": {
    "snapshot": {
      "path": "tests/db/m02-native-executor-snapshot.sql",
      "sha256": "d3a90a07d7ec2ba476d1ea9cf3eb7d0e81d349928f90b7979270f4b2813f22b2"
    },
    "setup": {
      "path": "tests/db/m02-native-executor-setup.sql",
      "sha256": "20f74cbe6e3ab4dc41d6d29c6ac1affe5dd4315be18994ffcf022c69c0fabfe2"
    },
    "cancel": {
      "path": "tests/db/m02-native-executor-cancel.sql",
      "sha256": "62e716322675429003612489f88a3427459f94cfb609f2057059aa3f89ecb2ae"
    },
    "change": {
      "path": "tests/db/m02-native-executor-change-source.sql",
      "sha256": "b2df9c15028b5cb61cf2d6882ef73a6d24145bff535052847bef511c5f727b8a"
    },
    "expire": {
      "path": "tests/db/m02-native-executor-expire.sql",
      "sha256": "9587239319c75621828198930ece444a31f93569d01e6c14dfdf49df7089e571"
    },
    "ready": {
      "path": "tests/db/m02-native-executor-ready.sql",
      "sha256": "68e3d33d99fe1409f61fb7e35250321c865530cf8e74eff502dcda4fc30e7aa5"
    },
    "verify": {
      "path": "tests/db/m02-native-executor-verify.sql",
      "sha256": "369e92689b0fe3b1912ff6e9e0179ba47b1021d1886e8bc08c3d264db730de78"
    },
    "cleanup": {
      "path": "tests/db/m02-native-executor-cleanup.sql",
      "sha256": "0c44ba3f9066328b769cc7588672b9d3a897f4d48ea68e162077a219da0dc9dc"
    }
  }
});
const FILES = Object.freeze({
  snapshot: 'tests/db/m02-native-executor-snapshot.sql', setup: 'tests/db/m02-native-executor-setup.sql',
  cancel: 'tests/db/m02-native-executor-cancel.sql', change: 'tests/db/m02-native-executor-change-source.sql',
  expire: 'tests/db/m02-native-executor-expire.sql', ready: 'tests/db/m02-native-executor-ready.sql',
  verify: 'tests/db/m02-native-executor-verify.sql', cleanup: 'tests/db/m02-native-executor-cleanup.sql',
});
const REQUIRED_SOURCES = Object.freeze([
  'tools/lib/native-specs-local-transport.mjs', 'tools/lib/native-specs-local-login.mjs',
  'tools/sql/local-native-specs-login-create.sql', 'tools/sql/local-native-specs-login-drop.sql',
  'tools/lib/native-specs-executor-scenario.mjs', 'tools/local-postgres.mjs', 'tools/test-m02-native-logging.mjs',
  'tools/test-m02-specs-pipeline-local.mjs', 'development/m02/specs-pipeline-candidate.sql',
  'tests/db/m02-specs-pipeline-candidate.sql', 'development/local-db/reviewed.json',
  'apps/worker/src/specs-executor.ts', 'apps/worker/src/pasted-text.ts', 'apps/worker/src/prepare.ts',
  'apps/worker/src/process.ts', 'apps/worker/src/prepare-process.mjs', 'apps/worker/src/storage.ts', 'apps/worker/src/types.ts',
  'apps/worker/src/docx.ts', 'apps/worker/src/pdf.ts',
  'packages/integrations/src/index.ts', 'packages/integrations/src/openai-specs.ts', 'packages/integrations/src/errors.ts',
  'packages/integrations/src/specs-schema.ts', 'packages/integrations/src/specs-types.ts',
  'packages/integrations/src/job-errors.ts', 'packages/integrations/src/n8n-dispatch.ts', 'packages/integrations/src/prompts/specs-v1.ts',
  'contracts/json-schema/document-preparation.schema.json', 'contracts/json-schema/specs-extraction.schema.json',
  'apps/worker/package.json', 'packages/integrations/package.json', 'package.json', 'package-lock.json', 'tsconfig.json',
]);
async function sealed(entry) {
  check(entry && typeof entry.path === 'string' && HASH.test(entry.sha256), 'NATIVE_REVIEW_SEALS_REQUIRED');
  const absolute = path.resolve(ROOT, entry.path);
  check(absolute.startsWith(ROOT + path.sep) && await realpath(absolute) === absolute, 'NATIVE_REVIEW_PATH_REJECTED');
  const info = await lstat(absolute); check(info.isFile() && !info.isSymbolicLink() && info.size <= 2 * 1024 * 1024, 'NATIVE_REVIEW_SOURCE_REJECTED');
  const bytes = await readFile(absolute); check(sha(bytes) === entry.sha256, 'NATIVE_REVIEW_SOURCE_CHANGED'); return bytes;
}
export async function nativeExecutorPrerequisites() {
  check(SEALS.migration && SEALS.local10Proof && SEALS.loggingProof && Array.isArray(SEALS.sourceFiles)
    && SEALS.fixtures, 'NATIVE_REVIEW_SEALS_REQUIRED');
  check(isDeepStrictEqual(SEALS.sourceFiles.map(entry => entry.path).sort(), [...REQUIRED_SOURCES].sort())
    && Object.keys(SEALS.fixtures).length === Object.keys(FILES).length, 'NATIVE_EXACT_SOURCE_MATRIX_REQUIRED');
  const migration = await sealed(SEALS.migration);
  check(SEALS.migration.path === MIGRATION, 'NATIVE_LOCAL10_MIGRATION_REQUIRED');
  const proof = JSON.parse((await sealed(SEALS.local10Proof)).toString('utf8'));
  const logging = JSON.parse((await sealed(SEALS.loggingProof)).toString('utf8'));
  check(proof.schema_version === '1.0' && proof.migration === MIGRATION && proof.migration_sha256 === SEALS.migration.sha256
    && proof.environment?.system_identifier === SYSTEM_ID
    && proof.result === 'passed' && proof.catalog_and_all_counts_restored === true && proof.rollback_verified === true
    && proof.transaction_completed_to_rollback === true && proof.persisted_schema_assertions_tested === true
    && proof.owned_backend_settled === true && isDeepStrictEqual(proof.before, proof.after)
    && isDeepStrictEqual(proof.before?.versions, VERSIONS) && proof.before?.all_business_counts
    && isDeepStrictEqual(proof.before.all_business_counts, proof.after.all_business_counts), 'NATIVE_LOCAL10_PROOF_REQUIRED');
  check(logging.result === 'passed' && logging.synthetic_sentinel_only === true && logging.private_bind_sentinel_absent === true
    && logging.invalid_jsonb_rejection_sanitized === true && HASH.test(logging.container_id)
    && logging.credential_authentication_verified === false && logging.local_auth_method === 'trust'
    && logging.connection === 'container_ipv4_loopback' && logging.role_authorization_verified === true
    && logging.hba_unchanged === true && logging.hba_sha256 === HBA_SHA256 && logging.hba_after_sha256 === HBA_SHA256,
    'NATIVE_LOGGING_PROOF_REQUIRED');
  const sourceBytes = new Map();
  for (const entry of SEALS.sourceFiles) sourceBytes.set(entry.path, await sealed(entry));
  const sourceHash = file => SEALS.sourceFiles.find(entry => entry.path === file).sha256;
  check(proof.harness_sha256 === sourceHash('tools/test-m02-specs-pipeline-local.mjs')
    && proof.hashes?.candidate === sourceHash('development/m02/specs-pipeline-candidate.sql')
    && proof.hashes?.assertions === sourceHash('tests/db/m02-specs-pipeline-candidate.sql')
    && proof.reviewed_manifest_sha256 === sourceHash('development/local-db/reviewed.json'), 'NATIVE_LOCAL10_PROOF_SOURCE_MISMATCH');
  const loggingSources = [SEALS.migration, ...SEALS.sourceFiles.filter(entry =>
    ['tools/lib/native-specs-local-transport.mjs', 'tools/lib/native-specs-local-login.mjs'].includes(entry.path))]
    .map(({ path, sha256 }) => ({ path, sha256 })).sort((a, b) => a.path.localeCompare(b.path));
  check(logging.harness_sha256 === sourceHash('tools/test-m02-native-logging.mjs')
    && logging.baseline_restored === true && logging.fixture_removed === true && logging.lock_removed === true
    && Array.isArray(logging.sources) && isDeepStrictEqual([...logging.sources].sort((a, b) => a.path.localeCompare(b.path)), loggingSources),
  'NATIVE_LOGGING_PROOF_SOURCE_MISMATCH');
  const manifest = JSON.parse(sourceBytes.get('development/local-db/reviewed.json').toString('utf8'));
  check(manifest.version === 1 && Array.isArray(manifest.migrations) && manifest.migrations.length === 10
    && manifest.migrations.every((entry, index) => typeof entry.path === 'string'
      && entry.path.startsWith(`supabase/migrations/${VERSIONS[index]}_`) && HASH.test(entry.sha256))
    && manifest.migrations[9].path === MIGRATION && manifest.migrations[9].sha256 === SEALS.migration.sha256,
  'NATIVE_EXACT_TEN_MANIFEST_REQUIRED');
  const fixtures = {};
  for (const [operation, file] of Object.entries(FILES)) {
    const entry = SEALS.fixtures[operation]; check(entry?.path === file, 'NATIVE_FIXED_FIXTURE_REQUIRED');
    fixtures[operation] = (await sealed(entry)).toString('utf8');
    const directGuard = fixtures[operation].includes('eps.native_specs.fixture_run_id') && fixtures[operation].includes('eps.local_fixture_tests');
    const fixedHelperGuard = !['snapshot', 'setup', 'cleanup'].includes(operation)
      && fixtures[operation].includes('select eps_local_guard.native_specs_fixture_require();');
    check(directGuard || fixedHelperGuard, 'NATIVE_FIXTURE_OWNERSHIP_GUARD_REQUIRED');
  }
  check(fixtures.snapshot.includes('pg_db_role_setting') && fixtures.snapshot.includes('pg_shdescription')
    && fixtures.snapshot.includes('specs_pipeline_config'), 'NATIVE_COMPLETE_BASELINE_SNAPSHOT_REQUIRED');
  return { fixtures, migration_sha256: sha(migration), migration_sources: manifest.migrations.map(({ path, sha256 }) => [path, sha256]),
    logging_container_id: logging.container_id, reviewed: SEALS };
}
function safeObjectOutput(value) {
  const lines = value.stdout.split(/\r?\n/u).filter(line => line.startsWith('{'));
  check(lines.length === 1, 'NATIVE_FIXTURE_OUTPUT_UNCONFIRMED');
  let result; try { result = JSON.parse(lines[0]); } catch { fail('NATIVE_FIXTURE_OUTPUT_UNCONFIRMED'); }
  check(result && typeof result === 'object' && !Array.isArray(result), 'NATIVE_FIXTURE_OUTPUT_UNCONFIRMED'); return result;
}
async function fixtureSql(sql, runId, containerId) {
  // The reviewed file is fixed. The sole variable is a validated nonsecret run
  // marker; source, lease, result and provider arguments never use this seam.
  check(UUID.test(runId) && HASH.test(containerId), 'NATIVE_RUN_INVALID');
  const target = await verifyNativeSpecsLocalTarget(); check(target.container.Id === containerId, 'NATIVE_TARGET_CHANGED');
  const script = `set lock_timeout='5s'; set statement_timeout='30s'; set application_name='eps-native-fixture-${runId}';
set eps.local_fixture_tests='eps-presentation-canonical-pg17-local'; set eps.native_specs.fixture_run_id='${runId}';
do $fixed_guard$ begin if current_user<>'postgres' or current_database()<>'postgres'
 or (select system_identifier::text from pg_control_system())<>'${SYSTEM_ID}'
 then raise exception 'NATIVE_OWNED_FIXTURE_REQUIRED'; end if; end $fixed_guard$;\n${sql}`;
  check(Buffer.byteLength(script, 'utf8') <= 256 * 1024 && !/^\s*\\/mu.test(script), 'NATIVE_FIXED_FIXTURE_REQUIRED');
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', ENDPOINT, 'exec', '--user', 'postgres', '-i', containerId,
      'env', '-i', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'HOME=/tmp', 'PGPASSFILE=/dev/null',
      'PGCONNECT_TIMEOUT=3', 'PGSSLMODE=disable', 'psql', '-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1',
      '-v', 'VERBOSITY=sqlstate', '-v', 'SHOW_CONTEXT=never', '-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'postgres'],
    { cwd: ROOT, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let bytes = 0; let errors = 0; let unknown = false;
    const stop = () => { unknown = true; child.kill(); }; const timer = setTimeout(stop, 40_000);
    child.stdin.on('error', () => {});
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) stop(); else stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { errors += chunk.length; if (errors > 65536) stop(); });
    child.on('error', () => { unknown = true; });
    child.on('close', code => {
      clearTimeout(timer);
      if (unknown || code !== 0) reject(new Error('NATIVE_OWNED_FIXTURE_UNCONFIRMED'));
      else { try { resolve(safeObjectOutput({ stdout })); } catch { reject(new Error('NATIVE_OWNED_FIXTURE_UNCONFIRMED')); } }
    });
    child.stdin.end(script);
  });
}
async function settleFixture(runId, containerId) {
  if (!containerId) return true;
  for (let attempt = 0; attempt < 20; attempt++) {
    const state = await fixtureSql(`begin read only;
select jsonb_build_object('remaining',count(*)) from pg_stat_activity
 where application_name='eps-native-fixture-${runId}' and pid<>pg_backend_pid(); rollback;`, runId, containerId);
    if (state.remaining === 0) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  fail('NATIVE_FIXTURE_BACKEND_UNSETTLED');
}
function casesFrom(output) {
  check(Array.isArray(output.cases) && output.cases.length === 4, 'NATIVE_FIXTURE_CASES_INVALID');
  const names = ['happy', 'cancelled', 'source_changed', 'recovery']; const cases = {};
  for (const value of output.cases) {
    check(value && names.includes(value.name) && !cases[value.name] && UUID.test(value.job_id) && HASH.test(value.input_hash), 'NATIVE_FIXTURE_CASES_INVALID');
    cases[value.name] = { job_id: value.job_id, input_hash: value.input_hash };
  }
  check(names.every(name => cases[name]), 'NATIVE_FIXTURE_CASES_INVALID'); return cases;
}
function requireNativeHba(observed) {
  check(observed?.hba_sha256 === HBA_SHA256 && observed.auth_method === 'trust'
    && observed.connection === 'container_ipv4_loopback' && observed.credential_authentication_verified === false,
  'NATIVE_LOCAL_HBA_SCOPE_CHANGED');
  return { hba_sha256: observed.hba_sha256, auth_method: observed.auth_method,
    connection: observed.connection, credential_authentication_verified: false };
}
async function main() {
  check(process.argv.length === 2 && /^v24\./u.test(process.version), 'NATIVE_FIXED_NODE24_COMMAND_REQUIRED');
  const reviewed = await nativeExecutorPrerequisites(); // Deliberately first.
  const runId = randomUUID(); const transport = createNativeSpecsLocalTransport(runId);
  let ownsLock = false; let creationAttempted = false; let fixtureAttempted = false; let roleAbsent = true; let before; let hbaBefore; let containerId;
  const receipt = { schema_version: '1.0', run_id: runId, started_at: new Date().toISOString(), result: 'failed',
    harness_sha256: sha(await readFile(import.meta.filename)), migration_sha256: reviewed.migration_sha256,
    scope: 'Owned local10, direct narrow role via inside-container loopback TRUST, actual native parser/executor and strict adapter with synthetic Responses only.',
    credential_authentication_verified: false, local_auth_method: 'trust', local_route: 'inside-container127.0.0.1:5432',
    provider_transport: 'synthetic-only', actual_provider_called: false, cloud_called: false, runtime_gateway_user_jwt_used: false,
    source_correction_fixture_actor: 'synthetic-authenticated-only', source_correction_path: 'scoped-sql-rpc-not-http',
    worker_provider_configuration_read: false, provider_credentials_loaded: false,
    local_runtime_ownership_files_read: true, hosted_pipeline_accepted: false, cases: [] };
  const phase = (value, currentCase = null) => { receipt.phase = value; receipt.current_case = currentCase; delete receipt.current_stage; };
  const stageHook = stage => { receipt.current_stage = stage; };
  const fixture = operation => fixtureSql(reviewed.fixtures[operation], runId, containerId);
  try {
    phase('verify_target');
    const observed = await verifyNativeSpecsLocalTarget(); containerId = observed.container.Id;
    check(containerId === reviewed.logging_container_id, 'NATIVE_LOGGING_TARGET_CHANGED');
    await mkdir(path.dirname(LOCK), { recursive: true }); const lock = await open(LOCK, 'wx', 0o600);
    try { await lock.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); await lock.sync(); ownsLock = true; } finally { await lock.close(); }
    phase('snapshot_before'); before = await fixture('snapshot');
    check(isDeepStrictEqual(before.versions, VERSIONS) && isDeepStrictEqual(before.migration_sources, reviewed.migration_sources)
      && before.pipeline_config_disabled === true && before.pipeline_config_rows === 1, 'NATIVE_CURRENT_LOCAL10_BASELINE_REQUIRED');
    phase('verify_hba_before'); hbaBefore = requireNativeHba(await readNativeSpecsLocalHba(runId)); receipt.hba_sha256 = hbaBefore.hba_sha256;
    creationAttempted = true; roleAbsent = false; receipt.login_creation_attempted = true;
    phase('create_restricted_login'); await createNativeSpecsLocalLogin(runId);
    phase('probe_restricted_login'); const authorization = await probeNativeSpecsLocalLogin(runId);
    check(authorization.local_auth_method === 'trust' && authorization.credential_authentication_verified === false,
      'NATIVE_LOCAL_AUTHORIZATION_SCOPE_REQUIRED'); receipt.local_direct_role_authorization_verified = true;
    fixtureAttempted = true; receipt.fixture_setup_attempted = true;
    phase('fixture_setup'); const cases = casesFrom(await fixture('setup'));
    phase('native_stages', 'happy'); receipt.cases.push(await executeNativeSpecsFixture(cases.happy, transport, { onStage: stageHook }));
    phase('native_stages', 'cancelled');
    receipt.cases.push(await executeNativeSpecsFixture({ ...cases.cancelled, outcome: 'cancelled' }, transport, {
      onStage: stageHook,
      beforeApplyEvent: async () => { const state = await fixture('cancel'); check(state.cancelled === true, 'NATIVE_CANCEL_FIXTURE_UNCONFIRMED'); },
    }));
    phase('native_stages', 'source_changed'); receipt.cases.push(await executeNativeSpecsFixture({ ...cases.source_changed, outcome: 'source_changed' }, transport, {
      onStage: stageHook,
      beforeApplyEvent: async scope => {
        const state = await fixture('change'); check(state.source_changed === true, 'NATIVE_SOURCE_CHANGE_FIXTURE_UNCONFIRMED');
        let denied = false;
        try { await transport.getInput(scope); } catch (error) { denied = error?.code === 'INPUT_CHANGED' && error.unknown === false; }
        check(denied, 'NATIVE_REPLACED_SOURCE_READ_NOT_DENIED');
      },
    }));
    phase('two_client_claim_requests', 'recovery'); const claimRequests = await Promise.allSettled([transport.claim({ ...cases.recovery, stage: 'prepare_document' }),
      transport.claim({ ...cases.recovery, stage: 'prepare_document' })]);
    const winners = claimRequests.filter(value => value.status === 'fulfilled');
    const losers = claimRequests.filter(value => value.status === 'rejected');
    check(winners.length === 1 && losers.length === 1 && losers[0].reason?.code === 'JOB_ALREADY_RUNNING'
      && losers[0].reason.unknown === false, 'NATIVE_TWO_CLIENT_CLAIM_OUTCOME_UNCONFIRMED');
    const oldLease = winners[0].value;
    receipt.recovery_claim_pair = { concurrent_client_requests: true, separate_direct_sessions: true, one_live_winner: true,
      one_known_already_running: true, server_lock_overlap_proven: false };
    check(oldLease.already_completed === false, 'NATIVE_RESTART_LEASE_REQUIRED');
    await transport.settle(); const target = await verifyNativeSpecsLocalTarget();
    check(target.container.Id === containerId, 'NATIVE_TARGET_CHANGED');
    phase('restart_owned_database', 'recovery'); await restartOwnedLocalTarget(SYSTEM_ID);
    check((await verifyNativeSpecsLocalTarget()).container.Id === containerId, 'NATIVE_TARGET_CHANGED');
    phase('probe_restricted_login_after_restart', 'recovery'); await probeNativeSpecsLocalLogin(runId); receipt.restart_reconnected_restricted_role = true;
    let activeRefused = false;
    try { await transport.claim({ ...cases.recovery, stage: 'prepare_document' }); }
    catch (error) { activeRefused = error?.code === 'JOB_ALREADY_RUNNING' && error.unknown === false; }
    check(activeRefused, 'NATIVE_DURABLE_ACTIVE_LEASE_NOT_PRESERVED');
    phase('expire_known_synthetic_lease', 'recovery'); const expiry = await fixture('expire'); check(expiry.expired === true, 'NATIVE_SYNTHETIC_EXPIRY_UNCONFIRMED');
    const recovered = await transport.recover(1); check(recovered?.recovered === 1, 'NATIVE_DURABLE_RECOVERY_UNCONFIRMED');
    const ready = await fixture('ready'); check(ready.ready === true, 'NATIVE_SYNTHETIC_RETRY_READY_UNCONFIRMED');
    const newLease = await transport.claim({ ...cases.recovery, stage: 'prepare_document' });
    check(newLease.attempt_id !== oldLease.attempt_id && newLease.lease_token !== oldLease.lease_token, 'NATIVE_RECLAIM_FENCE_NOT_ROTATED');
    const stale = await transport.recordEvent({ event_id: randomUUID(), job_id: oldLease.job_id, attempt_id: oldLease.attempt_id,
      lease_token: oldLease.lease_token, stage: oldLease.stage, sequence: 1, event_type: 'heartbeat', input_hash: cases.recovery.input_hash });
    check(stale?.stale === true && stale.applied === false, 'NATIVE_OLD_ATTEMPT_NOT_FENCED');
    phase('native_stages', 'recovery'); receipt.cases.push(await executeNativeSpecsFixture(cases.recovery, transport, { initialLease: newLease, onStage: stageHook }));
    receipt.database_restart_and_reclaim = { actual_restart: true, active_lease_refused: true, synthetic_expiry_used: true, old_attempt_fenced: true };
    phase('verify_fixture_effects'); const verification = await fixture('verify');
    check(verification.verified === true, 'NATIVE_FINAL_FIXTURE_INVARIANTS_FAILED'); receipt.fixture_invariants_verified = true;
    await nativeExecutorPrerequisites();
    check(sha(await readFile(import.meta.filename)) === receipt.harness_sha256, 'NATIVE_HARNESS_CHANGED');
    receipt.operations_completed = true;
  } catch (error) { receipt.failure = nativeSpecsTransportFailure(error)
    ?? (error instanceof NativeSpecsScenarioError ? error.safeTransportFailure : null)
    ?? { code: 'NATIVE_ACCEPTANCE_UNCONFIRMED', unknown: true }; }
  finally {
    try {
      receipt.cleanup_phase = 'settle_backends'; await transport.settle(); await settleFixture(runId, containerId); receipt.owned_backends_settled = true;
      if (containerId) check((await verifyNativeSpecsLocalTarget()).container.Id === containerId, 'NATIVE_TARGET_CHANGED');
      if (fixtureAttempted) {
        receipt.cleanup_phase = 'cleanup_fixture'; const cleanup = await fixture('cleanup'); check(cleanup.cleaned === true, 'NATIVE_CLEANUP_REFUSED'); receipt.fixture_cleanup = 'passed';
      }
      if (creationAttempted) {
        receipt.cleanup_phase = 'reconcile_restricted_login'; const observed = await inspectNativeSpecsLocalLogin(runId);
        if (observed.present) { check(observed.owned === true && observed.active_sessions === 0, 'NATIVE_LOGIN_CLEANUP_REFUSED'); await dropNativeSpecsLocalLogin(runId); }
        roleAbsent = !(await inspectNativeSpecsLocalLogin(runId)).present; check(roleAbsent, 'NATIVE_LOGIN_REMOVAL_UNCONFIRMED');
      }
      if (before) {
        receipt.cleanup_phase = 'snapshot_after'; const after = await fixture('snapshot');
        check(isDeepStrictEqual(before, after), 'NATIVE_BASELINE_RESTORATION_FAILED'); receipt.baseline_restored = true;
      }
      if (hbaBefore) {
        receipt.cleanup_phase = 'verify_hba_after'; const hbaAfter = requireNativeHba(await readNativeSpecsLocalHba(runId));
        check(isDeepStrictEqual(hbaBefore, hbaAfter), 'NATIVE_LOCAL_HBA_SCOPE_CHANGED'); receipt.hba_unchanged = true;
        receipt.hba_after_sha256 = hbaAfter.hba_sha256;
      }
      if (ownsLock && roleAbsent) {
        const owner = JSON.parse(await readFile(LOCK, 'utf8'));
        check(owner.run_id === runId && owner.pid === process.pid, 'NATIVE_LOCK_OWNERSHIP_CHANGED'); await unlink(LOCK); ownsLock = false;
      }
      if (receipt.operations_completed && receipt.baseline_restored && receipt.hba_unchanged && !ownsLock) receipt.result = 'passed';
    } catch (error) { receipt.cleanup_failure = nativeSpecsTransportFailure(error) ?? { code: 'NATIVE_CLEANUP_UNCONFIRMED', unknown: true }; receipt.cleanup_unconfirmed = true; receipt.shared_db_lock_retained = ownsLock; }
    receipt.finished_at = new Date().toISOString();
    const directory = path.join(ROOT, 'tracking/evidence/m02/native-executor'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${receipt.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(`M02 native executor local proof: ${receipt.result}\nReceipt: ${path.relative(ROOT, file).replaceAll('\\', '/')}\n`);
    if (receipt.result !== 'passed') process.exitCode = 1;
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { process.stderr.write('Native executor proof is not ready: exact reviewed local10, logging, source and fixture seals are required. No fallback is permitted.\n'); process.exitCode = 1; });
}
