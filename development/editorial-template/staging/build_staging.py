"""Disposable staging replica of the canonical catalogue for migration m08.

Why: migrations 30-42 are canonical-admission migrations (they pin the canonical
history list, role OIDs, existing role identities and protected-data hashes), so
they refuse a fresh local replay by design. This builds the deployed state instead:

  refresh  READ-ONLY canonical reads with the existing CLI login (schema-only dump of
           eps/public, role dump without passwords, postgres memberships, migration
           history and the two template rows). No business rows are read.
  build    fresh pinned Postgres 17.11 container, restore as supabase_admin, then
           apply supabase/migrations/20261104210000_m08_editorial_template.sql as
           postgres (as on canonical) inside one transaction.
  verify   before/after catalogue diff: only the seven declared bodies change, and
           each changes exactly by its declared replacement; owners, ACLs, config,
           security attributes, policies and every other function stay identical.

Inputs/outputs live in .local/editorial-release/staging (git-ignored). Never point
this at a shared, staging or cloud database: it only talks to its own container.
"""
import hashlib
import json
import re
import secrets
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / '.local/editorial-release/staging'
TARGET = 'pyibofyctwnqpvktepse'
CLI = ['npx.cmd', '--yes', 'supabase@2.122.0']
IMAGE = 'public.ecr.aws/supabase/postgres:17.11.0.011'
CONTAINER = 'eps-editorial-staging-disposable'
MIGRATION = ROOT / 'supabase/migrations/20261104210000_m08_editorial_template.sql'
PATCHED = ['public.eps_update_settings(jsonb,text)', 'public.eps_get_workspace_review(uuid,uuid,text)',
           'public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)', 'eps.review_snapshot_data(uuid,uuid,text)',
           'public.eps_generate_version(uuid,jsonb,text)', 'eps.presentation_validate_result(eps.jobs,jsonb)',
           'eps.export_validate_result(eps.jobs,jsonb)']

CATALOGUE = """select jsonb_build_object(
 'functions',(select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
   'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'secdef',p.prosecdef,'config',p.proconfig,'volatile',p.provolatile,'strict',p.proisstrict,
   'result',pg_get_function_result(p.oid),'args',pg_get_function_arguments(p.oid)))
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')),
 'tables',(select jsonb_object_agg(c.oid::regclass::text,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'force',c.relforcerowsecurity))
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('eps','public')and c.relkind in('r','v','p')),
 'policies',(select jsonb_agg(to_jsonb(p)order by schemaname,tablename,policyname)from pg_policies p where schemaname in('eps','public')),
 'templates',(select jsonb_agg(jsonb_build_object('key',key,'version',version,'registered',registered,'content_sha256',content_sha256)order by key,version)from eps.presentation_templates),
 'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations))"""


def run(args, **kw):
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding='utf-8', **kw)


