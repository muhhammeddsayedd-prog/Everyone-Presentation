"""Rollback-only test of managed role logging configuration; no secret exists."""
import datetime
import hashlib
import json
from release_foundation import ROOT, TARGET, call

def main():
    source = (ROOT/'tools/sql/provision-specs-runtime.sql').read_text(encoding='utf-8')
    statements = [line.strip().replace('eps_specs_runtime','eps_specs_runtime_probe') for line in source.splitlines() if line.strip().startswith('alter role eps_specs_runtime set ')]
    assert len(statements) == 9
    directory = ROOT/'.local/specs-runtime'; directory.mkdir(parents=True,exist_ok=True)
    memberships = "(select coalesce(jsonb_agg(jsonb_build_object('member',r.rolname,'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by r.rolname,m.admin_option),'[]') from pg_auth_members m join pg_roles r on r.oid=m.member where m.roleid=(select oid from pg_roles where rolname='eps_specs_runtime_probe'))"
    sql = "begin; set local statement_timeout='15s'; do $$ begin if exists(select 1 from pg_roles where rolname='eps_specs_runtime_probe') then raise exception 'PROBE_COLLISION'; end if; end $$; create role eps_specs_runtime_probe nologin noinherit;\n" + '\n'.join(statements)
    sql += "\nselect set_config('eps.probe.incoming_before'," + memberships + "::text,true); grant eps_specs_runtime_probe to postgres;"
    sql += "\nselect jsonb_build_object('role','eps_specs_runtime_probe','settings',(select rolconfig from pg_roles where rolname='eps_specs_runtime_probe'),'incoming_before',current_setting('eps.probe.incoming_before')::jsonb,'incoming_after'," + memberships + ") as probe; rollback;\n"
    file=directory/'logging-probe.sql'; file.write_text(sql,encoding='utf-8')
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json'])
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'scope':'rollback-only NOLOGIN role logging configuration; no credential or business writes','sql_sha256':hashlib.sha256(sql.encode()).hexdigest(),'exit_code':result.returncode,'result':'unconfirmed'}
    if result.returncode == 0:
        payload=json.loads(result.stdout); report['metadata']=payload['rows']; report['result']='passed'
    else:
        # Fixed no-secret SQL; only a reviewed PG classification may be shown.
        report['classification']='CONFIGURATION_NOT_CONFIRMED'
    evidence=ROOT/'tracking/evidence/m02/specs-runtime'; evidence.mkdir(parents=True,exist_ok=True)
    (evidence/(report['observed_at'].replace(':','-')+'-logging-probe.json')).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report)); return result.returncode
if __name__=='__main__':
    try: raise SystemExit(main())
    except Exception: print('{"result":"unconfirmed","code":"LOGGING_PROBE_UNCONFIRMED"}'); raise SystemExit(1)
