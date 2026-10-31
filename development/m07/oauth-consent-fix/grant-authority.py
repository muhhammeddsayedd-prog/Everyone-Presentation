"""Read only exact-target managed grant authority; no raw CLI persistence."""
from pathlib import Path
import importlib.util,json,subprocess,os,datetime,hashlib,sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];TARGET='pyibofyctwnqpvktepse'
def main():
 if len(sys.argv)!=1:raise ValueError('NO_ARGUMENTS')
 spec=importlib.util.spec_from_file_location('read_only_discovery',HERE/'discover.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
 if(ROOT/'supabase/.temp/project-ref').read_text().strip()!=TARGET:raise ValueError('TARGET_REQUIRED')
 query=HERE/'grant-authority.sql';env=d.environment(os.environ)
 r=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(query),'--output-format','json','--workdir',str(ROOT)],cwd=ROOT,env=env,capture_output=True,text=True,timeout=45,encoding='utf8',errors='replace')
 if r.returncode or len(r.stdout)>65536 or len(r.stderr)>65536:raise ValueError('READ_UNCONFIRMED')
 value=json.loads(r.stdout);rows=value if type(value)is list else value.get('rows');assert type(rows)is list and len(rows)==1 and set(rows[0])=={'oauth_grant_authority'}
 result=rows[0]['oauth_grant_authority'];assert result['operator']==result['database']=='postgres'
 receipt={'schema_version':'1.0','evidence_kind':'actual_metadata_only_read','target':TARGET,'query_sha256':hashlib.sha256(query.read_bytes()).hexdigest(),'raw_cli_persisted':False,'grant_authority':result}
 path=ROOT/'tracking/evidence/m07/oauth-consent-fix'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-grant-authority.json')
 with path.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':'passed','receipt':path.relative_to(ROOT).as_posix(),'authority':result}))
if __name__=='__main__':
 try:main()
 except Exception:print('GRANT_AUTHORITY_READ_UNCONFIRMED');sys.exit(1)
