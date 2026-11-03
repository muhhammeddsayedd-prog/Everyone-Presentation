"""One bounded, RLS-constrained assignment data enumeration; source only."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ENTRY_ENABLED = False
BASE_BUILD_SHA = 'cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd'
BASE_BODY_SHA = '4b37255bd919719086175f5df2b197584555f3c08000ee13fe18a7dbe62f8cc3'
DECLARATION = 'reuse_bytes bigint:=0;reuse_cost bigint;reuse_key text;reuse_pos integer;reuse_found boolean;'
EXTRA = """
 assignment_rows eps.assignments[]:='{}';assignment_row eps.assignments;
 assignment_rows_loaded boolean:=false;assignment_rows_complete boolean:=false;
 assignment_rows_start_bytes bigint;slot_has_main boolean;"""
PREDICATE = "workspace_id=p_workspace and slot_id=slot_item.id and archived_at is null and(series.output_type='selection'or shortlist_included)"
OLD_LOOP = 'for assignment in select * from eps.assignments where ' + PREDICATE + 'order by sort_order,id loop'
OLD_MAIN = "not exists(select 1 from eps.assignments where slot_id=slot_item.id and archived_at is null and position='main'and(series.output_type='selection'or shortlist_included))"
LOAD = """if not assignment_rows_loaded then
    assignment_rows_loaded:=true;assignment_rows_complete:=true;
    assignment_rows_start_bytes:=reuse_bytes;
    -- Rows only, read under the original invoker RLS and STABLE snapshot.
    for assignment_row in select * from eps.assignments where workspace_id=p_workspace and archived_at is null and(series.output_type='selection'or shortlist_included)order by slot_id,sort_order,id loop
     reuse_cost:=pg_column_size(assignment_row)::bigint+octet_length(assignment_row::text)::bigint+octet_length(assignment_row.id::text)+256;
     if reuse_bytes+reuse_cost>4194304 then
      -- A partial collection can never stand for a complete enumeration.
      assignment_rows:='{}'::eps.assignments[];reuse_bytes:=assignment_rows_start_bytes;
      assignment_rows_complete:=false;exit;
     end if;
     assignment_rows:=array_append(assignment_rows,assignment_row);reuse_bytes:=reuse_bytes+reuse_cost;
    end loop;
   end if;
   """
NEW_LOOP = """for assignment in
    select cached.* from unnest(assignment_rows)cached where assignment_rows_complete and cached.workspace_id=p_workspace and cached.slot_id=slot_item.id and cached.archived_at is null and(series.output_type='selection'or cached.shortlist_included)
    union all
    select * from eps.assignments where not assignment_rows_complete and """ + PREDICATE + 'order by sort_order,id loop'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ASSIGNMENT_ENUMERATION_SOURCE_UNCONFIRMED')


def edits():
    return [
        (DECLARATION, DECLARATION + EXTRA),
        ('slot_assignments:=0;', 'slot_assignments:=0;slot_has_main:=false;'),
        (OLD_LOOP, LOAD + NEW_LOOP),
        ('slot_assignments:=slot_assignments+1;candidate_count:=candidate_count+1;',
         "slot_assignments:=slot_assignments+1;candidate_count:=candidate_count+1;\n    if assignment.position='main'then slot_has_main:=true;end if;"),
        (OLD_MAIN, 'not slot_has_main '),
    ]


def patch_body(body):
    need(sha(body.encode()) == BASE_BODY_SHA)
    for before, after in edits():
        need(body.count(before) == 1)
        body = body.replace(before, after, 1)
    return body


def unpatch_body(body):
    for before, after in reversed(edits()):
        need(body.count(after) == 1)
        body = body.replace(after, before, 1)
    need(sha(body.encode()) == BASE_BODY_SHA)
    return body


def build():
    file = HERE.parent / 'presentation-generation-data-reuse/build.py'
    need(sha(file.read_bytes()) == BASE_BUILD_SHA)
    spec = importlib.util.spec_from_file_location('assignment_reuse_frozen_four', file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    rows = module.build()
    before = next(x['after'] for x in rows if x['name'] == 'eps.review_snapshot_data')
    match = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', before, re.S)
    need(match is not None)
    body = patch_body(match[2])
    after = before[:match.start(2)] + body + before[match.end(2):]
    need(unpatch_body(body) == match[2])
    return {
        'name': 'eps.review_snapshot_data',
        'before': before, 'after': after,
        'before_body_sha256': BASE_BODY_SHA,
        'after_body_sha256': sha(body.encode()),
        'inverse_byte_equal': True,
        'finite_edit_count': len(edits()),
        'existing_shared_row_data_budget_bytes': 4194304,
        'required_actual_FK': {
            'name': 'assignments_workspace_id_slot_id_fkey',
            'convalidated': True, 'condeferrable': False, 'condeferred': False,
        },
        'other_three_candidate_bodies': {
            x['name']: x['after_body_sha256'] for x in rows if x['name'] != 'eps.review_snapshot_data'
        },
    }


if __name__ == '__main__':
    if not ENTRY_ENABLED:
        raise SystemExit('ASSIGNMENT_ENUMERATION_ASSEMBLY_DISABLED')
    print(json.dumps({key: value for key, value in build().items() if key not in ['before', 'after']}))
