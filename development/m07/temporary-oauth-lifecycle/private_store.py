"""Private immutable generations and permanent phase claims; no network/auth reads."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,sys,uuid
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PRIVATE=MAIN/'.local/temporary-oauth-lifecycle'
HELPER=MAIN/'tools/provision_logo_verifier.py'
HELPER_SHA='660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'
PHASES=('authorize','exchange','expiry','refresh','logout','denials')

def need(value):
 if not value:raise ValueError('TEMP_OAUTH_PRIVATE_STATE_REFUSED')

def strict(raw):
 need(type(raw)is bytes and 0<len(raw)<=65536)
 def pairs(items):
  result={}
  for key,value in items:need(key not in result);result[key]=value
  return result
 try:return json.loads(raw.decode('utf8'),object_pairs_hook=pairs)
 except Exception:raise ValueError('TEMP_OAUTH_PRIVATE_STATE_REFUSED')from None

class Store:
 def __init__(self,run):
  need(str(uuid.UUID(run))==run and hashlib.sha256(HELPER.read_bytes()).hexdigest()==HELPER_SHA)
  sys.path.insert(0,str(MAIN/'tools'));spec=importlib.util.spec_from_file_location('temporary_oauth_existing_private_files',HELPER);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.secure=m.WindowsPrivateFiles();self.run=run;self.root=PRIVATE/run;m.safe_path(self.root);self.root.mkdir(parents=True,exist_ok=True);m.safe_path(self.root)
 def path(self,name):
  need(re.fullmatch(r'(?:[a-z]+\.(?:claim|normal)|generation-[1-9][0-9]{0,3}|baseline|authorization)\.json',name)is not None)
  file=self.root/name;need(file.resolve().parent==self.root.resolve()and file.resolve().is_relative_to(PRIVATE.resolve()));return file
 def write_new(self,name,value):
  raw=(json.dumps(value,separators=(',',':'))+'\n').encode();need(len(raw)<=65536)
  with self.secure.create(self.path(name))as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno());self.secure.verify_open(stream)
  self.secure.verify(self.path(name));return name
 def read(self,name):
  file=self.path(name);self.secure.verify(file)
  with file.open('rb')as stream:self.secure.verify_open(stream);return strict(stream.read(65537))
 def claim(self,phase):
  need(phase in PHASES);value={'v':1,'purpose':'temporary_owned_same_client_oauth','run':self.run,'phase':phase,'claim':str(uuid.uuid4()),'claimed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  self.write_new(phase+'.claim.json',value);return value['claim']
 def persist(self,phase,claim,tokens):
  need(phase in('exchange','refresh','denials'));prior=self.read(phase+'.claim.json');need(prior['run']==self.run and prior['phase']==phase and prior['claim']==claim)
  need(type(tokens)is dict and set(tokens)<=set(('access_token','refresh_token','token_type','expires_in','scope','id_token')))
  for key in('access_token','refresh_token','token_type'):need(type(tokens.get(key))is str and 0<len(tokens[key])<=16384 and not re.search(r'[\r\n\x00]',tokens[key]))
  need(tokens['token_type'].lower()=='bearer')
  return self.write_new('generation-'+str({'exchange':1,'refresh':2,'denials':3}[phase])+'.json',{'v':1,'run':self.run,'phase':phase,'claim':claim,'tokens':tokens})
 def normal(self,phase,claim,generation=None):
  need(phase in PHASES);prior=self.read(phase+'.claim.json');need(prior['run']==self.run and prior['phase']==phase and prior['claim']==claim)
  if phase in('exchange','refresh'):
   need(generation=='generation-'+('1'if phase=='exchange'else'2')+'.json');saved=self.read(generation);need(saved['run']==self.run and saved['phase']==phase and saved['claim']==claim)
  else:need(generation is None)
  value={'v':1,'run':self.run,'phase':phase,'claim':claim,'normal_return':True,'generation':generation};self.write_new(phase+'.normal.json',value);return{'phase':phase,'normal_return':True}
 def inspect(self,phase):
  need(phase in PHASES);claim=self.path(phase+'.claim.json');normal=self.path(phase+'.normal.json')
  if not claim.exists():need(not normal.exists());return{'phase':phase,'state':'not_dispatched'}
  c=self.read(claim.name);need(c['run']==self.run and c['phase']==phase)
  if not normal.exists():return{'phase':phase,'state':'unknown_no_replay'}
  n=self.read(normal.name);need(n['run']==self.run and n['phase']==phase and n['claim']==c['claim']and n['normal_return']is True)
  return{'phase':phase,'state':'normal_return_recorded'}

def main():
 # Private data may traverse captured stdio only. Never call this bridge with a
 # tool that forwards its read response; the future disabled Node adapter owns it.
 try:
  need(len(sys.argv)==1);value=strict(sys.stdin.buffer.read(65537));need(type(value)is dict and value.get('operation')in('claim','persist','normal','inspect','read','write_new'))
  operation=value.pop('operation');store=Store(value.pop('run'))
  if operation=='write_new':need(value.get('name')in('baseline.json','authorization.json'))
  result=getattr(store,operation)(**value)
  sys.stdout.write(json.dumps({'ok':True,'value':result},separators=(',',':'))+'\n')
 except Exception:sys.stdout.write('{"ok":false,"code":"TEMP_OAUTH_PRIVATE_STATE_REFUSED"}\n');raise SystemExit(1)from None

if __name__=='__main__':main()
