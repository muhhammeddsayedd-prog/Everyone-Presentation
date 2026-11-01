/** Fixed-run local reconciliation only. Default off; no IO occurs on import. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, realpath, unlink, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const APPLY_ENABLED = true;
export const RUN = '93bb8f21-2f2e-4305-948e-f78897c497d1';
export const ROOT = path.resolve(import.meta.dirname, '../../..');
const PREPARED = `.local/m07-worker38-concurrency-prepared/${RUN}`;
const ARTIFACTS = `.local/m07-worker38-concurrency-tests/${RUN}`;
const FAILURE = 'tracking/evidence/m07/worker38-concurrency/2026-11-01T18-36-34-245Z-93bb8f21.json';
const OBSERVATION = 'tracking/evidence/m07/worker38-concurrency/2026-11-01T18-38-37.532Z-93bb-role-observation.json';
const LOCK = '.local/local-postgres/test-db.lock';
const CLAIM = `${ARTIFACTS}/cleanup93bb.claim.json`;
const RETURNED = `${ARTIFACTS}/cleanup93bb.returned.json`;
const SYSTEM = '7701520506262638626';
const PID = 32580;
const COMMIT = 'fc4ad6d';
const OLD = ['eps_mcp_issuer_owner', 'eps_oauth_consent_owner'];
export const ROLES = [...OLD, 'eps_job_trace_owner'];
const DBS = ['source', 'restore'].map(kind => `eps_m07_r33_${kind}_${RUN.replaceAll('-', '')}`);
const PINS = Object.freeze({
 [FAILURE]: '4374996f89875af23d24beb617883bbb1ae7ae8749de4f34c88fd94ee0871377',
 [OBSERVATION]: '1f6d4bc4baed2dc9a13e8965c4587b8092aa92e9af9301556a103a59dde6f312',
 [`${PREPARED}/controller.mjs`]: '8c66d21a1b9cff722320d05afcc9da1aa4bee216eed4ea5e7ee11bd2baab6ad0',
 [`${PREPARED}/plan.json`]: 'a98cfba9f9efadd3ecf808af39d288e1a2cd8e36df7fed57570d84299a09920b',
 [`${PREPARED}/execution.claim.json`]: '7610ca3efd575d65b1a4dd2dcb5ff9f8dd3e2fec28b8c963acc97a5539ceb3b2',
 [`${ARTIFACTS}/original29-full-auth-storage-catalogue.json`]: '7bfeb27ac544ee245e487ce646fac7db6d2826372f179480145f81fcdc738dc4',
 [`${ARTIFACTS}/source33-before-fixture-catalogue.json`]: '04ff9e09b9c9265f91eb5a07a699eeaa310d7add809788a56b4ab9cfede8b7b3',
 [LOCK]: '6ff4c21d8e63ae67dda2a44f93106fbe61e58583f87152f31ff8f9fc2a3c18b8',
});
const HELPERS = Object.freeze({
 'development/m07/worker38-concurrency/proof.mjs': '444e89c363d523530aad88c229b4ba003874d9c65fe80e587d41e1c1d21d2569',
 'development/m07/recovery33/runtime.mjs': '9a5c6377937e27a4097f188488795f93840470b20dba4214e812e1fe209cd0ed',
 'development/m07/recovery33/compiler.mjs': 'e53ba5ab07b3724f0b2c4da59d46090ddb351342be205f74325e46192c4cf0a6',
 'development/m07/recovery33/ownership.mjs': '080ca9a50455a03acf2555fe3426cee595471a6182b7bf1c8022523d0a836d00',
 'development/m07/recovery29/identity.mjs': 'c785bf1533031b560ad538fdcf5fbddb00eeb28d5f72e0d5d65524a933ad727d',
 'tools/local-postgres.mjs': '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
});
export const sha = value => createHash('sha256').update(value).digest('hex');
const WORKSPACE_KEY = sha(ROOT.toLowerCase()).slice(0,24);
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value))+'::jsonb';
const scalar = value => value.trim().replace(/;$/u, '');
const strip = value => { assert(value.startsWith('begin read only;') && /rollback;\s*$/u.test(value)); return value.slice(16).replace(/rollback;\s*$/u, '').trim(); };
const guard = (sql, expected, label) => `do $cleanup93bb$begin if (${scalar(sql)}) is distinct from ${json(expected)} then raise exception'CLEANUP93BB_${label}';end if;end$cleanup93bb$;\n`;
const env = () => Object.fromEntries(['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP'].filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]));

async function bytes(file, expected) {
 assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
 const absolute = path.join(ROOT, file), stat = await lstat(absolute);
 assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 16*1024*1024);
 assert.equal(await realpath(absolute), absolute);
 const raw = await readFile(absolute); if (expected) assert.equal(sha(raw), expected); return raw;
}
export function processAbsent(kill = process.kill) { try { kill(PID, 0); return false; } catch (error) { return error.code === 'ESRCH'; } }
async function retainedLock() { const raw = await bytes(LOCK, PINS[LOCK]); assert.deepEqual(JSON.parse(raw), { run_id: RUN, pid: PID }); assert(processAbsent()); return raw; }
async function bounded(binary, args, input, maximum = 16*1024*1024) {
 return await new Promise((resolve, reject) => {
  const child = spawn(binary, args, { cwd: ROOT, env: { ...env(), PATH: '', NODE_ENV: 'production', CI: '1' }, shell: false, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  const chunks = []; let size = 0, settled = false;
  const stop = () => { if (!settled) { settled = true; clearTimeout(timer); child.kill(); reject(Error('CLEANUP93BB_TRANSPORT_UNCONFIRMED')); } };
  const timer = setTimeout(stop, 60_000); child.once('error', stop);
  child.stdout.on('data', chunk => { size += chunk.length; if (size > maximum) stop(); else if (!settled) chunks.push(chunk); });
  child.stderr.on('data', chunk => { size += chunk.length; if (size > maximum) stop(); });
  child.once('close', code => { if (settled) return; if (code !== 0) return stop(); settled = true; clearTimeout(timer); resolve(Buffer.concat(chunks)); });
  child.stdin.on('error', () => {}); child.stdin.end(input);
 });
}
export async function verifyArchivedSources(plan) {
 const git = 'C:/Program Files/Git/cmd/git.exe'; assert.equal(sha(await readFile(git)), '22fead8244ef3a7225fb800099a4e43eca8bcec0466774917669599c2f19a05a');
 const files = Object.keys(plan.source_pins); assert.equal(files.length, 312);
 assert(files.every(file => /^[A-Za-z0-9._/-]+$/u.test(file) && !file.split('/').includes('..')));
 const raw = await bounded(git, ['cat-file','--batch'], files.map(file => `${COMMIT}:${file}\n`).join(''));
 let at = 0;
 for (const file of files) {
  const end = raw.indexOf(10, at); assert(end > at); const header = raw.subarray(at, end).toString('ascii');
  const match = /^[a-f0-9]{40} blob ([0-9]+)$/u.exec(header); assert(match);
  const length = Number(match[1]); assert(Number.isSafeInteger(length) && length >= 0 && length <= 8*1024*1024);
  at = end+1; assert.equal(sha(raw.subarray(at, at+length)), plan.source_pins[file]); at += length; assert.equal(raw[at++], 10);
 }
 assert.equal(at, raw.length);
}
export async function pureHelpers() {
 const recorded = JSON.parse(await bytes(FAILURE,PINS[FAILURE])).source_seals;
 const allowed = {...recorded,...HELPERS}, seen = new Set();
 async function validate(file) {
  if (seen.has(file)) return; assert(Object.hasOwn(allowed,file)); seen.add(file);
  const raw = await bytes(file,allowed[file]);
  for (const match of raw.toString().matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/gu)) {
   if (!match[1].startsWith('.')) continue;
   const child = path.relative(ROOT,path.resolve(ROOT,path.dirname(file),match[1])).replaceAll('\\','/'); await validate(child);
  }
 }
 for (const file of Object.keys(HELPERS)) await validate(file);
 const load = file => import(pathToFileURL(path.join(ROOT, file)).href);
 const [proof, runtime, compiler, identity, local] = await Promise.all([
  load('development/m07/worker38-concurrency/proof.mjs'), load('development/m07/recovery33/runtime.mjs'),
  load('development/m07/recovery33/compiler.mjs'), load('development/m07/recovery29/identity.mjs'), load('tools/local-postgres.mjs')]);
 return { proof, runtime, compiler, identity, local, sourcePins:Object.fromEntries([...seen].sort().map(file => [file,allowed[file]])) };
}
async function inputs() {
 const files = new Map(); for (const [file, pin] of Object.entries(PINS)) files.set(file, await bytes(file, pin));
 const before = JSON.parse(files.get(FAILURE)), observation = JSON.parse(files.get(OBSERVATION));
 const plan = JSON.parse(files.get(`${PREPARED}/plan.json`)), claim = JSON.parse(files.get(`${PREPARED}/execution.claim.json`));
 assert.equal(before.run_id, RUN); assert.equal(before.result, 'failed'); assert.equal(before.cleanup_unconfirmed, true);
 assert.equal(before.checkpoint, 'worker38-owned-migration-20261101012057');
 assert.deepEqual(plan.source_pins, before.source_seals); assert.deepEqual(claim.source_pins, plan.source_pins);
 assert.equal(plan.generated_source_sha256, PINS[`${PREPARED}/controller.mjs`]); assert.equal(claim.controller_sha256, plan.generated_source_sha256);
 assert.equal(claim.run_id, RUN); assert.equal(claim.dispatch_may_have_occurred, true); assert.equal(claim.automatic_retry, false);
 assert.equal(plan.run_id, RUN); await verifyArchivedSources(plan);
 const helpers = await pureHelpers();
 const source = await bytes('development/m07/db/catalog29.sql', plan.source_pins['development/m07/db/catalog29.sql']);
 const catalogue = helpers.compiler.fullCatalogue33Sql(new Map([['development/m07/db/catalog29.sql', source]])).sql;
 const own = ['cleanup.mjs','cleanup.test.mjs','README.md'];
 const sourcePins = {...helpers.sourcePins}; for (const name of own) { const file = 'development/m07/worker38-concurrency-cleanup93bb/'+name; sourcePins[file] = sha(await bytes(file)); }
 return { before, observation, plan, sourcePins, controller: files.get(`${PREPARED}/controller.mjs`),
  original: JSON.parse(files.get(`${ARTIFACTS}/original29-full-auth-storage-catalogue.json`)),
  source33: JSON.parse(files.get(`${ARTIFACTS}/source33-before-fixture-catalogue.json`)), catalogue, helpers };
}
function oldRoleQuery(name) {
 assert(OLD.includes(name));
 return `select jsonb_build_object('name',r.rolname,'oid',r.oid,'marker',shobj_description(r.oid,'pg_authid'),'login',r.rolcanlogin,'super',r.rolsuper,'inherit',r.rolinherit,'bypassrls',r.rolbypassrls,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'member',member::regrole::text,'grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members where roleid=r.oid or member=r.oid or grantor=r.oid),'dependencies',(select coalesce(jsonb_agg(jsonb_build_object('dbid',dbid,'classid',classid::regclass::text,'objid',objid,'objsubid',objsubid,'deptype',deptype)order by dbid,classid,objid,objsubid),'[]')from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=r.oid),'clients',(select count(*)from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid()))from pg_roles r where r.rolname=${quote(name)}`;
}
export function targetRolesSql(helpers) {
 return `select jsonb_build_object('old',jsonb_build_array(${OLD.map(name => '('+oldRoleQuery(name)+')').join(',')}),'trace',((${scalar(helpers.proof.roleQuery())})->'role'))`;
}
function contextSql(context) {
 assert.equal(context.current_user, 'postgres'); assert.equal(context.session_user, 'supabase_admin');
 return 'set local role postgres;\n'+Object.entries({ search_path:'search_path', timezone:'TimeZone', date_style:'DateStyle', interval_style:'IntervalStyle', extra_float_digits:'extra_float_digits', bytea_output:'bytea_output' }).map(([key, setting]) => {
  assert(typeof context[key] === 'string' && context[key].length < 100 && !context[key].includes('\0'));
  return `do $context93bb$begin perform set_config(${quote(setting)},${quote(context[key])},true);end$context93bb$;`;
 }).join('\n')+'\n';
}
const CONTEXT = "select jsonb_build_object('current_user',current_user,'session_user',session_user,'search_path',current_setting('search_path'),'timezone',current_setting('TimeZone'),'date_style',current_setting('DateStyle'),'interval_style',current_setting('IntervalStyle'),'extra_float_digits',current_setting('extra_float_digits'),'bytea_output',current_setting('bytea_output'))";
const NORMALIZED = "set local role supabase_admin;set local search_path='';set local timezone='UTC';\n";
function identitySql(instance) {
 assert(/^[a-f0-9-]{36}$/u.test(instance));
 return `do $identity93bb$begin if current_database()<>'postgres'or current_user<>'supabase_admin'or session_user<>'supabase_admin'or not(select rolsuper from pg_roles where rolname=current_user)or(select system_identifier::text from pg_control_system())<>'${SYSTEM}'or not exists(select 1 from eps_local_guard.instance where id=1 and workspace_key=${quote(WORKSPACE_KEY)}and instance_id=${quote(instance)}::uuid)or exists(select 1 from pg_database where datname in(${DBS.map(quote).join(',')}))or exists(select 1 from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid())or(select count(*)from supabase_migrations.schema_migrations)<>29 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030111549'then raise exception'CLEANUP93BB_IDENTITY_REQUIRED';end if;end$identity93bb$;\n`;
}
export function validateRoles(data, roles) {
 const { helpers, before } = data; assert.deepEqual(Object.keys(roles).sort(), ['old','trace']);
 assert.equal(roles.old.length, 2); assert(before.existing_global_roles_before.roles.every(role => !ROLES.includes(role.name)));
 helpers.proof.admitTraceRole(roles.trace, RUN, '316935'); assert.deepEqual(roles.trace, data.observation.role); assert.deepEqual(roles.trace.dependencies, []);
 return roles.old.map((row, index) => {
  const name = OLD[index], marker = `eps-m07-recovery33:${RUN}:${index === 0 ? 'issuer' : 'consent'}`;
  const memberships = ['supabase_admin', 'postgres'].map(grantor => ({ role: name, member: 'postgres', grantor,
   ...Object.fromEntries(['admin','inherit','set'].map(field => [field, data.source33[`memberships|${name}>postgres/${grantor}|${field}`]])) }));
  assert.deepEqual(row.memberships, memberships); assert.equal(row.marker, marker); helpers.identity.normalizeDatabaseOid(row.oid);
  const expected = { name, marker, attempted: true, oid: row.oid, memberships };
  helpers.runtime.roleCleanupSql33(expected, row); return expected;
 });
}
export function withoutOwned(global, roles, normalize) {
 const ids = new Set([...roles.old, roles.trace].map(role => String(normalize(role.oid))));
 return { roles: global.roles.filter(role => !ROLES.includes(role.name)), memberships: global.memberships.filter(row => !['role_oid','member_oid','grantor_oid'].some(key => ids.has(String(normalize(row[key]))))) };
}
export function withoutCatalogue(value) { return Object.fromEntries(Object.entries(value).filter(([key]) => { const [category, name] = key.split('|'); return category === 'roles' ? !ROLES.includes(name) : category === 'memberships' ? !name.split(/[>/]/u).some(token => ROLES.includes(token)) : true; })); }
export function validateSnapshot(data, snapshot) {
 validateRoles(data, snapshot.roles);
 assert.equal(sha(JSON.stringify(snapshot.baseline)), data.before.original_baseline_sha256);
 assert.deepEqual(withoutOwned(snapshot.global, snapshot.roles, data.helpers.identity.normalizeDatabaseOid), data.before.existing_global_roles_before);
 assert.deepEqual(withoutCatalogue(snapshot.catalogue), data.original);
 assert.equal(snapshot.context.current_user, 'postgres'); assert.equal(snapshot.context.session_user, 'supabase_admin');
 return snapshot;
}
function baselineGuard(constants, snapshot) {
 const raw = strip(constants.baselineSql), at = raw.lastIndexOf('select jsonb_build_object('); assert(at > 0);
 return contextSql(snapshot.context)+raw.slice(0, at)+'\n'+guard(raw.slice(at), snapshot.baseline, 'BASELINE_CHANGED')+NORMALIZED;
}
function unwrap(sql) { assert(sql.startsWith('begin;') && sql.endsWith('commit;')); return sql.slice(6, -7); }
export function buildSql(data, snapshot, instance, marker, after = false) {
 const h = data.helpers, constants = h.compiler.staticControllerSql33(data.controller.toString());
 const roles = snapshot.roles, expected = validateRoles(data, roles);
 const global = strip(constants.rolesSql), catalogue = scalar(data.catalogue);
 const names = ROLES.map(quote).join(','), ids = [...roles.old, roles.trace].map(row => quote(String(h.identity.normalizeDatabaseOid(row.oid)))).join(',');
 const projectedGlobal = `select jsonb_build_object('roles',(select coalesce(jsonb_agg(item order by item->>'name'),'[]')from jsonb_array_elements(snapshot->'roles')e(item)where item->>'name'not in(${names})),'memberships',(select coalesce(jsonb_agg(item order by(item->>'role_oid')::oid,(item->>'member_oid')::oid,(item->>'grantor_oid')::oid),'[]')from jsonb_array_elements(snapshot->'memberships')e(item)where not(item->>'role_oid'in(${ids})or item->>'member_oid'in(${ids})or item->>'grantor_oid'in(${ids}))))from(${scalar(global)})g(snapshot)`;
 const projectedCatalogue = `select coalesce(jsonb_object_agg(key,value),'{}')from jsonb_each((${catalogue}))where not(split_part(key,'|',1)='roles'and split_part(key,'|',2)in(${names}))and not(split_part(key,'|',1)='memberships'and regexp_split_to_array(split_part(key,'|',2),'[>/]')&&array[${names}])`;
 const preserved = baselineGuard(constants, snapshot)+identitySql(instance)+guard(global, data.before.existing_global_roles_before, 'GLOBAL_AFTER')+guard(catalogue, data.original, 'CATALOGUE_AFTER')+guard(targetRolesSql(h), { old:[null,null], trace:null }, 'ROLES_ABSENT');
 let sql = `${after ? 'begin read only;' : 'begin;'}set local standard_conforming_strings=on;set local lock_timeout='5s';set local statement_timeout='45s';${NORMALIZED}${identitySql(instance)}`;
 if (!after) {
  sql += 'lock table pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_shdepend in share row exclusive mode;lock table pg_catalog.pg_database in share mode;\n'
   +guard(targetRolesSql(h), roles, 'EXACT_ROLES_CHANGED')+guard(projectedGlobal, data.before.existing_global_roles_before, 'GLOBAL_BEFORE')+guard(projectedCatalogue, data.original, 'CATALOGUE_BEFORE')+baselineGuard(constants, snapshot)
   +unwrap(h.proof.cleanupRoleSql(roles.trace, RUN, DBS))
   +unwrap(h.runtime.roleCleanupSql33(expected[1], roles.old[1]))+unwrap(h.runtime.roleCleanupSql33(expected[0], roles.old[0]));
 }
 sql += preserved;
 assert.equal(typeof marker, 'string'); assert.equal(marker, marker.toLowerCase()); assert(/^[a-f0-9-]{36}$/u.test(marker));
 sql += `${after ? 'rollback;' : 'commit;'}select jsonb_build_object('run_id',${quote(RUN)},'marker',${quote(marker)},'preserved',true,'roles_absent',true,'phase',${quote(after ? 'readback' : 'cleanup')});\n`;
 assert(Buffer.byteLength(sql) < 8*1024*1024); assert(!/^(?:drop database|drop owned|reassign|revoke)\b/imu.test(sql));
 assert.equal((sql.match(/\bdrop role /gu) ?? []).length, after ? 0 : 3); return sql;
}
function rows(raw) { return raw.toString().split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line)); }
async function database(sql, target) {
 const docker = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'; assert.equal(sha(await readFile(docker)), 'e768033e4b3f0dc760162f417a80360094644d16cd9fb12ad65c9d97508c076f');
 return rows(await bounded(docker, ['--host','npipe:////./pipe/dockerDesktopLinuxEngine','exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'], sql));
}
async function snapshot(data, target) {
 const c = data.helpers.compiler.staticControllerSql33(data.controller.toString());
 const base = c.baselineSql.replace('begin read only;','begin read only;set local role postgres;').replace(/rollback;\s*$/u, CONTEXT+';rollback;');
 const sql = base+c.rolesSql+`begin read only;${NORMALIZED}${identitySql(target.owned.instance_id)}${data.catalogue}${targetRolesSql(data.helpers)};rollback;`;
 const observed = await database(sql, target); assert.equal(observed.length, 5);
 return validateSnapshot(data, { baseline:observed[0],context:observed[1],global:observed[2],catalogue:observed[3].catalog,roles:observed[4] });
}
export async function run(ports) {
 assert(APPLY_ENABLED, 'CLEANUP93BB_DISABLED');
 const p = ports ?? { inputs, retainedLock, database, snapshot, verify:async data => data.helpers.local.verifyLocalTarget(), verifySources:async pins => {for(const[file,pin]of Object.entries(pins))await bytes(file,pin);}, write:async(file,value) => writeFile(path.join(ROOT,file), JSON.stringify(value)+'\n', {flag:'wx',mode:0o600}), remove:async() => unlink(path.join(ROOT,LOCK)) };
 const data = await p.inputs(), lock = await p.retainedLock(), target = await p.verify(data);
 assert.equal(target.observed.system_identifier, SYSTEM); const observed = await p.snapshot(data, target); await p.retainedLock();
 return await executeWithPorts(p,data,lock,target,observed);
}
/** Port-only protocol seam. No filesystem, process or SQL fallback; the fixed
 * executable enters here only after run's disabled gate and exact preflight. */
