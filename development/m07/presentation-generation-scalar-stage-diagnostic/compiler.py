"""Finite current7 diagnostic composition; compile-only, no runtime dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('SCALAR_CURRENT_STAGE_COMPILATION_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def compile_source(relative):
    p=load('scalar_current_stage_source',HERE/'projection.py');p.frozen();p.admit_entry((HERE/'entry.mjs').read_bytes().decode('utf8'))
    match=re.fullmatch(r'\.local/presentation-generation-scalar-stage-diagnostic-compiled/controller-([a-f0-9-]{36})\.mjs',relative)
    need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
    old_relative=relative.replace(p.NAMESPACE,p.PREVIOUS_NAMESPACE)
    source,old_callback,cases=load('scalar_current_stage_parent',p.OLD/'compiler.py').compile_source(old_relative)
    callback_relative=relative.replace('/controller-','/callback-');cases_relative=relative.replace('/controller-','/cases-')
    callback,proof=p.project_callback(ROOT/cases_relative);bodies,body_proof=p.instrumented_bodies()
    def replace(a,b):
        nonlocal source
        need(source.count(a)==1);source=source.replace(a,b,1)
    replace(json.dumps((p.OLD/'entry.mjs').as_uri()),json.dumps((HERE/'entry.mjs').as_uri()))
    for a,b in [("'.local/"+p.PREVIOUS_NAMESPACE+"'","'.local/"+p.NAMESPACE+"'"),
      ("'tracking/evidence/m07/"+p.PREVIOUS_NAMESPACE+"'","'tracking/evidence/m07/"+p.NAMESPACE+"'"),
      ("'.local/"+p.PREVIOUS_NAMESPACE+"-once'","'.local/"+p.NAMESPACE+"-once'"),
      ("'eps.englishstage.run'","'eps.scalarstage.run'"),("'eps.englishstage.workspace'","'eps.scalarstage.workspace'"),
      ("'eps.englishstage.purpose'","'eps.scalarstage.purpose'"),("'eps-englishstage-'","'eps-scalarstage-'"),
      ("'single-aa1-raw-English-batch-fixed-stage-diagnostic'","'single-current7-scalar-fixed-stage-diagnostic'"),
      ("'presentation-generation-english-companion-stage-owned-diagnostic'","'presentation-generation-current7-stage-owned-diagnostic'")]:replace(a,b)
    need(source.count('label=eps.englishstage.run=')==2);source=source.replace('label=eps.englishstage.run=','label=eps.scalarstage.run=')
    position=source.index('bindings:',source.index('await lockProof.runCases('))+len('bindings:')
    args,length=json.JSONDecoder().raw_decode(source[position:]);old_callback_path=args['projectedCallback'];old_cases_path=args['projectedCases']
    new_rows=[{'name':r['name'],'sha':r['after_body_sha256'],'sql':r['after'],'definition_sha256':sha(r['after'].encode())}for r in bodies]
    need(len(args['afterBodies'])==len(new_rows)==4)
    for old,new in zip(args['afterBodies'],new_rows):
        if new['name']!='public.eps_generate_version':need(old==new)
        else:need(old['sha']==p.OLD_INSTRUMENTED)
    args['afterBodies']=new_rows
    args['stageInstrumentation']=[{key:r[key]for key in['name','current_candidate_body_sha256','after_body_sha256','instrumented','line_count_equal','business_SQL_inverse_byte_equal']}for r in bodies]
    need(args['diagnosticStageMap']['candidate_generate_body_sha256']==p.OLD_INSTRUMENTED)
    args['diagnosticStageMap']={**args['diagnosticStageMap'],'candidate_generate_body_sha256':p.INSTRUMENTED_GEN}
    extension=load('scalar_current_stage_bindings',p.EXTENSION);args.update(extension.scalar_bindings())
    args.update(projectedCallback=str(ROOT/callback_relative).replace('\\','/'),projectedCallbackSha=sha(callback.encode()),
      projectedCases=str(ROOT/cases_relative).replace('\\','/'),projectedCasesSha=sha(cases.encode()),scalarCurrentStageProjection=proof,scalarCurrentStageBodies=body_proof)
    source=source[:position]+json.dumps(args)+source[position+length:]
    replace(json.dumps(old_relative),json.dumps(relative));replace(json.dumps(old_callback_path),json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())),json.dumps(args['projectedCallbackSha']));replace(json.dumps(old_cases_path),json.dumps(args['projectedCases']))
    need(sha(cases.encode())==args['projectedCasesSha'])
    marker='report.source_seals = {}; for (const [root, file] of ';begin=source.index(marker)+len(marker);end=source.index(') {\n      const bytes = await readFile',begin);records=json.loads(source[begin:end])
    for record in records:
        if record[1]==old_relative.replace('/controller-','/callback-'):record[1]=callback_relative
        if record[1]==old_relative.replace('/controller-','/cases-'):record[1]=cases_relative
    files=sorted({file for folder in[HERE,p.SLIDE.parent]for file in folder.iterdir()if file.is_file()and file.suffix in['.py','.mjs','.md','.sql','.diff']}|set(p.EXTRA))
    for file in files:
        base=ROOT if file.is_relative_to(ROOT)else p.LIBRARY;records.append([str(base).replace('\\','/'),file.relative_to(base).as_posix()])
    source=source[:begin]+json.dumps(records)+source[end:]
    checks=''.join('\n  assert.equal(sha(await readFile('+json.dumps(str(file).replace('\\','/'))+')),'+json.dumps(sha(file.read_bytes()))+');'for file in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'ENGLISH_STAGE_DIAG_EXECUTION_DISABLED');","assert(lockProof.EXECUTION_ENABLED,'SCALAR_CURRENT_STAGE_DIAG_EXECUTION_DISABLED');"+checks)
    return source,callback,cases


if __name__=='__main__':
    relative='.local/presentation-generation-scalar-stage-diagnostic-compiled/controller-'+str(uuid.uuid4())+'.mjs';controller,callback,cases=compile_source(relative);outputs=[]
    for kind,text in[('cases',cases),('callback',callback),('controller',controller)]:
        file=ROOT/relative.replace('/controller-','/'+kind+'-');file.parent.mkdir(parents=True,exist_ok=True)
        with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
        outputs.append({'path':file.relative_to(ROOT).as_posix(),'sha256':sha(text.encode())})
    print(json.dumps({'compiled_only':True,'execution_dispatched':False,'outputs':outputs}))
