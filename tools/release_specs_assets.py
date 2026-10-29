"""Fixed10->12 disabled asset boundary release; no runtime/key/flag provisioning.

Whole application catalogue contracts avoid weakening historical validators or
pretending the live text pipeline is still empty/default-disabled. Missing proof
seals stop before any CLI call. Raw CLI diagnostics remain ignored/private.
"""
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tomllib
import uuid

import release_specs_pipeline as previous
from release_foundation import call as cli_call

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'
NAME = '20261029001520_m02_specs_assets.sql'
MIME_NAME = '20261029003941_m02_specs_mime_guard.sql'
MIME_HASH = '5a4439e9dd5262cae7e6f813997c4c9506db3eb74fe4ea95d2a352726effb549'
PENDING = [NAME, MIME_NAME]
MIGRATIONS = {**previous.MIGRATIONS, NAME: '9b35e8efdfc5184252ab4ecfe1a50861c8991dadf2b20544d481b51b3b7fb288', MIME_NAME: MIME_HASH}
VERSIONS = [name[:14] for name in MIGRATIONS]
READBACK = 'tools/sql/specs-assets-readback.sql'
READBACK_HASH = 'c5f49dc4efdd325fec7c608ec7c5bbb2f8d17e9c2beab92077eb540b1a39b192'
LEGACY_READBACK = 'development/m02/specs-assets-readback-e8a9796c.source.txt'
LEGACY_READBACK_HASH = 'e8a9796c0f21d103032008162f4c710e6cb4b8266c72d7b36ec409dca852178c'
MANIFEST_HASH = '41981d2fbf426976c1a6557bacffe0f38866ca579bcfe0b58247d72d3425eb31'
HISTORICAL = {**previous.HISTORICAL, 'tools/release_specs_pipeline.py': '6804c900be5837084e2e860c3cdd1d85461ad4af4e8169e716595cb02c232dc2',
              'tools/sql/specs-pipeline-readback.sql': previous.READBACK_HASH}
