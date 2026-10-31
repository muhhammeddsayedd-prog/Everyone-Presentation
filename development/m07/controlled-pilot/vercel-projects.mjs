/** Fixed-target pilot project preparation. No deploy, secret, data or auth mutation. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const CLI = 'C:/Users/iway/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const SLUG = 'muhammed-abdelrahman';
const names = { web: 'everyone-presentation-pilot', worker: 'everyone-presentation-worker-pilot' };
const action = process.argv[2], unit = process.argv[3];
assert(['inspect', 'create', 'configure'].includes(action) && Object.hasOwn(names, unit) && process.argv.length === 4);
const name = names[unit];
function api(endpoint, body, method = 'POST') {
  const args = [CLI, 'api', endpoint, '--scope', SLUG, '--raw'];
  if (body) args.push('--method', method, '--input', '-');
  const bytes = execFileSync(process.execPath, args, { cwd: ROOT, input: body ? JSON.stringify(body) : undefined,
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(bytes.toString('utf8'));
}
function project(p) {
  assert(p.name === name && /^prj_[A-Za-z0-9]+$/u.test(p.id) && p.accountId === TEAM);
  return { id: p.id, name: p.name, account_id: p.accountId, framework: p.framework ?? null,
    root_directory: p.rootDirectory ?? null, node_version: p.nodeVersion,
    outside_workspace_files: p.sourceFilesOutsideRootDirectory ?? null,
    install_command: p.installCommand ?? null,
    deployment_protection: p.ssoProtection?.deploymentType ?? null, sandbox_region: p.sandbox?.region ?? null };
}
try {
  const team = api(`/v2/teams/${TEAM}`);
  assert(team.id === TEAM && team.slug === SLUG && team.billing?.plan === 'pro' && team.billing?.status === 'active');
  const found = api(`/v9/projects?teamId=${TEAM}&search=${encodeURIComponent(name)}&limit=100`);
  assert(Array.isArray(found.projects) && !found.pagination?.next);
  const exact = found.projects.filter(p => p.name === name);
  assert(exact.length <= 1);
  let result = exact.length ? project(exact[0]) : null;
  let dispatch = false;
  if (action === 'create') {
    assert.equal(result, null, 'Existing project must be inspected, not recreated.');
    const directory = path.join(ROOT, '.local/m07-pilot');
    await mkdir(directory, { recursive: true });
    const claim = await open(path.join(directory, `${unit}-create-dispatch.json`), 'wx');
    await claim.writeFile(JSON.stringify({ name, team: TEAM, claimed_at: new Date().toISOString(),
      scope: 'One project creation; unknown outcome requires read-only inspect, no redispatch' }) + '\n');
    await claim.close();
    const body = unit === 'web'
      ? { name, framework: 'nextjs', rootDirectory: 'apps/web', serverlessFunctionRegion: 'dub1' }
      : { name, framework: null, oidcTokenConfig: { enabled: true },
        sandbox: { region: 'dub1', failoverRegions: [] } };
    dispatch = true;
    result = project(api(`/v10/projects?teamId=${TEAM}`, body));
  }
  if (action === 'configure') {
    assert(result);
    const claim = JSON.parse(await readFile(path.join(ROOT, `.local/m07-pilot/${unit}-create-dispatch.json`), 'utf8'));
    assert(claim.name === name && claim.team === TEAM);
    const body = unit === 'web'
      ? { nodeVersion: '24.x', rootDirectory: 'apps/web', sourceFilesOutsideRootDirectory: true,
        serverlessFunctionRegion: 'dub1', enablePreviewFeedback: false, enableProductionFeedback: false,
        installCommand: 'npm ci --include=dev --workspace @eps/web --include-workspace-root' }
      : { nodeVersion: '24.x', rootDirectory: null, oidcTokenConfig: { enabled: true },
        sandbox: { region: 'dub1', failoverRegions: [] } };
    dispatch = true;
    result = project(api(`/v9/projects/${result.id}?teamId=${TEAM}`, body, 'PATCH'));
    assert(result.node_version === '24.x');
  }
  const domains = result ? api(`/v9/projects/${result.id}/domains?teamId=${TEAM}`).domains : [];
  assert(Array.isArray(domains));
  const report = { observed_at: new Date().toISOString(), action, unit, team: TEAM, team_slug: SLUG,
    team_plan: 'pro', dispatched: dispatch, project: result, deployment_performed: false,
    domains: domains.map(d => ({ name: d.name, verified: d.verified === true, git_branch: d.gitBranch ?? null })),
    private_configuration_transmitted: false, credentials_in_report: false };
  const out = path.join(ROOT, 'tracking/evidence/m07/controlled-pilot');
  await mkdir(out, { recursive: true });
  const filename = `${new Date().toISOString().replaceAll(':', '-').replace('.', '-')}-${randomUUID().slice(0, 8)}-${unit}-${action}.json`;
  await writeFile(path.join(out, filename), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ receipt: path.relative(ROOT, path.join(out, filename)), ...report }) + '\n');
} catch {
  process.stderr.write('Pilot project operation unconfirmed. Inspect the fixed target before any repeat; provider diagnostics suppressed.\n');
  process.exitCode = 1;
}
