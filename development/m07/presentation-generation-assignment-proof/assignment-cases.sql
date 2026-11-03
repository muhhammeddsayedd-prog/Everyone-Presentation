-- Owned temporary observer. Executes original wrapper under actual actor RLS.
create function pg_temp.assignment_review_observe(p_workspace uuid,p_series uuid)
returns jsonb language plpgsql volatile security invoker set search_path=''as $observe$
declare started timestamptz:=clock_timestamp();s jsonb;begin
 if current_user<>'eps_review_owner'or current_setting('statement_timeout')<>'8s'
 then raise exception'ASSIGNMENT_PROOF_CALLER_BOUND_REQUIRED';end if;
 s:=eps.review_snapshot(p_workspace,p_series,null);
 return jsonb_build_object('ok',true,'duration_ms',extract(epoch from(clock_timestamp()-started))*1000,
  'contract_hash',eps.presentation_hash(s),'new_series_normalized_hash',eps.presentation_hash(s-array['series_id','input_fingerprint']),
  'normalization',jsonb_build_array('new series_id','series-dependent input_fingerprint'),
  'input_fingerprint',s->>'input_fingerprint','output_type',s->>'output_type',
  'candidate_count',s->'candidate_slide_count','pending_count',s->'pending_slide_count',
  'main_count',(select count(*)from jsonb_array_elements(s->'slides')x where x->>'kind'='candidate'and x->>'position'='main'),
  'no_main_count',(select count(*)from jsonb_array_elements(s->'issues')x where x->>'code'='NO_MAIN'),
  'ordered_assignments_sha256',(select eps.presentation_hash(coalesce(jsonb_agg(x->'assignment_id'order by n),'[]'))from jsonb_array_elements(s->'slides')with ordinality a(x,n)where x->>'kind'='candidate'),
  'private_internal_note_in_output',position('OWNED_PRIVATE_ASSIGNMENT_NOTE' in s::text)>0);
exception when query_canceled then return jsonb_build_object('ok',false,'code','57014','duration_ms',extract(epoch from(clock_timestamp()-started))*1000);
 when raise_exception then
  if sqlerrm in('CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED')then return jsonb_build_object('ok',false,'code',sqlerrm);end if;raise;
 when insufficient_privilege then return jsonb_build_object('ok',false,'code','42501');
end$observe$;
