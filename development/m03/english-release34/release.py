"""Root-executed canonical33->34 release. Importing is offline and inert.

Existing private CLI login only; all raw CLI output stays bounded in RAM. An
ambiguous apply/activation is never replayed. Readback reconciles retained claims.
Deployment admission is deliberately a separately reviewed, pinned local record.
"""
from pathlib import Path
import copy, datetime, hashlib, importlib.util, json, os, re, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';VERSION='20261031143711'
MIGRATION=ROOT/'supabase/migrations/20261031143711_m03_english_transcript_projection.sql'
MIGRATION_SHA='0705f1940abbc5c4afc65a49e85d9ef2ce6a6489178b6dd82c3acb33cf976472'
PORT_FILE=ROOT/'development/m03/english-transcript34/port-patches.json'
PORT_SHA='12a675415e0970825903de616dae271911da6f01edd13d9dee62e0befecf813e'
PORTS=json.loads(PORT_FILE.read_text(encoding='utf8'))['ports']
HISTORY=re.search(r"array\[(.*?)\]::text\[\]",MIGRATION.read_text(encoding='utf8'),re.S)[1]
HISTORY=re.findall(r"'([0-9]{14})'",HISTORY)
PROTECTED_M02={'id':'b3f90268-147d-41d4-8875-2a6435df1496','status':'waiting_for_input','stage':'apply_specs','attempt':3,'row_version':7}
PRIVATE=ROOT/'.local/m03-english-release34'
CLAIM=PRIVATE/'apply.claim.json';ENABLE_CLAIM=PRIVATE/'enable.claim.json'
ADMISSION=PRIVATE/'deployment-admission.json'
NEW_MEDIA=['english_transcript','english_transcript_status','english_transcript_source_sha256','english_transcript_input_hash','english_transcript_metadata']
PROTECTED_TABLES={
 'candidates':[], 'candidate_media':NEW_MEDIA,'candidate_media_frames':[],
 'workspace_candidates':[], 'candidate_asset_config':['english_transcript_version'],
 'frame_extraction_config':['native_image_id'],'presentation_processing_config':[],
 'presentation_versions':['english_transcript_version'],'version_slides':[],
 'presentation_video_transcripts':[],'presentation_version_assets':[],
 'media_assets':[], 'presentation_exports':[], 'app_settings':[],
 'jobs':[],'outbox_events':[],'frame_extraction_requests':[],'candidate_stage_payloads':[],'specs':[]}
FROZEN={
 'development/m07/oauth-attempt-trace/release-context33.py':'89ded31f17961784e6611c3c12a4213fb24d155fdd0e69fa9570cabcfd740039',
 'development/m03/native-probe34/admit-native-probe34.mjs':'cf2e9b9cc481a09a0364865993f8f0c6662be418b428991ca75e7c67375f84d5',
 'development/m03/native-probe34/native-probe34-release.mjs':'9930e6d34ea9f8ff82ae5d2f992cda4dc63787406c180d7ae98e8a4b35ac65f8',
 'development/m07/oauth-attempt-trace/inspect-attempt.py':'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'}

