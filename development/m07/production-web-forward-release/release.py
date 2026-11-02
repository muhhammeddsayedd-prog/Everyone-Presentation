"""New default-OFF source deployment purpose; old executable source is inert."""
from pathlib import Path
import importlib.util
RELEASE_ENABLED=False
_spec=importlib.util.spec_from_file_location('forward_web_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
__forward_enabled__=RELEASE_ENABLED
exec(compile(_projection.project('release.py'),__file__,'exec'),globals())
