"""Root-run read-only observer for four explicitly uploaded synthetic attachments."""
import datetime,hashlib,json,re,sys,uuid
from release_foundation import ROOT,TARGET,call

SQL='tools/sql/m03-support-live-readback.sql'
BASELINE='tracking/evidence/m03/remaining-live-capture/2026-10-29T15-09-11-841107+00-00-24983a6c.json'
BASELINE_SHA='42487b2e46a73676d539c38bf110daea178cfa09a50e059518e9652d26ebf18c'
CANDIDATE='b7341092-50c4-49b4-ad5f-a0ceedddebf1'
WORKSPACE='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
EXPECTED={
 '092572d3-64ac-4bb5-bfe9-cb39830b850b':('application/pdf',1827,'fixtures/live-specs-files/synthetic-casting-english.pdf'),
 '17ffa630-be3d-4be7-a03e-a5f3a6d132f8':('application/vnd.openxmlformats-officedocument.wordprocessingml.document',1543,'fixtures/live-specs-files/synthetic-casting-mixed.docx'),
 '59a586ac-d53a-4ede-8711-70195732b300':('image/png',1286,'.local/m03-live-evidence/continuation/support-reference.png'),
 '82bec606-9aa6-49c8-9c14-20463b8f5eb4':('text/plain',110,'.local/m03-live-evidence/continuation/support-reference.txt')}
UUID=re.compile(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')
def require(value):
 if not value:raise ValueError('M03_SUPPORT_METADATA_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def main():
 require(sys.argv[1:]==[] and (ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 baseline_bytes=(ROOT/BASELINE).read_bytes();require(sha(baseline_bytes)==BASELINE_SHA)
 baseline=json.loads(baseline_bytes);require(baseline['result']=='captured')
 facts=next(v['facts_sha256']for v in baseline['proof']['participations']if v['candidate_id']==CANDIDATE and v['workspace_id']==WORKSPACE)
 expected={}
 for asset,(mime,size,file)in EXPECTED.items():
  data=(ROOT/file).read_bytes();require(len(data)==size);expected[asset]=(mime,size,sha(data))
 report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'failed','read_only':True,
  'sql_sha256':sha((ROOT/SQL).read_bytes()),'harness_sha256':sha((ROOT/'tools/capture-m03-support-live.py').read_bytes()),
  'baseline':BASELINE,'baseline_sha256':BASELINE_SHA,'cloud_called':False,'provider_called':False,'mutations_requested':False,'private_text_recorded':False}
 try:
  report['cloud_called']=True;response=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
  require(response.returncode==0 and len(response.stdout.encode())<=65536)
  rows=json.loads(response.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'support_live'});proof=rows[0]['support_live']
  require(set(proof)=={'query_role','database','candidate_id','facts_sha256','reviewed','candidate_rows_sha256','jobs_count','support'})
  require(proof['query_role']==proof['database']=='postgres' and proof['candidate_id']==CANDIDATE and type(proof['reviewed'])is bool)
  require(all(isinstance(proof[k],str)and re.fullmatch(r'[a-f0-9]{64}',proof[k])for k in('facts_sha256','candidate_rows_sha256')))
  require(type(proof['jobs_count'])is int and 0<=proof['jobs_count']<=1000 and len(proof['support'])==4)
  fields=set('support_id asset_id candidate_id upload_id row_version archived asset_status asset_purpose mime_type size_bytes sha256 width height upload_status origin_workspace_id reservation_matches stored_object_exists'.split())
  for row in proof['support']:
   require(set(row)==fields and all(isinstance(row[k],str)and UUID.fullmatch(row[k])for k in('support_id','asset_id','candidate_id','upload_id','origin_workspace_id')))
   require(row['asset_id']in expected and row['candidate_id']==CANDIDATE and row['origin_workspace_id']==WORKSPACE)
   require((row['mime_type'],row['size_bytes'],row['sha256'])==expected[row['asset_id']] and row['asset_status']=='ready'and row['asset_purpose']=='candidate_support'and row['upload_status']=='completed')
   require(all(type(row[k])is bool for k in('archived','reservation_matches','stored_object_exists'))and row['reservation_matches']and row['stored_object_exists'])
   require(type(row['row_version'])is int and 1<=row['row_version']<=20)
   require((row['width'],row['height'])==((320,180)if row['mime_type']=='image/png'else(None,None)))
  require(len({r['asset_id']for r in proof['support']})==4)
  report.update(result='captured',proof=proof,facts_unchanged=proof['facts_sha256']==facts,
   global_candidate_rows_unchanged=proof['candidate_rows_sha256']==baseline['proof']['candidate_rows_sha256'],
   four_ready_byte_hashes_match=True,archived_count=sum(r['archived']for r in proof['support']))
 except Exception:report['code']='M03_SUPPORT_METADATA_UNCONFIRMED'
 finally:
  folder=ROOT/'tracking/evidence/m03/remaining-support-live';folder.mkdir(parents=True,exist_ok=True)
  file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
  with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
  print(json.dumps({k:report.get(k)for k in('result','facts_unchanged','global_candidate_rows_unchanged','four_ready_byte_hashes_match','archived_count')}|{'receipt':file.relative_to(ROOT).as_posix()}))
 return 0 if report['result']=='captured'else 1
if __name__=='__main__':
 try:sys.exit(main())
 except Exception:sys.stderr.write('Support observer precondition stopped; private diagnostics suppressed.\n');sys.exit(1)
