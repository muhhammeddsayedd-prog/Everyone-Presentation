import assert from 'node:assert/strict';
import test from 'node:test';
import {Buffer}from 'node:buffer';
import {PHASES,projectStageLines,closedStageProjection,custodyStages}from './markers.mjs';
const RUN='00000000-0000-4000-8000-000000000001';
const line=(stage,n,run=RUN)=>`NOTICE:  00000: EPS_STAGE_V1|${run}|${stage}|${(1000+n/10).toFixed(6)}`;
const capture=events=>({...projectStageLines(events.map((stage,n)=>line(stage,n)).join('\n'),RUN),after_normal_close:true,child_exit:0});

test('complete and cancelled fixed traces project paired intervals, never timing acceptance',()=>{
 const complete=closedStageProjection(capture(PHASES),{ok:true});
 assert.equal(complete.events.length,14);assert.equal(complete.paired_diagnostic_intervals.assignment_enumeration.completed,true);assert.equal(complete.performance_acceptance,false);
 const stopped=closedStageProjection(capture([...PHASES.slice(0,7),'measure_cancel']),{ok:false,code:'57014'});
 assert.equal(stopped.paired_diagnostic_intervals.source_locking.completed,true);assert.equal(stopped.paired_diagnostic_intervals.assignment_enumeration.completed,false);assert.equal(stopped.terminal,'measure_cancel');
 const afterReturn=closedStageProjection(capture([...PHASES,'measure_cancel']),{ok:false,code:'57014'});assert.equal(afterReturn.events.length,15);assert.equal(afterReturn.terminal,'measure_cancel');
});

test('raw private text, SQL, token-looking strings and foreign labels never escape strict scanner',()=>{
 const canary='PRIVATE_SQL_TOKEN_CANARY';
 const raw=['ERROR: 57014: '+canary,'SQL statement "'+canary+'"','NOTICE: '+canary,line('measure_enter',0),line('gen_enter',1),'NOTICE: 00000: EPS_STAGE_V1|'+RUN+'|'+canary+'|1001.0'].join('\n');
 const result=projectStageLines(raw,RUN);assert.equal(result.events.length,2);assert.equal(result.invalid_owned_marker_count,1);assert(!JSON.stringify(result).includes(canary));
 const wrong=projectStageLines(line('measure_enter',0,'00000000-0000-4000-8000-000000000002'),RUN);assert.equal(wrong.foreign_marker_count,1);assert.equal(wrong.events.length,0);
});

test('count/line/UTF8byte bounds, ordering, close identity and nonfinite values fail closed',()=>{
 assert.equal(projectStageLines('中'.repeat(50000),RUN).bounded_stderr,false);
 assert.equal(Buffer.byteLength('中'.repeat(50000))>128*1024,true);
 const many=projectStageLines(Array.from({length:16},(_,i)=>line('gen_enter',i)).join('\n'),RUN);assert.equal(many.events.length,15);assert.equal(many.invalid_owned_marker_count,1);
 assert.equal(projectStageLines('NOTICE: EPS_STAGE_V1|'+RUN+'|'+('x'.repeat(300))+'|1',RUN).invalid_owned_marker_count,1);
 assert.throws(()=>closedStageProjection(capture(['measure_enter','data_enter','measure_cancel']),{ok:false,code:'57014'}));
 const reversed=capture(['measure_enter','gen_enter','measure_cancel']);reversed.events[1].epoch_seconds=999;assert.throws(()=>closedStageProjection(reversed,{ok:false,code:'57014'}));
 const open=capture(PHASES);open.after_normal_close=false;assert.throws(()=>closedStageProjection(open,{ok:true}));
 const dead=capture(PHASES);dead.child_exit=3;assert.throws(()=>closedStageProjection(dead,{ok:true}));
});

test('private phase custody precedes any public projection and strips sink extras',async()=>{
 const events=capture(PHASES),order=[];
 const result=await custodyStages(events,{ok:true},async value=>{order.push('private');assert.equal(value,events);return{normal_return:true,private_file:'phase-markers-private.json',sha256:'a'.repeat(64),PRIVATE_SECRET:'DO_NOT_FORWARD'};});
 order.push('public');assert.deepEqual(order,['private','public']);assert(!JSON.stringify(result).includes('PRIVATE_SECRET'));assert(!JSON.stringify(result).includes('DO_NOT_FORWARD'));
 await assert.rejects(custodyStages(events,{ok:true},async()=>{throw Error('PRIVATE_SINK_FAILURE');}));
 await assert.rejects(custodyStages(events,{ok:true},async()=>({normal_return:true,private_file:'other-private-file.json',sha256:'a'.repeat(64)})));
});
