"""Emit public metadata SQL only for the isolated local controller proof."""
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('release_v2_local_sql',Path(__file__).with_name('release_v2.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
print(module.state_sql())
