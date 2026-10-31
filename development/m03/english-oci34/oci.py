"""Fresh root-executed OCI export and standalone registry transport.

The previous build/push attempts remain immutable. Sixteen-MiB settings preserve
the historically working regctl configuration; they are not a claimed TLS fix.
Imports are offline and do not export, upload, read credentials or contact cloud.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, subprocess, sys, tarfile, threading, time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
build=module('english_oci34_frozen_build',ROOT/'development/m03/english-image34/build-image-v2.py');base=build.base
native=module('english_oci34_frozen_native',ROOT/'development/m03/english-release34/native_admission.py')
RUN=base.RUN;SOURCE=base.SOURCE;PRIVATE=ROOT/'.local/m03-english-oci34';TAG='english34-oci-4186fd1e';PREFIX=base.PREFIX
REGCTL=ROOT/'.local/m07-pilot/tooling/regctl-v0.11.7.exe';REGCTL_SHA='70f195ff4923082340738c796880864f66a296e6c5d3296bf743310653ad761f'
TLS=ROOT/'tracking/evidence/m03/english-image34/2026-10-31T17-03-17-960492Z-v2-registry-tls-diagnosis.json';TLS_SHA='9ca6d6885affb207a9956bac00ca711236d06466a4bce4b8c0250cae413ae58a'
CONFIG=b'{"hosts":{"vcr.vercel.com":{"blobChunk":16777216,"blobMax":16777216}},"incDockerCred":true,"incDockerCert":false}\n'
INDEX='application/vnd.oci.image.index.v1+json';MANIFEST='application/vnd.oci.image.manifest.v1+json'
MAX_ARCHIVE=4*1024**3;MAX_BLOB=1024**3;MAX_JSON=2*1024**2;MAX_FILES=256

def need(value):
 if not value:raise ValueError('ENGLISH34_OCI_TRANSPORT_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def exact_file(path,maximum=16*1024**2):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and 0<path.stat().st_size<=maximum);return path.read_bytes()
def digest(value):need(type(value)is str and re.fullmatch('sha256:[a-f0-9]{64}',value));return value
def kind_value(kind):need(kind in('native','daemon'));return kind
def target(kind):return PREFIX+kind_value(kind)+':'+TAG
def private_path(kind,suffix):return PRIVATE/(kind_value(kind)+'-'+suffix)
def exclusive(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);need(path.parent.resolve()==path.parent and not path.parent.is_symlink())
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n');stream.flush();os.fsync(stream.fileno())
def reference(relative):
 need(type(relative)is str and relative.startswith('tracking/evidence/m03/english-oci34/')and '..'not in relative and '\\'not in relative)
 path=ROOT/relative;need(path.resolve().is_relative_to(ROOT/'tracking/evidence/m03/english-oci34'));raw=exact_file(path)
 return {'receipt':relative,'sha256':sha(raw)},json.loads(raw)
def receipt(kind,action,value):
 path=ROOT/'tracking/evidence/m03/english-oci34'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+kind+'-'+action+'.json')
 exclusive(path,{'schema_version':'1.0','observed_at':stamp(),'kind':kind,'run':RUN,'source_sha256':SOURCE,'target':target(kind),'raw_logs_or_credentials_persisted':False,'private_media_used':False,'worker_polling':False,'db_jobs_or_openai_n8n_calls':False,**value});return path
def source_pins():
 need(sha(exact_file(TLS))==TLS_SHA);proof=json.loads(TLS.read_bytes());need(proof['failure_stage']=='registry_blob_head_tls_handshake'and proof['underlying_error']=='TLS_HANDSHAKE_TIMEOUT'and proof['registry_body_size_or_chunk_limit_determined']is False and proof['source_sha256']==SOURCE)
 need(REGCTL.stat().st_size==13152768 and sha(exact_file(REGCTL))==REGCTL_SHA)
 need(sha(exact_file(base.refresh.HELPER))=='2856e226b29ae2a9c67dd2419adbd527c03c34a84fc82454856b61f555c2b3b5')
 # Export and transfer add their own operator pins. Tests/docs and the future
 # transfer module are deliberately outside the immutable export closure.
 files=[Path(__file__),Path(native.__file__)]
 return {**build.sources(),**{p.relative_to(ROOT).as_posix():sha(exact_file(p))for p in files},'regctl_sha256':REGCTL_SHA,'tls_diagnosis_sha256':TLS_SHA}
def context(kind):
 if kind_value(kind)=='native':return base.verify_context('native')
 admitted=native.source();success=load_success('native');need(admitted['native_image_id']==success['runtime_digest'])
 seal_raw=exact_file(base.CONTEXT/'apps/worker/native-source.json');seal=json.loads(seal_raw);expected={row['path']:row['sha256']for row in seal['files']}
 for name in ['daemon','native-sandbox']:
  expected['Dockerfile.'+name]=expected['apps/worker/Dockerfile.'+name];need(sha(exact_file(base.CONTEXT/('Dockerfile.'+name)))==expected['Dockerfile.'+name])
 ignore=exact_file(base.CONTEXT/'.dockerignore',4096);need(ignore==b'.git\n.env*\n.local\nnode_modules\n**/node_modules\n')
 expected.update({'apps/worker/native-source.json':sha(seal_raw),'.dockerignore':sha(ignore),'apps/worker/native-sandbox-manifest.json':admitted['manifest_sha256']})
 actual=set()
 for path in base.CONTEXT.rglob('*'):
  need(not path.is_symlink()and path.resolve().is_relative_to(base.CONTEXT))
  if path.is_file():actual.add(path.relative_to(base.CONTEXT).as_posix())
 need(actual==set(expected));dockerfile=exact_file(base.CONTEXT/'Dockerfile.daemon').decode('utf8');need(dockerfile.count(base.IMPORT)==1 and dockerfile.index('USER 1000:1000')<dockerfile.index(base.IMPORT))
 return {'source_sha256':SOURCE,'file_count':160,'context_files':len(actual),'source_seal_sha256':sha(seal_raw),'manifest_sha256':admitted['manifest_sha256']}

def archive_proof(archive,destination=None):
 """Validate every tar member/hash/descriptor before copying explicit files.

 No layer decompression or legacy Docker manifest conversion is performed.
 """
 need(archive.is_file()and not archive.is_symlink()and archive.resolve()==archive and 0<archive.stat().st_size<=MAX_ARCHIVE)
 before=archive.stat();archive_hash=hashlib.sha256()
 with archive.open('rb')as stream:
  while chunk:=stream.read(1024**2):archive_hash.update(chunk)
 with tarfile.open(archive,'r:')as tar:
  entries=tar.getmembers();need(1<=len(entries)<=MAX_FILES);members={};seen=set()
  for entry in entries:
   name=entry.name.removeprefix('./');normalized=name.rstrip('/')if entry.isdir()else name;need(normalized not in seen);seen.add(normalized)
   if entry.isdir():need(name.rstrip('/')in('blobs','blobs/sha256'));continue
   need(entry.isfile()and(name in('oci-layout','index.json')or re.fullmatch('blobs/sha256/[a-f0-9]{64}',name))and 0<entry.size<=MAX_BLOB)
   members[name]=entry
  need({'oci-layout','index.json'}.issubset(members))
  metadata_hashes={}
  def read_json(name):
   need(name in members and members[name].size<=MAX_JSON);raw=tar.extractfile(members[name]).read();metadata_hashes[name]=sha(raw);return json.loads(raw)
  need(read_json('oci-layout')=={'imageLayoutVersion':'1.0.0'});index=read_json('index.json');need(index.get('schemaVersion')==2 and type(index.get('manifests'))is list and len(index['manifests'])==1)
  blobs={}
  for name,entry in members.items():
   if not name.startswith('blobs/'):continue
   observed=hashlib.sha256()
   with tar.extractfile(entry)as stream:
    while chunk:=stream.read(1024**2):observed.update(chunk)
   need(observed.hexdigest()==name.rsplit('/',1)[1]);blobs['sha256:'+observed.hexdigest()]={'name':name,'bytes':entry.size}
  visited=set();sizes={};runtimes=[]
  def verify(desc):
   need(type(desc)is dict and type(desc.get('size'))is int and 0<desc['size']<=MAX_BLOB and type(desc.get('mediaType'))is str and desc.get('urls')in(None,[])and 'data'not in desc)
   value=digest(desc.get('digest'));need(value in blobs and blobs[value]['bytes']==desc['size'])
   need(value not in sizes or sizes[value]==desc['size']);sizes[value]=desc['size']
   if value in visited:return
   visited.add(value)
   if desc['mediaType']==INDEX:
    body=read_json(blobs[value]['name']);need(body.get('schemaVersion')==2 and body.get('mediaType')==INDEX and type(body.get('manifests'))is list and 1<=len(body['manifests'])<=32)
    for child in body['manifests']:verify(child)
   elif desc['mediaType']==MANIFEST:
    body=read_json(blobs[value]['name']);need(body.get('schemaVersion')==2 and body.get('mediaType')==MANIFEST and type(body.get('layers'))is list and len(body['layers'])<=64)
    verify(body.get('config'))
    for child in body['layers']:verify(child)
    config=read_json(blobs[digest(body['config']['digest'])]['name'])
    if config.get('os')=='linux'and config.get('architecture')=='amd64':
     need(desc.get('platform')is None or desc['platform'].get('os')=='linux'and desc['platform'].get('architecture')=='amd64');runtimes.append(value)
   else:need(desc['mediaType']not in('application/vnd.docker.distribution.manifest.v2+json','application/vnd.docker.distribution.manifest.list.v2+json'))
  root=index['manifests'][0];need(root.get('mediaType')in(INDEX,MANIFEST));verify(root)
  need(visited==set(blobs)and len(set(runtimes))==1);root_digest=digest(root['digest']);runtime_digest=runtimes[0]
  if destination is not None:
   need(not destination.exists()and destination.parent.resolve()==destination.parent and not destination.parent.is_symlink());destination.mkdir();(destination/'blobs/sha256').mkdir(parents=True)
   for name,entry in members.items():
    output=destination/name;need(output.resolve().is_relative_to(destination));copied=hashlib.sha256()
    with tar.extractfile(entry)as source,output.open('xb')as target_stream:
     while chunk:=source.read(1024**2):copied.update(chunk);target_stream.write(chunk)
    if name.startswith('blobs/'):need(copied.hexdigest()==name.rsplit('/',1)[1])
    else:need(copied.hexdigest()==metadata_hashes[name])
 after=archive.stat();need((before.st_size,before.st_mtime_ns,before.st_ino)==(after.st_size,after.st_mtime_ns,after.st_ino))
 return {'archive_sha256':archive_hash.hexdigest(),'archive_bytes':before.st_size,'index_digest':root_digest,'runtime_digest':runtime_digest,'blobs_verified':len(visited),'compressed_blob_bytes':sum(row['bytes']for row in blobs.values()),'all_blob_sha256_and_descriptor_sizes_verified':True,'all_blobs_reachable':True,'layers_recompressed':False,'legacy_manifest_used':False,'external_descriptor_urls':False,'blobs':[{'digest':value,'bytes':blobs[value]['bytes']}for value in sorted(blobs)]}

def bounded(command,environment,timeout,phase):
 process=subprocess.Popen(command,cwd=ROOT,env=environment,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 buffers=[bytearray(),bytearray()];overflow=threading.Event()
 def collect(stream,index,limit):
  while chunk:=stream.read(4096):
   available=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:available])
   if len(chunk)>available:overflow.set();process.kill()
 threads=[threading.Thread(target=collect,args=(process.stdout,0,2*1024**2)),threading.Thread(target=collect,args=(process.stderr,1,8*1024**2))]
 for thread in threads:thread.start()
 started=time.monotonic();last=started;timed_out=False
 while process.poll()is None:
  if time.monotonic()-started>=timeout:timed_out=True;process.kill();break
  if time.monotonic()-last>=30:
   print(json.dumps({'event':'oci_operation_progress','phase':phase,'elapsed_seconds':round(time.monotonic()-started),'stdout_bytes':len(buffers[0]),'stderr_bytes':len(buffers[1]),'raw_logs_persisted':False}),flush=True);last=time.monotonic()
  time.sleep(.2)
 process.wait(timeout=10)
 for thread in threads:thread.join(timeout=5)
 need(all(not thread.is_alive()for thread in threads))
 return {'exit_code':process.returncode,'timed_out':timed_out,'output_limit_exceeded':overflow.is_set(),'stdout':bytes(buffers[0]),'stderr':bytes(buffers[1]),'process_id':process.pid,'elapsed_seconds':round(time.monotonic()-started,3)}

def load_success(kind):
 # The separately pinned transfer producer is completed independently while a
 # local export may run. It must validate the real export/copy/remote proofs.
 return module('english_oci34_actual_transfer',HERE/'transfer.py').load_success(kind)
