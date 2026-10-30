-- Extend the existing authenticated capability projection with the saved
-- central display default. No full Settings read is granted to ordinary users.
grant select(singleton,default_timezone)on eps.app_settings to eps_api_owner;
create policy capabilities_timezone_default on eps.app_settings for select to eps_api_owner
 using(auth.uid()is not null and coalesce(auth.jwt()->'is_anonymous','false'::jsonb)='false'::jsonb);
do $forward$declare source text;definition text;replacement text;needle text:='''timezone'',''Africa/Cairo''';begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid='public.eps_get_capabilities()'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'e08212ed292c5893688bcdd9ef314a00d74b1d13974af2f7f273acb99ae10d3e'
 or(length(source)-length(replace(source,needle,'')))/length(needle)<>1
 or(length(source)-length(replace(source,'g.active)','')))/length('g.active)')<>1
 then raise exception'M07_CAPABILITIES_SOURCE28_REQUIRED';end if;
 replacement:=replace(source,needle,'''timezone'',(select default_timezone from eps.app_settings where singleton)');
 -- Advertise the same effective delegated authority that the SQL operation
 -- boundary enforces; ordinary browser capabilities remain unchanged.
 replacement:=replace(replacement,'g.active)','g.active and eps.has_capability(g.capability))');
 execute replace(definition,source,replacement);
end$forward$;
