"""New disabled coordinator bridge. Private stdio only; no old operator entry calls."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,sys,uuid
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
LIVE_ENABLED=False
OWNER='tracking/evidence/m07/oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json'
OWNER_SHA='579377062d37de3909fab7212eeec0fb50db87f1c3e7341f3bbe435a8c268ed9'
CLI=MAIN/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
CLI_SHA='5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493'
NODE='C:/Program Files/nodejs/node.exe';GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
TARGET='pyibofyctwnqpvktepse';CLIENT='f2acafd5-d4b6-4176-b86c-067c57e45ecc';PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';ALIAS='everyone-presentation-pilot.vercel.app'
CODE=('core.mjs','core.test.mjs','private_store.py','test_private_store.py','owner_callback.mjs','owner_callback.test.mjs','metadata_reader.py','test_metadata_reader.py','coordinator.mjs','coordinator_callback.mjs','coordinator.test.mjs','coordinator_bridge.py','test_coordinator_bridge.py','COORDINATOR.md','coordinator-inputs.template.json','README.md','DESIGN.md')

def need(v):
 if not v:raise ValueError('TEMP_OAUTH_COORDINATOR_BRIDGE_REFUSED')

def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(file,maximum=16*1024**2):
 need(file.is_file()and not file.is_symlink()and not file.is_junction()and file.resolve()==file and file.stat().st_nlink==1 and file.stat().st_size<=maximum);return file.read_bytes()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'))
def reference(ref):
 need(type(ref)is dict and set(ref)=={'path','sha256'}and type(ref['path'])is str and re.fullmatch(r'tracking/evidence/[A-Za-z0-9_./-]+\.json',ref['path'])and'..'not in ref['path'].split('/'))
 raw=load(MAIN/ref['path']);need(sha(raw)==ref['sha256']);return json.loads(raw)
def seal():
 result={name:sha(load(HERE/name))for name in CODE}
 for relative in('apps/web/lib/mcp-auth.ts','apps/web/lib/mcp-http.ts','apps/web/app/mcp/route.ts','package-lock.json','tools/provision_logo_verifier.py','tools/release_foundation.py','tools/release_logo.py','development/m07/oauth-attempt-trace/inspect-attempt.py','development/m07/production-web-release/release.py','development/m07/production-web-release/state.py',OWNER):result['main:'+relative]=sha(load(MAIN/relative))
 for relative in('package.json','dist/index.d.mts','dist/public-CvV4ZHkX.mjs'):result['sdk:'+relative]=sha(load(MAIN/'node_modules/@modelcontextprotocol/client'/relative))
 need(result['main:'+OWNER]==OWNER_SHA and json.loads(load(MAIN/'node_modules/@modelcontextprotocol/client/package.json'))['version']=='2.4.0');return result

class Journal:
 def __init__(self,run):self.s=module('temporary_oauth_frozen_store',HERE/'private_store.py').Store(run);self.run=run
 def path(self,name):
  need(type(name)is str and re.fullmatch(r'(?:inputs|ready|plan|initial|expired|refreshed|revoked|complete|ownership|[a-z]+\.(?:claim|normal))',name))
  path=self.s.root/('coordinator-'+name+'.json');need(path.resolve().parent==self.s.root.resolve());return path
 def read(self,name):
  path=self.path(name);need(path.stat().st_size<=1024*1024);self.s.secure.verify(path)
  with path.open('rb')as stream:self.s.secure.verify_open(stream);return json.loads(stream.read(1024*1024+1))
 def create(self,name,value):
  raw=(canonical(value)+'\n').encode();need(len(raw)<=1024*1024)
  with self.s.secure.create(self.path(name))as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno());self.s.secure.verify_open(stream)
  return True
 def exists(self,name):return self.path(name).exists()

def context(j):
 inputs=j.read('inputs');need(type(inputs)is dict and set(inputs)=={'run','source_pins','web_ready_receipt'}and inputs['run']==j.run and inputs['source_pins']==seal())
 owner=json.loads(load(MAIN/OWNER));need(owner['status']=='passed'and owner['request_principal_client_project_match']is True and owner['server_receipt']['client_id']==CLIENT and owner['server_receipt']['request_id']==owner['owner_result']['request_id']=='23c439a1-4869-4228-a3f1-d4a6004ef4f0');principal=owner['server_receipt']['principal_id'];need(re.fullmatch(r'[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}',principal))
 ready=reference(inputs['web_ready_receipt']);need(ready['result']=='passed'and ready['stable_alias_matches']is True and ready['two_independent_reads_equal']is True and ready['normal_process_return_observed']is True);deployment=ready['deployment'];need(deployment['state']=='READY'and deployment['project_id']==PROJECT and deployment['team_id']==TEAM)
 guard=j.s.secure
 def protected(name):
  path=MAIN/'.local/production-web-release'/name;guard.verify(path);return json.loads(load(path)),sha(load(path))
 plan,plan_sha=protected('plan.json');build,build_sha=protected('build.json');web_inputs,_=protected('inputs.json')
 need(build['result']=='passed'and build['quality_only']is True and build['plan_sha256']==plan_sha and build['source_pins']==plan['source_pins'])
 gates=plan['gates'];public=gates['public_build_environment'];need(public==web_inputs['public_build_environment']and gates['source']==web_inputs['source_receipt']and public['APP_ENV']=='production'and public['EPS_RELEASE_MODE']=='production'and public['NODE_ENV']=='production'and public['APP_BASE_URL']=='https://'+ALIAS and public['SUPABASE_URL']=='https://'+TARGET+'.supabase.co'and re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]{8,4096}',public['SUPABASE_PUBLISHABLE_KEY']))
 source=reference(gates['source']);need(source['result']=='passed'and source['source_commit']==gates['source_commit']and source['source_sha256']==gates['source_sha256'])
 expected={'epsSourceCommit':gates['source_commit'],'epsSourceManifest':gates['source_sha256'],'epsProductionWebRun':plan['run_id'],'epsProductionWebBuild':build_sha,'epsProductionWebCanonical':gates['canonical']['sha256']}
 need(deployment['meta']==expected)
 for path in('apps/web/lib/mcp-auth.ts','apps/web/lib/mcp-http.ts','apps/web/app/mcp/route.ts'):
  row=next(row for row in source['files']if row['path']==path);need(row['sha256']==sha(load(MAIN/path)))
 return{'run':j.run,'principal':principal,'publishable_key':public['SUPABASE_PUBLISHABLE_KEY'],'source_pins':inputs['source_pins'],'deployment':deployment,'web_ready_receipt':inputs['web_ready_receipt']}

def preflight_sql(principal):
 need(re.fullmatch(r'[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}',principal))
 return"begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='15s';select jsonb_build_object('database',current_database(),'operator',current_user,'history39',(select count(*)=39 and max(version)='20261101223342'from supabase_migrations.schema_migrations),'client_id','"+CLIENT+"','client_count',(select count(*)from auth.oauth_clients where id='"+CLIENT+"'),'public_none',exists(select 1 from auth.oauth_clients where id='"+CLIENT+"'and deleted_at is null and client_type='public'and token_endpoint_auth_method='none'),'callback',exists(select 1 from auth.oauth_clients where id='"+CLIENT+"'and'http://localhost:3118/callback'=any(string_to_array(redirect_uris,','))),'grants',exists(select 1 from auth.oauth_clients where id='"+CLIENT+"'and'authorization_code'=any(string_to_array(grant_types,','))and'refresh_token'=any(string_to_array(grant_types,','))),'resource',exists(select 1 from eps.mcp_oauth_resources where client_id='"+CLIENT+"'and resource='https://"+ALIAS+"/mcp'and enabled),'enabled_resources',(select count(*)from eps.mcp_oauth_resources where client_id='"+CLIENT+"'and enabled),'owner',exists(select 1 from auth.users where id='"+principal+"'and is_anonymous is false),'capability',exists(select 1 from public.app_capability_grants where principal_id='"+principal+"'and capability='projects.read'and active),'membership',exists(select 1 from public.project_memberships where principal_id='"+principal+"'and project_id='6da14b82-8458-451f-aa21-28cb6c85bdc5'and active))as temporary_oauth_preflight;rollback;"
def query_metadata(j,c,kind):
 need(LIVE_ENABLED and kind in('preflight','inventory'));meta=module('temporary_oauth_disabled_reader_contract',HERE/'metadata_reader.py');need(sha(load(meta.READER))==meta.READER_SHA and not any(os.environ.get(k)for k in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD'))and(MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 reader=module('temporary_oauth_normal_reader',meta.READER);file=j.s.root/(kind+'-'+str(uuid.uuid4())+'.sql')
 with j.s.secure.create(file)as stream:stream.write((preflight_sql(c['principal'])if kind=='preflight'else meta.sql(c['principal'])).encode());stream.flush();os.fsync(stream.fileno())
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json','--workdir',str(MAIN)]
 code,timeout,overflow,out,_=reader.bounded(args,reader.environment());need(code==0 and not timeout and not overflow);payload=json.loads(out);rows=payload if type(payload)is list else payload.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'temporary_oauth_'+kind});return rows[0]['temporary_oauth_'+kind]
def deployment_read(c,identity):
 need(LIVE_ENABLED and identity in(ALIAS,c['deployment']['id'])and sha(load(CLI))==CLI_SHA and not any(os.environ.get(k)for k in('VERCEL_TOKEN','NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS')))
 web=module('temporary_oauth_normal_cli_capture',MAIN/'development/m07/production-web-release/release.py')
 environment={k:os.environ[k]for k in('SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG')if k in os.environ};environment.update({'PATH':'','NODE_ENV':'production','CI':'1','VERCEL_TELEMETRY_DISABLED':'1','VERCEL_CLI_USE_NATIVE_BINARY':'0'})
 args=[NODE,str(CLI),'api','/v13/deployments/'+identity+'?teamId='+TEAM,'--method','GET','--raw','--scope','muhammed-abdelrahman','--global-config',GLOBAL]
 value=json.loads(web.bounded(args,environment,MAIN));state=module('temporary_oauth_pure_deployment_projection',MAIN/'development/m07/production-web-release/state.py');return state.deployment(value)

def main():
 try:
  need(len(sys.argv)==1);value=json.loads(sys.stdin.buffer.read(1024*1024+1));operation=value.pop('operation')
  if operation=='seal':result=seal()
  else:
   if operation in('preflight','deployment','inventory'):need(LIVE_ENABLED)
   j=Journal(value.pop('run'))
   if operation=='context':result=context(j)
   elif operation in('create','read','exists'):result=getattr(j,operation)(**value)
   elif operation=='native':
    method=value.pop('method');need(method in('claim','persist','normal','inspect','read'));result=getattr(j.s,method)(**value)
   elif operation=='latest_tokens':
    found=next((name for name in('generation-3.json','generation-2.json','generation-1.json')if j.s.path(name).exists()),None);need(found is not None);result=j.s.read(found)
   else:
    need(LIVE_ENABLED);c=context(j)
    if operation=='preflight':result=query_metadata(j,c,'preflight')
    elif operation=='deployment':result=deployment_read(c,value['identity'])
    elif operation=='inventory':result=query_metadata(j,c,'inventory')
    else:raise ValueError('TEMP_OAUTH_COORDINATOR_BRIDGE_REFUSED')
  print(json.dumps({'ok':True,'value':result},separators=(',',':')))
 except Exception:print('{"ok":false,"code":"TEMP_OAUTH_COORDINATOR_BRIDGE_REFUSED"}');raise SystemExit(1)from None
if __name__=='__main__':main()
