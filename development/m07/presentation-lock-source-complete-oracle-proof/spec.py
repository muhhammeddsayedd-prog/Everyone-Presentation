"""Closed complete-PK shapes and exact pinned original predicate inventory."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
COHORT = HERE.parent / 'presentation-lock-source-proof/cohorts.sql'
COHORT_SHA = '06d12e3c2b2ca36deb7831579a7ef55ec183cdd77b9e66515b18c3b0bbc953ef'
OLD = HERE.parent / 'presentation-lock-source-pool-proof/oracle.py'
OLD_SHA = '18f1cd7291a75c5dd5c51a1f48606684887a0e1888c2476d8997c523d27c2e8b'
RELATIONS = ['public.projects', 'public.clients', 'eps.presentation_templates', 'eps.specs', 'eps.roles', 'eps.slots', 'eps.assignments', 'eps.workspace_candidates', 'eps.candidates', 'eps.candidate_media', 'eps.media_assets', 'eps.candidate_media_frames']
FIELDS = {name: ['id'] for name in RELATIONS}
FIELDS['eps.presentation_templates'] = ['key', 'version']
FIELDS['eps.candidate_media_frames'] = ['candidate_media_id', 'asset_id']
ALIASES = {'public.projects': 'p', 'public.clients': 'c', 'eps.presentation_templates': 't', 'eps.workspace_candidates': 'p', 'eps.candidates': 'c', 'eps.candidate_media': 'm', 'eps.media_assets': 'm', 'eps.candidate_media_frames': 'f'}


def need(ok):
    if not ok:
        raise ValueError('COMPLETE_ORACLE_SPEC_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def originals():
    need(sha(OLD.read_bytes()) == OLD_SHA and sha(COHORT.read_bytes()) == COHORT_SHA)
    spec = importlib.util.spec_from_file_location('complete_oracle_frozen', OLD)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, statements = module.build()
    need([k for k, _ in statements] == RELATIONS)
    return dict(statements)


def key_expr(relation, alias):
    return ','.join(literal(field) + ',' + (alias + '.' if alias else '') + field for field in FIELDS[relation])


def pk_guard(relation):
    expected = [{'name': field, 'type': 'text' if relation == 'eps.presentation_templates' else 'uuid', 'not_null': True} for field in sorted(FIELDS[relation])]
    return "exists(select 1 from pg_constraint c join pg_index i on i.indexrelid=c.conindid where c.conrelid=" + literal(relation) + "::regclass and c.contype='p'and c.convalidated and i.indisvalid and i.indisready and(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)order by a.attname)from unnest(c.conkey)k(attnum)join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=" + literal(json.dumps(expected)) + '::jsonb)'


def point_guard(relation, alias):
    columns = [(alias + '.' if alias else '') + f for f in FIELDS[relation]]
    values = ["(p_keys->0->>" + literal(f) + ')' + ('::uuid' if relation != 'eps.presentation_templates' else '') for f in FIELDS[relation]]
    return '(' + ','.join(columns) + ')=(' + ','.join(values) + ')' if len(columns) > 1 else columns[0] + '=' + values[0]


def sliced(statement, relation):
    alias = ALIASES.get(relation, '')
    selection = ','.join((alias + '.' if alias else '') + f for f in FIELDS[relation])
    anchor = 'from(select ' + selection + ' from ' + relation + ((' ' + alias) if alias else '') + ' where '
    need(statement.count(anchor) == 1 and statement.endswith(')q;'))
    prefix, tail = statement.split(anchor)
    # Every original ORDER BY is outside the complete WHERE expression.
    marker = 'order by ' if 'order by ' in tail else ')q;'
    cut = tail.rfind(marker)
    need(cut >= 0)
    predicate, suffix = tail[:cut], tail[cut:]
    result = prefix + anchor + '(' + predicate + ') and ' + point_guard(relation, alias) + ' ' + suffix
    need(result.replace('(' + predicate + ') and ' + point_guard(relation, alias) + ' ', predicate, 1) == statement)
    return result, predicate
