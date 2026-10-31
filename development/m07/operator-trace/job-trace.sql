-- Fixed pilot job metadata only. No payload, lease, input or private result reads.
begin isolation level repeatable read read only;
set local search_path='';
set local statement_timeout='20s';
set local timezone='UTC';
with fixed_jobs(id,kind,expected_workspace)as(values
 ('fa8593ca-80c2-4cb3-8bcc-0e357ffbf7f2'::uuid,'candidate_scan','86936940-b48d-497d-b1ff-8e0da0913afa'::uuid),
 ('35dcef5a-4717-4cdf-8cef-85f6940d0aec'::uuid,'specs_extract','86936940-b48d-497d-b1ff-8e0da0913afa'::uuid),
 ('7ca22801-2040-40df-87fc-84a82fffb6c7'::uuid,'presentation_render','098d5b48-42a3-475b-b562-735c9eafce80'::uuid)),
scoped_jobs as(
 select j.id,j.kind,j.workspace_id,j.resource_id,j.requested_by,j.correlation_id,
  j.status,j.stage,j.attempt,j.created_at,j.updated_at,j.n8n_execution_id,
  case when j.error is null then null
   when j.error->>'code'=any(array['DEPENDENCY_UNAVAILABLE','SOURCE_UNREADABLE','UNSUPPORTED_FORMAT','RESULT_INVALID','EXTRACTION_REFUSED','PROVIDER_RATE_LIMITED','LEASE_EXPIRED','DISPATCH_UNAVAILABLE','INPUT_CHANGED','PROCESSING_FAILED','RETRY_EXHAUSTED','PDF_TEMPLATE_MISMATCH','PDF_ASSET_INVALID','PDF_OVERFLOW','PDF_RENDER_FAILED','PDF_VALIDATION_FAILED','PDF_ABORTED','PDF_BUDGET_EXCEEDED','JOB_CANCELLED','PDF_SOURCE_UNAVAILABLE','PDF_TEMPLATE_UNAVAILABLE','PDF_LAYOUT_OVERFLOW','PDF_INVALID','PDF_PAGE_COUNT_MISMATCH','PDF_LINKS_INVALID','PDF_OUTPUT_UNVERIFIED','SNAPSHOT_INVALID','PERMISSION_CHANGED'])then j.error->>'code'
   else'UNCLASSIFIED_ERROR'end as safe_error_code
 from eps.jobs j join fixed_jobs f on f.id=j.id and f.kind=j.kind
 where j.workspace_id=f.expected_workspace),
projected as(
 select j.id,jsonb_build_object(
  'id',j.id,'kind',j.kind,'workspace_id',j.workspace_id,'resource_id',j.resource_id,
  'requested_by',j.requested_by,'request_id',case when j.correlation_id~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'then lower(j.correlation_id)end,
  'status',j.status,'stage',j.stage,'attempt',j.attempt,'created_at',j.created_at,'updated_at',j.updated_at,
  'workflow_execution_id',case when j.n8n_execution_id~'^[0-9]{1,20}$'then j.n8n_execution_id end,'error_code',j.safe_error_code,
  'events_total',(select count(*)from eps.job_events e where e.job_id=j.id),
  'events_truncated',(select count(*)>100 from eps.job_events e where e.job_id=j.id),
  'events',coalesce((select jsonb_agg(jsonb_build_object('attempt_id',e.attempt_id,'sequence',e.sequence,'stage',e.stage,'event_type',e.event_type,'created_at',e.created_at)order by e.created_at,e.attempt_id,e.sequence)
   from(select attempt_id,sequence,stage,event_type,created_at from eps.job_events where job_id=j.id order by created_at desc,attempt_id desc,sequence desc limit 100)e),'[]'::jsonb),
  'outbox',(select jsonb_build_object('total',count(*),'pending',count(*)filter(where status='pending'),'leased',count(*)filter(where status='leased'),
   'delivered',count(*)filter(where status='delivered'),'dead',count(*)filter(where status='dead'),'delivery_attempts',coalesce(sum(attempt_count),0),
   'last_created_at',max(created_at),'last_delivered_at',max(delivered_at))from eps.outbox_events where job_id=j.id),
  'audit_total',(select count(*)from eps.audit_events a where a.resource_id in(j.id,j.resource_id)),
  'audit_truncated',(select count(*)>50 from eps.audit_events a where a.resource_id in(j.id,j.resource_id)),
  'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'resource_id',a.resource_id,'principal_id',a.principal_id,
    'request_id',case when a.request_id~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'then lower(a.request_id)end,
    'declared_client',a.client_type,'created_at',a.created_at)order by a.created_at,a.id)
   from(select id,resource_id,principal_id,request_id,client_type,created_at from eps.audit_events where resource_id in(j.id,j.resource_id)order by created_at desc,id desc limit 50)a),'[]'::jsonb)
 )as value from scoped_jobs j)
select jsonb_build_object(
 'database',current_database(),'operator',current_user,'observed_at',clock_timestamp(),
 'read_only',current_setting('transaction_read_only')='on',
 'history_count',(select count(*)from supabase_migrations.schema_migrations),
 'exact_history33',(select array_agg(version order by version)from supabase_migrations.schema_migrations)=array[
 '20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320',
 '20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600',
 '20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218',
 '20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000','20261031104603','20261031130207']::text[],
 'protected_m02_preserved',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'and status='waiting_for_input'and stage='apply_specs'and attempt=3 and row_version=7),
 'jobs',coalesce((select jsonb_agg(value order by id)from projected),'[]'::jsonb)
)as operator_job_trace;
rollback;