PROOFS = {
    'prior_cloud': ('tracking/evidence/cloud-specs-pipeline/2026-10-28T23-48-48-579255Z-06621ead-readback.json',
                    '24ca991887de11abef0807f1850c350bf582811acd2faf60dab7f84f2eb4d11d'),
    'local_before': ('tracking/evidence/cloud-specs-assets/2026-10-29T00-17-41-251Z-83963a89-local-contract.json', 'fa968436f99a5f2c1bccd4853a41766dfd5215a17caae8568dfa620eb8a16204'),
    'local_after': ('tracking/evidence/cloud-specs-assets/2026-10-29T00-52-22-886Z-22eae3f3-local-contract.json', 'c5d62768da607b79e2cdc4b0a0d0341a52161c9955415d60fb5a7bb7a8e1de61'),
    'persisted11': ('tracking/evidence/m02/specs-assets-local/2026-10-29T00-37-15-941Z-56af2fa3-rollback.json', '8d4c537b22f7c87f6f79f70538f196314c271c0e5e0b4e8d2afe7f13c02930e9'),
    'mime_guard': ('tracking/evidence/m02/specs-mime-guard-local/2026-10-29T00-49-46-564Z-69275363-rollback.json', '8494cf2338d0c515c008f6fdef6006e9fcdc913d5d9f7c1dbcc28de3bc69abb5'),
    'cloud_before': ('tracking/evidence/cloud-specs-assets/2026-10-29T00-49-21-760199+00-00-f27cbfac-cloud-before.json', 'efd4dec646894c62b490a18222805b79adf4392aaad6736e51b4368029f30380'),
}
SOURCE_SEALS = {
    "apps/web/lib/specs-config.ts": "fcda00b2e1fbb1726bd525171d39778080dd824e1455f2749eb998e299f9a7d2",
    "apps/web/lib/specs-original.ts": "cb2516240efdfa9a58aceed866e03693fb9e1f0c01e75e039bff045537fbd360",
    "apps/web/lib/studio.ts": "aa34139e453a02b1fbcef19ab749c882579a0285cd0529c6d429f6bcafef9a16",
    "apps/worker/src/docx.ts": "e7a89f5fb9fb48b852fd912e89301ee1f3bb05f79d4ac71ff408ef904cd7bbfc",
    "apps/worker/src/index.ts": "0d85a0a74aab44fa7146acf26abbe5b834feff5d78de3f689f4656a9eeacecd3",
    "apps/worker/src/n8n-orchestrator.ts": "2a69e656deb98cb2ddc1c0fc8bc8ddf236b7f6816985e15ee2635345842d5094",
    "apps/worker/src/pasted-text.ts": "3924006774b171ce939cd829bd47370a967e3ab6c1cdc100c9ded27e195361ad",
    "apps/worker/src/pdf.ts": "a410c584c30f2d21d92be906c67a854c8055474c2961d4b26a3f9d3f244bab0c",
    "apps/worker/src/prepare.ts": "dea867f4953b854cb2cb63ddc96d908299767df1effd8f4c31cffea93894aef9",
    "apps/worker/src/process.ts": "fc9cc0c32b65dc59d44715381258090d0619f8b079aac9d20767d99651417fb5",
    "apps/worker/src/runtime-main.ts": "d615f87059b5698d9426c6c66c6d53417bf620d7f1ee1cefb20f05d455bf7a95",
    "apps/worker/src/runtime-types.ts": "0e53971f31b07740fe24c127673be02c355d07cdf68352d79553a60cba9eea8c",
    "apps/worker/src/runtime.ts": "85633de9923e32d67e0888ae9a9294d51f7113d71f22a28ea60723f003c3e00e",
    "apps/worker/src/specs-assets.ts": "a086c6072df0d2e151304802bdc14c03a990f5e02d502acdd7c3a81ff843b353",
    "apps/worker/src/specs-executor.ts": "37fea8c1c647fe41eea8e93bb77026af4715a60d7c1e92aeed841de2ca4be23d",
    "apps/worker/src/storage.ts": "a1bb69770b1c469e4d7f27f63a09908fa6707e8385c042e06ab789aac7ecd783",
    "apps/worker/src/types.ts": "9e3a7397b9e3a9c33b10e9e1b83497ba1b764dc7f0b7a86cebeb11b01d4e986a",
    "development/m02/specs-assets-local-reader-c90e1d21.source.txt": "c90e1d21dfd83a2a8cd256218e95137a585c887f32c41c1995564f6ca58f7c2b",
    "development/m02/specs-assets-readback-e8a9796c.source.txt": "e8a9796c0f21d103032008162f4c710e6cb4b8266c72d7b36ec409dca852178c",
    "package-lock.json": "8dc70ce844f9e4a9916beea8d3f5eb46014e7f0de5c97cc7c0700b932ea8b2aa",
    "packages/central/src/client.ts": "a21f37b900d4ffee50cedfce244500c73e0afb24bf3786ad9cb1cc9f04887f74",
    "packages/central/src/config.ts": "d1eba8e3df2d6c644f4167b05caf6c02dd6560a9dc847d19960cd1178b73ab0c",
    "packages/central/src/errors.ts": "b77cefc58b208bc171446465e5280d3eef6ef88c8822b59b2dd57a5d09c11733",
    "packages/central/src/specs-receipt.ts": "d2a229dcbcab42afd94440b0281a29be1f50c88051108d2074be933d18fd6c52",
    "packages/central/src/specs-runtime-assets.ts": "3f3ceaee23d34f15060e7fe685c9bc3e44aa7d20be7e7916d83c99d9c428cc1c",
    "packages/central/src/specs-runtime-gateway.ts": "40c16a8b0d630dface941e258e92684b4c1b83af1ad74227c019edc25a041a71",
    "packages/central/src/specs-storage.ts": "89fa7278041efba49ea7235067e87b1f9f6f743e4c34b622e16f37043009d445",
    "packages/central/src/studio.ts": "735175b3a08e1ec0d4d343f38b8c97f976664777469dac9d4e5d6739443f53cc",
    "packages/integrations/src/errors.ts": "ac02c36b535879e439752eeda0518c2d84389a16af97175d004f8fa7c61d4da2",
    "packages/integrations/src/index.ts": "a52d825d872c59b403126850f101b42a11bc123a72ffd035461e1943aef01e35",
    "packages/integrations/src/job-errors.ts": "6c248fd9a586464fd69ee182823e6510b062ddedd19884c80478fa12f207cd7c",
    "packages/integrations/src/n8n-dispatch.ts": "96487a2a0d8769056c4fd3600478b0464e956c591af6b777b0cce92c91e057d7",
    "packages/integrations/src/openai-specs.ts": "6d5ae9440075c95adaf6b24954b30ccca63b5aac613e37b85a9e532ad58f44b4",
    "packages/integrations/src/specs-schema.ts": "389c36f8cca115f46390024170071851e8a974befdde19476771a20cbc63569c",
    "packages/integrations/src/specs-types.ts": "64b0d7ab2d5bc02d7a171d1a5ccb1c976a32889625394c727936c9e2b89011ee",
    "tests/db/m02-specs-assets-candidate.sql": "636c08a295d2fd21e8e904b6b0b9e13be6ac0fe87874e6718a8a13c834eb33b4",
    "tests/db/m02-specs-mime-guard.sql": "1a9d280b5bb0d6c8d6d1eeca6d57b3f69d6ff9604f782590f265945e70acadc6",
    "tests/operations/test_specs_assets_release.py": "c87dc07d01aed984990749bf7770d35fd1bb7a729c8653d69830d0c8b3207161",
    "tests/operations/worker-files-env.test.mjs": "1d34e542d30678a741f106050eeacd98ffc1aef0b08cd7ac320034d695ba13c4",
    "tests/operations/worker-runtime-env.test.mjs": "d7a4823a18f3085c812446e4a23ada7c7e04f4d947de6802c6801ffea0f568e1",
    "tests/worker/runtime.test.ts": "76105ccda83ecfaf085d9082ff688aca0f886eb5cf4db4901a775a793eae2485",
    "tests/worker/specs-assets.test.ts": "78d27865506441fb2bd05b6c6a890a030528945245f5dfec4091fa88d4436d9a",
    "tests/worker/specs-executor.test.ts": "7d505b53a1771bb788c31c39b1c0ace60b43fdc632e0715a454507960ad6c47e",
    "tools/lib/native-specs-local-transport.mjs": "57f2b5dca8ea6e04542366c93283a2bf22a63c8d918918a0b00561b3b31758d9",
    "tools/local-postgres.mjs": "49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de",
    "tools/private-specs-env.mjs": "a51a105d63999d188cea614ad4abf5db9173d88ee21fbf432c104bd774e3d82e",
    "tools/read-specs-assets-local-contract.mjs": "5646bbd7fc5d53c7bda72d86eec1b67a21226ec20e73075785ae0c1423387a01",
    "tools/start-specs-worker.mjs": "e560a40c4b55a799120d1ae4327dccb80fba6e03371579f57f087d018c1bdb04",
    "tools/test-m02-specs-assets-local.mjs": "09358a86cb6620a87c84a46464300270cfbe826abf51ec605582de42bcba6c11",
    "tools/test-m02-specs-mime-guard-local.mjs": "f4e9900bf961976e69d409e5ba71aeb6f8c19b8b9ecc83cd8561c82d53c6fbfb",
    "tools/worker-files-env.mjs": "4a484ac8db37403bcd0bfe33db9e89b7a8bc76521e75325efefe07e718a73466",
    "tools/worker-private-env.mjs": "ef935580876c9150b8150947c3796dd4760d1ad2910bc3bf322dd5015eea4d79",
    "tools/worker-runtime-env.mjs": "4c2d1e6f4b0f81d61dce0b9811e7affc0a0331e809c3fc1203056a2602b17b00"
}
CATALOG_HASHES = {'pending': 'd032794e24e15bb6b9eb0e4ed465c0b1cc3a23b766093139f01aa3a226b55ef8', 'applied': 'e24d5d7ea50071d03dbf68b390ddf0137755b01c82990ff732486c2c9140ba45'}
EVIDENCE = ROOT / 'tracking/evidence/cloud-specs-assets'
Blocked = previous.Blocked
require = previous.require
NEW_TABLES = {'eps.specs_asset_config', 'eps.specs_upload_sessions', 'eps.specs_verification_keys',
              'eps.specs_asset_grants', 'eps.specs_file_preparations'}
