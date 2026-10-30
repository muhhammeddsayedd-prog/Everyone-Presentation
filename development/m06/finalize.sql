-- Only the new public wrappers are reachable. All private helpers remain closed.
grant create on schema eps,public to eps_guest_owner,eps_review_owner;
do $$declare item record;owner_name text;begin
 for item in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where(n.nspname='public'and p.proname=any(array['eps_list_review_links','eps_create_review_link','eps_update_review_link','eps_revoke_review_link','eps_rotate_review_link','eps_list_feedback','eps_create_comment','eps_update_comment','eps_set_preference','eps_prepare_pdf_export','eps_get_pdf_export','eps_get_pdf_export_asset','eps_guest_operation']))
 or(n.nspname='eps'and p.proname=any(array['guest_cleanup_credentials','guest_link_live','review_link_dto','presentation_export_dto','review_link_scope','review_link_require','review_expiry','review_credential','review_token_replay','feedback_comment_dto','feedback_preference_dto','feedback_version','feedback_page','feedback_mutate','feedback_internal_require','review_gateway_verify','review_gateway_rate','guest_link_for','guest_current','guest_access_dto','guest_version_dto','guest_replay','guest_prepare_export','guest_asset_issue','guest_export_access','guest_storage_allowed','export_storage_read_allowed']))loop
  owner_name:=case when item.proname in('eps_guest_operation','guest_prepare_export','guest_storage_allowed')or item.nspname='eps'and(item.proname like'guest_%'or item.proname like'review_gateway_%')then'eps_guest_owner'else'eps_review_owner'end;
  execute format('alter function %s owner to %I',item.signature,owner_name);execute format('revoke all on function %s from public,anon,authenticated,service_role',item.signature);
  if item.nspname='eps'then execute format('grant execute on function %s to eps_guest_owner,eps_review_owner',item.signature);end if;
 end loop;
end$$;
revoke create on schema eps,public from eps_guest_owner,eps_review_owner;
grant execute on function public.eps_list_review_links(jsonb),public.eps_create_review_link(uuid,jsonb,jsonb,text),public.eps_update_review_link(uuid,jsonb,text),public.eps_revoke_review_link(uuid,jsonb,text),public.eps_rotate_review_link(uuid,jsonb,jsonb,text),public.eps_list_feedback(uuid,jsonb),public.eps_create_comment(uuid,jsonb,text),public.eps_update_comment(uuid,jsonb,text),public.eps_set_preference(uuid,jsonb,text),public.eps_prepare_pdf_export(jsonb,text),public.eps_get_pdf_export(uuid),public.eps_get_pdf_export_asset(uuid)to authenticated;
grant execute on function public.eps_guest_operation(text,jsonb,jsonb)to anon,authenticated;
grant execute on function eps.guest_storage_allowed(text,text),eps.export_storage_read_allowed(text,text)to anon,authenticated;
grant execute on function eps.guest_link_live(eps.review_links),eps.presentation_export_dto(eps.presentation_exports)to eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.guest_cleanup_credentials()to eps_review_stage_owner;
-- Backend keys are intentionally absent; root provisions a distinct verifier
-- through the established encrypted, scoped bootstrap after local proofs.
