"""Finite full-proof successor; no dispatch, authority cache or old entry call."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OLD=HERE.parent/'presentation-generation-pin-batch-proof'
EXTENSION=HERE.parent/'presentation-generation-english-companion-first-proof/english.py'
CARRY=EXTENSION.with_name('admit.mjs')
RAW=HERE.parent/'presentation-raw-companion-batch/candidate.py'
ENGLISH=HERE.parent/'presentation-english-companion-batch/candidate.py'
PAIR=HERE.parent/'presentation-raw-companion-batch-proof/raw-authority.mjs'
NAMESPACE=HERE.name
PREVIOUS_NAMESPACE=OLD.name
PINS={'source.py':'cd19a115d4cc7df09aca5ac230674586a89d703adf46d9da85fce3ac5c617530',
      'compiler.py':'3b80325ffac756e036cd158b978708dc38cac838ed32cd22db647ff1bf903f18',
      'entry.mjs':'2c8e12d5432588a98a3207f81bc080dadffdaa0f07a77a47339166c27239577d',
      'admit.mjs':'38c41104f2f4129facac39b09f4a4fe8a5f0e01691fa069440db4aef89432963'}
RAW_BEFORE='afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7'
RAW_AFTER='f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'
ENGLISH_BEFORE='c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb'
ENGLISH_AFTER='b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad'
RAW_SHA='df807cb6fce3afca3abf8f82b441e56fffd421f0c79666f61ac99ac5687911c7'
ENGLISH_SHA='88f49917165683774423d7f723fce4aec102ea54f4f0cba87073eeee4663f341'
PAIR_SHA='1b7d1743f1c1e7a750d12a26056c3208bbfa024f230386b5296998f02f333896'
EXTENSION_SHA='537eb270278ed5a09beadec6ea332c25c0bb85fc874fa22aead1304cc0c901cb'
CARRY_SHA='8b54cc234e2030809dd4fac92e2232155d1ae07bab961416514e609289e98b23'


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('ENGLISH_FULL_PROOF_SOURCE_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def frozen():
    for name,digest in PINS.items():need(sha((OLD/name).read_bytes())==digest)
    for file,digest in [(RAW,RAW_SHA),(ENGLISH,ENGLISH_SHA),(PAIR,PAIR_SHA),(EXTENSION,EXTENSION_SHA),(CARRY,CARRY_SHA)]:need(sha(file.read_bytes())==digest)


def original():
    frozen();return load('english_full_frozen_projection',OLD/'source.py')


def project_cases():return original().project_cases()


def project_callback(cases_path):
    before,prior=original().project_callback(cases_path)
    source,english_proof=load('english_full_shared_extension',EXTENSION).extend_callback(before)
    edits=[
        ('import {verifyPinAuthorityCases}from '+json.dumps((OLD/'pin-authority.mjs').as_uri())+';',
         'import {verifyPinAuthorityCases}from '+json.dumps((OLD/'pin-authority.mjs').as_uri())+';\nimport {verifyRawAuthorityCases}from '+json.dumps(PAIR.as_uri())+';'),
        ('   await verifyPinAuthorityCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline,startFreshGeneration});',
         '   await verifyPinAuthorityCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline,startFreshGeneration});\n   await verifyRawAuthorityCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline,startFreshGeneration});'),
        ('original4107_and_all_four_old_bodies_restored=true','original4107_and_all_five_old_bodies_restored=true'),
    ]
    extended=source
    for a,b in edits:need(source.count(a)==1 and b not in source);source=source.replace(a,b,1)
    inverse=source
    for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    need(inverse==extended)
    return source,{'full_callback_inverse_byte_equal':True,'frozen_full_pin_batch_projection':prior,
                   'english_extension':english_proof,'exact_six_prosrc_targets_only':True,
                   'matrix_eight_and_component_sixteen_unchanged':True,
                   'all_AA_locks_RC_focus_pin_cases_unchanged':True,
                   'raw_authority_exact_existing_six_cases_per_variant_after_matrix_components':True,
                   'actual_English_source_and_full_authority_checked_every_install_and_restore':True}


def project_entry():
    frozen();before=(OLD/'entry.mjs').read_text(encoding='utf8')
    source=before.replace(PREVIOUS_NAMESPACE,NAMESPACE).replace('PIN_BATCH_PROOF_','ENGLISH_FULL_PROOF_')
    old_scope='owned synthetic whole-generation8s: old280 canonical four versus aa1 current four with one pin INSERT; fresh semantic lock and pin-phase authority proof; no provider/production acceptance'
    new_scope='owned synthetic whole-generation8s: old280 canonical four plus English versus aa1 current rawf222 and Englishb763; full8/16 plus fresh AA locks RC pin and raw authority; no provider/production acceptance'
    edits=[(RAW_BEFORE,RAW_AFTER),
           ("import {admitCarry,freshCarry}from './admit.mjs';","import {admitCarry,freshCarry,assertEnglishBindings}from './admit.mjs';"),
           (" for(const key of['beforeBodies','afterBodies'])for(const item of ctx.bindings[key])assert.equal(sha(item.sql),item.definition_sha256);",
            " for(const key of['beforeBodies','afterBodies'])for(const item of ctx.bindings[key])assert.equal(sha(item.sql),item.definition_sha256);\n assertEnglishBindings(ctx.bindings);"),
           (old_scope,new_scope)]
    for a,b in edits:need(source.count(a)==1);source=source.replace(a,b,1)
    inverse=source
    for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    inverse=inverse.replace(NAMESPACE,PREVIOUS_NAMESPACE).replace('ENGLISH_FULL_PROOF_','PIN_BATCH_PROOF_')
    need(inverse==before);return source


def admit_entry(raw):
    closed=project_entry()
    flag='export const EXECUTION_ENABLED=false;'
    need(closed.count(flag)==1)
    need(raw in [closed,closed.replace(flag,'export const EXECUTION_ENABLED=true;',1)])


def project_admit():
    frozen();before=(OLD/'admit.mjs').read_text(encoding='utf8')
    need(before.count(RAW_BEFORE)==1);source=before.replace(RAW_BEFORE,RAW_AFTER,1)
    # Earlier receipts retain their original expected arrays. Only this fresh
    # admission checks the new four-body array plus separate English records.
    a='export function freshCarry(ctx,admitted){';b=a+'\n assertEnglishBindings(ctx.bindings);'
    need(source.count(a)==1);source=source.replace(a,b,1)
    need(source.replace(b,a,1).replace(RAW_AFTER,RAW_BEFORE,1)==before)
    old="export {admitCarry}from '../presentation-generation-assignment-proof/admit.mjs';"
    new="export {admitCarry}from '../presentation-generation-english-companion-first-proof/admit.mjs';"
    need(source.count(old)==1);source=source.replace(old,new,1)
    suffix="""
export function assertEnglishBindings(bindings){
 for(const[key,expected,definition]of[['englishBefore','BEFORE','8c26f0bfc9b389ed297d8e2dd6d021876ee607c54959b0caae27246704e7ac03'],['englishAfter','AFTER','95a38067b74c9279541be4627f82cfccc1a93160d01937823fdc250b20b987b0']]){
  const item=bindings[key];assert(item&&Object.getPrototypeOf(item)===Object.prototype);
  assert.deepEqual(Object.keys(item).sort(),['definition_sha256','name','sha','sql']);
  assert.equal(item.name,'eps.capture_presentation_video_english_transcripts');
  assert.equal(item.sha,expected);assert.equal(item.definition_sha256,definition);assert.equal(sha(item.sql),definition);
  const match=/ AS (\\$[a-zA-Z0-9_]*\\$)([\\s\\S]*)\\1;$/u.exec(item.sql);
  assert(match,'ENGLISH_FULL_BODY_DELIMITER_REQUIRED');assert.equal(sha(match[2]),expected);
 }
}
""".replace("'BEFORE'",json.dumps(ENGLISH_BEFORE)).replace("'AFTER'",json.dumps(ENGLISH_AFTER))
    return source+suffix
