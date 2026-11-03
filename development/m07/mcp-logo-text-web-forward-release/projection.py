"""Finite MCP-text web purpose over the frozen G14 compiler. No operational port."""
from pathlib import Path
import copy,hashlib,importlib.util,re
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PREDECESSOR=MAIN/'development/m07/logo-recovery-web-forward-release'
APPROVED_PREDECESSOR={'gates.py':'ff0eb1c5a4b5b59d7f7aaa557f2964fd07484240ea9be606d7b35b6e9ce49994','inputs.template.json':'f2a208f8d1b4e4bcd32093974f99d413f69683037857edc529b5ea00e3549f68','preflight.py':'3722ab4632db3e513f738d8a0ad72f28e63e9589f9fd2eade1516412ad5954e8','projection.py':'cf1d1f3269f004182d7caf44fc4dcf63b93c635706410d47e76b889aae74db46','README.md':'2a17b1f80a69ac96e2f434731e0342515b9f228afa5ac277ac823af669a1512c','release.py':'7e363994879602e72d06dce2eba4c6a8d59cf15673f3839281890c62bc114fc7','scan-stage.mjs':'c9ab2c5ebbf9f677850e22d9480e5d86d8c4daf4eb690eea7497717ecd260af7','stage.py':'ded461e16605f8dba3c2e34d47186a5b510401af712c06e821501e3f2f86a1ee','test_release.py':'5a7e62091f2d16e6d6c610934d4683a43a4000ebb21a2e97cdee7985898a05d6'}
NAMESPACE='mcp-logo-text-web-forward-release'
TESTED='e259b81cd96e49e95004d9847384773f544c3d62'
QUALITY={'path':'tracking/evidence/m07/completion-release/2026-11-03T03-13-27.120Z-bb8a01ed-mcp-logo-root-quality.json','sha256':'3e5029c23cf3ccb95bd6e17bc9cbadea76deda3f176b8d5eb3fb5d12a720e9e5'}
BASELINE={'path':'tracking/evidence/m07/logo-recovery-web-forward-release/2026-11-03T02-23-02-487750Z-636b12ba-e950-427d-bd2b-51bd5e9b9759-readback.json','sha256':'4500410b4b0c9f730105d3790f546cc4cd1436fec4a40315d5bc80c4850c0c44'}
DELTA={'apps/web/lib/logo-error-log.ts','apps/web/lib/mcp-error-text.ts'}

def need(ok):
 if not ok:raise ValueError('MCP_LOGO_TEXT_WEB_SOURCE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def frozen():
 for name,digest in APPROVED_PREDECESSOR.items():
  file=PREDECESSOR/name;info=file.lstat();need(file.is_file()and not file.is_symlink()and file.resolve()==file and info.st_nlink==1 and 0<info.st_size<65536 and sha(file.read_bytes())==digest)
frozen()
_spec=importlib.util.spec_from_file_location('mcp_logo_text_frozen_projection',PREDECESSOR/'projection.py');previous=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(previous)
# Preserve the meaning of both pre-existing raw ancestor pin loops.
PINS=previous.PINS;FROZEN=previous.FROZEN;OLD=previous.OLD
NATIVE=previous.NATIVE;WORKER=copy.deepcopy(previous.WORKER)
worker_anchor=previous.worker_anchor;worker_projection=previous.worker_projection

def project(name):
 frozen();before=previous.project(name);source=before;edits=[]
 def edit(old,new,count=1):
  nonlocal source
  need(old!=new and source.count(old)==count and new not in source);source=source.replace(old,new);edits.append((old,new,count))
 def assignment(key,value):
  old=re.search('^'+key+r'=.*$',source,re.M);need(old is not None);literal='{'+','.join(repr(x)for x in sorted(value))+'}'if type(value)is set else repr(value);edit(old[0],key+'='+literal)
 for old,new in [('logo-recovery-web-forward-release',NAMESPACE),('LOGO_RECOVERY_WEB_FORWARD','MCP_LOGO_TEXT_WEB_FORWARD'),('logo_recovery_web_forward','mcp_logo_text_web_forward')]:
  if old in source:edit(old,new,source.count(old))
 if name=='gates.py':
  for key,value in [('BASELINE','dpl_G14dY1CobuaDg37rxPMoqZ6X3Uo9'),('BASE_COMMIT','7c8d32f52cb760974e251cd8ed5fcdd4277a39fe'),('BASE_MANIFEST','d4d8739099ccc7da746351dabb8b79ec38d96fe80568ae8768a13c42ddebb620'),('BASELINE_RECEIPT',BASELINE),('REASON_FILES',DELTA),('TESTED_COMMIT',TESTED),('QUALITY_RECEIPT',QUALITY)]:assignment(key,value)
  edit("test['tests']>=1019","test['tests']>=1023")
 if name=='release.py':
  marker='  return dict(sorted(pins.items()))'
  edit(marker,"  for name,expected in _projection.APPROVED_PREDECESSOR.items():\n   file='development/m07/logo-recovery-web-forward-release/'+name;g.need(g.sha(g.load(self.root/file))==expected);pins[file]=expected\n"+marker)
 inverse=source
 for old,new,count in reversed(edits):need(inverse.count(new)==count);inverse=inverse.replace(new,old)
 need(inverse==before);return source

def projected_tests():
 text=previous.projected_tests().replace('logo_recovery_web_tested','mcp_logo_text_web_tested').replace('logo_recovery_web_forward_canonical_preflight','mcp_logo_text_web_forward_canonical_preflight').replace('test_current_normal_9mi_baseline_is_required','test_current_normal_G14_baseline_is_required')
 text=text.replace("for change in [lambda v:v.update(id='dpl_4fro", "for change in [lambda v:v.update(id='dpl_9miSRSQgzwycmN6Ut5sRmeF3x5WF'),lambda v:v.update(id='dpl_4fro")
 return text.replace('1019','1023').replace('apps/web/components/LogoPanel.tsx','apps/web/lib/mcp-error-text.ts')
