"""Fixed protected-input read for the one fresh metadata observer; no network/config IO."""
from pathlib import Path
import hashlib,importlib.util,json,sys
ROOT=Path(__file__).resolve().parents[3]
HELPER=ROOT/'tools/provision_logo_verifier.py'
SECURITY_PINS={
 'provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'release_logo.py':'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4'}
try:
 if len(sys.argv)!=1:raise ValueError()
 for name,digest in SECURITY_PINS.items():
  file=ROOT/'tools'/name
  if file.is_symlink()or file.resolve()!=file or hashlib.sha256(file.read_bytes()).hexdigest()!=digest:raise ValueError()
 original_path=list(sys.path)
 try:
  sys.path.insert(0,str(ROOT/'tools'))
  spec=importlib.util.spec_from_file_location('fresh_plan_acl',HELPER);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  for name in ['release_foundation','release_logo']:
   if Path(sys.modules[name].__file__).resolve()!=ROOT/'tools'/(name+'.py'):raise ValueError()
 finally:sys.path[:]=original_path
 security=m.WindowsPrivateFiles();file=ROOT/'.local/m03-english-component/at074-new-english-job-input.json'
 security.verify(file)
 with file.open('rb')as stream:
  security.verify_open(stream);raw=stream.read(8193);security.verify_open(stream)
 value=m.strict_json(raw,8192)
 # The parent consumes this bounded metadata-only value in RAM; never tool-log it.
 print(json.dumps(value,separators=(',',':')))
except Exception:
 print('FRESH_PRIVATE_INPUT_UNCONFIRMED');sys.exit(1)
