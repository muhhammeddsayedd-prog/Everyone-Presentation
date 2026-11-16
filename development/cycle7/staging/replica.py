"""Disposable replica for the cycle-7 migrations (m15-m20).

Builds the cached canonical catalogue (build_staging.py), brings it to the live history
(m08 + fit fix, m09-m12, m13, m14) and then:

  live        stop there and dump the bodies of the functions cycle 7 replaces into
              .local/cycle7/live-functions/ (reference for writing the migrations).
  apply       additionally apply every cycle-7 migration in order, record the catalogue
              diff and run the SQL checks under tests/db/cycle7/*.sql (each file must print
              a final JSON line {"result":"passed",...}).

Run from the repository root:  python -X utf8 development/cycle7/staging/replica.py live|apply
Never point this at a shared or cloud database: it only talks to its own container.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'development/editorial-template/staging'))
sys.path.insert(0, str(ROOT / 'development/cast-photos/staging'))
import build_staging as base  # noqa: E402
import build_staging_1_3 as m13  # noqa: E402
import build_staging_m14 as m14  # noqa: E402

# EPS_REPLICA_CONTAINER lets parallel worktrees use their own disposable container.
base.CONTAINER = os.environ.get('EPS_REPLICA_CONTAINER', base.CONTAINER)

MIGRATIONS = ROOT / 'supabase/migrations'
LIVE = m14.LIVE + ['20261112190000_m14_candidate_photo_read']
CYCLE7 = sorted(p for p in MIGRATIONS.glob('2026111[6-9]*_m*.sql'))
OUT = ROOT / '.local/cycle7'
DUMP = [
    'public.eps_search_candidates', 'public.eps_list_workspace_candidates', 'public.eps_add_workspace_candidate',
    'public.eps_update_workspace_candidate', 'eps.cast_mutate', 'eps.cast_candidate_dto', 'eps.cast_search_match',
    'eps.apply_candidate_scan', 'eps.record_candidate_job_event', 'eps.review_snapshot_data', 'public.eps_generate_version',
    'eps.presentation_validate_result', 'eps.export_validate_result', 'eps.review_validate_fit',
    'public.eps_get_workspace_review', 'public.eps_request_workspace_review_fit', 'public.eps_update_settings',
    'public.eps_get_settings', 'public.eps_create_presentation_series', 'eps.specs_stage_apply', 'eps.editorial_deck_counts_1_3',
    'public.eps_reserve_candidate_upload', 'public.eps_complete_candidate_upload', 'public.eps_get_job', 'public.eps_list_jobs',
    'eps.cast_workspace_candidate_dto', 'public.eps_reorder_workspace', 'public.eps_get_specs', 'public.eps_list_roles',
    'public.eps_create_role', 'public.eps_update_role', 'public.eps_list_slots', 'public.eps_update_slot', 'eps.page_result',
    'public.eps_get_candidate', 'public.eps_list_candidate_photos', 'eps.specs_changed', 'eps.review_fields',
]


def live():
    m13.prepared()
    base.psql(m14.STORAGE_STUB, 'supabase_admin')
    for name in LIVE:
        m14.apply(name, m14.migration(name))


def dump():
    target = OUT / 'live-functions'
    target.mkdir(parents=True, exist_ok=True)
    names = ','.join(base.literal(n) for n in DUMP)
    out = base.psql(
        "select string_agg('-- '||p.oid::regprocedure::text||E'\\n'||pg_get_functiondef(p.oid),E'\\n\\n' order by p.oid::regprocedure::text) "
        f"from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname||'.'||p.proname) in ({names});")
    (target / 'functions.sql').write_text(out, encoding='utf-8')
    tables = base.psql(
        "select string_agg(c.oid::regclass::text||E'\\n'||(select string_agg('  '||a.attname||' '||format_type(a.atttypid,a.atttypmod)||case when a.attnotnull then ' not null' else '' end||coalesce(' default '||pg_get_expr(d.adbin,d.adrelid),''),E'\\n' order by a.attnum) "
        "from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)"
        "||coalesce(E'\\n'||(select string_agg('  # '||conname||' '||pg_get_constraintdef(oid),E'\\n') from pg_constraint where conrelid=c.oid),'')"
        "||coalesce(E'\\n'||(select string_agg('  @ '||pg_get_indexdef(indexrelid),E'\\n') from pg_index where indrelid=c.oid),''),E'\\n\\n' order by 1) "
        "from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps' and c.relkind='r';")
    (target / 'tables.txt').write_text(tables, encoding='utf-8')
    print(json.dumps({'functions': str(target / 'functions.sql'), 'tables': str(target / 'tables.txt')}))


def apply():
    live()
    before = base.catalogue()
    for path in CYCLE7:
        m14.apply(path.stem, path.read_bytes())
    after = base.catalogue()
    added = sorted(k for k in after['functions'] if k not in before['functions'])
    changed = sorted(k for k in before['functions'] if before['functions'][k] != after['functions'].get(k))
    results = {}
    for test in sorted((ROOT / 'tests/db/cycle7').glob('*.sql')):
        out = base.psql(test.read_bytes(), 'supabase_admin', single=False)
        line = [x for x in out.splitlines() if x.startswith('{')][-1]
        results[test.stem] = json.loads(line)
        assert results[test.stem].get('result') == 'passed', (test.stem, results[test.stem])
    report = {'result': 'passed', 'migrations': [p.name for p in CYCLE7], 'added': added, 'changed': changed, 'tests': results}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'replica-report.json').write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: (v if k != 'tests' else list(v)) for k, v in report.items()}))


if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else 'live'
    if command == 'live':
        live()
        dump()
    elif command == 'apply':
        apply()
    else:
        raise SystemExit('usage: replica.py live|apply')
