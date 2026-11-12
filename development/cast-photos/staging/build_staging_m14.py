"""Disposable staging replica for m14 (cast archive photo read path).

Builds the cached canonical catalogue (as build_staging.py does), brings it to the live history (m08, the m08 fit-font
fix, m09-m12, m13), applies m14 and checks:
  * m14 applies once and refuses a second run;
  * only two functions and one policy are added; tables and every other function/policy are unchanged;
  * as an account with cast.read: a person's photos list cover first, a photo/thumbnail asset resolves to its bucket
    and key; an unknown asset and a non-photo asset are not found;
  * without cast.read, and for anon, both functions are refused.
Run from the repository root:  python -X utf8 development/cast-photos/staging/build_staging_m14.py
Never point this at a shared or cloud database: it only talks to its own container.
"""
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'development/editorial-template/staging'))
import build_staging as base  # noqa: E402
import build_staging_1_3 as m13  # noqa: E402

MIGRATIONS = ROOT / 'supabase/migrations'
LIVE = ['20261109120000_m09_cast_archive_import', '20261111120000_m10_candidate_photo_guard_anon', '20261112120000_m11_candidate_media_rescan',
        '20261112180000_m12_list_page_before_dto', '20261113120000_m13_editorial_template_1_3']
M14 = MIGRATIONS / '20261112190000_m14_candidate_photo_read.sql'
ADDED = ['public.eps_get_candidate_photo_asset(uuid)', 'public.eps_list_candidate_photos(uuid)']


def migration(name):
    path = MIGRATIONS / f'{name}.sql'
    if not path.exists():  # m09-m12 may exist only in the main checkout
        path = ROOT.parent / 'Everyone-Presentation-Studio/supabase/migrations' / f'{name}.sql'
    return path.read_bytes()


def apply(name, data):
    base.psql(data)
    version, label = name.split('_', 1)
    base.psql(f"insert into supabase_migrations.schema_migrations(version,statements,name)values('{version}',array[]::text[],'{label}');", 'supabase_admin')


def as_user(principal, sql):
    claims = json.dumps({'sub': principal, 'role': 'authenticated', 'is_anonymous': False})
    return base.psql(f"begin;set local role authenticated;select set_config('request.jwt.claims',{base.literal(claims)},true),set_config('request.jwt.claim.sub','{principal}',true);{sql};rollback;")


def jsonline(out):
    return json.loads([line for line in out.splitlines() if line.startswith('{')][-1])


def as_anon(sql):
    return base.psql(f"begin;set local role anon;select set_config('request.jwt.claims','{{\"role\":\"anon\"}}',true);{sql};rollback;")


def refused(run, needle):
    try:
        run()
    except RuntimeError as error:
        assert needle in str(error), error
        return True
    raise AssertionError(f'expected refusal containing {needle}')


def seed():
    """One person with two photos (the second is the cover), one person without photos, and one unrelated asset."""
    ids = {k: str(uuid.uuid4()) for k in ['granted', 'denied', 'person', 'empty', 'p1', 'p2', 'a1', 't1', 'a2', 't2', 'ws']}
    sql = [f"insert into auth.users(id,instance_id,aud,role,email)values('{ids['granted']}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','granted@example.invalid'),('{ids['denied']}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','denied@example.invalid');",
           "set session_replication_role=replica;"]
    cols = base.psql("select string_agg(column_name||':'||is_nullable||':'||coalesce(column_default,''),'|' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='app_capability_grants';")
    print('app_capability_grants', cols.strip()[:300])
    sql.append(f"insert into public.app_capability_grants(principal_id,capability,active)values('{ids['granted']}','cast.read',true);")
    for person in ['person', 'empty']:
        sql.append(f"insert into eps.candidates(id,casting_id,facts,source_kind,created_by)select '{ids[person]}','EPS-SYN-{person}',facts,'archive','{ids['granted']}' from (select jsonb_build_object('name','Synthetic {person}','casting_id','EPS-SYN-{person}','age_or_range',null,'stated_gender',null,'height_measurements',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills_experience',null,'city',null,'previous_projects_roles',null,'classification',null) facts) f;")
    for n in ['1', '2']:
        for kind in ['a', 't']:
            sql.append(f"insert into eps.media_assets(id,purpose,filename,bucket,object_key,mime_type,size_bytes,sha256,width,height,status,origin_workspace_id)values('{ids[kind + n]}','candidate_photo','{kind}{n}.jpg','eps-candidate-photos','archive/{ids[kind + n]}.jpg','image/jpeg',1000,repeat('a',64),400,500,'ready','{ids['ws']}');")
        sql.append(f"insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key)values('{ids['p' + n]}','{ids['person']}',{n},'{ids['a' + n]}','{ids['t' + n]}',400,500,'synthetic/{n}');")
    sql.append(f"insert into eps.candidate_attributes(candidate_id,cover_photo_id)values('{ids['person']}','{ids['p2']}');")
    sql.append("set session_replication_role=origin;")
    base.psql('\n'.join(sql), 'supabase_admin')
    return ids


