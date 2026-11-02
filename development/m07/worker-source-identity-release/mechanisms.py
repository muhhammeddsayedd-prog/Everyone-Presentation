"""Exact existing normal CLI/OCI/security functions, without old entry guards."""
from pathlib import Path
import hashlib,importlib.util,json,os
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
FROZEN={
 'development/m03/english-oci34/oci.py':'48fa22d83cb6f8643696a84358b5ba831852f93e6b920f7ef7f7a6808ae60758',
 'development/m03/english-image34/build-image-v2.py':'5562cf2d1e7d4b23f2b86e45ef75bc2f02a1744b80a5ba580814c751b53948a2',
 'development/m03/english-image34/build-image.py':'f1ced25d33bf039909289bc1be17ab42bbdf5d662e15c22c6460693a16045cd4',
 'development/m03/english-image34/refresh-vcr.py':'3104f3405c2fdd0ffd2e402098522ba2ba7d6720aaed13aedfb2923c33c73224',
 'development/m03/english-release34/native_admission.py':'cfaf0eafb51ee99961a7f3552c34090f377475be4a7a1d23d9c5582e050cb9cf',
 'development/m07/completion-worker/registry.py':'809561e1585f164bba92363a9fb854fc55d1efc4f1d6343acc461c3ae3fbd50c',
 'development/m07/specs-diagnostic-worker38/registry.py':'5d7a4090e307d7c4eafa45e4effac090b9c516f824a93da6cc5d8d1d6c467b11',
 'development/m03/english-oci34/export.py':'ed386e1e0fa8fa5f31b1af089e36f43b4cd1f9d95fb65b3a739e60335b763f53',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_logo.py':'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4',
}
EMITTER='tools/worker-hosting-build.mjs';EMITTER_SHA='a9a628e004fc8a6a636486a67878e8f84fda335a32c13c7fcb68d60c33124c3c'
def need(value):
 if not value:raise ValueError('WORKER_IDENTITY_MECHANISM_REFUSED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(file,maximum=16*1024**2):
 need(file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1 and 0<file.stat().st_size<=maximum);return file.read_bytes()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

class Libraries:
 def __init__(self):
  # Do NOT call old registry.run/sources or diagnostic mechanisms(): their
  # historical whole-emitter pin remains legitimately incompatible with a124.
  for relative,digest in FROZEN.items():need(sha(load(MAIN/relative))==digest)
  need(sha(load(MAIN/EMITTER))==EMITTER_SHA)
  self.oci=module('worker_identity_original_oci_functions',MAIN/'development/m03/english-oci34/oci.py')
  self.registry=module('worker_identity_original_cli_functions',MAIN/'development/m07/completion-worker/registry.py')
 def environment(self):
  value=self.registry.environment()
  # CLI API/deploy use the same normal saved CLI auth. No old registry/cache
  # path, provider key or token is injected into these child processes.
  for key in('DOCKER_CONFIG','REGCTL_CONFIG'):value.pop(key,None)
  return value
 def cli(self,args):return self.registry.cli(args)
 def run(self,args,timeout=45):
  result=self.oci.bounded(args,self.environment(),timeout,'worker_identity_normal_cli');return self.registry.checked_response(result)
 def guard(self):return self.registry.helpers().private_security()
 def pins(self):
  for relative,digest in FROZEN.items():need(sha(load(MAIN/relative))==digest)
  need(sha(load(MAIN/EMITTER))==EMITTER_SHA)
  result={str(MAIN/path):digest for path,digest in FROZEN.items()};result[str(MAIN/EMITTER)]=EMITTER_SHA
  for name,digest in self.registry.helpers().transport().oci.base.refresh.PINS.items():
   file=self.registry.CLI.parent/name;need(sha(load(file))==digest);result[str(file)]=digest
  need(json.loads(load(self.registry.CLI.parent.parent/'package.json'))['version']=='65.8.0')
  file=self.registry.NODE;expected='9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de';need(sha(load(file,128*1024**2))==expected);result[str(file)]=expected
  return result
