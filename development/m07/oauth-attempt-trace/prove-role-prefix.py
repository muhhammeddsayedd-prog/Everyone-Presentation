"""Prove the existing coordinator role's namespace failure without an identity."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('attempt_reader',HERE/'inspect-attempt.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)

def main():
 base.need(len(sys.argv)==1 and(base.ROOT/'supabase/.temp/project-ref').read_text().strip()==base.TARGET)
 source=HERE/'prove-role-prefix.sql';sql=source.read_bytes()
 base.need(sql==b'-- No JWT, acting identity, selector or provider call. This is a read-only prefix.\nbegin read only;\nset local role eps_oauth_consent_owner;\nselect auth.uid();\nrollback;\n')
 cmd=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',base.TARGET,'--file',str(source),'--output-format','json','--workdir',str(base.ROOT)]
 code,timeout,overflow,stdout,stderr=base.bounded(cmd,base.environment());error=base.safe_errors(stdout,stderr)
 confirmed=code!=0 and not timeout and not overflow and error['sqlstates']==['42501']and 'permission denied for schema auth'in error['sanitized_native_error']
 receipt={'schema_version':'1.0','evidence_kind':'actual_identity_free_coordinator_prefix_read','target':base.TARGET,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sql_sha256':hashlib.sha256(sql).hexdigest(),'read_only':True,'jwt_supplied':False,'actor_emulation':False,'provider_request':False,'selector_supplied':False,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'safe_error':error,'missing_auth_usage_prefix_failure_confirmed':confirmed,'raw_cli_persisted':False}
 out=base.ROOT/'tracking/evidence/m07/oauth-attempt-trace';out.mkdir(parents=True,exist_ok=True)
 path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-role-prefix-proof.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':'confirmed'if confirmed else'unconfirmed','receipt':path.relative_to(base.ROOT).as_posix(),'safe_error':error}));base.need(confirmed)

if __name__=='__main__':
 try:main()
 except Exception:print('ROLE_PREFIX_PROOF_UNCONFIRMED');sys.exit(1)
