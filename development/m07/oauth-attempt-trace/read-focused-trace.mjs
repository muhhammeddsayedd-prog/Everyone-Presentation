/** Read-only focused pilot collection. Importing performs no filesystem/provider IO.
 * The existing collector remains the authority for every projected log field. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildLogCommand, childEnvironment, projectPilotTrace } from '../oauth-consent-fix/read-pilot-trace.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const CLI_SHA = '5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493';
const MAXIMUM = 2 * 1024 * 1024;
const QUERIES = Object.freeze({ oauth: 'EPS AND OAuth', reads: 'EPS AND MCP AND read' });
const fail = code => { throw new Error(code); };
function query(mode) {
  if (typeof mode !== 'string' || !Object.hasOwn(QUERIES, mode)) fail('FOCUSED_TRACE_ARGUMENTS_INVALID');
  return QUERIES[mode];
}

export function buildFocusedLogCommand(mode, deployment, since, now) {
  const focused = query(mode), args = buildLogCommand(deployment, since, now);
  const index = args.indexOf('--query');
  if (index < 0 || args.lastIndexOf('--query') !== index || args[index + 1] !== 'EPS AND (OAuth OR MCP)') fail('FOCUSED_TRACE_COMMAND_UNCONFIRMED');
  args[index + 1] = focused;
  return args;
}
export function projectFocusedTrace(text, scope, mode) {
  query(mode);
  return { schema_version: '1.0', read_only: true, focused_scope: mode, trace: projectPilotTrace(text, scope) };
}
export function focusedTraceSummary(receipt, evidencePath) {
  query(receipt.focused_scope);
  const report = receipt.trace;
  return { schema_version: '1.0', read_only: true, focused_scope: receipt.focused_scope, evidence_path: evidencePath,
    deployment_id: report.deployment_id, project_id: report.project_id, public_origin: report.public_origin,
    since: report.since, observed_at: report.observed_at, counts: report.counts,
    events: report.events.filter(value => receipt.focused_scope === 'oauth' ? value.event.startsWith('eps.oauth.') : value.event === 'eps.mcp.project_read_succeeded') };
}

async function pinnedCli(cli) {
  try {
    for (const file of [cli, path.join(path.dirname(cli), '../package.json')]) {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 8 * 1024 * 1024
        || path.resolve(await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()) fail('FOCUSED_TRACE_CLI_UNPINNED');
    }
    if (createHash('sha256').update(await readFile(cli)).digest('hex') !== CLI_SHA
      || JSON.parse(await readFile(path.join(path.dirname(cli), '../package.json'), 'utf8')).version !== '65.8.0') fail('FOCUSED_TRACE_CLI_UNPINNED');
  } catch { fail('FOCUSED_TRACE_CLI_UNPINNED'); }
}
/** At most one CLI read. Combined stdout/stderr are byte bounded; stderr is never persisted or displayed. */
function runtimeLogs(args) {
  return new Promise((resolve, reject) => {
    let child; const chunks = []; let bytes = 0, settled = false;
    const stop = () => { if (settled) return; settled = true; clearTimeout(timer); child?.kill(); reject(new Error('FOCUSED_TRACE_READ_UNCONFIRMED')); };
    const timer = setTimeout(stop, 30_000);
    try { child = spawn(process.execPath, args, { cwd: ROOT, env: childEnvironment(), windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { stop(); return; }
    child.once('error', stop);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > MAXIMUM) stop(); else if (!settled) chunks.push(chunk); });
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > MAXIMUM) stop(); });
    child.once('close', code => {
      if (settled) return; if (code !== 0) { stop(); return; } settled = true; clearTimeout(timer);
      try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { reject(new Error('FOCUSED_TRACE_RESPONSE_INVALID')); }
    });
  });
}
async function main() {
  const [mode, deployment, since, ...extra] = process.argv.slice(2);
  if (extra.length || process.platform !== 'win32' || !/^v24\./u.test(process.version) || process.env.NODE_OPTIONS) fail('FOCUSED_TRACE_ARGUMENTS_INVALID');
  const args = buildFocusedLogCommand(mode, deployment, since); await pinnedCli(args[0]);
  const text = await runtimeLogs(args), observedAt = new Date().toISOString();
  const receipt = projectFocusedTrace(text, { deployment, since: args[args.indexOf('--since') + 1], observedAt }, mode);
  const directory = path.join(ROOT, 'tracking/evidence/m07/oauth-attempt-trace'); await mkdir(directory, { recursive: true });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || path.resolve(await realpath(directory)).toLowerCase() !== directory.toLowerCase()) fail('FOCUSED_TRACE_OUTPUT_UNCONFIRMED');
  const filename = `${observedAt.replaceAll(':', '-')}-${randomUUID().slice(0, 8)}-${mode}-focused-trace.json`;
  await writeFile(path.join(directory, filename), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  const evidencePath = `tracking/evidence/m07/oauth-attempt-trace/${filename}`;
  process.stdout.write(JSON.stringify(focusedTraceSummary(receipt, evidencePath)) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { process.stderr.write('FOCUSED_TRACE_UNCONFIRMED\n'); process.exitCode = 1; });
}
