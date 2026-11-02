"""New admission for actual fresh OAuth quality; never runs any quality gate."""
from pathlib import Path
import datetime, importlib.util, io, json, re, subprocess, sys, tarfile, uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('production_fresh_quality_operator',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);s=r.s
RAW={'path':'tracking/evidence/m07/completion-release/2026-11-02T00-08-23.891Z-3a9ab5d8-oauth-root-quality.json','sha256':'7d40dff89354d746b80018e67983e8e8e38070c402bdb12b2b6efe494672871d'}
TESTED='c88f58c00820169f7396d72def77a74f1443594e';TREE='1bc63c161c95f93ea4607eb3d7f6d4452e6763dd'
PATHS=['apps','packages','contracts','tests','tools','fixtures','package.json','package-lock.json','tsconfig.json','eslint.config.mjs','playwright.config.ts']
REVIEWED={'apps/web/lib/mcp-auth.ts','apps/web/lib/mcp-http.ts','apps/web/app/mcp/route.ts','tests/server/mcp-verified-token-trace.test.ts','development/m07/completion-oauth/README.md'}
COMMANDS={'test':['test'],'typecheck':['run','typecheck'],'lint':['run','lint'],'production_guard':['run','check:production-guard']}

def admit(root,source,quality):
 s.need(quality['result']=='passed'and quality['source_head_before']==quality['source_head_after']==TESTED and quality['source_tree']==TREE and quality['reviewed_source_stable']is True and quality['testable_graph_worktree_clean']is True and quality['changed_source_paths']==[]and quality['review']['unresolved_findings']==0 and quality['node_version']=='v24.18.0')
 s.need(type(quality['checks'])is list and len(quality['checks'])==4);checks={row['name']:row for row in quality['checks']};s.need(set(checks)==set(COMMANDS))
 for key,row in checks.items():
  s.need(row['result']=='passed'and type(row['exit_code'])is int and row['exit_code']==0 and all(row[k]is False for k in('timed_out','output_limit_exceeded','spawn_failed'))and row['signal']is None)
  s.need(type(row['command'])is list and len(row['command'])>=3 and Path(row['command'][0])==Path('C:/Program Files/nodejs/node.exe')and Path(row['command'][1])==Path('C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js')and row['command'][2:]==COMMANDS[key])
 test=checks['test'];s.need(type(test['tests'])is int and test['tests']==test['pass']==955 and test['suite_summaries']==6 and all(type(test[k])is int and test[k]==0 for k in('fail','cancelled','skipped','todo')))
 def git(args):
  value=subprocess.run(['git',*args],cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);s.need(value.returncode==0 and len(value.stdout)<16*1024**2 and len(value.stderr)<65536);return value.stdout
 s.need(git(['rev-parse',TESTED+'^{tree}']).decode().strip()==TREE);git(['merge-base','--is-ancestor',TESTED,source['source_commit']])
 manifest=[]
 for line in git(['ls-tree','-r','-z',TESTED,'--',*PATHS]).decode().split('\0'):
  if not line:continue
  match=re.fullmatch(r'(100644|100755) blob ([a-f0-9]{40})\t(.+)',line);s.need(match is not None);manifest.append({'path':match[3],'mode':match[1],'git_blob':match[2]})
 s.need(manifest==quality['all_testable_source_files']and len(manifest)==quality['testable_source_file_count']==1328 and len({row['path']for row in manifest})==len(manifest))
 s.need(git(['diff','--name-only',TESTED,source['source_commit'],'--',*PATHS])==b'')
 seals=quality['reviewed_source_seals'];s.need(type(seals)is list and len(seals)==5 and {row['path']for row in seals}==REVIEWED)
 for row in seals:
  raw=git(['show',TESTED+':'+row['path']]);s.need(len(raw)==row['bytes']and s.sha(raw)==row['sha256'])
 rows=source['files'];archive=git(['archive','--format=tar',source['source_commit'],'--',*[row['path']for row in rows]]);s.need(s.sha(archive)==source['archive_sha256'])
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:')as tar:
  files={member.name:member for member in tar.getmembers()if member.isfile()};s.need(set(files)=={row['path']for row in rows})
  for row in rows:
   raw=tar.extractfile(files[row['path']]).read();s.need(len(raw)==row['bytes']and s.sha(raw)==row['sha256'])
 return {'raw_quality':RAW,'tested_head':TESTED,'tested_tree':TREE,'original_started_at':quality['started_at'],'original_finished_at':quality['finished_at'],'reviewed_source_seals':seals,'testable_source_file_count':1328,'testable_inventory_sha256':s.digest(manifest),'complete_testable_tree_preserved':True,'every_selected_blob_matches_archive':True,'actual_tests':955,'actual_pass':955,'actual_failed':0,'actual_skipped':0,'actual_command_exit_codes':{key:row['exit_code']for key,row in checks.items()},'carried_forward':False,'additional_quality_commands_run':False}

def run(root,source_path):
 root=Path(root).resolve();operator=r.Operator(root,HERE);raw=r.load(root/source_path);source=json.loads(raw);binding=admit(root,source,operator.reference(RAW));operator.git_source(source['source_commit'],[row['path']for row in source['files']])
 value={'result':'passed','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_commit':source['source_commit'],'source_sha256':source['source_sha256'],'source_receipt':{'path':source_path,'sha256':s.sha(raw)},'quality_kind':'fresh_reviewed_product_bytes','fresh_quality_verification':binding,'failed':0,'skipped':0,'commands':binding['actual_command_exit_codes'],'actual_full_tests':955,'additional_quality_commands_run':False,'provider_or_deployment_called':False,'raw_logs_or_private_values_persisted':False}
 path=root/'tracking/evidence/m07/production-web-release'/('fresh-quality-'+str(uuid.uuid4())+'.json');path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 return {'result':'passed','receipt':path.relative_to(root).as_posix(),'sha256':s.sha(r.load(path)),'actual_full_tests':955,'additional_quality_commands_run':False,'provider_or_deployment_called':False}

if __name__=='__main__':
 try:
  s.need(len(sys.argv)in(2,3));print(json.dumps(run(Path(sys.argv[2])if len(sys.argv)==3 else ROOT,sys.argv[1])))
 except Exception:print('PRODUCTION_WEB_FRESH_QUALITY_UNCONFIRMED',file=sys.stderr);sys.exit(1)
