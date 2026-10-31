# Worker pilot environment operator

`worker-environment.mjs` is an operator outside the frozen native/daemon image
graph. Its author has not run inspect/preflight/apply, accessed private values or
called a provider. The exact earlier `77796f0a…` source is retained at
[source-history](../../../tracking/evidence/m07/controlled-pilot/source-history/worker-environment-77796f0a.mjs).
This revision qualifies CLI retry behavior; it does not rebuild/reseal the frozen
`0ddf519a…` / `2e551bb2…` images or prove a working hosted worker.

The root operator can use:

```powershell
node development/m07/controlled-pilot/worker-environment.mjs inspect
node development/m07/controlled-pilot/worker-environment.mjs preflight
```

Inspect is metadata-only. Preflight loads the existing reviewed private worker
configuration in memory and requires the actual baked manifest in the fixed
`2e551bb2…` context. No dummy image/digest is accepted. Neither action writes a
file or a project variable. Review their closed metadata before root executes
`apply`, after the independently required native boundary/cleanup proof.

The fixed worker project/team, Node24, null project root, OIDC enablement,
CLI65.8.0 and existing protected global-config directory are checked before
transfer. Two installed public CLI chunks are SHA-pinned before authenticated
CLI access. The existing loader projection selects28 fields, including all seven
enabled features and owner-controlled operation until manually stopped. Twelve
credential/provider fields use Sensitive storage; public flags, models and
canonical publishable configuration are plain. No management/personal credential,
service-role key, database URL, local image ID or user-supplied platform/OIDC field
is uploaded. Private values and ciphertext are never logged, hashed or placed in
claims/journals/receipts. The only value hash is the public manifest's hash.

Apply requires an initially empty project-variable inventory, a permanent
fsynced exclusive claim, and a second empty inventory after that claim. Each
logical POST creates one variable for production only with `upsert=false`.
Per-key attempted/created journals hold metadata only. Unknown responses stop all
later keys and perform two independent metadata reads. There is no helper retry,
resume/upsert path or automatic claim deletion. A partial inventory requires
read-only reconciliation, never a blind second apply.

The pinned CLI transport may retry network/HTTP5xx failures three times, giving
at most four retry-loop attempts per logical operation including the first.
Each attempt may also perform one DPoP nonce correction; authentication
maintenance can add requests. **Four is not an exact wire-request count.**
The same loaded value and unique key are used across CLI attempts. If a lost
create reply is followed by a duplicate-key failure, only the first create can
exist, and the outer helper stops rather than proceeding to the next key.

Claims and all receipts distinguish `helper_write_retry:false` from
`cli_network_5xx_retries_maximum:3` and
`cli_request_attempts_maximum_per_operation:4`. Counts of attempted variables and
confirmed create responses describe logical CLI operations, not network traffic.
Metadata readback does not prove secret plaintext, Daemon startup/OIDC refresh,
native isolation, real OpenAI/n8n/Storage jobs or full hosted acceptance. Root
must verify those separately. AT-072/M03 remain pending, mobile testing skipped,
and Studio production release acceptance remains unverified.
