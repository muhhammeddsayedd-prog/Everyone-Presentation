"""Daemon-only registry operations under new build claims; no new transport."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ocr_registry_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
old=a.frozen('worker-compatible-daemon-release/registry.py');need=a.need;normal=old.normal
REGISTRY_ENABLED=False
class Ports(old.Ports):
 def pins(self):
  result=super().pins()
  for name in('anchors.py','registry.py','test_registry.py'):p=HERE/name;result[str(p)]=old.old.sha(old.old.load(p))
  return dict(sorted(result.items()))
def operate(action,kind,ports):need(REGISTRY_ENABLED and kind=='daemon');return old.operate(action,kind,ports)
def main():
 need(REGISTRY_ENABLED and len(sys.argv)==3);b=a.builder().load_build();action,kind=sys.argv[1:];value=operate(action,kind,Ports(b));value.update(provider_called=action!='prepare',provider_mutations=action in('refresh','copy'),credentials_extracted=False,raw_credentials_persisted=False,exact_wire_attempt_count_claimed=False);ref=b.save('daemon-registry-'+action,value);print(json.dumps({'result':value.get('result','passed'),'receipt':ref}));need(value.get('result','passed')in('passed','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('OCR_CONFIG_REGISTRY_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
