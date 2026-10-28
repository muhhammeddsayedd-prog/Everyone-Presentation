# Fifth capability migration security review

The actual post-release advisor result is in `security-advisors.json`:18 WARN
findings, all `authenticated_security_definer_function_executable`. There is no
zero-warning claim. The existing narrow scoped-RPC rationale is recorded in
`../cloud-logo-foundation/security-advisor-review.md`.

The fifth migration replaces only `eps_get_capabilities`. Cloud source/history
readback matches the exact reviewed function bytes; `eps_api_owner`, empty
search_path, authenticated EXECUTE and anon/service-role denial are unchanged.
The function advertises a purpose through ordinary active workspace grants and
writable active project scope; it grants no capability or target access. The
adapter additionally intersects decoder/signer readiness. Every reservation,
transfer, completion and ready read retains its authorization boundary.

The first advisor extractor did not recognize the CLI's `results` envelope. Its
count0 output is explicitly invalidated in `security-advisors-parser-invalidated.json`.
A corrected live query returned all18 findings. Raw CLI output is not retained.
These metadata checks do not establish hosted Auth, Storage byte acceptance,
API/MCP parity or production readiness.
