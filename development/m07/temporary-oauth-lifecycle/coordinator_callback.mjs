/** New coordinator-owned copy of reviewed loopback adapter; old source stays frozen. */
import { createServer } from 'node:http';
import { clearTimeout,setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { authorizationTarget,callback } from './core.mjs';
export const LIVE_ENABLED=true;
const need=value=>{if(!value)throw Error('TEMP_OAUTH_OWNER_CALLBACK_REFUSED');};
export function requestTarget({method,host,remoteAddress,url,origin}){
 need(method==='GET'&&host==='localhost:3118'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remoteAddress)&&typeof url==='string'&&url.length<=8192&&(origin===undefined||origin==='http://localhost:3118'));
 const target=new URL(url,'http://localhost:3118');need(target.origin==='http://localhost:3118'&&!target.hash&&['/start','/callback'].includes(target.pathname));if(target.pathname==='/start')need(!target.search);return target;
}
export async function ownerCallback({begin,claim,onCode,onReady}){
 need(LIVE_ENABLED);need(typeof claim==='function'&&typeof onCode==='function'&&typeof onReady==='function');const location=authorizationTarget(begin);
 const id=await claim('authorize');need(typeof id==='string'&&id.length>0);const servers=[];let timer,settled=false,started=false;
 const close=()=>{clearTimeout(timer);for(const server of servers){server.closeAllConnections();server.close(()=>{});}};
 try{return await new Promise((resolve,reject)=>{
  const fail=()=>{if(!settled){settled=true;close();reject(Error('TEMP_OAUTH_OWNER_CALLBACK_UNCONFIRMED'));}};
  const serve=(req,res)=>{
   const reply=(status,text,headers={})=>{res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...headers});res.end(text);};
   let target;try{target=requestTarget({method:req.method,host:req.headers.host,remoteAddress:req.socket.remoteAddress,url:req.url,origin:req.headers.origin});}catch{reply(400,'Request refused.');return;}
   if(target.pathname==='/start'){if(started||settled){reply(409,'This authorization has already started.');return;}started=true;reply(303,'Continue in your browser.',{Location:location});return;}
   if(!started||settled){reply(409,'This callback is no longer available.');return;}
   let code;try{code=callback(target,begin);}catch{reply(400,'Callback refused.');return;}
   // Consume before invoking the code handler. A lost response is never replayed.
   settled=true;reply(200,'Authorization received. You can close this tab.');close();Promise.resolve().then(()=>onCode(code)).then(value=>resolve({authorize_claim:id,value}),()=>reject(Error('TEMP_OAUTH_OWNER_CALLBACK_UNCONFIRMED')));
  };
  const bind=async host=>{const server=createServer(serve);servers.push(server);server.requestTimeout=10000;server.headersTimeout=10000;server.timeout=10000;server.maxHeadersCount=32;server.on('clientError',(_error,socket)=>socket.destroy());
   await new Promise((ready,failed)=>{server.once('error',failed);server.listen({host,port:3118,exclusive:true},()=>{server.removeListener('error',failed);server.on('error',fail);ready();});});};
  timer=setTimeout(fail,5*60*1000);bind('127.0.0.1').then(()=>bind('::1')).then(()=>onReady('http://localhost:3118/start')).catch(fail);
 });}finally{close();}
}
