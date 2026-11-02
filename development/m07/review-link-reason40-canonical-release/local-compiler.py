"""Finite NEW owned validation compiler; no SQL/Docker/provider calls."""
from pathlib import Path
import importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('reason40_local_compiler_adapter',HERE/'local.py');local=importlib.util.module_from_spec(spec);spec.loader.exec_module(local);s=local.s
BASE='development/m07/project-creation39-proof/concurrency.mjs';BASE_SHA='fe4f6e7cddb749690fea9587dd675a67d6db723ca458a700a8f6b53e67072fdd'
def compile_source(relative):
 raw=s.load(s.MAIN/BASE);s.need(s.sha(raw)==BASE_SHA);source=raw.decode().replace('\r\n','\n');cfg=local.configuration()
 def replace(old,new):
  nonlocal source
  source=s.replace_once(source,old,new)
 replace("import { functionalChange } from './run.mjs';","import { functionalChange } from "+json.dumps((s.MAIN/'development/m07/project-creation39-proof/run.mjs').as_uri())+";\nimport * as collector from "+json.dumps((HERE/'local-cases.mjs').as_uri())+';\nconst cfg='+json.dumps(cfg,sort_keys=True)+';')
 replace("const ROOT = path.resolve(import.meta.dirname, '../../..');",'const ROOT = '+json.dumps(str(ROOT).replace('\\','/'))+';')
 replace('export async function runRace(sourceRoot) {',"export async function runRace(sourceRoot) {\n  assert(collector.EXECUTION_ENABLED,'REASON40_COLLECTOR_EXECUTION_DISABLED');\n  for(const[file,expected]of Object.entries(cfg.source_pins))assert.equal(sha(await readFile(file)),expected);")
 for old,new in[("'.local/project-creation39-race'","'.local/reason40-collector-validation'"),("'eps.project39.run'","'eps.reason40collector.run'"),("'eps.project39.workspace'","'eps.reason40collector.workspace'"),("'eps.project39.purpose'","'eps.reason40collector.purpose'"),("'independent-race39'","'reason40-actual-collector-validation'"),("'eps-c39-'","'eps-r40q-'"),("'project-creation39-independent-race'","'reason40-collector-owned-validation'"),("'tracking/evidence/m07/project-creation39-race'","'tracking/evidence/m07/reason40-collector-validation'")]:replace(old,new)
 replace('independent owned local PG17 cluster, restored synthetic38 plus exact39 functional DDL; independent-session advisory-lock/idempotency race; no cloud/provider/hosted acceptance','new owned PG17 actual SQL40 collector/checkpoint/rendered transaction validation; explicit synthetic identity qualifications; no canonical/provider/MCP/restore acceptance')
 start=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',start)
 records=[[str(ROOT).replace('\\','/'),relative],[str(s.MAIN).replace('\\','/'),BASE],[str(s.MAIN).replace('\\','/'),'development/m07/project-creation39-proof/run.mjs'],[str(s.MAIN).replace('\\','/'),'development/m07/independent-recovery38/guards.mjs']]
 records.extend([[str(ROOT).replace('\\','/'),path.relative_to(ROOT).as_posix()]for path in sorted(HERE.glob('*'))if path.is_file()]);records.extend([[str(ROOT).replace('\\','/'),s.MIGRATION],[str(ROOT).replace('\\','/'),s.PROOF],[str(ROOT).replace('\\','/'),'development/m07/worker39-concurrency/qualification.py']])
 source=source[:start]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 old="await sql('begin;set local row_security=on;set local role postgres;' + functional + 'reset role;' + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);"
 replace(old,"await sql(\"begin;set local row_security=on;set local role postgres;grant usage on schema public to public;\"+functional+\"reset role;insert into supabase_migrations.schema_migrations(version,statements,name)values('20261101223342',array[]::text[],'collector40_owned_functional39');\"+snapshot+'commit;');")
 start=source.index("    report.checkpoint = 'same-key-independent-session-race';");end=source.index('    await sql(`do $preserve$',start)
 body="    report.checkpoint='reason40-collector-exact-fixture-qualification';\n    const qualification=cfg.qualification_sql.replace('__WORKER39_OWNED_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__WORKER39_OWNED_RUN_SQL__',quote(runId));await sql(\"begin;set local eps.worker39.run=\"+quote(runId)+';'+qualification+cfg.config_setup_sql+'commit;');report.synthetic_qualification={rows:cfg.qualification_rows,config_setup_tables:cfg.config_setup_tables,normal_version_trigger_only:true,no_canonical_role_or_protected_data_created:true};\n    report.checkpoint='reason40-actual-collector-checkpoint-transaction';\n    await collector.runCases({root:ROOT,runId,system:identity.system_identifier,inspect:()=>inspect(db),sql,report},cfg);\n"
 source=source[:start]+body+source[end:]
 replace('select distinct table_name from project39_proof.original_rows loop',"select distinct table_name from project39_proof.original_rows where table_name not in("+','.join("'eps."+table+"'"for table in cfg['config_setup_tables'])+")loop")
 replace('where table_name=%L except select encode',"where table_name=%L and not exists(select 1 from project39_proof.qualified_rows q where q.table_name=project39_proof.original_rows.table_name and q.original_row_hash=project39_proof.original_rows.row_hash)except select encode")
 old="'select count(*)from(select row_hash from project39_proof.original_rows where table_name=%L and not exists(select 1 from project39_proof.qualified_rows q where q.table_name=project39_proof.original_rows.table_name and q.original_row_hash=project39_proof.original_rows.row_hash)except select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %s t)s',r.table_name,r.table_name"
 new=old.replace("to_jsonb(t)::text","%s::text").replace("r.table_name,r.table_name","r.table_name,case when r.table_name='eps.audit_events'then'(to_jsonb(t)-''reason'')'else'to_jsonb(t)'end,r.table_name")
 replace(old,new);replace('report.all_preexisting_rows_preserved = true;','report.all_other_cloned_old_column_rows_preserved=true;')
 return source,cfg
if __name__=='__main__':
 relative='.local/reason40-collector-validation-source/controller-'+str(uuid.uuid4())+'.mjs';source,cfg=compile_source(relative);path=ROOT/relative;path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(source)
 print(json.dumps({'controller':str(path),'sha256':s.sha(source.encode()),'execution_enabled':False,'sql_or_docker_executed':False}))
