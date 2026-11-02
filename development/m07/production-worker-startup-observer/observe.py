"""New disabled data-only production startup observer; no provider transport.

The rollout adapter owns explicit-select normal-CLI POST after Root's review.
Pure functions accept only that response and caller-checked immutable bindings.
Raw messages/cursors/configuration never leave this process or persist on disk.
"""
from pathlib import Path
import copy, datetime, hashlib, json, os, re, subprocess, sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OBSERVE_ENABLED=False
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
OLD_DEPLOYMENT='dpl_G6CVBYjPxYwh8zNaAYLu4pURoVG4'
ENDPOINT='/v1/observability/events?teamId='+TEAM
HEADER='x-vercel-observability-query-reason:cli/daemons-logs'
BINDINGS={'source_sha256':'0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730','native_digest':'sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4','daemon_digest':'sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594','manifest_sha256':'a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943'}
SELECT=['projectId','requestId','branch','deploymentId','domain','environment','requestPath','requestMethod','source','service','isSystemLog','region','runtime','level','message','stream','traceId','spanId','attributes','truncated','daemonName','daemonInstanceId']
RUNTIME=ROOT/'development/m07/controlled-pilot/daemon-runtime.mjs'
RUNTIME_SHA='528072b8e21ee0dfe79911a42ceeffeaf43b631688f16c0c6ddf5ce025b86263'
NODE=Path('C:/Program Files/nodejs/node.exe')
FATAL={'hosted_worker_unconfirmed','hosted_worker_paused','hosted_worker_pilot_expired','native_sandbox_cleanup_unconfirmed','specs_worker_start_failed'}

