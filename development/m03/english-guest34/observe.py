"""One fixed, read-only self-test link observation per before/after phase."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,re,stat,sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';SERIES='93fb7425-7311-4b69-94cb-61588724c153';WORKSPACE='86936940-b48d-497d-b1ff-8e0da0913afa';VERSION='4f1b81a1-adb7-425b-8223-458d8bd82c28'
SQL=HERE/'link-metadata.sql';SQL_SHA='befd6726339076a3a81b501cda2c9744a0598fdd3041934295118dc3b49d5bf9'
READER='development/m07/oauth-attempt-trace/inspect-attempt.py'
PRESERVATION='tracking/evidence/m03/english-preservation34/2026-10-31T18-19-53-933196Z-feac4485-c968-4ba5-a92d-c65f909d4f87-compare.json'
PINS={READER:'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_logo.py':'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4',
 PRESERVATION:'9f53182d9d8ffe51ebd2c5018de23b70c1874ab823769953ddcfe9ea5c37c9c1'}
UUID=re.compile(r'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$')
def need(value):
 if not value:raise ValueError('GUEST_LINK_METADATA_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def exact(value,keys):need(type(value)is dict and set(value)==set(keys))
def timestamp(value):
 need(type(value)is str and len(value)<=40);v=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));need(v.tzinfo is not None and v.utcoffset()==datetime.timedelta(0));return v
def parse(payload,phase,expected_id=None):
 need(phase in('before','after'));need(expected_id is None if phase=='before'else type(expected_id)is str and UUID.fullmatch(expected_id))
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1);exact(rows[0],{'guest_link_metadata'});v=rows[0]['guest_link_metadata']
 exact(v,{'database','operator','observed_at','read_only','exact_history34','english_enabled','scope_match_count','link_match_count','link','guest_session_rows'})
 need(v['database']=='postgres'and v['operator']=='postgres'and all(v[k]is True for k in('read_only','exact_history34','english_enabled')))
 need(type(v['scope_match_count'])is int and v['scope_match_count']==1 and type(v['link_match_count'])is int and v['link_match_count']==1)
 at=timestamp(v['observed_at']);link=v['link']
 exact(link,{'review_link_id','series_id','workspace_id','row_version','created_at','expires_at','revoked_at','download_enabled','current_ready_version_id','current_ready_version_no'})
 need(type(link['review_link_id'])is str and UUID.fullmatch(link['review_link_id'])and(expected_id is None or link['review_link_id']==expected_id))
 need(link['series_id']==SERIES and link['workspace_id']==WORKSPACE and link['current_ready_version_id']==VERSION and type(link['current_ready_version_no'])is int and link['current_ready_version_no']==1)
 need(type(link['row_version'])is int and 1<=link['row_version']<=9007199254740991 and type(link['download_enabled'])is bool)
 created=timestamp(link['created_at']);expires=timestamp(link['expires_at']);need(created<=at and created<expires)
 revoked=link['revoked_at'];need(revoked is None or created<=timestamp(revoked)<=at)
 counts=v['guest_session_rows'];exact(counts,{'limit','truncated','count','unexpired_row_count'});need(type(counts['limit'])is int and counts['limit']==100 and type(counts['truncated'])is bool)
 if counts['truncated']:need(counts['count']is None and counts['unexpired_row_count']is None)
 else:need(type(counts['count'])is int and type(counts['unexpired_row_count'])is int and 0<=counts['unexpired_row_count']<=counts['count']<=100)
 return v,revoked is not None if phase=='after'else revoked is None and expires>at
def regular(file,digest):
 info=file.lstat();need(stat.S_ISREG(info.st_mode)and info.st_nlink==1 and not file.is_symlink()and file.resolve()==file and sha(file.read_bytes())==digest)
def sources():
 regular(SQL,SQL_SHA)
 for name,digest in PINS.items():regular(ROOT/name,digest)
 code=re.sub(r'--[^\r\n]*','',SQL.read_text(encoding='utf8'))
 need(code.strip().startswith('begin isolation level repeatable read read only;')and code.rstrip().endswith('rollback;'))
 code=re.sub(r"'(?:''|[^'])*'","''",code)
 need(not re.search(r'\b(insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|copy|call|do|execute|commit|set_config|token_digest|session_token_digest|display_name|company|user_agent|original_transcript|english_transcript|object_key)\b',code,re.I))
 return SQL.read_bytes()
def load_security_module():
 for name in ['provision_logo_verifier.py','release_foundation.py','release_logo.py']:regular(ROOT/'tools'/name,PINS['tools/'+name])
 saved=list(sys.path)
 try:
  sys.path.insert(0,str(ROOT/'tools'))
  spec=importlib.util.spec_from_file_location('guest_private_files',ROOT/'tools/provision_logo_verifier.py');secure=importlib.util.module_from_spec(spec);spec.loader.exec_module(secure)
  for name in ['release_foundation','release_logo']:need(Path(sys.modules[name].__file__).resolve()==ROOT/'tools'/(name+'.py'))
 finally:sys.path[:]=saved
 return secure
def main():
 need(len(sys.argv)in(2,3));phase=sys.argv[1];expected=sys.argv[2]if len(sys.argv)==3 else None
 need(phase=='before'and expected is None or phase=='after'and type(expected)is str and UUID.fullmatch(expected))
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET);raw=sources()
 secure=load_security_module()
 security=secure.WindowsPrivateFiles()
 private=ROOT/'.local/m03-english-guest34';private.mkdir(exist_ok=True);need(not private.is_symlink()and private.resolve()==private)
 with security.create(private/(phase+'.claim.json'))as stream:stream.write(json.dumps({'phase':phase,'expected_review_link_id':expected,'query_sha256':SQL_SHA,'maximum_cli_queries':1,'automatic_retry':False}).encode())
 query=private/(phase+'.sql')
 with security.create(query)as stream:stream.write(raw)
 security.verify(query);regular(query,SQL_SHA)
 spec=importlib.util.spec_from_file_location('guest_fixed_cli_reader',ROOT/READER);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(query),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,reader.environment());need(code==0 and not timeout and not overflow)
 value,desired=parse(json.loads(stdout),phase,expected)
 report={'schema_version':'1.0','evidence_kind':'actual_fixed_selftest_review_link_read_only_metadata','target':TARGET,'phase':phase,'maximum_cli_queries':1,'automatic_retry':False,'observation':value,'desired_lifecycle_state_observed':desired,'source_pins':{**PINS,'query_sha256':SQL_SHA,'operator_sha256':sha(Path(__file__).read_bytes())},'bearer_or_cookie_or_digest_or_private_text_persisted':False,'business_mutations':False,'guest_session_rows_are_authorized_sessions_claim':False,'prior_preservation_reference':PRESERVATION,'prior_preservation_reexecuted':False,'guest_browser_playback_or_revocation_denial_acceptance':False}
 folder=ROOT/'tracking/evidence/m03/english-guest34';folder.mkdir(parents=True,exist_ok=True)
 file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+phase+'-link-metadata.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'receipt':file.relative_to(ROOT).as_posix(),'review_link_id':value['link']['review_link_id'],'phase':phase,'desired_lifecycle_state_observed':desired}))
if __name__=='__main__':
 try:main()
 except Exception:print('GUEST_LINK_METADATA_UNCONFIRMED');sys.exit(1)
