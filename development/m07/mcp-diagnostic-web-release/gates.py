"""Closed local receipt admission. No provider, database or quality commands."""
from pathlib import Path
import datetime, hashlib, io, json, re, subprocess, tarfile, uuid

PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';SLUG='muhammed-abdelrahman'
ALIAS='everyone-presentation-pilot.vercel.app';TARGET='pyibofyctwnqpvktepse'
BASELINE='dpl_J3hmctcHndRp8zDVAPYfcnjEgpzG'
BASELINE_RECEIPT={'path':'tracking/evidence/m07/production-web-release/2026-11-02T02-34-07-437169Z-readback.json','sha256':'410caceb600e01589147fdb1e13cd3cbb5b8dc8d8ce8459f27c7ee178c0116cb'}
CANONICAL={
 'schema39':{'ref':{'path':'tracking/evidence/m07/project-creation39-canonical-release/2026-11-01T23-46-11-679664Z-apply.json','sha256':'badbed58027c49897734251edb3aba666571eb57aa6b4e3f6e053c88dc264864'},'version':'20261101223342','count':39},
 # A later reviewed source change must pin the SPECIFIC actual passed40 receipt.
 # A private input cannot substitute an arbitrary hash or a migration count.
 'schema40':None,
}
FROZEN={'release.py':'62ce229284777f01a81589c61738cfef0feeadc1f68ef0049c883b54fdfed337','state.py':'84e90862eb72013663e1531a869563b0b9c7a9b57ae79e994825a7dcec4feba9','stage.py':'230ddc6bcb94bf5f1f63d8cc8850b844af5df595142802da191106bcbc5c59a0','fresh_quality.py':'ab3b9739b740f62b93f2295ecd64b186ec977ffdb551d6d17e9fd4463645c6de','scan-stage.mjs':'daaff6e5644bfd10e2548f5ce8634ac3bc36c1411d1ea596e06b5079e9935454'}
TESTABLE=['apps','packages','contracts','tests','tools','fixtures','package.json','package-lock.json','tsconfig.json','eslint.config.mjs','playwright.config.ts']
COMMANDS={'test':['test'],'typecheck':['run','typecheck'],'lint':['run','lint'],'production_guard':['run','check:production-guard']}
NATIVE='sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4'
RECOVERY_CHECKPOINT='d50647eec503fe6672898deec2e4e19460432edd8a951397e37454c15d3ab88d'

def need(value):
 if not value:raise ValueError('MCP_DIAGNOSTIC_WEB_UNCONFIRMED')
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
def canonical(root,key,ref):
 need(key in CANONICAL and CANONICAL[key]is not None);approved=CANONICAL[key];need(ref==approved['ref']);value=reference(root,ref)
 need(value['result']=='passed'and value['target']==TARGET and value['version']==approved['version']and value['normal_return_marker_observed']is True and value['two_independent_readbacks_equal']is True and value['first']==value['second'])
 history=value['first']['base']['history'];need(type(history)is list and len(history)==approved['count']and len(set(history))==len(history)and all(type(x)is str and re.fullmatch('[0-9]{14}',x)for x in history)and history==sorted(history)and history[-1]==approved['version'])
 return {'key':key,'ref':ref,'version':approved['version'],'history':history}
def preflight(root,ref,plan,now,built_at):
 value=reference(root,ref);keys={'schema_version','purpose','result','run_id','source_commit','source_manifest_sha256','target','canonical_receipt','recovery_checkpoint_sha256','observed_at','first','second','two_independent_readbacks_equal','cloud_mutations'}
 need(set(value)==keys and value['schema_version']=='1.0'and value['purpose']=='mcp_diagnostic_web_canonical_preflight'and value['result']=='passed'and value['target']==TARGET and value['run_id']==plan['run_id']and value['source_commit']==plan['gates']['source_commit']and value['source_manifest_sha256']==plan['gates']['source_sha256']and value['canonical_receipt']==plan['gates']['canonical']['ref']and value['recovery_checkpoint_sha256']==RECOVERY_CHECKPOINT and value['two_independent_readbacks_equal']is True and value['cloud_mutations']is False and value['first']==value['second'])
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
 test=checks['test'];need(type(test['tests'])is int and test['tests']==test['pass']and test['tests']>=955 and test['suite_summaries']==6 and all(type(test[x])is int and test[x]==0 for x in('fail','cancelled','skipped','todo')))
 rows=[]
 for line in git(root,['ls-tree','-r','-z',commit,'--',*TESTABLE]).decode().split('\0'):
  if not line:continue
  match=re.fullmatch(r'(100644|100755) blob ([a-f0-9]{40})\t(.+)',line);need(match is not None);rows.append({'path':match[3],'mode':match[1],'git_blob':match[2]})
 need(rows==value['all_testable_source_files']and len(rows)==value['testable_source_file_count']and len(rows)>1000 and len({x['path']for x in rows})==len(rows))
 required={'apps/web/lib/mcp.ts','apps/web/lib/mcp-error-text.ts','apps/web/lib/mcp-output-validation.ts'}
 changed=set(git(root,['diff','--name-only','c88f58c00820169f7396d72def77a74f1443594e',commit,'--',*TESTABLE]).decode().splitlines())
 required|=changed&{x['path']for x in source['files']}
 if any(x['path']=='packages/domain/src/review-link-action.ts'for x in source['files']):required|={'packages/domain/src/review-link-action.ts','packages/domain/src/guest-types.ts','packages/central/src/guest-reviews.ts','packages/central/src/review-credentials.ts','apps/web/lib/guest-http.ts'}
 seals=value['reviewed_source_seals'];need(type(seals)is list and required<={x['path']for x in seals}and len({x['path']for x in seals})==len(seals))
 for row in seals:
  need(type(row['path'])is str and'..'not in row['path'].split('/')and not row['path'].startswith('/'));raw=git(root,['show',commit+':'+row['path']]);need(len(raw)==row['bytes']and sha(raw)==row['sha256'])
 archive=git(root,['archive','--format=tar',commit,'--',*[x['path']for x in source['files']]]);need(sha(archive)==source['archive_sha256'])
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:')as tar:
  files={m.name:m for m in tar.getmembers()if m.isfile()};need(set(files)=={x['path']for x in source['files']})
  for row in source['files']:
   raw=tar.extractfile(files[row['path']]).read();need(len(raw)==row['bytes']and sha(raw)==row['sha256'])
 return {'ref':ref,'tested_head':commit,'tested_tree':tree,'actual_tests':test['tests'],'testable_inventory_sha256':digest(rows),'all_commands_passed':True,'fresh_actual_quality':True}
