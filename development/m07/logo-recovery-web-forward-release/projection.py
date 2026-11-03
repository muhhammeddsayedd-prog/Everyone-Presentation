"""Finite fresh web purpose over frozen source; no historical main/port runs."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PREDECESSOR=MAIN/'development/m07/production-web-forward-release'
FROZEN={'gates.py':'80cd56555fee0763c19754d6941dd3eba172d242ff3820904ee244b5dc54b122','inputs.template.json':'8bdfdfde17ceb737d892f9e04e00a4f4e854239b4fba229649e5b9745f644a2f','preflight.py':'c751adbf30ad9a6b687d77a4b4815554a23b12ac86e68a03df59298fd6378697','projection.py':'ad2d740ac6680e018c367a92b40e28b1568b751cf137ebe1f8df40ff9e152998','README.md':'aef1cc392be105a49f94e3a2fedf72817a5eb4ec39aa1c273217364b5fd0d8ce','release.py':'4249f2a9235bdbb5b19f195a5d265041f78696c64abcb85a9f76cb496831b592','scan-stage.mjs':'ecac2908d9eafbf5fc4582af333716343486050ba09483efd6a19cf8a536117c','stage.py':'07518f62dae95af0a722e5d28aa8f59c1cd5567ff87e9ce403967a46cf7666b6','test_release.py':'ad591aed1dd1e9ea65e9da701deaad4d42e06cd5131413b7c702727cc7bf1e62'}
NAMESPACE='logo-recovery-web-forward-release'
TESTED='7c8d32f52cb760974e251cd8ed5fcdd4277a39fe'
QUALITY={'path':'tracking/evidence/m07/completion-release/2026-11-03T01-47-46.934Z-82a90895-logo-recovery-root-quality.json','sha256':'c34f998b8898e725d5dc52834f6c2649292990111631061d0a70659ad2816c0f'}
BASELINE={'path':'tracking/evidence/m07/production-web-forward-release/2026-11-02T22-08-54-577976Z-7470f23c-b475-4b2e-9082-17d4ff344118-readback.json','sha256':'5b19f7029e83f9dfeb1ae1a2a9de4cc9c73923d383c094ab2d8485eabe6372a0'}
DELTA={'apps/web/components/LogoPanel.tsx','apps/web/components/WorkspaceView.tsx','apps/web/components/logo-upload-recovery.ts'}
NATIVE='sha256:3d4286db01b27b40ec9078e303158e93003a096d5ddad1c9802130238de6dd80'
WORKER_READY={'path':'tracking/evidence/m07/worker-ocr-config-daemon-release/2026-11-03T01-28-32-697043Z-ready.json','sha256':'83c725dae77d70ded39e7ba78c1d9d4901de8f3d35325aba97b4a66705e1b058'}
WORKER_RESUME={'path':'tracking/evidence/m07/worker-ocr-config-daemon-release/2026-11-03T01-38-19-111153Z-resume.json','sha256':'57551d733091eb59672f978545d9595b9c52ebad13d058c90a157fa245695b79'}
WORKER={'deployment_id':'dpl_FxdXyuy6oqtmwVRZW7twb4Xawtkc','project_id':'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6','team_id':'team_gboXPxTevpCOZuaA8eY9PmR1','state':'READY','target':'production','daemon_digest':'sha256:ffb4ce64dbb5a9a1854e96e32063539c72025023fee504c189b8f775e029cd98','daemon_source_sha256':'f8142f08baa37efcc160aea96c32b389dfd0a0ee5569f267642fc9ff396907b4','native_digest':NATIVE,'native_source_sha256':'f742e9e5e4b83643f5bae18cace3e9e253912c0114f59b4489f0d163bcb39368','native_graph_sha256':'247992bbe3331251f33186cfac22835e8734833cd229bb6a4d8bcafa3bc0c214','daemon_graph_sha256':'109b298cf3c42a7f8c6e5aaf30aefe49e493595726daf3c71b97b26cb81543b1','native_manifest_sha256':'fa221d833f0417d303c55ecc43629b2edf68ccdcc020d90e7f1864341e02fa57','native_compatibility_sha256':'7c3b2632ae2512a313b48fed5f02e4cba3a9180716160c17da2426a69cc90dfc','fresh_application_heartbeat_claimed':False}

def need(ok):
 if not ok:raise ValueError('LOGO_RECOVERY_WEB_SOURCE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def frozen():
 for name,digest in FROZEN.items():
  file=PREDECESSOR/name;info=file.lstat();need(file.is_file()and not file.is_symlink()and file.resolve()==file and info.st_nlink==1 and 0<info.st_size<65536 and sha(file.read_bytes())==digest)
frozen()
_spec=importlib.util.spec_from_file_location('logo_recovery_frozen_projection',PREDECESSOR/'projection.py');previous=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(previous)
# The already projected release retains its original eight-ancestor pin loop.
PINS=previous.PINS;OLD=previous.OLD

def worker_anchor():
 g={'__file__':str(PREDECESSOR/'gates.py'),'__name__':'inert_worker_anchor'}
 exec(compile(previous.project('gates.py'),'inert-approved-receipt-reader','exec'),g)
 ready=g['reference'](MAIN,WORKER_READY);resume=g['reference'](MAIN,WORKER_RESUME)
 need(ready['result']=='passed'and ready['deployment_id']==WORKER['deployment_id']and ready['startup']['complete_window']is True and ready['startup']['scope']['deployment']==WORKER['deployment_id'])
 need(resume['result']=='passed'and resume['normal_return_observed']is True and resume['two_equal_readbacks']is True and resume['native_pin_mutation_performed']is False and resume['bindings']==ready['bindings'])
 need(resume['bindings']=={**{k:WORKER[k]for k in('daemon_source_sha256','native_source_sha256','native_graph_sha256','daemon_graph_sha256','native_manifest_sha256','native_compatibility_sha256','native_digest','daemon_digest')},'environment':{'EPS_NATIVE_MANIFEST_SHA256':WORKER['native_manifest_sha256'],'EPS_DAEMON_SOURCE_SHA256':WORKER['daemon_source_sha256'],'EPS_NATIVE_COMPATIBILITY_SHA256':WORKER['native_compatibility_sha256']}})
 return {'ready':WORKER_READY,'resume':WORKER_RESUME,'historical_startup_only':True,'fresh_application_heartbeat_claimed':False}

def worker_projection(value):
 need(type(value)is dict and value.get('id')==WORKER['deployment_id']and value.get('project',{}).get('id')==WORKER['project_id']and value.get('team',{}).get('id')==WORKER['team_id']and value.get('name')=='everyone-presentation-worker-pilot'and value.get('target')=='production'and value.get('readyState')=='READY')
 meta=value.get('meta');need(type(meta)is dict)
 mapping={'epsWorkerIdentityDaemonSource':'daemon_source_sha256','epsWorkerIdentityNativeSource':'native_source_sha256','epsWorkerIdentityNativeGraph':'native_graph_sha256','epsWorkerIdentityDaemonGraph':'daemon_graph_sha256','epsWorkerIdentityManifest':'native_manifest_sha256','epsWorkerIdentityCompatibility':'native_compatibility_sha256','epsWorkerIdentityNative':'native_digest','epsWorkerIdentityDaemon':'daemon_digest'}
 need(all(meta.get(key)==WORKER[field]for key,field in mapping.items())and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',meta.get('epsWorkerIdentityRun',''))is not None)
 return copy.deepcopy(WORKER)

def project(name):
 frozen();before=previous.project(name);source=before;edits=[]
 def edit(old,new,count=1):
  nonlocal source
  need(old!=new and source.count(old)==count and new not in source);source=source.replace(old,new);edits.append((old,new,count))
 def assignment(key,value):
  old=re.search('^'+key+r'=.*$',source,re.M);need(old is not None);literal='{'+','.join(repr(x)for x in sorted(value))+'}'if type(value)is set else repr(value);edit(old[0],key+'='+literal)
 for old,new in [('production-web-forward-release',NAMESPACE),('PRODUCTION_WEB_FORWARD','LOGO_RECOVERY_WEB_FORWARD'),('production_web_forward','logo_recovery_web_forward')]:
  if old in source:edit(old,new,source.count(old))
 if name=='gates.py':
  for key,value in [('BASELINE','dpl_9miSRSQgzwycmN6Ut5sRmeF3x5WF'),('BASE_COMMIT','3ff3cb229826a939df2be26030f522347681bda9'),('BASE_MANIFEST','67f1ef685d9b2671ed76797d493a46a67f7d001d453954b702e74b1bf9c33b93'),('BASELINE_RECEIPT',BASELINE),('REASON_FILES',DELTA),('TESTED_COMMIT',TESTED),('QUALITY_RECEIPT',QUALITY),('NATIVE',NATIVE)]:assignment(key,value)
  edit("test['tests']>=1011","test['tests']>=1019")
  edit("set(current)=={'history','gates','native_image_id','english_transcript_version','lifecycle'}", "set(current)=={'history','gates','native_image_id','english_transcript_version','lifecycle','worker'}")
  edit(" current=value['first'];need("," _projection.worker_anchor()\n current=value['first'];need(current.get('worker')==_projection.WORKER);need(")
 if name=='release.py':
  marker='  return dict(sorted(pins.items()))'
  edit(marker,"  for name,expected in _projection.FROZEN.items():\n   file='development/m07/production-web-forward-release/'+name;g.need(g.sha(g.load(self.root/file))==expected);pins[file]=expected\n"+marker)
 if name=='preflight.py':
  assignment('NATIVE',NATIVE)
  edit(' observations=[]'," _projection.worker_anchor()\n observations=[]")
  edit('  observations.append(value)',"  value={**value,'worker':_projection.worker_projection(operator.api('/v13/deployments/'+_projection.WORKER['deployment_id']+'?teamId='+_projection.WORKER['team_id']))}\n  observations.append(value)")
 inverse=source
 for old,new,count in reversed(edits):need(inverse.count(new)==count);inverse=inverse.replace(new,old)
 need(inverse==before);return source

def projected_tests():
 text=previous.projected_tests().replace('forward_web_tested','logo_recovery_web_tested').replace('production_web_forward_canonical_preflight','logo_recovery_web_forward_canonical_preflight').replace('test_current_normal_4fro_baseline_is_required','test_current_normal_9mi_baseline_is_required')
 text=text.replace("for change in [lambda v:v.update(id='dpl_5A9", "for change in [lambda v:v.update(id='dpl_4fro7gR9EUhEQCzG4vavXevHgWVo'),lambda v:v.update(id='dpl_5A9")
 text=text.replace("'native_image_id':g.NATIVE,", "'worker':copy.deepcopy(p.WORKER),'native_image_id':g.NATIVE,")
 text=text.replace('1011','1019').replace('apps/web/components/api.ts','apps/web/components/LogoPanel.tsx')
 return text
