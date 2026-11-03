# Alias-safe41 Context and fresh release — default off

84d79b2c completed the owned fixture then failed before any bridge/nonce:
native `column p.oid does not exist`, child exit3. Numeric SQLSTATE was not
retained. The injected row guard reached `pg_policies p`, a view without oid.
The old source/run/artifacts and all earlier failures remain frozen.
The PostgreSQL17 [view definition](https://www.postgresql.org/docs/17/view-pg-policies.html)
lists no oid; [JSON extraction](https://www.postgresql.org/docs/17/functions-json.html)
returns SQL NULL when its requested key is absent.

Only the injected ROW condition now reads `(to_jsonb(p)->>'oid')::oid`; a missing
key gives SQL NULL. The exact target regprocedure and prosrc-key predicates remain.
All14 row sites have an inverse back to the frozen projection; typed p.prosrc
checks stay unchanged. No field/schema is ignored. Actual target metadata,
function scope/catalogue/dependencies/roles/full76/reasons and history guards are
inherited unchanged. Migration41 bytes4af699ab remain unchanged.

The fresh release binds the same sealed phase bytecode to independent Context
and purpose globals. No frozen module globals or method bodies are changed.
It inherits normal bounded CLI, exact nonce/private response binding, worker
GET/readback and full-row comparison. Its protected query-validation reference
must bind an ACTUAL passing collector using this fixed Context source; it cannot
reuse925 or84 as a pass. Literal arming qualification applies only to this new
entry; old canonical sources/flags remain false/frozen. No new transport,
credentials, grants, policies, timeouts or native/config mutation is introduced.
