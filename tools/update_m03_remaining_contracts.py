"""Add bounded TUS/support contracts, retaining unrelated operations and annotations."""
import copy, json
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]
file=ROOT/'contracts/openapi.yaml'; api=yaml.safe_load(file.read_text(encoding='utf8'))
schemas=api['components']['schemas']
session=schemas['UploadSession']
session['properties']['upload_metadata']={'type':'object','additionalProperties':False,'properties':{
    name:{'type':'string','minLength':1,'maxLength':2000} for name in ('bucketName','objectName','contentType','cacheControl')},
    'required':['bucketName','objectName','contentType','cacheControl'],
    'description':'Exact server-reserved TUS metadata. Never accept a caller-selected destination.'}
session['properties']['chunk_size']={'type':'integer','const':6291456}
tus={'if':{'properties':{'protocol':{'const':'tus'}}},'then':{'required':['upload_metadata','chunk_size']}}
if tus not in session['allOf']:session['allOf'].append(tus)
support_scope={'if':{'properties':{'purpose':{'const':'candidate_support'}}},'then':{'required':['workspace_id','candidate_id']}}
if support_scope not in schemas['UploadSessionCreate'].setdefault('allOf',[]): schemas['UploadSessionCreate']['allOf'].append(support_scope)
schemas['CandidateSupport']={'type':'object','additionalProperties':False,'properties':{
    'id':{'$ref':'#/components/schemas/Id'},'row_version':{'type':'integer','minimum':1},'candidate_id':{'$ref':'#/components/schemas/Id'},
    'asset':{'$ref':'#/components/schemas/MediaAsset'},'created_at':{'$ref':'#/components/schemas/DateTime'}},
    'required':['id','row_version','candidate_id','asset','created_at'],
    'description':'Explicit supporting attachment, separate from extracted frames and reusable facts.'}
schemas['CandidateSupportArchive']={'type':'object','additionalProperties':False,
    'properties':{'row_version':copy.deepcopy(schemas['ArchiveRequest']['properties']['row_version'])},
    'required':['row_version'],
    'description':'Archive only the supporting-file association at its current version. No reason, asset deletion or other fields are accepted.'}
schemas['FrameExtraction']['properties']['timestamps_ms']['items']['maximum']=1799999
schemas['FrameExtractionOutcome']={'type':'object','additionalProperties':False,'properties':{
    'requested_count':{'type':'integer','minimum':1,'maximum':10},'extracted_count':{'type':'integer','minimum':0,'maximum':10},
    'unavailable_timestamps_ms':{'type':'array','maxItems':10,'uniqueItems':True,'items':{'type':'integer','minimum':0,'maximum':1799999}},
    'warnings':{'type':'array','maxItems':2,'uniqueItems':True,'items':{'type':'string','enum':['FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE']}}},
    'required':['requested_count','extracted_count','unavailable_timestamps_ms','warnings']}
schemas['Job']['properties']['frame_extraction']={'$ref':'#/components/schemas/FrameExtractionOutcome'}
schemas['Job']['allOf']=[{'if':{'properties':{'kind':{'const':'frame_extract'},'status':{'const':'succeeded'}}},
    'then':{'required':['frame_extraction']},'else':{'not':{'required':['frame_extraction']}}}]
listing=copy.deepcopy(api['paths']['/candidates']['get'])
listing.update(operationId='list_candidate_support',summary='List private supporting files attached to a candidate',tags=['candidate-media'])
listing['x-shared-service-operation']='list_candidate_support'
listing['parameters']=[{'name':'candidate_id','in':'path','required':True,'schema':{'$ref':'#/components/schemas/Id'}}]+[
    p for p in listing['parameters'] if p.get('name') in ('cursor','limit')]
