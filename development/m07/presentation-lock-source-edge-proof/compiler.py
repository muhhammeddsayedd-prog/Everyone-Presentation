"""Fresh disabled edge purpose using pinned inert compiler/proof libraries."""
from pathlib import Path
import hashlib,importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
OLD=HERE.parent/'presentation-lock-source-dedupe-proof'
OLD_COMPILER_SHA='b7ce789a621ca4efe92b26770ad28b3210f5bb407d8fe61bacb12ad9427db3cf'
OLD_ENTRY_SHA='d6f2c841c1f0bc678e14bc7b5d3cbd2b11e4f902603a5b20a11acc8d3507f605'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def need(ok):
 if not ok:raise ValueError('LOCKSOURCE41_EDGE_PROJECTION_UNCONFIRMED')
def compile_source(relative):
 need(sha((OLD/'compiler.py').read_bytes())==OLD_COMPILER_SHA and sha((OLD/'entry.mjs').read_bytes())==OLD_ENTRY_SHA)
 spec=importlib.util.spec_from_file_location('pinned_dedupe_compiler_library',OLD/'compiler.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
 source=old.compile_source(relative)
 def replace(a,b):
  nonlocal source
  need(source.count(a)==1);source=source.replace(a,b)
 replace(json.dumps((OLD/'entry.mjs').as_uri()),json.dumps((HERE/'entry.mjs').as_uri()))
 for a,b in[("'.local/presentation-lock-source-dedupe-proof'","'.local/presentation-lock-source-edge-proof'"),("'tracking/evidence/m07/presentation-lock-source-dedupe-proof'","'tracking/evidence/m07/presentation-lock-source-edge-proof'"),("'eps.locksource41dedupe.run'","'eps.locksource41edge.run'"),("'eps.locksource41dedupe.workspace'","'eps.locksource41edge.workspace'"),("'eps.locksource41dedupe.purpose'","'eps.locksource41edge.purpose'"),("'locksource41-dedupe-qualified-performance-equality'","'locksource41-edge-qualified-performance-equality'"),("'eps-locksrc41dedupe-'","'eps-locksrc41edge-'"),("'presentation-lock-source41-dedupe-owned-proof'","'presentation-lock-source41-edge-owned-proof'")]:replace(a,b)
 need(source.count('label=eps.locksource41dedupe.run=')==2);source=source.replace('label=eps.locksource41dedupe.run=','label=eps.locksource41edge.run=')
 files=[HERE/'compiler.py',HERE/'entry.mjs',HERE/'test_edge.py',HERE/'README.md']
 checks=''.join('\n  assert.equal(sha(await readFile('+json.dumps(str(p).replace('\\','/'))+')),'+json.dumps(sha(p.read_bytes()))+');'for p in files)
 replace("assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_DEDUPE_EXECUTION_DISABLED');","assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_EDGE_EXECUTION_DISABLED');"+checks)
 marker='report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(') {\n      const bytes = await readFile',start)
 records=json.loads(source[start:end]);records.extend([[str(ROOT).replace('\\','/'),str(p.relative_to(ROOT)).replace('\\','/')]for p in files]);source=source[:start]+json.dumps(records)+source[end:]
 return source
if __name__=='__main__':
 relative='.local/presentation-lock-source-edge-proof-compiled/controller-'+str(uuid.uuid4())+'.mjs';source=compile_source(relative);p=ROOT/relative;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('x',encoding='utf8',newline='\n')as f:f.write(source)
 print(json.dumps({'controller':str(p),'sha256':sha(source.encode()),'compiled_only':True,'execution_dispatched':False}))
