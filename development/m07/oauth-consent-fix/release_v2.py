"""Corrected canonical32 bridge release. Root reviews/runs; imports are inert.

Existing CLI credentials stay private. No provider calls, Auth-row reads or
business writes occur; only protected M02 status metadata is observed.
Unknown dispatch is never replayed. Existing completed31 operators stay frozen.
"""
from pathlib import Path
import copy
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
ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse'
VERSION='20261031104603'
MIGRATION=ROOT/'supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql'
MIGRATION_SHA='0d7b7a7577ffe1ff4b24eba202ce6ac7e87c616ca8039397800e607c651908a5'
BRIDGE_BODY_SHA='f5fab36c5e074252b257d5e3150c6f1c5d77168f5230684f105d477158a5445e'
BASELINE=ROOT/'tracking/evidence/m07/oauth-consent-fix/2026-10-31T10-55-03-058615Z-catalogue.json'
PRIVATE=ROOT/'.local/m07-oauth-consent-release-v2'
CLAIM=PRIVATE/'apply.claim.json'
spec=importlib.util.spec_from_file_location('consent_discovery',HERE/'discover.py')
discovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(discovery)
OWNER='eps_oauth_consent_owner'
OWNER_FLAGS={'name':OWNER,'login':False,'inherit':False,'superuser':False,'bypass_rls':False,'create_db':False,'create_role':False,'replication':False}
COLUMNS={('auth','sessions'):{'id','user_id','oauth_client_id','not_after'},('auth','oauth_authorizations'):set(),('auth','oauth_clients'):set(),('eps','mcp_oauth_resources'):{'resource','client_id','enabled'}}
POLICIES={('auth','sessions'):{'name':'oauth_consent_ordinary_own_session','roles':[OWNER],'command':'r','using':"((user_id = ( SELECT auth.uid() AS uid)) AND ((id)::text = ( SELECT (auth.jwt() ->> 'session_id'::text))) AND (oauth_client_id IS NULL))",'check':None},('eps','mcp_oauth_resources'):{'name':'oauth_consent_enabled_registry','roles':[OWNER],'command':'r','using':'((auth.uid() IS NOT NULL) AND enabled)','check':None}}
SECURITY_CHECKS={'no_role_memberships','no_schema_create','no_whole_auth_reads','no_auth_secrets','no_unlisted_auth_columns','no_direct_managed_oauth_reads','no_managed_auth_writes','claims_forced_rls','claims_not_public','wrapper_owners','wrapper_acl','internal_acl','new_policies_permissive','bridge_definition','bridge_acl','bridge_guard_executable'}
FROZEN={
 'development/m07/oauth-consent-fix/source-history/c308fce9-migration.sql':'c308fce98dbe536ab5d2eb78fdb9d8d737ba66999727e31d9bb8e1910441a07d',
 'development/m07/oauth-consent-fix/release.py':'087c5af119432b21c568e79eaa80aeaa9e4593cdc35b15c3206f0e6c7d62e4a3',
 'development/m07/oauth-consent-fix/discover.py':'6ce739dc9394d67ba98a851651455dfb2ffaf553602f8312b1626130f2a125e9',
 'development/m07/oauth-consent-fix/discovery.sql':'0d19f8e10a12a4cd71c10cc476fea4654ce7d7591ee73b40ff02903bfb63809c',
 '.local/m07-oauth-consent-release/apply.sql':'7247ce8daa5fcd2318e59663836dc73d55ba51a3a8f0be55ceada9b0b4672fb1',
 '.local/m07-oauth-consent-release/apply.claim.json':'306d261ce4642090fec53a1a8e53bc2ac21056852c959c003752ce9cb7bec677',
 'tracking/evidence/m07/oauth-consent-fix/2026-10-31T10-57-28-169263Z-apply.json':'b47927cfdbe6fae5d45bd2ee59aa9f95fbadf99a1eabf2bcc07e94b1091952c6'}

def require(ok):
    if not ok:raise ValueError('OAUTH_CONSENT_RELEASE_UNCONFIRMED')

def sha(value):return hashlib.sha256(value).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def literal(value):return "'"+value.replace("'","''")+"'"
def json_literal(value):return literal(json.dumps(value,sort_keys=True,separators=(',',':')))+'::jsonb'

