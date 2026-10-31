"""Distinct future-frame forward adoption after actual canonical31 and the successful5e pin.
Root executes; the shared public baked-plan admission is required before CLI.
Existing source, claims, jobs and private credentials are never rewritten.
"""
from pathlib import Path
import copy
import datetime
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('pilot_origin_common', HERE/'future-origin.py')
origin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(origin)
ROOT = origin.ROOT
forward_spec = importlib.util.spec_from_file_location('worker_forward_admission', HERE/'worker-forward31.py')
forward = importlib.util.module_from_spec(forward_spec); forward_spec.loader.exec_module(forward)
FORWARD_SHA256 = '39741d783962e4a9fde38915578ba4cc84432a7dacb84ec6c8b78f1468541e18'
OLD_PIN = 'sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06'
PRIVATE = ROOT/'.local/m07-pilot/future-frame-protected31'
CLAIM = PRIVATE/'apply.claim.json'
PROCESS_PROOF = PRIVATE/'process-returned.json'
CommandProcessUnconfirmed = forward.CommandProcessUnconfirmed
QUERY_ATTEMPTS=0
PINS = {'development/m07/controlled-pilot/future-origin.py':'7d15c917bd781fd89a75e3efe36c561d9933ba64e3309b583c04b7ba5accee44',
        'development/m07/controlled-pilot/FUTURE_FRAME_PROTECTED31.sql':'31e1570131b8f773d64ba82cdea990b375d72032f143ba74e775a87b3a21b4d3',
        'development/m07/controlled-pilot/FUTURE_FRAME_PROTECTED31_READBACK.sql':'baa8a4a3224e832a59d55cf2ec117ab0fb5c39d74818809f7b1aea146ba30b8c'}
WORKER_ADOPTION={'tracking/evidence/m07/controlled-pilot/2026-10-31T02-29-00-006746Z-96e255e2-worker-forward31-apply.json': '42fea10fc6a3a99e566e787882e118aff05879d6b6144c8317f8da3247b10dfe', 'tracking/evidence/m07/controlled-pilot/2026-10-31T02-31-30-519507Z-f05de2c3-worker-forward31-readback.json': '55a9df1614a6225552becb1ad0b04986c77f6e058d9a5bc6ef45dd750c0c9fe9'}
BASELINE_RECEIPT='tracking/evidence/m07/controlled-pilot/2026-10-31-frame-protected31-baseline.json'
BASELINE_SHA256='ec366c0565e8044d53103a899040026427c3c32a36d7c22f639957cf0c4e4481'
PROTECTED_JOB_SHA256='7b875c1f212bc18a13d186daf40d7155d73748f2cc6d6704ba34fb8f1397636c'
PROTECTED_METADATA={'attempt': 3, 'id': 'b3f90268-147d-41d4-8875-2a6435df1496', 'manual_note_retained': True, 'resource_id': '73a1a500-acfe-48cc-91ba-53a83b895118', 'row_version': 7, 'spec_sha256': '2344eaa9fecced1eff04259500481c47b65bb2bb0a55c448770a23b303b56a86', 'stage': 'apply_specs', 'status': 'waiting_for_input'}
FINGERPRINTS = ('versions','slides','pins','ready_asset_metadata','jobs','outbox',
                'requests','payloads','candidates','candidate_media','frames','settings','protected_job_projection')


def require(value):
    if not value:
        raise ValueError('FUTURE_FRAME_FORWARD_UNCONFIRMED')


def verify_private():
    require(PRIVATE.resolve()==PRIVATE and PRIVATE.is_dir()and not PRIVATE.is_symlink())
    if os.name=='nt':
        environment=dict(os.environ);environment['EPS_ACK31_RELEASE_PRIVATE']=str(PRIVATE)
        result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',forward.common.canonical.m.acl.program(False)],
          capture_output=True,text=True,timeout=15,env=environment,stdin=subprocess.DEVNULL)
        require(result.returncode==0 and len(result.stdout.encode())<=16384 and len(result.stderr.encode())<=16384)
        forward.common.canonical.m.acl.validate(json.loads(result.stdout))
    else:require(PRIVATE.stat().st_mode&0o777==0o700)


