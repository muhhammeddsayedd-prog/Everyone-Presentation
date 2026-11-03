"""Pure source/inverse/SQL checks; never invoke the owned controller."""
from pathlib import Path
import importlib.util
import subprocess
import unittest

HERE = Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class SourceTests(unittest.TestCase):
    def test_original_graph_no_function_installs_and_full_catalogue(self):
        p = load('stats_projection_test', HERE / 'projection.py')
        callback, proof = p.project_callback(HERE / 'unused-cases.mjs')
        self.assertTrue(proof['inverse_byte_equal'])
        self.assertNotIn('await install(', callback)
        self.assertNotIn('const install=', callback)
        self.assertNotIn("then array['prosrc']", callback)
        self.assertIn('canonical_graph_unchanged', callback)
        self.assertIn('assert.deepEqual(await value(canonicalIdentitySQL),originalCanonicalIdentity)', callback)
        self.assertEqual(callback.count('await runDiagnostic('), 1)
        self.assertNotIn('await firstWholeGenerations(', callback)

    def test_both_arms_compile_inertly_default_off_and_distinct_claims(self):
        c = load('stats_compiler_test', HERE / 'compiler.py')
        outputs = []
        for arm in ('control', 'analyzed'):
            relative = '.local/presentation-generation-planner-statistics-proof-compiled/controller-' + arm + '-00000000-0000-4000-8000-000000000001.mjs'
            source, callback, cases = c.compile_source(relative, arm)
            outputs.append(source)
            self.assertIn("assert(lockProof.EXECUTION_ENABLED,'PLANNER_STATS_EXECUTION_DISABLED')", source)
            self.assertIn('planner-statistics-proof-' + arm + '-once', source)
            self.assertIn('"statsArm": "' + arm + '"', source)
            self.assertIn("all_original_functions_unchanged", callback)
            self.assertIn('runOriginalFirst', cases)
            for text in (source, callback, cases):
                checked = subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'],
                                         input=text, text=True, capture_output=True, timeout=15)
                self.assertEqual(checked.returncode, 0, checked.stderr)
        self.assertNotEqual(outputs[0], outputs[1])
        self.assertIn('export const EXECUTION_ENABLED=false;', (HERE / 'entry.mjs').read_text())
        with self.assertRaises(ValueError):
            c.compile_source('.local/wrong.mjs', 'control')

    def test_metadata_queries_parse_and_analyze_list_is_exact(self):
        from pglast import parse_sql
        p = load('stats_sql_test', HERE / 'projection.py')
        sql = (HERE / 'observations.sql').read_text()
        parse_sql(sql)
        self.assertNotIn('most_common_vals', sql)
        self.assertNotIn('histogram_bounds', sql)
        self.assertNotIn('EXPLAIN', sql.upper())
        self.assertEqual(len(p.TABLES), 18)
        self.assertEqual(len(set(p.TABLES)), 18)
        parse_sql('analyze ' + ','.join(p.TABLES) + ';')


if __name__ == '__main__':
    unittest.main()
