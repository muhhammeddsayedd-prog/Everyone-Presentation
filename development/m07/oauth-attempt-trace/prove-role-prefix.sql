-- No JWT, acting identity, selector or provider call. This is a read-only prefix.
begin read only;
set local role eps_oauth_consent_owner;
select auth.uid();
rollback;
