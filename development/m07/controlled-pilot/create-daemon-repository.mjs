/** One fixed private repository creation; no image, credential or deployment IO. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const CLI = path.join(ROOT, '.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';
function call(args) {
  return JSON.parse(execFileSync(process.execPath, [CLI, '--global-config', 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli', 'vcr', ...args,
    '--project', PROJECT, '--scope', 'muhammed-abdelrahman', '--json'], { cwd: ROOT, windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }));
}
try {
  assert.equal(process.argv.length, 2);
  const before = call(['ls']); assert.equal(before.pagination.next, null);
  assert(Array.isArray(before.repositories) && before.repositories.every(r => r.projectId === PROJECT));
  assert.equal(before.repositories.filter(r => r.name === 'daemon').length, 0);
  const claim = await open(path.join(ROOT, '.local/m07-pilot/daemon-repository-create.claim.json'), 'wx');
  try { await claim.writeFile(JSON.stringify({ project_id: PROJECT, name: 'daemon', claimed_at: new Date().toISOString(), unknown_outcome: 'Inspect only; never repeat creation' }) + '\n'); await claim.sync(); }
  finally { await claim.close(); }
  const created = call(['create', 'daemon']);
  const after = call(['ls']); assert.equal(after.pagination.next, null);
  const matches = after.repositories.filter(r => r.name === 'daemon'); assert.equal(matches.length, 1);
  const row = matches[0]; assert.equal(row.projectId, PROJECT); assert.equal(row.public, false);
  assert.equal(after.repositories.length, before.repositories.length + 1);
  const response = created.repository ?? created; assert.equal(response.id, row.id);
  for (const old of before.repositories) assert.deepEqual(after.repositories.find(r => r.id === old.id), old);
  const report = { observed_at: new Date().toISOString(), result: 'passed', project_id: PROJECT,
    repository: { id: row.id, name: 'daemon', public: false }, original_repositories_preserved: true,
    image_uploaded: false, deployment_performed: false, credentials_in_report: false };
  const directory = path.join(ROOT, 'tracking/evidence/m07/controlled-pilot'); await mkdir(directory, { recursive: true });
  const output = path.join(directory, `${report.observed_at.replaceAll(':', '-')}-daemon-repository.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ receipt: path.relative(ROOT, output), ...report }) + '\n');
} catch { process.stderr.write('Daemon repository outcome unconfirmed. Inspect fixed project; never repeat creation blindly.\n'); process.exitCode = 1; }
