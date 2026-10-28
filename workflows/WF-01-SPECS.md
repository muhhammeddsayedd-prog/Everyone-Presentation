# WF-01 — Specs ingestion

**Milestone:** M02. **Job kind:** `specs_extract`. **User entry:** `submit_specs`. **Business rules:** BR-004–006, BR-008, BR-022, BR-032–036.

## Inputs

An existing authorized Casting workspace, one ready PDF/Word asset or pasted source text, initial specs record ID, source hash, current row versions and extraction configuration version. The server resolves these inputs; n8n does not accept a caller-selected storage bucket or SQL target.

Supported source paths: text directly; text-rich PDF; scanned PDF requiring page rendering/vision; DOCX text extraction; legacy DOC conversion when the worker’s configured converter supports it. Unsupported conversion returns a per-source issue with manual pasted-text fallback. Keep originals unchanged.

## Stages

| Stage key | n8n action / worker task | Durable result | Failure/retry behavior |
| --- | --- | --- | --- |
| `prepare_document` | Claim stage; ask native worker to inspect type, extract text and page/paragraph map; render/convert where needed | Extracted-text/page assets, source reference map, content hash | Corrupt/password-protected/unsupported content needs replacement/manual text; other queued jobs continue |
| `extract_specs` | Call OpenAI processing adapter with versioned prompt and structured schema | Payload matching `specs-extraction.schema.json`, evidence, usage/model/prompt metadata | Transient retries bounded; refusal/malformed result retains source and manual completion path |
| `apply_specs` | Ask application service to apply validated result with original source/version guard | Corrected initial specs, distinct roles and individual slots, clarification flags | Stale manual edits cause waiting-for-input/review, never overwrite silently |

The last apply stage is a domain operation, not an unrestricted database node. A role’s multiple scene references remain one role; supplied headcount determines slots. Unknown headcount remains a clarification with an explicit provisional UI default, not a fabricated extraction value.

## Output and user experience

The job succeeds with specs/workspace resource IDs and a summary of roles, created slots and unresolved clarification count. UI opens editable extracted requirements. Missing requirements do not block casting work or generation. The user/Claude can correct roles, count, slots and instructions using normal API operations. The specs are stable; no revision/diff/reconciliation workflow is generated.

Re-running the same job/input uses idempotent stage outputs and never appends duplicate roles. Corrected roles carry row versions; an older extraction cannot overwrite them. If the user deliberately resubmits initial material, the existing specs record is corrected with the relevant optimistic version, and previously assigned slots are not silently deleted.

## Acceptance cases

- Text, DOCX, text PDF and scanned PDF each yield editable source-backed requirements.
- Mixed Arabic/English is preserved in evidence and normalized into English labels.
- Father repeated across three scenes creates one role with those scene references, not three independent casting needs.
- Three waiters creates Waiter 1, Waiter 2 and Waiter 3.
- Missing gender, age or shoot date remains absent/Needs clarification.
- Ambiguous headcount remains flagged; any provisional slot is labelled as an app default.
- Duplicate webhook completion creates no duplicate role or slot.
- User edit during processing is preserved by row-version guard.
- An unreadable input can be replaced or completed manually without blocking unrelated candidate imports.
