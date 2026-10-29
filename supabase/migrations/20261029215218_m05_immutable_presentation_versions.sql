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

-- Register a new retained template. Existing1.0 series and source bytes stay fixed.
insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes)
 select key,'1.1.0','bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638',font_key,font_hashes
 from eps.presentation_templates where key='everyone-casting'and version='1.0.0';
do $forward$
declare item record;source text;definition text;replacement text;begin
 for item in select * from(values
 ('public.eps_create_presentation_series(jsonb,text)','3e8ee724bf684c8ce3b890d3b474ad424aaedfe450d89814aa69367f74f2fdd0'),
 ('eps.review_target_context(uuid,text,uuid,text)','d2312bd892c3a98e2ae4ac5c42e68b06289f30a6285a2e19a9e10be2755d1928'),
 ('eps.review_snapshot_data(uuid,uuid,text)','ba6e8c5501f5d9c7299b0ceb50dfc770de851d673bc6ec2c9ab98b134f5fc12a'),
 ('public.eps_get_workspace_review(uuid,uuid,text)','f1aa46bf5008f57e680a841dc94f888f9194631e10e3ba34ed39c199fda0e9c8'),
 ('public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)','a32753610028eee4159a7e4c1f252356714bab113cf6cf89ab184c7aa98bc73a')
 )v(signature,expected)loop
  select replace(prosrc,E'\r\n',E'\n'),pg_get_functiondef(oid)into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected then raise exception'M05_PRECEDING_TEMPLATE_SOURCE_REQUIRED';end if;
  definition:=replace(definition,E'\r\n',E'\n');replacement:=source;
  if item.signature in('public.eps_create_presentation_series(jsonb,text)','eps.review_target_context(uuid,text,uuid,text)')then
   replacement:=replace(source,'version=''1.0.0''','version=''1.1.0''');
  elsif item.signature='eps.review_snapshot_data(uuid,uuid,text)'then
   replacement:=replace(source,' select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''headcount'',headcount',
    E' if series.template_version=''1.1.0''then\n  select coalesce(jsonb_agg(v||jsonb_build_object(''role_category'',(select r.category from eps.roles r where r.id=(v->>''role_id'')::uuid))order by ord),''[]''::jsonb)into slides from jsonb_array_elements(slides)with ordinality s(v,ord);\n end if;\n select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''headcount'',headcount');
  elsif item.signature='public.eps_get_workspace_review(uuid,uuid,text)'then
   replacement:=replace(source,' review:=eps.review_snapshot(p_workspace_id,p_series_id,p_output_type);',
    E' review:=eps.review_snapshot(p_workspace_id,p_series_id,p_output_type);\n if review#>>''{template,version}''<>''1.1.0''then return review||jsonb_build_object(''can_generate'',false,''issues'',review->''issues''||jsonb_build_array(eps.review_issue(''TEMPLATE_UPGRADE_REQUIRED'',''blocking'',p_series_id,null,''This retained template requires a new series before generation.'',''Create a current template series and review it.'')),''fit'',jsonb_build_object(''status'',''unmeasured'',''input_fingerprint'',null,''measured_at'',null,''overflows'',''[]''::jsonb,''error_code'',''TEMPLATE_UPGRADE_REQUIRED''));end if;');
  else
   replacement:=replace(source,' select * into configuration from eps.review_processing_config where id and enabled;',
    E' if not exists(select 1 from eps.presentation_series where id=p_series_id and workspace_id=p_workspace_id and template_version=''1.1.0'')then perform eps.fail(''TEMPLATE_UPGRADE_REQUIRED'',''Create a current template series before measuring.'',409);end if;\n if not exists(select 1 from eps.presentation_processing_config where id and enabled)then perform eps.fail(''REVIEW_PROCESSING_UNAVAILABLE'',''Current template processing is not enabled.'',503);end if;\n select * into configuration from eps.review_processing_config where id and enabled;');
  end if;
  if replacement=source then raise exception'M05_TEMPLATE_FORWARD_ANCHOR_REQUIRED:%',item.signature;end if;execute replace(definition,source,replacement);
 end loop;
end$forward$;

