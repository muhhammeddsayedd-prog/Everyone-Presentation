"""New compatible error-guidance release purpose; import is offline and inert.

Reuses frozen provider-source web controller. No old plan/claim/source is edited
or replayed. Root alone enables, stages, builds and dispatches this purpose.
"""
from pathlib import Path
import copy,datetime,hashlib,importlib.util,json,sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
BASE=ROOT/'development/m07/workspace-summary35-web/web.py'
BASE_SHA='b306de33cbfe1a2d43426d0d9ec8e397618e847d94cd19692a3f6caff3e0a483'
DEPLOY_ENABLED=True
CURRENT='dpl_6L6vS8FnaGDckcYq8Xm4QxHGc74b'
CANONICAL_HELPER='development/m07/job-attempt-observability36-release/release.py'
CANONICAL_HELPER_SHA='9a0c6c1711c0e5f33b1102a878568e46879ed6b835094eded92872856734258c'
STATE='development/m07/job-attempt-observability36-release/state.py'
STATE_SHA='2240ad7b9ae85ebc7d1ab94857e9ed5a5c572f51b6ef7fb18c1fd72b9a0b13f9'
ANCHORS={
 'baseline_ready':{'path':'tracking/evidence/m07/workspace-summary35-web/2026-11-01T01-03-59-685059Z-ready.json','sha256':'5bd09c44433e8e5860c763d462f50a2d2e7d591ebfa77a8842cbe6a9c6f0d238'},
 'baseline_source':{'path':'tracking/evidence/m07/controlled-pilot/2026-11-01T00-40-04-581Z-c49c2253-web-source.json','sha256':'aa05a833158a3f76b377e15d5cc7c427587902b27dda9f865a4f9ea34a20c107'},
 'apply':{'path':'tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-19-19-577795Z-apply.json','sha256':'5899b5f052510bc31635fa2ba0b37500b5451240d8306b409e97aa2897bc1f3a'},
 'readback':{'path':'tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-20-17-194633Z-readback.json','sha256':'fcfd3972cc660d8a9fdded4fc24db72ceac7c3bdafe1d461671d03baa6045b10'},
 'paired_audit':{'path':'tracking/evidence/m07/job-attempt-observability36-live-sidecar/2026-11-01T02-50-02-687228Z-8829fa59-3c1c-46dc-b20b-32649645c275.json','sha256':'0997addf653c8ccd754221c42f1c35096bf596a20a0be8b697f43c765eaf1a15'}}
COPY_FILES={
 'apps/web/components/processing-view.ts':'f3c82c6ebf3222d94df4c4ab9b0542bef46b824b4ffa2cf5446b89a6973e2aaf',
 'packages/central/src/jobs.ts':'429c540f80897f5441660ec94f9be4415127d428ac763adef0895b3a34484acb'}
PRODUCT_FILES=set(COPY_FILES)
ADDED_TRACE='packages/jobs/src/attempt-trace.ts'
ADDED_TRACE_SHA='f92f5a6f484cbfb17a69283b4bc7cd734f42326fe1a91429c36d3aa91787694a'
MARKERS=(('epsSourceUnreadable36Source','source_sha256'),('epsSourceUnreadable36Quality','quality_sha256'),('epsSourceUnreadable36Canonical','canonical_sha256'))

