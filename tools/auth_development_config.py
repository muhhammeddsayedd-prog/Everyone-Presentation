"""Apply only two reviewed local callback URL settings to the approved new canonical project."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'
ALLOWED = {('auth','site_url'),('auth','additional_redirect_urls')}

def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    if action not in ('diff','apply'): raise ValueError('Choose diff or apply.')
    if (ROOT/'supabase/.temp/project-ref').read_text().strip() != TARGET: raise ValueError('Unexpected linked project.')
    source = ROOT/'supabase/auth-development.toml'
    private = ROOT/'.local/auth-config-release'
    (private/'supabase').mkdir(parents=True,exist_ok=True)
    (private/'supabase/config.toml').write_bytes(source.read_bytes())
    def call(command):
        return subprocess.run(['npx.cmd','--yes','supabase@2.122.0','config',command,'--project-ref',TARGET,
            '--workdir',str(private),'--output-format','json','--yes'],cwd=ROOT,capture_output=True,text=True,
            encoding='utf-8',errors='replace',timeout=60)
    diff = call('diff')
    (private/'diff-private.txt').write_text(diff.stdout+'\n'+diff.stderr,encoding='utf-8')
    try: payload = json.loads(diff.stdout)
    except ValueError: raise ValueError('Configuration diff unavailable; private diagnostics retained.')
    changes = payload.get('changes',[])
    declared = [c for c in changes if c.get('declared') and c.get('local') != c.get('remote')]
    if any(tuple(c.get('path',[])) not in ALLOWED for c in declared): raise ValueError('Unexpected declared setting; no configuration applied.')
    safe = [{'path':c['path'],'before':c.get('remote'),'after':c.get('local')} for c in declared]
    receipt = {'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'action':action,
        'source':'supabase/auth-development.toml','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'declared_changes':safe,'diff_exit_code':diff.returncode,'cloud_configuration_applied':False,
        'secrets_or_email_messages_sent':False}
    if action == 'apply' and declared:
        if diff.returncode != 0: raise ValueError('Configuration diff failed; no push attempted.')
        pushed = call('push')
        (private/'push-private.txt').write_text(pushed.stdout+'\n'+pushed.stderr,encoding='utf-8')
        receipt['apply_exit_code'] = pushed.returncode
        receipt['cloud_configuration_applied'] = pushed.returncode == 0
        if pushed.returncode: raise ValueError('Configuration push failed; inspect private diagnostics and read back state.')
    output = ROOT/'tracking/evidence/cloud-foundation'
    output.mkdir(parents=True,exist_ok=True)
    (output/('auth-development-'+action+'.json')).write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt,indent=2))
    return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError,KeyError,subprocess.TimeoutExpired) as error:
        print(json.dumps({'status':'BLOCKED','reason':str(error) if isinstance(error,ValueError) else type(error).__name__,'raw_output_suppressed':True}));sys.exit(1)
