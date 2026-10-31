# Hosted OAuth final31 preparation

This separate family prepares app-side OAuth after the hosted core checks.
Its seals now bind actual `HOSTED_CORE.json` SHA `4591f101…`, all fifteen public
evidence leaves, canonical31 readback `222f51dc`, and the reviewed sources.
The source authors performed no provider, credential, client, database or Claude
operation. Root's fresh guard and operator results are recorded separately.

The completed adoption chain remains frozen. In particular, do not edit
`oauth31-guard.py` (`2bb655b6…`), `OAUTH31_PLAN.json` (`32520a46…`), the existing
provider/client/binding/web31 family, or any completed worker/frame operator,
claim or receipt. The new guard pins that old provenance as immutable public
source. Its separate plan retains actual canonical31 readback `222f51dc` and
the reviewed canonical sources. The existing read-only `OAUTH31_GUARD.sql` and
`HOSTED_BINDING31.sql`/readback are reused without changing their bytes.

The new entry points are:

- `hosted-oauth-final31-guard.py` with `HOSTED_OAUTH_FINAL31_PLAN.json`.
- `hosted-provider-final31.py` for the reviewed six Auth configuration fields.
- `hosted-oauth-client-final31.py` for the actual public client.
- `hosted-binding-final31.py` for its one resource binding.
- `hosted-web-oauth-env-final31.mjs` for the public MCP environment values.

Each operator has a distinct final31 claim directory and receipt suffix. The
resource stays `https://everyone-presentation-pilot.vercel.app/mcp`, issuer stays
`https://pyibofyctwnqpvktepse.supabase.co/auth/v1`, and the public-client callback
stays `http://localhost:3118/callback`. Dynamic registration remains disabled.
No client UUID is invented, and no Claude configuration, login or model call is
performed by these helpers.

Sealing used only this new family, in the following order:

1. Validate the actual core receipt and evidence references; set only the new
   plan's core SHA and final status, retaining the actual canonical release pins.
2. Put that plan SHA in the new guard and hash the new guard.
3. Put the guard SHA in the four new operator seals, hash the new provider/client,
   update the new binding's client pin, then update the new web child pins.
4. Run the pure tests and independently review the final pin delta. All 64 Python
   and 14 Node cases passed. The final plan is `dea972d1…`, guard `703be716…`,
   provider `c239a6dc…`, client `31d831d4…`, binding `fe5339a1…`, and web helper
   `7f4a0408…`. These consumed files are now frozen; preserve exact bytes after
   any operator claim too.

The dependency order is one-way; the guard never pins its new operator children.
The test suite mocks operational subprocesses, including the web bridge, so
future sealing must not turn a pure test into a database or provider request.

```powershell
python -m unittest discover -s development/m07/controlled-pilot -p 'test_*final31*.py'
node --test development/m07/controlled-pilot/hosted-web-oauth-env-final31.test.mjs
```

Root's reviewed operator sequence is provider inspect/apply/
readback; client inspect/create/readback; binding inspect/apply/readback with
the actual client UUID and actual client receipt; web preflight/apply with the
actual provider, client and binding receipts. The operator argument names and
unknown-outcome readback rules remain those of the reviewed source copies.
Root then deploys the app configuration and runs hosted readiness. These source
files do not prove provider activation, OAuth login, MCP connection or a full
production release. The user configures and signs in to Claude Code themselves.
