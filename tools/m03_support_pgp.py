"""Server-generated verifier bootstrap with public-only CLI SQL inputs.

No credential lookup, private SQL parameter, role/logging/grant change or key
rotation. Importing is inert. Root explicitly executes after local crypto proof.
"""
import argparse,copy,hashlib,hmac,inspect,json,os,re,secrets,subprocess,sys,uuid
from pathlib import Path
import m03_remaining_activation as a
PRIVATE=a.ROOT/'.local/m03-support-pgp'
EVIDENCE=a.ROOT/'tracking/evidence/m03/support-pgp-bootstrap'
BOOTSTRAP='tools/sql/m03-support-pgp-bootstrap-template.sql'
RECOVER='tools/sql/m03-support-pgp-recover-template.sql'
CRYPTO='tools/private-key-bootstrap/bootstrap.mjs'
NODE=Path('C:/Program Files/nodejs/node.exe')
META_FIELDS=a.META_FIELDS

def compile_sql(template,bundle,versions):
    public=bundle['public_key'];nonce=bundle['nonce']
    a.require(isinstance(public,str)and len(public)<=16384 and public.startswith('-----BEGIN PGP PUBLIC KEY BLOCK-----\n')
      and public.rstrip().endswith('-----END PGP PUBLIC KEY BLOCK-----')and'PRIVATE KEY BLOCK'not in public and all(ord(c)<128 for c in public)
      and re.fullmatch(r'[a-f0-9]{32}',nonce)is not None and len(versions)==19 and versions==sorted(set(versions))
      and all(re.fullmatch(r'[0-9]{14}',v)is not None for v in versions)
      and set(re.findall(r'__[A-Z_]+__',template))in({'__PUBLIC_HEX__','__NONCE__','__VERSIONS__'},{'__PUBLIC_HEX__','__NONCE__','__VERSIONS__','__CONSTRAINT_SHA__'}))
    if '__CONSTRAINT_SHA__'in template:a.require(a.is_hash(bundle['constraints_sha256']))
    return template.replace('__PUBLIC_HEX__',public.encode('ascii').hex()).replace('__NONCE__',nonce).replace('__VERSIONS__',','.join("'"+v+"'"for v in versions)).replace('__CONSTRAINT_SHA__',bundle.get('constraints_sha256',''))
def constraints_hash(state):
    rows=sorted((v for v in state['catalog']['constraints']if v['table']=='eps.support_verification_keys'),key=lambda v:v['name']);a.require(len(rows)>=4)
    return a.sha('\n'.join(v['name']+'\n'+v['definition']for v in rows).encode())
def compare_key_delta(before,after,metadata):
    a.validate_protected(before);a.validate_protected(after);a.validate_metadata(metadata)
    a.require(before['remaining']['support_config']==after['remaining']['support_config']==a.SUPPORT_DISABLED)
    old,new=copy.deepcopy(before),copy.deepcopy(after);keys=old['remaining']['support_verification_keys'];a.require(not any(k['key_id']==a.KEY_ID for k in keys))
    a.require(new['remaining']['support_verification_keys']==sorted([*keys,metadata],key=lambda k:k['key_id']));new['remaining']['support_verification_keys']=keys
    a.require(new['counts']['eps.support_verification_keys']==old['counts']['eps.support_verification_keys']+1);new['counts']['eps.support_verification_keys']=old['counts']['eps.support_verification_keys']
    x=old['data_sha256'].pop(a.KEY_META);y=new['data_sha256'].pop(a.KEY_META);a.require(a.is_hash(x)and a.is_hash(y)and x!=y and old==new)
def closed_scope(state,release):
    a.validate_protected(state);a.require(state['remaining']['support_config']==a.SUPPORT_DISABLED)
    for field in('catalog','runtime','source_config'):a.require(state[field]==release['readback'][field])
    # Any unexpected user trigger could log a generated row in error details.
    a.require(not any(t['table']=='eps.support_verification_keys'for t in state['catalog']['triggers']))
def crypto(payload,seals):
    env={k:os.environ[k]for k in('PATH','Path','SystemRoot','WINDIR','TEMP','TMP')if k in os.environ}
    require_sources(seals)
    result=subprocess.run([str(NODE),str(a.ROOT/CRYPTO)],input=json.dumps(payload),capture_output=True,text=True,encoding='utf8',errors='strict',timeout=90,env=env,cwd=a.ROOT)
    a.require(result.returncode==0 and 0<len(result.stdout.encode())<=65536 and not result.stderr);return json.loads(result.stdout)
