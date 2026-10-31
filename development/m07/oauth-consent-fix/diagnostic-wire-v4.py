"""ONE separately claimed canonical diagnostic; candidate changes always ROLLBACK.

No COMMIT exists. Only catalogue/ACL/status metadata may leave the CLI. Raw CLI
error bodies stay in RAM and reduce to SQLSTATE and fixed source/error flags.
"""
from pathlib import Path
import copy,datetime,hashlib,importlib.util,json,os,re,subprocess,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('corrected_wire_diagnostic',HERE/'release_v3.py');v2=importlib.util.module_from_spec(spec);spec.loader.exec_module(v2)
PRIVATE=ROOT/'.local/m07-oauth-consent-corrected-wire-diagnostic-v4';CLAIM=PRIVATE/'dispatch.claim.json'
FROZEN={
 'development/m07/oauth-consent-fix/diagnostic-response-v3.py':'8b788244af8aa563e0eb9cbc1572d4600798e77651133d470b605bf6454063e1',
 '.local/m07-oauth-consent-diagnostic-response-v3/dispatch.claim.json':'29a063a840b49de6509b4fd44b0440f463aa8e7cc3a2061a3b2bdfdac36a6077',
 '.local/m07-oauth-consent-diagnostic-response-v3/diagnostic.sql':'31804e18c7a619315ca3cccf6621440528e7a760c15dacd7d813cf5ab1bd8aa6',
 'tracking/evidence/m07/oauth-consent-fix/2026-10-31T11-17-32-625657Z-response-v3-rollback-diagnostic.json':'a0501f1c3df3fe4b52d2006397a6bb02b9c36948aff506fc13e11812d7fc5727',
 'development/m07/oauth-consent-fix/release_v2.py':'a14eb8a1cc6ce10367131866ee7fe5a37d1274c2e9357b82f57095e70a476328',
 'supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql':'0d7b7a7577ffe1ff4b24eba202ce6ac7e87c616ca8039397800e607c651908a5',
 '.local/m07-oauth-consent-release-v2/apply.sql':'546b20d02b99e3edce4607839123d50ce6e12c293cc30650849742748fb12837',
 '.local/m07-oauth-consent-release-v2/apply.claim.json':'8fa00d7f2a3595177d67f67c4ef2ac6a2f376a6f39507d42095d8a9db75abbc4',
 'tracking/evidence/m07/oauth-consent-fix/2026-10-31T11-07-38-350496Z-apply.json':'c3ec0a7e9beb6733a1c4aeb24d9605700abae6c0a78cc5b8429d21bfb7e8f196',
 'development/m07/oauth-consent-fix/diagnose-v2.py':'9e8a9037f89d10fd170fd3b8fde0fc07752712ce2e5d090d5b41ab78c54cfef6',
 '.local/m07-oauth-consent-diagnostic-v2/dispatch.claim.json':'5bb2de2cb153316764fbb5e0bfc04134e2f1c30dc5367d08bc661e9bb95eecca',
 '.local/m07-oauth-consent-diagnostic-v2/diagnostic.sql':'7bda4481f2d477e01919b5046e6257bf909194cd5f16c98d459a84d30c205a64',
 'tracking/evidence/m07/oauth-consent-fix/2026-10-31T11-10-40-509001Z-v2-rollback-diagnostic.json':'117639476a9ecf2c516bb3da00e1d07f8f9f12c8dfe97a6995090d430288464e'}
MARKERS=('OAUTH_CONSENT_EXACT31_ADDITIVE_TARGET_REQUIRED','OAUTH_CONSENT_DISCOVERED_COLUMNS_REQUIRED','OAUTH_CONSENT_RELEASE_PREFLIGHT_CHANGED','OAUTH_CONSENT_RELEASE_POSTCONDITION_FAILED')

