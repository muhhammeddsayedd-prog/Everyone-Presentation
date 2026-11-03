"""Two fresh unchanged SQL reads plus normal GET-only current worker identity."""
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('logo_recovery_preflight_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
exec(compile(_projection.project('preflight.py'),__file__,'exec'),globals())
