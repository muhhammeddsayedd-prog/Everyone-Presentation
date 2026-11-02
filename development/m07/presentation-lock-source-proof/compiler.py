"""Fresh disabled PG17 purpose compiled from the reviewed bootstrap, not replayed."""
from pathlib import Path
import hashlib,importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BASE='development/m07/project-creation39-proof/concurrency.mjs'
BASE_SHA='fe4f6e7cddb749690fea9587dd675a67d6db723ca458a700a8f6b53e67072fdd'
SQL40='supabase/migrations/20261102085405_m07_review_link_action_reason.sql'
SQL40_SHA='08bf4de8a63823b0e7c9aee75560a6e7de0620eb9b8b3c483c65929578db8212'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def need(ok):
 if not ok:raise ValueError('LOCKSOURCE41_PROOF_COMPILATION_UNCONFIRMED')
def load(path):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and 0<path.stat().st_size<=16*1024**2);return path.read_bytes()
def candidate():
 p=HERE.parent/'presentation-lock-source-optimization/candidate.py';spec=importlib.util.spec_from_file_location('locksource41_candidate_pure',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m.build(),m
def compile_source(relative):
 need(sha(load(MAIN/BASE))==BASE_SHA and sha(load(MAIN/SQL40))==SQL40_SHA)
 source=load(MAIN/BASE).decode().replace('\r\n','\n');(before,after),c=candidate()
 def replace(old,new):
  nonlocal source
  need(source.count(old)==1);source=source.replace(old,new)
 replace("import { functionalChange } from './run.mjs';","import { functionalChange } from "+json.dumps((MAIN/'development/m07/project-creation39-proof/run.mjs').as_uri())+";\nimport * as lockProof from "+json.dumps((HERE/'proof.mjs').as_uri())+';')
 replace("const ROOT = path.resolve(import.meta.dirname, '../../..');",'const ROOT = '+json.dumps(str(ROOT).replace('\\','/'))+';')
 replace("const ACTOR = 'a4390000-0000-4000-8000-000000000001';","const ACTOR = 'a4410000-0000-4000-8000-000000000001';")
 paths=[HERE/'compiler.py',HERE/'proof.mjs',HERE/'session.mjs',HERE/'probes.mjs',HERE/'fixture.sql',HERE/'scale.sql',HERE/'background.sql',HERE/'cohorts.sql',HERE/'temporary.sql',HERE/'counts.sql',HERE/'test_proof.py',HERE/'test_cohorts.py',HERE/'README.md',HERE.parent/'presentation-lock-source-optimization/candidate.py',MAIN/SQL40]
 checks=''.join('\n  assert.equal(sha(await readFile('+json.dumps(str(p).replace('\\','/'))+')),'+json.dumps(sha(load(p)))+');'for p in paths)
 replace('export async function runRace(sourceRoot) {',"export async function runRace(sourceRoot) {\n  assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_EXECUTION_DISABLED');"+checks)
 for old,new in[("'.local/project-creation39-race'","'.local/presentation-lock-source-proof'"),("'eps.project39.run'","'eps.locksource41.run'"),("'eps.project39.workspace'","'eps.locksource41.workspace'"),("'eps.project39.purpose'","'eps.locksource41.purpose'"),("'independent-race39'","'locksource41-performance-equality'"),("'eps-c39-'","'eps-locksrc41-'"),("'project-creation39-independent-race'","'presentation-lock-source41-owned-proof'"),("'tracking/evidence/m07/project-creation39-race'","'tracking/evidence/m07/presentation-lock-source-proof'")]:replace(old,new)
 replace('independent owned local PG17 cluster, restored synthetic38 plus exact39 functional DDL; independent-session advisory-lock/idempotency race; no cloud/provider/hosted acceptance','fresh owned network-none PG17 synthetic38-to39-to40 old/new lock-source performance, RLS equality, actual generation rollback and races; no canonical, provider, OAuth protocol, native or UI acceptance')
 begin=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',begin)
 records=[[str(ROOT).replace('\\','/'),relative],[str(MAIN).replace('\\','/'),BASE],[str(MAIN).replace('\\','/'),'development/m07/project-creation39-proof/run.mjs'],[str(MAIN).replace('\\','/'),'development/m07/independent-recovery38/guards.mjs']]
 records.extend([[str(ROOT if p.is_relative_to(ROOT)else MAIN).replace('\\','/'),str(p.relative_to(ROOT if p.is_relative_to(ROOT)else MAIN)).replace('\\','/')]for p in paths])
 source=source[:begin]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 old="await sql('begin;set local row_security=on;set local role postgres;' + functional + 'reset role;' + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);"
 new="await sql(\"begin;set local row_security=on;set local role postgres;grant usage on schema public to public;\" + functional + \"reset role;insert into supabase_migrations.schema_migrations(version,statements,name)values('20261101223342',array[]::text[],'locksource41_owned_functional39');\" + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);"
 replace(old,new)
 start=source.index("    report.checkpoint = 'same-key-independent-session-race';");stop=source.index('    await sql(`do $preserve$',start)
 args={'baseSource':before,'candidateSource':after,'baseSha':c.ACTUAL_SOURCE_SHA,'candidateSha':sha(c.body(after).encode()),'migration40':str(MAIN/SQL40).replace('\\','/'),'migration40Sha':SQL40_SHA}
 source=source[:start]+"    report.checkpoint='locksource41-fixture-and-old-new-proof';\n    await lockProof.runCases({root:ROOT,runId,system:identity.system_identifier,inspect:()=>inspect(db),psqlArgs:()=>psqlArgs(),sql,report,sessions,bindings:"+json.dumps(args)+"});\n"+source[stop:]
 old="'select count(*)from(select row_hash from project39_proof.original_rows where table_name=%L except select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %s t)s',r.table_name,r.table_name"
 new="'select count(*)from(select row_hash from project39_proof.original_rows where table_name=%L except select encode(sha256(convert_to(%s::text,''UTF8'')),''hex'')from %s t)s',r.table_name,case when r.table_name='eps.audit_events'then'(to_jsonb(t)-''reason'')'else'to_jsonb(t)'end,r.table_name"
 replace(old,new);replace('report.all_preexisting_rows_preserved = true;','report.all_preexisting_old_column_rows_preserved = true;')
 replace('report.all_owned_resources_absent = resources.length === 2;',"report.all_owned_resources_absent = resources.length === 2;assert.equal((await docker(['container','ls','-aq','--filter','label=eps.locksource41.run='+runId])).stdout.trim(),'');assert.equal((await docker(['volume','ls','-q','--filter','label=eps.locksource41.run='+runId])).stdout.trim(),'');report.independent_successful_daemon_label_inventories_empty=true;")
 return source
if __name__=='__main__':
 relative='.local/presentation-lock-source-proof-compiled/controller-'+str(uuid.uuid4())+'.mjs';text=compile_source(relative);p=ROOT/relative;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('x',encoding='utf8',newline='\n')as f:f.write(text)
 print(json.dumps({'controller':str(p),'sha256':sha(text.encode()),'SQL_or_Docker_executed':False}))
