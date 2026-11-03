"""Fresh default-OFF MCP logo text source deployment; no consumed entry runs."""
from pathlib import Path
import importlib.util
RELEASE_ENABLED=False
_spec=importlib.util.spec_from_file_location('mcp_logo_text_web_projection',Path(__file__).resolve().parent/'projection.py')
_projection=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_projection)
__forward_enabled__=RELEASE_ENABLED
exec(compile(_projection.project('release.py'),__file__,'exec'),globals())