def validate_baseline(value):
    origin.exact(value,('schema_version','observed_at','target','read_only','query_sha256','value','raw_diagnostics_or_private_values_persisted'))
    require(value['schema_version']=='1.0'and value['target']==origin.TARGET and value['read_only']is True
      and value['query_sha256']=='a3428b5178368bbcbbb4a031be1f80360ed9e0dd1621c83a6c6f2e660dc29c62'
      and value['raw_diagnostics_or_private_values_persisted']is False)
    row=value['value'];origin.exact(row,('database','operator','history','job_kind','job_projection_sha256','protected_m02'))
    require(row['database']==row['operator']=='postgres'and row['history']==list(forward.common.VERSIONS)
      and row['job_kind']=='specs_extract'and row['job_projection_sha256']==PROTECTED_JOB_SHA256 and row['protected_m02']==PROTECTED_METADATA)


def validate_new_pin(value):
    require(type(value) is str and re.fullmatch('sha256:[a-f0-9]{64}',value) and value != OLD_PIN)


def validate_protected(value):
    origin.exact(value, (*FINGERPRINTS,'protected_m02'))
    origin.validate_metadata({key:value[key] for key in ('versions','slides','pins','ready_asset_metadata','protected_m02')})
    require(value['protected_m02']==PROTECTED_METADATA and value['protected_job_projection']=={'count':1,'sha256':PROTECTED_JOB_SHA256})
    for key in FINGERPRINTS:
        origin.exact(value[key], ('count','sha256')); origin.integer(value[key]['count'])
        require(type(value[key]['sha256']) is str and re.fullmatch('[a-f0-9]{64}',value[key]['sha256']))


def validate_state(value, new_pin, require_old=False):
    validate_new_pin(new_pin); origin.exact(value, ('context','frame_config','protected_metadata'))
    context = value['context']
    origin.exact(context, ('database','operator','history','configuration_count','unexpected_config_triggers','total_active_jobs','other_active_jobs','protected_waiting_jobs','leased_outbox','ack_body_sha256','hook_body_sha256'))
    require(context['database'] == context['operator'] == 'postgres' and context['history'] == list(forward.common.VERSIONS) and context['ack_body_sha256']==forward.common.guard.ACK_BODY and context['hook_body_sha256']==forward.common.guard.HOOK_BODY)
    require(type(context['configuration_count']) is int and context['configuration_count'] == 1)
    for key in ('unexpected_config_triggers','other_active_jobs','leased_outbox'):
        require(type(context[key]) is int and context[key] == 0)
    require(type(context['total_active_jobs'])is int and context['total_active_jobs']==1
      and type(context['protected_waiting_jobs'])is int and context['protected_waiting_jobs']==1)
    config = value['frame_config']; origin.exact(config, ('id','enabled','native_image_id','implementation_version'))
    require(config['id'] is True and config['enabled'] is True and config['implementation_version'] == 'frame-extraction.v1')
    require(config['native_image_id'] == OLD_PIN if require_old else config['native_image_id'] in (OLD_PIN,new_pin))
    validate_protected(value['protected_metadata']); return copy.deepcopy(value)


def validate_update(value, new_pin):
    origin.exact(value, ('expected_project','old_native_image_id','new_native_image_id','other_config_columns_preserved','protected_metadata_preserved','protected_metadata'))
    require(value['expected_project'] == origin.TARGET and value['old_native_image_id'] == OLD_PIN and value['new_native_image_id'] == new_pin
            and value['other_config_columns_preserved'] is True and value['protected_metadata_preserved'] is True)
    validate_protected(value['protected_metadata']); return copy.deepcopy(value)


def preserved(before, after, new_pin):
    if before is None or after is None:
        return False
    expected = copy.deepcopy(before); expected['frame_config']['native_image_id'] = new_pin
    return expected == after


def read_pair(io, new_pin):
    values = []
    for _ in range(2):
        try:
            values.append(validate_state(io.readback(),new_pin))
        except Exception:
            values.append(None)
    return values


