/** New default-off diagnostic/ACL purpose. Existing case functions stay frozen. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const EXECUTION_ENABLED=true;
export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'REASON40_ACL_EXECUTION_DISABLED');
 const bytes=await readFile(cfg.typed_cases_path);assert.equal(createHash('sha256').update(bytes).digest('hex'),cfg.typed_cases_sha256);
 const library=await import(pathToFileURL(cfg.typed_cases_path).href);await library.runCases(ctx,cfg);
 ctx.report.valid_synthetic_config_fixture={setup_before_fresh_baseline:true,canonical_configuration_acceptance:false,fields:cfg.synthetic_config_fixture};
 ctx.report.acl_catalogue_projection={same_six_key_text_array:cfg.typed_keys,new_reason_acl_null:true,existing_reference_acl_preserved:true,shape_comparison_excludes_only:['attname','attnum','attacl'],state_sha256:cfg.new_state_sha256,checkpoint_sha256:cfg.new_checkpoint_sha256,case_source_changes:['owned_bridge_URL','diagnostic_action_allowlist','bounded_rollback_diagnostic_before_unchanged_commit']};
}
