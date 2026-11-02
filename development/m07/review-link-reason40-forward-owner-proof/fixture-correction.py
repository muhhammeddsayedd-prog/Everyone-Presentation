"""Exact owned-session correction only. No I/O, grants, role or schema changes."""
import hashlib
OLD_SQL_SHA='7031a11d4cb15f905f485807e06848788e68dc82683c5eb5b06cca4be0f116dd'
OLD_SWITCH='set local role supabase_storage_admin;\n'
NEW_SWITCH="""reset session authorization;
do $forward_initial_owner$begin
 if session_user<>'supabase_admin'or current_user<>'supabase_admin'or not coalesce((select rolsuper from pg_roles where rolname='supabase_admin'),false)
 then raise exception'FORWARD_EXACT_INITIAL_OWNED_ADMIN_REQUIRED';end if;
end$forward_initial_owner$;
set local role supabase_storage_admin;
"""
OLD_RETURN='end$forward_ledger$;\nselect jsonb_build_object('
NEW_RETURN="""end$forward_ledger$;
set session authorization postgres;
do $forward_actor_returned$begin
 if session_user<>'postgres'or current_user<>'postgres'then raise exception'FORWARD_POSTGRES_ACTOR_RETURN_REQUIRED';end if;
end$forward_actor_returned$;
select jsonb_build_object("""
def replace_once(text,old,new):
 if text.count(old)!=1:raise ValueError('FORWARD_OWNER_FIXTURE_SOURCE_CHANGED')
 return text.replace(old,new)
def correct(sql):
 if hashlib.sha256(sql.encode()).hexdigest()!=OLD_SQL_SHA:raise ValueError('FORWARD_OWNER_FIXTURE_SOURCE_CHANGED')
 if not sql.index('end$forward_owned$;')<sql.index(OLD_SWITCH):raise ValueError('FORWARD_OWNER_GUARD_ORDER')
 result=replace_once(replace_once(sql,OLD_SWITCH,NEW_SWITCH),OLD_RETURN,NEW_RETURN)
 if replace_once(replace_once(result,NEW_RETURN,OLD_RETURN),NEW_SWITCH,OLD_SWITCH)!=sql:raise ValueError('FORWARD_OWNER_INVERSE_REQUIRED')
 return result
