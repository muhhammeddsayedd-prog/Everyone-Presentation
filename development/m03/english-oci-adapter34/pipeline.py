"""Read-only bindings to actual OCI producer receipts, never a V2 success shim."""
from pathlib import Path
import hashlib, importlib.util, json, re

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
OCI_FILE=ROOT/'development/m03/english-oci34/oci.py'
PRIVATE=ROOT/'.local/m03-english-oci34'
RUN='4186fd1e-55c7-4ea5-956e-ad9ad92f64b1';SOURCE='b3489d64fb1bb207e0a1020fadac3db14490c94ba6d2aedf9c6a358ebb36f181'
CONTEXT=ROOT/'.local/worker-hosting'/RUN/'context'
PREFIX='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/'
TAG='english34-oci-4186fd1e'

def need(value):
 if not value:raise ValueError('ENGLISH34_OCI_PIPELINE_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def load(path,maximum=2*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_size<=maximum);return path.read_bytes()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def producer():return module('english34_actual_oci_producer',OCI_FILE)
def validate_image(kind,value):
 need(kind in('native','daemon')and type(value)is dict)
 need(value.get('result')=='passed'and value.get('kind')==kind and value.get('run')==RUN and value.get('source_sha256')==SOURCE and value.get('target')==PREFIX+kind+':'+TAG)
 need(all(type(value.get(key))is str and re.fullmatch('sha256:[a-f0-9]{64}',value[key])for key in ['index_digest','runtime_digest']))
 need(value.get('remote_digest_independent_readback_equal')is True)
 source=value.get('source');need(type(source)is dict and source.get('file_count')==160 and source.get('source_sha256')==SOURCE)
 if kind=='daemon':
  need(type(source.get('manifest_sha256'))is str and re.fullmatch('[a-f0-9]{64}',source['manifest_sha256']))
  gate=value.get('production_import_gate');need(type(gate)is dict and gate.get('user')=='1000:1000'and gate.get('network')=='none'and gate.get('completed')is True and gate.get('cached')is False and gate.get('build_exit_code')==0 and type(gate.get('step'))is str and re.fullmatch('#[0-9]{1,4}',gate['step']))
 else:need(source.get('manifest_sha256')is None and value.get('production_import_gate')is None)
 return value
def load_success(kind):
 # The producer's own pure loader enforces its export/recursive-closure/copy
 # process/remote-read claims. These extra checks bind the common pipeline DTO.
 actual=producer().load_success(kind);return validate_image(kind,actual)
def manifest(native,daemon):
 raw=load(CONTEXT/'apps/worker/native-sandbox-manifest.json',4096);value=json.loads(raw)
 need(value=={'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1','image':PREFIX.removeprefix('vcr.vercel.com/')+'native@'+native['runtime_digest'],'region':'dub1','source_sha256':SOURCE})
 digest=sha(raw);need(digest==daemon['source']['manifest_sha256']);return digest
def pointer(kind):
 need(kind in('native','daemon'));return PRIVATE/(kind+'-build.success.json')
def source_pins():
 files=[Path(__file__),HERE/'daemon-proof.py',HERE/'worker-v2.py',HERE/'test_pipeline.py',HERE/'README.md',OCI_FILE,OCI_FILE.parent/'export.py',OCI_FILE.parent/'transfer.py']
 return {p.relative_to(ROOT).as_posix():sha(load(p))for p in files}
