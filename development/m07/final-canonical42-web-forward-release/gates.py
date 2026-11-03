"""Inert source/quality admission plus actual42 proof/checkpoint gate."""
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('final42_gate_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
exec(compile(_projection.project('gates.py'),__file__,'exec'),globals())