def need(ok):
 if not ok:raise ValueError('V2_DIAGNOSTIC_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def pins():
 values=v2.sources()
 for file,digest in FROZEN.items():need(sha((ROOT/file).read_bytes())==digest)
 return {**values,**FROZEN,'development/m07/oauth-consent-fix/diagnostic-wire-v4.py':sha(Path(__file__).read_bytes())}
def redact(value,limit=300):
 value=re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',value)
 value=re.sub(r'(?i)\bBearer\s+[^\s"\x27]+','Bearer [REDACTED]',value)
 value=re.sub(r'(?i)https?://[^\s<>"\x27]+','[REDACTED_URL]',value)
 value=re.sub(r'(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b','[REDACTED_EMAIL]',value)
 value=re.sub(r'(?i)(?:sb_secret_|sb_publishable_|sbp_|sk-proj-|sk-)[A-Za-z0-9._~-]+','[REDACTED_TOKEN]',value)
 value=re.sub(r'[A-Za-z0-9_\-]{20,}','[REDACTED_LONG_VALUE]',value)
 value=' '.join(value.encode('ascii','replace').decode().split())
 return value[:limit]
def safe_errors(stdout,stderr):
 # Parse the actual observed CLI schema before examining native error text.
 # Never scan echoed SQL for branch markers or expose raw CLI/query/context.
 tag=code=None;message='';status=None
 try:
  payload=json.loads(stdout)
  if type(payload)is dict:
   tag=payload.get('_tag')if type(payload.get('_tag'))is str else None
   error=payload.get('error')
   if type(error)is dict:
    code=error.get('code')if type(error.get('code'))is str else None
    message=error.get('message')if type(error.get('message'))is str else ''
 except Exception:pass
 if not message:message=stderr[:65536]
 http=re.search(r'(?i)unexpected status\s+(\d{3})\s*:',message)
 if http:status=int(http.group(1))
 nested_start=message.find('{')
 if nested_start>=0:
  try:
   nested=json.loads(message[nested_start:])
   if type(nested)is dict and type(nested.get('message'))is str:message=nested['message']
  except Exception:pass
 native=re.search(r'(?i)ERROR:\s*([A-Z0-9]{5}):\s*([^\r\n]*)',message)
 states=[native.group(1).upper()]if native else sorted(set(re.findall(r'(?i)SQLSTATE[^a-z0-9]{0,8}([a-z0-9]{5})',message)))
 first_line=native.group(2)if native else message.splitlines()[0]if message else ''
 # Native MESSAGE_TEXT only: DETAIL, CONTEXT and query strings are discarded.
 first_line=re.split(r'(?i)\\+[nr]|\b(?:LINE\s+\d+\s*:|DETAIL:|CONTEXT:|QUERY:|STATEMENT:)',first_line,maxsplit=1)[0]
 first_line=re.sub(r'\\+(["\x27])',r'\1',first_line).rstrip('\\ ')
 lower=first_line.lower()
 flags={
 'must_own_auth_sessions':bool(re.search(r'must be owner of (?:table|relation) (?:auth\.)?["\x27]?sessions',lower)),
 'must_own_auth_schema':'must be owner of schema auth'in lower,
 'permission_denied_auth_schema':'permission denied for schema auth'in lower,
 'permission_denied_eps_schema':'permission denied for schema eps'in lower,
 'permission_denied_create_role':'permission denied to create role'in lower,
 'must_be_member_role':'must be member of role'in lower,
 'syntax_error':'syntax error'in lower,
 'statement_timeout':'statement timeout'in lower,
 'lock_timeout':'lock timeout'in lower,
 'permission_denied_auth_sessions':bool(re.search(r'permission denied for (?:table|relation) (?:auth\.)?["\x27]?sessions',lower)),
 'permission_denied_auth_authorizations':'permission denied for table oauth_authorizations'in lower,
 'permission_denied_auth_clients':'permission denied for table oauth_clients'in lower,
 'no_privileges_granted':'no privileges were granted'in lower}
 return {'cli_tag':redact(tag,60)if tag else None,'cli_error_code':code if code in('DbQueryUnexpectedStatusError',)else redact(code,80)if code else None,'http_status':status,'sqlstates':sorted(set(s.upper()for s in states)),'sanitized_native_error':redact(first_line),'fixed_error_flags':flags,'known_source_markers':[m for m in MARKERS if m in first_line],'raw_cli_persisted':False}
def equal(a,b):return v2.stable_catalogue(a['catalogue'])==v2.stable_catalogue(b['catalogue'])and a['protected_m02']==b['protected_m02']and a['new_objects']==b['new_objects']and a['security']==b['security']
def render(before,marker):
 # Execute the ENTIRE corrected production wire, including both exact guards,
 # candidate and coordinated history. Only final COMMIT/result is substituted.
 full=v2.render(before,marker);need(full.count('::jsonb then')==2 and '::jsonbthen'not in full)
 cut=full.rindex('commit;select');head=full[:cut]
 metadata="select jsonb_build_object('during',(select value from pg_temp.oauth_consent_after),'bridge',(select jsonb_build_object('owner',pg_get_userbyid(proowner),'security_definer',prosecdef,'config',proconfig,'body_sha256',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'acl',proacl::text)from pg_proc where oid=to_regprocedure('eps.oauth_consent_binding(text,text)')),'managed_ddl_authority',jsonb_build_object('auth_sessions_owner',(select pg_get_userbyid(relowner)from pg_class where oid='auth.sessions'::regclass),'operator_superuser',(select rolsuper from pg_roles where rolname=current_user),'operator_uses_auth_owner',pg_has_role(current_user,'supabase_auth_admin','USAGE'),'operator_sets_auth_owner',pg_has_role(current_user,'supabase_auth_admin','SET'),'auth_schema_create',has_schema_privilege(current_user,'auth','CREATE')),'marker',"+v2.literal(marker)+")as oauth_consent_diagnostic;"
 sql=head+metadata+'\nrollback;\n'
 need(not re.search(r'(?im)^\s*commit\s*;',sql)and sql.rstrip().endswith('rollback;'))
 return sql
def dispatch(sql):
 path=PRIVATE/'diagnostic.sql';path.write_text(sql,encoding='utf8',newline='\n')
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==v2.TARGET)
 env=v2.discovery.environment(os.environ)
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',v2.TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
 try:result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60,stdin=subprocess.DEVNULL)
 except subprocess.TimeoutExpired:return {'exit_code':None,'timed_out':True,'safe_errors':None,'metadata':None}
 safe=safe_errors(result.stdout,result.stderr);metadata=None
 if result.returncode==0 and len(result.stdout)<=512*1024:
  try:
   value=json.loads(result.stdout);rows=value if type(value)is list else value.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'oauth_consent_diagnostic'});metadata=rows[0]['oauth_consent_diagnostic'];need(type(metadata)is dict and set(metadata)=={'during','bridge','managed_ddl_authority','marker'})
  except Exception:metadata=None
 return {'exit_code':result.returncode,'timed_out':False,'safe_errors':safe,'metadata':metadata}
