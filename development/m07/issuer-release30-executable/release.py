"""Fixed once-only canonical29->30 release. Importing and pure guards are inert.

Root owns execution after exact source review. No target/SQL/credential/reset/
seed/force argument. Unknown dispatch uses readback only, never another push.
"""
from pathlib import Path, PurePosixPath
import copy
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tomllib
import uuid

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
TARGET='pyibofyctwnqpvktepse'
CANDIDATE_SHA='e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785'
BASE='tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-31-12-986032Z-b19aca5b-canonical-discovery.json'
BASE_SHA='7aab9fc8b793504999e3987750cc81aa69a73f7035a8cbcbac9abbd8c77fd0dc'
PROOF='tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-54-37-082Z-36b1483b-local-proof.json'
PROOF_SHA='6af3eb1319c3959ccb34f2c7afc80b71a52919cb4dd1f2c16344ff9d3a17e70c'
DELTA_SHA='79a372de1167e14d8d5d601c290e2684fb8f93e53b678e8d131f40bcfc49787c'
QUERY_SHA='5a30e3bf2bb17f32c932dad9bfac71f8162ff552ae9f12ef05ec6e03aef10f6f'
PLAN_SHA='f723eb36f05ecf8e668d2da57cb7ecfe70a47e5a662ee112e68b504ac798ade4'
AREA=ROOT/'tracking/evidence/m07/issuer-release30-executable'
PRIVATE=ROOT/'.local/m07-issuer30-release'
CLAIM=PRIVATE/'dispatch-claim.json'
QUIESCENCE=HERE/'quiescence.json'
FLAGS=('login','super','inherit','bypassrls','create_role','create_db','replication')
ROLE_KEYS={'name','oid',*FLAGS,'connection_limit','valid_until'}

def require(value):
    if not value:raise ValueError('ISSUER30_FIXED_RELEASE_GUARD_REQUIRED')

def stamp():return datetime.datetime.now(datetime.timezone.utc)
def sha(value):return hashlib.sha256(value).hexdigest()
def canonical(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())

def timestamp(value):
    try:result=value if isinstance(value,datetime.datetime) else datetime.datetime.fromisoformat(value) if type(value)is str else None
    except ValueError:result=None
    require(result is not None and result.tzinfo is not None and result.utcoffset() is not None)
    return result

def oid(value):
    require(type(value)in(int,str) and(type(value)is int or re.fullmatch(r'[1-9][0-9]{0,9}',value)is not None))
    number=int(value);require(0<number<=4294967295);return number

def validate_plan(plan):
    require(type(plan)is dict and set(plan)=={'schema_version','version','migration_path','migration_sha256','candidate_sha256','cli_version'})
    require(plan['schema_version']=='1.0'and plan['cli_version']=='2.122.0')
    require(type(plan['version'])is str and re.fullmatch(r'[0-9]{14}',plan['version'])is not None and plan['version']>'20261030111549')
    require(plan['migration_path']==f"supabase/migrations/{plan['version']}_m07_native_oauth_issuer.sql")
    require(plan['candidate_sha256']==plan['migration_sha256']==CANDIDATE_SHA)
    return plan

def validate_role_preservation(before,after,observed_at,allow_new_issuer=False):
    require(type(before)is list and type(after)is list and type(allow_new_issuer)is bool)
    def index(values):
        result={};ids=set()
        for item in values:
            require(type(item)is dict and set(item)==ROLE_KEYS and type(item['name'])is str and item['name']not in result)
            number=oid(item['oid']);require(number not in ids);ids.add(number)
            require(all(type(item[k])is bool for k in FLAGS));result[item['name']]=item
        return result
    old,new=index(before),index(after);require(set(old)<=set(new));extra=set(new)-set(old)
    require(extra==({'eps_mcp_issuer_owner'}if allow_new_issuer else set()))
    observed=timestamp(observed_at);qualifications=[]
    for name,original in old.items():
        actual=new[name];require(oid(original['oid'])==oid(actual['oid']))
        a,b=copy.deepcopy(original),copy.deepcopy(actual);a['oid']=b['oid']=oid(a['oid'])
        if name=='cli_login_postgres'and a['valid_until']!=b['valid_until']:
            end=timestamp(b['valid_until']);require(observed<=end<=observed+datetime.timedelta(minutes=10))
            if a['valid_until']is not None:require(end>=timestamp(a['valid_until']))
            qualifications.append({'name':name,'field':'valid_until','before':a['valid_until'],'after':b['valid_until'],
                'scope':'only CLI-managed short-login expiry; raw evidence retained, all other role attributes/OIDs exact'})
            b['valid_until']=a['valid_until']
        require(a==b)
    if extra:
        role=new['eps_mcp_issuer_owner'];require(all(role[k]is False for k in FLAGS))
        require(role['connection_limit']==-1 and role['valid_until']is None)
    return qualifications

