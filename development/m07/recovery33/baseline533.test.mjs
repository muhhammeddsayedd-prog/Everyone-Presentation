import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildBaselineComparison533, projectBaselineComparison533 } from './baseline533.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
test('exact-source baseline comparison preserves native session before a separate normalized read and parses', async () => {
  const controller = await readFile(path.join(root, '.local/m07-recovery33-prepared/5332c86b-b1f9-410e-8702-647031182b17/controller.mjs'));
  const sql = buildBaselineComparison533(controller);
  assert(sql.indexOf("'phase','native'") < sql.indexOf("set local search_path=''"));
  assert(sql.startsWith('begin read only;') && sql.endsWith('rollback;\n'));
  const result = spawnSync(path.join(root, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-c',
    "from pglast import parse_sql,parse_plpgsql;import sys;s=sys.stdin.read();parse_sql(s);parse_plpgsql(s);print('PARSED')"], { input: sql, encoding: 'utf8', timeout: 10000, windowsHide: true, shell: false });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'PARSED');
});
test('baseline proof requires the unchanged original digest and reports only safe part/table hashes', () => {
  const native = { table_rows: { 'eps.synthetic': 'a'.repeat(32) }, functions: 'b'.repeat(32), grants: 'c'.repeat(32) };
  const normalized = { ...native, functions: 'd'.repeat(32) };
  const rows = [{ kind: 'baseline533_session', phase: 'native', current_user: 'postgres', session_user: 'postgres' }, native,
    { kind: 'baseline533_session', phase: 'normalized' }, normalized];
  const expected = createHash('sha256').update(JSON.stringify(native)).digest('hex');
  const proof = projectBaselineComparison533(rows, expected); assert.equal(proof.native_exact_original_baseline_match, true);
  assert.equal(proof.parts.functions_same, false); assert.equal(proof.parts.grants_same, true); assert.equal(proof.parts.changed_table_count, 0);
  assert.equal(projectBaselineComparison533(rows, '0'.repeat(64)).native_exact_original_baseline_match, false);
  assert.throws(() => projectBaselineComparison533([{ ...rows[0], current_user: 'other' }, ...rows.slice(1)], expected));
});