def need(value):
 if not value:raise ValueError('ENGLISH34_RELEASE_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def literal(value):return "'"+value.replace("'","''")+"'"
def json_sql(value):return literal(json.dumps(value,sort_keys=True,separators=(',',':')))+'::jsonb'
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def sources():
 need(sha(MIGRATION.read_bytes())==MIGRATION_SHA)
 need(sha(PORT_FILE.read_bytes())==PORT_SHA)
 for path,digest in FROZEN.items():need(sha((ROOT/path).read_bytes())==digest)
 files=[Path(__file__),HERE/'test_release.py',HERE/'README.md',HERE/'native_admission.py',HERE/'native_manifest.py',HERE/'native_pin.py',PORT_FILE,MIGRATION]
 return {**FROZEN,**{p.relative_to(ROOT).as_posix():sha(p.read_bytes())for p in files}}

def oauth_sql():
 old=module('english34_frozen33',ROOT/'development/m07/oauth-attempt-trace/release-context33.py')
 # The authenticated claims ledger may be populated now. Preserve it, but omit
 # only the native observation clock and independently checked history array.
 return "(select jsonb_set(q.value,'{base,catalogue}',(q.value#>'{base,catalogue}')-'observed_at'-'history')from("+old.state_sql()+"as value)q)"

def protected_m02_integrity_sql():
 return "exists(select 1 from eps.jobs j join eps.specs s on s.id=j.resource_id where j.id='"+PROTECTED_M02['id']+"'and j.kind='specs_extract'and j.resource_id='73a1a500-acfe-48cc-91ba-53a83b895118'and encode(sha256(convert_to(jsonb_build_object('id',j.id,'kind',j.kind,'resource_id',j.resource_id,'input_asset_id',j.input_asset_id,'input',j.input,'input_hash',j.input_hash,'input_hash_version',j.input_hash_version,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'completed_stages',j.completed_stages,'result',j.result,'error',j.error)::text,'UTF8')),'hex')='7b875c1f212bc18a13d186daf40d7155d73748f2cc6d6704ba34fb8f1397636c'and encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex')='2344eaa9fecced1eff04259500481c47b65bb2bb0a55c448770a23b303b56a86'and position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0)"

def state_sql(after=False):
 hashes=[]
 for name,removed in PROTECTED_TABLES.items():
  projection='to_jsonb(t)'+("-array["+','.join(literal(v)for v in removed)+"]::text[]"if removed else'')
  hashes +=[literal(name),"(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(row_hash,E'\\n'order by row_hash),''),'UTF8')),'hex'))from(select encode(sha256(convert_to(("+projection+")::text,'UTF8')),'hex')as row_hash from eps."+name+" t)s)"]
 signatures=','.join('('+literal(p['signature'])+')'for p in PORTS)
 ports="(select jsonb_object_agg(v.signature,case when p.oid is null then null else jsonb_build_object('source_sha256',encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'attributes_sha256',encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex'))end)from(values"+signatures+")v(signature)left join pg_proc p on p.oid=to_regprocedure(v.signature))"
 english="jsonb_build_object('config_column',exists(select 1 from pg_attribute where attrelid='eps.candidate_asset_config'::regclass and attname='english_transcript_version'and not attisdropped),'media_column',exists(select 1 from pg_attribute where attrelid='eps.candidate_media'::regclass and attname='english_transcript_status'and not attisdropped),'version_column',exists(select 1 from pg_attribute where attrelid='eps.presentation_versions'::regclass and attname='english_transcript_version'and not attisdropped),'table',to_regclass('eps.presentation_video_english_transcripts')is not null,'flags',"+("(select jsonb_agg(to_jsonb(c)->'english_transcript_version'order by id)from eps.candidate_asset_config c)"if after else'null')+",'rows',"+("(select count(*)from eps.presentation_video_english_transcripts)"if after else'null')+",'legacy_projection_valid',"+("not exists(select 1 from eps.candidate_media where english_transcript_status<>'not_captured'or english_transcript is not null or english_transcript_source_sha256 is not null or english_transcript_input_hash is not null or english_transcript_metadata<>'[]'::jsonb)and not exists(select 1 from eps.presentation_versions where english_transcript_version is not null)"if after else'null')+",'security',"+(security_sql()if after else'null')+")"
 return "select jsonb_build_object('database',current_database(),'operator',current_user,'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),'protected_m02',(select jsonb_build_object('id',id,'status',status,'stage',stage,'attempt',attempt,'row_version',row_version)from eps.jobs where id='"+PROTECTED_M02['id']+"'),'protected_m02_integrity',"+protected_m02_integrity_sql()+",'data',jsonb_build_object("+','.join(hashes)+"),'frame_config',(select to_jsonb(c)from eps.frame_extraction_config c where id),'drain',jsonb_build_object('other_active_jobs',(select count(*)from eps.jobs where status in('queued','running','waiting_for_input')and id<>'"+PROTECTED_M02['id']+"'),'leased_outbox',(select count(*)from eps.outbox_events where status='leased')),'oauth',"+oauth_sql()+",'ports',"+ports+",'english',"+english+")"

def security_sql():
 table="'eps.presentation_video_english_transcripts'"
 checks=["(select relrowsecurity and relforcerowsecurity and relowner='postgres'::regrole from pg_class where oid="+table+"::regclass)"]
 for role in ['anon','authenticated','service_role']:
  checks.append("not has_table_privilege("+literal(role)+","+table+",'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')")
 checks +=["has_table_privilege('eps_review_owner',"+table+",'SELECT')","has_table_privilege('eps_review_owner',"+table+",'INSERT')","not has_table_privilege('eps_review_owner',"+table+",'UPDATE,DELETE,TRUNCATE')","has_table_privilege('eps_guest_owner',"+table+",'SELECT')","not has_table_privilege('eps_guest_owner',"+table+",'INSERT,UPDATE,DELETE,TRUNCATE')",
 "(select bool_and(grantee='postgres'::regrole or grantee='eps_review_owner'::regrole and privilege_type in('SELECT','INSERT')or grantee='eps_guest_owner'::regrole and privilege_type='SELECT')from pg_class cross join lateral aclexplode(relacl)where oid="+table+"::regclass)",
 "(select count(*)=3 from pg_policy where polrelid="+table+"::regclass)",
 "exists(select 1 from pg_trigger where tgrelid="+table+"::regclass and tgname='presentation_video_english_immutable'and tgfoid='eps.presentation_immutable_row()'::regprocedure and not tgisinternal)",
 "not has_schema_privilege('eps_review_owner','eps','CREATE')","not has_schema_privilege('eps_candidate_stage_owner','eps','CREATE')"]
 helpers=[('eps.english_transcript_text_valid(text)','eps_candidate_stage_owner',False,'i'),('eps.validate_candidate_english_transcript(eps.jobs,text,jsonb,jsonb)','eps_candidate_stage_owner',True,'v'),('eps.capture_presentation_video_english_transcripts(uuid)','eps_review_owner',False,'v'),('eps.presentation_video_english_transcript(uuid,uuid)','eps_review_owner',False,'s')]
 source=MIGRATION.read_text(encoding='utf8').replace('\r\n','\n')
 for signature,owner,definer,volatility in helpers:
  name=signature.split('(')[0];match=re.search(r'create function '+re.escape(name)+r'\(.*?as \$\$(.*?)\$\$;',source,re.S);need(match is not None)
  checks +=["exists(select 1 from pg_proc where oid=to_regprocedure("+literal(signature)+")and proowner="+literal(owner)+"::regrole and prosecdef="+str(definer).lower()+" and provolatile="+literal(volatility)+" and proconfig=array['search_path=\"\"']::text[]and encode(sha256(convert_to(prosrc,'UTF8')),'hex')="+literal(sha(match[1].encode()))+")"]
  allowed={
   'eps.english_transcript_text_valid(text)':['eps_candidate_stage_owner','eps_candidate_apply_owner','eps_cast_owner','eps_review_owner'],
   'eps.validate_candidate_english_transcript(eps.jobs,text,jsonb,jsonb)':['eps_candidate_stage_owner','eps_candidate_apply_owner'],
   'eps.capture_presentation_video_english_transcripts(uuid)':['eps_review_owner'],
   'eps.presentation_video_english_transcript(uuid,uuid)':['eps_review_owner','eps_guest_owner']}[signature]
  checks +=["(select count(*)="+str(len(allowed))+" and bool_and(privilege_type='EXECUTE'and not is_grantable and grantee in("+','.join(literal(role)+'::regrole'for role in allowed)+"))from pg_proc cross join lateral aclexplode(proacl)where oid=to_regprocedure("+literal(signature)+"))"]
  for role in ['anon','authenticated','service_role']:
   checks +=["not has_function_privilege("+literal(role)+","+literal(signature)+",'EXECUTE')"]
 return '('+' and '.join(checks)+')'

def check_before(value):
 need(type(value)is dict and set(value)=={'database','operator','history','protected_m02','protected_m02_integrity','data','frame_config','drain','oauth','ports','english'})
 need(value['database']=='postgres'and value['operator']=='postgres'and value['history']==HISTORY and len(HISTORY)==33)
 need(value['protected_m02']==PROTECTED_M02 and value['protected_m02_integrity']is True)
 need(value['drain']=={'other_active_jobs':0,'leased_outbox':0}and value['oauth']['coordinator_auth_usage']is False)
 need(value['english']=={'config_column':False,'media_column':False,'version_column':False,'table':False,'flags':None,'rows':None,'legacy_projection_valid':None,'security':None})
 need(set(value['ports'])=={p['signature']for p in PORTS})
 for port in PORTS:
  current=value['ports'][port['signature']];need(type(current)is dict and set(current)=={'source_sha256','attributes_sha256'}and current['source_sha256']==port['before_sha256']and re.fullmatch('[a-f0-9]{64}',current['attributes_sha256']))

def expected_after(before):
 check_before(before);value=copy.deepcopy(before);value['history'].append(VERSION)
 for port in PORTS:value['ports'][port['signature']]['source_sha256']=port['after_sha256']
 value['english']={'config_column':True,'media_column':True,'version_column':True,'table':True,'flags':[None],'rows':0,'legacy_projection_valid':True,'security':True}
 return value
def check_after(value,before):need(value==expected_after(before))
def assertion(sql,state,message):
 return "do $guard$declare observed jsonb;begin "+sql+" into observed;if observed is distinct from "+json_sql(state)+" then raise exception'"+message+"';end if;end$guard$;\n"
def marker(value):need(type(value)is str and str(uuid.UUID(value))==value)
def transaction():
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+','.join('eps.'+name for name in PROTECTED_TABLES)+" in share mode;\n"
def render_apply(before,run):
 marker(run);check_before(before)
 return transaction()+assertion(state_sql(False),before,'ENGLISH34_PREFLIGHT_CHANGED')+MIGRATION.read_text(encoding='utf8')+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values("+literal(VERSION)+",array[]::text[],'m03_english_transcript_projection');\n"+assertion(state_sql(True),expected_after(before),'ENGLISH34_POSTCONDITION_FAILED')+"commit;select jsonb_build_object('version',"+literal(VERSION)+",'marker',"+literal(run)+",'migration_sha256',"+literal(MIGRATION_SHA)+")as english34_release;\n"
def render_activation(before,run):
 marker(run);need(before['history']==HISTORY+[VERSION]and before['english']['flags']==[None]and before['english']['security']is True)
 after=copy.deepcopy(before);after['english']['flags']=['1.0']
 return transaction()+assertion(state_sql(True),before,'ENGLISH34_ACTIVATION_PREFLIGHT_CHANGED')+"do $enable$declare changed integer;begin update eps.candidate_asset_config set english_transcript_version='1.0'where id and enabled and english_transcript_version is null;get diagnostics changed=row_count;if changed<>1 then raise exception'ENGLISH34_EXACT_ONE_ENABLE_REQUIRED';end if;end$enable$;\n"+assertion(state_sql(True),after,'ENGLISH34_ACTIVATION_POSTCONDITION_FAILED')+"commit;select jsonb_build_object('version',"+literal(VERSION)+",'marker',"+literal(run)+",'english_enabled',true)as english34_release;\n"

def query(sql,mode):
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 reader=module('english34_bounded_cli',ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
 PRIVATE.mkdir(parents=True,exist_ok=True);path=PRIVATE/(mode+'.sql');path.write_text(sql,encoding='utf8',newline='\n')
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,reader.environment());need(code==0 and not timeout and not overflow)
 payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'english34_release'});return rows[0]['english34_release']
