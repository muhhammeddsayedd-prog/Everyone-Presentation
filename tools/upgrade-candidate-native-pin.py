"""One reviewed local pin upgrade; never edits credentials, data or cloud config."""
import datetime, hashlib, json, os, sys, uuid
from provision_logo_verifier import ROOT, TARGET, WindowsPrivateFiles
from release_foundation import call

OLD = 'sha256:59b6728cdbf37a54b466239020839936d78ccd10eec2e964f9d1af78cb7cc0ed'
NEW = 'sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'
FILE = ROOT/'.env.candidate-runtime.local'
PRIVATE = ROOT/'.local/candidate-native-upgrade'
PROOFS = ['tracking/evidence/m03/media-container/2026-10-29T12-51-41-582Z.json',
          'tracking/evidence/m03/native-geometry/2026-10-29T12-59-20-445Z.json']
SQL = 'tools/sql/m03-candidate-pin-drain.sql'

def require(value):
    if not value: raise ValueError('CANDIDATE_NATIVE_UPGRADE_UNCONFIRMED')

def sha(data): return hashlib.sha256(data).hexdigest()

def read(security, file, maximum):
    security.verify(file)
    with file.open('rb') as handle:
        security.verify_open(handle); data = handle.read(maximum+1); security.verify_open(handle)
    require(len(data)<=maximum)
    return data

def main():
    action = sys.argv[1] if len(sys.argv)==2 else ''
    require(action in ('dry-run','upgrade'))
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    security=WindowsPrivateFiles(); PRIVATE.mkdir(parents=True,exist_ok=True)
    before=read(security,FILE,4096)
    require(before.count(('EPS_MEDIA_IMAGE_ID='+OLD+'\n').encode())==1 and b'EPS_CANDIDATE_MEDIA_ENABLED=true\n' in before)
    proofs=[json.loads((ROOT/p).read_bytes()) for p in PROOFS]
    require(proofs[0]['passed'] is True and len(proofs[0]['tests'])==10 and all(t['result']=='passed' for t in proofs[0]['tests']))
    require(proofs[1]['result']=='passed' and proofs[1]['source_sha256']=='260b82845e677126cfcdc0d99479eaf22eec13c84f6a4c8845e7fd95c49d1010')
    require(all(p['image_id']==NEW and p['provider_called'] is False for p in proofs))
    require(proofs[1]['display_geometry']['sample_aspect_ratio']=={'numerator':16,'denominator':15})
    require(all(f['width']==853 and f['height']==480 for f in proofs[1]['frames']))
    inputs={'before_sha256':sha(before),'proof_seals':{p:sha((ROOT/p).read_bytes()) for p in PROOFS},
            'helper_sha256':sha((ROOT/'tools/upgrade-candidate-native-pin.py').read_bytes()),'drain_sql_sha256':sha((ROOT/SQL).read_bytes())}
    claim=PRIVATE/'upgrade.claim.json'; dry=PRIVATE/'dry-run.json'
    require(not claim.exists())
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]
    for stream in ('stdout','stderr'):
        with security.create(PRIVATE/(stamp+'.'+stream)) as handle: handle.write(getattr(result,stream).encode());handle.flush();os.fsync(handle.fileno())
    require(result.returncode==0)
    rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'candidate_pin_drain'})
    drain=rows[0]['candidate_pin_drain']
    require(drain['query_role']==drain['database']=='postgres' and drain['active_candidate_jobs']==drain['leased_candidate_dispatches']==0)
    require(drain['candidate_enabled'] and drain['protected_job_still_waiting'])
    require(drain['versions']==sorted(p.name[:14] for p in (ROOT/'supabase/migrations').glob('*.sql')))
    if action=='dry-run':
        require(not dry.exists())
        with security.create(dry) as handle: handle.write(json.dumps({'inputs':inputs,'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}).encode())
    else:
        prior=json.loads(read(security,dry,16384));require(prior['inputs']==inputs)
        require(0<=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(prior['created_at'])).total_seconds()<=900)
        with security.create(claim) as handle:handle.write(json.dumps({'status':'attempting','at':stamp,'automatic_retry':False}).encode())
        with security.create(PRIVATE/'before.env') as handle:handle.write(before);handle.flush();os.fsync(handle.fileno())
        after=before.replace(('EPS_MEDIA_IMAGE_ID='+OLD+'\n').encode(),('EPS_MEDIA_IMAGE_ID='+NEW+'\n').encode(),1)
        with FILE.open('r+b') as handle:
            security.verify_open(handle);require(handle.read()==before);handle.seek(0);handle.write(after);handle.truncate();handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
        require(read(security,FILE,4096)==after)
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'passed','action':action,'target':TARGET,
      'old_image':OLD,'new_image':NEW,'proofs':PROOFS,'drain':drain,'local_pin_changed':action=='upgrade','credentials_changed':False,
      'old_assets_changed':False,'cloud_mutated':False,'provider_called':False,'process_started':False,'hosting_deferred':True}
    directory=ROOT/'tracking/evidence/m03/native-pin-upgrade';directory.mkdir(parents=True,exist_ok=True)
    file=directory/(stamp+'-'+action+'.json');file.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'result':'passed','action':action,'receipt':file.relative_to(ROOT).as_posix(),'credentials_changed':False,'cloud_mutated':False}))

if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'result':'unconfirmed','private_values_suppressed':True,'automatic_retry':False}));sys.exit(1)
