"""Pure downloaded-byte/comparator checks; no browser, network or credentials."""
import copy, hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('m03_browser_artifacts', ROOT / 'tools/verify-m03-browser-artifacts.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)

class BrowserArtifactChecks(unittest.TestCase):
    def test_intent_is_a_unique_bounded_asset_file_list_without_other_authority(self):
        item = {'asset_id': check.FRAME_IDS[0], 'downloaded_path': r'C:\Users\synthetic\Downloads\content.jfif'}
        self.assertEqual(check.parse_intent({'files': [item]}), [item])
        for value in ({'files': []}, {'files': [item, item]}, {'files': [item], 'url': 'https://untrusted.invalid'},
                      {'files': [{**item, 'token': 'private'}]}, {'files': [{**item, 'asset_id': 'foreign'}]}):
            with self.subTest(value=value), self.assertRaises(ValueError): check.parse_intent(value)

    def test_exact_local_bytes_match_the_canonical_hash_and_size(self):
        content = b'\xff\xd8synthetic-source-jpeg\xff\xd9'
        record = {'asset_id': check.FRAME_IDS[0], 'kind': 'frame', 'mime_type': 'image/jpeg',
                  'size_bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(),
                  'width': 853, 'height': 480, 'timestamp_ms': 1720}
        result = check.compare_bytes(content, record)
        self.assertTrue(result['bytes_match_canonical'])
        self.assertFalse(result['decoded_or_visually_inspected_by_tool'])
        self.assertNotIn('bytes', result)
        self.assertNotIn('downloaded_path', result)
        for wrong in (b'', content + b'x', b'x' + content[1:]):
            with self.subTest(wrong=wrong), self.assertRaises(ValueError): check.compare_bytes(wrong, record)

    def test_hash_mismatch_does_not_disclose_unknown_file_fingerprint(self):
        content = b'private-unexpected-content'
        record = {'asset_id': check.PDF_ID, 'kind': 'support', 'mime_type': 'application/pdf',
                  'size_bytes': len(content), 'sha256': '0' * 64, 'width': None, 'height': None, 'timestamp_ms': None}
        with self.assertRaises(ValueError) as error: check.compare_bytes(content, record)
        self.assertEqual(str(error.exception), 'M03_BROWSER_ARTIFACT_UNCONFIRMED')
        self.assertNotIn(hashlib.sha256(content).hexdigest(), str(error.exception))

    def test_magic_must_match_even_if_a_fixture_has_an_internally_matching_hash(self):
        for mime in ('image/jpeg', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'):
            content = b'wrong-format'
            record = {'asset_id': check.PDF_ID, 'kind': 'support', 'mime_type': mime,
                      'size_bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(),
                      'width': None, 'height': None, 'timestamp_ms': None}
            with self.subTest(mime=mime), self.assertRaises(ValueError): check.compare_bytes(content, record)

    def test_frozen_real_metadata_contains_exactly_three_picks_and_two_ready_documents(self):
        vision = json.loads((ROOT / check.VISION_PATH).read_text())
        support = json.loads((ROOT / check.SUPPORT_PATH).read_text())
        expected = check.expected_artifacts(vision, support)
        self.assertEqual(set(expected), set(check.FRAME_IDS) | {check.PDF_ID, check.DOCX_ID})
        self.assertEqual(expected[check.FRAME_IDS[1]]['timestamp_ms'], 5160)
        self.assertEqual(expected[check.DOCX_ID]['size_bytes'], 1543)
        self.assertNotIn('original_transcript', json.dumps(expected))
        changed = copy.deepcopy(support)
        next(row for row in changed['proof']['support'] if row['asset_id'] == check.PDF_ID)['archived'] = True
        with self.assertRaises(ValueError): check.expected_artifacts(vision, changed)

    def test_old_metadata_cannot_be_relabelled_as_a_new_vision_or_different_source(self):
        vision = json.loads((ROOT / check.VISION_PATH).read_text())
        support = json.loads((ROOT / check.SUPPORT_PATH).read_text())
        for key, value in [('method', 'native'), ('source_asset_id', 'foreign')]:
            changed = copy.deepcopy(vision); changed['state']['selection'][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): check.expected_artifacts(changed, support)

    def test_local_read_is_bounded_and_reparse_or_empty_files_are_denied_before_open(self):
        with tempfile.TemporaryDirectory(prefix='eps-m03-byte-test-') as folder:
            file = Path(folder) / 'download.bin'; file.write_bytes(b'bounded bytes')
            self.assertEqual(check.read_stable_file(file, 100), b'bounded bytes')
            with self.assertRaises(ValueError): check.read_stable_file(file, 3)
            file.write_bytes(b'')
            with self.assertRaises(ValueError): check.read_stable_file(file, 100)
            file.write_bytes(b'bounded bytes')
            with patch.object(Path, 'is_symlink', return_value=True), patch.object(check.os, 'open', side_effect=AssertionError('Denied files must not be opened')):
                with self.assertRaises(ValueError): check.read_stable_file(file, 100)

    def test_only_files_within_the_two_explicit_download_roots_are_admitted(self):
        with tempfile.TemporaryDirectory(prefix='eps-m03-path-test-') as folder:
            base = Path(folder); download = base / 'Downloads'; download.mkdir()
            (base / '.local/m03-close-checks').mkdir(parents=True)
            inside = download / 'content.jfif'; inside.write_bytes(b'local')
            outside = base / 'outside.jfif'; outside.write_bytes(b'local')
            with patch.object(check, 'ROOT', base), patch.object(Path, 'home', return_value=base):
                self.assertEqual(check.downloaded_file(str(inside)), inside.resolve())
                for value in (str(outside), str(download / '..' / 'outside.jfif'), 'relative.jfif'):
                    with self.subTest(value=value), self.assertRaises(ValueError): check.downloaded_file(value)

    def test_windows_uses_explicit_birthtime_without_relaxing_size_or_modification_fences(self):
        first = SimpleNamespace(st_dev=1, st_ino=2, st_size=20, st_mtime_ns=100, st_ctime_ns=90, st_birthtime_ns=90)
        descriptor = SimpleNamespace(**{**vars(first), 'st_ctime_ns': 100})
        with patch.object(check.os, 'name', 'nt'):
            self.assertEqual(check.identity(first), check.identity(descriptor))
            descriptor.st_mtime_ns += 1
            self.assertNotEqual(check.identity(first), check.identity(descriptor))
            descriptor.st_mtime_ns -= 1; descriptor.st_size += 1
            self.assertNotEqual(check.identity(first), check.identity(descriptor))

    def test_posix_metadata_change_remains_part_of_the_identity_fence(self):
        first = SimpleNamespace(st_dev=1, st_ino=2, st_size=20, st_mtime_ns=100, st_ctime_ns=90)
        changed = SimpleNamespace(**{**vars(first), 'st_ctime_ns': 100})
        with patch.object(check.os, 'name', 'posix'):
            self.assertNotEqual(check.identity(first), check.identity(changed))

if __name__ == '__main__': unittest.main()
