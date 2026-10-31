"""Fixed hosted MCP registry binding after actual core and public-client proof.

Root executes. Imports only public source; no credentials, CLI, provider or DB
access on import. Existing local helpers remain separate. No Auth/enrollment or
capability write exists here; unknown insert outcomes only read back.
"""
from pathlib import Path, PurePosixPath
import copy
import datetime
import importlib.util
import json
import os
import re
import subprocess
import sys
import uuid

HERE=Path(__file__).resolve().parent
def public_module(name,file):
    spec=importlib.util.spec_from_file_location(name,file)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
origin=public_module('hosted_binding_common',HERE/'future-origin.py')
client=public_module('hosted_binding_client_schema',HERE/'hosted-oauth-client.py')
ROOT=origin.ROOT
HOST='https://everyone-presentation-pilot.vercel.app'
RESOURCE=HOST+'/mcp'
ISSUER='https://pyibofyctwnqpvktepse.supabase.co/auth/v1'
WEB_PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0'
CORE_FILE=ROOT/'tracking/evidence/m07/controlled-pilot/HOSTED_CORE.json'
CORE_CHECKS=('projects','settings','processing','specs_openai_n8n','video_openai_n8n','native_frames','selection_pdf','guest_feedback','guest_original_video')
CLIENT_SHA='c3be05e05d9bf9c80bad906903007ee9fbcc663c0c0eeb79efc0d877c17d22e2'
PLAN_SHA='f8c8b4cbf63b5a114f5f25810965c42d4c03d958b109ea490ba86ee8d22d27c8'
PINS={'development/m07/controlled-pilot/future-origin.py':'7d15c917bd781fd89a75e3efe36c561d9933ba64e3309b583c04b7ba5accee44',
      'development/m07/controlled-pilot/hosted-oauth-client.py':CLIENT_SHA,
      'development/m07/controlled-pilot/hosted-oauth-plan.mjs':PLAN_SHA,
      'development/m07/controlled-pilot/HOSTED_BINDING.sql':'fa526a53715e058a9770ecd7b0f4bdb52cfda2bbf83538c5cd418b0e6fc59ce4',
      'development/m07/controlled-pilot/HOSTED_BINDING_READBACK.sql':'0f5bfc2a4fe68c3993824d0cd760316be154a654a3b74d169269c4b7b0d95af7'}
HOOK_CHECKS={'owner_and_body','auth_admin_execute','no_public_client_execute','auth_admin_schema','auth_admin_no_other_eps_execute',
             'no_issuer_schema_create','registry_forced_rls','capability_forced_rls'}
CAPABILITIES={'projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review',
              'presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry'}
PRIVATE=ROOT/'.local/m07-pilot/hosted-binding'
CLAIM=PRIVATE/'apply.claim.json'


def require(value):
    if not value:raise ValueError('HOSTED_BINDING_UNCONFIRMED')


def receipt_path(value):
    require(type(value) is str and len(value)<=300 and value.startswith('tracking/evidence/m07/controlled-pilot/')
            and re.fullmatch('[A-Za-z0-9_./+-]+[.]json',value) and '..' not in PurePosixPath(value).parts
            and not PurePosixPath(value).is_absolute() and '\\' not in value and ':' not in value)
    return ROOT/value


def validate_core(value):
    origin.exact(value, ('schema_version','result','target','origin','web_project_id','web_deployment_id','acting_user_id','core_checks','evidence_receipts'))
    require(value['schema_version']=='1.0' and value['result']=='passed' and value['target']==origin.TARGET
            and value['origin']==HOST and value['web_project_id']==WEB_PROJECT)
    require(type(value['web_deployment_id']) is str and re.fullmatch('dpl_[A-Za-z0-9]{8,100}',value['web_deployment_id']))
    origin.canonical_uuid(value['acting_user_id']);origin.exact(value['core_checks'],CORE_CHECKS)
    require(all(result=='passed' for result in value['core_checks'].values()))
    receipts=value['evidence_receipts'];require(type(receipts) is list and 1<=len(receipts)<=128 and all(type(item) is str for item in receipts))
    require(len(set(receipts))==len(receipts))
    for item in receipts:require(receipt_path(item)!=CORE_FILE)
    return copy.deepcopy(value)