def need(value):
 if not value:raise ValueError('SOURCE_UNREADABLE36_WEB_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
need(sha(BASE.read_bytes())==BASE_SHA)
spec=importlib.util.spec_from_file_location('unreadable36_frozen_summary_web',BASE);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
old=base.old;ORIGINAL_PINS=base.source_pins;ORIGINAL_STAGE=base.stage

def anchor(name):
 ref=ANCHORS[name];raw=old.load(ROOT/ref['path']);need(sha(raw)==ref['sha256']);return json.loads(raw)

def source_delta(report):
 """Exact public before/after row hashes; no environment values or stage IO."""
 baseline=anchor('baseline_source');ready=anchor('baseline_ready')
 base.validate_rows(baseline['files']);base.validate_rows(report['files'])
 need(baseline['entries']==len(baseline['files'])and ready['action']=='ready'and ready['deployment']['id']==CURRENT and ready['stable_alias_matches']is True)
 baseline_hash=base.digest(baseline['files']);need(baseline_hash==ready['deployment']['source_sha256'])
 before={row['path']:row for row in baseline['files']};after={row['path']:row for row in report['files']}
 added=[{'path':p,'before':None,'after':copy.deepcopy(after[p])}for p in sorted(after.keys()-before.keys())]
 removed=[{'path':p,'before':copy.deepcopy(before[p]),'after':None}for p in sorted(before.keys()-after.keys())]
 changed=[{'path':p,'before':copy.deepcopy(before[p]),'after':copy.deepcopy(after[p])}for p in sorted(before.keys()&after.keys())if before[p]!=after[p]]
 need(not removed and {row['path']for row in changed}==PRODUCT_FILES and {row['path']for row in added}=={ADDED_TRACE})
 for row in changed:need(row['after']['sha256']==COPY_FILES[row['path']])
 need(added[0]['after']['sha256']==ADDED_TRACE_SHA)
 return {'baseline_ready':ANCHORS['baseline_ready'],'baseline_source':ANCHORS['baseline_source'],'baseline_source_sha256':baseline_hash,
  'baseline_entries':len(before),'current_entries':len(after),'current_source_sha256':base.digest(report['files']),
  'added':added,'changed':changed,'removed':removed,'environment_values_included':False,'deployment_performed':False,
  'scope':'Two safe error-copy files plus the already merged, separately tested attempt-trace parser; no test/client-tool/development runtime payload.'}

def canonical_helper():
 apply=anchor('apply');need(apply['source_pins'][CANONICAL_HELPER]==CANONICAL_HELPER_SHA and apply['source_pins'][STATE]==STATE_SHA)
 for file,digest in apply['source_pins'].items():need(sha(old.load(ROOT/file))==digest)
 spec=importlib.util.spec_from_file_location('unreadable36_applied_canonical',ROOT/CANONICAL_HELPER);helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
 need(helper.VERSION=='20261101012057');return helper

def canonical(reference_value,live=False):
 need(type(live)is bool and reference_value==ANCHORS['apply']);apply=anchor('apply');readback=anchor('readback');audit=anchor('paired_audit')
 need(apply['target']==readback['target']=='pyibofyctwnqpvktepse'and apply['action']=='apply'and apply['result']=='passed'and apply['version']=='20261101012057')
 need(apply['normal_return_marker_observed']is True and apply['independent_readback_verified']is True and apply['claim_retained']is True and apply['first']==apply['second'])
 need(readback['action']=='readback'and readback['result']=='observed_applied'and readback['source_pins']==apply['source_pins']and readback['static_schema_after']==apply['static_schema_after'])
 need(audit['result']=='passed'and audit['read_only']is True and audit['audited_job_count']==2 and audit['producer_browser_message_verified']is False)
 expected=readback['static_schema_after'];need(len(expected['history'])==36 and expected['history'][-1]=='20261101012057')
 if live:
  helper=canonical_helper();helper._installed(apply['first'],apply['admission'])
  current=helper.read_state('after');helper._installed(current,apply['admission'])
  need(helper.s.static_schema(current)==expected)
 return base.digest(expected)

def source_pins():
 pins=ORIGINAL_PINS();need(sha(old.load(BASE))==BASE_SHA)
 apply=anchor('apply')
 for file,digest in apply['source_pins'].items():need(sha(old.load(ROOT/file))==digest);pins[file]=digest
 for ref in ANCHORS.values():need(sha(old.load(ROOT/ref['path']))==ref['sha256']);pins[ref['path']]=ref['sha256']
 for path in [Path(__file__),HERE/'test_web.py',HERE/'README.md',HERE/'inputs.template.json']:pins[path.relative_to(ROOT).as_posix()]=sha(old.load(path))
 return pins

def stage(value):
 report,folder=ORIGINAL_STAGE(value);source_delta(report);return report,folder

def deployment(value):
 result=old.deployment(value);meta=value.get('meta',{})
 for key,target in MARKERS:
  marker=meta.get(key);need(marker is None or type(marker)is str and len(marker)==64 and all(c in'0123456789abcdef'for c in marker));result[target]=marker
 return result

def deploy_command(folder,source_hash,quality_hash,canonical_hash):
 args=[str(old.NODE),str(old.CLI),'deploy',str(folder),'--prod','--yes','--no-wait','--scope',old.SLUG,'--project',old.PROJECT]
 for(key,_),value in zip(MARKERS,[source_hash,quality_hash,canonical_hash]):args+=['--meta',key+'='+value]
 return args+['--global-config',old.GLOBAL]

def save(action,value):
 if action=='prepare':
  report=base.reference(value['source']);delta=source_delta(report);value={**value,'source_delta_evidence':save('source-delta',delta)}
 if 'canonical35_preserved'in value:value={**{k:v for k,v in value.items()if k!='canonical35_preserved'},'canonical36_static_contract_preserved':value['canonical35_preserved']}
 directory=ROOT/'tracking/evidence/m07/source-unreadable36-web';path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 old.exclusive(path,{'schema_version':'1.0','action':action,'project_id':old.PROJECT,'team_id':old.TEAM,'source_only_author':True,
  'deployment_method':'provider_source_build','no_prebuilt_acceptance':True,'worker_or_oauth_or_environment_mutations':False,
  'raw_cli_or_credentials_persisted':False,**value});return path.relative_to(ROOT).as_posix()

# Only this imported module instance is adapted. Frozen source files stay exact.
PRIVATE=ROOT/'.local/m07-source-unreadable36-web'
for key,name in [('PLAN','plan.json'),('INSPECT','provider-before.json'),('BUILD_CLAIM','build.claim.json'),('BUILD','build.json'),('CLAIM','deploy.claim.json'),('RETURNED','deploy.returned.json'),('ADMISSION','canonical-admission.json')]:setattr(base,key,PRIVATE/name)
base.PRIVATE=PRIVATE;base.CURRENT=CURRENT;base.DEPLOY_ENABLED=DEPLOY_ENABLED
base.REQUIRED=base.REQUIRED|PRODUCT_FILES;old.REQUIRED=base.REQUIRED
base.source_pins=source_pins;base.stage=stage;base.canonical=canonical;base.deployment=deployment;base.deploy_command=deploy_command;base.save=save

def main():
 need(DEPLOY_ENABLED);base.main()
if __name__=='__main__':
 try:main()
 except Exception:print('SOURCE_UNREADABLE36_WEB_UNCONFIRMED');sys.exit(1)
