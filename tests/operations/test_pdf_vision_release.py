import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import release_pdf_vision as release
class PdfVisionReleaseTests(unittest.TestCase):
    def setUp(self):
        self.promotion=release.read_json(release.PROMOTION)
        self.expected={row['name']:row for row in self.promotion['changed_functions']}
    def test_exact_two_helpers_only_transition_passes(self):
        self.assertEqual(len(release.compare(self.promotion['before'],self.promotion['after'],self.expected)),2)
    def test_existing_data_change_is_rejected(self):
        after=copy.deepcopy(self.promotion['after']);after['counts']['eps.jobs']+=1
        with self.assertRaises(ValueError):release.compare(self.promotion['before'],after,self.expected)
    def test_permission_or_other_function_change_is_rejected(self):
        after=copy.deepcopy(self.promotion['after']);after['catalog']['functions'][0]['public_execute']=not after['catalog']['functions'][0]['public_execute']
        with self.assertRaises(ValueError):release.compare(self.promotion['before'],after,self.expected)
    def test_wrong_helper_source_hash_is_rejected(self):
        after=copy.deepcopy(self.promotion['after']);next(row for row in after['catalog']['functions'] if row['name'] in release.FUNCTIONS)['source_sha256']='0'*64
        with self.assertRaises(ValueError):release.compare(self.promotion['before'],after,self.expected)
    def test_json_roundtrip_seals_are_stable(self):
        value={'migration':release.SEAL,'proof':release.read_json(release.PROOF)['source_seals']}
        self.assertEqual(release.canonical(value),release.canonical(json.loads(json.dumps(value))))
if __name__=='__main__':unittest.main()
