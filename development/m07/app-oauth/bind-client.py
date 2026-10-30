"""Fixed local-resource registration. Apply once; unknown outcomes use inspect."""
from pathlib import Path
import datetime,hashlib,json,os,re,subprocess,sys,uuid
R=Path(__file__).resolve().parents[3]
TARGET='pyibofyctwnqpvktepse'
FORBIDDEN_ENV={'SUPABASE_PROJECT_ID','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL',
 'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE',
 'PGSERVICEFILE','PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION'}
HOOK_CHECKS={'owner_and_body','auth_admin_execute','no_public_client_execute','auth_admin_schema','auth_admin_no_other_eps_execute','no_issuer_schema_create','registry_forced_rls','capability_forced_rls'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def validate_environment(environment):
    if any(environment.get(name)for name in FORBIDDEN_ENV):raise ValueError('MCP_BIND_AMBIENT_TARGET_OVERRIDE')
def validate_binding(value,client):
    expected={'resource':'http://127.0.0.1:3000/mcp','client_id':client,'enabled':True,'inserted_rows':1,'ready_settings_capabilities_unchanged':True}
    if type(value)is not dict or set(value)!=set(expected)or value!=expected or value['enabled']is not True or value['ready_settings_capabilities_unchanged']is not True or type(value['inserted_rows'])is not int:raise ValueError()
    return value
def validate_inspection(value,versions):
    if type(value)is not dict or set(value)!={'database','operator','history','bindings','hook_present','hook_security','settings'}or value['database']!='postgres'or value['operator']!='postgres'or value['history']!=versions or type(value['bindings'])is not list or len(value['bindings'])>32:raise ValueError()
    security=value['hook_security']
    if type(security)is not dict or set(security)!=HOOK_CHECKS or any(x is not True for x in security.values()):raise ValueError()
    for item in value['bindings']:
        if type(item)is not dict or set(item)!={'resource','client_id','enabled'}or item['resource']!='http://127.0.0.1:3000/mcp'or type(item['client_id'])is not str or str(uuid.UUID(item['client_id']))!=item['client_id']or type(item['enabled'])is not bool:raise ValueError()
    settings=value['settings']
    if type(value['hook_present'])is not bool or type(settings)is not dict or set(settings)!={'timezone','template_version','row_version'}or type(settings['timezone'])is not str or not re.fullmatch('[A-Za-z0-9_+/-]{1,100}',settings['timezone'])or settings['template_version']!='1.1.0'or type(settings['row_version'])is not int or not 1<=settings['row_version']<=9007199254740991:raise ValueError()
    return value
def main():
    validate_environment(os.environ)
    if len(sys.argv)not in(2,3)or sys.argv[1]not in('inspect','apply')or(R/'supabase/.temp/project-ref').read_text().strip()!=TARGET:raise ValueError()
    action=sys.argv[1];folder=Path(__file__).parent
    versions=sorted(p.name[:14]for p in(R/'supabase/migrations').glob('*.sql'))
    if not all(re.fullmatch('[0-9]{14}',v)for v in versions):raise ValueError()
    sources={p.relative_to(R).as_posix():sha(p)for p in[Path(__file__),folder/'bind-client.sql',folder/'inspect-binding.sql']}
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'action':action,'scope':'One fixed operator resource/client configuration; no account, capability, provider or job mutation','result':'unverified','sources':sources,'raw_diagnostics_suppressed':True}
    private=R/'.local/m07-app-oauth';private.mkdir(parents=True,exist_ok=True)
    if action=='apply':
        if len(sys.argv)!=3 or len(versions)!=30:raise ValueError()
        client=sys.argv[2]
        if str(uuid.UUID(client))!=client or uuid.UUID(client).int==0:raise ValueError()
        sql=(folder/'bind-client.sql').read_text(encoding='utf8')
        if sql.count('__CLIENT_UUID__')!=1 or sql.count('__HISTORY_HEX__')!=1:raise ValueError()
        sql=sql.replace('__CLIENT_UUID__',client).replace('__HISTORY_HEX__',json.dumps(versions,separators=(',',':')).encode().hex())
        source=private/f'bind-{client}.sql'
        with source.open('x',encoding='utf8',newline='\n')as f:f.write(sql)
        with(private/f'bind-{client}-dispatch.json').open('x',encoding='utf8')as f:f.write(json.dumps({'claimed_at':report['observed_at'],'client_id':client,'target':TARGET,'rendered_sql_sha256':sha(source)})+'\n')
        report['rendered_sql_sha256']=sha(source)
    else:
        if len(sys.argv)!=2:raise ValueError()
        source=folder/'inspect-binding.sql'
    try:
        result=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(source),'--output-format','json','--workdir',str(R)],cwd=R,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60)
        report['exit_code']=result.returncode
        if result.returncode:raise ValueError()
        rows=json.loads(result.stdout)['rows'];key='binding'if action=='apply'else'inspection'
        if len(rows)!=1 or set(rows[0])!={key}:raise ValueError()
        value=rows[0][key]
        if action=='apply':
            value=validate_binding(value,client)
        else:
            value=validate_inspection(value,versions)
        if any(sha(R/p)!=h for p,h in sources.items()):raise ValueError()
        report.update(result='passed',**{key:value})
    finally:
        out=R/'tracking/evidence/m07/app-oauth'/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{action}-binding.json"
        out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes((json.dumps(report,indent=2)+'\n').encode())
        print(json.dumps({'result':report['result'],'evidence':str(out.relative_to(R)),'unknown_apply_never_repeated':True}))
if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'result':'unverified','raw_diagnostics_suppressed':True,'next_action':'read-only inspect; do not repeat unknown dispatch'}));sys.exit(1)
