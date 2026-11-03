"""Shared pure sixth-target extension for fresh first/full proof callbacks."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE=Path(__file__).resolve().parent
DATA=HERE.parent/'presentation-generation-data-proof/proof_source.py'
CANDIDATE=HERE.parent/'presentation-english-companion-batch/candidate.py'
DATA_SHA='67cc13d0fed354e102eb769bf5d9712b07e1af1f434d2a3da8ede57333232c1c'
CANDIDATE_SHA='88f49917165683774423d7f723fce4aec102ea54f4f0cba87073eeee4663f341'
SIGNATURE='eps.capture_presentation_video_english_transcripts(uuid)'
NAME='eps.capture_presentation_video_english_transcripts'
BEFORE='c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb'
AFTER='b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad'


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('ENGLISH_SIX_TARGET_EXTENSION_UNCONFIRMED')


def load(name,file,digest):
    info=file.lstat();need(file.is_file()and not file.is_symlink()and info.st_nlink==1 and sha(file.read_bytes())==digest)
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def english_bindings():
    candidate=load('english_target_candidate',CANDIDATE,CANDIDATE_SHA);row=candidate.build()
    need(row['before_body_sha256']==BEFORE and row['after_body_sha256']==AFTER)
    return{'english'+key.capitalize():{'name':NAME,'sha':row[key+'_body_sha256'],'sql':row[key],'definition_sha256':sha(row[key].encode())}for key in ['before','after']}


def edits():
    data=load('english_target_data_extension',DATA,DATA_SHA)
    signatures=['eps.presentation_lock_sources(uuid,text,text)']+data.SIGNATURES
    need(len(signatures)==5 and SIGNATURE not in signatures)
    mask=lambda values:'p.oid in('+','.join("'"+x+"'::regprocedure"for x in values)+')'
    old_mask,new_mask=mask(signatures),mask(signatures+[SIGNATURE])
    identity=data.IDENTITY_SQL
    need(identity.count(');')==1)
    new_identity=identity[:-2]+",'"+SIGNATURE+"'::regprocedure);"
    old_install=' const install=async(source,bodies=ctx.bindings.beforeBodies)=>{'
    new_install=old_install+"\n  const english=bodies===ctx.bindings.afterBodies?ctx.bindings.englishAfter:ctx.bindings.englishBefore;\n  assert.equal(english.name,'"+NAME+"');bodies=[...bodies,english];"
    return[(old_mask,new_mask,1),(json.dumps(identity),json.dumps(new_identity),2),(old_install,new_install,1),('catalogue_prosrc_exclusions:5','catalogue_prosrc_exclusions:6',1)]


def extend_callback(source):
    before=source;changes=edits()
    for a,b,count in changes:need(source.count(a)==count);source=source.replace(a,b)
    inverse=source
    for a,b,count in reversed(changes):need(inverse.count(b)==count);inverse=inverse.replace(b,a)
    need(inverse==before)
    return source,{'inverse_byte_equal':True,'catalogue_prosrc_targets_exactly_six':True,
                   'masked_signatures':['eps.presentation_lock_sources(uuid,text,text)']+load('english_target_signatures',DATA,DATA_SHA).SIGNATURES+[SIGNATURE],
                   'body_identity_targets_four_to_five_helper_identity_retained_separately':True,
                   'four_body_binding_arrays_unchanged':True,'English_selected_before_local_array_expansion':True,
                   'original_install_checks_full_source_and_all_other_pg_proc_fields':True,
                   'initial_candidate_and_final_restoration_all_include_English':True}
