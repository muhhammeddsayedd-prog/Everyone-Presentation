"""Pure production38 renderer. Never writes the official migration or calls SQL."""
from pathlib import Path
from hashlib import sha256
import json
import pglast
from pglast import ast,parse_sql

ROOT=Path(__file__).resolve().parents[3]
VERSION='20261101110939'
MIGRATION='supabase/migrations/'+VERSION+'_m07_job_batch_filter.sql'
CANDIDATE='development/m07/job-batch-filter/candidate.sql.txt'
CANDIDATE_SHA='331e6d9a83220d9baed3fed58810cd2bea70ea7acf05642c1d93885640fddb30'
BASELINE='tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-27-793801Z-readback.json'
BASELINE_SHA='cc0936d60ab10c9f2bdabcd6c7b26dc07655abc9126de692cfe519a589e2c8c2'
OLD='public.eps_list_jobs(uuid,text,uuid,integer)'
NEW='public.eps_list_jobs_by_batch(uuid,text,uuid,integer,uuid)'
OLD_BODY_SHA='a2239225b995673e9ab432ac63014f742b25032cc586c790535db260c551d241'
NEW_BODY_SHA='323d6c19b056cd722cb915717d88616eaf28ed52c82c2743327f84690287d3f9'
ANCHOR='\ncreate function public.eps_list_jobs_by_batch('

def need(v):
 if not v:raise ValueError('BATCH38_MIGRATION_SOURCE_UNCONFIRMED')

def functional_suffix(raw):
 need(type(raw)is bytes and raw.count(ANCHOR.encode())==1)
 return raw[raw.index(ANCHOR.encode()):]

def render():
 need(pglast.__version__=='v7.21')
 candidate=(ROOT/CANDIDATE).read_bytes();need(sha256(candidate).hexdigest()==CANDIDATE_SHA)
 raw=(ROOT/BASELINE).read_bytes();need(sha256(raw).hexdigest()==BASELINE_SHA)
 baseline=json.loads(raw);need(baseline['result']=='observed_applied'and baseline['version']=='20261101042702')
 history=baseline['static_schema_after']['history'];need(len(history)==37 and history[-1]=='20261101042702')
 function=[r.stmt for r in parse_sql(candidate.decode())if isinstance(r.stmt,ast.CreateFunctionStmt)]
 need(len(function)==1 and len(function[0].parameters)==5 and all(p.defexpr is None for p in function[0].parameters))
 body=next(o.arg[0].sval for o in function[0].options if o.defname=='as');need(sha256(body.encode()).hexdigest()==NEW_BODY_SHA)
 versions='array['+','.join("'"+v+"'"for v in history)+']::text[]'
 prefix=f'''-- Additive M07 batch filter38. Functional suffix is byte-identical to the
-- actual ownedbb9cf2bf 205-job SQL proof. No existing business function is replaced.
begin;
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $batch38_target$declare retained_port pg_proc;begin
 if current_database()<>'postgres'or current_user<>'postgres'or session_user<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from {versions}
 or exists(select 1 from pg_proc prospective_proc join pg_namespace prospective_namespace on prospective_namespace.oid=prospective_proc.pronamespace where prospective_namespace.nspname='public'and prospective_proc.proname='eps_list_jobs_by_batch')
 or has_schema_privilege('eps_jobs_owner','public','CREATE')
 or not exists(select 1 from pg_roles where rolname='eps_jobs_owner'and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)
 then raise exception'BATCH38_EXACT_CANONICAL37_REQUIRED';end if;
 select*into retained_port from pg_proc where oid=to_regprocedure('{OLD}');
 if retained_port.oid is null or pg_get_userbyid(retained_port.proowner)<>'eps_jobs_owner'or not retained_port.prosecdef
 or retained_port.proconfig is distinct from array['search_path=""']::text[]or retained_port.provolatile<>'v'
 or retained_port.prokind<>'f'or retained_port.prorettype<>'jsonb'::regtype or retained_port.proretset or retained_port.proisstrict or retained_port.proleakproof
 or retained_port.pronargs<>4 or retained_port.pronargdefaults<>4
 or encode(sha256(convert_to(replace(retained_port.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')<>'{OLD_BODY_SHA}'
 then raise exception'BATCH38_CURRENT_OLD_PORT_REQUIRED';end if;
 perform set_config('eps.job_batch_filter.old_port',to_jsonb(retained_port)::text,true);
end$batch38_target$;
'''
 result=prefix.encode()+functional_suffix(candidate)
 need(functional_suffix(result)==functional_suffix(candidate)and result.endswith(b'commit;\n'))
 return result
