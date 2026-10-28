# Existing UX and visual references

## Included prototype

`everyone-casting-ux-prototype.html` is the delivered standalone UX demonstration with Project → Specs → Candidates → Casting → Review → Presentation, including client logo upload/placement. Open locally in a browser to understand interaction intent. It is self-contained and does not connect to real Supabase, OpenAI, n8n or MCP.

Known deliberate differences from the production contract:

- Prototype allows skipping every stage and starting an unlinked project; production requires authorized central project identity.
- Specs extraction, transcription and AI wording are simulated; production requires real providers.
- Some prototype Selection toggles and Main behavior predate the final rules. Production Selection is all assignments, Shortlist explicit, zero/one Main per slot enforced transactionally.
- Prototype media is local/session-scoped and its PDF renderer is a demonstration; production uses private persistent objects, frozen manifests, server rendering and version-bound authorized video links.
- Prototype does not implement real guest review, canonical shared-record writes, durable processing or user-equivalent MCP.

The product specification overrides conflicting demo behavior. Do not convert this single file into a production architecture by adding a few fetch calls.

## Existing visual sources available in the workspace history

The Everyone Market Radar DESIGN.md source contains brand/UI tokens (black/white/green, General Sans and Arabic font direction), but its business screens and chart requirements belong to another app. Reuse visual language only. Exact production font files/licensing availability must be checked, not assumed.

The Floward Cast Selection/Shortlist PDFs are historical visual references. They were not reproduced in this pack because they contain actual project material and are unnecessary for synthetic test execution. If needed, resolve them from the user's existing files:

- [Floward Cast Selection V3](https://chatgpt.com/library?file_id=libfile_27ec1bd9fd58819198232bc1a4aa4d1d&account_id=personal)
- [Floward Cast Shortlist V3](https://chatgpt.com/library?file_id=libfile_61eb751a83188191a4169d207a47077b&account_id=personal)
- [Everyone UI design reference](https://chatgpt.com/library?file_id=libfile_f4003d234f188191ad2df548124141d5&account_id=personal)

These are supplied-file references, not public web sources or a claim that Codex has connector access. Use supplied local copies if available; otherwise list the asset dependency and proceed with the documented layout structure. The current requirement of one candidate per assignment page, ten fields and all frames in the PDF takes precedence over older deck arrangements.

## Fixture policy

All new sample candidates and specs in this development pack are synthetic. Source files do not establish measured transcription accuracy or visual fidelity to a production deck. Authorized representative material is required for live-service evaluation; do not commit it to public source control.
