"""Shared bounded guards for the author-reviewed19 activation commands.

Importing performs no filesystem, cloud, configuration or process mutation.
Private key bytes/configuration hashes are never included in public receipts.
"""
import copy,datetime,hashlib,importlib.util,inspect as python_inspect,json,os,re,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TARGET='pyibofyctwnqpvktepse'
MIGRATION='20261029135318_m03_frame_request_resubmission.sql'
MIGRATION_SHA='e816ad6b491626ace489efd256b56c322d25d9101de94e5fb8b24d2d4b745048'
MIGRATIONS=[{'migration':'20261029133455_m03_remaining_media_library.sql','sha256':'2e190e001b2bda044d9c90da4287f54e5839b0af7ffec84d4c93083909c944fb'},
 {'migration':MIGRATION,'sha256':MIGRATION_SHA}]
IMAGE='sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'
KEY_ID='eps-candidate-support-local-20261029-v1'
PROTECTED='b3f90268-147d-41d4-8875-2a6435df1496'
PRIVATE=ROOT/'.local/m03-remaining-activation'
EVIDENCE=ROOT/'tracking/evidence/m03/remaining-activation'
FRAME_DISABLED={'id':True,'enabled':False,'native_image_id':None,'implementation_version':'frame-extraction.v1'}
FRAME_ENABLED={**FRAME_DISABLED,'enabled':True,'native_image_id':IMAGE}
SUPPORT_DISABLED={'id':True,'uploads_enabled':False}
SUPPORT_ENABLED={'id':True,'uploads_enabled':True}
KEY_META='eps.support_verification_keys:metadata'
META_FIELDS={'key_id','purpose','not_before','not_after','revoked_at','created_at'}

class ActivationError(Exception):
    def __init__(self):super().__init__('M03_REMAINING_ACTIVATION_UNCONFIRMED')
def require(value):
    if not value:raise ActivationError()
def sha(data):return hashlib.sha256(data).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc)
def is_hash(value):return isinstance(value,str)and re.fullmatch(r'[a-f0-9]{64}',value)is not None
def parse_support(data,enabled=False):
    require(isinstance(data,bytes)and len(data)<=1024)
    match=re.fullmatch(rb'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED='+str(enabled).lower().encode()+rb'\nEPS_SUPPORT_VERIFIER_KEY_ID='+KEY_ID.encode()+rb'\nEPS_SUPPORT_VERIFIER_KEY_HEX=([a-f0-9]{64})\n',data)
    require(match is not None);return match[1].decode('ascii')
def parse_frame(data,enabled=False):
    require(data==f'EPS_FRAME_EXTRACTION_ENABLED={str(enabled).lower()}\nEPS_FRAME_IMAGE_ID={IMAGE}\n'.encode());return IMAGE
def validate_protected(state):
    require(state['query_role']==state['database']=='postgres'and state['unrestricted_visibility']is True)
    p=state['protected_m02'];require(p['job_id']==PROTECTED and p['job_exists']is True and p['manual_note_retained']is True
      and all(is_hash(p[k])for k in('job_sha256','specs_sha256','source_inputs_sha256'))
      and re.fullmatch(r'[a-f0-9-]{36}',p['specs_id'])is not None)
def validate_metadata(value):
    require(isinstance(value,dict)and set(value)==META_FIELDS and value['key_id']==KEY_ID and value['purpose']=='candidate_support'
      and value['not_after']is None and value['revoked_at']is None and isinstance(value['not_before'],str)and isinstance(value['created_at'],str))
def disabled(state):
    validate_protected(state);require(state['remaining']['frame_config']==FRAME_DISABLED and state['remaining']['support_config']==SUPPORT_DISABLED)
def enabled(state):
    validate_protected(state);require(state['remaining']['frame_config']==FRAME_ENABLED and state['remaining']['support_config']==SUPPORT_ENABLED)