def validate_provider_receipt(value,client_id,now=None):
    origin.canonical_uuid(client_id)
    try:client.validate_public_receipt(value,require_actual=True)
    except Exception:raise ValueError('HOSTED_BINDING_UNCONFIRMED') from None
    require(value['client']['client_id']==client_id and value['client_secret_observed'] is False
            and value['source_pins']=={'helper_sha256':CLIENT_SHA,'plan_sha256':PLAN_SHA})
    now=datetime.datetime.now(datetime.timezone.utc) if now is None else now
    require(isinstance(now,datetime.datetime) and now.utcoffset()==datetime.timedelta(0))
    finished=datetime.datetime.fromisoformat(value['finished_at']);started=datetime.datetime.fromisoformat(value['observed_at'])
    require(0<=(now-finished).total_seconds()<=3600 and 0<=(finished-started).total_seconds()<=900)
    return copy.deepcopy(value)


def validate_protected(value):
    origin.exact(value, ('versions','slides','pins','ready_asset_metadata','protected_m02','grants','settings'))
    origin.validate_metadata({key:value[key] for key in ('versions','slides','pins','ready_asset_metadata','protected_m02')})
    for key in ('grants','settings'):
        origin.exact(value[key], ('count','sha256'));origin.integer(value[key]['count'],1)
        require(type(value[key]['sha256']) is str and re.fullmatch('[a-f0-9]{64}',value[key]['sha256']))


def validate_capabilities(value):
    require(type(value) is list and all(type(item) is str and item in CAPABILITIES for item in value)
            and sorted(set(value))==value and {'workspaces.read','cast.read'}<=set(value))


def validate_hook(value):
    origin.exact(value,HOOK_CHECKS);require(all(flag is True for flag in value.values()))


def expected_binding(client_id):
    origin.canonical_uuid(client_id);return {'resource':RESOURCE,'client_id':client_id,'enabled':True}


def validate_state(value,client_id,actor,require_empty=False):
    origin.canonical_uuid(actor);expected=expected_binding(client_id)
    origin.exact(value, ('database','operator','history','registry_trigger_count','bindings','acting_user_id','producer_capabilities','hook_security','protected_metadata'))
    require(value['database']==value['operator']=='postgres' and value['history']==list(origin.VERSIONS)
            and type(value['registry_trigger_count']) is int and value['registry_trigger_count']==0 and value['acting_user_id']==actor)
    require(type(value['bindings']) is list and (value['bindings']==[] or value['bindings']==[expected]))
    if value['bindings']:
        origin.exact(value['bindings'][0], ('resource','client_id','enabled'));require(value['bindings'][0]['enabled'] is True)
    if require_empty:require(value['bindings']==[])
    validate_capabilities(value['producer_capabilities']);validate_hook(value['hook_security']);validate_protected(value['protected_metadata'])
    return copy.deepcopy(value)


def validate_update(value,client_id,actor):
    origin.exact(value, ('resource','client_id','enabled','inserted_rows','acting_user_id','producer_capabilities','hook_security','protected_metadata','business_and_hook_state_preserved'))
    require({key:value[key] for key in ('resource','client_id','enabled')}==expected_binding(client_id) and value['enabled'] is True
            and type(value['inserted_rows']) is int and value['inserted_rows']==1 and value['acting_user_id']==actor
            and value['business_and_hook_state_preserved'] is True)
    validate_capabilities(value['producer_capabilities']);validate_hook(value['hook_security']);validate_protected(value['protected_metadata'])
    return copy.deepcopy(value)


def preserved(before,after,client_id):
    if before is None or after is None:return False
    expected=copy.deepcopy(before);expected['bindings']=[expected_binding(client_id)];return expected==after


def read_pair(io,client_id,actor):
    result=[]
    for _ in range(2):
        try:result.append(validate_state(io.readback(),client_id,actor))
        except Exception:result.append(None)
    return result


def readback_result(before,after,independent,client_id):
    equal=after is not None and independent is not None and after==independent
    observed=equal and after['bindings']==[expected_binding(client_id)]
    intact=preserved(before,after,client_id) and preserved(before,independent,client_id) if before is not None else None
    verified=before is not None and before['bindings']==[] and observed and intact is True
    return {'result':'passed' if verified else 'unconfirmed','binding_observed':observed,'application_verified_by_readback':verified,
            'business_and_hook_state_preserved':intact,'original_baseline_available':before is not None,
            'independent_readback_equal':equal,'after':after,'independent_readback':independent,'automatic_dispatch_retry':False}