def sources():
    return{f:a.sha((a.ROOT/f).read_bytes())for f in('tools/m03_support_pgp.py','tools/provision-m03-support-pgp.py','tools/m03_remaining_activation.py','tools/provision_logo_verifier.py','tools/release_foundation.py',BOOTSTRAP,RECOVER,CRYPTO,'tools/private-key-bootstrap/package.json','tools/private-key-bootstrap/package-lock.json')}
def held_source(file,seals):
    value=(a.ROOT/file).read_bytes();a.require(a.sha(value)==seals[file]);return value.decode('utf8')
def require_sources(seals):a.require(sources()==seals)
def dispatch_bootstrap(path,seals,report,write):
    require_sources(seals);report['cloud_write_attempted']=write
    return a.call_sql(path,'support_bootstrap')
def replace_unused(security,old,new_hex,seals):
    require_sources(seals);return write_unused_configuration(security,old,new_hex)
def local_proof():
    value=a.public_json(EVIDENCE/'local-pgp-proof.json');a.require(value['result']=='passed'and value['cloud_called']is False and value['activation_private_configuration_read']is False
      and value['rollback_verified']is value['sources_stable']is value['actual_pgcrypto_openpgp_round_trip']is True
      and value['plaintext_absent_from_statement_statistics_and_error_output']is True
      and value['frame_enabled_preserved_during_bootstrap_and_recovery']is True
      and value['source_seals'][BOOTSTRAP]==a.sha((a.ROOT/BOOTSTRAP).read_bytes())and value['source_seals'][RECOVER]==a.sha((a.ROOT/RECOVER).read_bytes())
      and value['source_seals'][CRYPTO]==a.sha((a.ROOT/CRYPTO).read_bytes())and value['compiler_sha256']==a.sha(inspect.getsource(compile_sql).encode()))
def retain(report,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True);path=EVIDENCE/(a.now().strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');return path
def recipient(security):
    value=json.loads(a.protected_read(security,PRIVATE/'recipient.json',65536));a.require(value['target']==a.TARGET and value['key_id']==a.KEY_ID)
    a.require(set(value)=={'target','key_id','public_key','private_key','public_fingerprint','recipient_id','nonce','constraints_sha256'}and a.is_hash(value['constraints_sha256']))
    return value
def attempt_path(value):
    a.require(isinstance(value,str)and value.endswith('-attempt.json'))
    path=a.receipt_path(EVIDENCE,Path(value).name);a.require(path.relative_to(a.ROOT).as_posix()==value)
    return path
def decode_response(value,bundle,seals):
    a.require(isinstance(value,dict)and set(value)=={'query_role','database','inserted_rows','key_metadata','recipient_key_id','ciphertext','nonce_hmac'}
      and value['query_role']==value['database']=='postgres'and str(value['recipient_key_id']).lower()==bundle['recipient_id'])
    a.validate_metadata(value['key_metadata'])
    key=crypto({'action':'decrypt','payload':{**bundle,'ciphertext':value['ciphertext'],'nonce_hmac':value['nonce_hmac']}},seals)
    a.require(set(key)=={'key_hex'}and re.fullmatch(r'[a-f0-9]{64}',key['key_hex'])is not None
      and hmac.compare_digest(hmac.new(bytes.fromhex(key['key_hex']),bundle['nonce'].encode(),hashlib.sha256).hexdigest(),value['nonce_hmac']))
    return key['key_hex']
def write_unused_configuration(security,old,new_hex):
    old_hex=a.parse_support(old);current=a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024)
    after=old.replace(('EPS_SUPPORT_VERIFIER_KEY_HEX='+old_hex+'\n').encode(),('EPS_SUPPORT_VERIFIER_KEY_HEX='+new_hex+'\n').encode(),1)
    a.require(a.parse_support(after)==new_hex)
    if current==after:return False
    a.require(current==old)
    with(a.ROOT/'.env.support-runtime.local').open('r+b')as handle:
        security.verify_open(handle);a.require(handle.read()==old);handle.seek(0);handle.write(after);handle.truncate();handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
    a.require(a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024)==after);return True

