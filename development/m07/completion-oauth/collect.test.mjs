import test from 'node:test';
import assert from 'node:assert/strict';
import { command, projectBatch, compare } from './collect.mjs';

const deployment='dpl_1234567890Synthetic',since='2026-11-02T00:00:00.000Z',observed_at='2026-11-02T00:01:00.000Z';
const id='10000000-0000-4000-8000-000000000001',trace='20000000-0000-4000-8000-000000000001',principal='30000000-0000-4000-8000-000000000001';
const client='f2acafd5-d4b6-4176-b86c-067c57e45ecc',project='6da14b82-8458-451f-aa21-28cb6c85bdc5';
const scope={deployment,since,observed_at};
const row=(event,prefix='EPS MCP read receipt ')=>({type:'log',data:{timestamp:Date.parse(since)+1000,deploymentId:deployment,projectId:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',message:prefix+JSON.stringify(event),path:'/private?token=private-capability',requestId:'private-platform-id'}});
const summary=count=>({type:'summary',recordsReturned:count,timeRange:{start:since,end:observed_at},pagination:{hasMore:false,next:null},excludedIntervals:[]});
const lines=events=>events.map(event=>JSON.stringify(event)).join('\n');
const read=()=>({event:'eps.mcp.project_read_succeeded',entry_point:'mcp_http',operation:'get_project',success:true,request_id:id,principal_id:principal,client_id:client,project_ids:[project],trace_id:trace});
const token=()=>({event:'eps.mcp.verified_token',trace_id:trace,client_id:client,session_sha256:'a'.repeat(64),iat:Math.floor(Date.parse(since)/1000)-1,exp:Math.floor(Date.parse(since)/1000)+60});

test('fixed project/deployment query accepts only safe exact request or trace UUID and bounded time',()=>{
 const args=command(deployment,since,'read',id,Date.parse(observed_at));assert(args.includes('prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0'));assert(args.includes(`"eps.mcp.project_read_succeeded" AND "${id}"`));assert(!args.includes('--token'));
 for(const args of[[deployment,since,'read','private-value'],['https://private.invalid',since,'read',id],[deployment,'2026-10-01T00:00:00.000Z','read',id],[deployment,since,'arbitrary',id]])assert.throws(()=>command(...args,Date.parse(observed_at)));
});

test('closed collector joins actual tool ID to trace and discards old principal and platform metadata',()=>{
 const projected=projectBatch(lines([row(read()),summary(1)]),scope,'read',id);assert.equal(projected.trace_id,trace);assert.equal(projected.request_id,id);
 const encoded=JSON.stringify(projected);for(const raw of[principal,'private-capability','private-platform-id','path','principal_id'])assert(!encoded.includes(raw));
 const verified=projectBatch(lines([row(token(),'EPS MCP verified token '),summary(1)]),scope,'token',trace);assert.equal(verified.session_sha256,'a'.repeat(64));assert.deepEqual(Object.keys(verified).sort(),['client_id','event','exp','iat','logged_at','session_sha256','trace_id']);
});

test('selected event must fall inside the actual complete summary start/end range',()=>{
 const event=row(read());event.data.timestamp=Date.parse(since)+20000;
 const earlyEnd={...summary(1),timeRange:{start:since,end:new Date(Date.parse(since)+10000).toISOString()}};
 assert.throws(()=>projectBatch(lines([event,earlyEnd]),scope,'read',id));
 const exactEnd={...summary(1),timeRange:{start:since,end:new Date(event.data.timestamp).toISOString()}};
 assert.equal(projectBatch(lines([event,exactEnd]),scope,'read',id).request_id,id);
});

test('extra private fields, wrong bindings, truncated/incomplete/ambiguous windows and malformed payload refuse',()=>{
 const cases=[row({...read(),raw_token:'private-capability'}),row({...read(),trace_id:'private'}),row({...read(),request_id:trace}),{...row(read()),data:{...row(read()).data,truncated:true}},{...row(read()),data:{...row(read()).data,deploymentId:'dpl_WrongDeployment'}}];
 for(const event of cases)assert.throws(()=>projectBatch(lines([event,summary(1)]),scope,'read',id));
 for(const payload of[lines([summary(0)]),lines([row(read()),row(read()),summary(2)]),lines([row(read()),{...summary(1),pagination:{hasMore:true,next:'opaque'}}]),lines([row(read()),{...summary(1),excludedIntervals:[{start:since,end:observed_at}]}]),'private raw diagnostics','x'.repeat(2*1024*1024+1)])assert.throws(()=>projectBatch(payload,scope,'read',id));
 for(const event of[{...token(),session_sha256:principal},{...token(),client_id:principal},{...token(),iat:1.1},{...token(),private_payload:'private'},{...token(),exp:token().iat}])assert.throws(()=>projectBatch(lines([row(event,'EPS MCP verified token '),summary(1)]),scope,'token',trace));
});

function receipt(requestId,issued,expiry,logged){return{schema_version:'1.0',scope:'actual_Claude_request_id_correlated_verified_token_observation',read_only:true,deployment_id:deployment,project_id:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',request_id_source:'owner_supplied_actual_Claude_get_project_result',observed_at:new Date(logged+1000).toISOString(),since,project_read:{logged_at:new Date(logged).toISOString(),event:'eps.mcp.project_read_succeeded',request_id:requestId,trace_id:trace,client_id:client,project_id:project},verified_token:{logged_at:new Date(logged-100).toISOString(),event:'eps.mcp.verified_token',trace_id:trace,client_id:client,session_sha256:'a'.repeat(64),iat:issued,exp:expiry},source_seals:Object.fromEntries(['development/m07/completion-oauth/collect.mjs','development/m07/oauth-consent-fix/read-pilot-trace.mjs','apps/web/lib/mcp-auth.ts','apps/web/app/mcp/route.ts'].map(name=>[name,'b'.repeat(64)])),maximum_provider_reads:2,automatic_retry:false,raw_cli_persisted:false};}
test('natural-expiry comparison permits proactive refresh and explicitly retains rotation/revoke limitations',()=>{
 const start=Math.floor(Date.parse(since)/1000),before=receipt(id,start,start+3600,start*1000+1000),after=receipt(principal,start+3500,start+7100,(start+3601)*1000);
 const result=compare(before,after);assert.equal(result.result,'passed');assert.equal(result.same_session_verified,true);assert.equal(result.full_lifecycle_verified,false);assert.equal(result.refresh_token_rotation_storage_verified,false);assert.equal(result.old_expired_bearer_denial_collected,false);
 for(const change of[entry=>{entry.verified_token.session_sha256='c'.repeat(64);},entry=>{entry.project_read.logged_at=new Date((start+3599)*1000).toISOString();entry.verified_token.logged_at=entry.project_read.logged_at;},entry=>{entry.verified_token.iat=start;},entry=>{entry.deployment_id='private-capability';},entry=>{entry.verified_token.raw_token='private';}]){const wrong=JSON.parse(JSON.stringify(after));change(wrong);assert.throws(()=>compare(before,wrong));}
});

test('same-trace token event is correlated only within thirty seconds before and one second after the read',()=>{
 const start=Math.floor(Date.parse(since)/1000),before=receipt(id,start,start+3600,start*1000+1000),after=receipt(principal,start+3500,start+7100,(start+3601)*1000);
 for(const gap of[-1001,30001]){const wrong=JSON.parse(JSON.stringify(after));wrong.verified_token.logged_at=new Date(Date.parse(wrong.project_read.logged_at)-gap).toISOString();assert.throws(()=>compare(before,wrong));}
 for(const gap of[-1000,30000]){const edge=JSON.parse(JSON.stringify(after));edge.verified_token.logged_at=new Date(Date.parse(edge.project_read.logged_at)-gap).toISOString();assert.equal(compare(before,edge).result,'passed');}
});
