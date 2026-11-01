"""Default-off, two-row canonical test setup. Import/compiler perform source IO only."""
from pathlib import Path
import copy
import datetime
import hashlib
import importlib.util
import json
import os
import re
import sys
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
APPLY_ENABLED = True
PURPOSE = 'm07-specs-worker38-test-project'
NAME = 'Dummy Specs Worker Test'
STATE = 'development/m07/specs-diagnostic-worker38-adoption/state.py'
STATE_SHA = '690ae972ab0481026c139af5bcbf42017aa2fe63144f2981bd035dd139bbe8ff'
IDENTITY = 'tracking/evidence/m07/controlled-pilot/2026-10-30T23-53-44-160454Z-6b2ce6c6-dummy-project-apply.json'
IDENTITY_SHA = '520a53ef6cf19ff07bd4e310a96f5e8dac4dbe75a72c2a9063072c6ba36c1c13'
NATIVE = 'sha256:50082f72d4438653d4c831a1f9a360d61e64d19b3568ed1c2a2456d486f0d77c'
DAEMON = 'sha256:ce23af3ba163199c1e35f224f71a281ab450d7acfc0f4ab85b6044df5246431c'
WORKER_SOURCE = '037dc5d9b41605808d8f35907a71be4aba6fc6666a824ad7316d823334f35c38'
WRITES = ('public.projects', 'public.project_memberships')
PRIVATE = ROOT/'.local/m07-specs-worker38-test-project'


