# Scoped HTTP logo failure trace

The logo adapter's safe error details were already returned by HTTP, but the UI
displays only the message. This change emits a closed server event in the
existing API route catch so a future attempt can be correlated without reading
a browser session or private network payload.

`logo_request_failed` contains only `request_id`, a closed application `code`,
`logo_phase`, `storage_http_status`, `storage_body_status` and `storage_code`.
The phase must be one of the adapter's ten known values before anything is
logged. HTTP status values must be integers from 100 to 599; Storage codes use
the same fifteen official names accepted by the adapter. Unknown values become
null or the static dependency code. The correlation is the route-generated
UUID. No principal, resource ID, request, exception, message, arbitrary detail,
URL, key, header or body is serialized. Unmarked failures emit nothing.

The catch still returns the existing `failure()` response unchanged. Throwing
diagnostic getters or synchronous/asynchronous sink failures are suppressed.
No UI flow, auth, RLS, grants, mutation contract, provider retry or configuration
is changed. The two product changes are web-only: a new logger and its import
and invocation in the existing HTTP catch. Worker/native sources, dependencies,
package manifests and lockfiles are untouched.

Five new deterministic tests include two exported HTTP-route journeys through
the real pinned Supabase SDK with fake Auth/RPC/Storage responses. A mint
wire 400/body 403 and completion-download wire 400/body 404 retain their 403/409
responses and log the same request ID. Both initially failed because no event
was emitted; they pass with the logger. Further tests check private canaries,
malformed values, unmarked errors, hostile getters and throwing/rejecting sinks.
The earlier fixture iterations lacking Host and a routing RPC were corrected
before the final meaningful red run; their ignored logs remain retained.

The new five tests plus the existing guest-log four and logo-storage twelve
pass 21/21. Typecheck and lint both exit 0. These are local fake-boundary checks,
not a new production upload or proof of the earlier managed Storage failure's
cause. Root owns the later deployment and any one new real attempt.