def cli_read(sql_file, out_file):
    """One read-only canonical query through the existing CLI login."""
    text = sql_file.read_text(encoding='utf-8')
    assert text.lstrip().lower().startswith('begin') and 'read only' in text.lower() and text.rstrip().endswith('rollback;')
    out = run(CLI + ['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(sql_file), '--output-format', 'json', '--workdir', str(ROOT)])
    out_file.write_text(out.stdout, encoding='utf-8')


def refresh():
    assert (ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET
    OUT.mkdir(parents=True, exist_ok=True)
    run(CLI + ['db', 'dump', '--linked', '--schema', 'eps,public', '--file', str(OUT / 'schema.sql'), '--workdir', str(ROOT)])
    run(CLI + ['db', 'dump', '--linked', '--role-only', '--file', str(OUT / 'roles.sql'), '--workdir', str(ROOT)])
    queries = {
        'members': "select jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option,'grantor',grantor::regrole::text)order by roleid::regrole::text,grantor::regrole::text)as m from pg_auth_members where member='postgres'::regrole and roleid::regrole::text like 'eps%'",
        'seed': "select jsonb_build_object('templates',(select jsonb_agg(to_jsonb(t)order by key,version)from eps.presentation_templates t),'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name)order by version)from supabase_migrations.schema_migrations))as seed",
        'catalogue': CATALOGUE + ' as catalogue',
    }
    for name, sql in queries.items():
        path = OUT / f'read-{name}.sql'
        path.write_text(f"begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='30s';\n{sql};\nrollback;\n", encoding='utf-8')
        cli_read(path, OUT / f'{name}.json')


def value(file, key):
    data = json.loads((OUT / file).read_text(encoding='utf-8'))
    row = data[0] if isinstance(data, list) else data['rows'][0]
    item = row[key]
    return json.loads(item) if isinstance(item, str) else item


def psql(sql, user='postgres', single=True):
    args = ['docker', 'exec', '-i', CONTAINER, 'psql', '-U', user, '-h', 'localhost', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
    if single:
        args.append('-1')
    # Bytes, never text mode: function bodies keep their exact line endings.
    data = sql if isinstance(sql, bytes) else sql.encode('utf-8')
    done = subprocess.run(args, input=b"set search_path='';\n" + data, capture_output=True)
    if done.returncode:
        raise RuntimeError(done.stderr.decode('utf-8', 'replace')[-2000:])
    return done.stdout.decode('utf-8')


def literal(text):
    return "'" + text.replace("'", "''") + "'"


def build():
    subprocess.run(['docker', 'rm', '-f', CONTAINER], capture_output=True)
    run(['docker', 'run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=' + secrets.token_hex(16), IMAGE])
    for _ in range(90):
        if subprocess.run(['docker', 'exec', CONTAINER, 'pg_isready', '-U', 'postgres', '-h', 'localhost'], capture_output=True).returncode == 0:
            break
        time.sleep(2)
    time.sleep(8)  # image init scripts finish after the first ready
    # Grantor clauses are dropped: staging restores as supabase_admin (grantor identity
    # is not part of the function/ACL surface this migration touches).
    roles = '\n'.join(re.sub(r' GRANTED BY "[^"]+"', '', line) for line in (OUT / 'roles.sql').read_text(encoding='utf-8').splitlines()
                      if 'supabase_realtime_admin' not in line and not re.match(r'^CREATE ROLE "(?!eps_)', line))
    psql(roles, 'supabase_admin', single=False)
    grants = []
    for item in value('members.json', 'm'):
        if item['grantor'] == 'postgres':
            grants.append(f'grant "{item["role"]}" to postgres with inherit {str(item["inherit"]).lower()}, set {str(item["set"]).lower()};')
    psql('\n'.join(grants), 'supabase_admin')
    # Stubs for provider-managed objects (GoTrue/Storage create them on canonical; the
    # bare image does not). Only signatures matter: no auth or storage rows exist here.
    psql("""create or replace function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table if not exists auth.sessions(id uuid primary key,user_id uuid,oauth_client_id uuid,not_after timestamptz,scopes text);
create table if not exists auth.oauth_clients(id uuid primary key,deleted_at timestamptz,client_name text,redirect_uris text);
create table if not exists auth.oauth_authorizations(id uuid primary key,client_id uuid,user_id uuid,scope text,status text,created_at timestamptz,approved_at timestamptz);
create schema if not exists storage;
create or replace function storage.allow_only_operation(text)returns boolean language sql stable as $$select false$$;
-- The image's default privileges would add grants the dump never revokes; canonical
-- ACLs come only from the dump's explicit GRANT/REVOKE statements.
delete from pg_catalog.pg_default_acl;""", 'supabase_admin')
    psql((OUT / 'schema.sql').read_bytes(), 'supabase_admin')
    seed = value('seed.json', 'seed')
    rows = ','.join(f"({literal(m['version'])},{literal(m['name'] or '')})" for m in seed['migrations'])
    templates = ','.join('(' + ','.join([literal(t['key']), literal(t['version']), literal(t['content_sha256']), literal(t['font_key']), literal(json.dumps(t['font_hashes'])) + '::jsonb', str(t['registered']).lower()]) + ')' for t in seed['templates'])
    psql('create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);'
         f'insert into supabase_migrations.schema_migrations(version,name)values{rows};'
         f'insert into eps.presentation_templates(key,version,content_sha256,font_key,font_hashes,registered)values{templates};', 'supabase_admin')


def catalogue():
    return json.loads(psql(CATALOGUE + ';').split('\n', 1)[1])  # after the SET line


def owner_default(tables):
    """NULL relacl and an explicit owner-only ACL grant identical rights."""
    normal = {}
    for name, item in tables.items():
        acl = item['acl'] if item['acl'] is not None else '{%s=arwdDxtm/%s}' % (item['owner'], item['owner'])
        normal[name] = {**item, 'acl': acl}
    return normal


def verify(before, after, canonical):
    report = {'history_before': len(before['history']), 'functions_before': len(before['functions'])}
    # Staging must equal the canonical catalogue before the migration.
    assert before['functions'] == canonical['functions'], 'staging functions differ from canonical'
    assert owner_default(before['tables']) == owner_default(canonical['tables']) and before['policies'] == canonical['policies'], 'staging tables/policies differ from canonical'
    assert before['templates'] == canonical['templates'] and before['history'] == canonical['history']
    added = sorted(set(after['functions']) - set(before['functions']))
    assert added == ['eps.editorial_deck_counts(jsonb)'] and not set(before['functions']) - set(after['functions']), added
    changed = sorted(sig for sig in before['functions'] if before['functions'][sig] != after['functions'][sig])
    assert changed == sorted(PATCHED), changed
    for sig in changed:
        b, a = dict(before['functions'][sig]), dict(after['functions'][sig])
        b.pop('sha256'), a.pop('sha256')
        assert a == b, f'{sig}: attributes changed'
    assert before['tables'] == after['tables'] and before['policies'] == after['policies']
    # Every function that calls the mirror runs as a role that may execute it
    # (security definer: its owner; invoker: callers already hold presentation_hash).
    callers = json.loads(psql("""select coalesce(jsonb_agg(jsonb_build_object('fn',p.oid::regprocedure::text,'role',pg_get_userbyid(p.proowner),
      'ok',has_function_privilege(p.proowner,'eps.editorial_deck_counts(jsonb)','EXECUTE'))),'[]')from pg_proc p
      where p.prosrc like '%editorial_deck_counts(%' and p.oid<>'eps.editorial_deck_counts(jsonb)'::regprocedure;""").split('\n', 1)[1])
    assert len(callers) == 3 and all(item['ok'] for item in callers), callers
    report['mirror_callers'] = callers
    assert after['templates'][-1] == {**after['templates'][-1], 'version': '1.2.0', 'registered': True}
    report.update(added=added, changed={sig: {'before': before['functions'][sig]['sha256'], 'after': after['functions'][sig]['sha256']} for sig in changed},
                  new_function=after['functions'][added[0]], templates=after['templates'])
    return report


def refuses_drift():
    """A one-comment change to one patched body must make the migration refuse."""
    psql("""do $d$declare d text;begin select pg_get_functiondef('public.eps_update_settings(jsonb,text)'::regprocedure)into d;
execute replace(d,'begin','begin/*drift*/');end$d$;""", 'supabase_admin')
    try:
        psql(MIGRATION.read_bytes())
    except RuntimeError as error:
        assert 'M08_EDITORIAL_PREIMAGE_REQUIRED' in str(error), error
        assert psql("select count(*) from eps.presentation_templates where version='1.2.0';").split()[-1] == '0'
        return True
    raise AssertionError('drifted preimage was not refused')


def main(argv):
    if 'refresh' in argv:
        refresh()
    build()
    drift_refused = refuses_drift()
    build()
    before = catalogue()
    canonical = value('catalogue.json', 'catalogue')
    migration = MIGRATION.read_bytes()
    psql(migration)  # one transaction, as postgres
    after = catalogue()
    report = verify(before, after, canonical)
    report.update(drift_refused=drift_refused, migration_sha256=hashlib.sha256(migration).hexdigest(), image=IMAGE, container=CONTAINER)
    (OUT / 'staging-report.json').write_text(json.dumps(report, indent=1, sort_keys=True), encoding='utf-8')
    print(json.dumps({'result': 'passed', 'changed': len(report['changed']), 'migration_sha256': report['migration_sha256']}))


if __name__ == '__main__':
    main(sys.argv[1:])
