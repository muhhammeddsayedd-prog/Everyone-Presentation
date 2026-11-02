"""Fixed canonical metadata read after the owner's single uncertain UI attempt."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse'
PROJECT='6da14b82-8458-451f-aa21-28cb6c85bdc5'
READER=ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py';GUARD=ROOT/'tools/provision_logo_verifier.py'
PINS={READER:'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',GUARD:'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'}
SQL="""begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='15s';
with scope as(select id from eps.workspaces where project_id='6da14b82-8458-451f-aa21-28cb6c85bdc5'::uuid),
versions as(select id,series_id,version_number,status,generation_job_id,created_at from eps.presentation_versions where workspace_id in(select id from scope)and created_at>='2026-11-02T09:34:00Z'::timestamptz and created_at<'2026-11-02T09:37:00Z'::timestamptz order by created_at,id limit 101),
jobs as(select id,kind,resource_id,status,stage,created_at from eps.jobs where workspace_id in(select id from scope)and kind='presentation_render'and created_at>='2026-11-02T09:34:00Z'::timestamptz and created_at<'2026-11-02T09:37:00Z'::timestamptz order by created_at,id limit 101)
select jsonb_build_object('database',current_database(),'operator',current_user,'read_only',current_setting('transaction_read_only')='on','observed_at',clock_timestamp(),'history_count',(select count(*)from supabase_migrations.schema_migrations),'workspace_count',(select count(*)from scope),'window_start','2026-11-02T09:34:00Z','window_end_exclusive','2026-11-02T09:37:00Z','versions',(select jsonb_build_object('count',count(*),'truncated',count(*)>100,'rows',coalesce(jsonb_agg(to_jsonb(versions)order by created_at,id),'[]'))from versions),'jobs',(select jsonb_build_object('count',count(*),'truncated',count(*)>100,'rows',coalesce(jsonb_agg(to_jsonb(jobs)order by created_at,id),'[]'))from jobs),'series',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'output_type',s.output_type,'row_version',s.row_version,'latest_ready_version_id',s.latest_ready_version_id,'version_count',(select count(*)from eps.presentation_versions v where v.series_id=s.id))order by s.id),'[]')from eps.presentation_series s where s.workspace_id in(select id from scope)and s.id in('93fb7425-7311-4b69-94cb-61588724c153'::uuid,'dcf357b7-0249-42d2-9513-35e9a83ced65'::uuid)))as generation_metadata;rollback;"""
def need(ok):
 if not ok:raise ValueError('PRESENTATION_GENERATION_AUDIT_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def main():
 need(len(sys.argv)==1 and(MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 for file,pin in PINS.items():need(sha(file.read_bytes())==pin)
 import pglast;pglast.parse_sql(SQL);need(SQL.endswith('rollback;')and not re.search(r'(?im)^\s*(?:commit|insert|update|delete|grant|revoke|create|alter|drop)\b',SQL))
 reader=module('generation_audit_normal_reader',READER);sys.path.insert(0,str(ROOT/'tools'));security=module('generation_audit_guard',GUARD);need(security.ROOT==ROOT)
 directory=ROOT/'.local/presentation-facade-diagnostics'/str(uuid.uuid4());directory.mkdir(parents=True,exist_ok=False);guard=security.WindowsPrivateFiles();file=directory/'audit.sql'
 with guard.create(file)as stream:stream.write(SQL.encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json','--workdir',str(MAIN)]
 code,timeout,overflow,out,_stderr=reader.bounded(args,reader.environment());value=None
 if code==0 and not timeout and not overflow:
  payload=json.loads(out);rows=payload if type(payload)is list else payload.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'generation_metadata'});value=rows[0]['generation_metadata']
  need(value['database']==value['operator']=='postgres'and value['read_only']is True and value['history_count']==39 and value['workspace_count']==1)
  for key in('versions','jobs'):need(value[key]['truncated']is False and value[key]['count']==len(value[key]['rows'])<=100)
 receipt={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'bounded_canonical_after_single_owner_UI_generation_attempt','result':'observed'if value else'unconfirmed','project_id':PROJECT,'read_only_rollback':True,'RPC_or_JWT_or_synthetic_actor_used':False,'generation_or_confirm_or_retry_performed':False,'raw_cli_or_private_values_saved':False,'source_sha256':sha(Path(__file__).read_bytes()),'sql_sha256':sha(SQL.encode()),'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'metadata':value,'limits':['Current version/job absence in this fixed window proves no durable accepted generation found in this scope, not the original server error code.','No generation retry, uncertain-intent confirmation, canonical mutation or acting-role simulation performed.']}
 folder=ROOT/'tracking/evidence/m07/presentation-facade-diagnostics';folder.mkdir(parents=True,exist_ok=True);output=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-generation-metadata.json')
 with output.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':receipt['result'],'receipt':output.relative_to(ROOT).as_posix(),'metadata':value}));need(value is not None)
if __name__=='__main__':
 try:main()
 except Exception:print('PRESENTATION_GENERATION_AUDIT_UNCONFIRMED');sys.exit(1)
