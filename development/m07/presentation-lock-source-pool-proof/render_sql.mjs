/** Test-only renderer of actual source templates with fixed synthetic bindings. */
import ts from 'typescript';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import process from 'node:process';
import { literal,json } from '../presentation-lock-source-proof/proof.mjs';
const uuid='00000000-0000-4000-8000-000000000001';
const text=await readFile(new URL('./cases.mjs',import.meta.url),'utf8');
const source=ts.createSourceFile('cases.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const profile={workspace:uuid,series:uuid,project:uuid};
const results=[];
for(const share of[false,true])for(const table of['public.project_memberships','public.app_capability_grants']){
 const scope={literal,json,ACTOR:uuid,workspace:uuid,variant:'old',array:"array['"+uuid+"'::uuid]::uuid[]",relation:'eps.roles',key:{id:uuid,candidate_media_id:uuid,asset_id:uuid},p:profile,holder:{pid:11},writer:{pid:12},observer:{pid:13},contender:{pid:14},blocker:{pid:15},input:{slot_id:uuid},pair:{slot:uuid,pool:uuid,slot_revision:1},table,predicate:"principal_id='"+uuid+"'::uuid",pre:{principal_id:uuid},change:'membership',share,ctx:{id:()=>uuid,profiles:{large:profile,control:profile},runId:uuid}};
 const visit=node=>{
  if(ts.isTemplateExpression(node)||ts.isNoSubstitutionTemplateLiteral(node)){
   const value=vm.runInNewContext(node.getText(source),scope,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
   if(typeof value==='string'&&/^\s*(?:select|begin|reset role|do |update|delete|insert|rollback)/iu.test(value))results.push(value);
  }else if(ts.isStringLiteral(node)&&/^\s*(?:select|begin|reset role|do |update|delete|insert|rollback|set local)/iu.test(node.text))results.push(node.text);
  ts.forEachChild(node,visit);
 };
 visit(source);
}
process.stdout.write(JSON.stringify([...new Set(results)]));
