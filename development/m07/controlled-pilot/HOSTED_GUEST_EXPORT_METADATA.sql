-- Fixed hosted export: provider/job/count metadata, no saved content or URLs.
begin read only;
set local search_path='';
set local statement_timeout='20s';
select jsonb_build_object(
 'export',(select to_jsonb(e) from eps.presentation_exports e
   where e.id='341f1fd1-a2d5-40bf-b734-91ab01a6599a'
   and e.version_id='0175b902-b26b-4fd3-ae90-0f8281f071df'
   and e.review_link_id='243b8e61-b9e2-4988-9697-a07b72a84cc8'),
 'job',(select jsonb_build_object('id',j.id,'kind',j.kind,'status',j.status,
   'stage',j.stage,'attempt',j.attempt,'created_at',j.created_at,
   'updated_at',j.updated_at,'n8n_execution_id',j.n8n_execution_id)
   from eps.jobs j join eps.presentation_exports e on e.job_id=j.id
   where e.id='341f1fd1-a2d5-40bf-b734-91ab01a6599a'),
 'proof_counts',(select jsonb_agg(jsonb_build_object('stage',p.stage,
   'created_at',p.created_at,'schema',p.result_schema,
   'page_count',p.payload->'proof'->'page_count',
   'frame_draw_count',p.payload->'proof'->'frame_draw_count',
   'candidate_field_count',p.payload->'proof'->'candidate_field_count',
   'overflow_count',p.payload->'proof'->'overflow_count',
   'image_draws_checked',p.payload->'proof'->'image_draws_checked',
   'video_links_checked',p.payload->'proof'->'video_links_checked')order by p.created_at)
   from eps.review_stage_payloads p join eps.presentation_exports e on e.job_id=p.job_id
   where e.id='341f1fd1-a2d5-40bf-b734-91ab01a6599a')
) as hosted_guest_export_metadata;
rollback;
