"""Fixed24->25 guest review release. Importing is inert; root owns execution.

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

MIGRATION = '20261030002634_m06_guest_review_feedback_exports.sql'
CONFIG = 'development/m06/review-release.json'
CONFIG_SHA = '74f27808ce412a34d91eb42f04167870643025520d40616f2dec0df8c98347ff'  # Final source/control pin installed after pure helper tests.
READBACK = 'tools/sql/m06-review-readback.sql'
ADMISSION = 'tools/sql/m06-release-admission.sql'
DELTA = 'development/m06/review-release-delta.json'
PRIVATE = ROOT / '.local/cloud-m06-review'
EVIDENCE = ROOT / 'tracking/evidence/cloud-m06-review'
CLAIM = PRIVATE / 'apply.claim.json'
HASH = re.compile('[a-f0-9]{64}')
OLD_OPERATIONS = {
 'eps.claim_job_outbox(integer)', 'eps.finish_job_outbox(uuid,text,boolean)',
 'eps.claim_job_stage(jsonb)', 'eps.claim_job_stage_replay(jsonb,text,text,text)',
 'eps.get_specs_stage_input(uuid,uuid,text)', 'eps.record_job_event(jsonb)',
 'eps.recover_job_stages(integer)', 'eps.get_job_asset_access(jsonb)',
 'eps.reserve_job_output(jsonb)', 'eps.complete_job_output(jsonb)',
 'eps.store_specs_preparation(jsonb)',
}
NEW_OPERATIONS = OLD_OPERATIONS | {'eps.mint_review_media_grant(jsonb)'}

class Blocked(Exception):
    def __init__(self): super().__init__('M06_REVIEW_RELEASE_UNCONFIRMED')

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

def validate_delta(delta):
    require(type(delta) is dict and set(delta) == {'schema_version','created','changed','deleted','new_state'})
    require(delta['schema_version'] == '1.0' and all(type(delta[k]) is dict for k in ('created','changed','deleted')))
    require(delta['created'] and delta['changed'] and not delta['deleted'])
    keys = [key for name in ('created','changed','deleted') for key in delta[name]]
    require(len(keys) == len(set(keys)) and all(type(k) is str and 0 < len(k) <= 2000 and not re.search('[\x00-\x1f]', k) for k in keys))
    require(all(type(v) is dict and set(v) == {'before','after'} and v['before'] != v['after'] for v in delta['changed'].values()))
    require(delta['new_state']['config'] == {'enabled':False,'key_present':False,'key_bytes':None,'replay_ttl_seconds':86400,'session_ttl_seconds':3600})
    tables = delta['new_state']['tables']; require(type(tables) is dict and len(tables) == 12)
    require(all(v == {'count': 1 if k == 'review_gateway_config' else 0} for k,v in tables.items()))
    require(len(json.dumps(delta).encode()) <= 1024 * 1024)
    return sorted(keys)

def validate_before_state(state, delta):
    require(state['old_data']['versions'][-1] == '20261029215218' and len(state['old_data']['versions']) == 24)
    require(state['new_state']['config'] is None and all(v is None for v in state['new_state']['tables'].values()))
    require(state['catalog_delta_values'] == {k:v['before'] for k,v in delta['changed'].items()})
    require(set(v.replace(' ', '') for v in state['runtime']['execute']) == OLD_OPERATIONS)

def compare_states(before, after, delta):
    expected_data = copy.deepcopy(before['old_data']); expected_data['versions'].append(MIGRATION[:14])
    require(after['old_data'] == expected_data)
    require(before['catalog_protected_sha256'] == after['catalog_protected_sha256'])
    require(after['catalog_count'] == before['catalog_count'] + len(delta['created']))
    require(before['catalog_delta_values'] == {k:v['before'] for k,v in delta['changed'].items()})
    require(after['catalog_delta_values'] == {**delta['created'], **{k:v['after'] for k,v in delta['changed'].items()}})
    require(after['new_state'] == delta['new_state'])
    runtime_before = copy.deepcopy(before['runtime']); runtime_after = copy.deepcopy(after['runtime'])
    require(set(v.replace(' ', '') for v in runtime_before.pop('execute')) == OLD_OPERATIONS)
    require(set(v.replace(' ', '') for v in runtime_after.pop('execute')) == NEW_OPERATIONS)
    require(runtime_before == runtime_after and before['protected_m02'] == after['protected_m02'])
    return {'old_noncredential_business_data_and_managed_auth_metadata_counts_preserved':True,
      'old_catalog_defaults_storage_and_runtime11_preserved':True,'exact_additive_local_catalog_delta':True,
      'only_operation12_added_no_runtime_login':True,'new_config_disabled_key_absent':True}

def current_release_inputs():
    sealed(CONFIG, CONFIG_SHA); validate_process_scope(os.environ); config = read_json(CONFIG)
    require(set(config) == {'schema_version','frozen_release','promotion','current_pgp_proof','reviewed_manifest','source_seals'})
    require(config['schema_version'] == '1.0' and type(config['source_seals']) is dict and config['source_seals'])
    for item in (config['frozen_release'],config['promotion'],config['current_pgp_proof'],config['reviewed_manifest']):
        require(set(item) == {'path','sha256'}); sealed(item['path'],item['sha256'])
    for file,digest in config['source_seals'].items(): sealed(file,digest)
    required = {READBACK,ADMISSION,DELTA,'tools/release_foundation.py','tools/provision_logo_verifier.py','tests/operations/test_m06_review_release.py'}
    require(required <= set(config['source_seals']))
    frozen = read_json(config['frozen_release']['path']); require(frozen['migration_path'] == 'supabase/migrations/' + MIGRATION)
    sealed(frozen['migration_path'],frozen['migration_sha256']); sealed(frozen['baseline'],frozen['baseline_sha256'])
    sealed(frozen['readback_query'],frozen['readback_sha256']); sealed(frozen['catalog_delta'],frozen['catalog_delta_sha256'])
    require(config['reviewed_manifest']['path'] == 'development/local-db/reviewed.json')
    manifest = read_json(config['reviewed_manifest']['path']); baseline = read_json(frozen['baseline'])
    require(len(manifest['migrations']) == 25 and len(baseline['migrations']) == 24 and manifest['migrations'][:-1] == baseline['migrations'])
    require(manifest['migrations'][-1]['path'] == frozen['migration_path'] and manifest['migrations'][-1]['sha256'] == frozen['migration_sha256'])
    names = sorted(p.name for p in (ROOT / 'supabase/migrations').glob('*.sql'))
    require(names == [Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']: require(row['reviewed_by'] and row['reviewed_at']); sealed(row['path'],row['sha256'])
    release = read_json(frozen['release_proof']); sealed(frozen['release_proof'],frozen['release_proof_sha256'])
    behavior = read_json(frozen['behavior_proof']); sealed(frozen['behavior_proof'],frozen['behavior_proof_sha256'])
    promotion = read_json(config['promotion']['path']); pgp = read_json(config['current_pgp_proof']['path'])
    for item in (release,behavior,promotion,pgp): require(item['result'] == 'passed' and item['cloud_called'] is False and item['provider_called'] is False and item['sources_stable'] is True)
    require(release['compact_readback_exact'] and release['rollback_verified'] and release['old_business_and_managed_auth_metadata_counts_preserved'])
    require(behavior['behavior_passed'] and behavior['rollback_verified'] and behavior['backend_settled'])
    require(promotion['exact_proven_catalog_delta'] and promotion['old_business_and_managed_auth_metadata_counts_preserved'] and promotion['key_absent_disabled'] and promotion['lock_retained'] is False)
    require(pgp['actual_pgcrypto_openpgp_round_trip'] and pgp['plaintext_absent_from_statement_statistics_and_error_output'] and pgp['rollback_verified'] and pgp['activation_private_configuration_read'] is False)
    for file,digest in frozen['fragments'].items(): sealed(file,digest); require(behavior['source_seals'].get(file) == digest)
    for item in (release,promotion,pgp):
        for file,digest in item['source_seals'].items(): sealed(file,digest)
    expected = copy.deepcopy(release['readback_expected']); expected['old_data']['versions'].append(MIGRATION[:14])
    require(promotion['before'] == release['readback_before'] and promotion['after'] == expected)
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    settings = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(settings['db']['migrations']['enabled'] is True and settings['db']['seed']['enabled'] is False)
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
    receipt = {'action':action,'target':TARGET,'migration':MIGRATION,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'flags_changed':False,'key_provisioned':False,'identity_provisioned':False,'seeds':False,'hosting_deferred':True}
    try:
        inputs = current_release_inputs(); receipt['inputs'] = inputs; delta = read_json(DELTA); before = inspect_state(inputs); receipt['before'] = before
        if action == 'inspect': receipt['readback'] = before
        elif action == 'readback':
            require(before['old_data']['versions'] == inputs['versions']); claim = read_json(CLAIM.relative_to(ROOT).as_posix())
            require(claim['target'] == TARGET and claim['inputs_sha256'] == canonical(inputs)); file = Path(claim['attempt_receipt'])
            require(file.parent.as_posix() == 'tracking/evidence/cloud-m06-review' and file.name.endswith('-apply-attempt.json')); attempt = read_json(file.as_posix()); require(canonical(attempt['before']) == claim['before_sha256'])
            receipt['before'] = attempt['before']; receipt['readback'] = before; receipt['comparison'] = compare_states(attempt['before'],before,delta)
        else:
            require(before['old_data']['versions'] == inputs['versions'][:-1]); validate_before_state(before,delta)
            if action == 'apply':
                refuse_repeat_apply(); dry = read_json('tracking/evidence/cloud-m06-review/dry-run.json'); age = (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
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
        receipt['reason'] = 'Fixed25 release unconfirmed. Preserve claim and reconcile read-only; no repeat write.'; raise
    finally:
        receipt['finished_at'] = stamp(); file = retain(receipt,action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-'+uuid.uuid4().hex+'.tmp'); temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8'); os.replace(temporary,EVIDENCE / 'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))

if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('Fixed25 release stopped; raw diagnostics remain private. No automatic retry.\n'); sys.exit(1)
