"""Pure exact-source/finite-diff/parser checks; no SQL/Docker/provider execution."""
from pathlib import Path
import hashlib
import importlib.util
import re
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('generation_capture_patch', HERE / 'capture.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
BACKUP = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
BACKUP_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'


def sources():
    def need(ok):
        if not ok:
            raise AssertionError('SOURCE_UNCONFIRMED')
    need(BACKUP.is_file() and not BACKUP.is_symlink() and BACKUP.stat().st_nlink == 1 and BACKUP.stat().st_size <= 2 * 1024**2)
    raw = BACKUP.read_bytes()
    need(hashlib.sha256(raw).hexdigest() == BACKUP_SHA)
    text = raw.decode().replace('\r\n', '\n')
    result = {}
    for name, expected in [('public.eps_generate_version', c.GENERATE_SHA), ('eps.capture_presentation_video_transcripts', c.RAW_SHA)]:
        matches = list(re.finditer(r'(CREATE FUNCTION ' + re.escape(name) + r'\([^;]*? AS (\$[a-zA-Z0-9_]*\$))(.*?)\2;', text, re.S))
        need(len(matches) == 1)
        item = matches[0]
        need(c.sha(item[3]) == expected)
        result[name] = {'definition': item[0], 'prefix': item[1], 'body': item[3], 'suffix': item[2] + ';'}
    return result


class Tests(unittest.TestCase):
    def setUp(self):
        self.sources = sources()
        self.generate = self.sources['public.eps_generate_version']['body']
        self.raw = self.sources['eps.capture_presentation_video_transcripts']['body']

    def test_exact_sealed_bodies_finite_three_edits_each_and_inverse(self):
        for before, transform, inverse, edits in [(self.generate, c.patch_generate_body, c.unpatch_generate_body, c.GENERATE_EDITS), (self.raw, c.patch_raw_body, c.unpatch_raw_body, c.RAW_EDITS)]:
            after = transform(before)
            self.assertEqual(inverse(after), before)
            self.assertEqual(len(edits), 3)
            for old, new in edits:
                self.assertEqual(before.count(old), 1)
                self.assertEqual(after.count(new), 1)
            for bad in [before + '\n', before.replace('eps.fail(', 'eps.changed_fail(', 1), after]:
                with self.assertRaises(ValueError):
                    transform(bad)

    def test_signatures_attributes_and_plpgsql_syntax_unchanged(self):
        for name, transform in [('public.eps_generate_version', c.patch_generate_body), ('eps.capture_presentation_video_transcripts', c.patch_raw_body)]:
            item = self.sources[name]
            after = item['prefix'].replace('CREATE FUNCTION ', 'CREATE OR REPLACE FUNCTION ', 1) + transform(item['body']) + item['suffix']
            old_node, new_node = parse_sql(item['definition'])[0].stmt, parse_sql(after)[0].stmt
            self.assertEqual(old_node.funcname, new_node.funcname)
            self.assertEqual(old_node.parameters, new_node.parameters)
            self.assertEqual(old_node.returnType, new_node.returnType)
            self.assertEqual([x for x in old_node.options if x.defname != 'as'], [x for x in new_node.options if x.defname != 'as'])
            self.assertEqual(len(parse_plpgsql(after)), 1)

    def test_one_private_typed_asset_capture_exact_predicate_inventory_fields_and_pin_order(self):
        after = c.patch_generate_body(self.generate)
        self.assertEqual(after.count('from eps.media_assets'), 1)
        self.assertEqual(after.count(c.ASSET_PREDICATE), 1)
        self.assertEqual(after.count(c.INVENTORY_SELECT), 1)
        self.assertIn("coalesce(array_agg(a order by a.id),'{}'::eps.media_assets[])", after)
        self.assertIn('from unnest(capture_assets)a;', after)
        self.assertIn('for source in select * from unnest(capture_assets)order by id loop', after)
        self.assertIn("if jsonb_array_length(inventory)<>cardinality(assets)then", after)
        self.assertLess(after.index('into capture_assets'), after.index('into inventory'))
        self.assertLess(after.index('jsonb_array_length(inventory)'), after.index('snapshot:=jsonb_build_object'))
        self.assertNotIn('to_jsonb(source)', after)
        self.assertNotIn("'capture_assets'", after)
        self.assertEqual(after[after.index('  insert into eps.presentation_version_assets'):after.index(' end loop;', after.index('  insert into eps.presentation_version_assets'))], self.generate[self.generate.index('  insert into eps.presentation_version_assets'):self.generate.index(' end loop;', self.generate.index('  insert into eps.presentation_version_assets'))])

    def test_text_only_slide_associations_are_loaded_once_conditionally_and_zipped(self):
        after = c.patch_raw_body(self.raw)
        self.assertEqual(after.count('from eps.version_slides'), 1)
        self.assertIn("if exists(select 1 from eps.presentation_version_assets p where p.version_id=version.id and p.asset_kind='candidate_video')then", after)
        self.assertEqual(c.RAW_PRELOAD.count('order by d.ordinal,d.id'), 2)
        self.assertNotIn('::uuid', c.RAW_PRELOAD)
        self.assertIn('unnest(capture_slide_video_ids,capture_slide_media_ids)d(video_asset_id,candidate_media_id)', after)
        self.assertNotIn('cross join', c.RAW_ASSOCIATION_NEW)
        self.assertIn('where d.video_asset_id=pin.asset_id::text and d.candidate_media_id is not null', after)
        self.assertLess(after.index(c.RAW_PRELOAD), after.index('for pin in select'))
        self.assertGreater(after.index('array_agg(distinct(d.candidate_media_id)::uuid)'), after.index('for pin in select'))
        self.assertEqual(self.raw.count('::uuid'), after.count('::uuid'))

    def test_all_authority_guards_errors_writes_english_and_context_restoration_are_retained(self):
        generated = c.patch_generate_body(self.generate)
        raw = c.patch_raw_body(self.raw)
        for before, after in [(self.generate, generated), (self.raw, raw)]:
            for marker in ['perform eps.require_capability', 'eps.presentation_scope(', 'for share', 'perform eps.fail(', 'insert into eps.', 'update eps.', 'return ', 'eps.capture_presentation_video_english_transcripts', "perform set_config('eps.presentation.transcript_capture_version'"]:
                self.assertEqual(before.count(marker), after.count(marker), marker)
        start = self.raw.index('  if coalesce(cardinality(source_ids),0)<>1')
        self.assertEqual(self.raw[start:], raw[raw.index('  if coalesce(cardinality(source_ids),0)<>1'):])
        self.assertIn("order by p.asset_id loop", raw)
        self.assertIn("eps.capture_presentation_video_english_transcripts(version.id)", raw)
        self.assertIn("coalesce(prior_context,'')", raw)


if __name__ == '__main__':
    unittest.main()
