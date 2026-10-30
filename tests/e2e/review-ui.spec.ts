import { expect, test } from '@playwright/test';

const workspace='99000000-0000-4000-8000-000000000001', project='99000000-0000-4000-8000-000000000002';
const series='99000000-0000-4000-8000-000000000003', audience='99000000-0000-4000-8000-000000000004';
const assignment='99000000-0000-4000-8000-000000000005', candidate='99000000-0000-4000-8000-000000000006';
const media='99000000-0000-4000-8000-000000000012',asset='99000000-0000-4000-8000-000000000013';
const role='99000000-0000-4000-8000-000000000007',slot='99000000-0000-4000-8000-000000000008';
const fields={name_or_id:'Synthetic review person',age_or_range:'Not provided',height_measurements:'Not provided',languages_accents:'Arabic',skills_experience:'Supplied longer experience',city:'Not provided',previous_projects_roles:'Not provided',classification:'Not provided',availability:'Monday',presentation_notes:'Only this assignment'};
test('review uses an exact series, retains ten fields and applies only previewed assignment wording',async({page})=>{
 let wording=fields.skills_experience,revision=1,fingerprint=1;const changes:Record<string,unknown>[]=[];
 let suggestionRequested=false,suggestionDelivered=false;let releaseSuggestion!:()=>void;
 const suggestionWait=new Promise<void>(resolve=>{releaseSuggestion=resolve;});
 const suggestion='99000000-0000-4000-8000-000000000011';
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;const ok=(data:unknown)=>route.fulfill({json:{request_id:'synthetic-review',data}});
  const list=(data:unknown[])=>route.fulfill({json:{request_id:'synthetic-review',data,page:{next_cursor:null}}});
  if(p==='/api/session')return ok({mode:'supabase',actor:{id:'review-producer',name:'Synthetic Producer',capabilities:['projects.read','workspaces.read','workspaces.write','cast.read','cast.write','cast.review','presentations.generate'],upload_purposes:[]},actors:[]});
  if(p===`/api/v1/projects/${project}`)return ok({id:project,name:'Synthetic review project',client_name:null,client_id:null,row_version:1,can_edit:false});
  if(p===`/api/v1/workspaces/${workspace}`)return ok({id:workspace,project_id:project,module:'casting',title:'Synthetic review project',active_output:'selection',row_version:1,draft_revision:revision,has_unpublished_changes:true});
  if(p==='/api/v1/audience-presets')return list([{id:audience,key:'external',label:'Client review',scope:'external',settings:{},archived:false,row_version:1}]);
  const template={key:'everyone-casting',version:'1.0.0',content_sha256:'8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001',font_key:'everyone-casting-fonts-v1'};
  if(p==='/api/v1/presentation-series')return list([{id:series,workspace_id:workspace,output_type:'selection',audience_preset_id:audience,audience_snapshot:{id:audience,key:'external',label:'Client review',scope:'external',settings:{},archived:false,row_version:1},title:'Cast Selection',latest_ready_version_id:null,latest_ready_version_no:null,row_version:1,archived:false,template_key:template.key,template_version:template.version,template_content_sha256:template.content_sha256,font_key:template.font_key}]);
  if(p===`/api/v1/workspaces/${workspace}/review`){expect(url.searchParams.get('series_id')).toBe(series);return ok({workspace_id:workspace,series_id:series,input_fingerprint:String(fingerprint).repeat(64),draft_revision:revision,output_type:'selection',candidate_slide_count:1,pending_slide_count:1,issues:[{code:'MISSING_FACTS',severity:'warning',entity_id:candidate,field:null,message:'Some supplied facts are missing.',repair_action:'Review profile'}],can_generate:false,unreviewed_candidate_ids:[candidate],template,cover:{project_name:'Synthetic review project',client_name:null,title:'Cast Selection',output_type:'selection',logo_asset_id:null,logo_placement:'cover'},fit:{status:'unmeasured',input_fingerprint:null,measured_at:null,overflows:[],error_code:null},slides:[{kind:'candidate',role_id:role,role_name:'Father',slot_id:slot,slot_label:'Father 1',assignment_id:assignment,assignment_row_version:revision,workspace_candidate_id:'99000000-0000-4000-8000-000000000009',workspace_candidate_row_version:1,candidate_id:candidate,candidate_row_version:1,candidate_media_id:media,position:'option',review_status:'unreviewed',requirements:{age_range:null,gender_requirement:null,languages:[],skills:[]},provisional:false,fields:{...fields,skills_experience:wording},source_fields:fields,frames:[],video_asset_id:asset},{kind:'pending',role_id:role,role_name:'Father',slot_id:'99000000-0000-4000-8000-000000000010',slot_label:'Father 2',assignment_id:null,assignment_row_version:null,workspace_candidate_id:null,workspace_candidate_row_version:null,candidate_id:null,candidate_row_version:null,candidate_media_id:null,position:null,review_status:null,requirements:{age_range:null,gender_requirement:null,languages:[],skills:[]},provisional:false,fields:Object.fromEntries(Object.keys(fields).map(k=>[k,'Not provided'])),source_fields:Object.fromEntries(Object.keys(fields).map(k=>[k,'Not provided'])),frames:[],video_asset_id:null}]});}
  if(p===`/api/v1/candidates/${candidate}/media`){expect(url.searchParams.get('limit')).toBe('100');if(!url.searchParams.has('cursor'))return route.fulfill({json:{request_id:'synthetic-review-page1',data:[{id:'another-source',source_asset_id:'another-asset'}],page:{next_cursor:'synthetic-source-next'}}});expect(url.searchParams.get('cursor')).toBe('synthetic-source-next');return list([{id:media,source_asset_id:asset,preview_asset_id:null,original_transcript:'Synthetic source transcript only.'}]);}
  if(p===`/api/v1/assignments/${assignment}`&&req.method()==='PATCH'){const body=req.postDataJSON();changes.push(body);expect(body.row_version).toBe(revision);if(body.slide_wording.skills_experience==='A late AI proposal'){expect(body.ai_suggestion_id).toBe(suggestion);expect(body.expected_series_id).toBe(series);expect(body.expected_input_fingerprint).toBe(String(fingerprint).repeat(64));}wording=body.slide_wording.skills_experience;revision++;fingerprint++;return ok({id:assignment,row_version:revision});}
  if(p==='/api/v1/ai-suggestions'&&req.method()==='POST')return ok({job_id:suggestion,resource_id:suggestion,poll_url:'/api/v1/jobs/'+suggestion,status:'queued'});
  if(p==='/api/v1/ai-suggestions/'+suggestion){suggestionRequested=true;await suggestionWait;await ok({id:suggestion,target_id:assignment,target_row_version:revision,status:'succeeded',suggested_text:'A late AI proposal',proposed_changes:[{field:'skills_experience',old_value:wording,new_value:'A late AI proposal'}],warnings:[]});suggestionDelivered=true;return;}
  return route.fulfill({status:404,json:{error:{code:'NOT_FOUND',message:'Synthetic route unavailable'}}});
 });
 await page.goto(`/projects/${project}/casting/${workspace}/review`);
 await expect(page.getByRole('heading',{name:'Final review',exact:true})).toBeVisible();
 await expect(page.getByText('1 candidate slide · 1 Pending slot',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Assignment review',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Review Father 1',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Assignment review',exact:true})).toBeVisible();
 await expect(page.getByText('Image not provided',{exact:true}).first()).toBeVisible();
 await page.getByText('Original transcript and video',{exact:true}).click();
 await expect(page.getByText('Synthetic source transcript only.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Play source video',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Slide wording field',exact:true}).selectOption('skills_experience');
 await page.getByRole('textbox',{name:'Presentation wording',exact:true}).fill('Supplied experience');
 await page.getByRole('button',{name:'Save slide wording',exact:true}).click();
 await expect.poll(()=>wording).toBe('Supplied experience');
 expect(fields.skills_experience).toBe('Supplied longer experience');expect(changes).toHaveLength(1);
 await expect(page.getByText('Slide wording saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review Father 1',exact:true}).click();
 await page.getByRole('button',{name:'Suggest shorter saved wording',exact:true}).click();
 await expect.poll(()=>suggestionRequested).toBe(true);
 await page.getByRole('textbox',{name:'Presentation wording',exact:true}).fill('Manual draft keeps control');
 releaseSuggestion();await expect.poll(()=>suggestionDelivered).toBe(true);await page.waitForLoadState('networkidle');
 await expect(page.getByRole('button',{name:'Apply this suggestion',exact:true})).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Presentation wording',exact:true})).toHaveValue('Manual draft keeps control');
 await page.getByRole('button',{name:'Save slide wording',exact:true}).click();
 await expect.poll(()=>wording).toBe('Manual draft keeps control');expect(changes).toHaveLength(2);
 await expect(page.getByText('Slide wording saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review Father 1',exact:true}).click();
 await page.getByRole('button',{name:'Suggest shorter saved wording',exact:true}).click();
 await expect(page.getByRole('button',{name:'Apply this suggestion',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Apply this suggestion',exact:true}).click();
 await expect.poll(()=>wording).toBe('A late AI proposal');expect(changes).toHaveLength(3);
 await expect(page.getByText('Slide wording saved.',{exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Slide wording field',exact:true}).selectOption('city');
 await expect(page.getByRole('textbox',{name:'Presentation wording',exact:true})).toHaveValue('');
 fields.city='Refreshed source city';fingerprint++;
 await page.getByRole('button',{name:'Refresh review',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Presentation wording',exact:true})).toHaveValue('Refreshed source city');
 await page.getByRole('textbox',{name:'Presentation wording',exact:true}).fill('Unsent wording');
 await expect(page.getByRole('button',{name:'Refresh review',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Discard wording edit',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Presentation wording',exact:true})).toHaveValue('Refreshed source city');
 fields.availability='Refreshed project availability';fingerprint++;
 await page.getByRole('button',{name:'Refresh review',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Project availability',exact:true})).toHaveValue('Refreshed project availability');
 await page.getByRole('textbox',{name:'Project availability',exact:true}).fill('Unsent availability');
 await expect(page.getByRole('button',{name:'Refresh review',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Discard availability edit',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Project availability',exact:true})).toHaveValue('Refreshed project availability');
 // The owner explicitly excluded mobile from the scoped M07 continuation.
 // Default execution retains this historical responsive check.
 if(process.env.EPS_SKIP_MOBILE_TESTS!=='true'){
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.clientWidth)).toBe(390);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await page.getByRole('heading',{name:'Final review',exact:true}).click();
  await page.screenshot({path:'.local/m04-review-root/review-mobile-controlled.png',fullPage:true});
 }
});
