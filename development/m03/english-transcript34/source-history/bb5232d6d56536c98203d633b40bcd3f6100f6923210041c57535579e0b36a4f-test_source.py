"""Offline source/compiler/parser checks. Never imports a SQL runner or calls DB."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import os
import subprocess
import unittest

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('english34_compiler',HERE/'build_ports.py')
compiler=importlib.util.module_from_spec(spec)
spec.loader.exec_module(compiler)

def parse_offline(source):
 from pglast import parse_sql,parse_plpgsql
 parse_sql(source)
 # pglast has no live catalogue for named composite fields. Preserve the exact
 # SQL parse and use record stand-ins ONLY in declarations for PL/pgSQL grammar.
 # Actual composite field/type/permission proof remains the isolated DB gate.
 def declarations(match):
  body=re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\s+eps\.(?:jobs|media_assets|candidates|candidate_media|workspaces|candidate_stage_payloads|presentation_versions|presentation_video_transcripts|presentation_video_english_transcripts|candidate_uploads|candidate_asset_config|presentation_series|presentation_templates|presentation_processing_config)\b',r'\1 record',match[1])
  return 'declare'+body+'begin'
 normalized=re.sub(r'\bdeclare\b(.*?)\bbegin\b',declarations,source,flags=re.I|re.S)
 parse_plpgsql(normalized)

class English34SourceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.sql=compiler.MIGRATION.read_text(encoding='utf8')
  cls.base,cls.generated=cls.sql.split(compiler.MARKER)
  cls.block,cls.summary=compiler.compile_ports()

 def test_checked_in_ports_are_exact_compiler_output(self):
  self.assertEqual(self.generated,self.block)
  self.assertEqual(len(self.summary),8)
  self.assertEqual(sum(row['once_only_patches']for row in self.summary),15)
  self.assertEqual(json.loads((HERE/'port-patches.json').read_text())['ports'],self.summary)

 def test_every_port_keeps_all_non_body_catalogue_attributes(self):
  self.assertEqual(self.generated.count("to_jsonb(p)-'prosrc'from pg_proc"),8)
  self.assertEqual(self.generated.count('ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED'),8)
  self.assertEqual(self.generated.count('ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED'),8)
  self.assertNotIn('alter function',self.generated.lower())
  self.assertNotIn('grant ',self.generated.lower())

 def test_candidate_config_is_opt_in_and_old_jobs_omit_key(self):
  self.assertIn('add column english_transcript_version text',self.base)
  self.assertNotRegex(self.base.lower(),r'update\s+eps\.candidate_asset_config')
  self.assertIn("when config.english_transcript_version is null then '{}'::jsonb",self.generated)
  self.assertIn("candidate-extraction-stage.v2'else'candidate-extraction-stage.v1'",self.generated)
  self.assertIn("not(p_payload?'english_transcript')",self.base)
  self.assertIn("p_job.input#>>'{configuration,english_transcript_version}'is null",self.base)
  self.assertNotIn("input->'configuration'?'english_transcript_version'",self.generated)
  self.assertNotIn('eps.english_transcript_text_valid(raw_text)',self.base)
  self.assertNotIn('eps.english_transcript_text_valid(original_transcript)',self.base)

 def test_sources_assets_jobs_models_and_prompt_metadata_are_bound(self):
  for value in ["p_payload->>'source_asset_id'=p_job.input_asset_id::text",
   'p_job.input_hash=eps.candidate_job_hash(p_job.input)',
   "p_original->>'source_asset_id'=p_job.input_asset_id::text",
   "encode(sha256(convert_to(raw_text,'UTF8')),'hex')",
   "metadata->>'requested_model'=p_job.input#>>'{configuration,extraction_model}'",
   "metadata->>'task'='transcript_english'",'jsonb_array_length(item->\'metadata\')<=64',
   '5acd4200c0210c372dd280702488f1fec9094b3c2e2793aa60a83112cb2aadef',
   'dbf6ded402301f4c93af1525a981a98eca025f1776f08978758088222823f04f']:
   self.assertIn(value,self.base)

 def test_legacy_tables_and_original_media_are_never_rewritten(self):
  self.assertNotRegex(self.sql.lower(),r'(?:update|delete\s+from|truncate)\s+eps\.(?:presentation_versions|presentation_video_transcripts|candidate_media)\b')
  self.assertNotIn('drop table',self.sql.lower())
  self.assertIn('for each row execute function eps.presentation_immutable_row()',self.base)
  self.assertIn("job_id,auth.uid(),note,created_at,'1.0'",self.generated)
  self.assertIn("version.english_transcript_version='1.0'",self.generated)

 def test_reader_only_uses_frozen_companion_and_exact_video_pin(self):
  body=self.base.split('create function eps.presentation_video_english_transcript(')[1].split('end$$;')[0]
  self.assertIn('eps.presentation_version_assets',body)
  self.assertIn("asset_kind='candidate_video'",body)
  self.assertIn('eps.presentation_video_english_transcripts',body)
  self.assertNotIn('eps.candidate_media',body)
  self.assertIn("'english_status','not_captured'",body)

 def test_private_rls_authority_and_capture_match_existing_actor_scope(self):
  for value in ['force row level security','from public,anon,authenticated,service_role',
   'v.generated_by=auth.uid()','eps.presentation_scope(v.workspace_id,true)',
   't.source_media_row_version=m.row_version',
   "version.english_transcript_version is distinct from'1.0'",
   "current_setting('eps.presentation.english_transcript_capture_version',true)"]:
   self.assertIn(value,self.base)
  self.assertNotIn('create role',self.base.lower())
  self.assertNotRegex(self.base.lower(),r'grant\s+.*\s+on\s+(?:table\s+)?auth\.')
  self.assertIn('ENGLISH_TRANSCRIPT_EPS_SCHEMA_ACL_CHANGED',self.base)

 def test_database_target_is_current33_or_exact_owned_clone(self):
  for value in ["current_user<>'postgres'","current_database()<>'postgres'",
   "'^eps_english34_[a-f0-9]{32}$'",'eps.english34_test_oid',"shobj_description(oid,'pg_database')='eps-english34-owned:'",
   '20261031130207','ENGLISH_TRANSCRIPT_EXACT33_ADDITIVE_TARGET_REQUIRED']:
   self.assertIn(value,self.base)
  for name in ['test-target.sql','before34.sql','validation-tests.sql','capture-tests.sql']:
   text=(HERE/name).read_text()
   self.assertIn('ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED',text)
   self.assertIn('eps.english34_test_oid',text)
   self.assertNotRegex(text.lower(),r'\bcommit\b')

 def test_sql_and_plpgsql_parse_including_actual_patched_function_bodies(self):
  for name,source in [('migration34',self.sql)]+[(f.name,f.read_text())for f in HERE.glob('*.sql')]:
   with self.subTest(name=name):parse_offline(source)
  archive=json.loads(compiler.ARCHIVE.read_bytes())
  for port in archive['ports']:
   definition=port['definition'].replace('\r\n','\n')
   match=re.search(r'AS (\$[A-Za-z0-9_]*\$)(.*?)\1',definition,re.S)
   original=changed=match[2]
   segment=self.generated.split('-- '+port['signature']+'\n',1)[1].split('\n -- ',1)[0]
   for old,new in re.findall(r'old_text:=\$old34_\d+\$(.*?)\$old34_\d+\$;new_text:=\$new34_\d+\$(.*?)\$new34_\d+\$;',segment,re.S):
    self.assertEqual(changed.count(old),1);changed=changed.replace(old,new,1)
   expected=next(row['after_sha256']for row in self.summary if row['signature']==port['signature'])
   self.assertEqual(hashlib.sha256(changed.encode()).hexdigest(),expected)
   with self.subTest(port=port['signature']):
    patched=definition.replace(original,changed,1);parse_offline(patched)

 def test_actual_owned_controller_wire_parses_without_database_execution(self):
  program="""import{readFile}from'node:fs/promises';
