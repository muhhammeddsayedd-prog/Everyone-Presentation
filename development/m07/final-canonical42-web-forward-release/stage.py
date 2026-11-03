"""Fresh immutable exact selected Main archive; OFF/unbound before ports."""
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('final42_stage_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
exec(compile(_projection.project('stage.py'),__file__,'exec'),globals())
