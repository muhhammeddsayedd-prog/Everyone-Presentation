/** Offline reconciliation only. Never invokes a client, model, provider or listener. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const source = 'tracking/evidence/m07/claude-code/2026-10-30T11-18-40-826Z-d9825720.json';
assert.equal(process.argv.length, 2);
const bytes = await readFile(path.join(ROOT, source)); const run = JSON.parse(bytes);
assert.equal(run.run_id, 'd9825720-4e9e-4a89-bf25-1b8949edf83b');
assert.equal(run.actual_client_called, true); assert.equal(run.client_exit_code, 0); assert.equal(run.client_timed_out, false);
assert.equal(run.client_result.subtype, 'success'); assert.equal(run.client_result.is_error, false);
assert.equal(run.client_result.num_turns, 6); assert.ok(run.client_result.total_cost_usd < 1.5);
assert.deepEqual(run.client_result.permission_denials, []);
const calls = run.protocol_trace.filter(event => event.method === 'tools/call');
assert.deepEqual(calls.map(event => event.tool), ['get_capabilities', 'list_projects', 'get_project', 'update_project', 'get_project']);
assert.ok(calls.every(event => event.principal_id === '71000000-0000-4000-8000-000000000001'));
assert.equal(run.synthetic_final_state.writes, 1); assert.equal(run.synthetic_final_state.project.row_version, 2);
assert.equal(run.synthetic_final_state.project.name, 'Synthetic Claude Code compatibility passed');
assert.ok(run.protocol_trace.some(event => event.method === 'server/discover'));
assert.equal(run.owned_server_closed, true); assert.equal(run.owned_empty_workdir_removed, true); assert.equal(run.client_process_exited, true);
const observed = new Date().toISOString();
const log = await readFile(path.join(ROOT, '.local/m07-client', run.run_id, 'stdout.jsonl'), 'utf8');
const events = log.split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
const init = events.find(event => event.type === 'system' && event.subtype === 'init'); assert.ok(init);
assert.ok(init.tools.every(name => name.startsWith('mcp__eps_m07_synthetic__')));
assert.equal(init.skills.length, 0); assert.equal(init.slash_commands.length, 0); assert.equal(init.additional_directories.length, 0);
assert.equal(init.permissionMode, 'dontAsk');
const transportSeals = Object.fromEntries(Object.entries(run.source_seals).filter(([file]) => !file.startsWith('tools/')));
for (const [file, seal] of Object.entries(transportSeals)) assert.equal(createHash('sha256').update(await readFile(path.join(ROOT, file))).digest('hex'), seal);
const assessment = { schema_version: '1.0', assessed_at: observed, result: 'business_compatibility_passed_protocol_capture_unverified',
  source_receipt: source, source_receipt_sha256: createHash('sha256').update(bytes).digest('hex'), source_receipt_preserved: true,
  actual_client: run.client_version, client_result: run.client_result, exact_observed_tools: calls.map(event => event.tool),
  synthetic_principal_id: calls[0].principal_id, synthetic_project_id: run.synthetic_final_state.project.id,
  synthetic_final_row_version: run.synthetic_final_state.project.row_version, synthetic_updates_committed: 1,
  observed_discovery_method: 'server/discover', exact_protocol_revision_captured: false,
  transport_source_seals_rechecked: transportSeals,
  observed_client_isolation: { no_builtin_tools: true, all_mcp_tools_from_synthetic_test_server: true, advertised_mcp_schema_count: init.tools.length,
    skill_count: init.skills.length, slash_command_count: init.slash_commands.length, additional_directory_count: init.additional_directories.length,
    permission_mode: init.permissionMode, mcp_servers: init.mcp_servers,
    builtin_plugin_registrations: init.plugins.map(plugin => ({ name: plugin.name })), plugin_tools_or_skills_exercised: false },
  capture_failure: 'The original harness asserted a negotiated-protocol event but recorded initialize responses only. The real client used modern server/discover; successful business calls were already independently observed by the server.',
  capture_fix_validation: 'The updated local preflight covers modern server/discover plus the accepted 2026-07-28 revision; that local result is not retroactively claimed as the original client header.',
  actual_client_retried: false, retry_reason: 'Combined execution window was preserved; no second model call was made after it approached expiry.',
  synthetic_only: true, real_service_journey_tested: false, provider_oauth_tested: false, hosting_tested: false,
  cleanup: { own_loopback_server_closed: true, own_cli_exited: true, marker_bounded_temporary_workdir_removed: true, raw_logs_private_ignored: true } };
const target = path.join(ROOT, 'tracking/evidence/m07/claude-code', `${observed.replace(/[:.]/gu, '-')}-offline-assessment.json`);
await writeFile(target, JSON.stringify(assessment, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ result: assessment.result, evidence: path.relative(ROOT, target).replaceAll('\\', '/') }));
