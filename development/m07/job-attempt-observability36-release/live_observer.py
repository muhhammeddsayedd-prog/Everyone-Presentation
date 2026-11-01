"""Exact post36 two-job audit; inert on import and disabled until root review.

Only whole-row hashes, identifiers and bounded closed processing metadata cross
the SQL boundary. No facts, text, payload objects, leases, credentials or usage.
"""
from pathlib import Path
import copy, datetime, hashlib, importlib.util, json, os, re, sys, uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ENTRY_ENABLED = False
TARGET = 'pyibofyctwnqpvktepse'
PROJECT = '6da14b82-8458-451f-aa21-28cb6c85bdc5'
WORKSPACE = '86936940-b48d-497d-b1ff-8e0da0913afa'
REVIEWED = '25a3c924-7b6c-48e3-88ce-c72e72b99c6d'
PROTECTED_JOB = 'b3f90268-147d-41d4-8875-2a6435df1496'
REAL_SHA = 'ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
FAILURE_SHA = '4c2b9f1cc0dab3e047e66f52ec09ba747feedb0dd0b82417bdac2b2f12a4fe70'
READER = 'development/m07/oauth-attempt-trace/inspect-attempt.py'
READER_SHA = '1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'
OPERATOR_QUERY = 'development/m07/job-attempt-observability36/operator-query.sql'
OPERATOR_QUERY_SHA = 'd4248a1fd71556c3837ba2c0c6a398f3328d4f09a704f3d261412392304f553c'
BASE = 'development/m07/workspace-summary35-release/release.py'
BASE_SHA = '33e64f3c9a3d2b5d394a6a7a1468968974ef05765802c03748db70ef3890510f'
SECURITY_PINS = {'tools/provision_logo_verifier.py': '660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
                 'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
                 'tools/release_logo.py': 'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4'}
PRIVATE = ROOT / '.local/m07-attempt36-live-audit/observer'
GROUPS = ('versions', 'slides', 'pins', 'raw', 'english', 'exports', 'assets', 'reviewed_media', 'reviewed_frames')
EXACT_GROUPS = ('versions', 'slides', 'pins', 'raw', 'english')
UUID = re.compile(r'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$')
SHA = re.compile(r'^[a-f0-9]{64}$')


def need(value):
    if not value:
        raise ValueError('ATTEMPT36_LIVE_OBSERVATION_UNCONFIRMED')


def sha(value): return hashlib.sha256(value).hexdigest()
def exact(value, keys): need(type(value) is dict and set(value) == set(keys))
def literal(value): return "'" + value.replace("'", "''") + "'"
def digest_sql(value): return "encode(sha256(convert_to((" + value + ")::text,'UTF8')),'hex')"


def load_module(name, file, expected):
    path = ROOT / file
    need(path.is_file() and not path.is_symlink() and path.resolve() == path and sha(path.read_bytes()) == expected)
    spec = importlib.util.spec_from_file_location('live36_' + name, path)
    module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def job_inputs(value):
    exact(value, ['success_job_id', 'failure_job_id'])
    need(all(type(v) is str and UUID.fullmatch(v) and v != PROTECTED_JOB for v in value.values()))
    need(value['success_job_id'] != value['failure_job_id'])
    return dict(value)


def public_reference(value):
    exact(value, ['path', 'sha256'])
    need(type(value['path']) is str and re.fullmatch(r'tracking/evidence/m07/job-attempt-observability36-release/[A-Za-z0-9_.-]+\.json', value['path'])
         and type(value['sha256']) is str and SHA.fullmatch(value['sha256']))
    path = ROOT / value['path'];need(path.is_file() and not path.is_symlink() and path.resolve() == path and path.stat().st_size <= 4 * 1024 * 1024)
    raw = path.read_bytes();need(sha(raw) == value['sha256'])
    return json.loads(raw)


