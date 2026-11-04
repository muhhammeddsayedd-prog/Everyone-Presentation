-- Forward fix for 20261104210000_m08_editorial_template (additive, in place).
-- eps.review_validate_fit already requires the measured font inventory to EQUAL the
-- template row's pinned font_hashes, but it also required exactly six keys, so the
-- nine pinned 1.2.0 fonts (six General Sans + three IBM Plex Sans Arabic) could
-- never be accepted. The count now follows the template: 9 for 1.2.0, 6 otherwise.
-- Equality with the pinned row is unchanged. Preimage read from canonical history 43
-- (read-only, 4 Nov 2026); postimage asserted below.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';

do $fit_fonts$
declare source text;definition text;
 needle constant text:='jsonb_object_keys(p_value->''font_hashes''))<>6 then';
 patch constant text:='jsonb_object_keys(p_value->''font_hashes''))<>(case when p_job.input#>>''{template,version}''=''1.2.0''then 9 else 6 end)then';
begin
 if current_user<>'postgres'
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261104210000')
 or not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.2.0'and registered)
 or(select encode(sha256(convert_to(prosrc,'UTF8')),'hex')from pg_proc where oid='eps.review_validate_fit(eps.jobs,jsonb)'::regprocedure)
   <>'655bb4833c912b0f0d9523de5a61081e1b3afbb054cc29c8df46ee29ae73abea'
 then raise exception'M08_FIT_FONTS_PREIMAGE_REQUIRED';end if;
 select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid='eps.review_validate_fit(eps.jobs,jsonb)'::regprocedure;
 if(length(source)-length(replace(source,needle,'')))/length(needle)<>1 or position(patch in source)>0 then raise exception'M08_FIT_FONTS_ANCHOR_REQUIRED';end if;
 execute replace(definition,source,replace(source,needle,patch));
 if(select encode(sha256(convert_to(prosrc,'UTF8')),'hex')from pg_proc where oid='eps.review_validate_fit(eps.jobs,jsonb)'::regprocedure)
   <>'91e27a9c641f64243a03fe54969e9f9f634bee62a50e0ff97a9534682d65adf0'
 then raise exception'M08_FIT_FONTS_READBACK_FAILED';end if;
end$fit_fonts$;
