"""Root-only fixed canonical30 SELECT diagnostics. Imports/pure seams do no IO.

No submit RPC, job retry, grant, Auth write or business DML. Raw CLI output is
discarded; an authenticated private-helper denial is not itself a missing grant.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('specs_access_origin', HERE/'future-origin.py')
origin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(origin)
ROOT = origin.ROOT
ACTOR = '0a79a703-caba-47e5-93d4-42e32197037a'
PROJECT = '6da14b82-8458-451f-aa21-28cb6c85bdc5'
WORKSPACE = '86936940-b48d-497d-b1ff-8e0da0913afa'
ROLES = ('authenticated', 'eps_specs_submit_owner')
PINS = {'SPECS_ACCESS_DIAGNOSTIC.sql':'42743983a08b562b2c99f58fc760842fd092635c72dca28a148c5b1eff43ad38',
        'SPECS_ACCESS_SCOPE.sql':'1676b4742e10a77bf860c4e1911f435de0f1026d5f23b201f917a2daf5a181c8'}
BOOLS = ('read_only','actor_exists','project_exists','projects_read','workspaces_read','workspaces_write',
         'workspace_initializer_enabled','submit_authenticated_execute','scope_submit_owner_execute',
         'submit_inherits_authenticated','submit_eps_usage','authenticated_eps_usage','authenticated_scope_execute',
         'submit_scope_select_privileges','submit_workspace_lock_privilege')
COUNTS = ('membership_count','active_write_membership_count','specs_count','workspace_jobs_count','accepted_specs_idempotency_count')
NULL_BOOLS = ('project_archived','workspace_archived','submit_security_definer','scope_security_definer')
META_FIELDS = (*BOOLS,*COUNTS,*NULL_BOOLS,'database','operator','history','actor_id','project_id','workspace_id',
               'workspace_project_id','specs_ids','specs_row_versions','specs_have_source','submit_owner')


def require(value):
    if not value:
        raise ValueError('SPECS_ACCESS_UNCONFIRMED')


def row(value, key):
    require(type(value) is dict and type(value.get('rows')) is list and len(value['rows']) == 1)
    origin.exact(value['rows'][0], (key,))
    return value['rows'][0][key]


def render_scope(template, role):
    require(role in ROLES and type(template) is str and template.count('__ROLE__') == 1)
    return template.replace('__ROLE__', role)


def validate_environment(environment):
    origin.validate_environment(environment)
    blocked = {'NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','SUPABASE_DEBUG'}
    require(not any(value for key,value in environment.items() if key.upper() in blocked))


def safe_error(raw):
    code = re.search(r'\b(42501|P0001|42703|42883|42P01|25006|57014)\b', raw)
    target = re.search(r'permission denied for (schema|table|function) ["\']?([a-z_]+)', raw.lower())
    allowed = {'eps','public','auth','workspaces','projects','project_memberships','app_capability_grants','specs',
               'has_capability','project_scope','specs_scope','uid','jwt'}
    return {'sqlstate': code.group(1) if code else None,'permission_denied': 'permission denied' in raw.lower(),
            'permission_object': f'{target.group(1)}:{target.group(2)}' if target and target.group(2) in allowed else None}


def scope(value, role):
    origin.exact(value, ('role','actor_id','projects_read','workspaces_write','project_write','workspace_read','workspace_write'))
    require(role in ROLES and value['role'] == role and value['actor_id'] == ACTOR)
    require(all(type(value[key]) is bool for key in ('projects_read','workspaces_write','project_write','workspace_read','workspace_write')))
    return value


def metadata(value):
    origin.exact(value, META_FIELDS)
    require(value['database'] == value['operator'] == 'postgres' and value['read_only'] is True and value['history'] == list(origin.VERSIONS))
    require(value['actor_id'] == ACTOR and value['project_id'] == PROJECT and value['workspace_id'] == WORKSPACE)
    require(value['workspace_project_id'] in (None,PROJECT))
    require(all(type(value[key]) is bool for key in BOOLS) and all(value[key] is None or type(value[key]) is bool for key in NULL_BOOLS))
    require(all(type(value[key]) is int and 0 <= value[key] <= 1000000 for key in COUNTS))
    require(value['submit_owner'] is None or type(value['submit_owner']) is str and re.fullmatch('eps_[a-z_]{1,64}',value['submit_owner']))
    for key in ('specs_ids','specs_row_versions','specs_have_source'):
        require(type(value[key]) is list and len(value[key]) == value['specs_count'] and len(value[key]) <= 2)
    for item in value['specs_ids']:
        require(type(item) is str and str(uuid.UUID(item)) == item)
    require(all(type(item) is int and item >= 1 for item in value['specs_row_versions']))
    require(all(type(item) is bool for item in value['specs_have_source']))
    return value


def query(file, key, parser):
    command = ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',origin.TARGET,
               '--file',str(file),'--output-format','json','--workdir',str(ROOT)]
    try:
        result = subprocess.run(command,cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',
                                timeout=45,stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        return {'result':'unconfirmed','timeout':True,'automatic_retry':False}
    require(len(result.stdout.encode()) <= 2*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
    if result.returncode != 0:
        return {'result':'sql_error_observed','exit_code':result.returncode,**safe_error(result.stdout+'\n'+result.stderr)}
    return {'result':'observed','data':parser(row(json.loads(result.stdout),key))}


def main():
    require(len(sys.argv) == 1)
    validate_environment(os.environ)
    pins = origin.source_pins()
    for name, expected in PINS.items():
        data = origin.public_bytes(HERE/name)
        require(hashlib.sha256(data).hexdigest() == expected)
        pins[f'development/m07/controlled-pilot/{name}'] = expected
    require(len(PINS) == 2)
    result = query(HERE/'SPECS_ACCESS_DIAGNOSTIC.sql','specs_access_metadata',metadata)
    require(result['result'] == 'observed')
    directory = ROOT/'.local/m07-pilot/specs-access-diagnostic'
    directory.mkdir(parents=True,exist_ok=True)
    require(directory.resolve() == directory and not directory.is_symlink())
    outcomes = {}
    template = origin.public_bytes(HERE/'SPECS_ACCESS_SCOPE.sql').decode('utf8')
    for role in ROLES:
        file = directory/f'{uuid.uuid4().hex}-{role}.sql'
        with file.open('x',encoding='utf8',newline='\n') as stream:
            stream.write(render_scope(template,role));stream.flush();os.fsync(stream.fileno())
        outcomes[role] = query(file,'specs_access_scope',lambda value:scope(value,role))
        if outcomes[role]['result'] == 'unconfirmed':
            break
    for name, expected in PINS.items():
        require(hashlib.sha256(origin.public_bytes(HERE/name)).hexdigest() == expected)
    report = {'schema_version':'1.0','observed_at':origin.stamp(),'result':'observed','target':origin.TARGET,
              'actor_id':ACTOR,'project_id':PROJECT,'workspace_id':WORKSPACE,'metadata':result['data'],'role_scopes':outcomes,
              'source_pins':pins,'helper_sha256':hashlib.sha256(origin.public_bytes(Path(__file__))).hexdigest(),
              'maximum_cli_commands':3,'all_sql_transactions_read_only':True,'submission_rpc_executed':False,
              'business_auth_grant_or_job_mutation':False,'actual_tokens_or_source_or_raw_diagnostics_persisted':False,
              'scope':'Read-only local actual-actor claims and private-owner scope; not token issuance or an actual submission proof'}
    output = ROOT/'tracking/evidence/m07/controlled-pilot'/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-specs-access.json"
    with output.open('x',encoding='utf8',newline='\n') as stream:
        json.dump(report,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
    print(json.dumps({'receipt':output.relative_to(ROOT).as_posix(),'result':'observed','submission_rpc_executed':False}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"result":"unconfirmed","raw_diagnostics_suppressed":true,"automatic_retry":false}')
        sys.exit(1)
