-- m10: Fix m09's photo-bucket read guard blocking every anonymous Storage read.
-- The restrictive guard eps_candidate_photos_read_guard applies to all buckets for role public.
-- Postgres may evaluate eps.candidate_photo_read_allowed even when bucket_id<>'eps-candidate-photos',
-- so anon reads (worker asset grants, guest links) failed with "permission denied for function".
-- The function returns false whenever auth.uid() is null, so this grant gives anon no photo access.
grant execute on function eps.candidate_photo_read_allowed(text,text) to anon;

do $$ begin
 if not has_function_privilege('anon','eps.candidate_photo_read_allowed(text,text)','execute') then
  raise exception 'M10_GRANT_MISSING';
 end if;
end $$;
