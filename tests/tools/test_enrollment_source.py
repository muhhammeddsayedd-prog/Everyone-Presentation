"""An original-reference exception must never hide key leakage or new copies."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
from check_enrollment_source import ROOT, INHERITED_REFERENCE, classify


class OriginalReferenceScanTests(unittest.TestCase):
    def setUp(self):
        self.relative = INHERITED_REFERENCE[0]
        self.content = (ROOT / self.relative).read_bytes()
        self.synthetic_pattern = b'Each card has an active toggle'
        self.assertIn(self.synthetic_pattern, self.content)

    def test_only_exact_unchanged_reference_is_preserved(self):
        self.assertEqual(classify(self.relative, self.content, [], [self.synthetic_pattern]), 'inherited_reference_contact')
        self.assertEqual(classify(self.relative, self.content + b'\nchanged', [], [self.synthetic_pattern]), 'new_identity_copy')

    def test_identical_reference_copied_elsewhere_is_not_exempt(self):
        self.assertEqual(classify('tests/new-copy.md', self.content, [], [self.synthetic_pattern]), 'new_identity_copy')

    def test_key_match_always_overrides_the_reference_exception(self):
        self.assertEqual(classify(self.relative, self.content, [self.synthetic_pattern], [self.synthetic_pattern]), 'verifier')


if __name__ == '__main__':
    unittest.main()