def admitted(value):
    """Require actual normal apply AND separate installed readback; no guesses."""
    exact(value, ['apply', 'readback'])
    apply = public_reference(value['apply']);readback = public_reference(value['readback'])
    need(apply['action'] == 'apply' and apply['target'] == TARGET and apply['result'] == 'passed'
         and apply['normal_return_marker_observed'] is True and apply['independent_readback_verified'] is True
         and apply['first'] == apply['second'] and apply['claim_retained'] is True)
    need(readback['action'] == 'readback' and readback['target'] == TARGET and readback['result'] == 'observed_applied'
         and readback['static_schema_after'] == apply['static_schema_after']
         and readback['source_pins'] == apply['source_pins'])
    state_file = (HERE / 'state.py').relative_to(ROOT).as_posix()
    core = load_module('state', state_file, apply['source_pins'][state_file])
    # Joint release freeze includes this observer and its tests. A late flag or
    # code change cannot silently replace the source admitted by actual apply.
    pins = source_pins(core)
    need(all(apply['source_pins'].get(k) == v for k, v in pins.items()))
    expected = readback['static_schema_after']
    need(expected['history'][-1] == core.VERSION and len(expected['history']) == 36)
    core.module('schema_gate').check_schema_after(expected['schema'])
    return core, expected


def source_pins(core):
    pins = core.sources()
    for file, digest in [(READER, READER_SHA), (OPERATOR_QUERY, OPERATOR_QUERY_SHA)]:
        need(sha((ROOT / file).read_bytes()) == digest);pins[file] = digest
    for path in [Path(__file__), HERE / 'test_live_observer.py']:
        pins[path.relative_to(ROOT).as_posix()] = sha(path.read_bytes())
    return dict(sorted(pins.items()))


def grouped(table, alias, where, key, version='null'):
    query = "select " + key + " key,jsonb_build_object('key'," + key + ",'version_id'," + version + ",'sha256'," + digest_sql('to_jsonb(' + alias + ')') + ")row from eps." + table + ' ' + alias + ' where ' + where
    return "(select jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(row order by key)filter(where ordinal<=10000),'[]'::jsonb))from(select q.*,row_number()over(order by key)ordinal from(" + query + ')q)numbered)'


def attempt_query(job_id):
    need(UUID.fullmatch(job_id) and job_id != PROTECTED_JOB)
    raw = (ROOT / OPERATOR_QUERY).read_bytes();need(sha(raw) == OPERATOR_QUERY_SHA)
    sql = '\n'.join(line for line in raw.decode().splitlines() if not line.startswith('--')).strip().removesuffix(';')
    need(sql.count('$1::uuid') == 1 and sql.count('$2::integer') == 2 and sql.count('$3::integer') == 2)
    return sql.replace('$1::uuid', literal(job_id) + '::uuid').replace('$2::integer', '0').replace('$3::integer', '100')


