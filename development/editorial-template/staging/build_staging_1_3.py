"""Disposable staging replica for migration m13 (Everyone Film editorial template 1.3.0).

Builds the deployed catalogue exactly as build_staging.py does (cached read-only canonical
schema/roles/seed in .local/editorial-release/staging), applies m08 and the m08 fit-font fix
as on canonical (recording both in history), then applies m13 and verifies:

  * only the eight declared bodies change, each by exactly its declared replacement;
  * exactly four new functions appear (the 1.3.0 mirror and its three helpers), owned by
    postgres, security invoker, with the same EXECUTE grantees as eps.editorial_deck_counts;
  * tables, policies and every other function (owner, ACL, config, security) are identical;
  * the 1.3.0 template row is registered with the pinned registry identity;
  * a drifted preimage is refused and leaves nothing behind;
  * fit results: 1.3.0 accepts its nine pinned fonts and refuses the 1.1.0 six-font set.

Run from the repository root:  python -X utf8 development/editorial-template/staging/build_staging_1_3.py
The container is left running for the opt-in SQL mirror test:
  EPS_EDITORIAL_SQL_CONTAINER=eps-editorial-staging-disposable node tools/run-tests.mjs tests/worker/editorial-1-3-sql-mirror.test.ts
Never point this at a shared, staging or cloud database: it only talks to its own container.
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_staging as base  # noqa: E402

ROOT = base.ROOT
M13 = ROOT / 'supabase/migrations/20261113120000_m13_editorial_template_1_3.sql'
PATCHED = ['eps.export_validate_result(eps.jobs,jsonb)', 'eps.presentation_validate_result(eps.jobs,jsonb)', 'eps.review_snapshot_data(uuid,uuid,text)',
           'eps.review_validate_fit(eps.jobs,jsonb)', 'public.eps_generate_version(uuid,jsonb,text)', 'public.eps_get_workspace_review(uuid,uuid,text)',
           'public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)', 'public.eps_update_settings(jsonb,text)']
NEW = ['eps.editorial13_lines(text,integer)', 'eps.editorial13_provided(jsonb)', 'eps.editorial13_trim(text)', 'eps.editorial_deck_counts_1_3(jsonb)']


def prepared():
    """Fresh replica at the canonical post-m08 state (m08 + fit-font fix, both in history)."""
    base.build()
    base.psql(base.MIGRATION.read_bytes())
    base.psql("insert into supabase_migrations.schema_migrations(version,statements,name)values('20261104210000',array[]::text[],'m08_editorial_template');", 'supabase_admin')
    base.psql(base.FIT_FIX.read_bytes())
    base.psql("insert into supabase_migrations.schema_migrations(version,statements,name)values('20261104230000',array[]::text[],'m08_editorial_fit_fonts');", 'supabase_admin')


def refuses_drift():
    prepared()
    base.psql("""do $d$declare d text;begin select pg_get_functiondef('eps.review_validate_fit(eps.jobs,jsonb)'::regprocedure)into d;
