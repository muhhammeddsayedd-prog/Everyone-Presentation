-- M07: body-free exact-version feedback counts. No table/RLS/identity mutation.
-- Current guest body independently matches the authored M06 source and applied30 catalogue.
begin;
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';
do $feedback37_admit$declare p pg_proc;begin
 if current_database()<>'postgres' or current_user<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000','20261031104603','20261031130207','20261031143711','20261031182038','20261101012057']::text[]
 or to_regprocedure('eps.feedback_summary(uuid,boolean)')is not null
 or to_regprocedure('public.eps_get_feedback_summary(uuid)')is not null
 or not exists(select 1 from pg_roles where rolname='eps_review_owner'and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)
 or not exists(select 1 from pg_roles where rolname='eps_guest_owner'and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)
 or has_schema_privilege('eps_review_owner','eps','CREATE')or has_schema_privilege('eps_review_owner','public','CREATE')
 then raise exception'M07_FEEDBACK_EXACT36_REQUIRED';end if;
 select *into p from pg_proc where oid=to_regprocedure('public.eps_guest_operation(text,jsonb,jsonb)');
 if p.oid is null or p.proowner<>(select oid from pg_roles where rolname='eps_guest_owner')or not p.prosecdef or p.provolatile<>'v'
 or p.prolang<>(select oid from pg_language where lanname='plpgsql')or p.prokind<>'f'or p.proparallel<>'u'or p.proisstrict or p.proleakproof
 or p.proretset or p.prorettype<>'jsonb'::regtype or p.pronargdefaults<>0 or p.provariadic<>0 or p.prosupport<>0
 or p.proconfig is distinct from array['search_path=""']::text[]
 or encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')<>'f5a2a813cce9d990b972ef2e4006b15dce1a2c7b4f0d0e85cec82587fa97d53c'
 or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x where x.grantor<>p.proowner)
 or exists((select r.rolname g,x.privilege_type,x.is_grantable from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x left join pg_roles r on r.oid=x.grantee
 except select*from(values('eps_guest_owner'::name,'EXECUTE'::text,false),('anon'::name,'EXECUTE'::text,false),('authenticated'::name,'EXECUTE'::text,false))v)
 union all(select*from(values('eps_guest_owner'::name,'EXECUTE'::text,false),('anon'::name,'EXECUTE'::text,false),('authenticated'::name,'EXECUTE'::text,false))v
 except select r.rolname,x.privilege_type,x.is_grantable from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x left join pg_roles r on r.oid=x.grantee))
 then raise exception'M07_FEEDBACK_EXACT_GUEST_PORT_REQUIRED';end if;
 perform set_config('eps.feedback_summary37.guest_before',(to_jsonb(p)-'prosrc')::text,true);
end$feedback37_admit$;

create function eps.feedback_summary(p_version uuid,p_external boolean)returns jsonb language plpgsql stable security invoker set search_path=''as $feedback37_summary$
declare result jsonb;begin
 if p_external is null then perform eps.fail('VALIDATION_FAILED','Provide the fixed feedback audience.',400);end if;
 perform eps.feedback_version(p_version);
 with slides as(select id,ordinal,kind from eps.version_slides where version_id=p_version),
 comments as(select c.slide_id,count(*)n,count(*)filter(where not c.resolved)unresolved
  from eps.feedback_comments c join slides s on s.id=c.slide_id and s.kind in('candidate','pending')
  where c.version_id=p_version and c.deleted_at is null and(not p_external or c.visibility='external')group by c.slide_id),
 votes as(select p.slide_id,count(*)filter(where p.preference='preferred')preferred,count(*)filter(where p.preference='maybe')maybe,count(*)filter(where p.preference='not_preferred')not_preferred
  from eps.feedback_preferences p join slides s on s.id=p.slide_id and s.kind='candidate'where p.version_id=p_version group by p.slide_id),
 per_slide as(select s.id,s.ordinal,coalesce(v.preferred,0)preferred,coalesce(v.maybe,0)maybe,coalesce(v.not_preferred,0)not_preferred,
  coalesce(c.n,0)comment_count,coalesce(c.unresolved,0)unresolved_count from slides s left join comments c on c.slide_id=s.id left join votes v on v.slide_id=s.id)
 select jsonb_build_object('version_id',p_version,'per_slide',coalesce(jsonb_agg(jsonb_build_object('version_slide_id',id,'preferred',preferred,'maybe',maybe,'not_preferred',not_preferred,'comment_count',comment_count,'unresolved_count',unresolved_count)order by ordinal),'[]'::jsonb),
 'totals',jsonb_build_object('preferred',coalesce(sum(preferred),0),'maybe',coalesce(sum(maybe),0),'not_preferred',coalesce(sum(not_preferred),0),'comment_count',coalesce(sum(comment_count),0),'unresolved_count',coalesce(sum(unresolved_count),0)))into result from per_slide;
 return result;
end$feedback37_summary$;
create function public.eps_get_feedback_summary(p_version_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $feedback37_internal$
begin perform eps.feedback_internal_require(p_version_id);return eps.feedback_summary(p_version_id,false);end$feedback37_internal$;

grant create on schema eps,public to eps_review_owner;
alter function eps.feedback_summary(uuid,boolean)owner to eps_review_owner;
alter function public.eps_get_feedback_summary(uuid)owner to eps_review_owner;
revoke create on schema eps,public from eps_review_owner;
revoke all on function eps.feedback_summary(uuid,boolean),public.eps_get_feedback_summary(uuid)from public,anon,authenticated,service_role;
grant execute on function eps.feedback_summary(uuid,boolean)to eps_review_owner,eps_guest_owner;
grant execute on function public.eps_get_feedback_summary(uuid)to authenticated;

do $feedback37_patch$declare source text;definition text;replacement text;p pg_proc;begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid='public.eps_guest_operation(text,jsonb,jsonb)'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'f5a2a813cce9d990b972ef2e4006b15dce1a2c7b4f0d0e85cec82587fa97d53c'
 or(length(source)-length(replace(source,' elsif p_operation=''list_feedback''then','')))<>length(' elsif p_operation=''list_feedback''then')then raise exception'M07_FEEDBACK_GUEST_PATCH_SOURCE_REQUIRED';end if;
 replacement:=replace(source,' elsif p_operation=''list_feedback''then',' elsif p_operation=''get_feedback_summary''then
  perform eps.review_body(p_input,array[''session_digest'',''version_id''],array[''session_digest'',''version_id'']);
  version:=eps.feedback_version(eps.casting_uuid(p_input->''version_id''),link.series_id);
  return eps.feedback_summary(version.id,true);
 elsif p_operation=''list_feedback''then');
 if encode(sha256(convert_to(replacement,'UTF8')),'hex')<>'1a4f925db46f580d2d8c6baa682948f28955a41fb26ba86fb563b7189248229b'
 or(length(definition)-length(replace(definition,source,'')))<>length(source)then raise exception'M07_FEEDBACK_GUEST_EXACT_PATCH_REQUIRED';end if;
 execute replace(definition,source,replacement);
 select *into p from pg_proc where oid='public.eps_guest_operation(text,jsonb,jsonb)'::regprocedure;
 if(to_jsonb(p)-'prosrc')is distinct from current_setting('eps.feedback_summary37.guest_before')::jsonb
 or encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>'1a4f925db46f580d2d8c6baa682948f28955a41fb26ba86fb563b7189248229b'then raise exception'M07_FEEDBACK_GUEST_METADATA_CHANGED';end if;
end$feedback37_patch$;
notify pgrst,'reload schema';
commit;
