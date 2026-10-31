"""Source-only release admission and fixed read-only canonical31 checks.

No OAuth activation/core acceptance gate is invoked. The pure release validator
is reused from its reviewed public source; actual native adoption has its own
unsealed plan, exact image proofs, current runtime and quiescence requirements.
"""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

guard=module('native31_pure_release_validator',HERE/'oauth31-guard.py')
canonical=module('native31_frozen_canonical_sources',HERE.parent/'specs-ack31/canonical-continuation.py')
CANONICAL_SHA='2e894606ccb0eded975b805ab5290896a0dbcd5bf92e48b3fd0f6f646be3a371'
GUARD_SHA='2bb655b62dedd61aff1e60f07722473dcbe92e53149b57340c4fcf6d1f2532d1'
HOOK_SQL_SHA='43f0daedb3c341ebde0b254c24fa4505301570d21ca7a11fad7ebfd548ecdeca'
CANONICAL_REFERENCES={
 'apply':{'receipt':'tracking/evidence/m07/specs-ack31/2026-10-31T01-57-10-621248Z-a99247a4-canonical31-continuation-apply.json','sha256':'c457af902ff1f79567ae2f4839da669be11cfbcbf0695442d26bab66f9faf285'},
 'readback':{'receipt':'tracking/evidence/m07/specs-ack31/2026-10-31T01-58-36-630017Z-222f51dc-canonical31-continuation-readback.json','sha256':'d3416c80ea7ec6f991b1698347e90792c5e46be40adcc50c52075885ab66d7be'}}
VERSIONS=(*canonical.m.origin.VERSIONS,canonical.m.VERSION)
READONLY_ATTEMPTS=0

def native_proof_reference(value):
    guard.exact(value,('receipt','sha256'));relative=value['receipt'];guard.sha(value['sha256'])
    guard.require(type(relative)is str and len(relative)<=300 and re.fullmatch(r'tracking/evidence/m07/(?:worker-hosting|controlled-pilot)/[A-Za-z0-9_.+-]+\.json',relative))
    return value

def canonical_source_pins():
    return {path:sha for path,sha in canonical.load_inputs()['pins'].items()if path.startswith('development/m07/specs-ack31/')}

def static_sources():
    guard.validate_environment(os.environ)
    require=guard.require;read=guard.public_bytes;digest=guard.digest
    require(digest(read(HERE/'oauth31-guard.py'))==GUARD_SHA and digest(read(HERE.parent/'specs-ack31/canonical-continuation.py'))==CANONICAL_SHA)
    require(digest(read(HERE/'OAUTH31_GUARD.sql'))==HOOK_SQL_SHA)
    inputs=canonical.load_inputs();pins=dict(inputs['pins']);source_pins=canonical_source_pins();receipts={}
    for action,ref in CANONICAL_REFERENCES.items():
        raw=read(ROOT/ref['receipt']);require(digest(raw)==ref['sha256']);value=json.loads(raw)
        require(value['action']==action);guard.validate_release(value,{'canonical_source_pins':source_pins})
        receipts[action]=value;pins[ref['receipt']]=ref['sha256']
    require(receipts['apply']['before_summary']==receipts['readback']['before_summary']
      and receipts['apply']['after_summary']==receipts['readback']['after_summary'])
    pins['development/m07/controlled-pilot/oauth31-guard.py']=GUARD_SHA
    pins['development/m07/controlled-pilot/OAUTH31_GUARD.sql']=HOOK_SQL_SHA
    pins['development/m07/controlled-pilot/native-forward31-common.py']=digest(read(Path(__file__)))
    return pins

