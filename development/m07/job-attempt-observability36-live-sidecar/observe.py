"""One metadata-only after audit for the owner's actual2852 upload; inert on import.

The original before baseline and frozen observer remain unchanged. This separate
entry has a new permanent claim and admits actual rows without rewriting them.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, re, sys, uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ENTRY_ENABLED = True
ORIGINAL = 'development/m07/job-attempt-observability36-release/live_observer.py'
ORIGINAL_SHA = '6bac5273945f5ab9768ab51bfe0db0915224007feaeec581998010a42732ec84'
BEFORE_REFERENCE = 'tracking/evidence/m07/job-attempt-observability36-live-audit/2026-11-01T02-21-35-394018Z-before.json'
BEFORE_REFERENCE_SHA = 'ee4206b4146446a5ce71aeba29b755c8126e5c5a2131b82453b6eff2de9ff6dc'
BASELINE_SHA = '8142423e9e5b1ca3f9ade4f367af677a83a85d43211aa9fc6b3241e5523a5b1f'
SOURCE_REFERENCE = 'tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01-owner-selected2852-source-verification.json'
SOURCE_REFERENCE_SHA = '3bf46b5099536e1177646ba1828424044f60a37b302584ad00f72ebd01cad570'
SUCCESS_JOB = '6763e5fa-dc53-4956-8d9b-17bbc437609e'
SUCCESS_SHA = '865d9db7a5afe7183525c3111de29c5f5f4fb01d11b29d975b3b620a43c48aa1'
SUCCESS_BYTES = 5294727
SOURCE_VERIFIED_AT = '2026-11-01T02:34:29.014216+00:00'
WORKSPACE = '86936940-b48d-497d-b1ff-8e0da0913afa'
FAILURE_SHA = '4c2b9f1cc0dab3e047e66f52ec09ba747feedb0dd0b82417bdac2b2f12a4fe70'
PRIVATE = ROOT / '.local/m07-attempt36-live-audit/sidecar'


def need(value):
    if not value:raise ValueError('ATTEMPT36_SIDECAR_UNCONFIRMED')


def sha(raw):return hashlib.sha256(raw).hexdigest()


def original():
    path = ROOT / ORIGINAL
    need(path.is_file() and not path.is_symlink() and path.resolve() == path and path.stat().st_nlink == 1 and sha(path.read_bytes()) == ORIGINAL_SHA)
    spec = importlib.util.spec_from_file_location('attempt36_original_sidecar_reference', path)
    value = importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def fixed_json(relative, expected_sha):
    path = ROOT / relative
    need(path.is_file() and not path.is_symlink() and path.resolve() == path and path.stat().st_nlink == 1 and path.stat().st_size <= 4 * 1024 * 1024)
    raw = path.read_bytes();need(sha(raw) == expected_sha);return json.loads(raw)


def check_source(value):
    expected = {'schema_version': '1.0', 'recorded_at': SOURCE_VERIFIED_AT,
        'evidence_kind': 'authorized_owner_selected_source_verification_after_upload', 'source_file': 'IMG_2852.MP4',
        'bytes': SUCCESS_BYTES, 'sha256': SUCCESS_SHA, 'source_read_only': True, 'user_submitted_job_id': SUCCESS_JOB,
        'pre_upload_verification_claimed': False, 'resubmitted_by_agent': False, 'job_success_or_semantic_accuracy_claimed': False}
    need(type(value) is dict and set(value) == set(expected)
         and all(type(value[k]) is type(v) and value[k] == v for k, v in expected.items()));return value


def job_inputs(value, old):
    old.exact(value, ['failure_job_id'])
    return old.job_inputs({'success_job_id': SUCCESS_JOB, 'failure_job_id': value['failure_job_id']})


def load_baseline(guard, old):
    before = fixed_json(BEFORE_REFERENCE, BEFORE_REFERENCE_SHA)
    need(before['action'] == 'before' and before['target'] == old.TARGET and before['result'] == 'passed'
         and before['baseline_sha256'] == BASELINE_SHA)
    path = old.PRIVATE / 'baseline.json';guard.verify(path)
    with path.open('rb') as stream:
        guard.verify_open(stream);raw = stream.read(4 * 1024 * 1024 + 1);guard.verify_open(stream)
    need(len(raw) <= 4 * 1024 * 1024 and sha(raw) == BASELINE_SHA)
    baseline = json.loads(raw);old.exact(baseline, ['admission', 'source_pins', 'observation'])
    core, expected = old.admitted(baseline['admission']);pins = old.source_pins(core)
    need(baseline['source_pins'] == before['source_pins'] == pins)
    observed = old.parse_observation([{'live_observation': baseline['observation']}], core, expected)
    need(observed['observed_at'] == before['observed_at'] and observed['jobs'] == []
         and {k: v['count'] for k, v in observed['groups'].items()} == before['old_counts'])
    return core, expected, baseline, pins


def own_pins():
    pins = {}
    for name in ['observe.py', 'test_observe.py', 'PLAN_CHANGE.md']:
        path = HERE / name
        need(path.is_file() and not path.is_symlink() and path.resolve() == path and path.stat().st_nlink == 1)
        pins[path.relative_to(ROOT).as_posix()] = sha(path.read_bytes())
    return pins


def timestamp(value):
    need(type(value) is str)
    result = datetime.datetime.fromisoformat(value);need(result.tzinfo is not None);return result


def audit_cases(value, baseline, supplied, old):
    inputs = job_inputs(supplied, old);need(type(value['jobs']) is list and len(value['jobs']) == 2)
    fields = ['job_id', 'workspace_id', 'kind', 'stage', 'status', 'attempt', 'input_hash', 'source_asset_id', 'source_sha256', 'source_bytes', 'source_mime', 'target_candidate_id', 'created_at', 'updated_at', 'error_code', 'error_retryable', 'trace_count', 'attempts', 'provider_records']
    reports = []
    for index, role in enumerate(['success', 'failure']):
        row = value['jobs'][index];old.exact(row, fields)
        need(row['job_id'] == inputs[role + '_job_id'] and row['workspace_id'] == WORKSPACE and row['kind'] == 'candidate_scan'
             and type(row['source_asset_id']) is str and old.UUID.fullmatch(row['source_asset_id']) and row['source_mime'] == 'video/mp4'
             and type(row['input_hash']) is str and old.SHA.fullmatch(row['input_hash']))
        need(timestamp(row['created_at']) >= timestamp(baseline['observed_at']) and timestamp(row['updated_at']) >= timestamp(row['created_at']))
        need(type(row['trace_count']) is int and 1 <= row['trace_count'] <= 100 and type(row['attempt']) is int
             and type(row['attempts']) is list and row['trace_count'] == len(row['attempts']) == row['attempt'])
        stages = set();events = [];attempt_stages = {}
        for position, item in enumerate(row['attempts'], 1):
            old.exact(item, ['attempt', 'events', 'events_truncated']);attempt = old.parse_trace(item['attempt'])
            need(attempt['job_id'] == row['job_id'] and attempt['kind'] == 'candidate_scan' and attempt['input_hash'] == row['input_hash']
                 and attempt['attempt'] == position and attempt['attempt_id'] not in attempt_stages and attempt['workflow_execution_ref_state'] == 'recorded'
                 and timestamp(attempt['claimed_at']) >= timestamp(baseline['observed_at']))
            attempt_stages[attempt['attempt_id']] = attempt['stage'];stages.add(attempt['stage'])
            need(type(item['events_truncated']) is bool and type(item['events']) is list and len(item['events']) <= 100)
            sequences = []
            for event in item['events']:
                old.exact(event, ['sequence', 'event_type', 'created_at'])
                need(type(event['sequence']) is int and event['sequence'] > 0 and event['event_type'] in ['heartbeat', 'progress', 'succeeded', 'failed'])
                timestamp(event['created_at']);sequences.append(event['sequence']);events.append((attempt['stage'], event['event_type']))
            need(sequences == sorted(set(sequences)))
        if role == 'success':
            need(row['status'] == 'succeeded' and row['stage'] == 'apply_candidate' and row['target_candidate_id'] is None
                 and row['source_bytes'] == SUCCESS_BYTES and row['source_sha256'] == SUCCESS_SHA and row['error_code'] is None and row['error_retryable'] is None
                 and timestamp(row['created_at']) <= timestamp(SOURCE_VERIFIED_AT))
            need(stages == {'prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'}
                 and all((stage, 'succeeded') in events for stage in stages))
            need(type(row['provider_records']) is list and len(row['provider_records']) == 3)
            provider_stages = set()
            for provider in row['provider_records']:
                old.exact(provider, ['stage', 'attempt_id', 'source_bound', 'openai_records', 'english_status', 'english_openai_records'])
                need(provider['stage'] in ['transcribe_candidate', 'extract_candidate', 'select_frames'] and provider['stage'] not in provider_stages
                     and attempt_stages.get(provider['attempt_id']) == provider['stage'] and provider['source_bound'] is True
                     and type(provider['openai_records']) is int and 1 <= provider['openai_records'] <= 64)
                if provider['stage'] == 'extract_candidate':need(provider['english_status'] == 'available' and type(provider['english_openai_records']) is int and 1 <= provider['english_openai_records'] <= 64)
                else:need(provider['english_status'] is None and type(provider['english_openai_records']) is int and provider['english_openai_records'] == 0)
                provider_stages.add(provider['stage'])
        else:
            need(row['status'] == 'failed' and row['stage'] == 'prepare_candidate' and row['target_candidate_id'] is None
                 and row['source_bytes'] == 67 and row['source_sha256'] == FAILURE_SHA and row['error_code'] == 'SOURCE_UNREADABLE'
                 and row['error_retryable'] is False and stages == {'prepare_candidate'} and row['provider_records'] == [] and ('prepare_candidate', 'failed') in events)
        reports.append({'case': role, 'job_id': row['job_id'], 'source_asset_id': row['source_asset_id'], 'status': row['status'],
            'attempts': row['attempts'], 'provider_records': row['provider_records'], 'usage_or_cost_inferred': False})
    return reports


def main():
    need(ENTRY_ENABLED and len(sys.argv) == 2)
    old = original()
    for path, digest in old.SECURITY_PINS.items():need(sha((ROOT / path).read_bytes()) == digest)
    guard = old.load_module('frozen_base', old.BASE, old.BASE_SHA).security()
    input_path = Path(sys.argv[1]).resolve();need(input_path == PRIVATE / 'after-input.json' and input_path.is_file() and input_path.stat().st_size <= 8192)
    supplied = old.private_json(guard, input_path);inputs = job_inputs(supplied, old)
    check_source(fixed_json(SOURCE_REFERENCE, SOURCE_REFERENCE_SHA))
    core, expected, baseline, old_pins = load_baseline(guard, old)
    need(not (old.PRIVATE / 'after.claim.json').exists())
    need(PRIVATE.is_dir() and PRIVATE.resolve() == PRIVATE and not PRIVATE.is_symlink())
    need((ROOT / 'supabase/.temp/project-ref').read_text().strip() == old.TARGET)
    new_pins = own_pins();query = old.observation_sql(core, inputs)
    need(query.startswith('begin isolation level repeatable read read only;') and query.endswith('rollback;'))
    need(not re.search(r'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b', query))
    run = str(uuid.uuid4());claim = {'run_id': run, 'target': old.TARGET, 'baseline_sha256': BASELINE_SHA, 'source_pins': new_pins,
        'frozen_original_source_pins': old_pins, 'sql_sha256': sha(query.encode()), 'audited_job_ids': inputs, 'automatic_retry': False}
    old.protected_write(guard, PRIVATE / 'after.claim.json', json.dumps(claim, sort_keys=True).encode())
    query_path = PRIVATE / (run + '.sql');old.protected_write(guard, query_path, query.encode())
    reader = old.load_module('reader', old.READER, old.READER_SHA)
    need(own_pins() == new_pins and old.source_pins(core) == old_pins and sha(query_path.read_bytes()) == sha(query.encode()))
    command = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', old.TARGET, '--file', str(query_path), '--output-format', 'json', '--workdir', str(ROOT)]
    code, timeout, overflow, stdout, _stderr = reader.bounded(command, reader.environment())
    receipt = {'schema_version': '1.0', 'action': 'sidecar-after', 'run_id': run, 'target': old.TARGET, 'result': 'unconfirmed',
        'source_pins': new_pins, 'frozen_original_source_pins': old_pins, 'baseline_reference': {'path': BEFORE_REFERENCE, 'sha256': BEFORE_REFERENCE_SHA},
        'baseline_sha256': BASELINE_SHA, 'source_verification_reference': {'path': SOURCE_REFERENCE, 'sha256': SOURCE_REFERENCE_SHA},
        'source_verification_timing': 'post_upload', 'pre_upload_verification_claimed': False, 'planned2850_candidate_append_executed': False,
        'actual_success_submission': 'owner_submitted_untargeted2852_per_root_record', 'frozen_after_entry_used_by_sidecar': False,
        'automatic_retry': False, 'read_only': True, 'provider_or_media_fetch_performed': False, 'raw_output_or_private_payload_persisted': False}
    try:
        need(code == 0 and not timeout and not overflow and own_pins() == new_pins and old.source_pins(core) == old_pins and sha(query_path.read_bytes()) == sha(query.encode()))
        value = old.parse_observation(json.loads(stdout), core, expected)
        receipt['preservation'] = old.preserve(baseline['observation'], value)
        receipt['jobs'] = audit_cases(value, baseline['observation'], supplied, old)
        receipt['audited_job_count'] = len(receipt['jobs']);receipt['other_new_job_absence_checked'] = False
        receipt['producer_browser_message_verified'] = False;receipt['observed_at'] = value['observed_at'];receipt['result'] = 'passed'
    except Exception:receipt['safe_error_code'] = 'ATTEMPT36_SIDECAR_UNCONFIRMED'
    out = ROOT / 'tracking/evidence/m07/job-attempt-observability36-live-sidecar';out.mkdir(parents=True, exist_ok=True)
    path = out / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + run + '.json')
    with path.open('x', encoding='utf8', newline='\n') as stream:stream.write(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'result': receipt['result'], 'receipt': path.relative_to(ROOT).as_posix()}));need(receipt['result'] == 'passed')


if __name__ == '__main__':
    try:main()
    except Exception:print('ATTEMPT36_SIDECAR_UNCONFIRMED');sys.exit(1)
