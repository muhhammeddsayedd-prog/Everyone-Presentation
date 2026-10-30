import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m06_playback_private',ROOT/'tools/m06-pdf-playback-private.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def body():
    href='http://127.0.0.1:3000/m/'+'A'*43+'/versions/'+m.VERSION+'/media/'+m.VIDEO
    return ('<!doctype html><html><head><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'; form-action \'none\'; object-src \'none\'"></head><body><h1>Extracted actual PDF link</h1><a href="'+href+'" target="_blank" rel="noopener noreferrer">Open original introduction from saved V1 PDF</a></body></html>').encode()

class PlaybackPrivateTests(unittest.TestCase):
    def test_exact_scoped_single_link_is_accepted(self):self.assertEqual(m.validate_html(body()),body())
    def test_bad_destination_multiple_links_scripts_handlers_and_missing_protections_are_denied(self):
        for changed in [body().replace(b'127.0.0.1',b'untrusted.invalid'),body().replace(m.VERSION.encode(),m.EXPORT.encode()),body().replace(b'</body>',b'<a href="https://untrusted.invalid">other</a></body>'),body().replace(b'</body>',b'<script>private()</script></body>'),body().replace(b'<a href=',b'<a onclick="private()" href='),body().replace(b'noopener noreferrer',b'noopener'),body().replace(b'no-referrer',b'unsafe-url')]:
            with self.assertRaises(ValueError):m.validate_html(changed)
    def test_fixed_writer_uses_exclusive_owner_security_creation_and_cannot_overwrite(self):
        memory=io.BytesIO();state={'created':False,'verified':0}
        class Handle:
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def write(self,value):memory.write(value)
            def flush(self):pass
            def fileno(self):return 1
            def seek(self,value):memory.seek(value)
            def read(self):return memory.read()
        class Security:
            def create(self,path):
                self.assert_path(path)
                if state['created']:raise FileExistsError()
                state['created']=True;return Handle()
            def assert_path(self,path):
                if path!=m.OUTPUT:raise AssertionError('Only fixed output allowed')
            def verify_open(self,_):state['verified']+=1
            def verify(self,path):self.assert_path(path);state['verified']+=1
        with patch.object(m.sys,'argv',['tool','--write-html']),patch.object(m.sys,'stdin',type('Input',(),{'buffer':io.BytesIO(body())})()),patch.object(m,'WindowsPrivateFiles',Security),patch.object(m,'safe_path'),patch.object(m.os,'fsync'),contextlib.redirect_stdout(io.StringIO()):m.main()
        self.assertEqual(memory.getvalue(),body());self.assertEqual(state['verified'],3)
        with patch.object(m.sys,'argv',['tool','--write-html']),patch.object(m.sys,'stdin',type('Input',(),{'buffer':io.BytesIO(body())})()),patch.object(m,'WindowsPrivateFiles',Security),patch.object(m,'safe_path'),self.assertRaises(FileExistsError):m.main()
        self.assertEqual(memory.getvalue(),body())

if __name__=='__main__':unittest.main()
