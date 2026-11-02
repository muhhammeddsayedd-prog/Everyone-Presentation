"""Disabled data-only complete-window observer with truthful new source event."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,sys
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OBSERVE_ENABLED=False
BASE=MAIN/'development/m07/production-worker-startup-observer/observe.py'
BASE_SHA='01087405e55f0824d43ae7f55a62c0511cd01dfeb0353da16eb0526ea13f84c3'
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
ENDPOINT='/v1/observability/events?teamId='+TEAM;HEADER='x-vercel-observability-query-reason:cli/daemons-logs'
FIELDS=('daemon_source_sha256','native_source_sha256','native_graph_sha256','native_manifest_sha256','native_compatibility_sha256')
def need(value):
 if not value:raise ValueError('WORKER_IDENTITY_STARTUP_REFUSED')
def base():
 need(hashlib.sha256(BASE.read_bytes()).hexdigest()==BASE_SHA);spec=importlib.util.spec_from_file_location('worker_identity_frozen_log_helpers',BASE);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def scope_value(scope,now=None):
 need(type(scope)is dict and set(scope)=={'deployment','instance','bindings'}and type(scope['deployment'])is str and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',scope['deployment'])and scope['deployment']!='dpl_Cp1TW1vP3JiLJoL5G3Zx2yfei97M')
 instance=scope['instance'];need(type(instance)is dict and set(instance)=={'id','started_at_ms'}and re.fullmatch('dmni_[0-9a-hjkmnp-tv-z]{26}',instance.get('id',''))and type(instance.get('started_at_ms'))is int and 0<instance['started_at_ms']<=9007199254140991)
 bindings=scope['bindings'];need(type(bindings)is dict and set(bindings)==set(FIELDS)|{'native_digest','daemon_digest'}and all(type(bindings[key])is str and re.fullmatch('[a-f0-9]{64}',bindings[key])for key in FIELDS)
  and all(type(bindings[key])is str and re.fullmatch('sha256:[a-f0-9]{64}',bindings[key])for key in('native_digest','daemon_digest')))
 window={'start':instance['started_at_ms'],'end':instance['started_at_ms']+600000}
 if now is not None:need(type(now)is int and now>=window['end'])
 return {'deployment':scope['deployment'],'instance':copy.deepcopy(instance),'window':window}
def request(scope):
 value=scope_value(scope);old=base();deployment=value['deployment'];instance=value['instance']['id']
 query='deploymentId:"'+deployment+'" AND source:daemon AND (environment:"production" OR (attributes/\'scope.type\':"target" AND attributes/\'scope.value\':"production")) AND (daemonName:"worker" OR attributes/\'daemonName\':"worker") AND (daemonInstanceId:"'+instance+'" OR attributes/\'daemonInstanceId\':"'+instance+'")'
 return {'event':'vercel.log','scope':{'ownerId':TEAM,'projectIds':[PROJECT]},'timeRange':{key:old.iso(value['window'][key])for key in('start','end')},'select':old.SELECT.copy(),'order':'asc','limit':100,'filter':query}
def startup(scope,payload,now,project=None):
 value=scope_value(scope,now);old=base();need(type(payload)is dict and'error'not in payload and'errors'not in payload and not payload.get('warnings')and payload.get('truncated',False)is False)
 rows=payload.get('events');page=payload.get('pagination');meta=payload.get('meta',{})
 need(type(rows)is list and 0<len(rows)<=100 and type(page)is dict and set(page)=={'hasMore','nextCursor'}and page['hasMore']is False and page['nextCursor']is None and type(meta)is dict and'error'not in meta and'errors'not in meta and not meta.get('warnings')and meta.get('excludedIntervals',[])==[]and meta.get('truncated',False)is False)
 lines=[];started=0;identities=0;previous=None
 for raw in rows:
  need(type(raw)is dict and raw.get('projectId')==PROJECT and raw.get('deploymentId')==value['deployment']and raw.get('source')=='daemon'and raw.get('truncated')is False and type(raw.get('attributes',{}))is dict)
  for key,expected in(('projectId',PROJECT),('deploymentId',value['deployment']),('source','daemon'),('daemonName','worker'),('daemonInstanceId',value['instance']['id'])):old.bound(raw,key,expected)
  moment=old.timestamp(raw.get('timestamp'));need(value['window']['start']<=moment<=value['window']['end']and(previous is None or previous<=moment));previous=moment
  need(type(raw.get('message'))is str and len(raw['message'].encode())<=65536)
  for key in('level','stream'):need(key not in raw or type(raw[key])is str and len(raw[key])<=32)
  need(raw.get('level','').lower()not in('warn','warning','error','fatal'))
  attrs=raw.get('attributes',{});environment=raw.get('environment');need(environment in('','production'))
  for key,expected in(('scope.type','target'),('scope.value','production'),('environment','production')):need(key not in attrs or attrs[key]==expected)
  event=copy.deepcopy(raw)
  if environment=='':need(attrs.get('scope.type')=='target'and attrs.get('scope.value')=='production');del event['environment']
  try:message=json.loads(raw['message'])
  except Exception:message=None
  if type(message)is dict:
   need(message.get('event')not in old.FATAL)
   if message.get('event')=='specs_worker_started':need(message=={'event':'specs_worker_started','authentication':'narrow_database_login','orchestration':'n8n_required'});started+=1
   if message.get('event')=='hosted_worker_source_identity':need(message=={'event':'hosted_worker_source_identity',**{key:scope['bindings'][key]for key in FIELDS}});identities+=1
  lines.append(json.dumps({'type':'log','data':event},separators=(',',':')))
 need(started>=1 and identities>=1)
 lines.append(json.dumps({'type':'summary','recordsReturned':len(rows),'timeRange':request(scope)['timeRange'],'pagination':{'hasMore':False,'next':None},'excludedIntervals':[]},separators=(',',':')));text='\n'.join(lines);need(len(text.encode())<=1048576)
 result=(old.project_runtime if project is None else project)(text,value)
 need(type(result)is dict and result.get('complete_window')is True and result.get('unbound_records')==result.get('truncated_records')==result.get('warning_records')==result.get('excluded_interval_count')==0 and result.get('has_more')is False
  and result.get('log_records')==len(rows)and result.get('instance_id')==value['instance']['id']and result.get('events',{}).get('worker_started')==started
  and all(result['events'].get(key)==0 for key in('worker_unconfirmed','worker_paused','pilot_expired'))and type(result.get('last_startup_at_ms'))is int and value['window']['start']<=result['last_startup_at_ms']<=value['window']['end'])
 return {**result,'scope':value,'caller_checked_artifacts':{key:scope['bindings'][key]for key in('native_digest','daemon_digest')},'actual_source_identity_event':{key:scope['bindings'][key]for key in FIELDS},'source_identity_records':identities,'record_identities_synthesized':False,'raw_logs_persisted':False}
if __name__=='__main__':
 need(OBSERVE_ENABLED);raise ValueError('WORKER_IDENTITY_STARTUP_DATA_PORT_ONLY')
