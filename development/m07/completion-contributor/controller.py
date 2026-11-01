"""Disabled absent-only temporary contributor access; no account/session APIs.

The owner must review and arm this new purpose before grant/revoke. All state is
protected ignored local data. Unknown dispatches are read-only reconciled; they
are never automatically replayed. Existing or changed rows are never updated.
"""
from pathlib import Path
import datetime as dt
import hashlib
import importlib.util
import json
import re
import sys
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('contributor_inspection', HERE / 'identity.py')
access = importlib.util.module_from_spec(spec)
spec.loader.exec_module(access)
ROOT = access.ROOT
MUTATIONS_ENABLED = False
REQUIRED = access.CAPABILITIES
PRODUCER = '0a79a703-caba-47e5-93d4-42e32197037a'


def need(ok):
    if not ok:
        raise ValueError('CONTRIBUTOR_ACCESS_REFUSED')


def seal():
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (HERE / 'controller.py', HERE / 'identity.py')}


def private_path(raw):
    path = Path(raw).resolve()
    need(path.is_relative_to((ROOT / '.local/completion-contributor').resolve()))
    return path


def prepare_identity(receipt):
    need(receipt['scope'] == 'actual_read_only_existing_identity_and_grants' and receipt['target'] == access.TARGET and receipt['read_only_rollback'] is True)
    need(receipt['exit_code'] == 0 and receipt['timed_out'] is False and receipt['output_limit_exceeded'] is False)
    value = access.parse(json.dumps([{'contributor_identity': receipt['metadata']}]))
    need(value['project_active'] and value['project_name_matches'])
    identities = {i['label']: i for i in value['identities']}
    need(all(i['match_count'] == 1 for i in identities.values()))
    contributor, producer = identities['contributor']['users'][0], identities['producer']['users'][0]
    need(producer['principal_id'] == PRODUCER and contributor['principal_id'] != PRODUCER)
    for user in (contributor, producer):
        need(all(user[k] for k in ('not_deleted', 'not_banned', 'not_anonymous', 'authenticated_role', 'email_confirmed')))
    need(producer['membership_active'] and producer['membership_can_write'] and producer['capabilities']['projects.write'])
    need(not any(enabled for capability, enabled in contributor['capabilities'].items() if capability not in REQUIRED))
    need(contributor['required_inactive'] == 0)
    need(not contributor['membership_exists'] or contributor['membership_active'] and contributor['membership_can_write'])
    observed = dt.datetime.fromisoformat(value['observed_at'].replace('Z', '+00:00'))
    age = (dt.datetime.now(dt.timezone.utc) - observed).total_seconds()
    need(0 <= age <= 900)
    return contributor['principal_id']


