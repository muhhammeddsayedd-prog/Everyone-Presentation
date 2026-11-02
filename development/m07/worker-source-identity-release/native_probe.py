"""Disabled finite compilation/admission of the existing nine-task native probe.

Only source/data/path/once-claim seams change. The existing normal CLI mint,
bounded SDK, ownership/session/UID/network checks and cleanup remain unchanged.
"""
from pathlib import Path
import importlib.util,json,re,sys,uuid
HERE=Path(__file__).resolve().parent
PROBE_ENABLED=False
BASE_OPERATOR='tools/probe-hosted-native.mjs';BASE_OPERATOR_SHA='84630e42f2e5277fe8865721d00779939802cc73d059bf795cffb9915e5cb3ab'
BASE_ADMISSION='development/m07/completion-native/admit-native-probe.mjs';BASE_ADMISSION_SHA='3d4063414ae08a0c419be1e893322332f61f431afa57f45ff2957780cd889060'
BASE_RELEASE_SHA='b8eec2107417f4f4641c9dd7810ce056e5af937d2cada3236f05c454eb9cff26'
OLD_RELEASE_SHA='41a4f9c84970d9c1509ac60fda878a746156f02a9be5f598c977276f78b5b7f9'
OLD_READY={'path':'tracking/evidence/m07/completion-worker/2026-11-01T23-38-34-463049Z-native-registry-ready.json','sha256':'9c5c6ed9f6cf74df71dd60981666fd03b5849b4ce8ca15358d308f455d1e2742'}
PUBLIC_HELPERS={
 'development/m07/worker-hosting/native-init-diagnostic.mjs':'042c29fc6241dc931cbdcc38ee9aa42094008abf0a1db1956cbb710f37200e64',
 'development/m07/worker-hosting/native-boundary-diagnostic.mjs':'3ac17c10ca838c6f349e1002d179de69b0f16d2e853e95709b2ddccdfff30616',
 'development/m07/worker-hosting/native-chromium-diagnostic.mjs':'661a6ca55c79b91c899301b832d568a3fcdb94f429adca6e4f0d0d63796ee0ec',
 'tests/worker/document-fixtures.ts':'afcadca5a40ff643839683876d112c186005982784c6e161d321033d00e57a0d',
 'tests/worker/review-fit-fixture.ts':'ae23706908b67b32c7375d9a29a051a524058e804deb8752a905255cb971c2c1',
 'tests/worker/presentation-native-fixture.ts':'d42d81ec2504b4217bee57dda7e0a15e8acd1a45c34c6193e1669e66b6659d63'}
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
b=module('worker_identity_probe_build',HERE/'build.py');need=b.need;sha=b.sha;load=b.load
def once(text,before,after,changes,label):
 need(text.count(before)==1);changes.append({'label':label,'before':before,'after':after});return text.replace(before,after,1)
def release_data(source,build_run,context_ref):
 b.source_shape(source);need(str(uuid.UUID(build_run))==build_run and uuid.UUID(build_run).version==4);pins={row['path']:row['sha256']for row in source['files']}
 return {'source_sha256':source['source_sha256'],'context_relative':'.local/worker-hosting/'+build_run+'/context','file_count':len(source['files']),'context_proof':context_ref,'native_uid':65432,'native_gid':65432,
  'native_identity_sha256':pins['apps/worker/src/native-identity.mjs'],'native_task_limits_sha256':pins['apps/worker/src/native-task-limits.mjs'],'native_launcher_sha256':pins['apps/worker/src/native-sandbox-launch.mjs'],'seal_validator_sha256':pins['apps/worker/src/native-source-seal.ts'],
  'runtime_contract_sha256':{name:pins[name]for name in('contracts/json-schema/candidate-extraction.schema.json','contracts/json-schema/frame-selection.schema.json','contracts/json-schema/slide-wording.schema.json','contracts/json-schema/specs-extraction.schema.json')},'diagnostic_modes_enabled':False}
