"""Complete pool-PK partitions of the three original validation queries only."""
from pathlib import Path
import hashlib
import importlib.util
import re

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'presentation-lock-source-pool-proof/measure.sql'
BASE_SHA = 'b6c69370cd22c37cf835452e19b770f6a8ec198c92f164b1a42168e0b666f256'
spec = importlib.util.spec_from_file_location('complete_semantic_oracle', HERE / 'oracle.py')
o = importlib.util.module_from_spec(spec)
spec.loader.exec_module(o)
s = o.s
RELATION = 'eps.workspace_candidates'


def build():
    raw = BASE.read_bytes()
    s.need(hashlib.sha256(raw).hexdigest() == BASE_SHA)
    text = raw.decode().replace('\r\n', '\n')
    capture = text.split('as $ids$\n', 1)[1].split('\n$ids$;', 1)[0]
    marker = 'from eps.workspace_candidates p where '
    s.need(capture.count(marker) == 1)
    capture_predicate = capture.split(marker)[1].strip()
    source = "create function pg_temp.complete41_semantic_slice(p_variant text,p_workspace uuid,p_pool_ids uuid[],p_keys jsonb)returns jsonb language plpgsql stable security invoker set search_path=''as $$\ndeclare p_relation text:='eps.workspace_candidates';v_keys jsonb;begin\n"
    source += o.shape([RELATION], 'off') + o.AUTH + '\ncase p_variant\n'
    source += "when 'capture'then select coalesce(jsonb_agg(jsonb_build_object('id',p.id)order by p.id),'[]')into v_keys from eps.workspace_candidates p where(" + capture_predicate + ')and ' + s.point_guard(RELATION, 'p') + ';\n'
    originals = {}
    for variant, next_marker in [('old', " elsif p_variant='new'then"), ('new', " else raise exception")]:
        start = text.index(" if p_variant='old'then" if variant == 'old' else " elsif p_variant='new'then")
        begin = text.index('\n  select ', start)
        end = text.index(next_marker, begin)
        query = text[begin:end].strip().replace('into answer', 'into v_keys')
        anchor = 'from eps.workspace_candidates p'
        where = query.index('where ', query.index(anchor)) + len('where ')
        tail = query.rfind('\n  )q;')
        s.need(tail > where)
        predicate = query[where:tail]
        changed = query[:where] + '(' + predicate + ')and ' + s.point_guard(RELATION, 'p') + query[tail:]
        s.need(changed.replace('(' + predicate + ')and ' + s.point_guard(RELATION, 'p'), predicate, 1) == query)
        originals[variant] = query
        source += 'when ' + s.literal(variant) + 'then\n' + changed + '\n'
    source += "else raise exception'COMPLETE_SEMANTIC_VARIANT_REQUIRED'using errcode='22023';end case;" + o.FINAL_AUTH + "return jsonb_build_object('keys',v_keys,'identity',pg_temp.complete41_identity());end$$;\n"
    sql = o.IDENTITY + o.universe('complete41_semantic_universe', [RELATION], 'off') + o.live('complete41_semantic_live', 'off') + source
    return sql, {'source_sha256': BASE_SHA, 'capture_whole_predicate_sha256': s.sha(capture_predicate.encode()), 'original_tuple_queries_sha256': {k: s.sha(v.encode()) for k, v in originals.items()}, 'all_pool_PKs_not_candidate_IDs': True, 'chunk_size': 1, 'same_holder_RR_readwrite_after_fixture_DML_only': True, 'claims_unchanged_by_role_switch': True, 'sql_sha256': s.sha(sql.encode())}