def audit_job_sql(job_id):
    attempts = attempt_query(job_id)
    # Select exactly four identity/counter/reference fields groups, never error
    # messages/details, event receipts, payloads, input objects or usage objects.
    providers = """(select coalesce(jsonb_agg(jsonb_build_object('stage',p.stage,'attempt_id',p.attempt_id,
      'source_bound',p.payload->>'source_asset_id'=j.input_asset_id::text and p.input_hash=j.input_hash and exists(select 1 from eps.job_stage_attempts a where a.job_id=j.id and a.attempt_id=p.attempt_id and a.stage=p.stage),
      'openai_records',case when p.stage='transcribe_candidate'then(select count(*)from jsonb_array_elements(case when jsonb_typeof(p.payload->'provider_metadata')='array'then p.payload->'provider_metadata'else'[]'::jsonb end)m where m->>'provider'='openai')else case when p.payload#>>'{metadata,provider}'='openai'then 1 else 0 end end,
      'english_status',case when p.stage='extract_candidate'then p.payload#>>'{english_transcript,status}'end,
      'english_openai_records',case when p.stage='extract_candidate'then(select count(*)from jsonb_array_elements(case when jsonb_typeof(p.payload#>'{english_transcript,metadata}')='array'then p.payload#>'{english_transcript,metadata}'else'[]'::jsonb end)m where m->>'provider'='openai')else 0 end)order by p.stage),'[]'::jsonb)
      from eps.candidate_stage_payloads p where p.job_id=j.id and p.stage in('transcribe_candidate','extract_candidate','select_frames'))"""
    return "(select jsonb_build_object('job_id',j.id,'workspace_id',j.workspace_id,'kind',j.kind,'stage',j.stage,'status',j.status,'attempt',j.attempt,'input_hash',j.input_hash,'source_asset_id',j.input_asset_id,'source_sha256',coalesce(a.sha256,j.input->>'source_declared_sha256'),'source_bytes',a.size_bytes,'source_mime',a.mime_type,'target_candidate_id',j.input->>'target_candidate_id','created_at',j.created_at,'updated_at',j.updated_at,'error_code',case when j.error->>'code'='SOURCE_UNREADABLE'then'SOURCE_UNREADABLE'when j.error is null then null else'OTHER_ERROR'end,'error_retryable',case when jsonb_typeof(j.error->'retryable')='boolean'then(j.error->>'retryable')::boolean end,'trace_count',(select count(*)from eps.job_stage_attempts t where t.job_id=j.id),'attempts',(select coalesce(jsonb_agg(to_jsonb(t)order by(t.attempt->>'attempt')::integer),'[]'::jsonb)from(" + attempts + ")t),'provider_records'," + providers + ")from eps.jobs j join eps.workspaces w on w.id=j.workspace_id join eps.media_assets a on a.id=j.input_asset_id where j.id=" + literal(job_id) + "::uuid and j.id<>" + literal(PROTECTED_JOB) + "::uuid and j.kind='candidate_scan'and j.workspace_id=" + literal(WORKSPACE) + "::uuid and w.project_id=" + literal(PROJECT) + '::uuid)'


def observation_sql(core, inputs=None):
    if inputs is not None:inputs = job_inputs(inputs)
    b = core.base()
    # Project the FINAL core's normalized36 static contract in this snapshot.
    # No old35 catalogue exception: unrelated pre-baseline drift must fail too.
    static_pairs = [literal(key) + ",r.value->" + literal(key) for key in b.STATIC_KEYS]
    controls = 'jsonb_build_object(' + ','.join(literal(key) + ",r.value->'data'->" + literal(key) for key in b.CONTROL_TABLES) + ')'
    static_pairs += ["'control_plane'," + controls, "'schema',r.value->'schema'", "'delta_metadata',r.value->'delta_metadata'", "'claim_ports',r.value->'claim_ports'"]
    static_sql = "case when r.value->'cli_role_safe'='true'::jsonb then jsonb_build_object(" + ','.join(static_pairs) + ')end'
    ready = '(select id from ready)'
    groups = {
        'versions': grouped('presentation_versions', 'v', "v.status='ready'", 'v.id::text', 'v.id'),
        'slides': grouped('version_slides', 's', 's.version_id in' + ready, 's.id::text', 's.version_id'),
        'pins': grouped('presentation_version_assets', 'p', 'p.version_id in' + ready, "p.version_id::text||':'||p.asset_id::text", 'p.version_id'),
        'raw': grouped('presentation_video_transcripts', 't', 't.version_id in' + ready, "t.version_id::text||':'||t.video_asset_id::text", 't.version_id'),
        'english': grouped('presentation_video_english_transcripts', 't', 't.version_id in' + ready, "t.version_id::text||':'||t.video_asset_id::text", 't.version_id'),
        'exports': grouped('presentation_exports', 'e', "e.status='ready'and e.version_id in" + ready, 'e.id::text', 'e.version_id'),
        'assets': grouped('media_assets', 'a', 'a.id in(select id from pinned_assets)', 'a.id::text'),
        'reviewed_media': grouped('candidate_media', 'm', 'm.candidate_id=' + literal(REVIEWED) + '::uuid', 'm.id::text'),
        'reviewed_frames': grouped('candidate_media_frames', 'f', 'f.candidate_media_id in(select id from reviewed_media)', "f.candidate_media_id::text||':'||f.asset_id::text")}
    jobs = "'[]'::jsonb" if inputs is None else 'jsonb_build_array(' + ','.join(audit_job_sql(inputs[k]) for k in ['success_job_id', 'failure_job_id']) + ')'
    return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';\nwith readiness as(" + core.state_sql('after') + " as value),ready as(select id from eps.presentation_versions where status='ready'),reviewed_media as(select id,source_asset_id,transcript_asset_id,preview_asset_id from eps.candidate_media where candidate_id=" + literal(REVIEWED) + "::uuid),pinned_assets as(select asset_id id from eps.presentation_version_assets where version_id in(select id from ready)union select pdf_asset_id from eps.presentation_exports where status='ready'and version_id in(select id from ready)union select pdf_asset_id from eps.presentation_versions where id in(select id from ready)union select manifest_asset_id from eps.presentation_versions where id in(select id from ready)union select source_asset_id from reviewed_media union select transcript_asset_id from reviewed_media union select preview_asset_id from reviewed_media union select asset_id from eps.candidate_media_frames where candidate_media_id in(select id from reviewed_media)union select id from eps.media_assets where source_asset_id in(select source_asset_id from reviewed_media))\nselect jsonb_build_object('observed_at',clock_timestamp(),'database',current_database(),'operator',current_user,'session_user',session_user,'static'," + static_sql + ",'schema',r.value->'schema','claim_ports',r.value->'claim_ports','reviewed',(select jsonb_build_object('candidate_id',c.id,'row_sha256'," + digest_sql('to_jsonb(c)') + ",'is_reviewed',eps.cast_is_reviewed(c))from eps.candidates c where c.id=" + literal(REVIEWED) + "::uuid),'groups',jsonb_build_object(" + ','.join(literal(k) + ',' + v for k, v in groups.items()) + "),'jobs'," + jobs + ')as live_observation from readiness r;rollback;'


