"""Fresh daemon-only claims using the exact reviewed normal registry functions."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('compatible_registry_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
old=a.library('registry.py');need=old.need;normal=old.normal
REGISTRY_ENABLED=True

class Ports(old.Ports):
 def pins(self):
  result=super().pins()
  for name in('anchors.py','registry.py','test_registry.py'):file=HERE/name;result[str(file)]=old.sha(old.load(file))
  return dict(sorted(result.items()))
 def exported(self,kind):need(kind=='daemon');return super().exported(kind)
 def target(self,kind):need(kind=='daemon');return super().target(kind)
 def copy(self,kind,value):need(kind=='daemon');return super().copy(kind,value)

def operate(action,kind,ports):
 need(REGISTRY_ENABLED and kind=='daemon');return old.operate(action,kind,ports)

def main():
 need(REGISTRY_ENABLED and len(sys.argv)==3)
 need(type(a.BUILD_WRAPPER_SHA)is str and old.sha(old.load(a.BUILD_WRAPPER))==a.BUILD_WRAPPER_SHA and old.sha(old.load(a.BUILD_ANCHORS))==a.BUILD_ANCHORS_SHA)
 libraries=old.b.m.Libraries();builder=a.module('compatible_daemon_registry_build',a.BUILD_WRAPPER);inputs=builder.load_profile(libraries);need(set(inputs)=={'run','source'});build=builder.Build(inputs,libraries=libraries)
 action,kind=sys.argv[1:];value=operate(action,kind,Ports(build));value.update(provider_called=action!='prepare',provider_mutations=action in('refresh','copy'),credentials_extracted=False,raw_credentials_persisted=False,exact_wire_attempt_count_claimed=False)
 ref=build.save('daemon-registry-'+action,value);print(json.dumps({'result':value.get('result','passed'),'receipt':ref}));need(value.get('result','passed')in('passed','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('COMPATIBLE_DAEMON_REGISTRY_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
