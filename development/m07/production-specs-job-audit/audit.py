"""Fixed production-job metadata observation; no business/provider mutation."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse';JOB='6e3cb86f-b0c4-4afd-9a0f-61f18b216866';WORKSPACE='5505def3-f7af-4684-968c-d1b154931601';PROJECT='bf650022-0f7f-4928-a8eb-46a27ef555d4'
PRIVATE=MAIN/'.local/production-specs-job-audit'/str(uuid.uuid4())
SOURCES={'development/m07/specs-worker38-audit/audit.py':'f49668d9b71e86de143165e852a3d8406f2538f15330547ac5157b2b52d6565e','development/m07/oauth-attempt-trace/inspect-attempt.py':'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c','apps/worker/src/runtime.ts':'7c4f2ef4495e5f1634a9fb22a084a26912100c51b10adb030347593b1e83a8a9','apps/worker/src/n8n-orchestrator.ts':'7be252a5115c5f600d0f161458e60b056ec3d2109a634592dc7336792efa5e93','packages/central/src/specs-runtime-gateway.ts':'5e3e6c1b4da316ebac501967769712ecc61d590b68a4e6fd942e50a382f9d1de'}
def need(value):
 if not value:raise ValueError('PRODUCTION_SPECS_AUDIT_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
for relative,digest in SOURCES.items():need(sha((MAIN/relative).read_bytes())==digest)
old=module('production_specs_existing_pure_job_projection',MAIN/'development/m07/specs-worker38-audit/audit.py');reader=module('production_specs_existing_bounded_reader',MAIN/'development/m07/oauth-attempt-trace/inspect-attempt.py')

def sql():
 literal=old.literal;job=literal(JOB)+'::uuid';workspace=literal(WORKSPACE)+'::uuid';project=literal(PROJECT)+'::uuid'
 source="(select jsonb_build_object('rows',count(*),'input_hash_matches_job',coalesce(bool_and(i.input_hash=j.input_hash),false),'source_hash_verified',coalesce(bool_and(i.source_hash=encode(sha256(convert_to(i.source_text,'UTF8')),'hex')),false),'source_bytes',coalesce(sum(octet_length(i.source_text)),0),'controlled_synthetic_marker_present',coalesce(bool_and(position('controlled synthetic'in lower(i.source_text))>0),false))from eps.specs_source_inputs i join eps.jobs j on j.id=i.job_id where i.job_id="+job+' and i.workspace_id='+workspace+')'
 specs="(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'processing_job_id',s.processing_job_id,'source_asset_present',s.source_asset_id is not null,'source_text_present',s.source_text is not null,'source_extraction_present',s.source_extraction is not null,'source_row_version',s.source_row_version,'row_version',s.row_version)order by s.id),'[]'::jsonb)from eps.specs s where s.workspace_id="+workspace+' and s.processing_job_id='+job+')'
 roles="(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'spec_id',r.spec_id,'headcount',r.headcount,'row_version',r.row_version,'source_evidence_present',r.source_role is not null,'working_row_updated_after_job',r.updated_at>j.updated_at,'active_slots',(select count(*)from eps.slots x where x.role_id=r.id and x.workspace_id=r.workspace_id and x.archived_at is null),'provisional_slots',(select count(*)from eps.slots x where x.role_id=r.id and x.workspace_id=r.workspace_id and x.archived_at is null and x.provisional))order by r.id),'[]'::jsonb)from eps.roles r join eps.specs s on s.id=r.spec_id and s.workspace_id=r.workspace_id join eps.jobs j on j.id=s.processing_job_id where r.workspace_id="+workspace+' and r.archived_at is null and s.processing_job_id='+job+')'
 stage="(select coalesce(jsonb_agg(jsonb_build_object('stage',x.stage,'attempt_id',x.attempt_id,'result_schema',x.result_schema,'input_hash_matches_job',x.input_hash=j.input_hash,'created_at',x.created_at)order by x.stage),'[]'::jsonb)from eps.specs_stage_payloads x join eps.jobs j on j.id=x.job_id where x.job_id="+job+')'
 query="select jsonb_build_object('observed_at',clock_timestamp(),'database',current_database(),'operator',current_user,'session_user',session_user,'history_count',(select count(*)from supabase_migrations.schema_migrations),'workspace_project_valid',exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id where w.id="+workspace+' and p.id='+project+" and p.archived_at is null),'job',"+old.job_sql(JOB,WORKSPACE)+",'retained_source',"+source+",'specs',"+specs+",'roles',"+roles+",'persisted_stage_payloads',"+stage+')as production_specs_audit;'
 return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='45s';"+query+'rollback;'

def validate(value):
 need(set(value)=={'observed_at','database','operator','session_user','history_count','workspace_project_valid','job','retained_source','specs','roles','persisted_stage_payloads'})
 need(value['database']==value['operator']==value['session_user']=='postgres'and value['history_count']==39 and value['workspace_project_valid']is True)
 old.timestamp(value['observed_at']);old.job_check(value['job'],JOB,WORKSPACE,'2026-11-02T02:28:39Z')
 source=value['retained_source'];need(set(source)=={'rows','input_hash_matches_job','source_hash_verified','source_bytes','controlled_synthetic_marker_present'}and source['rows']==1 and source['input_hash_matches_job']is True and source['source_hash_verified']is True and type(source['source_bytes'])is int and 1<=source['source_bytes']<=20*1024**2 and type(source['controlled_synthetic_marker_present'])is bool)
 need(type(value['specs'])is list and len(value['specs'])==1 and value['specs'][0]['processing_job_id']==JOB)
 for spec in value['specs']:
  need(set(spec)=={'id','processing_job_id','source_asset_present','source_text_present','source_extraction_present','source_row_version','row_version'});old.identifier(spec['id']);need(all(type(spec[k])is bool for k in('source_asset_present','source_text_present','source_extraction_present')))
 need(type(value['roles'])is list and 0<len(value['roles'])<=200)
 for row in value['roles']:
  need(set(row)=={'id','spec_id','headcount','row_version','source_evidence_present','working_row_updated_after_job','active_slots','provisional_slots'});old.identifier(row['id']);need(row['spec_id']==value['specs'][0]['id']and row['source_evidence_present']is True and type(row['working_row_updated_after_job'])is bool and(row['headcount']is None or type(row['headcount'])is int and row['headcount']>=1)and type(row['active_slots'])is int and 0<=row['provisional_slots']<=row['active_slots'])
 for row in value['persisted_stage_payloads']:
  need(set(row)=={'stage','attempt_id','result_schema','input_hash_matches_job','created_at'}and row['stage']in('prepare_document','extract_specs')and row['input_hash_matches_job']is True);old.identifier(row['attempt_id']);old.timestamp(row['created_at'])
 return value

def main():
 need(len(sys.argv)==1 and(MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET and not any(os.environ.get(k)for k in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
 text=sql();import pglast;pglast.parse_sql(text)
 need(text.rstrip().endswith('rollback;')and' repeatable read read only;'in text and not re.search(r'(?im)^\s*(?:commit|insert|update|delete|grant|revoke|create|alter|drop)\b',text))
 PRIVATE.mkdir(parents=True,exist_ok=False);need(PRIVATE.resolve()==PRIVATE and PRIVATE.is_relative_to(MAIN/'.local/production-specs-job-audit'))
 guard=old.s.s.b.security();file=PRIVATE/'audit.sql'
 with guard.create(file)as stream:stream.write(text.encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json','--workdir',str(MAIN)]
 code,timeout,overflow,out,err=reader.bounded(args,reader.environment());observed=None
 if code==0 and not timeout and not overflow:
  parsed=json.loads(out);rows=parsed if type(parsed)is list else parsed.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'production_specs_audit'});observed=validate(rows[0]['production_specs_audit'])
 receipt={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'observed'if observed else'unconfirmed','evidence_kind':'actual_production_specs_job_metadata','target':TARGET,'job_id':JOB,'workspace_id':WORKSPACE,'project_id':PROJECT,'source_classification':'owner_authorized_CONTROLLED_SYNTHETIC_text','source_classification_owner_attested':True,'source_pins':SOURCES,'audit_source_sha256':sha(Path(__file__).read_bytes()),'sql_sha256':sha(text.encode()),'read_only_rollback':True,'automatic_retry':False,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'raw_inputs_prompts_transcripts_payloads_logs_or_credentials_saved':False,'provider_processing_triggered_by_audit':False,'metadata':observed,'limitations':['one controlled synthetic text source; no business accuracy or English/mixed benchmark claim','current working role/headcount/slot metadata may reflect later permitted edits','durable attempt traces record orchestration refs, not daemon instance identity','worker deployment/startup receipt is a separate release observation until job-scoped logs bind it','no browser/MCP parity, guest/auth lifecycle or AT069 proof from this query']}
 folder=ROOT/'tracking/evidence/m07/production-specs-job-audit';folder.mkdir(parents=True,exist_ok=True);file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-job6e3c.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(ROOT).as_posix(),'job_status':observed['job']['status']if observed else None,'active_roles':len(observed['roles'])if observed else None,'active_slots':sum(row['active_slots']for row in observed['roles'])if observed else None}));need(observed is not None)
if __name__=='__main__':
 try:main()
 except Exception:print('PRODUCTION_SPECS_AUDIT_UNCONFIRMED');sys.exit(1)
