"""Source-only helper candidate. No database, process or provider transport."""
from pathlib import Path
import hashlib
import importlib.util

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / 'presentation-lock-source-pool-reuse/candidate.py'
PRIOR_SHA = 'c646bc4f62b3c98f836398edf19ff2d66e49c9ef851f62cdce7c6e54063a2a5d'
BEFORE_BODY_SHA = '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4'
AFTER_BODY_SHA = 'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3'
ENTRY_ENABLED = False

PROJECT_OLD = '  perform 1 from public.projects p where p.id=project_id for share nowait;select p.client_id into client_id from public.projects p where p.id=project_id;'
PROJECT_NEW = '  select p.client_id into client_id from public.projects p where p.id=project_id for share nowait;'

ASSIGNMENT_OLD = '  perform 1 from eps.assignments where workspace_id=p_workspace and archived_at is null order by id for share nowait;'
ASSIGNMENT_NEW = """  select coalesce(array_agg(distinct locked.workspace_candidate_id order by locked.workspace_candidate_id),'{}'::uuid[])into v_pool_ids
   from(
    select a.workspace_candidate_id from eps.assignments a
    where a.workspace_id=p_workspace and a.archived_at is null order by a.id for share nowait
   )locked;"""

POOL_OLD = """  -- Keep the original pool-lock scope, including archived pools still referenced
  -- by active assignments. Capture mutable selected IDs only after pool locks.
  select coalesce(array_agg(p.id order by p.id),'{}'::uuid[])into v_pool_ids
   from eps.workspace_candidates p where p.workspace_id=p_workspace
   and exists(select 1 from eps.assignments a where a.workspace_candidate_id=p.id and a.archived_at is null);
  perform 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and p.id=any(v_pool_ids)order by p.id for share nowait;
  with selected as materialized(
   select distinct p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids
   from eps.workspace_candidates p
   where p.workspace_id=p_workspace and p.id=any(v_pool_ids)
  ),frames as materialized(
   select s.selected_candidate_media_id media_id,f.asset_id
   from selected s cross join lateral unnest(s.selected_frame_asset_ids)f(asset_id)
  ),pairs as materialized(
   select distinct media_id,asset_id from frames where media_id is not null and asset_id is not null
  )
  select
   (select coalesce(array_agg(distinct candidate_id order by candidate_id),'{}'::uuid[])from selected where candidate_id is not null),
   (select coalesce(array_agg(distinct selected_candidate_media_id order by selected_candidate_media_id),'{}'::uuid[])from selected where selected_candidate_media_id is not null),
   (select coalesce(array_agg(distinct asset_id order by asset_id),'{}'::uuid[])from frames where asset_id is not null),
   (select coalesce(array_agg(media_id order by media_id,asset_id),'{}'::uuid[])from pairs),
   (select coalesce(array_agg(asset_id order by media_id,asset_id),'{}'::uuid[])from pairs)
  into v_candidate_ids,v_media_ids,v_frame_asset_ids,v_pair_media_ids,v_pair_asset_ids;"""
POOL_NEW = """  -- Keep archived pools referenced by active assignments. Every ordered lock
  -- stream is consumed fully before the next source table is locked.
  with selected as materialized(
   select distinct locked.id,locked.candidate_id,locked.selected_candidate_media_id,locked.selected_frame_asset_ids
   from(
    select p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids
    from eps.workspace_candidates p
    where p.workspace_id=p_workspace and p.id=any(v_pool_ids)order by p.id for share nowait
   )locked
  ),frames as materialized(
   select s.selected_candidate_media_id media_id,f.asset_id
   from selected s cross join lateral unnest(s.selected_frame_asset_ids)f(asset_id)
  ),pairs as materialized(
   select distinct media_id,asset_id from frames where media_id is not null and asset_id is not null
  )
  select
   (select coalesce(array_agg(id order by id),'{}'::uuid[])from selected),
   (select coalesce(array_agg(distinct candidate_id order by candidate_id),'{}'::uuid[])from selected where candidate_id is not null),
   (select coalesce(array_agg(distinct selected_candidate_media_id order by selected_candidate_media_id),'{}'::uuid[])from selected where selected_candidate_media_id is not null),
   (select coalesce(array_agg(distinct asset_id order by asset_id),'{}'::uuid[])from frames where asset_id is not null),
   (select coalesce(array_agg(media_id order by media_id,asset_id),'{}'::uuid[])from pairs),
   (select coalesce(array_agg(asset_id order by media_id,asset_id),'{}'::uuid[])from pairs)
  into v_pool_ids,v_candidate_ids,v_media_ids,v_frame_asset_ids,v_pair_media_ids,v_pair_asset_ids;"""

