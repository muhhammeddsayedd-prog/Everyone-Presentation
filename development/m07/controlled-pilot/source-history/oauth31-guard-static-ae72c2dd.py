"""DRAFT read-only history31 admission. No provider configuration or key access.

The original history30 foundation stays frozen. Empty admission seals and absent
actual release/core proofs refuse before CLI. Imports read public source only.
"""
from pathlib import Path, PurePosixPath
import copy
import datetime
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
BASE_SHA='7d15c917bd781fd89a75e3efe36c561d9933ba64e3309b583c04b7ba5accee44'
BASE_PREFLIGHT_SHA256='b66939e0feed102ad0b99157d726904f4c3a84fd6dfc2341ed749951badc6219'
base_file=HERE/'future-origin.py'
if not base_file.is_file() or base_file.is_symlink() or base_file.resolve()!=base_file or hashlib.sha256(base_file.read_bytes()).hexdigest()!=BASE_SHA:
    raise ValueError('OAUTH31_GUARD_UNCONFIRMED')
spec=importlib.util.spec_from_file_location('oauth31_frozen_origin30',base_file)
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
TARGET=base.TARGET
HOST='https://everyone-presentation-pilot.vercel.app'
WEB_PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0'
VERSION='20261031010000'
OLD_VERSIONS=tuple(base.VERSIONS)
VERSIONS=(*OLD_VERSIONS,VERSION)
CANDIDATE='development/m07/specs-ack31/candidate.sql'
MIGRATION='supabase/migrations/'+VERSION+'_m07_specs_submit_ack_projection.sql'
CANDIDATE_SHA='c1c4cb41460df067d726e4058cc24eacbcf55e5cc73e6a18365394e2c2fbc5e5'
OLD_ACK='3a164335af33462b20dff3e1dffdcd26bec1c57d39e9028ef999adbf29eb89a4'
ACK_BODY='e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'
HOOK_BODY='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'
CORE='tracking/evidence/m07/controlled-pilot/HOSTED_CORE.json'
CORE_CHECKS=('projects','settings','processing','specs_openai_n8n','video_openai_n8n','native_frames','selection_pdf','guest_feedback','guest_original_video')
HOOK_CHECKS=('owner_and_body','auth_admin_execute','no_public_client_execute','auth_admin_schema','auth_admin_no_other_eps_execute','no_issuer_schema_create','registry_forced_rls','capability_forced_rls')
ACK_CHECKS=('owner_body','owner_execute','public_execute_denied','column_selects','whole_job_select_denied')
PLAN=HERE/'OAUTH31_PLAN.json'
SQL=HERE/'OAUTH31_GUARD.sql'
PLAN_SHA256=''  # Root actual canonical31 + all nine hosted core proofs required.
SQL_SHA256='43f0daedb3c341ebde0b254c24fa4505301570d21ca7a11fad7ebfd548ecdeca'
RELEASE_FIELDS=('schema_version','evidence_kind','observed_at','target','action','result','phase','version','migration_path','migration_sha256','source_pins','local_proof',
 'before_summary','after_summary','independent_summary','dispatch_attempted','dispatch_process_returned','normal_return_marker_observed',
 'application_verified_by_readback','independent_readback_equal','protected_before_after_equal','claim_retained','helper_dispatch_retry','cli_internal_retries_not_characterized',
 'cli_commands_attempted','raw_source_credentials_or_cli_diagnostics_persisted','cli_short_login_expiry_qualifications','finished_at','helper_sha256')
FROZEN={
 'development/m07/controlled-pilot/future-origin.py':BASE_SHA,
 'development/m07/controlled-pilot/hosted-provider.py':'be12528355d2ade7b82e0f1231632d9dea752b54be258c7342530974380b7d73',
 'development/m07/controlled-pilot/hosted-oauth-client.py':'c3be05e05d9bf9c80bad906903007ee9fbcc663c0c0eeb79efc0d877c17d22e2',
 'development/m07/controlled-pilot/hosted-binding.py':'6876e4eceea337d2a127c7023eeeadda2b7b85693d2c339061d60b55dc3d4cc3',
 'development/m07/controlled-pilot/hosted-web-oauth-env.mjs':'c9f9a9d6b42f3de120df656aa61b31acdee5170a4061b4d7a900daaf727120de'}
