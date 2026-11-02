"""Pure fake-port rendering + SQL parser diagnosis. No DB/Docker/provider I/O."""
from pathlib import Path
import hashlib,json,subprocess
from pglast import parse_sql,parse_plpgsql
ROOT=Path(__file__).resolve().parents[4]
PROBES=ROOT/'development/m07/presentation-lock-source-proof/probes.mjs'
PROOF=ROOT/'development/m07/presentation-lock-source-proof/proof.mjs'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(PROBES)=='8973de4f38895f2497b46d87d6dda0fe929f2652d8cebb870c9d402587bf21b4'
assert sha(PROOF)=='087df11fa717f72043c9782c8da7380ae8cda559221a0495582d1dcd01d22448'
script="""
import{verifyEdges}from PROBES;import{idFor,acting}from PROOF;
const run='11111111-1111-4111-8111-111111111111',id=label=>idFor(run,label),workspace=id('large'),series=id('series'),calls=[];let measured=false;
const observer={pid:33,async request(sql){calls.push(sql);if(sql.includes('do $cross_workspace$'))return[{slot_code:'23503',pool_code:'23503'}];if(sql.includes("'workspace',workspace_id"))return[{workspace,pool:id('pool-2-1'),row_version:1,updated_at:'synthetic',row_sha256:'a'.repeat(64)}];return[];}};
const holder={pid:11,async request(sql){calls.push(sql);if(sql.includes('locksource41_measure')){measured=true;return[{ok:true,duration_ms:1}];}if(sql.includes("'archived_pool'"))return[{archived_pool:true,active_reference:true}];return[];}};
const contender={pid:22,async request(sql){calls.push(sql);if(sql.includes('locksource41_probe_pool_share'))return[measured?{found:true,locked:true,code:'55P03'}:{found:true,locked:false}];return[];}};
await verifyEdges({observer,holder,contender,id,acting,workspace,series,variant:'old'});process.stdout.write(JSON.stringify(calls));
""".replace('PROBES',json.dumps(PROBES.as_uri())).replace('PROOF',json.dumps(PROOF.as_uri()))
r=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--eval',script],capture_output=True,text=True,timeout=15)
assert r.returncode==0,'FAKE_PORT_RENDER_FAILED'
queries=json.loads(r.stdout);bad=[];counts={'::uuidwhere':0,'::uuidand':0}
for i,query in enumerate(queries):
 for token in counts:counts[token]+=query.count(token)
 try:parse_sql(query);parse_plpgsql(query)
 except Exception as error:bad.append({'query_index':i,'sha256':hashlib.sha256(query.encode()).hexdigest(),'parser_error_type':type(error).__name__})
 corrected=query.replace('::uuidwhere','::uuid where').replace('::uuidand','::uuid and')
 parse_sql(corrected);parse_plpgsql(corrected)
assert len(bad)==2 and counts=={'::uuidwhere':1,'::uuidand':2}
print(json.dumps({'scope':'pure_fake_port_rendering_and_parser_only','SQL_Docker_or_provider_executed':False,'frozen_probe_sha256':sha(PROBES),'rendered_query_count':len(queries),'invalid_rendered_queries':bad,'invalid_token_occurrences':counts,'three_whitespace_insertions_in_RAM_parse_all_queries':True,'frozen_source_modified':False,'actual11ea_primary_native_error_retained':False,'actual11ea_observed_failure':'LOCKSOURCE41_EDGE_ROLLBACK_UNCONFIRMED','causality_limit':'The invalid rendered SQL is a definite harness defect. The original native session error was masked by cleanup, so this is not recovery of that lost HTTP/SQL diagnostic or a product-security finding.'}))
