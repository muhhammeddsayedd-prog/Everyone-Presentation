"""Compose the frozen full proof in a fresh default-OFF namespace; no dispatch."""
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
    if not ok:raise ValueError('ENGLISH_FULL_PROOF_COMPILATION_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def compile_source(relative):
    p=load('english_full_projection',HERE/'source.py');p.frozen()
    match=re.fullmatch(r'\.local/presentation-generation-english-full-proof-compiled/controller-([a-f0-9-]{36})\.mjs',relative)
    need(match is not None and str(uuid.UUID(match[1]))==match[1] and uuid.UUID(match[1]).version==4)
    old_relative=relative.replace(p.NAMESPACE,p.PREVIOUS_NAMESPACE)
    source,old_callback,cases=load('english_full_frozen_compiler',p.OLD/'compiler.py').compile_source(old_relative)
    callback_relative=relative.replace('/controller-','/callback-');cases_relative=relative.replace('/controller-','/cases-')
    callback,proof=p.project_callback(ROOT/cases_relative)
    p.admit_entry((HERE/'entry.mjs').read_text(encoding='utf8'))
    need((HERE/'admit.mjs').read_text(encoding='utf8')==p.project_admit())

    def replace(a,b):
        nonlocal source
        need(source.count(a)==1);source=source.replace(a,b,1)

    replace(json.dumps((p.OLD/'entry.mjs').as_uri()),json.dumps((HERE/'entry.mjs').as_uri()))
    for a,b in [("'.local/"+p.PREVIOUS_NAMESPACE+"'","'.local/"+p.NAMESPACE+"'"),
                ("'tracking/evidence/m07/"+p.PREVIOUS_NAMESPACE+"'","'tracking/evidence/m07/"+p.NAMESPACE+"'"),
                ("'.local/"+p.PREVIOUS_NAMESPACE+"-once'","'.local/"+p.NAMESPACE+"-once'"),
                ("'eps.pinbatch.run'","'eps.englishfull.run'"),("'eps.pinbatch.workspace'","'eps.englishfull.workspace'"),
                ("'eps.pinbatch.purpose'","'eps.englishfull.purpose'"),("'eps-pinbatch-'","'eps-englishfull-'"),
                ("'aa1-single-pin-INSERT-generation8s-and-authority-proof'","'six-body-English-raw-batch-full-generation-and-authority-proof'"),
                ("'presentation-generation-pin-batch-owned-proof'","'presentation-generation-english-full-owned-proof'")]:replace(a,b)
    need(source.count('label=eps.pinbatch.run=')==2);source=source.replace('label=eps.pinbatch.run=','label=eps.englishfull.run=')
    position=source.index('bindings:',source.index('await lockProof.runCases('))+len('bindings:')
    args,length=json.JSONDecoder().raw_decode(source[position:]);old_callback_path=args['projectedCallback'];old_cases_path=args['projectedCases']
    raw=p.load('english_full_raw_candidate',p.RAW).build();english=p.load('english_full_English_candidate',p.ENGLISH).build()
    need(args['afterBodies'][3]['name']==raw['name'] and args['afterBodies'][3]['sha']==p.RAW_BEFORE)
    args['afterBodies'][3]={'name':raw['name'],'sha':raw['after_body_sha256'],'sql':raw['after'],'definition_sha256':raw['after_definition_sha256']}
    for phase,key in [('before','englishBefore'),('after','englishAfter')]:
        args[key]={'name':english['name'],'sha':english[phase+'_body_sha256'],'sql':english[phase],'definition_sha256':english[phase+'_definition_sha256']}
    args.update(projectedCallback=str(ROOT/callback_relative).replace('\\','/'),projectedCallbackSha=sha(callback.encode()),
                projectedCases=str(ROOT/cases_relative).replace('\\','/'),projectedCasesSha=sha(cases.encode()),englishFullProjection=proof)
    source=source[:position]+json.dumps(args)+source[position+length:]
    replace(json.dumps(old_relative),json.dumps(relative));replace(json.dumps(old_callback_path),json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())),json.dumps(args['projectedCallbackSha']));replace(json.dumps(old_cases_path),json.dumps(args['projectedCases']))
    marker='report.source_seals = {}; for (const [root, file] of ';begin=source.index(marker)+len(marker);end=source.index(') {\n      const bytes = await readFile',begin);records=json.loads(source[begin:end])
    for record in records:
        if record[1]==old_relative.replace('/controller-','/callback-'):record[1]=callback_relative
        if record[1]==old_relative.replace('/controller-','/cases-'):record[1]=cases_relative
    files=sorted({file for folder in [HERE,p.RAW.parent,p.ENGLISH.parent]for file in folder.iterdir()if file.is_file()and file.suffix in ['.py','.mjs','.md','.sql','.diff']}|{p.EXTENSION,p.CARRY,p.PAIR})
    records.extend([[str(ROOT).replace('\\','/'),file.relative_to(ROOT).as_posix()]for file in files])
    source=source[:begin]+json.dumps(records)+source[end:]
    checks=''.join('\n  assert.equal(sha(await readFile('+json.dumps(str(file).replace('\\','/'))+')),'+json.dumps(sha(file.read_bytes()))+');'for file in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'PIN_BATCH_PROOF_EXECUTION_DISABLED');","assert(lockProof.EXECUTION_ENABLED,'ENGLISH_FULL_PROOF_EXECUTION_DISABLED');"+checks)
    return source,callback,cases


if __name__=='__main__':
    relative='.local/presentation-generation-english-full-proof-compiled/controller-'+str(uuid.uuid4())+'.mjs'
    controller,callback,cases=compile_source(relative);outputs=[]
    for kind,text in [('cases',cases),('callback',callback),('controller',controller)]:
        file=ROOT/relative.replace('/controller-','/'+kind+'-');file.parent.mkdir(parents=True,exist_ok=True)
        with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
        outputs.append({'path':file.relative_to(ROOT).as_posix(),'sha256':sha(text.encode())})
    print(json.dumps({'compiled_only':True,'execution_dispatched':False,'outputs':outputs}))