def validate_quiescence_receipt(value,now):
    require(type(value)is dict and set(value)=={'schema_version','observed_at','target','owned_processes_verified','web_stopped','worker_stopped','owned_pids','ownership_evidence'})
    require(value['schema_version']=='1.0'and value['target']==TARGET)
    require(all(value[key]is True for key in['owned_processes_verified','web_stopped','worker_stopped']))
    require(0<=(timestamp(now)-timestamp(value['observed_at'])).total_seconds()<=900)
    pids=value['owned_pids'];require(type(pids)is list and 1<=len(pids)<=32)
    require(all(type(pid)is int and 0<pid<=2147483647 for pid in pids)and len(set(pids))==len(pids))
    file=value['ownership_evidence'];require(type(file)is str and file.startswith('.local/')and'\\'not in file and':'not in file and'..'not in PurePosixPath(file).parts and len(PurePosixPath(file).parts)>1)

def sealed(file,digest):
    require(type(file)is str and not PurePosixPath(file).is_absolute()and'\\'not in file and':'not in file and'..'not in PurePosixPath(file).parts)
    require(type(digest)is str and re.fullmatch(r'[a-f0-9]{64}',digest)is not None)
    path=ROOT/file;require(path.resolve()==path and path.resolve().is_relative_to(ROOT)and path.is_file()and not path.is_symlink())
    data=path.read_bytes();require(sha(data)==digest);return data

def validate_claim(claim):
    require(type(claim)is dict and set(claim)=={'target','plan','before_sha256','attempt_receipt','attempt_sha256','dispatch_may_have_occurred'})
    require(claim['target']==TARGET and claim['dispatch_may_have_occurred']is True);validate_plan(claim['plan'])
    for key in('before_sha256','attempt_sha256'):require(type(claim[key])is str and re.fullmatch(r'[a-f0-9]{64}',claim[key])is not None)
    require(type(claim['attempt_receipt'])is str and re.fullmatch(r'tracking/evidence/m07/issuer-release30-executable/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{6}Z-[a-f0-9]{8}-canonical-apply-attempt[.]json',claim['attempt_receipt'])is not None)

def private_write(file,data):
    sys.path.insert(0,str(ROOT/'tools'))
    from provision_logo_verifier import WindowsPrivateFiles
    PRIVATE.mkdir(parents=True,exist_ok=True);security=WindowsPrivateFiles()
    with security.create(file)as handle:
        handle.write(data);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)

def call(arguments):
    sys.path.insert(0,str(ROOT/'tools'))
    from release_foundation import call as pinned_cli
    label=stamp().strftime('%Y%m%dT%H%M%S%f')+'-'+uuid.uuid4().hex[:8]
    try:result=pinned_cli(arguments)
    except subprocess.TimeoutExpired as error:
        for stream in('stdout','stderr'):
            data=getattr(error,stream,None)or b'';private_write(PRIVATE/(label+'.'+stream),data.encode()if type(data)is str else data)
        raise ValueError('ISSUER30_DISPATCH_OR_QUERY_UNCONFIRMED')from None
    for stream in('stdout','stderr'):private_write(PRIVATE/(label+'.'+stream),getattr(result,stream).encode())
    require(len(result.stdout.encode())<=16*1024*1024 and len(result.stderr.encode())<=1024*1024)
    return result