def parse_observation(payload, core, expected):
    rows = payload if type(payload) is list else payload.get('rows') if type(payload) is dict else None
    need(type(rows) is list and len(rows) == 1);exact(rows[0], ['live_observation'])
    value = rows[0]['live_observation']
    exact(value, ['observed_at', 'database', 'operator', 'session_user', 'static', 'schema', 'claim_ports', 'reviewed', 'groups', 'jobs'])
    need(value['database'] == value['operator'] == value['session_user'] == 'postgres')
    need(type(value['observed_at']) is str and datetime.datetime.fromisoformat(value['observed_at']).tzinfo is not None)
    core.module('schema_gate').check_schema_after(value['schema'])
    need(value['schema'] == expected['schema'] and value['claim_ports'] == expected['claim_ports'])
    static = value['static'];need(type(static) is dict and static['history'] == expected['history']
         and len(static['history']) == 36 and static['history'][-1] == core.VERSION
         and static['protected_m02_integrity'] is True and static['protected_m02'] == expected['protected_m02']
         and static['english'] == {'flags': ['1.0'], 'security': True})
    need(static == expected)
    reviewed = value['reviewed'];exact(reviewed, ['candidate_id', 'row_sha256', 'is_reviewed'])
    need(reviewed['candidate_id'] == REVIEWED and SHA.fullmatch(reviewed['row_sha256']) and reviewed['is_reviewed'] is True)
    exact(value['groups'], GROUPS)
    for name, group in value['groups'].items():
        exact(group, ['count', 'rows']);need(type(group['count']) is int and 0 <= group['count'] <= 10000 and type(group['rows']) is list and group['count'] == len(group['rows']))
        keys = set()
        for row in group['rows']:
            exact(row, ['key', 'version_id', 'sha256'])
            need(type(row['key']) is str and len(row['key'].split(':')) in (1, 2) and all(UUID.fullmatch(v) for v in row['key'].split(':'))
                 and row['key'] not in keys and type(row['sha256']) is str and SHA.fullmatch(row['sha256']))
            need(row['version_id'] is None or type(row['version_id']) is str and UUID.fullmatch(row['version_id']));keys.add(row['key'])
    need(value['groups']['versions']['count'] > 0 and value['groups']['reviewed_media']['count'] > 0 and type(value['jobs']) is list)
    return value