def apply_once(io,client_id,actor):
    before=validate_state(io.readback(),client_id,actor);io.verify_sources()
    if before['bindings']:
        after,independent=read_pair(io,client_id,actor)
        return {**readback_result(None,after,independent,client_id),'dispatch_attempted':False,'existing_binding_readback_only':True}
    try:io.claim({'target':origin.TARGET,'resource':RESOURCE,'client_id':client_id,'acting_user_id':actor,'before':before,
                  'claimed_at':origin.stamp(),'dispatch_may_have_occurred':True})
    except Exception:raise ValueError('HOSTED_BINDING_UNCONFIRMED') from None
    fresh=validate_state(io.readback(),client_id,actor,require_empty=True);require(fresh==before);io.verify_sources()
    update=None;outcome='unconfirmed'
    try:update=validate_update(io.dispatch(),client_id,actor);outcome='command_succeeded'
    except Exception:pass
    after,independent=read_pair(io,client_id,actor);result=readback_result(before,after,independent,client_id)
    if update is not None and (update['protected_metadata']!=before['protected_metadata'] or update['producer_capabilities']!=before['producer_capabilities']
                               or update['hook_security']!=before['hook_security']):
        result['result']='unconfirmed';result['application_verified_by_readback']=False
    try:io.verify_sources()
    except Exception:result['result']='unconfirmed';result['application_verified_by_readback']=False
    return {**result,'before':before,'dispatch_attempted':True,'dispatch_outcome':outcome,'update_result_verified':update is not None,'claim_retained':True}


def render_sql(template,client_id,actor,update=False):
    origin.canonical_uuid(actor);origin.canonical_uuid(client_id)
    require(type(template) is str and template.count('__ACTING_USER_UUID__')==1 and template.count('__CLIENT_UUID__')==(1 if update else 0))
    return template.replace('__ACTING_USER_UUID__',actor).replace('__CLIENT_UUID__',client_id)


def strict_json(data):
    def pairs(items):
        value={}
        for key,item in items:require(key not in value);value[key]=item
        return value
    try:return json.loads(data,object_pairs_hook=pairs)
    except Exception:raise ValueError('HOSTED_BINDING_UNCONFIRMED') from None


def inputs(client_id,provider_relative):
    origin.validate_environment(os.environ);origin.canonical_uuid(client_id)
    provider_file=receipt_path(provider_relative)
    require(re.fullmatch(r'tracking/evidence/m07/controlled-pilot/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}(?:-[0-9]{6})?\+00-00-[a-f0-9]{8}-hosted-oauth-client-(inspect|create|readback)[.]json',provider_relative))
    pins=origin.source_pins()
    for relative,expected in PINS.items():
        actual=origin.digest(origin.public_bytes(ROOT/relative));require(actual==expected);pins[relative]=actual
    pins['development/m07/controlled-pilot/hosted-binding.py']=origin.digest(origin.public_bytes(Path(__file__).resolve()))
    core_bytes=origin.public_bytes(CORE_FILE);core=validate_core(strict_json(core_bytes))
    pins[CORE_FILE.relative_to(ROOT).as_posix()]=origin.digest(core_bytes)
    for relative in core['evidence_receipts']:
        # Root's public metadata receipts only. Preserve their bytes/stats seal;
        # never copy their contents or read auth/private filesystem locations.
        data=origin.public_bytes(receipt_path(relative),2*1024*1024);require(type(strict_json(data)) is dict);pins[relative]=origin.digest(data)
    provider_bytes=origin.public_bytes(provider_file);provider=validate_provider_receipt(strict_json(provider_bytes),client_id)
    require(provider_relative.endswith('-hosted-oauth-client-'+provider['action']+'.json'))
    pins[provider_relative]=origin.digest(provider_bytes)
    return pins,core,provider


def prepare_queries(client_id,actor):
    PRIVATE.mkdir(parents=True,exist_ok=True);require(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink())
    result={}
    for mode,name in [('update','HOSTED_BINDING.sql'),('readback','HOSTED_BINDING_READBACK.sql')]:
        data=render_sql(origin.public_bytes(HERE/name).decode('utf8'),client_id,actor,update=mode=='update').encode()
        file=PRIVATE/(mode+'.sql')
        if file.exists():require(origin.public_bytes(file)==data)
        else:
            with file.open('xb') as handle:handle.write(data);handle.flush();os.fsync(handle.fileno())
        result[mode]=origin.digest(data)
    return result