execute replace(d,'begin','begin/*drift*/');end$d$;""", 'supabase_admin')
    try:
        base.psql(M13.read_bytes())
    except RuntimeError as error:
        assert 'M13_EDITORIAL_PREIMAGE_REQUIRED' in str(error), error
        assert base.psql("select count(*) from eps.presentation_templates where version='1.3.0';").split()[-1] == '0'
        assert base.psql("select to_regprocedure('eps.editorial_deck_counts_1_3(jsonb)') is null;").split()[-1] == 't'
        return True
    raise AssertionError('drifted preimage was not refused')


def fit_checks():
    registry = json.loads((ROOT / 'packages/templates/versions/1.3.0/registry.json').read_text(encoding='utf-8'))
    seed = base.value('seed.json', 'seed')
    six = next(t['font_hashes'] for t in seed['templates'] if t['version'] == '1.1.0')
    nine = {f['path']: f['sha256'] for f in registry['fonts']}

    def accepts(measured):
        job = {'input': {'expected_input_fingerprint': 'a' * 64, 'template': {'key': 'everyone-casting', 'version': '1.3.0', 'content_sha256': registry['content_sha256']},
                         'configuration': {'renderer_version': 'everyone-casting-fit-v1'}}}
        value = {'schema_version': '1.0', 'input_fingerprint': 'a' * 64, 'template_content_sha256': registry['content_sha256'], 'renderer_version': 'everyone-casting-fit-v1',
                 'chromium_version': '156.0.0.0', 'font_hashes': measured, 'overflows': [], 'measured_at': '2026-11-01T00:00:00Z'}
        sql = (f"do $t$begin perform eps.review_validate_fit(jsonb_populate_record(null::eps.jobs,{base.literal(json.dumps(job))}::jsonb),{base.literal(json.dumps(value))}::jsonb);end$t$;")
        try:
            base.psql(sql)
            return True
        except RuntimeError as error:
            if 'Measured font inventory is invalid' in str(error):
                return False
            assert 'RESOURCE_NOT_FOUND' in str(error), error  # passed the font check, then no workspace
            return True
    checks = {'1.3.0_nine_fonts': accepts(nine), '1.3.0_with_1.1.0_fonts': accepts(six)}
    assert checks == {'1.3.0_nine_fonts': True, '1.3.0_with_1.1.0_fonts': False}, checks
    return checks


def main():
    drift = refuses_drift()
    prepared()
    before = base.catalogue()
    migration = M13.read_bytes()
    base.psql(migration)
    base.psql("insert into supabase_migrations.schema_migrations(version,statements,name)values('20261113120000',array[]::text[],'m13_editorial_template_1_3');", 'supabase_admin')
    after = base.catalogue()
    changed = sorted(k for k in before['functions'] if before['functions'][k] != after['functions'].get(k))
    added = sorted(k for k in after['functions'] if k not in before['functions'])
    assert changed == PATCHED, changed
    assert added == NEW, added
    for fn in PATCHED:  # only the body changed
        assert {k: v for k, v in after['functions'][fn].items() if k != 'sha256'} == {k: v for k, v in before['functions'][fn].items() if k != 'sha256'}, fn
    mirror = after['functions']['eps.editorial_deck_counts(jsonb)']
    for fn in NEW:
        item = after['functions'][fn]
        assert item['owner'] == 'postgres' and item['secdef'] is False and item['volatile'] == 'i', (fn, item)
        assert set((item['acl'] or '').strip('{}').split(',')) - {''} == {a.replace('editorial_deck_counts', '') for a in (mirror['acl'] or '').strip('{}').split(',')} - {''}, (fn, item['acl'], mirror['acl'])
    assert after['tables'] == before['tables'] and after['policies'] == before['policies']
    registry = json.loads((ROOT / 'packages/templates/versions/1.3.0/registry.json').read_text(encoding='utf-8'))
    templates = {t['version']: t for t in after['templates']}
    assert templates['1.3.0'] == {'key': 'everyone-casting', 'version': '1.3.0', 'registered': True, 'content_sha256': registry['content_sha256']}, templates
    assert [t for t in after['templates'] if t['version'] != '1.3.0'] == before['templates']
    report = {'result': 'passed', 'changed': changed, 'added': added, 'drift_refused': drift, 'fit': fit_checks(),
              'migration_sha256': hashlib.sha256(migration).hexdigest(), 'postimages': {fn: after['functions'][fn]['sha256'] for fn in PATCHED},
              'template_content_sha256': registry['content_sha256'], 'image': base.IMAGE, 'container': base.CONTAINER}
    (base.OUT / 'staging-report-1.3.0.json').write_text(json.dumps(report, indent=1, sort_keys=True), encoding='utf-8')
    print(json.dumps({'result': 'passed', 'changed': len(changed), 'added': len(added), 'migration_sha256': report['migration_sha256']}))


if __name__ == '__main__':
    main()
