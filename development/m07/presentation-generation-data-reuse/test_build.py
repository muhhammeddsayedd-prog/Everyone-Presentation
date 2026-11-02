"""Four-body assembly/attributes only; no database or provider actions."""
from pathlib import Path
import importlib.util
import subprocess
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('generation_assembly', HERE / 'build.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class Tests(unittest.TestCase):
    def test_exact_four_changed_bodies_and_unchanged_every_other_attribute(self):
        definitions = b.build()
        self.assertEqual([item['name'] for item in definitions], [
            'eps.review_snapshot_data', 'eps.review_snapshot',
            'public.eps_generate_version', 'eps.capture_presentation_video_transcripts',
        ])
        for item in definitions:
            before, after = parse_sql(item['before'])[0].stmt, parse_sql(item['after'])[0].stmt
            self.assertEqual(before.funcname, after.funcname)
            self.assertEqual(before.parameters, after.parameters)
            self.assertEqual(before.returnType, after.returnType)
            self.assertEqual([v for v in before.options if v.defname != 'as'], [v for v in after.options if v.defname != 'as'])
            self.assertNotEqual(item['before_body_sha256'], item['after_body_sha256'])
            self.assertEqual(len(parse_plpgsql(item['after'])), 1)
        self.assertFalse('CREATE OR REPLACE FUNCTION eps.presentation_lock_sources' in '\n'.join(item['after'] for item in definitions))
        self.assertFalse('CREATE OR REPLACE FUNCTION eps.capture_presentation_video_english_transcripts' in '\n'.join(item['after'] for item in definitions))

    def test_disabled_cli_before_assembly_and_no_transport(self):
        result = subprocess.run([str(Path(__import__('sys').executable)), '-X', 'utf8', '-B', str(HERE / 'build.py')], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr.strip(), 'GENERATION_DATA_REUSE_ASSEMBLY_DISABLED')
        self.assertFalse(b.ENTRY_ENABLED)
        text = (HERE / 'build.py').read_text()
        for token in ['psycopg', 'subprocess', 'requests.', 'docker', 'exec_command']:
            self.assertNotIn(token, text)


if __name__ == '__main__':
    unittest.main()