def main():
 need(len(sys.argv)==1 and not CLAIM.exists());source=pins();before=v2.read_state();independent_before=v2.read_state();v2.check_before(before);v2.check_before(independent_before);need(equal(before,independent_before));marker=str(uuid.uuid4());sql=render(before,marker)
 PRIVATE.mkdir(parents=True,exist_ok=True)
 with CLAIM.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps({'target':v2.TARGET,'marker':marker,'source_pins':source,'diagnostic_sql_sha256':sha(sql.encode()),'dispatch_may_have_occurred':True,'explicit_rollback_only':True,'before':before},sort_keys=True)+'\n');f.flush();os.fsync(f.fileno())
 fresh=v2.read_state();v2.check_before(fresh);need(equal(fresh,before)and pins()==source)
 result=dispatch(sql);after=independent_after=None;unchanged=False
 try:after=v2.read_state();independent_after=v2.read_state();v2.check_before(after);v2.check_before(independent_after);unchanged=equal(after,before)and equal(independent_after,before)and pins()==source
 except Exception:pass
 receipt={'schema_version':'1.0','evidence_kind':'actual_canonical_corrected_full_wire_rollback_diagnostic_v4','target':v2.TARGET,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'diagnosed'if unchanged and(result['metadata']is not None or result['safe_errors']and(result['safe_errors']['sqlstates']or result['safe_errors']['sanitized_native_error']))else'unconfirmed','source_pins':source,'before':before,'independent_before':independent_before,'dispatch_attempted':True,'explicit_rollback_only':True,'commit_in_sql':False,'automatic_dispatch_retry':False,'claim_retained':True,'dispatch':result,'after':after,'independent_after':independent_after,'old31_metadata_unchanged_twice':unchanged,'raw_cli_persisted':False}
 file=ROOT/'tracking/evidence/m07/oauth-consent-fix'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-corrected-wire-v4-rollback-diagnostic.json')
 with file.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(ROOT).as_posix(),'old31_unchanged_twice':unchanged,'safe_error':result['safe_errors'],'metadata_captured':result['metadata']is not None}));need(unchanged)
if __name__=='__main__':
 try:main()
 except Exception:print('V2_DIAGNOSTIC_UNCONFIRMED');sys.exit(1)
