"""Shared exact sixth-target extension tested on both frozen caller shapes."""
from pathlib import Path
import importlib.util
import subprocess
import unittest
from pglast import parse_plpgsql

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


e=load('english_extension_test',HERE/'english.py')


class Tests(unittest.TestCase):
    def test_actual_first_and_full_callback_closed_six_mask_full_identity_install_and_inverse(self):
        for folder,file in [('presentation-generation-raw-companion-first-proof','projection.py'),('presentation-generation-pin-batch-proof','source.py')]:
            callback,_=load('english_extension_caller_'+folder.replace('-','_'),HERE.parent/folder/file).project_callback(ROOT/'.local/never-written-English-extension.mjs')
            after,proof=e.extend_callback(callback)
            self.assertEqual(len(proof['masked_signatures']),6);self.assertEqual(len(set(proof['masked_signatures'])),6);self.assertTrue(proof['inverse_byte_equal'])
            self.assertEqual(proof['masked_signatures'][-1],e.SIGNATURE)
            self.assertIn('const english=bodies===ctx.bindings.afterBodies?ctx.bindings.englishAfter:ctx.bindings.englishBefore;',after)
            self.assertIn('bodies=[...bodies,english];',after)
            self.assertIn('assert.deepEqual(actual[item.name].authority,originalBodyIdentity[item.name].authority)',after)
            self.assertIn('catalogue_prosrc_exclusions:6',after);self.assertNotIn('catalogue_prosrc_exclusions:5',after)
            inverse=after
            for a,b,count in reversed(e.edits()):self.assertEqual(inverse.count(b),count);inverse=inverse.replace(b,a)
            self.assertEqual(inverse,callback)
            result=subprocess.run(['node','--check','--input-type=module'],input=after,capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stderr)

    def test_separate_English_bindings_exact_full_definitions_and_source_seals(self):
        rows=e.english_bindings();self.assertEqual(set(rows),{'englishBefore','englishAfter'})
        for key,digest in [('before',e.BEFORE),('after',e.AFTER)]:
            row=rows['english'+key.capitalize()];self.assertEqual(row['name'],e.NAME);self.assertEqual(row['sha'],digest);self.assertEqual(row['definition_sha256'],e.sha(row['sql'].encode()));self.assertEqual(len(parse_plpgsql(row['sql'])),1)

    def test_mask_or_identity_shape_drift_refused_not_broadly_ignored(self):
        callback,_=load('english_extension_negative_source',HERE.parent/'presentation-generation-raw-companion-first-proof/projection.py').project_callback(ROOT/'.local/never-written-negative.mjs')
        first=e.edits()[0][0]
        for source in [callback+first,callback.replace(first,first[:-1]+',\'unknown\'::regprocedure)',1),callback.replace('const install=async(source,bodies=ctx.bindings.beforeBodies)','const install=async(source,bodies=[])',1)]:
            with self.assertRaises(ValueError):e.extend_callback(source)


if __name__=='__main__':unittest.main()
