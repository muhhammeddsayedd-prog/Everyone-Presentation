# Live synthetic extraction checkpoint

`2026-10-28T19-31-30-526Z-0cfe7e61.json` records one actual OpenAI request using
the owner's privately configured `gpt-6.1-sol` and installed SDK7.45.1. The input
is the exact SHA-sealed synthetic pack brief `fixtures/source-specs.txt`, prepared
through the separate pasted-text parser process. No private business document,
candidate video or real personal fixture was sent.

The strict Responses output passed application schema/evidence validation and
the fixture checks: Father1, Manager1 and Waiter3; repeated scenes do not create
another Father; missing Manager gender/availability and Waiter gender stay null.
The neutral draft projection creates three roles/five slots locally in memory.
No Auth identity, cloud business row, database job or source asset was fabricated
or written. The input fingerprint is labelled `synthetic-evaluation.v1`, not the
database's pg-jsonb job hash. Requested/resolved model, prompt/schema hashes,
response/request correlation and usage are retained. Measured usage is1413 input
and1575 output tokens (2988 total); no billed monetary amount is asserted.

The SDK pins the official API endpoint and supplied key, disables retries/store/
tools/logging, and strips unrelated process account/admin/custom-header settings.
A real-SDK mocked-fetch regression failed before that fix and passes afterward.
That deterministic regression is distinct from the real request recorded here.

The private OpenAI and n8n management credential read checks separately returned
HTTP200. n8n's MCP connection still returns-32603; its management API works.
No n8n workflow was executed or modified. This checkpoint does not demonstrate
source submission, durable callback/lease application, hosted worker reachability,
representative real-source accuracy, an integrated M02 flow or production release.

`node --import tsx tools/evaluate_live_specs.mjs` deliberately makes one new real
provider request against this fixed synthetic brief. Importing the script does
not run it, and normal test suites do not invoke it. Do not rerun merely to
refresh timestamps; retain this actual observation until a specific change or
failure justifies another bounded evaluation. No keys or raw error bodies are
printed or recorded.