FORBIDDEN_ENV=set(base.FORBIDDEN_ENV)|{'SUPABASE_DEBUG','NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_TLS_REJECT_UNAUTHORIZED',
 'NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'}
# Explicit aliases only. Never mutate base.VERSIONS or its module globals.
exact=base.exact;canonical_uuid=base.canonical_uuid;integer=base.integer
public_bytes=base.public_bytes;digest=base.digest;stamp=base.stamp


def require(value):
    if not value:raise ValueError('OAUTH31_GUARD_UNCONFIRMED')


def sha(value):require(type(value) is str and re.fullmatch('[a-f0-9]{64}',value));return value


def validate_environment(environment):
    require(not any(value for key,value in environment.items() if key.upper() in FORBIDDEN_ENV))


def receipt_path(value):
    require(type(value) is str and len(value)<=300 and re.fullmatch(r'tracking/evidence/m07/(?:controlled-pilot|specs-ack31)/[A-Za-z0-9_./+-]+\.json',value)
            and '..' not in PurePosixPath(value).parts and not PurePosixPath(value).is_absolute() and '\\' not in value and ':' not in value)
    return ROOT/value


def validate_plan(value):
    exact(value,('schema_version','status','target','version','candidate_path','candidate_sha256','migration_path','migration_sha256',
                 'canonical_release_receipt','canonical_release_sha256','canonical_source_pins','hosted_core_sha256'))
    require(value['schema_version']=='1.0' and value['status']=='actual_canonical31_and_hosted_core' and value['target']==TARGET and value['version']==VERSION
      and value['candidate_path']==CANDIDATE and value['candidate_sha256']==CANDIDATE_SHA and value['migration_path']==MIGRATION and value['migration_sha256']==CANDIDATE_SHA)
    receipt_path(value['canonical_release_receipt']);sha(value['canonical_release_sha256']);sha(value['hosted_core_sha256'])
    pins=value['canonical_source_pins'];require(type(pins) is dict and 1<=len(pins)<=64)
    require({'development/m07/specs-ack31/'+name for name in ('canonical-release.py','canonical_guards.py','canonical_sql.py','canonical-plan.json','canonical-query.sql')}<=set(pins))
    for relative,expected in pins.items():
        require(type(relative) is str and re.fullmatch(r'development/m07/specs-ack31/[A-Za-z0-9_.-]+\.(?:py|sql|json|mjs)',relative) and '..' not in relative);sha(expected)
        if relative==CANDIDATE:require(expected==CANDIDATE_SHA)
    return copy.deepcopy(value)


def validate_core(value):
    exact(value,('schema_version','result','target','origin','web_project_id','web_deployment_id','acting_user_id','core_checks','evidence_receipts'))
    require(value['schema_version']=='1.0' and value['result']=='passed' and value['target']==TARGET and value['origin']==HOST and value['web_project_id']==WEB_PROJECT
      and type(value['web_deployment_id']) is str and re.fullmatch('dpl_[A-Za-z0-9]{8,100}',value['web_deployment_id']))
    canonical_uuid(value['acting_user_id']);exact(value['core_checks'],CORE_CHECKS)
    require(all(type(item) is str and item=='passed' for item in value['core_checks'].values()))
    refs=value['evidence_receipts'];require(type(refs) is list and 1<=len(refs)<=128 and len(set(refs))==len(refs))
    for ref in refs:require(receipt_path(ref)!=ROOT/CORE)
    return copy.deepcopy(value)


