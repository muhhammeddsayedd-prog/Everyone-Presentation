"""Finite OAuth metadata observation; import is inert and execution is disabled.

No credential discovery, token endpoint, Auth-user row or session identifier read.
The accepted principal is derived from pinned evidence and canonical identity code.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, stat, sys, uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ENTRY_ENABLED = True
TARGET = 'pyibofyctwnqpvktepse'
CLIENT = 'f2acafd5-d4b6-4176-b86c-067c57e45ecc'
REQUEST = '23c439a1-4869-4228-a3f1-d4a6004ef4f0'
WINDOW_START = '2026-10-31T13:40:13.706+00:00'
AUTH_COMMIT = '4eee58f296d9698a1c2c0ae14d7a0b379c7622d3'
ACCEPTANCE = 'tracking/evidence/m07/oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json'
HISTORICAL_HEALTH = 'tracking/evidence/m07/2026-10-30-provider-auth-metadata.json'
READBACK = 'tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-20-17-194633Z-readback.json'
READER = 'development/m07/oauth-attempt-trace/inspect-attempt.py'
BASE = 'development/m07/workspace-summary35-release/release.py'
PINS = {
    ACCEPTANCE: '579377062d37de3909fab7212eeec0fb50db87f1c3e7341f3bbe435a8c268ed9',
    HISTORICAL_HEALTH: 'a8ee3a1c7cb2c46e9a9a70496e0f156a00b7405a50a97bab2dedb99f6388541a',
    READBACK: 'fcfd3972cc660d8a9fdded4fc24db72ceac7c3bdafe1d461671d03baa6045b10',
    READER: '1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',
    BASE: '33e64f3c9a3d2b5d394a6a7a1468968974ef05765802c03748db70ef3890510f',
    'packages/central/src/client.ts': 'a21f37b900d4ffee50cedfce244500c73e0afb24bf3786ad9cb1cc9f04887f74',
    'apps/web/lib/mcp-auth.ts': '3ebbdb287898761342f49c75f6fef96c70c14b9019b745d4acc4dd82cb893a01',
    'apps/web/lib/mcp-central-session.ts': 'a773c07b5e2fc150f499ac59f7ade1d5fb3abcfec16f04f3c6d4f8bc0a7925ac',
    'supabase/migrations/20261028010943_m01_canonical_foundation.sql': '8a5f3ed7727a72051e630307d2daecab8c4a74054398a6425e73bd85e17568b9',
    'supabase/migrations/20261030111549_m07_settings_delegated_session.sql': '6531e8decab5496e212eb01575aca666cd9e03b0575f92dd66bd380760f84af4',
    'tools/provision_logo_verifier.py': '660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
    'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
    'tools/release_logo.py': 'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4',
}
UUID = re.compile(r'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$')
SESSION_KEYS = ['truncated', 'count', 'refreshed_count', 'refreshed_after_creation_count', 'missing_created_count',
                'first_created_at', 'last_created_at', 'last_refreshed_at']


def need(ok):
    if not ok: raise ValueError('OAUTH_REFRESH_METADATA_UNCONFIRMED')


def sha(raw): return hashlib.sha256(raw).hexdigest()
def exact(value, keys): need(type(value) is dict and set(value) == set(keys))
def literal(value): return "'" + value.replace("'", "''") + "'"


def timestamp(value):
    need(type(value) is str and len(value) <= 40)
    parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    need(parsed.tzinfo is not None and parsed.utcoffset() == datetime.timedelta())
    return parsed


def checked(file, expected):
    path = ROOT / file; info = path.lstat()
    need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not path.is_symlink()
         and not getattr(path, 'is_junction', lambda: False)() and path.resolve() == path and info.st_size <= 8 * 1024 * 1024)
    raw = path.read_bytes(); need(sha(raw) == expected); return raw


def source_pins():
    pins = dict(PINS)
    for file, digest in pins.items(): checked(file, digest)
    for name in ['observer.py', 'test_observer.py', 'README.md']:
        path = HERE / name; info = path.lstat()
        need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not path.is_symlink() and path.resolve() == path)
        pins[path.relative_to(ROOT).as_posix()] = sha(path.read_bytes())
    return pins


def identity_from_acceptance(value):
    need(value['status'] == 'passed' and value['request_principal_client_project_match'] is True)
    server = value['server_receipt']; owner = value['owner_result']
    need(server['request_id'] == owner['request_id'] == REQUEST and server['client_id'] == CLIENT
         and server['event'] == 'eps.mcp.project_read_succeeded' and server['entry_point'] == 'mcp_http'
         and server['operation'] == 'get_project' and server['success'] is True
         and type(server['principal_id']) is str and UUID.fullmatch(server['principal_id'])
         and timestamp(server['logged_at']) == timestamp(WINDOW_START))
    return {'client_id': CLIENT, 'auth_user_id': server['principal_id']}


def admission():
    for file, digest in PINS.items(): checked(file, digest)
    identity = identity_from_acceptance(json.loads(checked(ACCEPTANCE, PINS[ACCEPTANCE])))
    history = json.loads(checked(READBACK, PINS[READBACK]))
    need(history['target'] == TARGET and history['action'] == 'readback' and history['result'] == 'observed_applied')
    versions = history['static_schema_after']['history']
    need(type(versions) is list and len(versions) == len(set(versions)) == 36 and versions == sorted(versions)
         and all(type(v) is str and re.fullmatch(r'[0-9]{14}', v) for v in versions) and versions[-1] == '20261101012057')
    # Source-bound mapping: verified JWT sub -> session RPC principal=auth.uid()
    # -> auth.sessions.user_id, with canonical principal_id FK to auth.users(id).
    auth = checked('apps/web/lib/mcp-auth.ts', PINS['apps/web/lib/mcp-auth.ts']).decode()
    session_file = 'supabase/migrations/20261030111549_m07_settings_delegated_session.sql'
    session = checked(session_file, PINS[session_file]).decode()
    foundation_file = 'supabase/migrations/20261028010943_m01_canonical_foundation.sql'
    foundation = checked(foundation_file, PINS[foundation_file]).decode()
    need('principalId: payload.sub' in auth and 'principal uuid:=auth.uid()' in session
         and 'user_id=principal and oauth_client_id=cid' in session
         and 'principal_id uuid not null references auth.users(id)' in foundation)
    health = json.loads(checked(HISTORICAL_HEALTH, PINS[HISTORICAL_HEALTH]))
    need(health['target'] == TARGET and health['observed_at'] == '2026-10-30T11:12:13.825Z'
         and any(v['kind'] == 'health' and v['status'] == 200 and v['version'] == 'v2.197.0' for v in health['results']))
    return {**identity, 'history': versions}


def observation_sql(identity, end):
    exact(identity, ['client_id', 'auth_user_id', 'history'])
    need(identity['client_id'] == CLIENT and UUID.fullmatch(identity['auth_user_id']))
    end_time = timestamp(end); need(timestamp(WINDOW_START) <= end_time <= timestamp(WINDOW_START) + datetime.timedelta(days=7))
    need(type(identity['history']) is list and len(identity['history']) == 36
         and all(type(v) is str and re.fullmatch(r'[0-9]{14}', v) for v in identity['history']))
    expected = [('sessions', 'user_id', 'uuid', True), ('sessions', 'oauth_client_id', 'uuid', False),
        ('sessions', 'created_at', 'timestamp with time zone', False), ('sessions', 'refreshed_at', 'timestamp without time zone', False),
        ('audit_log_entries', 'payload', 'json', False), ('audit_log_entries', 'created_at', 'timestamp with time zone', False)]
    values = ','.join('(' + ', '.join([literal(t), literal(c), literal(typ), str(nn).lower()]) + ')' for t, c, typ, nn in expected)
    owner = literal(identity['auth_user_id']); client = literal(CLIENT)
    history = literal(json.dumps(identity['history'], separators=(',', ':'))) + '::jsonb'
    return f"""begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';set local statement_timeout='10s';
