# Source submission and native execution checkpoint

Code commit `da77ab4` follows the ninth database release `8c514a7` and the
pasted-source/provider-isolation change `527fa79`. All nine applied migration
files remain unchanged. Source submission and stage SQL candidates are separate
from this committed HTTP/SDK/native code and are not enabled in the cloud.

`checkpoint.json` seals the public source and actual gate logs. The broad suite
passed188 tests:81 unit/server,5 contracts,12 jobs,15 integrations,34 worker and
41 central. Build/typecheck, production fixture denial,15 offline configuration
checks and325 strict pack checks pass. A prefer-const lint failure is retained
in `final-lint.log`; full lint passes in `final-lint-fixed.log`, and the12
executor tests reran after that lint-only correction. The earlier170 and185
test logs are historical. No newer browser run occurred; the19 controlled
browser cases belong to the separately retained c2df325 checkpoint.

The verified-user facade preserves original Arabic/BOM/CRLF source, Spec version,
request identity and a16-200-character idempotency key. It validates the exact
durable acknowledgement and same-job polling route. It reports actual reused
job status instead of inventing another enqueue. HTTP returns202 only after RPC
acceptance; missing/disabled processing remains an honest503.

Independent executor review found four integration defects before acceptance:
an extra SQL apply-input source hash, the SQL64-hex versus pure-kernel43-base64url
lease encoding, an unresolved heartbeat blocking cancellation, and a lease
expiring during input read before paid extraction. Fixes validate the real SQL
shape, treat tokens as bounded opaque credentials, bound/abort gateway waits
and recheck expiry/cancellation before expensive work. Reproduced regressions
pass. Detached lease/configuration, serialized heartbeat/terminal ordering,
safe failures and no second terminal publication also pass. The helper does
not retry a model request or pretend an unknown callback was delivered.

These tests use actual synthetic document parsing and injected gateway/provider
responses. They do not establish authenticated transport, persistent SQL stage
application, dispatcher recovery or n8n execution. One actual OpenAI synthetic
request is recorded separately under `../provider-evaluation/`; it did not use
this gateway/executor or apply database facts. The local parser container proof
is likewise separate under `../document-container/`.

The owner selected continued local testing with hosting decided later. No
worker host, runtime service identity, workflow credential, source asset or new
cloud job was fabricated. Source replacement, the source form, private document
outputs, the persistent integrated pipeline and complete M02 acceptance remain
unfinished. Historical failures and completed side effects stay preserved.
