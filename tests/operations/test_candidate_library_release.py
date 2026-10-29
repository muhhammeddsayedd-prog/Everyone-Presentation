"""Offline actual-local-catalog regression; no CLI or cloud calls."""
import copy, importlib.util, json, pathlib, sys, unittest
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import release_candidate_library as release

class LibraryReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proof = json.loads((ROOT / release.PROMOTION).read_bytes())
    def test_actual_local_catalog_and_data_pass(self):
        release.compare(self.proof['before'], self.proof['after'], self.proof['after'])
    def test_current_preflight_refuses_later_history_without_weakening_historical_release(self):
        manifest = release.read_json('development/local-db/reviewed.json')
        if len(manifest['migrations']) == 15 and manifest['migrations'][-1]['path'].endswith(release.MIGRATION):
            release.prerequisites()
        else:
            with self.assertRaises(ValueError): release.prerequisites()
    def test_changed_business_row_is_rejected(self):
        changed = copy.deepcopy(self.proof['after']); changed['data_sha256']['public.projects'] = 'changed'
        with self.assertRaises(ValueError): release.compare(self.proof['before'], changed, self.proof['after'])
    def test_old_function_drift_is_rejected(self):
        changed = copy.deepcopy(self.proof['after'])
        next(row for row in changed['catalog']['functions'] if row['name'] == 'public.eps_get_project')['source_sha256'] = 'changed'
        with self.assertRaises(ValueError): release.compare(self.proof['before'], changed, self.proof['after'])
    def test_added_public_private_helper_execute_is_rejected(self):
        changed = copy.deepcopy(self.proof['after'])
        next(row for row in changed['catalog']['functions'] if row['name'] == 'eps.cast_mutate')['public_execute'] = True
        with self.assertRaises(ValueError): release.compare(self.proof['before'], changed, self.proof['after'])
    def test_added_role_bypass_is_rejected(self):
        changed = copy.deepcopy(self.proof['after'])
        next(row for row in changed['catalog']['roles'] if row['name'] == 'eps_cast_owner')['bypass_rls'] = True
        with self.assertRaises(ValueError): release.compare(self.proof['before'], changed, self.proof['after'])
    def test_new_tables_must_be_empty_and_new_columns_null(self):
        for key in release.TABLES:
            changed = copy.deepcopy(self.proof['after']); changed['counts'][key] = 1
            with self.assertRaises(ValueError): release.compare(self.proof['before'], changed, self.proof['after'])
        changed = copy.deepcopy(self.proof['after']); changed['candidate_media_extensions_pristine'] = False
        with self.assertRaises(ValueError): release.compare(self.proof['before'], changed, self.proof['after'])
if __name__ == '__main__': unittest.main()
