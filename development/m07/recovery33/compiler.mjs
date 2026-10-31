/** Source-pinned compiler only. No process, database, provider or filesystem IO. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ownedPredicate33 } from './ownership.mjs';

export const FROZEN29 = 'development/m07/recovery29/run.mjs';
export const SOURCE_PINS = Object.freeze({
  [FROZEN29]: 'd5602e34077b8cce5ad5c100893b6d7b4be984305f9705ce75fed3e90c7fbffd',
  'development/m07/db/catalog29.sql': '1af59495b01424e6ec2578f6ea1f8ac362829577612c32b2cd373545a58b9098',
  'development/m07/db/data29.sql': '931581121cf2548af7b244b5638d243176bed9a4a83241bd4f72998ddec90a81',
  'supabase/migrations/20261030154824_m07_native_oauth_issuer.sql': 'e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785',
  'supabase/migrations/20261031010000_m07_specs_submit_ack_projection.sql': 'c1c4cb41460df067d726e4058cc24eacbcf55e5cc73e6a18365394e2c2fbc5e5',
  'supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql': '0d7b7a7577ffe1ff4b24eba202ce6ac7e87c616ca8039397800e607c651908a5',
  'supabase/migrations/20261031130207_m07_oauth_consent_browser_context.sql': '9923e7a1cb52e160041aacea053a21cb9c25c1fc468db99eb7b7ea77e15dcb81',
  'development/m07/recovery33/schema-migrations-acl-observation.json': 'ae00c7258469b913bc82be4f06a4aebb6c0467f26841423a97ee28b9512adf4a',
  'development/m07/recovery33/schema-migrations-acl-semantics.sql': 'bc0d070580205a2cb2992836808880822a01d6f8397413c09a79ee8f34e22901',
  'tracking/evidence/m07/recovery33/2026-10-31-auth-schema-migrations-acl-semantic-proof.json': 'aeaff1879563b96acadf05ef8f885b8602bf5d225209e95c0721506bcca8a813',
  'development/m07/recovery33/retained533-acl-observation.json': '6d5a0284b0c956b6dbae80906a6b4b7ea3482733fa135fd16b1eb5fe4b3b1654',
  'development/m07/recovery33/retained533-acl-semantics.sql': '86b46544bb451cf483dd0ef21b00826cf61a75bd91a8990e3add685d0cb3d4f6',
  'tracking/evidence/m07/recovery33/2026-10-31-retained533-acl-native-semantics.json': '4e672a10f28d4c653a9714745f75c16e8b5aba1edcddf9fbe480d7e0170dffe5',
});
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function checkedSource(sources, file) {
  const bytes = sources.get(file); assert(bytes instanceof Uint8Array, 'RECOVERY33_SOURCE_REQUIRED');
  if (Object.hasOwn(SOURCE_PINS, file)) assert.equal(sha(bytes), SOURCE_PINS[file], 'RECOVERY33_FROZEN_SOURCE_CHANGED');
  return Buffer.from(bytes).toString('utf8');
}
function substitute(source, old, replacement, label, changes, count = 1) {
  assert.equal(source.split(old).length - 1, count, `RECOVERY33_SUBSTITUTION_COUNT:${label}`);
  changes.push({ label, expected_count: count, removed_sha256: sha(old), inserted_sha256: sha(replacement) });
  return source.split(old).join(replacement);
}
export function migration33Adapters(sources, identity) {
  const changes = [], result = [], target = ownedPredicate33(identity);
  for (const [index, file] of Object.keys(SOURCE_PINS).filter(file => file.startsWith('supabase/')).entries()) {
    const original = checkedSource(sources, file); let sql;
    const anchor = index === 0 ? '\ncreate role eps_mcp_issuer_owner' : index === 1 ? '\ncreate or replace function eps.specs_submit_ack('
      : index === 2 ? '\ncreate role eps_oauth_consent_owner' : '\ncreate function eps.oauth_consent_browser_context()';
    assert.equal(original.split(anchor).length, 2);
    const functional = original.slice(original.indexOf(anchor));
    if (index === 0) {
      const old = original.slice(0, original.indexOf(anchor));
      sql = substitute(original, old, `-- Explicit owned-local33 admission; canonical cloud metadata prefix is not executed.\nDO $recovery33$ BEGIN IF current_user<>'postgres' OR ${target} THEN RAISE EXCEPTION 'RECOVERY33_OWNED_TARGET_REQUIRED'; END IF; END $recovery33$;\n`, file, changes);
    } else if (index === 1) sql = substitute(original, "current_database()<>'postgres'", `(${target})`, file, changes);
    else {
      const start = original.indexOf("(current_database()<>'postgres'and not(");
      const end = original.indexOf('\n  or(select', start);
      assert(start > 0 && end > start);
      sql = substitute(original, original.slice(start, end), `(${target})`, file, changes);
    }
    assert.equal(sql.slice(sql.indexOf(anchor)), functional, 'RECOVERY33_FUNCTIONAL_SQL_CHANGED');
    result.push({ file, version: path.basename(file).slice(0, 14), sql, source_sha256: sha(original),
      functional_sha256: sha(functional), adapted_sha256: sha(sql), only_local_admission_changed: true });
  }
  return { migrations: result, substitutions: changes };
}

export function fullCatalogue33Sql(sources) {
  let sql = checkedSource(sources, 'development/m07/db/catalog29.sql'); const substitutions = [];
  sql = substitute(sql, "n.nspname in('eps','public')or n.nspname='storage'and p.proname in('operation','allow_only_operation','allow_any_operation')", "n.nspname in('eps','public','auth','storage')", 'all-restored-functions', substitutions);
  const scoped = "n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets')or n.nspname='auth'and c.relname='sessions'";
  for (const category of ['tables', 'columns', 'constraints', 'triggers']) {
    const at = sql.indexOf(` '${category}',`), nextMatch = /\n '[a-z_]+',/u.exec(sql.slice(at + 1));
    const next = nextMatch ? at + 1 + nextMatch.index : -1;
    assert(at > 0 && next > at);
    const section = sql.slice(at, next); assert.equal(section.split(scoped).length, 2);
    sql = substitute(sql, section, section.replace(scoped, "n.nspname in('eps','public','auth','storage')"), `all-restored-${category}`, substitutions);
  }
  sql = substitute(sql, "schemaname in('eps','public','storage')or schemaname='auth'and tablename='sessions'", "schemaname in('eps','public','auth','storage')", 'all-restored-policies', substitutions);
  sql = substitute(sql, "n.nspname in('eps','public')or n.nspname='storage'and t.relname in('objects','buckets')", "n.nspname in('eps','public','auth','storage')", 'all-restored-indexes', substitutions);
  sql = substitute(sql, "n.nspname in('eps','public')and t.typelem=0", "n.nspname in('eps','public','auth','storage')and t.typelem=0", 'all-restored-types', substitutions);
  return { sql, substitutions, source_sha256: sha(checkedSource(sources, 'development/m07/db/catalog29.sql')), adapted_sha256: sha(sql) };
}

export function compileController33(sources, { root, runId, mode = 'metadata' }) {
  for (const file of Object.keys(SOURCE_PINS)) checkedSource(sources, file);
  assert(['metadata', 'full'].includes(mode));
  assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));
  assert(path.isAbsolute(root));
  let source = checkedSource(sources, FROZEN29); const substitutions = [];
  const change = (old, replacement, label) => { source = substitute(source, old, replacement, label, substitutions); };
  const url = file => pathToFileURL(path.join(root, file)).href;
  for (const line of source.split('\n').filter(line => /^import .*from '\.\.?\//u.test(line))) {
    const relative = /from '([^']+)'/u.exec(line)[1];
    const file = path.resolve(root, 'development/m07/recovery29', relative);
    const replacementFile = relative === './profile8.mjs' ? path.join(root, 'development/m07/recovery33/retained533-profile.mjs')
      : relative === './ownership.mjs' ? path.join(root, 'development/m07/recovery33/ownership.mjs') : file;
    const replacement = line.replace(relative, pathToFileURL(replacementFile).href)
      .replace('exactRestoreProfile8Sql as exactRestoreProfileSql', 'exactRestoreProfile33Sql as exactRestoreProfileSql');
    change(line, replacement, `absolute-import:${relative}`);
  }
  change("const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');", `const ROOT = ${JSON.stringify(root)};\nimport { createRecovery33Context } from '${url('development/m07/recovery33/runtime.mjs')}';\nlet recovery33; let expectedSourceCatalogue;\nasync function restoreOwnedDump(database,body){const identity=await databaseIdentity(database);return docker(psqlArgs(database),{input:ownedRestoreSql33(body,{database,marker:marker(database),oid:identity.oid})});}`, 'fixed-workspace-and-runtime');
  change("const runId = randomUUID(), suffix = runId.replaceAll('-', '');", `const runId = '${runId}', suffix = runId.replaceAll('-', '');`, 'fixed-new-run-id');
  change('const sourceDb = `eps_m07_r29_source_${suffix}`, restoreDb = `eps_m07_r29_restore_${suffix}`;', 'const sourceDb = `eps_m07_r33_source_${suffix}`, restoreDb = `eps_m07_r33_restore_${suffix}`;', 'new-database-identities');
  change("const marker = database => `eps-m07-recovery29:${runId}:${database === sourceDb ? 'source' : 'restore'}`;", "const marker = database => `eps-m07-recovery33:${runId}:${database === sourceDb ? 'source' : 'restore'}`;", 'new-ownership-marker');
  change("assert(/^eps_m07_r29_(?:source|restore)_[a-f0-9]{32}$/u.test(database));", "assert(/^eps_m07_r33_(?:source|restore)_[a-f0-9]{32}$/u.test(database));", 'new-create-guard');
  change("async function sql(database, body, role = 'postgres', principal, allowFailure = false) {\n  await databaseIdentity(database);", "async function sql(database, body, role = 'postgres', principal, allowFailure = false) {\n  const identity = await databaseIdentity(database);", 'transaction-oid-from-verified-identity');
  const guardLine = source.split('\n').find(line => line.startsWith('  const guard = '));
  assert(guardLine);
  change(guardLine, "  const guard = `do $guard$begin if ${ownedPredicate33({database,marker:marker(database),oid:identity.oid})} then raise exception'OWNED_M07_DATABASE_REQUIRED';end if;end$guard$;`;", 'transaction-name-marker-oid-guard');
  change("import { createRecovery33Context } from", "import { ownedPredicate33, ownedRestoreSql33 } from '" + url('development/m07/recovery33/ownership.mjs') + "';\nimport { createRecovery33Context } from", 'ownership-predicate-import');
  change("async function catalogue(database) { return value(database, await readFile('development/m07/db/catalog29.sql','utf8')); }", "async function catalogue(database) { return value(database, recovery33?.active ? recovery33.catalogueSql : await readFile('development/m07/db/catalog29.sql','utf8')); }", 'catalogue33-after-upgrade');
  change('const planned=exactRestoreProfileSql(expected,before,{database,marker:marker(database),oid:identity.oid});',
    'const planned=exactRestoreProfileSql(expected,before,{database,marker:marker(database),oid:identity.oid},recovery33?.profileEvidence());', 'captured-owned-role-and-native-acl-profile-evidence');
  change('report.disposable_databases_removed=true;', 'report.disposable_databases_removed=true; if(recovery33) await recovery33.cleanupRoles();', 'new-role-cleanup-after-databases');
  change("scope: 'AT-070 history29 synthetic isolated local PostgreSQL + local filesystem object restore; exact known baseline profile preserved'", `scope: 'AT-070 full owned29->33 ${mode} synthetic local restore; original29 and existing global roles preserved'`, 'truthful-new-scope');
  const roleLine = source.split('\n').find(line => line.startsWith('const rolesSql = ')); assert(roleLine);
  const allRoles = roleLine.replace("from pg_roles where rolname like'eps_%'or rolname in('postgres','anon','authenticated','service_role','supabase_admin','supabase_auth_admin','pg_database_owner'))", 'from pg_roles)')
    .replace("from pg_auth_members where roleid::regrole::text like'eps_%'or member::regrole::text like'eps_%'))", 'from pg_auth_members))')
    .replace("'create_role',rolcreaterole", "'replication',rolreplication,'create_role',rolcreaterole");
  assert.notEqual(allRoles, roleLine); assert(!allRoles.includes("rolname like'eps_%'")); assert(!allRoles.includes("member::regrole::text like'eps_%'"));
  change(roleLine, allRoles, 'all-global-role-identities-and-memberships');
  change("const sourceFiles = new Map(await Promise.all([...new Set(sourcePaths)]", "sourcePaths.push(..." + JSON.stringify([...sources.keys()].filter(file => file.startsWith('development/m07/recovery33/') || Object.hasOwn(SOURCE_PINS, file))) + ");\n  const sourceFiles = new Map(await Promise.all([...new Set(sourcePaths)]", 'new-controller-sources-in-backup');
  const afterClone = 'report.source_clone_profile=await preserveOriginalDumpProfile(sourceDb,originalCatalogue);';
  change(afterClone, afterClone + `\n  recovery33 = createRecovery33Context({root:ROOT,runId,sourceDb,restoreDb,privateRoot,report,sql,value,rows,docker,psqlArgs,databaseIdentity,marker,catalogue,dump,createDatabase,restoreOwnedDump,preserveOriginalDumpProfile,sourceFiles,readOriginalCatalogue:async body=>rows((await runOwnedLocalSql("begin read only;set local search_path='';set local timezone='UTC';"+body+'rollback;')).stdout).at(-1)});\n  await recovery33.upgrade(); expectedSourceCatalogue=await catalogue(sourceDb);\n  ${mode === 'metadata' ? 'await recovery33.metadataRestore();' : ''}\n  if (${mode === 'full'}) {`, 'actual30-to33-before-native');
  change('await docker(psqlArgs(sourceDb), { input: initialDump });', 'await restoreOwnedDump(sourceDb,initialDump);', 'same-connection-source-restore-guard');
  change("await docker(psqlArgs(restoreDb), { input: await readFile(path.join(privateRoot, 'restored/metadata.sql')) });", "await restoreOwnedDump(restoreDb,await readFile(path.join(privateRoot, 'restored/metadata.sql')));", 'same-connection-full-restore-guard');
  change("report.result = 'passed'; report.checkpoint = 'complete';", "}\n  report.result = 'passed'; report.checkpoint = 'complete';", 'close-native-mode-block');
  change('assert.deepEqual(sourceCatalogue,originalCatalogue); const objectInventory', 'await recovery33.admitSourceFixtureCatalogue(expectedSourceCatalogue,sourceCatalogue); const objectInventory', 'admit-only-authored-fixture-catalogue-transition');
  change("assert.equal(rows.mcp_registry_count,0);assert.equal(rows.auth_session_count,0);", "assert.equal(rows.mcp_registry_count,1);assert.equal(rows.auth_session_count,1);", 'synthetic-auth-resource-state-counts');
  change('mcp_empty_registry_preserved:true,auth_sessions_empty_preserved:true', 'synthetic_mcp_registry_preserved:true,synthetic_auth_session_preserved:true', 'truthful-auth-boundary-flags');
  change('report.settings_row1_empty_mcp_registry_auth_subset_restored_exactly=true;', 'report.settings_row1_synthetic_mcp_registry_auth_subset_restored_exactly=true; await recovery33.authBoundary(restoreDb);', 'restored33-auth-functional-boundary');
  change('${baseFixture}\\n${versionFixture}', '${baseFixture}\\nset local role postgres;\\n${recovery33.seedSql()}\\n${versionFixture}', 'synthetic-native-auth-data-provenance');
  change('report.before_restore29_boundaries=await settingsBoundary(sourceDb);', 'await recovery33.authBoundary(sourceDb);report.before_restore29_boundaries=await settingsBoundary(sourceDb);', 'source33-auth-functional-boundary');
  change("'auth_sessions',(select jsonb_agg(to_jsonb(t)order by id)from auth.sessions t)", "'auth_sessions',(select jsonb_agg(to_jsonb(t)order by id)from auth.sessions t),'auth_oauth_clients',(select jsonb_agg(to_jsonb(t)order by id)from auth.oauth_clients t),'auth_oauth_authorizations',(select jsonb_agg(to_jsonb(t)order by authorization_id)from auth.oauth_authorizations t),'oauth_consent_claims',(select jsonb_agg(to_jsonb(t)order by authorization_hash)from eps.oauth_consent_claims t)", 'all-synthetic-auth-state-in-snapshot');
  const schemaLine = source.split('\n').find(line => line.startsWith('async function schema(database)'));
  assert(schemaLine); change(schemaLine, schemaLine.replace("n.nspname in('eps','public')and p.prokind='f'", "n.nspname in('eps','public','auth','storage')and p.prokind='f'"), 'all-restored-function-definitions');
  change("'tracking/evidence/m07/recovery29'", "'tracking/evidence/m07/recovery33'", 'new-evidence-directory-prefix');
  return { source, manifest: { schema_version: '1.0', run_id: runId, mode, frozen_source: FROZEN29,
    frozen_source_sha256: SOURCE_PINS[FROZEN29], generated_source_sha256: sha(source), substitutions,
    no_old_source_written: true, local_only: true, database_executed: false } };
}
/** Actual emitted static SQL, without evaluating the generated controller.
 * Dynamic SQL remains covered by the rendered helper/migration inventory. */
export function staticControllerSql33(compiled) {
  const result = Object.create(null);
  for (const match of compiled.matchAll(/^const ([A-Za-z][A-Za-z0-9]*Sql) = `([^`]+)`;/gmu)) {
    assert(!match[2].includes('${'), 'RECOVERY33_STATIC_SQL_INTERPOLATION_FORBIDDEN');
    assert(!Object.hasOwn(result, match[1]));
    result[match[1]] = match[2].replace(/\\(\\|n|r|t)/gu, (_, escaped) => ({ '\\': '\\', n: '\n', r: '\r', t: '\t' })[escaped]);
  }
  assert.deepEqual(Object.keys(result).sort(), ['baselineSql', 'rolesSql']);
  return result;
}