def validate_release(value,plan):
    exact(value,RELEASE_FIELDS)
    require(value['schema_version']=='1.0' and value['evidence_kind']=='actual_canonical_observation' and value['target']==TARGET and value['action'] in ('apply','readback')
      and value['result']=='passed' and value['version']==VERSION and value['migration_path']==MIGRATION and value['migration_sha256']==CANDIDATE_SHA
      and value['helper_dispatch_retry'] is False)
    pins=value['source_pins'];require(type(pins) is dict and 1<=len(pins)<=256)
    for relative,expected in pins.items():
        require(type(relative) is str and '..' not in relative and '\\' not in relative and ':' not in relative
          and re.fullmatch(r'(?:(?:development|tools)/[A-Za-z0-9_./+-]+\.(?:py|mjs|sql|json|md)|supabase/migrations/[A-Za-z0-9_-]+\.sql|tracking/evidence/[A-Za-z0-9_./+-]+\.json|supabase/config\.toml|supabase/\.temp/project-ref)',relative));sha(expected)
    require(pins.get(CANDIDATE)==pins.get(MIGRATION)==CANDIDATE_SHA)
    require(all(pins.get(relative)==expected for relative,expected in plan['canonical_source_pins'].items()))
    require(value['helper_sha256']==plan['canonical_source_pins']['development/m07/specs-ack31/canonical-release.py'])
    require(type(value['phase']) is str and re.fullmatch('[a-z0-9_-]{1,100}',value['phase']) and type(value['cli_internal_retries_not_characterized']) is bool
      and type(value['cli_commands_attempted']) is int and 0<=value['cli_commands_attempted']<=1000 and value['raw_source_credentials_or_cli_diagnostics_persisted'] is False)
    times=[]
    for key in ('observed_at','finished_at'):
        require(type(value[key]) is str and value[key].endswith(('+00:00','Z')))
        parsed=datetime.datetime.fromisoformat(value[key].replace('Z','+00:00'));require(parsed.utcoffset()==datetime.timedelta(0));times.append(parsed)
    require(times[1]>=times[0])
    for key in ('normal_return_marker_observed','application_verified_by_readback','independent_readback_equal','protected_before_after_equal','claim_retained'):require(value[key] is True)
    require(type(value['dispatch_attempted']) is bool and type(value['dispatch_process_returned']) is bool)
    if value['action']=='apply':require(value['dispatch_attempted'] is True and value['dispatch_process_returned'] is True)
    else:require(value['dispatch_attempted'] is False)
    for key,history,body in [('before_summary',OLD_VERSIONS,OLD_ACK),('after_summary',VERSIONS,ACK_BODY),('independent_summary',VERSIONS,ACK_BODY)]:
        summary=value[key];require(type(summary) is dict and summary.get('history')==list(history)
            and summary.get('ack_body_sha256')==body and summary.get('hook_body_sha256')==HOOK_BODY)
    return copy.deepcopy(value)


def validate_state(value):
    exact(value,('database','operator','history','hook_security','ack_security','hook_body_sha256','ack_body_sha256'))
    require(value['database']==value['operator']=='postgres' and value['history']==list(VERSIONS)
      and value['hook_body_sha256']==HOOK_BODY and value['ack_body_sha256']==ACK_BODY)
    exact(value['hook_security'],HOOK_CHECKS);exact(value['ack_security'],ACK_CHECKS)
    require(all(item is True for item in (*value['hook_security'].values(),*value['ack_security'].values())))
    return copy.deepcopy(value)


def validate_gate(value,require_actual=True):
    exact(value,('schema_version','evidence_kind','result','target','history','guard_plan_sha256','canonical_release_receipt_sha256','hosted_core_sha256','source_pins','database_state'))
    require(value['schema_version']=='1.0' and value['result']=='passed' and value['target']==TARGET and value['history']==list(VERSIONS)
      and value['evidence_kind'] in ('actual_canonical_readonly_guard','controlled_source_test'))
    if require_actual:require(value['evidence_kind']=='actual_canonical_readonly_guard')
    for key in ('guard_plan_sha256','canonical_release_receipt_sha256','hosted_core_sha256'):sha(value[key])
    require(type(value['source_pins']) is dict and 1<=len(value['source_pins'])<=256)
    for relative,expected in value['source_pins'].items():require(type(relative) is str and relative.startswith(('development/','tracking/','supabase/','tools/')) and '..' not in relative and '\\' not in relative and ':' not in relative);sha(expected)
    validate_state(value['database_state']);return copy.deepcopy(value)


def static_source_pins():
    # Reuse frozen public-file provenance, with our own exact31 inventory.
    # The old preflight is not executed; its derived digest is checked here and
    # bound by BASE_SHA rather than leaking a nonpath entry into the gate.
    pins={}
    for relative,expected in base.PINS.items():
        require(digest(public_bytes(ROOT/relative))==expected);pins[relative]=expected
    require(public_bytes(ROOT/'supabase/.temp/project-ref').decode().strip()==TARGET)
    require(tuple(sorted(file.name[:14]for file in(ROOT/'supabase/migrations').glob('*.sql')))==VERSIONS)
    require(digest(public_bytes(base_file))==BASE_SHA and digest(base.PREFLIGHT_SQL.encode())==BASE_PREFLIGHT_SHA256)
    pins[base_file.relative_to(ROOT).as_posix()]=BASE_SHA
    return pins


