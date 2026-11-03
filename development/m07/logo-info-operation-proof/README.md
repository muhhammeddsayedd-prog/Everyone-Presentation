# Logo info-operation candidate and local proof source

**Default OFF, source preparation only. No SQL/Docker/Storage run or production
migration is represented by these files.** There is no transport or execution
entrypoint. No migration version has been assigned.

The correlated live observation is an original SDK object GET followed through
the same Cloudflare Ray base to an info operation for the same object. The SDK
itself has no info preflight; the isolated actual-SDK diagnostic documents that
boundary. The hosted catalogue's logo helper admits object GET only. This creates
a concrete operation mismatch at the observed backend info stage, with original
HTTP acceptance still required after any reviewed fix.

## Candidate

`candidate.py` reads the checked-in M01 migration, checks its exact SHA and helper
body SHA against the retained hosted preimage, and changes one guard:

```sql
not storage.allow_only_operation('object.get_authenticated')
```

becomes:

```sql
not(storage.allow_only_operation('object.get_authenticated')
    or storage.allow_only_operation('object.get_authenticated_info'))
```

The inverse must recover every original byte. All actor, brand bucket, asset
mapping, Ready-versus-own-Open, workspace scope, owner, status and clock expiry
predicates remain byte-identical. Signature, STABLE, SECURITY DEFINER and empty
search_path are retained. CREATE OR REPLACE retains the existing function owner,
ACL and OID; the proposed local proof checks the entire pg_proc row except prosrc.
No grant, role, policy, verifier, signature or upload/completion contract changes.

Both the permissive `eps_logo_read` and restrictive `eps_logo_read_guard` already
call this helper. Updating this one helper is sufficient for the ordinary logo
path; expanding the restrictive policy separately would duplicate the rule.
Other bucket guards are unchanged. Other presentation/export/guest capability
branches keep their current independent validation.

An authorized same-project nonowner can already read a Ready logo through media
RLS. That remains a positive. Wrong-owner Open is a negative; unrelated-project
Ready is a negative. Requiring upload ownership for Ready would change the
contract and is intentionally absent from this candidate.

## Prepared local proof

`proof.sql` is a render template for a future fresh Root-owned PG17 purpose using
the sealed owned bootstrap, exact38->39->40 history and inherited full original
data/catalogue/global-role/resource/lock cleanup. Do not run a consumed controller
or apply this template to the hosted database. The parent will coordinate any
actual local run after source review and the current timing hold.

The rendered SQL requires the local fixture sentinel, postgres role/database and
schema40. All actor/project/workspace IDs derive from a fresh run UUID. Normal
reservation RPCs create fresh Open assets. Only the new synthetic Ready asset is
declared by the local fixture owner; this is not normal upload-verifier acceptance
and never edits existing Ready media or presentation versions.

It first demonstrates old GET positive and INFO denied, applies the exact
candidate within the same rollback transaction, then checks helper results and
actual RLS-filtered storage.objects SELECT results. Positive cases cover owned
Open and authorized Ready GET/INFO, including same-project nonowner Ready.
Negatives cover anonymous, wrong owner, reader Open, unrelated project, revoked
workspace-write/project-read/membership, clock-expired/cancelled Open, wrong key/bucket, unrelated
operations, spoofed operation header and verifier role. It records function/table
ACL denials distinctly from a zero-row RLS result. A temporary broad permissive
SELECT policy proves the existing restrictive guard still prevents bypass.
The verifier inherits authenticated: its public helper can be true for an
authorized acting-user JWT while its independent restrictive Storage policy
still returns zero rows. Both old-GET and new-INFO cases check that distinction.
Existing `workspaces_write` is a permissive FOR ALL policy. A scoped writer with
`workspaces.write` and `projects.read` still sees the workspace after revoking
only `workspaces.read`; both Open and Ready are therefore positive in that case.
Revoking `projects.read` closes project_scope and supplies the actual read-denial
control. This corrects a source-discovered fixture expectation and does not
change the candidate or any authority rule.

The original policies and every pg_proc metadata field except prosrc must remain
equal. The candidate and all synthetic fixtures roll back. The SQL's final row
says `rollback_required`; a future normal controller must observe ROLLBACK and
independently prove full baseline/resource cleanup before publishing a pass.

The JWT/Storage-operation GUCs are deliberate SQL simulation of trusted server
context. They do not prove HTTP gateway propagation, real file reads or hosted
Storage acceptance. A later authorized single normal completion of the retained
upload, with the original body/key and no new PUT/reservation, is the necessary
HTTP acceptance after any actual approved apply.

The MCP text-only omission of the four closed logo diagnostic fields is a
separate concrete observability gap. No product change for it is included here.

## Pure checks

The prepared tests check the exact finite inverse, refused drift, function shape,
actual SQL parser acceptance, case inventory and absence of execution ports.
They do not execute SQL or claim RLS runtime results. After the timing hold was
released, the original **5/5 pure checks passed**. The writer-without-read
expectation correction adds a sixth check pinned to the foundation policy's
actual FOR ALL shape. SQL/PLpgSQL parsing includes all eight rendered bodies.
No database, Docker or provider call was made.
