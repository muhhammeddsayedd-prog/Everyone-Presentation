import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildCleanupSql533, validateCleanupInputs533 } from './cleanup533.mjs';
import { fullCatalogue33Sql } from './compiler.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
const run = '5332c86b-b1f9-410e-8702-647031182b17';
const read = async file => readFile(path.join(root, file));
const json = async file => JSON.parse(await read(file));
async function fixture() {
  const before = await json('tracking/evidence/m07/recovery33/2026-10-31T14-39-48-217Z-5332c86b.json');
  const proof = await json('tracking/evidence/m07/recovery33/2026-10-31T14-55-00.036Z-533-baseline-context.json');
  return { before, proof, recon: await json('tracking/evidence/m07/recovery33/2026-10-31T14-49-51.508Z-533-read-only-reconciliation.json'),
    native: await json(proof.private_baseline_artifact), controller: await read(`.local/m07-recovery33-prepared/${run}/controller.mjs`),
    originalCatalogue: await json(`${before.private_artifact_directory}/original29-full-auth-storage-catalogue.json`),
    catalogueSql: fullCatalogue33Sql(new Map([['development/m07/db/catalog29.sql', await read('development/m07/db/catalog29.sql')]])).sql };
}
test('full fixed533 cleanup and independent read-only postcheck parse SQL and every PL/pgSQL body', async () => {
  const data = await fixture(), sql = buildCleanupSql533(data), post = buildCleanupSql533(data, { after: true, readOnly: true });
  const result = spawnSync(path.join(root, '.venv-skills/Scripts/python.exe'), ['-X','utf8','-c',
    "import sys,json;from pglast import parse_sql,parse_plpgsql\nfor s in json.load(sys.stdin):\n parse_sql(s);parse_plpgsql(s)\nprint('PARSED')"],
  { input: JSON.stringify([sql, post]), encoding: 'utf8', timeout: 20000, windowsHide: true, shell: false, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'PARSED');
  assert.equal((sql.match(/^drop role /gmu) ?? []).length, 2); assert(sql.includes('drop role eps_oauth_consent_owner;\ndrop role eps_mcp_issuer_owner;'));
  assert(!/^\s*(?:revoke|drop\s+owned|reassign\s+owned|drop\s+database)\b/imu.test(sql));
  assert(sql.includes("current_user")); assert(sql.includes("'185012','185052'"));
  assert(sql.indexOf('CLEANUP533_EXACT_OWNED_ROLES_MISMATCH') < sql.indexOf('drop role eps_oauth'));
  assert(sql.indexOf('CLEANUP533_FULL_CATALOGUE_AFTER_MISMATCH') > sql.indexOf('drop role eps_mcp'));
  assert(post.startsWith('begin read only;') && post.endsWith('rollback;\n')); assert(!/^drop role /mu.test(post));
});
test('cleanup rejects changed original baseline, marker, OID, role privileges, dependencies and source', async () => {
  const original = await fixture(); validateCleanupInputs533(original);
  const mutations = [data => { data.native.native_baseline.functions = '0'.repeat(32); }, data => { data.recon.target_roles[0].oid = '185013'; },
    data => { data.recon.target_roles[1].marker += '-other'; }, data => { data.recon.target_roles[0].super = true; },
    data => { data.recon.target_roles[0].dependencies.push({ dbid: 42 }); }, data => { data.recon.other_clients = 1; },
    data => { data.proof.native_exact_original_baseline_match = false; }, data => { data.before.original_baseline_sha256 = '0'.repeat(64); },
    data => { data.controller = Buffer.from('changed'); }];
  for (const mutate of mutations) { const data = structuredClone(original); data.controller = Buffer.from(data.controller); mutate(data); assert.throws(() => buildCleanupSql533(data)); }
});
test('exact native context precedes both baseline checks and every unchanged global/catalogue check survives', async () => {
  const data = await fixture(), sql = buildCleanupSql533(data);
  assert.equal((sql.match(/perform set_config\('search_path'/gu) ?? []).length, 2);
  assert.equal((sql.match(/CLEANUP533_ORIGINAL_BASELINE_MISMATCH/gu) ?? []).length, 2);
  assert(sql.includes("set local role postgres;"));
  assert(sql.includes("'functions'")); assert(sql.includes("'grants'"));
  assert(sql.includes('CLEANUP533_GLOBAL_ROLES_BEFORE_MISMATCH') && sql.includes('CLEANUP533_GLOBAL_ROLES_AFTER_MISMATCH'));
  assert(sql.includes('CLEANUP533_FULL_CATALOGUE_BEFORE_MISMATCH') && sql.includes('CLEANUP533_FULL_CATALOGUE_AFTER_MISMATCH'));
  assert.equal(data.recon.original_baseline_matches_before, false); assert.equal(data.proof.native_exact_original_baseline_match, true);
});
