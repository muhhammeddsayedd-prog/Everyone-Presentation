"""Pure finite SQL/AST and fake-session tests; never starts DB/Docker/network."""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess
import unittest
from unittest.mock import patch
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('partitioned_oracle_source', HERE / 'oracle.py')
o = importlib.util.module_from_spec(spec)
spec.loader.exec_module(o)


def without_locations(value):
    if isinstance(value, dict):
        return {k: without_locations(v) for k, v in value.items() if 'location' not in k}
    if isinstance(value, (list, tuple)):
        return [without_locations(v) for v in value]
    return value


def node(code):
    prelude = "import assert from 'node:assert/strict';import {partitionUniverse,prepareOracle,readOracle,CHUNK_SIZE}from " + json.dumps((HERE / 'oracle.mjs').as_uri()) + ";\n"
    prelude += r"""
const uuid=i=>'00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0');
const heavy=['eps.media_assets','eps.candidate_media_frames'];
function fixture(fault=null){
 const assets=Array.from({length:501},(_,i)=>({id:uuid(i+1)}));
 const frames=Array.from({length:328},(_,i)=>({candidate_media_id:uuid(Math.floor(i/4)+1),asset_id:uuid(i+1001)}));
 if(fault==='duplicate')assets[500]={...assets[0]};if(fault==='missing')assets.pop();
 let role='postgres',slices=0;const calls=[],record={};
 const identity=()=>({pid:123,snapshot:'100:200:101,102',role,isolation:'repeatable read',read_only:'on',statement_timeout:'8s',lock_timeout:'8s'});
 const oracle={pid:123,async request(text){
  calls.push(text);
  if(text==='PURE_INSTALL_SQL'||text.startsWith('reset role;begin'))return[];
  if(text.includes('pool_oracle41_universe'))return[{identity:identity(),universes:{[heavy[0]]:assets,[heavy[1]]:frames}}];
  if(text.startsWith('PURE_ACTING_MCP;')){role='eps_review_owner';return[];}
  if(text==='select pg_temp.pool_oracle41_identity();')return[identity()];
  if(text.includes('pool_proof_cohort'))return[[{id:uuid(1)}]];
  const match=text.match(/^select pg_temp\.pool_oracle41_slice\('([^']+)','[^']+'::uuid,'[^']+'::uuid,'([^']+)'::jsonb\);$/u);assert(match,'SYNTHETIC_EXPECTED_FINITE_QUERY');
  const chunk=JSON.parse(match[2]),relation=match[1];slices++;
  let chosen=chunk.filter((_,i)=>i%3===0).map(k=>({...k}));
  if(fault==='foreign'&&slices===1)chosen=[{id:uuid(9999)}];
  if(fault==='crosspair'&&relation===heavy[1])chosen=[{candidate_media_id:chunk[0].candidate_media_id,asset_id:chunk[4].asset_id}];
  const actual=identity();
  if(fault==='snapshot')actual.snapshot='100:201:101,102';
  if(fault==='pid')actual.pid++;
  if(fault==='role')actual.role='postgres';
  if(fault==='readonly')actual.read_only='off';
  if(fault==='isolation')actual.isolation='read committed';
  if(fault==='timeout')actual.statement_timeout='9s';
  return[{identity:actual,keys:chosen}];
 }};
 const ctx={runId:uuid(800),profiles:{large:{workspace:uuid(801),series:uuid(802)}},bindings:{oracleSliceSql:'PURE_INSTALL_SQL'},acting:mode=>{assert.equal(mode,'mcp');return'PURE_ACTING_MCP;';}};
 return {ctx,oracle,record,calls,assets,frames};
}
"""
    run = subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module', '-e', prelude + code], cwd=ROOT, capture_output=True, text=True, timeout=30)
    if run.returncode:
        raise AssertionError('Pure Node oracle regression failed:\n' + run.stderr)


