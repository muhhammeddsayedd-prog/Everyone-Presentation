"""Fresh daemon-only claims over immutable reviewed build mechanics."""
from pathlib import Path
import datetime,importlib.util,json,re,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ocr_build_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
old=a.library();need=a.need;MAIN=a.MAIN
BUILD_ENABLED=True

class Build(old.Build):
 def __init__(self,inputs,libraries=None):
  super().__init__(inputs,libraries);need(inputs['run']not in('cd917d16-2d3d-4915-9d65-364d1edf4fe9','bbf4b5da-8723-4fc4-930e-be3aba8d6fa3'));self.private=MAIN/a.PRIVATE/inputs['run']
 def pins(self):
  result=super().pins()
  for p in sorted(HERE.iterdir()):
   if p.is_file():result[str(p)]=old.sha(old.base.load(p))
  return dict(sorted(result.items()))
 def source_admission(self):
  profile=load_profile(self.l);need(profile=={'run':self.inputs['run'],'source':self.source})
  # Skip only the predecessor's consumed profile lookup; its generic immutable
  # archive/current-file/quality gate remains the exact inherited function.
  return old.base.Build.source_admission(self)
 def stage(self):need(BUILD_ENABLED);return super().stage()
 def reuse_native(self):need(BUILD_ENABLED);return super().reuse_native()
 def export(self,kind):need(BUILD_ENABLED and kind=='daemon');return super().export(kind)
 def prepare_oci(self,kind):need(BUILD_ENABLED and kind=='daemon');return super().prepare_oci(kind)
 def export_readback(self,kind):need(BUILD_ENABLED and kind=='daemon');return super().export_readback(kind)
 def emit(self):need(BUILD_ENABLED);return super().emit()
 def save(self,action,value):
  return save(self,action,value)

def save(build,action,value):
 folder=MAIN/a.EVIDENCE;folder.mkdir(parents=True,exist_ok=True);need(folder.resolve()==folder and not folder.is_symlink())
 file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 raw=old.base.compact({'schema_version':'1.0','observed_at':old.base.stamp(),'run':build.inputs['run'],'build_run':build.build_run,'action':action,'source_sha256':build.source['source_sha256'],'daemon_source_sha256':build.source['source_sha256'],'native_source_sha256':old.a.SOURCE,'native_rebuilt':False,'provider_called':False,'worker_deployed':False,**value})+b'\n'
 with file.open('xb')as stream:stream.write(raw);stream.flush();old.os.fsync(stream.fileno())
 return {'path':file.relative_to(MAIN).as_posix(),'sha256':old.sha(old.base.load(file))}
def load_profile(libraries=None):
 ref=a.PROFILE;need(type(ref)is dict and set(ref)=={'path','sha256'}and ref['path']==a.PROFILE_PATH and re.fullmatch('[a-f0-9]{64}',ref['sha256']))
 libraries=libraries or old.base.m.Libraries();p=MAIN/ref['path'];libraries.guard().verify(p);raw=old.base.load(p);need(old.sha(raw)==ref['sha256']);value=json.loads(raw)
 need(type(value)is dict and set(value)=={'run','source'});old.base.source_shape(value['source']);return value
def load_build(libraries=None):
 need(a.PROFILE is not None);libraries=libraries or old.base.m.Libraries();return Build(load_profile(libraries),libraries)
def main():
 need(BUILD_ENABLED and len(sys.argv)==2);b=load_build();action=sys.argv[1]
 if action=='stage':value=b.stage()
 elif action=='reuse-native':value=b.reuse_native()
 elif action=='daemon-export':value=b.export('daemon')
 elif action=='daemon-oci':value=b.prepare_oci('daemon')
 elif action=='daemon-export-readback':value=b.export_readback('daemon')
 else:need(action=='emit');value=b.emit()
 print(json.dumps({'result':'passed','action':action,'output':value}))
if __name__=='__main__':
 try:main()
 except Exception:print('OCR_DAEMON_BUILD_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
