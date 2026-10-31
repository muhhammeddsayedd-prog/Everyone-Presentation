import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseLogShape, DEPLOYMENT, INSTANCE } from './daemon-log-shape.mjs';
const start=Date.parse('2026-10-31T00:29:00Z');const end=start+600000;
const stream = data => [JSON.stringify({type:'log',data}),JSON.stringify({type:'summary',recordsReturned:1,
  timeRange:{start:new Date(start).toISOString(),end:new Date(end).toISOString()},pagination:{hasMore:false,next:null},excludedIntervals:[]})].join('\n');
test('shape diagnostics return only fixed key/type inventories and binding booleans, never arbitrary keys or values',()=>{
  const row={timestamp:start+50000,source:'daemon',daemonName:'worker',daemonInstanceId:INSTANCE,deploymentId:DEPLOYMENT,environment:'production',
    message:'SYNTHETIC_PRIVATE',attributes:{'SYNTHETIC_PRIVATE_KEY':'SYNTHETIC_PRIVATE'}};
  const value=diagnoseLogShape(stream(row),{start,end});
  assert.equal(value.records,1);assert.equal(value.fields.timestamp.number,1);assert.equal(value.bindings.instance.top_match,1);
  assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE'));assert.equal(value.startup_verified,false);
});
test('known Node error codes and patterns are counted even for unbound records, with no error text',()=>{
  const value=diagnoseLogShape(stream({message:'SYNTHETIC_PRIVATE Error [ERR_MODULE_NOT_FOUND]: Cannot find package; SyntaxError requested module does not provide an export named'}),{start,end});
  assert.equal(value.node_codes.ERR_MODULE_NOT_FOUND,1);assert.equal(value.patterns.named_export_missing,1);
  assert.equal(value.patterns.syntax_error,1);assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE'));
});
test('exact fixed JSON startup/failure markers are diagnostic counts and never grant acceptance',()=>{
  const valid={event:'specs_worker_started',authentication:'narrow_database_login',orchestration:'n8n_required'};
  const value=diagnoseLogShape(stream({message:JSON.stringify(valid)}),{start,end});
  assert.equal(value.fixed_events_unbound.worker_started,1);assert.equal(value.startup_verified,false);
  assert.equal(diagnoseLogShape(stream({message:JSON.stringify({...valid,private:'SYNTHETIC_PRIVATE'})}),{start,end}).fixed_events_unbound.worker_started,0);
});
test('alternate timestamp units/attributes are distinguished without returning data and malformed streams fail closed',()=>{
  const value=diagnoseLogShape(stream({timestamp:(start+1000)/1000,attributes:{daemonInstanceId:INSTANCE,deploymentId:DEPLOYMENT,'scope.type':'target','scope.value':'production'}}),{start,end});
  assert.equal(value.timestamp_shapes.epoch_seconds_in_window,1);assert.equal(value.bindings.instance.attribute_match,1);
  for(const bad of ['SYNTHETIC_PRIVATE',stream({})+'\n'+JSON.stringify({type:'log',data:{}}),'x'.repeat(1048577)])assert.throws(()=>diagnoseLogShape(bad,{start,end}));
});
