"""Finite source-only SQL40 builder. No database, CLI, Docker or provider calls."""
from pathlib import Path
import hashlib,json,re
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MIGRATION=ROOT/'supabase/migrations/20261102085405_m07_review_link_action_reason.sql'
BASE=HERE/'before-functions.json'
NAMES=('eps.review_remember(text,text,jsonb,jsonb,uuid)','public.eps_revoke_review_link(uuid,jsonb,text)','public.eps_rotate_review_link(uuid,jsonb,jsonb,text)','eps.review_gateway_verify(text,jsonb,jsonb)')
SOURCE_HASHES=('b9c377129a74c237dbf5aa6db2d76d1c4170e35fac5d04a6b15003d280c0764f','ccc280d9b16642012bf3e0f781d107bdac78c1fda4009b732fe7a8e33e3be083','10fc75a60494924ea63a7b3e5a7a42a4f2a596384357af611dd78a1155394428','6dcb44c5a8ed44f01528c929615c5a6232f86b38fdc3cf9ed20fcad4838742e4')
TRACE=""" begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;exception when invalid_text_representation then headers:='{}';end;
 if jsonb_typeof(headers)is distinct from'object'then headers:='{}';end if;
 request_id:=headers->>'x-eps-request-id';if request_id is not null and request_id!~'^[A-Za-z0-9._:-]{1,128}$'then request_id:=null;end if;
 client_type:=headers->>'x-eps-client-type';if client_type is null or client_type not in('browser','api','mcp')then client_type:='api';end if;
"""
REASON_GUARD=""" if octet_length(p_input::text)>65536+3 or p_input?'reason'and(jsonb_typeof(p_input->'reason')not in('string','null')or octet_length(p_input->>'reason')>65536)then perform eps.fail('VALIDATION_FAILED','Provide a string or null review-link reason within the request byte limit.',400);end if;
"""

def sha(raw):return hashlib.sha256(raw).hexdigest()
def need(value):
 if not value:raise ValueError('REASON40_SOURCE_COMPILATION_UNCONFIRMED')
def source(definition):
 m=re.search(r'AS (\$[^$]*\$)(.*?)\1',definition,re.S);need(m is not None);return m[2]
def patch(text,old,new):
 need(text.count(old)==1);return text.replace(old,new)

