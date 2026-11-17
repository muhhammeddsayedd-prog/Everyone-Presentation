"""Cycle-7 staging database on real Supabase Auth + Storage schemas.

Run after up.sh (eps-c7stg-db with GoTrue and Storage API already migrated). Restores the canonical eps/public
catalogue (the same cached live dump the disposable replica uses), brings it to live history 50 (m08, fit fix,
m09-m12, m14, m13) with the reviewed migration files, applies the live storage bucket/policy baseline, and sets the
worker runtime login's local password. Cycle-7 migrations are applied separately (step-by-step rehearsal):

  python -X utf8 development/cycle7/staging-full/build.py base          # history 50 (current production state)
  python -X utf8 development/cycle7/staging-full/build.py step <file>   # one cycle-7 migration + history row
  python -X utf8 development/cycle7/staging-full/build.py history       # print history count / last version

Only ever talks to the eps-c7stg-db container.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'development/editorial-template/staging'))
sys.path.insert(0, str(ROOT / 'development/cast-photos/staging'))
import build_staging as base  # noqa: E402
import build_staging_m14 as m14  # noqa: E402

base.CONTAINER = 'eps-c7stg-db'
HERE = Path(__file__).resolve().parent
SECRETS = json.loads((ROOT / '.local/cycle7/stg/secrets.json').read_text(encoding='utf-8'))
LIVE_AFTER_M08 = ['20261109120000_m09_cast_archive_import', '20261111120000_m10_candidate_photo_guard_anon',
                  '20261112120000_m11_candidate_media_rescan', '20261112180000_m12_list_page_before_dto',
                  '20261112190000_m14_candidate_photo_read', '20261113120000_m13_editorial_template_1_3']


def restore_canonical():
    out = base.OUT
    roles = '\n'.join(re.sub(r' GRANTED BY "[^"]+"', '', line) for line in (out / 'roles.sql').read_text(encoding='utf-8').splitlines()
                      if 'supabase_realtime_admin' not in line and not re.match(r'^CREATE ROLE "(?!eps_)', line))
    base.psql(roles, 'supabase_admin', single=False)
    grants = [f'grant "{i["role"]}" to postgres with inherit {str(i["inherit"]).lower()}, set {str(i["set"]).lower()};'
              for i in base.value('members.json', 'm') if i['grantor'] == 'postgres']
    base.psql('\n'.join(grants), 'supabase_admin')
    # Auth and Storage objects come from the real GoTrue / Storage API migrations (no stubs). Canonical ACLs come only
    # from the dump's explicit GRANT/REVOKE statements, as in the replica.
    base.psql('delete from pg_catalog.pg_default_acl;', 'supabase_admin')
    base.psql((out / 'schema.sql').read_bytes(), 'supabase_admin')
    seed = base.value('seed.json', 'seed')
    rows = ','.join(f"({base.literal(m['version'])},{base.literal(m['name'] or '')})" for m in seed['migrations'])
    templates = ','.join('(' + ','.join([base.literal(t['key']), base.literal(t['version']), base.literal(t['content_sha256']), base.literal(t['font_key']),
                                         base.literal(json.dumps(t['font_hashes'])) + '::jsonb', str(t['registered']).lower()]) + ')' for t in seed['templates'])
    base.psql('create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);'
              f'insert into supabase_migrations.schema_migrations(version,name)values{rows};'
              f'insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes,registered)values{templates};', 'supabase_admin')


def history():
    out = base.psql("select count(*)||' '||max(version) from supabase_migrations.schema_migrations;", 'supabase_admin')
    return out.split()[-2:]


def base_build():
    restore_canonical()
    base.psql(base.MIGRATION.read_bytes())
    base.psql("insert into supabase_migrations.schema_migrations(version,statements,name)values('20261104210000',array[]::text[],'m08_editorial_template');", 'supabase_admin')
    base.psql(base.FIT_FIX.read_bytes())
    base.psql("insert into supabase_migrations.schema_migrations(version,statements,name)values('20261104230000',array[]::text[],'m08_editorial_fit_fonts');", 'supabase_admin')
    for name in LIVE_AFTER_M08:
        m14.apply(name, m14.migration(name))
    base.psql((HERE / 'storage-baseline-live.sql').read_bytes(), 'supabase_admin', single=False)
    # Worker runtime login (eps_specs_runtime) gets a local SCRAM password; the hosted pooler user is
    # eps_specs_runtime.<project>, here the plain role on the private network.
    base.psql(f"alter role eps_specs_runtime with login password '{SECRETS['runtime']}';", 'supabase_admin')
    count, last = history()
    print(json.dumps({'history': int(count), 'last': last}))


def config():
    # Processing switches as on live (read-only catalogue read 2026-11-17), with staging-only values: the application
    # origin is the local app and the review-gateway backend key is this stack's private key (never live's).
    gw = SECRETS['review_gateway']
    base.psql(f"""
insert into eps.presentation_processing_config(id,enabled,max_pages,max_pdf_bytes,renderer_version,application_origin,max_manifest_bytes)
 values(true,true,1000,67108864,'everyone-casting-pdf-v1','http://127.0.0.1:3000',8388608)
 on conflict (id) do update set enabled=true,application_origin=excluded.application_origin;
insert into eps.review_processing_config(id,model,enabled,prompt_version,renderer_version) values(true,'gpt-6.1-sol',true,'contextual_suggestion_v1','everyone-casting-fit-v1')
 on conflict (id) do update set enabled=true;
insert into eps.review_gateway_config(id,enabled,backend_key) values(true,true,decode('{gw}','hex'))
 on conflict (id) do update set enabled=true,backend_key=excluded.backend_key;
insert into eps.specs_asset_config(id,uploads_enabled,capabilities_enabled,file_pipeline_enabled) values(1,true,true,true) on conflict (id) do nothing;
insert into eps.specs_pipeline_config(id,enabled,model_version,prompt_version,result_schema_version,document_preparation_version)
 values(1,true,'gpt-6.1-sol','spec_extract_v1.0.0','1.0','document-preparation.v1') on conflict (id) do nothing;
insert into eps.candidate_support_config(id,uploads_enabled) values(true,true) on conflict (id) do nothing;
""", 'supabase_admin')
    print(base.psql("select (select count(*) from eps.presentation_processing_config where enabled)||' '||(select count(*) from eps.review_processing_config where enabled)||' '||(select count(*) from eps.review_gateway_config where enabled);", 'supabase_admin'))


def step(file):
    path = ROOT / 'supabase/migrations' / file
    name = path.stem
    m14.apply(name, path.read_bytes())
    count, last = history()
    print(json.dumps({'applied': name, 'history': int(count), 'last': last}))


if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else 'base'
    if command == 'base':
        base_build()
    elif command == 'step':
        step(sys.argv[2])
    elif command == 'config':
        config()
    elif command == 'history':
        print(history())
