"""Bounded read-only15 reconciliation for eleven observed managed Storage columns.

The failed apply and its helper remain immutable. No migration, seed, grants,
configuration or business mutation is offered by this tool.
"""
import copy, datetime, json, sys
import release_candidate_library as release

APPLY = 'tracking/evidence/cloud-candidate-library/2026-10-29T09-14-24-275050Z-6b6bb388-apply.json'
APPLY_SEAL = '0178290a7c9055ff634b257531036aabbeae6115105c35c8f0a5386c22bc2d6b'
EXTRA_COLUMNS = {
    ('storage.buckets', 'avif_autodetection'), ('storage.buckets', 'type'),
    ('storage.buckets', 'versioning_status'), ('storage.buckets', 'lifecycle_configuration'),
    ('storage.buckets', 'lifecycle_configuration_generation'), ('storage.objects', 'is_delete_marker'),
    ('storage.objects', 'is_versioned'), ('storage.objects', 'version'), ('storage.objects', 'user_metadata'),
    ('storage.objects', 'path_tokens'), ('storage.objects', 'archived_at'),
}
def compare_retained(before, after, expected):
    roles = {row['name'] for row in before['catalog']['roles']} | {'anon', 'authenticated', 'service_role', 'eps_cast_owner'}
    actual_new = release.additions(after['catalog'], roles)['column_acls']
    expected_new = release.additions(expected['catalog'], roles)['column_acls']
    expected_keys = {(row['table'], row['column'], row['role']) for row in expected_new}
    extras = [row for row in actual_new if (row['table'], row['column'], row['role']) not in expected_keys]
    release.require(len(extras) == 11 and {(row['table'], row['column']) for row in extras} == EXTRA_COLUMNS)
    for row in extras:
        release.require(row['role'] == 'eps_cast_owner')
        inherited = [old for old in before['catalog']['column_acls'] if old['table'] == row['table'] and old['column'] == row['column'] and old['role'] == 'authenticated']
        release.require(len(inherited) == 1)
        release.require({key: value for key, value in row.items() if key != 'role'} == {key: value for key, value in inherited[0].items() if key != 'role'})
        release.require(any(column['table'] == row['table'] and column['name'] == row['column'] for column in before['catalog']['columns']))
    role = next(row for row in after['catalog']['roles'] if row['name'] == 'eps_cast_owner')
    release.require(role['parents'] == [{'name': 'authenticated', 'admin': False, 'inherit': True, 'set': False}])
    for name, table in [('eps_cast_no_objects', 'storage.objects'), ('eps_cast_no_buckets', 'storage.buckets')]:
        policy = [row for row in after['catalog']['policies'] if row['name'] == name and row['table'] == table]
        release.require(len(policy) == 1 and policy[0]['permissive'] is False and policy[0]['using'] == 'false' and policy[0]['check'] == 'false' and policy[0]['roles'] == ['eps_cast_owner'])
    adjusted = copy.deepcopy(after)
    adjusted['catalog']['column_acls'] = [row for row in adjusted['catalog']['column_acls'] if row not in extras]
    release.compare(before, adjusted, expected)
    return [{'table': row['table'], 'column': row['column'], 'role': row['role'], 'matches_preexisting_authenticated_flags': True} for row in extras]
def main():
    release.require(len(sys.argv) == 1)
    inputs, versions, expected = release.prerequisites()
    release.require(release.sha((release.ROOT / APPLY).read_bytes()) == APPLY_SEAL)
    applied = release.read_json(APPLY)
    release.require(applied['dispatch_attempted'] is True and applied['exit_code'] == 0 and applied['pending_migrations'] == [release.MIGRATION] and applied['result'] == 'failed')
    inherited_columns = compare_retained(applied['before'], applied['readback'], expected)
    current = release.inspect()
    release.require(current['versions'] == versions + [release.MIGRATION[:14]])
    release.require(current['catalog'] == applied['readback']['catalog'])
    for key in ('runtime', 'source_config', 'assets', 'buckets', 'candidate_media_extensions_pristine'):
        release.require(current[key] == applied['readback'][key])
    changes = {key: {'at_apply_readback': applied['readback']['counts'].get(key), 'current': current['counts'].get(key)} for key in set(applied['readback']['counts']) | set(current['counts']) if applied['readback']['counts'].get(key) != current['counts'].get(key)}
    receipt = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'result': 'passed', 'target': release.TARGET,
        'read_only': True, 'ddl_dispatched': False, 'automatic_retry': False, 'historical_apply': APPLY, 'historical_apply_sha256': APPLY_SEAL,
        'historical_helper_source': 'development/m03/library-release-before-managed-storage-reconcile/release_candidate_library.py',
        'inputs': inputs, 'exact_managed_storage_column_differences': inherited_columns,
        'captured_apply_preserved_all_old_rows_and_old_catalog': True, 'new_restrictive_storage_policies_verified': True,
        'fresh_catalog_and_runtime_match_applied_library': True, 'fresh_history': current['versions'],
        'post_release_business_count_changes': changes,
        'post_release_data_claim': 'Fresh catalog/history verified only. Root reported creating the authorized Dummy Reuse Test workspace after the captured apply receipt; post-release row contents were not individually inspected.',
        'current': current}
    file = release.retain(receipt, 'managed-storage-readonly-reconcile')
    print(json.dumps({'result': 'passed', 'receipt': file, 'ddl_dispatched': False, 'captured_apply_old_rows_preserved': True, 'fresh_catalog_verified': True, 'post_release_business_count_changes': changes}))
if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('Bounded library read-only reconciliation stopped; no mutation or retry occurred.\n'); sys.exit(1)
