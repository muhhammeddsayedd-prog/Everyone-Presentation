"""Add series-pinned review, measured-fit and typed retirement contracts.

Source-only contract update; no live configuration or provider/database calls.
"""
import copy,json
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]
file=ROOT/'contracts/openapi.yaml';api=yaml.safe_load(file.read_text(encoding='utf8'));schemas=api['components']['schemas']
ref=lambda name:{'$ref':'#/components/schemas/'+name}
nullable=lambda value:{'anyOf':[value,{'type':'null'}]}
obj=lambda properties:{'type':'object','additionalProperties':False,'properties':properties,'required':list(properties)}
string={'type':'string'};identifier=ref('Id');digest={'type':'string','pattern':'^[a-f0-9]{64}$'}
integer={'type':'integer','minimum':0};boolean={'type':'boolean'}
fields=['name_or_id','age_or_range','height_measurements','languages_accents','skills_experience','city','previous_projects_roles','classification','availability','presentation_notes']
schemas['ReviewFields']=obj({key:copy.deepcopy(string)for key in fields})
schemas['TemplateIdentity']=obj({'key':identifier,'version':identifier,'content_sha256':digest,'font_key':identifier})
schemas['ReviewFrame']=obj({'asset_id':identifier,'source_asset_id':identifier,'timestamp_ms':integer,'width':{'type':'integer','minimum':1},'height':{'type':'integer','minimum':1},'sha256':digest})
schemas['ReviewSlide']=obj({'kind':{'type':'string','enum':['candidate','pending']},'role_id':nullable(identifier),'role_name':string,'slot_id':nullable(identifier),'slot_label':string,
 'assignment_id':nullable(identifier),'workspace_candidate_id':nullable(identifier),'candidate_id':nullable(identifier),'candidate_media_id':nullable(identifier),
 'position':nullable({'type':'string','enum':['main','option','backup']}),'review_status':nullable({'type':'string','enum':['reviewed','unreviewed']}),
 'assignment_row_version':nullable(ref('RowVersion')),'workspace_candidate_row_version':nullable(ref('RowVersion')),'candidate_row_version':nullable(ref('RowVersion')),
 'requirements':ref('RoleRequirements'),'provisional':boolean,'fields':ref('ReviewFields'),'source_fields':ref('ReviewFields'),
 'frames':{'type':'array','maxItems':3,'items':ref('ReviewFrame')},'video_asset_id':nullable(identifier)})
schemas['ReviewFitOverflow']=obj({'slide_index':integer,'field':identifier,'axis':{'type':'string','enum':['horizontal','vertical']},'overflow_px':{'type':'number','exclusiveMinimum':0}})
schemas['ReviewFit']=obj({'status':{'type':'string','enum':['unmeasured','measured','failed']},'input_fingerprint':nullable(digest),'measured_at':nullable(ref('DateTime')),
 'overflows':{'type':'array','maxItems':10000,'items':ref('ReviewFitOverflow')},'error_code':nullable(identifier)})
schemas['ReviewCover']=obj({'project_name':string,'client_name':nullable(string),'title':string,'output_type':{'type':'string','enum':['selection','shortlist']},'logo_asset_id':nullable(identifier),'logo_placement':{'type':'string','enum':['cover','every_slide']}})
review=schemas['WorkspaceReview'];review['properties'].update({'series_id':identifier,'template':ref('TemplateIdentity'),'cover':ref('ReviewCover'),'slides':{'type':'array','maxItems':10000,'items':ref('ReviewSlide')},'fit':ref('ReviewFit')})
for key in ('series_id','template','cover','slides','fit'):
 if key not in review['required']:review['required'].append(key)
series=schemas['PresentationSeries'];series['properties'].update({'template_key':identifier,'template_version':identifier,'template_content_sha256':digest,'font_key':identifier})
for key in ('template_key','template_version','template_content_sha256','font_key'):
 if key not in series['required']:series['required'].append(key)
