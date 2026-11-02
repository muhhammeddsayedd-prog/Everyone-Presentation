"""Pure public-worker-env projection and exact same-ID mutation preservation."""
import copy,re
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
FLAGS=('EPS_SPECS_FILES_ENABLED','EPS_CANDIDATE_MEDIA_ENABLED','EPS_FRAME_EXTRACTION_ENABLED','EPS_PDF_VISION_ENABLED','EPS_REVIEW_ENABLED','EPS_PRESENTATION_ENABLED','EPS_GUEST_EXPORTS_ENABLED')
EDITABLE=('APP_ENV','EPS_RELEASE_MODE','EPS_NATIVE_MANIFEST_SHA256','EPS_PILOT_EXPIRES_AT')
PUBLIC=(*EDITABLE,'EPS_PILOT_OWNER_CONTROLLED','EPS_NATIVE_TRANSPORT','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY',*FLAGS)
METADATA=('id','key','type','target','gitBranch','createdAt','updatedAt')
OLD_MANIFEST='3e20f7b1c795ab2e825a02327c4a4a241b97a57a8bf3d28e2a265f7eba8630f9'
MANIFEST='a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943'
MANIFEST_ID='O1l5qVwaJ6VYRhm9'
def need(v):
 if not v:raise ValueError('COMPLETION39_PUBLIC_ENV_UNCONFIRMED')
def metadata(payload):
 need(type(payload)is dict and type(payload.get('envs'))is list and len(payload['envs'])<=100
  and(payload.get('pagination')is None or type(payload['pagination'])is dict and payload['pagination'].get('next')is None))
 result=[]
 for raw in payload['envs']:
  need(type(raw)is dict);row={key:copy.deepcopy(raw.get(key))for key in METADATA}
  need(type(row['id'])is str and re.fullmatch('[A-Za-z0-9_-]{1,128}',row['id'])and type(row['key'])is str and re.fullmatch('[A-Z][A-Z0-9_]{0,99}',row['key'])
   and row['type']in('encrypted','sensitive','plain','system','secret')and(row['gitBranch']is None or type(row['gitBranch'])is str and 0<len(row['gitBranch'])<=256)
   and type(row['target'])is list and len(set(row['target']))==len(row['target'])and all(v in('production','preview','development')for v in row['target'])
   and type(row['createdAt'])is int and type(row['updatedAt'])is int and 0<row['createdAt']<=row['updatedAt'])
  result.append(row)
 need(len({row['id']for row in result})==len(result));return sorted(result,key=lambda row:row['id'])
def selected(rows,key,required=True):
 need(key in PUBLIC);matches=[row for row in rows if row['key']==key and 'production'in row['target']and row['gitBranch']is None]
 need(len(matches)==1 if required else len(matches)<=1)
 if not matches:return None
 row=matches[0]
 if key in EDITABLE:need(row['type']=='plain'and row['target']==['production'])
 return row
def projection(rows,values):
 # values are read only for the public allowlist, never for service credentials.
 need(type(values)is dict and not(set(values)-set(PUBLIC)))
 ids={};public={}
 for key in PUBLIC:
  row=selected(rows,key,key not in('APP_ENV','EPS_PILOT_EXPIRES_AT','EPS_PILOT_OWNER_CONTROLLED'))
  if row is None:need(key not in values);continue
  need(key in values and type(values[key])is str and len(values[key])<=4096);value=values[key];ids[key]=row['id']
  if key in FLAGS:need(value=='true')
  if key=='EPS_NATIVE_TRANSPORT':need(value=='vercel_sandbox')
  if key=='SUPABASE_URL':need(value=='https://pyibofyctwnqpvktepse.supabase.co');value='canonical_supabase_url_verified'
  if key=='SUPABASE_PUBLISHABLE_KEY':need(re.fullmatch('sb_publishable_[A-Za-z0-9_-]{8,}',value));value='canonical_publishable_key_shape_verified'
  if key=='EPS_PILOT_OWNER_CONTROLLED':need(value in('false','true'))
  public[key]=value
 need(ids['EPS_NATIVE_MANIFEST_SHA256']==MANIFEST_ID)
 return {'metadata':copy.deepcopy(rows),'ids':ids,'public':public}
def actions(before):
 public=before['public'];need(public['EPS_NATIVE_MANIFEST_SHA256']==OLD_MANIFEST and public['EPS_RELEASE_MODE']=='controlled_pilot')
 need(public.get('APP_ENV')in(None,'production','development','test','staging'))
 result=[]
 for key,wanted in [('APP_ENV','production'),('EPS_RELEASE_MODE','production'),('EPS_NATIVE_MANIFEST_SHA256',MANIFEST),('EPS_PILOT_EXPIRES_AT','')]:
  row=selected(before['metadata'],key,False)
  if row is None:
   if key=='APP_ENV':result.append({'method':'POST','key':key,'body':{'key':key,'value':wanted,'type':'plain','target':['production']}})
  elif public[key]!=wanted:result.append({'method':'PATCH','key':key,'id':row['id'],'body':{'value':wanted}})
 return result
def preserved(before,after,action):
 need(action['key']in EDITABLE and action['method']in('PATCH','POST'))
 old={row['id']:row for row in before['metadata']};new={row['id']:row for row in after['metadata']};key=action['key']
 if action['method']=='PATCH':
  need(old.keys()==new.keys()and before['ids'][key]==after['ids'][key]==action['id'])
  identity=action['id'];need(selected(before['metadata'],key)['target']==['production'])
  for item in old:need(({k:v for k,v in old[item].items()if k!='updatedAt'}=={k:v for k,v in new[item].items()if k!='updatedAt'})if item==identity else old[item]==new[item])
 else:
  need(key=='APP_ENV'and key not in before['ids']and len(new)==len(old)+1 and set(old)<set(new)and all(old[item]==new[item]for item in old))
  need(after['ids'][key]in set(new)-set(old));created=selected(after['metadata'],key);need(created['type']=='plain'and created['target']==['production']and created['gitBranch']is None)
 expected=copy.deepcopy(before['public']);expected[key]=action['body']['value'];need(after['public']==expected)
 return True
def production(value):
 public=value['public'];need(public['APP_ENV']==public['EPS_RELEASE_MODE']=='production'and public['EPS_NATIVE_MANIFEST_SHA256']==MANIFEST
  and public.get('EPS_PILOT_EXPIRES_AT','')==''and all(public[key]=='true'for key in FLAGS))
 return True
