"""Fixed M05 readiness transition. Importing performs no IO.

Inspect is read-only. Enable is one-shot and requires sealed canonical recovery,
live WF03, authenticated complete startup and local single-flag proof. Unknown
enable outcomes only permit readback, never an automatic repeat.
"""
import copy
import datetime
import json
import os
from pathlib import Path
import sys
import uuid

import release_m05_presentations as release

ROOT = release.ROOT
SQL = 'development/m05/enable-presentation-processing.sql'
SQL_SHA = '2188b95f79344af181430b5c0bd75b686176da11fa08e4aaf109d65716417105'
READINESS = 'tools/sql/m05-presentation-readiness.sql'
READINESS_SHA = '9edbac4c6ec2f437efaf1621b8e8792b4070e739dd85dd3382a6cc04c5cd4e78'
CONFIG = 'development/m05/presentation-activation.json'
CONFIG_SHA = 'a9d88a0ceccfe98372829ff2a3069c94cddf37c490a1fb06382cacc15b4536a7'
EVIDENCE = ROOT / 'tracking/evidence/m05/presentation-activation'
CLAIM = ROOT / '.local/presentation-activation/enable.claim.json'
STARTUP_HARNESS = 'tools/check-presentation-runtime.mts'
STARTUP_SOURCES = {STARTUP_HARNESS, 'tools/start-specs-worker.mjs', 'tools/worker-private-env.mjs', 'tools/worker-runtime-env.mjs',
    'tools/worker-files-env.mjs', 'tools/candidate-runtime-env.mjs', 'tools/pdf-vision-env.mjs', 'tools/frame-runtime-env.mjs',
    'tools/review-runtime-env.mjs', 'tools/presentation-runtime-env.mjs', 'apps/worker/src/runtime-main.ts', 'apps/worker/src/runtime.ts',
    'apps/worker/src/runtime-types.ts', 'apps/worker/src/n8n-orchestrator.ts', 'apps/worker/src/presentation-assets.ts',
    'apps/worker/src/presentation-stage-executor.ts', 'apps/worker/src/presentation-pdf.ts', 'apps/worker/src/presentation-pdf-inspect-process.mjs',
    'apps/worker/src/native-browser.ts', 'packages/central/src/specs-runtime-gateway.ts', 'packages/central/src/presentation-runtime-assets.ts',
    'packages/integrations/src/n8n-dispatch.ts'}
LOCAL_HARNESS = 'tools/test-m05-readiness-local.mjs'
LOCAL_SOURCES = {LOCAL_HARNESS, SQL, READINESS, release.READBACK, 'tools/local-postgres.mjs', 'development/local-db/instance.json',
                 'development/local-db/reviewed.json', 'supabase/migrations/' + release.MIGRATION}
require = release.require


def sources():
    release.sealed(SQL, SQL_SHA); release.sealed(READINESS, READINESS_SHA)
    return release.current_release_inputs()


def compare_enabled(before, after, enabled_hash):
    require(isinstance(enabled_hash, str) and release.HASH.fullmatch(enabled_hash))
    require(len(before['versions']) == 24 and before['versions'] == after['versions'])
    configuration = before['m05_state']['config']
    require(configuration['enabled'] is False and before['review_state']['config']['enabled'] is True)
    require(before['m05_state']['tables']['eps.presentation_processing_config']['count'] == 1)
    expected = copy.deepcopy(before)
    expected['m05_state']['config']['enabled'] = True
    expected['m05_state']['tables']['eps.presentation_processing_config']['sha256'] = enabled_hash
    require(after == expected)
    return {'only_presentation_enabled_flag_changed': True, 'old_catalog_business_auth_runtime_storage_preserved': True,
            'existing_review_configuration_preserved': True}


def validate_startup(proof, config):
    require(proof['result'] == 'passed' and proof['sources_stable'] is True and proof['gateway_attempted'] is True
            and proof['authenticated_gateway_verified'] is True and proof['jobs_claimed'] is False and proof['provider_invoked'] is False
            and proof['workflows_executed'] is False and proof['credentials_printed'] is False and proof['hosting_deferred'] is True)
    require(proof['harness_path'] == STARTUP_HARNESS and set(proof['source_sha256']) == STARTUP_SOURCES)
    require(proof['harness_sha256'] == proof['source_sha256'][STARTUP_HARNESS])
    for name, digest in proof['source_sha256'].items(): require(config['source_seals'].get(name) == digest); release.sealed(name, digest)