def main():
    parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True)
    for flag in('--dry-run','--provision','--recover'):group.add_argument(flag,action='store_true')
    parser.add_argument('--release',required=True);args=parser.parse_args();action='recover'if args.recover else'provision'if args.provision else'dry-run'
    from provision_logo_verifier import WindowsPrivateFiles
    module,release_inputs,release,release_hash=a.load_release(args.release);security=WindowsPrivateFiles();PRIVATE.mkdir(parents=True,exist_ok=True);a.PRIVATE.mkdir(parents=True,exist_ok=True)
    report={'observed_at':a.now().isoformat(),'target':a.TARGET,'result':'failed','action':action,'release_receipt':args.release,'release_receipt_sha256':release_hash,
      'source_seals':sources(),'cloud_write_attempted':False,'local_unused_key_replaced':False,'flags_changed':False,'provider_called':False,'automatic_retry':False,'secret_recorded':False,'private_sql_inputs':False}
    try:
        templates={file:held_source(file,report['source_seals'])for file in(BOOTSTRAP,RECOVER)}
        before=a.inspect(module,release);closed_scope(before,release);report['before']=before
        claim=PRIVATE/'bootstrap.claim.json'
        if action=='recover':
            local_proof();a.require(claim.exists());intent=json.loads(a.protected_read(security,claim,65536));bundle=recipient(security)
            a.require(intent['source_seals']==report['source_seals']and intent['release_sha256']==release_hash and intent['recipient_sha256']==a.sha(a.protected_read(security,PRIVATE/'recipient.json',65536)))
            attempt_file=attempt_path(intent['attempt_receipt']);attempt=a.public_json(attempt_file)
            a.require(a.sha(attempt_file.read_bytes())==intent['attempt_sha256']and attempt['result']=='attempting'and attempt['action']=='provision'and attempt['target']==a.TARGET
              and attempt['source_seals']==report['source_seals']and attempt['release_receipt_sha256']==release_hash
              and not any(k['key_id']==a.KEY_ID for k in attempt['before']['remaining']['support_verification_keys']))
            old=a.protected_read(security,PRIVATE/'unused-support-before.env',1024);a.parse_support(old)
        else:
            a.require(not claim.exists()and not any(k['key_id']==a.KEY_ID for k in before['remaining']['support_verification_keys']))
            old=a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024);a.parse_support(old)
            inputs={'release_sha256':release_hash,'release_inputs':release_inputs,'source_seals':report['source_seals'],'before_sha256':a.sha(json.dumps(before,sort_keys=True).encode()),'unused_configuration_sha256':a.sha(old)}
        if action=='dry-run':
            after=a.inspect(module,release);a.require(before==after);report['after']=after;a.dry_run(security,'support-pgp',inputs,write=True)
        else:
            if action=='provision':
                local_proof();a.dry_run(security,'support-pgp',inputs);a.require(not(PRIVATE/'recipient.json').exists());bundle={**crypto({'action':'generate'},report['source_seals']),'nonce':secrets.token_hex(16),'target':a.TARGET,'key_id':a.KEY_ID,'constraints_sha256':constraints_hash(before)}
                a.protected_write(security,PRIVATE/'recipient.json',json.dumps(bundle).encode());a.protected_write(security,PRIVATE/'unused-support-before.env',old)
                attempt=retain({**report,'result':'attempting','before':before},'attempt');intent={'at':a.now().isoformat(),'release_sha256':release_hash,'source_seals':report['source_seals'],'recipient_sha256':a.sha(a.protected_read(security,PRIVATE/'recipient.json',65536)),'attempt_receipt':attempt.relative_to(a.ROOT).as_posix(),'attempt_sha256':a.sha(attempt.read_bytes()),'automatic_retry':False}
                a.protected_write(security,claim,json.dumps(intent).encode())
            template=RECOVER if action=='recover'else BOOTSTRAP;sql=compile_sql(templates[template],bundle,before['versions']);path=PRIVATE/(action+'-public-only-'+uuid.uuid4().hex+'.sql');a.protected_write(security,path,sql.encode())
            value=dispatch_bootstrap(path,report['source_seals'],report,action=='provision');a.require(value['inserted_rows']==(0 if action=='recover'else 1))
            after=a.inspect(module,release);closed_scope(after,release);report['after']=after
            if action=='recover':a.require(before==after);report['original_at_apply_whole_business_preservation_unverified']=True
            else:compare_key_delta(before,after,value['key_metadata']);report['other_business_catalog_runtime_and_config_unchanged']=True
            a.require([k for k in after['remaining']['support_verification_keys']if k['key_id']==a.KEY_ID]==[value['key_metadata']])
            new_hex=decode_response(value,bundle,report['source_seals']);a.protected_write(security,PRIVATE/('encrypted-response-'+uuid.uuid4().hex+'.json'),json.dumps(value).encode())
            report['local_unused_key_replaced']=replace_unused(security,old,new_hex,report['source_seals']);report['nonce_hmac_verified']=True;report['key_matches_canonical_ciphertext']=True
        report['support_still_disabled']=True;report['result']='passed'
    finally:
        report['finished_at']=a.now().isoformat();path=retain(report,action);print(json.dumps({'result':report['result'],'action':action,'receipt':path.relative_to(a.ROOT).as_posix(),'cloud_write_attempted':report['cloud_write_attempted'],'local_unused_key_replaced':report['local_unused_key_replaced'],'automatic_retry':False,'secret_recorded':False}))