def preserve(before, after):
    need(before['static'] == after['static'] and before['schema'] == after['schema']
         and before['claim_ports'] == after['claim_ports'] and before['reviewed'] == after['reviewed'])
    counts = {};added = {}
    for key in GROUPS:
        old = {r['key']: r for r in before['groups'][key]['rows']};new = {r['key']: r for r in after['groups'][key]['rows']}
        need(all(new.get(k) == v for k, v in old.items()))
        if key in EXACT_GROUPS:need(new == old)
        counts[key] = len(old);added[key] = len(new) - len(old)
    return {'old_ready_reviewed_and_source_metadata_preserved': True, 'new_versions_created': False, 'old_counts': counts, 'new_rows_permitted': added}


def audit_jobs(value, baseline, inputs, trace_parser):
    inputs = job_inputs(inputs);need(len(value['jobs']) == 2)
    audit = []
    fields = ['job_id', 'workspace_id', 'kind', 'stage', 'status', 'attempt', 'input_hash', 'source_asset_id', 'source_sha256', 'source_bytes', 'source_mime', 'target_candidate_id', 'created_at', 'updated_at', 'error_code', 'error_retryable', 'trace_count', 'attempts', 'provider_records']
    for index, role in enumerate(['success', 'failure']):
        row = value['jobs'][index];exact(row, fields)
        need(row['job_id'] == inputs[role + '_job_id'] and row['workspace_id'] == WORKSPACE and row['kind'] == 'candidate_scan'
             and type(row['source_asset_id']) is str and UUID.fullmatch(row['source_asset_id']) and row['source_mime'] == 'video/mp4'
             and type(row['input_hash']) is str and SHA.fullmatch(row['input_hash']))
        need(datetime.datetime.fromisoformat(row['created_at']) >= datetime.datetime.fromisoformat(baseline['observed_at']))
        need(type(row['trace_count']) is int and 1 <= row['trace_count'] <= 100 and row['trace_count'] == len(row['attempts']) and row['attempt'] == row['trace_count'])
        stages = set();events = [];attempt_ids = set()
        for position, item in enumerate(row['attempts'], 1):
            exact(item, ['attempt', 'events', 'events_truncated']);attempt = trace_parser(item['attempt'])
            need(attempt['job_id'] == row['job_id'] and attempt['kind'] == 'candidate_scan' and attempt['input_hash'] == row['input_hash']
                 and attempt['attempt'] == position and attempt['attempt_id'] not in attempt_ids
                 and attempt['workflow_execution_ref_state'] == 'recorded'
                 and datetime.datetime.fromisoformat(attempt['claimed_at']) >= datetime.datetime.fromisoformat(baseline['observed_at']))
            attempt_ids.add(attempt['attempt_id']);stages.add(attempt['stage'])
            need(type(item['events_truncated']) is bool and type(item['events']) is list and len(item['events']) <= 100)
            sequences = []
            for event in item['events']:
                exact(event, ['sequence', 'event_type', 'created_at'])
                need(type(event['sequence']) is int and event['sequence'] > 0 and event['event_type'] in ['heartbeat', 'progress', 'succeeded', 'failed']
                     and type(event['created_at']) is str and datetime.datetime.fromisoformat(event['created_at']).tzinfo is not None)
                sequences.append(event['sequence']);events.append((attempt['stage'], event['event_type']))
            need(sequences == sorted(set(sequences)))
        if role == 'success':
            need(row['status'] == 'succeeded' and row['stage'] == 'apply_candidate' and row['target_candidate_id'] == REVIEWED
                 and row['source_bytes'] == 4316429 and row['source_sha256'] == REAL_SHA and row['error_code'] is None)
            need(stages == {'prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'})
            need(all((stage, 'succeeded') in events for stage in stages))
            need(type(row['provider_records']) is list and len(row['provider_records']) == 3)
            provider_stages = set()
            for provider in row['provider_records']:
                exact(provider, ['stage', 'attempt_id', 'source_bound', 'openai_records', 'english_status', 'english_openai_records'])
                need(provider['stage'] in ['transcribe_candidate', 'extract_candidate', 'select_frames'] and provider['stage'] not in provider_stages
                     and provider['attempt_id'] in attempt_ids and provider['source_bound'] is True
                     and type(provider['openai_records']) is int and 1 <= provider['openai_records'] <= 64)
                if provider['stage'] == 'extract_candidate':need(provider['english_status'] == 'available' and type(provider['english_openai_records']) is int and 1 <= provider['english_openai_records'] <= 64)
                else:need(provider['english_status'] is None and provider['english_openai_records'] == 0)
                provider_stages.add(provider['stage'])
        else:
            need(row['status'] == 'failed' and row['stage'] == 'prepare_candidate' and row['target_candidate_id'] is None
                 and row['source_bytes'] == 67 and row['source_sha256'] == FAILURE_SHA and row['error_code'] == 'SOURCE_UNREADABLE'
                 and row['error_retryable'] is False and stages == {'prepare_candidate'} and row['provider_records'] == []
                 and ('prepare_candidate', 'failed') in events)
        audit.append({'case': role, 'job_id': row['job_id'], 'status': row['status'], 'source_asset_id': row['source_asset_id'], 'attempts': row['attempts'],
                      'provider_records': row['provider_records'], 'usage_or_cost_inferred': False})
    return audit