def validate_workflow(published, probe):
    require(published['result'] == 'passed' and published['action'] == 'publish' and published['active'] is True and published['graph_verified'] is True)
    require(probe['result'] == 'passed' and probe['action'] == 'probe' and probe['workflow_id'] == published['workflow_id']
            and probe['real_workflow_executions'] is True and probe['database_work_claimed'] is False and probe['provider_invoked'] is False
            and probe['unauthorized_http_status'] in (401, 403) and probe['invalid_http_status'] == probe['malformed_stage_http_status'] == 400)
    require([row['stage'] for row in probe['stages']] == ['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'])
    require(len({row['execution_id'] for row in probe['stages']}) == 4 and all(row['kind'] == 'presentation_render' and row['http_status'] == 200
            and row['bound_response'] is True and isinstance(row['execution_id'], str) and row['execution_id'] for row in probe['stages']))


def current_inputs():
    release.sealed(CONFIG, CONFIG_SHA)
    inputs = sources(); config = release.read_json(CONFIG)
    require(set(config) == {'schema_version', 'cloud_reconciliation', 'workflow_publish', 'workflow_probe', 'startup', 'local_readiness',
                           'enabled_configuration_sha256', 'source_seals'})
    require(config['schema_version'] == '1.0' and LOCAL_SOURCES | STARTUP_SOURCES | {SQL, READINESS,
            'tests/operations/test_m05_presentation_enable.py', 'tools/provision-presentation-n8n.mjs', 'tools/build-presentation-wf03.mjs',
            'tools/reconcile_m05_presentation_bucket.py', 'development/m05/presentation-bucket-reconciliation.json'} <= set(config['source_seals']))
    for name, digest in config['source_seals'].items(): release.sealed(name, digest)
    proofs = {}
    for key in ('cloud_reconciliation', 'workflow_publish', 'workflow_probe', 'startup', 'local_readiness'):
        item = config[key]; require(set(item) == {'path', 'sha256'}); release.sealed(item['path'], item['sha256']); proofs[key] = release.read_json(item['path'])
    cloud = proofs['cloud_reconciliation']
    require(cloud['result'] == 'passed' and cloud['action'] == 'reconcile_readonly' and cloud['target'] == release.TARGET
            and cloud['application_verified_by_readback'] is True and cloud['application_status'] == 'verified_applied_with_exact_managed_bucket_extension'
            and cloud['write_operations'] == 0 and cloud['inputs'] == inputs and len(cloud['readback']['versions']) == 24)
    require(cloud['reconciliation_helper_sha256'] == config['source_seals']['tools/reconcile_m05_presentation_bucket.py']
            and cloud['reconciliation_config_sha256'] == config['source_seals']['development/m05/presentation-bucket-reconciliation.json'])
    validate_startup(proofs['startup'], config); validate_workflow(proofs['workflow_publish'], proofs['workflow_probe'])
    proof = proofs['local_readiness']
    require(proof['result'] == 'passed' and proof['cloud_called'] is False and proof['provider_called'] is False and proof['hosted_credentials_loaded'] is False)
    require(all(proof[name] is True for name in ('repeated_enable_denied', 'synthetic_preconditions', 'exact_single_flag_change',
            'behavior_assertions_passed', 'owned_backend_settled', 'rollback_verified', 'sources_stable')) and proof['original'] == proof['after'])
    require(proof['harness_path'] == LOCAL_HARNESS and proof['harness_sha256'] == config['source_seals'][LOCAL_HARNESS]
            and LOCAL_SOURCES <= set(proof['source_sha256']))
    for name, digest in proof['source_sha256'].items(): require(config['source_seals'].get(name) == digest); release.sealed(name, digest)
    compare_enabled(proof['before'], proof['enabled_state'], config['enabled_configuration_sha256'])
    return inputs, config, proofs


def query(file, field):
    require(file in (SQL, READINESS))
    release.sealed(file, SQL_SHA if file == SQL else READINESS_SHA)
    result = release.call(['db', 'query', '--linked', '--project-ref', release.TARGET, '--file', str(ROOT / file), '--output-format', 'json'])
    require(result.returncode == 0 and len(result.stdout.encode()) <= 256 * 1024)
    rows = json.loads(result.stdout)['rows']; require(len(rows) == 1 and set(rows[0]) == {field})
    return rows[0][field]


def validate_readiness(state, inputs, *, idle):
    require(state['schema_version'] == '1.0' and state['query_role'] == state['database'] == 'postgres'
            and state['unrestricted_visibility'] is True and state['versions'] == inputs['versions'])
    require(state['review_processing']['enabled'] is True and state['protected_m02']['status'] == 'waiting_for_input')
    require(state['protected_m02']['id'] == 'b3f90268-147d-41d4-8875-2a6435df1496')
    if idle: require(state['active_jobs'] == {'queued': 0, 'running': 0, 'by_kind': []})


