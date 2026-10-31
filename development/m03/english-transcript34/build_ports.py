"""Offline exact-source patch compiler. No SQL execution or provider calls."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[3]
ARCHIVE=ROOT/'.local/m03-english34-discovery/182e0341-65b9-4bf6-9eee-2f94d1f0b553/ports.json'
ARCHIVE_SHA='530383505920427743f61798b2260bb71d6f070e2e15afe386a3c83f0cef8384'
MIGRATION=ROOT/'supabase/migrations/20261031143711_m03_english_transcript_projection.sql'
MARKER='-- BEGIN EXACT CANONICAL33 PORT PATCHES\n'

def compile_ports():
 raw=ARCHIVE.read_bytes();assert hashlib.sha256(raw).hexdigest()==ARCHIVE_SHA
 ports=json.loads(raw);assert ports['history_count']==33 and ports['database']=='postgres'and ports['operator']=='postgres'
 expected={p['name']:p for p in ports['ports']};assert len(expected)==8
 patches={name:[]for name in expected}
 def add(name,old,new):patches[name].append((old,new))
 add('enqueue_candidate_scan',"'schema_version',config.schema_version,'media_implementation_version',config.media_implementation_version));",
  "'schema_version',config.schema_version,'media_implementation_version',config.media_implementation_version)||case when config.english_transcript_version is null then '{}'::jsonb else jsonb_build_object('english_transcript_version',config.english_transcript_version)end);")
 add('get_candidate_stage_input',"'prompt_version','candidate_extract_v1','result_schema_version','1.0'),",
  "'prompt_version','candidate_extract_v1','result_schema_version','1.0')||case when job.input#>>'{configuration,english_transcript_version}'='1.0'then jsonb_build_object('english_transcript_version','1.0')else'{}'::jsonb end,")
 add('candidate_validate_stage',"p_schema='candidate-extraction-stage.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id','result','metadata','manual_profile_required','provider_metadata','missing_extraction_reason','provider_error_code'],array['source_asset_id','result'])",
  "p_schema=case when p_job.input#>>'{configuration,english_transcript_version}'='1.0'then'candidate-extraction-stage.v2'else'candidate-extraction-stage.v1'end and eps.specs_stage_shape(p_payload,array['source_asset_id','result','metadata','manual_profile_required','provider_metadata','missing_extraction_reason','provider_error_code']||case when p_job.input#>>'{configuration,english_transcript_version}'='1.0'then array['english_transcript']else'{}'::text[]end,array['source_asset_id','result']||case when p_job.input#>>'{configuration,english_transcript_version}'='1.0'then array['english_transcript']else'{}'::text[]end)")
 old="  select * into strict transcribed from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='transcribe_candidate';"
 add('candidate_validate_stage',old,old+"\n  perform eps.validate_candidate_english_transcript(p_job,p_schema,p_payload,transcribed.payload->'original_transcript');")
 add('apply_candidate_scan',"extracted.result_schema='candidate-extraction-stage.v1'",
  "extracted.result_schema=case when job.input#>>'{configuration,english_transcript_version}'='1.0'then'candidate-extraction-stage.v2'else'candidate-extraction-stage.v1'end")
 old=" transcript:=transcribed.payload->'original_transcript'; extraction:=extracted.payload->'result';"
 add('apply_candidate_scan',old,old+"\n perform eps.validate_candidate_english_transcript(job,extracted.result_schema,extracted.payload,transcript);")
 old=" if selected.payload->>'selection_method'='manual_required' then issues:=array_append(issues,'FRAME_SELECTION_UNAVAILABLE');end if;"
 add('apply_candidate_scan',old,old+"\n if extracted.payload#>>'{english_transcript,status}'='unavailable'then issues:=array_append(issues,'ENGLISH_TRANSCRIPT_UNAVAILABLE');end if;")
 add('apply_candidate_scan',"insert into eps.candidate_media(id,candidate_id,source_asset_id,transcript_asset_id,original_transcript,transcript_segments,languages,extraction,source_job_id,selected_frame_asset_ids,processing_issues)",
  "insert into eps.candidate_media(id,candidate_id,source_asset_id,transcript_asset_id,original_transcript,transcript_segments,languages,extraction,source_job_id,selected_frame_asset_ids,processing_issues,english_transcript,english_transcript_status,english_transcript_source_sha256,english_transcript_input_hash,english_transcript_metadata)")
 add('apply_candidate_scan',"nullif(extraction,'null'::jsonb),job.id,chosen_frames,issues);",
  "nullif(extraction,'null'::jsonb),job.id,chosen_frames,issues,extracted.payload#>>'{english_transcript,text}',coalesce(extracted.payload#>>'{english_transcript,status}','not_captured'),extracted.payload#>>'{english_transcript,source_sha256}',case when job.input#>>'{configuration,english_transcript_version}'='1.0'then job.input_hash end,coalesce(extracted.payload#>'{english_transcript,metadata}','[]'::jsonb));")
 add('cast_media_dto',"'processing_issues',to_jsonb(media.processing_issues),'row_version',media.row_version)",
  "'processing_issues',to_jsonb(media.processing_issues),'english_transcript',media.english_transcript,'english_transcript_status',media.english_transcript_status,'row_version',media.row_version)")
 old=" perform set_config('eps.presentation.transcript_capture_version',coalesce(prior_context,''),true);"
 add('capture_presentation_video_transcripts',old," if version.english_transcript_version='1.0'then perform eps.capture_presentation_video_english_transcripts(version.id);end if;\n"+old)
 add('presentation_video_transcript',"'original_text',null,'languages','[]'::jsonb,'source_kind','source_transcript','source_sha256',null);end if;",
  "'original_text',null,'languages','[]'::jsonb,'source_kind','source_transcript','source_sha256',null)||eps.presentation_video_english_transcript(p_version,p_asset);end if;")
 add('presentation_video_transcript',"'original_text',item.original_text,'languages',to_jsonb(item.languages),'source_kind','source_transcript','source_sha256',item.source_sha256);",
  "'original_text',item.original_text,'languages',to_jsonb(item.languages),'source_kind','source_transcript','source_sha256',item.source_sha256)||eps.presentation_video_english_transcript(p_version,p_asset);")
 add('eps_generate_version','generation_note,created_at)','generation_note,created_at,english_transcript_version)')
 add('eps_generate_version','job_id,auth.uid(),note,created_at);',"job_id,auth.uid(),note,created_at,'1.0');")
 fragments=[];summary=[]
 def literal(value):return "'"+value.replace("'","''")+"'"
 for name,port in sorted(expected.items()):
  definition=port['definition'].replace('\r\n','\n');match=re.search(r'AS (\$[A-Za-z0-9_]*\$)(.*?)\1',definition,re.S);assert match,name
  original=match[2];assert hashlib.sha256(original.encode()).hexdigest()==port['source_sha256'],name
  changed=original
  lines=[f" -- {port['signature']}",f" routine:={literal(port['signature'])}::regprocedure;",
   " select replace(prosrc,E'\\r\\n',E'\\n'),replace(pg_get_functiondef(oid),E'\\r\\n',E'\\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;",
   f" if encode(sha256(convert_to(source,'UTF8')),'hex')<>{literal(port['source_sha256'])} or before_attributes->>'proowner' is distinct from({literal(port['owner'])}::regrole::oid)::text",
   f" or before_attributes->'prosecdef'is distinct from'{str(port['definer']).lower()}'::jsonb or before_attributes->'proconfig'is distinct from {literal(json.dumps(port['config']))}::jsonb",
   f" or(select proacl::text from pg_proc where oid=routine)is distinct from {literal(port['acl'])}",
   " then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;"]
  for index,(old,new)in enumerate(patches[name]):
   assert changed.count(old)==1,(name,index,changed.count(old));changed=changed.replace(old,new,1)
   lines +=[f" old_text:=$old34_{index}${old}$old34_{index}$;new_text:=$new34_{index}${new}$new34_{index}$;",
    " if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);"]
  lines +=[f" if encode(sha256(convert_to(source,'UTF8')),'hex')<>{literal(hashlib.sha256(changed.encode()).hexdigest())}then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;",
   " select replace(prosrc,E'\\r\\n',E'\\n')into original_source from pg_proc where oid=routine;",
   " if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;",
   " execute replace(definition,original_source,source);",
   " if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;"]
  fragments.append('\n'.join(lines));summary.append({'signature':port['signature'],'owner':port['owner'],'before_sha256':port['source_sha256'],'after_sha256':hashlib.sha256(changed.encode()).hexdigest(),'once_only_patches':len(patches[name]),'attributes_retained':True})
 return "do $english34_ports$declare routine regprocedure;source text;definition text;original_source text;old_text text;new_text text;before_attributes jsonb;begin\n"+'\n'.join(fragments)+"\nend$english34_ports$;\n",summary

if __name__=='__main__':
 block,summary=compile_ports();source=MIGRATION.read_text(encoding='utf8');source=source.split(MARKER)[0];MIGRATION.write_text(source+MARKER+block,encoding='utf8',newline='\n')
 (Path(__file__).parent/'port-patches.json').write_text(json.dumps({'source_archive_sha256':ARCHIVE_SHA,'ports':summary},indent=2)+'\n',encoding='utf8',newline='\n')
 print(json.dumps({'compiled_ports':len(summary),'patch_count':sum(x['once_only_patches']for x in summary),'sql_executed':False}))
