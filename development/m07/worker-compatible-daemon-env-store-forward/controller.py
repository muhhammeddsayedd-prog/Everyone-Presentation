"""New default-off entry over the exact frozen controller, without its main."""
from pathlib import Path
import hashlib
_OLD=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/worker-compatible-daemon-env-forward/controller.py')
_RAW=_OLD.read_bytes();assert hashlib.sha256(_RAW).hexdigest()=='c29505a93adb5de679c7d792c541af35abfa1dfa1070b6419f9473812133b1a1'
_text=_RAW.decode('utf8')
_flag='EXECUTION_ENABLED=True\n'
_main="if __name__=='__main__':\n try:main()\n except Exception:print('ENV_FORWARD_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None\n"
assert _text.count(_flag)==1 and _text.count(_main)==1
assert _text.endswith(_main)
_flag_position=_text.index(_flag)
_projected=_text.replace(_flag,'').replace(_main,'')
assert (_projected[:_flag_position]+_flag+_projected[_flag_position:]+_main)==_text
exec(compile(_projected,str(_OLD),'exec'),globals())
EXECUTION_ENABLED=True
if __name__=='__main__':
 try:main()
 except Exception:print('ENV_STORE_FORWARD_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
