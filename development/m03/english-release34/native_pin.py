"""Canonical33 future-only native frame pin; root execution, separate claim.

No old input/job/request/frame/media/version is rewritten. The same actual fresh
native proof and successful same-ID manifest adoption are prerequisites.
"""
from pathlib import Path
import copy, hashlib, importlib.util, json, re, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
release=module('english34_native_pin_release',HERE/'release.py')
native=module('english34_native_pin_plan',HERE/'native_admission.py')
manifest=module('english34_native_pin_environment',HERE/'native_manifest.py')
CLAIM=release.PRIVATE/'native-pin.claim.json'

def need(value):
 if not value:raise ValueError('ENGLISH34_NATIVE_PIN_UNCONFIRMED')
def expected_after(before,new_image):
 release.check_before(before);need(re.fullmatch('sha256:[a-f0-9]{64}',new_image)and new_image!=native.OLD_IMAGE)
 need(before['frame_config']['id']is True and before['frame_config']['enabled']is True and before['frame_config']['native_image_id']==native.OLD_IMAGE and before['frame_config']['implementation_version']=='frame-extraction.v1')
 after=copy.deepcopy(before);after['frame_config']['native_image_id']=new_image;return after
def render(before,new_image,run):
 release.marker(run);after=expected_after(before,new_image)
 return release.transaction()+release.assertion(release.state_sql(False),before,'ENGLISH34_NATIVE_PIN_PREFLIGHT_CHANGED')+"do $pin$declare changed integer;begin if exists(select 1 from pg_trigger where tgrelid='eps.frame_extraction_config'::regclass and not tgisinternal)then raise exception'ENGLISH34_FRAME_CONFIG_TRIGGER_REQUIRED_ABSENT';end if;update eps.frame_extraction_config set native_image_id="+release.literal(new_image)+"where id and enabled and implementation_version='frame-extraction.v1'and native_image_id="+release.literal(native.OLD_IMAGE)+";get diagnostics changed=row_count;if changed<>1 then raise exception'ENGLISH34_EXACT_ONE_NATIVE_PIN_REQUIRED';end if;end$pin$;\n"+release.assertion(release.state_sql(False),after,'ENGLISH34_NATIVE_PIN_POSTCONDITION_FAILED')+"commit;select jsonb_build_object('native_image_id',"+release.literal(new_image)+",'marker',"+release.literal(run)+")as english34_release;\n"
def environment_adopted(plan,pins):
 claim=json.loads(manifest.CLAIM.read_text(encoding='utf8'));proof=json.loads(manifest.RETURNED.read_text(encoding='utf8'))
 need(claim['target']==native.TARGET and claim['source_pins']==pins and claim['plan']==plan)
 need(proof=={'claim_sha256':release.sha(manifest.CLAIM.read_bytes()),'new_manifest_sha256':plan['next']['manifest_sha256'],'process_returned':True})
 api=manifest.API();first=api.observe();second=api.observe()
 need(manifest.outcome(claim['before'],first,second,plan['next']['manifest_sha256'],True)['result']=='passed')
 return {'claim_sha256':proof['claim_sha256'],'manifest_sha256':plan['next']['manifest_sha256'],'metadata':first['metadata']}
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('inspect','apply','readback'));action=sys.argv[1];pins=manifest.sources();plan=native.plan();new=plan['next']['native_image_id'];env=environment_adopted(plan,pins)
 if action=='inspect':
  before=release.read_state(False);expected_after(before,new);report={'result':'observed','before':before,'dispatch_attempted':False}
 elif action=='readback':
  claim=json.loads(CLAIM.read_text(encoding='utf8'));need(claim['target']==native.TARGET and claim['source_pins']==pins and claim['plan']==plan)
  first=release.read_state(False);second=release.read_state(False);need(first==second==expected_after(claim['before'],new));report={'result':'observed_applied','first':first,'second':second,'claim_retained':True,'dispatch_attempted':False}
 else:
  need(not CLAIM.exists());before=release.read_state(False);expected=expected_after(before,new);run=str(uuid.uuid4())
  release.claim(CLAIM,{'target':native.TARGET,'source_pins':pins,'plan':plan,'before':before,'manifest_adoption':env,'marker':run,'claimed_at':release.stamp(),'dispatch_may_have_occurred':True})
  need(release.read_state(False)==before and manifest.sources()==pins and native.plan()==plan and environment_adopted(plan,pins)==env)
  returned=False;first=second=None;verified=False
  try:returned=release.query(render(before,new,run),'native-pin')=={'native_image_id':new,'marker':run}
  except Exception:pass
  try:
   first=release.read_state(False);second=release.read_state(False);need(first==second==expected and manifest.sources()==pins and native.plan()==plan);verified=True
  except Exception:pass
  report={'result':'passed'if returned and verified else'unconfirmed','normal_return_marker_observed':returned,'independent_readback_verified':verified,'before':before,'first':first,'second':second,'claim_retained':True,'dispatch_attempted':True}
 path=release.receipt('native-pin-'+action,{'source_pins':pins,'plan':plan,'manifest_adoption':env,'only_future_native_pin_changed':report['result']in('passed','observed_applied'),'english_processing_enabled':False,**report})
 print(json.dumps({'result':report['result'],'receipt':path,'claim_retained':CLAIM.exists(),'automatic_dispatch_retry':False}));need(report['result']in('passed','observed','observed_applied'))
if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_NATIVE_PIN_UNCONFIRMED');sys.exit(1)
