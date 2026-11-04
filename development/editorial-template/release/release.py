"""Canonical release of m08 (editorial template 1.2.0). Importing is inert.

  preflight  read-only: history, templates, seven preimage hashes, mirror absence
  apply      ONE transaction: exact history-42 assertion, the migration (its own
             target/preimage/needle/readback guards), the history row; commit marker
  readback   read-only, run twice after apply: history 43, template 1.2.0, seven
             postimage hashes, mirror ACL; equal readbacks required

Uses the existing private CLI login (`supabase db query --linked`), the transport
of earlier canonical releases. No secret is read, printed or stored. Evidence (no
business rows) is written to tracking/evidence/m08/editorial-release/.
"""
import datetime
import hashlib
import json
import subprocess
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TARGET = 'pyibofyctwnqpvktepse'
VERSION = '20261104210000'
NAME = 'm08_editorial_template'
MIGRATION = ROOT / 'supabase/migrations/20261104210000_m08_editorial_template.sql'
EVIDENCE = ROOT / 'tracking/evidence/m08/editorial-release'
WORK = ROOT / '.local/editorial-release/canonical'
CLI = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', TARGET, '--output-format', 'json', '--workdir', str(ROOT)]
HISTORY42 = ['20261028010943', '20261028013324', '20261028013655', '20261028024205', '20261028072515', '20261028162702', '20261028162800',
             '20261028172320', '20261028184145', '20261028222030', '20261029001520', '20261029003941', '20261029070038', '20261029090500',
             '20261029090724', '20261029094600', '20261029100500', '20261029133455', '20261029135318', '20261029174841', '20261029180953',
             '20261029202629', '20261029203953', '20261029215218', '20261030002634', '20261030004643', '20261030013832', '20261030030717',
             '20261030111549', '20261030154824', '20261031010000', '20261031104603', '20261031130207', '20261031143711', '20261031182038',
             '20261101012057', '20261101042702', '20261101110939', '20261101223342', '20261102085405', '20261103031200', '20261103104337']
PATCHED = ['eps.export_validate_result(eps.jobs,jsonb)', 'eps.presentation_validate_result(eps.jobs,jsonb)', 'eps.review_snapshot_data(uuid,uuid,text)',
           'public.eps_generate_version(uuid,jsonb,text)', 'public.eps_get_workspace_review(uuid,uuid,text)',
           'public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)', 'public.eps_update_settings(jsonb,text)']


def literal(text):
    return "'" + text.replace("'", "''") + "'"


STATE = ("select jsonb_build_object('database',current_database(),'operator',current_user,"
         "'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),"
         "'templates',(select jsonb_agg(jsonb_build_object('key',key,'version',version,'registered',registered,'content_sha256',content_sha256,'font_key',font_key)order by key,version)from eps.presentation_templates),"
         "'bodies',(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))from pg_proc p where p.oid::regprocedure::text=any(array[" + ','.join(map(literal, PATCHED)) + "])),"
         "'mirror',(select jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text)from pg_proc where oid=to_regprocedure('eps.editorial_deck_counts(jsonb)')),"
         "'series_templates',(select jsonb_object_agg(coalesce(template_version,'null'),n)from(select template_version,count(*)n from eps.presentation_series group by 1)x),"
         "'version_templates',(select jsonb_object_agg(coalesce(t,'null'),n)from(select snapshot#>>'{template,version}'t,count(*)n from eps.presentation_versions group by 1)x),"
         "'version_hash',(select encode(sha256(convert_to(coalesce(string_agg(id::text||':'||snapshot_sha256||':'||status,','order by id),''),'UTF8')),'hex')from eps.presentation_versions))")


