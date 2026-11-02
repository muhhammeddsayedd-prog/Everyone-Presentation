"""Checkpoint-to-current historical Ready/profile hashes, no private SQL payload."""
from pathlib import Path
import datetime,decimal,importlib.util,json,os,sys,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('preservation_existing_readonly_audit',HERE/'audit.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
CHECKPOINT=a.MAIN/'.local/completion-worker-production39/67305390-0d94-4896-b924-e11229400bb8/canonical39-checkpoint.json'
PROFILE='25a3c924-7b6c-48e3-88ce-c72e72b99c6d'
def canonical(value):
 if type(value)is dict:return '{'+','.join(json.dumps(key,ensure_ascii=False)+':'+canonical(value[key])for key in sorted(value))+'}'
 if type(value)is list:return '['+','.join(canonical(item)for item in value)+']'
 if type(value)is decimal.Decimal:return format(value,'f')
 return json.dumps(value,ensure_ascii=False,separators=(',',':'))
def main():
 a.need(len(sys.argv)==1 and(a.MAIN/'supabase/.temp/project-ref').read_text().strip()==a.TARGET);guard=a.old.s.s.b.security();guard.verify(CHECKPOINT);raw=CHECKPOINT.read_bytes();a.need(len(raw)<=16*1024**2 and a.sha(raw).startswith('d506'));checkpoint=json.loads(raw,parse_float=decimal.Decimal);tables=checkpoint['application_tables'];a.need(len(tables)==76)
 versions={row['id']for row in tables['presentation_versions']if row['status']=='ready'};a.need(0<len(versions)<=1000)
 groups={'versions':[r for r in tables['presentation_versions']if r['id']in versions],'slides':[r for r in tables['version_slides']if r['version_id']in versions],'assets':[r for r in tables['presentation_version_assets']if r['version_id']in versions],'profile':[r for r in tables['candidates']if r['id']==PROFILE]};a.need(len(groups['profile'])==1)
 key=lambda group,row:row['version_id']+':'+row['asset_id']if group=='assets'else row['id']
 expected={group:{key(group,row):a.sha(canonical(row).encode())for row in rows}for group,rows in groups.items()}
 ids=','.join(a.old.literal(a.old.identifier(v))+'::uuid'for v in sorted(versions));digest=lambda value:"encode(sha256(convert_to(eps.cast_canonical("+value+"),'UTF8')),'hex')"
 terms=[]
 for group,table,where,k in [('versions','presentation_versions','r.id in('+ids+')','r.id::text'),('slides','version_slides','r.version_id in('+ids+')','r.id::text'),('assets','presentation_version_assets','r.version_id in('+ids+')',"r.version_id::text||':'||r.asset_id::text"),('profile','candidates','r.id='+a.old.literal(PROFILE)+'::uuid','r.id::text')]:terms+=[a.old.literal(group),"(select coalesce(jsonb_object_agg("+k+','+digest('to_jsonb(r)')+"),'{}'::jsonb)from eps."+table+' r where '+where+')']
 fixture={'unicode':'controlled تحقق','number':decimal.Decimal('1.250'),'array':[True,None,3]};probe=canonical(fixture)
 text="begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='45s';select jsonb_build_object('groups',jsonb_build_object("+','.join(terms)+"),'profile_is_reviewed',(select eps.cast_is_reviewed(c)from eps.candidates c where c.id="+a.old.literal(PROFILE)+"::uuid),'canonical_probe_sha256',"+digest(a.old.literal(probe)+'::jsonb')+')as historical_preservation;rollback;';import pglast;pglast.parse_sql(text)
 private=a.MAIN/'.local/production-historical-preservation'/str(uuid.uuid4());private.mkdir(parents=True,exist_ok=False);a.need(private.resolve()==private and private.is_relative_to(a.MAIN/'.local/production-historical-preservation'));file=private/'preserve.sql'
 with guard.create(file)as stream:stream.write(text.encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',a.TARGET,'--file',str(file),'--output-format','json','--workdir',str(a.MAIN)];code,timeout,overflow,out,_=a.reader.bounded(args,a.reader.environment());observed=None;comparison=None
 if code==0 and not timeout and not overflow:
  parsed=json.loads(out);rows=parsed if type(parsed)is list else parsed.get('rows');a.need(type(rows)is list and len(rows)==1 and set(rows[0])=={'historical_preservation'});observed=rows[0]['historical_preservation'];a.need(observed['canonical_probe_sha256']==a.sha(probe.encode()));comparison={group:{'baseline_count':len(expected[group]),'current_count':len(observed['groups'][group]),'all_rows_exact':observed['groups'][group]==expected[group]}for group in expected};a.need(all(row['all_rows_exact']is True for row in comparison.values())and observed['profile_is_reviewed']is True)
 receipt={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'passed'if comparison else'unconfirmed','target':a.TARGET,'read_only_rollback':True,'automatic_retry':False,'checkpoint':{'protected_path':CHECKPOINT.relative_to(a.MAIN).as_posix(),'sha256':a.sha(raw),'application_tables':76},'sql_sha256':a.sha(text.encode()),'audit_source_sha256':a.sha(Path(__file__).read_bytes()),'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'canonical_numeric_unicode_protocol_probe_verified':observed is not None,'comparisons':comparison,'profile_id':PROFILE,'profile_still_reviewed':observed['profile_is_reviewed']if observed else None,'safe_current_hashes':observed['groups']if observed else None,'private_values_entered_SQL':False,'raw_person_facts_names_notes_snapshots_payloads_or_credentials_saved':False,'mutations_or_restores_performed':False,'limits':['only preexistingReadyversion/slides/assets and fixedReviewedprofile compared','clientrevision/updated_at intentionally not compared or restored','new currentversions are outside historicalReadycohort']}
 folder=a.ROOT/'tracking/evidence/m07/production-specs-job-audit';file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-historical-preservation.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(a.ROOT).as_posix(),'comparison_counts':comparison,'profile_reviewed':receipt['profile_still_reviewed']}));a.need(comparison is not None)
if __name__=='__main__':
 try:main()
 except Exception:print('PRODUCTION_HISTORICAL_PRESERVATION_UNCONFIRMED');sys.exit(1)