SETTINGS = sorted(['log_statement=none', 'log_parameter_max_length=0', 'log_parameter_max_length_on_error=0',
                   'log_min_error_statement=panic', 'log_min_duration_statement=-1', 'auto_explain.log_min_duration=-1',
                   'auto_explain.log_parameter_max_length=0', 'auto_explain.log_nested_statements=false', 'pg_stat_statements.track=none'])
RUNTIME_OPERATIONS = sorted(['eps.claim_job_outbox(integer)', 'eps.finish_job_outbox(uuid, text, boolean)',
                             'eps.claim_job_stage(jsonb)', 'eps.get_specs_stage_input(uuid, uuid, text)',
                             'eps.record_job_event(jsonb)', 'eps.recover_job_stages(integer)'])
NEW_ROLES = {'eps_specs_upload_owner', 'eps_specs_verify_owner', 'eps_specs_assets_owner', 'eps_specs_assets_executor'}


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def catalogue_hash(catalogue, mode):
    value = copy.deepcopy(catalogue)
    if mode == 'pending':
        # Historical local10 was observed before MAINTAIN/direct-ACL coverage
        # was added. Preserve that exact checkpoint; current cloud10 separately
        # checks the new metadata and is compared with the final local contract.
        for row in value.get('table_acls', []): row.pop('maintain', None)
        for section in ('functions', 'relations', 'columns'):
            for row in value.get(section, []): row.pop('explicit_acl', None)
    return canonical_hash(value)


