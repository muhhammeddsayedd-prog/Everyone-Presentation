"""Fresh exact immutable archive; source/quality/delta must be bound first."""
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('pdf_metadata_stage_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
exec(compile(_projection.project('stage.py'),__file__,'exec'),globals())
