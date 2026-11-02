"""Finite new-purpose projection; no SQL/Docker execution or old CLI replay."""
from pathlib import Path
import hashlib,importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
OLD=HERE.parent/'presentation-lock-source-proof'
OLD_COMPILER_SHA='0bed646aeb5f1af8a1c1bd686900335bdffb6b8c88e1be128bb1f9be2d0cfd25'
OLD_PROOF_SHA='087df11fa717f72043c9782c8da7380ae8cda559221a0495582d1dcd01d22448'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def need(ok):
 if not ok:raise ValueError('LOCKSOURCE41_SEED_PROJECTION_UNCONFIRMED')
def compile_source(relative):
 need(sha((OLD/'compiler.py').read_bytes())==OLD_COMPILER_SHA and sha((OLD/'proof.mjs').read_bytes())==OLD_PROOF_SHA)
 spec=importlib.util.spec_from_file_location('pinned_locksource41_compiler_library',OLD/'compiler.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
 source=old.compile_source(relative)
 def replace(a,b):
  nonlocal source
  need(source.count(a)==1);source=source.replace(a,b)
 replace(json.dumps((OLD/'proof.mjs').as_uri()),json.dumps((HERE/'entry.mjs').as_uri()))
 for a,b in[("'.local/presentation-lock-source-proof'","'.local/presentation-lock-source-seed-proof'"),("'tracking/evidence/m07/presentation-lock-source-proof'","'tracking/evidence/m07/presentation-lock-source-seed-proof'"),("'eps.locksource41.run'","'eps.locksource41seed.run'"),("'eps.locksource41.workspace'","'eps.locksource41seed.workspace'"),("'eps.locksource41.purpose'","'eps.locksource41seed.purpose'"),("'locksource41-performance-equality'","'locksource41-seed-qualified-performance-equality'"),("'eps-locksrc41-'","'eps-locksrc41seed-'"),("'presentation-lock-source41-owned-proof'","'presentation-lock-source41-seed-owned-proof'")]:replace(a,b)
 need(source.count('label=eps.locksource41.run=')==2);source=source.replace('label=eps.locksource41.run=','label=eps.locksource41seed.run=')
 files=[HERE/'compiler.py',HERE/'entry.mjs',HERE/'test_seed.py',HERE/'README.md']
 checks=''.join('\n  assert.equal(sha(await readFile('+json.dumps(str(p).replace('\\','/'))+')),'+json.dumps(sha(p.read_bytes()))+');'for p in files)
 replace("assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_EXECUTION_DISABLED');","assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_SEED_EXECUTION_DISABLED');"+checks)
 marker='report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(') {\n      const bytes = await readFile',start)
 records=json.loads(source[start:end]);records.extend([[str(ROOT).replace('\\','/'),str(p.relative_to(ROOT)).replace('\\','/')]for p in files]);source=source[:start]+json.dumps(records)+source[end:]
 return source
if __name__=='__main__':
 relative='.local/presentation-lock-source-seed-proof-compiled/controller-'+str(uuid.uuid4())+'.mjs';source=compile_source(relative);p=ROOT/relative;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('x',encoding='utf8',newline='\n')as f:f.write(source)
 print(json.dumps({'controller':str(p),'sha256':sha(source.encode()),'compiled_only':True,'execution_dispatched':False}))