def validate_security_metadata(catalogue):
    require(all(row['maintain'] is False for row in catalogue['table_acls']),
            'Unexpected direct application-role MAINTAIN authority.')
    owners = {row['name']: row['owner'] for row in catalogue['relations']}
    for section in ('functions', 'relations', 'columns'):
        for row in catalogue[section]:
            owner = owners[row['table']] if section == 'columns' else row['owner']
            for acl in row['explicit_acl']:
                require(set(acl) == {'grantor', 'grantee', 'privilege', 'grantable'} and type(acl['grantable']) is bool
                        and (not acl['grantable'] or acl['grantee'] == owner),
                        'Unexpected non-owner delegation/grant-option authority.')


def compare_direct_acls(before, after):
    """Preserve every old direct ACL except the reviewed additive11 grants."""
    added = {('functions', 'eps.input_uuid(text)'): {('eps_jobs_owner', 'EXECUTE')}}
    added[('relations', 'eps.media_assets')] = {(name, 'SELECT') for name in
                                              ('eps_specs_submit_owner', 'eps_specs_stage_owner', 'eps_specs_apply_owner')}
    added[('columns', ('eps.jobs', 'input_asset_id'))] = {('eps_specs_submit_owner', 'SELECT')}
    for table in ('eps.roles', 'eps.slots'):
        for column in ('archived_at', 'row_version', 'updated_at'):
            added[('columns', (table, column))] = {('eps_specs_apply_owner', 'UPDATE')}
    for section in ('functions', 'relations', 'columns'):
        key = lambda row: (row['table'], row['name']) if section == 'columns' else row['signature'] if section == 'functions' else row['name']
        expected = {key(row): row for row in after[section]}
        for row in before[section]:
            identity = key(row); require(identity in expected, 'A preexisting ACL object disappeared.')
            old = {canonical_hash(acl) for acl in row['explicit_acl']}
            current = expected[identity]['explicit_acl']
            allowed = added.get((section, identity), set())
            require(old.issubset({canonical_hash(acl) for acl in current}), 'A preexisting explicit grant or grantor was removed/changed.')
            for acl in current:
                require(canonical_hash(acl) in old or acl['grantee'] in NEW_ROLES
                        or (acl['grantee'], acl['privilege']) in allowed and not acl['grantable'],
                        'A direct ACL changed beyond the exact reviewed asset additions.')


