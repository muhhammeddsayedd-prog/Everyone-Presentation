# Canonical31 compact continuation

This is a separate, explicitly requested operator after the retained unknown
`ea8a5943` attempt. The original `88493c6d` controller, permanent claim and
receipts remain unchanged. A later synthetic read-only request of the same
6,999,662-byte length received HTTP413. That observation does **not** establish
the original request's wire outcome.

The new renderer sends less than 64,000 bytes. Its pinned read-only query returns
the full selected state and a PostgreSQL-computed SHA256 of that state with only
the CLI login expiry normalized. The transaction captures the actual state,
checks that hash and the exact CLI role identity/bounded expiry, and retains the
actual preimage in a transaction-local GUC. After the unchanged reviewed `c1c4`
candidate and one history insert, it compares the full selected state against
that preimage with only the ACK body and the two history arrays changed.
No business data, permissions, roles or generic Job DTO are changed.

Before any dispatch, fresh state must still equal the original claimed
canonical30 predecessor apart from the already qualified CLI expiry. Monitoring
must be enabled and the reader must have complete activity visibility. Every
other client-backend transaction with nonnull `xact_start` at or before the
original finish time (`2026-10-31T01:37:38.327713+00:00`) must be absent, including
idle or aborted transactions. The same fence runs under the history/business
locks and again before commit. It uses no query-tail marker. These are bounded
database observations; they cannot prove the state of a queued remote HTTP
request. Exact predecessor comparison, history locking and unique history31
insertion also guard a delayed competing batch.

Root runs each command separately after source review and examines its closed
receipt before proceeding:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/specs-ack31/canonical-continuation.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/specs-ack31/canonical-continuation.py dry-run
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/specs-ack31/canonical-continuation.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/specs-ack31/canonical-continuation.py readback
```

The new Owner/SYSTEM private directory is
`.local/m07-specs-ack31-continuation/`. Its claim is created exclusively and
fsynced before one logical dispatch. The original claim is verified and retained.
An unknown result stops further writes; use `readback`, never replay `apply` or
delete either claim. Source changes after a claim invalidate admission.

A nonce appears at the start of the SQL and in `application_name`. A valid normal
return marker bound to the continuation claim plus two full preserving readbacks
is required for `passed`. Desired-state observations without that marker remain
`unconfirmed`. Independent `readback` requires the same marker and baseline.

Failure receipts record only bounded exit status, timeout, selected HTTP/SQLSTATE
codes and fixed guard tokens. Raw CLI output, error text and baseline state are
never copied into public evidence. CLI internal retries remain uncharacterized;
`helper_dispatch_retry:false` is not a one-wire-request guarantee.

Source-only tests include a behavioral RED using the preserved old renderer:
the large synthetic baseline produced 7,243,664 bytes and failed the 64,000-byte
bound. The compact renderer and conservative fence/diagnostic/process tests pass.
Parser checks establish SQL/PLpgSQL syntax only. Actual continuation admission,
commit, preservation and independent readback remain root-executed evidence.