def compare_key_provision(before,after,metadata):
    disabled(before);disabled(after);validate_metadata(metadata)
    old,new=copy.deepcopy(before),copy.deepcopy(after);keys=old['remaining']['support_verification_keys']
    require(all(k['key_id']!=KEY_ID for k in keys))
    require(new['remaining']['support_verification_keys']==sorted([*keys,metadata],key=lambda k:k['key_id']))
    new['remaining']['support_verification_keys']=keys
    require(new['counts']['eps.support_verification_keys']==old['counts']['eps.support_verification_keys']+1)
    new['counts']['eps.support_verification_keys']=old['counts']['eps.support_verification_keys']
    old_hash=old['data_sha256'].pop(KEY_META);new_hash=new['data_sha256'].pop(KEY_META)
    require(is_hash(old_hash)and is_hash(new_hash)and old_hash!=new_hash and old==new)
def compare_activation(before,after):
    disabled(before);enabled(after)
    require(any(k['key_id']==KEY_ID for k in before['remaining']['support_verification_keys']))
    old,new=copy.deepcopy(before),copy.deepcopy(after)
    new['remaining']['frame_config']=old['remaining']['frame_config'];new['remaining']['support_config']=old['remaining']['support_config']
    for key in('eps.frame_extraction_config','eps.candidate_support_config'):
        a=old['data_sha256'].pop(key);b=new['data_sha256'].pop(key);require(is_hash(a)and is_hash(b)and a!=b)
    require(old==new)
def compare_frame_activation(before,after):
    disabled(before);validate_protected(after)
    require(after['remaining']['frame_config']==FRAME_ENABLED and after['remaining']['support_config']==SUPPORT_DISABLED)
    old,new=copy.deepcopy(before),copy.deepcopy(after);new['remaining']['frame_config']=old['remaining']['frame_config']
    previous=old['data_sha256'].pop('eps.frame_extraction_config');current=new['data_sha256'].pop('eps.frame_extraction_config')
    require(is_hash(previous)and is_hash(current)and previous!=current and old==new)
def render_sql(template,key_hex,versions,action):
    require(isinstance(template,str)and len(template.encode())<64*1024 and re.fullmatch(r'[a-f0-9]{64}',key_hex)is not None
      and len(versions)==19 and versions==sorted(set(versions))and all(re.fullmatch(r'[0-9]{14}',v)is not None for v in versions)
      and action in('inspect','provision','enable'))
    require(set(re.findall(r'__[A-Z_]+__',template))=={'__KEY_HEX__','__VERSIONS__','__ACTION__'})
    result=template.replace('__KEY_HEX__',key_hex).replace('__VERSIONS__',','.join("'"+v+"'"for v in versions)).replace('__ACTION__',action)
    if action=='inspect':require(result.count('\nbegin;')==1);result=result.replace('\nbegin;','\nbegin read only;',1)
    return result
def public_json(path,maximum=16*1024*1024):
    require(path.is_file()and not path.is_symlink()and path.stat().st_size<=maximum);return json.loads(path.read_bytes())
def receipt_path(directory,name):
    require(isinstance(name,str)and re.fullmatch(r'[0-9A-Za-zT_+.-]{10,160}\.json',name)is not None and Path(name).name==name)
    path=directory/name;require(path.resolve().parent==directory.resolve());return path
