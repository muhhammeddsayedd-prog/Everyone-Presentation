"""Inherited offline guards plus actual safe receipt-filename admission."""
from pathlib import Path
import importlib.util
import tempfile

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('pdf_metadata_test_projection', HERE / 'projection.py')
_projection = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_projection)
exec(compile(_projection.projected_tests(), 'pdf-metadata-inherited-fake-tests', 'exec'), globals())


class Filename(unittest.TestCase):
    def test_actual_generated_filename_passes_unchanged_closed_reference_validator(self):
        self.assertEqual(r.g.TESTED_COMMIT, p.TESTED)
        self.assertEqual(r.g.QUALITY_RECEIPT, p.QUALITY)
        self.assertEqual(r.g._projection.MIN_TESTS, 1030)
        run = '00000000-0000-4000-8000-000000000042'
        observed = '2026-11-03T13:40:41.005273+00:00'
        name = f.receipt_filename(observed, run)
        self.assertEqual(name, '2026-11-03T13-40-41.005273Z-' + run + '-canonical-preflight.json')
        self.assertEqual(observed, '2026-11-03T13:40:41.005273+00:00')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            relative = 'tracking/evidence/m07/' + p.NAMESPACE + '/' + name
            file = root / relative
            file.parent.mkdir(parents=True)
            raw = b'{"synthetic":true}'
            file.write_bytes(raw)
            ref = {'path': relative, 'sha256': p.sha(raw)}
            self.assertEqual(r.g.reference(root, ref), {'synthetic': True})
            bad = observed.replace(':', '-') + '-' + run + '-canonical-preflight.json'
            with self.assertRaises(ValueError):
                r.g.reference(root, {'path': str(Path(relative).parent / bad).replace('\\', '/'), 'sha256': p.sha(raw)})

    def test_timestamp_format_is_invertible_and_observed_at_unchanged(self):
        for observed in ('2026-11-03T13:40:41.005273+00:00', '2026-11-03T13:40:41+00:00'):
            run = '00000000-0000-4000-8000-000000000042'
            suffix = '-' + run + '-canonical-preflight.json'
            stamp = f.receipt_filename(observed, run).removesuffix(suffix)
            self.assertTrue(stamp.endswith('Z'))
            # Restore only the timestamp's fixed time separators, then UTC.
            restored = stamp[:11] + stamp[11:].replace('-', ':')
            self.assertEqual(restored.removesuffix('Z') + '+00:00', observed)
            self.assertEqual(datetime.datetime.fromisoformat(observed), datetime.datetime.fromisoformat(restored))


if __name__ == '__main__':
    unittest.main()
