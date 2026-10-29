"""Read-only post-app canonical checkpoint; not a migration or release retry."""
import datetime,hashlib,json,sys,uuid
from pathlib import Path
import release_m03_remaining as release
import m03_remaining_activation as activation

BASELINE='tracking/evidence/cloud-m03-remaining/2026-10-29T14-27-32-733612Z-f4f2ecc5-readback.json'
def main():
    activation.require(sys.argv[1:]==[])
    baseline_path=release.ROOT/BASELINE
    baseline=json.loads(baseline_path.read_bytes())
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':release.TARGET,
      'result':'unconfirmed','read_only':True,'mutations_requested':False,'provider_called':False,
      'baseline':BASELINE,'baseline_sha256':hashlib.sha256(baseline_path.read_bytes()).hexdigest(),
      'harness_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'boundary':'Post-app state is not at-apply whole-business preservation. New authorized app records are included; only catalog/runtime and protected M02 are compared to the release.'}
    try:
        activation.require(baseline['result']=='passed')
        state=release.inspect_state();activation.enabled(state)
        activation.require(state['versions']==sorted(p.name[:14]for p in(release.ROOT/'supabase/migrations').glob('*.sql'))and len(state['versions'])==19)
        activation.require(state['catalog']==baseline['readback']['catalog']and state['runtime']==baseline['readback']['runtime']
          and state['protected_m02']==baseline['readback']['protected_m02'])
        activation.require(state['data_sha256']['eps.candidate_asset_config']==baseline['readback']['data_sha256']['eps.candidate_asset_config'])
        activation.require(len(state['remaining']['support_verification_keys'])==1)
        activation.validate_metadata(state['remaining']['support_verification_keys'][0])
        report.update(result='captured',state=state,catalog_and_runtime_unchanged=True,protected_m02_unchanged=True,
          frame_and_support_upload_flags_enabled=True,candidate_config_hash_unchanged=True,
          runtime_operations=len(state['runtime']['execute']))
    except Exception:report['code']='POST_APP_CANONICAL_METADATA_UNCONFIRMED'
    finally:
        folder=release.ROOT/'tracking/evidence/m03/final-canonical';folder.mkdir(parents=True,exist_ok=True)
        file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
        with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
        print(json.dumps({'result':report['result'],'receipt':file.relative_to(release.ROOT).as_posix(),
          'runtime_operations':report.get('runtime_operations'),'protected_m02_unchanged':report.get('protected_m02_unchanged')}))
    return 0 if report['result']=='captured'else 1
if __name__=='__main__':sys.exit(main())