def public_inputs():
    sha(PLAN_SHA256);sha(SQL_SHA256);raw=public_bytes(PLAN);require(digest(raw)==PLAN_SHA256);plan=validate_plan(json.loads(raw))
    pins=static_source_pins()
    for relative,expected in {**FROZEN,CANDIDATE:CANDIDATE_SHA,MIGRATION:CANDIDATE_SHA,**plan['canonical_source_pins']}.items():
        require(digest(public_bytes(ROOT/relative,16*1024*1024))==expected);pins[relative]=expected
    require(digest(public_bytes(SQL))==SQL_SHA256);pins[SQL.relative_to(ROOT).as_posix()]=SQL_SHA256
    release_raw=public_bytes(receipt_path(plan['canonical_release_receipt']),2*1024*1024);require(digest(release_raw)==plan['canonical_release_sha256'])
    release=validate_release(json.loads(release_raw),plan);pins[plan['canonical_release_receipt']]=plan['canonical_release_sha256']
    for relative,expected in release['source_pins'].items():
        require(digest(public_bytes(ROOT/relative,16*1024*1024))==expected)
        if relative in pins:require(pins[relative]==expected)
        pins[relative]=expected
    core_raw=public_bytes(ROOT/CORE);require(digest(core_raw)==plan['hosted_core_sha256']);core=validate_core(json.loads(core_raw));pins[CORE]=plan['hosted_core_sha256']
    for relative in core['evidence_receipts']:pins[relative]=digest(public_bytes(receipt_path(relative),2*1024*1024))
    pins[PLAN.relative_to(ROOT).as_posix()]=PLAN_SHA256;pins[Path(__file__).resolve().relative_to(ROOT).as_posix()]=digest(public_bytes(Path(__file__).resolve()))
    return {'plan':plan,'core':core,'release':release,'pins':pins,'plan_sha256':PLAN_SHA256}


def source_pins():
    return public_inputs()['pins']


def query_command():
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(SQL),'--output-format','json','--workdir',str(ROOT)]


class LiveIO:
    def inputs(self):return public_inputs()
    def read_database(self):
        validate_environment(os.environ)
        result=subprocess.run(query_command(),cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=45,stdin=subprocess.DEVNULL)
        require(result.returncode==0 and len(result.stdout.encode())<=128*1024 and len(result.stderr.encode())<=64*1024)
        value=json.loads(result.stdout);require(type(value) is dict and type(value.get('rows')) is list and len(value['rows'])==1)
        exact(value['rows'][0],('oauth31_guard',));return value['rows'][0]['oauth31_guard']


def admit31(io=None):
    controlled=io is not None;io=LiveIO() if io is None else io
    initial=io.inputs();exact(initial,('plan','core','release','pins','plan_sha256'));plan=validate_plan(initial['plan']);validate_core(initial['core']);validate_release(initial['release'],plan);sha(initial['plan_sha256'])
    state=validate_state(io.read_database());require(io.inputs()==initial)
    result={'schema_version':'1.0','evidence_kind':'controlled_source_test' if controlled else 'actual_canonical_readonly_guard','result':'passed','target':TARGET,'history':list(VERSIONS),
      'guard_plan_sha256':initial['plan_sha256'],'canonical_release_receipt_sha256':plan['canonical_release_sha256'],'hosted_core_sha256':plan['hosted_core_sha256'],
      'source_pins':initial['pins'],'database_state':state}
    return validate_gate(result,require_actual=not controlled)


if __name__=='__main__':
    try:
        require(len(sys.argv)==2 and sys.argv[1]=='admit');validate_environment(os.environ)
        print(json.dumps(admit31(),separators=(',',':')))
    except Exception:
        print(json.dumps({'result':'unconfirmed','code':'OAUTH31_GUARD_UNCONFIRMED','raw_diagnostics_suppressed':True}));sys.exit(1)
