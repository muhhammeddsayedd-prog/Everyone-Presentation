"""One guest26 flag only. Inert import; root seals actual prerequisites later.

No cloud execution by its implementation agent. Unknown outcomes use readback;
the exclusive claim and attempt prevent an automatic second flag write.
"""
import copy
import datetime
import json
import os
from pathlib import Path
import sys
import uuid
import release_m06_forward26 as release

ROOT=release.ROOT
SQL='development/m06/enable-guest26.sql'
READINESS='tools/sql/m06-guest26-readiness.sql'
CONFIG='development/m06/guest26-activation.json'
CONFIG_SHA='9a73000d0d669efbaf713836691099db602bd71f30d4409f05a0b1cce8bef12b'  # Actual26 runtime, workflow and preservation proofs.
EVIDENCE=ROOT/'tracking/evidence/m06/guest26-activation'
CLAIM=ROOT/'.local/guest26-activation/enable.claim.json'
LOCAL_HARNESS='tools/test-m06-guest26-readiness-local.mjs'
STARTUP_HARNESS='tools/check-guest-export-runtime.mts'
LOCAL_SOURCES={SQL,READINESS,LOCAL_HARNESS,release.READBACK,'tools/local-postgres.mjs','development/local-db/instance.json','development/local-db/reviewed.json','supabase/migrations/'+release.MIGRATION}
WORKFLOW_SOURCES={'tools/repair-m06-wf03-expression.mjs','tools/build-guest-export-wf03.mjs','tools/build-presentation-wf03.mjs'}
require=release.require

def compare_enabled(before,after,enabled_hash):
    require(type(enabled_hash)is str and release.HASH.fullmatch(enabled_hash))
    require(len(before['old_data']['versions'])==26 and before['old_data']['versions']==after['old_data']['versions'])
    require(before['new_state']['config']=={'enabled':False,'key_present':True,'key_bytes':32,'replay_ttl_seconds':86400,'session_ttl_seconds':3600})
    require(before['new_state']['tables']['review_gateway_config']=={'count':1})
    expected=copy.deepcopy(before);expected['new_state']['config']['enabled']=True
    expected['old_data']['hashes']['eps.review_gateway_config']=enabled_hash
    require(after==expected)
    return {'only_guest_enabled_flag_changed':True,'safe_public_configuration_projection_hash_only':True,'old_catalog_noncredential_business_auth_metadata_runtime_storage_preserved':True}

def compare_bootstrap(before,after):
    require(before['new_state']['config']=={'enabled':False,'key_present':False,'key_bytes':None,'replay_ttl_seconds':86400,'session_ttl_seconds':3600})
    expected=copy.deepcopy(before);expected['new_state']['config'].update(key_present=True,key_bytes=32)
    require(after==expected)
    return True

def validate_startup(proof,config):
    require(proof['result']=='passed' and proof['sources_stable']is True and proof['gateway_attempted']is True and proof['authenticated_gateway_verified']is True and proof['verified_function_operations']==12)
    require(proof['jobs_claimed']is False and proof['provider_invoked']is False and proof['workflows_executed']is False and proof['credentials_printed']is False and proof['hosting_deferred']is True)
    require(proof['harness_path']==STARTUP_HARNESS and proof['harness_sha256']==proof['source_sha256'][STARTUP_HARNESS])
    require(type(proof['source_sha256'])is dict and 20<=len(proof['source_sha256'])<=40)
    for name,digest in proof['source_sha256'].items():require(config['source_seals'].get(name)==digest);release.sealed(name,digest)

def validate_workflow(repaired,probe,config):
    require(repaired['result']=='passed' and repaired['action']=='repair' and repaired['workflow_id']=='kE4qSEcugaKhIoJU' and repaired['active_graph_verified']is True and repaired['draft_graph_verified']is True and repaired['put_auto_publication_verified']is True and repaired['unrelated_workflows_modified']is False and repaired['credentials_modified']is False)
    require(probe['result']=='passed' and probe['action']=='probe' and probe['workflow_id']==repaired['workflow_id'] and probe['version_id']==repaired['version_id'] and probe['real_workflow_executions']is True and probe['database_work_claimed']is False and probe['provider_invoked']is False and probe['unauthorized_http_status']in(401,403) and probe['raw_headers_or_private_payload_recorded']is False)
    expected=[('presentation_render',s)for s in('prepare_presentation','render_presentation','validate_presentation','publish_presentation')]+[('presentation_export','render_export')]
    require([(v['kind'],v['stage'])for v in probe['stages']]==expected and len({v['execution_id']for v in probe['stages']})==5 and all(v['http_status']==200 and v['bound_response']is True for v in probe['stages']))
    for name in WORKFLOW_SOURCES:require(config['source_seals'].get(name)==repaired['source_seals'].get(name));release.sealed(name,config['source_seals'][name])

