/** New default-off purpose; a pinned private bridge-path-only case projection. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const EXECUTION_ENABLED=false;
export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'REASON40_TYPED_EXECUTION_DISABLED');
 const raw=await readFile(cfg.typed_cases_path);assert.equal(createHash('sha256').update(raw).digest('hex'),cfg.typed_cases_sha256);
 const cases=await import(pathToFileURL(cfg.typed_cases_path).href);await cases.runCases(ctx,cfg);
 ctx.report.valid_synthetic_config_fixture={setup_before_fresh_baseline:true,canonical_configuration_acceptance:false,fields:cfg.synthetic_config_fixture};
 ctx.report.typed_catalogue_projection={only_six_key_deletion_operand_type_corrected:true,exact_keys:cfg.typed_keys,old_state_sha256:cfg.old_state_sha256,new_state_sha256:cfg.new_state_sha256,old_checkpoint_sha256:cfg.old_checkpoint_sha256,new_checkpoint_sha256:cfg.new_checkpoint_sha256,case_functions_changed_only_bridge_file_path:true,canonical_READ_APPLY:false};
}