STORAGE_STUB = """create schema if not exists storage;
create table if not exists storage.buckets(id text primary key,name text not null,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.allow_only_operation(p_operation text)returns boolean language sql stable as $$select false$$;
grant usage on schema storage to public;
alter table storage.buckets owner to postgres;alter table storage.objects owner to postgres;alter function storage.allow_only_operation(text) owner to postgres;"""


def main():
    m13.prepared()
    # The replica image has no Storage service schema; m09 only needs these shapes (no Storage behaviour is tested here).
    base.psql(STORAGE_STUB, 'supabase_admin')
    for name in LIVE:
        apply(name, migration(name))
    before = base.catalogue()
    apply(M14.stem, M14.read_bytes())
    after = base.catalogue()
    added = sorted(k for k in after['functions'] if k not in before['functions'])
    changed = sorted(k for k in before['functions'] if before['functions'][k] != after['functions'].get(k))
    assert added == ADDED, added
    assert changed == [], changed
    assert after['tables'] == before['tables'], 'tables changed'
    new_policies = [p for p in after['policies'] if p not in before['policies']]
    assert [p['policyname'] for p in new_policies] == ['cast_photo_assets_read'] and [p for p in before['policies'] if p not in after['policies']] == [], new_policies
    second = refused(lambda: base.psql(M14.read_bytes()), 'M14_ALREADY_APPLIED')

    ids = seed()
    listed = jsonline(as_user(ids['granted'], f"select public.eps_list_candidate_photos('{ids['person']}')::text"))
    assert [row['id'] for row in listed['data']] == [ids['p2'], ids['p1']] and listed['data'][0]['cover'] is True and listed['data'][0]['thumb_asset_id'] == ids['t2'], listed
    empty = jsonline(as_user(ids['granted'], f"select public.eps_list_candidate_photos('{ids['empty']}')::text"))
    assert empty == {'data': []}, empty
    asset = jsonline(as_user(ids['granted'], f"select public.eps_get_candidate_photo_asset('{ids['t2']}')::text"))
    assert asset['bucket'] == 'eps-candidate-photos' and asset['object_key'] == f"archive/{ids['t2']}.jpg" and asset['asset']['purpose'] == 'candidate_photo', asset
    checks = {
        'unknown_asset_not_found': refused(lambda: as_user(ids['granted'], f"select public.eps_get_candidate_photo_asset('{uuid.uuid4()}')"), 'RESOURCE_NOT_FOUND'),
        'unknown_person_not_found': refused(lambda: as_user(ids['granted'], f"select public.eps_list_candidate_photos('{uuid.uuid4()}')"), 'RESOURCE_NOT_FOUND'),
        'no_cast_read_refused_list': refused(lambda: as_user(ids['denied'], f"select public.eps_list_candidate_photos('{ids['person']}')"), 'CAPABILITY_REQUIRED'),
        'no_cast_read_refused_asset': refused(lambda: as_user(ids['denied'], f"select public.eps_get_candidate_photo_asset('{ids['t2']}')"), 'CAPABILITY_REQUIRED'),
        'anon_refused': refused(lambda: as_anon(f"select public.eps_list_candidate_photos('{ids['person']}')"), 'permission denied'),
    }
    print(json.dumps({'result': 'passed', 'added': added, 'policy': 'cast_photo_assets_read', 'second_run_refused': second, **checks}))


if __name__ == '__main__':
    main()
