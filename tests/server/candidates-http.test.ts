import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { handleCandidatesRequest,isCandidatesRoute } from '../../apps/web/lib/candidates-http.ts';
import type { CentralCandidates } from '@eps/central';
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
test('candidate HTTP keeps current permission failures and leaves future frame extraction to the worker route',async()=>{
 const denial=new DomainError('CAPABILITY_REQUIRED','Producer confirmation required.',403);const service={confirmCandidateReviewed:async()=>{throw denial;}} as unknown as CentralCandidates;
 await assert.rejects(handleCandidatesRequest(request('candidates/candidate/reviewed','POST',{row_version:1}),['candidates','candidate','reviewed'],actor,service,context),error=>error===denial);
 assert.equal(isCandidatesRoute(['candidate-media','media','frames','extract']),false);
});
