"""Disabled once-only LOCAL forward preparation for one failed daemon extraction.

Read existing ACLs; never rerun Set-Acl, old prepare, login or copy. Preserve all
executed source/claims and the original unconfirmed public outcome.
"""
from pathlib import Path
import datetime, importlib.util, json, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
RECONCILE_ENABLED=True
FAILED='tracking/evidence/m07/specs-diagnostic-worker38/2026-11-01T18-26-26-263725Z-daemon-registry-prepare.json'
FAILED_SHA='38f36ca2d06894a27747d011b6b81a7725b6a01e76543d77f185cadf081b8f85'
EXPORT={'receipt':'tracking/evidence/m07/specs-diagnostic-worker38/2026-11-01T18-03-17-571823Z-daemon-export.json','sha256':'b0ba5c5920f65e325ab9fde6cc795331782f0c9a504aa1ee6a2f232c7ed8b106'}
EXECUTED={'registry.py':'5d7a4090e307d7c4eafa45e4effac090b9c516f824a93da6cc5d8d1d6c467b11','test_registry.py':'da3bad2c5786265eeced81f3b6efe72d3e3374fbbc051a875686370b8f16d687','REGISTRY.md':'64b01892fe309a617865331a0a958e78f39eabcadc6afaeff7b79f264fc292a0'}
spec=importlib.util.spec_from_file_location('diagnostic38_unchanged_registry_for_local_reconcile',HERE/'registry.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
need=r.need;sha=r.sha;load=r.load
CLAIM=r.phase('daemon','prepare-reconcile.claim.json')

def failed_receipt():
 raw=load(ROOT/FAILED);need(sha(raw)==FAILED_SHA);v=json.loads(raw)
 need(v['schema_version']=='1.0'and v['result']=='unconfirmed'and v['failure_code']=='TRANSPORT_UNCONFIRMED'
  and v['action']=='prepare'and v['kind']=='daemon'and v['run']==r.RUN and v['source_sha256']==r.SOURCE
  and v['project_id']==r.PROJECT and v['team_id']==r.TEAM and v['export']==EXPORT and v['claim_retained']is True
  and v['provider_mutations']is False and v['credentials_extracted']is False and v['db_jobs_or_openai_n8n_calls']is False and v['worker_deployed']is False)
 need(type(v['source_pins'])is dict and len(v['source_pins'])==30)
 return v

def source_pins():
 failure=failed_receipt();old=r.sources();need(old==failure['source_pins'])
 for name,pin in EXECUTED.items():need(sha(load(HERE/name))==pin)
 pins={**old,FAILED:FAILED_SHA}
 for name in ['daemon_prepare_reconcile.py','test_daemon_prepare_reconcile.py','DAEMON_PREPARE_RECONCILE.md']:pins[(HERE/name).relative_to(ROOT).as_posix()]=sha(load(HERE/name))
 return dict(sorted(pins.items()))

def validate_original_claim(value,expected_pins):
 need(type(value)is dict and set(value)=={'source_pins','export','local_extraction_may_have_occurred','automatic_retry'}
  and value['source_pins']==expected_pins and value['export']==EXPORT and value['local_extraction_may_have_occurred']is True and value['automatic_retry']is False)

def readonly_configs():
 # All files/folders must already exist. Do not call configs(), whose conditional
 # file creation belongs to the frozen old prepare path.
 for path in [r.PRIVATE,r.DOCKER_CONFIG]:need(path.is_dir()and not path.is_symlink()and path.resolve()==path)
 for path in [r.CONFIG,r.DOCKER_CONFIG/'config.json']:need(path.is_file()and not path.is_symlink()and path.resolve()==path)
 r.directory_acl(r.PRIVATE,False);r.directory_acl(r.DOCKER_CONFIG,False)
 r.private_security().verify(r.CONFIG);r.directory_acl(r.DOCKER_CONFIG/'config.json',False)
 config_raw=load(r.CONFIG,4096);docker_raw=load(r.DOCKER_CONFIG/'config.json',16384)
 need(config_raw==r.CONFIG_BYTES);docker=json.loads(docker_raw)
 need(type(docker)is dict and set(docker)=={'credsStore','auths'}and docker['credsStore']=='desktop'and docker['auths']in({}, {'vcr.vercel.com':{}}))
 return {'regctl_routing_sha256':sha(config_raw),'docker_helper_routing_sha256':sha(docker_raw),'existing_directory_and_file_ACLs_valid':True}

class LocalPorts:
 def pins(self):return source_pins()
 def claim_exists(self):return CLAIM.exists()
 def preflight(self,absent):
  need(type(absent)is bool);failure=failed_receipt();claim_path=r.phase('daemon','prepare.claim.json')
  claim=r.private_json(claim_path);validate_original_claim(claim,failure['source_pins'])
  v,ref=r.export_state('daemon');need(ref==EXPORT and v['runtime_digest']=='sha256:ce23af3ba163199c1e35f224f71a281ab450d7acfc0f4ab85b6044df5246431c'
   and v['archive']['archive_bytes']==111132672 and v['source']['file_count']==164 and v['source']['source_sha256']==r.SOURCE)
  config=readonly_configs();target=r.folder('daemon')
  if absent:need(not target.exists()and not target.is_symlink())
  else:need(target.is_dir()and target.resolve()==target and not target.is_symlink());r.verify_directory('daemon',v['archive'])
  return {'original_receipt_sha256':FAILED_SHA,'original_claim_sha256':sha(load(claim_path)),
   'export':ref,'export_archive_sha256':v['archive']['archive_sha256'],'runtime_digest':v['runtime_digest'],
   'source_sha256':r.SOURCE,'file_count':164,'target_absent':absent,'configs':config}
 def claim(self,value):r.private_write(CLAIM,value)
 def extract(self):
  # The sole extraction destination is the previously absent daemon OCI tree.
  v,ref=r.export_state('daemon');need(ref==EXPORT)
  proof=r.b.mechanisms().archive_proof(r.b.artifact('daemon','export.tar'),r.folder('daemon'))
  need(proof==v['archive']);r.verify_directory('daemon',proof)
  return {'archive_sha256':proof['archive_sha256'],'runtime_digest':proof['runtime_digest'],'blobs_verified':proof['blobs_verified']}
 def old_prepared(self):
  # The unchanged old gate has optional config creation. For this read only,
  # deny that seam in memory; missing files must fail rather than be recreated.
  # No executed source file or permission guard is changed.
  readonly_configs();original=r.private_write
  def deny_write(*_args,**_kwargs):need(False)
  try:r.private_write=deny_write;v,ref=r.Ports().prepared('daemon')
  finally:r.private_write=original
  need(ref==EXPORT)
  return {'export':ref,'runtime_digest':v['runtime_digest'],'file_count':v['source']['file_count']}
 def save(self,value):
  path=r.EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-daemon-local-prepare-reconcile.json')
  r.b.exclusive(path,{'schema_version':'1.0','observed_at':r.stamp(),'run':r.RUN,'source_sha256':r.SOURCE,'action':'local_daemon_prepare_reconcile','kind':'daemon',
   'original_receipt':{'path':FAILED,'sha256':FAILED_SHA,'result':'unconfirmed'},'original_claim_replayed':False,'original_receipt_or_claim_overwritten':False,
   'Set_Acl_invoked':False,'existing_directory_acl_writes':False,'provider_called':False,'login_or_registry_copy_called':False,'worker_deployed':False,
   'db_jobs_or_openai_n8n_calls':False,'raw_logs_or_credentials_persisted':False,**value})
  return {'result':value['result'],'receipt':path.relative_to(ROOT).as_posix(),'claim_retained':True}

def reconcile(ports=None):
 need(RECONCILE_ENABLED);p=LocalPorts()if ports is None else ports
 pins=p.pins();before=p.preflight(True);need(not p.claim_exists())
 p.claim({'purpose':'exact-daemon-prepare-local-forward-reconciliation','source_pins':pins,'before':before,'original_receipt':{'path':FAILED,'sha256':FAILED_SHA},
  'local_extraction_may_have_occurred':True,'automatic_retry':False,'provider_operations_authorized':False})
 result={'result':'unconfirmed','source_pins':pins,'before':before,'new_claim_retained':True,'normal_extraction_return_observed':False,'old_registry_prepared_admitted':False,'original_unconfirmed_outcome_preserved':True}
 try:
  need(p.pins()==pins and p.preflight(True)==before)
  proof=p.extract();result['normal_extraction_return_observed']=True
  after=p.preflight(False);expected={**before,'target_absent':False};need(after==expected and p.pins()==pins)
  need(proof['archive_sha256']==before['export_archive_sha256']and proof['runtime_digest']==before['runtime_digest'])
  admitted=p.old_prepared();need(admitted=={'export':EXPORT,'runtime_digest':before['runtime_digest'],'file_count':164})
  need(p.preflight(False)==after and p.pins()==pins)
  result.update(result='passed',after=after,local_extraction=proof,old_registry_prepared_admitted=True)
 except Exception:result['failure_code']='DAEMON_LOCAL_PREPARATION_RECONCILIATION_UNCONFIRMED'
 return p.save(result)

def main():
 need(RECONCILE_ENABLED and len(sys.argv)==1);value=reconcile();print(json.dumps(value));need(value['result']=='passed')

if __name__=='__main__':
 try:main()
 except Exception:print('DAEMON_LOCAL_PREPARATION_RECONCILIATION_UNCONFIRMED');sys.exit(1)
