# Additive preparation continuation

`forward_prepare.py` is default-off. No phase has run through this entry.
Frozen state4c, provider8ae, controller76, old inputs, both failed receipts and
the protected read-only prepare claim remain unchanged. The original claim
captured no baseline/plan and dispatched no processing/config/env/deployment mutation.

The confirmed difference is one legitimate added review_fit job. Existing source
`job-attempt-observability36-release/state.py` counts all jobs in legacy.job_count
and legacy.kinds; these are business aggregates. `forward_state.py` validates
their existing closed kinds/count/sum contract plus historical total/per-kind
lower bounds, then omits only these two aggregates from initial historical
equality. Unsupported metadata must stay zero, and protected M02/static schema,
OAuth/configuration/identity checks remain intact. Every full fresh legacy/data/
trace/intent value remains preserved across all later phase assertions.

The new State contract binds forward_state.py itself, while its inherited nine
SQL fragments are byte-identical to frozen4c. A new owned actual SQL proof must
bind that new hash before any read-only preparation continuation. Its exact
receipt goes in forward_inputs.json; null blocks before provider calls.

The additive entry uses a ForwardProvider object composed from frozen transport,
the new State and new inputs. It does not alter module globals or invoke an old
main. Before any provider call it checks old private ownership, absence of any
plan/mutation/continuation claim, exact retained read-only claim/failure hashes,
and every old source pin. Only the six named new forward source files may be
added to those pins. It creates an exclusive new forward-prepare.claim first.

Root reviews and arms FORWARD_ENABLED before the new prepare command. Use this
entry for **all** future phases: prepare, pause, env, deploy, ready, pin, resume,
or readback:<phase>. The existing original functions receive the new State and
the freshly captured plan, whose forward reference binds both claims. Repeating
prepare is blocked; old claims are never deleted, relabeled or used as normal
mutation returns. Existing availability/unknown-outcome rules stay unchanged.

Root owns live phases; no app/API/canonical writes by other agents during switch.
