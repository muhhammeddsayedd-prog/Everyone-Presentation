"""Pure metadata/source-fence tests. No credential, DB, CLI or provider call."""
import copy,importlib.util,json,subprocess,sys,unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m03_frame_vision_capture',ROOT/'tools/capture-m03-frame-vision.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
ID=lambda n:'99000000-0000-4000-8000-'+str(n).zfill(12)
VERSIONS=[str(20261028000000+n)for n in range(19)]+['20261029174841','20261029180953']

def fixture():
    frames=[]
    for n in range(12):
        frames.append({'ordinal':n+1,'frame_asset_id':ID(20+n),'source_asset_id':ID(2),'timestamp_ms':n*1700,'width':853,'height':480,'sha256':str(n%10)*64,
          'asset_sha256':str(n%10)*64,'asset_timestamp_ms':n*1700,'asset_width':853,'asset_height':480,'size_bytes':23000,'status':'ready','mime_type':'image/jpeg',
          'source_and_job_match':True,'storage_object_exists':True,'registered_in_result':True})
    old=[{'job_id':ID(100+n),'candidate_id':ID(200+n),'candidate_media_id':ID(300+n),'source_asset_id':ID(400+n),'source_sha256':'b'*64,
      'facts_sha256':'c'*64,'unarchived':True,'selected_frame_asset_ids':[ID(500+n)],'frames':[{'asset_id':ID(500+n),'sha256':'d'*64,'timestamp_ms':3000,'width':853,'height':480,'ready':True,'source_and_job_match':True}]}for n in range(9)]
    metadata={'provider':'openai','sdk_version':'7.45.1','requested_model':'gpt-6.1-sol','resolved_model':'gpt-6.1-sol-2026-10-01',
      'prompt_version':'frame_selection_vision_v1','prompt_sha256':capture.PROMPT_SHA,'schema_sha256':capture.schema_fingerprint(ID(2),frames),
      'input_sha256':'a'*64,'frame_input_sha256':capture.frame_fingerprint(frames),'response_id_sha256':'e'*64,'request_id_sha256':'f'*64,
      'usage':{'input_tokens':1000,'output_tokens':200,'total_tokens':1200}}
    state={'observed_at':'2026-10-29T19:00:00Z','query_role':'postgres','database':'postgres','versions':VERSIONS,
      'job':{'id':ID(1),'kind':'candidate_scan','workspace_id':capture.WORKSPACE,'project_id':capture.PROJECT,'status':'succeeded','stage':'apply_candidate','input_sha256':'a'*64,
        'source_asset_id':ID(2),'upload_id':ID(3),'target_candidate_id':None,'created_at':'2026-10-29T18:55:00Z','n8n_execution_id':'32000','extraction_model':'gpt-6.1-sol',
        'completed_stages':[{'stage':stage,'input_hash_matches':True}for stage in capture.STAGES],
        'outbox':[{'stage':stage,'status':'delivered','input_hash_matches':True}for stage in capture.STAGES]},
      'source':{'asset_id':ID(2),'sha256':capture.SOURCE_SHA,'size_bytes':capture.SOURCE_SIZE,'duration_ms':21880,'width':853,'height':480,'status':'ready','mime_type':'video/mp4',
        'declared_sha256':capture.SOURCE_SHA,'declared_size_bytes':capture.SOURCE_SIZE,'upload_id':ID(3),'upload_status':'completed','upload_actor_bound':True,
        'storage_object_exists':True,'storage_size_bytes':capture.SOURCE_SIZE,'private_path_bound':True},
      'preparation':{'payload_id':ID(4),'attempt_id':ID(5),'result_schema':'media-preparation.v1','input_hash_matches':True,'source_sha256':capture.SOURCE_SHA,'implementation_version':'video-preparation.v1','sampled_frames':frames},
      'selection':{'payload_id':ID(6),'attempt_id':ID(7),'result_schema':'frame-selection-stage.v1','input_hash_matches':True,'source_asset_id':ID(2),
        'method':'openai_vision','metadata':metadata,'selected_frame_asset_ids':[ID(20),ID(24),ID(28)]},
      'application':{'candidate_id':ID(8),'candidate_media_id':ID(9),'source_asset_id':ID(2),'source_job_id':ID(1),'processing_issues':[],
        'selected_frame_asset_ids':[ID(20),ID(24),ID(28)],'registered_frame_count':12,'reviewed':False,'source_kind':'scan','created_by_matches_job':True},
      'retained_profiles':old}
    return state,{'job_id':ID(1)},copy.deepcopy(old)

