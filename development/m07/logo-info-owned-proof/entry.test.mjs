import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import { admit, claim, renderProof, projectResults, runProof, inventories } from './entry.mjs';

const run = '8a100000-0000-4000-8000-000000000002';
const token = '8a100000-0000-4000-8000-000000000001';
const sha = x => createHash('sha256').update(x).digest('hex');
const sql = 'begin;select \'' + token + "';rollback;";
const cfg = { template_run: token, proof_sql: sql, proof_sql_sha256: sha(sql), expected_cases: ['own-open-INFO'] };
const row = { case: 'own-open-INFO', operation: 'object.get_authenticated_info', helper_allowed: true, helper_execute_denied: false, table_select_denied: false, selected_count: 1, passed: true };
const final = { result: 'passed_local_SQL_simulation', http_or_physical_Storage_acceptance: false, rollback_required: true, existing_Ready_rows_modified: false };
const output = x => [JSON.stringify(x), JSON.stringify(final)].join('\n');

test('default-off admission refuses before configuration/files/ports', async () => {
  await assert.rejects(admit(undefined, undefined, undefined), /LOGO_INFO_OWNED_PROOF_DISABLED/u);
});
test('render preserves one runtime binding and rejects drift/foreign UUID', () => {
  assert.equal(renderProof(cfg, run), sql.replace(token, run));
  assert.throws(() => renderProof({ ...cfg, proof_sql: sql + ' ' }, run));
  assert.throws(() => renderProof(cfg, 'not-a-uuid'));
  const duplicate = sql.replace(token, token + token);
  assert.throws(() => renderProof({ ...cfg, proof_sql: duplicate, proof_sql_sha256: sha(duplicate) }, run));
});
test('public projection accepts exact cases and refuses extra fields/missing result', () => {
  assert.equal(projectResults(output(row), cfg.expected_cases).case_count, 1);
  assert.throws(() => projectResults(output({ ...row, secret: 'synthetic-canary' }), cfg.expected_cases));
  assert.throws(() => projectResults(JSON.stringify(row), cfg.expected_cases));
  assert.throws(() => projectResults(output(row), ['other-case']));
});
test('proof input custody precedes SQL and full rollback precedes public acceptance', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'eps-logo-info-pure-'));
  try {
    const report = {}, events = [];
    let reads = 0;
    const ctx = { runId: run, privateRoot: directory, report,
      baseline: async () => { events.push('baseline'); reads++; return [{ full_reason_hash: 'same', full_catalogue_hash: 'same' }]; },
      sql: async text => { events.push('sql'); assert.equal(await readFile(path.join(directory, 'logo-info-proof.sql'), 'utf8'), renderProof(cfg, run)); assert(text.endsWith('rollback;')); return { stdout: output(row), stderr: '' }; },
    };
    await runProof(ctx, cfg);
    assert.deepEqual(events, ['baseline', 'sql', 'baseline']); assert.equal(reads, 2);
    assert.equal(report.logo_info.full_clone_rows_catalogue_roles_rollback_exact, true);
    const directory2 = await mkdtemp(path.join(tmpdir(), 'eps-logo-info-drift-'));
    try {
      let count = 0; const changed = { ...ctx, privateRoot: directory2, report: {}, baseline: async () => [{ full_catalogue_hash: ++count === 1 ? 'old' : 'changed' }] };
      changed.sql = async () => ({ stdout: output(row), stderr: '' });
      await assert.rejects(runProof(changed, cfg), /LOGO_INFO_FULL_CLONE_ROLLBACK_CHANGED/u);
      assert.equal(changed.report.logo_info, undefined);
    } finally { await rm(directory2, { recursive: true }); }
  } finally { await rm(directory, { recursive: true }); }
});
test('once claim is exclusive and binds actual controller bytes before dispatch', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'eps-logo-info-claim-'));
  try {
    const ctx = { root: directory, runId: run, report: {}, protect: async target => { const { mkdir } = await import('node:fs/promises'); await mkdir(target); } };
    const config = { compile_uuid: run, controller: new URL('./entry.mjs', import.meta.url), source_pins: {} };
    await claim(ctx, config);
    assert.equal(ctx.report.dispatch_once_claim_created, true);
    const saved = JSON.parse(await readFile(path.join(directory, '.local/logo-info-owned-once', run, 'claim.json'), 'utf8'));
    assert.equal(saved.compile_uuid, run); assert.equal(saved.run_id, run);
    assert.equal(saved.controller_sha256, sha(await readFile(config.controller)));
    assert.equal(saved.automatic_retry, false); assert.deepEqual(saved.source_pins, {});
    await assert.rejects(claim(ctx, config));
  } finally { await rm(directory, { recursive: true }); }
});
test('cleanup inventories use same supplied engine port and reject unknown/nonempty', async () => {
  const calls = [];
  const result = await inventories(async args => { calls.push(args); return { code: 0, stdout: '' }; }, run);
  assert(result.same_engine_container_inventory_empty && result.same_engine_volume_inventory_empty);
  assert.equal(calls.length, 2); assert(calls.every(args => args.includes('label=eps.logoinfo.run=' + run)));
  await assert.rejects(inventories(async () => ({ code: 0, stdout: 'owned-resource-still-present' }), run));
  await assert.rejects(inventories(async () => ({ code: 1, stdout: '' }), run));
});
