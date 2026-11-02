# One-request Specs evaluation candidate

Status: source preparation only. No provider call, retry, deployment, configuration
change or result writeback has occurred. The failed Samsung PDF47 job, its three
attempts and unknown charges remain intact. This is separate from n8n/job and
production acceptance.

The optional `reasoningEffort: 'low'` adapter setting is an evaluation candidate.
Omitting it retains the existing request, including the provider's reasoning
default. Environment configuration does not enable it. The candidate changes
only `reasoning: { effort: 'low' }` in the request; it keeps the existing model,
prompt, source paragraphs, strict schema,16,384 output-token ceiling,60s deadline,
store:false, tools:[], stream:false and SDK retries0. No extraction fields or
evidence/Unicode validation are removed. Synthetic success tests establish
request compatibility, not factual quality or performance.

Current [model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
lists low as supported and medium as the default. The
[reasoning guide](https://developers.openai.com/api/docs/guides/reasoning)
explains that output-token limits include hidden reasoning. The configured
16,384 limit is therefore not a guarantee of that many structured-result tokens.
The [latency guide](https://developers.openai.com/api/docs/guides/latency-optimization)
identifies generated tokens as a major latency contributor. These sources make
low effort a testable option; they do not establish why the three real attempts
reached60s. No completed response, usage or reasoning-token count was retained.

The source envelope is a single nonstreaming request. Its observed prepared input
has24 mapped pages,219 paragraphs and12,807 text bytes, within the existing2MB
input limit. Each role emits seven required fields, eleven requirements keys and
eight-field source references. Lists/free text have no cardinality/length bounds
in this schema; the prompt also requests missing-field clarifications and exact
source quotations. Output complexity is not bounded by page count alone. Do not
raise output limits, truncate facts/evidence, split calls, change models or raise
timeouts as an unmeasured workaround.

The canonical `eps.specs_stage_metadata` contract admits exactly15 metadata keys
and fixed prompt/schema hashes; job configuration admits four keys. The candidate
preserves those bytes and does not falsely add effort to existing persisted
metadata. The evaluation's separate safe receipt must record the actual selected
effort and full request/source identity before dispatch. Any later production
activation needs explicit durable request/configuration provenance; this
evaluation-only setting is not production activation.

Root reviews source, exact worker/job budget findings, private-input handling and
the one-request budget before executing this plan:

1. Use only the retained preparation for job
   `47f86513-8999-4946-b5d9-f2fd6a18fd00`, source asset
   `0fbc905f-c51e-472d-9d03-74664ee9ac86`, original3,058,335 bytes. Fetch through the
   existing bounded read-only guard; verify the accepted source/preparation
   identity, paragraph indexes/page mapping/counts and hash before processing.
   No OCR, native preparation or new source version is needed. Keep the actual
   source and result exclusively in protected ignored files/RAM.
2. Bind the candidate commit and source/prompt/schema hashes, pinned SDK7.45.1,
   requested model `gpt-6.1-sol`, exact prepared-input identity, request settings,
   agreed accounting limit and a fresh run UUID. The provider configuration must
   be the authorized existing normal configuration. Never extract another
   client's credential cache, copy secrets into the helper or print raw errors.
3. Create one exclusive permanent dispatch claim before the single SDK call.
   Record low effort,60,000ms deadline,16,384 output tokens and retries0 in the
   safe receipt before dispatch. Do not use the public Retry action: it can
   schedule three durable provider attempts. No job/outbox/callback is emitted.
4. Make exactly one `extractSpecs` call with the explicit low setting and the
   retained paragraphs. SDK retries remain0. A timeout, transport failure,
   cancellation or unknown response stops permanently; do not resubmit the
   consumed claim. Provider work/charges can be unknown after cancellation.
5. For an actual response, retain raw output privately and validate the unchanged
   full schema, paragraph/page/quote evidence, source identity, distinct role
   keys and PostgreSQL-representable Unicode. Emit only closed status/error
   codes, duration, safe provider request/response IDs, model/settings, usage
   counts (including reasoning-token count when present), validation result,
   role/evidence/clarification counts and immutable source references. Never
   publish document/result text, headers, keys, private URLs or raw errors.
6. Compare the validated result privately against the real brief for role
   coverage, headcounts, negation, missing values and exact evidence. Stop after
   this one response; do not write it into specs/roles or describe this as
   factual accuracy, n8n recovery, full job completion or production acceptance.
   A passed bounded evaluation supplies evidence for the next release decision.

No evaluation helper has been armed and no paid request is authorized by this
document. Previously preserved failure and cost evidence must remain unchanged.
