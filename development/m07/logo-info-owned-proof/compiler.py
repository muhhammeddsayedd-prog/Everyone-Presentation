"""Finite fresh controller composition. Compiling never dispatches SQL/Docker."""
from pathlib import Path
import hashlib, importlib.util, json, re, uuid

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BASE = 'development/m07/project-creation39-proof/concurrency.mjs'
CANDIDATE = HERE.parent / 'logo-info-operation-proof'
TEMPLATE_RUN = '8a100000-0000-4000-8000-000000000001'
PINS = {
 BASE: 'fe4f6e7cddb749690fea9587dd675a67d6db723ca458a700a8f6b53e67072fdd',
 'development/m07/project-creation39-proof/run.mjs': 'be0987779cac7758419cd73122a61a32824f53515bcf3d93afdaa3e8c024afcf',
 'development/m07/independent-recovery38/guards.mjs': 'd8eebcb91902d840b211827a7e4891938cc52f1573f4456ae9d3ab87c6c3195a',
 'tools/local-postgres.mjs': '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
 'tools/m07-recovery-bundle.mjs': '0938d274456d19130eaa95554ee5d7b90b364efafed13912fa5c62001193268c',
 'development/m07/recovery33/compiler.mjs': 'e53ba5ab07b3724f0b2c4da59d46090ddb351342be205f74325e46192c4cf0a6',
 'development/m07/recovery36/runtime.mjs': '46759a3a6a4d8e0c5caf5e60ebc264cd351230cfa778cd72c7af1db629e1c506',
 'supabase/migrations/20261101223342_m07_project_creation.sql': 'c17af7708a1886d2129df2dc9e4eb196e6b760862939bd2f5fd3c7c1c687e242',
 'supabase/migrations/20261102085405_m07_review_link_action_reason.sql': '08bf4de8a63823b0e7c9aee75560a6e7de0620eb9b8b3c483c65929578db8212',
}
CANDIDATE_PINS = {
 'candidate.py':'8bc3689f3a6e04f49541891cf228d72141eb2a8f6f68bf56c365a7bdef7eba8c',
 'proof.sql':'b1097971bd6556fc8fda1c68ecbe6bd803cd17ad19e03b5718e9601213256e21',
 'test_candidate.py':'3dad5076d35dbd3366c75755a0f644da2a4ba8ad34dbece96d2d548eb46a0921',
 'README.md':'92dd5afda3fcb66abc87a0adc80a116142be462ae9f2c96b301b8f169c07a5e8',
}

def need(ok):
 if not ok: raise ValueError('LOGO_INFO_OWNED_SOURCE_UNCONFIRMED')

def sha(raw): return hashlib.sha256(raw).hexdigest()

def module(name, file):
 spec=importlib.util.spec_from_file_location(name,file); value=importlib.util.module_from_spec(spec); spec.loader.exec_module(value); return value

def configuration():
 pins={}
 for relative, expected in PINS.items():
  file=MAIN/relative; need(sha(file.read_bytes())==expected); pins[str(file)]=expected
 need(set(CANDIDATE_PINS)=={'candidate.py','proof.sql','test_candidate.py','README.md'})
 for relative,expected in CANDIDATE_PINS.items():
  file=CANDIDATE/relative; need(sha(file.read_bytes())==expected); pins[str(file)]=expected
 c=module('owned_logo_info_candidate',CANDIDATE/'candidate.py')
 need(c.EXECUTION_ENABLED is False)
 original_proof=c.proof(TEMPLATE_RUN)
 old_guard="current_database()<>'postgres'";new_guard="current_database()<>'project39'"
 need(original_proof.count(old_guard)==1 and new_guard not in original_proof)
 proof=original_proof.replace(old_guard,new_guard)
 need(proof.replace(new_guard,old_guard)==original_proof)
 cases=re.findall(r"select pg_temp\.check_row\('([^']+)'",proof)
 need(len(cases)>30 and len(cases)==len(set(cases)))
 migration40=(MAIN/'supabase/migrations/20261102085405_m07_review_link_action_reason.sql').read_text(encoding='utf8')
 begin='-- BEGIN REASON40 FUNCTIONAL CHANGE'; end='-- END REASON40 FUNCTIONAL CHANGE'
 need(migration40.count(begin)==migration40.count(end)==1)
 functional40=migration40.split(begin)[1].split(end)[0]
 need(not re.search(r'^\s*(?:begin|commit|rollback)\s*;',functional40,re.M|re.I))
 for file in sorted(HERE.iterdir()):
  if file.is_file() and file.suffix in ('.py','.mjs','.md'): pins[str(file)]=sha(file.read_bytes())
 history=re.search(r"is distinct from array\[(.*?)\]::text\[\]",migration40,re.S)
 need(history is not None);history40=re.findall(r"'([0-9]{14})'",history[1])+['20261102085405'];need(len(history40)==40)
 return {'root':str(MAIN),'template_run':TEMPLATE_RUN,'proof_sql':proof,'proof_sql_sha256':sha(proof.encode()),'original_proof_sql_sha256':sha(original_proof.encode()),'owned_database_guard_inverse_equal':True,'history40':history40,'expected_cases':cases,'functional40':functional40,'source_pins':dict(sorted(pins.items()))}