def need(value):
    if not value:
        raise ValueError('SPECS_TEST_PROJECT_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


need(sha((ROOT/STATE).read_bytes()) == STATE_SHA)
spec = importlib.util.spec_from_file_location('specs_project38_pure_state', ROOT/STATE)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
need(sha(s.load(ROOT/IDENTITY)) == IDENTITY_SHA)
identity = json.loads(s.load(ROOT/IDENTITY))
need(identity['result'] == 'passed' and identity['protected_before_after_equal'] is True
     and identity['independent_readback_equal'] is True)
ACTOR = identity['acting_user_id']
CLIENT = identity['after']['client']['id']
TEMPLATE = identity['after']['template']['id']
need(identity['after']['client']['name'] == 'Dummy Client'
     and identity['after']['template']['name'] == 'Dummy Reuse Test'
     and identity['after']['template_membership'] == {'project_id': TEMPLATE, 'principal_id': ACTOR,
                                                    'active': True, 'can_write': True})
TARGET = s.TARGET
HISTORY = tuple(s.s.baseline()['history']+[s.s.VERSION])


def identifier(value):
    need(type(value) is str and str(uuid.UUID(value)) == value and uuid.UUID(value).int != 0)
    return value


for resource in (ACTOR, CLIENT, TEMPLATE):
    identifier(resource)


def active_snapshot(value):
    s.check(value)
    need(value['state']['history'] == list(HISTORY) and len(HISTORY) == 38
         and all(row['public']['enabled'] is True for row in value['config'].values())
         and value['config']['frame_extraction_config']['public']['native_image_id'] == NATIVE
         and set(value['state']['data']) == set(s.s.b.TABLES) and len(value['state']['data']) == 74)
    for row in [value['state']['trace_rows'], *value['state']['data'].values()]:
        need(type(row) is dict and set(row) == {'count', 'sha256'} and type(row['count']) is int and row['count'] >= 0
             and type(row['sha256']) is str and re.fullmatch('[a-f0-9]{64}', row['sha256']))
    return value


def reference(ref):
    need(type(ref) is dict and set(ref) == {'path', 'sha256'} and type(ref['path']) is str
         and ref['path'].startswith('tracking/evidence/') and '..' not in Path(ref['path']).parts
         and re.fullmatch('[A-Za-z0-9._/-]+\\.json', ref['path'])
         and type(ref['sha256']) is str and re.fullmatch('[a-f0-9]{64}', ref['sha256']))
    raw = s.load(ROOT/ref['path'])
    need(sha(raw) == ref['sha256'])
    return json.loads(raw)


def admit(value, read_ref=reference):
    fixed = {'schema_version': '1.0', 'purpose': PURPOSE, 'target': TARGET, 'project_name': NAME,
             'actor_id': ACTOR, 'client_id': CLIENT, 'template_project_id': TEMPLATE, 'native_image_id': NATIVE}
    need(type(value) is dict and set(value) == set(fixed)|{'resume_receipt', 'worker_ready'}
         and all(value[key] == expected for key, expected in fixed.items())
         and type(value['resume_receipt']) is dict and type(value['worker_ready']) is dict)
    resumed, worker = read_ref(value['resume_receipt']), read_ref(value['worker_ready'])
    need(resumed['target'] == TARGET and resumed['phase'] == 'resume' and resumed['result'] == 'passed'
         and resumed['normal_return_marker_observed'] is True and resumed['independent_readback_verified'] is True
         and resumed['first'] == resumed['second'] and resumed['source_pins'][STATE] == STATE_SHA)
    active_snapshot(resumed['first'])
    expected = {'result': 'passed', 'project_id': s.PROJECT, 'team_id': s.TEAM, 'source_sha256': WORKER_SOURCE,
                'native_image_id': NATIVE, 'daemon_image_id': DAEMON, 'new_deployment_ready': True,
                'old_instances_absent': True, 'native_cleanup_confirmed': True, 'ready_alive_instances': 1,
                'memory_mib': 2048, 'region': 'dub1'}
    need(type(worker) is dict and all(type(worker[key]) is type(wanted) and worker[key] == wanted
                                    for key, wanted in expected.items()))
    return {'input': copy.deepcopy(value), 'resume': resumed}


def load_admission():
    return admit(json.loads(s.load(HERE/'admission.json')))


def validate(value, absent=False):
    fields = {'snapshot', 'actor_eligible', 'client_valid', 'template_valid', 'membership_valid', 'insert_surface_safe',
              'target_matches', 'target', 'target_memberships', 'target_workspace_count', 'counts'}
    need(type(value) is dict and set(value) == fields)
    active_snapshot(value['snapshot'])
    need(all(value[key] is True for key in ('actor_eligible', 'client_valid', 'template_valid', 'membership_valid', 'insert_surface_safe'))
         and type(value['target_matches']) is int and value['target_matches'] in (0, 1)
         and type(value['target_workspace_count']) is int and value['target_workspace_count'] == 0
         and type(value['counts']) is dict and set(value['counts']) == set(WRITES))
    for key in WRITES:
        need(type(value['counts'][key]) is int
             and value['counts'][key] == value['snapshot']['state']['data'][key]['count']+value['target_matches'])
    if value['target_matches'] == 0:
        need(value['target'] is None and value['target_memberships'] == [])
    else:
        row = value['target']
        need(type(row) is dict and set(row) == {'id', 'client_id', 'name', 'archived_at', 'row_version', 'created_at', 'updated_at'})
        identifier(row['id'])
        need(row['id'] != TEMPLATE and row['client_id'] == CLIENT and row['name'] == NAME and row['archived_at'] is None
             and type(row['row_version']) is int and row['row_version'] == 1
             and type(row['created_at']) is str and row['created_at'] == row['updated_at'])
        need(datetime.datetime.fromisoformat(row['created_at']).utcoffset() == datetime.timedelta(0))
        members = value['target_memberships']
        need(type(members) is list and len(members) == 1 and type(members[0]) is dict
             and type(members[0].get('active')) is bool and type(members[0].get('can_write')) is bool)
        need(value['target_memberships'] == [{'project_id': row['id'], 'principal_id': ACTOR, 'active': True,
                                             'can_write': True, 'created_at': row['created_at']}])
    need(not absent or value['target_matches'] == 0)
    return value


def preserved(before, after):
    validate(before, absent=True)
    validate(after)
    need(after['target_matches'] == 1)
    expected = copy.deepcopy(before)
    expected.update(target_matches=1, target=after['target'], target_memberships=after['target_memberships'],
                    counts={key: count+1 for key, count in before['counts'].items()})
    need(after == expected)
    return True


def old_rows(table, predicate):
    return "(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(h,E'\\n'order by h),''),'UTF8')),'hex'))from(select "+s.s.b.digest_sql('to_jsonb(r)')+' h from '+table+' r where '+predicate+')old_rows)'


def observation_sql():
    literal = s.s.b.literal
    normalized = "jsonb_set(jsonb_set(base.value,'{state,data,public.projects}',"+old_rows(WRITES[0], 'r.id is distinct from target.target_uuid')+"),'{state,data,public.project_memberships}',"+old_rows(WRITES[1], "not(r.project_id is not distinct from target.target_uuid and r.principal_id="+literal(ACTOR)+'::uuid)')+')'
    eligible = "exists(select 1 from auth.users where id="+literal(ACTOR)+"::uuid and email_confirmed_at is not null and last_sign_in_at is not null and not is_anonymous and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp()))and(select count(*)from public.app_capability_grants where principal_id="+literal(ACTOR)+"::uuid and active and capability in('projects.read','projects.write','workspaces.read','workspaces.write'))=4"
    membership = "exists(select 1 from public.project_memberships where project_id="+literal(TEMPLATE)+'::uuid and principal_id='+literal(ACTOR)+'::uuid and active and can_write)'
    safe = "not exists(select 1 from pg_trigger where tgrelid in('public.projects'::regclass,'public.project_memberships'::regclass)and not tgisinternal and(tgtype&4)<>0)and not exists(select 1 from pg_rewrite where ev_class in('public.projects'::regclass,'public.project_memberships'::regclass)and rulename<>'_RETURN')"
    return "select jsonb_build_object('snapshot',"+normalized+",'actor_eligible',"+eligible+",'membership_valid',"+membership+",'insert_surface_safe',"+safe+",'client_valid',exists(select 1 from public.clients where id="+literal(CLIENT)+"::uuid and name='Dummy Client'and archived_at is null),'template_valid',exists(select 1 from public.projects where id="+literal(TEMPLATE)+'::uuid and client_id='+literal(CLIENT)+"::uuid and name='Dummy Reuse Test'and archived_at is null),'target_matches',(select count(*)from public.projects where lower(btrim(name))=lower("+literal(NAME)+")),'target',(select to_jsonb(p)from public.projects p where id=target.target_uuid),'target_memberships',(select coalesce(jsonb_agg(to_jsonb(m)order by principal_id),'[]')from public.project_memberships m where project_id=target.target_uuid),'target_workspace_count',(select count(*)from eps.workspaces where project_id=target.target_uuid),'counts',jsonb_build_object('public.projects',(select count(*)from public.projects),'public.project_memberships',(select count(*)from public.project_memberships)))from("+s.snapshot_sql()+" as value)base cross join lateral(select case when count(*)=1 then(array_agg(id))[1]end target_uuid from public.projects where lower(btrim(name))=lower("+literal(NAME)+'))target'


def read_sql():
    return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='45s';select q.value as specs_worker38_project from("+observation_sql()+')q(value);rollback;'


def render_create(before, marker):
    validate(before, absent=True)
    identifier(marker)
    literal = s.s.b.literal
    tables = sorted(set(s.s.b.TABLES)-set(WRITES))
    tables = ','.join(table if table.startswith('public.') else 'eps.'+table for table in tables)
    sql = "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='3s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share mode;lock table public.projects,public.project_memberships in share row exclusive mode;lock table "+tables+",eps.job_stage_attempts in share mode;\n"
    sql += "do $specs_project$declare expected constant jsonb:="+literal(json.dumps(before, sort_keys=True, separators=(',', ':')))+"::jsonb;observation jsonb;created_uuid uuid;project_count integer;membership_count integer;begin\n"
    sql += 'perform id from auth.users where id='+literal(ACTOR)+"::uuid for share;\nobservation:=("+observation_sql()+");\nif observation is distinct from expected then raise exception'SPECS_TEST_PROJECT_PREFLIGHT_CHANGED';end if;\n"
    sql += 'insert into public.projects(client_id,name)values('+literal(CLIENT)+'::uuid,'+literal(NAME)+')returning id into created_uuid;get diagnostics project_count=row_count;\n'
    sql += 'insert into public.project_memberships(project_id,principal_id,active,can_write)select created_uuid,principal_id,active,can_write from public.project_memberships where project_id='+literal(TEMPLATE)+'::uuid and principal_id='+literal(ACTOR)+'::uuid and active and can_write;get diagnostics membership_count=row_count;\n'
    sql += 'observation:=('+observation_sql()+");\nif project_count<>1 or membership_count<>1 or observation->'target_matches'is distinct from'1'::jsonb or observation->'target'is distinct from jsonb_build_object('id',created_uuid,'client_id',"+literal(CLIENT)+"::uuid,'name',"+literal(NAME)+",'archived_at',null,'row_version',1,'created_at',transaction_timestamp(),'updated_at',transaction_timestamp())or observation->'target_memberships'is distinct from jsonb_build_array(jsonb_build_object('project_id',created_uuid,'principal_id',"+literal(ACTOR)+"::uuid,'active',true,'can_write',true,'created_at',transaction_timestamp()))or observation#>>'{counts,public.projects}'is distinct from((expected#>>'{counts,public.projects}')::bigint+1)::text or observation#>>'{counts,public.project_memberships}'is distinct from((expected#>>'{counts,public.project_memberships}')::bigint+1)::text or observation-'{target_matches,target,target_memberships,counts}'::text[]is distinct from expected-'{target_matches,target,target_memberships,counts}'::text[]then raise exception'SPECS_TEST_PROJECT_POSTCONDITION_FAILED';end if;\n"
    sql += "perform set_config('eps.specs_worker38_project',jsonb_build_object('phase','create','marker',"+literal(marker)+",'project_id',created_uuid,'inserted_projects',project_count,'inserted_memberships',membership_count)::text,true);end$specs_project$;select current_setting('eps.specs_worker38_project')::jsonb as specs_worker38_project;commit;"
    return sql


def sources():
    pins = s.s.projection_sources()
    fixed = {STATE: STATE_SHA, IDENTITY: IDENTITY_SHA}
    for path in ('supabase/.temp/project-ref', 'supabase/config.toml'):
        fixed[path] = identity['sources'][path]
    for path, expected in fixed.items():
        need(sha(s.load(ROOT/path)) == expected)
        pins[path] = expected
    for name in ('project.py', 'test_project.py', 'admission.template.json', 'README.md'):
        path = HERE/name
        pins[path.relative_to(ROOT).as_posix()] = sha(s.load(path))
    return dict(sorted(pins.items()))


def validate_reply(value, marker):
    need(type(value) is dict and set(value) == {'phase', 'marker', 'project_id', 'inserted_projects', 'inserted_memberships'}
         and value['phase'] == 'create' and value['marker'] == marker
         and type(value['inserted_projects']) is int and value['inserted_projects'] == 1
         and type(value['inserted_memberships']) is int and value['inserted_memberships'] == 1)
    identifier(value['project_id'])
    return copy.deepcopy(value)


def apply_once(io, plan):
    need(APPLY_ENABLED and set(plan) == {'before', 'pins', 'admission', 'marker'})
    before = validate(plan['before'], absent=True)
    identifier(plan['marker'])
    need(io.pins() == plan['pins'] and io.read() == before)
    claim = {**copy.deepcopy(plan), 'target': TARGET, 'purpose': PURPOSE, 'automatic_retry': False,
             'dispatch_may_have_occurred': True, 'sql_sha256': sha(render_create(before, plan['marker']).encode())}
    io.claim(claim)
    result = {'result': 'unconfirmed', 'claim_retained': True, 'automatic_retry': False,
              'normal_return_marker_observed': False, 'independent_readback_verified': False, 'marker': plan['marker']}
    reply = None
    try:
        need(io.pins() == plan['pins'] and io.read() == before)
        reply = validate_reply(io.dispatch(render_create(before, plan['marker'])), plan['marker'])
        result['update_reply_validated'] = True
        io.returned(claim, reply)
        result['normal_return_marker_observed'] = True
    except Exception:
        result['safe_error'] = 'SPECS_TEST_PROJECT_DISPATCH_UNCONFIRMED'
    try:
        need(io.pins() == plan['pins'])
        first, second = io.read(), io.read()
        need(first == second and preserved(before, first))
        result.update(first=first, second=second, independent_readback_verified=True)
        result['reply_matches_readbacks'] = reply is not None and reply['project_id'] == first['target']['id']
    except Exception:
        result['readback_error'] = 'SPECS_TEST_PROJECT_READBACK_UNCONFIRMED'
    if result['normal_return_marker_observed'] and result['independent_readback_verified'] and result.get('reply_matches_readbacks') is True:
        result['result'] = 'passed'
    return result


def private_write(path, value):
    PRIVATE.mkdir(parents=True, exist_ok=True)
    guard = s.s.b.security()
    with guard.create(path) as stream:
        stream.write((json.dumps(value, sort_keys=True)+'\n').encode())
        stream.flush(); os.fsync(stream.fileno()); guard.verify_open(stream)


def private_read(path):
    s.s.b.security().verify(path)
    return json.loads(s.load(path))


def query(sql):
    need(APPLY_ENABLED and (ROOT/'supabase/.temp/project-ref').read_text().strip() == TARGET
         and not any(os.environ.get(key) for key in ('SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD')))
    path = PRIVATE/(str(uuid.uuid4())+'.sql')
    PRIVATE.mkdir(parents=True, exist_ok=True)
    guard = s.s.b.security()
    with guard.create(path) as stream:
        stream.write(sql.encode()); stream.flush(); os.fsync(stream.fileno()); guard.verify_open(stream)
    reader = s.module('specs_project38_bounded_cli', ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
    command = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', TARGET,
               '--file', str(path), '--output-format', 'json', '--workdir', str(ROOT)]
    code, timeout, overflow, stdout, _stderr = reader.bounded(command, reader.environment())
    need(code == 0 and not timeout and not overflow)
    payload = json.loads(stdout)
    rows = payload if type(payload) is list else payload.get('rows') if type(payload) is dict else None
    need(type(rows) is list and len(rows) == 1 and type(rows[0]) is dict and set(rows[0]) == {'specs_worker38_project'})
    return rows[0]['specs_worker38_project']


class OperatorIO:
    def __init__(self, pins, admitted):
        self.sealed, self.admitted = pins, admitted
    def pins(self):
        need(load_admission() == self.admitted)
        return sources()
    def read(self):
        need(self.pins() == self.sealed)
        value = validate(query(read_sql()))
        need(s.s.static_schema(value['snapshot']['state']) == s.s.static_schema(self.admitted['resume']['first']['state']))
        return value
    def claim(self, value):
        private_write(PRIVATE/'create.claim.json', value)
    def returned(self, claim, reply):
        checked = validate_reply(reply, claim['marker'])
        need(private_read(PRIVATE/'create.claim.json') == claim)
        private_write(PRIVATE/'create.returned.json', {'claim_sha256': sha(s.load(PRIVATE/'create.claim.json')),
                                                     'normal_return_marker_observed': True, 'reply': checked})
    def dispatch(self, sql):
        need(self.pins() == self.sealed)
        claim = private_read(PRIVATE/'create.claim.json')
        need(claim['pins'] == self.sealed and claim['admission'] == self.admitted and claim['purpose'] == PURPOSE
             and claim['target'] == TARGET and claim['automatic_retry'] is False and claim['dispatch_may_have_occurred'] is True
             and claim['sql_sha256'] == sha(sql.encode()) and render_create(claim['before'], claim['marker']) == sql)
        return query(sql)


def main():
    need(APPLY_ENABLED and len(sys.argv) == 2 and sys.argv[1] in ('inspect', 'apply', 'readback'))
    admitted = load_admission()
    pins = sources()
    io = OperatorIO(pins, admitted)
    if sys.argv[1] == 'inspect':
        before = validate(io.read(), absent=True)
        plan = {'before': before, 'pins': pins, 'admission': admitted, 'marker': str(uuid.uuid4())}
        private_write(PRIVATE/'create.plan.json', plan)
        result = {'result': 'prepared', 'before': before, 'marker': plan['marker']}
    elif sys.argv[1] == 'apply':
        plan = private_read(PRIVATE/'create.plan.json')
        need(plan['admission'] == admitted)
        result = apply_once(io, plan)
    else:
        claim = private_read(PRIVATE/'create.claim.json')
        need(claim['purpose'] == PURPOSE and claim['target'] == TARGET and claim['pins'] == pins
             and claim['admission'] == admitted and claim['automatic_retry'] is False
             and claim['dispatch_may_have_occurred'] is True
             and claim['sql_sha256'] == sha(render_create(claim['before'], claim['marker']).encode()))
        returned = private_read(PRIVATE/'create.returned.json')
        need(type(returned) is dict and set(returned) == {'claim_sha256', 'normal_return_marker_observed', 'reply'}
             and returned['claim_sha256'] == sha(s.load(PRIVATE/'create.claim.json'))
             and returned['normal_return_marker_observed'] is True)
        reply = validate_reply(returned['reply'], claim['marker'])
        first, second = io.read(), io.read()
        need(first == second and preserved(claim['before'], first) and reply['project_id'] == first['target']['id'])
        result = {'result': 'passed', 'first': first, 'second': second, 'claim_retained': True,
                  'normal_return_marker_observed': True, 'independent_readback_verified': True}
    report = {'target': TARGET, 'purpose': PURPOSE, 'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'source_pins': pins, 'operator': 'postgres', 'scoped_membership_principal_id': ACTOR,
              'cloud_called': True, 'provider_management_called': False,
              'canonical_mutation_attempted': sys.argv[1] == 'apply', **result}
    folder = ROOT/'tracking/evidence/m07/specs-worker38-test-project'
    folder.mkdir(parents=True, exist_ok=True)
    path = folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+sys.argv[1]+'.json')
    with path.open('x', encoding='utf8', newline='\n') as stream:
        json.dump(report, stream, sort_keys=True, indent=2); stream.write('\n')
    return {'result': result['result'], 'receipt': path.relative_to(ROOT).as_posix()}


if __name__ == '__main__':
    try:
        result = main()
        print(json.dumps(result))
        if result['result'] not in ('prepared', 'passed'):
            sys.exit(1)
    except Exception:
        print('SPECS_TEST_PROJECT_UNCONFIRMED')
        sys.exit(1)
