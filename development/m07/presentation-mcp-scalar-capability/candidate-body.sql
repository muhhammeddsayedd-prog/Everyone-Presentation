
<<scalar_token>>
declare claims jsonb:=auth.jwt();cid uuid:=eps.mcp_claim_uuid('client_id');state jsonb;begin
 if not(claims?'eps_delegation')and not exists(select 1 from eps.mcp_oauth_resources where client_id=cid)then return true;end if;

declare p_resource text:=scalar_token.claims#>>'{eps_delegation,resource}';claims jsonb:=auth.jwt();principal uuid:=auth.uid();sid uuid:=eps.mcp_claim_uuid('session_id');cid uuid:=eps.mcp_claim_uuid('client_id');delegation jsonb;inactive jsonb;capabilities jsonb;permitted boolean;now_epoch numeric:=extract(epoch from clock_timestamp());begin
 if principal is null or sid is null or cid is null or claims->>'role'is distinct from'authenticated'or claims->'is_anonymous'is distinct from'false'::jsonb
 or p_resource is null or length(p_resource)not between 1 and 2048 or jsonb_typeof(claims->'aud')is distinct from'string'or claims->>'aud'is distinct from p_resource
 then return false;end if;
 -- Numeric bounds and types precede casts. This projection is not a signature
 -- verifier: PostgREST verifies JWTs and the resource gate verifies them again.
 if jsonb_typeof(claims->'exp')is distinct from'number'or claims->>'exp'!~'^[0-9]{1,12}$'
 or jsonb_typeof(claims->'iat')is distinct from'number'or claims->>'iat'!~'^[0-9]{1,12}$'then return false;end if;
 if(claims->>'exp')::numeric<=now_epoch or(claims->>'iat')::numeric>now_epoch then return false;end if;
 if claims?'nbf'then
  if jsonb_typeof(claims->'nbf')is distinct from'number'or claims->>'nbf'!~'^[0-9]{1,12}$'then return false;end if;
  if(claims->>'nbf')::numeric>now_epoch then return false;end if;
 end if;
 if not'openid'=any(regexp_split_to_array(coalesce(claims->>'scope',''),E'\\s+'))then return false;end if;
 delegation:=claims->'eps_delegation';
 if jsonb_typeof(delegation)is distinct from'object'then return false;end if;
 if(select count(*)from jsonb_object_keys(delegation))<>4 or delegation->'v'is distinct from'1'::jsonb
 or delegation->>'resource'is distinct from p_resource or delegation->>'client_id'is distinct from cid::text
 or jsonb_typeof(delegation->'capabilities')is distinct from'array'then return false;end if;
 if jsonb_array_length(delegation->'capabilities')not between 1 and 32
 or exists(select 1 from jsonb_array_elements(delegation->'capabilities')v where jsonb_typeof(v)<>'string'or v#>>'{}'not in('projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry'))then return false;end if;
 if not exists(select 1 from eps.mcp_oauth_resources where resource=p_resource and client_id=cid and enabled)
 or not exists(select 1 from auth.sessions where id=sid and user_id=principal and oauth_client_id=cid and(not_after is null or not_after>clock_timestamp())and'openid'=any(regexp_split_to_array(coalesce(scopes,''),E'\\s+')))
 then return false;end if;
 select exists(select 1 from public.app_capability_grants g
 where g.principal_id=principal and g.active and delegation->'capabilities'?g.capability
 and(p_capability is null or g.capability=p_capability))into permitted;
 if p_capability is null then return null;end if;
 return permitted;
end;
end