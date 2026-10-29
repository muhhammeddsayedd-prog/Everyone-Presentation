"""Prepare local opt-ins disabled; create an independent purpose-bound key privately."""
import datetime, json, os, re, secrets, sys
from provision_logo_verifier import ROOT, WindowsPrivateFiles
PIN='sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'
KEY_ID='eps-candidate-support-local-20261029-v1'

def main():
    if sys.argv[1:]!=['--prepare']:raise ValueError('Require fixed prepare action')
    security=WindowsPrivateFiles();created=[]
    frame=ROOT/'.env.frames-runtime.local';expected=f'EPS_FRAME_EXTRACTION_ENABLED=false\nEPS_FRAME_IMAGE_ID={PIN}\n'.encode()
    if not frame.exists():
        with security.create(frame) as handle:handle.write(expected);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
        created.append('frame_configuration')
    security.verify(frame)
    if frame.read_bytes()!=expected:raise ValueError('Preserve existing frame configuration')
    support=ROOT/'.env.support-runtime.local'
    if not support.exists():
        key=secrets.token_hex(32)
        data=f'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=false\nEPS_SUPPORT_VERIFIER_KEY_ID={KEY_ID}\nEPS_SUPPORT_VERIFIER_KEY_HEX={key}\n'.encode()
        with security.create(support) as handle:handle.write(data);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
        created.append('support_configuration')
    security.verify(support)
    with support.open('rb') as handle:
        security.verify_open(handle);data=handle.read(1025);security.verify_open(handle)
    if len(data)>1024 or not re.fullmatch(rb'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=false\nEPS_SUPPORT_VERIFIER_KEY_ID='+KEY_ID.encode()+rb'\nEPS_SUPPORT_VERIFIER_KEY_HEX=[a-f0-9]{64}\n',data):raise ValueError('Preserve existing support configuration')
    proof={'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'passed','created':created,'frame_enabled':False,'support_enabled':False,
      'image_id':PIN,'support_key_id':KEY_ID,'key_value_recorded':False,'protected_owner_system_dacl_verified':True,'cloud_called':False,'process_started':False,'hosting_deferred':True}
    out=ROOT/'tracking/evidence/m03/remaining-configuration';out.mkdir(exist_ok=True,parents=True)
    (out/'local-disabled-preparation.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf8');print(json.dumps(proof))

if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'result':'unconfirmed','private_values_suppressed':True,'automatic_rotation':False}));sys.exit(1)
