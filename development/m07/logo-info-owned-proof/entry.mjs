/** Fresh owned local proof only. No hosted Storage, cloud or provider ports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export const EXECUTION_ENABLED = false;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);

export async function admit(cfg, controller, root) {
  assert(EXECUTION_ENABLED, 'LOGO_INFO_OWNED_PROOF_DISABLED');
  assert.equal(path.resolve(root), cfg.root);
  for (const [file, digest] of Object.entries(cfg.source_pins)) {
    const stat = await lstat(file);
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
    assert.equal(await realpath(file), file);
    assert.equal(sha(await readFile(file)), digest);
  }
  assert.equal(path.resolve(controller), cfg.controller);
  assert(uuid(cfg.compile_uuid));
}

export async function claim(ctx, cfg) {
  assert(uuid(ctx.runId));
  const directory = path.join(ctx.root, '.local/logo-info-owned-once', cfg.compile_uuid);
  await mkdir(path.dirname(directory), { recursive: true });
  await ctx.protect(directory);
  await writeFile(path.join(directory, 'claim.json'), JSON.stringify({
    compile_uuid: cfg.compile_uuid, run_id: ctx.runId,
    controller_sha256: sha(await readFile(cfg.controller)), source_pins: cfg.source_pins,
    automatic_retry: false,
  }), { flag: 'wx' });
  ctx.report.dispatch_once_claim_created = true;
}

export function renderProof(cfg, runId) {
  assert(uuid(runId));
  assert.equal(sha(cfg.proof_sql), cfg.proof_sql_sha256);
  assert.equal(cfg.proof_sql.split(cfg.template_run).length, 2);
  const text = cfg.proof_sql.replace(cfg.template_run, runId);
  assert(text.trimEnd().endsWith('rollback;'));
  assert.equal(text.split('begin;').length, 2);
  return text;
}

export function projectResults(stdout, expectedCases) {
  const rows = stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  const cases = rows.filter(row => Object.hasOwn(row, 'case'));
  assert.deepEqual(cases.map(row => row.case), expectedCases);
  for (const row of cases) {
    assert.deepEqual(Object.keys(row).sort(), ['case', 'helper_allowed', 'helper_execute_denied', 'operation', 'passed', 'selected_count', 'table_select_denied']);
    assert.equal(row.passed, true);
    for (const key of ['helper_allowed', 'helper_execute_denied', 'table_select_denied']) assert.equal(typeof row[key], 'boolean');
    assert([0, 1].includes(row.selected_count));
  }
  const final = rows.filter(row => row.result === 'passed_local_SQL_simulation');
  assert.deepEqual(final, [{ result: 'passed_local_SQL_simulation', http_or_physical_Storage_acceptance: false, rollback_required: true, existing_Ready_rows_modified: false }]);
  return { cases, case_count: cases.length, SQL_simulation_only: true, hosted_Storage_acceptance: false };
}

export async function runProof(ctx, cfg) {
  const text = renderProof(cfg, ctx.runId);
  const before = await ctx.baseline();
  const input = path.join(ctx.privateRoot, 'logo-info-proof.sql');
  await writeFile(input, text, { flag: 'wx' });
  assert.equal(sha(await readFile(input)), sha(text));
  ctx.report.proof_input_sha256 = sha(text);
  const result = await ctx.sql('set session authorization postgres;set eps.local_fixture_tests=\'eps-presentation-canonical-pg17-local\';' + text);
  // Normal psql return is required before any result is accepted. Preserve full
  // stdout privately; the public projection contains closed synthetic case data.
  await writeFile(path.join(ctx.privateRoot, 'proof-normal-output.json'), JSON.stringify({ stdout: result.stdout, stderr: result.stderr }), { flag: 'wx' });
  const projected = projectResults(result.stdout, cfg.expected_cases);
  assert.deepEqual(await ctx.baseline(), before, 'LOGO_INFO_FULL_CLONE_ROLLBACK_CHANGED');
  ctx.report.logo_info = { ...projected, normal_child_return: true, full_clone_rows_catalogue_roles_rollback_exact: true };
}

export async function inventories(docker, runId) {
  assert(uuid(runId));
  const filter = 'label=eps.logoinfo.run=' + runId;
  const containers = await docker(['ps', '-aq', '--filter', filter]);
  const volumes = await docker(['volume', 'ls', '-q', '--filter', filter]);
  assert.equal(containers.code, 0); assert.equal(volumes.code, 0);
  assert.equal(containers.stdout.trim(), ''); assert.equal(volumes.stdout.trim(), '');
  return { same_engine_container_inventory_empty: true, same_engine_volume_inventory_empty: true };
}