def release_source(data):return ('export const NATIVE_PROBE_RELEASE=Object.freeze('+b.compact(data).decode()+');\nexport function nativeProbePrivilegeArguments(){return [`--reuid=${NATIVE_PROBE_RELEASE.native_uid}`,`--regid=${NATIVE_PROBE_RELEASE.native_gid}`,"--clear-groups","--inh-caps=-all","--bounding-set=-all","--no-new-privs"];}\n').encode()
def probe_pins(build):
 result=build.pins()
 for relative,digest in{BASE_OPERATOR:BASE_OPERATOR_SHA,BASE_ADMISSION:BASE_ADMISSION_SHA,**PUBLIC_HELPERS}.items():need(sha(load(b.MAIN/relative))==digest);result[str(b.MAIN/relative)]=digest
 for name in('native_probe.py','test_native_probe.py'):result[str(HERE/name)]=sha(load(HERE/name))
 helpers=build.l.registry.helpers();need(sha(load(b.MAIN/helpers.ACL))==helpers.ACL_SHA);result[str(b.MAIN/helpers.ACL)]=helpers.ACL_SHA;shell=helpers.POWERSHELL;need(shell.is_file()and not shell.is_symlink()and shell.resolve()==shell and shell.stat().st_nlink==2 and sha(shell.read_bytes())==helpers.POWERSHELL_SHA);result[str(shell)]=helpers.POWERSHELL_SHA
 return dict(sorted(result.items()))
def compile_sources(operator,admission,scope):
 need(sha(operator)==BASE_OPERATOR_SHA and sha(admission)==BASE_ADMISSION_SHA and re.fullmatch(r'\.local/worker-source-identity-native/[a-f0-9-]{36}',scope['private']));text=operator.decode();changes=[];root=b.MAIN;folder=root/scope['private'];data=scope['release_data'];release_sha=sha(release_source(data));image=scope['image'];need(re.fullmatch(r'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:[a-f0-9]{64}',image))
 def change(before,after,label):
  nonlocal text;text=once(text,before,after,changes,label)
 for relative in('../development/m07/worker-hosting/native-init-diagnostic.mjs','../development/m07/worker-hosting/native-boundary-diagnostic.mjs','../development/m07/worker-hosting/native-chromium-diagnostic.mjs','../tests/worker/presentation-native-fixture.ts','../tests/worker/document-fixtures.ts'):
  change("'"+relative+"'",json.dumps((root/'tools'/relative).resolve().as_uri()),'absolute-public-helper:'+relative)
 change("'../development/m07/worker-hosting/native-probe-release.mjs'",json.dumps((folder/'native-probe-release.mjs').as_uri()),'new-release-module')
 change("const ROOT = path.resolve(import.meta.dirname, '..');",'const ROOT = '+json.dumps(str(root))+';','fixed-Main-root')
 change("const RELEASE_SOURCE_SHA = '"+BASE_RELEASE_SHA+"';","const RELEASE_SOURCE_SHA = '"+release_sha+"';",'new-release-hash')
 change("'development/m07/worker-hosting/native-probe-release.mjs'",json.dumps(scope['private']+'/native-probe-release.mjs'),'new-release-read')
 change("'tracking/evidence/m07/worker-hosting'","'tracking/evidence/m07/worker-source-identity-release'",'new-evidence-namespace')
 seam='const plan = probePlan(process.argv[2]); const image = validateProbeImage(process.argv[3]);'
 admission_data={'base_operator_sha256':BASE_OPERATOR_SHA,'release_sha256':release_sha,'compiler_sha256':scope['compiler_sha256'],'mode':'smoke','image':image,'source_sha256':data['source_sha256'],'context_proof':data['context_proof'],'native_ready':scope['native_ready']}
 change(seam,seam+'\n  if (!'+str(PROBE_ENABLED).lower()+' || plan.mode!=="smoke" || image!=='+json.dumps(image)+') fail("PROBE_PLAN_MISMATCH");\n  report.completion_native_admission='+b.compact(admission_data).decode()+';','flag-and-exact-smoke-image')
 seam='await lock.close(); locked = true;'
 change(seam,seam+'\n    await writeFile(path.join(ROOT,'+json.dumps(scope['private']+'/native-probe-dispatch.claim.json')+'),JSON.stringify({purpose:"worker-separate-source-native-smoke",source_sha256:SOURCE,image,automatic_retry:false}),{flag:"wx",mode:0o600});\n    report.permanent_completion_native_claim_created=true;','new-permanent-claim')
 inverse=text
 for row in reversed(changes):need(inverse.count(row['after'])==1);inverse=inverse.replace(row['after'],row['before'],1)
 need(inverse.encode()==operator)
 admit=admission.decode();admit_changes=[]
 for before,after,label in[("'./native-probe-release.mjs'",json.dumps((folder/'native-probe-release.mjs').as_uri()),'new-release-import'),('plan.file_count === 165','plan.file_count === '+str(data['file_count']),'actual-count'),("plan.release_sha256 === '"+OLD_RELEASE_SHA+"'","plan.release_sha256 === '"+release_sha+"'",'actual-release-hash'),("muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4",image,'actual-image'),(OLD_READY['path'],scope['native_ready']['path'],'actual-ready-path'),(OLD_READY['sha256'],scope['native_ready']['sha256'],'actual-ready-hash')]:admit=once(admit,before,after,admit_changes,label)
 inverse=admit
 for row in reversed(admit_changes):need(inverse.count(row['after'])==1);inverse=inverse.replace(row['after'],row['before'],1)
 need(inverse.encode()==admission);return {'operator':text.encode(),'admission':admit.encode(),'release':release_source(data),'operator_changes':changes,'admission_changes':admit_changes,'inverse_byte_equal':True}
