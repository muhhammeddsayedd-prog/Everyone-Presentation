-- M05 additive immutable version capture on exact reviewed23. No runtime activation.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres'or current_database()<>'postgres'or(select count(*)from supabase_migrations.schema_migrations)<>23
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261029203953'
 or to_regclass('eps.presentation_versions')is not null then raise exception'M05_EXACT_REVIEWED23_REQUIRED';end if;
end$$;

create table eps.presentation_processing_config(
 id boolean primary key default true check(id),enabled boolean not null default false,
 renderer_version text not null check(renderer_version='everyone-casting-pdf-v1'),
 application_origin text not null check(application_origin='http://127.0.0.1:3000'or application_origin~'^https://[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?$'),
 max_manifest_bytes bigint not null default 8388608 check(max_manifest_bytes=8388608),
 max_pdf_bytes bigint not null default 67108864 check(max_pdf_bytes=67108864),max_pages integer not null default 1000 check(max_pages=1000)
);
insert into eps.presentation_processing_config(id,renderer_version,application_origin)values(true,'everyone-casting-pdf-v1','http://127.0.0.1:3000');
create table eps.presentation_versions(
 id uuid primary key,series_id uuid not null references eps.presentation_series(id),workspace_id uuid not null references eps.workspaces(id),project_id uuid not null references public.projects(id),
 version_number bigint not null check(version_number between 1 and 9007199254740991),status text not null default'queued'check(status in('queued','rendering','ready','failed')),
 input_workspace_row_version bigint not null check(input_workspace_row_version between 1 and 9007199254740991),source_draft_revision bigint not null check(source_draft_revision between 0 and 9007199254740991),
 input_fingerprint text not null check(input_fingerprint~'^[a-f0-9]{64}$'),hash_protocol text not null default'eps-cast-canonical-v1'check(hash_protocol='eps-cast-canonical-v1'),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'and octet_length(snapshot::text)<=8388608),snapshot_sha256 text not null check(snapshot_sha256~'^[a-f0-9]{64}$'),
 manifest jsonb not null check(jsonb_typeof(manifest)='object'and octet_length(manifest::text)<=8388608),manifest_sha256 text not null check(manifest_sha256~'^[a-f0-9]{64}$'),inventory_sha256 text not null check(inventory_sha256~'^[a-f0-9]{64}$'),
 page_count integer not null check(page_count between 2 and 1000),generation_job_id uuid not null unique references eps.jobs(id),generated_by uuid not null,generation_note text,
 manifest_asset_id uuid references eps.media_assets(id),pdf_asset_id uuid references eps.media_assets(id),ready_at timestamptz,failure_code text,
 created_at timestamptz not null,updated_at timestamptz not null default clock_timestamp(),row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 unique(series_id,version_number),unique(series_id,id),
 check((status='ready'and manifest_asset_id is not null and pdf_asset_id is not null and manifest_asset_id<>pdf_asset_id and ready_at is not null and failure_code is null)
  or(status in('queued','rendering')and manifest_asset_id is null and pdf_asset_id is null and ready_at is null and failure_code is null)
  or(status='failed'and manifest_asset_id is null and pdf_asset_id is null and ready_at is null and failure_code is not null and failure_code~'^[A-Z][A-Z0-9_]{0,99}$'))
);
create index presentation_versions_workspace_id on eps.presentation_versions(workspace_id,id);
create index presentation_versions_series_number on eps.presentation_versions(series_id,version_number desc);
create table eps.version_slides(
 id uuid primary key,version_id uuid not null references eps.presentation_versions(id),ordinal integer not null check(ordinal between 0 and 999),
 kind text not null check(kind in('cover','candidate','pending')),source_assignment_id uuid references eps.assignments(id),source_slot_id uuid references eps.slots(id),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),content_sha256 text not null check(content_sha256~'^[a-f0-9]{64}$'),unique(version_id,ordinal)
);
create table eps.presentation_version_assets(
 version_id uuid not null references eps.presentation_versions(id),asset_id uuid not null references eps.media_assets(id),
 asset_kind text not null check(asset_kind in('client_logo','candidate_frame','candidate_video','presentation_manifest','presentation_pdf')),
 bucket text not null,object_key text not null,mime_type text not null,byte_size bigint not null check(byte_size>0),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 width integer,height integer,duration_ms bigint,source_asset_id uuid,timestamp_ms bigint,
 filename text not null,asset_created_at timestamptz not null,primary key(version_id,asset_id)
);
create index presentation_version_assets_asset on eps.presentation_version_assets(asset_id);
alter table eps.presentation_series add constraint presentation_latest_ready_version_fk foreign key(id,latest_ready_version_id)references eps.presentation_versions(series_id,id)deferrable initially deferred;
alter table eps.presentation_processing_config enable row level security;alter table eps.presentation_processing_config force row level security;
alter table eps.presentation_versions enable row level security;alter table eps.presentation_versions force row level security;
alter table eps.version_slides enable row level security;alter table eps.version_slides force row level security;
alter table eps.presentation_version_assets enable row level security;alter table eps.presentation_version_assets force row level security;
revoke all on eps.presentation_processing_config,eps.presentation_versions,eps.version_slides,eps.presentation_version_assets from public,anon,authenticated,service_role;
grant select on eps.presentation_processing_config to eps_review_owner,eps_review_stage_owner;
grant select,insert on eps.presentation_versions,eps.version_slides,eps.presentation_version_assets to eps_review_owner;
grant select on eps.presentation_versions,eps.version_slides,eps.presentation_version_assets to eps_review_stage_owner;
grant update(status,manifest_asset_id,pdf_asset_id,ready_at,failure_code,updated_at,row_version)on eps.presentation_versions to eps_review_stage_owner;
grant insert on eps.presentation_version_assets to eps_review_stage_owner;
grant update(latest_ready_version_id,latest_ready_version_no,row_version,updated_at)on eps.presentation_series to eps_review_stage_owner;
create function eps.presentation_scope(p_workspace uuid,p_write boolean default false)returns boolean language sql stable security invoker set search_path=''as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id where w.id=p_workspace and p.archived_at is null
 and eps.project_scope(p.id,p_write)and eps.has_capability('workspaces.read')and(not p_write or w.archived_at is null and eps.has_capability('presentations.generate')and eps.has_capability('workspaces.write')and eps.has_capability('cast.read')))
