import copy
import hashlib
import json
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('worker_forward', Path(__file__).with_name('worker-forward.py'))
forward = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(forward)


def observation(value=None):
    return {'metadata':[{**row,'id':f'env_{index}'} for index,row in enumerate(forward.EXPECTED)],
            'manifest_sha256':value or forward.OLD_MANIFEST}


class Fake:
    def __init__(self):
        self.state = observation(); self.calls = []; self.unknown = False
    def observe(self):
        self.calls.append('observe'); return copy.deepcopy(self.state)
    def verify_sources(self): self.calls.append('sources')
    def claim(self, value): self.calls.append('claim'); self.claimed = value
    def patch(self, identifier, body, on_return):
        self.calls.append(('patch',identifier,body)); self.state['manifest_sha256'] = body['value']
        on_return()
        if self.unknown: raise ValueError('SYNTHETIC_PRIVATE')


class Tests(unittest.TestCase):
    def test_only_public_value_changes_and_all_28_ids_survive(self):
        io = Fake(); result = forward.apply_once(io,'b'*64)
        self.assertEqual(result['result'],'passed')
        writes = [v for v in io.calls if isinstance(v,tuple)]
        self.assertEqual(len(writes),1)
        self.assertEqual(writes[0][2],{'value':'b'*64})
        self.assertLess(io.calls.index('claim'),io.calls.index(writes[0]))
        self.assertEqual(result['before']['metadata'],result['after']['metadata'])

    def test_unknown_patch_is_never_replayed_and_can_be_read_back(self):
        io=Fake(); io.unknown=True; result=forward.apply_once(io,'c'*64)
        self.assertEqual(len([v for v in io.calls if isinstance(v,tuple)]),1)
        self.assertEqual(result['dispatch_outcome'],'unconfirmed')
        self.assertTrue(result['application_verified_by_readback'])
        self.assertNotIn('SYNTHETIC_PRIVATE',str(result))

    def test_missing_baseline_or_replaced_environment_id_cannot_earn_preservation(self):
        after=observation('d'*64)
        self.assertEqual(forward.readback_result(None,after,after,'d'*64)['result'],'unconfirmed')
        before=observation(); after['metadata'][0]['id']='env_replacement'
        self.assertEqual(forward.readback_result(before,after,after,'d'*64)['result'],'unconfirmed')

    def test_metadata_strips_values_and_rejects_scope_type_and_identity_drift(self):
        rows=observation()['metadata']; raw=[{**row,'value':'SYNTHETIC_PRIVATE'} for row in rows]
        projected=forward.project_metadata({'envs':raw,'pagination':{'next':None}})
        self.assertNotIn('SYNTHETIC_PRIVATE',str(projected))
        for change in ({'target':['preview']},{'type':'plain'},{'id':'../escape'}):
            bad=copy.deepcopy(raw); index=next(i for i,row in enumerate(bad) if row['type']=='sensitive');bad[index].update(change)
            with self.assertRaises(ValueError): forward.project_metadata({'envs':bad})
        with self.assertRaises(ValueError): forward.project_metadata({'envs':raw+raw[:1]})

    def test_specific_value_readback_requires_exact_plain_key_id_and_hash(self):
        row=next(v for v in observation()['metadata'] if v['key']==forward.KEY)
        self.assertEqual(forward.project_public_value({**row,'value':forward.OLD_MANIFEST},row),forward.OLD_MANIFEST)
        for change in ({'value':'SYNTHETIC_PRIVATE'},{'key':'OPENAI_API_KEY'},{'type':'sensitive'},{'id':'different'}):
            with self.assertRaises(ValueError):forward.project_public_value({**row,'value':forward.OLD_MANIFEST,**change},row)
        wrong=observation()['metadata'];next(v for v in wrong if v['key']==forward.KEY)['visibility']='secret'
        with self.assertRaises(ValueError):forward.project_metadata({'envs':wrong})
        with self.assertRaises(ValueError):forward.project_public_value({**row,'value':forward.OLD_MANIFEST,'visibility':'secret'},row)

    def test_unstaged_plan_and_other_target_or_current_identity_refused(self):
        with self.assertRaises(ValueError):forward.validate_plan({'schema_version':'1.0','status':'awaiting_actual_stage','next':None})
        with self.assertRaises(ValueError):forward.apply_once(Fake(),forward.OLD_MANIFEST)

    def test_plan_has_closed_actual_identity_fields_and_no_path_escape(self):
        value={'schema_version':'1.0','status':'actual_staged_and_baked',
          'current':{'source_sha256':forward.OLD_SOURCE,'native_image_id':forward.OLD_IMAGE,'manifest_sha256':forward.OLD_MANIFEST},
          'admission':copy.deepcopy(forward.PROOF_REFERENCES),
          'next':{'context':'.local/worker-hosting/00000000-0000-4000-8000-000000000000/context','source_sha256':'a'*64,
            'manifest_sha256':'b'*64,'native_image_id':'sha256:'+'c'*64,'owner_sha256':'d'*64,'source_seal_sha256':'e'*64,'file_count':156}}
        self.assertEqual(forward.validate_plan(value),value)
        for key,bad in [('context','../private'),('file_count',True),('native_image_id',forward.OLD_IMAGE),('source_sha256',forward.OLD_SOURCE)]:
            wrong=copy.deepcopy(value);wrong['next'][key]=bad
            with self.assertRaises(ValueError):forward.validate_plan(wrong)
        value['next']['private']='SYNTHETIC_PRIVATE'
        with self.assertRaises(ValueError):forward.validate_plan(value)

    def test_actual_public_admission_receipts_require_success_source_isolation_and_cleanup(self):
        plan=json.loads(forward.PLAN.read_bytes());new=plan['next']
        native=json.loads((forward.ROOT/forward.PROOF_REFERENCES['native_smoke']['receipt']).read_bytes())
        daemon=json.loads((forward.ROOT/forward.PROOF_REFERENCES['daemon_import']['receipt']).read_bytes())
        forward.validate_admission(native,daemon,new)
        for key,bad in [('cleanup_confirmed',False),('lock_released',False),('source_sha256','a'*64),('private_media_used',True)]:
            changed=copy.deepcopy(native);changed[key]=bad
            with self.assertRaises(ValueError):forward.validate_admission(changed,daemon,new)
        changed=copy.deepcopy(daemon);changed['production_import_gate']['uid']=0
        with self.assertRaises(ValueError):forward.validate_admission(native,changed,new)

    def test_fresh_metadata_drift_prevents_the_only_patch(self):
        io=Fake();original=io.observe;reads=0
        def drift():
            nonlocal reads
            reads+=1;value=original()
            if reads==2:value['metadata'][0]['id']='env_replaced'
            return value
        io.observe=drift
        with self.assertRaises(ValueError):forward.apply_once(io,'d'*64)
        self.assertFalse(any(isinstance(v,tuple) for v in io.calls))

    def test_timed_out_process_cannot_earn_pass_from_matching_readbacks(self):
        io=Fake();io.process_unconfirmed=True
        self.assertEqual(forward.apply_once(io,'e'*64)['result'],'unconfirmed')

    def test_complete_public_source_inventory_rejects_private_path_before_file_reads(self):
        rows=[{'path':'apps/worker/src/runtime-main.ts','sha256':'a'*64,'bytes':1}]
        source={'files':rows,'source_sha256':hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()}
        forward.validate_source_metadata(source,source['source_sha256'],1)
        bad=[{'path':'.env','sha256':'b'*64,'bytes':1},*rows]
        source={'files':bad,'source_sha256':hashlib.sha256(json.dumps(bad,separators=(',',':')).encode()).hexdigest()}
        with self.assertRaises(ValueError):forward.validate_source_metadata(source,source['source_sha256'],2)

    def test_known_preload_target_tls_and_debug_flags_refused_case_insensitively_without_values(self):
        for key in ['npm_config_node_options','Node_Debug','NODE_DEBUG_NATIVE','supabase_debug','PGHOST','NODE_EXTRA_CA_CERTS']:
            with self.assertRaises(ValueError) as raised:forward.validate_environment({key:'SYNTHETIC_PRIVATE'})
            self.assertNotIn('SYNTHETIC_PRIVATE',str(raised.exception))
        forward.validate_environment({'UNRELATED':'allowed','NODE_OPTIONS':''})

    def test_standalone_readback_needs_claim_bound_normal_return_proof(self):
        before=observation();after=observation('e'*64)
        self.assertEqual(forward.readback_result(before,after,after,'e'*64)['result'],'unconfirmed')
        self.assertEqual(forward.readback_result(before,after,after,'e'*64,process_confirmed=True)['result'],'passed')

    def test_actual_subprocess_parent_timeout_never_invokes_normal_return_callback(self):
        io=forward.OperatorIO({}, {}, Path('SYNTHETIC_NODE.exe'));called=[]
        with patch.dict(forward.os.environ,{},clear=True),patch.object(forward.subprocess,'run',side_effect=forward.subprocess.TimeoutExpired(['synthetic'],30)):
            with self.assertRaises(forward.CommandProcessUnconfirmed):io.api('/synthetic',{'value':'e'*64},on_return=lambda:called.append(True))
        self.assertEqual(called,[])

    def test_applied_state_without_return_callback_remains_unconfirmed(self):
        io=Fake()
        def timeout(identifier,body,on_return):
            io.calls.append(('patch',identifier,body));io.state['manifest_sha256']=body['value']
            raise forward.CommandProcessUnconfirmed()
        io.patch=timeout
        self.assertEqual(forward.apply_once(io,'f'*64)['result'],'unconfirmed')

    def test_real_normal_return_callback_precedes_invalid_response_parsing(self):
        io=forward.OperatorIO({}, {}, Path('SYNTHETIC_NODE.exe'));called=[]
        result=forward.subprocess.CompletedProcess(['synthetic'],0,stdout='SYNTHETIC_INVALID_JSON',stderr='')
        with patch.dict(forward.os.environ,{},clear=True),patch.object(forward.subprocess,'run',return_value=result):
            with self.assertRaises(ValueError):io.api('/synthetic',{'value':'e'*64},on_return=lambda:called.append(True))
        self.assertEqual(called,[True])

    def test_normal_return_marker_is_closed_and_bound_to_this_claim_and_environment(self):
        value={'schema_version':'1.0','action':'worker-manifest-forward','project_id':forward.PROJECT,'team_id':forward.TEAM,
          'claim_sha256':'a'*64,'environment_id':'env_synthetic','new_manifest_sha256':'b'*64,'process_returned_at':'2026-10-31T00:00:00+00:00'}
        self.assertTrue(forward.validate_process_proof(value,'a'*64,'env_synthetic','b'*64))
        for changed in ({'claim_sha256':'c'*64},{'environment_id':'env_other'},{'private':'SYNTHETIC_PRIVATE'}):
            with self.assertRaises(ValueError):forward.validate_process_proof({**value,**changed},'a'*64,'env_synthetic','b'*64)


if __name__=='__main__': unittest.main()
