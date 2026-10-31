"""Root-only ONE read-only query to diagnose the frozen rollback preflight.

No submit, claim, DDL, source-pin replacement, private-file or provider IO on
import. Actual catalog values and CLI diagnostics are projected in RAM only.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('frozen_specs_rollback',HERE/'specs-submit-rollback.py')
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
RUNNER_SHA='030a4183eaec9aab551a5edc525b06763dc4613b179fab1e3a51fd188b902fb8'
CHECKS=('language_match','security_definer_match','volatility_match','body_match','search_path_match')
TRIGGER_CHECKS=('function_match','type_match','enabled_match','nargs_match')


def need(value):
    if not value:raise ValueError('SPECS_INSPECT_DIAGNOSTIC_UNCONFIRMED')


def safe_error(raw):
    match=re.search(r'\b(42501|P0001|42601|42703|42883|42P01|25006|57014|54000|XX000|22P02)\b',raw)
    target=re.search(r'permission denied for (?:schema|table|function) ["\']?([a-z_]+)',raw.lower())
    return {'sqlstate':match.group(1)if match else None,'permission_denied':'permission denied'in raw.lower(),
            'permission_object':target.group(1)if target and target.group(1)in core.OBJECTS else None}


def render_diagnostic(query):
    marker="select jsonb_build_object('database'"
    need(query.count(marker)==1)
    prefix=query.split(marker)[0]
    return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='25s';\n"+prefix+"""select jsonb_build_object(
 'snapshot',(select specs_submit_state from("""+query+""")s),
 'functions',(select jsonb_agg(jsonb_build_object('name',e.name,'nargs',e.nargs,
   'count',(select count(*)from actual_functions a where a.name=e.name and a.nargs=e.nargs),
   'language_match',coalesce((select bool_and(a.language=e.language)from actual_functions a where a.name=e.name and a.nargs=e.nargs),false),
   'security_definer_match',coalesce((select bool_and(a.security_definer=e.security_definer)from actual_functions a where a.name=e.name and a.nargs=e.nargs),false),
   'volatility_match',coalesce((select bool_and(a.volatility=e.volatility)from actual_functions a where a.name=e.name and a.nargs=e.nargs),false),
   'body_match',coalesce((select bool_and(a.sha256=e.sha256)from actual_functions a where a.name=e.name and a.nargs=e.nargs),false),
   'search_path_match',coalesce((select bool_and(a.search_path_empty=e.search_path_empty)from actual_functions a where a.name=e.name and a.nargs=e.nargs),false))order by e.name,e.nargs)from expected_functions e),
 'unexpected_functions',(select count(*)from actual_functions a where not exists(select 1 from expected_functions e where e.name=a.name and e.nargs=a.nargs)),
 'triggers',(select jsonb_agg(jsonb_build_object('table',e."table",'name',e.name,
   'count',(select count(*)from actual_triggers a where a."table"=e."table"and a.name=e.name),
   'function_match',coalesce((select bool_and(a."function"=e."function")from actual_triggers a where a."table"=e."table"and a.name=e.name),false),
   'type_match',coalesce((select bool_and(a."type"=e."type")from actual_triggers a where a."table"=e."table"and a.name=e.name),false),
   'enabled_match',coalesce((select bool_and(a.enabled=e.enabled)from actual_triggers a where a."table"=e."table"and a.name=e.name),false),
   'nargs_match',coalesce((select bool_and(a.nargs=e.nargs)from actual_triggers a where a."table"=e."table"and a.name=e.name),false))order by e."table",e.name)from expected_triggers e),
 'unexpected_triggers',(select count(*)from actual_triggers a where not exists(select 1 from expected_triggers e where e."table"=a."table"and e.name=a.name))
)as specs_inspect_diagnostic;
rollback;
"""


def project(value,trust):
    core.origin.exact(value,('snapshot','functions','unexpected_functions','triggers','unexpected_triggers'))
    need(type(value['functions'])is list and len(value['functions'])==len(trust['functions']))
    need(type(value['triggers'])is list and len(value['triggers'])==len(trust['triggers']))
    result={'mismatch_functions':[],'mismatch_triggers':[]}
    seen=set()
    for row in value['functions']:
        core.origin.exact(row,('name','nargs','count',*CHECKS))
        identity=(row['name'],row['nargs']);need(identity not in seen and identity in{(e['name'],e['nargs'])for e in trust['functions']});seen.add(identity)
        need(type(row['nargs'])is int and type(row['count'])is int and 0<=row['count']<=100 and all(type(row[k])is bool for k in CHECKS))
        reasons=(['count']if row['count']!=1 else[])+[key for key in CHECKS if not row[key]]
        if reasons:result['mismatch_functions'].append({'name':row['name'],'nargs':row['nargs'],'reasons':reasons})
    seen=set()
    for row in value['triggers']:
        core.origin.exact(row,('table','name','count',*TRIGGER_CHECKS))
        identity=(row['table'],row['name']);need(identity not in seen and identity in{(e['table'],e['name'])for e in trust['triggers']});seen.add(identity)
        need(type(row['count'])is int and 0<=row['count']<=100 and all(type(row[k])is bool for k in TRIGGER_CHECKS))
        reasons=(['count']if row['count']!=1 else[])+[key for key in TRIGGER_CHECKS if not row[key]]
        if reasons:result['mismatch_triggers'].append({'table':row['table'],'name':row['name'],'reasons':reasons})
    for key in('unexpected_functions','unexpected_triggers'):
        need(type(value[key])is int and 0<=value[key]<=1000);result[key]=value[key]
    state=value['snapshot'];need(type(state)is dict)
    result['context_matches']=all(state.get(k)==v for k,v in [('database','postgres'),('operator','postgres'),('actor_id',core.ACTOR),('project_id',core.PROJECT),('workspace_id',core.WORKSPACE)])
    result['history_matches']=state.get('history')==list(core.origin.VERSIONS)
    result['pristine_state_matches']=state.get('state')=={'spec_count':1,'spec_id':core.SPEC,'spec_row_version':1,'source_present':False,'workspace_jobs':0,'diagnostic_idempotency':0}
    try:core.snapshot(state);result['preflight_admissible']=True
    except Exception:result['preflight_admissible']=False
    return result


def main():
    need(len(sys.argv)==1)
    report={'schema_version':'1.0','observed_at':core.origin.stamp(),'target':core.origin.TARGET,'result':'unconfirmed',
            'phase':'public_source_gate','maximum_cli_commands':1,'cli_commands_attempted':0,'submission_rpc_executed':False,
            'dispatch_claim_created':False,'sql_transactions_read_only':True,'automatic_retry':False,
            'raw_source_hashes_values_or_cli_errors_persisted':False,'expected_source_requirements_changed':False}
    try:
        need(hashlib.sha256(core.origin.public_bytes(HERE/'specs-submit-rollback.py')).hexdigest()==RUNNER_SHA)
        pins,files,query,_=core.source_inputs();report['source_pins']=pins
        sql=render_diagnostic(query);trust=json.loads(files['SPECS_SUBMIT_TRUST.json'])
        directory=core.ROOT/'.local/m07-pilot/specs-inspect-diagnostic';directory.mkdir(parents=True,exist_ok=True)
        need(directory.resolve()==directory and not directory.is_symlink())
        file=directory/f'{uuid.uuid4().hex}.sql';core.exclusive(file,sql.encode())
        need(core.source_inputs()[0]==pins)
        report['phase']='cli_query';report['cli_commands_attempted']=1
        command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',core.origin.TARGET,
                 '--file',str(file),'--output-format','json','--workdir',str(core.ROOT)]
        response=subprocess.run(command,cwd=core.ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=45,stdin=subprocess.DEVNULL)
        need(len(response.stdout.encode())<=2*1024*1024 and len(response.stderr.encode())<=1024*1024)
        if response.returncode!=0:
            report['phase']='cli_sql_error';report['cli_exit_code']=response.returncode;report['error']=safe_error(response.stdout+'\n'+response.stderr)
        else:
            report['phase']='cli_json';value=json.loads(response.stdout)
            report['phase']='row_shape';selected=core.parse_row(value,'specs_inspect_diagnostic')
            report['phase']='diagnostic_projection';report['diagnostic']=project(selected,trust)
            report['phase']='admission';report['result']='diagnostic_observed'
    except subprocess.TimeoutExpired:report['phase']='cli_timeout'
    except Exception:pass
    report['finished_at']=core.origin.stamp();report['helper_sha256']=hashlib.sha256(core.origin.public_bytes(Path(__file__))).hexdigest()
    path=core.ROOT/'tracking/evidence/m07/controlled-pilot'/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-specs-inspect-diagnostic.json"
    core.exclusive(path,(json.dumps(report,indent=2)+'\n').encode())
    print(json.dumps({'receipt':path.relative_to(core.ROOT).as_posix(),'result':report['result'],'phase':report['phase'],'submission_rpc_executed':False}))
    return 0 if report['result']=='diagnostic_observed'else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","submission_rpc_executed":false,"raw_diagnostics_suppressed":true}');sys.exit(1)
