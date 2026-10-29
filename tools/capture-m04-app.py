"""Fixed read-only Dummy Test casting observer. Root invokes after its journey.

No release/replay entrypoint is called. Only validated IDs, hashes, counts and
bounded operational metadata reach the public receipt. Raw CLI streams remain
under the existing protected private logger; importing performs no IO.
"""
import datetime,hashlib,json,re,sys,uuid
from pathlib import Path
from release_foundation import ROOT,TARGET
from release_m04_casting import call as cli_call

SQL='tools/sql/m04-app-capture.sql'
SQL_SHA='70e7dba3de5f8f27458aa2be2396ce90ece4c3429d2c0e0e1dcb4371c4e0ae79'
RELEASE_BASELINE='tracking/evidence/cloud-m04-casting/2026-10-29T18-06-32-278912Z-2e383297-readback.json'
RELEASE_BASELINE_SHA='aeb701ffbc5a842abe3a14d3e223c9cd059f8aa0f2debdcf2649dba66cf66cfb'
PIN_BASELINE='tracking/evidence/m03/remaining-live-capture/2026-10-29T15-43-14-594675+00-00-bc9f137b.json'
PIN_BASELINE_SHA='4f08745279c442ef343e4a84ebf32d95b3481cdd67deb1d3f3b35dcaf63ee7ff'
SEALS={'tools/release_m04_casting.py':'ca855cda402566ebe8c6a78174a44dfcc9e878d7f0a320a6b7251a783ade2226',
 'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_m03_remaining.py':'5a608e480c7afb56a1b49c7a683c238d950301c589c1ff91348368f486995b7e',
 'tools/release_specs_read_operation.py':'a68be68c78bb20b59216e5aabd9b568bb0d46ef9fd35097ceb78392f85ad304e',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'}
WORKSPACE='098d5b48-42a3-475b-b562-735c9eafce80'
PROJECT='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'
CANDIDATES={'b7341092-50c4-49b4-ad5f-a0ceedddebf1','d5e665b3-dc23-4ead-858e-81abbce55743'}
CASTING_VERSION='20261029174841'
OPERATIONS={'create_assignment','update_assignment','remove_assignment','set_main','undo_main','reorder','retire_slots','archive_role','remove_workspace_candidate','link_duplicate'}
TOP={'observed_at','query_role','database','versions','workspace','roles','slots','assignments','events','counts','invariants','old_candidates','old_participations','old_media','protected_m02'}
UUID=re.compile('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')

def require(value):
    if not value:raise ValueError('M04_APP_METADATA_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def exact(value,keys):require(type(value)is dict and set(value)==set(keys))
def identifier(value):return isinstance(value,str)and UUID.fullmatch(value)is not None
def count(value):return type(value)is int and 0<=value<=9007199254740991
def timestamp(value):
    require(isinstance(value,str)and len(value)<=50)
    parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));require(parsed.tzinfo is not None)
def digest(value,nullable=False):require(nullable and value is None or isinstance(value,str)and re.fullmatch('[a-f0-9]{64}',value)is not None)
def rows(value,keys,maximum=1024):
    require(isinstance(value,list)and len(value)<=maximum)
    for row in value:exact(row,keys)
    require(all(identifier(row['id'])for row in value))
    require(len({row['id']for row in value})==len(value))
def scalars(row):
    for key,value in row.items():
        if key=='id'or key.endswith('_id'):require(value is None and key=='selected_candidate_media_id'or identifier(value))
        elif key.endswith('_sha256'):digest(value,key in('presentation_notes_sha256','internal_notes_sha256','availability_sha256'))
        elif key in('row_version','headcount'):require(value is None and key=='headcount'or count(value)and value>=1)
        elif key in('sort_order','draft_revision','selected_frame_count'):require(count(value))
        elif key in('archived','provisional','shortlist_included','has_unpublished_changes'):require(type(value)is bool)
        elif key=='position':require(value in('option','main','backup'))
        else:raise ValueError('M04_APP_METADATA_UNCONFIRMED')