def validate_worker(proof,startup_item,startup):
    require(proof['result']in('started','passed')and proof['new_process_ownership_verified']is True and proof['sources_match_authenticated_startup']is True and proof['public_worker_listener']is False and proof['guest_exports_enabled']is True and proof['hosting_deferred']is True)
    require(type(proof['worker_id'])is int and proof['worker_id']>0 and proof['startup_proof']==startup_item['path']and proof['startup_proof_sha256']==startup_item['sha256']and proof['source_sha256']==startup['source_sha256'])

def validate_fresh(proof,now=None):
    value=proof.get('observed_at')or proof.get('finished_at')
    require(type(value)is str);observed=datetime.datetime.fromisoformat(value)
    require(observed.tzinfo is not None);age=((now or datetime.datetime.now(datetime.timezone.utc))-observed).total_seconds();require(0<=age<=900)

def current_inputs():
    release.sealed(CONFIG,CONFIG_SHA);inputs=release.current_release_inputs();config=release.read_json(CONFIG)
    require(set(config)=={'schema_version','cloud_apply','cloud_readback','bootstrap','bootstrap_preservation','workflow_repair','workflow_probe','startup','worker_ready','local_readiness','enabled_projection_sha256','source_seals'})
    require(config['schema_version']=='1.0'and type(config['source_seals'])is dict)
    required=LOCAL_SOURCES|WORKFLOW_SOURCES|{'tests/operations/test_m06_guest26_enable.py','tools/release_m06_forward26.py','tools/provision-m06-guest26.py'}
    require(required<=set(config['source_seals']))
    for name,digest in config['source_seals'].items():release.sealed(name,digest)
    proofs={}
    for key in('cloud_apply','cloud_readback','bootstrap','bootstrap_preservation','workflow_repair','workflow_probe','startup','worker_ready','local_readiness'):
        item=config[key];require(set(item)=={'path','sha256'});release.sealed(item['path'],item['sha256']);proofs[key]=release.read_json(item['path'])
    for key,action in(('cloud_apply','apply'),('cloud_readback','readback')):
        proof=proofs[key];require(proof['result']=='passed'and proof['action']==action and proof['target']==release.TARGET and proof['application_verified_by_readback']is True and proof['inputs']==inputs and len(proof['readback']['old_data']['versions'])==26)
    bootstrap=proofs['bootstrap'];require(bootstrap['result']=='passed'and bootstrap['action']in('apply','recover')and bootstrap['target']==release.TARGET and bootstrap['nonce_hmac_verified']is True and bootstrap['configuration_written']is True and bootstrap['owner_system_only']is True and bootstrap['database_key_present']is True and bootstrap['database_enabled']is False and bootstrap['only_expected_key_metadata_changed']is True and bootstrap['raw_values_or_secret_digests_published']is False)
    preservation=proofs['bootstrap_preservation'];require(preservation['result']=='passed');compare_bootstrap(preservation['before'],preservation['after'])
    validate_workflow(proofs['workflow_repair'],proofs['workflow_probe'],config);validate_startup(proofs['startup'],config);validate_worker(proofs['worker_ready'],config['startup'],proofs['startup'])
    local=proofs['local_readiness'];require(local['result']=='passed'and local['cloud_called']is False and local['provider_called']is False and local['activation_private_configuration_read']is False)
    require(all(local.get(name)is True for name in('exact_single_flag_change','repeated_enable_denied','four_real_sql_negative_preconditions_passed','synthetic_preconditions','behavior_passed','backend_settled','rollback_verified','sources_stable'))and local['original']==local['after'])
    require(local['harness_path']==LOCAL_HARNESS and local['harness_sha256']==config['source_seals'][LOCAL_HARNESS]and LOCAL_SOURCES<=set(local['source_seals']))
    for name,digest in local['source_seals'].items():require(config['source_seals'].get(name)==digest);release.sealed(name,digest)
    require(config['enabled_projection_sha256']==local['enabled_projection_sha256']);compare_enabled(local['before'],local['enabled_state'],config['enabled_projection_sha256'])
    return inputs,config,proofs

def query(file,field,config):
    require(file in(SQL,READINESS));release.sealed(file,config['source_seals'][file]);result=release.call(['db','query','--linked','--project-ref',release.TARGET,'--file',str(ROOT/file),'--output-format','json'])
    require(result.returncode==0 and len(result.stdout.encode())<=256*1024);rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={field});return rows[0][field]

