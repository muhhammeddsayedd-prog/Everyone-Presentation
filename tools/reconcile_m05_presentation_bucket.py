"""Fixed read-only recovery for the five observed managed Storage extensions.

Never changes/repeats the migration, enables processing or edits its old proofs.
Importing is inert; missing final pins deny every CLI call.
"""
import copy
import json
import sys

import release_m05_presentations as release

ROOT = release.ROOT
CONFIG = 'development/m05/presentation-bucket-reconciliation.json'
CONFIG_SHA = '21c88f77b3c104ccc8cf2e73ded642c5d5930d0a47b726dc4a2e70bc2e244add'
SQL = 'tools/sql/m05-presentation-bucket-reconciliation.sql'
APPLY = 'tracking/evidence/cloud-m05-presentations/2026-10-29T22-13-00-310531Z-267e06a1-apply.json'
APPLY_SHA = '8f8523693d4800357b5c7f8157f86400debc3f838d05ea54300fa90a89e8980f'
FAILED_READBACK = 'tracking/evidence/cloud-m05-presentations/2026-10-29T22-13-29-418588Z-0db34869-readback.json'
FAILED_READBACK_SHA = '025f98f17d51ffaf2b0e78b4d25348ede0d3ea261d980ddd0149061ee094a2eb'
BASE_KEYS = {'id', 'name', 'owner', 'owner_id', 'public', 'file_size_limit', 'allowed_mime_types'}
MANAGED_FIELDS = {'avif_autodetection': False, 'lifecycle_configuration': None,
                  'lifecycle_configuration_generation': None, 'type': 'STANDARD', 'versioning_status': 'DISABLED'}
require = release.require


def compare_reconciliation(before, after, delta, metadata, expected_metadata):
    require(isinstance(metadata, dict) and set(metadata) == {'schema_version', 'query_role', 'database', 'unrestricted_visibility',
                                                           'versions', 'columns', 'constraints', 'bucket_fields'})
    require(metadata == expected_metadata and metadata['schema_version'] == '1.0' and metadata['query_role'] == metadata['database'] == 'postgres'
            and metadata['unrestricted_visibility'] is True and metadata['versions'] == after['versions'])
    require(metadata['bucket_fields'] == MANAGED_FIELDS)
    require(isinstance(metadata['columns'], list) and len(metadata['columns']) == 5
            and {row['name'] for row in metadata['columns']} == set(MANAGED_FIELDS))
    require(isinstance(metadata['constraints'], list))
    expected_bucket = delta['m05_state']['bucket']; bucket = after['m05_state']['bucket']
    require(set(expected_bucket) == BASE_KEYS and isinstance(bucket, dict) and set(bucket) == BASE_KEYS | set(MANAGED_FIELDS))
    require({name: bucket[name] for name in MANAGED_FIELDS} == MANAGED_FIELDS)
    normalized = copy.deepcopy(after)
    normalized['m05_state']['bucket'] = {name: bucket[name] for name in BASE_KEYS}
    comparison = release.compare_states(before, normalized, delta)
    return {**comparison, 'exact_five_managed_new_bucket_fields': True, 'exact_managed_column_types_defaults_and_constraints': True,
            'normalization_applied_only_to_comparison_copy': True}


