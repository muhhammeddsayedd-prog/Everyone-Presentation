"""Fresh disabled owned-PG17 purpose; finite pinned bootstrap adaptation only."""
from pathlib import Path
import hashlib,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BASE='development/m07/project-creation39-proof/concurrency.mjs';BASE_SHA='fe4f6e7cddb749690fea9587dd675a67d6db723ca458a700a8f6b53e67072fdd'
MIGRATION='supabase/migrations/20261102085405_m07_review_link_action_reason.sql'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def need(value):
 if not value:raise ValueError('REASON40_OWNED_PROOF_COMPILATION_UNCONFIRMED')
def load(path):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<16*1024**2);return path.read_bytes()
def compile_source(relative):
 raw=load(MAIN/BASE);need(sha(raw)==BASE_SHA);source=raw.decode().replace('\r\n','\n')
 def replace(old,new):
  nonlocal source
  need(source.count(old)==1);source=source.replace(old,new)
 replace("import { functionalChange } from './run.mjs';","import { functionalChange } from "+json.dumps((MAIN/'development/m07/project-creation39-proof/run.mjs').as_uri())+";\nimport * as reason40 from "+json.dumps((HERE/'proof.mjs').as_uri())+';')
 replace("const ROOT = path.resolve(import.meta.dirname, '../../..');",'const ROOT = '+json.dumps(str(ROOT).replace('\\','/'))+';')
 replace("const ACTOR = 'a4390000-0000-4000-8000-000000000001';","const ACTOR = 'a4400000-0000-4000-8000-000000000001';")
 replace('export async function runRace(sourceRoot) {',"export async function runRace(sourceRoot) {\n  assert(reason40.EXECUTION_ENABLED,'REASON40_EXECUTION_DISABLED');\n  assert.equal(sha(await readFile("+json.dumps(str(HERE/'proof.mjs').replace('\\','/'))+")),"+json.dumps(sha(load(HERE/'proof.mjs')))+");\n  assert.equal(sha(await readFile("+json.dumps(str(ROOT/MIGRATION).replace('\\','/'))+")),"+json.dumps(sha(load(ROOT/MIGRATION)))+');')
 for old,new in[("'.local/project-creation39-race'","'.local/review-link-reason40-proof'"),("'eps.project39.run'","'eps.reason40.run'"),("'eps.project39.workspace'","'eps.reason40.workspace'"),("'eps.project39.purpose'","'eps.reason40.purpose'"),("'independent-race39'","'reason40-compatibility-proof'"),("'eps-c39-'","'eps-reason40-'"),("'project-creation39-independent-race'","'review-link-reason40-owned-proof'"),("'tracking/evidence/m07/project-creation39-race'","'tracking/evidence/m07/review-link-reason40-proof'")]:replace(old,new)
 replace('independent owned local PG17 cluster, restored synthetic38 plus exact39 functional DDL; independent-session advisory-lock/idempotency race; no cloud/provider/hosted acceptance','independent owned network-none PG17 synthetic39-to40 compatibility, durable reason/trace and actual row-lock replay races; no canonical/provider/native/MCP/UI acceptance')
 begin=source.index('    report.source_seals = {}; for (const [root, file] of ');stop=source.index(' {\n      const bytes = await readFile',begin)
 records=[[str(ROOT).replace('\\','/'),relative],[str(MAIN).replace('\\','/'),BASE],[str(MAIN).replace('\\','/'),'development/m07/project-creation39-proof/run.mjs'],[str(MAIN).replace('\\','/'),'development/m07/independent-recovery38/guards.mjs']]
 records.extend([[str(ROOT).replace('\\','/'),str(path.relative_to(ROOT)).replace('\\','/')]for path in [HERE/'compiler.py',HERE/'build.py',HERE/'proof.mjs',HERE/'fixture.sql',HERE/'before-functions.json',ROOT/MIGRATION]])
 source=source[:begin]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[stop:]
 old="await sql('begin;set local row_security=on;set local role postgres;' + functional + 'reset role;' + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);"
 replace(old,"await sql(\"begin;set local row_security=on;set local role postgres;grant usage on schema public to public;\" + functional + \"reset role;insert into supabase_migrations.schema_migrations(version,statements,name)values('20261101223342',array[]::text[],'reason40_owned_functional39');\" + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);")
 start=source.index("    report.checkpoint = 'same-key-independent-session-race';");end=source.index('    await sql(`do $preserve$',start)
 source=source[:start]+"    report.checkpoint='reason40-owned-red-green-and-concurrency';\n    await reason40.runCases({root:ROOT,runId,system:identity.system_identifier,inspect:()=>inspect(db),psqlArgs:()=>psqlArgs(),sql,report,sessions,migrationSha:"+json.dumps(sha(load(ROOT/MIGRATION)))+",fixtureSha:"+json.dumps(sha(load(HERE/'fixture.sql')))+"});\n"+source[end:]
 # One nullable additive column changes full JSON shape; compare every exact old
 # audit column and independently assert reason NULL for all historical rows.
 old="'select count(*)from(select row_hash from project39_proof.original_rows where table_name=%L except select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %s t)s',r.table_name,r.table_name"
 new="'select count(*)from(select row_hash from project39_proof.original_rows where table_name=%L except select encode(sha256(convert_to(%s::text,''UTF8'')),''hex'')from %s t)s',r.table_name,case when r.table_name='eps.audit_events'then'(to_jsonb(t)-''reason'')'else'to_jsonb(t)'end,r.table_name"
 replace(old,new)
 replace('report.all_preexisting_rows_preserved = true;','report.all_preexisting_old_column_rows_preserved = true;')
 return source
if __name__=='__main__':
 relative='.local/review-link-reason40-source/controller-'+str(uuid.uuid4())+'.mjs';source=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True)
 with file.open('x',encoding='utf-8',newline='\n')as stream:stream.write(source)
 print(json.dumps({'controller':str(file),'sha256':sha(source.encode()),'sql_or_docker_executed':False}))