def catalogue_sql():
    raw=(HERE/'discovery.sql').read_text(encoding='utf8')
    start=raw.index('select jsonb_build_object(')
    end=raw.index('as oauth_consent_catalogue;')
    return raw[start:end].strip()

def state_sql():
    security="""case when not exists(select 1 from pg_roles where rolname='eps_oauth_consent_owner')then null else jsonb_build_object(
 'no_role_memberships',not exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='eps_oauth_consent_owner'))and(select array_agg(distinct member::regrole::text order by member::regrole::text)from pg_auth_members where roleid=(select oid from pg_roles where rolname='eps_oauth_consent_owner'))=array['postgres']::text[],
 'no_schema_create',not(has_schema_privilege('eps_oauth_consent_owner','eps','CREATE')or has_schema_privilege('eps_oauth_consent_owner','public','CREATE')or has_schema_privilege('eps_oauth_consent_owner','auth','CREATE')),
 'no_whole_auth_reads',not(has_table_privilege('eps_oauth_consent_owner','auth.oauth_authorizations','SELECT')or has_table_privilege('eps_oauth_consent_owner','auth.oauth_clients','SELECT')or has_table_privilege('eps_oauth_consent_owner','auth.sessions','SELECT')),
 'no_auth_secrets',not(has_column_privilege('eps_oauth_consent_owner','auth.oauth_authorizations','authorization_code','SELECT')or has_column_privilege('eps_oauth_consent_owner','auth.oauth_authorizations','state','SELECT')or has_column_privilege('eps_oauth_consent_owner','auth.oauth_authorizations','code_challenge','SELECT')or has_column_privilege('eps_oauth_consent_owner','auth.oauth_clients','client_secret_hash','SELECT')),
 'no_direct_managed_oauth_reads',not exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth'and c.relname in('oauth_clients','oauth_authorizations')and a.attnum>0 and not a.attisdropped and has_column_privilege('eps_oauth_consent_owner',c.oid,a.attnum,'SELECT')),
 'no_unlisted_auth_columns',not exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth'and c.relname in('sessions','oauth_clients','oauth_authorizations')and a.attnum>0 and not a.attisdropped and not((c.relname='sessions'and a.attname=any(array['id','user_id','oauth_client_id','not_after']))or(c.relname='oauth_authorizations'and a.attname=any(array['authorization_id','client_id','user_id','redirect_uri','scope','resource','status','expires_at']))or(c.relname='oauth_clients'and a.attname=any(array['id','redirect_uris','client_name','client_uri','logo_uri','deleted_at'])))and has_column_privilege('eps_oauth_consent_owner',c.oid,a.attnum,'SELECT')),
 'no_managed_auth_writes',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])p(privilege)where n.nspname='auth'and c.relname in('sessions','oauth_clients','oauth_authorizations')and has_table_privilege('eps_oauth_consent_owner',c.oid,p.privilege)),
 'claims_forced_rls',exists(select 1 from pg_class where oid=to_regclass('eps.oauth_consent_claims')and relrowsecurity and relforcerowsecurity),
 'new_policies_permissive',(select count(*)=2 and bool_and(polpermissive)from pg_policy where polname in('oauth_consent_ordinary_own_session','oauth_consent_enabled_registry')),
 'claims_not_public',not(has_table_privilege('authenticated','eps.oauth_consent_claims','SELECT')or has_table_privilege('anon','eps.oauth_consent_claims','SELECT')or has_table_privilege('service_role','eps.oauth_consent_claims','SELECT')),
 'wrapper_owners',(select count(*)=2 from pg_proc where oid in(to_regprocedure('public.eps_oauth_consent_claim(text,text,text,uuid)'),to_regprocedure('public.eps_oauth_consent_finish(text,text,uuid,text)'))and proowner=(select oid from pg_roles where rolname='eps_oauth_consent_owner')and prosecdef),
 'wrapper_acl',has_function_privilege('authenticated','public.eps_oauth_consent_claim(text,text,text,uuid)','EXECUTE')and has_function_privilege('authenticated','public.eps_oauth_consent_finish(text,text,uuid,text)','EXECUTE')and not(has_function_privilege('anon','public.eps_oauth_consent_claim(text,text,text,uuid)','EXECUTE')or has_function_privilege('service_role','public.eps_oauth_consent_claim(text,text,text,uuid)','EXECUTE')or has_function_privilege('anon','public.eps_oauth_consent_finish(text,text,uuid,text)','EXECUTE')or has_function_privilege('service_role','public.eps_oauth_consent_finish(text,text,uuid,text)','EXECUTE')),
 'internal_acl',not(has_function_privilege('authenticated','eps.oauth_consent_binding(text,text)','EXECUTE')or has_function_privilege('anon','eps.oauth_consent_binding(text,text)','EXECUTE')or has_function_privilege('service_role','eps.oauth_consent_binding(text,text)','EXECUTE')),
 'bridge_definition',exists(select 1 from pg_proc where oid=to_regprocedure('eps.oauth_consent_binding(text,text)')and proowner='postgres'::regrole and prosecdef and provolatile='s'and prorettype='jsonb'::regtype and proconfig=array['search_path=""','TimeZone=UTC']::text[]and encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')='BRIDGE_BODY_PLACEHOLDER'),
 'bridge_acl',(select count(*)=2 and bool_and(privilege_type='EXECUTE'and not is_grantable and grantor='postgres'::regrole and grantee in('postgres'::regrole,(select oid from pg_roles where rolname='eps_oauth_consent_owner')))from pg_proc cross join lateral aclexplode(proacl)where oid=to_regprocedure('eps.oauth_consent_binding(text,text)'))and has_function_privilege('eps_oauth_consent_owner','eps.oauth_consent_binding(text,text)','EXECUTE'),
 'bridge_guard_executable',has_function_privilege('postgres','eps.oauth_consent_browser_session()','EXECUTE')
 )end""".replace('BRIDGE_BODY_PLACEHOLDER',BRIDGE_BODY_SHA)
    return "select jsonb_build_object('catalogue',("+catalogue_sql()+"),'protected_m02',(select jsonb_build_object('id',id,'status',status,'stage',stage,'attempt',attempt,'row_version',row_version)from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),'new_objects',jsonb_build_object('role',exists(select 1 from pg_roles where rolname='eps_oauth_consent_owner'),'table',to_regclass('eps.oauth_consent_claims')is not null,'claim',to_regprocedure('public.eps_oauth_consent_claim(text,text,text,uuid)')is not null,'finish',to_regprocedure('public.eps_oauth_consent_finish(text,text,uuid,text)')is not null),'security',"+security+")"

