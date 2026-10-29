"""Add the optional atomic AI-apply guard to the normal assignment mutation."""
from pathlib import Path
import json,copy,yaml
ROOT=Path(__file__).resolve().parents[1]
api_file=ROOT/'contracts/openapi.yaml'
api=yaml.safe_load(api_file.read_text(encoding='utf8'))
schema=api['components']['schemas']['AssignmentPatch']
guards=['ai_suggestion_id','expected_series_id','expected_input_fingerprint']
schema['description']='Manual assignment edits remain independent. Explicit AI proposal apply supplies all three review guards and exactly one nonempty slide-wording field; the canonical transaction verifies current proposal/source/series context before writing.'
for key in guards:schema['properties'][key]={'$ref':'#/components/schemas/Id'}if key!='expected_input_fingerprint'else{'type':'string','pattern':'^[a-f0-9]{64}$'}
fields=api['components']['schemas']['SlideWording']['properties']
schema['allOf']=[{'if':{'anyOf':[{'required':[key]}for key in guards]},'then':{'required':guards+['slide_wording'],
 'not':{'anyOf':[{'required':[key]}for key in ['position','shortlist_included','presentation_notes','internal_notes']]},
 'properties':{'slide_wording':{'type':'object','additionalProperties':False,'minProperties':1,'maxProperties':1,
  'properties':{key:{'type':'string','minLength':1,'pattern':r'[^ \t\r\n]'}for key in fields}}}}}]
api_file.write_text(yaml.safe_dump(api,sort_keys=False,allow_unicode=True,width=140),encoding='utf8')
def convert(value):
 if isinstance(value,dict):return {key:item.replace('#/components/schemas/','#/$defs/')if key=='$ref'else convert(item)for key,item in value.items()}
 if isinstance(value,list):return [convert(item)for item in value]
 return value
catalog_file=ROOT/'contracts/mcp-tool-catalog.json';catalog=json.loads(catalog_file.read_bytes())
for tool in catalog['tools']:
 for side in ['inputSchema','outputSchema']:
  definitions=tool.get(side,{}).get('$defs',{})
  if 'AssignmentPatch'in definitions:definitions['AssignmentPatch']=convert(copy.deepcopy(schema))
catalog_file.write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf8')
print(json.dumps({'source_only':True,'operation':'update_assignment','guards':guards}))
