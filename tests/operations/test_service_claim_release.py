import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import release_service_claim as release
class ReleaseTests(unittest.TestCase):
    def test_reviewed_proof_and_migration_are_exact_local14(self):
        after=release.read_json(release.PROMOTION)['after']
        self.assertEqual(release.sha((release.ROOT/'supabase/migrations'/release.MIGRATION).read_bytes()),release.SEAL)
        self.assertEqual(release.read_json(release.PROOF)['source_seals']['candidate'],release.SEAL)
        self.assertEqual(len(after['versions']),14)
        self.assertEqual(after['counts'][release.TABLE],0)
    def test_local_expected_additions_have_private_rls_ciphertext_and_narrow_function(self):
        after=release.read_json(release.PROMOTION)['after'];added=release.additions(after['catalog'])
        self.assertEqual(len(added['relations']),1)
        self.assertTrue(added['relations'][0]['rls'] and added['relations'][0]['forced_rls'])
        self.assertEqual(len(added['functions']),1)
        self.assertFalse(added['functions'][0]['public_execute'])
        self.assertEqual({row['name'] for row in added['columns']},{'service_principal','idempotency_key','request_hash','job_id','attempt_id','key_id','encrypted_response','expires_at','created_at'})
    def test_catalog_subtraction_preserves_every_existing_row(self):
        promotion=release.read_json(release.PROMOTION)
        old=promotion['before']['catalog'];new=copy.deepcopy(promotion['after']['catalog'])
        for key,rows in new.items():new[key]=[row for row in rows if row.get('table')!=release.TABLE and row.get('name') not in (release.TABLE,release.FUNCTION)]
        self.assertEqual(old,new)
    def test_json_roundtrip_seals_remain_stable(self):
        inputs={'migration':release.SEAL,'proof':release.read_json(release.PROOF)['source_seals']}
        self.assertEqual(release.canonical(inputs),release.canonical(json.loads(json.dumps(inputs))))
if __name__=='__main__':unittest.main()
