# Isolated support verifier bootstrap

This operational tool pins official `openpgp`6.3.1 with registry integrity in its
own lockfile. Install only here with
`npm.cmd install --prefix tools/private-key-bootstrap --ignore-scripts --no-audit --no-fund`.
The app and worker never import it. Node24 is required. OpenPGP.js is LGPL-3.0+;
the installed package includes its license.

RSA4096/v4 with one encryption subkey is tested against actual PostgreSQL17
pgcrypto. MDC integrity stays enabled; unauthenticated messages/streams and v6
keys are disabled. The command accepts bounded JSON through stdin and returns
private IPC only. Never invoke generation/decryption interactively or print its
output. The Python orchestrator captures it, retains recipient/key data only in
protected files and emits metadata-only receipts. Errors have fixed diagnostics.

Official sources: [OpenPGP.js](https://github.com/openpgpjs/openpgpjs),
[API](https://docs.openpgpjs.org/),
[PostgreSQL](https://www.postgresql.org/docs/17/pgcrypto.html#PGCRYPTO-PGP-KEYS).
