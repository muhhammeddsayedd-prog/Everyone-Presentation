"""Read-only fixed failed-job diagnosis: allowlisted codes and asset counts only."""
import datetime,hashlib,json,re,sys,uuid
from release_foundation import ROOT,TARGET,call
SQL='tools/sql/m03-third-job-diagnostic.sql'
SEAL='5abae6f3f2bdcecd167a079a36d2ad70c770696726479cb25e61fcdd696d38c6'
CLI_SEAL='02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751'
JOB='237d0b59-4763-4229-ba32-f04fe2f29c79'
FIELDS=set(('observed_at query_role database job grants derivatives protected_m02 job_id workspace_id status stage current_attempt_id input_sha256 known_error_code error_retryable stage_attempts completed_stage_count private_payload_count transcription_payload_present attempt_id permission purpose grant_count revoked_count expired_count asset_count checksummed_assets minimum_size_bytes maximum_size_bytes minimum_timestamp_ms maximum_timestamp_ms still_waiting manual_note_retained prepare_candidate transcribe_candidate extract_candidate select_frames apply_candidate').split())
ENUMS=set(('postgres failed transcribe_candidate prepare_candidate extract_candidate select_frames apply_candidate UNOBSERVED read write candidate_video audio candidate_frame transcript uploading ready quarantined archived SOURCE_UNREADABLE RESULT_INVALID EXTRACTION_REFUSED PROVIDER_RATE_LIMITED DEPENDENCY_UNAVAILABLE PROCESSING_FAILED INPUT_CHANGED CAPABILITY_REQUIRED JOB_CANCELLED RETRY_EXHAUSTED UNRECOGNIZED').split())
def require(value):
 if not value:raise ValueError('FIXED_M03_THIRD_DIAGNOSTIC_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def validate(value):
 require(isinstance(value,dict) and set(value)==set('observed_at query_role database job grants derivatives protected_m02'.split()) and value['query_role']==value['database']=='postgres')
 require(value['job']['job_id']==JOB and value['job']['workspace_id']=='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and value['job']['status']=='failed' and value['job']['stage']=='transcribe_candidate')
 def walk(item,key='',depth=0):
  require(depth<=8)
  if isinstance(item,dict):
   require(set(item)<=FIELDS)
   for name,child in item.items():walk(child,name,depth+1)
  elif isinstance(item,list):
   require(len(item)<=64)
   for child in item:walk(child,key,depth+1)
  elif item is None or type(item) is bool:return
  elif type(item) is int:require(0<=item<=9007199254740991)
  elif isinstance(item,str):
   if key.endswith('_id'):require(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',item))
   elif key.endswith('_sha256'):require(re.fullmatch(r'[a-f0-9]{64}',item))
   elif key.endswith('_at'):require(datetime.datetime.fromisoformat(item.replace('Z','+00:00')).tzinfo is not None)
   else:require(item in ENUMS)
  else:require(False)
 walk(value);return value
def main():
 require(sys.argv[1:]==[] and (ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 require(sha((ROOT/SQL).read_bytes())==SEAL and sha((ROOT/'tools/release_foundation.py').read_bytes())==CLI_SEAL)
 receipt={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'unconfirmed','job_id':JOB,'read_only':True,'sql_sha256':SEAL,
  'harness_sha256':sha((ROOT/'tools/capture-m03-third-job-diagnostic.py').read_bytes()),'provider_called':False,'storage_http_called':False,'mutations_requested':False,'grant_digests_or_private_content_recorded':False}
 try:
  result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
  require(result.returncode==0 and len(result.stdout.encode())<=128*1024)
  rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'diagnostic'})
  receipt['proof']=validate(rows[0]['diagnostic']);receipt['result']='captured'
 except Exception:receipt['code']='FIXED_M03_THIRD_DIAGNOSTIC_UNCONFIRMED'
 finally:
  directory=ROOT/'tracking/evidence/m03/third-job-diagnostic';directory.mkdir(parents=True,exist_ok=True)
  file=directory/(receipt['observed_at'].replace(':','-').replace('.','-')+'-'+uuid.uuid4().hex[:8]+'.json')
  file.open('x',encoding='utf8').write(json.dumps(receipt,indent=2)+'\n')
  print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(ROOT).as_posix(),'job':receipt.get('proof',{}).get('job'),'grant_digests_or_private_content_recorded':False}))
 return 0 if receipt['result']=='captured' else 1
if __name__=='__main__':
 try:sys.exit(main())
 except Exception:sys.stderr.write('Fixed third-job read-only diagnosis stopped; private diagnostics suppressed.\n');sys.exit(1)
