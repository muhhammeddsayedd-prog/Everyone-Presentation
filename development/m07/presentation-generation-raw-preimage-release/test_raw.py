"""Real raw metadata/checkpoint relations; pure parsing and admission only."""
from pathlib import Path
import copy
import importlib.util
import json
import os
import tempfile
import unittest
from unittest.mock import patch
from pglast import scan, parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = module('raw42_state_tests', HERE / 'state.py')
r = module('raw42_phase_tests', HERE / 'release.py')


def tokens(text):
    # These two fixed before bodies are ASCII; byte offsets stay exact. Quoted
    # strings are retained, comments excluded. Literal EOL changes cannot hide.
    raw = text.encode('ascii')
    return [(token.name, raw[token.start:token.end + 1]) for token in scan(text) if token.name not in ('SQL_COMMENT', 'C_COMMENT')]


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = s.Context(root=s.MAIN, source=s.MAIN)
        cls.LF = s.parent.manifest()

    def test_exact_RAW_metadata_two_before_bodies_headers_and_unchanged_after_bytes(self):
        self.assertEqual(set(s.RAW), {'eps.presentation_lock_sources(uuid,text,text)', 'eps.review_snapshot(uuid,uuid,text)'})
        for name, row in self.c.targets.items():
            self.assertEqual(row['definition'], self.LF[name]['definition'])
            self.assertEqual(row['after_sha256'], self.LF[name]['after_sha256'])
            if name in s.RAW:
                raw, LF, count = s.RAW[name]
                self.assertEqual(s.sha(row['before_body'].encode()), raw)
                self.assertEqual(row['before_body'].count('\r\n'), count)
                self.assertEqual(row['before_body'].replace('\r\n', '\n'), self.LF[name]['before_body'])
                self.assertIn(row['before_definition'].replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION', 1), s.load(s.parent.METADATA).decode('utf8'))
                self.assertEqual(row['before_header'], self.LF[name]['definition'][:s.parts(self.LF[name]['definition']).start(2)])
                self.assertEqual(s.parts(row['before_definition'])[2], row['before_body'])
                self.assertEqual(tokens(row['before_body']), tokens(self.LF[name]['before_body']))
            else:
                self.assertEqual(row, self.LF[name])
        self.assertEqual(s.sha(self.c.definitions_sql().encode()), '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
        self.assertEqual(self.c.require_ready(), self.c.definitions_sql().encode())
        self.assertEqual(len(parse_sql(self.c.definitions_sql())), 7)
        self.assertEqual(len(parse_plpgsql(self.c.definitions_sql())), 7)
        # The lexer witness compares literal bytes too, rather than merely
        # treating all CRLF replacements as semantic whitespace.
        self.assertNotEqual(tokens("select 'a\r\nb';"), tokens("select 'a\nb';"))

    def test_actual_retained_canonical_after_checkpoint_and_fresh_read_match_raw_manifest(self):
        raw = s.load(s.MAIN / s.RETAINED_CHECKPOINT['path'])
        self.assertEqual(s.sha(raw), s.RETAINED_CHECKPOINT['sha256'])
        value = json.loads(raw)
        for name, (raw_sha, LF_sha, count) in s.RAW.items():
            rows = [row for row in value['function_rows'] if row['proname'] == name.split('(')[0].split('.')[1]]
            self.assertEqual(len(rows), 1)
            body = rows[0]['prosrc']
            self.assertEqual(s.sha(body.encode()), raw_sha)
            self.assertEqual(body, self.c.targets[name]['before_body'])
            self.assertEqual(s.sha(body.replace('\r\n', '\n').encode()), LF_sha)
            self.assertEqual(body.count('\r\n'), count)
        self.assertEqual(s.evidence()['fresh_normal_read'], s.FRESH)
        self.assertEqual(self.c.admission()['raw_preimage_binding']['retained_actual_after_checkpoint'], s.RETAINED_CHECKPOINT)

    def test_raw_equivalence_and_other_body_mutations_refuse(self):
        original = self.LF
        helper = 'eps.presentation_lock_sources(uuid,text,text)'
        altered = copy.deepcopy(original)
        altered[helper]['before_body'] += ' '
        with patch.object(s.parent, 'manifest', return_value=altered):
            with self.assertRaises(ValueError):
                s.raw_manifest()
        changed = copy.deepcopy(s.RAW)
        changed[helper] = ('f' * 64, s.RAW[helper][1], 20)
        with patch.object(s, 'RAW', changed):
            with self.assertRaises(ValueError):
                s.raw_manifest()
        fresh = json.loads(s.load(s.MAIN / s.FRESH['path']))
        for name in [helper, 'eps.review_snapshot_data(uuid,uuid,text)']:
            bad = copy.deepcopy(fresh)
            bad['functions'][name]['raw_source_sha256'] = 'f' * 64
            raw = json.dumps(bad).encode()
            load = s.load
            def changed_load(file):
                return raw if Path(file) == s.MAIN / s.FRESH['path'] else load(file)
            with patch.object(s, 'FRESH', {**s.FRESH, 'sha256': s.sha(raw)}), patch.object(s, 'load', side_effect=changed_load):
                with self.assertRaises(ValueError):
                    s.evidence()

    def test_normal_phase_global_bindings_full_checkpoint_logic_and_OFF(self):
        self.assertFalse(r.READ_ENABLED)
        self.assertFalse(r.APPLY_ENABLED)
        for method in ('query', 'prepare', 'apply', 'reconcile'):
            self.assertIs(getattr(r.Base, method).__globals__['s'], r.s)
            self.assertEqual(getattr(r.Base, method).__globals__['PURPOSE'], r.PURPOSE)
        for method in ('response_binding', 'worker', 'compare_checkpoints', 'admission'):
            self.assertIs(getattr(r.Phase, method).__globals__['s'], r.s)
            self.assertIs(getattr(r.Phase, method).__code__, getattr(r.old.Release, method).__code__)
        op = r.Release.__new__(r.Release)
        op.c = self.c
        for method in ('prepare', 'apply', 'reconcile', 'snapshot', 'admission'):
            with self.assertRaises(ValueError):
                getattr(op, method)()
        normalize = r.old.parent.old.old.disabled_release_bytes
        raw = (HERE / 'release.py').read_bytes()
        armed = raw.replace(b'READ_ENABLED=False', b'READ_ENABLED=True').replace(b'APPLY_ENABLED=False', b'APPLY_ENABLED=True')
        self.assertEqual(normalize(raw), raw)
        self.assertEqual(normalize(armed), raw)

    def test_normal_phase_loader_is_exact_guarded_parent_and_refuses_unsafe_files(self):
        self.assertIs(s.module, s.parent.module)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                s.module('directory_must_not_import', root)
            oversized = root / 'oversized.py'
            with oversized.open('wb') as stream:
                stream.truncate(s.MAXIMUM + 1)
            with self.assertRaises(ValueError):
                s.module('oversized_must_not_import', oversized)
            file, linked = root / 'unsafe.py', root / 'hardlink.py'
            file.write_text("raise AssertionError('unsafe module imported')\n", encoding='utf8')
            os.link(file, linked)
            self.assertEqual(file.stat().st_nlink, 2)
            with self.assertRaises(ValueError):
                s.module('hardlink_must_not_import', file)


if __name__ == '__main__':
    unittest.main()