class Tests(unittest.TestCase):
    def test_generated_sql_invoker_readonly_and_trusted_whole_pk_queries(self):
        sql, metadata = o.build()
        self.assertEqual(len(parse_sql(sql)), 3)
        self.assertEqual(len(parse_plpgsql(sql)), 3)
        for forbidden in ('security definer', 'for share', 'for update', 'grant ', 'insert into', 'update eps.', 'delete from'):
            self.assertNotIn(forbidden, sql.lower())
        self.assertIn("current_user<>'postgres'", sql)
        self.assertIn("current_user<>'eps_review_owner'", sql)
        self.assertIn("from eps.media_assets m;", sql)
        self.assertIn("from eps.candidate_media_frames f;", sql)
        self.assertIn("pg_current_snapshot()::text", sql)
        self.assertIn("current_setting('statement_timeout')<>'8s'", sql)
        self.assertEqual(metadata['chunk_size'], 16)
        self.assertTrue(metadata['same_snapshot_same_connection_required'])

    def test_original_whole_predicates_are_identical_ast_first_and_term(self):
        for relation, statement in o.originals():
            if relation not in o.HEAVY:
                continue
            sliced = o.sliced(statement, relation)
            inner = lambda text: text.split('  from(', 1)[1].rsplit(')q;', 1)[0]
            original_where = parse_sql(inner(statement))[0].stmt.whereClause
            partition_where = parse_sql(inner(sliced))[0].stmt.whereClause
            self.assertEqual(partition_where.boolop.name, 'AND_EXPR')
            self.assertEqual(without_locations(original_where()), without_locations(partition_where.args[0]()))
            if relation == o.HEAVY[1]:
                self.assertIn('(f.candidate_media_id,f.asset_id)in(select', sliced)
                self.assertNotIn('cross join', sliced)

    def test_other_ten_statement_hashes_and_frozen_sources(self):
        _, metadata = o.build()
        expected = {k: hashlib.sha256(v.encode()).hexdigest() for k, v in o.originals() if k not in o.HEAVY}
        self.assertEqual(len(expected), 10)
        self.assertEqual(metadata['unchanged_other_ten_statements'], expected)
        with patch.object(o, 'OLD_SHA', '0' * 64):
            with self.assertRaisesRegex(ValueError, 'SOURCE_UNCONFIRMED'):
                o.build()

    def test_complete_union_disjoint_chunks_and_original_other_relation_sql(self):
        node(r"""
const f=fixture();await prepareOracle(f.ctx,f.oracle,f.record);
for(const [relation,universe]of[[heavy[0],f.assets],[heavy[1],f.frames]]){
 const chunks=partitionUniverse(relation,universe);assert.equal(chunks.flat().length,universe.length);
 assert.deepEqual(chunks.flat(),universe);assert(chunks.every(c=>c.length>0&&c.length<=16));
 const selected=await readOracle(f.ctx,f.oracle,relation,f.record);
 assert.deepEqual(selected,chunks.flatMap(c=>c.filter((_,i)=>i%3===0)));
 const r=f.record.partitioned_oracle.relations.at(-1);assert.equal(r.completed,true);assert.equal(r.final_same_snapshot_verified,true);
 assert.equal(r.chunks.reduce((n,c)=>n+c.universe_rows,0),universe.length);assert(r.chunks.every(c=>c.normal_return&&c.same_pid_snapshot_role_and_bounds));
}
assert.equal(f.record.partitioned_oracle.universes[heavy[0]].chunks,32);assert.equal(f.record.partitioned_oracle.universes[heavy[1]].chunks,21);
await readOracle(f.ctx,f.oracle,'eps.roles',f.record);
assert(f.calls.includes(`select pg_temp.pool_proof_cohort('eps.roles','${f.ctx.profiles.large.workspace}'::uuid,'${f.ctx.profiles.large.series}'::uuid);`));
assert.equal(f.calls[0],'PURE_INSTALL_SQL');assert(f.calls[1].startsWith('reset role;begin isolation level repeatable read read only;'));
const publicText=JSON.stringify(f.record);assert(!publicText.includes(uuid(1)));assert(!publicText.includes('100:200:101,102'));assert(!publicText.includes('PURE_ACTING'));
""")

    def test_missing_duplicate_and_unprepared_universes_refuse(self):
        node(r"""
for(const fault of['duplicate','missing']){const f=fixture(fault);await assert.rejects(prepareOracle(f.ctx,f.oracle,f.record),/ORACLE_PARTITION_/u);assert(!f.calls.some(q=>q.includes('pool_oracle41_slice')));}
const f=fixture();await assert.rejects(readOracle(f.ctx,f.oracle,heavy[0],f.record),/NOT_PREPARED/u);assert.equal(f.calls.length,0);
await prepareOracle(f.ctx,f.oracle,f.record);await assert.rejects(readOracle(f.ctx,f.oracle,'eps.jobs',f.record),/CLOSED_RELATION/u);
""")

    def test_same_snapshot_pid_role_and_bounds_are_required_each_chunk(self):
        node(r"""
for(const fault of['snapshot','pid','role','readonly','isolation','timeout']){
 const f=fixture(fault);await prepareOracle(f.ctx,f.oracle,f.record);
 await assert.rejects(readOracle(f.ctx,f.oracle,heavy[0],f.record),/ORACLE_PARTITION_/u);
 const r=f.record.partitioned_oracle.relations[0];assert.equal(r.completed,false);assert.equal(r.chunks.length,1);assert.equal(r.chunks[0].normal_return,false);
}
""")

    def test_result_must_be_subset_of_exact_pk_chunk_not_frame_crossproduct(self):
        node(r"""
for(const [fault,relation]of[['foreign',heavy[0]],['crosspair',heavy[1]]]){
 const f=fixture(fault);await prepareOracle(f.ctx,f.oracle,f.record);
 await assert.rejects(readOracle(f.ctx,f.oracle,relation,f.record),/RESULT_OUTSIDE_CHUNK/u);
 assert.equal(f.record.partitioned_oracle.relations[0].completed,false);
}
const f=fixture();const bad=[...f.assets];bad[1]=bad[0];assert.throws(()=>partitionUniverse(heavy[0],bad),/DUPLICATE/u);
assert.throws(()=>partitionUniverse(heavy[1],[{candidate_media_id:uuid(1),asset_id:uuid(2),extra:'PRIVATE_CANARY'}]),/KEY_SHAPE/u);
""")


if __name__ == '__main__':
    unittest.main()