def protected_write(guard, path, raw):
    with guard.create(path) as stream:
        guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)


def private_json(guard, path):
    guard.verify(path)
    with path.open('rb') as stream:
        guard.verify_open(stream);raw = stream.read(4 * 1024 * 1024 + 1);guard.verify_open(stream)
    need(len(raw) <= 4 * 1024 * 1024);return json.loads(raw)


def main():
    need(ENTRY_ENABLED and len(sys.argv) == 3 and sys.argv[1] in ('before', 'after'))
    action = sys.argv[1];input_path = Path(sys.argv[2]).resolve()
    # Bootstrap only frozen source before reading any protected input/baseline.
    for file, digest in SECURITY_PINS.items():need(sha((ROOT / file).read_bytes()) == digest)
    guard = load_module('frozen_base', BASE, BASE_SHA).security()
    need(input_path.parent == PRIVATE.parent and input_path.is_file() and not input_path.is_symlink() and input_path.stat().st_size <= 8192)
    inputs = private_json(guard, input_path)
    admission_value = inputs if action == 'before' else private_json(guard, PRIVATE / 'baseline.json')['admission']
    core, expected = admitted(admission_value);b = core.base();pins = source_pins(core)
    need(PRIVATE.parent.is_dir() and PRIVATE.parent.resolve() == PRIVATE.parent and not PRIVATE.parent.is_symlink())
    PRIVATE.mkdir(exist_ok=True);need(PRIVATE.resolve() == PRIVATE and not PRIVATE.is_symlink())
    guard.verify(input_path);need((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    baseline_path = PRIVATE / 'baseline.json'
    if action == 'after':
        before = private_json(guard, baseline_path);need(before['source_pins'] == pins);inputs = job_inputs(inputs)
    else:need(not baseline_path.exists());before = None
    sql = observation_sql(core, inputs if action == 'after' else None)
    need(sql.startswith('begin isolation level repeatable read read only;') and sql.endswith('rollback;'))
    need(not re.search(r'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b', sql))
    run = str(uuid.uuid4());protected_write(guard, PRIVATE / (action + '.claim.json'), json.dumps({'run_id': run, 'target': TARGET, 'sql_sha256': sha(sql.encode()), 'source_pins': pins, 'automatic_retry': False}).encode())
    path = PRIVATE / (run + '.sql');protected_write(guard, path, sql.encode())
    reader = load_module('reader', READER, READER_SHA)
    need(sha(path.read_bytes()) == sha(sql.encode()) and source_pins(core) == pins)
    command = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', TARGET, '--file', str(path), '--output-format', 'json', '--workdir', str(ROOT)]
    code, timeout, overflow, stdout, _stderr = reader.bounded(command, reader.environment())
    receipt = {'schema_version': '1.0', 'action': action, 'target': TARGET, 'run_id': run, 'result': 'unconfirmed', 'source_pins': pins,
               'automatic_retry': False, 'raw_output_or_private_payload_persisted': False, 'read_only': True, 'provider_or_media_fetch_performed': False}
    try:
        need(code == 0 and not timeout and not overflow and source_pins(core) == pins and sha(path.read_bytes()) == sha(sql.encode()))
        value = parse_observation(json.loads(stdout), core, expected)
        if action == 'before':
            need(value['jobs'] == []);protected_write(guard, baseline_path, json.dumps({'admission': admission_value, 'source_pins': pins, 'observation': value}, sort_keys=True).encode())
            receipt['baseline_sha256'] = sha(baseline_path.read_bytes());receipt['old_counts'] = {k: v['count'] for k, v in value['groups'].items()}
        else:
            receipt['preservation'] = preserve(before['observation'], value)
            # Typed trace parsing uses the same closed14-field contract without
            # importing a Node/provider process. The Python gate below is finite.
            receipt['jobs'] = audit_jobs(value, before['observation'], inputs, parse_trace)
            receipt['producer_browser_message_verified'] = False
        receipt['observed_at'] = value['observed_at'];receipt['result'] = 'passed'
    except Exception:
        receipt['safe_error_code'] = 'ATTEMPT36_LIVE_OBSERVATION_UNCONFIRMED'
    out = ROOT / 'tracking/evidence/m07/job-attempt-observability36-live-audit';out.mkdir(parents=True, exist_ok=True)
    file = out / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + action + '.json')
    with file.open('x', encoding='utf8', newline='\n') as stream:stream.write(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'result': receipt['result'], 'receipt': file.relative_to(ROOT).as_posix()}));need(receipt['result'] == 'passed')


