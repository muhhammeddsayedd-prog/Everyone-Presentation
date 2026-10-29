"""Offline reconciliation orchestration. No provider/CLI/database calls."""
import contextlib,io,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from candidate_pipeline_historical_fixture import historical17_root, install_current19_fixture, REFRESH17, REFRESH17_SHA
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import reconcile_candidate_pipeline as reconciliation
class CandidatePipelineReconciliationTests(unittest.TestCase):
    def setUp(self):
        extras={**reconciliation.SEALS,reconciliation.FAILED:reconciliation.FAILED_SEAL,REFRESH17:REFRESH17_SHA}
        self.root=self.enterContext(historical17_root(reconciliation.release,extras))
        (self.root/'.local').mkdir()
        self.enterContext(patch.object(reconciliation.release,'ROOT',self.root))
        self.enterContext(patch.object(reconciliation,'ROOT',self.root))
        self.cli=self.enterContext(patch.object(reconciliation.release,'cli_call',side_effect=AssertionError('No live CLI in offline reconciliation tests.')))

    def test_retained_exact_inputs_and_nine_derived_booleans(self):
        _,failed,result=reconciliation.prerequisites()
        self.assertEqual(failed['result'],'failed');self.assertEqual(result['derived_boolean_count'],9)
        self.cli.assert_not_called()
    def test_current19_history_is_rejected_before_inspection(self):
        install_current19_fixture(self.root)
        with patch.object(reconciliation.release,'inspect') as inspect:
            with self.assertRaises(ValueError):reconciliation.prerequisites()
            inspect.assert_not_called()
        self.cli.assert_not_called()
    def test_historical_source_drift_is_rejected_before_inspection(self):
        source=self.root/reconciliation.release.READBACK
        source.write_bytes(source.read_bytes()+b'\n-- synthetic offline drift\n')
        with patch.object(reconciliation.release,'inspect') as inspect:
            with self.assertRaises(ValueError):reconciliation.prerequisites()
            inspect.assert_not_called()
        self.cli.assert_not_called()
    def test_changed_failed_receipt_seal_rejected_without_inspection(self):
        with patch.object(reconciliation,'FAILED_SEAL','0'*64),patch.object(reconciliation.release,'inspect') as inspect:
            with self.assertRaises(ValueError):reconciliation.prerequisites()
            inspect.assert_not_called()
    def test_readback_uses_one_inspection_and_retains_new_separate_receipt(self):
        failed=reconciliation.release.read_json(reconciliation.FAILED)
        refreshed=reconciliation.release.read_json(REFRESH17)['readback']
        with tempfile.TemporaryDirectory(dir=reconciliation.ROOT/'.local') as directory:
            with patch.object(reconciliation,'EVIDENCE',Path(directory)),patch.object(sys,'argv',['reconcile_candidate_pipeline.py','readback']),patch.object(reconciliation.release,'inspect',return_value=refreshed) as inspect,contextlib.redirect_stdout(io.StringIO()):
                reconciliation.main()
            inspect.assert_called_once_with();files=list(Path(directory).glob('*.json'));self.assertEqual(len(files),1)
            value=json.loads(files[0].read_bytes());self.assertEqual(value['result'],'passed');self.assertIs(value['application_verified_by_readback'],True)
            self.assertIs(value['cloud_write_attempted'],False);self.assertIs(value['migration_retry_attempted'],False)
            self.assertEqual(value['exact_runtime_function_operations'],11)
            self.assertIs(value['reconciliation']['fresh_whole_business_unchanged'],False)
            self.assertEqual(len(value['reconciliation']['post_release_business_drift']),4)
        self.assertEqual(reconciliation.sha((reconciliation.ROOT/reconciliation.FAILED).read_bytes()),reconciliation.FAILED_SEAL)
    def test_current_deployment_drift_is_limited_to_attested_app_tables(self):
        import copy
        failed=reconciliation.release.read_json(reconciliation.FAILED)
        fresh=reconciliation.release.read_json(REFRESH17)['readback']
        for mutate in ['jobs','catalog','runtime','third_operation']:
            current=copy.deepcopy(fresh)
            if mutate=='jobs':current['data_sha256']['eps.jobs']='0'*64
            elif mutate=='catalog':current['catalog']['functions'][0]['source_sha256']='0'*64
            elif mutate=='runtime':current['runtime']['table_authority']=True
            else:current['counts']['eps.audit_events']=failed['readback']['counts']['eps.audit_events']+3
            with self.assertRaises(ValueError):reconciliation.compare_current_deployment(failed['readback'],current)
if __name__=='__main__':unittest.main()
