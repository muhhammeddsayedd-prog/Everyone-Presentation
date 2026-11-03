# One-statement asset pin insertion candidate

Source only; entry disabled. No SQL, Docker, migration, production retry or
performance acceptance. This changes one four-line block of current GENa5 and
has an exact inverse. The builder/source chain is pinned to
`presentation-generation-data-reuse/build.py` SHA
`cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd`.

Before body:
`a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40`.
Candidate body:
`41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d`.
`before-body.sql`, `candidate-body.sql` and `body.diff` are exact review artifacts,
not runnable migrations. Existing signature, definer mode/search_path, owner/
ACLs, declarations, all other function statements and body line count stay fixed.

## Actual evidence and exact twelve-line context

Diagnostic eeca5340 normal-exit0 passed custody/restoration, but application
generation still returned57014 at7998.573ms. Source locking1731.392ms and public
review3465.598ms completed; nested DATA3403.590ms and assignment420.338ms are
not additive. Cancellation is in GEN line61 with presentation_scope → project_scope
→ has_capability → mcp_token_permits_capability in the captured stack. Companion
capture was not entered. This local instrumented observation does not measure
the individual pin command, attempted iteration count, policy CPU or a speedup.
Raw receipt SHA2f7bedb5 and safe outcome SHA7505ee04 remain preserved.

The uninstrumented current body has the same statement at line61. Exact source
lines55–66 follow (line numbers are explanatory, not SQL):

```text
55  insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,generation_job_id,generated_by,generation_note,created_at,english_transcript_version)
56  values(version_id,series.id,workspace.id,workspace.project_id,version_no,workspace.row_version,workspace.draft_revision,review->>'input_fingerprint',snapshot,snapshot_hash,manifest,manifest_hash,inventory_hash,jsonb_array_length(slides),job_id,auth.uid(),note,created_at,'1.0');
57  for item in select value from jsonb_array_elements(slides)loop
58   insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)values((item->>'id')::uuid,version_id,(item->>'order')::integer,item->>'kind',(item->>'assignment_id')::uuid,(item->>'slot_id')::uuid,item,eps.presentation_hash(item));
59  end loop;
60  for source in select * from unnest(capture_assets)order by id loop
61   insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
62   values(version_id,source.id,source.purpose,source.bucket,source.object_key,source.mime_type,source.size_bytes,source.sha256,source.width,source.height,source.duration_ms,source.source_asset_id,source.source_timestamp_ms,source.filename,source.created_at);
63  end loop;
64  perform eps.capture_presentation_video_transcripts(version_id);
65  update eps.presentation_series set next_version_number=next_version_number+1,row_version=row_version+1,updated_at=clock_timestamp()where id=series.id;
66  insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job_id,'prepare_presentation',input_hash,1,job_id::text||':1');
```

This is an INSERT VALUES executed per captured asset, not a broad media scan.
The distinct needed UUID set is already constructed at39–43; the capture query
at44–45 uses `media_assets.id=ANY(assets)`. The typed captured array is already
used by both inventory and pins. Do not add a second key set or optimize that
earlier completed query based only on the cancellation stack. The representative
fixture nominally captures44 distinct assets; attempted pin count is unobserved.

## The finite replacement

```sql
 if coalesce(cardinality(capture_assets),0)>0 then
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  select version_id,a.id,a.purpose,a.bucket,a.object_key,a.mime_type,a.size_bytes,a.sha256,a.width,a.height,a.duration_ms,a.source_asset_id,a.source_timestamp_ms,a.filename,a.created_at from unnest(capture_assets)a order by a.id;
 end if;
```

Keep all15 fields, NULLs and ID ordering. No WHERE, DISTINCT, ON CONFLICT,
LIMIT, RETURNING or source-table reread is introduced. Existing availability,
inventory cardinality/budget/hash checks run first. The empty/NULL guard retains
the original zero-iteration behavior, including skipping target INSERT privilege
checks. The old `source` variable can remain declared for the finite inverse;
neither it nor the loop's FOUND value is read before the unchanged next PERFORM.
No additional private row cache or memory budget is introduced; the original
typed array and its sorted stream are reused. Private filenames remain in
internal pins, and never newly enter snapshot, manifest or public error output.

## RLS, clock and concurrency boundary

Pinned schema metadata SHA12df4e56 has no INSERT trigger on pins; its only user
trigger is immutable BEFORE UPDATE/DELETE. Target source row type has no
`version_id` column, so the SELECT's existing local variable is unambiguous.

`presentation_pin_insert` still WITH CHECKs permitted asset kind and EXISTS of
the new queued version with `presentation_scope(v.workspace_id,true)`. That
version lookup also has `presentation_version_read` → presentation_scope(false).
The scope chain retains live project membership/business capabilities and MCP
session/delegation validation. PostgreSQL still enforces the unchanged
[INSERT row policies](https://www.postgresql.org/docs/17/sql-createpolicy.html).
No capability/session/clock result is materialized, cached or replaced, and no
role, grant, policy or execution mode changes.

One INSERT has one command snapshot instead of multiple INSERT snapshots.
Concurrent revocation visibility and error timing therefore are not claimed
byte-identical. Keep the subsequent companion's version read and explicit fresh
presentation_scope(write=true), plus series UPDATE's live review_scope
USING/WITH CHECK, exactly unchanged. Actual revoke/expiry while the pin command
waits must deny and restore the full baseline, including if a stale command
snapshot reaches the next fresh companion gate. An IMMUTABLE_VERSION denial can
surface there instead of the earlier policy42501; it must be recorded honestly.
No successful response after the tested authority loss is accepted.

PostgreSQL supports [INSERT from a query](https://www.postgresql.org/docs/17/sql-insert.html).
This removes per-row command execution boundaries, not necessarily per-row RLS
work or repeated planning: PL/pgSQL already [caches prepared statements/plans](https://www.postgresql.org/docs/17/plpgsql-implementation.html#PLPGSQL-PLAN-CACHING).
No faster result or completed eight-second generation is claimed from source.
The [READ COMMITTED command boundary](https://www.postgresql.org/docs/17/transaction-iso.html)
change and fresh late checks need actual owned proof before selection.

## Required proof, still unexecuted

Five offline checks parse final PL/SQL, match all15 projected fields/order,
verify one-block inverse/unchanged options/prefix/tail/line count, NULL/empty
behavior, frozen row-policy/trigger/schema facts and no transport. Initial sealing
corrected only a one-space anchor indentation mismatch; the fixed source hash
refused that draft before any SQL/artifact, without relaxing the anchor.

The new disabled proof must retain old280+canonical4 versus candidateaa1 with
current DATA0dba/wrapperc6/rawafe and only this new GEN. Candidate MCP-large is
first fresh8s and fails closed before remaining seven; no warm retry. Keep all
existing canonical semantic/fingerprint, immutable pin/hash/private-field,
English/fallback/selection/Shortlist tests and changed-helper locks/RC checks.
Add actual pin-table RowExclusive wait plus membership/capability/clock expiry
denial with exact preimage/rollback checks. Preserve all earlier failures and
original29 data/catalogue/global roles/resources/lock cleanup. No actual SQL is
authorized by this candidate or document.
