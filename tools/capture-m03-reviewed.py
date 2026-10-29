"""One fixed read-only canonical factual-confirmation observer.

The protected owner answer key and scalar comparison digests stay private. No
import-time IO, grants, provider calls, factual writes or general SQL interface.
The result is about two supplied fields in this one source, not overall accuracy.
"""
import datetime
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import stat
import sys
import uuid

from release_foundation import ROOT, TARGET
from release_m04_casting import call as cli_call

JOB = '9a5ddb61-6a9a-4157-b6be-8653cf2eadef'
WORKSPACE = 'e470aefd-e0f7-480c-bf0d-170cb2cb7069'
PROJECT = 'bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'
CANDIDATE = '25a3c924-7b6c-48e3-88ce-c72e72b99c6d'
MEDIA = 'f5dff77f-092f-4777-9f56-3bbce4dee57c'
ASSET = '5f8a6d53-0da0-4064-aacf-aea6b9c47c81'
SOURCE_SHA = 'ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
SOURCE_SIZE = 4316429
SQL = 'tools/sql/m03-reviewed-readback.sql'
SQL_SHA = '221d54398b5d5bbfe575a3eb115b9bf7114700d6576b344681750c86e1546cc4'
INTENT = '.local/m03-close-checks/ground-truth.json'
BASELINE = 'tracking/evidence/m03/frame-vision-app/2026-10-29T19-12-45-337511Z-5acae3bc.json'
BASELINE_SHA = 'd0cacb93b838d32e5b141668cc0182ba7cbd5c5f066322b2f0b1436240a1d6f7'
SEALS = {
    'tools/release_m04_casting.py': 'ca855cda402566ebe8c6a78174a44dfcc9e878d7f0a320a6b7251a783ade2226',
    'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
    'tools/provision_logo_verifier.py': '660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
}


def sha(value): return hashlib.sha256(value).hexdigest()


def require(value):
    if not value: raise ValueError('M03_REVIEWED_READBACK_UNCONFIRMED')


def exact(value, keys): require(type(value) is dict and set(value) == set(keys))


def timestamp(value):
    require(type(value) is str and 1 <= len(value) <= 50)
    parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parsed.tzinfo is not None)
    return parsed


