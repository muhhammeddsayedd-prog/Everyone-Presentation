# Direct specs service gateway

`@eps/central/specs-runtime` exports `readSpecsRuntimeConfig(values)` and async
`createSpecsRuntimeGateway(config)`. It is a separate server-only subpath; the
ordinary user-session adapter does not load the PostgreSQL driver. Imports do
not read files, connect, provision credentials or invoke a provider.

The fixed local worker launcher supplies only these PostgreSQL fields from its
protected runtime configuration:

- `EPS_SPECS_PG_HOST`: the owner-observed `aws-0-eu-west-1.pooler.supabase.com`.
- `EPS_SPECS_PG_PASSWORD`: the genuine narrow runtime role's private password.
- `EPS_SPECS_PG_CA_BASE64`: canonical base64 of the trusted CA's PEM certificate.

The target is fixed to canonical project `pyibofyctwnqpvktepse`, database
`postgres`, session-pooler port5432 and login
`eps_specs_runtime.pyibofyctwnqpvktepse`. No URL, schema, SQL, role, port, JWT or
`PG*` fallback is accepted. The adapter rejects ambient libpq configuration
without mutating the environment. TLS verifies the supplied CA and hostname,
requires TLS1.2 or newer and has no plaintext/unverified fallback.

Exact driver versions are `pg8.23.1` and `@types/pg8.23.1`. A small pinned client
subclass rejects cleartext and MD5 authentication before releasing a password,
and requires the SDK's completed SCRAM exchange. The SDK performs the SCRAM
server-proof validation; the adapter does not implement authentication itself.
Because the password handlers are SDK implementation hooks, the offline suite
exercises the real pinned SDK against synthetic authentication messages,
including invalid server proof, TRUST and legacy-password rejection.

Every transaction checks its real current/session login, effective app-table
and column denial, schema-create denial, exact executor/dispatcher memberships,
exact six function permissions, absence of user JWT context and safe effective
logging settings before private parameters are sent. No acting-user principal
is manufactured. Existing database functions independently authorize each
stored requester and validate source, scope, attempt and lease.

The gateway exposes `claimOutbox`, `finishOutbox`, `claim`, `getInput`,
`recordEvent`, `recover` and `close`. Function names and SQL are fixed;
arguments use unnamed extended-query parameters. Connections and transactions
have deadlines, the pool admits at most two connections, and requests are
never retried internally. NUL/unpaired UTF16 input is rejected before SQL.
Driver diagnostics, notices, connection objects and private values are never
logged or attached to errors. Errors carry only safe `code`, `status` and
`outcome: known | unknown`. Network, cancellation after dispatch and lost
commit responses remain unknown; the worker stops that attempt and relies on
durable lease recovery.

This is direct PostgreSQL service access, not an implemented HTTP
`ServiceBearer` endpoint or exact-key claim-response replay facility. The
current claim token cannot be recovered from its stored digest after a lost
response. No immediate model retry is authorized by an uncertain claim or
callback. HTTP idempotency, service deployment and real credential/TLS/provider
acceptance require their own evidence.

Tests inject transport results and use synthetic SCRAM messages; they do not
prove a live cloud login, production authentication, TLS certificate chain or
real OpenAI/n8n processing. Root owns provisioning, release and real execution.

Primary references: [parameterized queries](https://node-postgres.com/features/queries),
[client configuration](https://node-postgres.com/apis/client),
[TLS configuration](https://node-postgres.com/features/ssl), and
[Supabase connections/custom roles](https://supabase.com/docs/guides/database/connecting-to-postgres).
