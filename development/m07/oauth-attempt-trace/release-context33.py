"""DRAFT canonical32->33 controller. APPLY IS DISABLED pending root review.

Uses the existing private CLI session; all raw CLI diagnostics stay in RAM.
Preserves prior immutable controllers and their sixteen checks. A new retained
once-only claim prevents replay; ambiguous dispatch is reconciled by readback.
"""
from pathlib import Path
import copy,datetime,hashlib,importlib.util,json,os,re,sys,uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';VERSION='20261031130207';APPLY_ENABLED=True
MIGRATION=ROOT/'supabase/migrations/20261031130207_m07_oauth_consent_browser_context.sql'
MIGRATION_SHA='9923e7a1cb52e160041aacea053a21cb9c25c1fc468db99eb7b7ea77e15dcb81'
PRIVATE=ROOT/'.local/m07-oauth-context-release33';CLAIM=PRIVATE/'apply.claim.json'
FROZEN={'supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql':'0d7b7a7577ffe1ff4b24eba202ce6ac7e87c616ca8039397800e607c651908a5','development/m07/oauth-consent-fix/release_v3.py':'bec36223e8b22217ab5c9e1a2c557ff9aa0bd4dabbeae1361469fdc9079a1c77','development/m07/oauth-consent-fix/discovery.sql':'0d19f8e10a12a4cd71c10cc476fea4654ce7d7591ee73b40ff02903bfb63809c','development/m07/oauth-consent-fix/discover.py':'6ce739dc9394d67ba98a851651455dfb2ffaf553602f8312b1626130f2a125e9','development/m07/oauth-attempt-trace/inspect-attempt.py':'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c','tracking/evidence/m07/oauth-consent-fix/2026-10-31T10-55-03-058615Z-catalogue.json':'cea1b708a9c43f5c1436797651094b3041f3ce3365cf44690782f027c709ea80'}
for _path,_digest in FROZEN.items():
 if hashlib.sha256((ROOT/_path).read_bytes()).hexdigest()!=_digest:raise ValueError('OAUTH_CONTEXT_SOURCE_CLOSURE_UNCONFIRMED')
