/** One original-graph call per independently restored arm. No retry or EXPLAIN. */
import assert from 'node:assert/strict';
import {readFile}from 'node:fs/promises';
import {URL}from 'node:url';
import {literal,sha}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-proof/proof.mjs';
import {runDiagnostic as runOriginalFirst}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-generation-raw-companion-first-proof/run.mjs';

export const TABLES=['auth.sessions','eps.assignments','eps.candidate_media','eps.candidates','eps.mcp_oauth_resources','eps.media_assets','eps.presentation_version_assets','eps.presentation_versions','eps.presentation_video_english_transcripts','eps.presentation_video_transcripts','eps.roles','eps.slots','eps.version_slides','eps.workspace_candidates','eps.workspaces','public.app_capability_grants','public.project_memberships','public.projects'];
export const PROFILE="set jit=off;set plan_cache_mode=auto;set default_statistics_target=100;";
const SETTINGS=['autovacuum','autovacuum_analyze_scale_factor','autovacuum_analyze_threshold','default_statistics_target','jit','jit_above_cost','jit_inline_above_cost','jit_optimize_above_cost','plan_cache_mode'];
const exactKeys=(v,keys)=>assert.deepEqual(Object.keys(v).sort(),[...keys].sort());
const stamp=v=>assert(v===null||typeof v==='string'&&/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/u.test(v));
export function closedObservation(v){
 exactKeys(v,['observed_at','server_version_num','settings','tables']);stamp(v.observed_at);assert(v.observed_at!==null);
 assert(typeof v.server_version_num==='string'&&/^17\d{4}$/u.test(v.server_version_num));exactKeys(v.settings,SETTINGS);
 for(const[name,value]of Object.entries(v.settings))assert(typeof value==='string'&&(name==='jit'||name==='autovacuum'?['on','off'].includes(value):name==='plan_cache_mode'?['auto','force_generic_plan','force_custom_plan'].includes(value):/^\d+(?:\.\d+)?$/u.test(value)));
 assert(Array.isArray(v.tables));assert.deepEqual(v.tables.map(x=>x.table),TABLES);
 for(const row of v.tables){exactKeys(row,['table','estimated_rows','pages','all_visible_pages','last_analyze','last_autoanalyze','analyze_count','autoanalyze_count','live_estimate','modifications_since_analyze']);
  for(const k of['estimated_rows','pages','all_visible_pages','analyze_count','autoanalyze_count','live_estimate','modifications_since_analyze'])assert(Number.isFinite(row[k])&&row[k]>=(k==='estimated_rows'?-1:0));
  stamp(row.last_analyze);stamp(row.last_autoanalyze);
 }
 return v;
}
export async function runDiagnostic(ctx){
 const arm=ctx.bindings.statsArm;assert(['control','analyzed'].includes(arm));
 const sql=await readFile(new URL('./observations.sql',import.meta.url),'utf8');assert.equal(sha(sql),ctx.bindings.observationsSha);
 const record=ctx.report.planner_statistics={arm,diagnostic_only:true,product_functions_replaced:false,
  explicit_analyze_requested:arm==='analyzed',automatic_retry:false,performance_acceptance:false,
  fresh_backend_not_cold_machine_cache:true,cross_arm_business_hash_equality_claimed:false};
 record.before=closedObservation(await ctx.value(sql));
 if(arm==='analyzed'){
  const guard=`do $owned$begin if current_database()<>'project39'or current_user<>'supabase_admin'or session_user<>'supabase_admin'or not(select rolsuper from pg_roles where rolname=current_user)or(pg_control_system()).system_identifier::text<>${literal(ctx.system)}or(select count(*)from supabase_migrations.schema_migrations)<>40 then raise exception'PLANNER_STATS_OWNED_TARGET_REQUIRED';end if;end$owned$;`;
  await ctx.sql("reset session authorization;begin;set local statement_timeout='8s';set local lock_timeout='8s';"+PROFILE.replaceAll('set ','set local ')+guard+'analyze '+TABLES.join(',')+';commit;');
  record.explicit_analyze_normal_return=true;
 }
 record.after_setup=closedObservation(await ctx.value(sql));
 // System planner statistics may change; full application rows/function metadata may not.
 assert.deepEqual(await ctx.value('select locksource41_proof.row_hashes();'),ctx.baseline,'PLANNER_STATS_APPLICATION_BASELINE_CHANGED');
 record.application_baseline_unchanged_after_setup=true;
 let senders=0;
 await runOriginalFirst({...ctx,startFreshGeneration:async tag=>{
  assert.equal(++senders,1,'PLANNER_STATS_SECOND_SENDER_FORBIDDEN');
  const s=await ctx.startFreshGeneration(tag);record.pid=s.pid;
  const only=rows=>{assert.equal(rows.length,1);return rows[0];};
  record.sender_before_profile=closedObservation(only(await s.request(sql)));
  await s.request(PROFILE);
  record.sender_effective=closedObservation(only(await s.request(sql)));
  assert.equal(record.sender_effective.settings.jit,'off');assert.equal(record.sender_effective.settings.plan_cache_mode,'auto');assert.equal(record.sender_effective.settings.default_statistics_target,'100');
  record.profile_identical_between_arms={jit:'off',plan_cache_mode:'auto',default_statistics_target:'100'};
  return s;
 }});
 record.after_call=closedObservation(await ctx.value(sql));record.one_application_dispatch=true;
 record.application_rollback_baseline_restored=true;
}
