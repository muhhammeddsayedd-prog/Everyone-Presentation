"""Finite new-purpose compiler; no SQL/Docker on import or compilation."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
STATE=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio-Recovery/development/m07/completion-worker-rollout39/state.py')
STATE_SHA='4c184701d181e539d3b5de2d2d4a68d7a985086c195108872dde5d6fe61a4ff9'
BASE='development/m07/project-creation39-proof/concurrency.mjs';BASE_SHA='fe4f6e7cddb749690fea9587dd675a67d6db723ca458a700a8f6b53e67072fdd'
FIXTURE='development/m07/worker38-concurrency/fixture.sql';FIXTURE_SHA='ba273829ef27155d9e14152df721a13b6dc8393e563bc0a12dbc3c57a8794991'
CHECKPOINT=STATE.parent/'checkpoint-query.sql';CHECKPOINT_SHA='273ad36c1b65177b63780162b82892e131eb095ace9ff2b49d824d82335fe518'
def need(value):
 if not value:raise ValueError('WORKER39_COMPILATION_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(file):
 need(file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1 and file.stat().st_size<16*1024**2);return file.read_bytes()
def configuration():
 need(sha(load(STATE))==STATE_SHA);spec=importlib.util.spec_from_file_location('worker39_current_actual_state',STATE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);s=m.State()
 before={'canonical':copy.deepcopy(s.anchor),'intent_data':{'count':s.anchor['project39']['intent_rows'],'sha256':'a'*64}}
 paused=copy.deepcopy(before)
 for row in paused['canonical']['processing_config'].values():row['public']['enabled']=False
 def blocks(value,phase):
  rendered=s.render(value,phase,'11111111-1111-4111-8111-111111111111');result=re.findall(r'do \$completion39\$declare changed integer;begin update eps\..+?end\$completion39\$;\n',rendered);need(len(result)==5);return result
 sentinel={'__worker39_capture_sentinel':True};literal=s.b.old.json_sql(sentinel)
 def template(expression,label):
  text=s.b.old.assertion(expression,sentinel,label);need(text.count(literal)==1);return text.replace(literal,'__WORKER39_CAPTURED_PREIMAGE_SQL__')
 cfg={'sql_contract_sha256':STATE_SHA,'prefix':s.prefix(),'snapshot_sql':s.state_sql(),'comparable_sql':s.comparable_sql(),'lifecycle_sql':s.a.lifecycle_sql(),'tables':sorted(s.config),'counters':s.counters,
  'pause_updates':blocks(before,'pause'),'resume_updates':blocks(paused,'unwind'),'precondition_template':template(s.state_sql(),'COMPLETION39_PREFLIGHT_CHANGED'),'postcondition_template':template(s.comparable_sql(),'COMPLETION39_POSTCONDITION_FAILED'),'full_postcondition_template':template(s.state_sql(),'COMPLETION39_POSTCONDITION_FAILED')}
 need('select'not in cfg['prefix'].lower()and cfg['prefix'].startswith('begin isolation level repeatable read;')and len(cfg['tables'])==5)
 checkpoint=load(CHECKPOINT);need(sha(checkpoint)==CHECKPOINT_SHA and len(checkpoint)==159942 and cfg['snapshot_sql']in checkpoint.decode())
 cfg.update(checkpoint_sql=checkpoint.decode(),checkpoint_sha256=CHECKPOINT_SHA,checkpoint_tables=sorted(set(s.b.TABLES)|{'job_stage_attempts','project_creation_intents'}))
 spec=importlib.util.spec_from_file_location('worker39_explicit_synthetic_qualification',HERE/'qualification.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
 cfg['qualification_sql'],cfg['qualification_rows']=q.sql(load(MAIN/'.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql'),cfg['lifecycle_sql'],cfg['counters'])
 cfg['hashes']={key:sha(value.encode())for key,value in cfg.items()if type(value)is str};cfg['hashes'].update({key:sha(''.join(cfg[key]).encode())for key in('pause_updates','resume_updates')});return cfg
def compile_source(relative):
 raw=load(MAIN/BASE);need(sha(raw)==BASE_SHA and sha(load(MAIN/FIXTURE))==FIXTURE_SHA);source=raw.decode().replace('\r\n','\n');cfg=configuration()
 def replace(old,new):
  nonlocal source
  need(source.count(old)==1);source=source.replace(old,new)
 replace("import { functionalChange } from './run.mjs';","import { functionalChange } from "+json.dumps((MAIN/'development/m07/project-creation39-proof/run.mjs').as_uri())+";\nimport * as worker39 from "+json.dumps((HERE/'cases.mjs').as_uri())+';\nconst worker39cfg='+json.dumps(cfg,sort_keys=True)+';')
 replace("const ROOT = path.resolve(import.meta.dirname, '../../..');",'const ROOT = '+json.dumps(str(ROOT).replace('\\','/'))+';')
 replace("export async function runRace(sourceRoot) {","export async function runRace(sourceRoot) {\n  assert(worker39.EXECUTION_ENABLED,'WORKER39_EXECUTION_DISABLED');\n  assert.equal(sha(await readFile("+json.dumps(str(STATE).replace('\\','/'))+")),worker39cfg.sql_contract_sha256);\n  assert.equal(sha(await readFile("+json.dumps(str(CHECKPOINT).replace('\\','/'))+")),worker39cfg.checkpoint_sha256);\n  assert.equal(sha(await readFile("+json.dumps(str(HERE/'cases.mjs').replace('\\','/'))+")),"+json.dumps(sha(load(HERE/'cases.mjs')))+');')
 for old,new in[("'.local/project-creation39-race'","'.local/worker39-concurrency'"),("'eps.project39.run'","'eps.worker39.run'"),("'eps.project39.workspace'","'eps.worker39.workspace'"),("'eps.project39.purpose'","'eps.worker39.purpose'"),("'independent-race39'","'worker39-processing-concurrency'"),("'eps-c39-'","'eps-w39-'"),("'project-creation39-independent-race'","'worker39-independent-processing-concurrency'"),("'tracking/evidence/m07/project-creation39-race'","'tracking/evidence/m07/worker39-concurrency'")]:replace(old,new)
 replace("independent owned local PG17 cluster, restored synthetic38 plus exact39 functional DDL; independent-session advisory-lock/idempotency race; no cloud/provider/hosted acceptance","new independent owned PG17 worker39 SQL concurrency: exact current State4c prefix/snapshot/updates, real cached/fresh intake and retry; no canonical admission, cloud, worker, provider or restore acceptance")
 begin=source.index('    report.source_seals = {}; for (const [root, file] of ');stop=source.index(' {\n      const bytes = await readFile',begin)
 records=[[str(ROOT).replace('\\','/'),relative],[str(MAIN).replace('\\','/'),BASE],[str(MAIN).replace('\\','/'),'development/m07/project-creation39-proof/run.mjs'],[str(MAIN).replace('\\','/'),'development/m07/independent-recovery38/guards.mjs'],[str(MAIN).replace('\\','/'),FIXTURE],[str(ROOT).replace('\\','/'),'development/m07/worker39-concurrency/cases.mjs'],[str(ROOT).replace('\\','/'),'development/m07/worker39-concurrency/compiler.py'],[str(STATE.parents[3]).replace('\\','/'),'development/m07/completion-worker-rollout39/state.py']]
 records.extend([[str(ROOT).replace('\\','/'),'development/m07/worker39-concurrency/qualification.py'],[str(STATE.parents[3]).replace('\\','/'),'development/m07/completion-worker-rollout39/checkpoint-query.sql']])
 source=source[:begin]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[stop:]
 old="await sql('begin;set local row_security=on;set local role postgres;' + functional + 'reset role;' + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);"
 replace(old,"await sql(\"begin;set local row_security=on;set local role postgres;grant usage on schema public to public;\" + functional + \"reset role;insert into supabase_migrations.schema_migrations(version,statements,name)values('20261101223342',array[]::text[],'worker39_owned_functional_change');\" + snapshot + 'commit;');")
 start=source.index("    report.checkpoint = 'same-key-independent-session-race';");end=source.index('    await sql(`do $preserve$',start)
 source=source[:start]+"    report.checkpoint='worker39-exact-three-row-fixture-qualification';\n    const qualification=worker39cfg.qualification_sql.replace('__WORKER39_OWNED_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__WORKER39_OWNED_RUN_SQL__',quote(runId));await sql(\"begin;set local eps.worker39.run=\"+quote(runId)+';'+qualification+'commit;');report.synthetic_busy_fixture_qualification={rows:worker39cfg.qualification_rows,exact_backup_copy_fingerprints_required:true,only_two_direct_row_updates_and_one_normal_trigger_version:true,actual_lifecycle_sql_unchanged:true,original_backup_and_original29_unchanged:true};report.automatic_trigger_effect={version_id:'a5a0feec-b60e-46a0-82c1-ed380331b23a',normal_existing_trigger:true,direct_version_dml:false,source_status:'rendering',terminal_status:'failed',failure_code:'JOB_CANCELLED',source_revision:2,observed_revision:3,only_four_control_fields_changed:true,other23_fields_unchanged:true,old_ready_cohort_preserved:false};\n    report.checkpoint='worker39-owned-fixture-and-real-session-cases';\n    const rawFixture=await readFile(path.join(sourceRoot,"+json.dumps(FIXTURE)+"));assert.equal(sha(rawFixture),"+json.dumps(FIXTURE_SHA)+");const adapted=worker39.adaptFixture(rawFixture,identity,runId);report.fixture_adapter={...adapted};delete report.fixture_adapter.text;await writeFile(path.join(privateRoot,'adapted-fixture.sql'),adapted.text,{flag:'wx'});\n    await sql(\"begin;set local eps.worker38.concurrency='owned-local-v1';set local eps.worker39.run=\"+quote(runId)+';'+adapted.text+'reset role;commit;');\n    await worker39.runCases({root:ROOT,runId,system:identity.system_identifier,inspect:()=>inspect(db),psqlArgs:()=>psqlArgs(),sql,report,sessions},worker39cfg);\n"+source[end:]
 replace('select distinct table_name from project39_proof.original_rows loop',"select distinct table_name from project39_proof.original_rows where table_name not in("+','.join("'eps."+table+"'"for table in cfg['tables'])+")loop")
 replace('where table_name=%L except select encode',"where table_name=%L and not exists(select 1 from project39_proof.qualified_rows q where q.table_name=project39_proof.original_rows.table_name and q.original_row_hash=project39_proof.original_rows.row_hash)except select encode")
 replace('report.all_preexisting_rows_preserved = true;',"report.all_other_cloned_rows_preserved=true;report.automatic_trigger_effect.old_ready_cohort_preserved=true;report.fixture_config_setup_tables=worker39cfg.tables;report.fixture_qualified_busy_rows=worker39cfg.qualification_rows;")
 return source,cfg
if __name__=='__main__':
 need(len(sys.argv)==1);relative='.local/worker39-concurrency-source/controller-'+str(uuid.uuid4())+'.mjs';text,cfg=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True)
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(file),'sha256':sha(text.encode()),'sql_contract_sha256':STATE_SHA,'query_source_hashes':cfg['hashes'],'sql_or_docker_executed':False}))