def prepare(inputs,libraries):
 need(PROBE_ENABLED and set(inputs)=={'run','build_run','source','native'}and set(inputs['native'])=={'digest','ready'});build=b.Build(inputs,libraries);source=build.context('daemon');build.source_admission();pins=probe_pins(build);need(build.accepted_export('native')['runtime_digest']==inputs['native']['digest']);ready=b.reference(inputs['native']['ready']);need(ready['result']=='observed'and ready['read_only']is True and ready['provider_mutations']is False and ready['project_id']=='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6'and ready['team_id']=='team_gboXPxTevpCOZuaA8eY9PmR1'and ready['private_repository']is True and ready['image']['repository_id']=='repo_OpIvBNiZ8vPVROs68HxcMb39W6yz'and ready['image']['runtime_digest']==inputs['native']['digest']and ready['image']['architecture']=='amd64'and ready['image']['platform']=='linux')
 for relative,digest in PUBLIC_HELPERS.items():need(sha(load(b.MAIN/relative))==digest)
 proof=build.save('native-probe-context',{'result':'passed_source_context_pattern_checks','files':inputs['source']['files'],'source':source,'private_credentials_opened':False,'private_values_or_digests_recorded':False})
 private='.local/worker-source-identity-native/'+inputs['run'];folder=b.MAIN/private;need(not folder.exists());folder.mkdir(parents=True);need(folder.resolve()==folder and not folder.is_symlink());helpers=libraries.registry.helpers();env=libraries.environment();env['EPS_ACK31_RELEASE_PRIVATE']=str(folder);result=libraries.oci.bounded([str(helpers.POWERSHELL),'-NoProfile','-NonInteractive','-Command',helpers.acl_helper().program(True)],env,15,'worker_identity_native_same_private_ACL');helpers.acl_helper().validate(json.loads(helpers.check_response(result)))
 scope={'private':private,'image':b.PREFIX.removeprefix('vcr.vercel.com/')+'native@'+inputs['native']['digest'],'native_ready':inputs['native']['ready'],'release_data':release_data(inputs['source'],inputs['build_run'],proof),'compiler_sha256':sha(load(Path(__file__).resolve()))}
 result=compile_sources(load(b.MAIN/BASE_OPERATOR),load(b.MAIN/BASE_ADMISSION),scope);need(probe_pins(build)==pins)
 for name,key in(('native-probe-release.mjs','release'),('native-probe-operator.mjs','operator'),('native-probe-admission.mjs','admission')):
  file=folder/name
  with libraries.guard().create(file)as stream:stream.write(result[key]);stream.flush();b.os.fsync(stream.fileno());libraries.guard().verify_open(stream)
 plan={'schema_version':'1.0','preparation_enabled':True,'mode':'smoke','image':scope['image'],'source_sha256':scope['release_data']['source_sha256'],'file_count':scope['release_data']['file_count'],'context_relative':scope['release_data']['context_relative'],'context_proof':proof,'base_operator_sha256':BASE_OPERATOR_SHA,'release_sha256':sha(result['release']),'compiler_sha256':scope['compiler_sha256'],'generated_operator_sha256':sha(result['operator']),'generated_admission_sha256':sha(result['admission']),'native_ready':inputs['native']['ready'],'private':private,'source_pins':pins,'inverse_byte_equal':True,'automatic_retry':False}
 release_ref=build.save('native-probe-release',{'release_data':scope['release_data'],'release_sha256':plan['release_sha256'],'private':private,'generated_admission_sha256':plan['generated_admission_sha256'],'generated_operator_sha256':plan['generated_operator_sha256'],'inverse_byte_equal':True});plan_ref=build.save('native-probe-plan',plan)
 return {'result':'prepared','plan':plan_ref,'release':release_ref,'operator':private+'/native-probe-operator.mjs','command_mode':'smoke','image':scope['image'],'provider_called':False,'execution_dispatched':False}