def validate(state,versions=None):
    exact(state,TOP);require(state['query_role']==state['database']=='postgres');timestamp(state['observed_at'])
    require(isinstance(state['versions'],list)and len(state['versions'])>=20 and all(isinstance(v,str)and re.fullmatch('[0-9]{14}',v)for v in state['versions']))
    require(state['versions']==sorted(set(state['versions']))and CASTING_VERSION in state['versions'])
    if versions is not None:require(state['versions']==versions)
    exact(state['workspace'],{'id','project_id','row_version','draft_revision','has_unpublished_changes'});scalars(state['workspace'])
    require(state['workspace']['id']==WORKSPACE and state['workspace']['project_id']==PROJECT)
    shapes={'roles':({'id','row_version','headcount','sort_order','archived'},256),
      'slots':({'id','role_id','row_version','sort_order','provisional','archived'},1024),
      'assignments':({'id','slot_id','workspace_candidate_id','position','shortlist_included','sort_order','row_version','archived','presentation_notes_sha256','internal_notes_sha256','slide_wording_sha256'},512),
      'old_candidates':({'id','row_version','archived','facts_sha256','field_sources_sha256'},2),
      'old_participations':({'id','workspace_id','candidate_id','row_version','archived','selected_candidate_media_id','selected_frame_count','selected_frames_sha256','availability_sha256','internal_notes_sha256'},64),
      'old_media':({'id','candidate_id','row_version','selected_frame_count','selected_frames_sha256'},128)}
    for name,(keys,maximum)in shapes.items():
        rows(state[name],keys,maximum)
        for row in state[name]:scalars(row)
    require({row['id']for row in state['old_candidates']}==CANDIDATES)
    require(all(row['candidate_id']in CANDIDATES and row['selected_frame_count']<=3 for name in('old_participations','old_media')for row in state[name]))
    roles={r['id']:r for r in state['roles']};slots={s['id']:s for s in state['slots']}
    require(all(s['role_id']in roles for s in slots.values())and all(a['slot_id']in slots for a in state['assignments']))
    rows(state['events'],{'id','operation','resource_id','client_type','created_at','before_assignment_ids','after_assignments'})
    for event in state['events']:
        require(identifier(event['id'])and identifier(event['resource_id'])and event['operation']in OPERATIONS and event['client_type']in('browser','api','mcp'));timestamp(event['created_at'])
        before=event['before_assignment_ids'];require(isinstance(before,list)and len(before)<=100 and len(set(before))==len(before)and all(identifier(v)for v in before))
        rows(event['after_assignments'],{'id','position','row_version','archived'},100)
        for row in event['after_assignments']:scalars(row)
    exact(state['counts'],{'assignments_total','selection','shortlist','mains','archived_assignments','selection_pending_slots','shortlist_pending_slots'})
    require(all(count(v)for v in state['counts'].values()))
    active=[a for a in state['assignments']if not a['archived']]
    require(state['counts']['assignments_total']==len(state['assignments'])and state['counts']['selection']==len(active)
      and state['counts']['shortlist']==sum(a['shortlist_included']for a in active)and state['counts']['mains']==sum(a['position']=='main'for a in active)
      and state['counts']['archived_assignments']==len(state['assignments'])-len(active))
    active_slots={s['id']for s in slots.values()if not s['archived']and not roles[s['role_id']]['archived']}
    require(state['counts']['selection_pending_slots']==len(active_slots-{a['slot_id']for a in active})
      and state['counts']['shortlist_pending_slots']==len(active_slots-{a['slot_id']for a in active if a['shortlist_included']}))
    exact(state['invariants'],{'one_main_per_slot','one_active_candidate_per_slot','active_relationships_valid'});require(all(type(v)is bool for v in state['invariants'].values()))
    mains=[a['slot_id']for a in active if a['position']=='main'];relations=[(a['slot_id'],a['workspace_candidate_id'])for a in active]
    require(state['invariants']['one_main_per_slot']==(len(set(mains))==len(mains))and state['invariants']['one_active_candidate_per_slot']==(len(set(relations))==len(relations)))
    exact(state['protected_m02'],{'job_id','job_exists','job_sha256','specs_id','specs_sha256','manual_note_retained','source_inputs_count','source_inputs_sha256'})
    protected=state['protected_m02'];require(protected['job_id']=='b3f90268-147d-41d4-8875-2a6435df1496'and protected['specs_id']=='73a1a500-acfe-48cc-91ba-53a83b895118'
      and type(protected['job_exists'])is bool and type(protected['manual_note_retained'])is bool and count(protected['source_inputs_count']))
    for key in('job_sha256','specs_sha256','source_inputs_sha256'):digest(protected[key])
    return state

def sealed(relative,expected):
    file=ROOT/relative;require(file.resolve()==file and not file.is_symlink());value=file.read_bytes();require(sha(value)==expected);return value