def parse(value):
    rows=value if type(value)is list else value.get('rows')if type(value)is dict else None
    require(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'oauth_consent_release'})
    value=rows[0]['oauth_consent_release'];require(type(value)is dict)
    return value

def query(sql,mode):
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    env=discovery.environment(os.environ)
    PRIVATE.mkdir(parents=True,exist_ok=True)
    path=PRIVATE/(mode+'.sql');path.write_text(sql,encoding='utf8',newline='\n')
    command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
    result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60,stdin=subprocess.DEVNULL)
    require(result.returncode==0 and len(result.stdout.encode())<=256*1024 and len(result.stderr.encode())<=64*1024)
    return parse(json.loads(result.stdout))

def read_state():return query("begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='20s';set local timezone='UTC';"+state_sql()+"as oauth_consent_release;rollback;",'readback')

def stable_catalogue(value):
    result=copy.deepcopy(value);result.pop('observed_at',None);return result

def expected_after_catalogue(before):
    result=stable_catalogue(before);result['history'].append(VERSION);result['roles'].append(copy.deepcopy(OWNER_FLAGS));result['roles'].sort(key=lambda v:v['name'])
    for relation in result['relations']:
        key=(relation['schema'],relation['name'])
        if key in POLICIES:relation['policies'].append(copy.deepcopy(POLICIES[key]));relation['policies'].sort(key=lambda v:v['name'])
        for column in relation['columns']:
            if column['name']in COLUMNS[key]:
                previous=column['acl'];entry=OWNER+'=r/postgres'
                column['acl']='{'+entry+'}'if previous is None else previous[:-1]+','+entry+'}'
    return result

