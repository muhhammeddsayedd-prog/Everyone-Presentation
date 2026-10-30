"""Seal reviewed fixed29 local proof for the inert cloud helper. No CLI or DB access."""
import hashlib
import datetime
import json
from pathlib import Path
import re
import sys
import release_m07_29 as boundary
ROOT=Path(__file__).resolve().parents[1]
def sha(value):return hashlib.sha256(value).hexdigest()
def read(file):return json.loads((ROOT/file).read_bytes())
def sealed(file,digest):
 path=ROOT/file
 if path.resolve()!=path or path.is_symlink()or sha(path.read_bytes())!=digest:raise ValueError('M07_REVIEW_SOURCE_CHANGED')
def build_config(promotion_file,auth_file):
 for file,action in((promotion_file,'promote'),(auth_file,'auth-prerequisite')):
  if not re.fullmatch(r'tracking/evidence/m07/local29-promotion/[A-Za-z0-9_.-]+-'+action+r'\.json',file):raise ValueError('M07_LOCAL_RECEIPT_PATH_REQUIRED')
  value=read(file)
  if value['action']!=action or value['result']!='passed'or value['cloud_called']is not False or value['provider_called']is not False or value['sources_stable']is not True or value['lock_retained']is not False:raise ValueError('M07_PASSED_LOCAL_PROMOTION_REQUIRED')
 plan_path='development/m07/db/release29-plan.json';plan=read(plan_path)
 for file,digest in plan['source_seals'].items():sealed(file,digest)
 for key,digest_key in(('proof','proof_sha256'),('baseline','baseline_sha256'),('catalog_delta','catalog_delta_sha256'),('readback_query','readback_sha256'),('migration_path','migration_sha256')):sealed(plan[key],plan[digest_key])
 manifest=read('development/local-db/reviewed.json');baseline=read(plan['baseline'])
 if len(manifest['migrations'])!=29 or manifest['migrations'][:-1]!=baseline['migrations']or manifest['migrations'][-1]['path']!=plan['migration_path']:raise ValueError('M07_EXACT_REVIEWED29_REQUIRED')
 promotion=read(promotion_file)
 profile=boundary.load_original_profile(plan,{'path':boundary.PROFILE_REVIEW,'sha256':boundary.PROFILE_REVIEW_SHA})
 boundary.validate_local_promotion(promotion,profile,plan)
 source_paths=['development/m07/db/release29-admission.sql','tests/operations/test_m07_29_release.py','tools/freeze-m07-cloud29-review.py','tools/promote-m07-local29.mjs','tools/release_foundation.py','tools/provision_logo_verifier.py',promotion['promotion']['receipt']]
 config={'schema_version':'1.0','plan':{'path':plan_path,'sha256':sha((ROOT/plan_path).read_bytes())},'reviewed_manifest':{'path':'development/local-db/reviewed.json','sha256':sha((ROOT/'development/local-db/reviewed.json').read_bytes())},'promotion':{'path':promotion_file,'sha256':sha((ROOT/promotion_file).read_bytes())},'local_auth_prerequisite':{'path':auth_file,'sha256':sha((ROOT/auth_file).read_bytes())},'original_profile_review':{'path':boundary.PROFILE_REVIEW,'sha256':boundary.PROFILE_REVIEW_SHA},'source_seals':{file:sha((ROOT/file).read_bytes())for file in source_paths}}
 boundary.validate_release_config(config)
 return config
def main(arguments):
 prepare=len(arguments)==3 and arguments[0]=='prepare'
 if prepare:arguments=arguments[1:]
 if len(arguments)!=2:raise ValueError('EXACT_LOCAL_PROMOTION_AND_AUTH_RECEIPTS_REQUIRED')
 config=build_config(*arguments)
 payload=(json.dumps(config,indent=2)+'\n').encode();config_path=ROOT/'development/m07/db/release29-reviewed.json'
 helper=ROOT/'tools/release_m07_29.py';source=helper.read_text(encoding='utf8');needle="CONFIG_SHA = 'PENDING_ROOT_REVIEWED_LOCAL29_PROMOTION'"
 if source.count(needle)!=1:raise ValueError('M07_UNFROZEN_HELPER_REQUIRED')
 if prepare:
  prepared=ROOT/'development/m07/db'/('release29-cloud-review-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.prepared.json')
  with prepared.open('xb')as handle:handle.write(payload)
  print(json.dumps({'result':'prepared_unsealed','config':prepared.relative_to(ROOT).as_posix(),'config_sha256':sha(payload),'helper_sha256':sha(helper.read_bytes()),'cloud_called':False,'db_called':False,'helper_pin_changed':False}))
  return
 with config_path.open('xb')as handle:handle.write(payload)
 helper.write_text(source.replace(needle,"CONFIG_SHA = '"+sha(payload)+"'"),encoding='utf8',newline='\n')
 print(json.dumps({'result':'sealed','config':str(config_path.relative_to(ROOT)).replace('\\','/'),'config_sha256':sha(payload),'helper_sha256':sha(helper.read_bytes()),'cloud_called':False}))
if __name__=='__main__':main(sys.argv[1:])