def load_inputs():
    sys.path.insert(0,str(HERE))
    from discovery import validate_environment
    validate_environment(os.environ)
    plan=validate_plan(json.loads(sealed('development/m07/issuer-release30-executable/release-plan.json',PLAN_SHA)))
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text());require(config['db']['migrations']['enabled']is True and config['db']['seed']['enabled']is False)
    manifest=json.loads((ROOT/'development/local-db/reviewed.json').read_text());require(len(manifest['migrations'])==29)
    expected=[Path(item['path']).name for item in manifest['migrations']]+[Path(plan['migration_path']).name]
    require(sorted(p.name for p in(ROOT/'supabase/migrations').glob('*.sql'))==expected)
    for item in manifest['migrations']:sealed(item['path'],item['sha256'])
    sealed(plan['migration_path'],CANDIDATE_SHA);sealed('development/m07/issuer-release30-executable/candidate.sql',CANDIDATE_SHA)
    base=json.loads(sealed(BASE,BASE_SHA));proof=json.loads(sealed(PROOF,PROOF_SHA));require(proof['result']=='passed')
    for flag in['after_ddl_rollback_exact','after_history_rollback_exact','precommit_nine_stages_passed','committed_history_and_new_objects','effective_privileges_and_existing_roles_preserved','postcommit_nine_stages_passed','forward_fix_restores_exact_database_surface_history_retained','actual_owned_database_absent','actual_new_role_absent','original29_full_catalogue_data_settings_roles_oids_memberships_exact','shared_lock_released','sources_stable']:require(proof[flag]is True)
    require(proof['cloud_called']is False and proof['provider_called']is False and proof['automatic_retry']is False)
    for file,digest in proof['source_seals'].items():sealed(file,digest)
    delta=json.loads(sealed('development/m07/issuer-release30-executable/expected-delta.json',DELTA_SHA))
    require(delta['deleted']=={} and len(delta['created'])==42 and len(delta['changed'])==8)
    query='development/m07/issuer-release30-executable/discover.sql';sealed(query,QUERY_SHA)
    sources={file:sha(path.read_bytes())for file,path in[(str(HERE.relative_to(ROOT)).replace('\\','/')+'/'+name,HERE/name)for name in['release.py','test_release.py','test_release_payload.py','test_release_claim.py','discovery.py','release-plan.json','expected-delta.json']]}
    sources.update({'supabase/config.toml':sha((ROOT/'supabase/config.toml').read_bytes()),'development/local-db/reviewed.json':sha((ROOT/'development/local-db/reviewed.json').read_bytes()),
        'tools/release_foundation.py':sha((ROOT/'tools/release_foundation.py').read_bytes()),'tools/provision_logo_verifier.py':sha((ROOT/'tools/provision_logo_verifier.py').read_bytes()),'tools/release_m07_29.py':sha((ROOT/'tools/release_m07_29.py').read_bytes())})
    return{'plan':plan,'base':base['discovery'],'delta':delta,'sources':sources,'query':query}

def query_state(inputs):
    sealed(inputs['query'],QUERY_SHA)
    r=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/inputs['query']),'--output-format','json']);require(r.returncode==0)
    rows=json.loads(r.stdout)['rows'];require(type(rows)is list and len(rows)==1 and set(rows[0])=={'issuer30_discovery'})
    state=rows[0]['issuer30_discovery'];validate_query_shape(state)
    return state

