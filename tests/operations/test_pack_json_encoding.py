"""Static JSON-source encoding only; no application, SQL or provider execution."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('validate_pack_encoding', ROOT / 'tools/validate_pack.py')
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)
BOM = b'\xef\xbb\xbf'


class PackJsonEncodingTests(unittest.TestCase):
    def test_optional_bom_preserves_the_same_unicode_json_values(self):
        expected = {'text': 'مرحبا', 'values': [1, True, None]}
        encoded = json.dumps(expected, ensure_ascii=False).encode('utf-8')
        with tempfile.TemporaryDirectory() as directory:
            plain = Path(directory) / 'plain.json'
            marked = Path(directory) / 'marked.json'
            plain.write_bytes(encoded)
            marked.write_bytes(BOM + encoded)
            self.assertEqual(PACK.read_json_source(plain), expected)
            self.assertEqual(PACK.read_json_source(marked), expected)
            self.assertEqual(plain.read_bytes(), encoded)
            self.assertEqual(marked.read_bytes(), BOM + encoded)

    def test_bom_support_does_not_accept_malformed_json_or_invalid_utf8(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'invalid.json'
            for prefix in (b'', BOM):
                for content in (b'{"value":1,}', b'// comment\n{}', b'{"value":', b'{} trailing', b'{"value":"\xff"}'):
                    with self.subTest(prefix=bool(prefix), content=content):
                        path.write_bytes(prefix + content)
                        with self.assertRaises((json.JSONDecodeError, UnicodeDecodeError)):
                            PACK.read_json_source(path)

    def test_historical_windows_receipt_is_read_without_changing_its_bytes(self):
        path = ROOT / 'tracking/evidence/m06/runtime27-transition/2026-10-30-owned-runtime-quiesced.json'
        before = path.read_bytes()
        self.assertTrue(before.startswith(BOM))
        self.assertEqual(hashlib.sha256(before).hexdigest(), '2bb7e1d08dd33195c16443ebc19a4bb14f1ae9100d99582f3d27a69f10c3e2ad')
        value = PACK.read_json_source(path)
        self.assertEqual(value['result'], 'quiesced')
        self.assertEqual(value['observed_at'], '2026-10-30T01:41:09.5276624Z')
        self.assertEqual(path.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
