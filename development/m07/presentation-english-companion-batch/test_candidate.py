"""Actual source/DDL and syntax contracts only; no database/performance proof."""
from pathlib import Path
import importlib.util
import re
import subprocess
import unittest
from pglast import parse_plpgsql,parse_sql

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('english_batch_candidate_test',HERE/'candidate.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)


class Tests(unittest.TestCase):
    def test_exact_three_edits_inverse_definition_attributes_and_actual_parse(self):
        r=c.build();a,b=c.parts(r['before']),c.parts(r['after']);self.assertEqual(c.inverse(b[2]),a[2]);self.assertEqual(len(c.EDITS),3)
        self.assertEqual(r['before'][:a.start(2)],r['after'][:b.start(2)]);self.assertEqual(r['before'][a.end(2):],r['after'][b.end(2):])
        self.assertEqual(len(parse_plpgsql(r['before'])),1);self.assertEqual(len(parse_plpgsql(r['after'])),1)
        for bad in [a[2]+'\n',a[2].replace('for share;','for update;',1)]:
            with self.assertRaises(ValueError):c.patch_body(bad)

    def test_original_RLS_enumeration_media_locks_validation_and_suffix_exact(self):
        r=c.build();old,new=c.parts(r['before'])[2],c.parts(r['after'])[2]
        prefix=old[old.index(' for raw in '):old.index(c.OLD_INSERT)];self.assertIn(prefix,new)
        for value in ['where version_id=p_version order by video_asset_id loop','where id=raw.candidate_media_id and source_asset_id=raw.video_asset_id for share;',"media.english_transcript_status in('available','unavailable')",'media.english_transcript_source_sha256 is distinct from raw.source_sha256',"media.english_transcript_status='not_provided'and raw.status<>'not_provided'"]:
            self.assertIn(value,prefix)
        self.assertEqual(old[old.index(c.COUNT):],new[new.index(c.COUNT):])
        self.assertLess(new.index('then perform eps.fail(\'SNAPSHOT_INVALID\''),new.index(c.APPEND));self.assertLess(new.index(c.APPEND),new.index(c.INSERT))
        self.assertIn("set_config('eps.presentation.english_transcript_capture_version',coalesce(prior_context,''),true);return captured;",new)

    def test_nine_fields_four_states_null_hash_exact_pairs_empty_count_and_live_scope(self):
        insert=parse_sql(c.INSERT)[0].stmt
        self.assertEqual([x.name for x in insert.cols],['version_id','video_asset_id','candidate_media_id','source_media_row_version','status','english_text','source_sha256','english_sha256','captured_at']);self.assertEqual(len(insert.selectStmt.targetList),9)
        self.assertIn('m.english_transcript_status,m.english_transcript',c.INSERT);self.assertIn("case when m.english_transcript_status='available'then encode(sha256(convert_to(m.english_transcript,'UTF8')),'hex')end",c.INSERT)
        self.assertIn('r.version_id=p_version and r.video_asset_id=d.video_asset_id and r.candidate_media_id=d.candidate_media_id',c.INSERT);self.assertIn('m.id=d.candidate_media_id and m.source_asset_id=d.video_asset_id order by d.ordinal',c.INSERT)
        body=c.parts(c.build()['after'])[2];self.assertEqual(body.count('insert into eps.presentation_video_english_transcripts('),1)
        self.assertLess(body.index('if captured>0 then'),body.index(c.INSERT));self.assertLess(body.index('get diagnostics capture_inserted=row_count;'),body.index(c.FRESH));self.assertLess(body.index(c.FRESH),body.index('if capture_inserted<>captured'))
        self.assertNotIn('capture_text',body);self.assertNotIn('::eps.candidate_media',body)

    def test_actual_column_contract_limits_RLS_no_insert_trigger_and_owner_only_helper(self):
        text=c.METADATA.read_bytes().decode().replace('\r\n','\n')
        m=re.search(r'CREATE TABLE eps\.presentation_video_english_transcripts \(.*?\n\);',text,re.S);self.assertIsNotNone(m)
        cols=[x for x in parse_sql(m[0])[0].stmt.tableElts if type(x).__name__=='ColumnDef'];self.assertEqual([x.colname for x in cols],['version_id','video_asset_id','candidate_media_id','source_media_row_version','status','english_text','source_sha256','english_sha256','captured_at'])
        for status in ['available','not_provided','unavailable','not_captured']:self.assertIn("'"+status+"'::text",m[0])
        valid=re.search(r'CREATE FUNCTION eps\.english_transcript_text_valid\(.*?AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;',text,re.S);self.assertIn('length(p_text)between 1 and 200000',valid[2]);self.assertIn('octet_length(p_text)<=800000',valid[2])
        triggers=re.findall(r'CREATE TRIGGER [^;]*? ON eps\.presentation_video_english_transcripts\b[^;]*;',text);self.assertEqual(len(triggers),1);self.assertIn('BEFORE DELETE OR UPDATE',triggers[0]);self.assertNotIn('INSERT',triggers[0])
        self.assertIn('REVOKE ALL ON FUNCTION eps.capture_presentation_video_english_transcripts(p_version uuid) FROM PUBLIC;',text)
        self.assertIn('ALTER FUNCTION eps.capture_presentation_video_english_transcripts(p_version uuid) OWNER TO eps_review_owner;',text)

    def test_assembly_default_off_before_any_transport(self):
        self.assertIs(c.ENTRY_ENABLED,False);result=subprocess.run(['D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe','-B',str(HERE/'candidate.py')],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('ENGLISH_COMPANION_BATCH_SOURCE_UNCONFIRMED',result.stderr);self.assertEqual(result.stdout,'')


if __name__=='__main__':unittest.main()