def read_state(after):return query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+state_sql(after)+"as english34_release;rollback;",'readback34'if after else'preflight33')
def receipt(action,value):
 out=ROOT/'tracking/evidence/m03/english-release34';out.mkdir(parents=True,exist_ok=True);path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 document={'schema_version':'1.0','target':TARGET,'observed_at':stamp(),'evidence_kind':'actual_canonical_english34_observation','action':action,'raw_cli_persisted':False,'automatic_dispatch_retry':False,**value}
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(document,sort_keys=True,indent=2)+'\n')
 return path.relative_to(ROOT).as_posix()
def admission():
 # This file is root-reviewed after actual compatible deployments. It cannot
 # substitute for provider receipts. Missing admission fails before any SQL.
 data=json.loads(ADMISSION.read_text(encoding='utf8'));need(set(data)=={'target','english_disabled','web_deployment','worker_deployment','references'})
 need(data['target']==TARGET and data['english_disabled']is True)
 for field,old in [('web_deployment','dpl_CcwVabZ5PkadAPaeANRLJD4GqVg3'),('worker_deployment','dpl_CVDMpdETNwZYxdEyJ8XM66kSppdQ')]:need(type(data[field])is str and re.fullmatch(r'dpl_[A-Za-z0-9]{10,80}',data[field])and data[field]!=old)
 need(type(data['references'])is dict and set(data['references'])=={'web_ready','web_source','worker_runtime','worker_source','native_smoke','manifest_adoption'})
 for reference in data['references'].values():
  need(type(reference)is dict and set(reference)=={'path','sha256'}and re.fullmatch('[a-f0-9]{64}',reference['sha256']))
  relative=reference['path'];need(type(relative)is str and relative.startswith('tracking/evidence/')and '..'not in relative and '\\'not in relative)
  path=ROOT/relative;need(path.resolve().is_relative_to(ROOT/'tracking/evidence')and not path.is_symlink()and path.is_file()and path.stat().st_size<=2*1024*1024 and sha(path.read_bytes())==reference['sha256'])
 return data
