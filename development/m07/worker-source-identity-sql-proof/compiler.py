"""Compile a new owned40 purpose from the sealed bootstrap. Never dispatch."""
from pathlib import Path
import hashlib,importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BASE='development/m07/project-creation39-proof/concurrency.mjs';BASE_SHA='fe4f6e7cddb749690fea9587dd675a67d6db723ca458a700a8f6b53e67072fdd'
FIXTURE='development/m07/worker38-concurrency/fixture.sql';FIXTURE_SHA='ba273829ef27155d9e14152df721a13b6dc8393e563bc0a12dbc3c57a8794991'
FROZEN={
 'development/m07/project-creation39-proof/run.mjs':'be0987779cac7758419cd73122a61a32824f53515bcf3d93afdaa3e8c024afcf',
 'development/m07/independent-recovery38/guards.mjs':'d8eebcb91902d840b211827a7e4891938cc52f1573f4456ae9d3ab87c6c3195a',
 'development/m07/review-link-reason40-forward-proof/fixture.py':'0271cf6546e3b4de74c29cd22a83640c575f9467f4928630f29e44e037f5c1a9',
 'development/m07/review-link-reason40-forward-owner-proof/fixture-correction.py':'46611eb3a4d25488f3e9168eecfb10a26f6d587d9f2a2f222ca2387275934925'}
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
l=module('worker40_compiler_actual_state',HERE/'local.py');need=l.need;sha=l.sha;load=l.load
def checked(relative,digest):file=MAIN/relative;need(sha(load(file))==digest);return file
def configuration():
 cfg=l.configuration();cfg['migration40']=load(MAIN/'supabase/migrations/20261102085405_m07_review_link_action_reason.sql').decode();need(sha(cfg['migration40'].encode())=='08bf4de8a63823b0e7c9aee75560a6e7de0620eb9b8b3c483c65929578db8212')
 state=l.m.State(l.NEW_NATIVE);qualification=checked('development/m07/worker39-concurrency/qualification.py','96bb3ac850a1bf43adf8486ec705aa38f02d8ba451fdab5005d7c3a6c2f54370');q=module('worker40_unchanged_three_row_qualification',qualification);metadata=load(MAIN/'.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql');cfg['qualification_sql'],cfg['qualification_rows']=q.sql(metadata,cfg['lifecycle_sql'],cfg['counters'])
 fixture=checked('development/m07/review-link-reason40-collector-fixture/fixture.py','7d297022e5fd5f878fab14972facf7c6b1db890d9231ae4d81377d09ed29cfa4');cfg['config_setup_sql'],cfg['config_setup_records']=module('worker40_valid_config95e9',fixture).configuration()
 for relative,digest in FROZEN.items():checked(relative,digest)
 managed=MAIN/'development/m07/review-link-reason40-forward-proof/fixture.py';correction=MAIN/'development/m07/review-link-reason40-forward-owner-proof/fixture-correction.py';base=module('worker40_managed_fixture_library',managed);fix=module('worker40_admin_fixture_correction_library',correction);cfg['managed_fixture_sql']=fix.correct(base.build(state.context.history));cfg['worker_fixture_file']=str(checked(FIXTURE,FIXTURE_SHA));cfg['worker_fixture_sha256']=FIXTURE_SHA
 pins=state.source_pins()
 for file in(qualification,fixture,managed,correction,MAIN/FIXTURE,MAIN/BASE,MAIN/l.NATIVE_EXPORT['path'],*(MAIN/path for path in FROZEN)):pins[str(file)]=sha(load(file))
 for file in sorted(HERE.iterdir()):
  if file.is_file():pins[str(file)]=sha(load(file))
 cfg['source_pins']=dict(sorted(pins.items()));return cfg
