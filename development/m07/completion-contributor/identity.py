"""Narrow, read-only identity discovery through the existing normal CLI login.

Emails arrive on stdin only. Raw CLI output stays in bounded RAM; SQL and the
validated safe result live only in a fresh ACL-protected ignored directory.
"""
from pathlib import Path
import datetime as dt
import importlib.util
import json
import os
import re
import subprocess
import sys
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TARGET = 'pyibofyctwnqpvktepse'
PROJECT = '6da14b82-8458-451f-aa21-28cb6c85bdc5'
PROJECT_NAME = 'Live Testing Project'
CAPABILITIES = ('projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.upload')
ALL_CAPABILITIES = CAPABILITIES + ('projects.write', 'cast.write', 'cast.review', 'presentations.generate', 'review_links.manage', 'settings.manage', 'operations.read', 'operations.retry')
spec = importlib.util.spec_from_file_location('contributor_normal_reader', ROOT / 'development/m07/oauth-attempt-trace/inspect-attempt.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def need(ok):
    if not ok:
        raise ValueError('CONTRIBUTOR_INSPECTION_UNCONFIRMED')


def environment():
    need(not any(value for key, value in os.environ.items() if key.upper() in {'SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD'}))
    return reader.environment()


def protect(directory):
    directory.mkdir(parents=True, exist_ok=False)
    who = subprocess.run(['whoami', '/user', '/fo', 'csv', '/nh'], capture_output=True, check=True).stdout.decode()
    sid = re.search(r'S-1-5-[0-9-]+', who)
    need(sid is not None)
    result = subprocess.run(['icacls', str(directory), '/inheritance:r', '/grant:r', f'*{sid[0]}:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'], capture_output=True)
    need(result.returncode == 0)


def literal(value):
    need(type(value) is str and len(value) <= 254 and re.fullmatch(r'[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+', value) is not None)
    return "'" + value.replace("'", "''") + "'"


def inspection_sql(inputs):
    need(type(inputs) is dict and set(inputs) == {'contributor_email', 'producer_email'})
    contributor, producer = literal(inputs['contributor_email']), literal(inputs['producer_email'])
    need(contributor.lower() != producer.lower())
    caps = ','.join("'" + cap + "'" for cap in ALL_CAPABILITIES)
    project = f"'{PROJECT}'::uuid"
    return f"""begin read only;
set local statement_timeout='12s';
set local lock_timeout='2s';
with requested(label,email) as (values ('contributor',{contributor}),('producer',{producer})),
matched as (select r.label,u.id,u.deleted_at,u.banned_until,u.is_anonymous,u.role,u.email_confirmed_at
 from requested r left join auth.users u on lower(u.email)=lower(r.email)),
identities as (select r.label,(select count(*) from matched m where m.label=r.label and m.id is not null) as match_count,
 (select jsonb_agg(jsonb_build_object('principal_id',m.id,'not_deleted',m.deleted_at is null,
 'not_banned',m.banned_until is null or m.banned_until<=now(),'not_anonymous',not coalesce(m.is_anonymous,false),
 'authenticated_role',m.role='authenticated','email_confirmed',m.email_confirmed_at is not null,
 'capabilities',(select jsonb_object_agg(c,exists(select 1 from public.app_capability_grants g where g.principal_id=m.id and g.capability=c and g.active)) from unnest(array[{caps}]) c),
 'required_inactive',(select count(*) from public.app_capability_grants g where g.principal_id=m.id and g.capability=any(array[{','.join(repr(c) for c in CAPABILITIES)}]) and not g.active),
 'membership_exists',exists(select 1 from public.project_memberships p where p.principal_id=m.id and p.project_id={project}),
 'membership_active',coalesce((select p.active from public.project_memberships p where p.principal_id=m.id and p.project_id={project}),false),
 'membership_can_write',coalesce((select p.can_write from public.project_memberships p where p.principal_id=m.id and p.project_id={project}),false),
 'frame_request_count',(select count(*) from eps.jobs j where j.requested_by=m.id and j.kind='frame_extract')) order by m.id)
 from matched m where m.label=r.label and m.id is not null) as users from requested r)
select jsonb_build_object('database',current_database(),'operator',current_user,'observed_at',clock_timestamp(),
 'project_id','{PROJECT}',
 'project_active',exists(select 1 from public.projects where id='{PROJECT}' and archived_at is null),
 'project_name_matches',exists(select 1 from public.projects where id='{PROJECT}' and name='{PROJECT_NAME}'),
 'identities',(select jsonb_agg(to_jsonb(i) order by label) from identities i)) as contributor_identity;
rollback;
"""


def parse(raw):
    payload = json.loads(raw)
    rows = payload if type(payload) is list else payload.get('rows') if type(payload) is dict else None
    need(type(rows) is list and len(rows) == 1 and set(rows[0]) == {'contributor_identity'})
    value = rows[0]['contributor_identity']
    need(type(value) is dict and set(value) == {'database', 'operator', 'observed_at', 'project_id', 'project_active', 'project_name_matches', 'identities'})
    need(value['database'] == value['operator'] == 'postgres' and value['project_id'] == PROJECT)
    need(type(value['project_active']) is bool and type(value['project_name_matches']) is bool)
    dt.datetime.fromisoformat(value['observed_at'].replace('Z', '+00:00'))
    need(type(value['identities']) is list and [i['label'] for i in value['identities']] == ['contributor', 'producer'])
    keys = {'principal_id', 'not_deleted', 'not_banned', 'not_anonymous', 'authenticated_role', 'email_confirmed', 'capabilities', 'required_inactive', 'membership_exists', 'membership_active', 'membership_can_write', 'frame_request_count'}
    for identity in value['identities']:
        need(set(identity) == {'label', 'match_count', 'users'} and type(identity['match_count']) is int and 0 <= identity['match_count'] <= 2)
        users = identity['users'] or []
        need(type(users) is list and len(users) == identity['match_count'])
        for user in users:
            need(type(user) is dict and set(user) == keys and str(uuid.UUID(user['principal_id'])) == user['principal_id'])
            need(all(type(user[k]) is bool for k in keys - {'principal_id', 'capabilities', 'required_inactive', 'frame_request_count'}))
            need(set(user['capabilities']) == set(ALL_CAPABILITIES) and all(type(v) is bool for v in user['capabilities'].values()))
            need(type(user['required_inactive']) is int and 0 <= user['required_inactive'] <= 5)
            need(type(user['frame_request_count']) is int and 0 <= user['frame_request_count'] <= 100000)
    return value


def command(path):
    return ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', TARGET, '--file', str(path), '--output-format', 'json', '--workdir', str(ROOT)]


def main():
    need(len(sys.argv) == 1 and (ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    env = environment()
    inputs = json.loads(sys.stdin.buffer.read(2049))
    sql = inspection_sql(inputs)
    folder = ROOT / '.local/completion-contributor' / str(uuid.uuid4())
    protect(folder)
    path = folder / 'identity.sql'
    path.write_text(sql, encoding='utf8', newline='\n')
    code, timeout, overflow, stdout, stderr = reader.bounded(command(path), env)
    value = None
    if code == 0 and not timeout and not overflow:
        try:
            value = parse(stdout)
        except Exception:
            pass
    receipt = {'scope': 'actual_read_only_existing_identity_and_grants', 'target': TARGET, 'read_only_rollback': True, 'automatic_retry': False, 'raw_cli_persisted': False, 'exit_code': code, 'timed_out': timeout, 'output_limit_exceeded': overflow, 'metadata': value, 'safe_error': reader.safe_errors(stdout, stderr) if value is None else None}
    (folder / 'identity.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'result': 'passed' if value is not None else 'unconfirmed', 'receipt': (folder / 'identity.json').relative_to(ROOT).as_posix(), 'metadata': value, 'safe_error': receipt['safe_error']}))
    need(value is not None)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('CONTRIBUTOR_INSPECTION_UNCONFIRMED')
        sys.exit(1)
