"""Pure production-only manifest/identity hash updates; no provider transport."""
from pathlib import Path
import copy,hashlib,importlib.util,re
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
a=module('worker_identity_environment_anchors',HERE/'admission.py');need=a.need
BASE=MAIN/'development/m07/completion-worker-rollout39/environment.py'
BASE_SHA='2ddc448f3f77f55ae3024d544a34ce5e595d0b454a7d2bfb4b4d7c5385f2ed74'
def base():
 need(hashlib.sha256(BASE.read_bytes()).hexdigest()==BASE_SHA);return module('worker_identity_frozen_env_metadata',BASE)
EDITABLE=('EPS_NATIVE_MANIFEST_SHA256','EPS_DAEMON_SOURCE_SHA256','EPS_NATIVE_COMPATIBILITY_SHA256')
def selected(rows,key):
 matches=[row for row in rows if row['key']==key and 'production'in row['target']and row['gitBranch']is None];need(len(matches)<=1)
 if not matches:return None
 row=matches[0];need(row['type']=='plain'and row['target']==['production']);return row
def projection(rows,values):
 e=base();need(type(values)is dict and not(set(values)-set(e.PUBLIC)-set(a.PUBLIC_DIGESTS)))
 result=e.projection(rows,{key:value for key,value in values.items()if key in e.PUBLIC})
 for key in a.PUBLIC_DIGESTS:
  row=selected(rows,key)
  if row is None:need(key not in values);continue
  need(key in values and type(values[key])is str and re.fullmatch('[a-f0-9]{64}',values[key]));result['ids'][key]=row['id'];result['public'][key]=values[key]
 need(result['public']['APP_ENV']==result['public']['EPS_RELEASE_MODE']=='production'and result['public'].get('EPS_PILOT_EXPIRES_AT','')==''and all(result['public'][key]=='true'for key in e.FLAGS))
 return result
def wanted(values):
 need(type(values)is dict and set(values)==set(EDITABLE)and all(type(value)is str and re.fullmatch('[a-f0-9]{64}',value)for value in values.values()));return values
def actions(before,values):
 wanted(values);need(before['public']['EPS_NATIVE_MANIFEST_SHA256']==a.OLD['manifest_sha256']);result=[]
 for key in EDITABLE:
  row=selected(before['metadata'],key)
  if row is None:
   need(key in a.PUBLIC_DIGESTS);result.append({'method':'POST','key':key,'body':{'key':key,'value':values[key],'type':'plain','target':['production']}})
  elif before['public'][key]!=values[key]:result.append({'method':'PATCH','key':key,'id':row['id'],'body':{'value':values[key]}})
 return result
def preserved(before,after,action):
 key=action['key'];need(key in EDITABLE and action['method']in('POST','PATCH'))
 old={row['id']:row for row in before['metadata']};new={row['id']:row for row in after['metadata']}
 if action['method']=='PATCH':
  need(old.keys()==new.keys()and before['ids'][key]==after['ids'][key]==action['id']);identity=action['id']
  need(all(({k:v for k,v in old[item].items()if k not in('updatedAt','updatedBy')}=={k:v for k,v in new[item].items()if k not in('updatedAt','updatedBy')})if item==identity else old[item]==new[item]for item in old))
 else:
  need(key in a.PUBLIC_DIGESTS and key not in before['ids']and len(new)==len(old)+1 and set(old)<set(new)and all(old[item]==new[item]for item in old))
  need(after['ids'][key]in set(new)-set(old));created=selected(after['metadata'],key);need(created is not None and created['id']==after['ids'][key])
 expected=copy.deepcopy(before['public']);expected[key]=action['body']['value'];need(after['public']==expected)
 return True
def production(value,expected):
 wanted(expected);need(all(value['public'].get(key)==digest for key,digest in expected.items()));return True
