/** Root-executed read-only daemon observation. Importing performs no I/O.
 * Raw logs/configuration stay bounded in RAM; only selected metadata leaves. */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const DIST = path.join(ROOT, '.local/m07-pilot/tooling/node_modules/vercel/dist');
const CLI = path.join(DIST, 'vc.js');
const GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
export const PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';
export const TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1';
export const SLUG = 'muhammed-abdelrahman';
const NAME = 'everyone-presentation-worker-pilot';
const PINS = { 'vc.js':'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',
  'commands-routing.js':'1314ff6bb482b556ac540e12bf87d899b15e2e30ed1c907e54d5b664dea5ba90',
  'commands-deployments.js':'5309d52278f46cf3cd7764690873038b4054c0b702ff885b9878a67ee6ff218a',
  'chunks/chunk-CJHVHB2F.js':'c9301bc282bed45b0d8b127bf70cbc951c9d2ccf00be71289b331560445d03a0',
  'chunks/chunk-OLAG7Y3P.js':'96356f41ba1d0a364761c04470e831dea6365ca51744f19d4dc710c728927b52',
  'chunks/chunk-2PYFJXKS.js':'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b' };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const need = v => { if (!v) throw new Error('DAEMON_RUNTIME_UNCONFIRMED'); };
const exact = (v, keys) => need(object(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(','));
const integer = (v, maximum = 2) => Number.isSafeInteger(v) && v >= 0 && v <= maximum;
const instanceId = v => typeof v === 'string' && /^dmni_[0-9a-hjkmnp-tv-z]{26}$/u.test(v);
const hash = v => createHash('sha256').update(v).digest('hex');
export function validateDeploymentId(value) { need(typeof value === 'string' && /^dpl_[A-Za-z0-9]{10,80}$/u.test(value)); return value; }
function time(value, now = Date.now()) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d{4}-\d\d-\d\dT[0-9:.]+Z$/u.test(value) ? Date.parse(value) : NaN;
  need(Number.isSafeInteger(parsed) && parsed > 0 && parsed <= now + 60000); return parsed;
}
function image(value) {
  need(typeof value === 'string' && value.length <= 300);
  const match = /^(?:vcr\.vercel\.com\/)?muhammed-abdelrahman\/everyone-presentation-worker-pilot\/daemon(?:@sha256:([a-f0-9]{64})|:[A-Za-z0-9_.-]{1,128})$/u.exec(value);
  const bare = /^sha256:([a-f0-9]{64})$/u.exec(value); need(match || bare);
  return { reference:value, digest:match?.[1] ? `sha256:${match[1]}` : bare ? value : null };
}
function regions(value) { exact(value,['dub1']); need(integer(value.dub1)); return { dub1:value.dub1 }; }
export function projectDaemon(value, deployment, now = Date.now()) {
  validateDeploymentId(deployment); need(object(value) && object(value.context) && object(value.daemon));
  const context = value.context; need(context.project?.id === PROJECT && context.project?.name === NAME && context.team?.id === TEAM
    && context.team?.slug === SLUG && context.environment === 'production');
  const d = value.daemon; need(d.name === 'worker' && d.deploymentId === deployment && ['ready','reconciling','stopped'].includes(d.status));
  const config = d.config; need(object(config) && object(config.image) && object(d.instances));
  const requested = image(config.image.requested); const resolved = config.image.resolved == null ? null : image(config.image.resolved);
  const configured = regions(config.instances); const override = config.configuredInstances === undefined ? null : regions(config.configuredInstances);
  need(typeof value.scalingOverridden === 'boolean' && value.scalingOverridden === (override !== null));
  const memory = /^(\d{1,5})(Mi|Gi)$/u.exec(config.resources?.requests?.memory ?? '');
  need(memory); const memoryMiB = Number(memory[1]) * (memory[2] === 'Gi' ? 1024 : 1);
  need(memoryMiB === 2048 && config.terminationGracePeriodSeconds === 300);
  const counts = d.instances; for (const key of ['desired','ready','total']) need(integer(counts[key]));
  need(counts.ready <= counts.total && Array.isArray(counts.items) && counts.items.length <= 2 && counts.items.length <= counts.total);
  const seen = new Set();
  const instances = counts.items.map(row => {
    need(object(row) && instanceId(row.id) && !seen.has(row.id) && typeof row.alive === 'boolean' && row.region === 'dub1'); seen.add(row.id);
    need(row.memoryMiB == null || Number.isSafeInteger(row.memoryMiB) && row.memoryMiB > 0 && row.memoryMiB <= 8192);
    return { id:row.id,alive:row.alive,image:image(row.image),region:'dub1',memory_mib:row.memoryMiB ?? null,
      started_at_ms:row.startedAt == null ? null : time(row.startedAt,now),stopped_at_ms:row.stoppedAt == null ? null : time(row.stoppedAt,now),
      last_checked_at_ms:row.lastCheckedAt == null ? null : time(row.lastCheckedAt,now) };
  }).sort((a,b) => a.id.localeCompare(b.id));
  return { project_id:PROJECT,team_id:TEAM,daemon:'worker',environment:'production',deployment_id:deployment,status:d.status,
    updated_at_ms:time(d.updatedAt,now),requested_image:requested,resolved_image:resolved,configured_instances:configured,
    configured_override:override,memory_mib:memoryMiB,termination_grace_seconds:300,desired:counts.desired,ready:counts.ready,total:counts.total,instances };
}
function identity(event, key, expected) {
  const attribute = object(event.attributes) ? event.attributes[key] : undefined;
  return (event[key] !== undefined || attribute !== undefined) && (event[key] === undefined || event[key] === expected)
    && (attribute === undefined || attribute === expected);
}
function eventCode(message) {
  let value; try { value = JSON.parse(message); } catch { return null; }
  if (!object(value)) return null;
  if (Object.keys(value).sort().join(',') === 'authentication,event,orchestration' && value.event === 'specs_worker_started'
    && value.authentication === 'narrow_database_login' && value.orchestration === 'n8n_required') return 'worker_started';
  if (Object.keys(value).length === 1 && value.event === 'hosted_worker_unconfirmed') return 'worker_unconfirmed';
  if (Object.keys(value).length === 1 && value.event === 'hosted_worker_pilot_expired') return 'pilot_expired';
  if (Object.keys(value).sort().join(',') === 'code,event' && value.event === 'hosted_worker_paused' && value.code === 'NATIVE_CLEANUP_UNCONFIRMED') return 'worker_paused';
  return null;
}
export function projectRuntimeLogs(text, scope) {
  need(typeof text === 'string' && Buffer.byteLength(text) <= 1048576); validateDeploymentId(scope.deployment);
  need(instanceId(scope.instance.id) && integer(scope.window.start,Number.MAX_SAFE_INTEGER) && integer(scope.window.end,Number.MAX_SAFE_INTEGER)
    && scope.window.end > scope.window.start && scope.window.end-scope.window.start === 600000);
  const lines = text.trim().split(/\r?\n/u); need(lines.length >= 1 && lines.length <= 202);
  const result = { instance_id:scope.instance.id,log_records:0,unbound_records:0,unrecognized_message_records:0,truncated_records:0,
    warning_records:0,excluded_interval_count:0,has_more:false,complete_window:false,last_startup_at_ms:null,
    events:{worker_started:0,worker_unconfirmed:0,pilot_expired:0,worker_paused:0} };
  let summary = null;
  for (const line of lines) {
    need(line.length > 0 && Buffer.byteLength(line) <= 262144); const row = JSON.parse(line); need(object(row) && !summary);
    if (row.type === 'warning') { result.warning_records++; continue; }
    if (row.type === 'summary') { summary = row; continue; }
    need(row.type === 'log' && object(row.data) && ++result.log_records <= 100); const event = row.data;
    const attrs = object(event.attributes) ? event.attributes : {};
    const production = (event.environment === 'production' || attrs['scope.type'] === 'target' && attrs['scope.value'] === 'production')
      && (event.environment === undefined || event.environment === 'production');
    let timestamp; try { timestamp = time(event.timestamp,scope.window.end); } catch { timestamp = null; }
    if (!identity(event,'source','daemon') || !identity(event,'daemonName','worker') || !identity(event,'daemonInstanceId',scope.instance.id)
      || !identity(event,'deploymentId',scope.deployment) || !production || event.projectId !== undefined && event.projectId !== PROJECT
      || timestamp === null || timestamp < scope.window.start || timestamp > scope.window.end || scope.instance.started_at_ms === null || timestamp < scope.instance.started_at_ms) {
      result.unbound_records++; continue;
    }
    if (event.truncated === true) { result.truncated_records++; continue; }
    const code = typeof event.message === 'string' && Buffer.byteLength(event.message) <= 65536 ? eventCode(event.message) : null;
    if (!code) { result.unrecognized_message_records++; continue; }
    result.events[code]++; if (code === 'worker_started') result.last_startup_at_ms = Math.max(result.last_startup_at_ms ?? 0,timestamp);
  }
  need(summary && summary.recordsReturned === result.log_records && Number.isSafeInteger(summary.recordsReturned)
    && object(summary.timeRange) && time(summary.timeRange.start,scope.window.end) === scope.window.start && time(summary.timeRange.end,scope.window.end) === scope.window.end
    && object(summary.pagination) && typeof summary.pagination.hasMore === 'boolean'
    && (summary.pagination.next === null || typeof summary.pagination.next === 'string' && summary.pagination.next.length <= 65536)
    && Array.isArray(summary.excludedIntervals) && summary.excludedIntervals.length <= 100);
  for (const interval of summary.excludedIntervals) need(object(interval) && time(interval.start,scope.window.end) <= time(interval.end,scope.window.end));
  result.has_more = summary.pagination.hasMore; result.excluded_interval_count = summary.excludedIntervals.length;
  result.complete_window = !result.has_more && result.warning_records === 0 && result.excluded_interval_count === 0;
  return result;
}
export function runtimeObservation(before, after, logs) {
  const signature = v => JSON.stringify({ deployment:v.deployment_id,resolved:v.resolved_image,requested:v.requested_image,
    configured:v.configured_instances,override:v.configured_override,
    instances:v.instances.map(row => ({id:row.id,image:row.image,started:row.started_at_ms})) });
  const stable = signature(before) === signature(after);
  const ready = stable && before.status === 'ready' && after.status === 'ready' && before.desired === 1 && after.desired === 1
    && before.ready === 1 && after.ready === 1 && before.total === 1 && after.total === 1 && after.instances.length === 1
    && before.instances[0].alive && after.instances[0].alive && after.instances[0].stopped_at_ms === null
    && after.instances[0].memory_mib === 2048 && after.resolved_image?.digest !== null
    && after.instances[0].image.digest === after.resolved_image?.digest;
  const selected = logs.find(row => row.instance_id === after.instances[0]?.id);
  return { metadata_identity_stable:stable,current_instance_ready:ready,startup_observed:Boolean(ready && selected?.complete_window
    && selected.unbound_records === 0 && selected.truncated_records === 0
    && selected.events.worker_started > 0 && selected.events.worker_unconfirmed === 0 && selected.events.pilot_expired === 0 && selected.events.worker_paused === 0),
    polling_oidc_refresh_recovery_and_business_jobs_proven:false };
}
export function daemonCommands(deployment, instance, window) {
  validateDeploymentId(deployment); need(instanceId(instance));
  const common = ['--project',PROJECT,'--scope',SLUG,'--global-config',GLOBAL];
  const query = `source:daemon AND (environment:"production" OR (attributes/'scope.type':"target" AND attributes/'scope.value':"production")) AND (daemonName:"worker" OR attributes/'daemonName':"worker") AND (daemonInstanceId:"${instance}" OR attributes/'daemonInstanceId':"${instance}")`;
  return {inspect:['daemons','inspect','worker',...common,'--json'],logs:['logs','runtime',...common,'--deployment',deployment,
    '--since',new Date(window.start).toISOString(),'--until',new Date(window.end).toISOString(),'--limit','100','--query',query,'--json']};
}
function environment() {
  const env = { NODE_ENV:'production',PATH:'',CI:'1',VERCEL_TELEMETRY_DISABLED:'1',VERCEL_CLI_USE_NATIVE_BINARY:'0' };
  for (const key of ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']) if (process.env[key]) env[key]=process.env[key]; return env;
}
async function safeFile(file) {
  const info = await lstat(file); need(info.isFile() && !info.isSymbolicLink() && info.size <= 8*1024*1024 && (await realpath(file)).toLowerCase() === file.toLowerCase()); return readFile(file);
}
async function main() {
  const started = Date.now(); const deployment = validateDeploymentId(process.argv[2]);
  need(process.argv.length === 3 && process.platform === 'win32' && /^v24\./u.test(process.version) && !process.env.NODE_OPTIONS);
  const window = {start:started-600000,end:started}; let commands = 0;
  const report = {schema_version:'1.0',observed_at:new Date(started).toISOString(),result:'unconfirmed',read_only:true,project_id:PROJECT,team_id:TEAM,
    deployment_id:deployment,window_start:new Date(window.start).toISOString(),window_end:new Date(window.end).toISOString(),
    raw_logs_configuration_cursors_or_diagnostics_persisted:false,provider_mutations:false,maximum_cli_commands:4,
    cli_internal_http_retries_possible:true,exact_http_attempt_count_claimed:false};
  const call = args => new Promise((resolve,reject) => {
    need(++commands <= 4); const remaining = 120000-(Date.now()-started); need(remaining > 0);
    const child = spawn(process.execPath,[CLI,...args],{cwd:ROOT,env:environment(),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const chunks=[]; let bytes=0; let stderr=0; let bad=false;
    const stop=()=>{bad=true;child.kill('SIGKILL');}; const timer=setTimeout(stop,Math.min(30000,remaining));
    child.once('error',stop); child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>1048576)stop();else chunks.push(chunk);});
    child.stderr.on('data',chunk=>{stderr+=chunk.length;if(stderr>32768)stop();});
    child.once('close',code=>{clearTimeout(timer);if(bad||code!==0){reject(new Error('DAEMON_RUNTIME_UNCONFIRMED'));return;}resolve(Buffer.concat(chunks).toString('utf8'));});
  });
  try {
    await safeFile(CLI); const pkg=JSON.parse(await safeFile(path.join(DIST,'../package.json'))); need(pkg.version==='65.8.0');
    for(const [name,digest] of Object.entries(PINS)) need(hash(await safeFile(path.join(DIST,name)))===digest);
    report.cli_version='65.8.0';report.cli_source_pins={...PINS};report.helper_sha256=hash(await safeFile(import.meta.filename));
    const common=['--project',PROJECT,'--scope',SLUG,'--global-config',GLOBAL];
    const inspect=['daemons','inspect','worker',...common,'--json'];
    const before=projectDaemon(JSON.parse(await call(inspect)),deployment);report.before=before;
    const logs=[];
    for(const instance of before.instances) logs.push(projectRuntimeLogs(await call(daemonCommands(deployment,instance.id,window).logs),{deployment,instance,window}));
    report.logs=logs; const after=projectDaemon(JSON.parse(await call(inspect)),deployment);report.after=after;
    report.observation=runtimeObservation(before,after,logs);report.result='observed';
  } catch {report.code='DAEMON_RUNTIME_UNCONFIRMED';process.exitCode=1;}
  report.cli_commands_attempted=commands;report.finished_at=new Date().toISOString();
  const directory=path.join(ROOT,'tracking/evidence/m07/controlled-pilot');await mkdir(directory,{recursive:true});
  const file=path.join(directory,`${report.finished_at.replaceAll(':','-')}-${randomUUID().slice(0,8)}-daemon-runtime.json`);
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({receipt:path.relative(ROOT,file),result:report.result,startup_observed:report.observation?.startup_observed??false})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('DAEMON_RUNTIME_UNCONFIRMED\n');process.exitCode=1;});