def validate_readiness(state,inputs,enabled):
    require(state['schema_version']=='1.0'and state['query_role']==state['database']=='postgres'and state['unrestricted_visibility']is True and state['versions']==inputs['versions'])
    require(state['gateway']=={'count':1,'enabled':enabled,'key_present':True,'key_bytes':32,'replay_ttl_seconds':86400,'session_ttl_seconds':3600})
    require(state['presentation_processing_enabled']is True and state['active_jobs']==0 and state['leased_outbox']==0 and state['protected_m02']=={'id':'b3f90268-147d-41d4-8875-2a6435df1496','status':'waiting_for_input','error_code':'INPUT_CHANGED','manual_note_retained':True})

def retain(report,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True);file=EVIDENCE/(release.stamp().replace(':','-').replace('.','-')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n');handle.flush();os.fsync(handle.fileno())
    return file.relative_to(ROOT).as_posix()

def refuse_repeat():require(not CLAIM.exists()and not any(EVIDENCE.glob('*-enable-attempt.json')))

def write_claim(before,inputs,config,attempt):
    from provision_logo_verifier import WindowsPrivateFiles
    # main already checked historical attempts before retaining THIS attempt.
    # The protected exclusive create remains the cross-process write fence.
    require(not CLAIM.exists());CLAIM.parent.mkdir(parents=True,exist_ok=True);security=WindowsPrivateFiles()
    value={'at':release.stamp(),'target':release.TARGET,'inputs_sha256':release.canonical(inputs),'config_sha256':CONFIG_SHA,'before_sha256':release.canonical(before),'attempt_receipt':attempt,'helper_sha256':release.sha(Path(__file__).read_bytes()),'dispatch_may_have_occurred':True,'automatic_retry':False}
    with security.create(CLAIM)as handle:handle.write((json.dumps(value)+'\n').encode());handle.flush();os.fsync(handle.fileno());security.verify_open(handle)

def main(arguments=None):
    arguments=sys.argv[1:]if arguments is None else arguments;require(len(arguments)<=1);action=arguments[0]if arguments else'inspect';require(action in('inspect','enable','readback'))
    report={'action':action,'target':release.TARGET,'result':'failed','write_attempted':False,'automatic_retry':False,'hosting_deferred':True,'key_read_or_hashed':False}
    try:
        inputs,config,proofs=current_inputs();report['inputs']=inputs;report['config_sha256']=CONFIG_SHA;before=release.inspect_state(inputs);report['before']=before
        if action=='readback':
            claim=json.loads(CLAIM.read_bytes());require(claim['target']==release.TARGET and claim['inputs_sha256']==release.canonical(inputs)and claim['config_sha256']==CONFIG_SHA and claim['helper_sha256']==release.sha(Path(__file__).read_bytes()))
            path=Path(claim['attempt_receipt']);require(path.parent.as_posix()=='tracking/evidence/m06/guest26-activation'and path.name.endswith('-enable-attempt.json'));attempt=release.read_json(path.as_posix());require(release.canonical(attempt['before'])==claim['before_sha256']);report['before']=attempt['before'];report['after']=before;report['comparison']=compare_enabled(attempt['before'],before,config['enabled_projection_sha256']);validate_readiness(query(READINESS,'m06_guest26_readiness',config),inputs,True)
        else:
            enabled_before=before['new_state']['config']['enabled'];validate_readiness(query(READINESS,'m06_guest26_readiness',config),inputs,enabled_before)
            require(before['new_state']['config']['key_present']is True and before['new_state']['config']['key_bytes']==32)
            if action=='enable':
                require(enabled_before is False);validate_fresh(proofs['startup']);validate_fresh(proofs['worker_ready'])
                refuse_repeat();attempt=retain(report,'enable-attempt');report['attempt_receipt']=attempt;write_claim(before,inputs,config,attempt)
                require(current_inputs()[0]==inputs);report['write_attempted']=True;enabled=query(SQL,'m06_guest26_enabled',config);require(enabled['enabled_projection_sha256']==config['enabled_projection_sha256'])
                after=release.inspect_state(inputs);report['after']=after;report['comparison']=compare_enabled(before,after,config['enabled_projection_sha256']);validate_readiness(query(READINESS,'m06_guest26_readiness',config),inputs,True)
        report['result']='passed'
    except Exception:report['reason']='Guest26 flag outcome unconfirmed; preserve claim and use read-only readback. No repeated write.';raise
    finally:
        report['finished_at']=release.stamp();file=retain(report,action);print(json.dumps({'result':report['result'],'receipt':file,'write_attempted':report['write_attempted'],'automatic_retry':False}))

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Guest26 activation stopped; diagnostics remain private. No automatic retry.\n');sys.exit(1)
