"""Immutable main product git-archive stage; local only, never deploys."""
from pathlib import Path
import datetime, importlib.util, io, json, re, subprocess, sys, tarfile, uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('production_stage_operator',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);s=r.s
PREFIXES=['apps/web','packages','contracts/json-schema','contracts/mcp-tool-catalog.json','package.json','package-lock.json','tsconfig.json','CONTRACT_BASELINE.md','tools/start-web.mjs']
EXTRA={'apps/web/lib/hosting-pilot.ts','tools/start-pilot-web.mjs','apps/worker/package.json'}

def validate_members(members,selected):
 files={};total=0
 for member in members:
  name=member.name
  s.need(type(name)is str and not name.startswith('/')and'\\'not in name and':'not in name and all(p not in('.','..','')for p in name.rstrip('/').split('/')))
  if member.isdir():continue
  s.need(member.isfile()and not member.issym()and not member.islnk()and name in selected and name not in files and 0<=member.size<8*1024**2);files[name]=member;total+=member.size;s.need(total<16*1024**2)
 s.need(set(files)==set(selected));return files

def run(root,commit):
 root=Path(root).resolve();operator=r.Operator(root,HERE);s.need(re.fullmatch('[a-f0-9]{40}',commit));operator.pins()
 def git(args,raw=False):
  output=subprocess.run(['git',*args],cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60);s.need(output.returncode==0 and len(output.stdout)<16*1024**2 and len(output.stderr)<65536);return output.stdout if raw else output.stdout.decode().strip()
 listed=git(['ls-tree','-r','--name-only',commit,'--',*PREFIXES]).splitlines();selected=sorted({p for p in listed if p and not re.search(r'(?:^|/)(?:test|tests|__tests__)(?:/|$)',p)}|EXTRA)
 s.need(100<len(selected)<1000 and all(not re.search(r'(?:^|/)(?:\.env[^/]*|\.local|\.git|Screenshots|redesign-output|node_modules|\.next[^/]*)(?:/|$)',p)for p in selected));operator.git_source(commit,selected)
 private=root/'.local/production-web-release';private.mkdir(parents=True,exist_ok=True);run_id=str(uuid.uuid4());folder=private/('source-'+run_id);s.need(not folder.exists());folder.mkdir()
 # Git supplies blob bytes for exactly these paths at the pinned commit. The
 # working tree's line endings, generated files and untracked content cannot enter.
 archive=git(['archive','--format=tar',commit,'--',*selected],True);archive_file=private/('source-'+run_id+'.tar')
 with operator.guard.create(archive_file)as stream:operator.guard.verify_open(stream);stream.write(archive);stream.flush();operator.guard.verify_open(stream)
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:')as tar:
  files=validate_members(tar.getmembers(),selected)
  for name in selected:
   member=files[name];raw=tar.extractfile(member).read();s.need(len(raw)==member.size);target=folder/name;target.parent.mkdir(parents=True,exist_ok=True)
   with target.open('xb')as stream:stream.write(raw)
 link=folder/'.vercel/project.json';link.parent.mkdir();link.write_text(json.dumps({'projectId':s.PROJECT,'orgId':s.TEAM,'projectName':'everyone-presentation-pilot'})+'\n',encoding='utf8')
 scanned=json.loads(operator.run([str(operator.old.NODE),str(HERE/'scan-stage.mjs'),str(root),str(folder)],60));s.need(scanned=={'result':'passed','private_hits':0,'private_inputs_stable':True,'private_input_families':14,'files':len(selected)})
 rows=[{'path':name,'bytes':len(r.load(folder/name)),'sha256':s.sha(r.load(folder/name))}for name in selected];operator.git_source(commit,selected)
 s.need(operator.base.sealed_source_files(folder)==sorted(selected+['.vercel/project.json']))
 value={'result':'passed','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_commit':commit,'source_root':folder.relative_to(root).as_posix(),'source_sha256':s.digest(rows),'entries':len(rows),'bytes':sum(x['bytes']for x in rows),'files':rows,'archive_sha256':s.sha(archive),'archive_source':True,'project_id':s.PROJECT,'team_id':s.TEAM,'private_hits':0,'private_inputs_stable':True,'private_input_families':14,'source_stable':True,'cloud_mutation':False,'private_scan_scope':'fixed existing secret families only; not full PII or repository/archive acceptance','stage_source_pins':operator.pins()}
 path=root/'tracking/evidence/m07/production-web-release'/('source-'+run_id+'.json');path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 return {'result':'passed','receipt':path.relative_to(root).as_posix(),'sha256':s.sha(r.load(path)),'source_commit':commit,'source_sha256':value['source_sha256'],'entries':len(rows),'cloud_mutation':False}

if __name__=='__main__':
 try:
  s.need(len(sys.argv)in(2,3));print(json.dumps(run(Path(sys.argv[2])if len(sys.argv)==3 else ROOT,sys.argv[1])))
 except Exception:print('PRODUCTION_WEB_STAGE_UNCONFIRMED',file=sys.stderr);sys.exit(1)
