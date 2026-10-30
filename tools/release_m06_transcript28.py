"""Fixed28->28 frozen-source companion release. Importing is inert; root owns execution.

No SQL/target/credential/seed/reset/force/retry option. Exclusive protected claim
precedes one db push; unknown outcomes use independent readback only.
"""
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib
import uuid
from release_foundation import ROOT, TARGET, call as cli_call

MIGRATION = '20261030030717_m06_frozen_video_source_transcripts.sql'
CONFIG = 'development/m06/transcript28-review-release.json'
CONFIG_SHA = '3d42b3338ab5529e03dd1a9a01fcc7eee40efa1710dbe8daea4a362a754f937f'
READBACK = 'tools/sql/m06-transcript28-readback.sql'
ADMISSION = 'tools/sql/m06-release-admission.sql'
DELTA = 'development/m06/transcript28-release-delta.json'
PRIVATE = ROOT / '.local/cloud-m06-transcript28'
EVIDENCE = ROOT / 'tracking/evidence/cloud-m06-transcript28'
CLAIM = PRIVATE / 'apply.claim.json'
HASH = re.compile('[a-f0-9]{64}')
OLD_OPERATIONS = {
 'eps.claim_job_outbox(integer)', 'eps.finish_job_outbox(uuid,text,boolean)',
 'eps.claim_job_stage(jsonb)', 'eps.claim_job_stage_replay(jsonb,text,text,text)',
 'eps.get_specs_stage_input(uuid,uuid,text)', 'eps.record_job_event(jsonb)',
 'eps.recover_job_stages(integer)', 'eps.get_job_asset_access(jsonb)',
 'eps.reserve_job_output(jsonb)', 'eps.complete_job_output(jsonb)',
 'eps.store_specs_preparation(jsonb)', 'eps.mint_review_media_grant(jsonb)',
}
NEW_OPERATIONS = set(OLD_OPERATIONS)

class Blocked(Exception):
    def __init__(self): super().__init__('M06_TRANSCRIPT_RELEASE_UNCONFIRMED')

def require(value):
    if not value: raise Blocked()

def sha(value): return hashlib.sha256(value).hexdigest()
def canonical(value): return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read_json(file): return json.loads((ROOT / file).read_bytes())

def sealed(file, digest):
    require(type(file) is str and type(digest) is str and HASH.fullmatch(digest))
    path = ROOT / file
    require(path.resolve() == path and not path.is_symlink() and sha(path.read_bytes()) == digest)

def validate_process_scope(environment):
    forbidden = {'SUPABASE_PROJECT_ID','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL',
      'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSERVICE','PGSERVICEFILE',
      'PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION'}
    require(not any(environment.get(name) for name in forbidden))

