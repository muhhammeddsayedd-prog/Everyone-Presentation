/** Fixed metadata-only comparator bridge for the reviewed Python release. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import {URL} from 'node:url';
import {compareCandidatePipeline} from './lib/candidate-pipeline-comparison.mjs';
try{
 assert.equal(process.argv.length,2);let input='';for await(const chunk of process.stdin){input+=chunk.toString('utf8');assert(input.length<32*1024*1024);}
 const value=JSON.parse(input);assert.deepEqual(Object.keys(value).sort(),['after','before']);
 const bytes=await readFile(new URL('../tracking/evidence/m03/kernel-catalog/2026-10-29T10-20-30-781Z-5b008cdd.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'4d9d66c35f7419056365df954c6ee3fd9024b53ff2749d228cebfb8b3b2badc3');
 const reference=JSON.parse(bytes);assert(reference.result==='passed'&&reference.rollback_verified&&reference.sources_stable);
 for(const state of [value.before,value.after])assert(state.query_role==='postgres'&&state.database==='postgres'&&state.unrestricted_visibility===true);
 compareCandidatePipeline(value.before,value.after,reference.before,reference.candidate);
 process.stdout.write('{"comparison":"passed"}\n');
}catch{process.stderr.write('CANDIDATE_PIPELINE_METADATA_COMPARISON_UNCONFIRMED\n');process.exitCode=1;}