schemas['ReviewFitRequest']=obj({'series_id':identifier,'expected_input_fingerprint':digest})
schemas['CastingRetirement']=obj({'workspace_id':identifier,'resource_id':identifier,'operation':{'type':'string','enum':['retire_slots','archive_role','remove_workspace_candidate']},'undo_event_id':identifier,
 'expected_workspace_row_version':ref('RowVersion'),'assignment_ids':{'type':'array','uniqueItems':True,'maxItems':1000,'items':identifier},'slot_ids':{'type':'array','uniqueItems':True,'maxItems':1000,'items':identifier},
 'main_count':integer,'shortlist_count':integer,'can_undo':boolean,'unavailable_reason':nullable(string)})
schemas['CastingRetirementUndo']=obj({'expected_workspace_row_version':ref('RowVersion')})
schemas['CastingRetirementUndoResult']=obj({'success':{'type':'boolean','const':True},'affected_ids':{'type':'array','uniqueItems':True,'maxItems':10000,'items':identifier},'workspace_row_version':ref('RowVersion')})
if 'waiting_for_input'not in schemas['AiSuggestion']['properties']['status']['enum']:schemas['AiSuggestion']['properties']['status']['enum'].insert(2,'waiting_for_input')
suggestion=schemas['AiSuggestionCreate']
if 'field'not in suggestion['required']:suggestion['required'].append('field')
suggestion['properties']['instruction'].update(minLength=1,maxLength=8000)
suggestion['properties']['source_text']['maxLength']=65536
allowed={'assignment':fields,'candidate':['name','age_or_range','height_measurements','skills_experience','city','previous_projects_roles','classification'],
 'role':['name','requirements.age_range','requirements.appearance_performance','requirements.location','requirements.availability_requirements','requirements.other_instructions'],'workspace_candidate':['availability']}
suggestion['allOf']=[{'if':{'properties':{'target_type':{'const':target}}},'then':{'properties':{'field':{'type':'string','enum':names}}}}for target,names in allowed.items()]+[
 {'if':{'properties':{'capability':{'const':'slide_shorten'}}},'then':{'properties':{'target_type':{'const':'assignment'}}}}]