def need(value):
 if not value:raise ValueError('PRODUCTION_WORKER_STARTUP_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(path):
 need(path.is_file()and not path.is_symlink()and not path.is_junction()and path.resolve()==path and path.stat().st_nlink==1 and 0<path.stat().st_size<=8*1024**2);return path.read_bytes()
def pins():
 need(sha(load(RUNTIME))==RUNTIME_SHA)
 return {RUNTIME.relative_to(ROOT).as_posix():RUNTIME_SHA,**{(HERE/name).relative_to(ROOT).as_posix():sha(load(HERE/name))for name in('observe.py','test_observe.py','README.md')}}
def iso(value):return datetime.datetime.fromtimestamp(value/1000,datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def timestamp(value):
 if type(value)is int:need(0<value<=9007199254740991);return value
 need(type(value)is str and len(value)<=64 and re.fullmatch(r'\d{4}-\d\d-\d\dT[0-9:.]+Z',value))
 try:milliseconds=datetime.datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()*1000
 except Exception:raise ValueError('PRODUCTION_WORKER_STARTUP_UNCONFIRMED')from None
 need(milliseconds.is_integer()and milliseconds>0);return int(milliseconds)
def scope_value(scope,now=None):
 need(type(scope)is dict and set(scope)in({'deployment','instance','bindings'},{'deployment','instance','bindings','window'}))
 deployment=scope['deployment'];instance=scope['instance'];need(type(deployment)is str and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',deployment)and deployment!=OLD_DEPLOYMENT)
 need(type(instance)is dict and re.fullmatch('dmni_[0-9a-hjkmnp-tv-z]{26}',instance.get('id',''))and type(instance.get('started_at_ms'))is int and 0<instance['started_at_ms']<=9007199254140991 and scope['bindings']==BINDINGS)
 start=instance['started_at_ms'];window={'start':start,'end':start+600000};need('window'not in scope or scope['window']==window)
 if now is not None:need(type(now)is int and now>=window['end'])
 return {'deployment':deployment,'instance':{'id':instance['id'],'started_at_ms':start},'window':window}
def request(scope):
 value=scope_value(scope);deployment=value['deployment'];instance=value['instance']['id']
 query='deploymentId:"'+deployment+'" AND source:daemon AND (environment:"production" OR (attributes/\'scope.type\':"target" AND attributes/\'scope.value\':"production")) AND (daemonName:"worker" OR attributes/\'daemonName\':"worker") AND (daemonInstanceId:"'+instance+'" OR attributes/\'daemonInstanceId\':"'+instance+'")'
 return {'event':'vercel.log','scope':{'ownerId':TEAM,'projectIds':[PROJECT]},'timeRange':{key:iso(value['window'][key])for key in('start','end')},'select':SELECT.copy(),'order':'asc','limit':100,'filter':query}
def bound(event,key,expected):
 attrs=event.get('attributes',{});need((key in event or key in attrs)and(key not in event or event[key]==expected)and(key not in attrs or attrs[key]==expected))
def normalize(scope,payload,now):
 value=scope_value(scope,now);need(type(payload)is dict and'error'not in payload and'errors'not in payload and not payload.get('warnings')and payload.get('truncated',False)is False)
 rows=payload.get('events');page=payload.get('pagination');meta=payload.get('meta',{})
 need(type(rows)is list and 0<len(rows)<=100 and type(page)is dict and set(page)=={'hasMore','nextCursor'}and page['hasMore']is False and page['nextCursor']is None)
 need(type(meta)is dict and'error'not in meta and'errors'not in meta and type(meta.get('excludedIntervals',[]))is list and not meta.get('excludedIntervals',[])and not meta.get('warnings')and meta.get('truncated',False)is False)
 lines=[];empty=0;previous=None;required=0
 for raw in rows:
  need(type(raw)is dict and raw.get('projectId')==PROJECT and raw.get('deploymentId')==value['deployment']and raw.get('source')=='daemon'and raw.get('truncated')is False and type(raw.get('attributes',{}))is dict)
  for key,expected in[('projectId',PROJECT),('deploymentId',value['deployment']),('source','daemon'),('daemonName','worker'),('daemonInstanceId',value['instance']['id'])]:bound(raw,key,expected)
  moment=timestamp(raw.get('timestamp'));need(value['window']['start']<=moment<=value['window']['end']and(previous is None or previous<=moment));previous=moment
  need(type(raw.get('message'))is str and len(raw['message'].encode())<=65536)
  for key in('level','stream'):
   if key in raw:need(type(raw[key])is str and len(raw[key])<=32)
  need(raw.get('level','').lower()not in('warn','warning','error','fatal'))
  attrs=raw.get('attributes',{});environment=raw.get('environment');need(environment in('','production'))
  for key,expected in[('scope.type','target'),('scope.value','production'),('environment','production')]:need(key not in attrs or attrs[key]==expected)
  event=copy.deepcopy(raw)
  if environment=='':need(attrs.get('scope.type')=='target'and attrs.get('scope.value')=='production');del event['environment'];empty+=1
  try:message=json.loads(raw['message'])
  except Exception:message=None
  if type(message)is dict:
   need(message.get('event')not in FATAL)
   if message.get('event')=='specs_worker_started':
    need(message=={'event':'specs_worker_started','authentication':'narrow_database_login','orchestration':'n8n_required'});required+=1
  lines.append(json.dumps({'type':'log','data':event},separators=(',',':')))
 need(required>=1)
 lines.append(json.dumps({'type':'summary','recordsReturned':len(rows),'timeRange':request(scope)['timeRange'],'pagination':{'hasMore':False,'next':None},'excludedIntervals':[]},separators=(',',':')))
 text='\n'.join(lines);need(len(text.encode())<=1048576)
 return value,text,{'returned_records':len(rows),'required_worker_started_records':required,'empty_environment_with_exact_production_attributes':empty,'identity_synthesized':False,'complete_api_page':True,'all_records_identity_time_and_production_verified':True}
def project_runtime(text,scope):
 need(sha(load(RUNTIME))==RUNTIME_SHA and not os.environ.get('NODE_OPTIONS'))
 environment={key:os.environ[key]for key in('SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG')if key in os.environ};environment.update(PATH='',NODE_ENV='production')
 program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));const m=await import("+json.dumps(RUNTIME.as_uri())+");process.stdout.write(JSON.stringify(m.projectRuntimeLogs(p.text,p.scope)));"
 completed=subprocess.run([str(NODE),'--input-type=module','-e',program],input=json.dumps({'text':text,'scope':scope},separators=(',',':')).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,env=environment,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 need(completed.returncode==0 and len(completed.stdout)<=32768 and len(completed.stderr)<=32768);return json.loads(completed.stdout)
def startup(scope,payload,now):
 normalized,text,proof=normalize(scope,payload,now);result=project_runtime(text,normalized)
 need(type(result)is dict and result.get('complete_window')is True and result.get('unbound_records')==result.get('truncated_records')==result.get('warning_records')==result.get('excluded_interval_count')==0 and result.get('has_more')is False)
 need(result.get('log_records')==proof['returned_records']and result.get('instance_id')==normalized['instance']['id']and type(result.get('events'))is dict and result['events'].get('worker_started')==proof['required_worker_started_records']and result.get('last_startup_at_ms')is not None and all(result['events'].get(key)==0 for key in('worker_unconfirmed','worker_paused','pilot_expired')))
 need(normalized['window']['start']<=result['last_startup_at_ms']<=normalized['window']['end'])
 return {**result,'scope':normalized,'caller_checked_bindings':copy.deepcopy(BINDINGS),'artifact_bindings_inferred_from_logs':False,'read_only_observability_post':True,'request_sha256':sha(json.dumps(request(scope),sort_keys=True,separators=(',',':')).encode()),'projector_sha256':RUNTIME_SHA,'raw_logs_or_credentials_persisted':False,**proof}
def main(argv=None,stream=None):
 need(OBSERVE_ENABLED);argv=sys.argv if argv is None else argv;need(len(argv)==1)
 raw=(sys.stdin if stream is None else stream).read(1048577);need(len(raw.encode())<=1048576);value=json.loads(raw);need(type(value)is dict and set(value)=={'scope','payload','now'})
 return startup(value['scope'],value['payload'],value['now'])
if __name__=='__main__':
 try:print(json.dumps(main()))
 except Exception:print('PRODUCTION_WORKER_STARTUP_UNCONFIRMED',file=sys.stderr);sys.exit(1)
