"""Fixed seven-to-eight manual-specs release; never a processing acceptance claim.

Only dry-run/apply/readback, one linked target and reviewed SQL are accepted.
Fresh eight-version proof seals below bind actual local evidence; any drift
fails closed before CLI dispatch. No Auth, key, flag, provider or business-row setup.
Sources: https://supabase.com/docs/reference/cli/supabase-db-push
https://www.postgresql.org/docs/17/functions-info.html
"""
from pathlib import Path
import copy
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tomllib
import uuid

import release_processing_foundation as base

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'
PRIOR_HELPER = 'tools/release_processing_foundation.py'
PRIOR_HELPER_HASH = '3f1c6b10e62e9713aaa511f332bcc554f9254ad4eec8564a02f59d6bf4fa8336'
PRIOR_SQL = 'tools/sql/processing-foundation-readback.sql'
PRIOR_SQL_HASH = '24d305c117aa61888de98a6dbfb732a20cc53c527804e192f735adc0e7715189'
PENDING = ['20261028172320_m02_manual_specs_draft.sql']
MIGRATIONS = {**base.MIGRATIONS, PENDING[0]: '8ab866a49cb2e01eabf3b83076fe4519a60255263d0a1a170ef3ba9718a2349c'}
VERSIONS = [name[:14] for name in MIGRATIONS]
READBACK = 'tools/sql/manual-specs-readback.sql'
READBACK_HASH = 'f4abfc3c8a73647d61d4abdf7152d674af51194fc02f52ebf5c0d214aeb54c07'
# Actual source-hashed local readback, not expressions guessed from SQL text.
POLICY_EXPRESSIONS_HASH = '7e40691629b22e2b24772d7269a2f0cca8da026c9354ab602d92cba46a7ebe0f'
EVIDENCE = ROOT / 'tracking/evidence/cloud-manual-specs'
# No old seven-version prerequisite receipt can stand in for these fresh gates.
PROOFS = {
    'prior_cloud': ('tracking/evidence/cloud-processing-foundation/2026-10-28T16-56-29-737639Z-6e03dbf9-readback.json', '79e3e233a22d4b9cc7ff0f3937bd86648c720741a3b15658a7f1fb88ae2b213e'),
    'initial_backfill': ('tracking/evidence/m02/specs-local/2026-10-28T18-02-35-594Z-b35f9f60.json', '6b1f88c9341292125ba35a2111ba231c795fdcda209d079b8cf6a2648ddddcd8'),
    'full_db': ('development/local-db/receipts/2026-10-28T18-07-49-870Z-test-db-summary-68140882.json', '645afb935651e81456cfd24ba41c4220543208a99a40b0e37f55139e381588f4'),
    'm01_replay': ('tracking/evidence/m01/replay-scope/2026-10-28T18-10-19-748Z-fixed.json', '48329a160356b0d189917c75c8d742b0b901fbea23920ed176e9a28d452f5b83'),
    'm02_local': ('tracking/evidence/m02/local/2026-10-28T18-08-57-532Z-7930ab51.json', '891079d3d52eafe6ca03e97b977871e3e244482aa6b1e5ed1b329a6544e55756'),
    'manual_specs': ('tracking/evidence/m02/specs-local/2026-10-28T18-07-04-016Z-0fdcf864.json', '972fa5ceedba89333b2c6a6c49435b74787f795be4cf8271aa5b44920cb70c06'),
    'local_contract': ('tracking/evidence/cloud-manual-specs/local-contract.json', '15a4f012fab2e35c971ed8614e47f15f5f7cf947e19e9d91393d77d11e7181ad'),
}
SOURCE_SEALS = {
    'tools/test-db.mjs': 'b8b38abd637883e63c44b5412fa5b9a0e359bd840eb549aacc4455f11729562b',
    'tools/test-m01-replay-scope.mjs': '7286314bc425f35ac8a85a8fb8f8d8042d647975a9957674b589378bad6f06eb',
    'tools/test-m02-local.mjs': '8564f61f153493dd87ec7c996828ccfcdb73fd489d3a1929dca679dc4c4cb078',
    'tools/test-m02-specs-local.mjs': '886d219d86d7172265d4675965ea38537e3b3bccbe73236ae88b5a08a182953a',
    'tools/local-postgres.mjs': '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
}
PUBLIC = {'public.' + name for name in ('eps_get_specs', 'eps_update_specs', 'eps_list_roles', 'eps_create_role', 'eps_update_role',
                                      'eps_list_slots', 'eps_resize_role_slots', 'eps_archive_role', 'eps_update_slot')}
