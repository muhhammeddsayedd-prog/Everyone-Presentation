"""Fixed, source-pinned canonical READ ONLY issuer30 discovery. Never applies SQL."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tomllib
import uuid

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
TARGET = 'pyibofyctwnqpvktepse'
QUERY_SHA = '5a30e3bf2bb17f32c932dad9bfac71f8162ff552ae9f12ef05ec6e03aef10f6f'
HISTORICAL = ROOT/'development/m07/issuer-release30/historical29-expected.json'
HISTORICAL_SHA = 'd461973c85adae162f96b08b585b0bdc20030416132268007350c4e425685345'
FORBIDDEN_ENV = {'SUPABASE_PROJECT_ID','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL',
    'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE',
    'PGSERVICEFILE','PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION'}

def require(condition):
    if not condition: raise ValueError('ISSUER30_FIXED_READ_ONLY_DISCOVERY_REQUIRED')

def sha(value): return hashlib.sha256(value).hexdigest()

def oid(value):
    require(type(value) in (str,int))
    require(type(value) is int or re.fullmatch(r'[1-9][0-9]*',value) is not None)
    result=int(value);require(0<result<=4294967295);return result

def historical():
    data=HISTORICAL.read_bytes();require(sha(data)==HISTORICAL_SHA)
    return json.loads(data)

def validate_environment(environment):
    require(not any(environment.get(name) for name in FORBIDDEN_ENV))

def query_command():
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,
            '--file',str(HERE/'discover.sql'),'--output-format','json','--workdir',str(ROOT)]

def validate_discovery(state):
    require(type(state) is dict and set(state)=={'catalog','context','admission','protected_data'})
    catalog=state['catalog'];context=state['context'];expected=historical()
    require(type(catalog) is dict and 356<=len(catalog)<=50000)
    require(all(key in catalog and catalog[key]==value for key,value in expected['selected_metadata'].items()))
    require(set(context)=={'database','operator','unrestricted_visibility','migration_versions',
        'issuer_role_exists','issuer_function_count','issuer_policy_count','all_roles','all_memberships',
        'settings','registry_count','effective_privileges'})
    require(context['database']==context['operator']=='postgres' and context['unrestricted_visibility'] is True)
    require(context['migration_versions']==expected['versions'] and len(expected['versions'])==29)
    require(context['issuer_role_exists'] is False and type(context['issuer_function_count']) is int
            and context['issuer_function_count']==0 and type(context['issuer_policy_count']) is int
            and context['issuer_policy_count']==0)
    require(type(context['registry_count']) is int and context['registry_count']==0)
    require(type(context['all_roles']) is list and context['all_roles'])
    names=[]
    role_keys={'name','oid','login','super','inherit','bypassrls','create_role','create_db','replication','connection_limit','valid_until'}
    for role in context['all_roles']:
        require(type(role) is dict and set(role)==role_keys)
        require(type(role['name']) is str and role['name'] not in names);names.append(role['name']);oid(role['oid'])
        require(all(type(role[k]) is bool for k in ['login','super','inherit','bypassrls','create_role','create_db','replication']))
    require('eps_mcp_issuer_owner' not in names)
    require(type(context['all_memberships']) is list and type(context['effective_privileges']) is dict)
    for membership in context['all_memberships']:
        require(set(membership)=={'role','member','grantor','role_oid','member_oid','grantor_oid','admin','inherit','set'})
        for key in ['role_oid','member_oid','grantor_oid']:oid(membership[key])
        require(all(type(membership[k]) is bool for k in ['admin','inherit','set']))
    settings=context['settings'];require(type(settings) is dict)
    require(set(settings)=={'template_version','default_timezone','row_version','default_review_expiry_days'})
    require(type(settings['row_version']) is int and settings['row_version']>=1)
    require(settings['default_review_expiry_days']==30 and type(settings['default_timezone']) is str)
    admission=state['admission']
    require(set(admission)=={'query_role','database','unrestricted_visibility','runtime','protected_m02','active_jobs','leased_outbox'})
    require(admission['query_role']==admission['database']=='postgres' and admission['unrestricted_visibility'] is True)
    require(admission['protected_m02']=={'exists':True,'manual_note_retained':True})
    require(type(state['protected_data']) is dict)
    return state

def publish_discovery(report,state):
    # Mutate the public receipt only after closed validation succeeds.
    validate_discovery(state)
    report['discovery']=state

def validate_files():
    validate_environment(os.environ)
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text())
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False)
    manifest=json.loads((ROOT/'development/local-db/reviewed.json').read_text())
    entries=manifest['migrations'];require(len(entries)==29)
    actual=sorted(file.name for file in (ROOT/'supabase/migrations').glob('*.sql'))
    require(actual==[Path(entry['path']).name for entry in entries])
    require([name[:14]for name in actual]==historical()['versions'])
    for entry in entries:require(sha((ROOT/entry['path']).read_bytes())==entry['sha256'])
    require(sha((HERE/'discover.sql').read_bytes())==QUERY_SHA)
    sources=json.loads((HERE/'discovery-sources.json').read_text())['sources']
    for file,digest in sources.items():require(sha((ROOT/file).read_bytes())==digest)
    return {**sources,Path(__file__).relative_to(ROOT).as_posix():sha(Path(__file__).read_bytes()),
            'development/local-db/reviewed.json':sha((ROOT/'development/local-db/reviewed.json').read_bytes())}

def private_write(label,data):
    # Every raw diagnostic is protected at file creation, including early errors.
    sys.path.insert(0,str(ROOT/'tools'))
    from provision_logo_verifier import WindowsPrivateFiles
    folder=ROOT/'.local/m07-issuer30-discovery';folder.mkdir(parents=True,exist_ok=True)
    security=WindowsPrivateFiles()
    with security.create(folder/label) as handle:
        handle.write(data);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)

def main():
    require(sys.argv[1:]==['discover'])
    now=datetime.datetime.now(datetime.timezone.utc);run_id=uuid.uuid4().hex
    report={'schema_version':'1.0','observed_at':now.isoformat(),'run_id':run_id,'target':TARGET,
        'action':'read-only-issuer30-discovery','result':'failed','canonical_writes':False,'provider_mutations':False,
        'credential_values_read_or_printed_by_harness':False,'claude_configuration_or_login':False,'automatic_retry':False}
    try:
        before=validate_files();report['source_seals']=before
        version=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','--version'],cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=30)
        require(version.returncode==0 and version.stdout.strip()=='2.122.0');report['cli_version']='2.122.0'
        help_result=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','db','query','--help'],cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=30)
        require(help_result.returncode==0 and all(flag in help_result.stdout for flag in ['--linked','--project-ref','--file','--output-format']))
        report['installed_query_help_sha256']=sha(help_result.stdout.encode())
        result=subprocess.run(query_command(),cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60)
        report['exit_code']=result.returncode
        require(len(result.stdout.encode())<=16*1024*1024 and len(result.stderr.encode())<=1024*1024)
        private_write(run_id+'-stdout.txt',result.stdout.encode());private_write(run_id+'-stderr.txt',result.stderr.encode())
        require(result.returncode==0)
        rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'issuer30_discovery'})
        state=rows[0]['issuer30_discovery']
        validate_discovery(state);require(validate_files()==before)
        publish_discovery(report,state)
        report['result']='passed';report['sources_stable']=True
    finally:
        report['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        area=ROOT/'tracking/evidence/m07/issuer-release30-executable';area.mkdir(parents=True,exist_ok=True)
        output=area/(now.strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+run_id[:8]+'-canonical-discovery.json')
        output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
        print(json.dumps({'result':report['result'],'evidence':output.relative_to(ROOT).as_posix(),
            'raw_diagnostics_suppressed':True,'canonical_writes':False,'automatic_retry':False}))

if __name__=='__main__':
    try:main()
    except Exception:
        sys.stderr.write('Fixed read-only issuer discovery unconfirmed; private diagnostics suppressed.\n');sys.exit(1)
