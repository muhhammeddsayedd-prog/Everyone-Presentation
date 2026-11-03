"""Cache-free scalar source candidate inside the existing permission function."""
from pathlib import Path
import hashlib
import re

HERE=Path(__file__).resolve().parent
METADATA=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
METADATA_SHA='12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
BEFORE_BODY_SHA='5eb6c1272a78a4ca821569082c54d2b1ce434516585c8eac533c29ec1c445ccc'
AFTER_BODY_SHA='8455eeb4094d74a11e487627711f237192c9b591fdf61d1b54b9114bedd487ab'
VALIDATOR_BODY_SHA='9fe44accb3998d924bb0f453c721a33f5603f20e4c245abbf0e46807561891f6'
ENTRY_ENABLED=False
OUTER_DECLARE='declare claims jsonb:=auth.jwt();cid uuid:=eps.mcp_claim_uuid(\'client_id\');state jsonb;begin'
BYPASS=" if not(claims?'eps_delegation')and not exists(select 1 from eps.mcp_oauth_resources where client_id=cid)then return true;end if;"
CALL=""" state:=public.eps_validate_own_oauth_session(claims#>>'{eps_delegation,resource}');
 return state->'active'='true'::jsonb and state->'capabilities'?p_capability;"""
VALIDATOR_DECLARE="declare claims jsonb:=auth.jwt();principal uuid:=auth.uid();sid uuid:=eps.mcp_claim_uuid('session_id');cid uuid:=eps.mcp_claim_uuid('client_id');delegation jsonb;inactive jsonb;capabilities jsonb;now_epoch numeric:=extract(epoch from clock_timestamp());begin"
INACTIVE=" inactive:=jsonb_build_object('active',false,'principal_id',principal,'session_id',sid,'client_id',cid,'capabilities','[]'::jsonb);\n"
GRANTS=""" select coalesce(jsonb_agg(capability order by capability),'[]'::jsonb)into capabilities from public.app_capability_grants g
 where g.principal_id=principal and g.active and delegation->'capabilities'?g.capability;
 return jsonb_build_object('active',true,'principal_id',principal,'session_id',sid,'client_id',cid,'capabilities',capabilities);"""
SCALAR_GRANTS=""" select exists(select 1 from public.app_capability_grants g
 where g.principal_id=principal and g.active and delegation->'capabilities'?g.capability
 and(p_capability is null or g.capability=p_capability))into permitted;
 if p_capability is null then return null;end if;
 return permitted;"""


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('MCP_SCALAR_CAPABILITY_SOURCE_UNCONFIRMED')


def parts(definition):
    match=re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$',definition,re.S)
    need(match is not None);return match


def definitions():
    info=METADATA.lstat();need(METADATA.is_file()and not METADATA.is_symlink()and info.st_nlink==1)
    raw=METADATA.read_bytes();need(sha(raw)==METADATA_SHA);text=raw.decode('utf8').replace('\r\n','\n')
    result=[]
    for name,digest in [('eps.mcp_token_permits_capability',BEFORE_BODY_SHA),('public.eps_validate_own_oauth_session',VALIDATOR_BODY_SHA)]:
        match=re.search(r'CREATE FUNCTION '+re.escape(name)+r'\([^\n]*\) RETURNS [^\n]+\n.*? AS (\$[a-zA-Z0-9_]*\$).*?\1;',text,re.S)
        need(match is not None);definition=match[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1)
        need(sha(parts(definition)[2].encode())==digest);result.append(definition)
    return tuple(result)


def nested_edits():
    declaration="declare p_resource text:=scalar_token.claims#>>'{eps_delegation,resource}';"+VALIDATOR_DECLARE[len('declare '):]
    declaration=declaration.replace('capabilities jsonb;','capabilities jsonb;permitted boolean;',1)
    return[(VALIDATOR_DECLARE,declaration),(INACTIVE,''),('return inactive;','return false;'),(GRANTS,SCALAR_GRANTS)]


def nested_validator(body):
    need(sha(body.encode())==VALIDATOR_BODY_SHA)
    need(body.startswith('\n'+VALIDATOR_DECLARE+'\n')and body.endswith('\nend'))
    source=body
    counts=[]
    for a,b in nested_edits():
        count=source.count(a);need(count>0 and(a=='return inactive;'or count==1));counts.append(count);source=source.replace(a,b)
    # A nested PL/pgSQL block is terminated; its RETURN exits the same function.
    result=source+';'
    inverse=source
    for(a,b),count in reversed(list(zip(nested_edits(),counts))):
        if b:need(inverse.count(b)==count);inverse=inverse.replace(b,a)
        else:
            anchor='\n if principal is null';need(inverse.count(anchor)==1);inverse=inverse.replace(anchor,'\n'+a+anchor.lstrip('\n'),1)
    need(inverse==body)
    return result,{'inverse_byte_equal':True,'inactive_return_count':counts[2],
                   'fresh_validator_initializers_remain_post_bypass':True,'resource_argument_uses_outer_claims':True,
                   'clock_initialization_order_and_resource_session_queries_unchanged':True}


def edits():
    _,validator=definitions();block,proof=nested_validator(parts(validator)[2])
    return[(OUTER_DECLARE,'<<scalar_token>>\n'+OUTER_DECLARE),(CALL,block)],proof


def patch_body(body):
    need(sha(body.encode())==BEFORE_BODY_SHA and body.count(BYPASS)==1)
    source=body;changes,_=edits()
    for a,b in changes:need(source.count(a)==1 and b not in source);source=source.replace(a,b,1)
    inverse=source
    for a,b in reversed(changes):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    need(inverse==body and sha(source.encode())==AFTER_BODY_SHA);return source


def inverse(body):
    need(sha(body.encode())==AFTER_BODY_SHA)
    for a,b in reversed(edits()[0]):need(body.count(b)==1);body=body.replace(b,a,1)
    need(sha(body.encode())==BEFORE_BODY_SHA);return body


def build():
    before,validator=definitions();match=parts(before);body=patch_body(match[2]);after=before[:match.start(2)]+body+before[match.end(2):]
    return{'name':'eps.mcp_token_permits_capability','before':before,'after':after,
           'before_body_sha256':BEFORE_BODY_SHA,'after_body_sha256':sha(body.encode()),
           'before_definition_sha256':sha(before.encode()),'after_definition_sha256':sha(after.encode()),
           'unchanged_public_validator_body_sha256':VALIDATOR_BODY_SHA,
           'outer_declaration_and_browser_bypass_unchanged':True,'nested_validator_proof':edits()[1],
           'two_edit_inverse_byte_equal':True,'public_DTO_owner_ACL_policy_mode_timeout_unchanged':True,
           'authority_session_or_clock_result_cache':False,'fresh_grant_read_precedes_valid_NULL_return':True,
           'performance_or_actual_database_parity_claimed':False}


if __name__=='__main__':need(ENTRY_ENABLED)
