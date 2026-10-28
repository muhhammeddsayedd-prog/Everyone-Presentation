# Central Supabase discovery and migration runbook

**Milestone owner:** Codex, beginning in M00 and continuing through each feature milestone. **Current state:** no cloud schema has been inspected and no migration has been executed for this pack. The user explicitly authorized development against a local representation of the existing business database, with cloud inspection first and reuse where possible.

The deliverable is a coordinated extension to the existing database, not a new isolated Supabase project with unrelated users/projects. Read [the schema design](DATABASE_SCHEMA.md), [access model](SECURITY_AND_ACCESS.md), and [reference SQL](../../contracts/database/design-reference.sql).

## 1. Discovery outputs required before physical schema design

Create these files in the implementation repository and link them in the milestone progress ledger:

| Output | Required content |
|---|---|
| `docs/discovery/central-schema-map.yaml` | Completed mapping based on the supplied template; actual tables, keys, ownership, adapters, capabilities |
| `docs/discovery/database-inventory.md` | Relevant schema/table/column/function/trigger/RLS/storage/migration inventory; date and evidence source |
| `docs/discovery/integration-decisions.md` | Reuse/add/extend decisions with reasons and incompatible assumptions |
| `docs/discovery/local-reproduction.md` | How to reproduce the relevant central schema locally without copying unnecessary production personal data |
| `docs/discovery/migration-ownership.md` | Canonical migration repo/history, owner and coordination method across apps |
| `docs/discovery/runtime-and-access.md` | Existing auth, hosting, storage, credentials/quotas, runtime identity strategy, outstanding access dependencies |

Do not fill unknown entries with invented cloud names. Mark them `unverified`, use explicit local fixtures and continue independent work. Do not declare cloud integration complete until the actual mappings are verified. The absence of cloud credentials need not block building local domain logic, but it does block claims of successful production integration.

## 2. Inspect read-only first

Use the available authorized Supabase connector/CLI/SQL access. Verify the selected project reference before querying. Read metadata and a small, necessary sample of non-sensitive structures. Do not dump all production candidate videos, transcripts, personal records or auth secrets into a development repo.

Collect:

1. PostgreSQL version, installed extensions, schema names, database connection/pooling conventions.
2. Existing project/client/business entity table names, PK types, relationships, status fields and soft-delete conventions.
3. Auth/principal/profile/membership mappings and how project permissions are represented.
4. Existing casting/person/contact/media/library tables, field owners and unique identifiers.
5. Existing SQL/Edge/domain functions for central writes, validation, lifecycle and access.
6. Row policies, grants, default privileges, exposed Data API schemas and privileged function owners.
7. Storage buckets, public/private flags, MIME/size limits, policies, existing asset abstraction, backup/retention configuration.
8. Migration history and its authoritative Git repository; pending branch changes by other apps.
9. n8n Cloud integration conventions, callback auth and secret storage; do not assume a self-hosted environment.

### Safe metadata query example

The following is a read-only discovery example. Run it only against the intentionally selected authorized project; it does not create tables or alter data.

```sql
begin read only;
set local statement_timeout = '10s';

select table_schema, table_name, column_name, data_type,
       udt_schema, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name, ordinal_position;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
order by schemaname, tablename, policyname;

select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname not in ('pg_catalog', 'information_schema');

rollback;
```

Inspect primary/foreign keys, indexes and relevant function signatures next. Retrieve function bodies only when necessary to understand the integration, and review them before storing because an existing function could contain embedded secrets. Do not query password/token tables as a shortcut to understanding auth. Record source object names and semantics without exposing credentials in handoff documents.

## 3. Make reuse decisions field by field

For each logical entity, classify the result:

- **Reuse:** existing canonical table/function already satisfies identity and behavior.
- **Extend:** existing canonical record remains authoritative, with casting-only columns or a related extension table.
- **Add:** no equivalent exists; create an app-owned table in the agreed schema.
- **Adapt:** a typed adapter/view binds existing names/keys to the logical application contract.

The decision is per field as well as per table. Example: an existing person record owns name/city, while the casting app owns reviewed state, casting category and selected frames. Do not copy name/city into a second mutable candidate table just because the reference schema includes those logical fields. The resulting `Candidate` DTO joins canonical facts with casting extension fields; edits route back to the actual owner.

Project creation remains outside this app's v1 scope. A binding only references a real existing project. Prefer real foreign keys; if the canonical source uses a composite/non-UUID key and a binding is needed, validate it through a trusted adapter and document how central deletion/archival is detected. Do not create unrestricted dynamic SQL whose target table/key comes from browser input.

Where existing records already represent historical cast, import/reuse those identities through the mapping. New uploads use the normal scan flow. Do not presume a separate historical data migration product is required; create one only if actual discovery demonstrates a concrete data movement need.

## 4. Establish local development without harming shared history

Determine the existing canonical migration repository before initializing a second history. If this app has its own repo, it can consume the central schema baseline and contribute migrations through the agreed central path. One shared cloud database needs one coordinated sequence of migrations, even when several application repositories exist.

Use the Supabase CLI version pinned in the repository. Its exact commands/options must be verified against the installed version in M00. Typical local steps are:

```bash
supabase --version
supabase start
supabase migration list
supabase db reset --local
```

`db reset --local` is for the disposable local database only. Do not repurpose it to reset the shared cloud database. Inspect the repository's existing Supabase configuration and linked project before any command that can target a remote environment. Where schema pull/dump is necessary, use the installed CLI's documented schema-only mechanism and sanitize unrelated/secret definitions before committing.