def compile_source(relative):
 match=re.fullmatch(r'\.local/logo-info-owned-compiled/controller-([a-f0-9-]{36})\.mjs',relative)
 need(match is not None and str(uuid.UUID(match[1]))==match[1] and uuid.UUID(match[1]).version==4)
 cfg=configuration();cfg.update(compile_uuid=match[1],controller=str(MAIN/relative))
 raw=(MAIN/BASE).read_bytes();need(sha(raw)==PINS[BASE]); before=raw.decode().replace('\r\n','\n');source=before;edits=[]
 def replace(old,new):
  nonlocal source
  need(source.count(old)==1);source=source.replace(old,new,1);edits.append((old,new))
 replace("import { functionalChange } from './run.mjs';","import { functionalChange } from "+json.dumps((MAIN/'development/m07/project-creation39-proof/run.mjs').as_uri())+";\nimport * as logoInfo from "+json.dumps((HERE/'entry.mjs').as_uri())+';\nconst cfg='+json.dumps(cfg,sort_keys=True)+';')
 replace("const ROOT = path.resolve(import.meta.dirname, '../../..');",'const ROOT = '+json.dumps(str(MAIN))+';')
 replace('export async function runRace(sourceRoot) {','export async function runRace(sourceRoot) {\n  await logoInfo.admit(cfg,import.meta.filename,sourceRoot);')
 for old,new in [("'.local/project-creation39-race'","'.local/logo-info-owned-proof'"),("'eps.project39.run'","'eps.logoinfo.run'"),("'eps.project39.workspace'","'eps.logoinfo.workspace'"),("'eps.project39.purpose'","'eps.logoinfo.purpose'"),("'independent-race39'","'logo-info-operation-owned-SQL-proof'"),("'eps-c39-'","'eps-logoinfo-'"),("'project-creation39-independent-race'","'logo-info-operation-owned-proof'"),("'tracking/evidence/m07/project-creation39-race'","'tracking/evidence/m07/logo-info-owned-proof'")]:replace(old,new)
 replace('independent owned local PG17 cluster, restored synthetic38 plus exact39 functional DDL; independent-session advisory-lock/idempotency race; no cloud/provider/hosted acceptance','fresh owned PG17 restored38 plus exact39/40 functional DDL, one rollback-only logo INFO operation/RLS proof; no hosted Storage, bytes, cloud or provider acceptance')
 marker="    await mkdir(path.dirname(privateRoot), { recursive: true }); await protect(privateRoot); privateReady = true; report.private_acl_verified = true;"
 replace(marker,"    await logoInfo.claim({root:ROOT,runId,protect,report},cfg);\n"+marker)
 replace('before = await original(); assert.equal(before.length, 3);','before = await original(); assert.equal(before.length, 3);assert.equal(before[0][\'supabase_migrations.schema_migrations\'].count,29);')
 start=source.index('    report.source_seals = {}; for (const [root, file] of ')
 stop=source.index(' {\n      const bytes = await readFile',start)
 old=source[start:stop]
 records=[]
 for file in cfg['source_pins']:
  location=Path(file)
  root=MAIN if location.is_relative_to(MAIN)else SOURCE
  need(location.is_relative_to(root));records.append([str(root),location.relative_to(root).as_posix()])
 records.append([str(MAIN),relative])
 replace(old,'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')')
 old="await sql('begin;set local row_security=on;set local role postgres;' + functional + 'reset role;' + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);"
 setup="await sql(\"set session authorization postgres;begin;set local row_security=on;\"+functional+\"insert into supabase_migrations.schema_migrations(version,statements,name)values('20261101223342',array[]::text[],'logo_info_owned_functional39');\"+cfg.functional40+\"insert into supabase_migrations.schema_migrations(version,statements,name)values('20261102085405',array[]::text[],'logo_info_owned_functional40');commit;\");await sql(snapshot);"
 replace(old,setup)
 # Everything after fresh40 is transactional proof; no historical race runs.
 start=source.index("    report.checkpoint = 'same-key-independent-session-race';")
 stop=source.index('    await sql(`do $preserve$',start)
 removed=source[start:stop]
 replacement="""    report.checkpoint='logo-info-rollback-proof';
    assert.equal(identity.database,'project39');assert.notEqual(identity.system_identifier,target.observed.system_identifier);
    const actualHistory=await value("select jsonb_build_object('history',array_agg(version order by version))from supabase_migrations.schema_migrations;");assert.deepEqual(actualHistory.history,cfg.history40);
    const cloneBaseline=async()=>rows((await sql(\"set session authorization postgres;begin read only;set local search_path='';\"+dataSql+catalogueSql+originalRolesSql+'rollback;')).stdout);
    await logoInfo.runProof({runId,privateRoot,sql,baseline:cloneBaseline,report},cfg);
"""
 replace(removed,replacement)
 replace('report.catalogue39_delta = delta; report.catalogue39_delta_sha256 = sha(JSON.stringify(delta));','report.catalogue40_setup_delta = delta; report.catalogue40_setup_delta_sha256 = sha(JSON.stringify(delta));report.restored_current40_history_count=40;')
 replace('report.all_owned_resources_absent = resources.length === 2;','report.all_owned_resources_absent = resources.length === 2;report.cleanup_inventories=await logoInfo.inventories(docker,runId);')
 # A snapshot after40 preserves full reason values, not old-column masking.
 inverse=source
 for old,new in reversed(edits):
  need(inverse.count(new)==1);inverse=inverse.replace(new,old,1)
 need(inverse==before)
 return source,{'base_sha256':PINS[BASE],'all_edits_inverse_byte_equal':True,'edit_count':len(edits),'removed_race_sha256':sha(removed.encode()),'proof_sql_sha256':cfg['proof_sql_sha256'],'case_count':len(cfg['expected_cases']),'source_pins':cfg['source_pins']}

if __name__=='__main__':
 token=str(uuid.uuid4());relative='.local/logo-info-owned-compiled/controller-'+token+'.mjs'
 source,proof=compile_source(relative);file=MAIN/relative;file.parent.mkdir(parents=True,exist_ok=True)
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(source)
 print(json.dumps({'compiled_only':True,'execution_dispatched':False,'path':relative,'sha256':sha(source.encode()),'projection':proof}))
