"""Canonical release of m14 (cast archive photo read path). Importing is inert.

  preflight  read-only: m09-m12 in history, m14 absent, its two functions and policy absent
  apply      ONE transaction: the same history assertion, the migration (its own guards and readback), the history row
  readback   read-only, run twice after apply: m14 in history, both functions owned by eps_cast_owner (security
             definer, authenticated only), the policy present; the two readbacks are equal

Additive and read-only for business data: no row, table, existing function or existing policy changes. It does not
depend on m13 and is numbered before it, so either may be released first. Uses the private CLI login
(`supabase db query --linked`) as the earlier canonical releases do; no secret is read, printed or stored.
Evidence (no business rows) is written to tracking/evidence/m14/cast-photo-release/.
Validate first on the disposable replica: python -X utf8 development/cast-photos/staging/build_staging_m14.py
"""
import datetime
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'development/editorial-template/release'))
import release as m08  # noqa: E402

VERSION = '20261112190000'
NAME = 'm14_candidate_photo_read'
MIGRATION = ROOT / 'supabase/migrations/20261112190000_m14_candidate_photo_read.sql'
EVIDENCE = ROOT / 'tracking/evidence/m14/cast-photo-release'
REQUIRED = ['20261109120000', '20261111120000', '20261112120000', '20261112180000']
FUNCTIONS = ['public.eps_get_candidate_photo_asset(uuid)', 'public.eps_list_candidate_photos(uuid)']
lit = m08.literal
STATE = ("select jsonb_build_object('database',current_database(),'operator',current_user,"
         "'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),"
         "'functions',(select coalesce(jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('owner',pg_get_userbyid(p.proowner),'secdef',p.prosecdef,'acl',p.proacl::text,"
         "'sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))),'{}'::jsonb)from pg_proc p where p.oid::regprocedure::text=any(array[" + ','.join(map(lit, FUNCTIONS)) + "])),"
         "'policy',(select to_jsonb(p)from pg_policies p where schemaname='eps' and tablename='media_assets' and policyname='cast_photo_assets_read'),"
         "'photo_tables',(select jsonb_agg(c.oid::regclass::text order by 1)from pg_class c where c.oid in(to_regclass('eps.candidate_photos'),to_regclass('eps.candidate_attributes'))))")


def read_state(label):
    data, sql_hash = m08.query(f"begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='30s';\n{STATE} as state;\nrollback;\n", label)
    row = data[0] if isinstance(data, list) else data['rows'][0]
    state = row['state']
    return (json.loads(state) if isinstance(state, str) else state), sql_hash


def record(action, payload):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc)
    body = {'schema_version': 'eps-m14-cast-photo-release.v1', 'action': action, 'recorded_at': stamp.isoformat(), 'target': m08.TARGET,
            'version': VERSION, 'migration_sha256': hashlib.sha256(MIGRATION.read_bytes()).hexdigest(), **payload}
    path = EVIDENCE / f"{stamp.strftime('%Y-%m-%dT%H-%M-%S')}Z-{action}.json"
    path.write_text(json.dumps(body, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    return path


def preflight():
    state, sql_hash = read_state('m14-preflight')
    history = state['history'] or []
    ok = (state['operator'] == 'postgres' and all(v in history for v in REQUIRED) and VERSION not in history and state['functions'] == {}
          and state['policy'] is None and state['photo_tables'] == ['eps.candidate_attributes', 'eps.candidate_photos'])
    return state, ok, sql_hash


def apply():
    before, ok, _ = preflight()
    if not ok:
        raise RuntimeError('preflight refused: ' + json.dumps(before)[:600])
    marker = m08.uuid.uuid4().hex
    sql = ("begin;\nset local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';\n"
           "do $m14_release$begin if(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array["
           + ','.join(map(lit, before['history'])) + "]::text[] then raise exception'M14_RELEASE_HISTORY_CHANGED';end if;end$m14_release$;\n"
           + MIGRATION.read_text(encoding='utf-8')
           + f"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values({lit(VERSION)},array[]::text[],{lit(NAME)});\n"
           + f"commit;\nselect jsonb_build_object('version',{lit(VERSION)},'marker',{lit(marker)})as m14_release;\n")
    data, sql_hash = m08.query(sql, 'm14-apply')
    return before, marker, sql_hash, marker in json.dumps(data)


def main(argv):
    action = argv[0] if argv else ''
    if action == 'preflight':
        state, ok, sql_hash = preflight()
        print(json.dumps({'result': 'passed' if ok else 'refused', 'receipt': str(record('preflight', {'passed': ok, 'state': state, 'sql_sha256': sql_hash}))}))
    elif action == 'apply':
        before, marker, sql_hash, returned = apply()
        print(json.dumps({'result': 'applied' if returned else 'unconfirmed', 'receipt': str(record('apply', {'before': before, 'marker': marker, 'apply_sql_sha256': sql_hash, 'commit_marker_returned': returned}))}))
    elif action == 'readback':
        first, _ = read_state('m14-readback-a')
        second, _ = read_state('m14-readback-b')
        functions = first['functions']
        ok = (first == second and VERSION in first['history'] and sorted(functions) == FUNCTIONS
              and all(f['owner'] == 'eps_cast_owner' and f['secdef'] and 'authenticated=X' in (f['acl'] or '') and 'anon=' not in (f['acl'] or '') for f in functions.values())
              and first['policy'] is not None and first['policy']['roles'] in (['eps_cast_owner'], '{eps_cast_owner}') and first['policy']['cmd'] == 'SELECT')
        print(json.dumps({'result': 'passed' if ok else 'failed', 'receipt': str(record('readback', {'passed': ok, 'equal_readbacks': first == second, 'state': first}))}))
    else:
        raise SystemExit('usage: release_m14.py preflight|apply|readback')


if __name__ == '__main__':
    main(sys.argv[1:])
