"""New disabled purpose compiled from pinned libraries; no SQL/Docker runner."""
from pathlib import Path
import hashlib,importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
OLD=HERE.parent/'presentation-lock-source-seed-proof'
OLD_COMPILER_SHA='9467330333be87a1b4e2718ad62da4538e35068f6507ca38e9ac15a8a00d65d9'
OLD_ENTRY_SHA='a6697aa4dde6995220ea81b64015043b1b08915c3673c8028d97fe4af6efc819'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def need(ok):
 if not ok:raise ValueError('LOCKSOURCE41_DEDUPE_PROJECTION_UNCONFIRMED')
def compile_source(relative):
 need(sha((OLD/'compiler.py').read_bytes())==OLD_COMPILER_SHA and sha((OLD/'entry.mjs').read_bytes())==OLD_ENTRY_SHA)
 spec=importlib.util.spec_from_file_location('pinned_seed_compiler_library',OLD/'compiler.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
 source=old.compile_source(relative)
 def replace(a,b):
  nonlocal source
  need(source.count(a)==1);source=source.replace(a,b)
 replace(json.dumps((OLD/'entry.mjs').as_uri()),json.dumps((HERE/'entry.mjs').as_uri()))
 for a,b in[("'.local/presentation-lock-source-seed-proof'","'.local/presentation-lock-source-dedupe-proof'"),("'tracking/evidence/m07/presentation-lock-source-seed-proof'","'tracking/evidence/m07/presentation-lock-source-dedupe-proof'"),("'eps.locksource41seed.run'","'eps.locksource41dedupe.run'"),("'eps.locksource41seed.workspace'","'eps.locksource41dedupe.workspace'"),("'eps.locksource41seed.purpose'","'eps.locksource41dedupe.purpose'"),("'locksource41-seed-qualified-performance-equality'","'locksource41-dedupe-qualified-performance-equality'"),("'eps-locksrc41seed-'","'eps-locksrc41dedupe-'"),("'presentation-lock-source41-seed-owned-proof'","'presentation-lock-source41-dedupe-owned-proof'")]:replace(a,b)
 need(source.count('label=eps.locksource41seed.run=')==2);source=source.replace('label=eps.locksource41seed.run=','label=eps.locksource41dedupe.run=')
 files=[HERE/'compiler.py',HERE/'entry.mjs',HERE/'test_dedupe.py',HERE/'README.md']
 checks=''.join('\n  assert.equal(sha(await readFile('+json.dumps(str(p).replace('\\','/'))+')),'+json.dumps(sha(p.read_bytes()))+');'for p in files)
 replace("assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_SEED_EXECUTION_DISABLED');","assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_DEDUPE_EXECUTION_DISABLED');"+checks)
 marker='report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(') {\n      const bytes = await readFile',start)
 records=json.loads(source[start:end]);records.extend([[str(ROOT).replace('\\','/'),str(p.relative_to(ROOT)).replace('\\','/')]for p in files]);source=source[:start]+json.dumps(records)+source[end:]
 return source
if __name__=='__main__':
 relative='.local/presentation-lock-source-dedupe-proof-compiled/controller-'+str(uuid.uuid4())+'.mjs';source=compile_source(relative);p=ROOT/relative;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('x',encoding='utf8',newline='\n')as f:f.write(source)
 print(json.dumps({'controller':str(p),'sha256':sha(source.encode()),'compiled_only':True,'execution_dispatched':False}))
