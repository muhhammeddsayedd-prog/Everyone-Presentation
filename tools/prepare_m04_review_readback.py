"""Prepare a fixed metadata-only readback from reviewed public sources. No CLI."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = 'tools/sql/m04-casting-readback.sql'
ORACLE = 'tools/sql/m04-review-catalog.sql'
DELTA = 'development/m04/review-release-delta.json'
OUTPUT = 'tools/sql/m04-review-readback.sql'


def require(value):
    if not value: raise ValueError('M04_REVIEW_READBACK_PREPARATION_UNCONFIRMED')


def generate_readback(base, oracle, keys):
    require(isinstance(keys, list) and keys and len(keys) == len(set(keys)) and all(isinstance(key, str) and 0 < len(key) < 2001 and '\0' not in key for key in keys))
    start = " select jsonb_build_object(\n 'functions',"
    end = " select jsonb_build_object('name',r.rolname"
    require(base.count(start) == 1 and base.count(end) == 1)
    # The old enormous per-role effective ACL arrays are replaced by exact
    # explicit ACL/ownership/membership metadata in the new flat oracle.
    base = base[:base.index(start)] + base[base.index(end):]
    bucket_start = "  if relation.nspname='storage' and relation.relname='buckets' then"
    bucket_end = '  end if;\n'
    require(base.count(bucket_start) == 1)
    first = base.index(bucket_start); last = base.index(bucket_end, first) + len(bucket_end)
    base = base[:first] + base[last:]
    terminal = "select current_setting('eps.read_operation_release.snapshot')::jsonb as m04_casting_release;\nrollback;"
    require(base.count(terminal) == 1 and base.startswith('-- M04'))
    require(oracle.rstrip().endswith("select coalesce(jsonb_object_agg(key,value),'{}')catalog from flat;"))
    query = oracle.rstrip().replace("select coalesce(jsonb_object_agg(key,value),'{}')catalog from flat;", "select coalesce(jsonb_object_agg(key,value),'{}') into mapped from flat;")
    literal = json.dumps(sorted(keys), ensure_ascii=True, separators=(',', ':')).replace("'", "''")
    suffix = """do $compact_review_catalog$
declare mapped jsonb; protected jsonb; selected jsonb; config jsonb; template jsonb;
 excluded jsonb:='__DELTA_KEYS__'::jsonb;
begin
__ORACLE__
 select coalesce(jsonb_object_agg(key,value),'{}') into protected from jsonb_each(mapped) where not (excluded?key);
 select coalesce(jsonb_object_agg(key,value),'{}') into selected from jsonb_each(mapped) where excluded?key;
 if to_regclass('eps.review_processing_config')is not null then
  execute 'select to_jsonb(c)from eps.review_processing_config c where id' into config;
 end if;
 if to_regclass('eps.presentation_templates')is not null then
  execute $template$select to_jsonb(t)from eps.presentation_templates t where key='everyone-casting'and version='1.0.0'$template$ into template;
 end if;
 perform set_config('eps.review_release.compact_catalog',jsonb_build_object(
  'catalog_full_sha256',encode(sha256(convert_to(mapped::text,'UTF8')),'hex'),
  'catalog_protected_sha256',encode(sha256(convert_to(protected::text,'UTF8')),'hex'),
  'catalog_count',(select count(*)from jsonb_each(mapped)),
  'catalog_delta_values',selected,
  'review_state',jsonb_build_object('config',config,'template',template))::text,true);
end $compact_review_catalog$;
select (current_setting('eps.read_operation_release.snapshot')::jsonb-'catalog')
 ||current_setting('eps.review_release.compact_catalog')::jsonb as m04_review_release;
rollback;""".replace('__DELTA_KEYS__', literal).replace('__ORACLE__', query)
    result = base.replace(terminal, suffix).replace('-- M04 fixed casting release metadata readback.', '-- M04 fixed review release compact metadata readback.')
    require(result.count('begin isolation level repeatable read read only;') == 1 and result.rstrip().endswith('rollback;'))
    require(len(result.encode()) <= 512 * 1024)
    return result


def main():
    require(len(sys.argv) == 1)
    delta = json.loads((ROOT / DELTA).read_bytes())
    keys = sorted(set(delta['created']) | set(delta['changed']) | set(delta['deleted']))
    text = generate_readback((ROOT / BASE).read_text(encoding='utf8'), (ROOT / ORACLE).read_text(encoding='utf8'), keys)
    (ROOT / OUTPUT).write_text(text, encoding='utf8')
    print(json.dumps({'source_only': True, 'output': OUTPUT, 'catalog_delta_fields': len(keys)}))


if __name__ == '__main__': main()
