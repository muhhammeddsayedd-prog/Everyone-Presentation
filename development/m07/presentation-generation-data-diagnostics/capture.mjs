/** Pure observation adapter. Sink must be caller-owned private storage. No I/O. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const code=value=>typeof value==='string'&&/^[0-9A-Z]{5}$/u.test(value)?value:null;
const phase=text=>/^\s*select pg_temp\.locksource41_cohorts\(/u.test(text)?'source_cohort_read':/^\s*select pg_temp\.locksource41_measure\('locks',/u.test(text)?'source_lock_measure':text.trim()==='rollback;'?'cleanup_rollback':'owned_request';

export function preserveFirstOwnedError(target,sink,report){
 assert(Array.isArray(target)&&typeof sink==='function'&&report&&typeof report==='object');
 const wrapped=new WeakSet();let attempted=false;
 return new Proxy(target,{get(array,key,receiver){
  if(key!=='push')return Reflect.get(array,key,receiver);
  return(...values)=>{
   for(const value of values){
    assert(value&&typeof value.request==='function');if(wrapped.has(value))continue;wrapped.add(value);
    const request=value.request;
    value.request=async(text,...args)=>{
     try{return await request.call(value,text,...args);}
     catch(error){
      if(!attempted){
       attempted=true;
       const diagnostic=error?.diagnostic;
       const stdout=typeof diagnostic?.stdout==='string'?diagnostic.stdout:null,stderr=typeof diagnostic?.stderr==='string'?diagnostic.stderr:null;
       const sqlstate=code(error?.code)??code(typeof stderr==='string'?/\bERROR:\s+([0-9A-Z]{5}):/u.exec(stderr)?.[1]:null);
       const metadata={phase:phase(text),request_sha256:createHash('sha256').update(text).digest('hex'),native_sqlstate:sqlstate,private_capture_normal_return:false};
       report.first_native_error_capture=metadata;
       try{
        await sink({schema_version:'owned-first-native-error.v1',...metadata,message:typeof error?.message==='string'?error.message:null,stdout,stderr});
        metadata.private_capture_normal_return=true;
       }catch{metadata.private_capture_failed=true;}
      }
      throw error;
     }
    };
   }
   return Reflect.apply(Array.prototype.push,array,values);
  };
 }});
}
