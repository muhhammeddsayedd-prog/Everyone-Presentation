import copy, json, pathlib, sys, unittest
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import reconcile_candidate_library as reconcile
import release_candidate_library as release

class ManagedStorageReconcileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.applied = release.read_json(reconcile.APPLY); cls.expected = release.read_json(release.PROMOTION)['after']
    def test_actual_failed_apply_exact_eleven_inherited_columns_reconciles(self):
        self.assertEqual(len(reconcile.compare_retained(self.applied['before'], self.applied['readback'], self.expected)), 11)
    def test_an_extra_column_with_changed_privilege_is_rejected(self):
        changed = copy.deepcopy(self.applied['readback'])
        next(row for row in changed['catalog']['column_acls'] if row['table'] == 'storage.objects' and row['column'] == 'version' and row['role'] == 'eps_cast_owner')['references'] = True
        with self.assertRaises(ValueError): reconcile.compare_retained(self.applied['before'], changed, self.expected)
    def test_missing_restrictive_storage_policy_is_rejected(self):
        changed = copy.deepcopy(self.applied['readback'])
        changed['catalog']['policies'] = [row for row in changed['catalog']['policies'] if row['name'] != 'eps_cast_no_objects']
        with self.assertRaises(ValueError): reconcile.compare_retained(self.applied['before'], changed, self.expected)
    def test_other_business_change_cannot_be_excused_as_storage_catalog_difference(self):
        changed = copy.deepcopy(self.applied['readback']); changed['data_sha256']['eps.specs'] = 'changed'
        with self.assertRaises(ValueError): reconcile.compare_retained(self.applied['before'], changed, self.expected)
if __name__ == '__main__': unittest.main()
