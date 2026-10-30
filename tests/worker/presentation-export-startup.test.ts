import assert from 'node:assert/strict';
import test from 'node:test';
import { rootCertificates } from 'node:tls';
import { verifySpecsWorkerStartup, SpecsWorkerStartupError } from '../../apps/worker/src/runtime-main.ts';
const environment={OPENAI_API_KEY:'synthetic-private-provider',OPENAI_EXTRACTION_MODEL:'synthetic-model',N8N_DISPATCH_URL:'https://synthetic.app.n8n.cloud/webhook/metadata',N8N_DISPATCH_SECRET:'synthetic-base-secret-long-enough',EPS_SPECS_PG_HOST:'aws-0-eu-west-1.pooler.supabase.com',EPS_SPECS_PG_PASSWORD:'synthetic-private-runtime-password-long',EPS_SPECS_PG_CA_BASE64:Buffer.from(rootCertificates[0]).toString('base64'),EPS_SPECS_FILES_ENABLED:'true',SUPABASE_URL:'https://pyibofyctwnqpvktepse.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_public',EPS_PRESENTATION_ENABLED:'true',N8N_PRESENTATION_DISPATCH_URL:'https://synthetic.app.n8n.cloud/webhook/eps-wf03-presentation-stage-v1',N8N_PRESENTATION_DISPATCH_SECRET:'c'.repeat(64),EPS_GUEST_EXPORTS_ENABLED:'true'};
const port={async getAssetAccess(){throw Error('not called');},async reserveOutput(){throw Error('not called');},async completeOutput(){throw Error('not called');}};
test('export startup explicitly enables op12 and composes shared verified assets without processing work',async()=>{
 let factories=0;const result=await verifySpecsWorkerStartup(environment,(async(_config:unknown,_dependencies:unknown,_files:unknown,_replay:unknown,_candidate:boolean,presentation:boolean,exports:boolean)=>{factories++;assert.equal(presentation,true);assert.equal(exports,true);return{verifiedFunctionOperations:12,presentationFiles:port,async mintReviewMediaGrant(){throw Error('not called');},async close(){}};})as never);
 assert.equal(factories,1);assert.ok(result.presentationExport);assert.equal(result.presentationExport.assets,result.presentation!.assets);
});
test('export startup denies missing presentation scope, invalid flag, missing mint port or eleven-operation role',async()=>{
 for(const patch of[{EPS_GUEST_EXPORTS_ENABLED:'yes'},{EPS_PRESENTATION_ENABLED:'false'}]){let factories=0;await assert.rejects(verifySpecsWorkerStartup({...environment,...patch},(async()=>{factories++;})as never),e=>e instanceof SpecsWorkerStartupError&&e.code==='PRESENTATION_RUNTIME_CONFIGURATION_INVALID');assert.equal(factories,0);}
 for(const patch of[{verifiedFunctionOperations:11,async mintReviewMediaGrant(){}},{verifiedFunctionOperations:12}]){let closed=0;await assert.rejects(verifySpecsWorkerStartup(environment,(async()=>({presentationFiles:port,...patch,async close(){closed++;}}))as never),e=>e instanceof SpecsWorkerStartupError&&e.code==='PRESENTATION_RUNTIME_CONFIGURATION_INVALID');assert.equal(closed,1);}
});
