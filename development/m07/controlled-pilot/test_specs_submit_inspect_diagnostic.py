"""Synthetic pure projection/rendering only; no CLI/DB/provider execution."""
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('diagnostic',Path(__file__).with_name('specs-submit-inspect-diagnostic.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class DiagnosticTests(unittest.TestCase):
    def test_function_mismatch_keeps_expected_name_and_reasons_but_no_actual_values(self):
        trust={'functions':[{'name':'eps.synthetic','nargs':1}],'triggers':[]}
        value={'snapshot':{},'functions':[{'name':'eps.synthetic','nargs':1,'count':1,'language_match':True,'security_definer_match':True,'volatility_match':True,'body_match':False,'search_path_match':True}], 'unexpected_functions':0,'triggers':[],'unexpected_triggers':0}
        result=m.project(value,trust)
        self.assertEqual(result['mismatch_functions'],[{'name':'eps.synthetic','nargs':1,'reasons':['body_match']}])
        self.assertFalse(result['preflight_admissible']);self.assertNotIn('snapshot',result)
        for patch in ({'name':'eps.unknown_private'},{'count':'1'},{'raw':'SYNTHETIC_PRIVATE'}):
            with self.assertRaises(ValueError):m.project({**value,'functions':[{**value['functions'][0],**patch}]},trust)

    def test_sqlstate_and_permission_projection_discards_every_other_cli_character(self):
        result=m.safe_error('Error SQLSTATE 42501 permission denied for table specs SYNTHETIC_PRIVATE')
        self.assertEqual(result,{'sqlstate':'42501','permission_denied':True,'permission_object':'specs'})
        result=m.safe_error('Error permission denied for table synthetic_private secret=VALUE')
        self.assertIsNone(result['permission_object']);self.assertIsNone(result['sqlstate'])

    def test_rendering_is_closed_select_diagnostics_not_submission(self):
        query="with expected_functions as(select 1),actual_functions as(select 1),expected_triggers as(select 1),actual_triggers as(select 1) select jsonb_build_object('database','postgres')as specs_submit_state"
        rendered=m.render_diagnostic(query)
        self.assertTrue(rendered.startswith('begin isolation level repeatable read read only;'))
        self.assertTrue(rendered.rstrip().endswith('rollback;'))
        self.assertNotIn('eps_submit_specs(',rendered)
        self.assertNotIn('create function',rendered)
        self.assertIn("'body_match'",rendered)

if __name__=='__main__':unittest.main()
