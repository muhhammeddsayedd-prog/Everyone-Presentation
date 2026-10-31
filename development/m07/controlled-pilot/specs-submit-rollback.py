"""Root-only inspect/repro. One actual public RPC in a forced rollback block.

No provider or credential IO on import. No issued token, permanent function,
Auth/grant/migration change, COMMIT or automatic RPC replay is supported.
"""
from pathlib import Path
import base64
import datetime
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('specs_rollback_origin',HERE/'future-origin.py')
origin=importlib.util.module_from_spec(spec);spec.loader.exec_module(origin)
ROOT=origin.ROOT
ACTOR='0a79a703-caba-47e5-93d4-42e32197037a'
PROJECT='6da14b82-8458-451f-aa21-28cb6c85bdc5'
WORKSPACE='86936940-b48d-497d-b1ff-8e0da0913afa'
SPEC='3fc9b7a0-1d5d-41c3-8868-dff995ee861c'
DIRECTORY=ROOT/'.local/m07-pilot/specs-submit-rollback'
CLAIM=DIRECTORY/'dispatch.claim.json'
PINS={'SPECS_SUBMIT_SNAPSHOT.sql': 'ef4fdbbdcfcd3c36ed7873c4c2618de6e1ca6dcd4de5118cc5463a018d9a6d9c', 'SPECS_SUBMIT_ROLLBACK.sql': '3c99c8345ad9f7f52ec49a05534655669b0135b97cea0c46347da2ec4e728e22', 'SPECS_SUBMIT_TRUST.json': 'a12a8649fd5ce571eec4562c9455de1360e193ac8b886c4d878a8249bd82b434', 'build_specs_submit_trust.py': '008c29fef79bc70902294ff854b5e5324d4efa01a4dd2ac3ea89d9e873468118', 'fixtures/hosted-core-brief.txt': '2c8ca73ed55801dab5236b01c84ad1ec566e7eb66767e9f333d9a4b2beff3876'}
FINGERPRINTS=('spec','jobs','idempotency','versions','slides','pins','ready_asset_metadata','protected_m02')
OBJECTS={'eps','public','auth','workspaces','projects','project_memberships','app_capability_grants','specs','specs_source_inputs',
         'jobs','outbox_events','idempotency_records','audit_events','has_capability','project_scope','specs_scope','m02_enqueue_specs_job','jobs_dto','uid','jwt'}


def require(value):
    if not value:raise ValueError('SPECS_ROLLBACK_UNCONFIRMED')


def encoded(value):return base64.b64encode(json.dumps(value,separators=(',',':')).encode()).decode()


def snapshot(value):
    origin.exact(value,('database','operator','history','actor_id','project_id','workspace_id','trust','state','fingerprints'))
    require(value['database']==value['operator']=='postgres'and value['history']==list(origin.VERSIONS))
    require((value['actor_id'],value['project_id'],value['workspace_id'])==(ACTOR,PROJECT,WORKSPACE))
    trust=value['trust'];origin.exact(trust,('functions_count','functions_match','triggers_count','triggers_match'))
    require(type(trust['functions_count'])is int and trust['functions_count']==49 and trust['functions_match']is True
            and type(trust['triggers_count'])is int and trust['triggers_count']==4 and trust['triggers_match']is True)
    state=value['state'];origin.exact(state,('spec_count','spec_id','spec_row_version','source_present','workspace_jobs','diagnostic_idempotency'))
    require(state['spec_id']==SPEC and state['source_present']is False)
    for key,expected in [('spec_count',1),('spec_row_version',1),('workspace_jobs',0),('diagnostic_idempotency',0)]:
        require(type(state[key])is int and state[key]==expected)
    origin.exact(value['fingerprints'],FINGERPRINTS)
    for key,item in value['fingerprints'].items():
        origin.exact(item,('count','sha256'));require(type(item['count'])is int and 0<=item['count']<=1000000)
        require(type(item['sha256'])is str and re.fullmatch('[a-f0-9]{64}',item['sha256']))
        if key in('spec','protected_m02'):require(item['count']==1)
        if key in('jobs','idempotency'):require(item['count']==0)
    return value


def outcome(value):
    require(type(value)is dict and value.get('subtransaction_rolled_back')is True)
    if value.get('kind')=='ack':
        origin.exact(value,('kind','subtransaction_rolled_back','ack'));ack=value['ack']
        origin.exact(ack,('job_id','resource_id','poll_url','status'))
        require(type(ack['job_id'])is str and str(uuid.UUID(ack['job_id']))==ack['job_id'] and ack['resource_id']==SPEC)
        require(ack['poll_url']=='/api/v1/jobs/'+ack['job_id']and ack['status']in('queued','running','waiting_for_input','succeeded','failed','cancelled'))
    else:
        origin.exact(value,('kind','subtransaction_rolled_back','sqlstate','permission_denied','permission_object'))
        require(value['kind']=='sql_error'and type(value['sqlstate'])is str and re.fullmatch('[A-Z0-9]{5}',value['sqlstate']))
        require(type(value['permission_denied'])is bool and value['permission_object']in OBJECTS|{None})
    return value


def run_once(io):
    before=io.read();io.claim(before)
    result=None;returned=False
    try:result=outcome(io.execute());returned=True
    except Exception:pass
    after=None
    try:after=io.read()
    except Exception:pass
    equal=after is not None and before==after
    verified=returned and equal
    return {'result':'observed'if verified else'unconfirmed','before':before,'after':after,'outcome':result,
            'selected_state_equal':equal,'rollback_verified':verified,'rpc_dispatch_commands':1,
            'automatic_rpc_retry':False,'claim_retained':True,'cli_return_and_closed_outcome_observed':returned}