def validate_query_shape(state):
    require(type(state)is dict and set(state)=={'catalog','context','admission','protected_data'})
    require(all(type(state[key])is dict for key in state))
    require(set(state['context'])=={'database','operator','unrestricted_visibility','migration_versions','issuer_role_exists','issuer_function_count','issuer_policy_count','all_roles','all_memberships','settings','registry_count','effective_privileges'})
    require(set(state['admission'])=={'query_role','database','unrestricted_visibility','runtime','protected_m02','active_jobs','leased_outbox'})
    require(set(state['protected_data'])=={'counts','hashes','managed_auth','versions'})
    context=state['context'];require(type(context['all_roles'])is list and type(context['all_memberships'])is list)
    identities={}
    for role in context['all_roles']:
        require(type(role)is dict and set(role)==ROLE_KEYS and type(role['name'])is str and role['name']not in identities)
        identities[role['name']]=oid(role['oid'])
    require(len(set(identities.values()))==len(identities))
    edges=set()
    for membership in context['all_memberships']:
        require(type(membership)is dict and set(membership)=={'role','member','grantor','role_oid','member_oid','grantor_oid','admin','inherit','set'})
        for key in('role','member','grantor'):require(type(membership[key])is str and membership[key]in identities and oid(membership[key+'_oid'])==identities[membership[key]])
        require(all(type(membership[key])is bool for key in('admin','inherit','set')))
        edge=tuple(membership[key]for key in('role','member','grantor'));require(edge not in edges);edges.add(edge)
    privileges=context['effective_privileges'];require(type(privileges)is dict and'supabase_auth_admin'in privileges)
    inventory=privileges['supabase_auth_admin'];require(type(inventory)is dict and set(inventory)=={'schemas','functions','tables','columns'})
    for role_name,role in privileges.items():
        require(role_name in identities)
        require(type(role)is dict and set(role)=={'schemas','functions','tables','columns'})
        for category,fields in [('schemas',{'usage','create'}),('functions',{'execute','schema_usage'}),('tables',{'select','insert','update','delete','truncate','references','trigger','schema_usage'}),('columns',{'select','insert','update','references'})]:
            require(type(role[category])is dict and type(inventory[category])is dict and set(role[category])==set(inventory[category]))
            require(all(type(value)is dict and set(value)==fields and all(type(flag)is bool for flag in value.values())for value in role[category].values()))

def validate_before(inputs,state,observed):
    base=inputs['base'];require(state['catalog']==base['catalog']and state['protected_data']==base['protected_data'])
    a,b=state['context'],base['context'];require(a['database']==a['operator']=='postgres'and a['unrestricted_visibility']is True)
    for key in['migration_versions','settings','registry_count','issuer_role_exists','issuer_function_count','issuer_policy_count','all_memberships','effective_privileges']:require(a[key]==b[key])
    qualification=validate_role_preservation(b['all_roles'],a['all_roles'],observed)
    require(state['admission']==base['admission']);return qualification

def validate_attempt(inputs,claim,attempt):
    validate_claim(claim)
    require(type(attempt)is dict and set(attempt)=={'schema_version','action','target','started_at','result','dispatch_attempted','automatic_retry','provider_hook_client_or_identity_mutations','seeds','vault_sync','claude_config_login_or_model_calls','raw_diagnostics_suppressed','plan','source_seals','cli_login_expiry_qualifications','before','quiescence'})
    require(attempt['schema_version']=='1.0'and attempt['action']=='apply'and attempt['target']==TARGET and attempt['result']=='failed')
    require(all(attempt[key]is False for key in('dispatch_attempted','automatic_retry','provider_hook_client_or_identity_mutations','seeds','vault_sync','claude_config_login_or_model_calls'))and attempt['raw_diagnostics_suppressed']is True)
    require(attempt['plan']==claim['plan']==inputs['plan']and attempt['source_seals']==inputs['sources'])
    started=timestamp(attempt['started_at']);validate_quiescence_receipt(attempt['quiescence'],started)
    validate_query_shape(attempt['before']);require(canonical(attempt['before'])==claim['before_sha256'])
    require(validate_before(inputs,attempt['before'],started)==attempt['cli_login_expiry_qualifications'])