def identifier(value):
    require(type(value) is str and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', value))


def digest(value): require(type(value) is str and re.fullmatch('[a-f0-9]{64}', value))


def parse_ground_truth(value):
    exact(value, {'name', 'age'})
    name = value['name']
    require(type(name) is str and name == name.strip() and 1 <= len(name) <= 1000 and not any(ord(char) < 32 or ord(char) == 127 for char in name))
    require(type(value['age']) is int and 0 <= value['age'] <= 130)
    return value


def baseline_frames(baseline):
    return [{'asset_id': row['frame_asset_id'], 'sha256': row['sha256'], 'timestamp_ms': row['timestamp_ms'],
        'width': row['width'], 'height': row['height'], 'ready': row['status'] == 'ready',
        'source_and_job_match': row['source_and_job_match']} for row in baseline['state']['preparation']['sampled_frames']]


def validate(state, owner_key, baseline, versions):
    parse_ground_truth(owner_key)
    exact(state, {'observed_at', 'query_role', 'database', 'unrestricted_visibility', 'versions', 'job', 'source', 'candidate', 'audit', 'generation_capability', 'retained_profiles'})
    observed = timestamp(state['observed_at'])
    require(state['query_role'] == state['database'] == 'postgres' and state['unrestricted_visibility'] is True)
    require(type(versions) is list and len(versions) >= 21 and versions == sorted(set(versions)))
    require(all(type(version) is str and re.fullmatch('[0-9]{14}', version) for version in versions) and state['versions'] == versions)
    require(baseline['result'] == 'captured' and baseline['technical_vision_provider_success'] is True)
    before = baseline['state']; require(versions[:21] == before['versions'])
    job = state['job']
    exact(job, {'id', 'kind', 'workspace_id', 'project_id', 'status', 'stage', 'input_sha256', 'target_candidate_id'})
    require(job == {key: before['job'][key] for key in job})
    require(job['id'] == JOB and job['workspace_id'] == WORKSPACE and job['project_id'] == PROJECT and job['kind'] == 'candidate_scan'
        and job['status'] == 'succeeded' and job['stage'] == 'apply_candidate' and job['target_candidate_id'] is None)
    source = state['source']; exact(source, {'asset_id', 'sha256', 'size_bytes', 'status'})
    require(source == {'asset_id': ASSET, 'sha256': SOURCE_SHA, 'size_bytes': SOURCE_SIZE, 'status': 'ready'})
    candidate = state['candidate']
    exact(candidate, {'id', 'candidate_media_id', 'source_job_id', 'source_asset_id', 'source_kind', 'unarchived',
        'created_by_matches_requester', 'effective_reviewed', 'review_fingerprint_matches', 'facts_fingerprint',
        'reviewed_facts_fingerprint', 'reviewer_matches_requester', 'reviewed_at', 'row_version', 'name_manual_by_requester',
        'other_supplied_facts_unchanged', 'populated_source_fact_count', 'changed_supplied_field_paths',
        'extraction_matches_persisted_stage', 'selected_frame_asset_ids', 'frames', 'private_comparison'})
    require(candidate['id'] == CANDIDATE and candidate['candidate_media_id'] == MEDIA and candidate['source_job_id'] == JOB
        and candidate['source_asset_id'] == ASSET and candidate['source_kind'] == 'scan')
    for field in ('unarchived', 'created_by_matches_requester', 'effective_reviewed', 'review_fingerprint_matches', 'reviewer_matches_requester',
                  'name_manual_by_requester', 'other_supplied_facts_unchanged', 'extraction_matches_persisted_stage'):
        require(candidate[field] is True)
    digest(candidate['facts_fingerprint']); require(candidate['facts_fingerprint'] == candidate['reviewed_facts_fingerprint'])
    require(type(candidate['row_version']) is int and 3 <= candidate['row_version'] <= 9007199254740991)
    reviewed_at = timestamp(candidate['reviewed_at']); require(reviewed_at <= observed)
    require(type(candidate['populated_source_fact_count']) is int and candidate['populated_source_fact_count'] == 2
        and candidate['changed_supplied_field_paths'] == ['facts.name'])
    require(candidate['selected_frame_asset_ids'] == before['application']['selected_frame_asset_ids'] and candidate['frames'] == baseline_frames(baseline))
    private = candidate['private_comparison']
    exact(private, {'current_name_sha256', 'original_name_sha256', 'current_age_integer_sha256', 'original_age_integer_sha256'})
    for value in private.values(): digest(value)
    expected_name = sha(owner_key['name'].encode('utf8')); expected_age = sha(str(owner_key['age']).encode('ascii'))
    require(hmac.compare_digest(private['current_name_sha256'], expected_name)
        and not hmac.compare_digest(private['original_name_sha256'], expected_name)
        and hmac.compare_digest(private['current_age_integer_sha256'], expected_age)
        and hmac.compare_digest(private['original_age_integer_sha256'], expected_age))
    events = state['audit']; require(type(events) is list and 2 <= len(events) <= 32)
    updates = []; confirmations = []; event_order = []; event_ids = []
    for event in events:
        exact(event, {'id', 'action', 'at', 'actor_matches_requester'}); identifier(event['id'])
        require(event['actor_matches_requester'] is True and event['action'] in ('cast.update_candidate', 'cast.confirm_candidate_reviewed'))
        at = timestamp(event['at']); require(at <= observed); event_order.append((at, event['id'])); event_ids.append(event['id'])
        (updates if event['action'] == 'cast.update_candidate' else confirmations).append(event)
    require(event_order == sorted(event_order) and len(set(event_ids)) == len(event_ids) and updates and confirmations)
    require(timestamp(updates[-1]['at']) <= timestamp(confirmations[-1]['at']) <= reviewed_at)
    # Audit default now() is the transaction start; Reviewed uses clock_timestamp().
    require(0 <= (reviewed_at - timestamp(confirmations[-1]['at'])).total_seconds() <= 60)
    grant = state['generation_capability']
    exact(grant, {'capability', 'requester_derived_from_job', 'grant_count', 'active', 'state'})
    require(grant['capability'] == 'presentations.generate' and grant['requester_derived_from_job'] is True and type(grant['grant_count']) is int)
    require((grant['grant_count'] == 0 and grant['active'] is None and grant['state'] == 'absent')
        or (grant['grant_count'] == 1 and type(grant['active']) is bool and grant['state'] == ('active' if grant['active'] else 'inactive')))
    retained = state['retained_profiles']; expected = before['retained_profiles']
    require(type(retained) is list and len(retained) == len(expected) == 9 and retained == expected)
    require(sum(len(row['frames']) for row in retained) == 108)
    # Deliberate public allowlist. Never return state, private hashes or key bytes.
    return {'database_observed_at': state['observed_at'], 'job_id': JOB, 'workspace_id': WORKSPACE, 'project_id': PROJECT,
        'candidate_id': CANDIDATE, 'candidate_media_id': MEDIA, 'source_asset_id': ASSET, 'source_sha256': SOURCE_SHA,
        'source_job_and_persisted_extraction_bound': True, 'effective_reviewed': True,
        'reviewed_facts_fingerprint': candidate['facts_fingerprint'], 'reviewer_matches_original_job_requester': True,
        'reviewed_at': candidate['reviewed_at'], 'candidate_row_version': candidate['row_version'],
        'owner_key_name_matches': True, 'owner_key_age_matches': True, 'source_answer_key_fields': 2,
        'source_populated_fact_fields': 2, 'source_corrected_field_count': 1, 'source_corrected_field_paths': ['facts.name'],
        'other_supplied_facts_preserved': True, 'current_source_frames_and_selection_preserved': True,
        'ordinary_owner_update_audit_count': len(updates), 'ordinary_owner_confirm_audit_count': len(confirmations),
        'latest_update_audit_id': updates[-1]['id'], 'latest_confirm_audit_id': confirmations[-1]['id'],
        'ordinary_update_then_factual_confirmation': True, 'original_profiles_facts_frames_preserved': True,
        'original_profile_count': 9, 'original_frame_count': 108, 'generation_capability': dict(grant)}


def checked(relative):
    from provision_logo_verifier import safe_path
    file = ROOT / relative; safe_path(file); require(file.resolve() == file and not file.is_symlink())
    return file


def stable_read(relative, maximum, private=False):
    file = checked(relative); before = file.lstat()
    require(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= maximum)
    def identity(info):
        changed_or_created = info.st_birthtime_ns if os.name == 'nt' else info.st_ctime_ns
        return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, changed_or_created
    descriptor = os.open(file, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(descriptor, 'rb') as handle:
        if private:
            from provision_logo_verifier import WindowsPrivateFiles
            WindowsPrivateFiles().verify_open(handle)
        opened = os.fstat(handle.fileno()); require(identity(before) == identity(opened))
        data = handle.read(maximum + 1); require(len(data) == before.st_size and len(data) <= maximum)
        require(identity(before) == identity(os.fstat(handle.fileno())) == identity(file.lstat()))
    return data


def strict_json(data):
    def pairs(items):
        value = {}
        for key, item in items: require(key not in value); value[key] = item
        return value
    return json.loads(data.decode('utf8'), object_pairs_hook=pairs)


def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments; require(arguments == [])
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': TARGET, 'result': 'unconfirmed',
        'read_only': True, 'cloud_call_attempted': False, 'provider_called_by_observer': False,
        'business_facts_or_grants_mutated': False, 'browser_session_or_auth_export_used': False,
        'owner_key_and_scalar_hashes_published': False, 'private_cli_diagnostics_only': True, 'hosting_deferred': True,
        'scope': 'One owner-corrected Arabic source, its two populated supplied facts, factual confirmation, and nine original profiles.',
        'limitations': 'No general speech-quality rate, English/mixed-language proof, provider rerun, casting approval or presentation-generation execution.',
        'harness_sha256': sha(Path(__file__).read_bytes())}
    try:
        require(checked('supabase/.temp/project-ref').read_text().strip() == TARGET)
        seals = {SQL: SQL_SHA, BASELINE: BASELINE_SHA, **SEALS}
        for file, expected in seals.items(): require(sha(stable_read(file, 2 * 1024 * 1024)) == expected)
        baseline = strict_json(stable_read(BASELINE, 2 * 1024 * 1024))
        manifest_bytes = stable_read('development/local-db/reviewed.json', 1024 * 1024); manifest = strict_json(manifest_bytes)
        require(type(manifest.get('migrations')) is list and len(manifest['migrations']) >= 21)
        versions = []; migration_seals = {}
        for row in manifest['migrations']:
            require(type(row) is dict and type(row.get('path')) is str and re.fullmatch('supabase/migrations/[0-9]{14}_[a-z0-9_]+\\.sql', row['path'])
                and row.get('reviewed_by') and row.get('reviewed_at'))
            digest(row['sha256']); require(sha(stable_read(row['path'], 4 * 1024 * 1024)) == row['sha256'])
            migration_seals[row['path']] = row['sha256']; versions.append(Path(row['path']).name[:14])
        require(versions == sorted(set(versions)) and versions[:21] == baseline['state']['versions'])
        require(sorted(file.name for file in checked('supabase/migrations').glob('*.sql')) == [Path(row['path']).name for row in manifest['migrations']])
        intent_bytes = stable_read(INTENT, 8192, private=True); owner_key = parse_ground_truth(strict_json(intent_bytes))
        report['cloud_call_attempted'] = True
        result = cli_call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / SQL), '--output-format', 'json'])
        require(result.returncode == 0 and len(result.stdout.encode('utf8')) <= 2 * 1024 * 1024)
        payload = strict_json(result.stdout.encode('utf8'))
        require(type(payload) is dict and type(payload.get('rows')) is list and len(payload['rows']) == 1)
        exact(payload['rows'][0], {'m03_reviewed'})
        confirmation = validate(payload['rows'][0]['m03_reviewed'], owner_key, baseline, versions)
        for file, expected in {**seals, **migration_seals}.items(): require(sha(stable_read(file, 4 * 1024 * 1024)) == expected)
        require(stable_read(INTENT, 8192, private=True) == intent_bytes
            and stable_read('development/local-db/reviewed.json', 1024 * 1024) == manifest_bytes
            and sha(Path(__file__).read_bytes()) == report['harness_sha256'])
        report.update(result='captured', confirmation=confirmation, source_seals=seals, manifest_sha256=sha(manifest_bytes),
            migration_count=len(versions), source_and_answer_key_stable=True)
    except Exception:
        report['code'] = 'M03_REVIEWED_READBACK_UNCONFIRMED'
    directory = ROOT / 'tracking/evidence/m03/reviewed-source-readback'; directory.mkdir(parents=True, exist_ok=True)
    filename = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '.json'
    file = directory / filename
    with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps({'result': report['result'], 'receipt': file.relative_to(ROOT).as_posix(), 'read_only': True,
        'cloud_call_attempted': report['cloud_call_attempted'], 'effective_reviewed': report.get('confirmation', {}).get('effective_reviewed', False)}))
    return 0 if report['result'] == 'captured' else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception: sys.stderr.write('Fixed factual-confirmation observer stopped; private diagnostics suppressed.\n'); sys.exit(1)
