
declare claims jsonb:=auth.jwt();cid uuid:=eps.mcp_claim_uuid('client_id');state jsonb;begin
 if not(claims?'eps_delegation')and not exists(select 1 from eps.mcp_oauth_resources where client_id=cid)then return true;end if;
 state:=public.eps_validate_own_oauth_session(claims#>>'{eps_delegation,resource}');
 return state->'active'='true'::jsonb and state->'capabilities'?p_capability;
end