if 'review_fit'not in schemas['Job']['properties']['kind']['enum']:schemas['Job']['properties']['kind']['enum'].append('review_fit')
patch=api['paths']['/presentation-series/{series_id}']['patch']
if not any(item.get('$ref')=='#/components/parameters/IdempotencyKey'for item in patch['parameters']):patch['parameters'].append({'$ref':'#/components/parameters/IdempotencyKey'})
get=copy.deepcopy(api['paths']['/workspaces/{workspace_id}/review']['get']);post=copy.deepcopy(api['paths']['/ai-suggestions']['post'])
def operation(template,name,summary,cap,parameters,data,status,body=None):
 item=copy.deepcopy(template);item.update(operationId=name,summary=summary,tags=['review'],**{'x-capability':cap,'x-shared-service-operation':name});item['parameters']=parameters
 old=next(code for code in item['responses']if code.startswith('2'));response=item['responses'].pop(old)
 response['content']['application/json']['schema']['properties']['data']=ref(data);item['responses'][str(status)]=response
 if body:item['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body)}}}
 return item
pathparam=lambda name:{'name':name,'in':'path','required':True,'schema':identifier}
idem={'$ref':'#/components/parameters/IdempotencyKey'}
new=[('/workspaces/{workspace_id}/review/fit','post',operation(post,'request_workspace_review_fit','Measure the exact selected template against a captured review fingerprint','workspaces.write',[pathparam('workspace_id'),idem],'JobAccepted',202,'ReviewFitRequest')),
 ('/workspaces/{workspace_id}/retirements/{resource_id}','get',operation(get,'get_casting_retirement','Read the latest typed restoration choice for a retired resource','workspaces.write',[pathparam('workspace_id'),pathparam('resource_id')],'CastingRetirement',200)),
 ('/workspaces/{workspace_id}/retirements/{event_id}/undo','post',operation(post,'undo_casting_retirement','Restore a retirement with its current workspace revision and recorded inverse','workspaces.write',[pathparam('workspace_id'),pathparam('event_id'),idem],'CastingRetirementUndoResult',200,'CastingRetirementUndo'))]
for path,method,value in new:api['paths'].setdefault(path,{})[method]=value
file.write_text(yaml.safe_dump(api,sort_keys=False,allow_unicode=True,width=140),encoding='utf8')

def convert(value):
 if isinstance(value,dict):return {key:item.replace('#/components/schemas/','#/$defs/')if key=='$ref'else convert(item)for key,item in value.items()}
 if isinstance(value,list):return [convert(item)for item in value]
 return value
def definitions(value):
 names=set()
 def visit(node):
  if isinstance(node,dict):
   if '$ref'in node and node['$ref'].startswith('#/$defs/'):
    name=node['$ref'].split('/')[-1]
    if name not in names:names.add(name);visit(convert(schemas[name]))
   for key,item in node.items():
    if key!='$defs':visit(item)
  elif isinstance(node,list):
   for item in node:visit(item)
 visit(value);return {name:convert(schemas[name])for name in sorted(names)}
catalogfile=ROOT/'contracts/mcp-tool-catalog.json';catalog=json.loads(catalogfile.read_text(encoding='utf8'))
# Rebuild the definition closure of existing operations from the same source.
for tool in catalog['tools']:
 for side in ('inputSchema','outputSchema'):
  if '$defs'in tool[side]:tool[side]['$defs']=definitions(tool[side])
reviewnames={'list_presentation_series','create_presentation_series','get_presentation_series','update_presentation_series','get_workspace_review','create_ai_suggestion','get_ai_suggestion','request_workspace_review_fit','get_casting_retirement','undo_casting_retirement'}
operations=[(path,method,op)for path,item in api['paths'].items()for method,op in item.items()if isinstance(op,dict)and op.get('operationId')in reviewnames]
for path,method,op in operations:
 existing=next((row for row in catalog['tools']if row['name']==op['operationId']),None)
 template='get_workspace_review'if method=='get'else'create_presentation_series';tool=copy.deepcopy(existing or next(row for row in catalog['tools']if row['name']==template))
 tool.update(name=op['operationId'],description=op['summary'],operationId=op['operationId'],http={'path':path,'method':method.upper()},capability=op['x-capability'])
 properties={};required=[]
 for parameter in op['parameters']:
  if '$ref'in parameter:
   if parameter['$ref']=='#/components/parameters/IdempotencyKey':parameter={'name':'idempotency_key','schema':{'type':'string','minLength':16,'maxLength':200},'required':True}
   else:parameter=api['components']['parameters'][parameter['$ref'].split('/')[-1]]
  properties[parameter['name']]=convert(parameter['schema'])
  if parameter.get('required'):required.append(parameter['name'])
 if 'requestBody'in op:properties['body']=convert(op['requestBody']['content']['application/json']['schema']);required.append('body')
 tool['inputSchema']=obj(properties);tool['inputSchema']['required']=required;tool['inputSchema']['$defs']=definitions(tool['inputSchema'])
 status=next(code for code in op['responses']if code.startswith('2'));tool['outputSchema']=convert(op['responses'][status]['content']['application/json']['schema']);tool['outputSchema']['$defs']=definitions(tool['outputSchema'])
 index=next((index for index,row in enumerate(catalog['tools'])if row['name']==tool['name']),None)
 if index is None:catalog['tools'].append(tool)
 else:catalog['tools'][index]=tool
catalogfile.write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf8')
indexfile=ROOT/'docs/integrations/OPERATION_INDEX.md';content=indexfile.read_text(encoding='utf8')
for path,method,op in new:
 if '`'+op['operationId']+'`'not in content:content=content.rstrip()+f"\n| `{op['operationId']}` | `{method.upper()} {path}` | {op['x-capability']} | Yes |\n"
indexfile.write_text(content,encoding='utf8')
print(json.dumps({'source_only':True,'new_operations':[op['operationId']for _,_,op in new],'schemas':len(schemas)}))
