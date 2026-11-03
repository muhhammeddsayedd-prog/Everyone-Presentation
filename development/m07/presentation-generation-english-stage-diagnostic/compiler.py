"""New default-OFF stage purpose; finite library composition, never dispatch."""
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
    if not ok:raise ValueError('ENGLISH_STAGE_COMPILATION_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def compile_source(relative):
    p=load('English_stage_projection',HERE/'projection.py');p.frozen();p.admit_entry((HERE/'entry.mjs').read_text(encoding='utf8'))
    match=re.fullmatch(r'\.local/presentation-generation-english-stage-diagnostic-compiled/controller-([a-f0-9-]{36})\.mjs',relative)
    need(match is not None and str(uuid.UUID(match[1]))==match[1] and uuid.UUID(match[1]).version==4)
    old_relative=relative.replace(p.NAMESPACE,p.PREVIOUS_NAMESPACE)
    source,old_callback,cases=load('English_stage_frozen_compiler',p.OLD/'compiler.py').compile_source(old_relative)
    callback_relative=relative.replace('/controller-','/callback-');cases_relative=relative.replace('/controller-','/cases-')
    callback,proof=p.project_callback(ROOT/cases_relative)

    def replace(a,b):
        nonlocal source
        need(source.count(a)==1);source=source.replace(a,b,1)

    replace(json.dumps((p.OLD/'entry.mjs').as_uri()),json.dumps((HERE/'entry.mjs').as_uri()))
    for a,b in [("'.local/"+p.PREVIOUS_NAMESPACE+"'","'.local/"+p.NAMESPACE+"'"),
                ("'tracking/evidence/m07/"+p.PREVIOUS_NAMESPACE+"'","'tracking/evidence/m07/"+p.NAMESPACE+"'"),
                ("'.local/"+p.PREVIOUS_NAMESPACE+"-once'","'.local/"+p.NAMESPACE+"-once'"),
                ("'eps.rawstage.run'","'eps.englishstage.run'"),("'eps.rawstage.workspace'","'eps.englishstage.workspace'"),
                ("'eps.rawstage.purpose'","'eps.englishstage.purpose'"),("'eps-rawstage-'","'eps-englishstage-'"),
                ("'single-aa1-rawbatch-fixed-stage-diagnostic'","'single-aa1-raw-English-batch-fixed-stage-diagnostic'"),
                ("'presentation-generation-raw-companion-stage-owned-diagnostic'","'presentation-generation-english-companion-stage-owned-diagnostic'")]:replace(a,b)
    need(source.count('label=eps.rawstage.run=')==2);source=source.replace('label=eps.rawstage.run=','label=eps.englishstage.run=')
    position=source.index('bindings:',source.index('await lockProof.runCases('))+len('bindings:')
    args,length=json.JSONDecoder().raw_decode(source[position:]);old_callback_path=args['projectedCallback'];old_cases_path=args['projectedCases']
    args.update(load('English_stage_shared_bindings',p.EXTENSION).english_bindings())
    args.update(projectedCallback=str(ROOT/callback_relative).replace('\\','/'),projectedCallbackSha=sha(callback.encode()),
                projectedCases=str(ROOT/cases_relative).replace('\\','/'),projectedCasesSha=sha(cases.encode()),EnglishStageProjection=proof,
                EnglishStageDelta={'only_additional_business_body':'c68de52a_to_b763cd50','English_instrumented':False,'same_four_body_and_stage_instrumentation_arrays':True})
    source=source[:position]+json.dumps(args)+source[position+length:]
    replace(json.dumps(old_relative),json.dumps(relative));replace(json.dumps(old_callback_path),json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())),json.dumps(args['projectedCallbackSha']));replace(json.dumps(old_cases_path),json.dumps(args['projectedCases']))
    need(sha(cases.encode())==args['projectedCasesSha'])
    marker='report.source_seals = {}; for (const [root, file] of ';begin=source.index(marker)+len(marker);end=source.index(') {\n      const bytes = await readFile',begin);records=json.loads(source[begin:end])
    for record in records:
        if record[1]==old_relative.replace('/controller-','/callback-'):record[1]=callback_relative
        if record[1]==old_relative.replace('/controller-','/cases-'):record[1]=cases_relative
    files=sorted({file for folder in [HERE,p.CANDIDATE.parent]for file in folder.iterdir()if file.is_file()and file.suffix in ['.py','.mjs','.md','.sql','.diff']}|set(p.EXTRA_PINS))
    records.extend([[str(ROOT).replace('\\','/'),file.relative_to(ROOT).as_posix()]for file in files])
    source=source[:begin]+json.dumps(records)+source[end:]
    checks=''.join('\n  assert.equal(sha(await readFile('+json.dumps(str(file).replace('\\','/'))+')),'+json.dumps(sha(file.read_bytes()))+');'for file in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'RAW_BATCH_STAGE_DIAG_EXECUTION_DISABLED');","assert(lockProof.EXECUTION_ENABLED,'ENGLISH_STAGE_DIAG_EXECUTION_DISABLED');"+checks)
    return source,callback,cases


if __name__=='__main__':
    relative='.local/presentation-generation-english-stage-diagnostic-compiled/controller-'+str(uuid.uuid4())+'.mjs'
    controller,callback,cases=compile_source(relative);outputs=[]
    for kind,text in [('cases',cases),('callback',callback),('controller',controller)]:
        file=ROOT/relative.replace('/controller-','/'+kind+'-');file.parent.mkdir(parents=True,exist_ok=True)
        with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
        outputs.append({'path':file.relative_to(ROOT).as_posix(),'sha256':sha(text.encode())})
    print(json.dumps({'compiled_only':True,'execution_dispatched':False,'outputs':outputs}))
