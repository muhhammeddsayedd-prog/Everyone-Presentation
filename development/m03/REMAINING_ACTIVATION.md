# Guarded remaining-media activation

Hosting remains deferred. Configuration proof does not establish app acceptance.
Root owns real cloud/private-file writes and restarts. These authoring tools have
not inserted a real support key or changed a real support flag.

The target is pyibofyctwnqpvktepse, exact history19. Immutable18+19 sources,
proofs/promotions and the successful cloud release receipt are checked through
release_m03_remaining.current_release_inputs(). Fresh unrestricted readback
verifies the11-operation runtime and protected M02 job/specs/manual-note/input
hashes. Existing business data may be nonempty. Root coordinates a quiet window;
each mutation permits only its exact key/config change in fresh snapshots.

## Independent frame activation

The configure-m03-frames.py helper changes only frame DB configuration and then
only the frame private flag. It never reads the support private file. Root
reported cloud19, the separate candidate native-pin upgrade and both frame
activation steps complete before this support bootstrap authoring finished.
Historical frame receipts are retained. Owned local19 proofbce959bd passed with
complete rollback/source stability. Frame activation has no support dependency.

## Encrypted support-key bootstrap

Use tools/provision-m03-support-pgp.py. The existing pinned CLI receives only a
public RSA-v4 recipient, public nonce and reviewed metadata. PostgreSQL generates
32 random bytes inside the insert and returns only ciphertext, nonce HMAC and
lifecycle metadata. The verifier never enters SQL text/parameters, command
arguments, environment additions or public receipts. Node decrypts through a
private pipe and verifies HMAC. Before dispatch, protected owner/SYSTEM files
retain the private/public recipient, nonce, old unused support file and exclusive
claim. After canonical readback/HMAC verification, only the unused local hex is
replaced; the support flag stays false. Existing enabled frame state is preserved.

```text
.venv-skills\Scripts\python.exe -X utf8 tools/provision-m03-support-pgp.py --dry-run --release RELEASE.json
.venv-skills\Scripts\python.exe -X utf8 tools/provision-m03-support-pgp.py --provision --release RELEASE.json
```

For an uncertain result, retain .local/m03-support-pgp/ and the failed receipt.
Never repeat insertion or rotate the key. Explicit recovery only re-encrypts the
existing fixed key to the SAME retained public recipient and nonce:

```text
.venv-skills\Scripts\python.exe -X utf8 tools/provision-m03-support-pgp.py --recover --release RELEASE.json
```

Recovery compares a fresh read-only before/after snapshot. Original at-apply
whole-business preservation remains explicitly unverified after uncertain dispatch.

Actual local19 proof tracking/evidence/m03/support-pgp-bootstrap/2026-10-29T14-48-00-197Z-c221e77f-local.json passed DB-generated synthetic key, pgcrypto/OpenPGP RSA-v4 decrypt/HMAC, same-recipient read-only recovery, malformed-public-recipient error and enabled frame preservation. The generated key was absent from bounded statement statistics, server stderr and client output. All changes rolled back; sources stayed stable. Two earlier failed marker attempts remain retained. Fixed local-pgp-proof.json gates the real command against current templates/compiler.

Final SQL/crypto proof93c51ea0 at14:55:18 additionally requires an actual matching
bootstrap statement-statistics entry. Independent review then found a source
binding gap at dispatch. The fix compiles held validated template bytes and
rechecks operational source seals immediately before CLI dispatch, child crypto
IPC and private replacement. Twelve offline tests pass, including source mutation
after claim that prevents dispatch, child IPC and private writes. SQL/compiler/
crypto did not change. Independent final review found no remaining P1/P2.

## Support-only activation

The new configure-m03-support.py requires a successful encrypted bootstrap,
current enabled frame pin, exact private files and fresh canonical nonce/HMAC
challenge. Only public nonce/HMAC enter SQL. DB enable changes only the support
config; the separate local step changes only its flag false to true. Candidate
and frame files, key bytes and every unrelated snapshot field remain identical.

```text
.venv-skills\Scripts\python.exe -X utf8 tools/configure-m03-support.py --dry-run --release RELEASE.json --bootstrap BOOTSTRAP.json
.venv-skills\Scripts\python.exe -X utf8 tools/configure-m03-support.py --enable --release RELEASE.json --bootstrap BOOTSTRAP.json
.venv-skills\Scripts\python.exe -X utf8 tools/configure-m03-support.py --local-dry-run --release RELEASE.json --bootstrap BOOTSTRAP.json --activation SUPPORT_DB_ENABLE.json
.venv-skills\Scripts\python.exe -X utf8 tools/configure-m03-support.py --enable-local --release RELEASE.json --bootstrap BOOTSTRAP.json --activation SUPPORT_DB_ENABLE.json
```

Release basenames resolve only under tracking/evidence/cloud-m03-remaining/;
bootstrap basenames under tracking/evidence/m03/support-pgp-bootstrap/;
activation basenames under tracking/evidence/m03/remaining-activation/. Dry-runs
expire after15minutes; claims are exclusive. Unknown writes never retry.

Owned local19 support activation proofc1ccbcfe14:50:57 passed wrong-HMAC denial,
matching challenge, support-only config change, frame/key preservation and exact
rollback/source stability. This is synthetic DB proof, not a supporting-file upload.
Final unchanged-SQL/compiler proofd0a50e2e at14:55:41 is the fixed proof entry.

## Dependency and retired research paths

The isolated tools/private-key-bootstrap/package-lock.json pins official
OpenPGP.js6.3.1 with registry integrity. Its LGPL-3.0+ license remains installed.
Node24 is required. App/worker never import this package and the main lockfile is
unchanged. RSA4096/v4 with one encryption subkey follows the documented
[pgcrypto constraints](https://www.postgresql.org/docs/17/pgcrypto.html#PGCRYPTO-PGP-KEYS)
and [OpenPGP key generation API](https://docs.openpgpjs.org/global.html#generateKey),
then is verified by the actual local round trip. MDC integrity stays enabled.

Do not execute older literal-key provision-m03-support-key.py or combined
configure-m03-remaining.py key/activation entry points. Their logging guards stay
blocked. Actual read-only cloud receipt28125cd4 found restricted SET privileges
and enabled statement/error/explain logging. No global setting/role was weakened.
The bound-Management-API credential prototype remains inert research; this
public-only encrypted bootstrap uses the existing CLI without a new credential seam.
