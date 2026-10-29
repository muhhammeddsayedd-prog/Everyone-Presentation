"""Create the fixed separate presentation runtime configuration with a private DACL."""
import json
import os
import re
import secrets
import sys
from urllib.parse import urlsplit

from provision_logo_verifier import ROOT, WindowsPrivateFiles, require, safe_path


def main():
    require(sys.argv[1:] == ['prepare'], 'Use the fixed prepare operation.')
    source = ROOT / '.env.worker.local'
    safe_path(source)
    require(source.stat().st_size <= 16_384, 'Existing provider configuration is too large.')
    text = source.read_text(encoding='utf-8-sig')
    origins = re.findall(r'^\s*N8N_BASE_URL\s*=\s*([^\r\n]+)', text, re.M)
    require(len(origins) == 1, 'Existing n8n origin is unavailable.')
    origin = origins[0].strip().strip('\"\'').rstrip('/')
    parsed = urlsplit(origin)
    require(parsed.scheme == 'https' and parsed.hostname and not parsed.username
            and not parsed.password and not parsed.path and not parsed.query
            and not parsed.fragment and not parsed.port and parsed.hostname.endswith('.app.n8n.cloud'), 'Existing n8n origin is invalid.')
    secret = secrets.token_hex(32)
    for other in ['.env.worker-runtime.local', '.env.candidate-runtime.local', '.env.review-runtime.local']:
        safe_path(ROOT / other)
        require((ROOT / other).stat().st_size <= 65_536, 'Existing runtime configuration is too large.')
        require(secret not in (ROOT / other).read_text(encoding='utf-8-sig'), 'Dispatch keys must be distinct.')
    values = {'EPS_PRESENTATION_ENABLED': 'true',
              'N8N_PRESENTATION_DISPATCH_URL': origin + '/webhook/eps-wf03-presentation-stage-v1',
              'N8N_PRESENTATION_DISPATCH_SECRET': secret}
    security = WindowsPrivateFiles()
    destination = ROOT / '.env.presentation-runtime.local'
    safe_path(destination)
    with security.create(destination) as handle:
        handle.write(''.join(key + '=' + value + '\n' for key, value in values.items()).encode('utf8'))
        handle.flush()
        os.fsync(handle.fileno())
        security.verify_open(handle)
    security.verify(destination)
    print(json.dumps({'result': 'created', 'owner_and_system_only': True,
                      'database_processing_modified': False,
                      'credentials_printed': False, 'provider_called': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.stderr.write('Presentation private preparation stopped; existing files were not replaced.\n')
        sys.exit(1)
