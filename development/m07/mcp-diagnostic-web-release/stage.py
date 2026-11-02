"""New per-UUID immutable Main archive. No historical stage main is called."""
from pathlib import Path
import importlib.util, io, json, re, sys, tarfile
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('mcp_diagnostic_stage_release',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);g=r.g

def run(run_id,commit):
 g.need(r.RELEASE_ENABLED);g.run_id(run_id);g.need(re.fullmatch('[a-f0-9]{40}',commit));operator=r.Operator(run_id);root=operator.root;frozen=r.module('mcp_diagnostic_archive_validation',root/'development/m07/production-web-release/stage.py')
 paths=g.git(root,['ls-tree','-r','--name-only',commit,'--',*frozen.PREFIXES]).decode().splitlines();selected=sorted({p for p in paths if p and not re.search(r'(?:^|/)(?:test|tests|__tests__)(?:/|$)',p)}|frozen.EXTRA)
 g.need(100<len(selected)<1000 and all(not re.search(r'(?:^|/)(?:\.env[^/]*|\.local|\.git|Screenshots|redesign-output|node_modules|\.next[^/]*)(?:/|$)',p)for p in selected));operator.git_source(commit,selected);pins=operator.pins()
 private=operator.private;g.need(not private.exists());private.parent.mkdir(parents=True,exist_ok=True);private.mkdir();operator.write(private/'stage.claim.json',{'run_id':run_id,'source_commit':commit,'source_pins':pins,'automatic_retry':False});folder=private/'source';folder.mkdir()
 archive=g.git(root,['archive','--format=tar',commit,'--',*selected])
 with operator.guard.create(private/'source.tar')as stream:operator.guard.verify_open(stream);stream.write(archive);stream.flush();operator.guard.verify_open(stream)
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:')as tar:
  members=frozen.validate_members(tar.getmembers(),selected)
  for name in selected:
   member=members[name];raw=tar.extractfile(member).read();g.need(len(raw)==member.size);target=folder/name;target.parent.mkdir(parents=True,exist_ok=True)
   with target.open('xb')as stream:stream.write(raw)
 link=folder/'.vercel/project.json';link.parent.mkdir();link.write_text(json.dumps({'projectId':g.PROJECT,'orgId':g.TEAM,'projectName':'everyone-presentation-pilot'})+'\n',encoding='utf8')
 scanned=json.loads(operator.run([str(operator.old.NODE),str(HERE/'scan-stage.mjs'),str(root),str(folder)],60));g.need(scanned=={'result':'passed','private_hits':0,'private_inputs_stable':True,'private_input_families':14,'private_input_files':10,'files':len(selected)})
 rows=[{'path':name,'bytes':len(g.load(folder/name)),'sha256':g.sha(g.load(folder/name))}for name in selected];operator.git_source(commit,selected)
 g.need(operator.base.sealed_source_files(folder)==sorted(selected+['.vercel/project.json'])and operator.pins()==pins)
 value={'result':'passed','run_id':run_id,'observed_at':r.stamp(),'source_commit':commit,'source_root':folder.relative_to(root).as_posix(),'source_sha256':g.digest(rows),'entries':len(rows),'bytes':sum(x['bytes']for x in rows),'files':rows,'archive_sha256':g.sha(archive),'archive_source':True,'project_id':g.PROJECT,'team_id':g.TEAM,'private_hits':0,'private_inputs_stable':True,'private_input_families':14,'private_input_files':10,'source_stable':True,'cloud_mutation':False,'private_scan_scope':'fixed existing secret families only; not full PII or repository/archive acceptance','stage_source_pins':pins,'stage_claim_sha256':operator.file_sha(private/'stage.claim.json')}
 path=root/'tracking/evidence/m07/mcp-diagnostic-web-release'/('source-'+run_id+'.json');path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 return {'result':'passed','run_id':run_id,'receipt':path.relative_to(root).as_posix(),'sha256':g.sha(g.load(path)),'source_commit':commit,'source_sha256':value['source_sha256'],'entries':len(rows),'cloud_mutation':False}
if __name__=='__main__':
 try:g.need(len(sys.argv)==3);print(json.dumps(run(sys.argv[1],sys.argv[2])))
 except Exception:print('MCP_DIAGNOSTIC_WEB_STAGE_UNCONFIRMED',file=sys.stderr);sys.exit(1)