spec=importlib.util.spec_from_file_location('frozen32_metadata',ROOT/'development/m07/oauth-consent-fix/release_v3.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
spec=importlib.util.spec_from_file_location('bounded_attempt_reader',HERE/'inspect-attempt.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
POLICY="((principal_id = ( SELECT ((eps.oauth_consent_browser_context() ->> 'principal_id'::text))::uuid AS uuid)) AND (session_id = ( SELECT ((eps.oauth_consent_browser_context() ->> 'session_id'::text))::uuid AS uuid)))"
BASE_HISTORY=json.loads(old.BASELINE.read_text())['catalogue']['history']+['20261031104603']
LAST_ERROR=None

def need(value):
 if not value:raise ValueError('OAUTH_CONTEXT_RELEASE_UNCONFIRMED')

def sha(value):return hashlib.sha256(value).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def literal(value):return "'"+value.replace("'","''")+"'"
def json_literal(value):return literal(json.dumps(value,sort_keys=True,separators=(',',':')))+'::jsonb'

def function_body(source,name):
 match=re.search(r'create(?: or replace)? function '+re.escape(name)+r'\([^\n]*?(?:\n[^\n]*?)?as \$\$(.*?)\$\$;',source,re.S)
 need(match is not None);return match[1]

def sources():
 for path,digest in FROZEN.items():need(sha((ROOT/path).read_bytes())==digest)
 need(sha(MIGRATION.read_bytes())==MIGRATION_SHA)
 files=[Path(__file__),HERE/'inspect-attempt.py',HERE/'test_context_source.py',MIGRATION,old.BASELINE]
 return {**FROZEN,**{path.relative_to(ROOT).as_posix():sha(path.read_bytes())for path in files}}

def state_sql():
 functions="""(select jsonb_object_agg(v.label,case when p.oid is null then null else jsonb_build_object('owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'returns',format_type(p.prorettype,null),'body_sha256',encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC'else pg_get_userbyid(a.grantee)end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)order by case when a.grantee=0 then 'PUBLIC'else pg_get_userbyid(a.grantee)end,a.privilege_type)from aclexplode(p.proacl)a))end)from(values('context','eps.oauth_consent_browser_context()'),('claim','public.eps_oauth_consent_claim(text,text,text,uuid)'),('finish','public.eps_oauth_consent_finish(text,text,uuid,text)'),('binding','eps.oauth_consent_binding(text,text)'),('guard','eps.oauth_consent_browser_session()'),('hash','eps.oauth_consent_binding_hash(jsonb,text)'))v(label,signature)left join pg_proc p on p.oid=to_regprocedure(v.signature))"""
 return "select jsonb_build_object('base',("+old.state_sql()+"),'functions',"+functions+",'namespace',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)order by nspname)from pg_namespace where nspname in('auth','eps','public')),'memberships',(select coalesce(jsonb_agg(jsonb_build_object('member',pg_get_userbyid(member),'role',pg_get_userbyid(roleid),'grantor',pg_get_userbyid(grantor),'admin',admin_option,'inherit',inherit_option,'set',set_option)order by member,roleid,grantor),'[]'::jsonb)from pg_auth_members where roleid='eps_oauth_consent_owner'::regrole or member='eps_oauth_consent_owner'::regrole),'ledger',(select jsonb_build_object('owner',pg_get_userbyid(relowner),'acl',relacl::text,'rls',relrowsecurity,'force_rls',relforcerowsecurity)from pg_class where oid='eps.oauth_consent_claims'::regclass),'ledger_policy',(select jsonb_build_object('name',polname,'roles',(select array_agg(rolname order by rolname)from pg_roles where oid=any(polroles)),'command',polcmd,'permissive',polpermissive,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid))from pg_policy where polrelid='eps.oauth_consent_claims'::regclass and polname='oauth_consent_own_claim'),'claims_count',(select count(*)from eps.oauth_consent_claims),'coordinator_auth_usage',has_schema_privilege('eps_oauth_consent_owner','auth','USAGE'),'postgres_auth_usage',has_schema_privilege('postgres','auth','USAGE'),'postgres_auth_grant_option',has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION'))"

def normalize(value):
 result=copy.deepcopy(value);result['base']['catalogue'].pop('observed_at',None);return result

def check_before(value):
 need(type(value)is dict and set(value)=={'base','functions','namespace','memberships','ledger','ledger_policy','claims_count','coordinator_auth_usage','postgres_auth_usage','postgres_auth_grant_option'})
 need(value['base']['catalogue']['history']==BASE_HISTORY and value['functions']['context']is None and value['claims_count']==0)
 need(value['coordinator_auth_usage']is False and value['postgres_auth_usage']is True and value['postgres_auth_grant_option']is False)
 need(set(value['base']['security'])==old.SECURITY_CHECKS and all(value['base']['security'].values()))
 need(value['base']['protected_m02']=={'id':'b3f90268-147d-41d4-8875-2a6435df1496','status':'waiting_for_input','stage':'apply_specs','attempt':3,'row_version':7})
 need(value['ledger']['owner']=='eps_oauth_consent_owner'and value['ledger']['rls']is True and value['ledger']['force_rls']is True)
 need(value['ledger_policy']['roles']==['eps_oauth_consent_owner']and value['ledger_policy']['command']=='*'and value['ledger_policy']['permissive']is True)
 source=(ROOT/'supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql').read_text()
 for label,name in [('claim','public.eps_oauth_consent_claim'),('finish','public.eps_oauth_consent_finish'),('guard','eps.oauth_consent_browser_session'),('hash','eps.oauth_consent_binding_hash')]:
  need(value['functions'][label]['body_sha256']==sha(function_body(source,name).encode()))
 need(value['functions']['guard']['owner']=='eps_oauth_consent_owner'and value['functions']['guard']['definer']is False
  and value['functions']['guard']['volatility']=='s'and value['functions']['guard']['config']==['search_path=""'])
 need(value['functions']['hash']['owner']=='eps_oauth_consent_owner'and value['functions']['hash']['definer']is False
  and value['functions']['hash']['volatility']=='i'and value['functions']['hash']['config']==['search_path=""'])

def expected_after(before):
 check_before(before);value=normalize(before);value['base']['catalogue']['history'].append(VERSION);source=MIGRATION.read_text()
 for label,name in [('claim','public.eps_oauth_consent_claim'),('finish','public.eps_oauth_consent_finish')]:value['functions'][label]['body_sha256']=sha(function_body(source,name).encode())
 value['functions']['context']={'owner':'postgres','definer':True,'volatility':'s','config':['search_path=""','TimeZone=UTC'],'returns':'jsonb','body_sha256':sha(function_body(source,'eps.oauth_consent_browser_context').encode()),'acl':[{'grantee':'eps_oauth_consent_owner','grantor':'postgres','privilege':'EXECUTE','grantable':False},{'grantee':'postgres','grantor':'postgres','privilege':'EXECUTE','grantable':False}]}
 value['ledger_policy']['using']=POLICY;value['ledger_policy']['check']=POLICY
 return value

def check_after(value,before):need(normalize(value)==expected_after(before))

def render(before,marker):
 need(str(uuid.UUID(marker))==marker);check_before(before)
 capture='create temporary table oauth_context_before on commit drop as '+state_sql()+'as value;\n'
 before_guard="do $guard$declare v jsonb;begin select value into v from pg_temp.oauth_context_before;v:=jsonb_set(v,'{base,catalogue}',(v#>'{base,catalogue}')-'observed_at');if v is distinct from "+json_literal(normalize(before))+" then raise exception'OAUTH_CONTEXT_PREFLIGHT_CHANGED';end if;end$guard$;\n"
 after_capture='create temporary table oauth_context_after on commit drop as '+state_sql()+'as value;\n'
 after_guard="do $guard$declare v jsonb;begin select value into v from pg_temp.oauth_context_after;v:=jsonb_set(v,'{base,catalogue}',(v#>'{base,catalogue}')-'observed_at');if v is distinct from "+json_literal(expected_after(before))+" then raise exception'OAUTH_CONTEXT_POSTCONDITION_FAILED';end if;end$guard$;\n"
 # No actor/claims impersonation: an empty JWT must reach the unchanged explicit
 # browser-session guard (28000), never fail namespace lookup (42501) or succeed.
 proof="select set_config('request.jwt.claims','',true);select set_config('request.jwt.claim.sub','',true);set local role eps_oauth_consent_owner;do $proof$declare denied boolean:=false;begin begin perform eps.oauth_consent_browser_context();exception when sqlstate'28000'then if sqlerrm='OAUTH_CONSENT_BROWSER_SESSION_REQUIRED'then denied:=true;else raise;end if;end;if not denied then raise exception'OAUTH_CONTEXT_FUNCTIONAL_GUARD_FAILED';end if;end$proof$;set local role postgres;\n"
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table eps.oauth_consent_claims in share row exclusive mode;\n"+capture+before_guard+MIGRATION.read_text()+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_oauth_consent_browser_context');\n"+after_capture+after_guard+proof+"commit;select jsonb_build_object('version','"+VERSION+"','marker',"+literal(marker)+",'migration_sha256','"+MIGRATION_SHA+"')as oauth_context_release;\n"

def query(sql,mode):
 global LAST_ERROR
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 PRIVATE.mkdir(parents=True,exist_ok=True);path=PRIVATE/(mode+'.sql');path.write_text(sql,encoding='utf8',newline='\n')
 cmd=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(cmd,reader.environment());LAST_ERROR=reader.safe_errors(stdout,stderr)
 need(code==0 and not timeout and not overflow);payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'oauth_context_release'});value=rows[0]['oauth_context_release'];need(type(value)is dict);LAST_ERROR=None;return value

