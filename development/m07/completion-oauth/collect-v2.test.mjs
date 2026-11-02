import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { command as originalCommand } from './collect.mjs';
import { commandV2, projectBatch, compare, collectObservation, executionReceipt, QUERY_SCHEMA } from './collect-v2.mjs';

const deployment='dpl_1234567890Synthetic',since='2026-11-02T00:00:00.000Z',observed='2026-11-02T00:01:00.000Z';
const id='10000000-0000-4000-8000-000000000001',trace='20000000-0000-4000-8000-000000000001';
const principal='30000000-0000-4000-8000-000000000001',client='f2acafd5-d4b6-4176-b86c-067c57e45ecc';
const root=path.resolve(import.meta.dirname,'../../..');
const main=root.endsWith('-Production-Admission')?root.slice(0,-'-Production-Admission'.length):root;
const bareQuery=/^eps\.mcp\.(?:project_read_succeeded|verified_token) AND [a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;

test('actual pinned CLI 65.8 help explicitly rejects quoted bare message words',async()=>{
 const source=await readFile(path.join(main,'.local/m07-pilot/tooling/node_modules/vercel/dist/chunks/chunk-2PYFJXKS.js'));
 assert.equal(createHash('sha256').update(source).digest('hex'),'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b');
 const text=source.toString('utf8');
 assert(text.includes('Search messages with unquoted words; bare "unexpected token" is rejected.'));
 assert(text.includes('Quotes work only in field values.'));
 for(const kind of ['read','token'])assert.equal(bareQuery.test(originalCommand(deployment,since,kind,id,Date.parse(observed))[13]),false);
});

test('v2 fixes only the query argument using the original safe command admission',()=>{
 for(const kind of ['read','token']){
  const original=originalCommand(deployment,since,kind,id,Date.parse(observed));
  const actual=commandV2(deployment,since,kind,id,Date.parse(observed));
  assert(bareQuery.test(actual[13]));
  assert.equal(actual[13],`eps.mcp.${kind==='read'?'project_read_succeeded':'verified_token'} AND ${id}`);
  assert.deepEqual(actual.filter((_,index)=>index!==13),original.filter((_,index)=>index!==13));
 }
 for(const args of [[deployment,since,'read','x" OR secret'],[deployment,since,'token',null],[deployment,since,'unknown',id],['https://private.invalid',since,'read',id],[deployment,'2026-10-01T00:00:00.000Z','read',id]])assert.throws(()=>commandV2(...args,Date.parse(observed)));
});

test('v2 reuses closed original projection and rejects incomplete provider windows',()=>{
 const event={event:'eps.mcp.project_read_succeeded',entry_point:'mcp_http',operation:'get_project',success:true,request_id:id,principal_id:principal,client_id:client,project_ids:['6da14b82-8458-451f-aa21-28cb6c85bdc5'],trace_id:trace};
 const log={type:'log',data:{timestamp:Date.parse(since)+1000,deploymentId:deployment,projectId:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',message:'EPS MCP read receipt '+JSON.stringify(event),path:'/private?token=never-retain'}};
 const summary={type:'summary',recordsReturned:1,timeRange:{start:since,end:observed},pagination:{hasMore:false,next:null},excludedIntervals:[]};
 const lines=rows=>rows.map(row=>JSON.stringify(row)).join('\n');
 const result=projectBatch(lines([log,summary]),{deployment,since,observed_at:observed},'read',id);
 assert.equal(result.request_id,id);assert.equal(result.trace_id,trace);
 for(const forbidden of ['principal_id',principal,'never-retain','private?token'])assert(!JSON.stringify(result).includes(forbidden));
 assert.throws(()=>projectBatch(lines([log,{...summary,pagination:{hasMore:true,next:'opaque'}}]),{deployment,since,observed_at:observed},'read',id));
 assert.throws(()=>projectBatch(lines([log,log,{...summary,recordsReturned:2}]),{deployment,since,observed_at:observed},'read',id));
 assert.equal(typeof compare,'function');
});

const sources=['development/m07/completion-oauth/collect.mjs','development/m07/oauth-consent-fix/read-pilot-trace.mjs','apps/web/lib/mcp-auth.ts','apps/web/app/mcp/route.ts'];
const seals=Object.fromEntries(sources.map(name=>[name,'b'.repeat(64)]));
function providerRows(kind,requestId,logged,issued,expiry,end){
 const event=kind==='read'?{event:'eps.mcp.project_read_succeeded',entry_point:'mcp_http',operation:'get_project',success:true,request_id:requestId,principal_id:principal,client_id:client,project_ids:['6da14b82-8458-451f-aa21-28cb6c85bdc5'],trace_id:trace}:{event:'eps.mcp.verified_token',trace_id:trace,client_id:client,session_sha256:'a'.repeat(64),iat:issued,exp:expiry};
 return[{type:'log',data:{timestamp:logged,deploymentId:deployment,projectId:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',message:(kind==='read'?'EPS MCP read receipt ':'EPS MCP verified token ')+JSON.stringify(event),path:'/private?token=never-retain'}},{type:'summary',recordsReturned:1,timeRange:{start:since,end:new Date(end).toISOString()},pagination:{hasMore:false,next:null},excludedIntervals:[]}].map(row=>JSON.stringify(row)).join('\n');
}
test('exact two reads join request to returned trace and remain compatible with frozen compare',async()=>{
 const start=Date.parse(since),issued=start/1000,calls=[];
 async function collect(requestId,logged,iat,exp,now){
  let count=0;
  const result=await collectObservation({deployment,since,requestId},{seals:async()=>seals,now:()=>now,read:async args=>{calls.push(args);assert.equal(count<2,true);return providerRows(count++===0?'read':'token',requestId,logged,iat,exp,now);}});
  assert.equal(count,2);return result;
 }
 const before=await collect(id,start+1000,issued,issued+60,start+2000);
 const after=await collect(principal,start+61000,issued+30,issued+120,start+62000);
 assert.equal(calls.length,4);assert.equal(calls[0][13],`eps.mcp.project_read_succeeded AND ${id}`);assert.equal(calls[1][13],`eps.mcp.verified_token AND ${trace}`);
 assert.deepEqual(Object.keys(before.source_seals),sources);assert.equal(compare(before,after).result,'passed');
 assert(!JSON.stringify(before).includes('never-retain'));assert(!JSON.stringify(before).includes(principal));
 let reads=0;
 await assert.rejects(collectObservation({deployment,since,requestId:id},{seals:async()=>reads===0?seals:{...seals,[sources[0]]:'c'.repeat(64)},now:()=>start+2000,read:async()=>providerRows(reads++===0?'read':'token',id,start+1000,issued,issued+60,start+2000)}));
 assert.equal(reads,2);
 reads=0;
 await assert.rejects(collectObservation({deployment,since,requestId:id},{seals:async()=>seals,now:()=>start+2000,read:async()=>{reads++;throw Error('synthetic raw private failure');}}));assert.equal(reads,1);
});

test('separate provenance binds v2 query/source and exact observation bytes without raw CLI or old-entry execution claims',()=>{
 const pins={collector_sha256:'d'.repeat(64),cli_version:'65.8.0',cli_entry_sha256:'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',cli_query_help_sha256:'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b',query_schema:QUERY_SCHEMA};
 const artifact={path:'tracking/evidence/m07/completion-oauth/synthetic-request-observation.json',sha256:'e'.repeat(64)};
 const input={executionId:id,pins,observedAt:observed,stage:'complete',reads:2,result:'passed',artifact,sourceSeals:seals,raw_stderr:'never-retain',token:'never-retain'};
 const report=executionReceipt(input);assert.deepEqual(report.observation,artifact);assert.deepEqual(report.observation_source_seals,seals);assert.equal(report.original_entrypoint_executed,false);assert.equal(report.collector_sha256,pins.collector_sha256);
 assert(!JSON.stringify(report).includes('never-retain'));assert.equal(report.raw_cli_persisted,false);
 for(const change of [{reads:3},{reads:1},{artifact:null},{pins:{...pins,query_schema:'quoted-bare-words'}},{pins:{...pins,cli_version:'66.0.0'}}])assert.throws(()=>executionReceipt({...input,...change}));
 const refused=executionReceipt({...input,stage:'collect',result:'unconfirmed',reads:1,artifact:null,sourceSeals:null});assert.equal(refused.result,'unconfirmed');assert.equal(refused.observation,null);
});
