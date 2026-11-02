"""Finite complete-PK partitions of two original predicates; no transport."""
from pathlib import Path
import hashlib
import importlib.util

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'presentation-lock-source-pool-proof/oracle.py'
OLD_SHA = '18f1cd7291a75c5dd5c51a1f48606684887a0e1888c2476d8997c523d27c2e8b'
COHORT = HERE.parent / 'presentation-lock-source-proof/cohorts.sql'
COHORT_SHA = '06d12e3c2b2ca36deb7831579a7ef55ec183cdd77b9e66515b18c3b0bbc953ef'
CHUNK_SIZE = 16
HEAVY = ('eps.media_assets', 'eps.candidate_media_frames')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def originals():
    if sha(OLD.read_bytes()) != OLD_SHA or sha(COHORT.read_bytes()) != COHORT_SHA:
        raise ValueError('ORACLE_PARTITION_SOURCE_UNCONFIRMED')
    spec = importlib.util.spec_from_file_location('oracle_partition_frozen_builder', OLD)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, statements = module.build()
    return statements


def sliced(statement, relation):
    alias = 'm' if relation == HEAVY[0] else 'f'
    anchor = f'from(select {alias}.id from {relation} {alias} where ' if alias == 'm' else 'from(select f.candidate_media_id,f.asset_id from eps.candidate_media_frames f where '
    end = 'order by m.id)q;' if alias == 'm' else 'order by f.candidate_media_id,f.asset_id)q;'
    if statement.count(anchor) != 1 or not statement.endswith(end):
        raise ValueError('ORACLE_PARTITION_PREDICATE_UNCONFIRMED')
    before, predicate = statement.split(anchor)
    predicate = predicate[:-len(end)]
    guard = "m.id in(select(k->>'id')::uuid from jsonb_array_elements(p_keys)k)" if alias == 'm' else "(f.candidate_media_id,f.asset_id)in(select(k->>'candidate_media_id')::uuid,(k->>'asset_id')::uuid from jsonb_array_elements(p_keys)k)"
    result = before + anchor + '(' + predicate + ') and ' + guard + ' ' + end
    inverse = result.replace('(' + predicate + ') and ' + guard + ' ', predicate, 1)
    if inverse != statement:
        raise ValueError('ORACLE_PARTITION_INVERSE_UNCONFIRMED')
    return result


def build():
    statements = originals()
    old = dict(statements)
    raw = COHORT.read_text(encoding='utf8').replace('\r\n', '\n')
    prefix = raw.split('as $$\n', 1)[1].split(' -- cohort:', 1)[0].replace("v_result jsonb:='[]';", '')
    # No grants, durable schema, DML, auth cache or candidate-derived universe.
    identity = """create function pg_temp.pool_oracle41_identity()returns jsonb
language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('pid',pg_backend_pid(),'snapshot',pg_current_snapshot()::text,
  'role',current_user,'isolation',current_setting('transaction_isolation'),
  'read_only',current_setting('transaction_read_only'),'statement_timeout',current_setting('statement_timeout'),'lock_timeout',current_setting('lock_timeout'));
$$;
"""
    universe = """create function pg_temp.pool_oracle41_universe()returns jsonb
language plpgsql stable security invoker set search_path=''as $$
declare v_assets jsonb;v_frames jsonb;
begin
 if current_user<>'postgres' or current_setting('transaction_isolation')<>'repeatable read'
  or current_setting('transaction_read_only')<>'on' or current_setting('statement_timeout')<>'8s'
  or current_setting('lock_timeout')<>'8s' then raise exception'ORACLE_PARTITION_TRUSTED_SNAPSHOT_REQUIRED'using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id)order by m.id),'[]')into v_assets from eps.media_assets m;
 select coalesce(jsonb_agg(jsonb_build_object('candidate_media_id',f.candidate_media_id,'asset_id',f.asset_id)order by f.candidate_media_id,f.asset_id),'[]')into v_frames from eps.candidate_media_frames f;
 return jsonb_build_object('identity',pg_temp.pool_oracle41_identity(),'universes',jsonb_build_object('eps.media_assets',v_assets,'eps.candidate_media_frames',v_frames));
end$$;
"""
    shape = """ if current_user<>'eps_review_owner' or current_setting('transaction_isolation')<>'repeatable read'
  or current_setting('transaction_read_only')<>'on' or current_setting('statement_timeout')<>'8s'
  or current_setting('lock_timeout')<>'8s' then raise exception'ORACLE_PARTITION_ACTOR_SNAPSHOT_REQUIRED'using errcode='22023';end if;
 if p_relation not in('eps.media_assets','eps.candidate_media_frames')or jsonb_typeof(p_keys)is distinct from'array'
  or jsonb_array_length(p_keys)not between 1 and 16 then raise exception'ORACLE_PARTITION_KEYS_REQUIRED'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_keys)k where jsonb_typeof(k)is distinct from'object'
  or(select array_agg(name order by name)from jsonb_object_keys(k)name)is distinct from
   case when p_relation='eps.media_assets'then array['id']else array['asset_id','candidate_media_id']end)
 then raise exception'ORACLE_PARTITION_KEY_SHAPE_REQUIRED'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_keys)k cross join lateral jsonb_each(k)e where jsonb_typeof(e.value)is distinct from'string'
  or(e.value#>>'{}')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')then raise exception'ORACLE_PARTITION_UUID_REQUIRED'using errcode='22023';end if;
"""
    # The original scope prelude and each whole WHERE expression survive exactly.
    body = "create function pg_temp.pool_oracle41_slice(p_relation text,p_workspace uuid,p_series uuid,p_keys jsonb)returns jsonb\nlanguage plpgsql stable security invoker set search_path=''as $$\n" + prefix
    body = body.replace('begin\n', 'begin\n' + shape, 1) + ' case p_relation\n'
    transformed = {}
    for relation in HEAVY:
        transformed[relation] = sliced(old[relation], relation)
        body += " when '" + relation + "'then\n" + transformed[relation] + '\n'
    body += " else raise exception'ORACLE_PARTITION_CLOSED_RELATION_REQUIRED'using errcode='22023';\n end case;return jsonb_build_object('keys',v_keys,'identity',pg_temp.pool_oracle41_identity());\nend$$;\n"
    sql = identity + universe + body
    return sql, {'frozen_oracle_sha256': OLD_SHA, 'original_cohorts_sha256': COHORT_SHA,
                 'chunk_size': CHUNK_SIZE, 'complete_global_primary_key_universe': True,
                 'same_snapshot_same_connection_required': True,
                 'unchanged_other_ten_statements': {k: sha(v.encode()) for k, v in statements if k not in HEAVY},
                 'original_predicate_statement_sha256': {k: sha(old[k].encode()) for k in HEAVY},
                 'slice_statement_sha256': {k: sha(v.encode()) for k, v in transformed.items()},
                 'sql_sha256': sha(sql.encode())}