def query(sql, label):
    WORK.mkdir(parents=True, exist_ok=True)
    path = WORK / f'{label}-{uuid.uuid4()}.sql'
    path.write_bytes(sql.encode('utf-8'))
    done = subprocess.run(CLI + ['--file', str(path)], capture_output=True)
    if done.returncode:
        raise RuntimeError(f'{label}: CLI exit {done.returncode}: ' + done.stderr.decode('utf-8', 'replace')[-1500:])
    data = json.loads(done.stdout.decode('utf-8'))
    return data, hashlib.sha256(sql.encode('utf-8')).hexdigest()


def read_state(label):
    data, sql_hash = query(f"begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='30s';\n{STATE} as state;\nrollback;\n", label)
    row = data[0] if isinstance(data, list) else data['rows'][0]
    state = row['state']
    return (json.loads(state) if isinstance(state, str) else state), sql_hash


def record(action, payload):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc)
    body = {'schema_version': 'eps-m08-editorial-release.v1', 'action': action, 'recorded_at': stamp.isoformat(), 'target': TARGET,
            'version': VERSION, 'migration_sha256': hashlib.sha256(MIGRATION.read_bytes()).hexdigest(), **payload}
    path = EVIDENCE / f"{stamp.strftime('%Y-%m-%dT%H-%M-%S')}Z-{action}.json"
    path.write_text(json.dumps(body, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    return path


def preflight():
    state, sql_hash = read_state('preflight')
    ok = (state['operator'] == 'postgres' and state['history'] == HISTORY42 and state['mirror'] is None
          and [t['version'] for t in state['templates']] == ['1.0.0', '1.1.0'] and sorted(state['bodies']) == sorted(PATCHED))
    return state, ok, sql_hash


def apply():
    before, ok, _ = preflight()
    if not ok:
        raise RuntimeError('preflight refused: ' + json.dumps(before)[:500])
    marker = str(uuid.uuid4())
    sql = ("begin;\nset local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';\n"
           "do $m08_release$begin if(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array["
           + ','.join(map(literal, HISTORY42)) + "]::text[] then raise exception'M08_RELEASE_HISTORY42_REQUIRED';end if;end$m08_release$;\n"
           + MIGRATION.read_text(encoding='utf-8')
           + f"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values({literal(VERSION)},array[]::text[],{literal(NAME)});\n"
           + f"commit;\nselect jsonb_build_object('version',{literal(VERSION)},'marker',{literal(marker)})as m08_release;\n")
    data, sql_hash = query(sql, 'apply')
    returned = json.dumps(data)
    return before, marker, sql_hash, marker in returned


def main(argv):
    action = argv[0]
    if action == 'preflight':
        state, ok, sql_hash = preflight()
        print(json.dumps({'result': 'passed' if ok else 'refused', 'receipt': str(record('preflight', {'passed': ok, 'state': state, 'sql_sha256': sql_hash}))}))
    elif action == 'apply':
        before, marker, sql_hash, returned = apply()
        print(json.dumps({'result': 'applied' if returned else 'unconfirmed', 'receipt': str(record('apply', {'before': before, 'marker': marker, 'apply_sql_sha256': sql_hash, 'commit_marker_returned': returned}))}))
    elif action == 'readback':
        first, _ = read_state('readback-a')
        second, _ = read_state('readback-b')
        expected = json.loads((ROOT / '.local/editorial-release/staging/staging-report.json').read_text(encoding='utf-8'))
        post = {sig: item['after'] for sig, item in expected['changed'].items()}
        ok = (first == second and first['history'] == HISTORY42 + [VERSION] and first['bodies'] == post
              and [t['version'] for t in first['templates']] == ['1.0.0', '1.1.0', '1.2.0'] and first['mirror'] is not None)
        print(json.dumps({'result': 'passed' if ok else 'failed', 'receipt': str(record('readback', {'passed': ok, 'equal_readbacks': first == second, 'state': first, 'expected_postimages': post}))}))
    else:
        raise SystemExit('usage: release.py preflight|apply|readback')


if __name__ == '__main__':
    main(sys.argv[1:])
