"""Independent frame-only DB/local activation. No support key dependency or read."""
import argparse,importlib.util,json,re,sys
from pathlib import Path
import m03_remaining_activation as a
TEMPLATE='tools/sql/m03-frame-enable-template.sql'
DRAIN='tools/sql/m03-frame-drain.sql'

def prerequisites(workflow):
    spec=importlib.util.spec_from_file_location('remaining_public_proofs',a.ROOT/'tools/configure-m03-remaining.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module.public_prerequisites(workflow)
def render(template,versions):
    a.require(template.count('__VERSIONS__')==1 and len(versions)==19 and versions==sorted(set(versions))and all(re.fullmatch(r'[0-9]{14}',v)for v in versions))
    return template.replace('__VERSIONS__',','.join("'"+v+"'"for v in versions))
def drain():
    value=a.call_sql(a.ROOT/DRAIN,'m03_frame_drain');a.require(value['query_role']==value['database']=='postgres'and value['unrestricted_visibility']is True and value['candidate_active_jobs']==value['frame_active_jobs']==value['leased_dispatches']==0)
def private_files(security):
    frame=a.protected_read(security,a.ROOT/'.env.frames-runtime.local',1024);a.parse_frame(frame)
    candidate=a.protected_read(security,a.ROOT/'.env.candidate-runtime.local',4096)
    a.require(candidate.count(('EPS_MEDIA_IMAGE_ID='+a.IMAGE+'\n').encode())==1 and candidate.count(b'EPS_CANDIDATE_MEDIA_ENABLED=true\n')==1)
    return frame,candidate
def frame_enabled_support_disabled(state):
    a.validate_protected(state);a.require(state['remaining']['frame_config']==a.FRAME_ENABLED and state['remaining']['support_config']==a.SUPPORT_DISABLED)

def main():
    parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True)
    for flag in('--dry-run','--enable','--local-dry-run','--enable-local'):group.add_argument(flag,action='store_true')
    parser.add_argument('--release',required=True);parser.add_argument('--workflow',required=True);parser.add_argument('--activation')
    args=parser.parse_args();local=args.local_dry_run or args.enable_local;write=args.enable or args.enable_local;action=('frame-local-enable'if write else'frame-local-dry-run')if local else('frame-db-enable'if write else'frame-db-dry-run')
    from provision_logo_verifier import WindowsPrivateFiles
    module,release_inputs,release,release_hash=a.load_release(args.release);proofs=prerequisites(args.workflow);security=WindowsPrivateFiles();a.PRIVATE.mkdir(parents=True,exist_ok=True)
    frame,candidate=private_files(security);sources={f:a.sha((a.ROOT/f).read_bytes())for f in('tools/configure-m03-frames.py','tools/configure-m03-remaining.py','tools/m03_remaining_activation.py',TEMPLATE,DRAIN)}
    public_inputs={'release_receipt':args.release,'release_sha256':release_hash,'proofs':proofs,'source_seals':sources}
    report={'observed_at':a.now().isoformat(),'target':a.TARGET,'result':'failed','action':action,'inputs':public_inputs,
      'cloud_write_attempted':False,'local_frame_flag_changed':False,'support_key_read':False,'support_configuration_changed':False,'candidate_private_file_changed':False,'provider_called':False,'process_started':False,'automatic_retry':False}
    try:
        before=a.inspect(module,release);report['before']=before
        for field in('catalog','runtime','source_config'):a.require(before[field]==release['readback'][field])
        for field in('eps.candidate_asset_config','eps.specs_pipeline_config','eps.specs_asset_config'):a.require(before['data_sha256'][field]==release['readback']['data_sha256'][field])
        if local:frame_enabled_support_disabled(before)
        else:a.disabled(before)
        drain();name='frame-local-flag'if local else'frame-db-flag';a.require(not(a.PRIVATE/(name+'.claim.json')).exists())
        private_inputs={**public_inputs,'release_inputs':release_inputs,'before_sha256':a.sha(json.dumps(before,sort_keys=True).encode()),'frame_file_sha256':a.sha(frame),'candidate_file_sha256':a.sha(candidate)}
        if local:
            a.require(args.activation is not None);path=a.receipt_path(a.EVIDENCE,args.activation);activation=a.public_json(path)
            a.require(activation['result']=='passed'and activation['action']=='frame-db-enable'and activation['target']==a.TARGET and activation['inputs']==public_inputs
              and activation['frame_configuration_enabled_verified']is True and activation['support_configuration_changed']is False and activation['local_frame_flag_changed']is False)
            a.compare_frame_activation(activation['before'],activation['after'])
            for field in('catalog','runtime','source_config','remaining','protected_m02'):a.require(before[field]==activation['after'][field])
            for field in('eps.candidate_asset_config','eps.specs_pipeline_config','eps.specs_asset_config'):a.require(before['data_sha256'][field]==activation['after']['data_sha256'][field])
            a.require(0<=(a.now()-__import__('datetime').datetime.fromisoformat(activation['finished_at'])).total_seconds()<=3600);private_inputs['db_activation_sha256']=a.sha(path.read_bytes());report['db_activation_receipt']=args.activation
        if write:
            a.dry_run(security,name,private_inputs);drain();a.claim(security,name,private_inputs);a.require(private_files(security)==(frame,candidate))
            if local:
                a.protected_write(security,a.PRIVATE/'before-frame-only.env',frame)
                spec=importlib.util.spec_from_file_location('remaining_flag_writer',a.ROOT/'tools/configure-m03-remaining.py');flag=importlib.util.module_from_spec(spec);spec.loader.exec_module(flag)
                after_file=flag.write_flag(security,a.ROOT/'.env.frames-runtime.local',frame,b'EPS_FRAME_EXTRACTION_ENABLED=false\n',b'EPS_FRAME_EXTRACTION_ENABLED=true\n');a.parse_frame(after_file,enabled=True);report['local_frame_flag_changed']=True
            else:
                sql=render((a.ROOT/TEMPLATE).read_text(),before['versions']);path=a.PRIVATE/'frame-enable-reviewed.sql';a.protected_write(security,path,sql.encode());report['cloud_write_attempted']=True
                result=a.call_sql(path,'m03_frame_enabled');a.require(result=={'frame_config':a.FRAME_ENABLED,'support_config':a.SUPPORT_DISABLED,'changed_rows':1})
            after=a.inspect(module,release);report['after']=after
            if local:a.require(before==after)
            else:a.compare_frame_activation(before,after);report['frame_configuration_enabled_verified']=True
        else:
            after=a.inspect(module,release);a.require(before==after);report['after']=after;a.dry_run(security,name,private_inputs,write=True)
        a.require(a.protected_read(security,a.ROOT/'.env.candidate-runtime.local',4096)==candidate)
        if not(local and write):a.require(private_files(security)==(frame,candidate))
        report['other_business_catalog_runtime_and_config_unchanged']=True;report['result']='passed'
    finally:
        report['finished_at']=a.now().isoformat();path=a.retain(report,action)
        print(json.dumps({'result':report['result'],'action':action,'receipt':path.relative_to(a.ROOT).as_posix(),'cloud_write_attempted':report['cloud_write_attempted'],'local_frame_flag_changed':report['local_frame_flag_changed'],'support_configuration_changed':False,'automatic_retry':False}))

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Frame-only activation unconfirmed. Preserve any claim; no support-key dependency or automatic retry.\n');sys.exit(1)
