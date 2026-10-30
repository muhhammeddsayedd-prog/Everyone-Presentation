/** Exact source-pinned owned-local profile, with no ACL/hash normalization. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
const ROOT=path.resolve(import.meta.dirname,'..');
export const PROFILE='development/m07/db/release29-original-profile.json';
export const PROFILE_SHA='681fe120fea3ee70e35bd2c4ab4734e2b95e89e40ceef5a678f857adfa673cc2';
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(actual,expected)=>{if(!isDeepStrictEqual(actual,expected))throw Error('M07_EXACT_ORIGINAL_PROFILE_STATE_REQUIRED');};
async function sealed(file,digest){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&!file.split(/[\\/]/u).includes('..')&&/^[a-f0-9]{64}$/u.test(digest));
 const target=path.join(ROOT,file);assert(!(await lstat(target)).isSymbolicLink());const bytes=await readFile(target);assert.equal(sha(bytes),digest,'M07_ORIGINAL_PROFILE_SOURCE_CHANGED');return bytes;
}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export async function loadOriginalProfile29(){
 const value=JSON.parse(await sealed(PROFILE,PROFILE_SHA));assert.equal(value.schema_version,'1.0');assert.equal(value.migration_sha256,'6531e8decab5496e212eb01575aca666cd9e03b0575f92dd66bd380760f84af4');
 const plan=JSON.parse(await sealed(value.plan,value.plan_sha256));assert.equal(plan.migration_path,value.migration_path);assert.equal(plan.migration_sha256,value.migration_sha256);
 await sealed(value.migration_path,value.migration_sha256);await sealed(value.readback_query,value.readback_sha256);await sealed(value.catalog_delta,value.catalog_delta_sha256);await sealed(value.original_clone_proof,value.original_clone_proof_sha256);await sealed(value.reconciliation,value.reconciliation_sha256);
 for(const[file,digest]of Object.entries(value.source_seals))await sealed(file,digest);
 const proof=JSON.parse(await sealed(value.rehearsal.path,value.rehearsal.sha256));assert.equal(proof.result,'passed');
 for(const flag of['exact_frozen_clone_reconstructed','full_original_baseline_profile_matched','candidate_rollback_verified','original_public_usage_exactly_preserved','owned_clone_removed','original28_and_empty_auth_subset_unchanged','original_role_oids_and_attributes_unchanged','shared_lock_released','all_sources_unchanged'])assert.equal(proof[flag],true,flag);
 assert.equal(proof.original_database_writes,false);assert.equal(proof.promotion_retry,false);assert.equal(proof.owned_system_identifier,'7701520506262638626');
 await sealed(proof.full_before_catalogue.path,proof.full_before_catalogue.sha256);await sealed(proof.full_after_catalogue.path,proof.full_after_catalogue.sha256);same(value.before,proof.before);same(value.expected_after,proof.expected_after);
 assert.equal(value.before.old_data.versions.length,28);same(value.before.old_data,value.expected_after.old_data);assert.equal(value.before.catalog_protected_sha256,value.expected_after.catalog_protected_sha256);
 return freeze(value);
}
/** The profile parameter must originate from the sealed loader in operational code. */
export function assertExactProfileBefore(state,profile){same(state,profile.before);}
export function assertExactProfileAfter(state,profile,version){
 assert(/^\d{14}$/u.test(version));const expected=structuredClone(profile.expected_after);expected.old_data.versions.push(version);same(state,expected);
}