def validate_runtime_state(value,allowed_native):
    canonical.m.g.shape(value);guard.require(value['context']['migration_versions']==list(VERSIONS)
      and value['protected_data']['versions']==list(VERSIONS)and value['catalog'][canonical.m.g.ACK]==guard.ACK_BODY)
    guard.require(type(allowed_native)is tuple and 1<=len(allowed_native)<=2
      and all(type(pin)is str and re.fullmatch('sha256:[a-f0-9]{64}',pin)for pin in allowed_native)
      and value['admission']['frame_native_image_id']in allowed_native)
    # Reapply the frozen full predecessor invariant after removing ONLY the
    # reviewed31 ACK/history delta and separately validated future-frame pin.
    # Never mutate the actual observed state or the imported module globals.
    projected=copy.deepcopy(value);projected['catalog'][canonical.m.g.ACK]=canonical.m.g.OLD
    projected['context']['migration_versions']=list(canonical.m.origin.VERSIONS)
    projected['protected_data']['versions']=list(canonical.m.origin.VERSIONS)
    projected['admission']['frame_native_image_id']=canonical.m.g.NATIVE
    inputs=canonical.load_inputs();canonical.m.g.validate_before(projected,canonical.m.origin.VERSIONS,inputs['trust'])
    return value

def query_readonly(mode,deadline):
    global READONLY_ATTEMPTS
    guard.validate_environment(os.environ);guard.require(mode in('snapshot','hook'))
    remaining=deadline-time.monotonic();guard.require(remaining>0 and READONLY_ATTEMPTS<24);READONLY_ATTEMPTS+=1
    file=HERE.parent/'specs-ack31/canonical-query.sql'if mode=='snapshot'else HERE/'OAUTH31_GUARD.sql'
    key='specs_ack31_state'if mode=='snapshot'else'oauth31_guard'
    result=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',guard.TARGET,
      '--file',str(file),'--output-format','json','--workdir',str(ROOT)],cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=min(60,remaining),stdin=subprocess.DEVNULL)
    guard.require(result.returncode==0 and len(result.stdout.encode())<=16*1024*1024 and len(result.stderr.encode())<=1024*1024)
    value=json.loads(result.stdout);guard.require(type(value)is dict and type(value.get('rows'))is list and len(value['rows'])==1)
    guard.exact(value['rows'][0],(key,));return value['rows'][0][key]

def fresh_gate(allowed_native,deadline):
    static_sources()
    value=validate_runtime_state(query_readonly('snapshot',deadline),allowed_native)
    hook=guard.validate_state(query_readonly('hook',deadline))
    return {'history':list(VERSIONS),'ack_body_sha256':guard.ACK_BODY,'hook_body_sha256':guard.HOOK_BODY,
      'active_jobs':value['admission']['active_jobs'],'leased_outbox':value['admission']['leased_outbox'],
      'runtime_execute_count':len(value['admission']['runtime']['execute']),'frame_native_image_id':value['admission']['frame_native_image_id'],
      'hook_and_ack_security_verified':all(item is True for item in(*hook['hook_security'].values(),*hook['ack_security'].values()))}

def validate_strong_presentation(value):
    expected={'page_count':5,'candidate_field_count':40,'frame_draw_count':6,'logo_draw_count':5,'expected_image_draws':11,'video_link_count':4,'unique_image_count':7}
    guard.require(value.get('presentation_fixture')==expected)
    rows=value.get('presentation_checks');tasks=('presentation_render','presentation_validate','presentation_export_render','presentation_export_validate')
    guard.require(type(rows)is list and len(rows)==4)
    for task,row in zip(tasks,rows):
        guard.exact(row,('task','page_count','rendered_candidate_fields','rendered_frame_draws','rendered_logo_draws','validated_image_draws','video_links','pdf_bytes'))
        render=task.endswith('render');guard.require(row['task']==task and row['page_count']==5 and row['video_links']==4
          and type(row['pdf_bytes'])is int and 100<=row['pdf_bytes']<=64*1024**2
          and row['rendered_candidate_fields']==(40 if render else None)and row['rendered_frame_draws']==(6 if render else None)
          and row['rendered_logo_draws']==(5 if render else None)and row['validated_image_draws']==(None if render else 11))