def preservation(state,release,pins):
    facts={row['candidate_id']:row['facts_sha256']for row in pins['proof']['participations']if row['candidate_id']in CANDIDATES}
    require(set(facts)==CANDIDATES)
    current={row['id']:row for row in state['old_participations']}
    original=[row for row in pins['proof']['participations']if row['candidate_id']in CANDIDATES]
    return {'protected_m02_unchanged':state['protected_m02']==release['readback']['protected_m02'],
      'old_candidate_facts_unchanged':all(row['facts_sha256']==facts[row['id']]for row in state['old_candidates']),
      'old_project_pins_and_availability_unchanged':all(row['participation_id']in current and not current[row['participation_id']]['archived']
        and current[row['participation_id']]['workspace_id']==row['workspace_id']and current[row['participation_id']]['candidate_id']==row['candidate_id']
        and current[row['participation_id']]['selected_candidate_media_id']==row['selected_candidate_media_id']
        and current[row['participation_id']]['selected_frames_sha256']==sha(json.dumps(row['selected_frame_asset_ids'],separators=(', ',': ')).encode())
        and current[row['participation_id']]['availability_sha256']==row['availability_sha256']for row in original)}

def capture_acceptable(state,comparison):
    exact(comparison,{'protected_m02_unchanged','old_candidate_facts_unchanged','old_project_pins_and_availability_unchanged'})
    require(all(type(value)is bool for value in comparison.values()))
    return all(comparison.values())and all(state['invariants'].values())

def main(arguments=None):
    arguments=sys.argv[1:]if arguments is None else arguments;require(arguments==[])
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'unconfirmed','read_only':True,
      'mutations_requested':False,'provider_called':False,'sql':SQL,'sql_sha256':SQL_SHA,'harness_sha256':sha(Path(__file__).read_bytes()),
      'scope':'Fixed Dummy Test casting rows/events and two retained profiles across projects; hashes only for notes/facts/pins. No release comparator is used after app writes.',
      'release_baseline':RELEASE_BASELINE,'release_baseline_sha256':RELEASE_BASELINE_SHA,'pin_baseline':PIN_BASELINE,'pin_baseline_sha256':PIN_BASELINE_SHA,
      'hosting_deferred':True,'cloud_call_attempted':False}
    try:
        require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
        seals={SQL:SQL_SHA,RELEASE_BASELINE:RELEASE_BASELINE_SHA,PIN_BASELINE:PIN_BASELINE_SHA,**SEALS}
        for file,digest_value in seals.items():sealed(file,digest_value)
        manifest_bytes=(ROOT/'development/local-db/reviewed.json').read_bytes();manifest=json.loads(manifest_bytes)
        require(isinstance(manifest.get('migrations'),list)and len(manifest['migrations'])>=20)
        for row in manifest['migrations']:require(re.fullmatch('supabase/migrations/[0-9]{14}_[a-z0-9_]+\\.sql',row['path'])and row['reviewed_by']and row['reviewed_at']);sealed(row['path'],row['sha256'])
        versions=[Path(row['path']).name[:14]for row in manifest['migrations']];require(versions==sorted(set(versions))and CASTING_VERSION in versions)
        report['manifest_sha256']=sha(manifest_bytes);report['source_seals']=seals
        report['cloud_call_attempted']=True
        result=cli_call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json']);require(result.returncode==0 and len(result.stdout.encode())<=2*1024*1024)
        response=json.loads(result.stdout);require(isinstance(response,dict)and isinstance(response.get('rows'),list)and len(response['rows'])==1);exact(response['rows'][0],{'m04_app_capture'})
        state=validate(response['rows'][0]['m04_app_capture'],versions)
        for file,digest_value in seals.items():sealed(file,digest_value)
        require((ROOT/'development/local-db/reviewed.json').read_bytes()==manifest_bytes and sha(Path(__file__).read_bytes())==report['harness_sha256'])
        report['state']=state;report['preservation']=preservation(state,json.loads(sealed(RELEASE_BASELINE,RELEASE_BASELINE_SHA)),json.loads(sealed(PIN_BASELINE,PIN_BASELINE_SHA)))
        report['result']='captured'if capture_acceptable(state,report['preservation'])else'failed'
        report['sources_stable']=True
    except Exception:report['code']='M04_APP_READONLY_CAPTURE_UNCONFIRMED'
    finally:
        folder=ROOT/'tracking/evidence/m04/app-capture';folder.mkdir(parents=True,exist_ok=True)
        file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
        with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
        print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'read_only':True,'cloud_call_attempted':report['cloud_call_attempted'],'preservation':report.get('preservation')}))
    return 0 if report['result']=='captured'else 1
if __name__=='__main__':sys.exit(main())
