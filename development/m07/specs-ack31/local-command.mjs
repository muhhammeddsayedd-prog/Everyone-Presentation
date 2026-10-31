/** Bounded process adapter. Injected spawn/timers permit credential-free tests. */
import {Buffer} from 'node:buffer';
import {setTimeout,clearTimeout} from 'node:timers';
export function boundedCommand(spawn,exe,args,{cwd,input='',allowFailure=false,environment,timeoutMs=60_000,maximumBytes=64*1024*1024,setTimer=setTimeout,clearTimer=clearTimeout,onUnconfirmed=()=>{}}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(exe,args,{cwd,env:environment,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  const out=[],err=[];let bytes=0,settled=false;
  const uncertain=reason=>{
   if(settled)return;settled=true;clearTimer(timer);
   onUnconfirmed({pid:Number.isSafeInteger(child.pid)&&child.pid>0?child.pid:null,reason});
   child.kill();for(const stream of[child.stdin,child.stdout,child.stderr])stream.destroy();child.unref();
   reject(Error('ACK31_LOCAL_COMMAND_'+reason.toUpperCase()+'_UNCONFIRMED'));
  };
  const timer=setTimer(()=>uncertain('timeout'),timeoutMs);
  for(const[key,buffers]of[['stdout',out],['stderr',err]])child[key].on('data',chunk=>{
   if(settled)return;bytes+=chunk.length;if(bytes>maximumBytes)uncertain('overflow');else buffers.push(chunk);
  });
  child.once('error',()=>{if(settled)return;settled=true;clearTimer(timer);reject(Error('ACK31_LOCAL_TRANSPORT_UNCONFIRMED'));});
  child.once('close',code=>{
   if(settled)return;if(code===null){uncertain('signal');return;}settled=true;clearTimer(timer);
   const result={code,stdout:Buffer.concat(out).toString('utf8'),stderr:Buffer.concat(err).toString('utf8')};
   if(code!==0&&!allowFailure)reject(Object.assign(Error('ACK31_LOCAL_COMMAND_UNCONFIRMED'),{privateDiagnostic:{code,stderr:result.stderr}}));else resolve(result);
  });
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
