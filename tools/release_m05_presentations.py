"""Fixed23->24 immutable presentation version release. Importing performs no IO.

Root owns execution after source review. Empty final seals deny even read-only
CLI access. A protected one-shot claim precedes apply; unknown results can only
be reconciled through readback. No SQL/target/credential/flag/force/retry option.
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
from release_specs_read_operation import validate_runtime as validate_ten_runtime
from release_m03_remaining import OPERATIONS
from prepare_m05_presentation_readback import NEW_TABLES

# Pinned from the final prepared migration, actual rollback/race proof and
# local promotion. Missing or changed seals deny every CLI call.
MIGRATION = '20261029215218_m05_immutable_presentation_versions.sql'
CONFIG = 'development/m05/presentation-release.json'
CONFIG_SHA = 'e6ab4b3d468685b18724663337629afb7353e24bab155057a16667c35affbcf8'
READBACK = 'tools/sql/m05-presentation-readback.sql'
DELTA = 'development/m05/presentation-release-delta.json'
PRIVATE = ROOT / '.local/cloud-m05-presentations'
EVIDENCE = ROOT / 'tracking/evidence/cloud-m05-presentations'
CLAIM = PRIVATE / 'apply.claim.json'
HASH = re.compile(r'[a-f0-9]{64}')
REQUIRED_SOURCE_SEALS = {'tools/release_foundation.py', 'tools/release_specs_read_operation.py', 'tools/release_m03_remaining.py',
                         'tools/provision_logo_verifier.py', 'tools/prepare_m04_review_readback.py', 'tools/sql/m04-casting-readback.sql',
                         'tools/sql/m04-review-catalog.sql', 'tools/sql/m04-review-new-state.sql', 'tests/operations/test_m05_presentation_release.py', 'tools/prepare_m05_presentation_readback.py', 'tools/sql/m05-presentation-new-state.sql'}
FRAGMENTS = ('development/m05/versions.sql', 'development/m05/template-forward.sql', 'development/m05/presentation-processing.sql',
             'development/m05/presentation-assets.sql', 'development/m05/finalize.sql')
REQUIRED_SOURCE_SEALS |= set(FRAGMENTS)
CANDIDATE_HARNESS = 'tools/test-m05-versions-local.mjs'
PROMOTION_HARNESS = 'tools/promote-m05-presentation-local.mjs'
PROOF_SOURCES = set(FRAGMENTS) | {'supabase/migrations/' + MIGRATION, READBACK, DELTA, 'development/local-db/reviewed.json',
    'tools/local-postgres.mjs', 'development/local-db/instance.json', 'tools/sql/m04-review-catalog.sql',
    'tools/sql/m05-presentation-new-state.sql'}
CANDIDATE_SOURCES = PROOF_SOURCES | {CANDIDATE_HARNESS, 'tools/sql/m04-review-local-snapshot.sql', 'tests/db/m04-assignments-fixture.sql',
    'tests/db/m05-versions-fixture.sql', 'tests/db/m05-versions.sql', 'tests/db/m05-processing.sql',
    'tests/db/m05-lifecycle.sql', 'tests/db/m05-retention.sql', 'tests/db/m05-no-role.sql'}
RACE_HARNESS = 'tools/test-m05-presentation-race-local.mjs'
RACE_SOURCES = set(FRAGMENTS) | {RACE_HARNESS, 'supabase/migrations/' + MIGRATION, 'tools/local-postgres.mjs',
    'development/local-db/instance.json', 'development/local-db/reviewed.json', 'tools/sql/m04-review-local-snapshot.sql',
    'tools/sql/m04-review-catalog.sql', 'tools/m05-presentation-private-fixture-file.py', 'tools/provision_logo_verifier.py',
    'supabase/migrations/20261028222030_m02_specs_pipeline.sql', 'tests/db/m05-versions.sql',
    'tests/db/m05-versions-fixture.sql', 'tests/db/m04-assignments-fixture.sql'}
EXPECTED_MARKERS = [
    'M05_ACTUAL_CAPTURE_SELECTION8_SHORTLIST6_ORDER_TEN_FIELDS_CATEGORY_PENDING_PASSED',
    'M05_FOUR_STAGES_FROZEN_INPUT_ASSETS_REPLAY_RETENTION_READY_POINTER_AND_READ_PASSED',
    'M05_STRICT_GENERATE_GUARDS_CANCEL_LATE_CALLBACK_SAFE_FAILURE_EXPLICIT_RETRY_AND_RECOVERY_PASSED',
    'M05_IMMUTABLE_MEDIA_PINS_ARCHIVE_DEFAULT_CHANGES_NARROW_STORAGE_AND_CURRENT_PROJECT_AUTH_PASSED',
    'M05_NO_ROLE_TWO_PAGES_COMPLETE_PENDING_AND_FOREIGN_VERSION_DENIAL_PASSED',
]


class Blocked(Exception):
    def __init__(self): super().__init__('M05_PRESENTATION_RELEASE_UNCONFIRMED')


def require(value):
    if not value: raise Blocked()


def sha(value): return hashlib.sha256(value).hexdigest()
def canonical(value): return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())
def read_json(relative): return json.loads((ROOT / relative).read_bytes())
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sealed(relative, digest):
    require(isinstance(relative, str) and isinstance(digest, str) and HASH.fullmatch(digest))
    file = ROOT / relative
    require(file.resolve() == file and not file.is_symlink() and sha(file.read_bytes()) == digest)


def validate_process_scope(environment):
    # CLI2.122 forwards libpq TLS settings. These fixed release commands retain
    # their existing reviewed target/auth path; ambient routing cannot replace
    # it. Authentication token/password values remain with the CLI and private.
    forbidden = {'SUPABASE_PROJECT_ID', 'SUPABASE_API_URL', 'SUPABASE_WORKDIR', 'SUPABASE_DB_URL',
                 'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE',
                 'PGOPTIONS', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGSSLNEGOTIATION'}
    require(not any(environment.get(name) for name in forbidden))


def validate_delta(delta):
    require(isinstance(delta,dict) and set(delta)=={'schema_version','created','changed','deleted','m05_state'})
    require(delta['schema_version']=='1.0' and all(isinstance(delta[name],dict) for name in ('created','changed','deleted')))
    require(delta['created'] and delta['changed'] and not delta['deleted'])
    keys=[key for name in ('created','changed','deleted') for key in delta[name]]
    require(len(keys)==len(set(keys)) and all(isinstance(key,str) and 0<len(key)<=2000 and not re.search(r'[\x00-\x1f]',key) for key in keys))
    require(all(isinstance(row,dict) and set(row)=={'before','after'} and row['before']!=row['after'] for row in delta['changed'].values()))
    require(len(json.dumps(delta).encode())<=1024*1024)
    validate_new_state(delta['m05_state'])
    return sorted(keys)


def validate_new_state(state):
    require(isinstance(state,dict) and set(state)=={'tables','config','template','bucket'})
    require(isinstance(state['tables'],dict) and set(state['tables'])==set(NEW_TABLES))
    for name,row in state['tables'].items():
        require(isinstance(row,dict) and set(row)=={'count','sha256'} and type(row['count'])is int)
        require(row['count']==(1 if name=='eps.presentation_processing_config'else 0) and isinstance(row['sha256'],str) and HASH.fullmatch(row['sha256']))
        if name!='eps.presentation_processing_config':require(row['sha256']==sha(b''))
    require(state['config']=={'id':True,'enabled':False,'renderer_version':'everyone-casting-pdf-v1','application_origin':'http://127.0.0.1:3000',
                              'max_manifest_bytes':8388608,'max_pdf_bytes':67108864,'max_pages':1000})
    template=state['template']
    require(isinstance(template,dict) and set(template)=={'key','version','content_sha256','font_key','font_hashes','registered'})
    require(template['key']=='everyone-casting' and template['version']=='1.1.0' and template['registered']is True
            and template['content_sha256']=='bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638' and template['font_key']=='everyone-casting-fonts-v1')
    fonts=template['font_hashes']
    require(isinstance(fonts,dict) and len(fonts)==6 and all(isinstance(key,str) and key.startswith('apps/web/public/fonts/IBMPlexSans')
            and key.endswith('.woff2') and isinstance(value,str) and HASH.fullmatch(value) for key,value in fonts.items()))
    bucket=state['bucket']
    require(isinstance(bucket,dict) and bucket.get('id')==bucket.get('name')=='eps-presentation-outputs' and bucket.get('public')is False
            and bucket.get('file_size_limit')==67108864 and bucket.get('allowed_mime_types')==['application/json','application/pdf']
            and 'created_at'not in bucket and 'updated_at'not in bucket)


def validate_proof_sources(item, config, *, candidate):
    sources = item.get('source_sha256')
    require(isinstance(sources, dict) and sources)
    harness = item.get('harness_path'); digest = item.get('harness_sha256')
    expected_harness = CANDIDATE_HARNESS if candidate else PROMOTION_HARNESS
    required = CANDIDATE_SOURCES if candidate else PROOF_SOURCES | {PROMOTION_HARNESS, config['baseline_manifest']['path'], config['local_proof']['path']}
    require(required <= set(sources))
    require(harness == expected_harness and config['source_seals'].get(harness) == digest and sources[harness] == digest)
    sealed(harness, digest)
    for file, digest in sources.items():
        if file == 'development/local-db/reviewed.json':
            # Candidate execution uses baseline23; promotion reads the prepared
            # reviewed24 manifest. Both exact lineage seals are independently
            # checked, so neither phase can adopt an unrelated old manifest.
            require(digest == config['baseline_manifest' if candidate else 'reviewed_manifest']['sha256'])
        else:
            require(config['source_seals'].get(file) == digest); sealed(file, digest)
    if candidate:
        require(item.get('markers') == config['required_markers'] and len(item['markers']) == len(set(item['markers'])))


def validate_race_proof(item,config):
    require(item['result']=='passed' and item['cloud_called'] is False and item['provider_called'] is False and item['hosted_credential_files_read'] is False)
    require(item.get('mode')=='candidate')
    require(all(item.get(key) is True for key in ('sources_stable','assertions_passed','disposable_cleanup_verified','canonical23_unchanged','managed_auth_metadata_and_row_revisions_preserved','reviewed_catalog_and_application_snapshot_matches23','private_artifacts_owner_system_protected')))
    require(item['before']==item['after'] and item['managed_auth_before']==item['managed_auth_after'] and item.get('distinct_authorized_principals')==2)
    harness=RACE_HARNESS
    require(RACE_SOURCES <= set(item['source_seals']))
    for file,digest in item['source_seals'].items():
        if file=='development/local-db/reviewed.json':require(digest==config['baseline_manifest']['sha256'])
        else:require(config['source_seals'].get(file)==digest);sealed(file,digest)
    require(item['harness_sha256']==config['source_seals'].get(harness))
    require(item['busy_then_changed_source']=={'real_source_writer_held':True,'nowait_denied_code':'INPUT_CHANGED','no_partial_allocation':True,'review_before_source_commit':True,'after_commit_denied_code':'INPUT_CHANGED'})
    require(item['concurrent_allocation']=={'two_distinct_authorized_principals':True,'actual_workspace_lock_wait_observed':True,'distinct_version_ids':True,'sequential_numbers':[4,5],'no_gap_or_duplicate':True})
    require(item['atomic_capture_source_lock']=={'actual_source_writer_wait_observed':True,'capture_committed_before_source_writer':True,'frozen_content_preserved':True,'exact_ack_replay_after_later_source_change':True})


def validate_before_state(before,delta):
    validate_delta(delta)
    require(before['m05_state']=={'tables':{name:None for name in NEW_TABLES},'config':None,'template':None,'bucket':None})
    # The migration deliberately copies the retained1.0 font map. Verify that
    # read dependency before any dispatch, rather than discovering drift after
    # the new template has been inserted into the canonical database.
    template=before['review_state']['template']
    require(isinstance(template,dict) and template.get('key')=='everyone-casting' and template.get('version')=='1.0.0'
            and template.get('content_sha256')=='8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001'
            and template.get('registered')is True and template.get('font_key')==delta['m05_state']['template']['font_key']
            and template.get('font_hashes')==delta['m05_state']['template']['font_hashes'])


def compare_states(before,after,delta):
    validate_before_state(before,delta)
    require(set(before)==set(after) and len(before['versions'])==23 and after['versions']==before['versions']+[MIGRATION[:14]])
    excluded={'versions','catalog_full_sha256','catalog_count','catalog_delta_values','m05_state'}
    require({key:value for key,value in before.items() if key not in excluded}=={key:value for key,value in after.items() if key not in excluded})
    require(type(before['catalog_count']) is int and before['catalog_count']>0 and after['catalog_count']==before['catalog_count']+len(delta['created']))
    for state in (before,after):require(all(isinstance(state.get(key),str) and HASH.fullmatch(state[key]) for key in ('catalog_full_sha256','catalog_protected_sha256')))
    require(before['catalog_delta_values']=={key:row['before'] for key,row in delta['changed'].items()})
    require(after['catalog_delta_values']=={**delta['created'],**{key:row['after'] for key,row in delta['changed'].items()}})
    require(isinstance(before['counts'],dict) and isinstance(before['data_sha256'],dict) and isinstance(before['review_state']['config']['enabled'],bool))
    require(after['m05_state']==delta['m05_state'])
    return {'old_business_and_catalog_preserved':True,'runtime11_auth_defaults_and_storage_preserved':True,'exact_local_catalog_delta':True,
            'old_processing_configuration_and_template_unchanged':True,'new_processing_disabled':True,'exact_initial_template_bucket_and_empty_version_tables':True}


def current_release_inputs():
    # A missing source seal must fail before linked-target/config/private access.
    require(isinstance(MIGRATION, str) and re.fullmatch(r'\d{14}_m05_immutable_presentation_versions\.sql', MIGRATION))
    sealed(CONFIG, CONFIG_SHA)
    validate_process_scope(os.environ)
    config = read_json(CONFIG)
    require(set(config) == {'schema_version', 'migration', 'baseline_manifest', 'reviewed_manifest', 'local_proof', 'promotion', 'race_proof', 'delta', 'readback', 'source_seals', 'required_markers'})
    require(config['schema_version'] == '1.0' and config['migration']['path'] == 'supabase/migrations/' + MIGRATION
            and config['readback']['path'] == READBACK and config['delta']['path'] == DELTA)
    for name in ('migration', 'baseline_manifest', 'reviewed_manifest', 'local_proof', 'promotion', 'race_proof', 'delta', 'readback'):
        item = config[name]; require(set(item) == {'path', 'sha256'}); sealed(item['path'], item['sha256'])
    require(config['reviewed_manifest']['path'] == 'development/local-db/reviewed.json')
    require(config['source_seals'] and isinstance(config['source_seals'], dict))
    composition = b'\n'.join((ROOT / name).read_bytes() for name in FRAGMENTS)
    require(sha(composition) == config['migration']['sha256'])
    require(REQUIRED_SOURCE_SEALS <= set(config['source_seals']))
    require(config['required_markers'] == EXPECTED_MARKERS)
    for file, digest in config['source_seals'].items(): sealed(file, digest)
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    settings = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(settings['db']['migrations']['enabled'] is True and settings['db']['seed']['enabled'] is False)
    manifest = read_json(config['reviewed_manifest']['path']); baseline = read_json(config['baseline_manifest']['path'])
    require(len(manifest['migrations']) == 24 and len(baseline['migrations']) == 23 and manifest['migrations'][:-1] == baseline['migrations'])
    require(manifest['migrations'][-1]['path'] == config['migration']['path'] and manifest['migrations'][-1]['sha256'] == config['migration']['sha256'])
    names = sorted(file.name for file in (ROOT / 'supabase/migrations').glob('*.sql'))
    require(names == [Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']:
        require(row['reviewed_by'] and row['reviewed_at']); sealed(row['path'], row['sha256'])
    delta = read_json(DELTA); delta_keys = validate_delta(delta)
    proof = read_json(config['local_proof']['path']); promotion = read_json(config['promotion']['path'])
    for item in (proof, promotion):
        require(item['result'] == 'passed' and item['cloud_called'] is False and item['provider_called'] is False)
        require(item['migration_sha256'] == config['migration']['sha256'] and item['sources_stable'] is True)
    validate_proof_sources(proof, config, candidate=True); validate_proof_sources(promotion, config, candidate=False)
    require(proof['rollback_verified'] is True and proof['owned_backend_settled'] is True and proof['before'] == proof['after'])
    require(proof['behavior_assertions_passed'] is True)
    require(proof['compact_release_readback_proven'] is True)
    require(proof['catalog_delta_sha256'] == config['delta']['sha256'] and promotion['source_sha256'].get(DELTA) == config['delta']['sha256'])
    require(promotion['proof_sha256'] == config['local_proof']['sha256'] and promotion['exact_reviewed_catalog_delta'] is True
            and promotion['business_auth_runtime_and_old_configuration_preserved'] is True and promotion['immutable_versions_installed'] is True and promotion['lock_retained'] is False)
    require(proof['hosted_credentials_loaded'] is False and promotion['hosted_credentials_loaded'] is False)
    require(proof['readback_before']['versions'] == proof['readback_expected']['versions'] == [name[:14] for name in names[:-1]])
    expected = copy.deepcopy(proof['readback_expected']); expected['versions'] += [MIGRATION[:14]]
    compare_states(proof['readback_before'], expected, delta)
    require(promotion['before'] == proof['readback_before'] and promotion['after'] == expected)
    validate_race_proof(read_json(config['race_proof']['path']), config)
    return {'migration': MIGRATION, 'migration_sha256': config['migration']['sha256'], 'config_sha256': CONFIG_SHA,
            'readback_sha256': config['readback']['sha256'], 'delta_sha256': config['delta']['sha256'],
            'delta_keys_sha256': canonical(delta_keys), 'versions': [name[:14] for name in names],
            'helper_sha256': sha(Path(__file__).read_bytes()), 'source_seals': config['source_seals']}


def private_write(file, data):
    from provision_logo_verifier import WindowsPrivateFiles
    PRIVATE.mkdir(parents=True, exist_ok=True); security = WindowsPrivateFiles()
    with security.create(file) as handle:
        handle.write(data); handle.flush(); os.fsync(handle.fileno()); security.verify_open(handle)


def call(arguments):
    label = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '-' + uuid.uuid4().hex[:8]
    try: result = cli_call(arguments)
    except subprocess.TimeoutExpired as error:
        for stream in ('stdout', 'stderr'):
            value = getattr(error, stream, None) or b''
            private_write(PRIVATE / (label + '.' + stream), value.encode() if isinstance(value, str) else value)
        raise Blocked() from None
    for stream in ('stdout', 'stderr'): private_write(PRIVATE / (label + '.' + stream), getattr(result, stream).encode())
    return result


def inspect_state(inputs):
    sealed(READBACK, inputs['readback_sha256'])
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0 and len(result.stdout.encode()) <= 2 * 1024 * 1024)
    rows = json.loads(result.stdout)['rows']; require(len(rows) == 1 and set(rows[0]) == {'m05_presentation_release'})
    state = rows[0]['m05_presentation_release']
    require(state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['unrestricted_visibility'] is True)
    runtime = copy.deepcopy(state['runtime']); require({name.replace(' ', '') for name in runtime['execute']} == OPERATIONS)
    replay = 'eps.claim_job_stage_replay(jsonb, text, text, text)'; require(runtime['execute'].count(replay) == 1); runtime['execute'].remove(replay)
    try: validate_ten_runtime(runtime)
    except Exception: raise Blocked() from None
    require(state['protected_m02']['job_exists'] is True and state['protected_m02']['manual_note_retained'] is True and state['protected_m02']['source_inputs_count'] >= 1)
    require(isinstance(state['managed_auth'], dict) and isinstance(state['schema_defaults'], dict))
    require(state['versions'] in (inputs['versions'][:-1], inputs['versions']))
    return state


def pending_migrations(text): return sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', text)))
def validate_pending(text): require(pending_migrations(text) == [MIGRATION])
def push_command(dry_run): return ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json'] + (['--dry-run'] if dry_run else [])
def refuse_repeat_apply(): require(not CLAIM.exists() and not any(EVIDENCE.glob('*-apply-attempt.json')))


def retain(receipt, suffix):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    file = EVIDENCE / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + suffix + '.json')
    with file.open('x', encoding='utf8') as handle:
        json.dump(receipt, handle, indent=2); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    return file.relative_to(ROOT).as_posix()


def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments
    require(len(arguments) <= 1); action = arguments[0] if arguments else 'dry-run'
    require(action in ('inspect', 'dry-run', 'apply', 'readback'))
    receipt = {'action': action, 'target': TARGET, 'migration': MIGRATION, 'result': 'failed', 'dispatch_attempted': False,
               'automatic_retry': False, 'provider_called': False, 'flags_changed': False, 'identity_provisioned': False,
               'seeds': False, 'vault_sync': False, 'hosting_deferred': True}
    try:
        inputs = current_release_inputs(); receipt['inputs'] = inputs
        delta = read_json(DELTA); before = inspect_state(inputs); receipt['before'] = before
        if action == 'inspect': receipt['readback'] = before
        elif action == 'readback':
            require(before['versions'] == inputs['versions']); claim = read_json(CLAIM.relative_to(ROOT).as_posix())
            require(claim['target'] == TARGET and claim['inputs_sha256'] == canonical(inputs))
            file = Path(claim['attempt_receipt'])
            require(file.parent.as_posix() == 'tracking/evidence/cloud-m05-presentations' and file.name.endswith('-apply-attempt.json'))
            attempt = read_json(file); require(canonical(attempt['before']) == claim['before_sha256'])
            receipt['before'] = attempt['before']; receipt['readback'] = before
            receipt['comparison'] = compare_states(attempt['before'], before, delta)
        else:
            require(before['versions'] == inputs['versions'][:-1])
            validate_before_state(before,delta)
            require(before['catalog_delta_values'] == {key: value['before'] for key, value in delta['changed'].items()})
            if action == 'apply':
                refuse_repeat_apply(); dry = read_json('tracking/evidence/cloud-m05-presentations/dry-run.json')
                age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result'] == 'passed' and dry['inputs'] == inputs and dry['before'] == before and dry['pending_migrations'] == [MIGRATION] and 0 <= age <= 900)
            receipt['attempt_receipt'] = retain(receipt, action + '-attempt')
            if action == 'apply':
                private_write(CLAIM, (json.dumps({'target': TARGET, 'inputs_sha256': canonical(inputs), 'before_sha256': canonical(before), 'attempt_receipt': receipt['attempt_receipt'], 'dispatch_may_have_occurred': True}) + '\n').encode())
            require(current_release_inputs() == inputs)
            if action == 'apply': receipt['dispatch_attempted'] = True
            result = call(push_command(action == 'dry-run')); receipt['exit_code'] = result.returncode
            receipt['pending_migrations'] = pending_migrations(result.stdout + '\n' + result.stderr)
            after = inspect_state(inputs); receipt['readback'] = after
            if action == 'apply': receipt['comparison'] = compare_states(before, after, delta)
            else: require(before == after)
            require(result.returncode == 0); validate_pending(result.stdout + '\n' + result.stderr)
        receipt['application_verified_by_readback'] = action in ('apply', 'readback'); receipt['runtime_execute_operations'] = 11; receipt['result'] = 'passed'
    except Exception:
        receipt['reason'] = 'Fixed24 release unconfirmed. Preserve claim and reconcile through read-only readback; no automatic repeat.'
        raise
    finally:
        receipt['finished_at'] = stamp(); file = retain(receipt, action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-' + uuid.uuid4().hex + '.tmp'); temporary.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf8'); os.replace(temporary, EVIDENCE / 'dry-run.json')
        print(json.dumps({'result': receipt['result'], 'receipt': file, 'application_verified_by_readback': receipt.get('application_verified_by_readback', False), 'automatic_retry': False}))


if __name__ == '__main__':
    try: main()
    except Exception:
        sys.stderr.write('Fixed24 release stopped; raw diagnostics remain private. No automatic retry.\n'); sys.exit(1)
