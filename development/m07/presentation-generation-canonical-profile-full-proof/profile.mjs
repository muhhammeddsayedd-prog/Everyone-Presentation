/** Owned-server startup/profile checks only. No settings or product writes. */
import assert from 'node:assert/strict';

export const PROFILE={jit:'off',plan_cache_mode:'auto',default_statistics_target:'100'};
export const REFERENCE={path:'tracking/evidence/m07/completion-release/canonical-planner-stats-e2813947-7ccb-4f96-820b-6b156f3e8653.json',sha256:'8df6f004e2cc99e92fa43962dcc6523c93324910548f9836ddf927094a37a27d'};
export const PROFILE_SQL="select jsonb_build_object('observed_at',clock_timestamp(),'pid',pg_backend_pid(),'settings',(select jsonb_object_agg(name,jsonb_build_object('setting',setting,'reset_val',reset_val,'source',source)order by name)from pg_settings where name in('jit','plan_cache_mode','default_statistics_target')));";
const keys=(value,wanted)=>assert.deepEqual(Object.keys(value).sort(),[...wanted].sort());

export function ownedPostgresCommand(image){
 assert.deepEqual(image.Config.Entrypoint,['docker-entrypoint.sh'],'PROFILE_IMAGE_ENTRYPOINT_CHANGED');
 assert.deepEqual(image.Config.Cmd,['postgres','-D','/etc/postgresql'],'PROFILE_IMAGE_DEFAULT_CMD_CHANGED');
 return[...image.Config.Cmd,'-c','jit=off'];
}

export function closedProfile(value){
 keys(value,['observed_at','pid','settings']);
 assert(typeof value.observed_at==='string'&&/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/u.test(value.observed_at));
 assert(Number.isSafeInteger(value.pid)&&value.pid>0);keys(value.settings,Object.keys(PROFILE));
 for(const[name,wanted]of Object.entries(PROFILE)){
  const row=value.settings[name];keys(row,['setting','reset_val','source']);
  assert.equal(row.setting,wanted,'PROFILE_EFFECTIVE_VALUE_CHANGED');
  assert.equal(row.reset_val,wanted,'PROFILE_INHERITED_VALUE_CHANGED');
  assert(['default','environment variable','configuration file','command line','global','database','user','database user','client','override','interactive','test','session'].includes(row.source));
 }
 assert.equal(value.settings.jit.source,'command line','PROFILE_JIT_NOT_INHERITED_FROM_OWNED_COMMAND');
 return value;
}

export async function observeProfile(ctx,session,label){
 assert(/^[a-z_]{1,30}$/u.test(label));
 assert.deepEqual(ctx.bindings.canonicalPlannerProfile,PROFILE);
 assert.deepEqual(ctx.bindings.canonicalPlannerReference,REFERENCE);
 const rows=await session.request(PROFILE_SQL);assert.equal(rows.length,1);
 const actual=closedProfile(rows[0]);assert.equal(actual.pid,session.pid);
 const report=ctx.report.canonical_planner_profile??={reference:REFERENCE,expected:PROFILE,
  reference_connection:'canonical_admin_CLI',actual_production_API_or_MCP_backend_settings_observed:false,
  owned_server_jit_command_only:true,analyze_requested:false,product_bodies_changed_from_frozen_full_proof:false,
  cold_machine_cache_claimed:false,prior_jit_on_failures_not_relabelled:true,backend_observations:[]};
 report.backend_observations.push({label,...actual});
 if(label==='before_matrix')report.actual_before_matrix=actual;
 return actual;
}
