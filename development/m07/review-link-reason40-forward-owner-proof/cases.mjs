/** New default-off namespace; managed fixture precedes frozen collector cases. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runCases as prior } from '../review-link-reason40-main-diagnostics/cases.mjs';
export const EXECUTION_ENABLED=true;
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const only=text=>{const rows=text.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];};
export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'FORWARD_OWNED_EXECUTION_DISABLED');
 for(const[file,hash]of Object.entries(cfg.source_pins))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash);
 await ctx.inspect();assert.notEqual(ctx.system,'7701520506262638626');
 const guard='set session authorization postgres;set timezone=\'UTC\';set eps.reason40forward.run='+quote(ctx.runId)+';';
 const fixture=cfg.forward_fixture_sql.replace('__FORWARD_SYSTEM_SQL__',quote(ctx.system)).replace('__FORWARD_RUN_SQL__',quote(ctx.runId));
 const returned=await ctx.sql(guard+fixture);const result=only(returned.stdout);assert.equal(result.claims_after,result.claims_before+1);assert.equal(result.one_synthetic_ledger_row_added,true);assert.equal(result.official0074_exact_source,true);
 ctx.report.forward_owned_fixture={...result,setup_before_fresh_baseline:true,source_sha256:cfg.forward_upstream_sha256,core_column_source_sha256:cfg.forward_core_sha256,historical_dark_definition_source_sha256:cfg.forward_dark_source_sha256,synthetic_coordination_row_not_live_OAuth:true,no_canonical_identity_or_managed_upgrade_acceptance:true};
 await prior(ctx,cfg);
 await ctx.inspect();const retained=only((await ctx.sql(guard+"begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='60s';select jsonb_build_object('count',(select count(*)from storage.buckets),'new_versioning_status_all_disabled',not exists(select 1 from storage.buckets where versioning_status is distinct from'DISABLED'))as forward_bucket_preservation;rollback;")).stdout);assert.equal(retained.count,result.storage_bucket_count);assert.equal(retained.new_versioning_status_all_disabled,true);
 ctx.report.forward_owned_fixture.new_bucket_column_values_preserved_after40=true;ctx.report.forward_owned_fixture.storage_bucket_count_preserved_after40=true;
 ctx.report.forward_source_scope={new_forward_guard_source_pinned:true,SQL_guard_methods_inherited_unchanged:true,owned_current_identity_qualification_only:true,canonical_hardbound_five_scalar_baseline_claimed:false,historical_identity_equality_since39_claimed:false};
}
