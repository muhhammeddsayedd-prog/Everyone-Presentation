/** Derive a new read-only snapshot; the historical M02 snapshot stays immutable. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const BASE = new URL('./sql/specs-read-operation-readback.sql', import.meta.url);
const OUTPUT = new URL('./sql/candidates-library-readback.sql', import.meta.url);
const original = await readFile(BASE, 'utf8');
assert.equal(createHash('sha256').update(original).digest('hex'), '8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f');
const old = "  execute format('select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(row_value)::text,E''\\n'' order by to_jsonb(row_value)::text),''''),''UTF8'')),''hex'') from %I.%I row_value',relation.nspname,relation.relname) into checksum;";
assert.equal(original.split(old).length, 2);
let value = original.replace('-- Fixed active12/13 catalogue/data snapshot.', '-- Fixed M03 library14/15 catalogue/data snapshot.')
  .replace('added_fields_null boolean:=true;', 'added_fields_null boolean:=true; candidate_fields_null boolean:=true; row_expression text;')
  .replace(old, `  row_expression:=case when relation.nspname='eps' and relation.relname='media_assets' then '(to_jsonb(row_value)-''source_timestamp_ms''-''duration_ms'')' else 'to_jsonb(row_value)' end;
  execute format('select encode(sha256(convert_to(coalesce(string_agg(%s::text,E''\\n'' order by %s::text),''''),''UTF8'')),''hex'') from %I.%I row_value',row_expression,row_expression,relation.nspname,relation.relname) into checksum;`)
  .replace(" perform set_config('eps.read_operation_release.snapshot'", ` if exists(select 1 from pg_attribute where attrelid='eps.media_assets'::regclass and attname='duration_ms' and not attisdropped) then
  execute 'select not exists(select 1 from eps.media_assets where duration_ms is not null or source_timestamp_ms is not null)' into candidate_fields_null;
 end if;
 perform set_config('eps.read_operation_release.snapshot'`)
  .replace("'release_additions_pristine',added_fields_null,", "'release_additions_pristine',added_fields_null,'candidate_media_extensions_pristine',candidate_fields_null,")
  .replace('as specs_read_operation_release;', 'as candidates_library_release;');
assert(value !== original);
await writeFile(OUTPUT, value, { flag: 'wx' });