def compile_source(relative):
 match=re.fullmatch(r'\.local/worker-source-identity-sql-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4);raw=load(checked(BASE,BASE_SHA));source=raw.decode().replace('\r\n','\n');cfg=configuration();flag=(HERE/'cases.mjs').read_text();need(flag.count('export const EXECUTION_ENABLED=false;')+flag.count('export const EXECUTION_ENABLED=true;')==1);enabled='export const EXECUTION_ENABLED=true;'in flag
 concurrency,projection=module('worker40_finite_concurrency_projection',HERE/'projection.py').project(cfg['sql_contract_sha256'],enabled);concurrency_relative=relative.replace('/controller-','/concurrency-');cfg['concurrency_file']=str(MAIN/concurrency_relative);cfg['concurrency_sha256']=sha(concurrency.encode());cfg['concurrency_projection']=projection;cfg['source_pins'][str(MAIN/concurrency_relative)]=cfg['concurrency_sha256'];changes=[]
 def replace(before,after):
  nonlocal source;need(source.count(before)==1);source=source.replace(before,after,1);changes.append((before,after))
 replace("import { functionalChange } from './run.mjs';","import { functionalChange } from "+json.dumps((MAIN/'development/m07/project-creation39-proof/run.mjs').as_uri())+";\nimport * as worker40 from "+json.dumps((HERE/'cases.mjs').as_uri())+';\nconst cfg='+json.dumps(cfg,sort_keys=True)+';')
 replace("const ROOT = path.resolve(import.meta.dirname, '../../..');",'const ROOT = '+json.dumps(str(MAIN).replace('\\','/'))+';')
 replace('export async function runRace(sourceRoot) {',"export async function runRace(sourceRoot) {\n  assert(worker40.EXECUTION_ENABLED,'WORKER40_SQL_PROOF_DISABLED');\n  for(const[file,digest]of Object.entries(cfg.source_pins))assert.equal(sha(await readFile(file)),digest);")
 for before,after in[("'.local/project-creation39-race'","'.local/worker-source-identity-sql-proof'"),("'eps.project39.run'","'eps.worker40.run'"),("'eps.project39.workspace'","'eps.worker40.workspace'"),("'eps.project39.purpose'","'eps.worker40.purpose'"),("'independent-race39'","'worker40-owned-phase-validation'"),("'eps-c39-'","'eps-w40-'"),("'project-creation39-independent-race'","'worker40-independent-phase-validation'"),("'tracking/evidence/m07/project-creation39-race'","'tracking/evidence/m07/worker-source-identity-sql-proof'")]:replace(before,after)
 replace('independent owned local PG17 cluster, restored synthetic38 plus exact39 functional DDL; independent-session advisory-lock/idempotency race; no cloud/provider/hosted acceptance','new owned PG17 schema40 current worker phase/full-reason/76-table checkpoint and real-session intake proof; owned identity/OAuth-count qualifications only; no canonical, worker, provider or restore acceptance')
 marker='    await mkdir(path.dirname(privateRoot), { recursive: true }); await protect(privateRoot); privateReady = true; report.private_acl_verified = true;'
 once="    const onceRoot=path.join(ROOT,'.local/worker-source-identity-sql-once',"+json.dumps(match[1])+");await mkdir(path.dirname(onceRoot),{recursive:true});await protect(onceRoot);await writeFile(path.join(onceRoot,'claim.json'),JSON.stringify({compile_uuid:"+json.dumps(match[1])+",run_id:runId,automatic_retry:false}),{flag:'wx'});report.dispatch_once_claim_created=true;\n"
 replace(marker,once+marker)
 begin=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',begin);old=source[begin:end];records=[[str(MAIN).replace('\\','/'),relative],[str(MAIN).replace('\\','/'),concurrency_relative],[str(MAIN).replace('\\','/'),BASE],[str(MAIN).replace('\\','/'),'development/m07/project-creation39-proof/run.mjs'],[str(MAIN).replace('\\','/'),'development/m07/independent-recovery38/guards.mjs']]
 records.extend([[str(SOURCE).replace('\\','/'),file.relative_to(SOURCE).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.extend([[str(MAIN).replace('\\','/'),'supabase/migrations/20261102085405_m07_review_link_action_reason.sql'],[str(MAIN).replace('\\','/'),l.NATIVE_EXPORT['path']]])
 replace(old,'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')')
 old="await sql('begin;set local row_security=on;set local role postgres;' + functional + 'reset role;' + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);"
 replace(old,"await sql(\"begin;set local row_security=on;set local role postgres;grant usage on schema public to public;\"+functional+\"reset role;insert into supabase_migrations.schema_migrations(version,statements,name)values('20261101223342',array[]::text[],'worker40_owned_functional39');\"+snapshot+'commit;');")
 begin=source.index("    report.checkpoint = 'same-key-independent-session-race';");end=source.index('    await sql(`do $preserve$',begin);old=source[begin:end]
 body="""    report.checkpoint='worker40-declared-fixtures';
    const qualified=cfg.qualification_sql.replace('__WORKER39_OWNED_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__WORKER39_OWNED_RUN_SQL__',quote(runId));
    const config=cfg.config_setup_sql.replace('__REASON40_FIXTURE_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__REASON40_FIXTURE_RUN_SQL__',quote(runId));
    await sql("set session authorization postgres;begin;set local eps.worker39.run="+quote(runId)+";set local eps.reason40fixture.run="+quote(runId)+';'+qualified+config+'commit;');
    const managed=cfg.managed_fixture_sql.replace('__FORWARD_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__FORWARD_RUN_SQL__',quote(runId));await sql("set session authorization postgres;set timezone='UTC';set eps.reason40forward.run="+quote(runId)+';'+managed);
    report.clone_fixture_qualification={rows:cfg.qualification_rows,config_setup_records:cfg.config_setup_records,normal_version_trigger_only:true,no_original_or_canonical_changes:true};
    report.checkpoint='worker40-actual-phase-and-concurrency';
    await worker40.runCases({root:ROOT,privateRoot,runId,system:identity.system_identifier,inspect:()=>inspect(db),sql,psqlArgs:()=>psqlArgs(),sessions,report},cfg);
"""
 replace(old,body)
 replace('select distinct table_name from project39_proof.original_rows loop',"select distinct table_name from project39_proof.original_rows where table_name not in("+','.join("'eps."+name+"'"for name in cfg['tables'])+")loop")
 replace('where table_name=%L except select encode',"where table_name=%L and not exists(select 1 from project39_proof.qualified_rows q where q.table_name=project39_proof.original_rows.table_name and q.original_row_hash=project39_proof.original_rows.row_hash)except select encode")
 old="'select count(*)from(select row_hash from project39_proof.original_rows where table_name=%L and not exists(select 1 from project39_proof.qualified_rows q where q.table_name=project39_proof.original_rows.table_name and q.original_row_hash=project39_proof.original_rows.row_hash)except select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %s t)s',r.table_name,r.table_name"
 new=old.replace('to_jsonb(t)::text','%s::text').replace('r.table_name,r.table_name',"r.table_name,case when r.table_name='eps.audit_events'then'(to_jsonb(t)-''reason'')'when r.table_name='storage.buckets'then'(to_jsonb(t)-''versioning_status'')'else'to_jsonb(t)'end,r.table_name");replace(old,new)
 replace('report.all_preexisting_rows_preserved = true;','report.all_other_cloned_old_column_rows_preserved=true;report.all_preexisting_ready_content_preserved=true;')
 inverse=source
 for before,after in reversed(changes):need(inverse.count(after)==1);inverse=inverse.replace(after,before,1)
 need(inverse==raw.decode().replace('\r\n','\n'));return source,concurrency,{'execution_enabled':enabled,'compiled_only':True,'execution_dispatched':False,'bootstrap_inverse_byte_equal':True,'concurrency_projection':projection,'source_pins':cfg['source_pins'],'native_pin_value':cfg['native_pin_value'],'sql_contract_sha256':cfg['sql_contract_sha256'],'SQL_hashes':cfg['hashes'],'owned_oauth_count_qualification':cfg['owned_oauth_count_qualification']}
if __name__=='__main__':
 token=str(uuid.uuid4());relative='.local/worker-source-identity-sql-compiled/controller-'+token+'.mjs';source,concurrency,plan=compile_source(relative)
 for relative,text in[(relative.replace('/controller-','/concurrency-'),concurrency),(relative,source)]:
  file=MAIN/relative;file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(MAIN/'.local/worker-source-identity-sql-compiled'/('controller-'+token+'.mjs')),'controller_sha256':sha(source.encode()),'concurrency_sha256':sha(concurrency.encode()),**plan}))
