"""Support-only DB/local activation after encrypted key bootstrap.

Only public nonce/HMAC/history enter CLI SQL. Importing performs no I/O.
Frame/candidate configuration, private files and canonical data stay unchanged.
"""
import argparse,copy,hashlib,hmac,importlib.util,inspect,json,re,secrets,sys,uuid
import m03_remaining_activation as a
import m03_support_pgp as pgp
CHALLENGE='tools/sql/m03-support-hmac-template.sql'
ENABLE='tools/sql/m03-support-enable-template.sql'
SOURCE_FILES=('tools/configure-m03-support.py','tools/m03_remaining_activation.py','tools/configure-m03-remaining.py','tools/m03_support_pgp.py','tools/provision_logo_verifier.py','tools/release_foundation.py',CHALLENGE,ENABLE)
def sources():return{f:a.sha((a.ROOT/f).read_bytes())for f in SOURCE_FILES}
def require_sources(seals):a.require(sources()==seals)
def dispatch_enable(path,seals,report):
    require_sources(seals);report['cloud_write_attempted']=True
    return a.call_sql(path,'m03_support_enabled')
def replace_flag(security,path,old,writer,seals):
    require_sources(seals)
    return writer(security,path,old,b'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=false\n',b'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=true\n')

def render(template,versions,nonce,expected=None):
    tokens={'__NONCE__','__VERSIONS__'}|({'__EXPECTED_HMAC__'}if expected is not None else set())
    a.require(set(re.findall(r'__[A-Z_]+__',template))==tokens and re.fullmatch(r'[a-f0-9]{32}',nonce)is not None
      and len(versions)==19 and versions==sorted(set(versions))and all(re.fullmatch(r'[0-9]{14}',v)for v in versions))
    if expected is not None:a.require(a.is_hash(expected))
    return template.replace('__NONCE__',nonce).replace('__EXPECTED_HMAC__',expected or'').replace('__VERSIONS__',','.join("'"+v+"'"for v in versions))

def compare_support_activation(before,after):
    a.validate_protected(before);a.validate_protected(after)
    a.require(before['remaining']['frame_config']==after['remaining']['frame_config']==a.FRAME_ENABLED
      and before['remaining']['support_config']==a.SUPPORT_DISABLED and after['remaining']['support_config']==a.SUPPORT_ENABLED)
    old,new=copy.deepcopy(before),copy.deepcopy(after);new['remaining']['support_config']=old['remaining']['support_config']
    x=old['data_sha256'].pop('eps.candidate_support_config');y=new['data_sha256'].pop('eps.candidate_support_config')
    a.require(a.is_hash(x)and a.is_hash(y)and x!=y and old==new)

def local_template_proof():
    value=a.public_json(a.EVIDENCE/'support-template-proof.json')
    a.require(value['result']=='passed'and value['cloud_called']is value['activation_private_configuration_read']is False
      and value['rollback_verified']is value['sources_stable']is value['support_only_sql_round_trip']is value['wrong_hmac_rejected']is True
      and value['source_seals'][CHALLENGE]==a.sha((a.ROOT/CHALLENGE).read_bytes())and value['source_seals'][ENABLE]==a.sha((a.ROOT/ENABLE).read_bytes())
      and value['compiler_sha256']==a.sha(inspect.getsource(render).encode()))

def load_bootstrap(name,release_hash):
    path=a.receipt_path(pgp.EVIDENCE,name);value=a.public_json(path)
    a.require(value['result']=='passed'and value['target']==a.TARGET and value['release_receipt_sha256']==release_hash
      and value['action']in('provision','recover')and value['source_seals']==pgp.sources()
      and value['nonce_hmac_verified']is value['key_matches_canonical_ciphertext']is value['support_still_disabled']is True
      and value['flags_changed']is value['provider_called']is value['secret_recorded']is value['private_sql_inputs']is False)
    a.require(value['after']['remaining']['support_config']==a.SUPPORT_DISABLED)
    keys=[v for v in value['after']['remaining']['support_verification_keys']if v['key_id']==a.KEY_ID];a.require(len(keys)==1);a.validate_metadata(keys[0])
    return value,a.sha(path.read_bytes())

def private_files(security):
    support=a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024);a.parse_support(support)
    frame=a.protected_read(security,a.ROOT/'.env.frames-runtime.local',1024);a.parse_frame(frame,enabled=True)
    candidate=a.protected_read(security,a.ROOT/'.env.candidate-runtime.local',4096)
    a.require(candidate.count(('EPS_MEDIA_IMAGE_ID='+a.IMAGE+'\n').encode())==1 and candidate.count(b'EPS_CANDIDATE_MEDIA_ENABLED=true\n')==1)
    return support,frame,candidate

def challenge(security,state,key_hex,template=None,source_seals=None):
    nonce=secrets.token_hex(16);expected=hmac.new(bytes.fromhex(key_hex),nonce.encode(),hashlib.sha256).hexdigest()
    path=a.PRIVATE/('support-challenge-public-'+uuid.uuid4().hex+'.sql');a.protected_write(security,path,render(template if template is not None else(a.ROOT/CHALLENGE).read_text(),state['versions'],nonce).encode())
    if source_seals is not None:require_sources(source_seals)
    value=a.call_sql(path,'m03_support_challenge')
    a.require(set(value)=={'query_role','database','key_metadata','nonce_hmac'}and value['query_role']==value['database']=='postgres'
      and a.is_hash(value['nonce_hmac'])and hmac.compare_digest(value['nonce_hmac'],expected))
    a.validate_metadata(value['key_metadata']);a.require([k for k in state['remaining']['support_verification_keys']if k['key_id']==a.KEY_ID]==[value['key_metadata']])
    return nonce,expected

