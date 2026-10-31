-- M07 additive workspace summary. No data/backfill/configuration or OAuth changes.
-- STABLE uses one caller statement snapshot for gates, revisions and all counts.
set local search_path = '';
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $$begin
 if current_user <> 'postgres'
 or current_database() <> 'postgres'
 or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array[
  '20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320',
  '20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600',
  '20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218',
  '20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000',
  '20261031104603','20261031130207','20261031143711']::text[]
 or to_regprocedure('public.eps_get_workspace_summary(uuid)') is not null
 or not exists(select 1 from pg_roles where rolname='eps_review_owner' and not rolcanlogin and not rolsuper and not rolbypassrls)
 or has_schema_privilege('eps_review_owner', 'public', 'CREATE')
 then raise exception 'M07_SUMMARY_EXACT_REVIEWED34_REQUIRED'; end if;
end$$;

create function public.eps_get_workspace_summary(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
 workspace eps.workspaces;
 pool_count bigint;
 joined_pool_count bigint;
 unreviewed_count bigint := null;
 ready_count bigint;
 invalid_pointer boolean;
 ready_versions jsonb;
 result jsonb;
begin
 perform eps.require_capability('workspaces.read');
 perform eps.review_require(p_workspace_id, false);
 select * into workspace from eps.workspaces where id=p_workspace_id and archived_at is null;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND', 'Workspace not found.', 404); end if;

 select count(*) into pool_count from eps.workspace_candidates
 where workspace_id=p_workspace_id and archived_at is null;
 -- Never query protected library rows in the capability-absent branch.
 if eps.has_capability('cast.read') then
  select count(c.id), count(*) filter(where not eps.cast_is_reviewed(c))
  into joined_pool_count, unreviewed_count
  from eps.workspace_candidates p left join eps.candidates c on c.id=p.candidate_id
  where p.workspace_id=p_workspace_id and p.archived_at is null;
  if joined_pool_count <> pool_count then
   perform eps.fail('WORKSPACE_SUMMARY_INVALID', 'Canonical participation is inconsistent.', 503);
  end if;
 end if;

 -- Validate every active pointer before projecting. Audiences remain separate.
 select count(*) filter(where s.latest_ready_version_id is not null),
  coalesce(bool_or((s.latest_ready_version_id is null) <> (s.latest_ready_version_no is null)
   or (s.latest_ready_version_id is not null and (v.id is null or v.status <> 'ready'
    or v.series_id <> s.id or v.workspace_id <> p_workspace_id
    or v.version_number is distinct from s.latest_ready_version_no))), false)
 into ready_count, invalid_pointer
 from eps.presentation_series s left join eps.presentation_versions v on v.id=s.latest_ready_version_id
 where s.workspace_id=p_workspace_id and not s.archived;
 if invalid_pointer then perform eps.fail('WORKSPACE_SUMMARY_INVALID', 'Ready version metadata is inconsistent.', 503); end if;
 if ready_count > 1000 then perform eps.fail('WORKSPACE_SUMMARY_LIMIT_EXCEEDED', 'Workspace summary series budget exceeded.', 503); end if;
 select coalesce(jsonb_agg(jsonb_build_object('series_id', s.id, 'output_type', s.output_type,
  'version_no', s.latest_ready_version_no) order by s.id), '[]'::jsonb)
 into ready_versions from eps.presentation_series s
 where s.workspace_id=p_workspace_id and not s.archived and s.latest_ready_version_id is not null;

 with active_roles as materialized (
  select r.id, r.headcount, r.clarifications from eps.roles r
  where r.workspace_id=p_workspace_id and r.archived_at is null
 ), active_slots as materialized (
  select s.id from eps.slots s join active_roles r on r.id=s.role_id
  where s.workspace_id=p_workspace_id and s.archived_at is null
 ), active_assignments as materialized (
  select a.id, a.slot_id, a.shortlist_included from eps.assignments a
  join active_slots s on s.id=a.slot_id
  where a.workspace_id=p_workspace_id and a.archived_at is null
 )
 select jsonb_build_object(
  'workspace_id', workspace.id, 'row_version', workspace.row_version, 'draft_revision', workspace.draft_revision,
  'roles_needing_clarification', (select count(*) from active_roles r where r.headcount is null or exists(
   select 1 from jsonb_array_elements(r.clarifications) marker where marker->'resolved'='false'::jsonb)),
  'project_candidate_count', pool_count, 'unreviewed_candidate_count', unreviewed_count,
  'open_slot_count', (select count(*) from active_slots s where not exists(select 1 from active_assignments a where a.slot_id=s.id)),
  'assignment_count', jsonb_build_object('selection', (select count(*) from active_assignments),
   'shortlist', (select count(*) from active_assignments where shortlist_included)),
  'latest_ready_versions', ready_versions, 'review_issue_count', null)
 into result;
 if workspace.row_version > 9007199254740991 or workspace.draft_revision > 9007199254740991
 or octet_length(result::text) > 262144 then
  perform eps.fail('WORKSPACE_SUMMARY_LIMIT_EXCEEDED', 'Workspace summary response budget exceeded.', 503);
 end if;
 return result;
end$$;

-- Reuse the existing narrow, non-bypass owner and its read RLS. No new policy.
-- Admission rejects preexisting CREATE so this temporary grant cannot remove it.
grant execute on function eps.cast_is_reviewed(eps.candidates) to eps_review_owner;
grant create on schema public to eps_review_owner;
alter function public.eps_get_workspace_summary(uuid) owner to eps_review_owner;
revoke create on schema public from eps_review_owner;
revoke all on function public.eps_get_workspace_summary(uuid) from public, anon, authenticated, service_role;
grant execute on function public.eps_get_workspace_summary(uuid) to authenticated;
notify pgrst, 'reload schema';
