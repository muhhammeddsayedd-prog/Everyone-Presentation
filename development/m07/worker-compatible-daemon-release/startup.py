"""Same exact complete-window projector; a fresh dispatch flag only."""
from pathlib import Path
import importlib.util
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('compatible_startup_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
old=a.library('startup.py')
OBSERVE_ENABLED=False
FIELDS=old.FIELDS;PROJECT=old.PROJECT;TEAM=old.TEAM;ENDPOINT=old.ENDPOINT;HEADER=old.HEADER
base=old.base;scope_value=old.scope_value;request=old.request;startup=old.startup