def validate_plan(plan):
    need(type(plan) is dict and set(plan) == {'run_id', 'principal_id', 'project_id', 'marker', 'source', 'baseline', 'owned_capabilities', 'owned_membership'})
    need(str(uuid.UUID(plan['run_id'])) == plan['run_id'] and str(uuid.UUID(plan['principal_id'])) == plan['principal_id'])
    need(plan['principal_id'] != PRODUCER and plan['project_id'] == access.PROJECT and plan['source'] == seal())
    need(type(plan['marker']) is str and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+00:00', plan['marker']) is not None)
    need(type(plan['baseline']) is str and re.fullmatch(r'[a-f0-9]{64}', plan['baseline']) is not None)
    need(type(plan['owned_capabilities']) is list and len(set(plan['owned_capabilities'])) == len(plan['owned_capabilities']) and all(c in REQUIRED for c in plan['owned_capabilities']))
    need(type(plan['owned_membership']) is bool)


def snapshot(principal, marker=None, owned=(), membership=False, global_scope=False):
    """Exact canonical access rows; digests stay private, never receipt stdout."""
    scope = 'true' if global_scope else f"principal_id='{principal}'::uuid"
    caps = ','.join("'" + c + "'" for c in owned) or 'null'
    exclude_grants = f" and not(principal_id='{principal}'::uuid and capability in({caps}) and active and created_at='{marker}'::timestamptz)" if marker else ''
    exclude_membership = f" and not(principal_id='{principal}'::uuid and project_id='{access.PROJECT}'::uuid and active and can_write and created_at='{marker}'::timestamptz)" if marker and membership else ''
    expressions = []
    for table, exclude in (('app_capability_grants', exclude_grants), ('project_memberships', exclude_membership), ('client_memberships', '')):
        expressions.append(f"'{table}',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.{table} r where {scope}{exclude})")
    return "encode(sha256(convert_to(jsonb_build_object(" + ','.join(expressions) + ")::text,'UTF8')),'hex')"


def eligibility(principal):
    caps = ','.join("'" + c + "'" for c in REQUIRED)
    return f"""exists(select 1 from auth.users where id='{principal}' and deleted_at is null and (banned_until is null or banned_until<=now()) and not coalesce(is_anonymous,false) and role='authenticated' and email_confirmed_at is not null)
 and exists(select 1 from public.projects where id='{access.PROJECT}' and name='{access.PROJECT_NAME}' and archived_at is null)
 and exists(select 1 from public.project_memberships where principal_id='{PRODUCER}' and project_id='{access.PROJECT}' and active and can_write)
 and exists(select 1 from public.app_capability_grants where principal_id='{PRODUCER}' and capability='projects.write' and active)
 and not exists(select 1 from public.app_capability_grants where principal_id='{principal}' and (active and capability not in({caps}) or not active and capability in({caps})))
 and not exists(select 1 from public.project_memberships where principal_id='{principal}' and project_id='{access.PROJECT}' and (not active or not can_write))"""


def read_sql(principal, plan=None):
    need(str(uuid.UUID(principal)) == principal and principal != PRODUCER)
    owned = plan['owned_capabilities'] if plan else []
    marker = plan['marker'] if plan else None
    exclusion = snapshot(principal, marker, owned, plan['owned_membership'] if plan else False)
    required = ','.join("'" + c + "'" for c in REQUIRED)
    return f"""begin read only;
set local statement_timeout='12s';set local lock_timeout='2s';
select jsonb_build_object('eligible',({eligibility(principal)}),'baseline',{exclusion},
 'missing_capabilities',(select coalesce(jsonb_agg(c order by c),'[]'::jsonb) from unnest(array[{required}]) c where not exists(select 1 from public.app_capability_grants g where g.principal_id='{principal}' and g.capability=c)),
 'membership_absent',not exists(select 1 from public.project_memberships where principal_id='{principal}' and project_id='{access.PROJECT}')) as contributor_access;
rollback;
"""


def mutation_sql(plan, mode):
    validate_plan(plan)
    need(mode in ('grant', 'revoke'))
    principal, marker = plan['principal_id'], plan['marker']
    caps = ','.join("'" + c + "'" for c in plan['owned_capabilities']) or 'null'
    grants_filter = f"principal_id='{principal}' and capability in({caps}) and active and created_at='{marker}'::timestamptz"
    membership_filter = f"principal_id='{principal}' and project_id='{access.PROJECT}' and active and can_write and created_at='{marker}'::timestamptz"
    baseline = snapshot(principal, marker, plan['owned_capabilities'], plan['owned_membership'])
    global_before = snapshot(principal, global_scope=True)
    global_without_owned = snapshot(principal, marker, plan['owned_capabilities'], plan['owned_membership'], True)
    membership_count = 1 if plan['owned_membership'] else 0
    if mode == 'grant':
        action = f"""if not({eligibility(principal)}) or {snapshot(principal)}<>'{plan['baseline']}' then raise exception 'CONTRIBUTOR_ACCESS_REFUSED';end if;
 insert into public.app_capability_grants(principal_id,capability,active,created_at)
 select '{principal}'::uuid,c,true,'{marker}'::timestamptz from unnest(array[{caps}]::text[]) c where c is not null;
 {f"insert into public.project_memberships(project_id,principal_id,can_write,active,created_at) values('{access.PROJECT}','{principal}',true,true,'{marker}');" if plan['owned_membership'] else ''}
 if (select count(*) from public.app_capability_grants where {grants_filter})<>{len(plan['owned_capabilities'])} or (select count(*) from public.project_memberships where {membership_filter})<>{membership_count} or {baseline}<>'{plan['baseline']}' or {global_without_owned}<>before_access then raise exception 'CONTRIBUTOR_ACCESS_REFUSED';end if;"""
    else:
        action = f"""if (select count(*) from public.app_capability_grants where {grants_filter})<>{len(plan['owned_capabilities'])} or (select count(*) from public.project_memberships where {membership_filter})<>{membership_count} or {baseline}<>'{plan['baseline']}' then raise exception 'CONTRIBUTOR_ACCESS_REFUSED';end if;
 before_access:={global_without_owned};
 delete from public.app_capability_grants where {grants_filter};
 {f'delete from public.project_memberships where {membership_filter};' if plan['owned_membership'] else ''}
 if {snapshot(principal)}<>'{plan['baseline']}' or {global_before}<>before_access then raise exception 'CONTRIBUTOR_ACCESS_REFUSED';end if;"""
    return f"""begin;
set local statement_timeout='12s';set local lock_timeout='2s';
lock table public.app_capability_grants,public.project_memberships,public.client_memberships in share row exclusive mode;
do $contributor$ declare before_access text;begin
 before_access:={global_before};
 {action}
end $contributor$;
select jsonb_build_object('operation','{mode}','preserved',true,'owned_capability_count',{len(plan['owned_capabilities'])},'owned_membership_count',{membership_count}) as contributor_access;
commit;
"""


def query(folder, sql):
    need((ROOT / 'supabase/.temp/project-ref').read_text().strip() == access.TARGET)
    path = folder / (str(uuid.uuid4()) + '.sql')
    path.write_text(sql, encoding='utf8', newline='\n')
    code, timeout, overflow, stdout, stderr = access.reader.bounded(access.command(path), access.environment())
    need(code == 0 and not timeout and not overflow)
    payload = json.loads(stdout)
    rows = payload if type(payload) is list else payload.get('rows') if type(payload) is dict else None
    need(type(rows) is list and len(rows) == 1 and set(rows[0]) == {'contributor_access'})
    return rows[0]['contributor_access']


def readback_result(plan, state):
    need(type(state) is dict and set(state) == {'eligible', 'baseline', 'missing_capabilities', 'membership_absent'})
    need(type(state['eligible']) is bool and type(state['membership_absent']) is bool)
    need(type(state['missing_capabilities']) is list and len(set(state['missing_capabilities'])) == len(state['missing_capabilities']) and all(c in REQUIRED for c in state['missing_capabilities']))
    need(state['baseline'] == plan['baseline'])
    granted = state['eligible'] is True and state['missing_capabilities'] == [] and state['membership_absent'] is False
    cleaned = set(state['missing_capabilities']) == set(plan['owned_capabilities']) and state['membership_absent'] == plan['owned_membership']
    return {'granted': granted, 'cleaned': cleaned, 'baseline_preserved': True}


def main():
    need(len(sys.argv) == 3 and sys.argv[1] in ('prepare', 'readback', 'grant', 'revoke'))
    mode = sys.argv[1]
    # Arming is necessary even if an attacker supplies otherwise valid state.
    if mode in ('grant', 'revoke'):
        need(MUTATIONS_ENABLED)
    if mode == 'prepare':
        receipt = json.loads(private_path(sys.argv[2]).read_text(encoding='utf8'))
        principal = prepare_identity(receipt)
        run = str(uuid.uuid4())
        folder = ROOT / '.local/completion-contributor' / run
        access.protect(folder)
        initial = query(folder, read_sql(principal))
        need(type(initial) is dict and set(initial) == {'eligible', 'baseline', 'missing_capabilities', 'membership_absent'} and initial['eligible'] is True)
        plan = {'run_id': run, 'principal_id': principal, 'project_id': access.PROJECT, 'marker': dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds'), 'source': seal(), 'baseline': initial['baseline'], 'owned_capabilities': initial['missing_capabilities'], 'owned_membership': initial['membership_absent']}
        validate_plan(plan)
        (folder / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n', encoding='utf8')
        print(json.dumps({'result': 'prepared', 'path': str(folder.relative_to(ROOT)), 'mutations_enabled': MUTATIONS_ENABLED}))
        return
    folder = private_path(sys.argv[2])
    plan = json.loads((folder / 'plan.json').read_text(encoding='utf8'))
    validate_plan(plan)
    if mode == 'readback':
        state = query(folder, read_sql(plan['principal_id'], plan))
        result = readback_result(plan, state)
        (folder / ('readback-' + str(uuid.uuid4()) + '.json')).write_text(json.dumps(result) + '\n', encoding='utf8')
        print(json.dumps(result))
        return
    # A claim is durable before dispatch. Neither success nor unknown outcome
    # permits another grant/revoke dispatch for this run.
    claim = folder / (mode + '-dispatched.json')
    with claim.open('x', encoding='utf8') as stream:
        stream.write(json.dumps({'run_id': plan['run_id'], 'mode': mode, 'source': seal()}) + '\n')
    result = query(folder, mutation_sql(plan, mode))
    need(result == {'operation': mode, 'preserved': True, 'owned_capability_count': len(plan['owned_capabilities']), 'owned_membership_count': int(plan['owned_membership'])})
    # A returned mutation row precedes COMMIT; it never proves durability alone.
    observed = readback_result(plan, query(folder, read_sql(plan['principal_id'], plan)))
    need(observed['granted' if mode == 'grant' else 'cleaned'])
    result['post_commit_readback'] = observed
    (folder / (mode + '-confirmed.json')).write_text(json.dumps(result) + '\n', encoding='utf8')
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('CONTRIBUTOR_ACCESS_REFUSED_OR_OUTCOME_UNCONFIRMED; NO AUTOMATIC RETRY')
        sys.exit(1)