def load_release(name):
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    spec=importlib.util.spec_from_file_location('m03_remaining_release',ROOT/'tools/release_m03_remaining.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    inputs=module.current_release_inputs();path=receipt_path(ROOT/'tracking/evidence/cloud-m03-remaining',name);value=public_json(path)
    require(value['result']=='passed'and value['target']==TARGET and value['application_verified_by_readback']is True
      and value['migration']==MIGRATION and value['migration_sha256']==MIGRATION_SHA and value['runtime_execute_operations']==11
      and value['provider_called']is False and value['flags_changed']is False and value['inputs']==inputs and value['migrations']==MIGRATIONS)
    for entry in MIGRATIONS:require(sha((ROOT/'supabase/migrations'/entry['migration']).read_bytes())==entry['sha256'])
    require(len(inputs['versions'])==19 and inputs['versions'][-1]==MIGRATION[:14])
    validate_protected(value['readback']);return module,inputs,value,sha(path.read_bytes())
def inspect(module,release):
    state=module.inspect_state();validate_protected(state);require(state['versions']==release['readback']['versions']
      and state['protected_m02']==release['readback']['protected_m02']);return state
def protected_read(security,path,maximum):
    security.verify(path)
    with path.open('rb')as handle:
        security.verify_open(handle);data=handle.read(maximum+1);security.verify_open(handle)
    require(len(data)<=maximum);return data
def protected_write(security,path,data):
    with security.create(path)as handle:handle.write(data);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
def claim(security,name,inputs):
    path=PRIVATE/(name+'.claim.json');require(not path.exists());protected_write(security,path,json.dumps({'status':'dispatching','automatic_retry':False,'at':now().isoformat(),'inputs':inputs}).encode())
def dry_run(security,name,inputs,write=False):
    path=PRIVATE/(name+'.dry-run.json')
    if write:
        data=json.dumps({'at':now().isoformat(),'inputs':inputs}).encode()
        if path.exists():
            previous=protected_read(security,path,65536);protected_write(security,PRIVATE/(name+'.dry-run-retained-'+uuid.uuid4().hex+'.json'),previous)
            with path.open('r+b')as handle:
                security.verify_open(handle);require(handle.read()==previous);handle.seek(0);handle.write(data);handle.truncate();handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
        else:protected_write(security,path,data)
        return
    prior=json.loads(protected_read(security,path,65536));require(prior['inputs']==inputs and 0<=(now()-datetime.datetime.fromisoformat(prior['at'])).total_seconds()<=900)
def call_sql(path,field):
    from release_foundation import call
    # Do not log/save raw stdout/stderr: a server parse error can include literal SQL.
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json'])
    require(result.returncode==0);rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={field});return rows[0][field]
def admin_guard():
    value=call_sql(ROOT/'tools/sql/m03-remaining-admin-guard.sql','m03_remaining_admin')
    require(value['query_role']==value['database']=='postgres'and value['unrestricted_visibility']is True
      and value['literal_key_logging_safe']is True and value['key_privacy_verified']is True);return value
def local_template_proof():
    proof=public_json(ROOT/'tracking/evidence/m03/remaining-activation/template-local-proof.json')
    require(proof['result']=='passed'and proof['cloud_called']is proof['activation_private_configuration_read']is False
      and proof['rollback_verified']is proof['sources_stable']is True and proof['literal_canary_not_in_statement_statistics']is True
      and proof['synthetic_key_and_config_round_trip']is True and proof['template_sha256']==sha((ROOT/'tools/sql/m03-remaining-key-template.sql').read_bytes())
      and proof['admin_guard_sha256']==sha((ROOT/'tools/sql/m03-remaining-admin-guard.sql').read_bytes())
      and proof['compiler_sha256']==sha(python_inspect.getsource(render_sql).encode()))
    return proof
def private_key_query(security,key_hex,versions,action):
    local_template_proof()
    template=(ROOT/'tools/sql/m03-remaining-key-template.sql').read_text();sql=render_sql(template,key_hex,versions,action)
    path=PRIVATE/(action+'-'+uuid.uuid4().hex+'.sql');protected_write(security,path,sql.encode())
    value=call_sql(path,'m03_remaining_key')
    require(value['query_role']==value['database']=='postgres'and value['unrestricted_visibility']is True and value['privacy_verified']is True)
    return value
def key_matches(value):
    require(value['configured_key_exists']is True and value['key_matches']is True and value['key_active']is True and value['key_bytes']==32)
    validate_metadata(value['key_metadata'])
def retain(report,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True);path=EVIDENCE/(now().strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');return path
