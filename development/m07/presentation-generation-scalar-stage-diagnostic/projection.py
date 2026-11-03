"""Current seven-target graph on the frozen f540 NOTICE/custody mechanism."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
LIBRARY=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=LIBRARY/'development/m07/presentation-generation-english-stage-diagnostic'
EXTENSION=LIBRARY/'development/m07/presentation-generation-scalar-full-proof/extension.py'
FULL_ADMIT=EXTENSION.with_name('admit.mjs')
SLIDE=LIBRARY/'development/m07/presentation-slide-insert-batch/candidate.py'
NAMESPACE=HERE.name
PREVIOUS_NAMESPACE=OLD.name
PINS={
 'projection.py':'7bf4f71364b10c6b46a229fd32e44a403da622c7dec8748b86e7f829741dbf67',
 'compiler.py':'8c0861aa3e15cf06c971e62287c077be94cc82186715f0ce2c6cfa5fde14472f',
 'entry.mjs':'1c7e89c1800165832c8e20896ff1cbe60777d12c2041012b4abe661bfd5bef3c',
 'admit.mjs':'5656b0d1059df5eccaf14d8ec10fed29f01365576785e9f5ece6689aa061aad7',
 'README.md':'af73276b7a6f7c70286723d0586fe10bde25a446ef43e4fea7fc03f46308230b','test_wrapper.py':'ac9ef74dec629e27a8f4cf11b2176c1964be713942ffc2c8ca160d12fe7951e2',
 'wrapper.test.mjs':'823ce5b870d83d4d4a98a87628022afedf8ea56a9e5e83a864d233008285b4d1'}
EXTRA={EXTENSION:'32bd4cba5325bb240661f64b91707cfb2a984df78c121398841fe1866f03849d',
 FULL_ADMIT:'6d8e31246f580d7779e2cd6961629f542e786c3d1bb76d3e5813a74d4a60de02',
 SLIDE:'c0bf140a8caad5d562aaddf22cb3104bbdb9c7ffb7c17ed8d19a59aa8d8a52ef'}
GEN_BEFORE='41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d'
GEN_AFTER='af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198'
OLD_INSTRUMENTED='b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3'
INSTRUMENTED_GEN='5b0f389300a86b9cfa0b39e182eaca49f5bac81566e0bb72be1caa152faecca1'


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('SCALAR_CURRENT_STAGE_SOURCE_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def frozen():
    for file,digest in [(OLD/name,digest)for name,digest in PINS.items()]+list(EXTRA.items()):
        info=file.lstat();need(file.is_file()and not file.is_symlink()and info.st_nlink==1 and sha(file.read_bytes())==digest)
    load('scalar_stage_frozen_parent',OLD/'projection.py').frozen()


def original():
    frozen();return load('scalar_stage_parent_projection',OLD/'projection.py')


def instrumented_bodies():
    parent=original();rows,prior=parent.previous().instrumented_bodies()
    slide=load('scalar_stage_slide_candidate',SLIDE);candidate=slide.build(LIBRARY)
    instrument=load('scalar_stage_frozen_notices',LIBRARY/'development/m07/presentation-generation-stage-diagnostic/instrument.py')
    row=next(x for x in rows if x['name']=='public.eps_generate_version')
    need(row['current_candidate_body_sha256']==GEN_BEFORE and row['after_body_sha256']==OLD_INSTRUMENTED)
    match=slide.parts(candidate['after']);body=match[2]
    changed=instrument.transform(body,GEN_AFTER,instrument.generate_edits())
    after=candidate['after'][:match.start(2)]+changed+candidate['after'][match.end(2):]
    need(row['after'].count(slide.OLD)==1 and row['after'].replace(slide.OLD,slide.NEW,1)==after)
    need(len(changed.splitlines())==len(body.splitlines())and sha(changed.encode())==INSTRUMENTED_GEN)
    row.update(after=after,current_candidate_body_sha256=GEN_AFTER,after_body_sha256=sha(changed.encode()))
    return rows,{'prior_f540_four_body_projection':prior,'GEN_slide_block_and_existing_notice_edits_commute_exactly':True,
      'same_line_count_markers_map_temp_parser_transport':True,'GEN_business_sha256':GEN_AFTER,'GEN_instrumented_sha256':sha(changed.encode()),
      'English_and_scalar_remain_uninstrumented':True,'all_other_three_definitions_unchanged':True}


def project_callback(cases_path):
    before,prior=original().project_callback(cases_path)
    a='original4107_and_five_old_bodies_restored=true';b='original4107_and_all_five_old_bodies_restored=true'
    need(before.count(a)==1);bridged=before.replace(a,b,1)
    source,extension=load('scalar_stage_seven_target_extension',EXTENSION).extend_callback(bridged)
    edits=[('candidate_aa1_GEN41fe_rawf222_Englishb763_identity_verified=true','candidate_aa1_GENaf486_rawf222_Englishb763_scalar845_identity_verified=true'),
           ('fullc20_performance_failure_remains_open=true','full7c024_performance_failure_remains_open=true')]
    extended=source
    for old,new in edits:need(source.count(old)==1);source=source.replace(old,new,1)
    inverse=source
    for old,new in reversed(edits):need(inverse.count(new)==1);inverse=inverse.replace(new,old,1)
    need(inverse==extended)
    need(load('scalar_stage_inverse_extension',EXTENSION).inverse_callback(inverse).replace(b,a,1)==before)
    return source,{'inverse_byte_equal':True,'frozen_f540_callback':prior,'seven_target_extension':extension,
      'one_call_private_context_and_fixed_phase_mechanism_unchanged':True,'actual_current_seven_installed_and_original_seven_restored':True}


def project_entry():
    frozen();before=(OLD/'entry.mjs').read_bytes().decode('utf8')
    source=before.replace(PREVIOUS_NAMESPACE,NAMESPACE).replace('ENGLISH_STAGE_DIAG_','SCALAR_CURRENT_STAGE_DIAG_')
    rows,_=instrumented_bodies();new_gen=next(x['after_body_sha256']for x in rows if x['name']=='public.eps_generate_version')
    old_scope='one owned helperaa1 GEN41fe rawf222 Englishb763 MCP-large8s stage diagnostic: frozen9ed NOTICE/private57014 mechanism; fullc20 stage remains unknown; instrumentation cost present, no performance/provider/production acceptance'
    scope='one owned current7 helperAA GENaf486 rawf222 Englishb763 scalar845 MCP-large8s stage diagnostic: frozenf540 NOTICE/private57014 mechanism; c024 stage unknown; instrumentation cost present, no performance/provider/production acceptance'
    changes=[(OLD_INSTRUMENTED,new_gen),
      ("import {admitCarry,freshCarry,assertEnglishBindings}from './admit.mjs';","import {admitCarry,freshCarry,assertSevenBindings}from './admit.mjs';"),
      (' assertEnglishBindings(ctx.bindings);',' assertSevenBindings(ctx.bindings);'),(old_scope,scope)]
    for old,new in changes:need(source.count(old)==1);source=source.replace(old,new,1)
    inverse=source
    for old,new in reversed(changes):need(inverse.count(new)==1);inverse=inverse.replace(new,old,1)
    need(inverse.replace(NAMESPACE,PREVIOUS_NAMESPACE).replace('SCALAR_CURRENT_STAGE_DIAG_','ENGLISH_STAGE_DIAG_')==before)
    return source


def admit_entry(raw):
    closed=project_entry();flag='export const EXECUTION_ENABLED=false;';need(closed.count(flag)==1)
    need(raw in[closed,closed.replace(flag,'export const EXECUTION_ENABLED=true;',1)])