do $refresh36_gate$begin
 if current_database()<>'postgres' or current_user<>'postgres' or session_user<>'postgres'
 or current_setting('transaction_read_only')<>'on'
 or (select jsonb_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from {history}
 then raise exception'OAUTH_REFRESH_METADATA_GATE_DENIED';end if;
 if exists(select 1 from(values{values})e(tbl,col,typ,nn)
 left join pg_namespace n on n.nspname='auth' left join pg_class c on c.relnamespace=n.oid and c.relname=e.tbl
 left join pg_attribute a on a.attrelid=c.oid and a.attname=e.col and a.attnum>0 and not a.attisdropped
 left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where c.relkind is distinct from 'r' or a.attnum is null or format_type(a.atttypid,a.atttypmod)is distinct from e.typ
 or a.attnotnull is distinct from e.nn or d.oid is not null or a.attgenerated is distinct from '' or a.attidentity is distinct from '')
 then raise exception'OAUTH_REFRESH_METADATA_GATE_DENIED';end if;
 if (select count(*)from pg_constraint f where f.contype='f'and f.convalidated
 and f.conrelid=to_regclass('public.project_memberships')and f.confrelid=to_regclass('auth.users')
 and f.conkey=array[(select attnum from pg_attribute where attrelid=f.conrelid and attname='principal_id')]
 and f.confkey=array[(select attnum from pg_attribute where attrelid=f.confrelid and attname='id')])<>1
 then raise exception'OAUTH_REFRESH_METADATA_GATE_DENIED';end if;
 if (select count(*)from eps.mcp_oauth_resources where client_id={client}::uuid and resource='https://everyone-presentation-pilot.vercel.app/mcp'and enabled)<>1
 then raise exception'OAUTH_REFRESH_METADATA_GATE_DENIED';end if;
end$refresh36_gate$;
with sessions as materialized(
 select s.created_at,s.refreshed_at from auth.sessions s
 where s.user_id={owner}::uuid and s.oauth_client_id={client}::uuid
 order by s.refreshed_at desc nulls last,s.created_at desc nulls last limit 101
), audit as materialized(
 select a.payload->>'action' as action,a.created_at from auth.audit_log_entries a
 where a.payload->>'actor_id'={owner} and a.payload->>'action'in('login','token_refreshed')
 and a.created_at>={literal(WINDOW_START)}::timestamptz and a.created_at<={literal(end)}::timestamptz
 order by a.created_at desc limit 501
), audit_actions as(
 select action,count(a.action)as count,min(a.created_at)as first_at,max(a.created_at)as last_at
 from(values('login'),('token_refreshed'))expected(action)left join audit a using(action)group by action
)
select jsonb_build_object('observed_at',statement_timestamp(),'window_start',{literal(WINDOW_START)},'window_end',{literal(end)},'client_id',{client},
 'sessions',(select jsonb_build_object('truncated',count(*)>100,
 'count',case when count(*)<=100 then count(*)end,
 'refreshed_count',case when count(*)<=100 then count(*)filter(where refreshed_at is not null)end,
 'refreshed_after_creation_count',case when count(*)<=100 then count(*)filter(where (refreshed_at at time zone 'UTC')>created_at)end,
 'missing_created_count',case when count(*)<=100 then count(*)filter(where created_at is null)end,
 'first_created_at',case when count(*)<=100 then min(created_at)end,'last_created_at',case when count(*)<=100 then max(created_at)end,
 'last_refreshed_at',case when count(*)<=100 then max(refreshed_at)at time zone 'UTC'end)from sessions),
 'audit',jsonb_build_object('truncated',(select count(*)>500 from audit),
 'actions',case when(select count(*)from audit)<=500 then(select jsonb_agg(jsonb_build_object('action',action,'count',count,'first_at',first_at,'last_at',last_at)order by action)from audit_actions)end)
)as oauth_refresh_metadata;
rollback;"""


def parse(payload, end):
    rows = payload if type(payload) is list else payload.get('rows') if type(payload) is dict else None
    need(type(rows) is list and len(rows) == 1); exact(rows[0], ['oauth_refresh_metadata'])
    value = rows[0]['oauth_refresh_metadata']; exact(value, ['observed_at', 'window_start', 'window_end', 'client_id', 'sessions', 'audit'])
    observed = timestamp(value['observed_at']); last = timestamp(end)
    need(value['client_id'] == CLIENT and value['window_start'] == WINDOW_START and timestamp(value['window_end']) == last
         and timestamp(WINDOW_START) <= last <= observed <= last + datetime.timedelta(minutes=2))
    sessions = value['sessions']; exact(sessions, SESSION_KEYS); need(type(sessions['truncated']) is bool)
    if sessions['truncated']: need(all(sessions[k] is None for k in SESSION_KEYS if k != 'truncated'))
    else:
        for k in ['count', 'refreshed_count', 'refreshed_after_creation_count', 'missing_created_count']:
            need(type(sessions[k]) is int and 0 <= sessions[k] <= 100)
        need(sessions['refreshed_after_creation_count'] <= sessions['refreshed_count'] <= sessions['count']
             and sessions['missing_created_count'] <= sessions['count'])
        need(sessions['refreshed_after_creation_count'] <= sessions['count'] - sessions['missing_created_count'])
        for k in ['first_created_at', 'last_created_at', 'last_refreshed_at']:
            if sessions[k] is not None: need(timestamp(sessions[k]) <= observed)
        existing = sessions['count'] - sessions['missing_created_count'] > 0
        need((sessions['first_created_at'] is not None) == existing == (sessions['last_created_at'] is not None)
             and (sessions['last_refreshed_at'] is not None) == (sessions['refreshed_count'] > 0))
        if existing: need(timestamp(sessions['first_created_at']) <= timestamp(sessions['last_created_at']))
    audit = value['audit']; exact(audit, ['truncated', 'actions']); need(type(audit['truncated']) is bool)
    if audit['truncated']: need(audit['actions'] is None)
    else:
        need(type(audit['actions']) is list and len(audit['actions']) == 2)
        for action, expected in zip(audit['actions'], ['login', 'token_refreshed']):
            exact(action, ['action', 'count', 'first_at', 'last_at'])
            need(action['action'] == expected and type(action['count']) is int and 0 <= action['count'] <= 500)
            need((action['first_at'] is None) == (action['count'] == 0) == (action['last_at'] is None))
            if action['count']: need(timestamp(WINDOW_START) <= timestamp(action['first_at']) <= timestamp(action['last_at']) <= last)
        need(sum(a['count'] for a in audit['actions']) <= 500)
    incomplete = sessions['truncated'] or audit['truncated']
    return {**value, 'verdict': 'bounded_observation_incomplete' if incomplete else
        'source_founded_retained_client_refresh_timestamp' if sessions['refreshed_after_creation_count'] > 0 else 'not_observed_or_unavailable',
        'audit_client_binding': False, 'current_deployed_auth_version_verified': False, 'exact_current_process_proven': False,
        'token_received_or_stored_proven': False, 'rotation_proven': False, 'revocation_proven': False, 'mcp_use_proven': False}


def module(file):
    checked(file, PINS[file]); spec = importlib.util.spec_from_file_location('refresh36_' + Path(file).stem, ROOT / file)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value); return value


def main():
    need(ENTRY_ENABLED and len(sys.argv) == 1)
    identity = admission(); pins = source_pins()
    need((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    end = datetime.datetime.now(datetime.timezone.utc).isoformat(); sql = observation_sql(identity, end)
    guard = module(BASE).security()
    private = ROOT / '.local/m07-oauth-refresh-metadata36'
    private.mkdir(exist_ok=True); need(private.resolve() == private and not private.is_symlink() and not private.is_junction())
    run = str(uuid.uuid4()); query = private / (run + '.sql')
    with guard.create(query) as stream:
        guard.verify_open(stream); stream.write(sql.encode()); stream.flush(); os.fsync(stream.fileno()); guard.verify_open(stream)
    reader = module(READER)
    need(source_pins() == pins); guard.verify(query); need(sha(query.read_bytes()) == sha(sql.encode()))
    command = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', TARGET,
               '--file', str(query), '--output-format', 'json', '--workdir', str(ROOT)]
    code, timeout, overflow, stdout, _stderr = reader.bounded(command, reader.environment())
    receipt = {'schema_version': '1.0', 'kind': 'actual_readonly_oauth_refresh_metadata', 'target': TARGET, 'run_id': run,
        'result': 'unconfirmed', 'source_pins': pins, 'sql_sha256': sha(sql.encode()), 'read_only_rollback': True,
        'operator_automatic_retry': False, 'cli_internal_retry_policy_verified': False,
        'raw_cli_or_auth_rows_persisted': False, 'auth_mutation': False,
        'direct_credential_or_token_store_read': False, 'normal_supabase_cli_authentication_used': True,
        'token_endpoint_called': False, 'source_auth_commit': AUTH_COMMIT,
        'historical_auth_version': 'v2.197.0', 'historical_auth_observed_at': '2026-10-30T11:12:13.825Z',
        'current_deployed_auth_version_verified': False, 'metadata': None}
    try:
        need(code == 0 and not timeout and not overflow and source_pins() == pins)
        guard.verify(query); need(sha(query.read_bytes()) == sha(sql.encode()))
        receipt['metadata'] = parse(json.loads(stdout), end); receipt['result'] = 'observed_limited_metadata'
    except Exception: receipt['safe_error_code'] = 'OAUTH_REFRESH_METADATA_UNCONFIRMED'
    out = ROOT / 'tracking/evidence/m07/oauth-refresh-metadata36'; out.mkdir(parents=True, exist_ok=True)
    path = out / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + run + '.json')
    with path.open('x', encoding='utf8', newline='\n') as stream: stream.write(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'result': receipt['result'], 'receipt': path.relative_to(ROOT).as_posix()}))
    need(receipt['result'] == 'observed_limited_metadata')


if __name__ == '__main__':
    try: main()
    except Exception: print('OAUTH_REFRESH_METADATA_UNCONFIRMED'); sys.exit(1)
