"""Read-only exact-target OAuth catalogue probe; never loads credentials itself.

The existing pinned CLI uses its existing protected session. Raw CLI diagnostics
stay in memory. Only the closed catalogue JSON query result can be persisted.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import subprocess
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse'
SQL=HERE/'discovery.sql'
FORBIDDEN={'SUPABASE_PROJECT_ID','SUPABASE_PROJECT_REF','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL','DATABASE_URL',
 'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGSSLMODE',
 'PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION','NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED',
 'NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'}

def environment(value):
    if any(v for k,v in value.items()if k.upper()in FORBIDDEN):raise ValueError('CONSENT_DISCOVERY_ENVIRONMENT_UNCONFIRMED')
    return {k:v for k,v in value.items()if 'DEBUG'not in k.upper()}

def query_command():
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(SQL),'--output-format','json','--workdir',str(ROOT)]

def parse(value):
    rows=value if type(value)is list else value.get('rows')if type(value)is dict else None
    if type(rows)is not list or len(rows)!=1 or set(rows[0])!={'oauth_consent_catalogue'}:raise ValueError('CONSENT_DISCOVERY_RESPONSE_UNCONFIRMED')
    result=rows[0]['oauth_consent_catalogue']
    if type(result)is not dict or set(result)!={'database','operator','observed_at','history','history_columns','relations','roles','required_functions'}or result['database']!='postgres'or result['operator']!='postgres':raise ValueError('CONSENT_DISCOVERY_RESPONSE_UNCONFIRMED')
    if {(v['schema'],v['name'])for v in result['relations']}!={('auth','sessions'),('auth','oauth_authorizations'),('auth','oauth_clients'),('eps','mcp_oauth_resources')}:raise ValueError('CONSENT_DISCOVERY_RELATIONS_UNCONFIRMED')
    return result

def main():
    if len(sys.argv)!=1:raise ValueError('CONSENT_DISCOVERY_NO_ARGUMENTS')
    if(ROOT/'supabase/.temp/project-ref').read_text().strip()!=TARGET:raise ValueError('CONSENT_DISCOVERY_TARGET_UNCONFIRMED')
    env=environment(os.environ)
    run=subprocess.run(query_command(),cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=45,stdin=subprocess.DEVNULL)
    if run.returncode or len(run.stdout.encode())>256*1024 or len(run.stderr.encode())>64*1024:raise ValueError('CONSENT_DISCOVERY_CLI_UNCONFIRMED')
    data=parse(json.loads(run.stdout))
    receipt={'schema_version':'1.0','evidence_kind':'actual_metadata_only_read','target':TARGET,'query_sha256':hashlib.sha256(SQL.read_bytes()).hexdigest(),'raw_cli_diagnostics_persisted':False,'catalogue':data}
    out=ROOT/'tracking/evidence/m07/oauth-consent-fix'
    out.mkdir(parents=True,exist_ok=True)
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')
    path=out/(stamp+'-catalogue.json')
    with path.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'result':'passed','receipt':path.relative_to(ROOT).as_posix(),'metadata_only':True,'auth_or_business_rows_read':False}))

if __name__=='__main__':
    try:main()
    except Exception:print('CONSENT_DISCOVERY_UNCONFIRMED');sys.exit(1)
