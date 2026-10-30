/** One authorized actual Claude Code model call; synthetic loopback business data only. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSyntheticClientServer, CLIENT_TOOLS, CLIENT_ACTOR, CLIENT_PROJECT, CLIENT_RENAMED } from './m07-client-server.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const runId = randomUUID(), started = Date.now(), marker = randomBytes(32).toString('hex');
const privateRoot = path.join(ROOT, '.local/m07-client', runId), temporaryRoot = path.join(os.tmpdir(), `eps-m07-client-${runId}`), cwd = path.join(temporaryRoot, 'empty-cwd');
const sha = value => createHash('sha256').update(value).digest('hex');
const report = { schema_version: '1.0', run_id: runId, observed_at: new Date(started).toISOString(), result: 'unverified',
  scope: 'Actual installed Claude Code against current Studio MCP HTTP/SDK transport with clearly synthetic controlled business ports, owned loopback only. Not a real-service or OAuth journey.',
  actual_client_called: false, synthetic_business_data_only: true, central_called: false, openai_called: false, n8n_called: false,
  oauth_provider_tested: false, hosting_tested: false, private_workspace_context_supplied: false, credential_files_read_by_harness: false,
  global_mcp_settings_hooks_mutation_requested: false, max_turns: 8, max_budget_usd: 1.5, overall_deadline_ms: 120000,
  source_seals: {}, retry_attempted: false };
let server, child, childEnded = true;
const command = (executable, args, options = {}) => execFileSync(executable, args, { windowsHide: true, shell: false, encoding: 'utf8', timeout: 10000, ...options });
const ps = script => command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, EPS_M07_CLIENT_PRIVATE: privateRoot, EPS_M07_CLIENT_TEMP: temporaryRoot, EPS_M07_CLIENT_RUN_ID: runId, EPS_M07_CLIENT_PID: String(process.pid) } });
async function protect(folder) {
  await mkdir(folder, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const target = folder === privateRoot ? '$env:EPS_M07_CLIENT_PRIVATE' : '$env:EPS_M07_CLIENT_TEMP';
    assert.equal(ps(`$ErrorActionPreference='Stop';$p=${target};$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=New-Object System.Security.AccessControl.DirectorySecurity;$acl.SetAccessRuleProtection($true,$false);foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $acl;$a=Get-Acl -LiteralPath $p;if(-not $a.AreAccessRulesProtected){throw 'ACL_INVALID'};foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'ACL_INVALID'}};Write-Output 'VERIFIED'`).trim(), 'VERIFIED');
  }
}
function claudeEnvironment() {
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'ComSpec', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'ProgramFiles', 'ProgramData', 'PATHEXT']) if (process.env[key]) env[key] = process.env[key];
  return { ...env, CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1', DISABLE_AUTOUPDATER: '1', DISABLE_TELEMETRY: '1', DISABLE_ERROR_REPORTING: '1', MCP_TIMEOUT: '10000', MCP_TOOL_TIMEOUT: '10000' };
}
async function invoke(executable, args) {
  return new Promise((resolve, reject) => {
    child = spawn(executable, args, { cwd, env: claudeEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    report.client_pid = child.pid;
    childEnded = false; let expired = false, size = 0; const stdout = [], stderr = [];
    const timer = setTimeout(() => { expired = true; if (child.pid === report.client_pid && child.spawnfile === executable && child.spawnargs.includes(path.join(privateRoot, 'mcp.json')) && child.spawnargs.includes('--max-turns') && !childEnded) child.kill(); }, Math.max(1, 110000 - (Date.now() - started)));
    child.stdout.on('data', value => { size += value.length; if (size <= 8 * 1024 * 1024) stdout.push(value); else child.kill(); });
    child.stderr.on('data', value => { size += value.length; if (size <= 8 * 1024 * 1024) stderr.push(value); else child.kill(); });
    child.once('error', error => { clearTimeout(timer); childEnded = true; reject(error); });
    child.once('close', code => { clearTimeout(timer); childEnded = true; resolve({ code, expired, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }); });
    child.stdin.end();
  });
}
try {
  assert.equal(process.argv.length, 2); assert.equal(process.platform, 'win32');
  await protect(privateRoot); await protect(temporaryRoot); await mkdir(cwd); assert.deepEqual(await readdir(cwd), []);
  await writeFile(path.join(temporaryRoot, 'owner.json'), JSON.stringify({ run_id: runId, purpose: 'm07-synthetic-client-smoke', runner_pid: process.pid }), { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(privateRoot, 'owner.json'), JSON.stringify({ run_id: runId, purpose: 'm07-synthetic-client-smoke', runner_pid: process.pid }), { flag: 'wx', mode: 0o600 });
  report.private_acl_verified = true; report.empty_external_workdir_verified = true;
  const executable = await realpath(path.join(process.env.APPDATA, 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'));
  report.client_version = command(executable, ['--version']).trim(); assert.equal(report.client_version, '2.1.301 (Claude Code)');
  const sourcePaths = ['tools/m07-client-smoke.mjs', 'tools/m07-client-server.ts', 'apps/web/lib/mcp-http.ts', 'apps/web/lib/mcp.ts', 'apps/web/lib/mcp-capabilities.ts', 'apps/web/lib/mcp-output-validation.ts', 'contracts/mcp-tool-catalog.json', 'apps/web/package.json'];
  for (const file of sourcePaths) report.source_seals[file] = sha(await readFile(path.join(ROOT, file)));
  server = await createSyntheticClientServer(marker); report.server_pid = server.pid; report.loopback_url = `${server.origin}/mcp`;
  const names = CLIENT_TOOLS.map(name => `mcp__eps_m07_synthetic__${name}`);
  const configPath = path.join(privateRoot, 'mcp.json'), settingsPath = path.join(privateRoot, 'settings.json');
  await writeFile(configPath, JSON.stringify({ mcpServers: { eps_m07_synthetic: { type: 'http', url: `${server.origin}/mcp`, headers: { Origin: server.origin, 'X-EPS-Synthetic-Run': marker } } } }), { flag: 'wx', mode: 0o600 });
  await writeFile(settingsPath, JSON.stringify({ disableAllHooks: true, autoMemoryEnabled: false, disableBundledSkills: true, disableClaudeAiConnectors: true, disableWorkflows: true, claudeMdExcludes: ['**'], permissions: { allow: names, defaultMode: 'dontAsk' } }), { flag: 'wx', mode: 0o600 });
  const system = 'You are a bounded MCP compatibility test client. Use only the four provided synthetic MCP tools. All exposed project data is synthetic. Do not use or request files, shell, browser, networking, skills, subagents, credentials or additional tools. Never claim real central service or OAuth integration. Execute the exact user sequence, then return a concise result based only on tool responses.';
  const prompt = `Run this authorized synthetic compatibility sequence using server eps_m07_synthetic: (1) call get_capabilities; (2) call list_projects with limit 1; (3) call get_project for returned project ${CLIENT_PROJECT}; (4) call update_project once for that project with idempotency_key m07-claude-synthetic-${runId} and body containing its current row_version and name exactly ${JSON.stringify(CLIENT_RENAMED)}; (5) call get_project again. Check returned principal_id is ${CLIENT_ACTOR}, final name matches exactly and row_version is 2. These are clearly synthetic ports. Report actual returned project ID, principal ID, final row_version and success or failure. Do not ask questions or call other tools.`;
  const args = ['--print', '--restricted', '--strict-mcp-config', '--mcp-config', configPath, '--tools', '', '--allowedTools', names.join(','), '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--disable-slash-commands', '--no-chrome', '--no-session-persistence', '--setting-sources', '', '--settings', settingsPath, '--system-prompt', system, '--output-format', 'stream-json', '--verbose', '--max-turns', '8', '--max-budget-usd', '1.50', '--model', 'sonnet', '--effort', 'low', '--', prompt];
  report.flags = args.map((value, index) => [configPath, settingsPath, system, prompt].includes(value) ? `<${index === args.indexOf(configPath) ? 'private-mcp-config' : index === args.indexOf(settingsPath) ? 'private-settings' : index === args.indexOf(system) ? 'synthetic-only-system-prompt' : 'synthetic-only-user-prompt'}>` : value);
  report.exact_allowed_tools = names; report.actual_client_called = true;
  const result = await invoke(executable, args); report.client_exit_code = result.code; report.client_timed_out = result.expired;
  await writeFile(path.join(privateRoot, 'stdout.jsonl'), result.stdout, { flag: 'wx', mode: 0o600 }); await writeFile(path.join(privateRoot, 'stderr.txt'), result.stderr, { flag: 'wx', mode: 0o600 });
  const events = result.stdout.split(/\r?\n/u).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const final = events.findLast(event => event.type === 'result');
  if (final) {
    report.client_result = { subtype: final.subtype, is_error: final.is_error, duration_ms: final.duration_ms, duration_api_ms: final.duration_api_ms, num_turns: final.num_turns, total_cost_usd: final.total_cost_usd, usage: final.usage, model_usage: final.modelUsage, permission_denials: final.permission_denials };
    report.client_report = typeof final.result === 'string' ? final.result.slice(0, 4000) : null;
  }
  report.client_reported_tools = events.filter(event => event.type === 'assistant').flatMap(event => event.message?.content ?? []).filter(item => item.type === 'tool_use').map(item => item.name);
  report.protocol_trace = server.trace; report.synthetic_final_state = server.snapshot();
  const calls = server.trace.filter(event => event.method === 'tools/call').map(event => event.tool);
  assert.equal(result.code, 0); assert.equal(result.expired, false); assert.ok(final && !final.is_error);
  for (const name of CLIENT_TOOLS) assert.ok(calls.includes(name), `CLIENT_TOOL_NOT_OBSERVED:${name}`);
  assert.ok(calls.filter(name => name === 'get_project').length >= 2); assert.equal(server.snapshot().writes, 1);
  assert.equal(server.snapshot().project.name, CLIENT_RENAMED); assert.equal(server.snapshot().project.row_version, 2);
  assert.ok(server.trace.some(event => event.negotiated_protocol || event.accepted_protocol_header)); assert.ok(report.client_reported_tools.every(name => names.includes(name)));
  for (const file of sourcePaths) assert.equal(sha(await readFile(path.join(ROOT, file))), report.source_seals[file], `CLIENT_SOURCE_CHANGED:${file}`);
  report.result = 'passed';
} catch (error) {
  report.failure_code = 'M07_ACTUAL_CLIENT_SMOKE_UNCONFIRMED';
  await mkdir(privateRoot, { recursive: true }); await writeFile(path.join(privateRoot, 'failure.txt'), String(error.stack ?? error), { mode: 0o600 });
} finally {
  if (child && !childEnded) { assert.equal(child.pid, report.client_pid); assert.ok(child.spawnargs.includes(path.join(privateRoot, 'mcp.json')) && child.spawnargs.includes('--max-turns')); child.kill(); report.client_forced_stop_requested = true; }
  if (server) { report.protocol_trace ??= server.trace; report.synthetic_final_state ??= server.snapshot(); await server.close(); report.owned_server_closed = true; }
  if (process.platform === 'win32') {
    try {
      const result = ps("$ErrorActionPreference='Stop';$p=[IO.Path]::GetFullPath($env:EPS_M07_CLIENT_TEMP);$base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath());if(-not $p.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)-or(Split-Path $p -Leaf)-cne('eps-m07-client-'+$env:EPS_M07_CLIENT_RUN_ID)){throw 'TEMP_BOUNDS_REQUIRED'};$m=Get-Content -LiteralPath(Join-Path $p 'owner.json')-Raw|ConvertFrom-Json;if($m.run_id-cne$env:EPS_M07_CLIENT_RUN_ID-or$m.purpose-cne'm07-synthetic-client-smoke'-or$m.runner_pid-ne[int]$env:EPS_M07_CLIENT_PID){throw 'TEMP_MARKER_REQUIRED'};Remove-Item -LiteralPath $p -Recurse -Force;if(Test-Path -LiteralPath $p){throw 'TEMP_REMAINS'};Write-Output 'REMOVED'");
      report.owned_empty_workdir_removed = result.trim() === 'REMOVED';
    } catch { report.temporary_cleanup_unconfirmed = true; report.result = 'unverified'; }
  }
  report.client_process_exited = childEnded; report.finished_at = new Date().toISOString(); report.elapsed_ms = Date.now() - started;
  report.private_raw_logs = path.relative(ROOT, privateRoot).replaceAll('\\', '/');
  const folder = path.join(ROOT, 'tracking/evidence/m07/claude-code'); await mkdir(folder, { recursive: true });
  const receipt = path.join(folder, `${report.observed_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`); await writeFile(receipt, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: report.result, actual_client_called: report.actual_client_called, evidence: path.relative(ROOT, receipt).replaceAll('\\', '/'), client_exit_code: report.client_exit_code, owned_server_closed: report.owned_server_closed, temp_removed: report.owned_empty_workdir_removed }));
  if (report.result !== 'passed') process.exitCode = 1;
}