def main():
    parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True)
    for flag in('--dry-run','--enable','--local-dry-run','--enable-local'):group.add_argument(flag,action='store_true')
    parser.add_argument('--release',required=True);parser.add_argument('--bootstrap',required=True);parser.add_argument('--activation')
    args=parser.parse_args();local=args.local_dry_run or args.enable_local;write=args.enable or args.enable_local
    action=('support-local-enable'if write else'support-local-dry-run')if local else('support-db-enable'if write else'support-db-dry-run')
    from provision_logo_verifier import WindowsPrivateFiles
    module,release_inputs,release,release_hash=a.load_release(args.release);bootstrap,bootstrap_hash=load_bootstrap(args.bootstrap,release_hash)
    security=WindowsPrivateFiles();a.PRIVATE.mkdir(parents=True,exist_ok=True);support,frame,candidate=private_files(security)
    source_seals=sources();templates={file:pgp.held_source(file,source_seals)for file in(CHALLENGE,ENABLE)}
    public_inputs={'release_receipt':args.release,'release_sha256':release_hash,'bootstrap_receipt':args.bootstrap,'bootstrap_sha256':bootstrap_hash,'source_seals':source_seals}
    report={'observed_at':a.now().isoformat(),'target':a.TARGET,'result':'failed','action':action,'inputs':public_inputs,'cloud_write_attempted':False,
      'local_support_flag_changed':False,'frame_or_candidate_configuration_changed':False,'provider_called':False,'process_started':False,'automatic_retry':False,'secret_recorded':False}
    try:
        local_template_proof()
        before=a.inspect(module,release);report['before']=before
        for field in('catalog','runtime','source_config'):a.require(before[field]==release['readback'][field])
        for field in('eps.candidate_asset_config','eps.specs_pipeline_config','eps.specs_asset_config'):a.require(before['data_sha256'][field]==release['readback']['data_sha256'][field])
        a.require(before['remaining']['frame_config']==a.FRAME_ENABLED and before['remaining']['support_config']==(a.SUPPORT_ENABLED if local else a.SUPPORT_DISABLED)
          and before['remaining']['support_verification_keys']==bootstrap['after']['remaining']['support_verification_keys'])
        nonce,expected=challenge(security,before,a.parse_support(support),templates[CHALLENGE],source_seals);report['canonical_key_matches_local_verified']=True
        name='support-local-flag'if local else'support-db-flag';a.require(not(a.PRIVATE/(name+'.claim.json')).exists())
        private_inputs={**public_inputs,'release_inputs':release_inputs,'before_sha256':a.sha(json.dumps(before,sort_keys=True).encode()),
          'support_file_sha256':a.sha(support),'frame_file_sha256':a.sha(frame),'candidate_file_sha256':a.sha(candidate)}
        if local:
            a.require(args.activation is not None);path=a.receipt_path(a.EVIDENCE,args.activation);activation=a.public_json(path)
            a.require(activation['result']=='passed'and activation['action']=='support-db-enable'and activation['target']==a.TARGET and activation['inputs']==public_inputs
              and activation['canonical_key_matches_local_verified']is True and activation['local_support_flag_changed']is False)
            compare_support_activation(activation['before'],activation['after'])
            for field in('catalog','runtime','source_config','remaining','protected_m02'):a.require(before[field]==activation['after'][field])
            a.require(0<=(a.now()-__import__('datetime').datetime.fromisoformat(activation['finished_at'])).total_seconds()<=3600)
            private_inputs['db_activation_sha256']=a.sha(path.read_bytes());report['db_activation_receipt']=args.activation
        if write:
            a.dry_run(security,name,private_inputs);a.claim(security,name,private_inputs);a.require(private_files(security)==(support,frame,candidate))
            if local:
                a.protected_write(security,a.PRIVATE/'before-support-only.env',support)
                spec=importlib.util.spec_from_file_location('remaining_support_flag_writer',a.ROOT/'tools/configure-m03-remaining.py');flag=importlib.util.module_from_spec(spec);spec.loader.exec_module(flag)
                after_file=replace_flag(security,a.ROOT/'.env.support-runtime.local',support,flag.write_flag,source_seals)
                a.require(a.parse_support(after_file,enabled=True)==a.parse_support(support));report['local_support_flag_changed']=True
            else:
                path=a.PRIVATE/('support-enable-public-'+uuid.uuid4().hex+'.sql');a.protected_write(security,path,render(templates[ENABLE],before['versions'],nonce,expected).encode())
                value=dispatch_enable(path,source_seals,report);a.require(value=={'support_config':a.SUPPORT_ENABLED,'frame_config':a.FRAME_ENABLED,'changed_rows':1})
            after=a.inspect(module,release);report['after']=after
            if local:a.require(before==after)
            else:compare_support_activation(before,after);report['support_configuration_enabled_verified']=True
        else:
            after=a.inspect(module,release);a.require(before==after);report['after']=after;a.dry_run(security,name,private_inputs,write=True)
        a.require(a.protected_read(security,a.ROOT/'.env.frames-runtime.local',1024)==frame and a.protected_read(security,a.ROOT/'.env.candidate-runtime.local',4096)==candidate)
        if not(local and write):a.require(private_files(security)==(support,frame,candidate))
        report['other_business_catalog_runtime_and_config_unchanged']=True;report['result']='passed'
    finally:
        report['finished_at']=a.now().isoformat();path=a.retain(report,action)
        print(json.dumps({'result':report['result'],'action':action,'receipt':path.relative_to(a.ROOT).as_posix(),'cloud_write_attempted':report['cloud_write_attempted'],'local_support_flag_changed':report['local_support_flag_changed'],'automatic_retry':False}))

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Support-only activation unconfirmed. Preserve the claim; no automatic retry or frame/candidate change.\n');sys.exit(1)
