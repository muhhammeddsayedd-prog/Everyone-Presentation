"""Pure narrow web production environment/deployment projections."""
import copy, hashlib, json, re
PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';SLUG='muhammed-abdelrahman'
ALIAS='everyone-presentation-pilot.vercel.app';BASELINE='dpl_8mFQY4SkHiHmSVo6hR8QPLSdgwaS'
BASE_COMMIT='e494371894d148e335fa5a8bc50b601ac80bd555';BASE_SOURCE='2cef9eff53b2f9c8722370ccc29092cb7799a75ff89102cb2e6c3fc50ee3238b'
PUBLIC={'APP_ENV','EPS_RELEASE_MODE','EPS_PILOT_EXPIRES_AT','APP_BASE_URL','CENTRAL_ADAPTER_MODE','MCP_AUTH_MODE'}
DESIRED={'APP_ENV':'production','EPS_RELEASE_MODE':'production','EPS_PILOT_EXPIRES_AT':''}

def need(value):
 if not value:raise ValueError('PRODUCTION_WEB_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def environment_rows(value):
 need(type(value)is dict and type(value.get('envs'))is list and 1<=len(value['envs'])<=200 and(value.get('pagination')is None or value['pagination'].get('next')is None))
 rows=[];identities=set();scopes=set()
 for item in value['envs']:
  need(type(item)is dict and re.fullmatch('[A-Za-z0-9_-]{1,200}',item.get('id',''))and re.fullmatch('[A-Z][A-Z0-9_]{0,127}',item.get('key',''))and item['id']not in identities);identities.add(item['id'])
  target=item.get('target');need(type(target)is list and target and len(set(target))==len(target)and set(target)<={'production','preview','development'}and item.get('gitBranch')is None and item.get('customEnvironmentIds',[])==[])
  need(item.get('type')in('plain','sensitive','encrypted','system')and all(type(item.get(k))is int and item[k]>=0 for k in('createdAt','updatedAt')))
  for scope in target:need((item['key'],scope)not in scopes);scopes.add((item['key'],scope))
  row={k:copy.deepcopy(item[k])for k in('id','key','type','createdAt','updatedAt')};row['target']=sorted(target)
  if item['key']in PUBLIC:
   need(item['type']=='plain'and type(item.get('value'))is str and len(item['value'])<=2048);row['public_value']=item['value']
  rows.append(row)
 return sorted(rows,key=lambda row:row['id'])
def scoped(rows,key,target='production'):
 found=[r for r in rows if r['key']==key and target in r['target']];need(len(found)==1);return found[0]
def common_environment(rows):
 for key,value in{'APP_BASE_URL':'https://'+ALIAS,'CENTRAL_ADAPTER_MODE':'supabase','MCP_AUTH_MODE':'oauth'}.items():need(scoped(rows,key)['public_value']==value)
def production_environment(rows):
 common_environment(rows)
 for key,value in DESIRED.items():
  found=[r for r in rows if r['key']==key and'production'in r['target']]
  if key=='EPS_PILOT_EXPIRES_AT'and not found:continue
  need(len(found)==1 and found[0]['public_value']==value)
def environment_steps(rows):
 common_environment(rows);result=[]
 for key,value in DESIRED.items():
  found=[r for r in rows if r['key']==key and'production'in r['target']]
  if key=='EPS_PILOT_EXPIRES_AT'and not found:continue
  need(len(found)==1);row=found[0];need(row['type']=='plain'and row['public_value']in({'staging','production'}if key=='APP_ENV'else{'controlled_pilot','production'}if key=='EPS_RELEASE_MODE'else{row['public_value']}))
  if row['public_value']==value:continue
  if row['target']==['production']:result.append({'kind':'patch','key':key,'id':row['id'],'body':{'value':value}})
  else:
   result.append({'kind':'split','key':key,'id':row['id'],'body':{'target':[t for t in row['target']if t!='production']}})
   result.append({'kind':'create','key':key,'body':{'key':key,'value':value,'type':'plain','target':['production']}})
 return result
def transition(before,after,step):
 need(before['project']==after['project']and before['deployment']==after['deployment']);old={r['id']:r for r in before['environment']};new={r['id']:r for r in after['environment']}
 if step['kind']=='create':
  added=set(new)-set(old);need(len(added)==1 and set(old)<=set(new)and all(new[k]==v for k,v in old.items()));row=new[next(iter(added))]
  need(row['key']==step['key']and row['type']=='plain'and row['target']==['production']and row['public_value']==step['body']['value']and row['updatedAt']>=row['createdAt'])
 else:
  identity=step['id'];need(set(old)==set(new)and identity in old and all(new[k]==v for k,v in old.items()if k!=identity));row=copy.deepcopy(old[identity]);row['updatedAt']=new[identity]['updatedAt'];need(row['updatedAt']>=old[identity]['updatedAt'])
  if step['kind']=='split':row['target']=step['body']['target']
  else:need(step['kind']=='patch'and row['target']==['production']);row['public_value']=step['body']['value']
  need(row==new[identity])
 return after
def deployment(value):
 need(type(value)is dict and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',value.get('id',''))and value.get('project',{}).get('id')==PROJECT and value.get('team',{}).get('id')==TEAM and value.get('name')=='everyone-presentation-pilot')
 need(value.get('readyState')in('READY','BUILDING','INITIALIZING','QUEUED','ERROR','CANCELED','BLOCKED')and re.fullmatch(r'everyone-presentation-pilot(?:-[a-z0-9-]+)?\.vercel\.app',value.get('url','')))
 meta={k:value.get('meta',{}).get(k)for k in('epsSourceCommit','epsSourceManifest','epsProductionWebRun','epsProductionWebBuild','epsProductionWebCanonical')}
 for key,item in meta.items():need(item is None or type(item)is str and re.fullmatch('[a-f0-9-]{36}|[a-f0-9]{40}|[a-f0-9]{64}',item))
 return {'id':value['id'],'state':value['readyState'],'url':value['url'],'project_id':PROJECT,'team_id':TEAM,'meta':meta}
def baseline(value):
 need(value['id']==BASELINE and value['state']=='READY'and value['meta']['epsSourceCommit']==BASE_COMMIT and value['meta']['epsSourceManifest']==BASE_SOURCE)