def build():
 before=json.loads(BASE.read_text(encoding='utf-8'));need(set(before)=={'history','routines'}and len(before['routines'])==4 and len(before['history'])==39)
 definitions=[];identities=[]
 for signature,expected in zip(NAMES,SOURCE_HASHES):
  routine=next(row for row in before['routines']if row['signature']==signature);original=source(routine['definition']);need(sha(original.encode())==expected);body=original.replace('\r\n','\n')
  if signature==NAMES[0]:
   body=patch(body,'begin\n',"declare headers jsonb:='{}';request_id text;client_type text;audit_reason text;begin\n")
   body=patch(body," insert into eps.audit_events(principal_id,action,resource_id)values(auth.uid(),'review.'||p_operation,p_resource);return p_result;",TRACE+" if p_operation in('revoke_link','rotate_link')then audit_reason:=p_input#>>'{input,reason}';end if;\n insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type,reason)values(auth.uid(),'review.'||p_operation,p_resource,request_id,client_type,audit_reason);return p_result;")
  elif signature in NAMES[1:3]:
   body=patch(body,"perform eps.review_body(p_input,array['row_version'],array['row_version']);","perform eps.review_body(p_input,array['row_version','reason'],array['row_version']);\n"+REASON_GUARD)
   if signature==NAMES[2]:
    body=patch(body,'cached eps.review_link_replays;begin',"cached eps.review_link_replays;headers jsonb:='{}';request_id text;client_type text;begin")
    body=patch(body," insert into eps.audit_events(principal_id,action,resource_id)values(auth.uid(),'review.rotate_link',item.id);",TRACE+" insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type,reason)values(auth.uid(),'review.rotate_link',item.id,request_id,client_type,p_input->>'reason');")
  else:
   body=patch(body,'issued bigint;now_ms bigint;begin','issued bigint;now_ms bigint;payload_limit integer:=65536;begin')
   anchor=" if jsonb_typeof(p_input)is distinct from'object'or octet_length(p_input::text)>65536"
   allowance=""" -- Only the fixed backend-attested rotation envelope carries an ArchiveRequest.
 -- The preceding review_body admits at most65536 canonical ArchiveRequest
 -- bytes; its two-field JSONB rendering gains at most three separator spaces.
 -- JSON string escaping uses at most six bytes per character; existing metadata
 -- bounds are key200, ciphertext16384, UUIDs36 each and digest64 characters.
 if p_operation='rotate_review_link'and jsonb_typeof(p_input)='object'then
  if not p_input?&array['actor_id','subject_id','input','idempotency_key','token_digest','response_encrypted']
  or exists(select 1 from jsonb_object_keys(p_input)k where not(k=any(array['actor_id','subject_id','input','idempotency_key','token_digest','response_encrypted'])))
  then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  perform eps.review_body(p_input->'input',array['row_version','reason'],array['row_version']);
  if jsonb_typeof(p_input->'actor_id')is distinct from'string'or(p_input->>'actor_id')!~'^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$'
  or jsonb_typeof(p_input->'subject_id')is distinct from'string'or(p_input->>'subject_id')!~'^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$'
  or jsonb_typeof(p_input->'idempotency_key')is distinct from'string'or length(p_input->>'idempotency_key')not between 16 and 200 or(p_input->>'idempotency_key')~'[[:cntrl:]]'
  or jsonb_typeof(p_input->'token_digest')is distinct from'string'or(p_input->>'token_digest')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(p_input->'response_encrypted')is distinct from'string'or length(p_input->>'response_encrypted')not between 1 and 16384
  or octet_length((p_input->'input')::text)>65536+3
  then perform eps.fail('REVIEW_UNAVAILABLE','Review access is unavailable.',404);end if;
  payload_limit:=65536+3+6*(200+16384)+36*2+64
   +octet_length(jsonb_build_object('actor_id','','subject_id','','input','null'::jsonb,'idempotency_key','','token_digest','','response_encrypted','')::text)-4;
 end if;
 if jsonb_typeof(p_input)is distinct from'object'or octet_length(p_input::text)>payload_limit"""
   body=patch(body,anchor,allowance)
  need(body!=original)
  definitions.append(patch(routine['definition'],original,body).replace('\r\n','\n').rstrip().removesuffix(';')+';\n')
  identities.append({'signature':signature,'prosrc_sha256':expected,'owner':routine['owner'],'acl':routine['acl']})
 history=','.join("'"+v+"'"for v in before['history'])
 values=','.join('('+','.join("'"+str(v).replace("'","''")+"'"for v in [row['signature'],row['prosrc_sha256'],row['owner'],json.dumps(row['acl'],separators=(',',':'))])+')'for row in identities)
 guard="""-- M07 additive review-link reason and existing review trace repair.
-- Local/source candidate only. Root coordinates exact canonical target admission.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $reason40$declare item record;actual pg_proc;before jsonb;begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[HISTORY]::text[]
 or exists(select 1 from pg_attribute where attrelid='eps.audit_events'::regclass and attname='reason'and not attisdropped)
 then raise exception'REASON40_EXACT39_BASELINE_REQUIRED';end if;
 for item in select * from(values VALUES)v(signature,source_sha,owner_name,acl_json)loop
  select * into strict actual from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(actual.prosrc,'UTF8')),'hex')<>item.source_sha
  or pg_get_userbyid(actual.proowner)<>item.owner_name
  or(select jsonb_agg(value order by value)from unnest(actual.proacl::text[])value)is distinct from(select jsonb_agg(value order by value)from jsonb_array_elements_text(item.acl_json::jsonb)value)
  then raise exception'REASON40_EXACT_FUNCTION_BASELINE_REQUIRED';end if;
 end loop;
 select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',p.prolang,'volatility',p.provolatile,'strict',p.proisstrict,'parallel',p.proparallel,'arguments',p.proargtypes::text,'result',p.prorettype)order by p.oid)into before from pg_proc p where p.oid=any(array[FUNCTION_OIDS]::oid[]);
 perform set_config('eps.reason40.before_function_identity',before::text,true);
end$reason40$;

-- BEGIN REASON40 FUNCTIONAL CHANGE
alter table eps.audit_events add column reason text;

""".replace('HISTORY',history).replace('VALUES',values).replace('FUNCTION_OIDS',','.join("'"+v+"'::regprocedure::oid"for v in NAMES))
 post="""
-- END REASON40 FUNCTIONAL CHANGE
do $reason40$declare actual jsonb;begin
 select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',p.prolang,'volatility',p.provolatile,'strict',p.proisstrict,'parallel',p.proparallel,'arguments',p.proargtypes::text,'result',p.prorettype)order by p.oid)into actual from pg_proc p where p.oid=any(array[FUNCTION_OIDS]::oid[]);
 if actual is distinct from current_setting('eps.reason40.before_function_identity')::jsonb then raise exception'REASON40_FUNCTION_IDENTITY_CHANGED';end if;
 if exists(select 1 from eps.audit_events where reason is not null)then raise exception'REASON40_HISTORICAL_AUDIT_CHANGED';end if;
end$reason40$;
""".replace('FUNCTION_OIDS',','.join("'"+v+"'::regprocedure::oid"for v in NAMES))
 return guard+'\n'.join(definitions)+post

if __name__=='__main__':
 text=build();MIGRATION.write_text(text,encoding='utf-8',newline='\n');print(json.dumps({'migration':str(MIGRATION),'sha256':sha(text.encode()),'database_or_provider_called':False}))
