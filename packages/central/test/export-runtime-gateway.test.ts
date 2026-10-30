import assert from 'node:assert/strict';
import test from 'node:test';
import { rootCertificates } from 'node:tls';
import { createSpecsRuntimeGateway, readSpecsRuntimeConfig, SpecsRuntimeGatewayError, type SpecsRuntimePool } from '../src/specs-runtime-gateway.ts';
const env={EPS_SPECS_PG_HOST:'aws-0-eu-west-1.pooler.supabase.com',EPS_SPECS_PG_PASSWORD:'synthetic-not-real-export-runtime',EPS_SPECS_PG_CA_BASE64:Buffer.from(rootCertificates[0]).toString('base64')};
const id=(n:number)=>`a6060000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={job_id:id(1),attempt_id:id(2),lease_token:'b'.repeat(64)};
const fileConfig={storageOrigin:'https://pyibofyctwnqpvktepse.supabase.co',publishableKey:'sb_publishable_synthetic_public'};
function fixture(operations=12){const queries:{text:string;values:unknown[]}[]=[];let response:unknown={grant_id:id(3),grant_token:'g'.repeat(43),version_id:id(4),review_link_id:id(5),export_id:id(6),export_revision:1,expires_at:new Date(Date.now()+86400000).toISOString()};let closed=false;
 const pool:SpecsRuntimePool={async connect(){return{async query(text,values=[]){queries.push({text,values});if(text.includes(' as allowed'))return{rows:[{allowed:true,function_operations:operations}]};if(text.startsWith('select eps.'))return{rows:[{value:response}]};return{rows:[]};},release(){}};},async end(){closed=true;},on(){}};
 return{queries,pool,response:(v:unknown)=>{response=v;},closed:()=>closed};}
test('export gateway pins exact twelve operations and exposes one explicit scoped mint port',async()=>{
 const f=fixture();const gateway=await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:()=>f.pool},fileConfig,undefined,false,true,true);assert.equal(gateway.verifiedFunctionOperations,12);
 const identity=f.queries[0+1]?.text??f.queries.find(q=>q.text.includes(' as allowed'))!.text;assert.ok(identity.includes('count(*)=12'));assert.ok(identity.includes("to_regprocedure('eps.mint_review_media_grant(jsonb)')"));
 const grant=await gateway.mintReviewMediaGrant(scope,new AbortController().signal)as Record<string,unknown>;assert.equal(grant.grant_token,'g'.repeat(43));
 const call=f.queries.find(q=>q.text==='select eps.mint_review_media_grant($1::jsonb) as value')!;assert.deepEqual(JSON.parse(call.values[0]as string),scope);assert.equal(f.queries.filter(q=>q.text.includes(' as allowed')).length,2);
 await gateway.close();assert.equal(f.closed(),true);
});
test('export-enabled gateway rejects an eleven-operation identity and malformed grant response',async()=>{
 const old=fixture(11);await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:()=>old.pool},fileConfig,undefined,false,true,true),e=>e instanceof SpecsRuntimeGatewayError&&e.code==='RUNTIME_ROLE_UNVERIFIED');assert.equal(old.closed(),true);
 const f=fixture();const gateway=await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:()=>f.pool},fileConfig,undefined,false,true,true);f.response({grant_token:'synthetic-private-invalid'});await assert.rejects(gateway.mintReviewMediaGrant(scope,new AbortController().signal),e=>e instanceof SpecsRuntimeGatewayError&&e.code==='RUNTIME_RESPONSE_INVALID'&&!e.message.includes('synthetic-private'));await gateway.close();
});
test('old eleven-operation startup never silently mints, and export startup requires existing presentation assets',async()=>{
 const f=fixture(11);const gateway=await createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:()=>f.pool},fileConfig,undefined,false,true);await assert.rejects(gateway.mintReviewMediaGrant(scope,new AbortController().signal),e=>e instanceof SpecsRuntimeGatewayError&&e.code==='FEATURE_NOT_IMPLEMENTED');assert.equal(f.queries.some(q=>q.text.includes('select eps.mint_review_media_grant(')),false);await gateway.close();
 await assert.rejects(createSpecsRuntimeGateway(readSpecsRuntimeConfig(env),{poolFactory:()=>fixture().pool},fileConfig,undefined,false,false,true),e=>e instanceof SpecsRuntimeGatewayError&&e.code==='RUNTIME_CONFIG_INVALID');
});
