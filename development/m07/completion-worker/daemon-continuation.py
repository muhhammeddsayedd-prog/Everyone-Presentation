"""NEW disabled no-login continuation after an unconfirmed daemon refresh.

The old unknown result stays unknown. No refresh/helper-get/token extraction.
"""
from pathlib import Path
import base64,datetime,hashlib,importlib.util,json,sys
HERE=Path(__file__).resolve().parent
REGISTRY_SHA='809561e1585f164bba92363a9fb854fc55d1efc4f1d6343acc461c3ae3fbd50c'
file=HERE/'registry.py'
assert file.is_file()and not file.is_symlink()and file.stat().st_nlink==1 and hashlib.sha256(file.read_bytes()).hexdigest()==REGISTRY_SHA
spec=importlib.util.spec_from_file_location('completion_daemon_continuation_registry',file);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
CONTINUATION_ENABLED=True
need=r.need;sha=r.sha;load=r.load
OLD_DAEMON='sha256:ce23af3ba163199c1e35f224f71a281ab450d7acfc0f4ab85b6044df5246431c'
REFERENCES={
 'native_refresh':('2026-11-01T23-16-34-101236Z-native-registry-refresh.json','d501614884b03294af9f58dbf8980a3c7adb83cce944f89c97c5e891c0bfa637'),
 'daemon_refresh':('2026-11-01T23-40-18-869282Z-daemon-registry-refresh.json','1f5cbbcc6595c7f6e873f5a536dcae5ecf6eaf2ca5fede0bb94d14fe75776711'),
 'daemon_reconciliation':('2026-11-01T23-40-51-102774Z-daemon-registry-refresh-readback.json','2e7a2e69962479d5f5a3c7efebc43c99fd644fd599152ed692bccafee115435d')}
CLAIM=r.PRIVATE/'daemon-continuation-copy.claim.json';RETURNED=r.PRIVATE/'daemon-continuation-copy.returned.json'
PROCESS_SCRIPT=r"""$ErrorActionPreference='Stop'
$rows=@(Get-CimInstance Win32_Process -ErrorAction Stop)
if($rows.Count -lt 1){throw 'PROCESS_OBSERVATION_UNCONFIRMED'}
$login=0
$copy=0
foreach($item in $rows){
 $text=[string]$item.CommandLine
 if(($item.Name -in @('node.exe','vercel.exe') -or $item.Name -like 'regctl*') -and [string]::IsNullOrWhiteSpace($text)){throw 'PROCESS_OBSERVATION_UNCONFIRMED'}
 if($item.Name -in @('node.exe','vercel.exe')){
  if($text.Replace([char]92,[char]47).Contains('/m07-pilot/tooling/node_modules/vercel/dist/vc.js') -and $text -match '\bvcr\s+login\s+docker\b' -and $text.Contains('prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6')){$login++}
 }
 if($item.Name -like 'regctl*' -and $text.Contains('/everyone-presentation-worker-pilot/daemon:completion-8b559ebe')){$copy++}
}
@{query_succeeded=$true;scanned_processes=$rows.Count;owned_login_processes=$login;owned_daemon_copy_processes=$copy}|ConvertTo-Json -Compress
"""

def sources():
 pins=r.sources();need(pins[str(HERE/'registry.py')]==REGISTRY_SHA)
 for name in ['daemon-continuation.py','test_daemon_continuation.py','DAEMON_CONTINUATION.md']:pins[str(HERE/name)]=sha(load(HERE/name))
 return pins

def references():
 values={};refs={}
 for name,(filename,digest)in REFERENCES.items():
  raw=load(r.EVIDENCE/filename);need(sha(raw)==digest);value=json.loads(raw)
  need(value['run']==r.b.RUN and value['source_sha256']==r.b.SOURCE and value['project_id']==r.PROJECT and value['team_id']==r.TEAM)
  values[name]=value;refs[name]={'path':(r.EVIDENCE/filename).relative_to(r.ROOT).as_posix(),'sha256':digest}
 need(values['native_refresh']['result']=='passed'and values['native_refresh']['normal_cli_return_observed']is True)
 for name in ['daemon_refresh','daemon_reconciliation']:need(values[name]['result']=='unconfirmed'and values[name]['normal_cli_return_observed']is False)
 need(values['daemon_refresh']['failure_code']=='OPERATION_TIMEOUT'and values['daemon_reconciliation']['read_only']is True and values['daemon_reconciliation']['login_submitted']is False)
 return refs

def process_projection(value):
 need(type(value)is dict and set(value)=={'query_succeeded','scanned_processes','owned_login_processes','owned_daemon_copy_processes'}and value['query_succeeded']is True
  and type(value['scanned_processes'])is int and value['scanned_processes']>0 and type(value['owned_login_processes'])is int and value['owned_login_processes']==0
  and type(value['owned_daemon_copy_processes'])is int and value['owned_daemon_copy_processes']==0)
 return value

