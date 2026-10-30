/** Restore only six source-proven pg_dump representation differences. This is
 * a pure SQL planner; the caller separately verifies the pinned source profile. */
import { isDeepStrictEqual } from 'node:util';
import { ownedDatabasePredicate } from './ownership.mjs';
const fail=code=>{throw Error(code);};
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const fields=['model_version','prompt_version','result_schema_version','document_preparation_version'];
function originalCheck(name){return`CHECK (((${name} IS NULL) OR (((length(${name}) >= 1) AND (length(${name}) <= 200)) AND (${name} = btrim(${name})))))`;}
function dumpCheck(name){return`CHECK (((${name} IS NULL) OR ((length(${name}) >= 1) AND (length(${name}) <= 200) AND (${name} = btrim(${name})))))`;}
export function exactRestoreProfileSql(expected,observed,{database,marker,oid}){
 const match=/^eps_m07_r29_(source|restore)_([a-f0-9]{32})$/u.exec(database??'');
 if(!match||!Number.isSafeInteger(oid)||oid<1)fail('RECOVERY29_OWNED_DATABASE_REQUIRED');
 const hex=match[2],uuid=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 if(marker!==`eps-m07-recovery29:${uuid}:${match[1]}`)fail('RECOVERY29_OWNED_DATABASE_REQUIRED');
 const differences=[...new Set([...Object.keys(expected),...Object.keys(observed)])].filter(key=>!isDeepStrictEqual(expected[key],observed[key]));
 const guard=`do $owned_restore$begin if ${ownedDatabasePredicate({name:database,marker,oid})} then raise exception'RECOVERY29_OWNED_DATABASE_REQUIRED';end if;end$owned_restore$;\n`;
 let sql=guard;
 for(const key of differences){
  if(key==='schemas|public|acl'){
   const acl=expected[key];if(typeof acl!=='string'||!acl.startsWith('{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,')||observed[key]!==acl.replace(',=U/pg_database_owner',''))fail('RECOVERY29_UNKNOWN_CATALOGUE_PAIR');
   const entries=acl.slice(1,-1).split(',').slice(1);if(entries.some(value=>!/^(?:|[A-Za-z_][A-Za-z0-9_]*)=U\/pg_database_owner$/u.test(value)))fail('RECOVERY29_UNKNOWN_CATALOGUE_PAIR');
   const grantees=entries.map(value=>value.split('=')[0]).map(value=>value===''?'public':'"'+value+'"');
   sql+='revoke usage on schema public from '+grantees.join(',')+';\n'+grantees.map(value=>'grant usage on schema public to '+value+';').join('\n')+'\n';
  }else if(key==='tables|eps.cast_operation_notes|acl'){
   if(expected[key]!=='{postgres=arwdDxtm/postgres}'||observed[key]!==null)fail('RECOVERY29_UNKNOWN_CATALOGUE_PAIR');sql+='grant all privileges on table eps.cast_operation_notes to postgres;\n';
  }else{
   const name=fields.find(name=>key===`constraints|eps.specs_pipeline_config.specs_pipeline_config_${name}_check|definition`);
   if(!name||expected[key]!==originalCheck(name)||observed[key]!==dumpCheck(name))fail('RECOVERY29_UNKNOWN_CATALOGUE_PAIR');
   sql+=`alter table eps.specs_pipeline_config drop constraint specs_pipeline_config_${name}_check;alter table eps.specs_pipeline_config add constraint specs_pipeline_config_${name}_check check(${name} is null or length(${name})between 1 and 200 and ${name}=btrim(${name}));\n`;
  }
 }
 return{sql,differences};
}
