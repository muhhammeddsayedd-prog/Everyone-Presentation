"""Offline release preparation tests. No provider, database, auth or deploy."""
from pathlib import Path
import copy, importlib.util, json, unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('english_web34',HERE/'web.py');web=importlib.util.module_from_spec(spec);spec.loader.exec_module(web)

class WebReleaseGuards(unittest.TestCase):
 def provider(self):
  return {'id':'dpl_'+'a'*28,'name':'everyone-presentation-pilot','project':{'id':web.PROJECT},'team':{'id':web.TEAM},'readyState':'READY','url':'everyone-presentation-pilot-synthetic-muhammed-abdelrahman.vercel.app','meta':{'epsEnglishWeb34':'b'*64}}
 def test_exact_project_and_team(self):
  self.assertEqual(web.deployment(self.provider())['source_sha256'],'b'*64)
  for key,value in [('name','other'),('project',{'id':'other'}),('team',{'id':'other'}),('url','other.vercel.app')]:
   row=self.provider();row[key]=value
   with self.assertRaises(ValueError):web.deployment(row)
 def test_ready_alias_must_be_same_fresh_deployment(self):
  row=web.deployment(self.provider());self.assertEqual(web.ready_pair(row,copy.deepcopy(row)),row)
  for change in [{'id':web.OLD},{'state':'BUILDING'},{'state':'ERROR'}]:
   invalid={**row,**change}
   with self.assertRaises(ValueError):web.ready_pair(invalid,invalid)
  with self.assertRaises(ValueError):web.ready_pair(row,{**row,'id':'dpl_'+'c'*28})
 def test_deployment_url_cannot_point_at_another_project_or_query(self):
  url='https://'+self.provider()['url'];self.assertEqual(web.deployment_url(url+'\n'),url)
  for raw in ['https://another-project.vercel.app',url+'?code=synthetic',url+'\nhttps://everyone-presentation-pilot-other.vercel.app']:
   with self.assertRaises(ValueError):web.deployment_url(raw)
 def test_provider_environment_does_not_forward_debug_or_tokens(self):
  with patch.dict(web.os.environ,{'DEBUG':'synthetic','VERCEL_TOKEN':'synthetic','OPENAI_API_KEY':'synthetic','NODE_OPTIONS':'synthetic'}):
   value=web.environment(True)
   self.assertFalse({'DEBUG','VERCEL_TOKEN','OPENAI_API_KEY','NODE_OPTIONS'}&set(value));self.assertEqual(value['PATH'],'')
 def test_source_snapshot_includes_new_helper_and_excludes_private_files(self):
  rows=web.source_rows();self.assertTrue(web.REQUIRED.issubset({r['path']for r in rows}))
  self.assertTrue(all(not r['path'].startswith(('.local/','Screenshots/','redesign-output/'))for r in rows))
 def test_exact_staged_source_is_current_and_cannot_lose_helper(self):
  _,source=web.reference(web.SOURCE_RECEIPT)
  build={'result':'passed','action':'build','files':source['files'],'source_sha256':web.sha(json.dumps(source['files'],sort_keys=True,separators=(',',':')).encode())}
  folder=web.validate_stage(source,build);self.assertTrue(folder.is_dir())
  wrong=copy.deepcopy(source);wrong['files']=[r for r in wrong['files']if r['path']!='apps/web/components/english-transcript.tsx']
  with self.assertRaises(ValueError):web.validate_stage(wrong,build)
 def test_source_marker_must_be_sha256(self):
  row=self.provider();row['meta']['epsEnglishWeb34']='unsafe'
  with self.assertRaises(ValueError):web.deployment(row)

if __name__=='__main__':unittest.main()