PRIVATE = {'eps.specs_' + name for name in ('scope', 'check_body', 'check_text', 'check_requirements', 'check_clarifications',
    'merge_clarifications', 'count', 'check_allocation', 'assert_rows', 'assert_slots', 'lock_workspace', 'changed',
    'retirement_gate', 'dto', 'role_dto', 'slot_dto', 'initialize_workspace')}
ROLES = {'anon', 'authenticated', 'service_role', 'eps_api_owner', 'eps_logo_verify_owner', 'eps_jobs_owner',
         'eps_jobs_dispatcher', 'eps_specs_owner', 'eps_specs_initializer'}
TABLE_COLUMNS = {
    'eps.specs': set('id workspace_id source_asset_id source_text normalized_instructions clarifications source_extraction source_language_codes source_row_version processing_job_id row_version created_at updated_at'.split()),
    'eps.roles': set('id workspace_id spec_id name headcount category requirements clarifications source_role sort_order archived_at row_version created_at updated_at'.split()),
    'eps.slots': set('id workspace_id role_id ordinal label sort_order provisional archived_at row_version created_at updated_at'.split()),
}
UPDATES = {
    'eps.specs': set('normalized_instructions clarifications row_version updated_at'.split()),
    'eps.roles': set('name category requirements clarifications headcount archived_at row_version updated_at'.split()),
    'eps.slots': set('label provisional archived_at row_version updated_at'.split()),
}
INSERTS = {
    'eps.specs': set(),
    'eps.roles': set('workspace_id name headcount category requirements clarifications sort_order'.split()),
    'eps.slots': set('workspace_id role_id ordinal label sort_order provisional'.split()),
}
POLICIES = {
    'specs_workspace_identity': ('eps.workspaces', 'r'), 'specs_workspace_update': ('eps.workspaces', 'w'),
    'specs_read': ('eps.specs', 'r'), 'specs_insert': ('eps.specs', 'a'), 'specs_initialize_insert': ('eps.specs', 'a'),
    'specs_update': ('eps.specs', 'w'), 'roles_read': ('eps.roles', 'r'), 'roles_insert': ('eps.roles', 'a'),
    'roles_update': ('eps.roles', 'w'), 'slots_read': ('eps.slots', 'r'), 'slots_insert': ('eps.slots', 'a'),
    'slots_update': ('eps.slots', 'w'), 'specs_idempotency': ('eps.idempotency_records', '*'), 'specs_audit': ('eps.audit_events', 'a'),
    'eps_specs_no_objects': ('storage.objects', '*'), 'eps_specs_no_buckets': ('storage.buckets', '*'),
}
SUPPORT_TABLES = {'public.' + name for name in ('clients', 'projects', 'project_memberships', 'client_memberships', 'app_capability_grants')} | {
    'eps.' + name for name in ('workspaces', 'idempotency_records', 'audit_events', 'media_assets', 'upload_sessions', 'logo_verification_keys', 'jobs', 'job_events', 'outbox_events')
} | {'auth.users', 'storage.buckets', 'storage.objects'}
Blocked = base.Blocked
require = base.require


def digest(relative):
    return hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()