def current_inputs():
    release.sealed(CONFIG, CONFIG_SHA)
    inputs = release.current_release_inputs()
    config = release.read_json(CONFIG)
    require(set(config) == {'schema_version', 'metadata_receipt', 'expected_metadata', 'sql', 'source_seals'})
    require(config['schema_version'] == '1.0' and config['sql']['path'] == SQL)
    require(set(config['sql']) == set(config['metadata_receipt']) == {'path', 'sha256'})
    release.sealed(SQL, config['sql']['sha256'])
    require({SQL, 'tests/operations/test_m05_presentation_bucket_recovery.py'} <= set(config['source_seals']))
    for name, digest in config['source_seals'].items(): release.sealed(name, digest)
    release.sealed(config['metadata_receipt']['path'], config['metadata_receipt']['sha256'])
    captured = release.read_json(config['metadata_receipt']['path'])
    require(captured['target'] == release.TARGET and captured['result'] == 'captured' and captured['read_only'] is True
            and captured['sql'] == SQL and captured['sql_sha256'] == config['sql']['sha256']
            and captured['application_mutations'] is False and captured['secrets_or_source_objects_returned'] is False
            and captured['state'] == config['expected_metadata'])
    release.sealed(APPLY, APPLY_SHA); release.sealed(FAILED_READBACK, FAILED_READBACK_SHA)
    original = release.read_json(APPLY); failed = release.read_json(FAILED_READBACK)
    require(original['action'] == 'apply' and original['result'] == 'failed' and original['target'] == release.TARGET
            and original['dispatch_attempted'] is True and original['exit_code'] == 0 and original['inputs'] == inputs)
    require(failed['action'] == 'readback' and failed['result'] == 'failed' and failed['target'] == release.TARGET
            and failed['inputs'] == inputs and failed['before'] == original['before'])
    require(original['before']['versions'] == inputs['versions'][:-1] and original['readback']['versions'] == failed['readback']['versions'] == inputs['versions'])
    delta = release.read_json(release.DELTA)
    expected = config['expected_metadata']
    compare_reconciliation(original['before'], original['readback'], delta, expected, expected)
    compare_reconciliation(original['before'], failed['readback'], delta, expected, expected)
    return inputs, config, original, delta


def read_metadata(config):
    release.sealed(SQL, config['sql']['sha256'])
    result = release.call(['db', 'query', '--linked', '--project-ref', release.TARGET, '--file', str(ROOT / SQL), '--output-format', 'json'])
    require(result.returncode == 0 and len(result.stdout.encode()) <= 256 * 1024)
    rows = json.loads(result.stdout)['rows']
    require(len(rows) == 1 and set(rows[0]) == {'m05_presentation_bucket_metadata'})
    return rows[0]['m05_presentation_bucket_metadata']


def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments
    require(not arguments)
    report = {'action': 'reconcile_readonly', 'target': release.TARGET, 'migration': release.MIGRATION, 'result': 'failed',
              'automatic_retry': False, 'migration_repeated': False, 'write_operations': 0, 'flags_changed': False,
              'provider_called': False, 'original_comparison_failures_preserved': True, 'hosting_deferred': True}
    try:
        inputs, config, original, delta = current_inputs()
        report['inputs'] = inputs
        report['reconciliation_helper_sha256'] = release.sha((ROOT / 'tools/reconcile_m05_presentation_bucket.py').read_bytes())
        report['reconciliation_config_sha256'] = CONFIG_SHA
        report['original_apply'] = {'path': APPLY, 'sha256': APPLY_SHA}
        report['original_failed_readback'] = {'path': FAILED_READBACK, 'sha256': FAILED_READBACK_SHA}
        metadata = read_metadata(config)
        fresh = release.inspect_state(inputs)
        report['before'] = original['before']; report['readback'] = fresh; report['managed_bucket_metadata'] = metadata
        report['comparison'] = compare_reconciliation(original['before'], fresh, delta, metadata, config['expected_metadata'])
        require(current_inputs()[0] == inputs)
        report.update(result='passed', application_verified_by_readback=True, application_status='verified_applied_with_exact_managed_bucket_extension')
    finally:
        report['finished_at'] = release.stamp()
        file = release.retain(report, 'managed-bucket-reconciliation')
        print(json.dumps({'result': report['result'], 'receipt': file, 'application_verified_by_readback': report.get('application_verified_by_readback', False),
                          'write_operations': 0, 'automatic_retry': False}))


if __name__ == '__main__':
    try: main()
    except Exception:
        sys.stderr.write('Fixed read-only M05 bucket reconciliation stopped; original claim and receipts remain unchanged.\n')
        sys.exit(1)