def exact_owner_acl_and_policies(value):
    def owner_entries(raw):
        if raw is None:return []
        require(type(raw)is str and raw.startswith('{')and raw.endswith('}'))
        return [v for v in raw[1:-1].split(',')if v.startswith(OWNER+'=')]
    found_policies=[]
    for relation in value['relations']:
        key=(relation['schema'],relation['name']);require(key in COLUMNS and not owner_entries(relation['acl']))
        for column in relation['columns']:
            require(owner_entries(column['acl'])==([OWNER+'=r/postgres']if column['name']in COLUMNS[key]else []))
        for policy in relation['policies']:
            if policy['name']in[p['name']for p in POLICIES.values()]:
                require(key in POLICIES and policy==POLICIES[key]);found_policies.append(key)
    require(sorted(found_policies)==sorted(POLICIES))

def normalize_after(value):
    exact_owner_acl_and_policies(value)
    result=stable_catalogue(value)
    result['history']=[v for v in result['history']if v!=VERSION]
    result['roles']=[v for v in result['roles']if v['name']!='eps_oauth_consent_owner']
    def acl(raw):
        if raw is None:return None
        require(type(raw)is str and raw.startswith('{')and raw.endswith('}'))
        entries=[v for v in raw[1:-1].split(',')if not v.startswith('eps_oauth_consent_owner=')]
        return '{'+','.join(entries)+'}'if entries else None
    for relation in result['relations']:
        relation['acl']=acl(relation['acl'])
        relation['policies']=[p for p in relation['policies']if p['name']not in('oauth_consent_ordinary_own_session','oauth_consent_enabled_registry')]
        for column in relation['columns']:column['acl']=acl(column['acl'])
    return result

def sources():
    require(MIGRATION.is_file()and not MIGRATION.is_symlink()and sha(MIGRATION.read_bytes())==MIGRATION_SHA)
    files=[Path(__file__),HERE/'discover.py',HERE/'discovery.sql',MIGRATION,BASELINE]
    for relative,digest in FROZEN.items():require(sha((ROOT/relative).read_bytes())==digest)
    old=json.loads((ROOT/'tracking/evidence/m07/oauth-consent-fix/2026-10-31T10-57-28-169263Z-apply.json').read_text())
    require(old['result']=='unconfirmed'and old['normal_return_marker_observed']is False)
    for observed in(old['after'],old['independent_after']):check_before(observed)
    return {**{p.relative_to(ROOT).as_posix():sha(p.read_bytes())for p in files},**FROZEN}

def check_before(value):
    baseline=json.loads(BASELINE.read_text(encoding='utf8'));require(baseline['target']==TARGET)
    require(set(value)=={'catalogue','protected_m02','new_objects','security'}and value['security']is None and stable_catalogue(value['catalogue'])==stable_catalogue(baseline['catalogue']))
    require(value['new_objects']==dict.fromkeys(('role','table','claim','finish'),False))
    require(value['protected_m02']=={'id':'b3f90268-147d-41d4-8875-2a6435df1496','status':'waiting_for_input','stage':'apply_specs','attempt':3,'row_version':7})

def check_after(value,before):
    require(set(value)=={'catalogue','protected_m02','new_objects','security'}and value['new_objects']==dict.fromkeys(('role','table','claim','finish'),True))
    require(type(value['security'])is dict and set(value['security'])==SECURITY_CHECKS and all(v is True for v in value['security'].values()))
    require(value['catalogue']['history']==[*before['catalogue']['history'],VERSION])
    require(stable_catalogue(value['catalogue'])==expected_after_catalogue(before['catalogue']))
    exact_owner_acl_and_policies(value['catalogue'])
    require(value['protected_m02']==before['protected_m02'])
    owner=[r for r in value['catalogue']['roles']if r['name']=='eps_oauth_consent_owner']
    require(owner==[OWNER_FLAGS])