The local baseline should reproduce enough of the canonical schema, grants and functions to test integration honestly. Use synthetic seed users/projects/candidates; include at least two projects with different access to prove isolation. Keep local canonical stubs clearly identified when real discovery is still pending. Do not call a stub a confirmed cloud table.

Supabase migrations record schema changes as SQL and local reset replays migrations/seeds. Follow [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations), verified 27 October 2026, while reconciling with the existing central history rather than creating a parallel history that will collide.

## 5. Convert design reference into real migrations

`contracts/database/design-reference.sql` deliberately begins with an exception inside a transaction and ends with rollback. It is documentation, not an install script. Do not execute it against the cloud or merely delete its guard and assume it is production-ready.

For each feature milestone:

1. Identify the minimum added/changed objects required for that feature.
2. Map every canonical reference and owned field using the completed discovery map.
3. Generate a timestamped migration in the actual canonical migration system.
4. Include constraints, indexes, grants, RLS and privileged-function permissions in the migration; do not leave security to a later milestone.
5. Add or update local synthetic seeds and focused integrity/access tests.
6. Run a clean local reset and the focused tests using real runtime roles.
7. Compare the planned migration against the current shared baseline for drift and collisions.
8. Record objects affected, expected lock/data impact, validation query, rollback/forward-fix strategy and test evidence.

Prefer additive changes. Introduce new nullable fields, backfill deliberately, validate, then tighten constraints when justified. Avoid changing central project/person semantics merely to fit this app. Large indexes/backfills may require staged migration techniques; assess actual table size instead of assuming a new empty database.

### Migration dossier template

```text
Migration ID and file:
Owning repository/branch:
Milestone and business-rule IDs:
Current baseline revision:
Objects reused / added / altered:
Canonical apps potentially affected:
Data movement/backfill:
Runtime permissions/RLS changes:
Expected locks and estimated affected rows:
Local reset and focused test evidence:
Staging verification queries:
Recovery approach (rollback or forward fix):
Asset migration/retention effect:
Actual deployment result and timestamp:
```

Do not write “migration complete” when only a SQL file was created. Track authored, tested-local, tested-staging and applied-production as separate states.

## 6. Cross-app compatibility gates

- Existing project/client readers still receive the fields/relations they expect.
- Authorized presentation-app edits appear in central records and the connected app's normal read path.
- Existing canonical write functions/triggers still run where required.
- New grants/default privileges do not expose unrelated central tables.
- New RLS helpers do not recursively call themselves or use table-owner bypass unintentionally.
- New app functions have explicit execute grants; no unrestricted public mutation function is left behind.
- Storage policies permit the intended upload/read flow without making buckets public.
- Existing canonical IDs remain stable. A new binding never renumbers the business's primary keys.
- Migrations from another app since M00 are reconciled before staging/production application.

The relevant source of truth for exposure is the live grants, RLS and API schema configuration together, not whether a table name happens to begin with `eps_`. Supabase documents those layers in [Securing your API](https://supabase.com/docs/guides/api/securing-your-api), verified 27 October 2026.

## 7. Storage and file migration rules

Create or alter storage buckets/policies only after inspecting existing conventions. Use private buckets and an app-owned media registry that records physical object references. Do not store large binary media in Postgres rows or send huge base64 payloads through routine n8n webhook bodies.

Storage object operations go through the Storage API. Treat `storage` metadata tables as read-only for object creation/move/delete; do not manually delete a metadata row to claim the bytes have been removed. See [Storage schema](https://supabase.com/docs/guides/storage/schema/design), verified 27 October 2026.

If reusing existing historical media, record an identity/path mapping and check access/checksum availability. Avoid copying every asset if the existing private location can be referenced safely. If a physical migration is necessary, copy bytes first, verify, update app references atomically where possible, and retain the source until verification and existing consumers are accounted for.

## 8. Staging, production, and recovery

Use environment-specific credentials and app origins. Never point local fixture scripts at the production database. Before deployment, verify the target project reference, current migration history, backup/restore method, storage retention and actual pending SQL diff. Run an end-to-end staging scenario using real configured processing services and representative authorized media.

A successful production migration is followed by focused smoke checks: canonical project reads/writes, one permitted and one denied workspace request, a resumable upload, one processing job, candidate assignment/Main constraint, version generation, external review and fixed-version PDF playback. Broad destructive reset testing belongs locally/staging.

If a release fails, distinguish application rollback from data migration rollback. A previous web build may not understand a new schema, and restoring a database may not restore asset bytes. Prefer forward fixes for additive migrations when that preserves compatibility. Keep the prior app release and migration recovery instructions available; record actual recovery evidence rather than a generic “rollback supported” claim.

## 9. M00 exit checklist

- [ ] Real central project/client/principal/candidate ownership mapped or each missing access dependency explicitly recorded.
- [ ] Existing migration repository/history and coordination method identified.
- [ ] Local reproducible canonical baseline and synthetic fixtures available.
- [ ] Private app schema and runtime access mechanism chosen with real grant/RLS tests.
- [ ] Existing storage/auth/hosting/n8n integration conventions captured.
- [ ] Each proposed table/field classified reuse/extend/add/adapt.
- [ ] No invented cloud schema or unnecessary production personal-data dump committed.
- [ ] M01 can build a persistent workspace tied to a real or clearly labeled local canonical project fixture.