def claim(path,data):
 PRIVATE.mkdir(parents=True,exist_ok=True)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(data,sort_keys=True)+'\n');stream.flush();os.fsync(stream.fileno())
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('preflight','apply','readback','enable','enable-readback','render-local'));action=sys.argv[1];pins=sources()
 if action=='render-local':
  data=json.load(sys.stdin);print(json.dumps({'sql':render_apply(data['before'],data['marker'])}));return
 if action=='preflight':
  before=read_state(False);check_before(before);print(json.dumps({'result':'passed','dispatch_attempted':False,'receipt':receipt(action,{'result':'passed','source_pins':pins,'before':before})}));return
 if action in('readback','enable-readback'):
  source=CLAIM if action=='readback'else ENABLE_CLAIM;data=json.loads(source.read_text(encoding='utf8'));need(data['target']==TARGET and data['source_pins']==pins)
  first=read_state(True);second=read_state(True)
  expected=expected_after(data['before'])if action=='readback'else copy.deepcopy(data['before'])
  if action=='enable-readback':expected['english']['flags']=['1.0']
  need(first==second==expected);print(json.dumps({'result':'observed_applied','receipt':receipt(action,{'result':'observed_applied','source_pins':pins,'claim_retained':True,'first':first,'second':second})}));return
 deploy=admission();path=CLAIM if action=='apply'else ENABLE_CLAIM;need(not path.exists())
 if action=='apply':before=read_state(False);check_before(before)
 else:
  applied=json.loads(CLAIM.read_text(encoding='utf8'));need(applied['source_pins']==pins and applied['target']==TARGET)
  before=read_state(True);check_after(before,applied['before']);need(read_state(True)==before)
 run=str(uuid.uuid4());data={'target':TARGET,'version':VERSION,'marker':run,'migration_sha256':MIGRATION_SHA,'source_pins':pins,'deployment_admission':deploy,'before':before,'claimed_at':stamp(),'dispatch_may_have_occurred':True};claim(path,data)
 fresh=read_state(action=='enable');need(fresh==before and sources()==pins and admission()==deploy)
 returned=False;first=second=None;verified=False
 try:
  result=query(render_apply(before,run)if action=='apply'else render_activation(before,run),action)
  expected_marker={'version':VERSION,'marker':run,'migration_sha256':MIGRATION_SHA}if action=='apply'else{'version':VERSION,'marker':run,'english_enabled':True}
  returned=result==expected_marker
 except Exception:pass
 try:
  first=read_state(True);second=read_state(True);expected=expected_after(before)if action=='apply'else copy.deepcopy(before)
  if action=='enable':expected['english']['flags']=['1.0']
  need(first==second==expected and sources()==pins);verified=True
 except Exception:pass
 passed=returned and verified;print(json.dumps({'result':'passed'if passed else'unconfirmed','claim_retained':True,'automatic_dispatch_retry':False,'receipt':receipt(action,{'result':'passed'if passed else'unconfirmed','source_pins':pins,'deployment_admission':deploy,'normal_return_marker_observed':returned,'independent_readback_verified':verified,'claim_retained':True,'before':before,'first':first,'second':second})}));need(passed)

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_RELEASE_UNCONFIRMED');sys.exit(1)
