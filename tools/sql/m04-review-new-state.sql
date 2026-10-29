-- New fixed configuration/template rows and technical counts/hash only.
with names(name)as(values('eps.presentation_templates'),('eps.presentation_series'),('eps.review_processing_config'),('eps.ai_suggestions'),('eps.review_stage_payloads'),('eps.review_fit_results')),
rows(name,value)as(
 select 'eps.presentation_templates',to_jsonb(t)from eps.presentation_templates t union all
 select 'eps.presentation_series',to_jsonb(t)from eps.presentation_series t union all
 select 'eps.review_processing_config',to_jsonb(t)from eps.review_processing_config t union all
 select 'eps.ai_suggestions',to_jsonb(t)from eps.ai_suggestions t union all
 select 'eps.review_stage_payloads',to_jsonb(t)from eps.review_stage_payloads t union all
 select 'eps.review_fit_results',to_jsonb(t)from eps.review_fit_results t),
digests as(select names.name,count(rows.value)count,encode(sha256(convert_to(coalesce(string_agg(rows.value::text,E'\n'order by rows.value::text),''),'UTF8')),'hex')sha256 from names left join rows using(name)group by names.name)
select jsonb_build_object('new_tables',(select jsonb_object_agg(name,jsonb_build_object('count',count,'sha256',sha256))from digests),'review_state',jsonb_build_object('config',(select to_jsonb(c)from eps.review_processing_config c where id),'template',(select to_jsonb(t)from eps.presentation_templates t where key='everyone-casting'and version='1.0.0')));
