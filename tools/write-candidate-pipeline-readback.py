"""Generate the fixed17 metadata snapshot from the immutable16 snapshot source."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
source=(root/'tools/sql/specs-read-operation-readback.sql').read_bytes()
assert hashlib.sha256(source).hexdigest()=='8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f'
text=source.decode().replace('\r\n','\n')
anchor="  data_hashes:=data_hashes||jsonb_build_object(relation.nspname||'.'||relation.relname,checksum);"
assert text.count(anchor)==1
text=text.replace(anchor,"""  -- Compare every old field even when17 adds the safe issues column.
  if relation.nspname='eps' and relation.relname='candidate_media' then
   execute $oldmedia$select encode(sha256(convert_to(coalesce(string_agg((to_jsonb(r)-'processing_issues')::text,E'\\n' order by (to_jsonb(r)-'processing_issues')::text),''),'UTF8')),'hex') from eps.candidate_media r$oldmedia$ into checksum;
  elsif relation.nspname='storage' and relation.relname='buckets' then
   select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by to_jsonb(r)::text),''),'UTF8')),'hex') into checksum
    from storage.buckets r where r.id not in('eps-candidate-assets','eps-candidate-outputs');
  end if;
"""+anchor)
anchor="'catalog',catalogue,'counts',data_counts"
assert text.count(anchor)==1
text=text.replace(anchor,"""'candidate_buckets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id),'[]') from storage.buckets where id in('eps-candidate-assets','eps-candidate-outputs')),
  'candidate_processing_issues_pristine',not exists(select 1 from eps.candidate_media m where coalesce(to_jsonb(m)->'processing_issues','[]'::jsonb)<>'[]'::jsonb),
  'catalog',catalogue,'counts',data_counts""")
text=text.replace('as specs_read_operation_release;','as candidate_pipeline_release;')
target=root/'tools/sql/candidate-pipeline-readback.sql'
target.write_bytes(text.encode())
print(hashlib.sha256(target.read_bytes()).hexdigest())
