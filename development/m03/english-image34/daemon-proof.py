"""Root-executed GET-only Ready/import proof assembly after daemon build/push.

Consumes actual successful native/daemon build receipts. Projects only private
repository/image metadata from the existing CLI; never starts a daemon/VM/job.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, re, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('english34_daemon_image_build',HERE/'build-image-v2.py');build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
base=build.base;refresh=base.refresh

def need(value):
 if not value:raise ValueError('ENGLISH34_DAEMON_PROOF_UNCONFIRMED')
def api(endpoint):
 result=refresh.run(refresh.cli(['api',endpoint,'--method','GET','--raw']));need(result.returncode==0);return json.loads(result.stdout)
def ready_row(response,repo,runtime):
 need(type(response)is dict and type(response.get('images'))is list and len(response['images'])<=50)
 selected=[row for row in response['images']if type(row)is dict and row.get('repositoryId')==repo and row.get('manifestDigest')==runtime and row.get('kind')=='manifest'and row.get('status')=='ready'and row.get('arch')=='amd64'and row.get('platform')=='linux']
 need(len(selected)==1);return {'manifest_digest':runtime,'status':'ready','architecture':'amd64','platform':'linux'}
def build_receipts():
 native=base.load_success('native');daemon=base.load_success('daemon');gate=daemon['production_import_gate']
 need(daemon['remote_digest_independent_readback_equal']is True and daemon['exit_code']==0 and gate=={'user':'1000:1000','network':'none','step':gate.get('step'),'completed':True,'cached':False,'build_exit_code':0}and re.fullmatch('#[0-9]{1,4}',gate['step']))
 source=base.verify_context('daemon');need(source['manifest_sha256']==daemon['source']['manifest_sha256'])
 return native,daemon,source
def main():
 need(len(sys.argv)==1);pins=build.sources();native,daemon,source=build_receipts()
 suffix='?projectId='+refresh.PROJECT+'&teamId='+refresh.TEAM
 repository=api('/v1/vcr/repository/daemon'+suffix).get('repository')
 need(type(repository)is dict and re.fullmatch('repo_[A-Za-z0-9]{10,80}',repository.get('id',''))and repository.get('projectId')==refresh.PROJECT and repository.get('name')=='daemon'and repository.get('public')is False)
 image=ready_row(api('/v1/vcr/repository/daemon/images'+suffix+'&limit=50'),repository['id'],daemon['runtime_digest'])
 need(build.sources()==pins and build_receipts()==(native,daemon,source))
 value={'schema_version':'1.0','observed_at':refresh.stamp(),'result':'ready_image_and_import_gate_observed','run':base.RUN,'source_sha256':base.SOURCE,'native_runtime_digest':native['runtime_digest'],'baked_manifest_sha256':source['manifest_sha256'],'daemon_index_digest':daemon['index_digest'],'daemon_runtime_digest':daemon['runtime_digest'],'registry_repository_private':True,'daemon_status':image['status'],'architecture':image['architecture'],'production_import_gate':daemon['production_import_gate'],'dockerfile_sha256':base.sha(base.exact_file(base.CONTEXT/'Dockerfile.daemon')),'deployed':False,'polling':False,'credentials_or_raw_configuration_persisted':False,'project_id':refresh.PROJECT,'team_id':refresh.TEAM,'provider_mutations':False,'read_only':True,'provider_reads_attempted':2,'build_source_pins':pins,'helper_sha256':base.sha(Path(__file__).read_bytes()),'native_job_or_english_acceptance':False}
 directory=ROOT/'tracking/evidence/m03/english-image34';directory.mkdir(parents=True,exist_ok=True);path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-daemon-ready-import.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':value['result'],'receipt':path.relative_to(ROOT).as_posix(),'provider_reads_attempted':2,'deployment_performed':False}))
if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_DAEMON_PROOF_UNCONFIRMED');sys.exit(1)