def retain(report, suffix):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    file = EVIDENCE / (release.stamp().replace(':', '-').replace('.', '-') + '-' + uuid.uuid4().hex[:8] + '-' + suffix + '.json')
    with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    return file.relative_to(ROOT).as_posix()


def claim(before, inputs, attempt):
    from provision_logo_verifier import WindowsPrivateFiles
    require(not CLAIM.exists())
    CLAIM.parent.mkdir(parents=True, exist_ok=True)
    with WindowsPrivateFiles().create(CLAIM) as handle:
        handle.write((json.dumps({'target': release.TARGET, 'inputs_sha256': release.canonical(inputs), 'activation_config_sha256': CONFIG_SHA,
                                 'activation_helper_sha256': release.sha(Path(__file__).read_bytes()), 'before_sha256': release.canonical(before),
                                 'attempt_receipt': attempt, 'automatic_retry': False, 'dispatch_may_have_occurred': True}) + '\n').encode())
        handle.flush(); os.fsync(handle.fileno())


def main(arguments=None):
    args = sys.argv[1:] if arguments is None else arguments
    require(len(args) == 1 and args[0] in ('inspect', 'enable', 'readback')); action = args[0]
    report = {'action': action, 'target': release.TARGET, 'result': 'failed', 'automatic_retry': False, 'dispatch_attempted': False,
              'credentials_modified': False, 'business_facts_written': False, 'hosting_deferred': True}
    try:
        report['source_sha256'] = {SQL: SQL_SHA, READINESS: READINESS_SHA,
                                  'tools/enable_m05_presentation.py': release.sha(Path(__file__).read_bytes())}
        if action == 'inspect':
            inputs = sources(); state = query(READINESS, 'm05_presentation_readiness'); validate_readiness(state, inputs, idle=False)
            report.update(result='passed', inputs=inputs, read_only=True, readiness=state, worker_idle=state['active_jobs'] == {'queued': 0, 'running': 0, 'by_kind': []})
        else:
            inputs, config, proofs = current_inputs(); report['inputs'] = inputs; report['activation_config_sha256'] = CONFIG_SHA
            if action == 'readback':
                saved = release.read_json(CLAIM.relative_to(ROOT).as_posix())
                require(saved['target'] == release.TARGET and saved['inputs_sha256'] == release.canonical(inputs)
                        and saved['activation_config_sha256'] == CONFIG_SHA and saved['activation_helper_sha256'] == release.sha(Path(__file__).read_bytes()))
                file = Path(saved['attempt_receipt']); require(file.parent == EVIDENCE.relative_to(ROOT) and file.name.endswith('-enable-attempt.json'))
                attempt = release.read_json(file.as_posix()); before = attempt['before']; require(saved['before_sha256'] == release.canonical(before))
            else:
                require(not CLAIM.exists() and not any(EVIDENCE.glob('*-enable-attempt.json')))
                for name, seconds in (('startup', 1800), ('workflow_probe', 3600)):
                    age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(proofs[name]['observed_at'].replace('Z', '+00:00'))).total_seconds()
                    require(0 <= age <= seconds)
                before = release.inspect_state(inputs); require(before == proofs['cloud_reconciliation']['readback'])
                readiness = query(READINESS, 'm05_presentation_readiness'); validate_readiness(readiness, inputs, idle=True)
                require(readiness['presentation_processing'] == before['m05_state']['config'] and readiness['presentation_processing']['enabled'] is False)
                report['before'] = before; report['readiness_before'] = readiness
                attempt = retain(report, 'enable-attempt'); claim(before, inputs, attempt)
                require(current_inputs()[0] == inputs)
                report['dispatch_attempted'] = True
                query(SQL, 'm05_presentation_enabled')
            after = release.inspect_state(inputs); report['before'] = before; report['readback'] = after
            report['comparison'] = compare_enabled(before, after, config['enabled_configuration_sha256'])
            report.update(result='passed', processing_enabled_verified=True, new_flag_only=True)
    finally:
        report['finished_at'] = release.stamp(); file = retain(report, action)
        print(json.dumps({'result': report['result'], 'receipt': file, 'processing_enabled_verified': report.get('processing_enabled_verified', False), 'automatic_retry': False}))


if __name__ == '__main__':
    try: main()
    except Exception:
        sys.stderr.write('Fixed M05 activation unconfirmed. Preserve its claim and use readback; never repeat the enable mutation.\n')
        sys.exit(1)
