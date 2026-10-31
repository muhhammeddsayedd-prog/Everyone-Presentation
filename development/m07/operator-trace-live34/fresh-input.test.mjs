import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JOB_ID, WORKSPACE_ID, CANDIDATE_WORKFLOW_ID, validateFreshInput } from './fresh-input.mjs';

const evidence = Buffer.from('{"synthetic":true}\n');
const fixture = () => ({ schema_version:'1.0', purpose:'at074-controlled-english-job-metadata',
  job_id:JOB_ID, workspace_id:WORKSPACE_ID, kind:'candidate_scan', job_status:'succeeded',
  durable_observation:{receipt:'tracking/evidence/m03/synthetic-fixture/durable-job.json',
    sha256:createHash('sha256').update(evidence).digest('hex'),observed_at:'2026-10-31T18:00:00Z'},
  execution_refs:[{execution_id:'90001',workflow_id:CANDIDATE_WORKFLOW_ID,attempt:1}] });

test('closed fresh input yields only bounded metadata cases and keeps acceptance pending', () => {
  const result = validateFreshInput(fixture(), evidence);
  assert.equal(result.maximum_get_requests,1);
  assert.equal(result.cases[0].job_id,JOB_ID);
  assert.equal(result.includeData,false);
  assert.equal(result.automatic_retry,false);
  assert.equal(result.durable_job_execution_cross_binding_verified_by_helper,false);
  assert.equal(result.execution_metadata_observed,false);
  const postgresTime=fixture();postgresTime.durable_observation.observed_at='2026-10-31T18:00:00+00:00';
  assert.equal(validateFreshInput(postgresTime,evidence).durable_observation.observed_at,postgresTime.durable_observation.observed_at);
});

test('foreign identity, unknown/payload fields, missing execution and unconfirmed running job fail closed', () => {
  for (const change of [value=>{value.job_id='00000000-0000-4000-8000-000000000000';},
    value=>{value.workspace_id='00000000-0000-4000-8000-000000000000';},
    value=>{value.job_status='running';},value=>{value.execution_refs=[];},
    value=>{value.token='SYNTHETIC_SECRET';},value=>{value.execution_refs[0].data={};},
    value=>{value.execution_refs=Array.from({length:3},(_,i)=>({execution_id:String(90001+i),workflow_id:CANDIDATE_WORKFLOW_ID,attempt:i+1}));}]) {
    const value=fixture();change(value);assert.throws(()=>validateFreshInput(value,evidence));
  }
});

test('historical, duplicate and wrong-workflow executions cannot substitute for the new job', () => {
  for (const change of [value=>{value.execution_refs[0].execution_id='31515';},
    value=>{value.execution_refs.push({...value.execution_refs[0]});},
    value=>{value.execution_refs[0].workflow_id='kE4qSEcugaKhIoJU';},
    value=>{value.execution_refs[0].attempt=0;}]) {
    const value=fixture();change(value);assert.throws(()=>validateFreshInput(value,evidence));
  }
});

test('the source receipt is hash-bound and constrained to public metadata evidence paths', () => {
  assert.throws(()=>validateFreshInput(fixture(),Buffer.from('different')));
  for (const receipt of ['.env.worker.local','tracking/evidence/m03/../private.json','https://example.invalid/x.json','C:\\private.json']) {
    const value=fixture();value.durable_observation.receipt=receipt;assert.throws(()=>validateFreshInput(value,evidence));
  }
});