def render_repro(template,query,before,fixture):
    text=template
    for marker,value in [('__SNAPSHOT_QUERY__',query),('__BEFORE_B64__',encoded(before)),('__BRIEF_B64__',base64.b64encode(fixture).decode())]:
        require(text.count(marker)==1);text=text.replace(marker,value)
    require('__'not in text and not re.search(r'\bcommit\s*;',text,re.I))
    return text


def source_inputs():
    origin.validate_environment(os.environ)
    blocked={'NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','SUPABASE_DEBUG'}
    require(not any(value for key,value in os.environ.items()if key.upper()in blocked))
    require(len(PINS)==5)
    pins=origin.source_pins()
    files={}
    for name,expected in PINS.items():
        data=origin.public_bytes(HERE/name);require(hashlib.sha256(data).hexdigest()==expected)
        files[name]=data;pins[f'development/m07/controlled-pilot/{name}']=expected
    trust=json.loads(files['SPECS_SUBMIT_TRUST.json'])
    require(trust['schema_version']=='1.0'and trust['external_call_tokens_found']is False and len(trust['functions'])==49 and len(trust['triggers'])==4)
    for name,expected in trust['source_migrations'].items():
        require(re.fullmatch(r'[0-9]{14}_[a-z0-9_]+\.sql',name))
        require(hashlib.sha256(origin.public_bytes(ROOT/'supabase/migrations'/name,2*1024*1024)).hexdigest()==expected)
    fixture=origin.public_bytes(HERE/'fixtures/hosted-core-brief.txt',65536)
    require(len(fixture)==735 and hashlib.sha256(fixture).hexdigest()=='2c8ca73ed55801dab5236b01c84ad1ec566e7eb66767e9f333d9a4b2beff3876')
    pins['public_fixture_sha256']=hashlib.sha256(fixture).hexdigest()
    query=files['SPECS_SUBMIT_SNAPSHOT.sql'].decode()
    for marker,key in [('__FUNCTIONS_B64__','functions'),('__TRIGGERS_B64__','triggers'),('__TABLES_B64__','tables')]:
        require(query.count(marker)==1);query=query.replace(marker,encoded(trust[key]))
    require('__'not in query)
    return pins,files,query.strip().rstrip(';'),fixture


def parse_row(value,key):
    require(type(value)is dict and type(value.get('rows'))is list and len(value['rows'])==1)
    origin.exact(value['rows'][0],(key,));return value['rows'][0][key]


def exclusive(file,data):
    descriptor=os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'wb')as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())


class OperatorIO:
    def __init__(self,pins,files,query,fixture):
        self.pins,self.files,self.query,self.fixture=pins,files,query,fixture;self.before=None;self.calls=0

    def sql(self,text,key):
        require(self.calls<3);self.calls+=1
        require(source_inputs()[0]==self.pins)
        file=DIRECTORY/f'{uuid.uuid4().hex}.sql';exclusive(file,text.encode())
        command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',origin.TARGET,
                 '--file',str(file),'--output-format','json','--workdir',str(ROOT)]
        result=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=45,stdin=subprocess.DEVNULL)
        require(result.returncode==0 and len(result.stdout.encode())<=2*1024*1024 and len(result.stderr.encode())<=1024*1024)
        return parse_row(json.loads(result.stdout),key)

    def read(self):
        return snapshot(self.sql("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='25s';\n"+self.query+';\nrollback;','specs_submit_state'))

    def claim(self,before):
        self.before=before
        exclusive(CLAIM,(json.dumps({'target':origin.TARGET,'actor_id':ACTOR,'workspace_id':WORKSPACE,'before':before,
          'source_pins':self.pins,'claimed_at':origin.stamp(),'rpc_dispatch_may_have_occurred':True})+'\n').encode())

    def execute(self):
        require(self.before is not None)
        text=render_repro(self.files['SPECS_SUBMIT_ROLLBACK.sql'].decode(),self.query,self.before,self.fixture)
        return self.sql(text,'specs_submit_repro')


def main():
    require(len(sys.argv)==2 and sys.argv[1]in('inspect','repro'))
    pins,files,query,fixture=source_inputs()
    DIRECTORY.mkdir(parents=True,exist_ok=True);require(DIRECTORY.resolve()==DIRECTORY and not DIRECTORY.is_symlink())
    io=OperatorIO(pins,files,query,fixture)
    result={'result':'observed','snapshot':io.read(),'rpc_dispatch_commands':0}if sys.argv[1]=='inspect'else run_once(io)
    report={'schema_version':'1.0','observed_at':origin.stamp(),'target':origin.TARGET,'action':sys.argv[1],
            'source_pins':pins,'helper_sha256':hashlib.sha256(origin.public_bytes(Path(__file__))).hexdigest(),**result,
            'maximum_cli_commands':3,'temporary_invoker_function_only':True,'commit_supported':False,
            'issued_token_auth_grant_or_migration_mutation':False,'raw_source_tokens_or_cli_diagnostics_persisted':False,
            'scope':'Actual fixed public RPC under modeled existing actor; forced subtransaction and outer rollback; selected preservation only, no hosted HTTP/provider acceptance'}
    path=ROOT/'tracking/evidence/m07/controlled-pilot'/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-specs-submit-{sys.argv[1]}.json"
    exclusive(path,(json.dumps(report,indent=2)+'\n').encode())
    print(json.dumps({'receipt':path.relative_to(ROOT).as_posix(),'result':report['result'],'rollback_verified':report.get('rollback_verified',False)}))
    return 0 if report['result']=='observed'else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","raw_diagnostics_suppressed":true,"automatic_rpc_retry":false}');sys.exit(1)
