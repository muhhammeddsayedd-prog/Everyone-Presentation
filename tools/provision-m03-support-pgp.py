"""Explicit root entry point; no operation during import."""
import sys
from m03_support_pgp import main
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Encrypted support bootstrap unconfirmed. Preserve claim/recipient; use explicit read-only recovery, never repeat insertion.\n');sys.exit(1)
