"""Canonical release of m13 (Everyone Film editorial template 1.3.0). Importing is inert.

  preflight  read-only: m08 and the m08 fit-font fix in history, m13 absent, templates
             1.0.0-1.2.0 only, the eight pinned preimage hashes, 1.3.0 mirror absent
  apply      ONE transaction: the same history assertion, the migration (its own
             target/preimage/needle/readback guards), the history row; commit marker
  readback   read-only, run twice after apply: m13 in history, template 1.3.0 with the
             pinned identity, eight postimage hashes equal to the staging replica report,
             mirror present; saved versions unchanged (version_hash equal to preflight)

Order on canonical: release.py apply-fit + readback-fit (the m08 fit-font fix) first, then
this tool. Uses the existing private CLI login (`supabase db query --linked`), as earlier
canonical releases do. No secret is read, printed or stored. Evidence (no business rows)
is written to tracking/evidence/m13/editorial-release/.
"""
import datetime
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import release as m08  # noqa: E402

ROOT = m08.ROOT
VERSION = '20261113120000'
NAME = 'm13_editorial_template_1_3'
MIGRATION = ROOT / 'supabase/migrations/20261113120000_m13_editorial_template_1_3.sql'
EVIDENCE = ROOT / 'tracking/evidence/m13/editorial-release'
REPORT = ROOT / '.local/editorial-release/staging/staging-report-1.3.0.json'
REQUIRED = ['20261104210000', '20261104230000']
PRE = {
    'eps.export_validate_result(eps.jobs,jsonb)': '612c3097f2d4a7337ae0b35502e79bae82c7af46aac5bee1ac279928d9d53d54',
    'eps.presentation_validate_result(eps.jobs,jsonb)': '0d80168e25763f73d286494e45d58ec578cd39509000f12cc4d787611928c605',
    'eps.review_snapshot_data(uuid,uuid,text)': '9f3b50b8fdfb0c46efb96260d6886d938c861f27d44fd02bfa9e5047684329f4',
    'eps.review_validate_fit(eps.jobs,jsonb)': '91e27a9c641f64243a03fe54969e9f9f634bee62a50e0ff97a9534682d65adf0',
    'public.eps_generate_version(uuid,jsonb,text)': 'b4a91343c6d805309536f75f73766edc0d11d403ee22bfcd858e47a66aa90333',
    'public.eps_get_workspace_review(uuid,uuid,text)': '152511802f304f1e8d20843559d9fb69be70e8228cb00ff972c9ee627bca5fb7',
    'public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)': '4463ab7cf4b8da6422799a35a569b7a297ea3cfdb9edd43752312f05d6e261a2',
    'public.eps_update_settings(jsonb,text)': 'c02d4d82f51e53b6c8759515a04315363f075abcb427a960e3af6cd7889d31b7',
}
lit = m08.literal
STATE = ("select jsonb_build_object('database',current_database(),'operator',current_user,"
         "'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),"
         "'templates',(select jsonb_agg(jsonb_build_object('key',key,'version',version,'registered',registered,'content_sha256',content_sha256,'font_key',font_key)order by key,version)from eps.presentation_templates),"
         "'bodies',(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))from pg_proc p where p.oid::regprocedure::text=any(array[" + ','.join(map(lit, PRE)) + "])),"
         "'mirror',(select jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text)from pg_proc where oid=to_regprocedure('eps.editorial_deck_counts_1_3(jsonb)')),"
         "'default_template',(select template_version from eps.app_settings where singleton),"
         "'version_hash',(select encode(sha256(convert_to(coalesce(string_agg(id::text||':'||snapshot_sha256||':'||status,','order by id),''),'UTF8')),'hex')from eps.presentation_versions))")


def read_state(label):
    data, sql_hash = m08.query(f"begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='30s';\n{STATE} as state;\nrollback;\n", label)
    row = data[0] if isinstance(data, list) else data['rows'][0]
    state = row['state']
    return (json.loads(state) if isinstance(state, str) else state), sql_hash


def record(action, payload):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc)
    body = {'schema_version': 'eps-m13-editorial-release.v1', 'action': action, 'recorded_at': stamp.isoformat(), 'target': m08.TARGET,
            'version': VERSION, 'migration_sha256': hashlib.sha256(MIGRATION.read_bytes()).hexdigest(), **payload}
    path = EVIDENCE / f"{stamp.strftime('%Y-%m-%dT%H-%M-%S')}Z-{action}.json"
    path.write_text(json.dumps(body, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    return path


def preflight():
    state, sql_hash = read_state('m13-preflight')
    history = state['history'] or []
    ok = (state['operator'] == 'postgres' and all(v in history for v in REQUIRED) and not any(v >= VERSION for v in history)
          and state['mirror'] is None and [t['version'] for t in state['templates']] == ['1.0.0', '1.1.0', '1.2.0'] and state['bodies'] == PRE)
    return state, ok, sql_hash


def apply():
    before, ok, _ = preflight()
    if not ok:
        raise RuntimeError('preflight refused: ' + json.dumps(before)[:600])
    marker = m08.uuid.uuid4().hex
    history = before['history']
    sql = ("begin;\nset local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';\n"
           "do $m13_release$begin if(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array["
           + ','.join(map(lit, history)) + "]::text[] then raise exception'M13_RELEASE_HISTORY_CHANGED';end if;end$m13_release$;\n"
           + MIGRATION.read_text(encoding='utf-8')
           + f"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values({lit(VERSION)},array[]::text[],{lit(NAME)});\n"
           + f"commit;\nselect jsonb_build_object('version',{lit(VERSION)},'marker',{lit(marker)})as m13_release;\n")
    data, sql_hash = m08.query(sql, 'm13-apply')
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
        first, _ = read_state('m13-readback-a')
        second, _ = read_state('m13-readback-b')
        report = json.loads(REPORT.read_text(encoding='utf-8'))
        registry = json.loads((ROOT / 'packages/templates/versions/1.3.0/registry.json').read_text(encoding='utf-8'))
        templates = {t['version']: t for t in first['templates']}
        ok = (first == second and VERSION in first['history'] and first['bodies'] == report['postimages'] and first['mirror'] is not None
              and templates.get('1.3.0', {}).get('content_sha256') == registry['content_sha256'] and templates['1.3.0']['registered'])
        print(json.dumps({'result': 'passed' if ok else 'failed', 'receipt': str(record('readback', {'passed': ok, 'equal_readbacks': first == second, 'state': first, 'expected_postimages': report['postimages']}))}))
    else:
        raise SystemExit('usage: release_1_3.py preflight|apply|readback')


if __name__ == '__main__':
    main(sys.argv[1:])
