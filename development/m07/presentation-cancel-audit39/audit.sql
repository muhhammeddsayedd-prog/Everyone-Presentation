begin isolation level repeatable read read only;
set local search_path='';
set local timezone='UTC';
set local statement_timeout='20s';
with
scope(label,id)as(values('legacy','86936940-b48d-497d-b1ff-8e0da0913afa'::uuid),('controlled','5505def3-f7af-4684-968c-d1b154931601'::uuid)),
versions as(select id,series_id,version_number,status,generation_job_id,created_at from eps.presentation_versions where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'::uuid and created_at>='2026-11-02T10:21:00Z'::timestamptz and created_at<'2026-11-02T10:24:00Z'::timestamptz order by created_at,id limit 101),
jobs as(select id,kind,resource_id,status,stage,created_at from eps.jobs where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'::uuid and kind='presentation_render'and created_at>='2026-11-02T10:21:00Z'::timestamptz and created_at<'2026-11-02T10:24:00Z'::timestamptz order by created_at,id limit 101),
settings as(
 select 'role'::text source,r.rolname::text role_name,'all'::text database_scope,unnest(r.rolconfig)entry from pg_roles r where r.rolname in('anon','authenticated','authenticator','postgres','eps_review_owner')
 union all select 'database_role',coalesce(r.rolname,'all'),case when s.setdatabase=0 then'all'else'postgres'end,unnest(s.setconfig)from pg_db_role_setting s left join pg_roles r on r.oid=s.setrole where(s.setdatabase=0 or s.setdatabase=(select oid from pg_database where datname=current_database()))and(s.setrole=0 or r.rolname in('anon','authenticated','authenticator','postgres','eps_review_owner'))
),
safe_settings as(select source,role_name,database_scope,split_part(entry,'=',1)name,
 case when split_part(entry,'=',1)in('statement_timeout','lock_timeout','idle_in_transaction_session_timeout')and substring(entry from position('='in entry)+1)~'^[0-9]+(\.[0-9]+)?(us|ms|s|min|h|d)?$'then substring(entry from position('='in entry)+1)
 when split_part(entry,'=',1)in('pgrst.db_hoisted_tx_settings','pgrst.db_pre_request')and substring(entry from position('='in entry)+1)~'^[A-Za-z0-9_., ]{0,512}$'then substring(entry from position('='in entry)+1)else'[other]'end value
 from settings where split_part(entry,'=',1)in('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','pgrst.db_hoisted_tx_settings','pgrst.db_pre_request')),
functions as(select n.nspname||'.'||p.proname name,pg_get_function_identity_arguments(p.oid)arguments,p.prosecdef security_definer,
 encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')source_sha256,
 coalesce((select jsonb_object_agg(split_part(c,'=',1),case when split_part(c,'=',2)~'^[0-9]+(\.[0-9]+)?(us|ms|s|min|h|d)?$'then split_part(c,'=',2)else'[other]'end)from unnest(p.proconfig)c where split_part(c,'=',1)in('statement_timeout','lock_timeout','idle_in_transaction_session_timeout')),'{}')timeout_settings
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','eps')and p.proname in('eps_generate_version','presentation_lock_sources','review_document','review_snapshot','review_fingerprint','eps_get_presentation_review','eps_review_presentation','eps_get_generation_review')),
relations as(select c.oid,n.nspname||'.'||c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps'and c.relname in('workspaces','presentation_series','presentation_templates','audience_presets','roles','slots','assignments','workspace_candidates','candidates','candidate_media','candidate_media_frames','media_assets','review_wording','review_omissions','review_fit_results','presentation_versions','version_slides','presentation_version_assets','jobs','outbox_events')),
activity as(select a.pid,a.state,a.backend_type,a.wait_event_type,a.wait_event,
 greatest(0,extract(epoch from(clock_timestamp()-a.xact_start)))transaction_age_seconds,
 case when a.state='active'then greatest(0,extract(epoch from(clock_timestamp()-a.query_start)))end active_query_age_seconds,
 coalesce(a.query~'\meps_generate_version\M',false)generation_rpc,
 cardinality(pg_blocking_pids(a.pid))blocker_count
 from pg_stat_activity a where a.datname=current_database()and a.pid<>pg_backend_pid()),
activity_groups as(select state,backend_type,wait_event_type,case when wait_event~'^[A-Za-z0-9_]{1,64}$'then wait_event end wait_event,count(*)count,max(transaction_age_seconds)max_transaction_age_seconds,max(active_query_age_seconds)max_active_query_age_seconds,count(*)filter(where generation_rpc)generation_rpc_count,count(*)filter(where blocker_count>0)blocked_count,max(blocker_count)max_blocker_count from activity group by state,backend_type,wait_event_type,wait_event),
relation_locks as(select r.name relation,l.mode,l.granted,count(*)count,count(distinct l.pid)backend_count,count(*)filter(where cardinality(pg_blocking_pids(l.pid))>0)blocked_count,max(a.transaction_age_seconds)max_transaction_age_seconds from pg_locks l join relations r on r.oid=l.relation left join activity a on a.pid=l.pid where l.pid is distinct from pg_backend_pid()group by r.name,l.mode,l.granted)
select jsonb_build_object(
 'database',current_database(),'operator',current_user,'session_user',session_user,'read_only',current_setting('transaction_read_only')='on','observed_at',clock_timestamp(),'history_count',(select count(*)from supabase_migrations.schema_migrations),
 'window_start','2026-11-02T10:21:00Z','window_end_exclusive','2026-11-02T10:24:00Z',
 'versions',(select jsonb_build_object('count',count(*),'truncated',count(*)>100,'rows',coalesce(jsonb_agg(to_jsonb(versions)order by created_at,id),'[]'))from versions),
 'jobs',(select jsonb_build_object('count',count(*),'truncated',count(*)>100,'rows',coalesce(jsonb_agg(to_jsonb(jobs)order by created_at,id),'[]'))from jobs),
 'workspaces',(select jsonb_agg(jsonb_build_object('label',s.label,'id',w.id,'row_version',w.row_version,'draft_revision',w.draft_revision,'updated_at',w.updated_at,'roles',(select count(*)from eps.roles x where x.workspace_id=w.id),'slots',(select count(*)from eps.slots x where x.workspace_id=w.id),'assignments',(select count(*)from eps.assignments x where x.workspace_id=w.id),'pool_rows',(select count(*)from eps.workspace_candidates x where x.workspace_id=w.id),'series',(select count(*)from eps.presentation_series x where x.workspace_id=w.id),'versions',(select count(*)from eps.presentation_versions x where x.workspace_id=w.id),'slides',(select count(*)from eps.version_slides x join eps.presentation_versions v on v.id=x.version_id where v.workspace_id=w.id),'asset_pins',(select count(*)from eps.presentation_version_assets x join eps.presentation_versions v on v.id=x.version_id where v.workspace_id=w.id))order by s.label)from scope s join eps.workspaces w on w.id=s.id),
 'series',(select jsonb_agg(jsonb_build_object('id',s.id,'row_version',s.row_version,'latest_ready_version_id',s.latest_ready_version_id,'next_version_number',s.next_version_number,'versions',(select count(*)from eps.presentation_versions v where v.series_id=s.id))order by s.id)from eps.presentation_series s where s.id in('93fb7425-7311-4b69-94cb-61588724c153'::uuid,'dcf357b7-0249-42d2-9513-35e9a83ced65'::uuid)),
 'configured_timeouts',(select coalesce(jsonb_agg(to_jsonb(s)order by source,role_name,database_scope,name),'[]')from safe_settings s),
 'reader_session_settings',jsonb_build_object('statement_timeout',current_setting('statement_timeout'),'lock_timeout',current_setting('lock_timeout'),'is_PostgREST_request',false),
 'function_metadata',(select coalesce(jsonb_agg(to_jsonb(f)order by name,arguments),'[]')from functions f),
 'activity',(select coalesce(jsonb_agg(to_jsonb(a)order by state,backend_type,wait_event_type,wait_event),'[]')from activity_groups a),
 'relevant_relation_locks',(select coalesce(jsonb_agg(to_jsonb(l)order by relation,mode,granted),'[]')from relation_locks l),
 'relevant_relation_lock_waiters',(select count(*)from pg_locks l join relations r on r.oid=l.relation where not l.granted and l.pid is distinct from pg_backend_pid())
)as cancellation_metadata;
rollback;
