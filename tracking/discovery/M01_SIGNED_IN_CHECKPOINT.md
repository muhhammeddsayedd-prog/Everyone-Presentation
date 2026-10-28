# M01 enrollment and browser recovery checkpoint

The owner reported a successful email sign-in in another Chrome profile and an
unauthorized/empty project screen. Actual read-only Auth inspection at14:09:34Z
matched one confirmed, signed-in, nonanonymous, nondeleted, nonbanned account.
The reviewed bootstrap transaction at14:10:07Z pinned that account and granted
exactly the four M01 capabilities plus writable membership for Dummy Test and
Dummy Client. The transaction and readback passed. It created no Auth user,
workspace or media. These are setup operations, not an acting-user API journey.

Fresh scoped administrator metadata at14:54:01Z confirms both writable memberships,
all four capabilities, requested canonical names, row versions1 and no archived
record. That snapshot has no workspaces, upload sessions or Ready logos for the
test project. See `tracking/evidence/m01/signed-in/scoped-live-metadata.json`.

The owner then closed the other Chrome and tried the connected Person1 profile.
That profile's email request returned the former generic429 message. Read-only
Auth configuration inspection confirms a `1m0s` per-user resend frequency; this
CLI view does not expose project email quota or SMTP configuration. No Auth
setting, confirmation rule or rate limit was changed, and the agent sent no email.
The documented email-limit code can describe both resend frequency and sending
limits, so neither that code nor429 establishes an exact reset time.
[Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits) and
[Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).

The sign-in route now maps safe documented codes separately for email throttling,
request throttling, configuration restrictions and unknown delivery failure.
It makes one explicit provider request, never automatically resends, never emits
provider message/body text and gives same-browser guidance. A deterministic
server snapshot fixes the callback-error component's initial-render mismatch.
The actual connected browser displayed the controlled `auth=failed` recovery
view with an actionable message, then returned to `/projects`. That test did not
consume an actual expired callback or sign in. An extension-injected hydration
warning remains distinguished from app errors; sampled other errors were0.

## Prepared hosted Storage probe

An independently reviewed development utility is available at
`/dev/central-logo-probe`, POST `/api/dev/central-logo-probe`. It requires both
development environment signals, Supabase mode, an explicit process flag and the
fixed canonical project. It accepts only a workspace UUID, rejects bearer
substitution and foreign origins, uses the verified cookie actor and ordinary
resource checks, and targets only newly reserved private probe assets. No
service-role, arbitrary bucket/key/URL/SQL input or auth-impersonation path exists.

The approved existing brand PNG remains unchanged. A distinct tiny test PNG is
used only for forbidden replacement attempts. Signed URLs, user credentials,
proofs and provider bodies stay in server memory. Reports contain safe IDs,
numeric statuses, hashes/dimensions and explicit evidence limits. Empty successful
delete responses pass as no-effect only after a fresh authenticated byte check;
they are not called403 denials. Permission-hidden404 is accepted only for explicit Ready mutations after known-original SHA checks before and after. Unknown/generic400, network failures and transport5xx bodies never qualify as authorization denial. Failure-after-write tests detect changed bytes.
Cancellation reports the closed URL projection without claiming instant
revocation of already-issued Storage tokens.

The owned central server was restarted in session30061 with development logo
verification and `EPS_CENTRAL_LOGO_PROBE_ENABLED=true`; `.env.local` was not edited.
Actual HTTP checks at14:46:11Z confirm anonymous401, bearer substitution403 and
foreign-origin403 with no-store responses. They did not execute the Storage probe.
The connected Chrome tab1091386285 remains signed out and is kept as a handoff.
No live signing, byte transfer, overwrite, cancellation or normal workspace/logo
journey is established by having this helper.

## Validation and next action

Current root validation in `tracking/evidence/m01/signed-in/validation/` passes
104 module tests, lint, typecheck and a build using the separate `.next-e2e`
output. Four browser/HTTP journeys pass against the explicitly synthetic adapter
on3100, with traces off. The probe's ten tests use the installed SDK with
injected transport plus actual Sharp/HMAC work; they are not hosted Storage
acceptance. Earlier SQL/race/Python checks retain their own timestamps.

Recover the enrolled user's session in the connected Chrome profile, or reopen
the original profile if its session is still active. Request/open any new email
link in the same profile, without repeated automated requests. No re-enrollment
or regrant is needed. Then select the existing canonical project, create/reuse
its workspace through the app, run the normal M01 journey and the guarded probe,
and record actual receipts. M01 remains in progress. n8n's latest actual project
lookup still returned MCP-32603; M02 and later live provider/release gates remain.