MEDIA_OLD = """  perform 1 from eps.candidate_media m where m.id=any(v_media_ids)order by m.id for share nowait;
  -- Source IDs are read after the media locks, at the same stage as the old
  -- asset query. Keep frame IDs even when no media/frame link is available.
  select coalesce(array_agg(distinct wanted.asset_id order by wanted.asset_id),'{}'::uuid[])into v_asset_ids
   from(select w.logo_asset_id asset_id from eps.workspaces w where w.id=p_workspace
    union all select m.source_asset_id from eps.candidate_media m where m.id=any(v_media_ids)
    union all select unnest(v_frame_asset_ids))wanted where wanted.asset_id is not null;"""
MEDIA_NEW = """  select coalesce(array_agg(distinct locked.source_asset_id order by locked.source_asset_id),'{}'::uuid[])into v_asset_ids
   from(
    select m.source_asset_id from eps.candidate_media m
    where m.id=any(v_media_ids)order by m.id for share nowait
   )locked;
  -- Reuse source IDs returned by the fully consumed media lock acquisition.
  -- Keep frame IDs even when no media/frame link is available.
  select coalesce(array_agg(distinct wanted.asset_id order by wanted.asset_id),'{}'::uuid[])into v_asset_ids
   from(select w.logo_asset_id asset_id from eps.workspaces w where w.id=p_workspace
    union all select unnest(v_asset_ids)
    union all select unnest(v_frame_asset_ids))wanted where wanted.asset_id is not null;"""

PATCHES = (
    ('project_client', PROJECT_OLD, PROJECT_NEW),
    ('assignment_pool_ids', ASSIGNMENT_OLD, ASSIGNMENT_NEW),
    ('locked_pool_selection', POOL_OLD, POOL_NEW),
    ('locked_media_sources', MEDIA_OLD, MEDIA_NEW),
)


def need(ok):
    if not ok:
        raise ValueError('LOCK_ACQUISITION_REUSE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def body(definition):
    return definition.split('as $$', 1)[1].rsplit('$$;', 1)[0]


def baseline():
    need(PRIOR.is_file() and not PRIOR.is_symlink() and PRIOR.stat().st_nlink == 1)
    need(sha(PRIOR.read_bytes()) == PRIOR_SHA)
    spec = importlib.util.spec_from_file_location('pinned_lock280_source', PRIOR)
    prior = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prior)
    _, value = prior.build()
    need(sha(body(value).encode()) == BEFORE_BODY_SHA)
    return value


def patch_body(value):
    need(sha(value.encode()) == BEFORE_BODY_SHA)
    result = value
    for _, old, new in PATCHES:
        need(result.count(old) == 1 and result.count(new) == 0)
        result = result.replace(old, new)
    need(sha(result.encode()) == AFTER_BODY_SHA)
    need(unpatch_body(result) == value)
    return result


def unpatch_body(value):
    need(sha(value.encode()) == AFTER_BODY_SHA)
    result = value
    for _, old, new in reversed(PATCHES):
        need(result.count(new) == 1)
        result = result.replace(new, old)
    need(sha(result.encode()) == BEFORE_BODY_SHA)
    return result


def build():
    before = baseline()
    original = body(before)
    after = before.replace(original, patch_body(original))
    need(before.count(original) == 1)
    need(after.replace(body(after), unpatch_body(body(after))) == before)
    return before, after


if __name__ == '__main__':
    need(ENTRY_ENABLED)