def admit_actual(refs,inputs,libraries,write):
 need(type(refs)is dict and set(refs)=={'receipt','plan','release'});plan=b.reference(refs['plan']);release=b.reference(refs['release']);receipt=b.reference(refs['receipt'])
 need(plan['source_sha256']==inputs['source']['source_sha256']and plan['file_count']==len(inputs['source']['files'])and plan['context_relative']=='.local/worker-hosting/'+inputs['build_run']+'/context'and plan['image']==b.PREFIX.removeprefix('vcr.vercel.com/')+'native@'+inputs['native']['digest']and plan['native_ready']==inputs['native']['ready']and plan['inverse_byte_equal']is True)
 need(plan['compiler_sha256']==sha(load(Path(__file__).resolve()))and release['release_data']['source_sha256']==inputs['source']['source_sha256']and release['release_sha256']==plan['release_sha256']and plan['source_pins']==probe_pins(b.Build(inputs,libraries)));folder=b.MAIN/plan['private'];need(folder.parent==b.MAIN/'.local/worker-source-identity-native'and folder.name==inputs['run'])
 scope={'private':plan['private'],'image':plan['image'],'native_ready':plan['native_ready'],'release_data':release['release_data'],'compiler_sha256':plan['compiler_sha256']};generated=compile_sources(load(b.MAIN/BASE_OPERATOR),load(b.MAIN/BASE_ADMISSION),scope)
 for name,key,digest in(('native-probe-release.mjs','release',plan['release_sha256']),('native-probe-operator.mjs','operator',plan['generated_operator_sha256']),('native-probe-admission.mjs','admission',plan['generated_admission_sha256'])):
  file=folder/name;libraries.guard().verify(file);need(load(file)==generated[key]and sha(generated[key])==digest)
 # Read the exact original public bytes in Node: do not sort/re-serialize the
 # receipt's frozen release object across the Python/JS bridge.
 program="import fs from'node:fs';import{createHash}from'node:crypto';const read=(p,h)=>{const b=fs.readFileSync(p);if(createHash('sha256').update(b).digest('hex')!==h)throw Error('PROBE_REFUSED');return JSON.parse(b)};const m=await import("+json.dumps((folder/'native-probe-admission.mjs').as_uri())+");const receipt=read("+json.dumps(str(b.MAIN/refs['receipt']['path']))+','+json.dumps(refs['receipt']['sha256'])+");const plan=read("+json.dumps(str(b.MAIN/refs['plan']['path']))+','+json.dumps(refs['plan']['sha256'])+");process.stdout.write(JSON.stringify(m.admitNativeProbe(receipt,plan)));"
 return json.loads(libraries.run([str(libraries.registry.NODE),'--input-type=module','-e',program]))
def admit_reference(refs,inputs,libraries,write):
 need(type(refs)is dict and set(refs)=={'receipt','plan','release','admitted'});accepted=b.reference(refs['admitted']);value=admit_actual({key:refs[key]for key in('receipt','plan','release')},inputs,libraries,write)
 need(accepted['result']=='passed'and accepted['receipt']==refs['receipt']and accepted['plan']==refs['plan']and accepted['projection']==value);return value
def main():
 need(PROBE_ENABLED and len(sys.argv)==2 and sys.argv[1]in('prepare','admit'));libraries=b.m.Libraries();file=b.MAIN/'.local/worker-source-identity-release/native-inputs.json';libraries.guard().verify(file);inputs=json.loads(load(file))
 if sys.argv[1]=='prepare':value=prepare(inputs,libraries)
 else:
  file=b.MAIN/'.local/worker-source-identity-release/native-receipt-inputs.json';libraries.guard().verify(file);refs=json.loads(load(file));projection=admit_actual(refs,inputs,libraries,None);build=b.Build(inputs,libraries);value=build.save('native-probe-admitted',{'result':'passed','receipt':refs['receipt'],'plan':refs['plan'],'projection':projection})
 print(json.dumps(value))
if __name__=='__main__':
 try:main()
 except Exception:print('WORKER_IDENTITY_NATIVE_PROBE_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