def validate_runtime(runtime):
    require(isinstance(runtime, dict) and runtime['name'] == 'eps_specs_runtime' and runtime['login'] is True
            and all(runtime[key] is False for key in ('inherit', 'superuser', 'bypass_rls', 'create_db', 'create_role', 'replication', 'schema_create', 'table_authority'))
            and runtime['connection_limit'] == 4 and sorted(runtime['execute']) == RUNTIME_OPERATIONS,
            'The existing six-operation narrow runtime identity changed; no provisioning is authorized.')
    parents = runtime['parents']
    require(len(parents) == 2 and {row['name'] for row in parents} == {'eps_jobs_dispatcher', 'eps_jobs_executor'}
            and all(row == {'name': row['name'], 'grantor': 'postgres', 'admin': False, 'inherit': True, 'set': False} for row in parents),
            'Only the existing exact two runtime group memberships are allowed.')
    incoming = runtime['incoming']
    require(incoming in ([], [{'name': 'postgres', 'grantor': 'supabase_admin', 'admin': True, 'inherit': False, 'set': False}]),
            'Unexpected incoming runtime membership; preserve the boundary.')
    require(runtime['settings'] == [{'database': '0', 'values': SETTINGS, 'unknown_setting': False}],
            'Exact safe runtime role defaults required; no global/configuration changes are allowed.')
    try:
        expires = datetime.datetime.fromisoformat(runtime['valid_until'].replace('Z', '+00:00'))
    except (ValueError, TypeError, AttributeError):
        raise Blocked('The dedicated runtime expiry is unavailable.')
    require(expires > datetime.datetime.now(datetime.timezone.utc), 'The existing runtime credential has expired.')


