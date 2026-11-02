"""Finite source/data projection of the passed independent-session39 cases."""
from pathlib import Path
import hashlib,json,re
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BASE=MAIN/'development/m07/worker39-concurrency/cases.mjs'
BASE_SHA='157da473cfe11b642ff994e665d009ceb6ec56ff9db2c39f2a1fecd433a054e5'
def need(value):
 if not value:raise ValueError('WORKER40_CONCURRENCY_PROJECTION_REFUSED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def project(contract_sha256,enabled=False):
 raw=BASE.read_bytes();need(sha(raw)==BASE_SHA and re.fullmatch('[a-f0-9]{64}',contract_sha256));source=raw.decode();changes=[]
 def replace(before,after,count=1):
  nonlocal source;need(source.count(before)==count);source=source.replace(before,after);changes.append({'before':before,'after':after,'count':count})
 replace('export const EXECUTION_ENABLED = true;','export const EXECUTION_ENABLED = '+str(enabled).lower()+';')
 begin=source.index('export function adaptFixture(');end=source.index('\nexport function comparable',begin);original=source[begin:end]
 adapted=r"""export function adaptFixture(raw,identity,run){
 const value=original.adaptFixture(raw,identity,run);let text=value.text;const changes=[];
 const replace=(before,after,count)=>{assert.equal(text.split(before).length-1,count);text=text.replaceAll(before,after);changes.push({before_sha256:sha(before),after_sha256:sha(after),count});};
 replace('(select count(*)from supabase_migrations.schema_migrations)<>39','(select count(*)from supabase_migrations.schema_migrations)<>40',1);
 replace("(select max(version)from supabase_migrations.schema_migrations)<>'20261101223342'","(select max(version)from supabase_migrations.schema_migrations)<>'20261102085405'",1);
 const begin=text.indexOf('-- Nonsecret synthetic version labels only;'),end=text.indexOf('create schema eps_worker38_conc;',begin);assert(begin>0&&end>begin);const removed=text.slice(begin,end);
 const tables=[...removed.matchAll(/update eps\.([a-z_]+) set/gu)].map(match=>match[1]).sort();assert.deepEqual(tables,['candidate_asset_config','frame_extraction_config','presentation_processing_config','review_processing_config','specs_pipeline_config']);
 text=text.slice(0,begin)+text.slice(end);assert.equal(text.includes(removed),false);
 return {...value,text,adapted_sha256:sha(text),worker40_changes:changes,config_setup_replaced_by_exact_valid95e9_fixture:true,removed_five_config_block_sha256:sha(removed),actual_rpc_implementation_copied_or_modified:false};
}"""
 replace(original,adapted);source="import * as original from "+json.dumps(BASE.as_uri())+";\n"+source
 # Shape projection only; every real SQL/RPC, distinct backend/wait loop,
 # rollback/cleanup, denial and conservative retry assertion stays in place.
 for name in('before','paused','observed','final'):
  before=name+'.canonical.lifecycle';replace(before,name+'.lifecycle',source.count(before))
 replace('.canonical.','.schema40.canonical.',source.count('.canonical.'))
 replace('before.intent_data.count','before.schema40.intents.count')
 replace('or(select count(*)from supabase_migrations.schema_migrations)<>39 then', 'or(select count(*)from supabase_migrations.schema_migrations)<>40 then')
 replace("cfg.sql_contract_sha256, '4c184701d181e539d3b5de2d2d4a68d7a985086c195108872dde5d6fe61a4ff9'","cfg.sql_contract_sha256, '"+contract_sha256+"'")
 replace('before.schema40.canonical.base.history.length, 39','before.schema40.canonical.base.history.length, 40')
 replace('(COMPLETION39_[A-Z_]+)','(WORKER_IDENTITY_[A-Z_]+)')
 replace("rejection?.code, 'COMPLETION39_PREFLIGHT_CHANGED'","rejection?.code, 'WORKER_IDENTITY_PREIMAGE_CHANGED'")
 inverse=source.removeprefix('import * as original from '+json.dumps(BASE.as_uri())+';\n')
 for change in reversed(changes):need(inverse.count(change['after'])==change['count']);inverse=inverse.replace(change['after'],change['before'])
 need(inverse.encode()==raw);return source,{'base':str(BASE),'base_sha256':BASE_SHA,'projected_sha256':sha(source.encode()),'exact_inverse_byte_equal':True,'changes':[{'before_sha256':sha(item['before'].encode()),'after_sha256':sha(item['after'].encode()),'count':item['count']}for item in changes]}
