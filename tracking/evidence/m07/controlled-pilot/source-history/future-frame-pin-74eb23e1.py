"""Fixed future-frame pin rotation. Root executes; imports do not access credentials/providers.

Actual new identity comes only from the existing frozen49 baked manifest. The
one-row DML preserves old requests/jobs/results; old-pin retries remain fenced.
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
SOURCE = '5f9114a20cfa195282b53a89b3e3614e706f16fb1e4ed986d477e451086c5558'
OLD_PIN = 'sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'
MANIFEST = ROOT/'.local/worker-hosting/49a1a0f8-c1b6-4704-8c27-fb84adad4cab/context/apps/worker/native-sandbox-manifest.json'
PRIVATE = ROOT/'.local/m07-pilot/future-frame-pin'
CLAIM = PRIVATE/'apply.claim.json'
PINS = {'development/m07/controlled-pilot/future-origin.py':'7d15c917bd781fd89a75e3efe36c561d9933ba64e3309b583c04b7ba5accee44',
        'development/m07/controlled-pilot/FUTURE_FRAME_PIN.sql':'45d3f3d0dd66389badbc41f8e95f68accf88e1c5b857d003075630cd0c20e2a0',
        'development/m07/controlled-pilot/FUTURE_FRAME_PIN_READBACK.sql':'d20499beb160ba6bda2f0cc5ec10047b0f7e93d249195f6e9da0278eb703c377'}
FINGERPRINTS = ('versions','slides','pins','ready_asset_metadata','native_jobs','native_outbox',
                'requests','payloads','candidates','candidate_media','frames')


def require(value):
    if not value:
        raise ValueError('FUTURE_FRAME_PIN_UNCONFIRMED')


def validate_new_pin(value):
    require(type(value) is str and re.fullmatch('sha256:[a-f0-9]{64}',value) and value != OLD_PIN)


def manifest_pin(data):
    require(type(data) is bytes and 0 < len(data) <= 4096)
    try:
        value = json.loads(data.decode('utf8'))
    except (ValueError,UnicodeError):
        raise ValueError('FUTURE_FRAME_PIN_UNCONFIRMED') from None
    origin.exact(value, ('schema_version','transport','protocol','image','region','source_sha256'))
    require(value['schema_version'] == '1.0' and value['transport'] == 'vercel_sandbox' and value['protocol'] == 'eps-native-files-v1'
            and value['region'] == 'dub1' and value['source_sha256'] == SOURCE)
    require(type(value['image']) is str and re.fullmatch(r'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:[a-f0-9]{64}',value['image']))
    pin = value['image'].split('@')[1]; validate_new_pin(pin)
    return {'native_image_id':pin,'image':value['image'],'manifest_sha256':hashlib.sha256(data).hexdigest(),'source_sha256':SOURCE}


def validate_protected(value):
    origin.exact(value, (*FINGERPRINTS,'protected_m02'))
    origin.validate_metadata({key:value[key] for key in ('versions','slides','pins','ready_asset_metadata','protected_m02')})
    for key in FINGERPRINTS:
        origin.exact(value[key], ('count','sha256')); origin.integer(value[key]['count'])
        require(type(value[key]['sha256']) is str and re.fullmatch('[a-f0-9]{64}',value[key]['sha256']))


def validate_state(value, new_pin, require_old=False):
    validate_new_pin(new_pin); origin.exact(value, ('context','frame_config','protected_metadata'))
    context = value['context']
    origin.exact(context, ('database','operator','history','configuration_count','unexpected_config_triggers','active_native_jobs','leased_native_dispatches'))
    require(context['database'] == context['operator'] == 'postgres' and context['history'] == list(origin.VERSIONS))
    require(type(context['configuration_count']) is int and context['configuration_count'] == 1)
    for key in ('unexpected_config_triggers','active_native_jobs','leased_native_dispatches'):
        require(type(context[key]) is int and context[key] == 0)
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


def readback_result(before, after, independent, new_pin):
    equal = after is not None and independent is not None and after == independent
    observed = equal and after['frame_config']['native_image_id'] == new_pin
    intact = preserved(before,after,new_pin) and preserved(before,independent,new_pin) if before is not None else None
    verified = before is not None and observed and intact is True
    return {'result':'passed' if verified else 'unconfirmed','application_verified_by_readback':verified,'new_pin_observed':observed,
            'original_baseline_available':before is not None,'independent_readback_equal':equal,'protected_before_after_equal':intact,
            'after':after,'independent_readback':independent,'automatic_dispatch_retry':False,'old_job_inputs_rewritten':False}


def apply_once(io, new_pin):
    validate_new_pin(new_pin); before = validate_state(io.readback(),new_pin,require_old=True); io.verify_sources()
    io.claim({'target':origin.TARGET,'old_native_image_id':OLD_PIN,'new_native_image_id':new_pin,'before':before,
              'claimed_at':origin.stamp(),'dispatch_may_have_occurred':True})
    fresh = validate_state(io.readback(),new_pin,require_old=True); require(fresh == before); io.verify_sources()
    outcome = 'unconfirmed'; update = None
    try:
        update = validate_update(io.dispatch(),new_pin); outcome = 'command_succeeded'
    except Exception:
        pass
    after, independent = read_pair(io,new_pin)
    result = readback_result(before,after,independent,new_pin)
    if update is not None and update['protected_metadata'] != before['protected_metadata']:
        result['result'] = 'unconfirmed'; result['application_verified_by_readback'] = False
    try:
        io.verify_sources()
    except Exception:
        result['result'] = 'unconfirmed'; result['application_verified_by_readback'] = False
    return {**result,'before':before,'dispatch_attempted':True,'dispatch_outcome':outcome,'update_result_verified':update is not None,
            'claim_retained':True,'scope':'One future frame-capture pin only; existing jobs, requests, facts, media and Ready snapshots unchanged. Old-pin jobs are not migrated or retried.'}


def render_update(template, new_pin):
    validate_new_pin(new_pin); require(type(template) is str and template.count('__HOSTED_NATIVE_IMAGE_ID__') == 1)
    return template.replace('__HOSTED_NATIVE_IMAGE_ID__',new_pin)


def source_pins():
    result = origin.source_pins()
    for relative, expected in PINS.items():
        actual = origin.digest(origin.public_bytes(ROOT/relative)); require(actual == expected); result[relative] = actual
    result['development/m07/controlled-pilot/future-frame-pin.py'] = origin.digest(origin.public_bytes(Path(__file__).resolve()))
    pin = manifest_pin(origin.public_bytes(MANIFEST,4096)); result['frozen_manifest_sha256'] = pin['manifest_sha256']
    return result, pin


def query_command(mode):
    require(mode in ('readback','update'))
    file = HERE/'FUTURE_FRAME_PIN_READBACK.sql' if mode == 'readback' else PRIVATE/'update.sql'
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',origin.TARGET,
            '--file',str(file),'--output-format','json','--workdir',str(ROOT)]


def query(mode):
    result = subprocess.run(query_command(mode),cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',
                            timeout=90,stdin=subprocess.DEVNULL)
    require(result.returncode == 0 and len(result.stdout.encode()) <= 2*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
    value = json.loads(result.stdout); key = 'pilot_frame_pin_readback' if mode == 'readback' else 'pilot_frame_pin_update'
    require(type(value) is dict and type(value.get('rows')) is list and len(value['rows']) == 1)
    origin.exact(value['rows'][0], (key,)); return value['rows'][0][key]


def exclusive_json(file, value):
    require(file.parent.resolve() == PRIVATE and file.parent.is_dir())
    descriptor = os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w',encoding='utf8',newline='\n') as handle:
        handle.write(json.dumps(value,sort_keys=True)+'\n'); handle.flush(); os.fsync(handle.fileno())


class OperatorIO:
    def __init__(self, pins, manifest, rendered_hash):
        self.pins,self.manifest,self.rendered_hash = pins,manifest,rendered_hash

    def verify_sources(self):
        require(source_pins() == (self.pins,self.manifest))
        require(origin.digest(origin.public_bytes(PRIVATE/'update.sql')) == self.rendered_hash)

    def readback(self):
        return query('readback')

    def dispatch(self):
        self.verify_sources(); return query('update')

    def claim(self, value):
        exclusive_json(CLAIM,{**value,'sources':self.pins,'manifest':self.manifest,'rendered_update_sha256':self.rendered_hash})


def prepare_rendered_sql(new_pin):
    PRIVATE.mkdir(parents=True,exist_ok=True); require(PRIVATE.resolve() == PRIVATE and not PRIVATE.is_symlink())
    rendered = render_update(origin.public_bytes(HERE/'FUTURE_FRAME_PIN.sql').decode('utf8'),new_pin).encode()
    file = PRIVATE/'update.sql'
    if file.exists():
        require(origin.public_bytes(file) == rendered)
    else:
        with file.open('xb') as handle:
            handle.write(rendered); handle.flush(); os.fsync(handle.fileno())
    return origin.digest(rendered)


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect','apply','readback')); origin.validate_environment(os.environ)
    action = sys.argv[1]; pins,manifest = source_pins(); new_pin = manifest['native_image_id']
    rendered_hash = prepare_rendered_sql(new_pin); io = OperatorIO(pins,manifest,rendered_hash)
    if action == 'apply':
        result = apply_once(io,new_pin)
    elif action == 'inspect':
        result = {'result':'passed','dispatch_attempted':False,'inspection':validate_state(io.readback(),new_pin),
                  'scope':'Read-only current pin, quiescence and protected fingerprints; no pin rotation performed'}
    else:
        after,independent = read_pair(io,new_pin); before = None
        if CLAIM.exists():
            claim = json.loads(origin.public_bytes(CLAIM)); origin.exact(claim, ('target','old_native_image_id','new_native_image_id','before',
                'claimed_at','dispatch_may_have_occurred','sources','manifest','rendered_update_sha256'))
            require(claim['target'] == origin.TARGET and claim['old_native_image_id'] == OLD_PIN and claim['new_native_image_id'] == new_pin
                    and claim['sources'] == pins and claim['manifest'] == manifest and claim['rendered_update_sha256'] == rendered_hash
                    and claim['dispatch_may_have_occurred'] is True)
            before = validate_state(claim['before'],new_pin,require_old=True)
        result = {**readback_result(before,after,independent,new_pin),'dispatch_attempted':False}
    io.verify_sources()
    report = {'schema_version':'1.0','observed_at':origin.stamp(),'target':origin.TARGET,'action':action,'sources':pins,'manifest':manifest,
              'rendered_update_sha256':rendered_hash,**result,'credentials_or_raw_cli_diagnostics_persisted':False,
              'old_jobs_retried_or_rewritten':False,'lease_or_queue_state_forced':False}
    directory = ROOT/'tracking/evidence/m07/controlled-pilot'; directory.mkdir(parents=True,exist_ok=True)
    file = directory/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-future-frame-pin-{action}.json"
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