listing['responses']['200']['content']['application/json']['schema']['properties']['data']['items']={'$ref':'#/components/schemas/CandidateSupport'}
archive=copy.deepcopy(api['paths']['/candidates/{candidate_id}/archive']['post'])
archive.update(operationId='archive_candidate_support',summary='Archive a supporting-file association without deleting retained bytes',tags=['candidate-media'])
archive['x-shared-service-operation']='archive_candidate_support';archive['parameters'][0]['name']='candidate_support_id'
archive['requestBody']['content']['application/json']['schema']={'$ref':'#/components/schemas/CandidateSupportArchive'}
api['paths']['/candidates/{candidate_id}/supporting-files']={'get':listing}
api['paths']['/candidate-support/{candidate_support_id}/archive']={'post':archive}
file.write_text(yaml.safe_dump(api,sort_keys=False,allow_unicode=True,width=140),encoding='utf8')

def convert(value):
    if isinstance(value,dict):return {k:v.replace('#/components/schemas/','#/$defs/') if k=='$ref' else convert(v) for k,v in value.items()}
    if isinstance(value,list):return [convert(v) for v in value]
    return value
def definitions(value):
    found=set()
    def walk(item):
        if isinstance(item,dict):
            if '$ref' in item and item['$ref'].startswith('#/$defs/'):
                name=item['$ref'].split('/')[-1]
                if name not in found:found.add(name);walk(convert(schemas[name]))
            for key,child in item.items():
                if key!='$defs':walk(child)
        elif isinstance(item,list):
            for child in item:walk(child)
    walk(value)
    return {name:convert(schemas[name]) for name in sorted(found)}
catalog_file=ROOT/'contracts/mcp-tool-catalog.json';catalog=json.loads(catalog_file.read_text(encoding='utf8'))
for tool in catalog['tools']:
    for side in ('inputSchema','outputSchema'):
        target=tool[side]
        for name in ('UploadSession','UploadSessionCreate'):
            if name in target.get('$defs',{}):target['$defs'][name]=convert(schemas[name])
        if '$defs' in target:target['$defs']=definitions(target)
for path,method,template in [('/candidates/{candidate_id}/supporting-files','get','search_candidates'),('/candidate-support/{candidate_support_id}/archive','post','archive_candidate')]:
    op=api['paths'][path][method];tool=copy.deepcopy(next(t for t in catalog['tools'] if t['name']==template))
    tool.update(name=op['operationId'],description=op['summary'],operationId=op['operationId'],http={'method':method.upper(),'path':path},capability=op['x-capability'])
    properties={};required=[]
    for parameter in op['parameters']:
        if '$ref' in parameter:
            if parameter['$ref']!='#/components/parameters/IdempotencyKey':raise ValueError('Unexpected parameter')
            parameter={'name':'idempotency_key','required':True,'schema':{'type':'string','minLength':16,'maxLength':200}}
        properties[parameter['name']]=convert(parameter['schema'])
        if parameter.get('required'):required.append(parameter['name'])
    if 'requestBody' in op:
        properties['body']=convert(op['requestBody']['content']['application/json']['schema']);required.append('body')
    tool['inputSchema']={'type':'object','additionalProperties':False,'properties':properties,'required':required}
    tool['inputSchema']['$defs']=definitions(tool['inputSchema'])
    tool['outputSchema']=convert(op['responses']['200']['content']['application/json']['schema'])
    tool['outputSchema']['$defs']=definitions(tool['outputSchema'])
    existing=next((i for i,t in enumerate(catalog['tools']) if t['name']==tool['name']),None)
    if existing is None:catalog['tools'].append(tool)
    else:catalog['tools'][existing]=tool
catalog_file.write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf8')
index=ROOT/'docs/integrations/OPERATION_INDEX.md';text=index.read_text(encoding='utf8')
for name,route,cap in [('list_candidate_support','GET /candidates/{candidate_id}/supporting-files','cast.read'),('archive_candidate_support','POST /candidate-support/{candidate_support_id}/archive','cast.write')]:
    if f'`{name}`' not in text:text=text.rstrip()+f'\n| `{name}` | `{route}` | {cap} | Yes |\n'
text=text.replace('\n\n| `list_candidate_support`','\n| `list_candidate_support`').replace('\n\n| `archive_candidate_support`','\n| `archive_candidate_support`')
index.write_text(text,encoding='utf8')
print('Updated TUS/support contracts and self-contained MCP schemas from OpenAPI.')