def read_json(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def definitions():
    """Fixed simple declarations only; not an arbitrary SQL/parser interface."""
    sql = (ROOT / 'supabase/migrations' / PENDING[0]).read_text(encoding='utf-8')
    pattern = re.compile(r'^create function\s+(\w+)\.(\w+)\s*(\([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$;', re.M | re.I)
    result = {}
    for match in pattern.finditer(sql):
        schema, function, header, body = match.groups()
        name = schema + '.' + function
        require(name in PUBLIC | PRIVATE and name not in result, 'Unexpected fixed specs routine/overload.')
        declaration = re.match(r'^\(([\s\S]*?)\)\s*returns\s+([\w.]+)\s+language\b', header, re.I)
        require(declaration is not None, 'Fixed specs declaration parser needs review.')
        arguments = []
        for argument in declaration.group(1).split(',') if declaration.group(1).strip() else []:
            parsed = re.match(r'^\s*(\w+)\s+([\w.]+(?:\[\])?)(?:\s+default\b[\s\S]*)?\s*$', argument, re.I)
            require(parsed is not None, 'Fixed specs argument parser needs review.')
            arguments.append(parsed.groups())
        result[name] = {
            'signature': name + '(' + ', '.join(kind for _, kind in arguments) + ')',
            'identity_arguments': ', '.join(argument + ' ' + kind for argument, kind in arguments),
            'returns': declaration.group(2), 'source_sha256': hashlib.sha256(body.replace('\r\n', '\n').encode()).hexdigest(),
            'owner': 'eps_specs_initializer' if function == 'specs_initialize_workspace' else 'eps_specs_owner',
            'definer': bool(re.search(r'\bsecurity\s+definer\b', header, re.I)),
            'volatility': 's' if re.search(r'\bstable\b', header, re.I) else ('i' if re.search(r'\bimmutable\b', header, re.I) else 'v'),
            'language': re.search(r'\blanguage\s+(\w+)', header, re.I).group(1).lower(),
        }
    require(set(result) == PUBLIC | PRIVATE and len(result) == 26, 'Exact 26 new specs routine contracts required.')
    return result


def unique_rows(rows, fields, expected):
    keys = [tuple(row[field] for field in fields) for row in rows]
    require(len(keys) == len(set(keys)) and set(keys) == expected, 'Metadata ACL/column projection is incomplete or duplicated.')


def validate_state(state):
    """Known7 absent-specs or known8 exact catalog; all other states fail closed."""
    old, manual = state['base'], state['manual']
    versions = old['versions']
    require(versions in (VERSIONS[:7], VERSIONS), 'Cloud history differs from the exact before/after release.')
    projection = copy.deepcopy(old)
    projection['versions'] = VERSIONS[:7]
    projection['functions'] = [row for row in projection['functions'] if row['name'] not in PUBLIC]
    # Pure verification only: never invoke base.prerequisites(), inspect() or main().
    require(base.validate_state(projection) == 'applied', 'Unchanged seven-version catalog boundary differs.')
    require(re.fullmatch('[a-f0-9]{64}', manual['workspace_state_sha256']) is not None, 'Workspace state digest missing.')
    if versions == VERSIONS[:7]:
        require(all(manual[key] == [] for key in ('functions', 'relations', 'table_acls', 'column_acls', 'roles', 'policies', 'triggers', 'support_acls', 'workspace_column_acls'))
                and manual['counts'] is None, 'Specs collision before release; preserve and reconcile.')
        return 'pending'
    expected = definitions()
    functions = manual['functions']
    unique_rows(functions, ('name',), {(name,) for name in expected})
    for function in functions:
        require(all(function[key] == value for key, value in expected[function['name']].items())
                and function['config'] == ['search_path=""'] and function['public_execute'] is False,
                'Specs routine source/signature/named arguments/result/owner/security differs.')
        public = function['name'] in PUBLIC
        initialize = function['name'] == 'eps.specs_initialize_workspace'
        require(set(function['execute']) == ROLES, 'Specs routine effective ACL projection differs.')
        for role in ROLES:
            allowed = (public and role in {'authenticated', 'eps_api_owner', 'eps_logo_verify_owner', 'eps_jobs_owner', 'eps_specs_owner'}
                       or not public and role == ('eps_specs_initializer' if initialize else 'eps_specs_owner'))
            require(function['execute'][role] is allowed, 'Specs routine became exposed to another principal/owner.')
    relations = manual['relations']
    unique_rows(relations, ('name',), {(name,) for name in TABLE_COLUMNS})
    require(all(row['kind'] == 'r' and row['owner'] == 'postgres' and row['rls'] is True and row['forced_rls'] is True for row in relations), 'Exact three non-owner ordinary forced-RLS specs tables required.')
    acls = manual['table_acls']
    unique_rows(acls, ('table', 'role'), {(table, role) for table in TABLE_COLUMNS for role in ROLES})
    for row in acls:
        for privilege in ('select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'):
            require(row[privilege] is (row['role'] == 'eps_specs_owner' and privilege == 'select'), 'Unexpected direct specs table privilege.')
    columns = manual['column_acls']
    unique_rows(columns, ('table', 'column', 'role'), {(table, column, role) for table, names in TABLE_COLUMNS.items() for column in names for role in ROLES})
    for row in columns:
        owner = row['role'] == 'eps_specs_owner'
        for privilege in ('select', 'insert', 'update', 'references'):
            allowed = (owner and (privilege == 'select' or privilege == 'insert' and row['column'] in INSERTS[row['table']]
                                 or privilege == 'update' and row['column'] in UPDATES[row['table']])
                       or row['role'] == 'eps_specs_initializer' and row['table'] == 'eps.specs' and row['column'] == 'workspace_id' and privilege == 'insert')
            require(row[privilege] is allowed, 'Specs working/source/identity column privilege differs.')
    roles = manual['roles']
    unique_rows(roles, ('name',), {('eps_specs_owner',), ('eps_specs_initializer',)})
    for role in roles:
        require(all(role[key] is False for key in ('login', 'inherit', 'superuser', 'bypass_rls', 'create_db', 'create_role', 'eps_create', 'public_create',
            'authenticated_member', 'api_owner_member', 'sensitive_authority', 'enqueue', 'claim', 'finish')) and role['eps_usage'] is True,
            'Specs role gained login/DDL/managed-data/key/queue authority or reverse membership.')
        owner = role['name'] == 'eps_specs_owner'
        require(role['auth_usage'] is owner and role['parents'] == ([{'name': 'authenticated', 'admin': False, 'inherit': True, 'set': False}] if owner else []),
                'Specs identity inheritance/initializer isolation differs.')
    support = manual['support_acls']
    unique_rows(support, ('table', 'role'), {(table, role) for table in SUPPORT_TABLES for role in ('eps_specs_owner', 'eps_specs_initializer')})
    for row in support:
        owner = row['role'] == 'eps_specs_owner'
        allowed = ({'select'} if row['table'].startswith('public.') else
                   {'select', 'insert'} if row['table'] == 'eps.idempotency_records' else
                   {'insert'} if row['table'] == 'eps.audit_events' else
                   {'select', 'insert', 'update', 'delete'} if row['table'].startswith('storage.') else set()) if owner else set()
        for privilege in ('select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'):
            require(row[privilege] is (privilege in allowed), 'Specs owner/initializer support-table authority differs.')
    workspace_columns = manual['workspace_column_acls']
    workspace_names = {row['column'] for row in workspace_columns}
    unique_rows(workspace_columns, ('column', 'role'), {(column, role) for column in workspace_names for role in ('eps_specs_owner', 'eps_specs_initializer')})
    require({'id', 'project_id', 'archived_at', 'row_version', 'draft_revision', 'has_unpublished_changes', 'updated_at'} <= workspace_names, 'Workspace ACL projection missing.')
    for row in workspace_columns:
        for privilege in ('select', 'insert', 'update', 'references'):
            allowed = row['role'] == 'eps_specs_owner' and (privilege == 'select' and row['column'] in {'id', 'project_id', 'archived_at', 'row_version', 'draft_revision'}
                or privilege == 'update' and row['column'] in {'row_version', 'draft_revision', 'has_unpublished_changes', 'updated_at'})
            require(row[privilege] is allowed, 'Workspace identity/branding/version column authority differs.')
    policies = manual['policies']
    unique_rows(policies, ('name',), {(name,) for name in POLICIES})
    expressions = [{key: policy[key] for key in ('name', 'using', 'check')} for policy in sorted(policies, key=lambda item: item['name'])]
    require(POLICY_EXPRESSIONS_HASH is not None and hashlib.sha256(json.dumps(expressions, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == POLICY_EXPRESSIONS_HASH,
            'Specs RLS expressions differ from the reviewed actual local catalog.')
    for policy in policies:
        restrictive = policy['name'].startswith('eps_specs_no_')
        require((policy['table'], policy['command']) == POLICIES[policy['name']] and policy['permissive'] is not restrictive
                and policy['roles'] == (['eps_specs_initializer'] if policy['name'] == 'specs_initialize_insert' else ['eps_specs_owner']), 'Specs policy target/roles/command differs.')
        if restrictive:
            require(policy['using'] == policy['check'] == 'false', 'Inherited Storage authority is not denied.')
    require(manual['triggers'] == [{'name': 'specs_initialize_workspace', 'table': 'eps.workspaces', 'enabled': 'O', 'type': 5,
        'function': 'eps.specs_initialize_workspace', 'arguments': '', 'when': None}], 'Exact AFTER INSERT row initializer trigger required.')
    require(manual['counts'] is not None, 'Specs count projection missing.')
    return 'applied'


def stage_seals(proof, reviewed, *, all_migrations=True):
    require(proof['reviewed_manifest_sha256'] == digest('development/local-db/reviewed.json'), 'Fresh proof manifest differs from the current eight-version review seal.')
    for stage in proof['stages']:
        entry = reviewed.get(stage['path'], {})
        require(stage['result'] in ('passed', 'applied', 'already_applied', 'expected_rejection')
                and stage['sha256'] == entry.get('sha256') == digest(stage['path']), 'Fresh proof stage/source seal differs.')
        if stage['result'] == 'expected_rejection':
            require(stage['path'] == 'tests/db/m02-specs-local-cleanup.sql' and stage.get('code') == 'SPECS_LOCAL_SOURCE_PRESERVATION_REQUIRED', 'Unexpected local proof rejection.')
    if all_migrations:
        require({stage['path'] for stage in proof['stages'] if stage['path'].startswith('supabase/migrations/')} == {'supabase/migrations/' + name for name in MIGRATIONS}, 'All eight migrations must be replayed in the fresh proof.')


def prerequisites():
    require(READBACK_HASH is not None and POLICY_EXPRESSIONS_HASH is not None and all(path and seal for path, seal in PROOFS.values())
            and all(SOURCE_SEALS.values()), 'Fresh eight-version proof/catalog/source seals are not configured; no CLI is permitted.')
    require(digest(PRIOR_HELPER) == PRIOR_HELPER_HASH and digest(PRIOR_SQL) == PRIOR_SQL_HASH, 'Historical seven-version helper/SQL changed.')
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked target differs; preserve state.')
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False, 'Reviewed migrations and disabled seeds required.')
    require(sorted(path.name for path in (ROOT / 'supabase/migrations').glob('*.sql')) == list(MIGRATIONS), 'Exact eight-file history required.')
    manifest = read_json('development/local-db/reviewed.json')
    entries = manifest['migrations'] + manifest['tests']
    require(len(manifest['migrations']) == 8 and len({entry['path'] for entry in entries}) == len(entries), 'Exact unique reviewed history required.')
    reviewed = {entry['path']: entry for entry in entries}
    for name, expected in MIGRATIONS.items():
        path = 'supabase/migrations/' + name
        entry = reviewed.get(path, {})
        require(digest(path) == expected == entry.get('sha256') and entry.get('reviewed_by') and entry.get('reviewed_at'), 'Migration source/review seal differs.')
    for path, expected in SOURCE_SEALS.items():
        require(digest(path) == expected, 'Fixed local proof harness changed.')
    require(digest(READBACK) == READBACK_HASH, 'Fixed metadata SQL changed.')
    proofs = {}
    for key, (path, expected) in PROOFS.items():
        require(digest(path) == expected, 'A prerequisite receipt changed.')
        proofs[key] = read_json(path)
        if key not in ('initial_backfill', 'local_contract'):
            require(proofs[key]['result'] == 'passed', 'A fresh prerequisite did not pass.')
    prior, full, replay, core, manual = (proofs[key] for key in ('prior_cloud', 'full_db', 'm01_replay', 'm02_local', 'manual_specs'))
    require(prior['target'] == TARGET and prior['action'] == 'readback' and prior['application_verified_by_readback'] is True
            and prior['readback']['versions'] == VERSIONS[:7] and base.validate_state(prior['readback']) == 'applied', 'Exact successful prior seven-version cloud readback required.')
    require(len(full['stages']) == 24 and full['cleanup']['result'] == full['logo_cleanup']['result'] == 'passed'
            and len(full['concurrency_pairs']) == 3 and all(pair['result'] == 'passed' and pair['distinct_database_backends'] and pair['overlapping_reviewed_transaction_windows'] for pair in full['concurrency_pairs']), 'Fresh eight-version full M01 suite/three races/both cleanups required.')
    require(replay['mode'] == 'fixed' and replay['migration_sha256'] == MIGRATIONS['20261028162702_m01_replay_scope_refresh.sql']
            and replay['harness_sha256'] == SOURCE_SEALS['tools/test-m01-replay-scope.mjs'] and replay['cloud_called'] is False
            and replay['service_credentials_used'] is False and len(replay['cases']) == 11 and replay['before'] == replay['after'] and replay['cleanup']['result'] == 'passed', 'Fresh fixed M01 replay-scope proof required.')
    require(all(case['exact_advisory_wait_observed'] is True and case['legitimate_replay_passed'] is True and case['denied_after_concurrent_revocation'] is True
                and isinstance(case['holder_pid'], int) and case['holder_pid'] != case['waiter_pid'] for case in replay['cases']), 'M01 actual waits/control/denials required.')
    require(core['cleanup'] == 'passed' and core['before'] == core['after'] and len(core['stages']) == 28 and core['before']['versions'] == VERSIONS
            and all(core['after'][key] == 0 for key in ('jobs', 'outbox', 'events')) and core['after']['fixture_present'] is False
            and core['after']['restricted_dispatcher'] is True and all(core['before'][key] == 'on' for key in ('fsync', 'synchronous_commit', 'full_page_writes')), 'Fresh eight-version queue/restart proof/restoration required.')
    require({pair['name'] for pair in core['concurrency']} == {'same-input-distinct-key-enqueue', 'two-job-skip-locked', 'revoked-cached-replay', 'same-event-single-lease', 'cancel-before-dispatch-finish', 'dispatch-finish-before-cancel'}
            and len(core['concurrency']) == 6 and all(pair['distinct_backends'] is True for pair in core['concurrency']), 'Six M02 actual-backend pairs required.')
    require(core['restart']['same_container'] is True and core['restart']['same_volume'] is True and core['restart']['system_identifier'] == core['environment']['system_identifier']
            and core['environment']['container'] == 'eps-presentation-canonical-pg17-local' and core['environment']['host_ip'] == '127.0.0.1' and core['environment']['host_port'] == '55433'
            and all(core[key] is False for key in ('cloud_called', 'provider_called', 'stage_callbacks_tested', 'dispatcher_daemon_tested')), 'Owned local graceful restart/fencing boundary required.')
    require(manual['cleanup'] == 'passed' and manual['all_business_counts_restored'] is True and manual['before']['versions'] == manual['after']['versions'] == VERSIONS
            and manual['before'] == manual['after'] and manual['expected_versions'] == VERSIONS
            and manual['harness_sha256'] == SOURCE_SEALS['tools/test-m02-specs-local.mjs'] and manual['first_migration_application'] is False
            and manual['backfill_tested_by_migration'] is False and all(manual[key] is False for key in ('cloud_called', 'provider_called', 'source_submission_tested', 'assignment_retirement_integrated', 'job_callbacks_tested')),
            'Successful existing-eight manual SQL proof/cleanup with honest initial-backfill boundary required.')
    pairs = manual['concurrency']
    require(len(pairs) == 4 and {pair['name'] for pair in pairs} == {'same-key-role-create', 'rename-versus-resize', 'revoked-cached-role-replay', 'cleanup-preserves-source-after-row-wait'}
            and all(pair['actual_blocker_sampled'] is True and isinstance(pair['holder_pid'], int) and pair['holder_pid'] != pair['waiter_pid'] for pair in pairs)
            and next(pair for pair in pairs if pair['name'] == 'revoked-cached-role-replay')['denied'] is True
            and next(pair for pair in pairs if pair['name'] == 'cleanup-preserves-source-after-row-wait')['cleanup_denied'] is True, 'Four sampled manual-specs concurrency/revocation/source-preservation pairs required.')
    require(any(stage['path'] == 'tests/db/m02-specs-local-column-acl.sql' and stage['result'] == 'passed' for stage in manual['stages']), 'Actual source/identity column-denial SQL test required.')
    for proof in (full, core, manual):
        stage_seals(proof, reviewed)
    # Retain the first real7→8 result separately: its later harness failure must
    # never become a successful full-suite claim, nor justify resetting history.
    first = proofs['initial_backfill']
    require(first['first_migration_application'] is True and first['migration8_result'] == 'applied' and first['before']['versions'] == VERSIONS[:7]
            and first['before']['specs_boundary'] is None and first['before']['specs_relations'] == 0 and first['after']['versions'] == VERSIONS
            and first['cleanup'] == 'passed' and first['all_business_counts_restored'] is True
            and any(stage['name'] == 'committed-pre-DDL-backfill-fixture' and stage['result'] == 'passed' for stage in first['stages']), 'Actual initial seven-to-eight application/pre-DDL fixture/restoration required.')
    require(first['result'] == 'failed' and first['error'] == 'Historical assertions may not control transactions.', 'Preserve the known initial harness failure, never relabel it a successful suite.')
    stage_seals(first, reviewed)
    for proof in (full, replay, core, manual):
        require(datetime.datetime.fromisoformat(proof['started_at']) >= datetime.datetime.fromisoformat(first['finished_at']), 'An eight-version gate predates the actual eighth migration application.')
    local = proofs['local_contract']
    require(local['readback_sha256'] == READBACK_HASH and local['cloud_called'] is False
            and local['system_identifier'] == core['environment']['system_identifier']
            and validate_state(local['readback']) == 'applied', 'Fresh fixed local full routine/ACL/RLS catalog proof required.')
    definitions()
    return {'migration_hashes': MIGRATIONS, 'proofs': {key: {'path': path, 'sha256': expected} for key, (path, expected) in PROOFS.items()},
            'source_seals': SOURCE_SEALS, 'readback_sha256': READBACK_HASH, 'policy_expressions_sha256': POLICY_EXPRESSIONS_HASH,
            'reviewed_manifest_sha256': digest('development/local-db/reviewed.json'), 'release_helper_sha256': digest('tools/release_manual_specs.py'),
            'historical_helper_sha256': PRIOR_HELPER_HASH, 'historical_sql_sha256': PRIOR_SQL_HASH}


def call(arguments):
    return subprocess.run(['npx.cmd', '--yes', 'supabase@2.122.0', *arguments, '--workdir', str(ROOT)], cwd=ROOT,
                          capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90)


def inspect():
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0, 'Fixed read-only inspection failed; raw diagnostics suppressed.')
    state = json.loads(result.stdout)['rows'][0]['manual_specs_release']
    for section in ('base', 'manual'):
        for function in state[section]['functions']:
            function['source_sha256'] = hashlib.sha256(function.pop('source').replace('\r\n', '\n').encode()).hexdigest()
    try:
        return validate_state(state), state
    except Blocked as error:
        error.snapshot = state
        raise


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def retain(receipt, phase):
    name = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + phase + '.json'
    with (EVIDENCE / name).open('x', encoding='utf-8') as file:
        json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
    return name


def compare_preserved(before, after):
    require(after['base']['counts'] == before['base']['counts'] and after['base']['queue_counts'] == before['base']['queue_counts'], 'Business/storage/queue counts changed; applied state is retained for reconciliation.')
    require(after['manual']['workspace_state_sha256'] == before['manual']['workspace_state_sha256']
            and after['manual']['archived_workspaces'] == before['manual']['archived_workspaces'], 'Workspace versions/branding/archive state changed; preserve and reconcile.')


def check_backfill(state):
    total = state['base']['counts']['workspaces']
    counts = state['manual']['counts']
    require(counts == {'specs': total, 'roles': 0, 'slots': 0, 'workspace_coverage': total,
                       'archived_workspace_coverage': state['manual']['archived_workspaces'], 'pristine_specs': total},
            'Initial empty-spec backfill/zero role-slot state differs; applied history retained, reconcile concurrent activity.')


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('dry-run', 'apply', 'readback'), 'Use dry-run, apply or readback with no target/file overrides.')
    inputs = prerequisites()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    receipt = {'observed_at': stamp(), 'target': TARGET, 'action': action, 'inputs': inputs, 'result': 'failed',
               'application_status': 'not_attempted', 'application_verified_by_readback': False, 'schema_cache_notified': False,
               'runtime_flag_changed': False, 'identity_provisioned': False, 'provider_or_service_provisioned': False,
               'seeds': False, 'vault_sync': False, 'raw_diagnostics_recorded': False, 'pipeline_acceptance': False}
    try:
        mode, before = inspect(); receipt.update(before_mode=mode, before=before)
        if mode == 'applied':
            receipt['application_status'] = 'verified_existing'
            receipt['application_verified_by_readback'] = True
        if action != 'readback':
            require(mode == 'pending', 'Release already applied/unknown; inspect instead of replaying a mutator.')
            if action == 'apply':
                prior = json.loads((EVIDENCE / 'dry-run.json').read_text(encoding='utf-8'))
                age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(prior['finished_at'])).total_seconds()
                require(prior['result'] == 'passed' and prior['inputs'] == inputs and prior['target'] == TARGET and prior['action'] == 'dry-run'
                        and prior['pending_migrations'] == PENDING and prior['readback'] == before and 0 <= age <= 3600,
                        'Exact successful fresh dry-run/current preflight match required.')
            receipt['application_status'] = 'unknown_until_readback' if action == 'apply' else 'not_attempted'
            receipt['attempt_receipt'] = retain(receipt, action + '-attempt')
            command = ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json']
            if action == 'dry-run':
                command.append('--dry-run')
            try:
                result = call(command)
                receipt['exit_code'] = result.returncode
                receipt['pending_migrations'] = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr)))
            except Exception:
                receipt['dispatch_response_unavailable'] = True
        after_mode, after = inspect()
        receipt.update(after_mode=after_mode, readback=after, application_verified_by_readback=after_mode == 'applied',
                       application_status={'pending': 'verified_pending', 'applied': 'verified_applied'}[after_mode])
        expected_mode = 'pending' if action == 'dry-run' else ('applied' if action == 'apply' else mode)
        require(after_mode == expected_mode, 'Observed unexpected application; preserve and reconcile before another mutator.')
        compare_preserved(before, after)
        if action != 'readback':
            require(receipt.get('exit_code') == 0 and receipt.get('pending_migrations') == PENDING, 'Dispatch response unconfirmed; readback state retained, do not blindly retry.')
            if action == 'apply':
                check_backfill(after)
        receipt['result'] = 'passed'
    except Blocked as error:
        receipt['reason'] = str(error)
        if error.snapshot is not None:
            receipt['unverified_readback'] = error.snapshot
        raise
    except Exception:
        receipt['reason'] = 'Fixed release could not be confirmed; inspect retained history, raw diagnostics suppressed.'
        raise
    finally:
        receipt['finished_at'] = stamp()
        retain(receipt, action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-run-pointer-' + uuid.uuid4().hex + '.tmp')
            with temporary.open('x', encoding='utf-8') as file:
                json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
            os.replace(temporary, EVIDENCE / 'dry-run.json')
        print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Blocked as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'raw_diagnostics_recorded': False})); sys.exit(1)
    except Exception:
        print(json.dumps({'result': 'blocked', 'reason': 'Fixed release could not be confirmed; raw diagnostics suppressed.', 'raw_diagnostics_recorded': False})); sys.exit(1)
