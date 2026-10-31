-- First fragment for an owned synthetic transaction. Never run fixtures on a
-- shared/local-original/cloud database. The parent runner owns BEGIN/ROLLBACK.
set local role postgres;
set local search_path='';
do $english34_test_target$begin
 if current_user<>'postgres' or current_database()!~'^eps_english34_[a-f0-9]{32}$'
 or coalesce(current_setting('eps.english34_test_run',true),'')!~'^[a-f0-9]{32}$'
 or current_database()<>'eps_english34_'||current_setting('eps.english34_test_run',true)
 or coalesce(current_setting('eps.english34_test_oid',true),'')!~'^[1-9][0-9]{0,9}$'
 or not exists(select 1 from pg_database where datname=current_database()
  and oid::text=current_setting('eps.english34_test_oid',true)and datdba='postgres'::regrole
  and shobj_description(oid,'pg_database')='eps-english34-owned:'||current_setting('eps.english34_test_run',true))
 then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;
end$english34_test_target$;
