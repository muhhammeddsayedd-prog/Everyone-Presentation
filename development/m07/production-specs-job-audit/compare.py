"""Final fixed v1 immutability comparison and v2 note boolean, metadata only."""
from pathlib import Path
import datetime,importlib.util,json,os,sys,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('final_versions_existing_snapshot_projection',HERE/'snapshots.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s);a=s.a
BASELINE='tracking/evidence/m07/production-specs-job-audit/2026-11-02T03-43-50-093717Z-v1-snapshots.json'
V2='1b20ec2d-f133-4912-8efe-df2e21a3865e'
HASHES=('snapshot_sha256','manifest_sha256','inventory_sha256','version_row_jsonb_sha256','slides_jsonb_sha256','assets_jsonb_sha256')
def sql():
 literal=a.old.literal;previous=','.join(literal(v)+'::uuid'for v in s.VERSIONS);text=s.sql();needle='v.id in('+previous+')';a.need(text.count(needle)==1)
 text=text.replace(needle,'v.id in('+previous+','+literal(V2)+'::uuid)')
 needle="'internal_notes_key_in_snapshot'";a.need(text.count(needle)==1)
 return text.replace(needle,"'workflow_verification_note_present',exists(select 1 from eps.version_slides n where n.version_id=v.id and n.snapshot#>>'{fields,presentation_notes}'='Workflow verification only.'),"+needle)
def validate(value,baseline):
 a.need(len(value['versions'])==3);old={v['id']:v for v in baseline['metadata']['versions']};current={v['id']:v for v in value['versions']};a.need(set(current)==set(old)|{V2})
 subset={**value,'versions':[current[key]for key in old]};s.validate(subset)
 comparisons={key:{name:current[key][name]==before[name]for name in HASHES}for key,before in old.items()};a.need(all(all(row.values())for row in comparisons.values()))
 v=current[V2];a.need(v['series_id']==s.VERSIONS['8f1c303e-310b-473c-b217-212a65bdf245'][0]and v['version_number']==2 and v['status']=='ready'and v['output_type']=='selection'and v['page_count']==2 and v['workflow_verification_note_present']is True and v['internal_notes_key_in_snapshot']is False and v['internal_notes_key_in_manifest']is False and v['assets']['candidate_frames']==3 and v['assets']['candidate_videos']==1);a.old.identifier(v['generation_job_id'])
 a.need(all(row['candidate_is_reviewed']is True for row in value['current_assignments']))
 for slide in v['slides']:
  if slide['kind']=='candidate':a.need(len(slide['field_keys'])==10 and len(slide['frame_asset_ids'])==3 and slide['review_status']=='reviewed')
 return comparisons
def main():
 a.need(len(sys.argv)==1 and(a.MAIN/'supabase/.temp/project-ref').read_text().strip()==a.TARGET);before=(a.ROOT/BASELINE).read_bytes();baseline=json.loads(before);text=sql();import pglast;pglast.parse_sql(text)
 private=a.MAIN/'.local/production-specs-final-compare'/str(uuid.uuid4());private.mkdir(parents=True,exist_ok=False);a.need(private.resolve()==private and private.is_relative_to(a.MAIN/'.local/production-specs-final-compare'));file=private/'compare.sql';guard=a.old.s.s.b.security()
 with guard.create(file)as stream:stream.write(text.encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',a.TARGET,'--file',str(file),'--output-format','json','--workdir',str(a.MAIN)];code,timeout,overflow,out,_=a.reader.bounded(args,a.reader.environment());value=None;comparisons=None
 if code==0 and not timeout and not overflow:
  parsed=json.loads(out);rows=parsed if type(parsed)is list else parsed.get('rows');a.need(type(rows)is list and len(rows)==1 and set(rows[0])=={'production_snapshot_metadata'});value=rows[0]['production_snapshot_metadata'];comparisons=validate(value,baseline)
 receipt={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'passed'if comparisons else'unconfirmed','target':a.TARGET,'read_only_rollback':True,'automatic_retry':False,'sql_sha256':a.sha(text.encode()),'audit_source_sha256':a.sha(Path(__file__).read_bytes()),'baseline':{'path':BASELINE,'sha256':a.sha(before),'observed_at':baseline['metadata']['observed_at']},'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'all_six_hashes_per_v1_unchanged':comparisons,'metadata':value,'raw_person_facts_names_notes_snapshots_payloads_or_credentials_saved':False,'limits':['v1 equality is between stated baseline and final canonical read','known synthetic verification note is represented by a boolean only','browserPDFredownload/Poppler/all10labels proof remains separately owned by Root','no business accuracy/guest/MCP/authprotocol/AT069 closure']}
 folder=a.ROOT/'tracking/evidence/m07/production-specs-job-audit';file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-v1-v2-compare.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(a.ROOT).as_posix(),'v1_versions_compared':len(comparisons)if comparisons else None,'v2_note_and_reviewed_verified':comparisons is not None}));a.need(comparisons is not None)
if __name__=='__main__':
 try:main()
 except Exception:print('PRODUCTION_VERSION_COMPARE_UNCONFIRMED');sys.exit(1)