class Ports(r.Ports):
 def continuation_pins(self):return sources()
 def references(self):return references()
 def processes(self):
  command=[str(r.helpers().POWERSHELL),'-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(PROCESS_SCRIPT.encode('utf-16le')).decode()]
  return process_projection(json.loads(r.checked_response(self.run(command))))
 def continuation_claim(self,value):r.private_write(CLAIM,value)
 def continuation_claimed(self):return r.private_json(CLAIM)
 def continuation_exists(self):return CLAIM.exists()
 def continuation_hash(self):return sha(load(CLAIM))
 def continuation_return(self,value):r.private_write(RETURNED,value)
 def continuation_returned(self):return r.private_json(RETURNED)if RETURNED.exists()else None
 def daemon_ready(self):
  repo=self.api('daemon_repository')
  url='/v1/vcr/repository/'+r.DAEMON_REPO+'/images?projectId='+r.PROJECT+'&teamId='+r.TEAM+'&limit=50'
  body=json.loads(r.checked_response(self.run(r.cli(['api',url,'--method','GET','--raw']))))
  return ready_projection(repo,body)

def ready_projection(repository,payload):
 repo=r.helpers().repository_metadata(repository,r.DAEMON_REPO,'daemon')
 need(type(payload.get('images'))is list and len(payload['images'])<=50)
 found=[row for row in payload['images']if row.get('manifestDigest')==r.DIGESTS['daemon']]
 need(len(found)==1 and found[0].get('repositoryId')==r.DAEMON_REPO and found[0].get('kind')=='manifest'and found[0].get('status')=='ready'and found[0].get('arch')=='amd64'and found[0].get('platform')=='linux')
 return {'repository':repo,'image':{'runtime_digest':r.DIGESTS['daemon'],'status':'ready','architecture':'amd64','platform':'linux'},'pagination_followed':False,'limit':50}

def admission(p):
 refs=p.references();p.login_admitted('native')
 need(p.normal('daemon','refresh')is None and not p.admitted_exists('daemon')and not p.exists('daemon','copy'))
 native=p.claimed('native','refresh');daemon=p.claimed('daemon','refresh');need(native['metadata']==daemon['metadata']and native['pins']==daemon['pins']==p.pins())
 readings=[]
 for unused in range(2):
  process=process_projection(p.processes());metadata=p.metadata();need(metadata==native['metadata'])
  known={kind:p.remote(reference,digest)for kind,reference,digest in [('previous_native',r.b.PREFIX+'native@'+r.KNOWN_NATIVE,r.KNOWN_NATIVE),('new_native',r.b.PREFIX+'native@'+r.DIGESTS['native'],r.DIGESTS['native']),('previous_daemon',r.b.PREFIX+'daemon@'+OLD_DAEMON,OLD_DAEMON)]}
  readings.append({'observed_at':r.b.stamp(),'processes':process,'metadata':metadata,'helper_backed_known_images':known})
 need(p.metadata()==native['metadata']);process_projection(p.processes());p.login_admitted('native')
 return {'references':refs,'native_refresh_claim_sha256':p.claim_hash('native','refresh'),'daemon_unknown_refresh_claim_sha256':p.claim_hash('daemon','refresh'),
  'daemon_normal_refresh_return_observed':False,'separate_native_normal_project_login_used':True,'fresh_observations':readings,'new_login_submitted':False}

def operate(action,p):
 need(CONTINUATION_ENABLED and action in('observe','copy','readback','ready'));pins=p.continuation_pins();value,ref=p.prepared('daemon');normal=None;reads=[];failure=None;proof=None;status='unconfirmed';observed={}
 try:
  proof=admission(p);need(p.continuation_pins()==pins and p.prepared('daemon')==(value,ref))
  if action=='copy':
   need(not p.continuation_exists());process_projection(p.processes())
   p.continuation_claim({'purpose':'completion-daemon-copy-after-unknown-login','claimed_at':r.b.stamp(),'pins':pins,'export':ref,'admission':proof,'target':r.b.target('daemon'),'digest':r.DIGESTS['daemon'],'automatic_retry':False})
   need(p.continuation_pins()==pins);result=p.run(r.copy_command('daemon',value['archive']),1800)
   confirmed=result['exit_code']==0 and not result['timed_out']and not result['output_limit_exceeded']
   normal={'normal_return':confirmed,'claim_sha256':p.continuation_hash(),'exit_code':result['exit_code'],'timed_out':result['timed_out'],'output_limit_exceeded':result['output_limit_exceeded'],
    'failure_code':None if confirmed else r.helpers().transport().classify(result['stderr'],result['timed_out'],result['output_limit_exceeded'])};p.continuation_return(normal)
  if action in('copy','readback','ready'):
   claim=p.continuation_claimed();need(claim['pins']==pins and claim['export']==ref and claim['target']==r.b.target('daemon')and claim['digest']==r.DIGESTS['daemon']);normal=p.continuation_returned()
   for unused in range(2):reads.append({'tag':p.remote(r.b.target('daemon'),r.DIGESTS['daemon']),'digest':p.remote(r.b.PREFIX+'daemon@'+r.DIGESTS['daemon'],r.DIGESTS['daemon'])})
   need(reads[0]==reads[1]and normal and normal['normal_return']is True and normal['claim_sha256']==p.continuation_hash())
  if action=='ready':observed=p.daemon_ready()
  need(p.continuation_pins()==pins and p.prepared('daemon')==(value,ref));process_projection(p.processes());status='observed'if action=='ready'else'passed'
 except Exception as error:failure=r.helpers().safe_failure(error)
 return p.save('continuation-'+action,'daemon',{'result':status,'pins':pins,'export':ref,'admission':proof,'target':r.b.target('daemon'),'runtime_digest':r.DIGESTS['daemon'],
  'new_login_submitted':False,'daemon_normal_refresh_return_observed':False,'normal_copy_return_observed':bool(normal and normal['normal_return']),'remote_readbacks':reads,'automatic_copy_retry':False,
  'original_unknown_refresh_preserved':True,'read_only':action!='copy','provider_mutations':action=='copy','failure_code':failure,'copy_failure_code':normal.get('failure_code')if normal else None,'daemon_runtime_startup_proven':False,**observed})

def main():
 need(CONTINUATION_ENABLED and len(sys.argv)==2);result=operate(sys.argv[1],Ports());print(json.dumps(result))
 if result['result']not in('passed','observed'):raise ValueError('DAEMON_CONTINUATION_UNCONFIRMED')

if __name__=='__main__':
 try:main()
 except Exception:print('DAEMON_CONTINUATION_UNCONFIRMED');sys.exit(1)
