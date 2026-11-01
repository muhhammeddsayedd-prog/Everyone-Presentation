# Settings API error boundary: negative finding

The generic route returns the Settings handler promise without an outer
`await`. This observation did **not** reproduce an escaping error:
`handleSettingsRequest` already wraps its awaited `getSettings` and
`updateSettings` operations in its own try/catch and returns `failure` itself.
The service constructor is also awaited inside the generic route's catch.
No production source was changed and no Settings bug fix is claimed.

The actual exported API route regression in
`tests/server/settings-api-route.test.ts` uses the pinned Next request/work
context and wholly synthetic verified-user auth/RPC HTTP boundaries. It passes
on the existing implementation: denied RPC (403), asynchronous transport
rejection (503), invalid authentication (401) and invalid query (400) all preserve
safe structured errors, a request ID, no-store and diagnostic redaction.
Invalid queries do not invoke the Settings RPC. No server or provider starts,
and no Settings row is written. Together with the existing central facade and
HTTP/MCP parity suites, all seven focused Settings tests passed.

This differs from the Summary helper's confirmed missing-await regression,
which escaped its route catch before the Summary branch was fixed in 1db430d.
The completed owner Claude connection acceptance, English rollout, screen-reader
pending state, mobile skip and running pilot are unchanged.
