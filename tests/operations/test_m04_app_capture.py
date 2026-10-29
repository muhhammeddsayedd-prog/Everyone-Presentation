"""Pure metadata privacy/consistency boundary. No CLI/DB/provider is contacted."""
import copy,importlib.util,json,sys,unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m04_app_capture',ROOT/'tools/capture-m04-app.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
ID=lambda n:'99000000-0000-4000-8000-'+str(n).zfill(12)
def fixture():
    a={'id':ID(1),'slot_id':ID(2),'workspace_candidate_id':ID(3),'position':'main','shortlist_included':False,
      'sort_order':0,'row_version':1,'archived':False,'presentation_notes_sha256':None,'internal_notes_sha256':'a'*64,'slide_wording_sha256':'b'*64}
    return {'observed_at':'2026-10-29T18:00:00Z','query_role':'postgres','database':'postgres',
      'versions':sorted([str(20261028000000+n)for n in range(19)]+[capture.CASTING_VERSION]),
      'workspace':{'id':capture.WORKSPACE,'project_id':capture.PROJECT,'row_version':2,'draft_revision':1,'has_unpublished_changes':True},
      'roles':[{'id':ID(4),'row_version':1,'headcount':1,'sort_order':0,'archived':False}],
      'slots':[{'id':ID(2),'role_id':ID(4),'row_version':1,'sort_order':0,'provisional':False,'archived':False}],
      'assignments':[a],'events':[{'id':ID(5),'operation':'set_main','resource_id':ID(2),'client_type':'browser','created_at':'2026-10-29T18:00:00Z',
        'before_assignment_ids':[ID(1)],'after_assignments':[{'id':ID(1),'position':'main','row_version':1,'archived':False}]}],
      'counts':{'assignments_total':1,'selection':1,'shortlist':0,'mains':1,'archived_assignments':0,'selection_pending_slots':0,'shortlist_pending_slots':1},
      'invariants':{'one_main_per_slot':True,'one_active_candidate_per_slot':True,'active_relationships_valid':True},
      'old_candidates':[{'id':candidate,'row_version':1,'archived':False,'facts_sha256':'c'*64,'field_sources_sha256':'d'*64}for candidate in sorted(capture.CANDIDATES)],
      'old_participations':[],'old_media':[],
      'protected_m02':{'job_id':'b3f90268-147d-41d4-8875-2a6435df1496','job_exists':True,'job_sha256':'e'*64,
        'specs_id':'73a1a500-acfe-48cc-91ba-53a83b895118','specs_sha256':'f'*64,'manual_note_retained':True,'source_inputs_count':1,'source_inputs_sha256':'a'*64}}

class AppCaptureTests(unittest.TestCase):
    def setUp(self):self.cli=self.enterContext(patch.object(capture,'cli_call',side_effect=AssertionError('Offline capture test must not reach CLI.')))
    def test_allowlisted_source_scoped_metadata_passes_without_cli(self):
        state=fixture();self.assertIs(capture.validate(state,state['versions']),state);self.cli.assert_not_called()
    def test_raw_notes_facts_credentials_auth_or_unknown_projection_fields_are_denied(self):
        for key in('presentation_notes','facts','authorization','auth_users','private_payload'):
            state=fixture();state['assignments'][0][key]='PRIVATE_SYNTHETIC_MARKER'
            with self.subTest(key=key),self.assertRaises(ValueError):capture.validate(state)
        state=fixture();state['old_candidates'][0]['facts_sha256']='PRIVATE_SYNTHETIC_MARKER'
        with self.assertRaises(ValueError):capture.validate(state)
    def test_foreign_workspace_history_duplicate_ids_and_false_counts_are_denied(self):
        for change in('workspace','history','duplicate','count','pending','parent','enum'):
            state=fixture()
            if change=='workspace':state['workspace']['id']=ID(6)
            elif change=='history':state['versions']=state['versions'][:-1]
            elif change=='duplicate':state['assignments']*=2
            elif change=='count':state['counts']['selection']=2
            elif change=='pending':state['counts']['selection_pending_slots']=1
            elif change=='parent':state['slots'][0]['role_id']=ID(6)
            else:state['events'][0]['operation']='unknown-private-operation'
            with self.subTest(change=change),self.assertRaises(ValueError):capture.validate(state)
    def test_invalid_invariant_claim_and_raw_private_event_payload_are_denied(self):
        state=fixture();state['invariants']['one_main_per_slot']=False
        with self.assertRaises(ValueError):capture.validate(state)
        state=fixture();state['events'][0]['after_assignments'][0]['internal_notes']='PRIVATE_SYNTHETIC_MARKER'
        with self.assertRaises(ValueError):capture.validate(state)
    def test_protected_facts_and_project_pins_compare_without_raw_values(self):
        state=fixture();candidate=sorted(capture.CANDIDATES)[0];pool={'id':ID(8),'workspace_id':capture.WORKSPACE,'candidate_id':candidate,
          'row_version':1,'archived':False,'selected_candidate_media_id':ID(9),'selected_frame_count':1,'selected_frames_sha256':capture.sha(json.dumps([ID(10)]).encode()),
          'availability_sha256':None,'internal_notes_sha256':None};state['old_participations']=[pool]
        baseline={'proof':{'participations':[{'candidate_id':value,'facts_sha256':'c'*64,'participation_id':ID(8)if value==candidate else ID(11),
          'workspace_id':capture.WORKSPACE,'selected_candidate_media_id':ID(9),'selected_frame_asset_ids':[ID(10)],'availability_sha256':None}for value in capture.CANDIDATES]}}
        other=copy.deepcopy(pool);other.update(id=ID(11),candidate_id=next(value for value in capture.CANDIDATES if value!=candidate));state['old_participations'].append(other)
        release={'readback':{'protected_m02':copy.deepcopy(state['protected_m02'])}}
        self.assertTrue(all(capture.preservation(state,release,baseline).values()))
        state['old_participations'][0]['selected_frames_sha256']='0'*64
        self.assertFalse(capture.preservation(state,release,baseline)['old_project_pins_and_availability_unchanged'])
    def test_no_target_force_apply_or_sql_override_arguments_are_accepted(self):
        for args in(['apply'],['--target','another'],['--sql','select private']):
            with self.assertRaises(ValueError):capture.main(args)
        self.cli.assert_not_called()
    def test_changed_old_facts_or_pins_cannot_receive_captured_acceptance(self):
        state=fixture();comparison={'protected_m02_unchanged':True,'old_candidate_facts_unchanged':True,'old_project_pins_and_availability_unchanged':True}
        self.assertTrue(capture.capture_acceptable(state,comparison))
        for flag in comparison:
            changed=copy.deepcopy(comparison);changed[flag]=False
            with self.subTest(flag=flag):self.assertFalse(capture.capture_acceptable(state,changed))
        for flag in state['invariants']:
            changed=copy.deepcopy(state);changed['invariants'][flag]=False
            with self.subTest(invariant=flag):self.assertFalse(capture.capture_acceptable(changed,comparison))
        for bad in({'protected_m02_unchanged':True},{**comparison,'old_candidate_facts_unchanged':'false'},{**comparison,'private_payload':True}):
            with self.assertRaises(ValueError):capture.capture_acceptable(state,bad)

if __name__=='__main__':unittest.main()
