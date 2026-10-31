/** Pure compiler. Actual29->33 admission/cleanup comes from reviewed recovery33.
 * Root released the new runner after exact533 cleanup and direct-DROP review. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileController33, sha } from '../../m07/recovery33/compiler.mjs';
import { ownedPredicate33 } from '../../m07/recovery33/ownership.mjs';

export const MIGRATION34 = 'supabase/migrations/20261031143711_m03_english_transcript_projection.sql';
export const EXECUTION_ENABLED = true;
export const FILES34 = ['controller.mjs','runtime.mjs','run.mjs','controller.test.mjs','build_ports.py','test_source.py',
 'test-target.sql','before34.sql','validation-tests.sql','capture-tests.sql','port-patches.json','README.md','recovery-source-pins.json',
 'source-history/4597951eb5d26ff449abbbe0f6575ddb5ebfbf9d83fc8f58e22c21fd610a26bc-recovery-source-pins.json',
 'source-history/92ba4e1ebcca3a120cab03960e1c357897eda5f95cac4825163247751b0d3484-validation-tests.sql',
 'source-history/bb5232d6d56536c98203d633b40bcd3f6100f6923210041c57535579e0b36a4f-test_source.py']
 .map(file => 'development/m03/english-transcript34/' + file);
export const FIXTURES34 = ['tests/db/m04-assignments-fixture.sql','tests/db/m05-versions-fixture.sql','tests/db/m06-transcript28-legacy.sql'];
export const text34 = (sources,file) => { const bytes=sources.get(file);assert(bytes instanceof Uint8Array,'ENGLISH34_SOURCE_REQUIRED');return Buffer.from(bytes).toString('utf8'); };

export function ownedSql34(sources,identity) {
 const predicate=ownedPredicate33(identity), guard=`do $english34_owned$begin if current_user<>'postgres'or ${predicate}then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;end$english34_owned$;`;
 let migration=text34(sources,MIGRATION34);
 const start=migration.indexOf("(current_database()<>'postgres'and not("),end=migration.indexOf('\n or(select array_agg(version',start);
 assert(start>0&&end>start);const old=migration.slice(start,end);
 assert.equal(old.split('shobj_description').length,2);
 migration=migration.slice(0,start)+`(${predicate})`+migration.slice(end);
 // Functional DDL after the target block is byte exact. No history label is added.
 const boundary='end$english34_target$;';assert.equal(migration.split(boundary)[1],text34(sources,MIGRATION34).split(boundary)[1]);
 const fragments={};
 for(const file of ['test-target.sql','before34.sql','validation-tests.sql','capture-tests.sql']) {
  let sql=text34(sources,'development/m03/english-transcript34/'+file);
  const pattern=/do (\$english34_test_target\$|\$\$)begin\n if current_user<>[\s\S]*?end\1;|do \$\$(?:declare before jsonb;after jsonb;)?begin\n if current_database\(\)[\s\S]*?then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;/u;
  const match=pattern.exec(sql);assert(match,'ENGLISH34_FIXED_GUARD_SEAM_REQUIRED');
  // Before/capture guards share their DO with assertions; replace only admission.
  if(file==='test-target.sql')sql=sql.replace(match[0],guard);
  else {
   const begin=sql.indexOf(" if current_database()!~'^eps_english34_"),finish=sql.indexOf(" then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;",begin);
   assert(begin>0&&finish>begin);const after=finish+" then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;".length;
   sql=sql.slice(0,begin)+` if ${predicate}then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;`+sql.slice(after);
  }
  fragments[file]=sql;
 }
 return {migration,fragments,admission_only:true,canonical_sql_sha256:sha(text34(sources,MIGRATION34)),adapted_sql_sha256:sha(migration)};
}

export function compileEnglish34(sources,{root,runId}) {
 for(const file of [...FILES34,...FIXTURES34,MIGRATION34])text34(sources,file);
 const base=compileController33(sources,{root,runId,mode:'metadata'});let source=base.source;const substitutions=[];
 const change=(old,value,label)=>{assert.equal(source.split(old).length,2,'ENGLISH34_FIXED_CONTROLLER_SEAM_REQUIRED');substitutions.push({label,removed_sha256:sha(old),inserted_sha256:sha(value)});source=source.replace(old,value);};
 change('let recovery33; let expectedSourceCatalogue;',`let recovery33; let expectedSourceCatalogue;\nimport { runEnglish34 } from '${pathToFileURL(path.join(root,'development/m03/english-transcript34/runtime.mjs')).href}';\nif(!${EXECUTION_ENABLED})throw Error('ENGLISH34_RECOVERY_DEPENDENCY_NOT_RELEASED');`,'closed-execution-admission');
 change('await recovery33.metadataRestore();',`await runEnglish34({root:ROOT,runId,sourceDb,sourceFiles,report,privateRoot,sql,value,rows,databaseIdentity,marker,catalogue,recovery33});`,'owned-english34-rollback-proof');
 change("scope: 'AT-070 full owned29->33 metadata synthetic local restore; original29 and existing global roles preserved'","scope: 'Owned local29->33 plus additive34 synthetic SQL rollback proof; no restore/native/provider acceptance'",'truthful-english-scope');
 change("'tracking/evidence/m07/recovery33'","'tracking/evidence/m03/english-transcript34'",'dedicated-proof-receipt');
 change("'.local/m07-recovery'","'.local/m03-english34-tests'",'dedicated-private-artifacts');
 const push='sourcePaths.push(...';const at=source.indexOf(push);assert(at>0);
 source=source.slice(0,at)+`sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  `+source.slice(at);
 const seals='report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';
 change(seals,seals+`\n  for(const[file,expected]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([file,bytes])=>[file,sha(bytes)])))})){assert(sourceFiles.has(file),'ENGLISH34_PREPARED_SOURCE_MISSING');assert.equal(sha(sourceFiles.get(file)),expected,'ENGLISH34_PREPARED_SOURCE_CHANGED');}`,'prepared-source-closure-before-clone');
 return {source,manifest:{schema_version:'1.0',run_id:runId,execution_enabled:EXECUTION_ENABLED,
  source_sha256:Object.fromEntries([...sources].map(([file,bytes])=>[file,sha(bytes)])),generated_source_sha256:sha(source),
  recovery33_base_sha256:base.manifest.generated_source_sha256,recovery33_substitutions:base.manifest.substitutions,english34_substitutions:substitutions,
  actual30_to33_required:true,english34_ddl_rolls_back:true,history34_inserted:false,native_executed:false,database_executed:false}};
}
