"""Fixed coordinated14->15 library release. No seed, identity or provider action.

Fresh cloud baseline permits already-authorized owner enrollment/project changes.
All baseline rows, runtime grants and old catalog entries must remain unchanged.
Unknown dispatch is retained for read-only reconciliation, never auto-retried.
"""
from pathlib import Path
import copy, datetime, hashlib, json, os, re, sys, tomllib, uuid
from release_foundation import ROOT, TARGET, call as cli_call

MIGRATION = '20261029090724_m03_candidate_library.sql'
SEAL = '2a84e240fa1ed3a283a483775e797e7ef1bafeea36d2d11ace17e06b857d8b8d'
READBACK = 'tools/sql/candidates-library-readback.sql'
READBACK_SEAL = '0dbb4e2f26980288b5469be3cdb1842151b18294e3daa9e4190a9106d72e9661'
PROOF = 'tracking/evidence/m03/candidate-local/2026-10-29T09-04-40-827Z-25b670e9.json'
PROOF_SEAL = 'c6e4be98a225ffde1bdb6aef0ce6c189048811fcbee9875382c95e9a7a7aac15'
PROMOTION = 'tracking/evidence/m03/library-promotion/2026-10-29T09-10-06-082Z-05c4ba7c.json'
PROMOTION_SEAL = '786cbc402111c91116a120172edacbc9d18449af3a1884736a46dfae5405d42c'
MANIFEST_SEAL = '16161a9a0d3b8fe0efd49c9f629adb9233cf97cd0479e51abd08743efe5f5341'
TABLES = {'eps.candidates', 'eps.candidate_media', 'eps.candidate_media_frames', 'eps.workspace_candidates'}
PUBLIC_FUNCTIONS = {'public.' + name for name in ('eps_search_candidates', 'eps_get_candidate', 'eps_get_candidate_media', 'eps_find_candidate_duplicates', 'eps_list_workspace_candidates', 'eps_create_candidate', 'eps_update_candidate', 'eps_confirm_candidate_reviewed', 'eps_archive_candidate', 'eps_update_candidate_frames', 'eps_resolve_candidate_duplicate', 'eps_add_workspace_candidate', 'eps_update_workspace_candidate', 'eps_remove_workspace_candidate')}
COLUMNS = {'source_timestamp_ms', 'duration_ms'}
EVIDENCE = ROOT / 'tracking/evidence/cloud-candidate-library'

def require(value):
    if not value: raise ValueError('CANDIDATE_LIBRARY_RELEASE_UNCONFIRMED')
def sha(value): return hashlib.sha256(value).hexdigest()
def read_json(file): return json.loads((ROOT / file).read_bytes())
def canonical(value): return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())
def addition(key, row):
    return (row.get('table') in TABLES or row.get('name') in TABLES
      or key == 'functions' and (row['name'].startswith('eps.cast_') or row['name'] in PUBLIC_FUNCTIONS)
      or key == 'roles' and row['name'] == 'eps_cast_owner'
      or key in ('table_acls', 'column_acls') and row['role'] == 'eps_cast_owner'
      or key == 'columns' and row['table'] == 'eps.media_assets' and row['name'] in COLUMNS
      or key == 'column_acls' and row['table'] == 'eps.media_assets' and row['column'] in COLUMNS
      or key == 'constraints' and row['table'] == 'eps.media_assets' and row['name'] in {'media_assets_' + name + '_check' for name in COLUMNS}
      or key == 'policies' and (row['name'].startswith('cast_') or row['name'] in ('eps_cast_no_objects', 'eps_cast_no_buckets')))
def without_additions(catalog):
    result = copy.deepcopy(catalog)
    for key, rows in result.items():
        result[key] = [row for row in rows if not addition(key, row)]
        for row in result[key]:
            if 'execute' in row: row['execute'].pop('eps_cast_owner', None)
            if 'explicit_acl' in row: row['explicit_acl'] = [acl for acl in row['explicit_acl'] if acl['grantee'] != 'eps_cast_owner']
    return result
def additions(catalog, roles):
    result = {key: [copy.deepcopy(row) for row in rows if addition(key, row)] for key, rows in catalog.items()}
    for key, rows in result.items():
        if key in ('table_acls', 'column_acls'): result[key] = [row for row in rows if row['role'] in roles]
        if key == 'functions':
            for row in rows: row['execute'] = {name: value for name, value in row['execute'].items() if name in roles}
    return result
def compare(before, after, expected):
    require(after['versions'] == before['versions'] + [MIGRATION[:14]])
    for key in ('source_config', 'assets', 'runtime', 'buckets', 'release_additions_pristine', 'candidate_media_extensions_pristine', 'query_role', 'database', 'unrestricted_visibility'):
        require(after[key] == before[key])
    require(after['candidate_media_extensions_pristine'] is True)
    for key in ('counts', 'data_sha256'):
        old = dict(after[key])
        for table in TABLES: old.pop(table, None)
        require(old == before[key])
    require(all(after['counts'][table] == 0 for table in TABLES))
    require(without_additions(after['catalog']) == before['catalog'])
    roles = {row['name'] for row in before['catalog']['roles']} | {'anon', 'authenticated', 'service_role', 'eps_cast_owner'}
    require(additions(after['catalog'], roles) == additions(expected['catalog'], roles))
