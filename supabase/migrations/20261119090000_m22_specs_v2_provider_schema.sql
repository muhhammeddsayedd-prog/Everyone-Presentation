-- m22: re-pin the extraction v2 provider schema hash.
-- The provider-schema adapter dropped the Scene property "title" (it treated every key named "title" as an
-- annotation) while keeping it in `required`, so OpenAI strict Structured Outputs rejected every v2 request
-- (HTTP 400 invalid_json_schema; production jobs 2026-11-18). The adapter now keeps property names; the v2 provider
-- schema hash changes from cd80820d… to a57c08f1…. v1 pins are unchanged. Only eps.specs_stage_metadata changes.
-- Requires m21. Refuses a second run.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';
do $m22$
declare source text;definition text;
 needle text:=$n$p_value->>'provider_schema_sha256'='cd80820db66ad4e22d3cce7dc9dbfb07f2da6aee4e74697d2f81fe9c5b5123fc'$n$;
 patch text:=$r$p_value->>'provider_schema_sha256'='a57c08f1e016f2187e91faa8a5d42f97b3f6861ac15608ea4267a82332d729d1'$r$;
begin
 if to_regprocedure('eps.previous_client()') is null then raise exception 'M22_REQUIRES_M21'; end if;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n') into source,definition
  from pg_proc where oid='eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'::regprocedure;
 if position(patch in source)>0 then raise exception 'M22_ALREADY_APPLIED'; end if;
 if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then raise exception 'M22_ANCHOR_REQUIRED'; end if;
 execute replace(definition,source,replace(source,needle,patch));
 if (select prosrc from pg_proc where oid='eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'::regprocedure) !~ 'a57c08f1e016f2187e91faa8a5d42f97b3f6861ac15608ea4267a82332d729d1'
  or (select prosrc from pg_proc where oid='eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'::regprocedure) !~ 'd73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216'
 then raise exception 'M22_READBACK_FAILED'; end if;
end$m22$;
