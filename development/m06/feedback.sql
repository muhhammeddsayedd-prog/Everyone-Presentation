create function eps.feedback_comment_dto(p_item eps.feedback_comments)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_item.id,'series_id',p_item.series_id,'version_id',p_item.version_id,'version_slide_id',p_item.slide_id,'guest_session_id',p_item.guest_session_id,'author_display_name',p_item.author_name_snapshot,'company',p_item.company_snapshot,'visibility',p_item.visibility,'body',p_item.body,'parent_comment_id',p_item.parent_comment_id,'resolved',p_item.resolved,'row_version',p_item.row_version,'created_at',eps.presentation_time(p_item.created_at),'updated_at',eps.presentation_time(p_item.updated_at))
$$;
create function eps.feedback_preference_dto(p_item eps.feedback_preferences)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_item.id,'version_slide_id',p_item.slide_id,'guest_session_id',p_item.guest_session_id,'author_display_name',p_item.author_name_snapshot,'value',p_item.preference,'row_version',p_item.row_version,'updated_at',eps.presentation_time(p_item.updated_at))
$$;
create function eps.feedback_version(p_version uuid,p_series uuid default null)returns eps.presentation_versions language plpgsql stable security invoker set search_path=''as $$declare item eps.presentation_versions;begin
 select * into item from eps.presentation_versions where id=p_version and status='ready'and(p_series is null or series_id=p_series);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Shared version not found.',404);end if;
 if p_series is not null and not exists(select 1 from eps.presentation_series s where s.id=p_series and s.audience_snapshot->>'scope'='external'
 and item.snapshot->>'series_id'=s.id::text and item.snapshot#>'{audience_snapshot}'=s.audience_snapshot and item.snapshot#>>'{audience_snapshot,scope}'='external'
 and item.snapshot#>>'{cover,output_type}'=s.output_type and item.snapshot#>>'{template,key}'=s.template_key and item.snapshot#>>'{template,version}'=s.template_version and item.snapshot#>>'{template,content_sha256}'=s.template_content_sha256)
 then perform eps.fail('RESOURCE_NOT_FOUND','Shared version not found.',404);end if;return item;
end$$;
create function eps.feedback_page(p_version uuid,p_external boolean,p_options jsonb)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare maximum integer;cursor_text text;last_key text;keys text[];comments jsonb;preferences jsonb;begin
 perform eps.review_body(p_options,array['cursor','limit','version_slide_id']);maximum:=case when p_options?'limit'then eps.logo_integer(p_options->'limit',1,100)else 25 end;
 if p_options?'cursor'then cursor_text:=p_options->>'cursor';if cursor_text!~'^[a-f0-9-]{36}:[cp]$'then perform eps.fail('VALIDATION_FAILED','Invalid feedback cursor.',400);end if;end if;
 if p_options?'version_slide_id'then perform eps.casting_uuid(p_options->'version_slide_id');end if;
 select array_agg(key order by key),max(key)into keys,last_key from(
  select key from(
   select c.id::text||':c'as key,c.slide_id from eps.feedback_comments c where c.version_id=p_version and c.deleted_at is null and(not p_external or c.visibility='external')
   union all select f.id::text||':p',f.slide_id from eps.feedback_preferences f where f.version_id=p_version
  )items where(cursor_text is null or key>cursor_text)and(not p_options?'version_slide_id'or slide_id=eps.casting_uuid(p_options->'version_slide_id'))order by key limit maximum+1
 )page;
 if cardinality(keys)>maximum then keys:=keys[1:maximum];last_key:=keys[maximum];else last_key:=null;end if;
 select coalesce(jsonb_agg(eps.feedback_comment_dto(c)order by c.id),'[]')into comments from eps.feedback_comments c where c.version_id=p_version and c.id::text||':c'=any(keys)and c.deleted_at is null and(not p_external or c.visibility='external');
 select coalesce(jsonb_agg(eps.feedback_preference_dto(f)order by f.id),'[]')into preferences from eps.feedback_preferences f where f.version_id=p_version and f.id::text||':p'=any(keys);
 return jsonb_build_object('version_id',p_version,'comments',comments,'preferences',preferences,'page',jsonb_build_object('next_cursor',last_key));
end$$;
create function eps.feedback_mutate(p_guest uuid,p_principal uuid,p_version uuid,p_action text,p_input jsonb)returns jsonb language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;slide eps.version_slides;comment eps.feedback_comments;parent eps.feedback_comments;preference eps.feedback_preferences;guest eps.guest_sessions;author text;company text;requested_version bigint;begin
 if(p_guest is null)=(p_principal is null)then perform eps.fail('ACCESS_DENIED','Invalid feedback identity.',403);end if;
 version:=eps.feedback_version(p_version);
 if p_guest is not null then select * into guest from eps.guest_sessions where id=p_guest;if not found or guest.display_name is null then perform eps.fail('GUEST_IDENTITY_REQUIRED','Enter your name before adding feedback.',422);end if;author:=guest.display_name;company:=guest.company;
 else author:='Production';end if;
 if p_action in('create_comment','set_preference')then
  select * into slide from eps.version_slides where id=eps.casting_uuid(p_input->'version_slide_id')and version_id=version.id;
  if not found or slide.kind='cover'or(p_action='set_preference'and slide.kind<>'candidate')then perform eps.fail('RESOURCE_NOT_FOUND','Feedback slide not found.',404);end if;
 end if;
 if p_action='create_comment'then
  if jsonb_typeof(p_input->'body')is distinct from'string'or length(btrim(p_input->>'body'))not between 1 and 10000 then perform eps.fail('VALIDATION_FAILED','Provide a bounded comment.',400);end if;
  if p_input?'parent_comment_id'then select * into parent from eps.feedback_comments where id=eps.casting_uuid(p_input->'parent_comment_id')and version_id=version.id and slide_id=slide.id and deleted_at is null and(p_guest is null or visibility='external');if not found then perform eps.fail('RESOURCE_NOT_FOUND','Reply target not found.',404);end if;end if;
  if p_guest is null and(p_input->>'visibility')not in('external','internal')then perform eps.fail('VALIDATION_FAILED','Choose comment visibility.',400);end if;
  if parent.id is not null and p_guest is null and parent.visibility<>p_input->>'visibility'then perform eps.fail('VALIDATION_FAILED','Replies keep their parent visibility.',400);end if;
  insert into eps.feedback_comments(series_id,version_id,slide_id,guest_session_id,author_principal_id,author_name_snapshot,company_snapshot,parent_comment_id,body,visibility)
  values(version.series_id,version.id,slide.id,p_guest,p_principal,author,company,parent.id,btrim(p_input->>'body'),case when p_guest is not null then'external'else p_input->>'visibility'end)returning * into comment;
  return eps.feedback_comment_dto(comment);
 elsif p_action='update_comment'then
  select * into comment from eps.feedback_comments where id=eps.casting_uuid(p_input->'comment_id')and version_id=version.id and deleted_at is null for update;
  if not found or(p_guest is not null and comment.guest_session_id is distinct from p_guest)then perform eps.fail('RESOURCE_NOT_FOUND','Comment not found.',404);end if;
  if eps.logo_integer(p_input->'row_version',1,9007199254740991)<>comment.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh current feedback.',409,comment.row_version);end if;
  if p_input?'body'then
   if(p_guest is null and comment.author_principal_id is distinct from p_principal)then perform eps.fail('ACCESS_DENIED','Only the author may edit comment wording.',403);end if;
   if jsonb_typeof(p_input->'body')is distinct from'string'or length(btrim(p_input->>'body'))not between 1 and 10000 then perform eps.fail('VALIDATION_FAILED','Provide a bounded comment.',400);end if;
  end if;
  if p_input?'resolved'and(p_guest is not null or jsonb_typeof(p_input->'resolved')is distinct from'boolean')then perform eps.fail('ACCESS_DENIED','Only production may resolve feedback.',403);end if;
  update eps.feedback_comments set body=coalesce(p_input->>'body',body),resolved=coalesce((p_input->>'resolved')::boolean,resolved),resolved_at=case when p_input?'resolved'then case when(p_input->>'resolved')::boolean then clock_timestamp()else null end else resolved_at end,resolved_by=case when p_input?'resolved'then case when(p_input->>'resolved')::boolean then p_principal else null end else resolved_by end,row_version=row_version+1,updated_at=clock_timestamp()where id=comment.id returning * into comment;
  return eps.feedback_comment_dto(comment);
 elsif p_action='set_preference'then
  if not p_input?'value'or p_input->'value'<>'null'and(jsonb_typeof(p_input->'value')is distinct from'string'or p_input->>'value'not in('preferred','maybe','not_preferred'))then perform eps.fail('VALIDATION_FAILED','Choose a supported preference.',400);end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_guest,p_principal)::text||':preference:'||slide.id::text,0));
  select * into preference from eps.feedback_preferences where version_id=version.id and slide_id=slide.id and(case when p_guest is not null then guest_session_id=p_guest else author_principal_id=p_principal end)for update;
  if found then
   if not p_input?'row_version'or p_input->'row_version'='null'or eps.logo_integer(p_input->'row_version',1,9007199254740991)<>preference.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Refresh your current preference.',409,preference.row_version);end if;
   if p_input->'value'='null'then delete from eps.feedback_preferences where id=preference.id;return jsonb_build_object('preference',null,'cleared',true);end if;
   update eps.feedback_preferences set preference=p_input->>'value',author_name_snapshot=author,row_version=row_version+1,updated_at=clock_timestamp()where id=preference.id returning * into preference;
  else
   if p_input?'row_version'and p_input->'row_version'<>'null'then perform eps.fail('STALE_RESOURCE_VERSION','This preference no longer exists.',409);end if;
   if p_input->'value'='null'then return jsonb_build_object('preference',null,'cleared',true);end if;
   insert into eps.feedback_preferences(series_id,version_id,slide_id,guest_session_id,author_principal_id,author_name_snapshot,preference)values(version.series_id,version.id,slide.id,p_guest,p_principal,author,p_input->>'value')returning * into preference;
  end if;return jsonb_build_object('preference',eps.feedback_preference_dto(preference),'cleared',false);
 end if;perform eps.fail('VALIDATION_FAILED','Unsupported feedback operation.',400);return null;