def readback_result(before, after, independent, new_pin, process_confirmed=False):
    equal = after is not None and independent is not None and after == independent
    observed = equal and after['frame_config']['native_image_id'] == new_pin
    intact = preserved(before,after,new_pin) and preserved(before,independent,new_pin) if before is not None else None
    require(type(process_confirmed) is bool)
    verified = before is not None and observed and intact is True and process_confirmed
    return {'result':'passed' if verified else 'unconfirmed','application_verified_by_readback':verified,'new_pin_observed':observed,
            'original_baseline_available':before is not None,'independent_readback_equal':equal,'protected_before_after_equal':intact,
            'after':after,'independent_readback':independent,'automatic_dispatch_retry':False,'old_job_inputs_rewritten':False,
            'write_process_returned':process_confirmed}


def apply_once(io, new_pin):
    validate_new_pin(new_pin); before = validate_state(io.readback(),new_pin,require_old=True); io.verify_sources()
    io.claim({'target':origin.TARGET,'old_native_image_id':OLD_PIN,'new_native_image_id':new_pin,'before':before,
              'claimed_at':origin.stamp(),'dispatch_may_have_occurred':True})
    fresh = validate_state(io.readback(),new_pin,require_old=True); require(fresh == before); io.verify_sources()
    outcome = 'unconfirmed'; update = None; returned = False; process_unconfirmed = False
    def normal_return():
        nonlocal returned
        returned = True
    try:
        update = validate_update(io.dispatch(normal_return),new_pin); outcome = 'command_succeeded'
    except CommandProcessUnconfirmed:
        process_unconfirmed = True
    except Exception:
        pass
    after, independent = read_pair(io,new_pin)
    result = readback_result(before,after,independent,new_pin,process_confirmed=returned)
    if update is not None and update['protected_metadata'] != before['protected_metadata']:
        result['result'] = 'unconfirmed'; result['application_verified_by_readback'] = False
    try:
        io.verify_sources()
    except Exception:
        result['result'] = 'unconfirmed'; result['application_verified_by_readback'] = False
    return {**result,'before':before,'dispatch_attempted':True,'dispatch_outcome':outcome,'update_result_verified':update is not None,
            'command_process_unconfirmed':process_unconfirmed,
            'claim_retained':True,'scope':'One future frame-capture pin only; existing jobs, requests, facts, media and Ready snapshots unchanged. Old-pin jobs are not migrated or retried.'}


def render_update(template, new_pin):
    validate_new_pin(new_pin); require(type(template) is str and template.count('__HOSTED_NATIVE_IMAGE_ID__') == 1)
    return template.replace('__HOSTED_NATIVE_IMAGE_ID__',new_pin)


def source_pins():
    require(origin.digest(origin.public_bytes(ROOT/BASELINE_RECEIPT))==BASELINE_SHA256)
    validate_baseline(json.loads(origin.public_bytes(ROOT/BASELINE_RECEIPT)))
    require(re.fullmatch('[a-f0-9]{64}',FORWARD_SHA256))
    require(origin.digest(origin.public_bytes(HERE/'worker-forward31.py')) == FORWARD_SHA256)
    plan,shared = forward.public_release()
    adoption_pins={}
    for reference,expected in WORKER_ADOPTION.items():
        require(origin.digest(origin.public_bytes(ROOT/reference))==expected)
        receipt=json.loads(origin.public_bytes(ROOT/reference))
        require(receipt['result']=='passed'and receipt['write_process_returned']is True and receipt['application_verified_by_readback']is True
          and receipt['metadata_and_all_28_ids_preserved']is True and receipt['independent_readback_equal']is True
          and receipt['new_public_manifest_hash_observed']is True and receipt['private_values_or_digests_recorded']is False
          and receipt['project_id']==forward.PROJECT and receipt['team_id']==forward.TEAM and receipt['plan']==plan and receipt['sources']==shared
          and receipt['after']['manifest_sha256']==receipt['independent_readback']['manifest_sha256']==plan['next']['manifest_sha256'])
        adoption_pins[reference]=expected
    shared.update(adoption_pins)
    result = forward.common.static_sources()
    for relative, expected in PINS.items():
        actual = origin.digest(origin.public_bytes(ROOT/relative)); require(actual == expected); result[relative] = actual
    result.update(shared);result[BASELINE_RECEIPT]=BASELINE_SHA256
    result['development/m07/controlled-pilot/FRAME_PROTECTED31_BASELINE.sql']='a3428b5178368bbcbbb4a031be1f80360ed9e0dd1621c83a6c6f2e660dc29c62'
    require(origin.digest(origin.public_bytes(HERE/'FRAME_PROTECTED31_BASELINE.sql'))==result['development/m07/controlled-pilot/FRAME_PROTECTED31_BASELINE.sql'])
    result['development/m07/controlled-pilot/future-frame-protected31.py'] = origin.digest(origin.public_bytes(Path(__file__).resolve()))
    new=plan['next']
    pin={'native_image_id':new['native_image_id'],'image':'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+new['native_image_id'],
         'manifest_sha256':new['manifest_sha256'],'source_sha256':new['source_sha256']}
    return result,pin


