"""Closed local receipt admission. No provider, database or quality commands."""
from pathlib import Path
import datetime, hashlib, io, json, re, subprocess, tarfile, uuid

PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';SLUG='muhammed-abdelrahman'
ALIAS='everyone-presentation-pilot.vercel.app';TARGET='pyibofyctwnqpvktepse'
BASELINE='dpl_B5L2mM6QVQo99VJsqtEPDeq8i9n5'
BASE_COMMIT='1c72f2a2cc36e7f3f6c6d093fb24dd28dbe9fc20'
BASE_MANIFEST='05a398700628b8c2310704f05db5971d9fc46ac59795bd77e30148ca3d6f663f'
BASELINE_RECEIPT={'path':'tracking/evidence/m07/role-archive-focus-web-release/2026-11-02T13-11-38-700539Z-38fa1d8a-6d4d-48ea-924e-65052dbe38e4-readback.json','sha256':'7efe9129b5475cdb338f2eb384e7d8e77008a4e9789ff298445c105c7896d6ab'}
# Root must register exact accepted proof/apply/checkpoint references together.
# Neither pending schema can be admitted by a private hash or count alone.
CANONICAL={'schema40':None,'schema41':None}
FROZEN={'release.py':'62ce229284777f01a81589c61738cfef0feeadc1f68ef0049c883b54fdfed337','state.py':'84e90862eb72013663e1531a869563b0b9c7a9b57ae79e994825a7dcec4feba9','stage.py':'230ddc6bcb94bf5f1f63d8cc8850b844af5df595142802da191106bcbc5c59a0','fresh_quality.py':'ab3b9739b740f62b93f2295ecd64b186ec977ffdb551d6d17e9fd4463645c6de','scan-stage.mjs':'daaff6e5644bfd10e2548f5ce8634ac3bc36c1411d1ea596e06b5079e9935454'}
PREDECESSOR={'release.py':'d1a8d744f4e4c481d0ed2cee9b42a930c5ebc9c029893606ae694aeeda72690c','gates.py':'bd071110608af61f066e74d398f1b85ecbfbeaac4ce0197fa5d844ed116070ac','stage.py':'918848f8dfc38f441e4094fa0ba9b86fb73992420acea16147e4522dcfafd406','scan-stage.mjs':'ca0e72c67eb2af520964f8619b9827d8e00adb19e5bcd9323b0f50a4d2c1ae50','preflight.py':'f839f103181dd6b0cfb5eae8c1c0d454f3d8377b93dac7725fb92b49bc7c2419','inputs.template.json':'46132c1557a24091561041ff2ec576a7c59db6b30068bf2ca9b255fb7b638027','test_release.py':'ab57e394b311f1d9806b8c0feeb062b439888c3e272784943092d63d5000a23f','README.md':'89b3d14017eaf335740d42bc0e64c71c749174f8d329cce670223650bb72c05f'}
TESTABLE=['apps','packages','contracts','tests','tools','fixtures','package.json','package-lock.json','tsconfig.json','eslint.config.mjs','playwright.config.ts']
COMMANDS={'test':['test'],'typecheck':['run','typecheck'],'lint':['run','lint'],'production_guard':['run','check:production-guard']}
NATIVE='sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4'
REASON_FILES={'packages/domain/src/review-link-action.ts','packages/domain/src/guest-types.ts','packages/central/src/guest-reviews.ts','packages/central/src/review-credentials.ts','apps/web/lib/guest-http.ts'}

