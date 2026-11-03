/** Strict fixed-purpose NOTICE records only; never exposes other stderr text. */
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
export const PHASES=['measure_enter','gen_enter','gen_sources_enter','gen_sources_exit','gen_review_enter','data_enter','data_assignments_enter','data_assignments_exit','data_return','gen_review_exit','gen_capture_enter','gen_capture_exit','gen_finalize_enter','measure_exit'];
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const STAGE=new Set([...PHASES,'measure_cancel']);
// A cancel may arrive after the normal public-call-exit marker but before the
// temporary wrapper returns its JSON. Keep that distinct from a successful call.
const MAX_STDERR=128*1024,MAX_LINE=220,MAX_EVENTS=15;
const line=/^NOTICE:\s+(?:00000:\s+)?EPS_STAGE_V1\|([a-f0-9-]{36})\|([a-z_]{1,40})\|([0-9]{1,11}(?:\.[0-9]{1,9})?)$/u;
export function projectStageLines(stderr,runId){
 assert(typeof stderr==='string'&&UUID.test(runId));
 const result={schema_version:'owned-fixed-stage-records.v1',events:[],invalid_owned_marker_count:0,foreign_marker_count:0,bounded_stderr:true};
 if(Buffer.byteLength(stderr)>MAX_STDERR){result.bounded_stderr=false;return result;}
 for(const raw of stderr.split(/\r?\n/u)){
  // Query text, facts, unrelated warnings and LOCATION lines are never returned.
  if(!raw.startsWith('NOTICE:')||!raw.includes('EPS_STAGE_V1|'))continue;
  const parsed=Buffer.byteLength(raw)<=MAX_LINE?line.exec(raw):null;
  if(!parsed){result.invalid_owned_marker_count++;continue;}
  if(parsed[1]!==runId){result.foreign_marker_count++;continue;}
  const epoch=Number(parsed[3]);
  if(!STAGE.has(parsed[2])||!Number.isFinite(epoch)||epoch<0||epoch>20_000_000_000||result.events.length>=MAX_EVENTS){result.invalid_owned_marker_count++;continue;}
  result.events.push({stage:parsed[2],epoch_seconds:epoch});
 }
 return result;
}

export function closedStageProjection(captured,result){
 assert.equal(captured.schema_version,'owned-fixed-stage-records.v1');assert.equal(captured.bounded_stderr,true);
 assert.equal(captured.after_normal_close,true);assert.equal(captured.child_exit,0);
 assert.equal(captured.invalid_owned_marker_count,0);assert.equal(captured.foreign_marker_count,0);
 assert(Array.isArray(captured.events)&&captured.events.length>=2&&captured.events.length<=MAX_EVENTS);
 const events=captured.events,terminal=result.ok?'measure_exit':'measure_cancel';
 assert(result.ok===true||result.code==='57014');assert.equal(events.at(-1).stage,terminal);assert.equal(events[0].stage,'measure_enter');
 const expected=PHASES;
 const prefix=result.ok?events:events.slice(0,-1);
 assert.deepEqual(prefix.map(x=>x.stage),expected.slice(0,prefix.length));
 if(result.ok)assert.equal(prefix.length,PHASES.length);
 for(let i=0;i<events.length;i++){
  assert.deepEqual(Object.keys(events[i]).sort(),['epoch_seconds','stage']);assert(STAGE.has(events[i].stage));assert(Number.isFinite(events[i].epoch_seconds));
  if(i)assert(events[i].epoch_seconds>=events[i-1].epoch_seconds);
 }
 const begin=events[0].epoch_seconds,elapsed=events.map(x=>({stage:x.stage,elapsed_ms:(x.epoch_seconds-begin)*1000}));assert(elapsed.at(-1).elapsed_ms<=45000);
 const paired={};
 for(const[name,enter,exit]of[
  ['source_locking','gen_sources_enter','gen_sources_exit'],['public_review','gen_review_enter','gen_review_exit'],
  ['review_DATA','data_enter','data_return'],['assignment_enumeration','data_assignments_enter','data_assignments_exit'],
  ['source_companions','gen_capture_enter','gen_capture_exit'],
 ]){const a=events.find(x=>x.stage===enter),b=events.find(x=>x.stage===exit);paired[name]={completed:Boolean(a&&b),duration_ms:a&&b?(b.epoch_seconds-a.epoch_seconds)*1000:null};}
 return{stage_trace_confirmed:true,events:elapsed,paired_diagnostic_intervals:paired,terminal,whole_notice_span_ms:elapsed.at(-1).elapsed_ms,instrumentation_overhead_included:true,performance_acceptance:false};
}

export function closedPhaseCustody(metadata){
 assert.equal(metadata.normal_return,true);assert.equal(metadata.private_file,'phase-markers-private.json');assert(/^[a-f0-9]{64}$/u.test(metadata.sha256));
 // Never forward arbitrary sink metadata or absolute private paths.
 return{private_file:metadata.private_file,sha256:metadata.sha256,normal_return:true};
}
export async function custodyStages(captured,result,sink){
 const metadata=await sink(captured);
 return{private_custody:closedPhaseCustody(metadata),...closedStageProjection(captured,result)};
}
