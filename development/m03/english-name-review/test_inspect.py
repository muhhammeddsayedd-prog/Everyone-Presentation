"""Synthetic-only source comparison regressions. No personal fixtures."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('retained_source', Path(__file__).with_name('inspect-retained-source.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RetainedSourceComparisonTests(unittest.TestCase):
    def test_arabic_canonical_spelling_differences_are_not_name_errors(self):
        result = module.comparison('أَنَا كَـريم إِياد سَامي', 'كريم اياد سامي')
        self.assertTrue(result['expected_complete_name_present_after_compaction'])
        self.assertFalse(result['source_already_differs_from_existing_owner_full_name'])

    def test_punctuation_or_joined_tokens_do_not_cause_a_false_absence(self):
        result = module.comparison('اسمي كريم،إياد-سامي.', 'كريم اياد سامي')
        self.assertEqual(result['expected_tokens_absent_after_compaction'], 0)
        self.assertTrue(result['expected_complete_name_present_after_compaction'])

    def test_changed_middle_name_cannot_be_explained_by_latin_transliteration(self):
        result = module.comparison('اسمي كريم نور سامي', 'كريم اياد سامي')
        self.assertEqual(result['expected_tokens_absent_after_compaction'], 1)
        self.assertTrue(result['source_already_differs_from_existing_owner_full_name'])
        self.assertTrue(result['unmatched_token_is_not_an_english_transliteration_artifact'])
        self.assertFalse(result['new_translation_error_determined'])

    def test_no_private_values_or_scalar_name_hashes_in_classification(self):
        result = module.comparison('كريم نور سامي', 'كريم اياد سامي')
        self.assertTrue(all(type(value) in (str, int, bool) for value in result.values()))
        self.assertNotIn('كريم', str(result))
        self.assertNotIn('نور', str(result))
        self.assertFalse(any('sha' in key for key in result))


if __name__ == '__main__':
    unittest.main()
