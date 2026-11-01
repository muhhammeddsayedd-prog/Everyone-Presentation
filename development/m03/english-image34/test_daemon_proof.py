from pathlib import Path
import importlib.util,unittest
spec=importlib.util.spec_from_file_location('daemon_proof_test',Path(__file__).with_name('daemon-proof.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Guards(unittest.TestCase):
 def test_exact_ready_runtime_under_private_project(self):
  row={'repositoryId':'repo_Test','manifestDigest':'sha256:'+'a'*64,'kind':'manifest','status':'ready','arch':'amd64','platform':'linux'}
  self.assertEqual(module.ready_row({'images':[row]},'repo_Test',row['manifestDigest'])['status'],'ready')
  for key,value in [('repositoryId','other'),('status','preparing'),('arch','arm64'),('platform','windows'),('kind','attestation')]:
   with self.assertRaises(ValueError):module.ready_row({'images':[{**row,key:value}]},'repo_Test',row['manifestDigest'])
 def test_duplicate_or_missing_runtime_fails(self):
  with self.assertRaises(ValueError):module.ready_row({'images':[]},'repo_Test','sha256:'+'a'*64)
if __name__=='__main__':unittest.main()
