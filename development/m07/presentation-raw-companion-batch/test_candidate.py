"""Source/parser contracts only. No PostgreSQL, provider or timing acceptance."""
from pathlib import Path
import importlib.util
import hashlib
import re
import subprocess
import unittest
from pglast import parse_plpgsql, parse_sql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('raw_companion_candidate_test', HERE / 'candidate.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class Tests(unittest.TestCase):
    def test_three_finite_edits_inverse_function_attributes_and_parse(self):
        r = c.build()
        before, after = c.parts(r['before']), c.parts(r['after'])
        self.assertEqual(len(c.EDITS), 3)
        self.assertEqual(c.inverse(after[2]), before[2])
        self.assertEqual(r['before'][:before.start(2)], r['after'][:after.start(2)])
        self.assertEqual(r['before'][before.end(2):], r['after'][after.end(2):])
        self.assertEqual(len(parse_plpgsql(r['before'])), 1)
        self.assertEqual(len(parse_plpgsql(r['after'])), 1)
        self.assertTrue(r['fresh_return_scope_intentionally_strengthened'])
        for body in [before[2] + '\n', before[2].replace('for share;', 'for update;', 1)]:
            with self.assertRaises(ValueError):
                c.patch_body(body)

    def test_original_order_association_locks_validation_and_English_suffix_unchanged(self):
        r = c.build()
        old, new = c.parts(r['before'])[2], c.parts(r['after'])[2]
        prefix = old[old.index(' for pin in '):old.index(c.OLD_INSERT)]
        self.assertIn(prefix, new)
        self.assertIn("order by p.asset_id loop", prefix)
        self.assertIn("array_agg(distinct(d.candidate_media_id)::uuid)", prefix)
        self.assertIn("id=source_ids[1]and source_asset_id=pin.asset_id for share;", prefix)
        self.assertIn('presentation_source_text_valid(media.original_transcript,200000)', prefix)
        self.assertIn('presentation_source_languages_valid(media.languages)', prefix)
        self.assertLess(new.index('presentation_source_text_valid('), new.index(c.ID_APPEND))
        self.assertLess(new.index(c.ID_APPEND), new.index(c.INSERT))
        self.assertEqual(old[old.index(c.COUNT_ANCHOR):], new[new.index(c.COUNT_ANCHOR):])
        self.assertEqual(new.count("capture_presentation_video_english_transcripts(version.id)"), 1)
        self.assertEqual(new.count("current_setting('eps.presentation.transcript_capture_version',true)"), 1)
        self.assertEqual(new.count("set_config('eps.presentation.transcript_capture_version',coalesce(prior_context,''),true)"), 1)

    def test_batch_exact_nine_fields_zipped_ordinal_empty_guard_and_live_scope(self):
        r = c.build()
        body = c.parts(r['after'])[2]
        insert = parse_sql(c.INSERT)[0].stmt
        self.assertEqual([x.name for x in insert.cols], ['version_id','video_asset_id','candidate_media_id','source_media_row_version','status','original_text','source_sha256','languages','captured_at'])
        self.assertEqual(len(insert.selectStmt.targetList), 9)
        self.assertIn('unnest(capture_video_ids,capture_media_ids)with ordinality', c.INSERT)
        self.assertIn('m.id=d.candidate_media_id and m.source_asset_id=d.video_asset_id order by d.ordinal', c.INSERT)
        absent = 'media.original_transcript is null or media.original_transcript!~' + c.ABSENT.split('!~', 1)[1]
        self.assertIn(absent, body)
        self.assertEqual(c.INSERT.count(c.ABSENT), 4)
        self.assertEqual(body.count('insert into eps.presentation_video_transcripts('), 1)
        self.assertLess(body.index('if captured>0 then'), body.index(c.INSERT))
        self.assertLess(body.index('get diagnostics capture_inserted=row_count;'), body.index(c.FRESH_SCOPE))
        self.assertLess(body.index(c.FRESH_SCOPE), body.index('if capture_inserted<>captured'))
        self.assertIn("capture_inserted integer:=0", body)
        self.assertNotIn('capture_text', body)
        self.assertNotIn('::eps.presentation_video_transcripts', body)

    def test_actual_table_types_and_no_insert_trigger_or_public_execute(self):
        file = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
        raw = file.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c')
        text = raw.decode()
        match = re.search(r'CREATE TABLE eps\.presentation_video_transcripts \(.*?\n\);', text, re.S)
        columns = [x for x in parse_sql(match[0])[0].stmt.tableElts if type(x).__name__ == 'ColumnDef']
        self.assertEqual([x.colname for x in columns], ['version_id','video_asset_id','candidate_media_id','source_media_row_version','status','original_text','source_sha256','languages','captured_at'])
        self.assertEqual([x.typeName.names[-1].sval for x in columns], ['uuid','uuid','uuid','int8','text','text','text','text','timestamptz'])
        triggers = re.findall(r'CREATE TRIGGER [^;]*? ON eps\.presentation_video_transcripts\b[^;]*;', text)
        self.assertEqual(len(triggers), 1)
        self.assertIn('BEFORE DELETE OR UPDATE', triggers[0])
        self.assertNotIn('INSERT', triggers[0])
        self.assertIn('REVOKE ALL ON FUNCTION eps.capture_presentation_video_transcripts(p_version uuid) FROM PUBLIC;', text)

    def test_default_off_assembly_before_any_resource_or_process(self):
        self.assertIs(c.ENTRY_ENABLED, False)
        result = subprocess.run([str(ROOT / '.venv-skills/Scripts/python.exe') if (ROOT / '.venv-skills/Scripts/python.exe').exists() else 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe', '-B', str(HERE / 'candidate.py')], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('RAW_COMPANION_BATCH_SOURCE_UNCONFIRMED', result.stderr)
        self.assertEqual(result.stdout, '')


if __name__ == '__main__':
    unittest.main()
