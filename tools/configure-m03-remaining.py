"""Root-only explicit19 DB activation and subsequent local flags; authoring is inert.

No provider/worker process starts, no candidate private file edit, no secret
rotation, and no migration/ACL/business write. Private flag writes have a durable
one-attempt claim; a partial outcome stays unconfirmed and is never auto-retried.
"""
import argparse,json,os,re,sys
import m03_remaining_activation as a

SDK='tracking/evidence/m03/remaining-current-quality/2026-10-29T14-10-51-690Z-1e843067.json'
NATIVE='tracking/evidence/m03/media-container/2026-10-29T12-51-41-582Z.json'
GEOMETRY='tracking/evidence/m03/native-geometry/2026-10-29T12-59-20-445Z.json'
SDK_SOURCES=['packages/central/src/candidate-support-storage.ts','packages/central/src/candidate-storage.ts','packages/central/src/specs-runtime-gateway.ts',
 'apps/worker/src/frame-stage-executor.ts','packages/central/test/candidate-support-storage.test.ts','tests/worker/candidate-assets.test.ts','tests/worker/frame-stage-executor.test.ts','tests/worker/frame-runtime.test.ts']
STAGES={('candidate_scan',s)for s in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')}|{('frame_extract','extract_frames'),('frame_extract','apply_frames')}

def public_prerequisites(workflow_name):
    sdk=a.public_json(a.ROOT/SDK);a.require(sdk['result']=='passed'and sdk['sources_stable']is True)
    npm=[g for g in sdk['groups']if g['name']=='npm-test'];a.require(len(npm)==1 and npm[0]['exit_code']==0 and npm[0]['counts']['fail']==0 and npm[0]['counts']['pass']==npm[0]['counts']['tests']>0)
    for file in SDK_SOURCES:a.require(sdk['source_sha256'][file]==a.sha((a.ROOT/file).read_bytes()))
    native=a.public_json(a.ROOT/NATIVE);geometry=a.public_json(a.ROOT/GEOMETRY)
    a.require(native['passed']is True and len(native['tests'])==10 and all(t['result']=='passed'for t in native['tests'])
      and native['image_id']==geometry['image_id']==a.IMAGE and native['provider_called']is geometry['provider_called']is False
      and geometry['result']=='passed'and geometry['scrubbed_path_empty']is True
      and geometry['display_geometry']['sample_aspect_ratio']=={'numerator':16,'denominator':15}
      and 1<=len(geometry['frames'])<=3 and all(f['width']==853 and f['height']==480 and a.is_hash(f['sha256'])for f in geometry['frames']))
    path=a.receipt_path(a.ROOT/'tracking/evidence/m03/n8n-wf02',workflow_name);wf=a.public_json(path)
    a.require(wf['result']=='passed'and wf['action']=='probe'and wf['workflow_id']=='gfhxzvSkprS2CI4o'
      and len(wf['stages'])==7 and {(p['kind'],p['stage'])for p in wf['stages']}==STAGES
      and all(p['http_status']==200 and p['bound_response']is True and re.fullmatch(r'[A-Za-z0-9._:-]{1,200}',p['execution_id'])for p in wf['stages'])
      and wf['unauthorized_http_status']in(401,403)and wf['invalid_http_status']==wf['malformed_stage_http_status']==400
      and wf['real_workflow_executions']is True and wf['database_work_claimed']is wf['provider_invoked']is False)
    graph=a.public_json(a.ROOT/'n8n/eps-wf02-candidate-stage.json');journal=a.public_json(a.ROOT/'.local/candidate-runtime/n8n-bootstrap.json',65536)
    graph_hash=a.sha(json.dumps(graph,ensure_ascii=False,separators=(',',':')).encode())
    a.require(journal['workflow_id']==wf['workflow_id']and journal['status']=='published'and journal['graph_sha256']==graph_hash
      and isinstance(journal['version_id'],str)and 0<=(a.now()-__import__('datetime').datetime.fromisoformat(wf['observed_at'])).total_seconds()<=86400
      and __import__('datetime').datetime.fromisoformat(wf['observed_at'])>=__import__('datetime').datetime.fromisoformat(journal['updated_at']))
    return {'sdk_receipt':SDK,'sdk_sha256':a.sha((a.ROOT/SDK).read_bytes()),'native_receipt':NATIVE,'native_sha256':a.sha((a.ROOT/NATIVE).read_bytes()),
      'geometry_receipt':GEOMETRY,'geometry_sha256':a.sha((a.ROOT/GEOMETRY).read_bytes()),'workflow_receipt':workflow_name,'workflow_sha256':a.sha(path.read_bytes()),
      'workflow_graph_sha256':graph_hash,'workflow_version_id':journal['version_id'],'native_image_id':a.IMAGE}

def configurations(security):
    support=a.protected_read(security,a.ROOT/'.env.support-runtime.local',1024);key=a.parse_support(support)
    frame=a.protected_read(security,a.ROOT/'.env.frames-runtime.local',1024);a.parse_frame(frame)
    candidate=a.protected_read(security,a.ROOT/'.env.candidate-runtime.local',4096)
    a.require(candidate.count(('EPS_MEDIA_IMAGE_ID='+a.IMAGE+'\n').encode())==1 and candidate.count(b'EPS_CANDIDATE_MEDIA_ENABLED=true\n')==1)
    return support,frame,candidate,key

def drain(value):a.require(value['candidate_active_jobs']==value['frame_active_jobs']==value['leased_dispatches']==0)
def write_flag(security,path,before,old,new):
    a.require(before.count(old)==1);after=before.replace(old,new,1)
    with path.open('r+b')as handle:
        security.verify_open(handle);a.require(handle.read()==before);handle.seek(0);handle.write(after);handle.truncate();handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
    a.require(a.protected_read(security,path,1024)==after);return after

def main():
    parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True)
    for flag in('--dry-run','--enable','--local-dry-run','--enable-local'):group.add_argument(flag,action='store_true')
    parser.add_argument('--release',required=True);parser.add_argument('--workflow',required=True);parser.add_argument('--activation')
    args=parser.parse_args();local=args.local_dry_run or args.enable_local;write=args.enable or args.enable_local;action=('local-enable'if write else'local-dry-run')if local else('db-enable'if write else'db-dry-run')
    from provision_logo_verifier import WindowsPrivateFiles
    module,release_inputs,release,release_hash=a.load_release(args.release);proofs=public_prerequisites(args.workflow);security=WindowsPrivateFiles();a.PRIVATE.mkdir(parents=True,exist_ok=True)
    support,frame,candidate,key=configurations(security);sources={f:a.sha((a.ROOT/f).read_bytes())for f in('tools/configure-m03-remaining.py','tools/m03_remaining_activation.py','tools/sql/m03-remaining-admin-guard.sql','tools/sql/m03-remaining-key-template.sql')}
    public_inputs={'release_receipt':args.release,'release_sha256':release_hash,'proofs':proofs,'source_seals':sources}
    report={'observed_at':a.now().isoformat(),'target':a.TARGET,'result':'failed','action':action,'inputs':public_inputs,'cloud_write_attempted':False,
      'local_flags_changed':False,'candidate_private_file_changed':False,'provider_called':False,'process_started':False,'automatic_retry':False,'migration_retry_attempted':False}
    try:
        before=a.inspect(module,release);report['before']=before
        if local:a.enabled(before)
        else:a.disabled(before)
        drain(a.admin_guard());a.key_matches(a.private_key_query(security,key,before['versions'],'inspect'))
        private_inputs={**public_inputs,'release_inputs':release_inputs,'before_sha256':a.sha(json.dumps(before,sort_keys=True).encode()),
          'support_file_sha256':a.sha(support),'frame_file_sha256':a.sha(frame),'candidate_file_sha256':a.sha(candidate)}
        name='local-flags'if local else'database-flags';a.require(not(a.PRIVATE/(name+'.claim.json')).exists())
        if local:
            a.require(args.activation is not None);path=a.receipt_path(a.EVIDENCE,args.activation);activation=a.public_json(path)
            a.require(activation['result']=='passed'and activation['action']=='db-enable'and activation['target']==a.TARGET
              and activation['inputs']==public_inputs and activation['configuration_enabled_verified']is True
              and activation['other_business_catalog_runtime_and_config_unchanged']is True and activation['local_flags_changed']is False)
            a.compare_activation(activation['before'],activation['after'])
            for field in('catalog','runtime','source_config','remaining','protected_m02'):a.require(before[field]==activation['after'][field])
            a.require(0<=(a.now()-__import__('datetime').datetime.fromisoformat(activation['finished_at'])).total_seconds()<=3600)
            private_inputs['db_activation_sha256']=a.sha(path.read_bytes());report['db_activation_receipt']=args.activation
        if write:
            a.dry_run(security,name,private_inputs);drain(a.admin_guard());a.claim(security,name,private_inputs)
            a.require(configurations(security)==(support,frame,candidate,key))
            if local:
                a.protected_write(security,a.PRIVATE/'before-support.env',support);a.protected_write(security,a.PRIVATE/'before-frame.env',frame)
                frame_after=write_flag(security,a.ROOT/'.env.frames-runtime.local',frame,b'EPS_FRAME_EXTRACTION_ENABLED=false\n',b'EPS_FRAME_EXTRACTION_ENABLED=true\n');a.parse_frame(frame_after,enabled=True)
                a.protected_write(security,a.PRIVATE/'frame-flag-written.json',json.dumps({'at':a.now().isoformat(),'flag':True,'secret_recorded':False}).encode())
                support_after=write_flag(security,a.ROOT/'.env.support-runtime.local',support,b'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=false\n',b'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=true\n');a.require(a.parse_support(support_after,enabled=True)==key)
                report['local_flags_changed']=True;report['key_and_image_preserved']=True
            else:
                report['cloud_write_attempted']=True;result=a.private_key_query(security,key,before['versions'],'enable');a.key_matches(result);a.require(result['configuration_changed']is True and result['key_inserted']is False)
            after=a.inspect(module,release);report['after']=after
            if local:a.require(before==after)
            else:a.compare_activation(before,after);report['configuration_enabled_verified']=True
        else:
            after=a.inspect(module,release);a.require(before==after);report['after']=after;a.dry_run(security,name,private_inputs,write=True)
        a.require(a.protected_read(security,a.ROOT/'.env.candidate-runtime.local',4096)==candidate)
        if not(local and write):a.require(configurations(security)==(support,frame,candidate,key))
        report['other_business_catalog_runtime_and_config_unchanged']=True;report['result']='passed'
    finally:
        report['finished_at']=a.now().isoformat();path=a.retain(report,action)
        print(json.dumps({'result':report['result'],'action':action,'receipt':path.relative_to(a.ROOT).as_posix(),'cloud_write_attempted':report['cloud_write_attempted'],'local_flags_changed':report['local_flags_changed'],'automatic_retry':False}))

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Remaining activation unconfirmed. Preserve any claim and partial flag state; no automatic retry or private diagnostics.\n');sys.exit(1)
