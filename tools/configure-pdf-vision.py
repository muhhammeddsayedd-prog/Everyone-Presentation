"""Fixed local worker vision flag; no credential, DB or provider operation."""
import os,sys
from provision_logo_verifier import ROOT,WindowsPrivateFiles,require
IMAGE='sha256:52110c040822f1f1ecfd087518daa7583569c64a641dbdfe6585b5e8b7a98979'
PRIOR_IMAGE='sha256:0f0b87ed3ba6b42f78a1e76026edea5860bd3e2bd9dc9313a4cec010a0910b8e'
def main():
    action=sys.argv[1:];require(action in (['prepare'],['enable'],['upgrade']),'Use prepare, upgrade or enable.')
    file=ROOT/'.env.pdf-vision.local';security=WindowsPrivateFiles()
    disabled=f'EPS_PDF_VISION_ENABLED=false\nEPS_PDF_RASTER_IMAGE_ID={IMAGE}\n'.encode()
    if action==['prepare']:
        with security.create(file) as handle:handle.write(disabled);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
    else:
        security.verify(file)
        with file.open('r+b') as handle:
            security.verify_open(handle);expected=disabled if action==['enable'] else disabled.replace(IMAGE.encode(),PRIOR_IMAGE.encode());require(handle.read()==expected,'Fixed disabled image configuration required.')
            handle.seek(0);handle.write(disabled.replace(b'=false\n',b'=true\n',1) if action==['enable'] else disabled);handle.truncate();handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
    security.verify(file);print('{"result":"configured","mode":"'+action[0]+'","provider_called":false,"credentials_changed":false}')
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed local PDF vision configuration stopped.\n');sys.exit(1)