def validate_state(state, *, local=False, legacy=False):
    require(state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['unrestricted_visibility'] is True,
            'Unrestricted fixed-target catalogue/count visibility is required.')
    require(state['versions'] in (VERSIONS[:-2], VERSIONS), 'Only exact10-before/12-after history is allowed; partial11 must be reconciled.')
    mode = 'applied' if state['versions'] == VERSIONS else 'pending'
    require(CATALOG_HASHES[mode] and catalogue_hash(state['catalog'], mode) == CATALOG_HASHES[mode],
            'Application catalogue/source/named arguments/owners/ACL/RLS/constraints differ from the sealed local contract.')
    if legacy:
        require(local and mode == 'pending', 'Historical ACL projection is local10-only, never a cloud bypass.')
    else:
        validate_security_metadata(state['catalog'])
    if local:
        require(state['runtime'] is None, 'Local catalogue proof must not adopt a runtime login.')
    else:
        validate_runtime(state['runtime'])
    require(state['release_additions_pristine'] is True,
            'The new excluded nullable fields are not NULL on preexisting rows; preserve them.')
    require(isinstance(state['source_config'], dict) and state['source_config']['id'] == 1,
            'The existing text pipeline singleton is missing; never reset it.')
    if mode == 'pending':
        require(state['assets'] is None and state['buckets'] == [] and not NEW_TABLES.intersection(state['counts']),
                'An asset namespace/bucket/configuration collision exists before11; do not adopt it.')
    else:
        require(state['assets'] == {'config': {'id': 1, 'uploads_enabled': False, 'capabilities_enabled': False, 'file_pipeline_enabled': False},
                                    'keys': 0, 'uploads': 0, 'grants': 0, 'preparations': 0},
                'The new asset boundary must remain disabled, without keys, sessions or service grants.')
        expected = [{'id': 'eps-specs-assets', 'name': 'eps-specs-assets', 'public': False, 'file_size_limit': 20971520,
                     'allowed_mime_types': ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']},
                    {'id': 'eps-specs-outputs', 'name': 'eps-specs-outputs', 'public': False, 'file_size_limit': 20971520, 'allowed_mime_types': ['application/json']}]
        require(state['buckets'] == expected and all(state['counts'].get(name) == (1 if name == 'eps.specs_asset_config' else 0) for name in NEW_TABLES),
                'Exact private buckets and empty/default-disabled new tables are required.')
    return mode


def comparable_counts(state):
    counts = {name: value for name, value in state['counts'].items() if name not in NEW_TABLES}
    counts['storage.buckets'] -= len(state['buckets'])
    return counts


def compare_preserved(before, after):
    require(comparable_counts(before) == comparable_counts(after) and before['data_sha256'] == after['data_sha256'],
            'Existing business/account/key/media/queue counts or original/source/order/branding/storage digests changed.')
    require(before['runtime'] == after['runtime'] and before['source_config'] == after['source_config']
            and before['release_additions_pristine'] is True and after['release_additions_pristine'] is True,
            'Existing runtime authority or text-pipeline configuration changed; no such action is authorized.')


def prerequisites():
    require(MIME_HASH and MANIFEST_HASH and all(CATALOG_HASHES.values()) and all(path and seal for path, seal in PROOFS.values()) and SOURCE_SEALS,
            'Final12 local/cloud-before catalogue, MIME guard, persisted assertions and source proof seals are missing; no CLI is allowed.')
    for path, seal in HISTORICAL.items():
        require(digest(path) == seal, 'An immutable historical release source changed.')
    for path, seal in SOURCE_SEALS.items():
        require(digest(path) == seal, 'A reviewed current implementation or harness source changed.')
    require(digest(READBACK) == READBACK_HASH and digest(LEGACY_READBACK) == LEGACY_READBACK_HASH
            and digest('development/local-db/reviewed.json') == MANIFEST_HASH,
            'Fixed readback/reviewed-manifest bytes changed.')
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked target differs.')
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False,
            'Migrations enabled and seeds disabled required.')
    require(sorted(path.name for path in (ROOT / 'supabase/migrations').glob('*.sql')) == list(MIGRATIONS), 'Exact twelve-file history required.')
    manifest = read_json('development/local-db/reviewed.json'); reviewed = {row['path']: row for row in manifest['migrations']}
    require(len(reviewed) == len(MIGRATIONS), 'Exact reviewed twelve-version manifest required.')
    for name, seal in MIGRATIONS.items():
        path = 'supabase/migrations/' + name
        require(digest(path) == seal == reviewed.get(path, {}).get('sha256') and reviewed[path].get('reviewed_by') and reviewed[path].get('reviewed_at'),
                'Migration source/reviewer seal differs.')
    proofs = {}
    for key, (path, seal) in PROOFS.items():
        require(digest(path) == seal, 'An immutable prerequisite receipt changed.'); proofs[key] = read_json(path)
    old = proofs['prior_cloud']
    require(old['result'] == 'passed' and old['target'] == TARGET and old['application_verified_by_readback'] is True
            and old['readback']['base']['versions'] == VERSIONS[:-2], 'Actual historical cloud10 reconciliation proof required.')
    for name, mode in (('local_before', 'pending'), ('local_after', 'applied')):
        contract = proofs[name]
        legacy = name == 'local_before' and contract['readback_sha256'] == LEGACY_READBACK_HASH
        require(contract['cloud_called'] is False and contract['read_only'] is True and (legacy or contract['readback_sha256'] == READBACK_HASH)
                and contract['system_identifier'] == '7701520506262638626' and validate_state(contract['readback'], local=True, legacy=legacy) == mode,
                'Exact pinned source-hashed local10/12 catalogue contracts required.')
    compare_preserved(proofs['local_before']['readback'], proofs['local_after']['readback'])
    local = proofs['persisted11']
    require(local['result'] == 'passed' and local['migration_sha256'] == MIGRATIONS[NAME] and local['before'] == local['after']
            and local['before']['versions'] == VERSIONS[:-1] and local['catalog_and_all_counts_restored'] is True and local['rollback_verified'] is True
            and local['transaction_completed_to_rollback'] is True and local['persisted_schema_assertions_tested'] is True
            and local['candidate_ddl_executed'] is False and local['source_submission_tested'] is True and local['machine_replacement_tested'] is True
            and local['retained_source_correction_tested'] is True and local['job_callbacks_tested'] is True
            and local['cloud_called'] is False and local['provider_called'] is False and local['storage_http_tested'] is False,
            'Actual persisted11 authorization/preparation/replacement/manual-preservation and full rollback proof required.')
    require(local['harness_sha256'] == SOURCE_SEALS['tools/test-m02-specs-assets-local.mjs']
            and local['hashes']['assertions'] == SOURCE_SEALS['tests/db/m02-specs-assets-candidate.sql'],
            'Persisted11 proof must bind the exact current reviewed harness/assertions.')
    mime = proofs['mime_guard']
    require(mime['result'] == 'passed' and mime['migration_sha256'] == MIME_HASH and mime['before'] == mime['after'] and mime['before']['versions'] == VERSIONS
            and mime['catalog_and_all_counts_restored'] is True and mime['rollback_verified'] is True
            and mime['transaction_completed_to_rollback'] is True and mime['mime_scalar_guard_tested'] is True
            and mime['candidate_ddl_executed'] is False and mime['cloud_called'] is False and mime['provider_called'] is False,
            'Actual persisted12 MIME scalar guard and direct authenticated RPC rejection proof required.')
    require(mime['harness_sha256'] == SOURCE_SEALS['tools/test-m02-specs-mime-guard-local.mjs']
            and mime['hashes']['assertions'] == SOURCE_SEALS['tests/db/m02-specs-mime-guard.sql'],
            'Persisted12 proof must bind the exact current reviewed harness/assertions.')
    baseline = proofs['cloud_before']
    require(baseline['result'] == 'passed' and baseline['target'] == TARGET and baseline['readback_sha256'] == READBACK_HASH and baseline['read_only'] is True
            and validate_state(baseline['readback']) == 'pending', 'Fresh source-hashed operational cloud10 contract required.')
    compare_direct_acls(baseline['readback']['catalog'], proofs['local_after']['readback']['catalog'])
    return {'migrations': MIGRATIONS, 'readback_sha256': READBACK_HASH, 'catalog_sha256': CATALOG_HASHES,
            'proofs': {key: {'path': path, 'sha256': seal} for key, (path, seal) in PROOFS.items()},
            'source_seals': SOURCE_SEALS, 'historical_seals': HISTORICAL, 'manifest_sha256': MANIFEST_HASH,
            'release_helper_sha256': digest('tools/release_specs_assets.py')}


