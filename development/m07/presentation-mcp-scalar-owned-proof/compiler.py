"""Finite compile-only adapter over the frozen bounded owned40 controller."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE=Path(__file__).resolve().parent
SOURCE=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=HERE.parent/'logo-info-owned-proof'
PINS={'compiler.py':'d6a9f64b92dd02c424729e5a7f0ed7bd00d6a5a7301e427a3d9b4c1a385afb35',
      'entry.mjs':'cc3c1cf2909ee8d3e9a88c0c0397a40f08ba63f3a945230ccb6f44903b97a3bc',
      'entry.test.mjs':'357b82223fce55358e8f597806805afd8b4cdfe2ed527807a0b297a8ae7cffba',
      'README.md':'2f392462c139502d2f2737ded6d93421f9e9f879a021d033dc85abbd36647b00',
      'test_compiler.py':'148a9910ff074ef3eaf4533e987487459a0d09096052b4752d3fcace62fb2552'}


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('MCP_SCALAR_OWNED_COMPILATION_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def compile_source(relative):
    match=re.fullmatch(r'\.local/mcp-scalar-owned-compiled/controller-([a-f0-9-]{36})\.mjs',relative)
    need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
    for name,digest in PINS.items():need(sha((OLD/name).read_bytes())==digest)
    old=load('scalar_owned_frozen_controller',OLD/'compiler.py')
    source,prior=old.compile_source(relative.replace('mcp-scalar-owned-compiled','logo-info-owned-compiled'))
    proof=load('scalar_owned_transaction',HERE/'proof.py');p=load('scalar_owned_entry_projection',HERE/'projection.py')
    p.admit_entry((HERE/'entry.mjs').read_bytes().decode('utf8'))
    start=source.index('const cfg=')+len('const cfg=');cfg,length=json.JSONDecoder().raw_decode(source[start:])
    text=proof.proof(cfg['template_run']);case_ids=re.findall(r"select pg_temp\.scalar_case\('(old|candidate)','([^']+)'",text)
    need(len(case_ids)>80 and len(case_ids)==len(set(case_ids)))
    cfg.update(proof_sql=text,proof_sql_sha256=sha(text.encode()),expected_cases=[{'variant':variant,'case':name}for variant,name in case_ids],
               compile_uuid=match[1],controller=str(MAIN/relative),scalar_candidate={k:v for k,v in proof.candidate().build().items()if k not in['before','after']})
    for unused in ['original_proof_sql_sha256','owned_database_guard_inverse_equal']:cfg.pop(unused,None)
    files=sorted(file for folder in[HERE,proof.CANDIDATE.parent]for file in folder.iterdir()if file.is_file()and file.suffix in['.py','.mjs','.md','.sql','.diff'])
    for file in files:cfg['source_pins'][str(file)]=sha(file.read_bytes())
    source=source[:start]+json.dumps(cfg,sort_keys=True)+source[start+length:]
    edits=[]
    def replace(a,b):
        nonlocal source
        need(source.count(a)==1);source=source.replace(a,b,1);edits.append((a,b))
    replace(json.dumps((OLD/'entry.mjs').as_uri()),json.dumps((HERE/'entry.mjs').as_uri()))
    for a,b in [("'.local/logo-info-owned-proof'","'.local/mcp-scalar-owned-proof'"),("'eps.logoinfo.run'","'eps.scalarmcp.run'"),("'eps.logoinfo.workspace'","'eps.scalarmcp.workspace'"),("'eps.logoinfo.purpose'","'eps.scalarmcp.purpose'"),("'logo-info-operation-owned-SQL-proof'","'scalar-MCP-capability-owned-SQL-parity'"),("'eps-logoinfo-'","'eps-scalarmcp-'"),("'logo-info-operation-owned-proof'","'scalar-MCP-capability-owned-proof'"),("'tracking/evidence/m07/logo-info-owned-proof'","'tracking/evidence/m07/presentation-mcp-scalar-owned-proof'")]:replace(a,b)
    replace("report.checkpoint='logo-info-rollback-proof';","report.checkpoint='scalar-capability-rollback-proof';")
    replace('await logoInfo.runProof({runId,privateRoot,sql,baseline:cloneBaseline,report},cfg);','await logoInfo.runProof({runId,privateRoot,sql,baseline:cloneBaseline,report,identity,originalSystem:target.observed.system_identifier},cfg);')
    start=source.index('    report.source_seals = {}; for (const [root, file] of ');stop=source.index(' {\n      const bytes = await readFile',start)
    records=[]
    for name in cfg['source_pins']:
        file=Path(name);root=MAIN if file.is_relative_to(MAIN)else SOURCE;need(file.is_relative_to(root));records.append([str(root),file.relative_to(root).as_posix()])
    records.append([str(MAIN),relative]);replace(source[start:stop],'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')')
    replace('fresh owned PG17 restored38 plus exact39/40 functional DDL, one rollback-only logo INFO operation/RLS proof; no hosted Storage, bytes, cloud or provider acceptance','fresh owned PG17 restored38 plus exact39/40, one rollback-only scalar MCP boolean/NULL/native parity transaction; no signed OAuth/cloud/provider/generation acceptance')
    # Every controller edit after the explicit cfg data replacement inverts.
    inverse=source
    for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    base,projection=old.compile_source(relative.replace('mcp-scalar-owned-compiled','logo-info-owned-compiled'))
    at=base.index('const cfg=')+len('const cfg=');_,size=json.JSONDecoder().raw_decode(base[at:]);base=base[:at]+json.dumps(cfg,sort_keys=True)+base[at+size:]
    need(inverse==base)
    return source,{'finite_controller_inverse_byte_equal_after_declared_cfg_replacement':True,'frozen_owned40_projection':projection,
                   'case_count':len(case_ids),'proof_sql_sha256':cfg['proof_sql_sha256'],'source_pins':cfg['source_pins'],
                   'no_new_transport_timeout_role_or_security_mode':True}


if __name__=='__main__':
    relative='.local/mcp-scalar-owned-compiled/controller-'+str(uuid.uuid4())+'.mjs';source,proof=compile_source(relative);file=MAIN/relative
    file.parent.mkdir(parents=True,exist_ok=True)
    with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(source)
    print(json.dumps({'compiled_only':True,'execution_dispatched':False,'path':relative,'sha256':sha(source.encode()),'projection':proof}))
