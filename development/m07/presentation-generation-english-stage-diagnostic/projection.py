"""One English-body substitution over frozen9ed; no new diagnostic machinery."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
NAMESPACE=HERE.name
PREVIOUS_NAMESPACE='presentation-generation-raw-companion-stage-diagnostic'
OLD=HERE.parent/PREVIOUS_NAMESPACE
EXTENSION=HERE.parent/'presentation-generation-english-companion-first-proof/english.py'
CARRY=EXTENSION.with_name('admit.mjs')
CANDIDATE=HERE.parent/'presentation-english-companion-batch/candidate.py'
FULL_ADMIT=HERE.parent/'presentation-generation-english-full-proof/admit.mjs'
PINS={'projection.py':'39bfc19278add93d66a42ae8d03b852b4392daed9124712c0aa3ad6f95365310',
      'compiler.py':'eba7676124554d41d448b0dd51ee277ea121c5513cb136cbf98bc4285b21ea2a',
      'entry.mjs':'dd741e49957f22d7fa084f41ee8420720e68cb38d9f005d22389dbbe6119ed9b',
      'admit.mjs':'6d05a2bd278b19ef4d9d38f794859e6f72b35423f864fae2fbc840cb9de7c52c',
      'test_wrapper.py':'eb8afe3337f2bf860391a609f0b734f8e6abce42725cb299f664dbc8d623d36c',
      'wrapper.test.mjs':'f4d8be51ec933600b72c2bb4b4846e048aa473172d466135cbe2cca6ff82c97c',
      'README.md':'c6aa04fe140b65a91cdeadd11c9bb99e0401da6e76e3bf78215db337ee7e7b58'}
EXTRA_PINS={EXTENSION:'537eb270278ed5a09beadec6ea332c25c0bb85fc874fa22aead1304cc0c901cb',
            CARRY:'8b54cc234e2030809dd4fac92e2232155d1ae07bab961416514e609289e98b23',
            CANDIDATE:'88f49917165683774423d7f723fce4aec102ea54f4f0cba87073eeee4663f341',
            FULL_ADMIT:'b54b9669d0e00a63045311f8ca5edffb748cc3af5f88242db5953713d57c3e55'}
CALLBACK_EDITS=[('candidate_aa1_GEN41fe_rawf222_identity_verified=true','candidate_aa1_GEN41fe_rawf222_Englishb763_identity_verified=true'),
                ('first633_performance_failure_remains_open=true','fullc20_performance_failure_remains_open=true'),
                ('original4107_and_four_old_bodies_restored=true','original4107_and_five_old_bodies_restored=true')]


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('ENGLISH_STAGE_SOURCE_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def frozen():
    for file,digest in [(OLD/name,digest)for name,digest in PINS.items()]+list(EXTRA_PINS.items()):
        info=file.lstat();need(file.is_file()and not file.is_symlink()and info.st_nlink==1 and sha(file.read_bytes())==digest)
    load('English_stage_frozen_projection',OLD/'projection.py').frozen()


def previous():
    frozen();return load('English_stage_old_projection',OLD/'projection.py')


def project_callback(cases_path):
    before,prior=previous().project_callback(cases_path)
    extended,extension=load('English_stage_six_target_extension',EXTENSION).extend_callback(before)
    source=extended
    for a,b in CALLBACK_EDITS:need(source.count(a)==1);source=source.replace(a,b,1)
    inverse=source
    for a,b in reversed(CALLBACK_EDITS):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    need(inverse==extended)
    return source,{'inverse_byte_equal':True,'frozen_9ed_callback':prior,'English_six_target_extension':extension,
                   'one_call_temp_notices_parser_map_custody_bounds_and_transport_unchanged':True,
                   'original4107_canonical_four_and_English_restore_required':True}


def project_entry():
    frozen();before=(OLD/'entry.mjs').read_text(encoding='utf8')
    source=before.replace(PREVIOUS_NAMESPACE,NAMESPACE).replace('RAW_BATCH_STAGE_DIAG_','ENGLISH_STAGE_DIAG_')
    old_scope='one owned helperaa1 GEN41fe rawf222 MCP-large8s stage diagnostic: frozen ee38 bounded NOTICE/private57014 mechanism; first633 stage remains unknown; instrumentation cost present, no performance/provider/production acceptance'
    scope='one owned helperaa1 GEN41fe rawf222 Englishb763 MCP-large8s stage diagnostic: frozen9ed NOTICE/private57014 mechanism; fullc20 stage remains unknown; instrumentation cost present, no performance/provider/production acceptance'
    edits=[("import {admitCarry,freshCarry}from './admit.mjs';","import {admitCarry,freshCarry,assertEnglishBindings}from './admit.mjs';"),
           (" for(const key of['beforeBodies','afterBodies'])for(const item of ctx.bindings[key])assert.equal(sha(item.sql),item.definition_sha256);",
            " for(const key of['beforeBodies','afterBodies'])for(const item of ctx.bindings[key])assert.equal(sha(item.sql),item.definition_sha256);\n assertEnglishBindings(ctx.bindings);"),
           (old_scope,scope)]
    for a,b in edits:need(source.count(a)==1);source=source.replace(a,b,1)
    inverse=source
    for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    need(inverse.replace(NAMESPACE,PREVIOUS_NAMESPACE).replace('ENGLISH_STAGE_DIAG_','RAW_BATCH_STAGE_DIAG_')==before)
    return source


def admit_entry(raw):
    closed=project_entry();flag='export const EXECUTION_ENABLED=false;';need(closed.count(flag)==1)
    need(raw in [closed,closed.replace(flag,'export const EXECUTION_ENABLED=true;',1)])
