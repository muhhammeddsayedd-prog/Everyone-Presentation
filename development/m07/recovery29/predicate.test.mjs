import assert from'node:assert/strict';
import{test}from'node:test';
import{spawnSync}from'node:child_process';
import{ownedDatabasePredicate}from'./ownership.mjs';
const uuid='07000000-0000-4000-8000-000000000001',hex=uuid.replaceAll('-','');
test('installed pglast parses the actual shared guard predicate for every owned database kind and OID edge',()=>{
 const predicates=[];for(const kind of['source','restore','diag'])for(const oid of[1,123456,4294967295])predicates.push(ownedDatabasePredicate({name:`eps_m07_r29_${kind}_${hex}`,marker:kind==='diag'?`eps-m07-recovery29-diagnostic:${uuid}`:`eps-m07-recovery29:${uuid}:${kind}`,oid}));
 const script="import json,sys\nfrom pglast import parse_sql\npredicates=json.load(sys.stdin)\nfor predicate in predicates: parse_sql('SELECT ('+predicate+');')\nprint(json.dumps({'parsed':len(predicates)}))";
 const result=spawnSync('.venv-skills/Scripts/python.exe',['-X','utf8','-c',script],{input:JSON.stringify(predicates),encoding:'utf8',windowsHide:true,shell:false,timeout:10000});assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),{parsed:9});
 const broken=predicates[0].replace('oid = 1 and','oid = 1and');const bad=spawnSync('.venv-skills/Scripts/python.exe',['-X','utf8','-c',script],{input:JSON.stringify([broken]),encoding:'utf8',windowsHide:true,shell:false,timeout:10000});assert.notEqual(bad.status,0);
});
