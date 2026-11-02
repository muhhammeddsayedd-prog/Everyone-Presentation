"""New post-build two-read canonical40 preflight, disabled until Root review."""
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('forward_web_preflight_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
exec(compile(_projection.project('preflight.py'),__file__,'exec'),globals())
