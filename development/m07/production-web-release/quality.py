"""Carry forward actual reviewed root quality; only fixture guard runs afresh."""
from pathlib import Path
import datetime, importlib.util, io, json, subprocess, sys, tarfile, uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('production_quality_operator',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);s=r.s
ORIGINAL={'path':'tracking/evidence/m07/completion-release/2026-11-01T23-35-58.511Z-41676ea4-root-quality.json','sha256':'5504f2e9056095be29f789c15b8736de94eafde9eef0c88b50b684c938f672af'}
TESTED='e649b26e9d57292657f31c11a89585a54be2926f'
REVIEWED=['contracts/mcp-tool-catalog.json','tests/server/project-creation-mcp.test.ts','tools/update_project_creation_contracts.py']

def carry(root,source,quality):
 s.need(quality['result']=='passed'and quality['source_head_before']==quality['source_head_after']==TESTED and quality['reviewed_source_stable']is True and sorted(quality['changed_source_paths'])==sorted(REVIEWED)and quality['review']['unresolved_findings']==0)
 checks={row['name']:row for row in quality['checks']};s.need(set(checks)=={'test','lint','typecheck'})
 for row in checks.values():s.need(row['result']=='passed'and row['exit_code']==0 and all(row[k]is False for k in('timed_out','output_limit_exceeded','spawn_failed')))
 s.need(checks['test']['tests']==checks['test']['pass']==949 and all(checks['test'][k]==0 for k in('fail','cancelled','skipped','todo')))
 def git(args):
  result=subprocess.run(['git',*args],cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);s.need(result.returncode==0 and len(result.stdout)<8*1024**2 and len(result.stderr)<65536);return result.stdout
 commit=source['source_commit'];git(['merge-base','--is-ancestor',TESTED,commit]);seals={row['path']:row for row in quality['reviewed_source_seals']};s.need(set(seals)==set(REVIEWED))
 for path,row in seals.items():
  raw=git(['show',commit+':'+path]);s.need(len(raw)==row['bytes']and s.sha(raw)==row['sha256'])
 paths=[row['path']for row in source['files']];changed=git(['diff','--name-only',TESTED,commit,'--',*paths]).decode().splitlines();s.need(changed==['contracts/mcp-tool-catalog.json'])
 archive=git(['archive','--format=tar',commit,'--',*paths]);s.need(s.sha(archive)==source['archive_sha256'])
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:')as tar:
  files={row.name:row for row in tar.getmembers()if row.isfile()};s.need(set(files)==set(paths))
  for row in source['files']:
   raw=tar.extractfile(files[row['path']]).read();s.need(len(raw)==row['bytes']and s.sha(raw)==row['sha256'])
 return {'original_quality':ORIGINAL,'original_started_at':quality['started_at'],'original_finished_at':quality['finished_at'],'tested_head':TESTED,'reviewed_source_seals':quality['reviewed_source_seals'],'selected_product_changes_since_tested_head':changed,'every_selected_blob_matches_archive':True,'reviewed_seals_match_committed_bytes':True,'carried_forward':True,'original_tests':949,'original_failed':0,'original_skipped':0,'original_command_exit_codes':{key:row['exit_code']for key,row in checks.items()},'new_test_or_lint_or_typecheck_run':False}

def run(root,source_path):
 root=Path(root).resolve();operator=r.Operator(root,HERE);source_raw=r.load(root/source_path);source=json.loads(source_raw);original=operator.reference(ORIGINAL);binding=carry(root,source,original);operator.git_source(source['source_commit'],[row['path']for row in source['files']])
 started=datetime.datetime.now(datetime.timezone.utc).isoformat();command=[str(operator.old.NODE),str(operator.base.NPM),'run','check:production-guard'];operator.run(command,60,root,operator.old.environment())
 operator.git_source(source['source_commit'],[row['path']for row in source['files']]);s.need(carry(root,source,operator.reference(ORIGINAL))==binding)
 value={'result':'passed','source_commit':source['source_commit'],'source_sha256':source['source_sha256'],'source_receipt':{'path':source_path,'sha256':s.sha(source_raw)},'quality_kind':'carried_forward_reviewed_product_bytes','carried_forward_verification':binding,'failed':0,'skipped':0,'commands':{**binding['original_command_exit_codes'],'production_guard':0},'fresh_production_guard':{'command':command,'exit_code':0,'started_at':started,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_pins':{p:s.sha(r.load(root/p))for p in('tools/check-production-guard.ts','apps/web/lib/config.ts','apps/web/lib/hosting-pilot.ts')}},'provider_or_deployment_called':False,'full_tests_rerun':False,'raw_logs_or_private_values_persisted':False}
 path=root/'tracking/evidence/m07/production-web-release'/('quality-'+str(uuid.uuid4())+'.json');path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 return {'result':'passed','receipt':path.relative_to(root).as_posix(),'sha256':s.sha(r.load(path)),'carried_forward_tests':949,'fresh_production_guard_exit':0,'provider_or_deployment_called':False}

if __name__=='__main__':
 try:
  s.need(len(sys.argv)in(2,3));print(json.dumps(run(Path(sys.argv[2])if len(sys.argv)==3 else ROOT,sys.argv[1])))
 except Exception:print('PRODUCTION_WEB_QUALITY_UNCONFIRMED',file=sys.stderr);sys.exit(1)
