"""Compact query protocol and first actual paired-snapshot code negatives."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pglast import parse_sql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


local = module('compact_collector_actual_tests', HERE / 'local.py')
m = module('compact_collector_compiler_tests', HERE / 'compiler.py')
RUN = '8a800000-0000-4000-8000-000000000042'


class Tests(unittest.TestCase):
    def test_actual_retained_check_unchanged_factored_render_and_dispatch(self):
        file = m.MAIN / '.local/presentation-generation-factored-collector-proof/3c56fc2a-faba-48fd-a66a-a693c8ecc55b/bridge-check-04581a62-a48b-41b5-9231-c414722e2eed-input.json'
        raw = local.s.load(file)
        self.assertEqual(local.s.sha(raw), '4f0fa7cd6890970801239c1f8ef4f36811615e619a47cbcede5d12645733c0c7')
        value = json.loads(raw)
        self.assertEqual(local.dispatch('check', value), {'result': 'passed'})
        c = local.Context().bind(value['initial'], value['system'], value['run'])
        self.assertIs(local.Context.render.__code__, local.old.Context.render.__code__)
        self.assertIs(local.Context.diagnostic.__code__, local.old.Context.diagnostic.__code__)
        rendered = local.dispatch('render', {**value, 'before': value['initial'], 'marker': RUN})
        self.assertGreater(len(parse_sql(rendered['sql'])), 7)
        self.assertLess(len(rendered['sql'].encode()), 1024**2)
        self.assertEqual(rendered['sql'].count(c.state_sql()), 1)
        self.assertNotIn('commit;', rendered['diagnostic_sql'])
        self.assertEqual(local.dispatch('diagnose', {**value, 'before': value['initial'], 'observed': rendered['expected']})['difference_count'], 0)

    def test_finite_protocol_three_syntax_OFF_and_actual_pair_mismatch_before_assertion(self):
        source, bridge, entry, proof = m.compile_source('.local/presentation-generation-collector-compact-compiled/controller-' + RUN + '.mjs')
        self.assertTrue(all(proof[k] for k in ('parent_controller_inverse_byte_equal', 'parent_bridge_inverse_byte_equal', 'parent_entry_inverse_byte_equal', 'only_literal_query_paired_snapshot_and_new_ownership_changed', 'same_fixture_bounds_and_transaction_protocol_with_paired_RR_reads')))
        begin = source.index('const cfg=') + len('const cfg=')
        cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
        self.assertEqual(cfg['original_snapshot_sql'], local.old.configuration()['snapshot_sql'])
        self.assertLess(len(cfg['snapshot_sql'].encode()), len(cfg['original_snapshot_sql'].encode()) // 4)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = source.replace(Path(cfg['entry_file']).as_uri(), (root / 'entry.mjs').as_uri())
            for name, text in [('controller.mjs', source), ('bridge.mjs', bridge), ('entry.mjs', entry)]:
                file = root / name
                file.write_text(text, encoding='utf8', newline='\n')
                result = subprocess.run(['node', '--check', str(file)], capture_output=True, timeout=15)
                self.assertEqual(result.returncode, 0, 'generated syntax refused')
            off = root / 'off.mjs'
            off.write_text('const m=await import(' + json.dumps((root / 'controller.mjs').as_uri()) + ");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}", encoding='utf8')
            self.assertEqual(subprocess.run(['node', str(off)], capture_output=True, timeout=15).returncode, 0)
            fake_bridge = root / 'fake-bridge.mjs'
            fake_bridge.write_text("export async function privateWrite(){throw new Error('unexpected private write')};export async function diagnosticBridge(){throw new Error('unexpected bridge')};", encoding='utf8')
            active = root / 'active.mjs'
            active.write_text(entry.replace('export const EXECUTION_ENABLED = false;', 'export const EXECUTION_ENABLED = true;', 1), encoding='utf8')
            script = r'''import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{readFile,writeFile}from'node:fs/promises';
const p=await import(__ACTIVE_JSON__),cfg=__CONFIG_JSON__;cfg.bridge_file=__BRIDGE_JSON__;cfg.bridge_sha256=createHash('sha256').update(await readFile(__BRIDGE_JSON__)).digest('hex');
let query='',calls=0;const ctx={runId:__RUN_JSON__,system:'123456789',report:{},sql:async text=>{query=text;calls++;return{stdout:JSON.stringify({old:{history:{versions:['41']},secret:'PRIVATE_CANARY_OLD'},compact:{history:{versions:['41']},secret:'PRIVATE_CANARY_NEW'},isolation:'repeatable read',read_only:'on'})}}};
await assert.rejects(()=>p.runProof(ctx,cfg),e=>e.code==='ERR_ASSERTION');assert.equal(calls,1);const row=ctx.report.literal_compaction.snapshots[0];assert.equal(row.equal,false);assert(row.repeatable_read&&row.read_only&&row.same_statement_snapshot);assert(!JSON.stringify(ctx.report).includes('PRIVATE_CANARY'));
await writeFile(__QUERY_JSON__,query);'''
            for token, value in [('__ACTIVE_JSON__', active.as_uri()), ('__BRIDGE_JSON__', str(fake_bridge)), ('__RUN_JSON__', RUN), ('__QUERY_JSON__', str(root / 'pair.sql')), ('__CONFIG_JSON__', cfg)]:
                script = script.replace(token, json.dumps(value))
            fake = root / 'fake.mjs'
            fake.write_text(script, encoding='utf8', newline='\n')
            result = subprocess.run(['node', str(fake)], capture_output=True, timeout=20)
            self.assertEqual(result.returncode, 0, 'paired mismatch must reject after closed evidence, before writes; error kinds=' + ','.join(__import__('re').findall(r'([A-Za-z]+Error):', result.stderr.decode('utf8', errors='replace'))))
            query = (root / 'pair.sql').read_text(encoding='utf8')
            self.assertIn('begin isolation level repeatable read read only;', query)
            self.assertIn("select jsonb_build_object('old',(", query)
            self.assertIn("),'compact',(", query)
            self.assertGreater(len(parse_sql(query)), 7)


if __name__ == '__main__':
    unittest.main()
