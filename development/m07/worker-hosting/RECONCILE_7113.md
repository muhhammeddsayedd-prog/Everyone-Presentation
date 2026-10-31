# Retained7113 probe reconciliation

The failed smoke receipt `7113cb6d` records three known stable resource/session
identities and a retained local probe lock. Its final verification flags are
unknown; they do not establish that those resources still exist. The original
failure remains unconfirmed even after later cleanup is proven.

`tools/reconcile-hosted-native.mjs` admits only that exact receipt SHA256,
unchanged lock bytes, fixed worker project/team, sourcebc774 and actual image7846.
Root first executes after source review:

```powershell
node tools/reconcile-hosted-native.mjs inspect
```

It mints the same fixed project OIDC token through the pinned authorized CLI,
keeps it only in memory, and sends five bounded direct GETs: the three exact
names with `resume=false`, the project's `eps-native-` list and the project's
snapshot list. Raw HTTP statuses and closed count/pagination/parser outcomes
enter a new receipt. Bodies, headers, token values and diagnostics do not.
There is no SDK parser, retry, redirect, broad credential-file reader or CLI GET
fallback. The token mint is a logical CLI invocation whose internal auth/retry
behavior is preserved; resource GETs have no helper retry. Each GET has15 seconds,
the GET phase120 seconds and the body buffer1MiB. No create/resume/stop/delete,
snapshot, native command, input upload, database or worker action exists.

Only all three exact GET404s plus successful empty lists with `count=0` and
`next=null` prove complete absence. Extant resources, unknown transport results,
nonempty snapshots, pagination or malformed envelopes retain the lock. An
extant resource needs separate exact ownership review before any cleanup
operator is authored; this helper never adopts or deletes it.

After the read-only proof, root may explicitly execute:

```powershell
node tools/reconcile-hosted-native.mjs unlock
```

Unlock takes a permanent exclusive/fsynced once-claim, performs two new full
absence rounds, checks unchanged original sources/receipt/lock, writes a durable
new absence proof, rechecks those inputs, then unlinks only the fixed local lock.
It cannot turn an old unknown flag or stale earlier receipt into absence credit.
Unknown outcomes are inspect-only until reconciled; no automatic unlock retry
or broad cleanup is provided. Pure tests and author source checks are separate
from root's actual provider and lock receipts.
