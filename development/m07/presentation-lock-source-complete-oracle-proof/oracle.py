"""All12 whole predicates, single complete-PK partitions, temporary SQL only."""
from pathlib import Path
import importlib.util
import json

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('complete_oracle_spec', HERE / 'spec.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
IDENTITY = """create function pg_temp.complete41_identity()returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('pid',pg_backend_pid(),'snapshot',pg_current_snapshot()::text,'role',current_user,
 'isolation',current_setting('transaction_isolation'),'read_only',current_setting('transaction_read_only'),
 'statement_timeout',current_setting('statement_timeout'),'lock_timeout',current_setting('lock_timeout'),
 'claims_sha256',encode(sha256(convert_to(coalesce(current_setting('request.jwt.claims',true),''),'UTF8')),'hex'));
$$;
"""
AUTH = "if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace not found.',404);end if;"
FINAL_AUTH = "if not eps.presentation_scope(p_workspace,true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable presentation workspace changed.',404);end if;"


def universe(name, relations, readonly):
    code = "create function pg_temp." + name + "()returns jsonb language plpgsql stable security invoker set search_path=''as $$\ndeclare v_result jsonb:='{}';v_keys jsonb;v_rows bigint;begin\n"
    code += "if current_user<>'postgres'or current_setting('transaction_isolation')<>'repeatable read'or current_setting('transaction_read_only')<>" + s.literal(readonly) + "or current_setting('statement_timeout')<>'8s'or current_setting('lock_timeout')<>'8s'then raise exception'COMPLETE_ORACLE_TRUSTED_SNAPSHOT_REQUIRED'using errcode='22023';end if;\n"
    for relation in relations:
        order = ','.join('t.' + f for f in s.FIELDS[relation])
        code += "select coalesce(jsonb_agg(jsonb_build_object(" + s.key_expr(relation, 't') + ")order by " + order + "),'[]'),count(*)into v_keys,v_rows from " + relation + ' t;\n'
        code += "v_result:=v_result||jsonb_build_object(" + s.literal(relation) + ",jsonb_build_object('keys',v_keys,'rows',v_rows,'pk_valid'," + s.pk_guard(relation) + '));\n'
    return code + "return jsonb_build_object('identity',pg_temp.complete41_identity(),'universes',v_result);end$$;\n"


def shape(relations, readonly):
    value = "if current_user<>'eps_review_owner'or current_setting('transaction_isolation')<>'repeatable read'or current_setting('transaction_read_only')<>" + s.literal(readonly) + "or current_setting('statement_timeout')<>'8s'or current_setting('lock_timeout')<>'8s'then raise exception'COMPLETE_ORACLE_ACTOR_SNAPSHOT_REQUIRED'using errcode='22023';end if;\n"
    value += 'if p_relation not in(' + ','.join(s.literal(r) for r in relations) + ")or jsonb_typeof(p_keys)is distinct from'array'or jsonb_array_length(p_keys)<>1 then raise exception'COMPLETE_ORACLE_ONE_KEY_REQUIRED'using errcode='22023';end if;\n"
    value += "if jsonb_typeof(p_keys->0)is distinct from'object'then raise exception'COMPLETE_ORACLE_KEY_OBJECT_REQUIRED'using errcode='22023';end if;\ncase p_relation\n"
    for relation in relations:
        value += 'when ' + s.literal(relation) + "then if(select array_agg(k order by k)from jsonb_object_keys(p_keys->0)k)is distinct from array[" + ','.join(s.literal(f) for f in sorted(s.FIELDS[relation])) + "]then raise exception'COMPLETE_ORACLE_KEY_SHAPE_REQUIRED'using errcode='22023';end if;\n"
    value += 'end case;\n'
    value += "if exists(select 1 from jsonb_each(p_keys->0)e where jsonb_typeof(e.value)is distinct from'string'or(p_relation<>'eps.presentation_templates'and(e.value#>>'{}')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'))then raise exception'COMPLETE_ORACLE_KEY_VALUE_REQUIRED'using errcode='22023';end if;\n"
    return value


def live(name, readonly):
    return "create function pg_temp." + name + "(p_workspace uuid)returns jsonb language plpgsql stable security invoker set search_path=''as $$begin if current_user<>'eps_review_owner'or current_setting('transaction_isolation')<>'repeatable read'or current_setting('transaction_read_only')<>" + s.literal(readonly) + "or current_setting('statement_timeout')<>'8s'or current_setting('lock_timeout')<>'8s'then raise exception'COMPLETE_ORACLE_LIVE_CONTEXT_REQUIRED'using errcode='22023';end if;" + AUTH + "return pg_temp.complete41_identity();end$$;\n"


def build():
    originals = s.originals()
    raw = s.COHORT.read_text(encoding='utf8').replace('\r\n', '\n')
    prefix = raw.split('as $$\n', 1)[1].split(' -- cohort:', 1)[0].replace("v_result jsonb:='[]';", '')
    body = "create function pg_temp.complete41_slice(p_relation text,p_workspace uuid,p_series uuid,p_keys jsonb)returns jsonb language plpgsql stable security invoker set search_path=''as $$\n" + prefix
    body = body.replace('begin\n', 'begin\n' + shape(s.RELATIONS, 'on') + AUTH + '\n', 1) + 'case p_relation\n'
    transformed = {}
    for relation in s.RELATIONS:
        transformed[relation], _ = s.sliced(originals[relation], relation)
        body += 'when ' + s.literal(relation) + 'then\n' + transformed[relation] + '\n'
    body += "end case;" + FINAL_AUTH + "return jsonb_build_object('keys',v_keys,'identity',pg_temp.complete41_identity());end$$;\n"
    sql = IDENTITY + universe('complete41_universe', s.RELATIONS, 'on') + live('complete41_live', 'on') + body
    return sql, {'chunk_size': 1, 'complete_relations': s.RELATIONS, 'key_fields': s.FIELDS, 'key_types': {r: 'text' if r == 'eps.presentation_templates' else 'uuid' for r in s.RELATIONS}, 'original_cohorts_sha256': s.COHORT_SHA, 'original_statement_sha256': {r: s.sha(q.encode()) for r, q in originals.items()}, 'slice_statement_sha256': {r: s.sha(q.encode()) for r, q in transformed.items()}, 'sql_sha256': s.sha(sql.encode()), 'same_snapshot_role_bounds_and_live_authority_required': True}
