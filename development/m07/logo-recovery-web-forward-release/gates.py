"""Pure exact1019/7c8/9mi/40/native3d/current-Fxd admission."""
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('logo_recovery_gate_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
exec(compile(_projection.project('gates.py'),__file__,'exec'),globals())
