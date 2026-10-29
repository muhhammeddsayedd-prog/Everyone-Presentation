/** WF02 uses the already verified Webhook/Edit Fields/Respond node versions.
 * No secret, media body, provider key or runtime grant belongs in this graph. */
import { buildSpecsWf01 } from './build-specs-wf01.mjs';

export function mapCandidateStageEnvelope(body,executionId) {
  const fields = ['event_id', 'event_type', 'contract_version', 'job_id', 'kind', 'stage', 'input_hash', 'correlation_id'];
  const safe = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
  const handlers = {
    prepare_candidate: 'native.prepare_candidate', transcribe_candidate: 'openai.transcribe_candidate',
    extract_candidate: 'openai.extract_candidate', select_frames: 'native.select_frames', apply_candidate: 'domain.apply_candidate',
  };
  const invalid = () => ({ status: 400, body: { error: { code: 'DISPATCH_ENVELOPE_INVALID', message: 'Use the published candidate stage envelope.' } } });
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length
    || fields.some(key => !Object.hasOwn(body, key))
    || body.event_type !== 'job.stage_ready' || body.contract_version !== '1.0' || body.kind !== 'candidate_scan'
    || !safe(body.event_id) || !safe(body.job_id) || !safe(body.correlation_id) || typeof body.stage !== 'string' || !Object.hasOwn(handlers, body.stage)
    || typeof body.input_hash !== 'string' || !/^[a-f0-9]{64}$/u.test(body.input_hash)) return invalid();
  if (!safe(executionId)) return { status: 500, body: { error: { code: 'WF02_EXECUTION_ID_INVALID', message: 'The candidate work order could not be prepared.' } } };
  return { status: 200, body: { schema_version: '1.0', event_id: body.event_id, job_id: body.job_id, kind: body.kind,
    stage: body.stage, input_hash: body.input_hash, correlation_id: body.correlation_id,
    workflow_execution_id: executionId, handler: handlers[body.stage] } };
}
export function buildCandidateWf02(credential) {
  if(!credential||Object.keys(credential).sort().join(',')!=='id,name'||!/^[A-Za-z0-9_-]{1,100}$/u.test(credential.id)||credential.name!=='Everyone Presentation Studio WF02 local dispatch')throw new Error('WF02_CREDENTIAL_REFERENCE_REQUIRED');
  const graph=buildSpecsWf01();graph.name='Process candidate stages - Everyone Presentation Studio WF02';
  const rename=name=>name.replace('specs','candidate');
  graph.nodes=graph.nodes.map((node,index)=>({...node,id:`33c30000-0000-4000-8000-00000000000${index+1}`,name:rename(node.name),
    ...(index===0?{webhookId:'33c30000-0000-4000-8000-000000000005',parameters:{...node.parameters,path:'eps-wf02-candidate-stage-v1'},credentials:{httpHeaderAuth:{...credential}}}:{}),
    ...(index===1?{parameters:{...node.parameters,jsonOutput:`={{ (${mapCandidateStageEnvelope.toString()})($('Receive candidate stage').first().json.body, $execution.id) }}`}}:{}),
    ...(index===3?{parameters:{...node.parameters,responseBody:'={{ ({ error: { code: "WF02_NODE_ERROR", message: "The candidate work order could not be prepared." } }) }}'}}:{})}));
  graph.connections=Object.fromEntries(Object.entries(graph.connections).map(([name,value])=>[rename(name),{main:value.main.map(branch=>branch.map(edge=>({...edge,node:rename(edge.node)})))}]));
  return graph;
}
export function validateCandidateWf02(value,credential) {
  const expected=buildCandidateWf02(credential);
  const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
  if(!value||value.name!==expected.name||canonical(value.nodes)!==canonical(expected.nodes)||canonical(value.connections)!==canonical(expected.connections)
    ||Object.entries(expected.settings).some(([key,entry])=>value.settings?.[key]!==entry))throw new Error('WF02_GRAPH_UNCONFIRMED');
  return true;
}