$$;
create policy presentation_config_read on eps.presentation_processing_config for select to eps_review_owner,eps_review_stage_owner using(true);
create policy presentation_version_read on eps.presentation_versions for select to eps_review_owner using(eps.presentation_scope(workspace_id));
create policy presentation_version_insert on eps.presentation_versions for insert to eps_review_owner with check(eps.presentation_scope(workspace_id,true)and generated_by=auth.uid()and status='queued');
create policy presentation_slide_read on eps.version_slides for select to eps_review_owner using(exists(select 1 from eps.presentation_versions v where v.id=version_id));
create policy presentation_slide_insert on eps.version_slides for insert to eps_review_owner with check(exists(select 1 from eps.presentation_versions v where v.id=version_id and eps.presentation_scope(v.workspace_id,true)and v.status='queued'));
create policy presentation_pin_read on eps.presentation_version_assets for select to eps_review_owner using(exists(select 1 from eps.presentation_versions v where v.id=version_id));
create policy presentation_pin_insert on eps.presentation_version_assets for insert to eps_review_owner with check(asset_kind in('client_logo','candidate_frame','candidate_video')and exists(select 1 from eps.presentation_versions v where v.id=version_id and eps.presentation_scope(v.workspace_id,true)and v.status='queued'));
create policy presentation_version_service_read on eps.presentation_versions for select to eps_review_stage_owner using(true);
create policy presentation_slide_service_read on eps.version_slides for select to eps_review_stage_owner using(true);
create policy presentation_pin_service_read on eps.presentation_version_assets for select to eps_review_stage_owner using(true);
-- Lifecycle writes are additionally fenced by the current trusted job context.
create policy presentation_version_service_update on eps.presentation_versions for update to eps_review_stage_owner using(generation_job_id::text=current_setting('eps.presentation.lifecycle_job',true))with check(generation_job_id::text=current_setting('eps.presentation.lifecycle_job',true));
create policy presentation_pin_service_insert on eps.presentation_version_assets for insert to eps_review_stage_owner with check(asset_kind in('presentation_manifest','presentation_pdf')and exists(select 1 from eps.presentation_versions v where v.id=version_id and v.generation_job_id::text=current_setting('eps.presentation.lifecycle_job',true)));
create policy presentation_series_service_read on eps.presentation_series for select to eps_review_stage_owner using(true);
create policy presentation_series_service_update on eps.presentation_series for update to eps_review_stage_owner using(exists(select 1 from eps.presentation_versions v where v.series_id=presentation_series.id and v.generation_job_id::text=current_setting('eps.presentation.lifecycle_job',true)))with check(exists(select 1 from eps.presentation_versions v where v.series_id=presentation_series.id and v.generation_job_id::text=current_setting('eps.presentation.lifecycle_job',true)));
create function eps.presentation_immutable_version()returns trigger language plpgsql security invoker set search_path=''as $$begin
 if tg_op='DELETE'then perform eps.fail('IMMUTABLE_VERSION','Captured versions cannot be deleted.',409);end if;
 if(old.status='ready'and to_jsonb(new)is distinct from to_jsonb(old))or(to_jsonb(new)-array['status','manifest_asset_id','pdf_asset_id','ready_at','failure_code','updated_at','row_version'])is distinct from(to_jsonb(old)-array['status','manifest_asset_id','pdf_asset_id','ready_at','failure_code','updated_at','row_version'])then perform eps.fail('IMMUTABLE_VERSION','Captured content and Ready artifacts are immutable.',409);end if;return new;