import{MIGRATION34,FIXTURES34}from'./development/m03/english-transcript34/controller.mjs';
import{renderEnglish34Wire}from'./development/m03/english-transcript34/runtime.mjs';
const files=[MIGRATION34,...FIXTURES34,...['test-target.sql','before34.sql','validation-tests.sql','capture-tests.sql'].map(f=>'development/m03/english-transcript34/'+f)];
const sources=new Map(await Promise.all(files.map(async f=>[f,await readFile(f)])));
const id='12345678-1234-4234-8234-123456789abc';
process.stdout.write(renderEnglish34Wire(sources,{database:'eps_m07_r33_source_'+id.replaceAll('-',''),marker:'eps-m07-recovery33:'+id+':source',oid:12345},await readFile('development/m07/recovery33/seed-auth.sql','utf8')).body);"""
  env={key:value for key,value in os.environ.items()if key.upper()in ['PATH','SYSTEMROOT','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']}
  result=subprocess.run(['node','--input-type=module','-e',program],cwd=ROOT,env=env,capture_output=True,timeout=15)
  self.assertEqual(result.returncode,0,'OFFLINE_WIRE_RENDER_FAILED')
  self.assertLess(len(result.stdout),4*1024*1024)
  parse_offline(result.stdout.decode('utf8'))

if __name__=='__main__':unittest.main()
