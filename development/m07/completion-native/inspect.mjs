/** Exact read-only public-source inspection. No private inputs/provider calls. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { MAIN, PREPARATION_ENABLED, IMAGE, READY_REFERENCE, BASE_OPERATOR_SHA256, RELEASE_DATA_SHA256,
  PUBLIC_HELPER_PINS, compileSource, replaceOnce, sha, validateContextProof, validateNativeReady } from './compile-native-probe.mjs';
import { NATIVE_PROBE_RELEASE } from './native-probe-release.mjs';
import { regular } from './context-audit.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..');
const need=value=>{if(!value)throw Error('COMPLETION_NATIVE_INSPECTION_UNCONFIRMED');};
export async function inspect() {
  need(PREPARATION_ENABLED===false);
  const base=(await regular(path.join(MAIN,'tools/probe-hosted-native.mjs'))).bytes;
  const release=(await regular(path.join(import.meta.dirname,'native-probe-release.mjs'))).bytes;
  const compiler=(await regular(path.join(import.meta.dirname,'compile-native-probe.mjs'))).bytes;
  const proofBytes=(await regular(path.join(ROOT,NATIVE_PROBE_RELEASE.context_proof.path))).bytes;
  const readyBytes=(await regular(path.join(ROOT,READY_REFERENCE.path))).bytes;
  need(sha(base)===BASE_OPERATOR_SHA256&&sha(release)===RELEASE_DATA_SHA256&&sha(proofBytes)===NATIVE_PROBE_RELEASE.context_proof.sha256&&sha(readyBytes)===READY_REFERENCE.sha256);
  const proof=JSON.parse(proofBytes),ready=JSON.parse(readyBytes);
  const sourceBytes=(await regular(path.join(MAIN,NATIVE_PROBE_RELEASE.context_relative,'apps/worker/native-source.json'))).bytes;
  const source=JSON.parse(sourceBytes);validateContextProof(proof,source);validateNativeReady(ready,IMAGE);
  need(sha(sourceBytes)===proof.source_seal_sha256&&sha(await readFile(path.join(import.meta.dirname,'context-audit.mjs')))===proof.audit_source_sha256);
  for(const row of source.files)for(const prefix of [MAIN,path.join(MAIN,NATIVE_PROBE_RELEASE.context_relative)]){const bytes=(await regular(path.join(prefix,row.path))).bytes;need(bytes.length===row.bytes&&sha(bytes)===row.sha256);}
  const pins={};
  for(const [relative,digest]of Object.entries(PUBLIC_HELPER_PINS)){const file=path.join(MAIN,relative);need(sha((await regular(file)).bytes)===digest);pins[file]=digest;}
  for(const name of ['compile-native-probe.mjs','native-probe-release.mjs','admit-native-probe.mjs','native-probe.test.mjs','context-audit.mjs','inspect.mjs','input.json','README.md'])pins[path.join(import.meta.dirname,name)]=sha((await regular(path.join(import.meta.dirname,name))).bytes);
  const compiled=compileSource(base,MAIN,IMAGE,sha(release),sha(compiler),READY_REFERENCE);
  let reverted=compiled.source.toString('utf8');
  for(const change of [...compiled.changes].reverse())reverted=replaceOnce(reverted,change.after,change.before);
  need(compiled.changes.length===12&&reverted===base.toString('utf8'));
  return {schema_version:'1.0',observed_at:new Date().toISOString(),result:'passed_disabled_source_inspection',preparation_enabled:false,
    source_sha256:NATIVE_PROBE_RELEASE.source_sha256,file_count:165,image:IMAGE,context_proof:NATIVE_PROBE_RELEASE.context_proof,native_ready:READY_REFERENCE,
    base_operator_sha256:sha(base),release_sha256:sha(release),compiler_sha256:sha(compiler),disabled_preview_sha256:sha(compiled.source),
    inverse_transforms_exact:true,transforms:12,public_source_pins:pins,private_inputs_opened:false,provider_called:false,generated_operator_persisted:false,
    real_native_smoke_or_daemon_acceptance:false};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  try{const report=await inspect();const file='tracking/evidence/m07/completion-worker/'+report.observed_at.replaceAll(':','-').replace('.','-')+'-native-purpose-inspection.json';await writeFile(path.join(ROOT,file),JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:file,provider_called:false})+'\n');}
  catch{process.stdout.write('COMPLETION_NATIVE_INSPECTION_UNCONFIRMED\n');process.exitCode=1;}
}
