"""Pure candidate36 promotion renderer. Caller owns writing/review; never applies."""
import importlib.util,json
from pathlib import Path

HERE=Path(__file__).resolve().parent
def module(name):
 spec=importlib.util.spec_from_file_location('attempt36_build_'+name,HERE/(name+'.py'));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def render(candidate,proof):
 p=module('proposal');p.validate_proof(proof);b=p.load_base();history=b.HISTORY+[b.VERSION]
 header=("""-- M07 additive future stage-attempt correlation; no historical backfill.
-- Functional DDL is byte-exact to candidate36 proved by owned7cff rollback.
-- Canonical target/source/data/role/catalogue gates are enforced by the release.
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';
do $attempt36_target$begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or (select array_agg(version order by version)from supabase_migrations.schema_migrations) is distinct from array["""+','.join(b.literal(v)for v in history)+"]::text[]\n"+
  " or to_regclass('eps.job_stage_attempts') is not null\n or to_regprocedure('eps.capture_job_stage_attempt()') is not null\n"+
  " or exists(select 1 from pg_roles where rolname='eps_job_trace_owner')\n or exists(select 1 from pg_trigger where tgrelid='eps.jobs'::regclass and tgname='capture_job_stage_attempt')\n"+
  " or (select encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')from pg_proc where oid=to_regprocedure('public.eps_get_workspace_summary(uuid)')) is distinct from "+b.literal(b.SUMMARY_BODY_SHA)+"\n"+
  " or not("+b.old.protected_m02_integrity_sql()+")\n then raise exception 'M07_ATTEMPT36_EXACT_REVIEWED35_REQUIRED';end if;\nend$attempt36_target$;\n")
 promoted=header.encode('utf-8')+p.functional_bytes(candidate);p.assert_functional_promotion(promoted,candidate);return promoted