CREATED_OBJECT_FIELDS = {'columns|eps.presentation_video_transcripts.candidate_media_id': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.captured_at': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.languages': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.original_text': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.source_media_row_version': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.source_sha256': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.status': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.version_id': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'columns|eps.presentation_video_transcripts.video_asset_id': ('acl', 'default', 'generated', 'identity', 'not_null', 'type'), 'constraints|eps.presentation_video_transcripts.presentation_video_transcripts_candidate_media_id_fkey': ('definition',), 'constraints|eps.presentation_video_transcripts.presentation_video_transcripts_check': ('definition',), 'constraints|eps.presentation_video_transcripts.presentation_video_transcripts_languages_check': ('definition',), 'constraints|eps.presentation_video_transcripts.presentation_video_transcripts_pkey': ('definition',), 'constraints|eps.presentation_video_transcripts.presentation_video_transcripts_source_media_row_version_check': ('definition',), 'constraints|eps.presentation_video_transcripts.presentation_video_transcripts_status_check': ('definition',), 'constraints|eps.presentation_video_transcripts.presentation_video_transcripts_version_id_video_asset_id_fkey': ('definition',), 'functions|eps.capture_presentation_video_transcripts(uuid)': ('acl', 'argument_defaults', 'config', 'definer', 'identity_arguments', 'kind', 'language', 'leakproof', 'owner', 'parallel', 'returns', 'source_sha256', 'strict', 'support', 'volatility'), 'functions|eps.presentation_source_languages_valid(text[])': ('acl', 'argument_defaults', 'config', 'definer', 'identity_arguments', 'kind', 'language', 'leakproof', 'owner', 'parallel', 'returns', 'source_sha256', 'strict', 'support', 'volatility'), 'functions|eps.presentation_source_text_valid(text,integer)': ('acl', 'argument_defaults', 'config', 'definer', 'identity_arguments', 'kind', 'language', 'leakproof', 'owner', 'parallel', 'returns', 'source_sha256', 'strict', 'support', 'volatility'), 'functions|eps.presentation_video_transcript(uuid,uuid)': ('acl', 'argument_defaults', 'config', 'definer', 'identity_arguments', 'kind', 'language', 'leakproof', 'owner', 'parallel', 'returns', 'source_sha256', 'strict', 'support', 'volatility'), 'indexes|eps.presentation_video_transcript_source': ('definition', 'live', 'ready', 'valid'), 'indexes|eps.presentation_video_transcripts_pkey': ('definition', 'live', 'ready', 'valid'), 'policies|eps.presentation_video_transcripts.presentation_video_transcript_capture': ('cmd', 'permissive', 'qual', 'roles', 'with_check'), 'policies|eps.presentation_video_transcripts.presentation_video_transcript_guest_read': ('cmd', 'permissive', 'qual', 'roles', 'with_check'), 'policies|eps.presentation_video_transcripts.presentation_video_transcript_internal_read': ('cmd', 'permissive', 'qual', 'roles', 'with_check'), 'tables|eps.presentation_video_transcripts': ('acl', 'force_rls', 'owner', 'rls'), 'triggers|eps.presentation_video_transcripts.presentation_video_transcript_immutable': ('definition', 'enabled'), 'types|eps.presentation_video_transcripts': ('acl', 'base', 'default', 'enum_labels', 'kind', 'not_null', 'owner')}
CREATED_KEYS = {name + "|" + field for name,fields in CREATED_OBJECT_FIELDS.items() for field in fields}
CHANGED_KEYS = {'functions|eps.guest_asset_issue(uuid,text,uuid,uuid,text,uuid)|source_sha256', 'functions|public.eps_generate_version(uuid,jsonb,text)|source_sha256', 'functions|public.eps_get_version_asset(uuid,uuid,text)|source_sha256'}
NEW_FUNCTIONS = ('eps.capture_presentation_video_transcripts(uuid)', 'eps.presentation_source_languages_valid(text[])', 'eps.presentation_source_text_valid(text,integer)', 'eps.presentation_video_transcript(uuid,uuid)')

def validate_delta(delta):
    require(type(delta) is dict and set(delta) == {'schema_version','created','changed','deleted','new_state'})
    require(delta['schema_version'] == '1.0' and type(delta['created']) is dict and set(delta['created']) == CREATED_KEYS and delta['deleted'] == {})
    require(type(delta['changed']) is dict and set(delta['changed']) == CHANGED_KEYS)
    require(all(type(v) is dict and set(v) == {'before','after'} and type(v['before']) is str and HASH.fullmatch(v['before']) and type(v['after']) is str and HASH.fullmatch(v['after']) and v['before'] != v['after'] for v in delta['changed'].values()))
    require(delta['created']['tables|eps.presentation_video_transcripts|owner'] == 'postgres')
    require(delta['created']['tables|eps.presentation_video_transcripts|rls'] is True and delta['created']['tables|eps.presentation_video_transcripts|force_rls'] is True)
    require(delta['created']['tables|eps.presentation_video_transcripts|acl'] == '{postgres=arwdDxtm/postgres,eps_review_owner=ar/postgres,eps_guest_owner=r/postgres}')
    for function in NEW_FUNCTIONS:
        require(delta['created']['functions|' + function + '|owner'] == 'eps_review_owner')
        require(delta['created']['functions|' + function + '|definer'] is False)
        require(delta['created']['functions|' + function + '|config'] == ['search_path=""'])
        expected = '{eps_review_owner=X/eps_review_owner,eps_guest_owner=X/eps_review_owner}' if function == 'eps.presentation_video_transcript(uuid,uuid)' else '{eps_review_owner=X/eps_review_owner}'
        require(delta['created']['functions|' + function + '|acl'] == expected)
    for policy,role,command in (('presentation_video_transcript_internal_read','eps_review_owner','SELECT'),('presentation_video_transcript_guest_read','eps_guest_owner','SELECT'),('presentation_video_transcript_capture','eps_review_owner','INSERT')):
        base = 'policies|eps.presentation_video_transcripts.' + policy + '|'
        require(delta['created'][base+'roles'] == [role] and delta['created'][base+'cmd'] == command)
    require(delta['new_state']['tables']['review_gateway_config'] == {'count':1})
    require(delta['new_state']['tables']['presentation_video_transcripts'] == {'count':0})
    require(delta['new_state']['config']['replay_ttl_seconds'] == 86400 and delta['new_state']['config']['session_ttl_seconds'] == 3600)
    require(len(json.dumps(delta).encode()) <= 128 * 1024)
    return sorted(CREATED_KEYS | CHANGED_KEYS)

def validate_before_state(state, delta):
    require(state['old_data']['versions'][-1] == '20261030013832' and len(state['old_data']['versions']) == 27)
    require(state['new_state']['config'] == {'enabled':True,'key_present':True,'key_bytes':32,'replay_ttl_seconds':86400,'session_ttl_seconds':3600})
    require(state['new_state']['tables']['review_gateway_config'] == {'count':1} and state['new_state']['tables']['presentation_video_transcripts'] is None)
    require(state['catalog_delta_values'] == {k:v['before'] for k,v in delta['changed'].items()})
    require(set(v.replace(' ', '') for v in state['runtime']['execute']) == OLD_OPERATIONS)

def compare_states(before, after, delta):
    expected_data = copy.deepcopy(before['old_data']); expected_data['versions'].append(MIGRATION[:14])
    require(after['old_data'] == expected_data)
    require(before['catalog_protected_sha256'] == after['catalog_protected_sha256'])
    require(after['catalog_count'] == before['catalog_count'] + len(CREATED_KEYS))
    require(before['catalog_delta_values'] == {k:v['before'] for k,v in delta['changed'].items()})
    require(after['catalog_delta_values'] == {**delta['created'],**{k:v['after'] for k,v in delta['changed'].items()}})
    expected_state = copy.deepcopy(before['new_state']); expected_state['tables']['presentation_video_transcripts'] = {'count':0}
    require(after['new_state'] == expected_state)
    runtime_before = copy.deepcopy(before['runtime']); runtime_after = copy.deepcopy(after['runtime'])
    require(set(v.replace(' ', '') for v in runtime_before.pop('execute')) == OLD_OPERATIONS)
    require(set(v.replace(' ', '') for v in runtime_after.pop('execute')) == NEW_OPERATIONS)
    require(runtime_before == runtime_after and before['protected_m02'] == after['protected_m02'])
    return {'old_noncredential_business_data_and_managed_auth_metadata_counts_preserved':True,
      'exact_empty_frozen_source_table_and_three_guarded_capture_playback_ports':True,'old_catalog_defaults_storage_metadata_and_runtime12_preserved':True,
      'gateway_key_metadata_counts_and_flags_preserved':True,'no_old_version_backfill_or_new_login_bucket_ttl_secret_configuration_native_change':True}

def current_release_inputs():
    sealed(CONFIG, CONFIG_SHA); validate_process_scope(os.environ); config = read_json(CONFIG)
    require(set(config) == {'schema_version','frozen_release','promotion','reviewed_manifest','source_seals'})
    require(config['schema_version'] == '1.0' and type(config['source_seals']) is dict and config['source_seals'])
    for item in (config['frozen_release'],config['promotion'],config['reviewed_manifest']):
        require(set(item) == {'path','sha256'}); sealed(item['path'],item['sha256'])
    for file,digest in config['source_seals'].items(): sealed(file,digest)
    require({READBACK,ADMISSION,DELTA,'tools/release_foundation.py','tools/provision_logo_verifier.py','tests/operations/test_m06_transcript28_release.py'} <= set(config['source_seals']))
    frozen = read_json(config['frozen_release']['path']); require(frozen['migration_path'] == 'supabase/migrations/' + MIGRATION)
    sealed(frozen['migration_path'],frozen['migration_sha256']); sealed(frozen['baseline'],frozen['baseline_sha256'])
    sealed(frozen['readback_query'],frozen['readback_sha256']); sealed(frozen['catalog_delta'],frozen['catalog_delta_sha256'])
    require(config['reviewed_manifest']['path'] == 'development/local-db/reviewed.json')
    manifest = read_json(config['reviewed_manifest']['path']); baseline = read_json(frozen['baseline'])
    require(len(manifest['migrations']) == 28 and len(baseline['migrations']) == 27 and manifest['migrations'][:-1] == baseline['migrations'])
    require(manifest['migrations'][-1]['path'] == frozen['migration_path'] and manifest['migrations'][-1]['sha256'] == frozen['migration_sha256'])
    names = sorted(p.name for p in (ROOT / 'supabase/migrations').glob('*.sql')); require(names == [Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']: require(row['reviewed_by'] and row['reviewed_at']); sealed(row['path'],row['sha256'])
    proof = read_json(frozen['release_proof']); sealed(frozen['release_proof'],frozen['release_proof_sha256'])
    behavior = read_json(frozen['behavior_proof']); sealed(frozen['behavior_proof'],frozen['behavior_proof_sha256'])
    promotion = read_json(config['promotion']['path'])
    for item in (proof,behavior,promotion): require(item['result'] == 'passed' and item['cloud_called'] is False and item['provider_called'] is False and item['sources_stable'] is True)
    require(proof['compact_readback_exact'] and proof['rollback_verified'] and proof['old_business_and_managed_auth_metadata_counts_preserved'] and proof['key_metadata_configuration_and_all_rows_preserved'])
    require(behavior['behavior_passed'] and behavior['rollback_verified'] and behavior['backend_settled'])
    require(promotion['exact_proven_catalog_delta'] and promotion['old_business_and_managed_auth_metadata_counts_preserved'] and promotion['key_metadata_and_configuration_preserved'] and promotion['lock_retained'] is False)
    for file,digest in frozen['fragments'].items(): sealed(file,digest); require(behavior['source_seals'].get(file) == digest)
    for item in (proof,behavior,promotion):
        for file,digest in item['source_seals'].items(): sealed(file,digest)
    expected = copy.deepcopy(proof['readback_expected']); expected['old_data']['versions'].append(MIGRATION[:14])
    require(promotion['before'] == proof['readback_before'] and promotion['after'] == expected)
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    settings = tomllib.loads((ROOT / 'supabase/config.toml').read_text()); require(settings['db']['migrations']['enabled'] is True and settings['db']['seed']['enabled'] is False)
    delta = read_json(DELTA); validate_delta(delta)
    return {'migration':MIGRATION,'migration_sha256':frozen['migration_sha256'],'config_sha256':CONFIG_SHA,
      'readback_sha256':frozen['readback_sha256'],'admission_sha256':config['source_seals'][ADMISSION],
      'versions':[name[:14] for name in names],'source_seals':config['source_seals'],'helper_sha256':sha(Path(__file__).read_bytes())}

def private_write(file, data):
    from provision_logo_verifier import WindowsPrivateFiles
    PRIVATE.mkdir(parents=True,exist_ok=True); security = WindowsPrivateFiles()
    with security.create(file) as handle:
        handle.write(data); handle.flush(); os.fsync(handle.fileno()); security.verify_open(handle)

def call(arguments):
    label = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '-' + uuid.uuid4().hex[:8]
    try: result = cli_call(arguments)
    except subprocess.TimeoutExpired as error:
        for stream in ('stdout','stderr'):
            value = getattr(error,stream,None) or b''; private_write(PRIVATE / (label + '.' + stream),value.encode() if type(value) is str else value)
        raise Blocked() from None
    for stream in ('stdout','stderr'): private_write(PRIVATE / (label + '.' + stream),getattr(result,stream).encode())
    require(len(result.stdout.encode()) <= 2*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
    return result

def _query(file, digest):
    sealed(file,digest); result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT / file),'--output-format','json'])
    require(result.returncode == 0); values = json.loads(result.stdout)['rows']; require(len(values) == 1 and len(values[0]) == 1)
    state = next(iter(values[0].values())); require(type(state) is dict)
    return state

def inspect_state(inputs):
    """Read-only current snapshot, usable before/after bootstrap without key IO."""
    state = _query(READBACK,inputs['readback_sha256']); admission = _query(ADMISSION,inputs['admission_sha256'])
    require(state['query_role'] == admission['query_role'] == 'postgres' and admission['database'] == 'postgres' and admission['unrestricted_visibility'] is True)
    require(state['old_data']['versions'] in (inputs['versions'][:-1],inputs['versions']))
    require(admission['protected_m02'] == {'exists':True,'manual_note_retained':True})
    runtime = admission['runtime']; require(runtime['name'] == 'eps_specs_runtime' and runtime['login'] is True and runtime['inherit'] is False and runtime['superuser'] is False and runtime['bypass_rls'] is False and runtime['create_db'] is False and runtime['create_role'] is False and runtime['replication'] is False)
    require(set(v.replace(' ', '') for v in runtime['execute']) in (OLD_OPERATIONS,NEW_OPERATIONS))
    return {**state,'runtime':runtime,'protected_m02':admission['protected_m02']}

def pending_migrations(text): return sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',text)))
def validate_pending(text): require(pending_migrations(text) == [MIGRATION])
def push_command(dry_run): return ['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json'] + (['--dry-run'] if dry_run else [])
def refuse_repeat_apply(): require(not CLAIM.exists() and not any(EVIDENCE.glob('*-apply-attempt.json')))

def retain(receipt,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True); file = EVIDENCE / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    with file.open('x',encoding='utf8') as handle: json.dump(receipt,handle,indent=2); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    return file.relative_to(ROOT).as_posix()

def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments; require(len(arguments) <= 1); action = arguments[0] if arguments else 'dry-run'; require(action in ('inspect','dry-run','apply','readback'))
    receipt = {'action':action,'target':TARGET,'migration':MIGRATION,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'flags_changed':False,'key_provisioned':False,'key_or_credential_digest_read_or_hashed':False,'identity_provisioned':False,'seeds':False,'hosting_deferred':True}
    try:
        inputs = current_release_inputs(); receipt['inputs'] = inputs; delta = read_json(DELTA); before = inspect_state(inputs); receipt['before'] = before
        if action == 'inspect': receipt['readback'] = before
        elif action == 'readback':
            require(before['old_data']['versions'] == inputs['versions']); claim = read_json(CLAIM.relative_to(ROOT).as_posix())
            require(claim['target'] == TARGET and claim['inputs_sha256'] == canonical(inputs)); file = Path(claim['attempt_receipt'])
            require(file.parent.as_posix() == 'tracking/evidence/cloud-m06-transcript28' and file.name.endswith('-apply-attempt.json')); attempt = read_json(file.as_posix()); require(canonical(attempt['before']) == claim['before_sha256'])
            receipt['before'] = attempt['before']; receipt['readback'] = before; receipt['comparison'] = compare_states(attempt['before'],before,delta)
        else:
            require(before['old_data']['versions'] == inputs['versions'][:-1]); validate_before_state(before,delta)
            if action == 'apply':
                refuse_repeat_apply(); dry = read_json('tracking/evidence/cloud-m06-transcript28/dry-run.json'); age = (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result'] == 'passed' and dry['inputs'] == inputs and dry['before'] == before and dry['pending_migrations'] == [MIGRATION] and 0 <= age <= 900)
            receipt['attempt_receipt'] = retain(receipt,action+'-attempt')
            if action == 'apply': private_write(CLAIM,(json.dumps({'target':TARGET,'inputs_sha256':canonical(inputs),'before_sha256':canonical(before),'attempt_receipt':receipt['attempt_receipt'],'dispatch_may_have_occurred':True})+'\n').encode())
            require(current_release_inputs() == inputs)
            if action == 'apply': receipt['dispatch_attempted'] = True
            result = call(push_command(action == 'dry-run')); receipt['exit_code'] = result.returncode; receipt['pending_migrations'] = pending_migrations(result.stdout+'\n'+result.stderr); after = inspect_state(inputs); receipt['readback'] = after
            if action == 'apply': receipt['comparison'] = compare_states(before,after,delta)
            else: require(before == after)
            require(result.returncode == 0); validate_pending(result.stdout+'\n'+result.stderr)
        receipt['application_verified_by_readback'] = action in ('apply','readback'); receipt['result'] = 'passed'
    except Exception:
        receipt['reason'] = 'Fixed28 source transcript release unconfirmed. Preserve claim and reconcile read-only; no repeat write.'; raise
    finally:
        receipt['finished_at'] = stamp(); file = retain(receipt,action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-'+uuid.uuid4().hex+'.tmp'); temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8'); os.replace(temporary,EVIDENCE / 'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))

if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('Fixed28 source transcript release stopped; raw diagnostics remain private. No automatic retry.\n'); sys.exit(1)
