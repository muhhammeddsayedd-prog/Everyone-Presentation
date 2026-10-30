/** Metadata-only synthetic workload scheduler. No provider, runtime, DB or I/O. */
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const CODES = new Set(['VIDEO_CONTAINER_UNAVAILABLE','VIDEO_CONTAINER_REQUIRED','VIDEO_CONTAINER_CLEANUP_FAILED','VIDEO_CONTAINER_OWNERSHIP_INVALID','VIDEO_DECODE_FAILED','VIDEO_SOURCE_INVALID','VIDEO_TYPE_UNSUPPORTED','VIDEO_UNREADABLE','VIDEO_LIMIT_EXCEEDED','VIDEO_PREPARATION_BUSY','VIDEO_PREPARATION_CANCELLED','VIDEO_PROCESS_TIMEOUT','WORKLOAD_DEADLINE','WORKLOAD_OPERATION_UNCONFIRMED']);
const fail = code => { throw new Error(code); };
const count = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
function descriptor(item) {
  return item && typeof item === 'object' && /^[a-z0-9-]{1,80}$/u.test(item.id) && /^[a-zA-Z0-9_-]+\.mp4$/u.test(item.file) && HASH.test(item.sha256) && count(item.size_bytes,1,1024*1024) && ['video/mp4','application/octet-stream'].includes(item.mime_type) && ['probe','prepare'].includes(item.mode);
}
export function createWorkloadState(runId, descriptors, createdMs = Date.now()) {
  if (!UUID.test(runId) || !Array.isArray(descriptors) || !count(descriptors.length,1,200) || !count(createdMs,0,Number.MAX_SAFE_INTEGER) || descriptors.some(item=>!descriptor(item)) || new Set(descriptors.map(item=>item.id)).size !== descriptors.length || new Set(descriptors.map(item=>item.file)).size !== descriptors.length) fail('WORKLOAD_CONFIGURATION_INVALID');
  return { schema_version:'1.0',scope:'synthetic-local-native-workload',run_id:runId,created_ms:createdMs,restarts:0,peak_inflight:0,items:descriptors.map(item=>({id:item.id,file:item.file,sha256:item.sha256,size_bytes:item.size_bytes,mime_type:item.mime_type,mode:item.mode,status:'pending',attempts:[]})) };
}
export function resumeWorkload(value) {
  const state = structuredClone(value);
  if (!state || state.schema_version!=='1.0' || state.scope!=='synthetic-local-native-workload' || !count(state.restarts,0,100) || !count(state.peak_inflight,0,2)) fail('WORKLOAD_CHECKPOINT_INVALID');
  createWorkloadState(state.run_id,state.items,state.created_ms);
  for (const item of state.items) {
    if (!['pending','running','succeeded','failed','unconfirmed'].includes(item.status) || !Array.isArray(item.attempts) || item.attempts.length>2 || item.attempts.some(attempt=>!count(attempt.attempt_no,1,2) || !count(attempt.started_ms,0,Number.MAX_SAFE_INTEGER) || !CODES.has(attempt.code) && attempt.code!==null)) fail('WORKLOAD_CHECKPOINT_INVALID');
    if (item.status==='running') item.status='unconfirmed';
  }
  state.restarts++; return state;
}
export async function runBoundedWorkload(state, execute, options) {
  const concurrency=options.concurrency, maximumItems=options.maximum_items??200, maximumAttempts=options.maximum_attempts??2;
  const now=options.now??Date.now, snapshot=options.snapshot??(async()=>{});
  if (!count(concurrency,1,2) || !count(maximumItems,1,200) || !count(maximumAttempts,1,2) || !count(options.deadline_ms,0,Number.MAX_SAFE_INTEGER) || typeof execute!=='function') fail('WORKLOAD_CONFIGURATION_INVALID');
  let active=0, admitted=0;
  async function worker() {
    while (now()<options.deadline_ms && admitted<maximumItems) {
      const item=state.items.find(item=>item.status==='pending'); if(!item)return;
      item.status='running'; admitted++; active++; state.peak_inflight=Math.max(state.peak_inflight,active);
      try {
        while (item.attempts.length<maximumAttempts && now()<options.deadline_ms) {
          const start=now(); const attempt={attempt_no:item.attempts.length+1,started_ms:start,finished_ms:null,duration_ms:null,queue_wait_ms:Math.max(0,start-state.created_ms),success:false,code:null,native_called:false};item.attempts.push(attempt);await snapshot(state);
          let retry=false;
          try {const result=await execute(item,attempt.attempt_no);attempt.native_called=result?.native_called===true;attempt.success=true;item.status='succeeded';}
          catch(error) { const code=typeof error?.code==='string'&&CODES.has(error.code)?error.code:'WORKLOAD_OPERATION_UNCONFIRMED';attempt.code=code;attempt.native_called=error?.native_called===true;const uncertain=error?.outcome==='unknown';retry=!uncertain&&error?.retryable===true&&item.attempts.length<maximumAttempts;item.status=uncertain?'unconfirmed':retry?'running':'failed'; }
          attempt.finished_ms=now();attempt.duration_ms=Math.max(0,attempt.finished_ms-start);await snapshot(state);
          if(!retry)break;
        }
        if(item.status==='running')item.status='pending';
      } finally {active--;await snapshot(state);}
    }
  }
  const workers=await Promise.allSettled(Array.from({length:concurrency},worker));
  if(workers.some(result=>result.status==='rejected'))fail('WORKLOAD_CHECKPOINT_UNCONFIRMED');
  return summarizeWorkload(state);
}
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]:null;
export function summarizeWorkload(state) {
  const attempts=state.items.flatMap(item=>item.attempts);const finished=attempts.filter(attempt=>attempt.duration_ms!==null);const successful=finished.filter(attempt=>attempt.success);
  const q=values=>({p50:percentile(values,.5),p95:percentile(values,.95),maximum:values.length?Math.max(...values):null});
  return { total_files:state.items.length,total_input_bytes:state.items.reduce((sum,item)=>sum+item.size_bytes,0),succeeded:state.items.filter(item=>item.status==='succeeded').length,failed:state.items.filter(item=>item.status==='failed').length,unconfirmed:state.items.filter(item=>item.status==='unconfirmed').length,pending:state.items.filter(item=>item.status==='pending').length,running:state.items.filter(item=>item.status==='running').length,total_attempts:attempts.length,retries:state.items.reduce((sum,item)=>sum+Math.max(0,item.attempts.length-1),0),native_requests:attempts.filter(attempt=>attempt.native_called).length,attempted_input_bytes:state.items.reduce((sum,item)=>sum+item.attempts.length*item.size_bytes,0),peak_inflight:state.peak_inflight,restarts:state.restarts,duration_ms:q(finished.map(attempt=>attempt.duration_ms)),successful_duration_ms:q(successful.map(attempt=>attempt.duration_ms)),queue_wait_ms:q(finished.map(attempt=>attempt.queue_wait_ms)),failure_codes:Object.fromEntries([...new Set(finished.map(attempt=>attempt.code).filter(Boolean))].map(code=>[code,finished.filter(attempt=>attempt.code===code).length])) };
}
