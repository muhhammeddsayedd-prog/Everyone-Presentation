# Canonical project creation

Confirmed release addition, 2 November 2026 (Africa/Cairo). This extends project
selection; it does not introduce another project database or complete future modules.

`POST /api/v1/projects` / MCP `create_project` accepts `name` (trimmed, 1–500
characters), `presentation_type`, and optional `client_id`. An Idempotency-Key
is required. Both `projects.read` and `projects.write` are required. The server
derives the actor and project UUID and atomically saves the central project,
creator-only writer membership, initial type intent, audit and replay receipt.
No global capability or client membership is granted. Duplicate names are allowed;
UUIDs identify projects and idempotency protects repeated submissions.

Optional clients come from `GET /api/v1/clients` / MCP `list_clients`, using the
existing q/cursor/limit contract. Only active clients with current client write
authority qualify. An unauthorized/archived client is rejected, including on
replay. Project membership and capabilities are rechecked after any idempotency
lock wait. Revoked access cannot be restored by replaying creation.

`GET /api/v1/presentation-types` / MCP `list_presentation_types` returns the shared
catalogue. Casting is available. Wardrobe, Art Direction, Storyboard, Vehicles &
Animals, Fitting, Pre-PPM, PPM and Production Documents are Planned. Planned types
can be saved as real project intent; their overview exposes no generation or
processing workflow. Casting workspace creation remains a separate operation
under its existing permissions. Initial type intent is not an exclusive central
project classification. Existing projects receive no historical intent backfill.

The optional `Project.presentation_type` projection supports rolling adoption.
Deploy compatible readers before activating creation. Existing projects retain
their old response shape; new projects include the persisted intent. Browser,
HTTP and MCP use the same operation and existing structured errors/envelopes.

Implementation and deterministic tests do not establish cloud migration or hosted
acceptance. Current release evidence remains in the M07 matrix and handoff.
