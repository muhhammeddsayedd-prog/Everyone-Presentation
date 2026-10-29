import {DomainError,type Actor,type MutationContext} from '@eps/domain';
import {parseAssignmentCreate,parseAssignmentPatch,parseAssignmentListOptions,parseAssignmentRemove,
 parseSetSlotMain,parseMainUndo,parseCastingMutationContext,parseCastingReorderWorkspace} from '../../../packages/domain/src/casting';
import type {CastingOperations} from '../../../packages/domain/src/casting-types';
import {json,NO_STORE,readJson} from './http';
import {validateContract} from './validation';

/** Exact route ownership; the order route supersedes the M02 role-only handler
 * only when the composed M04 database adapter is enabled. */
export function isCastingRoute(s:string[]):boolean {
 return s[0]==='workspaces'&&s.length===3&&['assignments','order'].includes(s[2])
  ||s[0]==='assignments'&&(s.length===2||s.length===3&&s[2]==='remove')
  ||s[0]==='slots'&&(s.length===3&&s[2]==='main'||s.length===4&&s[2]==='main'&&s[3]==='undo');
}
const invalid=():never=>{throw new DomainError('INVALID_REQUEST','Use the supported casting route, method and bounded parameters.',400);};

export async function handleCastingRequest(request:Request,s:string[],actor:Actor,service:CastingOperations,context:MutationContext&{requestId:string}){
 if(!isCastingRoute(s)||s.some(part=>!part||part.length>200))invalid();
 const method=request.method,url=new URL(request.url);
 if(s[0]==='workspaces'&&s[2]==='assignments'&&method==='GET'){
  const supplied:Record<string,unknown>={};
  for(const[key,value]of url.searchParams){
   if(url.searchParams.getAll(key).length!==1)invalid();
   if(key==='limit'){if(!/^[1-9][0-9]*$/u.test(value)||Number(value)>100)invalid();supplied.limit=Number(value);}
   else if(['output_type','cursor'].includes(key))supplied[key]=value;
   else invalid();
  }
  const result=await service.listAssignments(actor,s[1],parseAssignmentListOptions(supplied));
  return Response.json({request_id:context.requestId,...result},{headers:NO_STORE});
 }
 if(url.search)invalid();
 // Method is checked before parsing a body or validating a mutation intent.
 const operation=s[0]==='workspaces'&&s[2]==='assignments'&&method==='POST'?'create'
  :s[0]==='workspaces'&&s[2]==='order'&&method==='PUT'?'reorder'
  :s[0]==='assignments'&&s.length===2&&method==='PATCH'?'update'
  :s[0]==='assignments'&&s[2]==='remove'&&method==='POST'?'remove'
  :s[0]==='slots'&&s.length===3&&method==='PUT'?'main'
  :s[0]==='slots'&&s.length===4&&method==='POST'?'undo':null;
 if(!operation)throw new DomainError('RESOURCE_NOT_FOUND','This casting operation is unavailable.',404);
 const mutation=parseCastingMutationContext(context);
 const body=await readJson(request);
 const checked=(schema:string)=>validateContract(schema,body);
 switch(operation){
  case'create':return json(await service.createAssignment(actor,s[1],parseAssignmentCreate(checked('AssignmentCreate')),mutation),context.requestId,201);
  case'update':return json(await service.updateAssignment(actor,s[1],parseAssignmentPatch(checked('AssignmentPatch')),mutation),context.requestId);
  case'remove':return json(await service.removeAssignment(actor,s[1],parseAssignmentRemove(checked('ArchiveRequest')),mutation),context.requestId);
  case'main':return json(await service.setSlotMain(actor,s[1],parseSetSlotMain(checked('SetSlotMain')),mutation),context.requestId);
  case'undo':{
   const input=parseMainUndo(checked('MainUndo'));if(input.slot_id!==s[1])invalid();
   return json(await service.undoSlotMain(actor,s[1],input,mutation),context.requestId);
  }
  case'reorder':return json(await service.reorderWorkspace(actor,s[1],parseCastingReorderWorkspace(checked('ReorderWorkspace')),mutation),context.requestId);
 }
}
