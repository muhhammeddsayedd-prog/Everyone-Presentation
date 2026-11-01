"""Distinct continuation after proven CLI plugin discovery failure.

The completed first controller and its claims/receipts remain unchanged. The
only environment correction is the ordinary Windows ProgramFiles path required
by Docker CLI to discover its already installed, checksum-pinned Buildx plugin.
"""
from pathlib import Path
import hashlib, importlib.util, json, subprocess, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
FROZEN=HERE/'build-image.py';FROZEN_SHA='f1ced25d33bf039909289bc1be17ab42bbdf5d662e15c22c6460693a16045cd4'
FAILED=ROOT/'tracking/evidence/m03/english-image34/2026-10-31T16-52-05-543196Z-native-build-push.json'
FAILED_SHA='216f19304ba6edf19b78ef22585ebb3dde7378969fba6ee8113db0245802d3a0'
PLUGIN=Path('C:/Program Files/Docker/Docker/resources/cli-plugins/docker-buildx.exe')
PLUGIN_SHA='f2512b849418b860d1e497708ccdd4864e2377a97fe15d500af83381cf5f967e'
def need(value):
 if not value:raise ValueError('ENGLISH34_IMAGE_CONTINUATION_UNCONFIRMED')
sha=lambda value:hashlib.sha256(value).hexdigest()
need(sha(FROZEN.read_bytes())==FROZEN_SHA)
spec=importlib.util.spec_from_file_location('english34_frozen_image_operator',FROZEN);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
original_environment=base.environment;original_sources=base.source_pins
base.PRIVATE=ROOT/'.local/m03-english-image34-continuation'
base.TAG='english34-auth2-4186fd1e'

def environment():
 value=original_environment();value['ProgramFiles']='C:/Program Files';return value
base.environment=environment

def sources():
 need(sha(FAILED.read_bytes())==FAILED_SHA);failed=json.loads(FAILED.read_text(encoding='utf8'))
 need(failed['result']=='unconfirmed'and failed['exit_code']==125 and failed['elapsed_seconds']<1 and failed['stdout_bytes']==0 and failed['stderr_bytes']==109 and failed['progress']['completed_steps']==0 and failed['source_pins']['build_operator_sha256']==FROZEN_SHA)
 need(PLUGIN.is_file()and not PLUGIN.is_symlink()and PLUGIN.resolve()==PLUGIN and sha(PLUGIN.read_bytes())==PLUGIN_SHA)
 pins=original_sources()
 # Read-only validation catches plugin-discovery failure before any claim/build.
 result=subprocess.run([str(base.refresh.DOCKER),'--host',base.HOST,'buildx','version'],cwd=ROOT,env=environment(),stdin=subprocess.DEVNULL,capture_output=True,timeout=15)
 need(result.returncode==0 and result.stderr==b''and len(result.stdout)<=4096 and result.stdout.decode('utf8').strip()=='github.com/docker/buildx v0.35.0-desktop.2 b554ce1decd8b509893b1e7c6227eabfb923d094')
 return {**pins,'continuation_operator_sha256':sha(Path(__file__).read_bytes()),'frozen_failed_build_receipt_sha256':FAILED_SHA,'buildx_plugin_sha256':PLUGIN_SHA,'program_files_explicitly_forwarded':True}
base.source_pins=sources

if __name__=='__main__':
 try:base.main()
 except Exception:print('ENGLISH34_IMAGE_CONTINUATION_UNCONFIRMED',flush=True);sys.exit(1)
