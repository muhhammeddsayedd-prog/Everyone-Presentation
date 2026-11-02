# Disabled one-call low-effort evaluation

Both live flags are false. No retained source, provider configuration or private
file is read during import or default-off CLI refusal. This implements only the
[reviewed one-request plan](../pdf47-transport-fix/LOW_EFFORT_EVALUATION_PLAN.md).
It does not retry PDF47, emit a job/outbox/callback, apply a result or establish
production/n8n/factual-quality acceptance.

After Root reviews source and the known budget limits, `prepare` uses the pinned
existing bounded normal SupabaseCLI2.122 reader for exactly one read-only query
of the fixed failed job/source. It verifies the original asset/source/job hash,
ready status,24-page/219-paragraph/12,807-byte preparation and configured model.
The real paragraph mapping remains in protected Main .local files. The existing
pinned Win32 current-owner+SYSTEM guard protects source SQL, input, permanent
dispatch claim and validated output. There is no credential file/cache reader.
The private bridge receives a whitelist environment without the provider key.

`evaluate` uses only the existing authorized process API-key/model configuration.
It fixes gpt-6.1-sol/low/60s/16,384 output tokens/SDK retries0 and verifies the
reviewed adapter source hash and SDK7.45.1. The default worker request remains
unchanged. Source hashes and the selected settings enter an exclusive permanent
claim and safe predispatch receipt before the one adapter call. The raw source
and validated result never enter public receipts; existing adapter metadata,
usage, request IDs, counts and safe failure codes can. Reasoning-token count is
unobserved because no additional response observer was introduced.

The same run cannot dispatch twice, including after a timeout, lost response,
private-persistence failure or receipt error. A consumed claim stops; it is not
deleted or resumed. A different UUID is another potential paid request and needs
Root's separate budget decision. One failed/unknown request does not establish
zero charges or remote cancellation. Raw error messages/headers/URLs are never
printed. No secret/config loader, new identity, native processing or mutation
transport is included.

The new runner/bridge are source-only helpers outside the native/daemon image
graph. The optional adapter change is the separate `dfec3fa` candidate. Root must
arm only these new helper flags after review; no actual prepare/evaluate has run.
The public evidence directory must exist before evaluation. Root supplies the
existing authorized provider configuration privately, never through argv or
source. Reviewed commands, shown for later execution only:

```
node --import tsx development/m07/pdf47-low-effort-evaluation/evaluate.mts prepare <new-run-UUID>
node --import tsx development/m07/pdf47-low-effort-evaluation/evaluate.mts evaluate <same-run-UUID>
```

Offline checks use injected ports/synthetic temporary files only:

```
node tools/run-tests.mjs development/m07/pdf47-low-effort-evaluation/evaluate.test.mts
D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe -X utf8 -B -m unittest discover -s development/m07/pdf47-low-effort-evaluation -p test_*.py
node node_modules/typescript/bin/tsc --noEmit -p development/m07/pdf47-low-effort-evaluation/tsconfig.json
```