def compare_after(inputs,before,after,observed):
    delta=inputs['delta'];expected=copy.deepcopy(before['catalog'])
    for key,entry in delta['changed'].items():require(expected[key]==entry['before']);expected[key]=entry['after']
    for key,value in delta['created'].items():require(key not in expected);expected[key]=value
    require(after['catalog']==expected)
    olddata=copy.deepcopy(before['protected_data']);olddata['versions'].append(inputs['plan']['version']);require(after['protected_data']==olddata)
    a,b=after['context'],before['context'];require(a['database']==a['operator']=='postgres'and a['unrestricted_visibility']is True)
    require(a['migration_versions']==b['migration_versions']+[inputs['plan']['version']])
    require(a['settings']==b['settings']and a['registry_count']==b['registry_count']==0)
    require(a['issuer_role_exists']is True and a['issuer_function_count']==1 and a['issuer_policy_count']==2)
    qualification=validate_role_preservation(b['all_roles'],a['all_roles'],observed,allow_new_issuer=True)
    oldmembers=[m for m in a['all_memberships']if m['role']!='eps_mcp_issuer_owner'and m['member']!='eps_mcp_issuer_owner'and m['grantor']!='eps_mcp_issuer_owner'];require(oldmembers==b['all_memberships'])
    newmembers=[{k:v for k,v in m.items()if k not in('role_oid','member_oid','grantor_oid')}for m in a['all_memberships']if'eps_mcp_issuer_owner'in(m['role'],m['member'],m['grantor'])]
    require(sorted(newmembers,key=lambda m:m['grantor'])==sorted(delta['provenance']['new_role_memberships'],key=lambda m:m['grantor']))
    require(after['admission']==before['admission'])
    e=a['effective_privileges'];hook='eps.mcp_custom_access_token_hook(jsonb)';require(set(e)==set(b['effective_privileges'])|{'eps_mcp_issuer_owner'})
    for role,previous in b['effective_privileges'].items():
        current=copy.deepcopy(e[role]);entry=current['functions'].pop(hook);require(entry['execute']is(role=='supabase_auth_admin'))
        if role=='supabase_auth_admin':
            require(current['schemas']['eps']=={'usage':True,'create':False});current['schemas']['eps']=previous['schemas']['eps']
            for category in('functions','tables'):
                for name,value in current[category].items():
                    if name.startswith('eps.'):
                        require(value['schema_usage']is True);value['schema_usage']=previous[category][name]['schema_usage']
        require(current==previous)
    owner=e['eps_mcp_issuer_owner'];require(owner['schemas']['eps']['create']is False and owner['schemas']['public']['create']is False)
    selected=sorted(name for name,value in owner['columns'].items()if name.split('.')[0]in('eps','public','auth')and value['select'])
    require(selected==sorted(['eps.mcp_oauth_resources.client_id','eps.mcp_oauth_resources.enabled','eps.mcp_oauth_resources.resource','public.app_capability_grants.active','public.app_capability_grants.capability','public.app_capability_grants.principal_id']))
    for name,value in owner['columns'].items():
        if name.split('.')[0]in('eps','public','auth'):require(not any(value[key]for key in('insert','update','references')))
    for name,value in owner['tables'].items():
        if name.split('.')[0]in('eps','public','auth'):require(not any(value[key]for key in('select','insert','update','delete','truncate','references','trigger')))
    return{'exact42_created_and8_changed_raw_catalogue_fields':True,'protected_current_data_settings_registry_runtime12_m02_and_old_role_identities_preserved':True,
        'native_auth_only_execute_no_public_authenticated_anon_service_execute':True,'six_read_columns_no_auth_table_or_column_grants':True,'cli_login_expiry_qualifications':qualification}

def save(receipt,label):
    AREA.mkdir(parents=True,exist_ok=True);file=AREA/(stamp().strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+label+'.json')
    with file.open('x',encoding='utf8')as handle:json.dump(receipt,handle,indent=2);handle.write('\n');handle.flush();os.fsync(handle.fileno())
    return file.relative_to(ROOT).as_posix()

