"""Build fixed M05 metadata readback from reviewed sources. No CLI or private IO."""
import json
from pathlib import Path
import sys

from prepare_m04_review_readback import generate_readback as generate_catalog_readback

ROOT = Path(__file__).resolve().parents[1]
BASE = 'tools/sql/m04-casting-readback.sql'
ORACLE = 'tools/sql/m04-review-catalog.sql'
NEW_STATE = 'tools/sql/m05-presentation-new-state.sql'
DELTA = 'development/m05/presentation-release-delta.json'
OUTPUT = 'tools/sql/m05-presentation-readback.sql'
NEW_TABLES = ('eps.presentation_processing_config', 'eps.presentation_versions', 'eps.version_slides',
              'eps.presentation_version_assets', 'eps.presentation_asset_grants')


def require(value):
    if not value: raise ValueError('M05_PRESENTATION_READBACK_PREPARATION_UNCONFIRMED')


def generate_readback(base, oracle, new_state, keys):
    text = generate_catalog_readback(base, oracle, keys)
    table_anchor = "  where c.relkind in('r','p') and (n.nspname='eps'"
    require(text.count(table_anchor) == 1)
    names = ','.join("'" + name.removeprefix('eps.') + "'" for name in NEW_TABLES)
    text = text.replace(table_anchor, "  where c.relkind in('r','p') and not(n.nspname='eps'and c.relname in(" + names + ")) and (n.nspname='eps'", 1)
    count_anchor = "  data_counts:=data_counts||jsonb_build_object(relation.nspname||'.'||relation.relname,amount);"
    require(text.count(count_anchor) == 1)
    text = text.replace(count_anchor, """  if relation.nspname='eps'and relation.relname='presentation_templates'then
   select count(*)into amount from eps.presentation_templates where not(key='everyone-casting'and version='1.1.0');
  elsif relation.nspname='storage'and relation.relname='buckets'then
   select count(*)into amount from storage.buckets where id<>'eps-presentation-outputs';
  end if;
""" + count_anchor, 1)
    hash_anchor = "  data_hashes:=data_hashes||jsonb_build_object(relation.nspname||'.'||relation.relname,checksum);"
    require(text.count(hash_anchor) == 1)
    text = text.replace(hash_anchor, """  if relation.nspname='eps'and relation.relname='presentation_templates'then
   select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\\n'order by to_jsonb(r)::text),''),'UTF8')),'hex')into checksum
    from eps.presentation_templates r where not(r.key='everyone-casting'and r.version='1.1.0');
  elsif relation.nspname='storage'and relation.relname='buckets'then
   select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\\n'order by to_jsonb(r)::text),''),'UTF8')),'hex')into checksum
    from storage.buckets r where r.id<>'eps-presentation-outputs';
  end if;
""" + hash_anchor, 1)
    state_terminal = "select current_setting('eps.presentation_release.new_state')::jsonb as m05_state;"
    require(new_state.count(state_terminal) == 1 and new_state.rstrip().endswith(state_terminal))
    new_state_body = new_state[:new_state.index(state_terminal)]
    terminal = "select (current_setting('eps.read_operation_release.snapshot')::jsonb-'catalog')\n ||current_setting('eps.review_release.compact_catalog')::jsonb as m04_review_release;\nrollback;"
    require(text.count(terminal) == 1)
    result = text.replace(terminal, new_state_body + """select (current_setting('eps.read_operation_release.snapshot')::jsonb-'catalog')
 ||current_setting('eps.review_release.compact_catalog')::jsonb
 ||jsonb_build_object('m05_state',current_setting('eps.presentation_release.new_state')::jsonb)as m05_presentation_release;
rollback;""")
    result = result.replace('-- M04 fixed review release compact metadata readback.', '-- M05 fixed presentation release compact metadata readback.')
    require(result.count('begin isolation level repeatable read read only;') == 1 and result.rstrip().endswith('rollback;'))
    require(len(result.encode()) <= 512 * 1024)
    return result


def main():
    require(len(sys.argv) == 1)
    delta = json.loads((ROOT / DELTA).read_bytes())
    keys = sorted(set(delta['created']) | set(delta['changed']) | set(delta['deleted']))
    text = generate_readback((ROOT / BASE).read_text(encoding='utf8'), (ROOT / ORACLE).read_text(encoding='utf8'),
                            (ROOT / NEW_STATE).read_text(encoding='utf8'), keys)
    (ROOT / OUTPUT).write_text(text, encoding='utf8')
    print(json.dumps({'source_only': True, 'output': OUTPUT, 'catalog_delta_fields': len(keys)}))


if __name__ == '__main__': main()