def prerequisites():
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False)
    for file, seal in ((READBACK, READBACK_SEAL), (PROOF, PROOF_SEAL), (PROMOTION, PROMOTION_SEAL), ('development/local-db/reviewed.json', MANIFEST_SEAL)):
        require(sha((ROOT / file).read_bytes()) == seal)
    manifest = read_json('development/local-db/reviewed.json')
    names = sorted(path.name for path in (ROOT / 'supabase/migrations').glob('*.sql'))
    require(len(manifest['migrations']) == 15 and names == [Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']: require(row['reviewed_by'] and row['reviewed_at'] and sha((ROOT / row['path']).read_bytes()) == row['sha256'])
    require(names[-1] == MIGRATION and sha((ROOT / 'supabase/migrations' / MIGRATION).read_bytes()) == SEAL)
    proof, promotion = read_json(PROOF), read_json(PROMOTION)
    require(proof['result'] == 'passed' and proof['rollback_verified'] and proof['cloud_called'] is False)
    require(promotion['result'] == 'passed' and promotion['business_and_old_catalog_preserved'] and promotion['migration_sha256'] == SEAL and promotion['cloud_called'] is False)
    compare(promotion['before'], promotion['after'], promotion['after'])
    return {'migration_sha256': SEAL, 'proof_sha256': PROOF_SEAL, 'promotion_sha256': PROMOTION_SEAL, 'manifest_sha256': MANIFEST_SEAL, 'readback_sha256': READBACK_SEAL}, [name[:14] for name in names[:-1]], promotion['after']
def call(arguments):
    result = cli_call(arguments)
    directory = ROOT / '.local/cloud-candidate-library'; directory.mkdir(parents=True, exist_ok=True)
    label = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '-' + uuid.uuid4().hex[:8]
    for stream in ('stdout', 'stderr'): (directory / (label + '.' + stream)).write_text(getattr(result, stream), encoding='utf8')
    return result
def inspect():
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0)
    rows = json.loads(result.stdout)['rows']; require(len(rows) == 1 and set(rows[0]) == {'candidates_library_release'})
    state = rows[0]['candidates_library_release']; require(state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['unrestricted_visibility'] is True)
    return state
def retain(value, suffix):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    file = EVIDENCE / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + suffix + '.json')
    file.write_text(json.dumps(value, indent=2) + '\n', encoding='utf8'); return file.relative_to(ROOT).as_posix()
def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''; require(action in ('dry-run', 'apply', 'readback'))
    inputs, versions, expected = prerequisites()
    receipt = {'action': action, 'target': TARGET, 'inputs': inputs, 'result': 'failed', 'dispatch_attempted': False, 'automatic_retry': False, 'provider_called': False, 'identity_provisioned': False, 'seeds': False}
    try:
        before = inspect(); receipt['before'] = before; require(before['versions'] in (versions, versions + [MIGRATION[:14]]))
        if action == 'readback':
            baseline = read_json('tracking/evidence/cloud-candidate-library/dry-run.json')['before']
            compare(baseline, before, expected); receipt['application_verified_by_readback'] = True
        else:
            require(before['versions'] == versions)
            if action == 'apply':
                dry = read_json('tracking/evidence/cloud-candidate-library/dry-run.json')
                age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result'] == 'passed' and canonical(dry['inputs']) == canonical(inputs) and dry['before'] == before and 0 <= age <= 3600)
            receipt['attempt_receipt'] = retain(receipt, action + '-attempt')
            command = ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json']
            if action == 'dry-run': command.append('--dry-run')
            receipt['dispatch_attempted'] = action == 'apply'; result = call(command); receipt['exit_code'] = result.returncode
            pending = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr))); receipt['pending_migrations'] = pending
            after = inspect(); receipt['readback'] = after
            if action == 'apply': compare(before, after, expected); receipt['application_verified_by_readback'] = True
            else: require(before == after)
            require(result.returncode == 0 and pending == [MIGRATION])
        receipt['result'] = 'passed'
    except Exception:
        receipt['reason'] = 'Fixed library15 release unconfirmed. Inspect retained readback/history before any retry.'
        raise
    finally:
        receipt['finished_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat(); file = retain(receipt, action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-' + uuid.uuid4().hex + '.tmp'); temporary.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf8'); os.replace(temporary, EVIDENCE / 'dry-run.json')
        print(json.dumps({'result': receipt['result'], 'receipt': file, 'application_verified_by_readback': receipt.get('application_verified_by_readback', False), 'automatic_retry': False}))
if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('Fixed candidate-library release stopped; raw diagnostics remain private.\n'); sys.exit(1)
