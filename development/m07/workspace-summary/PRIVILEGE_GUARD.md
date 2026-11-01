# Migration35 temporary CREATE privilege guard

Root review identified that the temporary `GRANT CREATE ON SCHEMA public` and
subsequent `REVOKE` must not remove a legitimate privilege that existed before
this migration. Admission now fails closed when
`has_schema_privilege('eps_review_owner', 'public', 'CREATE')` is true, before
either statement executes. No existing role attribute, policy, routine body or
business row changes. The migration still requires exact history34.

The new contract source test was RED against the earlier migration and GREEN
after this guard. Actual migration SQL and PL/pgSQL still parse (12 statements,
two PL/pgSQL bodies). This is a source precondition test, not a database
permission execution result. Prior module/build results remain historical;
the Summary RPC implementation and its published contracts are unchanged.
No SQL, database, provider, process control or deployment was performed.
