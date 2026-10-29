import test from 'node:test';import assert from 'node:assert/strict';
import {DomainError}from '@eps/domain';
import type{CastingOperations}from '../../packages/domain/src/casting-types';
import{handleCastingRequest,isCastingRoute}from '../../apps/web/lib/casting-http';
const actor={principal_id:'verified-acting-user'},ctx={requestId:'casting-http',clientType:'mcp' as const,idempotencyKey:'stable-assignment-intent'};
function req(path:string,method='GET',body?:unknown){return new Request('http://127.0.0.1/api/v1/'+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
function stub(){const calls:unknown[][]=[];const service=new Proxy({}as CastingOperations,{get:(_t,name)=>async(...args:unknown[])=>{calls.push([name,...args]);return name==='listAssignments'?{data:[],page:{next_cursor:null}}:{success:true,affected_ids:[]};}});return{calls,service};}
test('casting route ownership preserves unrelated slot, requirements and candidate paths',()=>{
 for(const path of ['workspaces/w/assignments','workspaces/w/order','assignments/a','assignments/a/remove','slots/s/main','slots/s/main/undo'])assert.equal(isCastingRoute(path.split('/')),true);
 for(const path of ['slots/s','roles/r/slots','workspaces/w/roles','workspaces/w/candidates','assignments/a/remove/extra','slots/s/main/undo/extra'])assert.equal(isCastingRoute(path.split('/')),false);
});
test('assignment list rejects duplicate, unknown and invalid filters before service access',async()=>{
 const{service,calls}=stub(),s=['workspaces','w','assignments'];
 for(const q of ['?output_type=shortlist&output_type=selection','?limit=101','?limit=1.5','?principal_id=forged','?output_type=everything'])await assert.rejects(handleCastingRequest(req(s.join('/')+q),s,actor,service,ctx),DomainError);
 assert.equal(calls.length,0);
 const response=await handleCastingRequest(req(s.join('/')+'?output_type=shortlist&limit=20'),s,actor,service,ctx);
 assert.match(response.headers.get('cache-control')!,/private.*no-store|no-store.*private/u);
 assert.deepEqual(calls[0],['listAssignments',actor,'w',{output_type:'shortlist',limit:20}]);
});
test('assignment creation forwards the acting principal and stable intent without any Selection flag',async()=>{
 const{service,calls}=stub(),s=['workspaces','w','assignments'],body={slot_id:'s',workspace_candidate_id:'p',expected_slot_row_version:3,shortlist_included:true};
 const response=await handleCastingRequest(req(s.join('/'),'POST',body),s,actor,service,ctx);assert.equal(response.status,201);
 assert.deepEqual(calls[0],['createAssignment',actor,'w',body,ctx]);
 for(const extra of [{position:'main'},{selection_included:false},{principal_id:'forged'}])await assert.rejects(handleCastingRequest(req(s.join('/'),'POST',{...body,...extra}),s,actor,service,ctx),DomainError);
 await assert.rejects(handleCastingRequest(req(s.join('/'),'POST',body),s,actor,service,{requestId:'missing'}),DomainError);assert.equal(calls.length,1);
});
test('Main and Undo use separate operations, validate the path and preserve server-bound inverse input',async()=>{
 const{service,calls}=stub(),main=['slots','s','main'],undo=[...main,'undo'];
 const body={assignment_id:'a',expected_slot_row_version:4,replacement_behavior:'move_previous_to_backup'};
 await handleCastingRequest(req(main.join('/'),'PUT',body),main,actor,service,ctx);
 const inverse={undo_event_id:'event',slot_id:'s',expected_slot_row_version:5,restore_assignment_positions:[{assignment_id:'a',position:'option'}]};
 await handleCastingRequest(req(undo.join('/'),'POST',inverse),undo,actor,service,ctx);
 assert.deepEqual(calls,[['setSlotMain',actor,'s',body,ctx],['undoSlotMain',actor,'s',inverse,ctx]]);
 await assert.rejects(handleCastingRequest(req(undo.join('/'),'POST',{...inverse,slot_id:'foreign'}),undo,actor,service,ctx),DomainError);
 await assert.rejects(handleCastingRequest(req('assignments/a','PATCH',{row_version:2,position:'main'}),['assignments','a'],actor,service,ctx),DomainError);assert.equal(calls.length,2);
});
test('assignment mutation methods and query authority are rejected before persistence',async()=>{
 const{service,calls}=stub();
 for(const[path,method,body]of [['assignments/a/remove','DELETE',{}],['slots/s/main/undo','PUT',{}],['assignments/a?actor=another','PATCH',{row_version:1}]]as const){const s=path.split('?')[0].split('/');await assert.rejects(handleCastingRequest(req(path,method,body),s,actor,service,ctx),DomainError);}
 assert.equal(calls.length,0);
});
test('casting forwards permission and concurrency errors intact for HTTP and MCP consumers',async()=>{
 const denied=new DomainError('STALE_RESOURCE_VERSION','Reload the slot before changing Main.',409);
 const service={setSlotMain:async()=>{throw denied;}}as unknown as CastingOperations,s=['slots','s','main'];
 await assert.rejects(handleCastingRequest(req(s.join('/'),'PUT',{assignment_id:null,expected_slot_row_version:4,replacement_behavior:'move_previous_to_backup'}),s,actor,service,ctx),error=>error===denied);
});
