"""Default-off explicit-select READ query; held daemon/claims remain unchanged."""
from pathlib import Path
import datetime, importlib.util, json, os, subprocess, sys, threading

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OBSERVE_ENABLED=True
DEPLOY=ROOT/'development/m07/specs-diagnostic-daemon38/deploy.py';DEPLOY_SHA='9cc48568e08a906c5ed1c3c10e07bc88140e126f9c0932bfd4cc0e5b58164720'
import hashlib
def need(v):
 if not v:raise ValueError('DAEMON38_EXPLICIT_STARTUP_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
need(sha(DEPLOY.read_bytes())==DEPLOY_SHA)
spec=importlib.util.spec_from_file_location('startup38_held_daemon_release',DEPLOY);d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
DEPLOYMENT='dpl_G6CVBYjPxYwh8zNaAYLu4pURoVG4';INSTANCE='dmni_01m6ca4s3fygy6yrdyp0qr6zv7'
ENDPOINT='/v1/observability/events?teamId='+d.TEAM
HEADER='x-vercel-observability-query-reason:cli/daemons-logs'
# Pinned runtimeSource.select, plus the two identity fields selected by the
# installed CLI's separate daemon-tail path. Timestamp is API-provided metadata.
SELECT=['projectId','requestId','branch','deploymentId','domain','environment','requestPath','requestMethod','source','service','isSystemLog','region','runtime','level','message','stream','traceId','spanId','attributes','truncated','daemonName','daemonInstanceId']
CLI_PINS={'chunks/chunk-OLAG7Y3P.js':'96356f41ba1d0a364761c04470e831dea6365ca51744f19d4dc710c728927b52','chunks/chunk-2PYFJXKS.js':'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b','chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661'}

def pins():
 need(sha(d.load(DEPLOY))==DEPLOY_SHA and sha(d.load(d.RUNTIME))==d.RUNTIME_SHA)
 out={DEPLOY.relative_to(ROOT).as_posix():DEPLOY_SHA,d.RUNTIME.relative_to(ROOT).as_posix():d.RUNTIME_SHA}
 for name,digest in {**d.CLI_PINS,**CLI_PINS}.items():need(sha(d.load(d.CLI.parent/name))==digest);out['cli/'+name]=digest
 for name in ['observe.py','test_observe.py','README.md']:out[(HERE/name).relative_to(ROOT).as_posix()]=sha(d.load(HERE/name))
 return dict(sorted(out.items()))

def iso(value):return datetime.datetime.fromtimestamp(value/1000,datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def window(instance,now):
 need(instance['id']==INSTANCE and type(instance['started_at_ms'])is int and instance['started_at_ms']>0)
 start=instance['started_at_ms'];end=start+600000;need(type(now)is int and end<=now)
 return {'start':start,'end':end}
def request(scope):
 need(scope['deployment']==DEPLOYMENT and scope['instance']['id']==INSTANCE and scope['window']==window(scope['instance'],scope['window']['end']))
 filter='deploymentId:"'+DEPLOYMENT+'" AND source:daemon AND (environment:"production" OR (attributes/\'scope.type\':"target" AND attributes/\'scope.value\':"production")) AND (daemonName:"worker" OR attributes/\'daemonName\':"worker") AND (daemonInstanceId:"'+INSTANCE+'" OR attributes/\'daemonInstanceId\':"'+INSTANCE+'")'
 return {'event':'vercel.log','scope':{'ownerId':d.TEAM,'projectIds':[d.PROJECT]},'timeRange':{'start':iso(scope['window']['start']),'end':iso(scope['window']['end'])},'select':SELECT,'order':'asc','limit':100,'filter':filter}
def command():return d.cli(['api',ENDPOINT,'--method','POST','--header',HEADER,'--input','-','--raw'])

def bound(event,key,expected):
 attrs=event.get('attributes')if type(event.get('attributes'))is dict else{}
 need((key in event or key in attrs)and(key not in event or event[key]==expected)and(key not in attrs or attrs[key]==expected))

def normalize(payload,scope):
 need(type(payload)is dict and 'error'not in payload and 'errors'not in payload and not payload.get('warnings'))
 rows=payload.get('events');page=payload.get('pagination');meta=payload.get('meta',{})
 need(type(rows)is list and 0<len(rows)<=100 and type(page)is dict and 'nextCursor'in page and page.get('hasMore')is False and page['nextCursor']is None
  and type(meta)is dict and type(meta.get('excludedIntervals',[]))is list and not meta.get('excludedIntervals',[]))
 request(scope);lines=[];empty=0
 for raw in rows:
  need(type(raw)is dict and raw.get('projectId')==d.PROJECT and raw.get('deploymentId')==DEPLOYMENT and raw.get('source')=='daemon'and raw.get('truncated')is False)
  for key,value in [('projectId',d.PROJECT),('deploymentId',DEPLOYMENT),('source','daemon'),('daemonName','worker'),('daemonInstanceId',INSTANCE)]:bound(raw,key,value)
  need(type(raw.get('message'))is str and len(raw['message'].encode())<=65536)
  event=dict(raw);environment=event.get('environment');attrs=event.get('attributes')if type(event.get('attributes'))is dict else{}
  need(environment in('','production'))
  if environment=='':
   need(attrs.get('scope.type')=='target'and attrs.get('scope.value')=='production');del event['environment'];empty+=1
  lines.append(json.dumps({'type':'log','data':event},separators=(',',':')))
 lines.append(json.dumps({'type':'summary','recordsReturned':len(rows),'timeRange':request(scope)['timeRange'],'pagination':{'hasMore':False,'next':None},'excludedIntervals':[]},separators=(',',':')))
 text='\n'.join(lines);need(len(text.encode())<=1048576)
 return text,{'returned_records':len(rows),'exact_project_deployment_source_identity_verified':True,'exact_returned_daemon_instance_identity_verified':True,'empty_environment_with_exact_production_attributes':empty,'identity_synthesized':False,'complete_api_page':True}

def post(body):
 raw=json.dumps(body,separators=(',',':')).encode();need(len(raw)<=16384)
 process=subprocess.Popen(command(),cwd=ROOT,env=d.environment(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 buffers=[bytearray(),bytearray()];overflow=threading.Event()
 def stop():
  try:process.kill()
  except OSError:pass
 def collect(stream,index,limit):
  try:
   while chunk:=stream.read(4096):
    room=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:room])
    if len(chunk)>room:overflow.set();stop();break
  except Exception:overflow.set();stop()
  finally:stream.close()
 threads=[threading.Thread(target=collect,args=(process.stdout,0,1048576),daemon=True),threading.Thread(target=collect,args=(process.stderr,1,32768),daemon=True)]
 for thread in threads:thread.start()
 try:
  process.stdin.write(raw);process.stdin.close();process.wait(timeout=30)
 except Exception:stop();process.wait(timeout=10);raise ValueError('DAEMON38_EXPLICIT_STARTUP_UNCONFIRMED')from None
 finally:
  for thread in threads:thread.join(timeout=5)
 need(all(not thread.is_alive()for thread in threads)and process.returncode==0 and not overflow.is_set())
 return json.loads(bytes(buffers[0]))

class ObserverPorts(d.Ports):
 def startup(self,deployment,instance):
  need(OBSERVE_ENABLED and deployment==DEPLOYMENT and instance['id']==INSTANCE);sealed=pins()
  now=int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000);scope={'deployment':deployment,'instance':instance,'window':window(instance,now)}
  body=request(scope);payload=post(body);text,proof=normalize(payload,scope);value=self.project_js('runtime',{'text':text,'scope':scope})
  need(value['complete_window']is True and value['unbound_records']==value['truncated_records']==0 and value['events']['worker_started']>=1 and value['last_startup_at_ms']is not None
   and all(value['events'][key]==0 for key in ['worker_unconfirmed','worker_paused','pilot_expired'])and pins()==sealed)
  return {**value,'explicit_select_observer':{'source_pins':sealed,'read_only_observability_post':True,'request_sha256':sha(json.dumps(body,sort_keys=True,separators=(',',':')).encode()),'window':scope['window'],**proof,'raw_logs_or_credentials_persisted':False}}

def main():
 need(OBSERVE_ENABLED and len(sys.argv)==1);sealed=pins();result=d.readback(ObserverPorts());need(pins()==sealed and result['result']=='passed');return result
if __name__=='__main__':
 try:print(json.dumps(main()))
 except Exception:print('DAEMON38_EXPLICIT_STARTUP_UNCONFIRMED');sys.exit(1)
