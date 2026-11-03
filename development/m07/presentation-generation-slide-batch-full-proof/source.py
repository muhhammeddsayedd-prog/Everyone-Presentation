"""Finite GEN-only successor to the frozen full English proof; no dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OLD=HERE.parent/'presentation-generation-english-full-proof'
NAMESPACE=HERE.name
PREVIOUS_NAMESPACE=OLD.name
CANDIDATE=HERE.parent/'presentation-slide-insert-batch/candidate.py'
HISTORY=HERE.parent/'presentation-generation-english-stage-diagnostic/admit.mjs'
CANDIDATE_SHA='c0bf140a8caad5d562aaddf22cb3104bbdb9c7ffb7c17ed8d19a59aa8d8a52ef'
HISTORY_SHA='5656b0d1059df5eccaf14d8ec10fed29f01365576785e9f5ece6689aa061aad7'
GEN_BEFORE='41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d'
GEN_AFTER='af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198'
PINS={'source.py':'b021db1f43b265c76e39c5e93065efdc13e0702898207cc336c03da1c1b580d2',
 'compiler.py':'7e84809ca94e4167a7d8bb15654e1de08762ee51c8def02f1a9b4a87e9ef6c98',
 'entry.mjs':'f6e4f892bc55724c88e6109ca7cb1a9d99d28fecdc107293d897eb857a91c8fc',
 'admit.mjs':'b54b9669d0e00a63045311f8ca5edffb748cc3af5f88242db5953713d57c3e55',
 'test_proof.py':'5d5712afb43deaf6c29f70c427f94d188a76a7bb8ce01ea91c6369544f26ee87',
 'README.md':'dccaa7a4594eb576b3424cb67156864cc4e27f7a9862f3e62765409f40650f45'}


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('SLIDE_FULL_SOURCE_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def frozen():
    for file,digest in [(OLD/name,digest)for name,digest in PINS.items()]+[(CANDIDATE,CANDIDATE_SHA),(HISTORY,HISTORY_SHA)]:
        info=file.lstat();need(file.is_file()and not file.is_symlink()and info.st_nlink==1 and sha(file.read_bytes())==digest)
    load('slide_full_old_projection',OLD/'source.py').frozen()


def original():
    frozen();return load('slide_full_frozen_source',OLD/'source.py')


def project_cases():return original().project_cases()


def project_callback(cases_path):
    callback,prior=original().project_callback(cases_path)
    return callback,{'callback_byte_equal_for_same_cases_path':True,'frozen_full_English_projection':prior,
                     'all_eight_sixteen_AA_RC_focus_pin_raw_cases_and_six_target_restore_unchanged':True,
                     'only_new_candidate_GEN_SQL_bound_by_compiler':True}


def project_entry():
    frozen();before=(OLD/'entry.mjs').read_bytes().decode('utf8')
    source=before.replace(PREVIOUS_NAMESPACE,NAMESPACE).replace('ENGLISH_FULL_PROOF_','SLIDE_FULL_PROOF_')
    old_scope='owned synthetic whole-generation8s: old280 canonical four plus English versus aa1 current rawf222 and Englishb763; full8/16 plus fresh AA locks RC pin and raw authority; no provider/production acceptance'
    scope='owned synthetic whole-generation8s: old280 canonical four plus English versus aa1 DATA0dba wrapperc6 GENaf486 rawf222 Englishb763; unchanged full8/16 AA RC pin raw and restore; no provider/production acceptance'
    edits=[(GEN_BEFORE,GEN_AFTER),(old_scope,scope)]
    for a,b in edits:need(source.count(a)==1);source=source.replace(a,b,1)
    inverse=source
    for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    need(inverse.replace(NAMESPACE,PREVIOUS_NAMESPACE).replace('SLIDE_FULL_PROOF_','ENGLISH_FULL_PROOF_')==before)
    return source


def admit_entry(raw):
    closed=project_entry();flag='export const EXECUTION_ENABLED=false;';need(closed.count(flag)==1)
    need(raw in [closed,closed.replace(flag,'export const EXECUTION_ENABLED=true;',1)])


def project_admit_prefix():
    frozen();before=(OLD/'admit.mjs').read_bytes().decode('utf8')
    old="export {admitCarry}from '../presentation-generation-english-companion-first-proof/admit.mjs';"
    need(before.count(old)==1 and before.count(GEN_BEFORE)==1)
    source=before.replace(old,"import {admitCarry as admitEarlier}from '../presentation-generation-english-stage-diagnostic/admit.mjs';",1).replace(GEN_BEFORE,GEN_AFTER,1)
    need(source.replace(GEN_AFTER,GEN_BEFORE,1).replace("import {admitCarry as admitEarlier}from '../presentation-generation-english-stage-diagnostic/admit.mjs';",old,1)==before)
    return source
