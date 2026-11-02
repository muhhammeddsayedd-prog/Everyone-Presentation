"""Finite inverse of the frozen continuation: only Store loader and namespaces."""
from pathlib import Path
import hashlib
_ORIGINAL=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/worker-compatible-daemon-env-forward')
_OLD_PINS={'forward.py':'9781ecb2b555b55acde67f97b38064d90d165a46b60330f77348448253047012','controller.py':'c29505a93adb5de679c7d792c541af35abfa1dfa1070b6419f9473812133b1a1','test_forward.py':'8741fe70149b28ed5c84dcd172a396761718384a02c53e05d0ed1a83e49e40f6','README.md':'6b4bf51ea8bfcbe668a8754ba95fa3ecc75b040c36979d5e91cd4fb64a48caf5'}

def frozen_bytes(name):
 file=_ORIGINAL/name;assert file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1
 raw=file.read_bytes();assert hashlib.sha256(raw).hexdigest()==_OLD_PINS[name];return raw

def project_forward():
 original=frozen_bytes('forward.py').decode('utf8');changed=original
 edits=[('self.p.s.load(file)','FILE_LOAD(file)',2),("'.local/worker-compatible-daemon-env-forward'","'.local/worker-compatible-daemon-env-store-forward'",1),("'tracking/evidence/m07/worker-compatible-daemon-env-forward'","'tracking/evidence/m07/worker-compatible-daemon-env-store-forward'",1),("'unknown_env1_observed_unattempted_env2_forward'","'unknown_env1_observed_unattempted_env2_store_forward'",2)]
 for before,after,count in edits:
  assert changed.count(before)==count;changed=changed.replace(before,after)
 inverse=changed
 for before,after,count in reversed(edits):assert inverse.count(after)==count;inverse=inverse.replace(after,before)
 assert inverse==original;return changed

for _name in _OLD_PINS:frozen_bytes(_name)
# New module globals/HERE; the frozen original module is never imported/modified.
exec(compile(project_forward(),str(_ORIGINAL/'forward.py'),'exec'),globals())
_provider_module,_controller_module=libraries()
FILE_LOAD=_provider_module.s.load
_local_source_pins=source_pins

def source_pins():
 result=_local_source_pins()
 for name,digest in _OLD_PINS.items():frozen_bytes(name);result['frozen/'+name]=digest
 return result
