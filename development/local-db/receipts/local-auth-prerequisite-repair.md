# Retained local prerequisite failures and repair

The root integration owner's first reviewed app replay failed with `function auth.jwt() does not exist` and rolled back; the subsequent DB acceptance test found no `public.clients`, consistent with that rollback. The root retained its command failure evidence. This local image has `auth.users` and `auth.uid()` but lacks the hosted project's separately observed `auth.jwt()` helper.

Read-only local inspection confirmed `postgres` is not superuser, `auth` belongs to `supabase_admin`, `auth.uid()` belongs to `supabase_auth_admin`, and no app tables existed. The known local `supabase_admin` superuser was verified through the owned container Unix socket and used only for prerequisite bootstrap. Existing users/uid objects were preserved. Only the absent synthetic `auth.jwt()` was created from `request.jwt.claims` and assigned to `supabase_auth_admin`.

The first post-repair behavior check failed with `LOCAL_AUTH_HELPER_CHECK_FAILED`: it set only `request.jwt.claims`, while this image's pre-existing uid function reads only `request.jwt.claim.sub`. Read-only function inspection established that difference. The harness check was corrected to set both transaction-local values, as the SQL acceptance fixture does; no uid replacement or app migration change was made.

The successful bootstrap/status receipts establish the repaired local prerequisites. This does not establish hosted login or cryptographic JWT verification. The app migration remains subject to root replay authorization and real SQL acceptance.