end$$;
create function eps.presentation_immutable_row()returns trigger language plpgsql security invoker set search_path=''as $$begin perform eps.fail('IMMUTABLE_VERSION','Captured slides and retained assets are immutable.',409);return null;end$$;
create trigger presentation_version_immutable before update or delete on eps.presentation_versions for each row execute function eps.presentation_immutable_version();
create trigger presentation_slide_immutable before update or delete on eps.version_slides for each row execute function eps.presentation_immutable_row();
create trigger presentation_pin_immutable before update or delete on eps.presentation_version_assets for each row execute function eps.presentation_immutable_row();
create function eps.presentation_asset_retained(p_asset uuid)returns boolean language sql stable security definer set search_path=''as $$select exists(select 1 from eps.presentation_version_assets where asset_id=p_asset)$$;
create function eps.presentation_protect_asset()returns trigger language plpgsql security definer set search_path=''as $$begin
 if eps.presentation_asset_retained(old.id)then
  if tg_op='DELETE'then perform eps.fail('RETAINED_VERSION_ASSET','A captured version retains this asset.',409);end if;
  if(new.id,new.purpose,new.filename,new.mime_type,new.bucket,new.object_key,new.size_bytes,new.sha256,new.width,new.height,new.duration_ms,new.source_asset_id,new.source_timestamp_ms,new.created_at)
   is distinct from(old.id,old.purpose,old.filename,old.mime_type,old.bucket,old.object_key,old.size_bytes,old.sha256,old.width,old.height,old.duration_ms,old.source_asset_id,old.source_timestamp_ms,old.created_at)
  then perform eps.fail('RETAINED_VERSION_ASSET','A captured asset identity and bytes cannot be changed.',409);end if;
 end if;return case when tg_op='DELETE'then old else new end;
end$$;
create trigger presentation_retained_asset before update or delete on eps.media_assets for each row execute function eps.presentation_protect_asset();
create function eps.presentation_ready_pointer()returns trigger language plpgsql security definer set search_path=''as $$begin
 if old.latest_ready_version_no is not null and(new.latest_ready_version_no is null or new.latest_ready_version_no<old.latest_ready_version_no)then perform eps.fail('READY_POINTER_REGRESSION','The latest Ready version cannot move backward.',409);end if;
 if new.latest_ready_version_id is not null and not exists(select 1 from eps.presentation_versions v where v.id=new.latest_ready_version_id and v.series_id=new.id and v.version_number=new.latest_ready_version_no and v.status='ready')then perform eps.fail('READY_POINTER_INVALID','The latest pointer must reference this series Ready version.',409);end if;return new;
end$$;
create trigger presentation_ready_pointer_guard before update of latest_ready_version_id,latest_ready_version_no on eps.presentation_series for each row execute function eps.presentation_ready_pointer();
create policy presentation_retained_asset_read on eps.media_assets for select to eps_review_owner using(exists(select 1 from eps.presentation_version_assets p join eps.presentation_versions v on v.id=p.version_id where p.asset_id=media_assets.id and eps.presentation_scope(v.workspace_id)));
create function eps.presentation_hash(p_value jsonb)returns text language sql immutable security invoker set search_path=''as $$select encode(sha256(convert_to(eps.cast_canonical(p_value),'UTF8')),'hex')$$;
create function eps.presentation_time(p_value timestamptz)returns text language sql stable security invoker set search_path=''as $$select to_char(p_value at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')$$;
create function eps.presentation_public_slide(p_slide jsonb)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_slide->'id','version_id',p_slide->'version_id','order',p_slide->'order','kind',p_slide->'kind','assignment_id',p_slide->'assignment_id','candidate_id',p_slide->'candidate_id','role_label',p_slide->'role_label','role_category',p_slide->'role_category','slot_label',p_slide->'slot_label','position',p_slide->'position','fields',p_slide->'fields','requirements',p_slide->'requirements','frame_asset_ids',p_slide->'frame_asset_ids','video_asset_id',p_slide->'video_asset_id','logo_asset_id',p_slide->'logo_asset_id')
$$;
create function eps.presentation_manifest(p_snapshot jsonb)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('schema_version','1.0','version_id',p_snapshot->'version_id','series_id',p_snapshot->'series_id','output_type',p_snapshot#>'{cover,output_type}','audience_snapshot',p_snapshot->'audience_snapshot','template_version',p_snapshot#>'{template,version}','template_content_hash',p_snapshot#>'{template,content_sha256}',
  'asset_inventory',coalesce((select jsonb_agg(jsonb_build_object('asset_id',v->'asset_id','sha256',v->'sha256','asset_kind',v->'asset_kind','mime_type',v->'mime_type','byte_size',v->'byte_size')order by ordinal)from jsonb_array_elements(p_snapshot->'asset_inventory')with ordinality a(v,ordinal)),'[]'::jsonb),
  'project_name',p_snapshot#>'{cover,project_name}','client_name',p_snapshot#>'{cover,client_name}','logo_asset_id',p_snapshot#>'{cover,logo_asset_id}','logo_placement',p_snapshot#>'{cover,logo_placement}','input_draft_revision',p_snapshot->'input_draft_revision','input_fingerprint',p_snapshot->'input_fingerprint',
  'slides',coalesce((select jsonb_agg(eps.presentation_public_slide(v)order by ordinal)from jsonb_array_elements(p_snapshot->'slides')with ordinality s(v,ordinal)),'[]'::jsonb),'created_at',p_snapshot->'created_at')