def main():
    require(len(sys.argv)==2 and sys.argv[1]in('inspect','dry-run','apply','readback'));action=sys.argv[1]
    report={'schema_version':'1.0','action':action,'target':TARGET,'started_at':stamp().isoformat(),'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_hook_client_or_identity_mutations':False,'seeds':False,'vault_sync':False,'claude_config_login_or_model_calls':False,'raw_diagnostics_suppressed':True}
    try:
        inputs=load_inputs();report['plan']=inputs['plan'];report['source_seals']=inputs['sources'];observed=stamp();state=query_state(inputs)
        if action=='readback':
            require(CLAIM.is_file()and not CLAIM.is_symlink()and CLAIM.resolve()==CLAIM)
            claim=json.loads(CLAIM.read_text());validate_claim(claim);require(claim['plan']==inputs['plan'])
            attempt=json.loads(sealed(claim['attempt_receipt'],claim['attempt_sha256']));validate_attempt(inputs,claim,attempt);before=attempt['before']
            report['comparison']=compare_after(inputs,before,state,observed);report['before']=before;report['after']=state;report['application_verified_by_readback']=True
        else:
            report['cli_login_expiry_qualifications']=validate_before(inputs,state,observed);report['before']=state
            if action!='inspect':
                if action=='apply':
                    require(not CLAIM.exists());require(QUIESCENCE.is_file()and not QUIESCENCE.is_symlink()and QUIESCENCE.resolve()==QUIESCENCE);quiet=json.loads(QUIESCENCE.read_text());validate_quiescence_receipt(quiet,stamp())
                    file=ROOT/quiet['ownership_evidence'];require(file.is_file()and not file.is_symlink()and file.resolve()==file)
                    sys.path.insert(0,str(ROOT/'tools'));from release_m07_29 import verify_owned_processes_absent
                    verify_owned_processes_absent(quiet['owned_pids'])
                    latest=AREA/'latest-dry-run.json';require(latest.is_file()and not latest.is_symlink()and latest.resolve()==latest);dry=json.loads(latest.read_text());require(dry['result']=='passed'and dry['plan']==inputs['plan']and dry['source_seals']==inputs['sources'])
                    require(0<=(stamp()-timestamp(dry['finished_at'])).total_seconds()<=900)
                    require(dry['pending_migrations']==[Path(inputs['plan']['migration_path']).name]);validate_before(inputs,dry['before'],timestamp(dry['started_at']))
                    report['quiescence']=quiet;attempt=save(report,'canonical-apply-attempt');attempt_bytes=(ROOT/attempt).read_bytes()
                    private_write(CLAIM,(json.dumps({'target':TARGET,'plan':inputs['plan'],'before_sha256':canonical(state),'attempt_receipt':attempt,'attempt_sha256':sha(attempt_bytes),'dispatch_may_have_occurred':True})+'\n').encode())
                require(load_inputs()['sources']==inputs['sources'])
                command=['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']+(['--dry-run']if action=='dry-run'else[])
                report['dispatch_attempted']=action=='apply';result=call(command);report['exit_code']=result.returncode
                pending=sorted(set(re.findall(r'[0-9]{14}_[A-Za-z0-9_]+\.sql',result.stdout+'\n'+result.stderr)));report['pending_migrations']=pending
                after=query_state(inputs)
                if action=='apply':report['comparison']=compare_after(inputs,state,after,stamp());report['application_verified_by_readback']=True
                else:
                    require(after['catalog']==state['catalog']and after['protected_data']==state['protected_data'])
                    validate_before(inputs,after,stamp());report['cli_login_expiry_qualifications_after_dryrun']=validate_role_preservation(state['context']['all_roles'],after['context']['all_roles'],stamp())
                report['after']=after;require(result.returncode==0 and pending==[Path(inputs['plan']['migration_path']).name])
        require(load_inputs()['sources']==inputs['sources']);report['sources_stable']=True;report['result']='passed'
    finally:
        report['finished_at']=stamp().isoformat();file=save(report,'canonical-'+action)
        if action=='dry-run'and report['result']=='passed':
            temporary=AREA/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');os.replace(temporary,AREA/'latest-dry-run.json')
        print(json.dumps({'result':report['result'],'action':action,'receipt':file,'application_verified_by_readback':report.get('application_verified_by_readback',False),'automatic_retry':False}))

if __name__=='__main__':
    try:main()
    except Exception:
        sys.stderr.write('Fixed issuer30 release unconfirmed. Preserve claim; reconcile by readback only.\n');sys.exit(1)
