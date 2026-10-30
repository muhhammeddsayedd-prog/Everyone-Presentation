"""Fixed read-only Dummy Test observer. No feedback text, names or credentials."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import uuid

from release_foundation import ROOT,TARGET
from release_m06_forward26 import call as cli_call,validate_process_scope

SQL='tools/sql/m06-app-capture.sql'
SQL_SHA='3ea7b6546bce9a4f82e1a6e1de1c57d20bec7115d86c77bc3ad1946c5d0c81e7'
MANIFEST='development/local-db/reviewed.json'
WORKSPACE='098d5b48-42a3-475b-b562-735c9eafce80'
BASELINE='tracking/evidence/m05/app-capture/2026-10-30T00-06-42-638598Z-d5ef6628.json'
BASELINE_SHA='94a3df146c92a0a6c744f338036b39a514129d27bc9068baee959eff780b528e'
SOURCES=[SQL,MANIFEST,BASELINE,'tools/capture-m06-app.py','tests/operations/test_m06_app_capture.py',
    'tools/release_m06_forward26.py','tools/release_foundation.py','tools/provision_logo_verifier.py']
IMMUTABLE_FIELDS=('id','series_id','workspace_id','version_no','status','snapshot_sha256','manifest_sha256','inventory_sha256',
    'snapshot_hash_matches','manifest_hash_matches','inventory_hash_matches','page_count','template_version','template_content_sha256',
    'slides','pins','pdf_asset_id','manifest_asset_id','pdf_sha256','pdf_bytes','manifest_bytes_sha256')
UUID=re.compile(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}')
HASH=re.compile(r'[a-f0-9]{64}')

def require(value):
    if not value:raise ValueError('M06_APP_CAPTURE_UNCONFIRMED')

def sha(value):return hashlib.sha256(value).hexdigest()
def exact(value,keys):require(type(value)is dict and set(value)==set(keys))
def identifier(value):require(type(value)is str and UUID.fullmatch(value))
def digest(value):require(type(value)is str and HASH.fullmatch(value))
def integer(value,minimum=0,maximum=9007199254740991):require(type(value)is int and minimum<=value<=maximum)
def boolean(value):require(type(value)is bool)
def optional(validator):
    def check(value):
        if value is not None:validator(value)
    return check
def enum(*values):return lambda value:require(type(value)is str and value in values)
def semver(value):require(type(value)is str and re.fullmatch(r'[0-9]{1,5}\.[0-9]{1,5}\.[0-9]{1,5}',value))
def code(value):require(type(value)is str and re.fullmatch(r'[A-Z][A-Z0-9_]{0,99}',value))
def execution(value):require(type(value)is str and re.fullmatch(r'[0-9]{1,20}',value))
def timestamp(value):
    require(type(value)is str and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})',value))
    parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));require(parsed.tzinfo is not None);return parsed
def row(value,shape):
    exact(value,shape)
    for key,validator in shape.items():validator(value[key])
def sequence(value,maximum=1000):require(type(value)is list and len(value)<=maximum)
def indexed(value,maximum=1000):
    sequence(value,maximum);result={}
    for item in value:
        require(type(item)is dict);identifier(item.get('id'));require(item['id']not in result);result[item['id']]=item
    return result

def inputs():
    validate_process_scope(os.environ);require(TARGET=='pyibofyctwnqpvktepse')
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    require(sha((ROOT/SQL).read_bytes())==SQL_SHA and sha((ROOT/BASELINE).read_bytes())==BASELINE_SHA)
    manifest=json.loads((ROOT/MANIFEST).read_bytes());require(len(manifest['migrations'])==26)
    require(manifest['migrations'][-1]['path']=='supabase/migrations/20261030004643_m06_credential_admission_guest_retry.sql')
    versions=[];names=[]
    for migration in manifest['migrations']:
        name=migration['path'];require(re.fullmatch(r'supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql',name));digest(migration['sha256'])
        require(sha((ROOT/name).read_bytes())==migration['sha256']);versions.append(Path(name).name[:14]);names.append(name)
    require(versions==sorted(set(versions)))
    baseline=json.loads((ROOT/BASELINE).read_bytes());require(baseline['result']=='captured'and baseline['target']==TARGET and baseline['read_only']is True)
    require(baseline['state']['migration_versions']==versions[:24])
    return versions,{name:sha((ROOT/name).read_bytes())for name in SOURCES+names},baseline['state']

def validate(state,versions,baseline):
    exact(state,['schema_version','observed_at','query_role','database','unrestricted_visibility','workspace_id','migration_versions',
        'series','versions','links','sessions','comments','preferences','exports','media_grants','asset_grants','jobs','protected'])
    require(state['schema_version']=='1.0'and state['query_role']==state['database']=='postgres'and state['unrestricted_visibility']is True)
    require(state['workspace_id']==WORKSPACE and state['migration_versions']==versions and len(versions)==26)
    observed=timestamp(state['observed_at'])
    series=indexed(state['series'],100);fixed=indexed(state['versions'],200);links=indexed(state['links'],200);sessions=indexed(state['sessions'],1000)
    comments=indexed(state['comments']);preferences=indexed(state['preferences']);exports=indexed(state['exports'],200);grants=indexed(state['media_grants']);jobs=indexed(state['jobs'],200)
    slides={}
    for s in series.values():
        row(s,{'id':identifier,'workspace_id':identifier,'output_type':enum('selection','shortlist'),'audience_scope':enum('internal','external'),
            'template_version':semver,'template_content_sha256':digest,'latest_ready_version_id':optional(identifier),'latest_ready_version_no':optional(lambda v:integer(v,1)),'next_version_no':lambda v:integer(v,1)})
        require(s['workspace_id']==WORKSPACE and(s['latest_ready_version_id']is None)==(s['latest_ready_version_no']is None))
    for v in fixed.values():
        row(v,{'id':identifier,'series_id':identifier,'workspace_id':identifier,'version_no':lambda x:integer(x,1),'status':enum('queued','rendering','ready','failed'),
            'snapshot_sha256':digest,'manifest_sha256':digest,'inventory_sha256':digest,'snapshot_hash_matches':boolean,'manifest_hash_matches':boolean,'inventory_hash_matches':boolean,
            'page_count':lambda x:integer(x,2,1000),'template_version':semver,'template_content_sha256':digest,'slides':sequence,'pins':sequence,
            'pdf_asset_id':optional(identifier),'manifest_asset_id':optional(identifier),'pdf_sha256':optional(digest),'pdf_bytes':optional(lambda x:integer(x,1)),
            'manifest_bytes_sha256':optional(digest),'audience_scope':enum('internal','external'),'snapshot_scope_matches_series':boolean})
        require(v['workspace_id']==WORKSPACE and v['series_id']in series);s=series[v['series_id']]
        require(v['audience_scope']==s['audience_scope']and v['template_version']==s['template_version']and v['template_content_sha256']==s['template_content_sha256'])
        require(all(v[key]is True for key in('snapshot_hash_matches','manifest_hash_matches','inventory_hash_matches','snapshot_scope_matches_series')))
        require(v['page_count']==len(v['slides'])and [d['order']for d in v['slides']]==list(range(v['page_count'])))
        for d in v['slides']:
            row(d,{'id':identifier,'order':integer,'kind':enum('cover','candidate','pending'),'assignment_id':optional(identifier),'slot_id':optional(identifier),
                'content_sha256':digest,'frame_count':optional(lambda x:integer(x,0,3)),'has_original_video':boolean})
            require(d['id']not in slides);slides[d['id']]=(v['id'],d)
        require(len({p['asset_id']for p in v['pins']})==len(v['pins']))
        for p in v['pins']:
            row(p,{'asset_id':identifier,'asset_kind':enum('client_logo','candidate_frame','candidate_video','presentation_manifest','presentation_pdf'),
                'sha256':digest,'byte_size':lambda x:integer(x,1),'current_physical_identity_matches':boolean,'retained':boolean})
            require(p['current_physical_identity_matches']is True and p['retained']is True)
        if v['status']=='ready':
            identifier(v['pdf_asset_id']);identifier(v['manifest_asset_id']);digest(v['pdf_sha256']);digest(v['manifest_bytes_sha256']);integer(v['pdf_bytes'],1)
            require(v['pdf_asset_id']!=v['manifest_asset_id'])
            for prefix,kind,checksum in [('pdf','presentation_pdf','pdf_sha256'),('manifest','presentation_manifest','manifest_bytes_sha256')]:
                pins=[p for p in v['pins']if p['asset_id']==v[prefix+'_asset_id']];require(len(pins)==1 and pins[0]['asset_kind']==kind and pins[0]['sha256']==v[checksum])
        else:require(all(v[key]is None for key in('pdf_asset_id','manifest_asset_id','pdf_sha256','pdf_bytes','manifest_bytes_sha256')))
    for s in series.values():
        if s['latest_ready_version_id']is not None:
            v=fixed.get(s['latest_ready_version_id']);require(v is not None and v['series_id']==s['id']and v['status']=='ready'and v['version_no']==s['latest_ready_version_no'])
    old=[v for v in baseline['versions']if v['status']=='ready'];require(len(old)==3)
    for v in old:require(v['id']in fixed and {k:fixed[v['id']][k]for k in IMMUTABLE_FIELDS}=={k:v[k]for k in IMMUTABLE_FIELDS})
    for l in links.values():
        row(l,{'id':identifier,'series_id':identifier,'label_present':boolean,'label_codepoints':lambda x:integer(x,0,160),'created_at':timestamp,'expires_at':timestamp,
            'expiry_default30_delta_ms':lambda x:integer(x,-315576000000,315576000000),'default_30_day_expiry':boolean,'download_enabled':boolean,'revoked_at':optional(timestamp),
            'token_generation':lambda x:integer(x,1),'export_revision':lambda x:integer(x,1),'row_version':lambda x:integer(x,1),'live':boolean,'latest_ready_version_id':optional(identifier),
            'session_count':integer,'external_comment_count':integer,'preference_count':integer})
        require(l['series_id']in series and series[l['series_id']]['audience_scope']=='external')
        require(l['latest_ready_version_id']==series[l['series_id']]['latest_ready_version_id']and l['label_present']==(l['label_codepoints']>0))
        delta=(timestamp(l['expires_at'])-timestamp(l['created_at'])-datetime.timedelta(days=30)).total_seconds()*1000
        require(abs(delta-l['expiry_default30_delta_ms'])<=1 and l['default_30_day_expiry']==(abs(delta)<=1000))
        require(l['live']==(l['revoked_at']is None and timestamp(l['expires_at'])>observed))
    for g in sessions.values():
        row(g,{'id':identifier,'review_link_id':identifier,'identified':boolean,'company_present':boolean,'link_token_generation':lambda x:integer(x,1),
            'created_at':timestamp,'expires_at':timestamp,'last_seen_at':timestamp,'parent_generation_current':boolean,'active':boolean,'comment_count':integer,'preference_count':integer})
        require(g['review_link_id']in links);l=links[g['review_link_id']]
        require(g['parent_generation_current']==(g['link_token_generation']==l['token_generation']))
        require(g['active']==(l['live']and g['parent_generation_current']and timestamp(g['expires_at'])>observed))
    def feedback_scope(f):
        require(f['version_id']in fixed and f['series_id']==fixed[f['version_id']]['series_id']and f['slide_id']in slides and slides[f['slide_id']][0]==f['version_id'])
        require((f['author_kind']=='guest')==(f['guest_session_id']is not None))
        if f['guest_session_id']is not None:
            require(f['guest_session_id']in sessions);g=sessions[f['guest_session_id']];require(links[g['review_link_id']]['series_id']==f['series_id']and g['identified']is True)
    for f in comments.values():
        row(f,{'id':identifier,'series_id':identifier,'version_id':identifier,'slide_id':identifier,'guest_session_id':optional(identifier),'author_kind':enum('guest','internal'),
            'parent_comment_id':optional(identifier),'visibility':enum('external','internal'),'resolved':boolean,'deleted':boolean,'row_version':lambda x:integer(x,1),'created_at':timestamp,'updated_at':timestamp,'reply_count':integer})
        feedback_scope(f);require(f['author_kind']!='guest'or f['visibility']=='external')
        if f['parent_comment_id']is not None:
            p=comments.get(f['parent_comment_id']);require(p is not None and p['id']!=f['id']and all(p[k]==f[k]for k in('series_id','version_id','slide_id')))
        require(f['reply_count']==sum(p['parent_comment_id']==f['id']for p in comments.values()))
    for f in preferences.values():
        row(f,{'id':identifier,'series_id':identifier,'version_id':identifier,'slide_id':identifier,'guest_session_id':optional(identifier),'author_kind':enum('guest','internal'),
            'preference':enum('preferred','maybe','not_preferred'),'row_version':lambda x:integer(x,1)})
        feedback_scope(f);require(slides[f['slide_id']][1]['kind']=='candidate')
    for g in sessions.values():
        require(g['comment_count']==sum(f['guest_session_id']==g['id']for f in comments.values()))
        require(g['preference_count']==sum(f['guest_session_id']==g['id']for f in preferences.values()))
    for l in links.values():
        own={g['id']for g in sessions.values()if g['review_link_id']==l['id']}
        require(l['session_count']==len(own)and l['external_comment_count']==sum(f['guest_session_id']in own and f['visibility']=='external'for f in comments.values())and l['preference_count']==sum(f['guest_session_id']in own for f in preferences.values()))
    for e in exports.values():
        row(e,{'id':identifier,'version_id':identifier,'review_link_id':identifier,'template_version':semver,'export_revision':lambda x:integer(x,1),'parent_token_generation':lambda x:integer(x,1),
            'current_cache_identity':boolean,'status':enum('queued','rendering','ready','failed'),'pdf_asset_id':optional(identifier),'pdf_sha256':optional(digest),'pdf_bytes':optional(lambda x:integer(x,1)),
            'pdf_identity_matches_job':optional(boolean),'canonical_pdf_unchanged':boolean,'media_grant_id':optional(identifier),'grant_digest_present':boolean,'job_id':identifier,'created_at':timestamp,'ready_at':optional(timestamp),'failure_code':optional(code)})
        require(e['review_link_id']in links and e['version_id']in fixed);l=links[e['review_link_id']];v=fixed[e['version_id']]
        require(v['series_id']==l['series_id']and v['status']=='ready'and e['template_version']==v['template_version']and e['canonical_pdf_unchanged']is True and e['pdf_asset_id']!=v['pdf_asset_id'])
        require(e['current_cache_identity']==(e['parent_token_generation']==l['token_generation']and e['export_revision']==l['export_revision']))
        require(e['job_id']in jobs and jobs[e['job_id']]['export_id']==e['id'])
        if e['status']=='ready':
            identifier(e['pdf_asset_id']);digest(e['pdf_sha256']);integer(e['pdf_bytes'],1);timestamp(e['ready_at']);require(e['pdf_identity_matches_job']is True and e['grant_digest_present']is True and e['media_grant_id']in grants and e['failure_code']is None and jobs[e['job_id']]['status']=='succeeded')
        else:
            require(all(e[k]is None for k in('pdf_asset_id','pdf_sha256','pdf_bytes','pdf_identity_matches_job','media_grant_id','ready_at'))and e['grant_digest_present']is False)
            require((e['status']=='failed')==(e['failure_code']is not None))
    for g in grants.values():
        row(g,{'id':identifier,'review_link_id':identifier,'version_id':identifier,'export_id':identifier,'parent_token_generation':lambda x:integer(x,1),'token_digest_present':boolean,'producing_attempt_id':identifier,
            'created_at':timestamp,'expires_at':timestamp,'revoked_at':optional(timestamp),'parent_generation_current':boolean,'live':boolean,'published_export_member':boolean,'video_asset_ids':sequence})
        require(g['export_id']in exports and g['review_link_id']in links and g['version_id']in fixed and g['token_digest_present']is True);e=exports[g['export_id']];l=links[g['review_link_id']]
        require(e['version_id']==g['version_id']and e['review_link_id']==g['review_link_id']and e['parent_token_generation']==g['parent_token_generation'])
        require(g['parent_generation_current']==(g['parent_token_generation']==l['token_generation']))
        require(g['live']==(g['revoked_at']is None and timestamp(g['expires_at'])>observed and l['live']and g['parent_generation_current']))
        require(g['published_export_member']==(e['media_grant_id']==g['id']and e['status']=='ready'))
        require(sorted(g['video_asset_ids'])==sorted(p['asset_id']for p in fixed[g['version_id']]['pins']if p['asset_kind']=='candidate_video'))
    sequence(state['asset_grants'])
    for g in state['asset_grants']:
        row(g,{'session_id':optional(identifier),'media_grant_id':optional(identifier),'review_link_id':identifier,'version_id':identifier,'asset_id':identifier,'export_id':optional(identifier),
            'purpose':enum('frame','logo','video','pdf'),'created_at':timestamp,'expires_at':timestamp,'token_digest_present':boolean,'fixed_asset_membership':boolean})
        require(g['token_digest_present']is True and g['fixed_asset_membership']is True and g['review_link_id']in links and g['version_id']in fixed)
        require(fixed[g['version_id']]['series_id']==links[g['review_link_id']]['series_id']and(g['session_id']is None)!=(g['media_grant_id']is None))
        require(0<=(timestamp(g['expires_at'])-timestamp(g['created_at'])).total_seconds()<=60)
        if g['session_id']is not None:require(g['session_id']in sessions and sessions[g['session_id']]['review_link_id']==g['review_link_id'])
        else:require(g['media_grant_id']in grants and grants[g['media_grant_id']]['review_link_id']==g['review_link_id']and grants[g['media_grant_id']]['version_id']==g['version_id']and g['purpose']=='video')
        if g['purpose']=='pdf':require(g['export_id']in exports and exports[g['export_id']]['pdf_asset_id']==g['asset_id']and exports[g['export_id']]['version_id']==g['version_id'])
        else:require(any(p['asset_id']==g['asset_id']and p['asset_kind']=={'video':'candidate_video','frame':'candidate_frame','logo':'client_logo'}[g['purpose']]for p in fixed[g['version_id']]['pins']))
    for j in jobs.values():
        row(j,{'id':identifier,'workspace_id':identifier,'export_id':identifier,'kind':enum('presentation_export'),'status':enum('queued','running','waiting_for_input','succeeded','failed','cancelled'),
            'stage':enum('render_export'),'attempt':integer,'current_attempt_id':optional(identifier),'dispatch_generation':lambda x:integer(x,1),'n8n_execution_id':optional(execution),'error_code':optional(code),
            'input_hash_matches':boolean,'completed_stages':sequence,'stage_receipts':sequence,'outbox':sequence})
        require(j['workspace_id']==WORKSPACE and j['export_id']in exports and exports[j['export_id']]['job_id']==j['id']and j['input_hash_matches']is True)
        for d in j['completed_stages']:
            row(d,{'stage':enum('render_export'),'attempt_id':identifier,'input_hash_matches':boolean,'result_schema':enum('presentation-export-result.v1')});require(d['input_hash_matches']is True)
        for d in j['stage_receipts']:row(d,{'stage':enum('render_export'),'attempt_id':identifier,'result_schema':enum('presentation-export-result.v1')})
        for d in j['outbox']:
            row(d,{'id':identifier,'stage':enum('render_export'),'status':enum('pending','leased','delivered','dead'),'generation':lambda x:integer(x,1),'attempt_count':lambda x:integer(x,0,5),'input_hash_matches':boolean});require(d['input_hash_matches']is True and d['generation']<=j['dispatch_generation'])
        if j['status']=='succeeded':
            require(len(j['completed_stages'])==1 and len(j['stage_receipts'])==1 and j['current_attempt_id']==j['completed_stages'][0]['attempt_id']==j['stage_receipts'][0]['attempt_id']and j['n8n_execution_id']is not None)
    row(state['protected'],{'m02_waiting_preserved':boolean,'m02_manual_note_retained':boolean,'owner_confirmed_profile_still_reviewed':boolean,'reviewed_source_sha256':digest})
    require(all(state['protected'][key]is True for key in('m02_waiting_preserved','m02_manual_note_retained','owner_confirmed_profile_still_reviewed')))
    require(state['protected']['reviewed_source_sha256']=='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a')
    return {'old_ready_versions_preserved':len(old),'fixed_workspace_and_external_link_scope_verified':True,
        'feedback_version_slide_identity_and_ownership_counts_verified':True,'export_pdf_and_grant_fixed_identity_verified':True,
        'protected_m02_and_owner_reviewed_preserved':True,'no_names_text_urls_or_credentials_in_observation':True}

def retain(report):
    directory=ROOT/'tracking/evidence/m06/app-capture';directory.mkdir(parents=True,exist_ok=True)
    file=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
    with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
    return file.relative_to(ROOT).as_posix()

def main(arguments=None):
    arguments=sys.argv[1:]if arguments is None else arguments;require(arguments==[])
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'unconfirmed','target':TARGET,'read_only':True,
        'provider_called_by_observer':False,'browser_session_used':False,'private_payloads_names_urls_paths_credentials_or_credential_digests_published':False,'hosting_deferred':True}
    try:
        versions,seals,baseline=inputs()
        result=cli_call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
        require(result.returncode==0 and len(result.stdout.encode())<=1024*1024)
        rows=json.loads(result.stdout)['rows'];sequence(rows,1);require(len(rows)==1);exact(rows[0],['m06_app_capture'])
        state=rows[0]['m06_app_capture'];checks=validate(state,versions,baseline);require(inputs()==(versions,seals,baseline))
        report.update(result='captured',state=state,checks=checks,source_sha256=seals,sources_stable=True)
    except Exception:report['code']='M06_APP_CAPTURE_UNCONFIRMED'
    file=retain(report);print(json.dumps({'result':report['result'],'receipt':file,'read_only':True}))
    return 0 if report['result']=='captured'else 1

if __name__=='__main__':sys.exit(main())