def need(value):
 if not value:raise ValueError('REVIEW_LINK_REASON_WEB_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def run_id(value):need(type(value)is str and str(uuid.UUID(value))==value and uuid.UUID(value).version==4);return value
def load(path,limit=16*1024**2):
 need(path.is_file()and not path.is_symlink()and not path.is_junction()and path.resolve()==path and path.stat().st_nlink==1 and 0<path.stat().st_size<=limit);return path.read_bytes()
def reference(root,ref):
 need(type(ref)is dict and set(ref)=={'path','sha256'}and type(ref['path'])is str and re.fullmatch(r'tracking/evidence/m07/[A-Za-z0-9_./-]+\.json',ref['path'])and'..'not in ref['path'].split('/')and re.fullmatch('[a-f0-9]{64}',ref['sha256']))
 raw=load(root/ref['path']);need(sha(raw)==ref['sha256']);return json.loads(raw)
def git(root,args):
 result=subprocess.run(['git',*args],cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60);need(result.returncode==0 and len(result.stdout)<16*1024**2 and len(result.stderr)<65536);return result.stdout
def at(value,path):
 need(type(path)is list and 0<len(path)<=8 and all(type(x)is str and re.fullmatch('[A-Za-z0-9_]+',x)for x in path))
 for item in path:need(type(value)is dict and item in value);value=value[item]
 return value
def canonical(root,key,ref,private_verify):
 need(key in('schema40','schema41')and CANONICAL.get(key)is not None);approved=CANONICAL[key];need(approved['count']==int(key[-2:])and ref==approved['ref']);value=reference(root,ref)
 need(value['result']=='passed'and value['target']==TARGET and value['version']==approved['version']and value['normal_return_marker_observed']is True and value['two_independent_readbacks_equal']is True and value['first']==value['second'])
 history=at(value['first'],approved['history_path']);need(type(history)is list and len(history)==approved['count']and len(set(history))==len(history)and all(type(x)is str and re.fullmatch('[0-9]{14}',x)for x in history)and history==sorted(history)and history[-1]==approved['version']and'20261102085405'in history)
 need(value['local_proof']==approved['proof']and value['checkpoint']==approved['checkpoint']);proof=reference(root,approved['proof'])
 need(proof['result']=='passed'and proof['all_owned_resources_absent']is True and proof['original_data_catalogue_and_global_roles_unchanged']is True and proof['shared_lock_released']is True)
 checkpoint=approved['checkpoint'];need(set(checkpoint)=={'path','sha256','history_path','tables','scope','restore_verified'}and checkpoint['scope']=='after_apply'and checkpoint['restore_verified']is False and type(checkpoint['tables'])is int and checkpoint['tables']>=76)
 need(type(checkpoint['path'])is str and re.fullmatch(r'\.local/[A-Za-z0-9_./-]+\.json',checkpoint['path'])and'..'not in checkpoint['path'].split('/')and re.fullmatch('[a-f0-9]{64}',checkpoint['sha256']))
 file=root/checkpoint['path'];private_verify(file);raw=load(file);need(sha(raw)==checkpoint['sha256']);payload=json.loads(raw);need(payload['target']==TARGET and at(payload,checkpoint['history_path'])==history)
 return {'key':key,'ref':ref,'proof':approved['proof'],'checkpoint':checkpoint,'version':approved['version'],'history':history}
def preflight(root,ref,plan,now,built_at):
 value=reference(root,ref);keys={'schema_version','purpose','result','run_id','source_commit','source_manifest_sha256','target','canonical_receipt','recovery_checkpoint_sha256','observed_at','first','second','two_independent_readbacks_equal','cloud_mutations'}
 need(set(value)==keys and value['schema_version']=='1.0'and value['purpose']=='review_link_reason_web_canonical_preflight'and value['result']=='passed'and value['target']==TARGET and value['run_id']==plan['run_id']and value['source_commit']==plan['gates']['source_commit']and value['source_manifest_sha256']==plan['gates']['source_sha256']and value['canonical_receipt']==plan['gates']['canonical']['ref']and value['recovery_checkpoint_sha256']==plan['gates']['canonical']['checkpoint']['sha256']and value['two_independent_readbacks_equal']is True and value['cloud_mutations']is False and value['first']==value['second'])
 observed=datetime.datetime.fromisoformat(value['observed_at']);built=datetime.datetime.fromisoformat(built_at);need(observed.tzinfo is not None and built.tzinfo is not None and now.tzinfo is not None and built<observed and -60<=(now-observed).total_seconds()<=900)
 current=value['first'];need(type(current)is dict and set(current)=={'history','gates','native_image_id','english_transcript_version','lifecycle'}and current['history']==plan['gates']['canonical']['history']and current['native_image_id']==NATIVE and current['english_transcript_version']=='1.0')
 gates=current['gates'];need(type(gates)is dict and set(gates)=={'specs','candidates','support','frames','presentations'}and all(x is True for x in gates.values()))
 lifecycle=current['lifecycle'];need(type(lifecycle)is dict and set(lifecycle)=={'queued','running','waiting_for_input','generic_retry_lifecycle','presentation_retry_lifecycle','pending_outbox','leased_outbox'}and all(type(x)is int and x==0 for x in lifecycle.values()))
 return {'ref':ref,'run_id':plan['run_id'],'observed_at':value['observed_at'],'after_local_build':True,'exact_history_and_production_gates':True,'two_independent_readbacks_equal':True}
def quality(root,source,ref):
 value=reference(root,ref);commit=source['source_commit'];tree=git(root,['rev-parse',commit+'^{tree}']).decode().strip()
 need(value['result']=='passed'and value['source_head_before']==value['source_head_after']==commit and value['source_tree']==tree and value['reviewed_source_stable']is True and value['testable_graph_worktree_clean']is True and value['changed_source_paths']==[]and value['review']['unresolved_findings']==0 and value['node_version']=='v24.18.0')
 need(type(value['checks'])is list and len(value['checks'])==4);checks={x['name']:x for x in value['checks']};need(set(checks)==set(COMMANDS))
 for name,row in checks.items():
  need(row['result']=='passed'and type(row['exit_code'])is int and row['exit_code']==0 and row['signal']is None and all(row[x]is False for x in('timed_out','output_limit_exceeded','spawn_failed')))
  need(type(row['command'])is list and len(row['command'])>=3 and Path(row['command'][0])==Path('C:/Program Files/nodejs/node.exe')and Path(row['command'][1])==Path('C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js')and row['command'][2:]==COMMANDS[name])
 test=checks['test'];need(type(test['tests'])is int and test['tests']==test['pass']and test['tests']>=968 and test['suite_summaries']==6 and all(type(test[x])is int and test[x]==0 for x in('fail','cancelled','skipped','todo')))
 rows=[]
 for line in git(root,['ls-tree','-r','-z',commit,'--',*TESTABLE]).decode().split('\0'):
  if not line:continue
  match=re.fullmatch(r'(100644|100755) blob ([a-f0-9]{40})\t(.+)',line);need(match is not None);rows.append({'path':match[3],'mode':match[1],'git_blob':match[2]})
 need(rows==value['all_testable_source_files']and len(rows)==value['testable_source_file_count']and len(rows)>1000 and len({x['path']for x in rows})==len(rows))
 need(REASON_FILES<={x['path']for x in source['files']});required=set(REASON_FILES)
 changed=set(git(root,['diff','--name-only',BASE_COMMIT,commit,'--',*TESTABLE]).decode().splitlines())
 required|=changed&{x['path']for x in source['files']}
 seals=value['reviewed_source_seals'];need(type(seals)is list and required<={x['path']for x in seals}and len({x['path']for x in seals})==len(seals))
 for row in seals:
  need(type(row['path'])is str and'..'not in row['path'].split('/')and not row['path'].startswith('/'));raw=git(root,['show',commit+':'+row['path']]);need(len(raw)==row['bytes']and sha(raw)==row['sha256'])
 archive=git(root,['archive','--format=tar',commit,'--',*[x['path']for x in source['files']]]);need(sha(archive)==source['archive_sha256'])
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:')as tar:
  files={m.name:m for m in tar.getmembers()if m.isfile()};need(set(files)=={x['path']for x in source['files']})
  for row in source['files']:
   raw=tar.extractfile(files[row['path']]).read();need(len(raw)==row['bytes']and sha(raw)==row['sha256'])
 return {'ref':ref,'tested_head':commit,'tested_tree':tree,'actual_tests':test['tests'],'testable_inventory_sha256':digest(rows),'all_commands_passed':True,'fresh_actual_quality':True}
