import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { handleCandidatesRequest,isCandidatesRoute } from '../../apps/web/lib/candidates-http.ts';
import type { CandidatesOperations as CentralCandidates } from '../../apps/web/lib/candidates-http.ts';
const actor={principal_id:'verified-current-user'};
const context={requestId:'candidate-http-test',clientType:'mcp' as const,idempotencyKey:'synthetic-candidate-intent'};
function request(path:string,method='GET',body?:unknown){return new Request('http://127.0.0.1/api/v1/'+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
test('candidate search refuses unknown/duplicate filters before access and preserves include-unknown semantics',async()=>{
 const calls:unknown[][]=[];const service={searchCandidates:async(...args:unknown[])=>{calls.push(args);return {data:[],page:{next_cursor:null}};}} as unknown as CentralCandidates;
 for(const query of ['?include_unknown=no','?include_unknown=true&include_unknown=false','?limit=0','?principal_id=another'])await assert.rejects(handleCandidatesRequest(request('candidates'+query),['candidates'],actor,service,context),DomainError);
 assert.equal(calls.length,0);
 const response=await handleCandidatesRequest(request('candidates?include_unknown=false&language=Arabic&limit=25'),['candidates'],actor,service,context);
 assert.match(response.headers.get('cache-control')!,/\bno-store\b/u);assert.match(response.headers.get('cache-control')!,/\bprivate\b/u);assert.deepEqual(calls[0],[actor,{include_unknown:false,language:'Arabic',limit:25}]);
});
test('Reviewed route uses the published confirmation schema and passes the same actor, row version and intent',async()=>{
 let received:unknown[]=[];const service={confirmCandidateReviewed:async(...args:unknown[])=>{received=args;return {id:'candidate'};}} as unknown as CentralCandidates;
 const path=['candidates','candidate','reviewed'];
 const response=await handleCandidatesRequest(request(path.join('/'),'POST',{row_version:4}),path,actor,service,context);assert.equal(response.status,200);assert.deepEqual(received,[actor,'candidate',{row_version:4},context]);
 await assert.rejects(handleCandidatesRequest(request(path.join('/'),'POST',{row_version:4,principal_id:'forged'}),path,actor,service,context),DomainError);
});
test('candidate HTTP keeps current permission failures and recognizes only the exact frame route',async()=>{
 const denial=new DomainError('CAPABILITY_REQUIRED','Producer confirmation required.',403);const service={confirmCandidateReviewed:async()=>{throw denial;}} as unknown as CentralCandidates;
 await assert.rejects(handleCandidatesRequest(request('candidates/candidate/reviewed','POST',{row_version:1}),['candidates','candidate','reviewed'],actor,service,context),error=>error===denial);
 assert.equal(isCandidatesRoute(['candidate-media','media','frames','extract']),true);
 assert.equal(isCandidatesRoute(['candidate-media','media','frames','extract','extra']),false);
});
test('role filter suggestions use the current actor and reject arbitrary parameters',async()=>{
 const calls:unknown[][]=[];const service={suggestCandidateFilters:async(...args:unknown[])=>{calls.push(args);return {role_id:'role',include_unknown:true,suggested_filters:[],explanations:[]};}} as unknown as CentralCandidates;
 const path=['roles','role','candidate-filters'];assert.equal(isCandidatesRoute(path),true);
 const response=await handleCandidatesRequest(request(path.join('/')),path,actor,service,context);
 assert.equal(response.status,200);assert.deepEqual(calls,[[actor,'role']]);assert.match(response.headers.get('cache-control')!,/no-store/u);
 await assert.rejects(handleCandidatesRequest(request(path.join('/')+'?principal_id=another'),path,actor,service,context),DomainError);
 assert.equal(calls.length,1);
});
test('chosen timestamp extraction uses the bounded schema and same actor intent',async()=>{
 const calls:unknown[][]=[];const service={extractCandidateFrames:async(...args:unknown[])=>{calls.push(args);return {job_id:'job',resource_id:'media',poll_url:'/api/v1/jobs/job',status:'queued'};}} as unknown as CentralCandidates;
 const path=['candidate-media','media','frames','extract'];const body={source_asset_id:'source',timestamps_ms:[1250,5000]};
 const response=await handleCandidatesRequest(request(path.join('/'),'POST',body),path,actor,service,context);
 assert.equal(response.status,202);assert.deepEqual(calls,[[actor,'media',body,context]]);
 await assert.rejects(handleCandidatesRequest(request(path.join('/'),'POST',{...body,principal_id:'other'}),path,actor,service,context),DomainError);
 await assert.rejects(handleCandidatesRequest(request(path.join('/')+'?url=https://outside.invalid','POST',body),path,actor,service,context),DomainError);
 await assert.rejects(handleCandidatesRequest(request(path.join('/'),'PUT',{row_version:1,selected_frame_asset_ids:[]}),path,actor,service,context),DomainError);
 assert.equal(calls.length,1);
});
test('supporting-file routes keep pagination, revision and acting-user authority',async()=>{
 const calls:unknown[][]=[];const service={listCandidateSupport:async(...args:unknown[])=>{calls.push(args);return {data:[],page:{next_cursor:null}};},archiveCandidateSupport:async(...args:unknown[])=>{calls.push(args);return {ok:true};}} as unknown as CentralCandidates;
 const list=['candidates','candidate','supporting-files'];const archive=['candidate-support','support','archive'];
 assert.equal(isCandidatesRoute(archive),true);
 assert.equal((await handleCandidatesRequest(request(list.join('/')+'?limit=25'),list,actor,service,context)).status,200);
 assert.deepEqual(calls[0],[actor,'candidate',{limit:25}]);
 assert.equal((await handleCandidatesRequest(request(archive.join('/'),'POST',{row_version:2}),archive,actor,service,context)).status,200);
 assert.deepEqual(calls[1],[actor,'support',{row_version:2},context]);
 await assert.rejects(handleCandidatesRequest(request(list.join('/')+'?principal_id=other'),list,actor,service,context),DomainError);
 await assert.rejects(handleCandidatesRequest(request(archive.join('/'),'POST',{row_version:2,delete_asset:true}),archive,actor,service,context),DomainError);
 assert.equal(calls.length,2);
});
