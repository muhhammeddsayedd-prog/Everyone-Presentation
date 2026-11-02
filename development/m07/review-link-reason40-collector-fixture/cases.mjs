/** New purpose guard; reuses the exact frozen collector/test functions. */
import assert from 'node:assert/strict';
import { runCases as frozenCases } from '../review-link-reason40-canonical-release/local-cases.mjs';
export const EXECUTION_ENABLED=false;
export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'REASON40_CONFIG_COLLECTOR_EXECUTION_DISABLED');
 await frozenCases(ctx,cfg);
 ctx.report.valid_synthetic_config_fixture={setup_before_fresh_baseline:true,canonical_configuration_acceptance:false,fields:cfg.synthetic_config_fixture};
}
