"""Finite, pinned inert-source reuse; no historical entrypoint or I/O port runs."""
from pathlib import Path
import hashlib,json,re
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=MAIN/'development/m07/logo-failure-trace-web-release'
NAMESPACE='production-web-forward-release'
TESTED='3ff3cb229826a939df2be26030f522347681bda9'
QUALITY={'path':'tracking/evidence/m07/completion-release/2026-11-02T21-13-18.744Z-a7dc8241-streaming-root-quality.json','sha256':'62bc4f3dcba081525564e98ec4936c1b59269a3ad467c403f430fbab5269e4c1'}
BASELINE={'path':'tracking/evidence/m07/logo-failure-trace-web-release/2026-11-02T17-58-22-617365Z-a8890fe6-9fb0-4f92-8a2f-5d5a85abda11-readback.json','sha256':'169fb656525337465cbc1e203e6090febada1d36ee4ce3d0ddddd151d1d2f892'}
DELTA={'apps/web/components/api.ts','packages/integrations/src/index.ts','packages/integrations/src/openai-specs.ts','packages/integrations/src/specs-stream.ts'}
PINS={
 'gates.py':'19473e581c718cbfc81e7707e61887155a9e1568511b92e5ff23dc9633824810',
 'release.py':'5dd1d61d12c48c81a454394123ac6108d0fe2cf9e3441079c1e1817411ffcac3',
 'stage.py':'736c7c95d8e9f9fb508aa079eeba60ed0932a59420ebf98f81792afb2342adc8',
 'preflight.py':'c2999f1a11714a9dff6030569a51cf68c74a18bf5bfe896147f56dd40659f828',
 'scan-stage.mjs':'35602b3a6d6a3c237adff015ec067e2a1cdf3af9a64bc3a39d90c4bac9cb8e3a',
 'inputs.template.json':'95810c0992a0bc89b52eb56200843c066d9af6c6300caf92f37f992e6e67a02e',
 'test_release.py':'17d6267fceab064251e24c13e3c070af8219fb359681054f70cc1ce53181eec1',
 'README.md':'483ae6145190b460901934b2cf05aa6c1ae2fb298cc0fe231f01466299a1ecf5',
}
def need(ok):
 if not ok:raise ValueError('FORWARD_WEB_SOURCE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def original(name):
 need(name in PINS);file=OLD/name;info=file.lstat();need(file.is_file()and not file.is_symlink()and file.resolve()==file and info.st_nlink==1 and 0<info.st_size<65536)
 raw=file.read_bytes();need(sha(raw)==PINS[name]);return raw.decode('utf8')
def project(name):
 before=original(name);source=before;edits=[]
 def edit(old,new,count=1):
  nonlocal source
  need(old!=new and source.count(old)==count and new not in source);source=source.replace(old,new);edits.append((old,new,count))
 for old,new in [('logo-failure-trace-web-release',NAMESPACE),('LOGO_FAILURE_TRACE','PRODUCTION_WEB_FORWARD'),('logo_failure_trace','production_web_forward')]:
  if old in source:edit(old,new,source.count(old))
 if 'production_web_forward_web_canonical_preflight'in source:edit('production_web_forward_web_canonical_preflight','production_web_forward_canonical_preflight')
 if name=='gates.py':
  def assignment(key,value):
   old=re.search('^'+key+r'=.*$',source,re.M);need(old is not None);literal='{'+','.join(repr(x)for x in sorted(value))+'}'if type(value)is set else repr(value);edit(old[0],key+'='+literal)
  assignment('BASELINE','dpl_4fro7gR9EUhEQCzG4vavXevHgWVo');assignment('BASE_COMMIT','a5670eb063b799c15790496ad20bad38a16b2dcb');assignment('BASE_MANIFEST','92e1bb61ad60d2e8c0f78c1c521eee3f8d7a32da0a19e0e55915af5f816772c7');assignment('BASELINE_RECEIPT',BASELINE);assignment('REASON_FILES',DELTA)
  edit("need(key in('schema40','schema41')and", "need(key=='schema40'and")
  edit("value=reference(root,ref);commit=source['source_commit'];tree=git", "value=reference(root,ref);commit=source['source_commit'];need(commit==TESTED_COMMIT and ref==QUALITY_RECEIPT);tree=git")
  edit("test['tests']>=968", "test['tests']>=1011")
  edit(" required|=changed&{x['path']for x in source['files']}", " need(changed&{x['path']for x in source['files']}==REASON_FILES)\n required|=changed&{x['path']for x in source['files']}")
  # These are new-module constants; all inherited admission code stays intact.
  edit("COMMANDS=",'TESTED_COMMIT='+repr(TESTED)+'\nQUALITY_RECEIPT='+repr(QUALITY)+'\nCOMMANDS=')
 if name=='release.py':
  edit('RELEASE_ENABLED=True','RELEASE_ENABLED=__forward_enabled__')
  edit("'test_release.py','README.md')", "'test_release.py','README.md','projection.py')")
  edit("  return dict(sorted(pins.items()))", "  for name,expected in _projection.PINS.items():\n   file='development/m07/logo-failure-trace-web-release/'+name;g.need(g.sha(g.load(self.root/file))==expected);pins[file]=expected\n  return dict(sorted(pins.items()))")
  edit("'--prod','--yes','--no-wait','--project'", "'--prod','--archive=tgz','--yes','--no-wait','--project'")
 if name=='stage.py':edit("g.need(re.fullmatch('[a-f0-9]{40}',commit));operator=", "g.need(re.fullmatch('[a-f0-9]{40}',commit)and commit==g.TESTED_COMMIT);operator=")
 if name=='preflight.py':edit("canonical['key'] in ('schema40','schema41')", "canonical['key']=='schema40'")
 inverse=source
 for old,new,count in reversed(edits):need(inverse.count(new)==count);inverse=inverse.replace(new,old)
 need(inverse==before)
 return source

def projected_tests():
 """Reuse the prior fake-port suite, adapting only fixed new admission fixtures."""
 text=original('test_release.py').replace('logo_failure_trace_web_tested','forward_web_tested').replace('logo_failure_trace_web_canonical_preflight','production_web_forward_canonical_preflight').replace('test_new_normal_5A9_baseline_is_required','test_current_normal_4fro_baseline_is_required')
 text=text.replace("for change in [lambda v:v.update(id='dpl_B5L2", "for change in [lambda v:v.update(id='dpl_5A9eKKEC1eWhaNzor48y7eK5C9TS'),lambda v:v.update(id='dpl_B5L2")
 text=text.replace("actual=g.reference(HERE.parents[2],approved['ref'])", "actual=g.reference(r.ROOT,approved['ref'])")
 text=text.replace('for count in(40,41):','for count in(40,):')
 text=text.replace("text=(HERE/'preflight.py').read_text()", "text=r._projection.project('preflight.py')")
 start=text.index(' def test_fresh_quality_binds_');end=text.index(' def test_preflight_requires_',start)
 block=text[start:end].replace("g.REASON_FILES|{'packages/central/src/presentation.ts'}",'g.REASON_FILES').replace("'a'*40",'g.TESTED_COMMIT').replace('973','1011').replace('packages/domain/src/review-link-action.ts','apps/web/components/api.ts')
 block=re.sub(r"g\.quality\(Path\('synthetic'\),(.*),\{\}\)",lambda m:"g.quality(Path('synthetic'),"+m[1]+',g.QUALITY_RECEIPT)',block)
 return (text[:start]+block+text[end:]).replace("if __name__=='__main__':unittest.main()",'')
