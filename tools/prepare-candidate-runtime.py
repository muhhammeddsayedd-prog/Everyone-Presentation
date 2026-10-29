"""Create the separate, disabled candidate runtime configuration privately."""
import os, re, secrets, sys
from provision_logo_verifier import ROOT, WindowsPrivateFiles, require

def main():
    require(sys.argv[1:]==['prepare'],'Use the fixed prepare operation.')
    source=(ROOT/'.env.worker.local').read_text(encoding='utf-8-sig')
    matches=re.findall(r'^\s*N8N_BASE_URL\s*=\s*([^\r\n]+)',source,re.M)
    require(len(matches)==1,'Existing n8n origin is unavailable.')
    origin=matches[0].strip().strip('\"\'').rstrip('/')
    require(re.fullmatch(r'https://[A-Za-z0-9.-]+',origin) is not None,'Existing n8n origin is invalid.')
    values={'EPS_CANDIDATE_MEDIA_ENABLED':'false','EPS_MEDIA_IMAGE_ID':'sha256:59b6728cdbf37a54b466239020839936d78ccd10eec2e964f9d1af78cb7cc0ed',
            'OPENAI_TRANSCRIPTION_MODEL':'gpt-transcribe','N8N_CANDIDATE_DISPATCH_URL':origin+'/webhook/eps-wf02-candidate-stage-v1',
            'N8N_CANDIDATE_DISPATCH_SECRET':secrets.token_hex(32)}
    security=WindowsPrivateFiles();file=ROOT/'.env.candidate-runtime.local'
    with security.create(file) as handle:
        handle.write((''.join(key+'='+value+'\n' for key,value in values.items())).encode('utf8'));handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
    security.verify(file)
    print('{"result":"created_disabled","owner_and_system_only":true,"credentials_printed":false,"provider_called":false}')

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Candidate private preparation stopped. Existing credentials were not replaced.\n');sys.exit(1)
