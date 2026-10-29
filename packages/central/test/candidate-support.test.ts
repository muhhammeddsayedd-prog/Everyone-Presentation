import assert from 'node:assert/strict';import test from 'node:test';import {DomainError} from '@eps/domain';
import {createBearerUserClient} from '../src/client.ts';import {createCentralCandidateSupport} from '../src/candidate-support.ts';
const principal='10000000-0000-4000-8000-000000000001',candidate='20000000-0000-4000-8000-000000000001',support='30000000-0000-4000-8000-000000000001',asset='40000000-0000-4000-8000-000000000001';
const row={id:support,row_version:1,candidate_id:candidate,created_at:'2026-10-29T09:00:00Z',asset:{id:asset,purpose:'candidate_support',filename:'synthetic.txt',mime_type:'text/plain',size_bytes:50,sha256:'a'.repeat(64),status:'ready',duration_ms:null,width:null,height:null,source_asset_id:null,source_timestamp_ms:null,created_at:'2026-10-29T09:00:00Z'}};
async function harness(){let response:unknown={data:[row],page:{next_cursor:null}};const requests:{body:Record<string,unknown>;headers:Headers}[]=[];const client=createBearerUserClient({url:'https://synthetic-support.example.invalid',publishableKey:'sb_publishable_synthetic',accessToken:'synthetic-acting-token'},{fetch:async(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input));if(url.pathname==='/auth/v1/user')return Response.json({id:principal,role:'authenticated',aud:'authenticated',is_anonymous:false});requests.push({body:JSON.parse(String(init?.body)),headers:new Headers(init?.headers)});return Response.json(response);}});return{api:await createCentralCandidateSupport(client),requests,set:(v:unknown)=>{response=v;}};}
const code=(v:string)=>(e:unknown)=>e instanceof DomainError&&e.code===v;
test('support list projects exact candidate and bounded cursor page while archive carries stable mutation correlation',async()=>{
 const h=await harness();assert.deepEqual(await h.api.listCandidateSupport({principal_id:principal},candidate,{limit:1}),{data:[row],page:{next_cursor:null}});assert.equal(h.requests[0].body.p_limit,1);
 h.set({ok:true});assert.deepEqual(await h.api.archiveCandidateSupport({principal_id:principal},support,{row_version:1},{idempotencyKey:'synthetic-support-archive',requestId:'synthetic-request',clientType:'mcp'}),{success:true,affected_ids:[support]});assert.equal(h.requests[1].body.p_idempotency_key,'synthetic-support-archive');assert.equal(h.requests[1].headers.get('X-EPS-Request-ID'),'synthetic-request');assert.equal(h.requests[1].headers.get('X-EPS-Client-Type'),'mcp');
});

test('support archive rejects unsupported request fields and never treats malformed private acknowledgements as Success',async()=>{
 const h=await harness();const context={idempotencyKey:'synthetic-support-archive'};
 for(const input of [{row_version:1,reason:null},{row_version:1,reason:'Unsupported reason'},{row_version:1,delete_asset:true},[],null])await assert.rejects(h.api.archiveCandidateSupport({principal_id:principal},support,input as never,context),code('INVALID_REQUEST'));
 assert.equal(h.requests.length,0);
 for(const acknowledgement of [{ok:false},{ok:'true'},{ok:true,private_payload:'must-not-escape'},{success:true,affected_ids:[support]},null,[]]){
  h.set(acknowledgement);await assert.rejects(h.api.archiveCandidateSupport({principal_id:principal},support,{row_version:1},context),error=>code('CENTRAL_RESPONSE_INVALID')(error)&&!JSON.stringify(error).includes('must-not-escape'));
 }
});
test('foreign actor, unknown page inputs and forged support DTOs never become public attachments',async()=>{
 const h=await harness();await assert.rejects(h.api.listCandidateSupport({principal_id:asset},candidate),code('ACCESS_DENIED'));await assert.rejects(h.api.listCandidateSupport({principal_id:principal},candidate,{limit:101}),code('INVALID_REQUEST'));await assert.rejects(h.api.listCandidateSupport({principal_id:principal},candidate,{raw_query:'private'} as never),code('INVALID_REQUEST'));assert.equal(h.requests.length,0);
 for(const forged of [{...row,candidate_id:asset},{...row,asset:{...row.asset,status:['ready']}},{...row,asset:{...row.asset,provider_payload:'private'}},{...row,asset:{...row.asset,mime_type:'text/html'}}]){h.set({data:[forged],page:{next_cursor:null}});await assert.rejects(h.api.listCandidateSupport({principal_id:principal},candidate),code('CENTRAL_RESPONSE_INVALID'));}
 await assert.rejects(h.api.archiveCandidateSupport({principal_id:principal},support,{row_version:1},{idempotencyKey:'x'}),code('IDEMPOTENCY_KEY_REQUIRED'));
});