$$;
create function eps.presentation_render_context(p_snapshot jsonb)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('cover',p_snapshot->'cover','template',(p_snapshot->'template')-'font_hashes','slide_contexts',coalesce((select jsonb_agg(jsonb_build_object('slide_id',v->'id','role_id',v->'role_id','slot_id',v->'slot_id','provisional',v->'provisional','review_status',v->'review_status','frames',v->'frames')order by ordinal)from jsonb_array_elements(p_snapshot->'slides')with ordinality s(v,ordinal)),'[]'::jsonb))
$$;
create function eps.presentation_version_dto(p_version eps.presentation_versions)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_version.id,'series_id',p_version.series_id,'version_no',p_version.version_number,'status',p_version.status,'input_draft_revision',p_version.source_draft_revision,'input_fingerprint',p_version.input_fingerprint,'template_version',p_version.snapshot#>>'{template,version}','manifest_hash',p_version.manifest_sha256,'slides',p_version.manifest->'slides','pdf_asset_id',p_version.pdf_asset_id,'manifest_asset_id',p_version.manifest_asset_id,'created_at',p_version.snapshot->>'created_at','ready_at',eps.presentation_time(p_version.ready_at),'generation_job_id',p_version.generation_job_id,'generated_by',p_version.generated_by,'failure_code',p_version.failure_code,'render_context',eps.presentation_render_context(p_version.snapshot))
$$;
create function eps.presentation_media_dto(p_asset eps.media_assets)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',p_asset.id,'purpose',p_asset.purpose,'filename',p_asset.filename,'mime_type',p_asset.mime_type,'size_bytes',p_asset.size_bytes,'sha256',p_asset.sha256,'status',p_asset.status,'duration_ms',p_asset.duration_ms,'width',p_asset.width,'height',p_asset.height,'source_asset_id',p_asset.source_asset_id,'source_timestamp_ms',p_asset.source_timestamp_ms,'created_at',eps.presentation_time(p_asset.created_at))
$$;
create function public.eps_get_version(p_version_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare version eps.presentation_versions;begin
 perform eps.require_capability('workspaces.read');select * into version from eps.presentation_versions where id=p_version_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Presentation version not found.',404);end if;
 if not eps.presentation_scope(version.workspace_id)then perform eps.fail('RESOURCE_NOT_FOUND','Presentation version not found.',404);end if;return eps.presentation_version_dto(version);
end$$;
create function public.eps_list_versions(p_series_id uuid,p_options jsonb default'{}')returns jsonb language plpgsql stable security definer set search_path=''as $$
declare series eps.presentation_series;maximum integer:=25;cursor_no bigint;items jsonb;last_no bigint;begin
 perform eps.require_capability('workspaces.read');perform eps.review_body(p_options,array['cursor','limit']);
 select * into series from eps.presentation_series where id=p_series_id;if not found or not eps.presentation_scope(series.workspace_id)then perform eps.fail('RESOURCE_NOT_FOUND','Presentation series not found.',404);end if;
 if p_options?'limit'then if jsonb_typeof(p_options->'limit')is distinct from'number'or(p_options->>'limit')!~'^[1-9][0-9]{0,2}$'then perform eps.fail('VALIDATION_FAILED','Invalid version page limit.',400);end if;maximum:=(p_options->>'limit')::integer;if maximum>100 then perform eps.fail('VALIDATION_FAILED','Invalid version page limit.',400);end if;end if;
 if p_options?'cursor'then
  if jsonb_typeof(p_options->'cursor')is distinct from'string'or cardinality(string_to_array(p_options->>'cursor','|'))<>2 or split_part(p_options->>'cursor','|',1)is distinct from p_series_id::text
   or split_part(p_options->>'cursor','|',2)!~'^[1-9][0-9]{0,15}$'then perform eps.fail('VALIDATION_FAILED','Invalid series-bound version cursor.',400);end if;
  if split_part(p_options->>'cursor','|',2)::numeric>9007199254740991 then perform eps.fail('VALIDATION_FAILED','Invalid series-bound version cursor.',400);end if;cursor_no:=split_part(p_options->>'cursor','|',2)::bigint;
 end if;
 select coalesce(jsonb_agg(eps.presentation_version_dto(v)order by v.version_number desc),'[]'),min(v.version_number)into items,last_no from(select * from eps.presentation_versions where series_id=p_series_id and(cursor_no is null or version_number<cursor_no)order by version_number desc limit maximum)v;
 return jsonb_build_object('data',items,'page',jsonb_build_object('next_cursor',case when last_no is not null and exists(select 1 from eps.presentation_versions where series_id=p_series_id and version_number<last_no)then p_series_id::text||'|'||last_no::text else null end));
end$$;
create function public.eps_get_version_asset(p_version_id uuid,p_asset_id uuid,p_purpose text)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare version eps.presentation_versions;pin eps.presentation_version_assets;asset eps.media_assets;kind text;begin
 perform eps.require_capability('workspaces.read');if p_purpose is null or p_purpose not in('pdf','frame','logo','video')then perform eps.fail('VALIDATION_FAILED','Invalid fixed-version asset purpose.',400);end if;
 select * into version from eps.presentation_versions where id=p_version_id;if not found or not eps.presentation_scope(version.workspace_id)then perform eps.fail('RESOURCE_NOT_FOUND','Presentation version not found.',404);end if;
 kind:=case p_purpose when'pdf'then'presentation_pdf'when'frame'then'candidate_frame'when'logo'then'client_logo'else'candidate_video'end;
 select * into pin from eps.presentation_version_assets p where p.version_id=version.id and p.asset_id=p_asset_id and p.asset_kind=kind;
 if not found or(p_purpose='pdf'and(version.status<>'ready'or version.pdf_asset_id is distinct from p_asset_id))then perform eps.fail('RESOURCE_NOT_FOUND','Fixed-version asset not found.',404);end if;
 select * into asset from eps.media_assets where id=pin.asset_id;
 if not found or asset.status not in('ready','archived')or(p_purpose='pdf'and asset.status<>'ready')or(asset.bucket,asset.object_key,asset.purpose,asset.sha256,asset.size_bytes,asset.mime_type,asset.width,asset.height,asset.duration_ms,asset.source_asset_id,asset.source_timestamp_ms,asset.filename,asset.created_at)
  is distinct from(pin.bucket,pin.object_key,pin.asset_kind,pin.sha256,pin.byte_size,pin.mime_type,pin.width,pin.height,pin.duration_ms,pin.source_asset_id,pin.timestamp_ms,pin.filename,pin.asset_created_at)
 then perform eps.fail('ASSET_UNAVAILABLE','The retained version asset is unavailable.',503);end if;
 return jsonb_build_object('asset',eps.presentation_media_dto(asset),'bucket',pin.bucket,'object_key',pin.object_key);
end$$;
create function eps.presentation_remember(p_key text,p_payload jsonb,p_result jsonb,p_version uuid)returns jsonb language plpgsql volatile security invoker set search_path=''as $$
declare headers jsonb;request_id text;client_type text;begin
 insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)values(auth.uid(),'review.generate_version',p_key,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),p_result);
 begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;exception when invalid_text_representation then headers:='{}';end;
 request_id:=headers->>'x-eps-request-id';if request_id is not null and request_id!~'^[A-Za-z0-9._:-]{1,128}$'then request_id:=null;end if;
 client_type:=headers->>'x-eps-client-type';if client_type is null or client_type not in('browser','api','mcp')then client_type:='api';end if;
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type)values(auth.uid(),'review.generate_version',p_version,request_id,client_type);return p_result;
end$$;
create policy presentation_jobs_user_read on eps.jobs for select to eps_review_owner using(kind='presentation_render'and eps.presentation_scope(workspace_id));
create policy presentation_jobs_user_insert on eps.jobs for insert to eps_review_owner with check(kind='presentation_render'and requested_by=auth.uid()and status='queued'and stage='prepare_presentation'and attempt=0 and dispatch_generation=1 and current_attempt_id is null and lease_token_digest is null and input_hash_version='eps.presentation-job-input.cast-canonical.v1'and eps.presentation_scope(workspace_id,true));
create policy presentation_outbox_user_read on eps.outbox_events for select to eps_review_owner using(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='presentation_render'));
create policy presentation_outbox_user_insert on eps.outbox_events for insert to eps_review_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='presentation_render'and j.requested_by=auth.uid()and j.status='queued'and j.stage=outbox_events.stage and j.input_hash=outbox_events.input_hash and j.dispatch_generation=outbox_events.dispatch_generation));
create function public.eps_generate_version(p_series_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare series eps.presentation_series;workspace eps.workspaces;template eps.presentation_templates;configuration eps.presentation_processing_config;
 expected_workspace bigint;expected_draft bigint;initial_workspace uuid;payload jsonb;cached jsonb;review jsonb;slide jsonb;frozen jsonb;slides jsonb:='[]';inventory jsonb;manifest jsonb;snapshot jsonb;job_input jsonb;
 version_id uuid:=gen_random_uuid();job_id uuid:=gen_random_uuid();slide_id uuid;version_no bigint;created_at timestamptz;ordinal integer:=0;assets uuid[];source eps.media_assets;item jsonb;note text;snapshot_hash text;manifest_hash text;inventory_hash text;input_hash text;begin
 perform eps.require_capability('presentations.generate');perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');perform eps.require_capability('workspaces.read');
 perform eps.review_body(p_input,array['expected_workspace_row_version','expected_draft_revision','expected_input_fingerprint','generation_note'],array['expected_workspace_row_version','expected_draft_revision','expected_input_fingerprint']);
 expected_workspace:=eps.casting_version(p_input->'expected_workspace_row_version');
 if jsonb_typeof(p_input->'expected_draft_revision')is distinct from'number'or(p_input->>'expected_draft_revision')!~'^(0|[1-9][0-9]{0,15})$'or(p_input->>'expected_draft_revision')::numeric>9007199254740991
  or jsonb_typeof(p_input->'expected_input_fingerprint')is distinct from'string'or(p_input->>'expected_input_fingerprint')!~'^[a-f0-9]{64}$'then perform eps.fail('VALIDATION_FAILED','Exact generation revisions and review fingerprint are required.',400);end if;
 expected_draft:=(p_input->>'expected_draft_revision')::bigint;
 if p_input?'generation_note'then note:=eps.casting_text(p_input->'generation_note');if length(note)>8000 then perform eps.fail('VALIDATION_FAILED','Generation note is too long.',400);end if;end if;
 select * into series from eps.presentation_series where id=p_series_id and not archived;
 if not found or not eps.presentation_scope(series.workspace_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation series not found.',404);end if;
 initial_workspace:=series.workspace_id;payload:=jsonb_build_object('series_id',p_series_id,'input',p_input);cached:=eps.review_replay('generate_version',p_idempotency_key,payload);
 perform 1 from eps.workspaces where id=series.workspace_id for update;
 if not eps.presentation_scope(series.workspace_id,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation scope changed.',404);end if;
 if cached is not null then return cached;end if;
 select * into series from eps.presentation_series where id=p_series_id and not archived for update;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Presentation series changed.',404);end if;
 if series.workspace_id is distinct from initial_workspace then perform eps.fail('INPUT_CHANGED','Presentation scope changed. Refresh review.',409);end if;
 if series.template_key<>'everyone-casting'or series.template_version<>'1.1.0'then perform eps.fail('TEMPLATE_UPGRADE_REQUIRED','Select the current presentation template, then refresh review.',409);end if;
 select * into configuration from eps.presentation_processing_config where id and enabled;if not found then perform eps.fail('PRESENTATION_PROCESSING_UNAVAILABLE','Presentation rendering is not enabled.',503);end if;
 perform eps.presentation_lock_sources(series.workspace_id,series.template_key,series.template_version);
 select * into workspace from eps.workspaces where id=series.workspace_id;
 if workspace.row_version<>expected_workspace then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed. Refresh review before generating.',409,workspace.row_version);end if;
 if workspace.draft_revision<>expected_draft then perform eps.fail('INPUT_CHANGED','The working draft changed. Refresh review before generating.',409);end if;
 review:=public.eps_get_workspace_review(workspace.id,series.id,null);
 if(review->>'input_fingerprint')is distinct from(p_input->>'expected_input_fingerprint')then perform eps.fail('INPUT_CHANGED','Presentation information changed. Refresh review before generating.',409);end if;
 if review->'can_generate'is distinct from'true'::jsonb or review#>>'{fit,status}'is distinct from'measured'or review#>>'{fit,input_fingerprint}'is distinct from review->>'input_fingerprint'or jsonb_array_length(review#>'{fit,overflows}')<>0 then perform eps.fail('LAYOUT_NOT_READY','Measure and resolve the current presentation layout before generating.',409);end if;
 select * into template from eps.presentation_templates where key=series.template_key and version=series.template_version and registered and content_sha256=series.template_content_sha256 and font_key=series.font_key;
 if not found then perform eps.fail('TEMPLATE_UNAVAILABLE','The exact registered template is unavailable.',503);end if;
 version_no:=series.next_version_number;perform eps.casting_advance(version_no);created_at:=clock_timestamp();
 slide_id:=gen_random_uuid();slides:=jsonb_build_array(jsonb_build_object('id',slide_id,'version_id',version_id,'order',0,'kind','cover','assignment_id',null,'candidate_id',null,'role_label',null,'role_category',null,'slot_label',null,'position',null,'fields',null,'requirements',null,'frame_asset_ids','[]'::jsonb,'video_asset_id',null,'logo_asset_id',workspace.logo_asset_id,'role_id',null,'slot_id',null,'candidate_media_id',null,'provisional',false,'review_status',null,'frames','[]'::jsonb));
 for slide in select value from jsonb_array_elements(review->'slides')loop
  ordinal:=ordinal+1;if ordinal>=configuration.max_pages or not(slide?'role_category')then perform eps.fail('SNAPSHOT_INVALID','The exact presentation page contract is invalid or too large.',503);end if;
  slide_id:=gen_random_uuid();frozen:=jsonb_build_object('id',slide_id,'version_id',version_id,'order',ordinal,'kind',slide->'kind','assignment_id',slide->'assignment_id','candidate_id',slide->'candidate_id','role_label',slide->'role_name','role_category',slide->'role_category','slot_label',slide->'slot_label','position',slide->'position','fields',case when slide->>'kind'='candidate'then slide->'fields'else'null'::jsonb end,'requirements',slide->'requirements',
   'frame_asset_ids',coalesce((select jsonb_agg(f->'asset_id'order by position)from jsonb_array_elements(slide->'frames')with ordinality a(f,position)),'[]'::jsonb),'video_asset_id',slide->'video_asset_id','logo_asset_id',case when workspace.logo_placement='every_slide'then workspace.logo_asset_id else null end,'role_id',slide->'role_id','slot_id',slide->'slot_id','candidate_media_id',slide->'candidate_media_id','provisional',slide->'provisional','review_status',slide->'review_status','frames',slide->'frames');
  slides:=slides||jsonb_build_array(frozen);
 end loop;
 select coalesce(array_agg(distinct id order by id),'{}')into assets from(
  select(v->>'video_asset_id')::uuid id from jsonb_array_elements(slides)v union all
  select(v->>'logo_asset_id')::uuid from jsonb_array_elements(slides)v union all
  select(f#>>'{}')::uuid from jsonb_array_elements(slides)v cross join lateral jsonb_array_elements(v->'frame_asset_ids')f
 )a where id is not null;
 select coalesce(jsonb_agg(jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'asset_kind',a.purpose,'mime_type',a.mime_type,'byte_size',a.size_bytes,'bucket',a.bucket,'object_key',a.object_key,'width',a.width,'height',a.height,'duration_ms',a.duration_ms,'source_asset_id',a.source_asset_id,'timestamp_ms',a.source_timestamp_ms)order by a.id),'[]'::jsonb)into inventory
 from eps.media_assets a where a.id=any(assets)and a.status='ready'and a.sha256 is not null and a.size_bytes>0 and a.purpose in('client_logo','candidate_frame','candidate_video')and a.bucket in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs');
 if jsonb_array_length(inventory)<>cardinality(assets)then perform eps.fail('ASSET_UNAVAILABLE','A selected source asset cannot be captured.',503);end if;
 snapshot:=jsonb_build_object('schema_version','1.0','hash_protocol','eps-cast-canonical-v1','version_id',version_id,'series_id',series.id,'workspace_id',workspace.id,'project_id',workspace.project_id,'version_no',version_no,'created_at',eps.presentation_time(created_at),'input_workspace_row_version',workspace.row_version,'input_draft_revision',workspace.draft_revision,'input_fingerprint',review->>'input_fingerprint','template',eps.review_template_dto(series)||jsonb_build_object('font_hashes',template.font_hashes),'render_configuration',jsonb_build_object('renderer_version',configuration.renderer_version,'application_origin',configuration.application_origin),'audience_snapshot',series.audience_snapshot,'cover',review->'cover','slides',slides,'asset_inventory',inventory);
 manifest:=eps.presentation_manifest(snapshot);
 if octet_length(snapshot::text)>8388608 or octet_length(manifest::text)>configuration.max_manifest_bytes then perform eps.fail('PDF_BUDGET_EXCEEDED','The captured presentation exceeds the technical metadata budget.',503);end if;
 snapshot_hash:=eps.presentation_hash(snapshot);manifest_hash:=eps.presentation_hash(manifest);inventory_hash:=eps.presentation_hash(inventory);
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',workspace.id,'series_id',series.id,'version_id',version_id,'snapshot_sha256',snapshot_hash,'manifest_sha256',manifest_hash,'inventory_sha256',inventory_hash,'configuration',snapshot->'render_configuration');input_hash:=eps.presentation_hash(job_input);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)values(job_id,workspace.id,auth.uid(),'presentation_render',version_id,job_input,input_hash,'eps.presentation-job-input.cast-canonical.v1',encode(sha256(convert_to(auth.uid()::text||':presentation.generate:'||p_idempotency_key,'UTF8')),'hex'),'prepare_presentation',job_id::text);
 insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,generation_job_id,generated_by,generation_note,created_at)
 values(version_id,series.id,workspace.id,workspace.project_id,version_no,workspace.row_version,workspace.draft_revision,review->>'input_fingerprint',snapshot,snapshot_hash,manifest,manifest_hash,inventory_hash,jsonb_array_length(slides),job_id,auth.uid(),note,created_at);
 for item in select value from jsonb_array_elements(slides)loop
  insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)values((item->>'id')::uuid,version_id,(item->>'order')::integer,item->>'kind',(item->>'assignment_id')::uuid,(item->>'slot_id')::uuid,item,eps.presentation_hash(item));
 end loop;
 for source in select * from eps.media_assets where id=any(assets)order by id loop
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  values(version_id,source.id,source.purpose,source.bucket,source.object_key,source.mime_type,source.size_bytes,source.sha256,source.width,source.height,source.duration_ms,source.source_asset_id,source.source_timestamp_ms,source.filename,source.created_at);
 end loop;
 update eps.presentation_series set next_version_number=next_version_number+1,row_version=row_version+1,updated_at=clock_timestamp()where id=series.id;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job_id,'prepare_presentation',input_hash,1,job_id::text||':1');
 return eps.presentation_remember(p_idempotency_key,payload,jsonb_build_object('job_id',job_id,'resource_id',version_id,'status','queued','poll_url','/api/v1/jobs/'||job_id::text),version_id);
