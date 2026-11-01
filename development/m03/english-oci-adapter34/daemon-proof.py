"""GET-only daemon Ready/import assembly from actual OCI transport receipts."""
from pathlib import Path
import datetime, importlib.util, json, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
pipeline=module('english34_oci_pipeline',HERE/'pipeline.py')
OLD=ROOT/'development/m03/english-image34/daemon-proof.py';OLD_SHA='110f2d2a66629a97d1c81152cdcbcded58a469272e0e0f136579debcd7a9f08e'
pipeline.need(pipeline.sha(OLD.read_bytes())==OLD_SHA)
old=module('english34_frozen_daemon_ready_projection',OLD)
def main():
 pipeline.need(len(sys.argv)==1);pins=pipeline.source_pins();native=pipeline.load_success('native');daemon=pipeline.load_success('daemon');manifest_sha=pipeline.manifest(native,daemon)
 refresh=old.refresh;suffix='?projectId='+refresh.PROJECT+'&teamId='+refresh.TEAM
 repository=old.api('/v1/vcr/repository/daemon'+suffix).get('repository')
 pipeline.need(type(repository)is dict and pipeline.re.fullmatch('repo_[A-Za-z0-9]{10,80}',repository.get('id',''))and repository.get('projectId')==refresh.PROJECT and repository.get('name')=='daemon'and repository.get('public')is False)
 ready=old.ready_row(old.api('/v1/vcr/repository/daemon/images'+suffix+'&limit=50'),repository['id'],daemon['runtime_digest'])
 pipeline.need(pipeline.source_pins()==pins and pipeline.load_success('native')==native and pipeline.load_success('daemon')==daemon and pipeline.manifest(native,daemon)==manifest_sha)
 value={'schema_version':'1.0','observed_at':refresh.stamp(),'result':'ready_image_and_import_gate_observed','run':pipeline.RUN,'source_sha256':pipeline.SOURCE,'native_runtime_digest':native['runtime_digest'],'baked_manifest_sha256':manifest_sha,'daemon_index_digest':daemon['index_digest'],'daemon_runtime_digest':daemon['runtime_digest'],'registry_repository_private':True,'daemon_status':ready['status'],'architecture':ready['architecture'],'production_import_gate':daemon['production_import_gate'],'dockerfile_sha256':pipeline.sha(pipeline.load(pipeline.CONTEXT/'Dockerfile.daemon')),'deployed':False,'polling':False,'credentials_or_raw_configuration_persisted':False,'project_id':refresh.PROJECT,'team_id':refresh.TEAM,'provider_mutations':False,'read_only':True,'provider_reads_attempted':2,'oci_source_pins':pins,'frozen_projection_helper_sha256':OLD_SHA,'actual_oci_receipts_used':True,'v2_success_pointer_written':False,'native_job_or_english_acceptance':False}
 directory=ROOT/'tracking/evidence/m03/english-oci-adapter34';directory.mkdir(parents=True,exist_ok=True);path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-daemon-ready-import.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':value['result'],'receipt':path.relative_to(ROOT).as_posix(),'provider_reads_attempted':2,'deployment_performed':False}))
if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_OCI_DAEMON_PROOF_UNCONFIRMED');sys.exit(1)