def query_command(mode):
    require(mode in ('readback','update'))
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',origin.TARGET,'--file',str(PRIVATE/(mode+'.sql')),
            '--output-format','json','--workdir',str(ROOT)]


def query(mode):
    result=subprocess.run(query_command(mode),cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=90,stdin=subprocess.DEVNULL)
    require(result.returncode==0 and len(result.stdout.encode())<=2*1024*1024 and len(result.stderr.encode())<=1024*1024)
    value=strict_json(result.stdout);key='hosted_binding_'+('readback' if mode=='readback' else 'update')
    require(type(value) is dict and type(value.get('rows')) is list and len(value['rows'])==1)
    origin.exact(value['rows'][0], (key,));return value['rows'][0][key]


class OperatorIO:
    def __init__(self,client_id,provider_relative,pins,core,provider,queries):
        self.client_id,self.provider_relative,self.pins,self.core,self.provider,self.queries=client_id,provider_relative,pins,core,provider,queries
    def verify_sources(self):
        require(inputs(self.client_id,self.provider_relative)==(self.pins,self.core,self.provider))
        for mode,expected in self.queries.items():require(origin.digest(origin.public_bytes(PRIVATE/(mode+'.sql')))==expected)
    def readback(self):return query('readback')
    def dispatch(self):self.verify_sources();return query('update')
    def claim(self,value):
        require(PRIVATE.resolve()==PRIVATE)
        descriptor=os.open(CLAIM,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(descriptor,'w',encoding='utf8',newline='\n') as handle:
            handle.write(json.dumps({**value,'sources':self.pins,'provider_receipt':self.provider_relative,'rendered_queries':self.queries},sort_keys=True)+'\n')
            handle.flush();os.fsync(handle.fileno())


def main():
    require(len(sys.argv)==4 and sys.argv[1] in ('inspect','apply','readback'))
    action,client_id,provider_relative=sys.argv[1:];pins,core,provider=inputs(client_id,provider_relative);actor=core['acting_user_id']
    queries=prepare_queries(client_id,actor);io=OperatorIO(client_id,provider_relative,pins,core,provider,queries)
    if action=='apply':result=apply_once(io,client_id,actor)
    elif action=='inspect':result={'result':'passed','dispatch_attempted':False,'inspection':validate_state(io.readback(),client_id,actor),
                                  'scope':'Read-only current registry/hook/business metadata; no binding application credited'}
    else:
        after,independent=read_pair(io,client_id,actor);before=None
        if CLAIM.exists():
            claim=strict_json(origin.public_bytes(CLAIM));origin.exact(claim, ('target','resource','client_id','acting_user_id','before','claimed_at',
                'dispatch_may_have_occurred','sources','provider_receipt','rendered_queries'))
            require(claim['target']==origin.TARGET and claim['resource']==RESOURCE and claim['client_id']==client_id and claim['acting_user_id']==actor
                    and claim['sources']==pins and claim['provider_receipt']==provider_relative and claim['rendered_queries']==queries
                    and claim['dispatch_may_have_occurred'] is True)
            before=validate_state(claim['before'],client_id,actor,require_empty=True)
        result={**readback_result(before,after,independent,client_id),'dispatch_attempted':False}
    io.verify_sources()
    report={'schema_version':'1.0','observed_at':origin.stamp(),'action':action,'target':origin.TARGET,'resource':RESOURCE,'client_id':client_id,
            'acting_user_id':actor,'provider_receipt':provider_relative,'sources':pins,'rendered_queries':queries,**result,
            'auth_enrollment_capability_or_provider_configuration_writes':False,'raw_cli_or_credentials_persisted':False,
            'oauth_issuance_or_claude_login_proved':False}
    directory=ROOT/'tracking/evidence/m07/controlled-pilot';directory.mkdir(parents=True,exist_ok=True)
    file=directory/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-hosted-binding-{action}.json"
    with file.open('x',encoding='utf8',newline='\n') as handle:handle.write(json.dumps(report,indent=2)+'\n');handle.flush();os.fsync(handle.fileno())
    print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'dispatch_attempted':report['dispatch_attempted'],
                      'automatic_dispatch_retry':False,'raw_diagnostics_suppressed':True}))
    return 0 if report['result']=='passed' else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:
        print(json.dumps({'result':'unconfirmed','raw_diagnostics_suppressed':True,'next_action':'inspect/readback only; never replay an unknown binding insert'}));sys.exit(1)
