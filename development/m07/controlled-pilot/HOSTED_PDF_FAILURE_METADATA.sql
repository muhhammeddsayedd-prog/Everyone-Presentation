-- Fixed failed hosted render; metadata only, never snapshots or media paths.
begin read only;
set local search_path='';
set local statement_timeout='20s';
select jsonb_build_object(
 'read_only',current_setting('transaction_read_only')='on',
 'job',(select jsonb_build_object('id',id,'status',status,'stage',stage,'attempt',attempt,
  'stage_attempts',stage_attempts,'created_at',created_at,'updated_at',updated_at,
  'error_code',error->>'code','n8n_execution_id',n8n_execution_id)from eps.jobs
  where id='7ca22801-2040-40df-87fc-84a82fffb6c7' and resource_id='0175b902-b26b-4fd3-ae90-0f8281f071df'),
 'payloads',(select jsonb_agg(jsonb_build_object('stage',stage,'attempt_id',attempt_id,'result_schema',result_schema,
   'created_at',created_at,'proof',payload->'proof','manifest_asset',payload->'manifest_asset','pdf_asset',payload->'pdf_asset')order by created_at)
  from eps.review_stage_payloads where job_id='7ca22801-2040-40df-87fc-84a82fffb6c7'),
 'grant_counts',(select jsonb_agg(row)from(select g.attempt_id,g.permission,a.purpose,count(*)as grants,
    min(g.created_at)as first_grant,max(g.created_at)as last_grant
    from eps.presentation_asset_grants g join eps.media_assets a on a.id=g.asset_id
    where g.job_id='7ca22801-2040-40df-87fc-84a82fffb6c7'group by g.attempt_id,g.permission,a.purpose order by first_grant)row),
 'events',(select jsonb_agg(jsonb_build_object('attempt_id',attempt_id,'stage',stage,'event_type',event_type,'created_at',created_at)order by created_at)
  from eps.job_events where job_id='7ca22801-2040-40df-87fc-84a82fffb6c7')
)as hosted_pdf_failure_metadata;
rollback;
