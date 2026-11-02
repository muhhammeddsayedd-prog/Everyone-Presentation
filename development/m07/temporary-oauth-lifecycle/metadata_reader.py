"""Disabled fixed normal-CLI session-metadata port. No token/session secret columns."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,sys,uuid
HERE=Path(__file__).resolve().parent
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse'
READ_ENABLED=False
READER=MAIN/'development/m07/oauth-attempt-trace/inspect-attempt.py'
READER_SHA='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'

def need(value):
 if not value:raise ValueError('TEMP_OAUTH_METADATA_REFUSED')

def sql(principal):
 need(type(principal)is str and re.fullmatch(r'[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}',principal)is not None and principal!='00000000-0000-0000-0000-000000000000')
 return"begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='15s';select jsonb_build_object('principal_id','"+principal+"','observed_at_ms',floor(extract(epoch from statement_timestamp())*1000)::bigint,'count',count(*),'truncated',count(*)>1024,'sessions',coalesce(jsonb_agg(jsonb_build_object('id',id,'oauth_client_id',oauth_client_id,'created_at',created_at,'not_after',not_after)order by id),'[]'::jsonb))as temporary_oauth_inventory from(select id,oauth_client_id,created_at,not_after from auth.sessions where user_id='"+principal+"'::uuid order by id limit 1025)s;rollback;"

def query(run,principal):
 need(READ_ENABLED)
 need((MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET and not any(os.environ.get(name)for name in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD'))and hashlib.sha256(READER.read_bytes()).hexdigest()==READER_SHA)
 spec=importlib.util.spec_from_file_location('temporary_oauth_existing_bounded_reader',READER);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 spec=importlib.util.spec_from_file_location('temporary_oauth_private_metadata_files',HERE/'private_store.py');storage=importlib.util.module_from_spec(spec);spec.loader.exec_module(storage);store=storage.Store(run)
 file=store.root/('inventory-'+str(uuid.uuid4())+'.sql')
 with store.secure.create(file)as stream:stream.write(sql(principal).encode());stream.flush();os.fsync(stream.fileno());store.secure.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json','--workdir',str(MAIN)]
 code,timed_out,overflow,stdout,_stderr=reader.bounded(args,reader.environment());need(code==0 and not timed_out and not overflow)
 payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'temporary_oauth_inventory'});value=rows[0]['temporary_oauth_inventory']
 need(type(value)is dict and set(value)=={'principal_id','observed_at_ms','count','truncated','sessions'}and value['principal_id']==principal and value['truncated']is False and type(value['count'])is int and type(value['sessions'])is list and value['count']==len(value['sessions'])<=1024)
 return value

def main():
 # The future reviewed Node bridge must capture this private metadata in RAM.
 # No raw stdout/stderr is ever forwarded by a public invocation.
 try:
  need(READ_ENABLED and len(sys.argv)==1);value=json.loads(sys.stdin.buffer.read(4097));need(type(value)is dict and set(value)=={'run','principal'});result=query(value['run'],value['principal']);print(json.dumps({'ok':True,'value':result},separators=(',',':')))
 except Exception:print('{"ok":false,"code":"TEMP_OAUTH_METADATA_REFUSED"}');raise SystemExit(1)from None

if __name__=='__main__':main()