def query_command(mode):
    require(mode in ('readback','update'))
    file = HERE/'FUTURE_FRAME_PROTECTED31_READBACK.sql' if mode == 'readback' else PRIVATE/'update.sql'
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',origin.TARGET,
            '--file',str(file),'--output-format','json','--workdir',str(ROOT)]


def query(mode,on_return=None,deadline=None):
    global QUERY_ATTEMPTS
    forward.validate_environment(os.environ)
    remaining=90 if deadline is None else deadline-forward.time.monotonic();require(remaining>0 and QUERY_ATTEMPTS<6);QUERY_ATTEMPTS+=1
    try:
        result = subprocess.run(query_command(mode),cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',
                                timeout=min(90,remaining),stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise CommandProcessUnconfirmed() from None
    # Only an actual process return can produce the claim-bound marker.
    if on_return is not None:
        on_return()
    require(result.returncode == 0 and len(result.stdout.encode()) <= 2*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
    value = json.loads(result.stdout); key = 'pilot_frame_protected31_readback' if mode == 'readback' else 'pilot_frame_protected31_update'
    require(type(value) is dict and type(value.get('rows')) is list and len(value['rows']) == 1)
    origin.exact(value['rows'][0], (key,)); return value['rows'][0][key]


def exclusive_json(file, value):
    verify_private()
    require(file.parent.resolve() == PRIVATE and file.parent.is_dir())
    descriptor = os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w',encoding='utf8',newline='\n') as handle:
        handle.write(json.dumps(value,sort_keys=True)+'\n'); handle.flush(); os.fsync(handle.fileno())


def validate_process_proof(value,claim_hash,new_pin):
    origin.exact(value,('schema_version','action','target','claim_sha256','new_native_image_id','process_returned_at'))
    require(value['schema_version']=='1.0' and value['action']=='future-frame-protected31' and value['target']==origin.TARGET
            and value['claim_sha256']==forward.sha(claim_hash) and value['new_native_image_id']==new_pin)
    stamp=value['process_returned_at']
    require(type(stamp) is str and stamp.endswith('+00:00') and datetime.datetime.fromisoformat(stamp).utcoffset()==datetime.timedelta(0))
    return True


class OperatorIO:
    def __init__(self, pins, manifest, rendered_hash):
        self.pins,self.manifest,self.rendered_hash = pins,manifest,rendered_hash
        self.deadline=forward.time.monotonic()+300

    def verify_sources(self):
        require(source_pins() == (self.pins,self.manifest))
        forward.common.fresh_gate((OLD_PIN,self.manifest['native_image_id']),self.deadline)
        require(origin.digest(origin.public_bytes(PRIVATE/'update.sql')) == self.rendered_hash)

    def readback(self):
        return query('readback',deadline=self.deadline)

    def dispatch(self,on_return):
        self.verify_sources();claim_hash=origin.digest(origin.public_bytes(CLAIM))
        def normal_return():
            require(origin.digest(origin.public_bytes(CLAIM))==claim_hash)
            exclusive_json(PROCESS_PROOF,{'schema_version':'1.0','action':'future-frame-protected31','target':origin.TARGET,
                'claim_sha256':claim_hash,'new_native_image_id':self.manifest['native_image_id'],'process_returned_at':origin.stamp()})
            on_return()
        return query('update',on_return=normal_return,deadline=self.deadline)

    def claim(self, value):
        exclusive_json(CLAIM,{**value,'sources':self.pins,'manifest':self.manifest,'rendered_update_sha256':self.rendered_hash})


def prepare_rendered_sql(new_pin):
    verify_private()
    rendered = render_update(origin.public_bytes(HERE/'FUTURE_FRAME_PROTECTED31.sql').decode('utf8'),new_pin).encode()
    file = PRIVATE/'update.sql'
    if file.exists():
        require(origin.public_bytes(file) == rendered)
    else:
        with file.open('xb') as handle:
            handle.write(rendered); handle.flush(); os.fsync(handle.fileno())
    return origin.digest(rendered)


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect','apply','readback')); forward.validate_environment(os.environ)
    action = sys.argv[1]; pins,manifest = source_pins(); new_pin = manifest['native_image_id']
    verify_private()
    rendered_hash = prepare_rendered_sql(new_pin); io = OperatorIO(pins,manifest,rendered_hash)
    forward.common.fresh_gate((OLD_PIN,new_pin),io.deadline)
    if action == 'apply':
        result = apply_once(io,new_pin)
    elif action == 'inspect':
        result = {'result':'passed','dispatch_attempted':False,'inspection':validate_state(io.readback(),new_pin),
                  'scope':'Read-only current pin, quiescence and protected fingerprints; no pin rotation performed'}
    else:
        after,independent = read_pair(io,new_pin); before = None; confirmed = False
        if CLAIM.exists():
            claim = json.loads(origin.public_bytes(CLAIM)); origin.exact(claim, ('target','old_native_image_id','new_native_image_id','before',
                'claimed_at','dispatch_may_have_occurred','sources','manifest','rendered_update_sha256'))
            require(claim['target'] == origin.TARGET and claim['old_native_image_id'] == OLD_PIN and claim['new_native_image_id'] == new_pin
                    and claim['sources'] == pins and claim['manifest'] == manifest and claim['rendered_update_sha256'] == rendered_hash
                    and claim['dispatch_may_have_occurred'] is True)
            before = validate_state(claim['before'],new_pin,require_old=True)
            if PROCESS_PROOF.exists():
                confirmed=validate_process_proof(json.loads(origin.public_bytes(PROCESS_PROOF)),origin.digest(origin.public_bytes(CLAIM)),new_pin)
        result = {**readback_result(before,after,independent,new_pin,process_confirmed=confirmed),'dispatch_attempted':False}
    io.verify_sources()
    report = {'schema_version':'1.0','observed_at':origin.stamp(),'target':origin.TARGET,'action':action,'sources':pins,'manifest':manifest,
              'rendered_update_sha256':rendered_hash,**result,'credentials_or_raw_cli_diagnostics_persisted':False,
              'old_jobs_retried_or_rewritten':False,'lease_or_queue_state_forced':False,'maximum_operator_io_seconds':300,'frame_sql_cli_attempts':QUERY_ATTEMPTS,'maximum_frame_sql_cli_attempts':6,'canonical_readonly_cli_attempts':forward.common.READONLY_ATTEMPTS,'maximum_canonical_readonly_cli_attempts':24}
    directory = ROOT/'tracking/evidence/m07/controlled-pilot'; directory.mkdir(parents=True,exist_ok=True)
    file = directory/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-future-frame-protected31-{action}.json"
    with file.open('x',encoding='utf8',newline='\n') as handle:
        handle.write(json.dumps(report,indent=2)+'\n'); handle.flush(); os.fsync(handle.fileno())
    print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'dispatch_attempted':report['dispatch_attempted'],
                      'automatic_dispatch_retry':False,'raw_diagnostics_suppressed':True}))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print(json.dumps({'result':'unconfirmed','raw_diagnostics_suppressed':True,'next_action':'readback only; do not replay unknown rotation'}))
        sys.exit(1)
