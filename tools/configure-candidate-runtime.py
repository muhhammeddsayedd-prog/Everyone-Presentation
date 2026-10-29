"""Explicit protected local candidate flag, after verified fixed17 DB activation.

Default --dry-run is read-only. Root separately invokes --enable. No new secret,
provider/cloud/workflow operation or process launch. Existing bytes stay exact
except the single false->true flag; failed/unknown outcomes remain journaled.
"""
import datetime, hashlib, importlib.util, json, os, re, sys, uuid
from pathlib import Path
from provision_logo_verifier import ROOT, WindowsPrivateFiles

spec=importlib.util.spec_from_file_location('candidate_activation',ROOT/'tools/configure-candidate-pipeline.py')
activation=importlib.util.module_from_spec(spec);spec.loader.exec_module(activation)
FILE=ROOT/'.env.candidate-runtime.local'
PROVIDER=ROOT/'.env.worker.local'
PRIVATE=ROOT/'.local/candidate-runtime'
DRY=PRIVATE/'local-enable-dry-run.json'
CLAIM=PRIVATE/'local-enable.claim.json'
EVIDENCE=ROOT/'tracking/evidence/m03/candidate-activation'
IMAGE='sha256:59b6728cdbf37a54b466239020839936d78ccd10eec2e964f9d1af78cb7cc0ed'
FIELDS={'EPS_CANDIDATE_MEDIA_ENABLED','EPS_MEDIA_IMAGE_ID','OPENAI_TRANSCRIPTION_MODEL',
 'N8N_CANDIDATE_DISPATCH_URL','N8N_CANDIDATE_DISPATCH_SECRET'}


def require(value):
    if not value:raise ValueError('FIXED_LOCAL_CANDIDATE_ACTIVATION_UNCONFIRMED')


def sha(value):return hashlib.sha256(value).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc)


def checked_config(data):
    require(isinstance(data,bytes) and 0<len(data)<=4096)
    text=data.decode('utf8');values={}
    for line in text.splitlines():
        require(re.fullmatch(r'[A-Z][A-Z0-9_]*=[^\r\n\0]+',line) is not None)
        key,value=line.split('=',1);require(key not in values);values[key]=value
    require(set(values)==FIELDS and values['EPS_CANDIDATE_MEDIA_ENABLED']=='false'
      and values['EPS_MEDIA_IMAGE_ID']==IMAGE and values['OPENAI_TRANSCRIPTION_MODEL']=='gpt-transcribe'
      and re.fullmatch(r'[a-f0-9]{64}',values['N8N_CANDIDATE_DISPATCH_SECRET']) is not None
      and re.fullmatch(r'https://[A-Za-z0-9.-]+/webhook/eps-wf02-candidate-stage-v1',values['N8N_CANDIDATE_DISPATCH_URL']) is not None)
    require(data.count(b'EPS_CANDIDATE_MEDIA_ENABLED=false\n')==1)
    return values


def extraction_model(data):
    require(0<len(data)<=64*1024)
    matches=re.findall(r'^\s*OPENAI_EXTRACTION_MODEL\s*=\s*([^\r\n]*)',data.decode('utf-8-sig'),re.M)
    require(len(matches)==1 and matches[0].strip().strip('\"\'')=='gpt-6.1-sol'
      and os.environ.get('OPENAI_EXTRACTION_MODEL','gpt-6.1-sol') in ('','gpt-6.1-sol'))


def read_protected(security,file,maximum):
    security.verify(file)
    with file.open('rb') as handle:
        security.verify_open(handle);data=handle.read(maximum+1);security.verify_open(handle)
    require(len(data)<=maximum);return data


def verified_cloud_receipt(name):
    require(re.fullmatch(r'[0-9TZA-Za-z-]{10,100}-enable\.json',name) is not None and Path(name).name==name)
    data=(EVIDENCE/name).read_bytes();value=json.loads(data)
    require(value['target']==activation.TARGET and value['result']=='passed' and value['action']=='enable'
      and value['configuration_enabled_verified'] is True and value['all_other_catalog_runtime_business_hashes_unchanged'] is True
      and value['credentials_changed'] is False and value['local_flags_changed'] is False)
    sealed=activation.inputs(value['inputs']['reconciliation_receipt']);require(sealed==value['inputs'])
    activation.compare_activation(value['before'],value['after'],value['activation'])
    require(0<=(now()-datetime.datetime.fromisoformat(value['finished_at'])).total_seconds()<=3600)
    return sha(data)


def main():
    action,name=activation.arguments(sys.argv[1:]);receipt_hash=verified_cloud_receipt(name)
    require(not CLAIM.exists())
    security=WindowsPrivateFiles();before=read_protected(security,FILE,4096)
    values=checked_config(before);extraction_model(read_protected(security,PROVIDER,64*1024))
    journal=json.loads((PRIVATE/'n8n-bootstrap.json').read_bytes())
    require(journal['status']=='published' and journal['secret_sha256']==sha(values['N8N_CANDIDATE_DISPATCH_SECRET'].encode())
      and journal['target_origin']+'/webhook/eps-wf02-candidate-stage-v1'==values['N8N_CANDIDATE_DISPATCH_URL'])
    private_state={'cloud_receipt':name,'cloud_receipt_sha256':receipt_hash,'configuration_sha256':sha(before),
      'helper_sha256':sha(Path(__file__).read_bytes())}
    report={'observed_at':now().isoformat(),'action':action,'result':'failed','target':activation.TARGET,
      'cloud_receipt':name,'provider_called':False,'cloud_called':False,'credentials_changed':False,
      'process_started':False,'public_listener_started':False,'hosting_deferred':True,'local_flag_changed':False}
    if action=='dry-run':
        require(not DRY.exists())
        with security.create(DRY) as handle:
            handle.write(json.dumps({**private_state,'created_at':now().isoformat()}).encode());handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
    else:
        prior=json.loads(read_protected(security,DRY,8192))
        require({key:prior[key] for key in private_state}==private_state
          and 0<=(now()-datetime.datetime.fromisoformat(prior['created_at'])).total_seconds()<=900)
        with security.create(CLAIM) as handle:
            handle.write(json.dumps({'status':'attempting','at':now().isoformat(),'automatic_retry':False}).encode());handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
        after=before.replace(b'EPS_CANDIDATE_MEDIA_ENABLED=false\n',b'EPS_CANDIDATE_MEDIA_ENABLED=true\n',1)
        with FILE.open('r+b') as handle:
            security.verify_open(handle);require(handle.read()==before);handle.seek(0);handle.write(after);handle.truncate();handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
        require(read_protected(security,FILE,4096)==after)
        report['local_flag_changed']=True
    report['result']='passed';report['models_verified']={'transcription':'gpt-transcribe','extraction':'gpt-6.1-sol'}
    EVIDENCE.mkdir(parents=True,exist_ok=True);file=EVIDENCE/(now().strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-local-'+action+'.json')
    file.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'result':'passed','action':action,'local_flag_changed':report['local_flag_changed'],'receipt':file.relative_to(ROOT).as_posix(),
      'credentials_changed':False,'process_started':False,'cloud_called':False}))


if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed local candidate activation stopped. Preserve private claims; no credentials or raw diagnostics are printed.\n');sys.exit(1)
