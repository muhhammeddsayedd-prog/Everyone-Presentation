"""Exact source-derived point controls; no SQL client, policy or helper changes."""
from pathlib import Path
import hashlib
import importlib.util

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def load(name, relative, expected):
    file = ROOT / relative
    if sha(file.read_bytes()) != expected:
        raise ValueError('EDGE_RLS_SOURCE_UNCONFIRMED')
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def build():
    old = load('edge_original_helper', 'development/m07/presentation-lock-source-optimization/candidate.py', '0639ade8dd50a6f3bb2c95f1739dd52e633af9a1e66d1cd92910f1bc87acbdb7')
    new = load('edge_pool_helper', 'development/m07/presentation-lock-source-pool-reuse/candidate.py', 'c646bc4f62b3c98f836398edf19ff2d66e49c9ef851f62cdce7c6e54063a2a5d')
    original = old.source()
    before, candidate = new.build()
    start = original.index('  perform 1 from eps.media_assets m where ')
    end = original.index('for share nowait;', start) + len('for share nowait;')
    old_statement = original[start:end]
    predicate = old_statement.split(' where ', 1)[1].rsplit('order by m.id for share nowait;', 1)[0]
    begin = candidate.index('  select coalesce(array_agg(p.id order by p.id)')
    end = candidate.index('  perform 1 from eps.media_assets m where ', begin)
    preparation = candidate[begin:end]
    # The asset-ID assembly/lock block is unchanged by the two-line pool query
    # optimization. Keep the actual post-media-lock stage and all zipped pairs.
    suffix = '  select coalesce(array_agg(distinct wanted.asset_id order by wanted.asset_id)'
    a = before.index(suffix); b = candidate.index(suffix)
    stop = '\n  -- Use exact media/frame pairs'
    asset_before = before[a:before.index(stop, a)]
    asset_after = candidate[b:candidate.index(stop, b)]
    assert asset_before == asset_after
    assert sha(new.body(candidate).encode()) == '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4'
    guard = "if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace not found.',404);end if;"
    footer = "if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace changed.',404);end if;"
    declarations = 'v_id uuid;v_included boolean;v_pool_ids uuid[];v_candidate_ids uuid[];v_media_ids uuid[];v_frame_asset_ids uuid[];v_pair_media_ids uuid[];v_pair_asset_ids uuid[];v_asset_ids uuid[];'
    sql = ''
    for variant in ['old', 'new']:
        pre = '' if variant == 'old' else preparation
        where = '(' + predicate + ')' if variant == 'old' else 'm.id=any(v_asset_ids)'
        inclusion = 'null' if variant == 'old' else 'p_asset=any(v_asset_ids)'
        sql += f"""create function pg_temp.edge41_{variant}(p_workspace uuid,p_asset uuid)returns jsonb
language plpgsql volatile security invoker set search_path=''as $edge$
declare {declarations}begin
 {guard}
{pre}
 v_included:={inclusion};
 select m.id into v_id from eps.media_assets m where ({where})and m.id=p_asset order by m.id for share nowait;
 {footer}
 return jsonb_build_object('found',v_id is not null,'source_ids_include_target',v_included,'role',current_user,'statement_timeout',current_setting('statement_timeout'),'lock_timeout',current_setting('lock_timeout'));
end$edge$;
"""
    return sql, {
        'original4107_asset_statement_sha256': sha(old_statement.encode()),
        'original4107_whole_asset_predicate_sha256': sha(predicate.encode()),
        'candidate280_pre_asset_stage_sha256': sha(preparation.encode()),
        'unchanged1ff_280_asset_assembly_lock_sha256': sha(asset_after.encode()),
        'asset_assembly_lock_byte_equal': True,
        'point_restriction_only_for_original_whole_asset_predicate': True,
        'actual_helper_installed_unchanged': '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4',
        'direct_branch_control_not_full_old_helper_timing': True,
        'same_security_invoker_RLS_and_FOR_SHARE_NOWAIT': True,
        'edge_only_RR_own_DML_no_concurrent_source_or_authority_writer': True,
    }
