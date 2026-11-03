
declare series eps.presentation_series;workspace eps.workspaces;template eps.presentation_templates;configuration eps.presentation_processing_config;
 expected_workspace bigint;expected_draft bigint;initial_workspace uuid;payload jsonb;cached jsonb;review jsonb;slide jsonb;frozen jsonb;slides jsonb:='[]';inventory jsonb;manifest jsonb;snapshot jsonb;job_input jsonb;
 version_id uuid:=gen_random_uuid();job_id uuid:=gen_random_uuid();slide_id uuid;version_no bigint;created_at timestamptz;ordinal integer:=0;assets uuid[];capture_assets eps.media_assets[]:='{}'::eps.media_assets[];source eps.media_assets;item jsonb;note text;snapshot_hash text;manifest_hash text;inventory_hash text;input_hash text;begin
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
 select coalesce(array_agg(a order by a.id),'{}'::eps.media_assets[])into capture_assets
 from eps.media_assets a where a.id=any(assets)and a.status='ready'and a.sha256 is not null and a.size_bytes>0 and a.purpose in('client_logo','candidate_frame','candidate_video')and a.bucket in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs');
 select coalesce(jsonb_agg(jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'asset_kind',a.purpose,'mime_type',a.mime_type,'byte_size',a.size_bytes,'bucket',a.bucket,'object_key',a.object_key,'width',a.width,'height',a.height,'duration_ms',a.duration_ms,'source_asset_id',a.source_asset_id,'timestamp_ms',a.source_timestamp_ms)order by a.id),'[]'::jsonb)into inventory
 from unnest(capture_assets)a;
 if jsonb_array_length(inventory)<>cardinality(assets)then perform eps.fail('ASSET_UNAVAILABLE','A selected source asset cannot be captured.',503);end if;
 snapshot:=jsonb_build_object('schema_version','1.0','hash_protocol','eps-cast-canonical-v1','version_id',version_id,'series_id',series.id,'workspace_id',workspace.id,'project_id',workspace.project_id,'version_no',version_no,'created_at',eps.presentation_time(created_at),'input_workspace_row_version',workspace.row_version,'input_draft_revision',workspace.draft_revision,'input_fingerprint',review->>'input_fingerprint','template',eps.review_template_dto(series)||jsonb_build_object('font_hashes',template.font_hashes),'render_configuration',jsonb_build_object('renderer_version',configuration.renderer_version,'application_origin',configuration.application_origin),'audience_snapshot',series.audience_snapshot,'cover',review->'cover','slides',slides,'asset_inventory',inventory);
 manifest:=eps.presentation_manifest(snapshot);
 if octet_length(snapshot::text)>8388608 or octet_length(manifest::text)>configuration.max_manifest_bytes then perform eps.fail('PDF_BUDGET_EXCEEDED','The captured presentation exceeds the technical metadata budget.',503);end if;
 snapshot_hash:=eps.presentation_hash(snapshot);manifest_hash:=eps.presentation_hash(manifest);inventory_hash:=eps.presentation_hash(inventory);
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',workspace.id,'series_id',series.id,'version_id',version_id,'snapshot_sha256',snapshot_hash,'manifest_sha256',manifest_hash,'inventory_sha256',inventory_hash,'configuration',snapshot->'render_configuration');input_hash:=eps.presentation_hash(job_input);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)values(job_id,workspace.id,auth.uid(),'presentation_render',version_id,job_input,input_hash,'eps.presentation-job-input.cast-canonical.v1',encode(sha256(convert_to(auth.uid()::text||':presentation.generate:'||p_idempotency_key,'UTF8')),'hex'),'prepare_presentation',job_id::text);
 insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,generation_job_id,generated_by,generation_note,created_at,english_transcript_version)
 values(version_id,series.id,workspace.id,workspace.project_id,version_no,workspace.row_version,workspace.draft_revision,review->>'input_fingerprint',snapshot,snapshot_hash,manifest,manifest_hash,inventory_hash,jsonb_array_length(slides),job_id,auth.uid(),note,created_at,'1.0');
 for item in select value from jsonb_array_elements(slides)loop
  insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)values((item->>'id')::uuid,version_id,(item->>'order')::integer,item->>'kind',(item->>'assignment_id')::uuid,(item->>'slot_id')::uuid,item,eps.presentation_hash(item));
 end loop;
 if coalesce(cardinality(capture_assets),0)>0 then
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  select version_id,a.id,a.purpose,a.bucket,a.object_key,a.mime_type,a.size_bytes,a.sha256,a.width,a.height,a.duration_ms,a.source_asset_id,a.source_timestamp_ms,a.filename,a.created_at from unnest(capture_assets)a order by a.id;
 end if;
 perform eps.capture_presentation_video_transcripts(version_id);
 update eps.presentation_series set next_version_number=next_version_number+1,row_version=row_version+1,updated_at=clock_timestamp()where id=series.id;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job_id,'prepare_presentation',input_hash,1,job_id::text||':1');
 return eps.presentation_remember(p_idempotency_key,payload,jsonb_build_object('job_id',job_id,'resource_id',version_id,'status','queued','poll_url','/api/v1/jobs/'||job_id::text),version_id);
end