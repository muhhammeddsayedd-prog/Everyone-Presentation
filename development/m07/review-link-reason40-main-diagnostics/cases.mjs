/** Default-off namespace guard; existing ACL/diagnostic cases are library-only. */
import assert from 'node:assert/strict';
import { runCases as prior } from '../review-link-reason40-acl-collector/cases.mjs';
export const EXECUTION_ENABLED=true;
export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'REASON40_MAIN_DIAGNOSTIC_EXECUTION_DISABLED');await prior(ctx,cfg);
 ctx.report.main_diagnostic_storage={workspace:'Main',existing_Main_guard:true,no_ROOT_or_cache_manipulation:true,no_new_IO_subprocess_port:true,SQL_and_acceptance_unchanged:true};
}