def render(before,marker):
    require(str(uuid.UUID(marker))==marker);check_before(before)
    clean=copy.deepcopy(before);clean['catalogue']=stable_catalogue(clean['catalogue'])
    # Snapshot comparison precedes all additive DDL within the same transaction.
    capture='create temporary table oauth_consent_before on commit drop as '+state_sql()+'as value;\n'
    guard="do $guard$declare v jsonb;begin select value into v from pg_temp.oauth_consent_before;v:=jsonb_set(v,'{catalogue}',(v->'catalogue')-'observed_at');if v is distinct from "+json_literal(clean)+"then raise exception'OAUTH_CONSENT_RELEASE_PREFLIGHT_CHANGED';end if;end$guard$;\n"
    expected={'catalogue':expected_after_catalogue(before['catalogue']),'protected_m02':before['protected_m02'],'new_objects':dict.fromkeys(('role','table','claim','finish'),True),'security':dict.fromkeys(SECURITY_CHECKS,True)}
    after_capture='create temporary table oauth_consent_after on commit drop as '+state_sql()+'as value;\n'
    after_guard="do $guard$declare v jsonb;begin select value into v from pg_temp.oauth_consent_after;v:=jsonb_set(v,'{catalogue}',(v->'catalogue')-'observed_at');if v is distinct from "+json_literal(expected)+"then raise exception'OAUTH_CONSENT_RELEASE_POSTCONDITION_FAILED';end if;end$guard$;\n"
    return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;\n"+capture+guard+MIGRATION.read_text(encoding='utf8')+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_oauth_consent_binding_and_claims');\n"+after_capture+after_guard+"commit;select jsonb_build_object('version','"+VERSION+"','marker',"+literal(marker)+",'migration_sha256','"+MIGRATION_SHA+"')as oauth_consent_release;\n"

def receipt(action,value):
    out=ROOT/'tracking/evidence/m07/oauth-consent-fix';out.mkdir(parents=True,exist_ok=True)
    path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
    value={'schema_version':'1.0','evidence_kind':'actual_canonical_release_observation','target':TARGET,'action':action,'observed_at':stamp(),'raw_cli_or_credentials_persisted':False,**value}
    with path.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
    return path.relative_to(ROOT).as_posix()

def main():
    require(len(sys.argv)==2 and sys.argv[1]in('preflight','apply','readback'));action=sys.argv[1];pins=sources()
    if action=='preflight':
        value=read_state();check_before(value);file=receipt(action,{'result':'passed','dispatch_attempted':False,'source_pins':pins,'before':value});print(json.dumps({'result':'passed','dispatch_attempted':False,'receipt':file}));return
    if action=='readback':
        require(CLAIM.is_file());claim=json.loads(CLAIM.read_text());require(claim['target']==TARGET and claim['migration_sha256']==MIGRATION_SHA)
        after=read_state();independent=read_state();check_after(after,claim['before']);check_after(independent,claim['before']);require(stable_catalogue(after['catalogue'])==stable_catalogue(independent['catalogue'])and after['protected_m02']==independent['protected_m02'])
        file=receipt(action,{'result':'observed_applied','dispatch_attempted':False,'original_claim_retained':True,'source_pins':pins,'after':after,'independent_after':independent});print(json.dumps({'result':'observed_applied','dispatch_attempted':False,'receipt':file}));return
    require(not CLAIM.exists());before=read_state();check_before(before);marker=str(uuid.uuid4())
    PRIVATE.mkdir(parents=True,exist_ok=True)
    claim={'target':TARGET,'version':VERSION,'migration_sha256':MIGRATION_SHA,'marker':marker,'claimed_at':stamp(),'dispatch_may_have_occurred':True,'source_pins':pins,'before':before}
    with CLAIM.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps(claim,sort_keys=True)+'\n');f.flush();os.fsync(f.fileno())
    fresh=read_state();check_before(fresh);require(stable_catalogue(fresh['catalogue'])==stable_catalogue(before['catalogue'])and fresh['protected_m02']==before['protected_m02']and sources()==pins)
    dispatched=False;returned=False;failure=False
    try:
        dispatched=True;result=query(render(fresh,marker),'apply');returned=result=={'version':VERSION,'marker':marker,'migration_sha256':MIGRATION_SHA}
    except Exception:failure=True
    after=independent=None
    try:
        after=read_state();independent=read_state();check_after(after,before);check_after(independent,before)
        require(stable_catalogue(after['catalogue'])==stable_catalogue(independent['catalogue'])and sources()==pins)
    except Exception:failure=True
    passed=returned and not failure
    file=receipt(action,{'result':'passed'if passed else'unconfirmed','source_pins':pins,'dispatch_attempted':dispatched,'normal_return_marker_observed':returned,'claim_retained':True,'automatic_dispatch_retry':False,'before':before,'after':after,'independent_after':independent})
    print(json.dumps({'result':'passed'if passed else'unconfirmed','dispatch_attempted':dispatched,'claim_retained':True,'receipt':file}));require(passed)

if __name__=='__main__':
    try:main()
    except Exception:print('OAUTH_CONSENT_RELEASE_UNCONFIRMED');sys.exit(1)
