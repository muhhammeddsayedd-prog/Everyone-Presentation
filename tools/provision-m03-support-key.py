"""Fixed known support key: dry-run/inspect read only; root explicitly provisions.

No actual action occurs on import. Never rotates/overwrites a key, changes flags,
prints key/config hashes, or retains raw CLI diagnostics. Unknown writes keep a
protected one-attempt claim; inspect remains available for read-only diagnosis.
"""
import argparse,json,sys
from pathlib import Path
import m03_remaining_activation as a

def main():
    parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run',action='store_true');group.add_argument('--provision',action='store_true');group.add_argument('--inspect',action='store_true');parser.add_argument('--release',required=True)
    args=parser.parse_args();action='provision'if args.provision else'inspect'if args.inspect else'dry-run'
    from provision_logo_verifier import WindowsPrivateFiles
    module,release_inputs,release,release_hash=a.load_release(args.release);security=WindowsPrivateFiles();a.PRIVATE.mkdir(parents=True,exist_ok=True)
    config=a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024);key=a.parse_support(config)
    frame=a.protected_read(security,a.ROOT/'.env.frames-runtime.local',1024);a.parse_frame(frame)
    report={'observed_at':a.now().isoformat(),'target':a.TARGET,'result':'failed','action':action,'release_receipt':args.release,'release_receipt_sha256':release_hash,
      'cloud_write_attempted':False,'provider_called':False,'local_flags_changed':False,'schema_acl_identity_changed':False,'automatic_retry':False,'secret_recorded':False}
    try:
        before=a.inspect(module,release);a.disabled(before);report['before']=before;a.admin_guard()
        current=a.private_key_query(security,key,before['versions'],'inspect')
        existing=current['configured_key_exists'];a.require(type(existing)is bool)
        if existing:a.key_matches(current)
        inputs={'release_sha256':release_hash,'release_inputs':release_inputs,'before_sha256':a.sha(json.dumps(before,sort_keys=True).encode()),
          'private_support_configuration_sha256':a.sha(config),'private_frame_configuration_sha256':a.sha(frame),
          'source_seals':{f:a.sha((a.ROOT/f).read_bytes())for f in('tools/provision-m03-support-key.py','tools/m03_remaining_activation.py','tools/sql/m03-remaining-admin-guard.sql','tools/sql/m03-remaining-key-template.sql')}}
        a.require(a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024)==config and a.protected_read(security,a.ROOT/'.env.frames-runtime.local',1024)==frame)
        if action=='provision'and not existing:
            a.require(not(a.PRIVATE/'support-key.claim.json').exists());a.dry_run(security,'support-key',inputs);a.admin_guard();a.claim(security,'support-key',inputs)
            report['cloud_write_attempted']=True;result=a.private_key_query(security,key,before['versions'],'provision');a.key_matches(result)
            after=a.inspect(module,release);a.compare_key_provision(before,after,result['key_metadata']);report['after']=after;report['key_inserted']=True
        else:
            after=a.inspect(module,release);a.require(before==after);report['after']=after;report['key_inserted']=False
            if action=='dry-run':a.require(not(a.PRIVATE/'support-key.claim.json').exists());a.dry_run(security,'support-key',inputs,write=True)
        if existing or report['cloud_write_attempted']:
            proof=a.private_key_query(security,key,before['versions'],'inspect');a.key_matches(proof);report['key_matches_runtime_file']=True
        else:report['key_matches_runtime_file']=False
        a.require(a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024)==config and a.protected_read(security,a.ROOT/'.env.frames-runtime.local',1024)==frame)
        report['private_configuration_unchanged']=True;report['other_business_catalog_runtime_and_config_unchanged']=True;report['both_upload_flags_disabled']=True;report['result']='passed'
    finally:
        report['finished_at']=a.now().isoformat();path=a.retain(report,'support-key-'+action)
        print(json.dumps({'result':report['result'],'action':action,'receipt':path.relative_to(a.ROOT).as_posix(),'cloud_write_attempted':report['cloud_write_attempted'],'automatic_retry':False,'secret_recorded':False}))

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Support key operation unconfirmed. Preserve any claim; no automatic retry or private diagnostics.\n');sys.exit(1)