class FrameVisionCaptureTests(unittest.TestCase):
    def setUp(self):
        self.cli=self.enterContext(patch.object(capture,'cli_call',side_effect=AssertionError('Offline tests must never reach the real CLI.')))
        self.files=self.enterContext(patch.object(capture,'checked_path',side_effect=AssertionError('Pure tests must not read private paths.')))
    def tearDown(self):self.cli.assert_not_called();self.files.assert_not_called()
    def test_source_bound_vision_metadata_passes_and_unknown_usage_stays_null(self):
        state,intent,old=fixture();self.assertIs(capture.validate(state,intent,old,VERSIONS),state)
        state['selection']['metadata']['usage']=None;self.assertIs(capture.validate(state,intent,old,VERSIONS),state)
        state['job']['outbox'].append(copy.deepcopy(state['job']['outbox'][3]));self.assertIs(capture.validate(state,intent,old,VERSIONS),state)
    def test_intent_accepts_only_one_uuid_not_sql_target_or_file(self):
        self.assertEqual(capture.parse_intent({'job_id':ID(1)}),{'job_id':ID(1)})
        for value in({'job_id':ID(1),'target':'foreign'},{'job_id':ID(1),'sql':'select 1'}, {'job_id':ID(1),'file':'foreign.sql'}, {'job_id':'ABC00000-0000-4000-8000-000000000001'}, {'job_id':"';delete from eps.jobs;--"},None,[]):
            with self.subTest(value=value),self.assertRaises(ValueError):capture.parse_intent(value)
    def test_unknown_personal_payloads_or_raw_provider_reasons_never_pass_projection(self):
        for location,key in(('top','facts'),('job','authorization'),('source','filename'),('preparation','transcript'),('selection','selected_reasons'),('metadata','response_id'),('application','facts')):
            state,intent,old=fixture();row=state if location=='top'else state['selection']['metadata']if location=='metadata'else state[location];row[key]='SYNTHETIC_PRIVATE_MARKER'
            with self.subTest(location=location,key=key),self.assertRaises(ValueError):capture.validate(state,intent,old,VERSIONS)
    def test_wrong_job_workspace_target_source_or_history_is_rejected(self):
        for change in('job','workspace','project','target','source_sha','declared_sha','source_size','native_sha','history','kind','incomplete'):
            state,intent,old=fixture()
            if change=='job':state['job']['id']=ID(99)
            elif change=='workspace':state['job']['workspace_id']=ID(99)
            elif change=='project':state['job']['project_id']=ID(99)
            elif change=='target':state['job']['target_candidate_id']=old[0]['candidate_id']
            elif change=='source_sha':state['source']['sha256']='b'*64
            elif change=='declared_sha':state['source']['declared_sha256']=None
            elif change=='source_size':state['source']['storage_size_bytes']-=1
            elif change=='native_sha':state['preparation']['source_sha256']='b'*64
            elif change=='history':state['versions']=VERSIONS[:-1]
            elif change=='kind':state['job']['kind']='frame_extract'
            else:state['job']['completed_stages']=state['job']['completed_stages'][:-1]
            with self.subTest(change=change),self.assertRaises(ValueError):capture.validate(state,intent,old,VERSIONS)
    def test_legacy_manual_false_ai_and_malformed_provider_metadata_are_rejected(self):
        for change in('legacy','manual','provider','model','prompt','input','pool','schema','response','usage','unknown_usage','extra_usage','negative_usage'):
            state,intent,old=fixture();meta=state['selection']['metadata']
            if change=='legacy':state['selection']['method']=None
            elif change=='manual':state['selection']['method']='manual_required';state['selection']['metadata']=None
            elif change=='provider':meta['provider']='native'
            elif change=='model':meta['requested_model']='foreign-model'
            elif change=='prompt':meta['prompt_sha256']='b'*64
            elif change=='input':meta['input_sha256']='b'*64
            elif change=='pool':meta['frame_input_sha256']='b'*64
            elif change=='schema':meta['schema_sha256']='b'*64
            elif change=='response':meta['response_id_sha256']=None
            elif change=='usage':meta['usage']['total_tokens']+=1
            elif change=='unknown_usage':meta['usage']={}
            elif change=='extra_usage':meta['usage']['private_diagnostics']='SYNTHETIC_PRIVATE_MARKER'
            else:meta['usage']['input_tokens']=-1
            with self.subTest(change=change),self.assertRaises(ValueError):capture.validate(state,intent,old,VERSIONS)
    def test_prepared_and_canonical_frame_pool_cannot_be_swapped_invented_or_reordered(self):
        for change in('missing','duplicate','foreign','sha','pts','geometry','not_ready','not_stored','not_registered','reorder'):
            state,intent,old=fixture();frames=state['preparation']['sampled_frames'];frame=frames[0]
            if change=='missing':frames.pop()
            elif change=='duplicate':frames[1]=copy.deepcopy(frame)
            elif change=='foreign':frame['source_asset_id']=ID(99)
            elif change=='sha':frame['asset_sha256']='b'*64
            elif change=='pts':frame['asset_timestamp_ms']+=1
            elif change=='geometry':frame['asset_width']+=1
            elif change=='not_ready':frame['status']='uploading'
            elif change=='not_stored':frame['storage_object_exists']=False
            elif change=='not_registered':frame['registered_in_result']=False
            else:frames.reverse()
            with self.subTest(change=change),self.assertRaises(ValueError):capture.validate(state,intent,old,VERSIONS)
    def test_selected_ids_application_issues_and_preserved_nine_profiles_are_consistent(self):
        for change in('invented','duplicate','order','failure_issue','missing_profile','old_facts','old_frame','new_is_old','reviewed','outbox'):
            state,intent,old=fixture()
            if change=='invented':state['selection']['selected_frame_asset_ids'][0]=ID(99)
            elif change=='duplicate':state['selection']['selected_frame_asset_ids'][1]=state['selection']['selected_frame_asset_ids'][0]
            elif change=='order':state['application']['selected_frame_asset_ids'].reverse()
            elif change=='failure_issue':state['application']['processing_issues']=['FRAME_SELECTION_UNAVAILABLE']
            elif change=='missing_profile':state['retained_profiles'].pop()
            elif change=='old_facts':state['retained_profiles'][0]['facts_sha256']='e'*64
            elif change=='old_frame':state['retained_profiles'][0]['frames'][0]['sha256']='e'*64
            elif change=='new_is_old':state['application']['candidate_id']=old[0]['candidate_id']
            elif change=='reviewed':state['application']['reviewed']=True
            else:state['job']['outbox'][0]['status']='pending'
            with self.subTest(change=change),self.assertRaises(ValueError):capture.validate(state,intent,old,VERSIONS)
    def test_fewer_real_vision_picks_are_not_provider_failure(self):
        state,intent,old=fixture();state['selection']['selected_frame_asset_ids']=[];state['application']['selected_frame_asset_ids']=[];state['application']['processing_issues']=['INSUFFICIENT_FRAMES']
        self.assertIs(capture.validate(state,intent,old,VERSIONS),state)
        state['application']['processing_issues']=[]
        with self.assertRaises(ValueError):capture.validate(state,intent,old,VERSIONS)
    def test_fixed_sql_template_has_one_uuid_substitution_and_only_readonly_statements(self):
        from pglast import parse_sql
        template=(ROOT/capture.SQL).read_text(encoding='utf8');query=capture.build_sql(template,{'job_id':ID(1)})
        self.assertNotIn('__M03_VISION_JOB_UUID__',query);self.assertEqual(query.count(ID(1)),1)
        self.assertIn('begin isolation level repeatable read read only;',query)
        kinds=[type(statement.stmt).__name__ for statement in parse_sql(query)]
        self.assertEqual(kinds,['TransactionStmt','VariableSetStmt','VariableSetStmt','VariableSetStmt','DoStmt','SelectStmt','TransactionStmt'])
        self.assertTrue(query.rstrip().endswith('rollback;'))
        for forbidden in('auth.users','auth.sessions','original_transcript','confirmation_note','selected_reasons','image_url'):
            self.assertNotIn(forbidden,query)
        for value in('',template+template):
            with self.assertRaises(ValueError):capture.build_sql(value,{'job_id':ID(1)})
        with self.assertRaises(ValueError):capture.main(['--target','unreviewed'])
    def test_pinned_public_metadata_baseline_covers_exactly_nine_profiles_and_108_real_frame_hashes(self):
        batch_bytes=(ROOT/capture.BATCH).read_bytes();baseline_bytes=(ROOT/capture.BASELINE).read_bytes()
        self.assertEqual(capture.sha(batch_bytes),capture.BATCH_SHA);self.assertEqual(capture.sha(baseline_bytes),capture.BASELINE_SHA)
        old=capture.expected_profiles(json.loads(batch_bytes),json.loads(baseline_bytes));self.assertEqual(len(old),9);self.assertEqual(sum(len(row['frames'])for row in old),108)
        template=(ROOT/capture.SQL).read_bytes();self.assertEqual(capture.sha(template),capture.SQL_SHA)
        for row in old:self.assertEqual(template.decode().count(row['job_id']),1)
        history=json.loads((ROOT/'development/m03/frame-vision-source-history/manifest.json').read_bytes())
        self.assertEqual(history['source_commit'],'fe90400e7bab0e0c43038d2baebf6e1e96d95568')
        archived={row['source']:row for row in history['files']}
        self.assertEqual(set(archived),{'apps/worker/src/n8n-orchestrator.ts','apps/worker/src/runtime-types.ts'})
        for file,digest in capture.SEALS.items():
            artifact=archived[file]['artifact'] if file in archived else file
            self.assertEqual(capture.sha((ROOT/artifact).read_bytes()),digest,file)
            if file in archived:
                self.assertEqual(archived[file]['sha256'],digest)
                # Later review routing is legitimate, but the old observer must
                # continue denying current changed code rather than reseal it.
                self.assertNotEqual(capture.sha((ROOT/file).read_bytes()),digest)
                with patch.object(capture,'checked_path',return_value=ROOT/file):
                    with self.assertRaises(ValueError):capture.sealed(file,digest)
    def test_python_fingerprint_and_schema_match_actual_typescript_adapter_without_provider(self):
        state,_,_=fixture();frames=state['preparation']['sampled_frames']
        script="""import {selectVisionFrames} from './packages/integrations/src/openai-frames.ts';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';
const raw=JSON.parse(readFileSync(0,'utf8'));const bytes=Uint8Array.of(255,216,255);
const frames=raw.map(({frame_asset_id,source_asset_id,timestamp_ms,width,height})=>({frame_asset_id,source_asset_id,timestamp_ms,width,height,sha256:createHash('sha256').update(bytes).digest('hex'),bytes}));
let called=0;const output=await selectVisionFrames({source_asset_id:frames[0].source_asset_id,input_hash:'a'.repeat(64),frames},{apiKey:'synthetic-private-test-key',model:'gpt-6.1-sol'},undefined,async()=>{called++;return {id:'synthetic-response',model:'gpt-6.1-sol',status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({schema_version:'1.0',source_asset_id:frames[0].source_asset_id,selected_frames:[],insufficient_frames_reason:'Fewer than three clear, distinct source frames are available.'})}]}]};});
process.stdout.write(JSON.stringify({called,frame_input_sha256:output.metadata.frame_input_sha256,schema_sha256:output.metadata.schema_sha256,frame_sha256:frames[0].sha256}));"""
        completed=subprocess.run(['node','--import','tsx','--input-type=module','--eval',script],cwd=ROOT,input=json.dumps(frames),capture_output=True,text=True,encoding='utf8',timeout=15)
        self.assertEqual(completed.returncode,0,'The offline adapter contract probe failed; raw diagnostics are suppressed.')
        result=json.loads(completed.stdout);self.assertEqual(result['called'],1)
        for frame in frames:frame['sha256']=result['frame_sha256']
        self.assertEqual(capture.frame_fingerprint(frames),result['frame_input_sha256'])
        self.assertEqual(capture.schema_fingerprint(ID(2),frames),result['schema_sha256'])

if __name__=='__main__':unittest.main()