end$$;
create function eps.presentation_lock_sources(p_workspace uuid,p_template_key text,p_template_version text)returns void language plpgsql volatile security invoker set search_path=''as $$
declare project_id uuid;client_id uuid;begin
 if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace not found.',404);end if;
 select w.project_id into project_id from eps.workspaces w where w.id=p_workspace;
 begin
  perform 1 from public.projects p where p.id=project_id for share nowait;select p.client_id into client_id from public.projects p where p.id=project_id;
  perform 1 from public.clients c where c.id=client_id for share nowait;
  perform 1 from eps.presentation_templates t where t.key=p_template_key and t.version=p_template_version for share nowait;
  perform 1 from eps.specs where workspace_id=p_workspace order by id for share nowait;
  perform 1 from eps.roles where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  perform 1 from eps.slots where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  perform 1 from eps.assignments where workspace_id=p_workspace and archived_at is null order by id for share nowait;
  perform 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and exists(select 1 from eps.assignments a where a.workspace_candidate_id=p.id and a.archived_at is null)order by p.id for share nowait;
  perform 1 from eps.candidates c where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where p.candidate_id=c.id and a.workspace_id=p_workspace and a.archived_at is null)order by c.id for share nowait;
  perform 1 from eps.candidate_media m where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where p.selected_candidate_media_id=m.id and a.workspace_id=p_workspace and a.archived_at is null)order by m.id for share nowait;
  perform 1 from eps.media_assets m where m.id=(select logo_asset_id from eps.workspaces where id=p_workspace)
   or exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id left join eps.candidate_media v on v.id=p.selected_candidate_media_id where a.workspace_id=p_workspace and a.archived_at is null and(m.id=v.source_asset_id or m.id=any(p.selected_frame_asset_ids)))order by m.id for share nowait;
  perform 1 from eps.candidate_media_frames f where exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where a.workspace_id=p_workspace and a.archived_at is null and f.candidate_media_id=p.selected_candidate_media_id and f.asset_id=any(p.selected_frame_asset_ids))order by f.candidate_media_id,f.asset_id for share nowait;
 exception when lock_not_available then perform eps.fail('INPUT_CHANGED','Presentation source information is changing. Refresh review before generating.',409);end;
 if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace changed.',404);end if;
end$$;
