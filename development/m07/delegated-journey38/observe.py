"""Read-only release identity and preservation baseline for the owner MCP journey.

Uses the established bounded canonical read transport; never reserves an upload,
reads a client capability, writes business data or calls a processing provider.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, subprocess, sys

ROOT=Path(__file__).resolve().parents[3]
TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
WEB='dpl_4Gm85atSx5XG8kd8w3tfXCTDjNro'
WORKER='dpl_G6CVBYjPxYwh8zNaAYLu4pURoVG4'

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path)
 value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def provider(endpoint):
 # Existing authorized CLI scope; output is projected in RAM, never logged raw.
 assert endpoint in ['/v13/deployments/'+WORKER+'?teamId='+TEAM,
  '/v4/aliases/everyone-presentation-pilot.vercel.app?teamId='+TEAM]
 command=['C:/Program Files/nodejs/node.exe',str(ROOT/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'),
  'api',endpoint,'--method','GET','--raw','--scope','muhammed-abdelrahman',
  '--global-config','C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli']
 result=subprocess.run(command,cwd=ROOT,capture_output=True,timeout=45,env=os.environ.copy())
 assert result.returncode==0 and len(result.stdout)<=4*1024*1024
 return json.loads(result.stdout)

def main():
 assert len(sys.argv)==2 and sys.argv[1] in ['before','after']
 mode=sys.argv[1]
 audit=module('delegated38_preservation',ROOT/'development/m07/specs-worker38-audit/audit.py')
 snapshot=audit.a.query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='45s';"
  +"select jsonb_build_object('observed_at',clock_timestamp(),'snapshot',snap.value,'preservation',"+audit.protection_sql()+") as worker38_adoption from("
  +audit.s.snapshot_sql()+" as value)snap;rollback;")
 full=audit.s.check(snapshot['snapshot']);state=full['state']
 assert len(state['history'])==38 and state['protected_m02_integrity'] is True
 assert state['english']['flags']==['1.0']
 assert all(row['public']['enabled'] is True for row in full['config'].values())
 alias=provider('/v4/aliases/everyone-presentation-pilot.vercel.app?teamId='+TEAM)
 deployment=alias.get('deploymentId') or alias.get('deployment',{}).get('id')
 worker=provider('/v13/deployments/'+WORKER+'?teamId='+TEAM)
 assert deployment==WEB and worker['id']==WORKER and worker['readyState']=='READY'
 evidence=ROOT/'tracking/evidence/m07/delegated-journey38';evidence.mkdir(parents=True,exist_ok=True)
 if mode=='after':
  previous=sorted(evidence.glob('*-before.json'));assert previous
  audit.preserve(json.loads(previous[-1].read_text(encoding='utf8')),snapshot)
 now=datetime.datetime.now(datetime.timezone.utc)
 data={'schema_version':'1.0','observed_at':snapshot['observed_at'],'result':'passed',
  'read_only':True,'business_mutations':False,'web_stable_alias_deployment':deployment,
  'worker_deployment_id':worker['id'],'worker_ready_state':worker['readyState'],
  'history_count':len(state['history']),'English_flags':state['english']['flags'],
  'processing_enabled_count':5,'native_DB_pin':full['config']['frame_extraction_config']['public']['native_image_id'],
  'lifecycle':full['lifecycle'],'protectedM02_integrity':state['protected_m02_integrity'],
  'preservation':snapshot['preservation'],'old_rows_preserved':True if mode=='after' else None,
  'operator_source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
  'actual_owner_upload_or_new_processing_accepted':False,
  'worker_instance_startup_or_health_accepted':False,'raw_configuration_or_credentials_persisted':False}
 path=evidence/(now.strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+mode+'.json')
 with path.open('x',encoding='utf8',newline='\n') as stream:json.dump(data,stream,indent=2);stream.write('\n')
 return {'result':'passed','receipt':path.relative_to(ROOT).as_posix(),'web':deployment,'worker':worker['id']}

if __name__=='__main__':
 try:print(json.dumps(main()))
 except Exception:print('DELEGATED38_READ_UNCONFIRMED');sys.exit(1)