-- Four-stage durable rendering, scoped to immutable captured versions.
do $$declare item record;definition text;begin
 for item in select conname,pg_get_constraintdef(oid)body,conrelid::regclass tab from pg_constraint where connamespace='eps'::regnamespace and conname in('jobs_kind_check','jobs_stage_check','jobs_kind_stage_check','jobs_input_hash_version_check','job_events_stage_check','outbox_events_stage_check')loop
  definition:=item.body;
  if item.conname='jobs_kind_check'then definition:=replace(definition,'''review_fit''::text','''review_fit''::text,''presentation_render''::text');
  elsif item.conname='jobs_kind_stage_check'then definition:='CHECK ('||substring(definition from 7)||' OR(kind=''presentation_render''and stage in(''prepare_presentation'',''render_presentation'',''validate_presentation'',''publish_presentation'')))';
  elsif item.conname='jobs_input_hash_version_check'then definition:=replace(definition,'''eps.review-job-input.pg-jsonb.v1''::text','''eps.review-job-input.pg-jsonb.v1''::text,''eps.presentation-job-input.cast-canonical.v1''::text');
  else definition:=replace(definition,'''measure_review_fit''::text','''measure_review_fit''::text,''prepare_presentation''::text,''render_presentation''::text,''validate_presentation''::text,''publish_presentation''::text');end if;
  if definition=item.body then raise exception'M05_STAGE_CONSTRAINT_ANCHOR_REQUIRED';end if;
  execute format('alter table %s drop constraint %I',item.tab,item.conname);execute format('alter table %s add constraint %I %s',item.tab,item.conname,definition);
 end loop;
end$$;
create function eps.presentation_timestamp_valid(p_value jsonb)returns boolean language plpgsql volatile security invoker set search_path=''as $$declare value text;at_value timestamptz;begin
 if jsonb_typeof(p_value)is distinct from'string'then return false;end if;value:=p_value#>>'{}';
 if value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$'then return false;end if;
 begin at_value:=value::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then return false;end;
 return isfinite(at_value)and at_value<=clock_timestamp()+interval'5minutes';
end$$;
create function eps.presentation_output_ref(p_ref jsonb,p_job eps.jobs,p_attempt uuid,p_purpose text)returns boolean language sql volatile security invoker set search_path=''as $$
 select eps.specs_stage_shape(p_ref,array['asset_id','sha256','size_bytes','mime_type'])and exists(select 1 from eps.media_assets a where a.id=eps.input_uuid(p_ref->>'asset_id')and a.producing_job_id=p_job.id and a.producing_attempt_id=p_attempt and a.origin_workspace_id=p_job.workspace_id and a.output_stage='render_presentation'and a.output_key=p_purpose and a.purpose=p_purpose and a.status='ready'and a.bucket='eps-presentation-outputs'and a.object_key='jobs/'||p_job.id||'/attempts/'||p_attempt||'/'||a.id||case when p_purpose='presentation_pdf'then'.pdf'else'.json'end and a.sha256=p_ref->>'sha256'and to_jsonb(a.size_bytes)=p_ref->'size_bytes'and a.mime_type=p_ref->>'mime_type'and a.width is null and a.height is null and a.duration_ms is null and a.source_asset_id is null and a.source_timestamp_ms is null)
$$;
create function eps.presentation_validate_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;proof jsonb;rendered jsonb;validated jsonb;render_attempt uuid;candidate_count integer;pending_count integer;frame_count integer;logo_count integer;video_count integer;link_hash text;begin
 select * into version from eps.presentation_versions where id=p_job.resource_id and generation_job_id=p_job.id;perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');
 select count(*)filter(where s->>'kind'='candidate'),count(*)filter(where s->>'kind'='pending'),coalesce(sum(jsonb_array_length(s->'frames')),0),count(*)filter(where s->>'logo_asset_id'is not null),count(*)filter(where s->>'video_asset_id'is not null)
 into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;
 select eps.presentation_hash(coalesce(jsonb_agg(to_jsonb((version.snapshot#>>'{render_configuration,application_origin}')||'/presentations/versions/'||version.id||'/media/'||(s->>'video_asset_id'))order by ord),'[]'::jsonb))into link_hash from jsonb_array_elements(version.snapshot->'slides')with ordinality a(s,ord)where s->>'video_asset_id'is not null;
 if p_job.stage='publish_presentation'then
  select payload into validated from eps.review_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='validate_presentation';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['version_id','manifest_asset_id','pdf_asset_id','pdf_sha256','page_count','template_version','validation_passed','overflow_count','renderer_build'])and p_value->>'version_id'=version.id::text and p_value->>'manifest_asset_id'=validated#>>'{manifest_asset,asset_id}'and p_value->>'pdf_asset_id'=validated#>>'{pdf_asset,asset_id}'and p_value->>'pdf_sha256'=validated#>>'{pdf_asset,sha256}'and p_value->'page_count'=to_jsonb(version.page_count)and p_value->>'template_version'=version.snapshot#>>'{template,version}'and p_value->'validation_passed'='true'and p_value->'overflow_count'='0'and p_value->>'renderer_build'=version.snapshot#>>'{render_configuration,renderer_version}','RESULT_INVALID');return;
 end if;
 perform eps.specs_stage_assert(p_value->>'schema_version'='1.0'and p_value->>'version_id'=version.id::text and p_value->>'snapshot_sha256'=version.snapshot_sha256 and p_value->>'manifest_sha256'=version.manifest_sha256 and p_value->>'inventory_sha256'=version.inventory_sha256,'RESULT_INVALID');
 if p_job.stage='prepare_presentation'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','version_id','snapshot_sha256','manifest_sha256','inventory_sha256','template_content_sha256','font_hashes','renderer_version','prepared_at'])and p_value->>'template_content_sha256'=version.snapshot#>>'{template,content_sha256}'and p_value->'font_hashes'=version.snapshot#>'{template,font_hashes}'and p_value->>'renderer_version'=version.snapshot#>>'{render_configuration,renderer_version}'and eps.presentation_timestamp_valid(p_value->'prepared_at'),'RESULT_INVALID');return;
 end if;
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','version_id','snapshot_sha256','manifest_sha256','inventory_sha256','manifest_asset','pdf_asset','proof']),'RESULT_INVALID');proof:=p_value->'proof';
 if p_job.stage='render_presentation'then
  perform eps.specs_stage_assert(eps.presentation_output_ref(p_value->'manifest_asset',p_job,p_job.current_attempt_id,'presentation_manifest')and eps.presentation_output_ref(p_value->'pdf_asset',p_job,p_job.current_attempt_id,'presentation_pdf')and p_value#>>'{manifest_asset,sha256}'=version.manifest_sha256,'RESULT_INVALID');
  perform eps.specs_stage_assert(eps.specs_stage_shape(proof,array['renderer_version','chromium_version','template_content_sha256','font_hashes','page_count','width_css_px','height_css_px','overflow_count','candidate_field_count','frame_draw_count','logo_draw_count','video_link_count','fonts_ready','images_ready','rendered_at','link_targets_sha256'])and proof->>'renderer_version'=version.snapshot#>>'{render_configuration,renderer_version}'and jsonb_typeof(proof->'chromium_version')='string'and length(proof->>'chromium_version')between 1 and 100 and proof->>'template_content_sha256'=version.snapshot#>>'{template,content_sha256}'and proof->'font_hashes'=version.snapshot#>'{template,font_hashes}'and proof->'page_count'=to_jsonb(version.page_count)and proof->'width_css_px'='1600'and proof->'height_css_px'='900'and proof->'overflow_count'='0'and proof->'candidate_field_count'=to_jsonb(candidate_count*10)and proof->'frame_draw_count'=to_jsonb(frame_count)and proof->'logo_draw_count'=to_jsonb(logo_count)and proof->'video_link_count'=to_jsonb(video_count)and proof->'fonts_ready'='true'and proof->'images_ready'='true'and eps.presentation_timestamp_valid(proof->'rendered_at')and proof->>'link_targets_sha256'=link_hash,'RESULT_INVALID');
 else
  select payload,attempt_id into rendered,render_attempt from eps.review_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='render_presentation';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  perform eps.specs_stage_assert(p_value->'manifest_asset'=rendered->'manifest_asset'and p_value->'pdf_asset'=rendered->'pdf_asset'and eps.presentation_output_ref(p_value->'manifest_asset',p_job,render_attempt,'presentation_manifest')and eps.presentation_output_ref(p_value->'pdf_asset',p_job,render_attempt,'presentation_pdf'),'RESULT_INVALID');
  perform eps.specs_stage_assert(eps.specs_stage_shape(proof,array['pdf_sha256','page_count','width_points','height_points','text_regions_checked','image_draws_checked','video_links_checked','embedded_font_count','validated_at'])and proof->>'pdf_sha256'=p_value#>>'{pdf_asset,sha256}'and proof->'page_count'=to_jsonb(version.page_count)and jsonb_typeof(proof->'width_points')='number'and abs((proof->>'width_points')::numeric-1200)<=0.5 and jsonb_typeof(proof->'height_points')='number'and abs((proof->>'height_points')::numeric-675)<=0.5 and proof->'text_regions_checked'=to_jsonb(3+candidate_count*23+pending_count*27)and proof->'image_draws_checked'=to_jsonb(frame_count+logo_count)and proof->'video_links_checked'=to_jsonb(video_count)and eps.specs_stage_integer(proof->'embedded_font_count',1,6000)and eps.presentation_timestamp_valid(proof->'validated_at'),'RESULT_INVALID');
 end if;
end$$;
create function eps.presentation_commit_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare prior text;version eps.presentation_versions;begin
 prior:=current_setting('eps.presentation.lifecycle_job',true);perform set_config('eps.presentation.lifecycle_job',p_job.id::text,true);
 if p_job.stage='render_presentation'then
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  select p_job.resource_id,a.id,a.purpose,a.bucket,a.object_key,a.mime_type,a.size_bytes,a.sha256,a.width,a.height,a.duration_ms,a.source_asset_id,a.source_timestamp_ms,a.filename,a.created_at
  from eps.media_assets a where a.id in((p_value#>>'{manifest_asset,asset_id}')::uuid,(p_value#>>'{pdf_asset,asset_id}')::uuid);
 elsif p_job.stage='publish_presentation'then
  update eps.presentation_versions set status='ready',manifest_asset_id=(p_value->>'manifest_asset_id')::uuid,pdf_asset_id=(p_value->>'pdf_asset_id')::uuid,ready_at=clock_timestamp(),failure_code=null,row_version=row_version+1,updated_at=clock_timestamp()where id=p_job.resource_id and generation_job_id=p_job.id and status<>'ready'returning * into version;
  perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  update eps.presentation_series set latest_ready_version_id=version.id,latest_ready_version_no=version.version_number,row_version=row_version+1,updated_at=clock_timestamp()where id=version.series_id and coalesce(latest_ready_version_no,0)<version.version_number;
 end if;
 perform set_config('eps.presentation.lifecycle_job',coalesce(prior,''),true);
end$$;
create function eps.record_presentation_job_event(p_event jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;previous eps.job_events;receipt jsonb;digest text;attempt uuid;sequence_value bigint;at_value timestamptz;safe_error jsonb;payload_id uuid;next_stage text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])and octet_length(p_event::text)<=1048576 and p_event->>'stage'in('prepare_presentation','render_presentation','validate_presentation','publish_presentation')and p_event->>'event_type'in('heartbeat','progress','succeeded','failed')and eps.specs_stage_integer(p_event->'sequence',1)and length(p_event->>'event_id')between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$'and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.presentation_stage_lock((p_event->>'job_id')::uuid,false);at_value:=clock_timestamp();attempt:=(p_event->>'attempt_id')::uuid;sequence_value:=(p_event->>'sequence')::bigint;digest:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=attempt and sequence=sequence_value),'EVENT_SEQUENCE_CONFLICT');
 receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running'or job.cancel_requested_at is not null or job.current_attempt_id<>attempt or job.stage<>p_event->>'stage'or job.lease_expires_at<=at_value then return receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');if sequence_value<=job.last_event_sequence then return receipt||'{"stale":true}'::jsonb;end if;
 if not eps.presentation_stage_can_write(job.requested_by,job.workspace_id)then safe_error:=eps.presentation_error('PERMISSION_CHANGED');
 elsif not eps.presentation_stage_matches(job)then safe_error:=eps.presentation_error('SNAPSHOT_INVALID');
 elsif p_event->>'event_type'='heartbeat'then
  perform eps.specs_stage_assert(not(p_event?'result')and not(p_event?'result_schema')and coalesce(p_event->'error','null')='null');job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval'90seconds';
 elsif p_event->>'event_type'='progress'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed)and(p_event#>'{result,progress_total}'='null'or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed'then
  perform eps.specs_stage_assert(not(p_event?'result')and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])and jsonb_typeof(p_event#>'{error,code}')='string'and jsonb_typeof(p_event#>'{error,retryable}')='boolean');safe_error:=eps.presentation_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean);
 else
  begin
   perform eps.specs_stage_assert(p_event->>'result_schema'=case job.stage when'prepare_presentation'then'presentation-preparation.v1'when'render_presentation'then'presentation-rendering.v1'when'validate_presentation'then'presentation-validation.v1'else'presentation-render-result.v1'end,'RESULT_INVALID');perform eps.presentation_validate_result(job,p_event->'result');
   insert into eps.review_stage_payloads(job_id,workspace_id,stage,attempt_id,input_hash,result_schema,payload)values(job.id,job.workspace_id,job.stage,attempt,job.input_hash,p_event->>'result_schema',p_event->'result')returning id into payload_id;
   perform eps.presentation_commit_result(job,p_event->'result');
  exception when raise_exception then if sqlerrm in('RESULT_INVALID','INVALID_REQUEST')then safe_error:=eps.presentation_error('PDF_OUTPUT_UNVERIFIED');else raise;end if;end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',attempt,'input_hash',job.input_hash,'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=case job.stage when'prepare_presentation'then'render_presentation'when'render_presentation'then'validate_presentation'when'validate_presentation'then'publish_presentation'else null end;
   if next_stage is null then job.status:='succeeded';job.result:=p_event->'result';else job.status:='queued';job.stage:=next_stage;job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value;job.progress_completed:=0;job.progress_total:=null;end if;job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if safe_error->'retryable'='true'and coalesce((job.stage_attempts->>job.stage)::integer,0)<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';else job.status:='failed';end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,last_event_sequence=sequence_value,heartbeat_at=job.heartbeat_at,lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 receipt:=receipt||jsonb_build_object('applied',true,'job_status',job.status);insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)values(job.id,attempt,p_event->>'event_id',sequence_value,p_event->>'stage',p_event->>'event_type',digest,receipt);return receipt;
end$$;
create function eps.recover_presentation_job_stages(p_limit integer)returns integer language plpgsql volatile security definer set search_path=''as $$
declare item record;job eps.jobs;recovered integer:=0;obsolete boolean;at_value timestamptz;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for item in select id,workspace_id from eps.jobs where kind='presentation_render'and status in('queued','running')order by lease_expires_at nulls last,id limit 1000 loop
  exit when recovered>=p_limit;perform 1 from eps.workspaces where id=item.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.presentation_stage_lock(item.id,false);if job.status not in('queued','running')or job.cancel_requested_at is not null then continue;end if;at_value:=clock_timestamp();
  if not eps.presentation_stage_can_write(job.requested_by,job.workspace_id)then job.status:='failed';job.error:=eps.presentation_error('PERMISSION_CHANGED');
  elsif not eps.presentation_stage_matches(job)then job.status:='failed';job.error:=eps.presentation_error('SNAPSHOT_INVALID');
  elsif job.status='queued'or job.lease_expires_at>at_value then continue;
  elsif coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then job.status:='failed';job.error:=eps.presentation_error('RETRY_EXHAUSTED');
  else job.status:='queued';job.error:=eps.presentation_error('LEASE_EXPIRED',true);job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;recovered:=recovered+1;
 end loop;return recovered;
end$$;
create policy presentation_jobs_service_read on eps.jobs for select to eps_review_stage_owner using(kind='presentation_render');
create policy presentation_jobs_service_update on eps.jobs for update to eps_review_stage_owner using(kind='presentation_render')with check(kind='presentation_render');
create function eps.presentation_is_job(p_job uuid)returns boolean language sql volatile security definer set search_path=''as $$select exists(select 1 from eps.jobs where id=p_job and kind='presentation_render')$$;
create function eps.presentation_stage_can_write(p_principal uuid,p_workspace uuid)returns boolean language sql volatile security invoker set search_path=''as $$
 select eps.review_stage_can_write(p_principal,p_workspace,'presentation_render')and exists(select 1 from public.app_capability_grants where principal_id=p_principal and capability='presentations.generate'and active)
$$;
create function eps.presentation_stage_matches(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$
 select p_job.kind='presentation_render'and p_job.input_hash_version='eps.presentation-job-input.cast-canonical.v1'and p_job.input_hash=eps.presentation_hash(p_job.input)
 and exists(select 1 from eps.presentation_versions v where v.id=p_job.resource_id and v.generation_job_id=p_job.id and v.workspace_id=p_job.workspace_id
  and p_job.input=jsonb_build_object('schema_version','1.0','workspace_id',v.workspace_id,'series_id',v.series_id,'version_id',v.id,'snapshot_sha256',v.snapshot_sha256,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,'configuration',v.snapshot->'render_configuration')
  and v.snapshot_sha256=eps.presentation_hash(v.snapshot)and v.manifest_sha256=eps.presentation_hash(v.manifest)and v.inventory_sha256=eps.presentation_hash(v.snapshot->'asset_inventory'))
$$;
create function eps.presentation_stage_lock(p_job uuid,p_require_access boolean default true)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$
declare identity eps.jobs;job eps.jobs;begin
 select * into identity from eps.jobs where id=p_job and kind='presentation_render';if not found then perform eps.fail('RESOURCE_NOT_FOUND','Presentation job not found.',404);end if;
 perform 1 from eps.workspaces where id=identity.workspace_id for update;
 select * into job from eps.jobs where id=p_job and workspace_id=identity.workspace_id and resource_id=identity.resource_id and kind='presentation_render'for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 if p_require_access and not eps.presentation_stage_can_write(job.requested_by,job.workspace_id)then perform eps.fail('PERMISSION_CHANGED','The requester no longer has presentation generation authority.',403);end if;
 return job;
end$$;
create function eps.presentation_stage_current(p_job uuid,p_attempt uuid,p_token text)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$declare job eps.jobs;begin
 job:=eps.presentation_stage_lock(p_job);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.presentation_stage_matches(job),'SNAPSHOT_INVALID');return job;
end$$;
create function eps.presentation_stage_live(p_job uuid,p_attempt uuid,p_hash text)returns boolean language sql volatile security definer set search_path=''as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='presentation_render'and j.current_attempt_id=p_attempt and j.input_hash=p_hash and j.status='running'and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp()and eps.presentation_stage_can_write(j.requested_by,j.workspace_id)and eps.presentation_stage_matches(j))
$$;
create function eps.presentation_error(p_code text,p_retryable boolean default false)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('code',case when p_code=any(array['PDF_SOURCE_UNAVAILABLE','PDF_TEMPLATE_UNAVAILABLE','PDF_LAYOUT_OVERFLOW','PDF_INVALID','PDF_PAGE_COUNT_MISMATCH','PDF_LINKS_INVALID','PDF_OUTPUT_UNVERIFIED','PDF_BUDGET_EXCEEDED','SNAPSHOT_INVALID','PERMISSION_CHANGED','RETRY_EXHAUSTED','JOB_CANCELLED','PROCESSING_FAILED','DEPENDENCY_UNAVAILABLE','LEASE_EXPIRED','DISPATCH_UNAVAILABLE'])then p_code else'PROCESSING_FAILED'end,'message','Presentation processing could not complete. The captured version was retained.','details','{}'::jsonb,'retryable',p_retryable and p_code in('DEPENDENCY_UNAVAILABLE','LEASE_EXPIRED','DISPATCH_UNAVAILABLE'))
$$;
create function eps.presentation_job_lifecycle()returns trigger language plpgsql security definer set search_path=''as $$
declare prior text;state text;begin
 if new.kind<>'presentation_render'or new.status=old.status then return new;end if;
 prior:=current_setting('eps.presentation.lifecycle_job',true);perform set_config('eps.presentation.lifecycle_job',new.id::text,true);
 state:=case when new.status='running'then'rendering'when new.status in('failed','cancelled','waiting_for_input')then'failed'when new.status='queued'then'queued'else null end;
 if state is not null then
  update eps.presentation_versions set status=state,failure_code=case when state='failed'then case when new.status='cancelled'then'JOB_CANCELLED'else coalesce(new.error->>'code','PROCESSING_FAILED')end else null end,row_version=row_version+1,updated_at=clock_timestamp()
  where generation_job_id=new.id and status<>'ready';
 end if;
 perform set_config('eps.presentation.lifecycle_job',coalesce(prior,''),true);return new;
end$$;
create trigger presentation_job_lifecycle after update of status on eps.jobs for each row execute function eps.presentation_job_lifecycle();
create function eps.claim_presentation_job_stage(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;completed jsonb;token text;attempts integer;at_value timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])and p_input->>'stage'in('prepare_presentation','render_presentation','validate_presentation','publish_presentation')and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.presentation_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();
 perform eps.specs_stage_assert(exists(select 1 from eps.presentation_processing_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.presentation_stage_matches(job),'SNAPSHOT_INVALID');perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled'or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Presentation processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages)value where value->>'stage'=p_input->>'stage'and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running'and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','This stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running')and job.available_at<=at_value,'JOB_NOT_AVAILABLE');attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');token:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=at_value+interval'90seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token,'lease_expires_at',job.lease_expires_at,'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end$$;
create function eps.get_presentation_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;snapshot jsonb;prepared jsonb;rendered jsonb;validated jsonb;begin
 job:=eps.presentation_stage_lock(p_job_id);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt_id and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.presentation_stage_matches(job),'SNAPSHOT_INVALID');
 select v.snapshot into snapshot from eps.presentation_versions v where v.id=job.resource_id and v.generation_job_id=job.id;
 select payload into prepared from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='prepare_presentation';
 select payload into rendered from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='render_presentation';
 select payload into validated from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='validate_presentation';
 if job.stage<>'prepare_presentation'then perform eps.specs_stage_assert(prepared is not null,'STAGE_STATE_INVALID');end if;
 if job.stage in('validate_presentation','publish_presentation')then perform eps.specs_stage_assert(rendered is not null,'STAGE_STATE_INVALID');end if;
 if job.stage='publish_presentation'then perform eps.specs_stage_assert(validated is not null,'STAGE_STATE_INVALID');end if;
 return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'snapshot',snapshot,'prepared',prepared,'rendered',rendered,'validated',validated);
end$$;

-- Private per-attempt output grants and retained-version interactive reads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('eps-presentation-outputs','eps-presentation-outputs',false,67108864,array['application/json','application/pdf']);
do $$declare definition text;begin
 select pg_get_constraintdef(oid)into definition from pg_constraint where conrelid='eps.media_assets'::regclass and conname='media_assets_typed_purpose_check';
 if position('ELSE false'in definition)=0 then raise exception'M05_TYPED_ASSET_CONSTRAINT_ANCHOR_REQUIRED';end if;
 definition:=replace(definition,'ELSE false',E'WHEN ''presentation_manifest''::text THEN mime_type=''application/json'' AND size_bytes BETWEEN 1 AND 8388608 AND bucket=''eps-presentation-outputs'' AND width IS NULL AND height IS NULL AND duration_ms IS NULL AND client_id IS NULL AND origin_workspace_id IS NOT NULL AND source_asset_id IS NULL AND source_timestamp_ms IS NULL AND producing_job_id IS NOT NULL AND producing_attempt_id IS NOT NULL AND output_stage=''render_presentation'' AND output_key=''presentation_manifest'' AND(status<>''ready'' OR sha256 IS NOT NULL)\nWHEN ''presentation_pdf''::text THEN mime_type=''application/pdf'' AND size_bytes BETWEEN 1 AND 67108864 AND bucket=''eps-presentation-outputs'' AND width IS NULL AND height IS NULL AND duration_ms IS NULL AND client_id IS NULL AND origin_workspace_id IS NOT NULL AND source_asset_id IS NULL AND source_timestamp_ms IS NULL AND producing_job_id IS NOT NULL AND producing_attempt_id IS NOT NULL AND output_stage=''render_presentation'' AND output_key=''presentation_pdf'' AND(status<>''ready'' OR sha256 IS NOT NULL)\nELSE false');
 alter table eps.media_assets drop constraint media_assets_typed_purpose_check;execute'alter table eps.media_assets add constraint media_assets_typed_purpose_check '||definition;
end$$;
create table eps.presentation_asset_grants(
 token_digest text primary key check(token_digest~'^[a-f0-9]{64}$'),job_id uuid not null references eps.jobs(id),attempt_id uuid not null,input_hash text not null,
 version_id uuid not null references eps.presentation_versions(id),asset_id uuid not null references eps.media_assets(id),bucket text not null,object_key text not null,
 permission text not null check(permission in('read','write')),created_at timestamptz not null,expires_at timestamptz not null,check(expires_at>created_at and expires_at<=created_at+interval'60seconds')
);
alter table eps.presentation_asset_grants enable row level security;alter table eps.presentation_asset_grants force row level security;
revoke all on eps.presentation_asset_grants from public,anon,authenticated,service_role;
grant select,insert on eps.presentation_asset_grants to eps_candidate_assets_owner;
create policy presentation_grants_service on eps.presentation_asset_grants for all to eps_candidate_assets_owner using(true)with check(true);
grant select on eps.presentation_versions,eps.presentation_version_assets,eps.review_stage_payloads to eps_candidate_assets_owner;
create policy presentation_asset_version_read on eps.presentation_versions for select to eps_candidate_assets_owner using(true);
create policy presentation_asset_pin_read on eps.presentation_version_assets for select to eps_candidate_assets_owner using(true);
create policy presentation_asset_payload_read on eps.review_stage_payloads for select to eps_candidate_assets_owner using(true);
create policy presentation_asset_job_read on eps.jobs for select to eps_candidate_assets_owner using(kind='presentation_render');
create policy presentation_asset_service_read on eps.media_assets for select to eps_candidate_assets_owner using(purpose in('client_logo','candidate_video','candidate_frame','presentation_manifest','presentation_pdf'));
create policy presentation_asset_service_insert on eps.media_assets for insert to eps_candidate_assets_owner with check(purpose in('presentation_manifest','presentation_pdf')and status='uploading'and bucket='eps-presentation-outputs'and output_stage='render_presentation'and sha256 is null and eps.presentation_stage_live(producing_job_id,producing_attempt_id,(select input_hash from eps.jobs where id=producing_job_id)));
create policy presentation_asset_service_complete on eps.media_assets for update to eps_candidate_assets_owner using(purpose in('presentation_manifest','presentation_pdf')and status='uploading'and eps.presentation_stage_live(producing_job_id,producing_attempt_id,(select input_hash from eps.jobs where id=producing_job_id)))with check(status='ready'and sha256 is not null);
create function eps.presentation_asset_member(p_job eps.jobs,p_asset eps.media_assets,p_permission text)returns boolean language plpgsql volatile security invoker set search_path=''as $$begin
 if p_permission='read'and p_asset.status in('ready','archived')and exists(select 1 from eps.presentation_version_assets p where p.version_id=p_job.resource_id and p.asset_id=p_asset.id and p.asset_kind in('client_logo','candidate_frame','candidate_video')and p.bucket=p_asset.bucket and p.object_key=p_asset.object_key and p.sha256=p_asset.sha256 and p.byte_size=p_asset.size_bytes and p.mime_type=p_asset.mime_type)then return true;end if;
 if p_asset.purpose not in('presentation_manifest','presentation_pdf')or p_asset.producing_job_id is distinct from p_job.id or p_asset.output_stage<>'render_presentation'or p_asset.bucket<>'eps-presentation-outputs'then return false;end if;
 if p_job.stage='render_presentation'and p_asset.producing_attempt_id=p_job.current_attempt_id and p_asset.status in('uploading','ready')and(p_permission='read'or p_asset.status='uploading')then return true;end if;
 return p_permission='read'and p_asset.status='ready'and exists(select 1 from eps.review_stage_payloads p where p.job_id=p_job.id and p.input_hash=p_job.input_hash and p.stage='render_presentation'and p.attempt_id=p_asset.producing_attempt_id and(p.payload#>>'{manifest_asset,asset_id}'=p_asset.id::text or p.payload#>>'{pdf_asset,asset_id}'=p_asset.id::text)and exists(select 1 from jsonb_array_elements(p_job.completed_stages)s where s#>>'{result,stage_output_id}'=p.id::text and s->>'attempt_id'=p.attempt_id::text));
end$$;
create function eps.get_presentation_asset_access(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;asset eps.media_assets;permission text;token text;at_value timestamptz;expiry timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','access'],array['job_id','attempt_id','lease_token','asset_id']));
 job:=eps.presentation_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');permission:=coalesce(p_input->>'access','read');perform eps.specs_stage_assert(permission in('read','write'));
 select * into asset from eps.media_assets where id=eps.input_uuid(p_input->>'asset_id');if not found or not eps.presentation_asset_member(job,asset,permission)then perform eps.fail('RESOURCE_NOT_FOUND','Asset not available to this captured version stage.',404);end if;
 at_value:=clock_timestamp();expiry:=least(job.lease_expires_at,at_value+interval'60seconds');perform eps.specs_stage_assert(expiry>at_value,'STALE_STAGE_LEASE');token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.presentation_asset_grants(token_digest,job_id,attempt_id,input_hash,version_id,asset_id,bucket,object_key,permission,created_at,expires_at)values(encode(sha256(convert_to(token,'UTF8')),'hex'),job.id,job.current_attempt_id,job.input_hash,job.resource_id,asset.id,asset.bucket,asset.object_key,permission,at_value,expiry);
 return jsonb_build_object('asset_id',asset.id,'bucket',asset.bucket,'object_key',asset.object_key,'permission',permission,'grant_token',token,'expires_at',expiry,'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,'sha256',asset.sha256);
end$$;
create function eps.reserve_presentation_job_output(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;existing eps.media_assets;asset_id uuid:=gen_random_uuid();expected_size bigint;kind text;mime text;filename text;extension text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms']));job:=eps.presentation_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 kind:=p_input->>'asset_kind';perform eps.specs_stage_assert(job.stage='render_presentation'and kind in('presentation_manifest','presentation_pdf')and p_input->>'output_key'=kind and p_input->'parent_asset_id'='null'and p_input->'time_offset_ms'='null');
 mime:=case kind when'presentation_pdf'then'application/pdf'else'application/json'end;filename:=case kind when'presentation_pdf'then'presentation.pdf'else'presentation-manifest.json'end;extension:=case kind when'presentation_pdf'then'pdf'else'json'end;
 perform eps.specs_stage_assert(p_input->>'mime_type'=mime and p_input->>'filename'=filename);expected_size:=eps.logo_integer(p_input->'expected_size_bytes',1,case kind when'presentation_pdf'then 67108864 else 8388608 end);
 select * into existing from eps.media_assets where producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_key=kind;
 if found then if existing.purpose<>kind or existing.size_bytes<>expected_size or existing.mime_type<>mime or existing.filename<>filename or existing.output_stage<>job.stage then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Logical presentation output metadata changed.',409);end if;
 else insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,producing_job_id,producing_attempt_id,output_stage,output_key)
  values(asset_id,job.workspace_id,kind,filename,mime,'eps-presentation-outputs','jobs/'||job.id||'/attempts/'||job.current_attempt_id||'/'||asset_id||'.'||extension,expected_size,'uploading',job.id,job.current_attempt_id,job.stage,kind)returning * into existing;end if;
 return jsonb_build_object('asset',eps.presentation_media_dto(existing),'bucket',existing.bucket,'object_key',existing.object_key);
end$$;
create function eps.complete_presentation_job_output(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;asset eps.media_assets;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','sha256','actual_size_bytes','width','height','duration_ms']));job:=eps.presentation_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 select * into asset from eps.media_assets where id=eps.input_uuid(p_input->>'asset_id')and producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_stage=job.stage and purpose in('presentation_manifest','presentation_pdf');if not found or job.stage<>'render_presentation'then perform eps.fail('RESOURCE_NOT_FOUND','Presentation output is not in the active attempt.',404);end if;
 perform eps.specs_stage_assert(p_input->>'sha256'~'^[a-f0-9]{64}$'and eps.logo_integer(p_input->'actual_size_bytes',1,67108864)=asset.size_bytes and p_input->'width'='null'and p_input->'height'='null'and p_input->'duration_ms'='null');
 if asset.status='ready'then if asset.sha256 is distinct from p_input->>'sha256' then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Presentation output already contains different verified bytes.',409);end if;
 else perform eps.specs_stage_assert(asset.status='uploading','INVALID_TRANSITION');update eps.media_assets set status='ready',sha256=p_input->>'sha256'where id=asset.id returning * into asset;end if;return eps.presentation_media_dto(asset);
end$$;
create function eps.presentation_capability_allowed(p_bucket text,p_key text,p_permission text)returns boolean language plpgsql volatile security definer set search_path=''as $$
declare headers jsonb;token text;begin
 if p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-presentation-outputs')or p_permission not in('read','write')then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;token:=headers->>'x-eps-asset-grant';if token is null or token!~'^[A-Za-z0-9_-]{43}$'then return false;end if;
 return exists(select 1 from eps.presentation_asset_grants g join eps.jobs j on j.id=g.job_id join eps.media_assets a on a.id=g.asset_id where g.token_digest=encode(sha256(convert_to(token,'UTF8')),'hex')and g.bucket=p_bucket and g.object_key=p_key and g.permission=p_permission and g.version_id=j.resource_id and g.expires_at>clock_timestamp()and a.bucket=p_bucket and a.object_key=p_key and eps.presentation_stage_live(j.id,g.attempt_id,g.input_hash)and eps.presentation_asset_member(j,a,p_permission)
 and(p_permission='read'or p_bucket='eps-presentation-outputs'and headers->>'x-upsert'='false'and headers->>'content-type'=a.mime_type));
end$$;
create function eps.presentation_storage_read_allowed(p_bucket text,p_key text)returns boolean language plpgsql stable security definer set search_path=''as $$begin
 if auth.uid()is null or p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-presentation-outputs')then return false;end if;
 return exists(select 1 from eps.presentation_version_assets p join eps.presentation_versions v on v.id=p.version_id join eps.media_assets a on a.id=p.asset_id where p.bucket=p_bucket and p.object_key=p_key and a.bucket=p.bucket and a.object_key=p.object_key and a.sha256=p.sha256 and a.size_bytes=p.byte_size and a.status in('ready','archived')and eps.presentation_scope(v.workspace_id)
 and(p.asset_kind in('client_logo','candidate_frame','candidate_video')or p.asset_kind='presentation_pdf'and v.status='ready'and v.pdf_asset_id=p.asset_id));
end$$;
create policy presentation_user_storage_read on storage.objects for select to authenticated using((storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info')or storage.allow_only_operation('object.sign'))and eps.presentation_storage_read_allowed(bucket_id,name));
create policy presentation_service_storage_read on storage.objects for select to anon using((storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info'))and eps.presentation_capability_allowed(bucket_id,name,'read'));
create policy presentation_service_storage_write on storage.objects for insert to anon with check(bucket_id='eps-presentation-outputs'and storage.allow_only_operation('object.upload')and eps.presentation_capability_allowed(bucket_id,name,'write'));
create policy presentation_output_read_guard on storage.objects as restrictive for select to public using(bucket_id<>'eps-presentation-outputs'or(storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info'))and(eps.presentation_storage_read_allowed(bucket_id,name)or eps.presentation_capability_allowed(bucket_id,name,'read'))or storage.allow_only_operation('object.sign')and eps.presentation_storage_read_allowed(bucket_id,name));
create policy presentation_output_insert_guard on storage.objects as restrictive for insert to public with check(bucket_id<>'eps-presentation-outputs'or storage.allow_only_operation('object.upload')and eps.presentation_capability_allowed(bucket_id,name,'write'));
create policy presentation_output_update_guard on storage.objects as restrictive for update to public using(bucket_id<>'eps-presentation-outputs')with check(bucket_id<>'eps-presentation-outputs');
create policy presentation_output_delete_guard on storage.objects as restrictive for delete to public using(bucket_id<>'eps-presentation-outputs');
do $$declare item record;definition text;begin
 for item in select polname,pg_get_expr(polqual,polrelid)qual from pg_policy where polrelid='storage.objects'::regclass and polname in('eps_logo_read_guard','eps_candidate_read_guard')loop
  definition:='('||item.qual||') OR((storage.allow_only_operation(''object.get_authenticated'')OR storage.allow_only_operation(''object.get_authenticated_info''))AND eps.presentation_capability_allowed(bucket_id,name,''read''))OR((storage.allow_only_operation(''object.get_authenticated'')OR storage.allow_only_operation(''object.get_authenticated_info'')OR storage.allow_only_operation(''object.sign''))AND eps.presentation_storage_read_allowed(bucket_id,name))';execute format('alter policy %I on storage.objects using(%s)',item.polname,definition);
 end loop;
end$$;

-- Extend existing constrained ports. No new runtime login or executable port.
create function eps.presentation_job_actions(p_job eps.jobs)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare operator boolean;principal uuid;begin
 principal:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
 operator:=eps.job_requester_active(principal)and exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id where w.id=p_job.workspace_id and w.archived_at is null and p.archived_at is null and m.principal_id=principal and m.active and m.can_write)
 and exists(select 1 from public.app_capability_grants where principal_id=principal and capability='operations.retry'and active);
 return jsonb_build_object('can_retry',coalesce(operator and p_job.status='failed'and p_job.cancel_requested_at is null and p_job.error->>'code'is distinct from'JOB_CANCELLED'and eps.presentation_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.presentation_stage_matches(p_job),false),'can_cancel',coalesce(operator and p_job.status in('queued','running','waiting_for_input'),false));
end$$;
do $dispatch$
declare item record;source text;definition text;replacement text;insertion text;at_value integer;begin
 for item in select * from(values
 ('eps.claim_job_stage(jsonb)','79700d4ec759eb26d67e5256ac146b7d3adcbd450c935ed8c6f36a78fd045338','if p_input->>''stage''in(''prepare_presentation'',''render_presentation'',''validate_presentation'',''publish_presentation'')then return eps.claim_presentation_job_stage(p_input);end if;'),
 ('eps.get_specs_stage_input(uuid,uuid,text)','32a84ecbec0d15d8b6aeaa795b52e9e59867e0daa8af4b04ff356c6831a0d81e','if eps.presentation_is_job(p_job_id)then return eps.get_presentation_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;'),
 ('eps.record_job_event(jsonb)','2addc85893d7abaab1e8ce9402a91956f8b7591998b0ad48b0be8e88ae74d1ac','if p_event->>''stage''in(''prepare_presentation'',''render_presentation'',''validate_presentation'',''publish_presentation'')then return eps.record_presentation_job_event(p_event);end if;'),
 ('eps.get_job_asset_access(jsonb)','12411358d6a2d2199a4b7ad633d68af471780796c7f42323feaa88ca15c382f3','if eps.presentation_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.get_presentation_asset_access(p_input);end if;'),
 ('eps.reserve_job_output(jsonb)','61123aefca808a7fcfff25efa04522404066bf68876a2fcfa39be1cb848ba732','if eps.presentation_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.reserve_presentation_job_output(p_input);end if;'),
 ('eps.complete_job_output(jsonb)','952f8b48d70c69c3f583025e986116b30270e413fe94d08d6297ccf519418517','if eps.presentation_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.complete_presentation_job_output(p_input);end if;'),
 ('eps.recover_job_stages(integer)','6bf6d08b48682b377f408125b3a9c9cdeadce54a3f0b8b555009114d73a1e75a',''),
 ('eps.claim_job_stage_replay(jsonb,text,text,text)','b5fbff3b697fd1a575baa7209fe792b94256d765756172fe5878e9c8ae6a8f8e',''),
 ('eps.jobs_dto(uuid)','17158fb3e7895e526718a620a1d9c2cbab373062a25c347ea066d6bd27438431',''),
 ('public.eps_retry_job(uuid,jsonb,text)','db777cbd79d8965964fb3e9270e90c42c885d2d4821c32869d8413dd9e3eb8ed',''),
 ('public.eps_cancel_job(uuid,jsonb,text)','f08c474649140d9e00555c76687765976ecca1e91212b47955cf8d66a07cd4e7','')
 )v(signature,expected,dispatch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected then raise exception'M05_EXACT_PRECEDING_PORT_SOURCE_REQUIRED:%',item.signature;end if;replacement:=source;
  if item.dispatch<>''then at_value:=position('begin'in source);replacement:=overlay(source placing E'begin\n '||item.dispatch||E'\n'from at_value for 6);
  elsif item.signature='eps.recover_job_stages(integer)'then replacement:=replace(source,'recovered:=eps.recover_review_job_stages(p_limit);','recovered:=eps.recover_presentation_job_stages(p_limit);recovered:=recovered+eps.recover_review_job_stages(p_limit-recovered);');
  elsif item.signature='eps.claim_job_stage_replay(jsonb,text,text,text)'then
   replacement:=replace(source,'if eps.frame_is_job(old.job_id) then','if eps.presentation_is_job(old.job_id)then job:=eps.presentation_stage_lock(old.job_id);elsif eps.frame_is_job(old.job_id) then');
   replacement:=replace(replacement,'case when job.kind=''frame_extract''','case when job.kind=''presentation_render''then eps.presentation_stage_matches(job)when job.kind=''frame_extract''');
  elsif item.signature='eps.jobs_dto(uuid)'then replacement:=replace(source,'  from eps.jobs where id=p_job','    ||case when kind=''presentation_render''then eps.presentation_job_actions(jobs)else''{}''::jsonb end'||E'\n  from eps.jobs where id=p_job');
  elsif item.signature='public.eps_retry_job(uuid,jsonb,text)'then
   replacement:=replace(source,'  if response is not null then return response; end if;',E'  if job.kind=''presentation_render''and not eps.presentation_stage_authorized(job)then perform eps.fail(''PERMISSION_CHANGED'',''The original requester no longer has generation authority.'',403);end if;\n  if response is not null then return response; end if;');
   replacement:=replace(replacement,E'  if job.status<>''failed'' or job.cancel_requested_at is not null or coalesce((job.error->>''retryable'')::boolean,false) is not true\n    or coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then',E'  if job.kind=''presentation_render''and(eps.presentation_job_actions(job)->''can_retry'')is distinct from''true''::jsonb or job.kind<>''presentation_render''and(job.status<>''failed'' or job.cancel_requested_at is not null or coalesce((job.error->>''retryable'')::boolean,false) is not true\n    or coalesce((job.stage_attempts->>job.stage)::integer,0)>=3)then');
   replacement:=replace(replacement,'  update eps.jobs set status=''queued'',error=null,','  update eps.jobs set stage_attempts=case when kind=''presentation_render''then stage_attempts-stage else stage_attempts end,status=''queued'',error=null,');
  else
   replacement:=replace(source,'  if job.status=''succeeded'' then',E'  if job.kind=''presentation_render''and job.status not in(''queued'',''running'',''waiting_for_input'',''cancelled'')then perform eps.fail(''INVALID_TRANSITION'',''This presentation job cannot be cancelled.'',409);end if;\n  if job.status=''succeeded'' then');
  end if;
  if replacement=source then raise exception'M05_PORT_DISPATCH_ANCHOR_REQUIRED:%',item.signature;end if;execute replace(definition,source,replacement);
 end loop;
end$dispatch$;
create function eps.presentation_stage_authorized(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$select eps.presentation_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.presentation_stage_matches(p_job)$$;
-- Existing owners retain their unrelated privileges; new private helpers are closed.
grant create on schema eps,public to eps_review_owner,eps_review_stage_owner,eps_candidate_assets_owner;
do $owners$declare item record;owner_name text;begin
 for item in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='eps'and(p.proname like'presentation_%'or p.proname in('claim_presentation_job_stage','get_presentation_stage_input','record_presentation_job_event','recover_presentation_job_stages','get_presentation_asset_access','reserve_presentation_job_output','complete_presentation_job_output')))or(n.nspname='public'and p.proname in('eps_generate_version','eps_list_versions','eps_get_version','eps_get_version_asset'))loop
  owner_name:=case when item.nspname='public'or item.proname in('presentation_scope','presentation_hash','presentation_time','presentation_public_slide','presentation_manifest','presentation_render_context','presentation_version_dto','presentation_media_dto','presentation_remember','presentation_lock_sources','presentation_storage_read_allowed')then'eps_review_owner'
   when item.proname in('presentation_asset_member','presentation_capability_allowed','get_presentation_asset_access','reserve_presentation_job_output','complete_presentation_job_output')then'eps_candidate_assets_owner'else'eps_review_stage_owner'end;
  execute format('alter function %s owner to %I',item.signature,owner_name);execute format('revoke all on function %s from public,anon,authenticated,service_role',item.signature);
 end loop;
end$owners$;
revoke create on schema eps,public from eps_review_owner,eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function public.eps_generate_version(uuid,jsonb,text),public.eps_list_versions(uuid,jsonb),public.eps_get_version(uuid),public.eps_get_version_asset(uuid,uuid,text)to authenticated;
grant execute on function eps.presentation_scope(uuid,boolean),eps.presentation_hash(jsonb),eps.presentation_time(timestamptz),eps.presentation_media_dto(eps.media_assets)to eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.presentation_immutable_version(),eps.presentation_immutable_row(),eps.presentation_protect_asset(),eps.presentation_ready_pointer()to eps_review_owner;
grant execute on function eps.presentation_hash(jsonb)to eps_review_owner;
grant execute on function eps.presentation_stage_current(uuid,uuid,text),eps.presentation_stage_live(uuid,uuid,text)to eps_candidate_assets_owner;
grant execute on function eps.presentation_is_job(uuid),eps.presentation_stage_lock(uuid,boolean),eps.presentation_stage_matches(eps.jobs),eps.claim_presentation_job_stage(jsonb),eps.get_presentation_stage_input(uuid,uuid,text),eps.record_presentation_job_event(jsonb),eps.recover_presentation_job_stages(integer)to eps_specs_stage_owner;
grant execute on function eps.presentation_is_job(uuid),eps.get_presentation_asset_access(jsonb),eps.reserve_presentation_job_output(jsonb),eps.complete_presentation_job_output(jsonb)to eps_specs_assets_owner;
grant execute on function eps.presentation_job_actions(eps.jobs),eps.presentation_stage_authorized(eps.jobs)to eps_jobs_owner;
grant execute on function eps.presentation_storage_read_allowed(text,text),eps.presentation_capability_allowed(text,text,text)to anon,authenticated;
grant execute on function eps.presentation_public_slide(jsonb),eps.presentation_manifest(jsonb),eps.presentation_render_context(jsonb)to eps_review_stage_owner;
notify pgrst,'reload schema';