end$$;
grant select,insert,update,delete on eps.feedback_comments,eps.feedback_preferences to eps_review_owner;
create policy m06_internal_comment on eps.feedback_comments for all to eps_review_owner using(eps.review_link_scope(series_id))with check(eps.review_link_scope(series_id));
create policy m06_internal_preference on eps.feedback_preferences for all to eps_review_owner using(eps.review_link_scope(series_id))with check(eps.review_link_scope(series_id));
grant select on eps.guest_sessions to eps_review_owner;
create policy m06_internal_guest_labels on eps.guest_sessions for select to eps_review_owner using(exists(select 1 from eps.review_links l where l.id=review_link_id and eps.review_link_scope(l.series_id)));
create function eps.feedback_internal_require(p_version uuid,p_write boolean default false)returns eps.presentation_versions language plpgsql stable security invoker set search_path=''as $$declare item eps.presentation_versions;begin
 item:=eps.feedback_version(p_version);perform eps.review_link_require(item.series_id);
 if p_write and(not eps.has_capability('workspaces.write')or not eps.project_scope(item.project_id,true))then perform eps.fail('ACCESS_DENIED','Feedback editing is not permitted.',403);end if;return item;
end$$;
create function public.eps_list_feedback(p_version_id uuid,p_options jsonb default'{}')returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 perform eps.feedback_internal_require(p_version_id);return eps.feedback_page(p_version_id,false,p_options);
end$$;
create function public.eps_create_comment(p_version_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare cached jsonb;result jsonb;begin
 perform eps.review_body(p_input,array['version_slide_id','visibility','body','parent_comment_id'],array['version_slide_id','visibility','body']);perform eps.feedback_internal_require(p_version_id,true);
 cached:=eps.review_replay('create_comment',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input));if cached is not null then return cached;end if;
 result:=eps.feedback_mutate(null,auth.uid(),p_version_id,'create_comment',p_input);return eps.review_remember('create_comment',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input),result,eps.casting_uuid(result->'id'));
