"""Default-off source-only candidate. No SQL client, actor, provider or runner."""
from pathlib import Path
import hashlib,json,re
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
ENTRY_ENABLED=False
BASE=ROOT/'supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql'
BASE_SHA='09d78c225ca02d436a8b1c2bcc6e55f273dfea116976807af4a8b228b99de5f4'
ACTUAL_SOURCE_SHA='4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7'
def need(ok):
 if not ok:raise ValueError('PRESENTATION_LOCK_CANDIDATE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def body(definition):return definition.split('as $$',1)[1].rsplit('$$;',1)[0]
def source():
 need(BASE.is_file()and not BASE.is_symlink()and BASE.stat().st_nlink==1)
 raw=BASE.read_bytes();need(sha(raw)==BASE_SHA);text=raw.decode().replace('\r\n','\n')
 marker='create function eps.presentation_lock_sources(';need(text.count(marker)==1)
 start=text.index(marker);definition=text[start:text.index('end$$;',start)+len('end$$;')]
 need(sha(body(definition).encode())==ACTUAL_SOURCE_SHA);return definition

COHORT_LOCKS="""  -- Keep the original pool-lock scope, including archived pools still referenced
  -- by active assignments. Capture mutable selected IDs only after pool locks.
  select coalesce(array_agg(p.id order by p.id),'{}'::uuid[])into v_pool_ids
   from eps.workspace_candidates p where p.workspace_id=p_workspace
   and exists(select 1 from eps.assignments a where a.workspace_candidate_id=p.id and a.archived_at is null);
  perform 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and p.id=any(v_pool_ids)order by p.id for share nowait;
  with selected as materialized(
   select distinct p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids
   from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id
   where a.workspace_id=p_workspace and a.archived_at is null
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
  into v_candidate_ids,v_media_ids,v_frame_asset_ids,v_pair_media_ids,v_pair_asset_ids;
  perform 1 from eps.candidates c where c.id=any(v_candidate_ids)order by c.id for share nowait;
  perform 1 from eps.candidate_media m where m.id=any(v_media_ids)order by m.id for share nowait;
  -- Source IDs are read after the media locks, at the same stage as the old
  -- asset query. Keep frame IDs even when no media/frame link is available.
  select coalesce(array_agg(distinct wanted.asset_id order by wanted.asset_id),'{}'::uuid[])into v_asset_ids
   from(select w.logo_asset_id asset_id from eps.workspaces w where w.id=p_workspace
    union all select m.source_asset_id from eps.candidate_media m where m.id=any(v_media_ids)
    union all select unnest(v_frame_asset_ids))wanted where wanted.asset_id is not null;
  perform 1 from eps.media_assets m where m.id=any(v_asset_ids)order by m.id for share nowait;
  -- Use exact media/frame pairs, not the cross product of two selected sets.
  perform 1 from eps.candidate_media_frames f
   where(f.candidate_media_id,f.asset_id)in(select k.media_id,k.asset_id from unnest(v_pair_media_ids,v_pair_asset_ids)k(media_id,asset_id))
   order by f.candidate_media_id,f.asset_id for share nowait;"""

def build():
 before=source();start=before.index('  perform 1 from eps.workspace_candidates p');end=before.index('\n exception when lock_not_available',start)
 after=before[:start]+COHORT_LOCKS+before[end:]
 declaration='declare project_id uuid;client_id uuid;begin'
 need(after.count(declaration)==1)
 after=after.replace(declaration,'declare project_id uuid;client_id uuid;v_pool_ids uuid[];v_candidate_ids uuid[];v_media_ids uuid[];v_frame_asset_ids uuid[];v_pair_media_ids uuid[];v_pair_asset_ids uuid[];v_asset_ids uuid[];begin')
 after=after.replace('create function eps.presentation_lock_sources(','create or replace function eps.presentation_lock_sources(',1)
 locks=lambda value:re.findall(r'perform 1 from ((?:eps|public)\.[a-z_]+)',value)
 need(locks(before)==locks(after)and len(locks(after))==12)
 need(before.count('for share nowait')==after.count('for share nowait')==12)
 need(before.count('eps.presentation_scope(p_workspace,true)')==after.count('eps.presentation_scope(p_workspace,true)')==2)
 return before,after

if __name__=='__main__':
 need(ENTRY_ENABLED)
 before,after=build();print(json.dumps({'before_source_sha256':sha(body(before).encode()),'candidate_source_sha256':sha(body(after).encode()),'source_only':True,'SQL_executed':False}))