def compact(state):
    return {key: value for key, value in state.items() if key != 'catalog'} | {'catalog_sha256': canonical_hash(state['catalog']),
             'catalogue_counts': {key: len(value) for key, value in state['catalog'].items()}}


def call(arguments):
    result = cli_call(arguments)
    private = ROOT / '.local/cloud-specs-assets-release'; private.mkdir(parents=True, exist_ok=True)
    label = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8]
    for stream in ('stdout', 'stderr'):
        with (private / (label + '.' + stream)).open('x', encoding='utf-8') as file:
            file.write(getattr(result, stream)); file.flush(); os.fsync(file.fileno())
    return result


def inspect():
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0, 'Fixed read-only asset-boundary inspection failed; raw diagnostics suppressed.')
    state = json.loads(result.stdout)['rows'][0]['specs_assets_release']
    try:
        return validate_state(state), state
    except Blocked as error:
        error.snapshot = compact(state); raise


def retain(receipt, phase):
    name = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + phase + '.json'
    with (EVIDENCE / name).open('x', encoding='utf-8') as file:
        json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
    return name


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('dry-run', 'apply', 'readback'), 'Use dry-run/apply/readback only; no target/file override.')
    inputs = prerequisites(); EVIDENCE.mkdir(parents=True, exist_ok=True)
    baseline = read_json(PROOFS['cloud_before'][0])['readback']
    receipt = {'observed_at': stamp(), 'target': TARGET, 'action': action, 'inputs': inputs, 'result': 'failed',
               'application_status': 'not_attempted', 'application_verified_by_readback': False, 'runtime_flag_changed': False,
               'identity_provisioned': False, 'verifier_key_provisioned': False, 'provider_called': False, 'n8n_changed': False,
               'seeds': False, 'vault_sync': False, 'raw_diagnostics_recorded': False, 'file_pipeline_acceptance': False}
    try:
        mode, before = inspect(); receipt.update(before_mode=mode, before=compact(before))
        if mode == 'applied':
            receipt.update(application_status='verified_existing', application_verified_by_readback=True)
        compare_preserved(baseline, before)
        if mode == 'pending':
            # The legacy local checkpoint cannot cover newly observed raw ACL
            # fields. Current cloud preflight must match the sealed full v2
            # baseline before any mutator, including nongrantable/grantor drift.
            require(canonical_hash(before['catalog']) == canonical_hash(baseline['catalog']),
                    'Current full catalogue/direct ACLs changed after the sealed cloud preflight.')
        if action != 'readback':
            require(mode == 'pending', 'Already applied/unknown: use readback; never repeat a mutator.')
            if action == 'apply':
                dry = read_json(str((EVIDENCE / 'dry-run.json').relative_to(ROOT)))
                age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result'] == 'passed' and dry['target'] == TARGET and dry['inputs'] == inputs and dry['action'] == 'dry-run'
                        and dry['readback'] == compact(before) and dry['pending_migrations'] == PENDING and 0 <= age <= 3600,
                        'Exact successful fresh dry-run/current preflight match required.')
            receipt['application_status'] = 'unknown_until_readback' if action == 'apply' else 'not_attempted'
            receipt['attempt_receipt'] = retain(receipt, action + '-attempt')
            command = ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json']
            if action == 'dry-run': command.append('--dry-run')
            try:
                result = call(command); receipt['exit_code'] = result.returncode
                receipt['pending_migrations'] = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr)))
            except Exception:
                receipt['dispatch_response_unavailable'] = True
        after_mode, after = inspect(); receipt.update(after_mode=after_mode, readback=compact(after),
            application_verified_by_readback=after_mode == 'applied', application_status='verified_' + after_mode)
        require(after_mode == ('pending' if action == 'dry-run' else 'applied' if action == 'apply' else mode),
                'Unexpected observed state; reconcile before another mutator.')
        compare_preserved(baseline, after); compare_preserved(before, after)
        compare_direct_acls(baseline['catalog'], after['catalog'])
        if action != 'readback':
            require(receipt.get('exit_code') == 0 and receipt.get('pending_migrations') == PENDING,
                    'Dispatch response unconfirmed; observed state retained, no blind retry.')
        receipt['result'] = 'passed'
    except Blocked as error:
        receipt['reason'] = str(error)
        if error.snapshot is not None:
            receipt['unverified_readback'] = error.snapshot
        raise
    except Exception:
        receipt['reason'] = 'Fixed asset release unconfirmed; raw diagnostics suppressed. Inspect durable history before retry.'; raise
    finally:
        receipt['finished_at'] = stamp(); retain(receipt, action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-run-pointer-' + uuid.uuid4().hex + '.tmp')
            with temporary.open('x', encoding='utf-8') as file:
                json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
            os.replace(temporary, EVIDENCE / 'dry-run.json')
        print(json.dumps({'result': receipt['result'], 'application_status': receipt['application_status'], 'target': TARGET,
                          'application_verified_by_readback': receipt['application_verified_by_readback'], 'raw_diagnostics_recorded': False}))


if __name__ == '__main__':
    try:
        main()
    except Blocked as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'raw_diagnostics_recorded': False})); sys.exit(1)
    except Exception:
        print(json.dumps({'result': 'blocked', 'reason': 'Fixed release unconfirmed; raw diagnostics suppressed.', 'raw_diagnostics_recorded': False})); sys.exit(1)