export async function executeWithPorts(p,data,lock,target,observed) {
 for(const name of ['retainedLock','verify','verifySources','write','database','remove'])assert.equal(typeof p[name],'function');
 const marker = randomUUID(), sql = buildSql(data, observed, target.owned.instance_id, marker), post = buildSql(data, observed, target.owned.instance_id, marker, true);
 const pins = {...PINS,...data.sourcePins};
 await p.write(CLAIM, {run_id:RUN,marker,sql_sha256:sha(sql),post_sql_sha256:sha(post),source_commit:COMMIT,source_pins:pins,
  preflight:{roles:observed.roles,baseline:observed.baseline,context:observed.context},dispatch_may_have_occurred:true,automatic_retry:false});
 let normal = false, checked = false, released = false;
 try {
  const verify = async() => { const current = await p.verify(data); assert.equal(current.observed.system_identifier,SYSTEM); assert.equal(current.container.Id,target.container.Id); assert.equal(current.owned.instance_id,target.owned.instance_id); await p.retainedLock(); await p.verifySources(pins); };
  await verify(); assert.deepEqual(await p.database(sql,target), [{run_id:RUN,marker,preserved:true,roles_absent:true,phase:'cleanup'}]); normal = true;
  await p.write(RETURNED, {run_id:RUN,marker,normal_return_observed:true,sql_sha256:sha(sql)});
  for (let i=0;i<2;i++) { await verify(); assert.deepEqual(await p.database(post,target), [{run_id:RUN,marker,preserved:true,roles_absent:true,phase:'readback'}]); }
  checked = true; assert((await p.retainedLock()).equals(lock)); await p.remove(); released = true;
 } catch { /* Reconcile unknown SQL read-only; never replay this permanent claim. */ }
 return {schema_version:'1.0',observed_at:new Date().toISOString(),run_id:RUN,result:normal&&checked&&released?'passed_cleanup_reconciliation':'unconfirmed',source_commit:COMMIT,source_pins:pins,normal_return_observed:normal,two_independent_postchecks:checked,lock_released:released,sql_sha256:sha(sql),post_sql_sha256:sha(post),cloud_called:false,provider_called:false,failed_proof_acceptance_unchanged:true};
}
async function readback() {
 assert(APPLY_ENABLED);
 const data=await inputs(), claim=JSON.parse(await bytes(CLAIM)); await retainedLock();
 const pins={...PINS,...data.sourcePins}; assert.equal(claim.run_id,RUN);assert.equal(claim.source_commit,COMMIT);assert.deepEqual(claim.source_pins,pins);
 assert.equal(claim.dispatch_may_have_occurred,true);assert.equal(claim.automatic_retry,false);
 const target=await data.helpers.local.verifyLocalTarget();assert.equal(target.observed.system_identifier,SYSTEM);
 const post=buildSql(data,claim.preflight,target.owned.instance_id,claim.marker,true);assert.equal(sha(post),claim.post_sql_sha256);
 for(let i=0;i<2;i++){
  await retainedLock();const current=await data.helpers.local.verifyLocalTarget();assert.equal(current.container.Id,target.container.Id);
  assert.equal(current.observed.system_identifier,SYSTEM);assert.equal(current.owned.instance_id,target.owned.instance_id);
  assert.deepEqual(await database(post,target),[{run_id:RUN,marker:claim.marker,preserved:true,roles_absent:true,phase:'readback'}]);
 }
 return {schema_version:'1.0',observed_at:new Date().toISOString(),run_id:RUN,result:'observed_cleaned_no_normal_return_inferred',two_independent_postchecks:true,lock_released:false,claim_retained:true,automatic_retry:false,source_pins:pins,cloud_called:false,provider_called:false,failed_proof_acceptance_unchanged:true};
}
async function main() {
 assert(APPLY_ENABLED && process.argv.length === 3 && ['apply','readback'].includes(process.argv[2]) && !process.env.NODE_OPTIONS);
 const result = process.argv[2]==='apply'?await run():await readback(), directory = path.join(ROOT,'tracking/evidence/m07/worker38-concurrency-cleanup93bb'); await mkdir(directory,{recursive:true});
 const file = path.join(directory,result.observed_at.replaceAll(':','-')+'-cleanup.json'); await writeFile(file,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({result:result.result,receipt:path.relative(ROOT,file)})+'\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { process.stderr.write('CLEANUP93BB_UNCONFIRMED_RETAIN_CLAIM_AND_LOCK\n');process.exitCode=1; });
