"""Fixed private inputs/output only; never prints PDF links or document bodies."""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from provision_logo_verifier import ROOT, WindowsPrivateFiles, safe_path

VERSION='796effc6-93d6-4602-97d7-c1199083114f'
VIDEO='20c0ed17-5705-4056-a53d-9898384d4187'
EXPORT='f6d03929-5e19-46cf-a4a4-b46bcbe59ea7'
PRIVATE=ROOT/'.local/m06-live'
PDF=PRIVATE/('export-'+EXPORT+'.pdf')
SNAPSHOT=PRIVATE/('version-'+VERSION+'.snapshot.json')
OUTPUT=PRIVATE/'pdf-playback-v1.html'

def require(value):
    if not value:raise ValueError('M06_PRIVATE_PDF_PLAYBACK_UNCONFIRMED')

def validate_html(data):
    require(type(data)is bytes and 0<len(data)<=16384)
    text=data.decode('utf-8')
    links=re.findall(r'href="([^"]+)"',text)
    require(len(links)==1 and re.fullmatch(r'http://127\.0\.0\.1:3000/m/[A-Za-z0-9_-]{43}/versions/'+VERSION+r'/media/'+VIDEO,links[0]))
    require(text.startswith('<!doctype html>')and '<script'not in text.lower()and not re.search(r'\son[a-z]+\s*=',text,re.I))
    for marker in ['<meta name="referrer" content="no-referrer">','<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'; form-action \'none\'; object-src \'none\'">','target="_blank" rel="noopener noreferrer"','Extracted actual PDF link','Open original introduction from saved V1 PDF']:
        require(marker in text)
    return data

def main():
    require(len(sys.argv)==2 and sys.argv[1]in('--verify-inputs','--write-html'))
    security=WindowsPrivateFiles()
    if sys.argv[1]=='--verify-inputs':
        result={}
        for key,file,maximum in [('pdf',PDF,67108864),('snapshot',SNAPSHOT,8388608)]:
            safe_path(file);security.verify(file);before=file.lstat();require(file.is_file()and not file.is_symlink()and 0<before.st_size<=maximum)
            raw=file.read_bytes();after=file.lstat();require((before.st_size,before.st_ino,before.st_dev,before.st_mtime_ns)==(after.st_size,after.st_ino,after.st_dev,after.st_mtime_ns)and len(raw)==before.st_size)
            result[key]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
        print(json.dumps({'verified':True,'owner_system_only':True,**result}));return
    raw=sys.stdin.buffer.read(16385);validate_html(raw);safe_path(OUTPUT)
    with security.create(OUTPUT)as handle:
        security.verify_open(handle);handle.write(raw);handle.flush();os.fsync(handle.fileno());security.verify_open(handle);handle.seek(0);require(handle.read()==raw)
    security.verify(OUTPUT)
    print(json.dumps({'written':True,'owner_system_only':True,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}))

if __name__=='__main__':
    try:main()
    except Exception:
        sys.stderr.write('M06 private PDF playback file unconfirmed; private values were suppressed.\n');sys.exit(1)