def parse_trace(value):
    fields = ['schema_version', 'job_id', 'attempt_id', 'kind', 'stage', 'attempt', 'stage_attempt', 'dispatch_generation', 'correlation_id', 'input_hash', 'workflow_execution_id', 'workflow_execution_ref_state', 'claimed_at', 'job_row_version']
    exact(value, fields)
    need(value['schema_version'] == '1.0' and type(value['job_id']) is str and UUID.fullmatch(value['job_id'])
         and type(value['attempt_id']) is str and UUID.fullmatch(value['attempt_id']) and value['kind'] == 'candidate_scan'
         and value['stage'] in ['prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'])
    need(all(type(value[k]) is int and 1 <= value[k] <= 9007199254740991 for k in ['attempt', 'stage_attempt', 'dispatch_generation', 'job_row_version'])
         and value['attempt'] <= 2147483647 and value['stage_attempt'] <= value['attempt'])
    need(type(value['correlation_id']) is str and re.fullmatch(r'[A-Za-z0-9._:-]{1,128}', value['correlation_id']) and type(value['input_hash']) is str and SHA.fullmatch(value['input_hash']))
    state = value['workflow_execution_ref_state']
    need(type(state) is str and state in ['recorded', 'not_provided', 'invalid_omitted'])
    need(type(value['workflow_execution_id']) is str and re.fullmatch(r'[A-Za-z0-9._:-]{1,200}', value['workflow_execution_id']) if state == 'recorded' else value['workflow_execution_id'] is None)
    need(type(value['claimed_at']) is str and datetime.datetime.fromisoformat(value['claimed_at']).tzinfo is not None)
    return copy.deepcopy(value)


if __name__ == '__main__':
    try:main()
    except Exception:print('ATTEMPT36_LIVE_OBSERVATION_UNCONFIRMED');sys.exit(1)