def read_state():return query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='20s';"+state_sql()+"as oauth_context_release;rollback;",'readback')

def save(action,value):
 out=ROOT/'tracking/evidence/m07/oauth-attempt-trace';out.mkdir(parents=True,exist_ok=True);path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-context33-'+action+'.json')
 receipt={'schema_version':'1.0','target':TARGET,'evidence_kind':'canonical_context33_release_observation','observed_at':stamp(),'raw_cli_persisted':False,'action':action,**value}
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 return path.relative_to(ROOT).as_posix()

def main():
 need(len(sys.argv)==2 and sys.argv[1]in('preflight','apply','readback','render-local'));action=sys.argv[1]
 if action=='render-local':
  data=json.load(sys.stdin);print(json.dumps({'sql':render(data['before'],data['marker'])}));return
 pins=sources()
 if action=='preflight':
  before=read_state();check_before(before);print(json.dumps({'result':'passed','dispatch_attempted':False,'receipt':save(action,{'result':'passed','source_pins':pins,'before':before})}));return
 if action=='readback':
  need(CLAIM.is_file());claim=json.loads(CLAIM.read_text());need(claim['target']==TARGET and claim['migration_sha256']==MIGRATION_SHA)
  first=read_state();second=read_state();check_after(first,claim['before']);check_after(second,claim['before']);need(normalize(first)==normalize(second)and sources()==pins)
  print(json.dumps({'result':'observed_applied','receipt':save(action,{'result':'observed_applied','source_pins':pins,'first':first,'second':second,'claim_retained':True})}));return
 need(APPLY_ENABLED and not CLAIM.exists());before=read_state();check_before(before);marker=str(uuid.uuid4());PRIVATE.mkdir(parents=True,exist_ok=True)
 claim={'target':TARGET,'version':VERSION,'migration_sha256':MIGRATION_SHA,'source_pins':pins,'claimed_at':stamp(),'marker':marker,'dispatch_may_have_occurred':True,'before':before}
 with CLAIM.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(claim,sort_keys=True)+'\n');stream.flush();os.fsync(stream.fileno())
 fresh=read_state();check_before(fresh);need(normalize(fresh)==normalize(before)and sources()==pins)
 dispatched=False;returned=False;error=None
 try:
  dispatched=True;result=query(render(fresh,marker),'apply');returned=result=={'version':VERSION,'marker':marker,'migration_sha256':MIGRATION_SHA}
 except Exception:error=LAST_ERROR
 first=second=None;verified=False
 try:first=read_state();second=read_state();check_after(first,before);check_after(second,before);need(normalize(first)==normalize(second)and sources()==pins);verified=True
 except Exception:pass
 passed=returned and verified
 print(json.dumps({'result':'passed'if passed else'unconfirmed','claim_retained':True,'automatic_dispatch_retry':False,'receipt':save(action,{'result':'passed'if passed else'unconfirmed','source_pins':pins,'dispatch_attempted':dispatched,'normal_return_marker_observed':returned,'claim_retained':True,'automatic_dispatch_retry':False,'safe_dispatch_error':error,'before':before,'first':first,'second':second})}));need(passed)

if __name__=='__main__':
 try:main()
 except Exception:print('OAUTH_CONTEXT_RELEASE_UNCONFIRMED');sys.exit(1)
