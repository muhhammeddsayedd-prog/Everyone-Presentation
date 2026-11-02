# Disabled typed catalogue projection and owned proof

This new source version corrects one concrete operator type error before any
further local dispatch. It keeps every consumed ec29 helper/controller/claim and
all prior plans unchanged. The separate valid-config proposal also remains
unchanged and unexecuted. All new execution flags and canonical READ/APPLY flags
are false. No SQL, Docker, provider or canonical call has occurred here.

The old collector used a JSONB value as the right operand of `catalog - ...`.
PostgreSQL17 supports a text array for deleting several keys. See the official
[JSON operators table](https://www.postgresql.org/docs/17/functions-json.html).
Parsing syntax cannot resolve this operator; actual owned execution is required
before canonical arming.

`context.py` inherits the frozen712762e9 Context, constructs it unchanged, and
replaces exactly one catalogue operand:

```sql
-- Before: JSONB - JSONB, unsupported
catalog-'["columns|eps.audit_events.reason|type", ...]'::jsonb
-- After: same exact six keys, typed deletion
catalog-ARRAY['columns|eps.audit_events.reason|type', ...]::text[]
```

The six complete keys are type, not_null, acl, identity, generated and default
for only `eps.audit_events.reason`. All four source-hash patches, full identity
normalization, role/dependency/history checks, masks, limits and permissions are
unchanged. An inverse full-query byte comparison proves that both collector and
checkpoint differ only in that operand. The actual rendered transaction has the
same two substitutions, one in each assertion; migration08bf is unchanged.

The new owned Context inherits the exact frozen target/CLI-role/protected-M02
fixture qualification methods and applies the same correction after construction.
The small new JSON bridge invokes those existing check/render/transition methods
and the frozen76-row/catalogue comparator; no canonical business logic is copied.
The original Node test functions are projected into a new private source file
with only their Python bridge file URL changed. Its inverse byte comparison and
hash are checked before target use. The new false wrapper guard precedes library
loading or target access. No old main or phase claim is invoked.

The compiler composes the pinned valid-config fixture proposal unchanged: the
same six missing synthetic labels, exact five pre/postimages and real CHECKs,
same three COPY-qualified busy rows/normal trigger, and same five setup-table
scope. Configuration is before the fresh baseline and explicitly is not canonical
configuration acceptance. There is no timeout increase, grant change, blanket
skip, trigger suppression or native/worker graph change.

New resources use `eps-r40t-<fresh UUID>`, labels `eps.reason40typed.*`, and private
claims/diagnostics `.local/reason40-typed-collector-validation/<fresh UUID>/`.
The normal Main shared lock, original29 data/catalogue/global-role preservation,
network-none PG17 bootstrap, restore38→39 and exact owned cleanup remain intact.
The public proof family remains `reason40-collector-validation`; typed query
hashes and all new source seals are additionally recorded. Generated source
metadata reports compiled-only, no dispatch, and the actual unique new flag.

## Canonical composition, still disabled

`release.py` is a thin Context-injecting subclass of the frozen canonical Release.
It delegates existing phase, claim, protected-file, SQL transport, nonce,
readback and checkpoint methods. It adds only opt-in flags and admission of the
new typed proof's exact six-key/query hashes and source seals. Its own release
bytes and the frozen orchestration bytes use the reviewed exact two-flag-only
normalization. No new cloud transport/controller implementation is introduced.

Future Root-reviewed arming must set the intended READ/APPLY flag state in both
the thin entry and its frozen orchestration library before preparing a new run;
both remain false now. The new entry supplies the corrected Context explicitly.
The original historical entry and its bad query are retained for provenance and
must not be used as the operational entry. Raw plan source pins deliberately
reject any later flag or source changes. Protected `query-validation.json` must
reference the actual future passed typed local receipt; older51a/ec29 or
parse-only evidence cannot satisfy the new admission.

## Pending actual proof

Root and independent peer review the disabled source/plan first. Then only a
separate authorization can arm the new local wrapper and dispatch one fresh
owned run. It must actually execute the typed operator, collector/checkpoint,
negative preimage/rollback, one rendered40 COMMIT nonce, two before/after reads,
full76 raw-row/catalogue preservation and exact cleanup. No result is implied
from the current pure checks or static type correction.

```powershell
& '<Main>/.venv-skills/Scripts/python.exe' -X utf8 -B -m unittest discover -s development/m07/review-link-reason40-typed-collector -p test_typed.py -v
```

Five focused source tests cover full-query/render inverse byte differences,
unchanged target qualifications/config/qualification hashes, role-drift denial,
bridge-path-only case source, SQL/PLpgSQL/Node parsing, default-off refusal and
absence of duplicated canonical orchestration. They make no DB/provider call.
