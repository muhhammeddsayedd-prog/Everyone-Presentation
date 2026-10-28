# Source register and evidence boundaries

Prepared 27 October 2026. User requirements are drawn from the supplied conversation and recorded in CONTRACT_BASELINE.md and tracking/DECISIONS.md. They are product decisions, not claims made by a vendor. Architecture defaults are recommendations. No current cloud schema, credential access, measured AI accuracy or production deployment is claimed.

Technical references below were consulted for the associated capability. Recheck current official documentation and available account capabilities when implementing; pin tested versions in the environment inventory. Links support specific technical facts, not a guarantee that this app is already integrated.

## S01

[Next.js — Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend). Route handlers can expose HTTP operations; request/runtime limitations motivate separate durable media workers in this design.

## S02

[Supabase — Database migrations](https://supabase.com/docs/guides/deployment/database-migrations). Use versioned SQL history and local development; adapt to the existing shared migration owner instead of generating a separate competing history.

## S03

[Supabase — Resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). Resumable transfer is available for large uploads. The app still verifies completion and owns job/idempotency behavior.

## S04

[n8n — Execute Command node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executecommand). The node is unavailable on n8n Cloud. A separate worker for native media/render tasks is a design response to the user's selected Cloud environment.

## S05

[OpenAI — Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Schema-constrained outputs help enforce expected shape; source-grounding and factual checks still matter. Provider-supported schema subset must be validated in implementation.

## S06

[OpenAI — File transcription](https://developers.openai.com/api/docs/guides/speech-to-text). Use current supported recorded-audio transcription workflows; verify model availability, input limits and deprecated parameters at implementation. Original video upload policy and extracted-audio request limits are separate.

## S07

[OpenAI — File inputs](https://developers.openai.com/api/docs/guides/file-inputs). PDF/document handling depends on input type and model capability; choose and test appropriate text/vision preparation. Do not assume every uploaded document can be interpreted identically.

## S08

[Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). Object grants and row policies serve different purposes; explicit private schema exposure and scoped operations are required in this design.

## S09

[Supabase — Serving assets from Storage](https://supabase.com/docs/guides/storage/serving/downloads). Private objects require authorized access or signed URLs. Storage URLs can remain valid through their expiry independent of Auth signing-key changes; permanent PDF playback must be mediated by the app's intended access policy.

## S10

[Playwright — page.pdf](https://playwright.dev/docs/api/class-page#page-pdf). Chromium print rendering supports the HTML/CSS PDF path. Template page layout, image/font readiness and actual download/visual checks remain application responsibilities.

## S11

[MCP — Transport overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports). Streamable HTTP and stdio are protocol transports; choose the compatible remote implementation and SDK for intended clients.

## S12

[MCP — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization). HTTP authorization is a separate protected-resource/client integration. Validate current delegated auth behavior rather than equating a business app session with MCP compatibility.

## S13

[W3C — Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/). Accessibility target and test references for keyboard, focus, contrast, labels and responsive interaction. This pack specifies a target; it does not certify unbuilt UI compliance.

## S14

[n8n — Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook) and [Error handling](https://docs.n8n.io/flow-logic/error-handling/). Use authenticated entrypoints and explicit error/recovery handling; application jobs remain the durable source of truth.

## S15

[PostgreSQL — Partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html) and [Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html). Database constraints and transaction locks support the proposed one-Main and concurrent mutation rules. Actual constraints must be applied/tested in local migrations.

## S16

[Supabase — Database functions](https://supabase.com/docs/guides/database/functions) and [Storage schema](https://supabase.com/docs/guides/storage/schema/design). Restrict function execution and search paths; manage actual storage objects through supported Storage operations rather than directly mutating provider-owned metadata tables.

## Supplied visual and UX evidence

The canonical prior HTML prototype and known historical deck/design references are listed in [reference/README.md](reference/README.md). The user requirement for one candidate page with ten fields supersedes older slide compositions. The design reference from another Everyone app informs brand tokens, not that app's business features.

## Validation evidence boundaries

Pack validation checks links, JSON/YAML/schema structure, operation parity, fixture calculations and document consistency. It does not execute the future app, cloud schema, services, real extraction, actual rendered production template, or deployment. PROGRESS.md and release evidence intentionally begin with Not started / Not run. Codex must fill actual implementation evidence during M00–M07.
