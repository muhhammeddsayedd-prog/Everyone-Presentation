"""One fixed read-only Auth audit projection; no token/session secret columns."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse';CLIENT='f2acafd5-d4b6-4176-b86c-067c57e45ecc'
INITIAL=MAIN/'.local/temporary-oauth-lifecycle/402aca12-60e1-464e-8573-c48958c3ab1f/coordinator-initial.json'
READER=ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py'
GUARD=ROOT/'tools/provision_logo_verifier.py'
PINS={READER:'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',GUARD:'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'}
START='2026-11-02T09:16:59Z';END='2026-11-02T09:17:03Z'
UUID=re.compile(r'[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}')
def need(ok):
 if not ok:raise ValueError('AUTH_DENIAL_AUDIT_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def literal(value):return "'"+value.replace("'","''")+"'"
def sql(principal,session):
 need(all(type(v)is str and UUID.fullmatch(v)for v in(principal,session)))
 action="coalesce(p->>'action',p#>>'{metadata,action}')"
 status="coalesce(p->>'status',p->>'status_code',p#>>'{metadata,status}',p#>>'{metadata,status_code}')"
 code="coalesce(p->>'error_code',p->>'code',p#>>'{metadata,error_code}',p#>>'{metadata,code}')"
 request="coalesce(p->>'request_id',p#>>'{metadata,request_id}')"
 uid=literal(principal);sid=literal(session);client=literal(CLIENT)
 return f"""begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='15s';
with bounded as(select created_at,payload::jsonb p from auth.audit_log_entries where created_at>={literal(START)}::timestamptz and created_at<{literal(END)}::timestamptz order by created_at,id limit 101),projected as(select created_at,
case when {action} in('login','logout','token_revoked','token_refreshed','user_reauthenticate_requested')then {action} else'[other]'end action,
case when {status}~'^[1-5][0-9]{{2}}$'then({status})::int end status,
case when {code} in('refresh_token_not_found','refresh_token_already_used','session_not_found','bad_jwt','invalid_grant','validation_failed','request_timeout','unexpected_failure')then {code} when {code} is not null then'[other]'end code,
case when {request}~'^[a-f0-9]{{8}}-([a-f0-9]{{4}}-){{3}}[a-f0-9]{{12}}$'then {request} end request_id,
coalesce(p->>'actor_id',p->>'user_id',p#>>'{{metadata,user_id}}')={uid} principal_matches,
coalesce(p->>'client_id',p#>>'{{metadata,client_id}}',p#>>'{{traits,client_id}}')={client} client_matches,
coalesce(p->>'session_id',p#>>'{{metadata,session_id}}',p#>>'{{traits,session_id}}')={sid} session_matches
from bounded)select jsonb_build_object('database',current_database(),'operator',current_user,'read_only',current_setting('transaction_read_only')='on','observed_at',clock_timestamp(),'history_count',(select count(*)from supabase_migrations.schema_migrations),'window_start',{literal(START)},'window_end_exclusive',{literal(END)},'count',count(*),'truncated',count(*)>100,'rows',coalesce(jsonb_agg(to_jsonb(projected)order by created_at),'[]'::jsonb))as auth_denial_audit from projected;rollback;"""
def main():
 need(len(sys.argv)==1 and(MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 for file,pin in PINS.items():need(sha(file.read_bytes())==pin)
 need(INITIAL.is_file()and not INITIAL.is_symlink()and INITIAL.stat().st_nlink==1 and INITIAL.stat().st_size<=4096)
 initial=json.loads(INITIAL.read_bytes());need(set(initial)=={'claims','original_baseline_sha256','principal_id','read','session_id'}and initial['claims']['client_id']==CLIENT)
 text=sql(initial['principal_id'],initial['session_id']);import pglast;pglast.parse_sql(text)
 need(text.endswith('rollback;')and not re.search(r'(?im)^\s*(?:commit|insert|update|delete|grant|revoke|create|alter|drop)\b',text))
 reader=module('auth_audit_normal_reader',READER);sys.path.insert(0,str(ROOT/'tools'));security=module('auth_audit_private_guard',GUARD);need(security.ROOT==ROOT)
 directory=ROOT/'.local/auth-denial-audit39'/str(uuid.uuid4());directory.mkdir(parents=True,exist_ok=False);guard=security.WindowsPrivateFiles();file=directory/'audit.sql'
 with guard.create(file)as stream:stream.write(text.encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json','--workdir',str(MAIN)]
 code,timeout,overflow,out,_stderr=reader.bounded(args,reader.environment());value=None
 if code==0 and not timeout and not overflow:
  payload=json.loads(out);rows=payload if type(payload)is list else payload.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'auth_denial_audit'});value=rows[0]['auth_denial_audit']
  need(value['database']==value['operator']=='postgres'and value['read_only']is True and value['history_count']==39 and value['window_start']==START and value['window_end_exclusive']==END and value['truncated']is False and value['count']==len(value['rows'])<=100)
 receipt={'schema_version':'1.0','scope':'fixed_read_only_Auth_audit_metadata_after_consumed_denials','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'observed'if value else'unconfirmed','read_only_rollback':True,'automatic_retry':False,'native_refresh_logout_or_denials_replayed':False,'token_or_secret_or_raw_payload_read':False,'raw_cli_persisted':False,'owned_session_identifier_printed_or_saved_in_receipt':False,'source_sha256':sha(Path(__file__).read_bytes()),'sql_sha256':sha(text.encode()),'protected_initial_metadata_sha256':sha(INITIAL.read_bytes()),'reader_sha256':PINS[READER],'guard_sha256':PINS[GUARD],'cli_version':'2.122.0','exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'metadata':value,'limits':['Audit action rows are not HTTP response receipts; absent status/code/request_id cannot reconstruct the original denial.','No raw Auth payloads, IP addresses, emails, tokens, session secrets or credential stores selected.','Optional database audit storage and asynchronous delivery limit conclusions from no matching rows.','No exposed Supabase connector or documented Auth-log subcommand found in pinned normal CLI help; no custom management transport or login introduced.']}
 folder=ROOT/'tracking/evidence/m07/auth-denial-audit39';folder.mkdir(parents=True,exist_ok=True);output=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-audit-metadata.json')
 with output.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':receipt['result'],'receipt':output.relative_to(ROOT).as_posix(),'metadata':value}));need(value is not None)
if __name__=='__main__':
 try:main()
 except Exception:print('AUTH_DENIAL_AUDIT_UNCONFIRMED');sys.exit(1)