end$$;
create function public.eps_update_comment(p_comment_id uuid,p_input jsonb,p_idempotency_key text default null)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare version_id uuid;cached jsonb;result jsonb;request jsonb:=jsonb_build_object('id',p_comment_id,'input',p_input);begin
 perform eps.review_body(p_input,array['row_version','body','resolved'],array['row_version']);if not(p_input?'body'or p_input?'resolved')then perform eps.fail('VALIDATION_FAILED','Choose a comment change.',400);end if;
 select c.version_id into version_id from eps.feedback_comments c where c.id=p_comment_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Comment not found.',404);end if;
 perform eps.feedback_internal_require(version_id,true);if p_idempotency_key is not null then cached:=eps.review_replay('update_comment',p_idempotency_key,request);if cached is not null then return cached;end if;end if;
 result:=eps.feedback_mutate(null,auth.uid(),version_id,'update_comment',p_input||jsonb_build_object('comment_id',p_comment_id));
 if p_idempotency_key is not null then return eps.review_remember('update_comment',p_idempotency_key,request,result,p_comment_id);end if;return result;
end$$;
create function public.eps_set_preference(p_version_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare cached jsonb;result jsonb;begin
 perform eps.review_body(p_input,array['version_slide_id','value','row_version'],array['version_slide_id','value']);perform eps.feedback_internal_require(p_version_id,true);
 cached:=eps.review_replay('set_preference',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input));if cached is not null then return cached;end if;
 result:=eps.feedback_mutate(null,auth.uid(),p_version_id,'set_preference',p_input);return eps.review_remember('set_preference',p_idempotency_key,jsonb_build_object('version_id',p_version_id,'input',p_input),result,eps.casting_uuid(p_input->'version_slide_id'));
end$$;
