"""Finite projection of the sealed combined proof; no runner or SQL dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-combined-proof'
SOURCE_SHA = '9ff14004b0ba0cc097ecafae1bbdec813e30d8c3ea0e59b0c269a52e6d915189'
ENTRY_SHA = '8dca5891b9f2e832f94c8ebc206377f159fd234441a4721d0e812f3055f51e88'
DATA_BEFORE = '4b37255bd919719086175f5df2b197584555f3c08000ee13fe18a7dbe62f8cc3'
DATA_AFTER = '0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ASSIGNMENT_PROOF_SOURCE_UNCONFIRMED')


def original():
    need(sha((OLD / 'source.py').read_bytes()) == SOURCE_SHA)
    spec = importlib.util.spec_from_file_location('assignment_frozen_combined_source', OLD / 'source.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project_cases():
    return original().project_cases()


def project_matrix():
    file = OLD / 'cases.mjs'
    raw = file.read_bytes()
    need(sha(raw) == 'f7ead827571ded1ea5d2b7d5cae9b2af3df1d46bc03f474128f585bc5fd9e3c1')
    before = raw.decode()
    old = " for(const variant of['old','candidate']){\n  await ctx.installVariant(variant);\n  for(const mode of['api','mcp'])for(const label of['control','large']){"
    new = """ const firstMatrix=[{variant:'candidate',mode:'mcp',label:'large'},
  ...['old','candidate'].flatMap(variant=>['api','mcp'].flatMap(mode=>['control','large'].map(label=>({variant,mode,label})))).filter(x=>!(x.variant==='candidate'&&x.mode==='mcp'&&x.label==='large'))];
 for(const {variant,mode,label}of firstMatrix){
  await ctx.installVariant(variant);
  {"""
    need(before.count(old) == 1)
    source = before.replace(old, new, 1)
    end = ' ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;'
    parity = """ for(const label of['control','large']){
  const api=records.find(x=>x.variant==='candidate'&&x.mode==='api'&&x.label===label),mcp=records.find(x=>x.variant==='candidate'&&x.mode==='mcp'&&x.label===label);
  assert.deepEqual(api.projection,mcp.projection);assert.deepEqual(api.pins,mcp.pins);assert.deepEqual(api.manifest,mcp.manifest);mcp.normalized_API_MCP_equal=true;
 }
""" + end
    need(source.count(end) == 1)
    source = source.replace(end, parity, 1)
    need(source.replace(parity, end, 1).replace(new, old, 1).encode() == raw)
    return source


def project_callback(cases_path):
    before, previous = original().project_callback(cases_path)
    source = before
    edits = [
        (json.dumps((OLD / 'cases.mjs').as_uri()), json.dumps((HERE / 'matrix.mjs').as_uri())),
        ('import {observePending}from ' + json.dumps((HERE.parent / 'presentation-lock-source-pool-proof/cases.mjs').as_uri()) + ';',
         'import {observePending}from ' + json.dumps((HERE.parent / 'presentation-lock-source-pool-proof/cases.mjs').as_uri()) + ';\nimport {verifyAssignmentCases,assertAssignmentEquality}from ' + json.dumps((HERE / 'assignment-cases.mjs').as_uri()) + ';'),
        ('  ctx.report.data_reuse_cases={};',
         "  ctx.report.data_reuse_cases={};ctx.report.assignment_cases={};\n  ctx.report.assignment_enumeration={before_data_sha256:'" + DATA_BEFORE + "',after_data_sha256:'" + DATA_AFTER + "',same_shared_budget_bytes:4194304};\n  const assignmentFK=await value(\"select jsonb_build_object('validated',convalidated,'deferrable',condeferrable,'deferred',condeferred,'workspace_slot_columns',conkey=ARRAY[(select attnum from pg_attribute where attrelid='eps.assignments'::regclass and attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.assignments'::regclass and attname='slot_id')]::smallint[],'references_slots',confrelid='eps.slots'::regclass,'referenced_workspace_id_columns',confkey=ARRAY[(select attnum from pg_attribute where attrelid='eps.slots'::regclass and attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.slots'::regclass and attname='id')]::smallint[])from pg_constraint where conrelid='eps.assignments'::regclass and conname='assignments_workspace_id_slot_id_fkey';\");\n  ctx.report.assignment_enumeration.actual_FK=assignmentFK;assert.deepEqual(assignmentFK,{validated:true,deferrable:false,deferred:false,workspace_slot_columns:true,references_slots:true,referenced_workspace_id_columns:true});"),
        ('   await verifyDataReuseCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline});',
         '   await verifyDataReuseCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline});\n   await verifyAssignmentCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline});'),
        ('  assertDataReuseEquality(ctx.report.data_reuse_cases);assert.deepEqual(security.old,security.candidate);',
         '  assertDataReuseEquality(ctx.report.data_reuse_cases);assertAssignmentEquality(ctx.report.assignment_cases);assert.deepEqual(security.old,security.candidate);'),
    ]
    for a, b in edits:
        need(source.count(a) == 1)
        source = source.replace(a, b, 1)
    inverse = source
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'frozen_combined_projection': previous,
                    'eight_first_calls_before_projections': True,
                    'candidate_MCP_large_first_exactly_once_then_remaining_seven': True,
                    'all_existing_fallback_capture_English_and_RC_security_calls_unchanged': True,
                    'adds_assignment_fallback_NO_MAIN_Shortlist_cases': True,
                    'adds_actual_immediate_validated_composite_FK_guard': True,
                    'full_original_config_five_body_and_original29_cleanup_preserved': True}


def project_entry():
    raw = (OLD / 'entry.mjs').read_bytes()
    need(sha(raw) == ENTRY_SHA)
    source = raw.decode().replace('presentation-generation-combined-proof', 'presentation-generation-assignment-proof').replace('COMBINED_PROOF_', 'ASSIGNMENT_PROOF_')
    need(source.count(DATA_BEFORE) == 1)
    source = source.replace(DATA_BEFORE, DATA_AFTER, 1)
    before = 'owned synthetic whole-generation8s and exact data/companion/security comparison: helper280 on both sides, four old versus four candidate bodies; completed helper scopes carried only; no provider/production acceptance'
    after = 'owned synthetic whole-generation8s and exact assignment/data/companion/security comparison: helper280 both sides, original four versus bounded-assignment candidate four; completed helper scopes carried only; no provider/production acceptance'
    need(source.count(before) == 1)
    return source.replace(before, after, 1)
