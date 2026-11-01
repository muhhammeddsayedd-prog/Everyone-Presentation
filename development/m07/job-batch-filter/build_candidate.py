"""Render an owned-local SQL draft only; Root supplies any later migration path."""
from hashlib import sha256
from pathlib import Path
import json
from pglast import ast,parse_sql

ROOT=Path(__file__).resolve().parents[3]
OLD_SIGNATURE='public.eps_list_jobs(uuid,text,uuid,integer)'
NEW_SIGNATURE='public.eps_list_jobs_by_batch(uuid,text,uuid,integer,uuid)'
M02_BODY_SHA='582adfd0958de33dc0d1eac0ffb55feb7be303bf7fd7f3a46d5850cfe530352d'
OLD_BODY_SHA='a2239225b995673e9ab432ac63014f742b25032cc586c790535db260c551d241'

def applied30_body_sha():
    """Read the existing protected catalogue literal, never a live database."""
    source=(ROOT/'supabase/migrations/20261030154824_m07_native_oauth_issuer.sql').read_text(encoding='utf8')
    anchor="if actual_catalogue is distinct from '";assert source.count(anchor)==1
    tail=source.split(anchor,1)[1];out=[];index=0
    while index<len(tail):
        if tail[index]=="'":
            if tail[index:index+2]=="''":out.append("'");index+=2;continue
            break
        out.append(tail[index]);index+=1
    assert tail[index:].startswith("'::jsonb")
    return json.loads(''.join(out))['functions|'+OLD_SIGNATURE+'|source_sha256']

def bodies():
    source=(ROOT/'supabase/migrations/20261028162800_m02_jobs_outbox.sql').read_text(encoding='utf8')
    funcs=[v.stmt for v in parse_sql(source)if isinstance(v.stmt,ast.CreateFunctionStmt)and '.'.join(n.sval for n in v.stmt.funcname)=='public.eps_list_jobs']
    assert len(funcs)==1 and len(funcs[0].parameters)==4
    old=next(o.arg[0].sval for o in funcs[0].options if o.defname=='as')
    assert sha256(old.encode()).hexdigest()==M02_BODY_SHA
    patch=(ROOT/'supabase/migrations/20261029133455_m03_remaining_media_library.sql').read_text(encoding='utf8')
    changes=[
        ("if not(eps.has_capability('workspaces.read') or eps.has_capability('operations.read')) then",
         "if not(eps.has_capability('workspaces.read') or eps.has_capability('operations.read') or eps.has_capability('cast.read')) then"),
        ("and eps.jobs_can_access(workspace_id,'read')",
         "and (kind='frame_extract' and eps.frame_user_can_read(jobs) or kind<>'frame_extract' and eps.jobs_can_access(workspace_id,'read'))")]
    for original,replacement in changes:
        assert old.count(original)==1
        assert patch.count("old_text:='"+original.replace("'","''")+"';")==1
        assert patch.count("new_text:='"+replacement.replace("'","''")+"';")==1
        old=old.replace(original,replacement)
    assert sha256(old.encode()).hexdigest()==OLD_BODY_SHA==applied30_body_sha()
    guard='if p_limit is null or p_limit not between 1 and 100'
    where='where (p_workspace_id is null or workspace_id=p_workspace_id)'
    assert old.count(guard)==old.count(where)==1
    new=old.replace(guard,'if p_batch_id is null or p_limit is null or p_limit not between 1 and 100').replace(where,'where batch_id=p_batch_id and (p_workspace_id is null or workspace_id=p_workspace_id)')
    return old,new

def render():
    _,body=bodies()
    versions=sorted(p.name[:14]for p in(ROOT/'supabase/migrations').glob('*.sql'))
    assert len(versions)==len(set(versions))==37 and versions[-1]=='20261101042702'
    history='array['+','.join("'"+v+"'"for v in versions)+']::text[]'
    return f'''-- DRAFT owned-local proof only. Not a coordinated migration or cloud entrypoint.
-- Root supplies the official filename/history/admission after source review.
begin;
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';
do $batch_filter_admit$declare p pg_proc;begin
 if current_database()!~'^eps_m07_r33_source_[a-f0-9]{{32}}$'
 or current_user<>'postgres' or session_user<>'postgres'
 or current_setting('eps.job_batch_filter.proof',true)is distinct from'owned-local-rollback-v1'
 or(pg_control_system()).system_identifier::text<>'7701520506262638626'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from {history}
 or to_regprocedure('{NEW_SIGNATURE}')is not null
 or exists(select 1 from pg_proc prospective_proc join pg_namespace prospective_namespace on prospective_namespace.oid=prospective_proc.pronamespace where prospective_namespace.nspname='public'and prospective_proc.proname='eps_list_jobs_by_batch')
 or has_schema_privilege('eps_jobs_owner','public','CREATE')
 or not exists(select 1 from pg_roles where rolname='eps_jobs_owner'and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)
 then raise exception'JOB_BATCH_FILTER_OWNED37_REQUIRED';end if;
 select*into p from pg_proc where oid=to_regprocedure('{OLD_SIGNATURE}');
 if p.oid is null or pg_get_userbyid(p.proowner)<>'eps_jobs_owner'or not p.prosecdef
 or p.proconfig is distinct from array['search_path=""']::text[]
 or encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')<>'{OLD_BODY_SHA}'
 then raise exception'JOB_BATCH_FILTER_OLD_PORT_REQUIRED';end if;
 perform set_config('eps.job_batch_filter.old_port',to_jsonb(p)::text,true);
end$batch_filter_admit$;

create function public.eps_list_jobs_by_batch(p_workspace_id uuid,p_status text,p_cursor uuid,p_limit integer,p_batch_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $job_batch_filter${body}$job_batch_filter$;
revoke all on function {NEW_SIGNATURE}from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_dispatcher;
grant create on schema public to eps_jobs_owner;
alter function {NEW_SIGNATURE}owner to eps_jobs_owner;
revoke create on schema public from eps_jobs_owner;
grant execute on function {NEW_SIGNATURE}to authenticated;
do $batch_filter_after$declare p pg_proc;q pg_proc;begin
 select*into p from pg_proc where oid=to_regprocedure('{OLD_SIGNATURE}');
 select*into q from pg_proc where oid=to_regprocedure('{NEW_SIGNATURE}');
 if to_jsonb(p)is distinct from current_setting('eps.job_batch_filter.old_port')::jsonb
 or has_schema_privilege('eps_jobs_owner','public','CREATE')
 or q.oid is null or pg_get_userbyid(q.proowner)<>'eps_jobs_owner'or not q.prosecdef or q.pronargdefaults<>0
 or q.proconfig is distinct from array['search_path=""']::text[]
 or encode(sha256(convert_to(replace(q.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')<>'{sha256(body.encode()).hexdigest()}'
 or exists(select 1 from aclexplode(coalesce(q.proacl,acldefault('f',q.proowner)))a where a.grantor<>q.proowner or a.grantee not in('eps_jobs_owner'::regrole,'authenticated'::regrole)or a.privilege_type<>'EXECUTE'or a.is_grantable)
 or not has_function_privilege('authenticated','{NEW_SIGNATURE}','EXECUTE')
 then raise exception'JOB_BATCH_FILTER_BOUNDARY_CHANGED';end if;
end$batch_filter_after$;
notify pgrst,'reload schema';
commit;
'''

if __name__=='__main__':
    import sys
    assert sys.argv[1:]==['--write-draft']
    (Path(__file__).resolve().parent/'candidate.sql.txt').write_text(render(),encoding='utf8',newline='\n')
