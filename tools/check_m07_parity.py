"""Source-bound operation inventory/schema/route reconciliation; never calls providers."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import yaml

ROOT = Path(__file__).resolve().parents[1]


def convert(value):
    if isinstance(value, dict):
        return {key: child.replace('#/components/schemas/', '#/$defs/') if key == '$ref' else convert(child) for key, child in value.items()}
    if isinstance(value, list):
        return [convert(child) for child in value]
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-doc', action='store_true')
    parser.add_argument('--report')
    args = parser.parse_args()
    inventory_path = ROOT / 'contracts/operation-parity.json'
    inventory = json.loads(inventory_path.read_text(encoding='utf-8'))
    api = yaml.safe_load((ROOT / 'contracts/openapi.yaml').read_text(encoding='utf-8'))
    catalog = json.loads((ROOT / 'contracts/mcp-tool-catalog.json').read_text(encoding='utf-8'))
    operations = {op['operationId']: (method.upper(), path, op) for path, item in api['paths'].items() for method, op in item.items() if isinstance(op, dict) and 'operationId' in op}
    tools = {tool['name']: tool for tool in catalog['tools']}
    script = """
import {createHash} from 'node:crypto';
import {implementedMcpTools} from './apps/web/lib/mcp.ts';
import {validateMcpSuccess} from './apps/web/lib/mcp-output-validation.ts';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const rows=implementedMcpTools(true,true,true,true,true).map(t=>{
 let rejected=false;try{validateMcpSuccess(t.name,{})}catch(e){if(e.code!=='OPERATION_RESPONSE_INVALID')throw e;rejected=true}
 if(!rejected)throw Error('Empty success result accepted');
 return {name:t.name,input:hash(t.inputSchema),output:hash(t.outputSchema),annotations:t.annotations};
});console.log(JSON.stringify(rows));
"""
    run = subprocess.run(['node', '--import', 'tsx', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=120)
    if run.returncode:
        raise RuntimeError('Local runtime import/schema check failed; inspect source without publishing raw diagnostics.')
    runtime = json.loads(run.stdout)
    errors = []
    def check(condition, message):
        if not condition:
            errors.append(message)
    check(len(runtime) == len(tools) == 87, 'Runtime/catalog must contain87 implemented user tools.')
    check({row['name'] for row in runtime} == set(tools), 'Runtime and catalog tool names differ.')
    rows = [row for group in inventory['groups'] for row in group['operations']]
    check(len(rows) == len({row['operation'] for row in rows}) == 87, 'Meaningful-action inventory must cover each user operation once.')
    check({row['operation'] for row in rows} == set(tools), 'UI semantic groups and MCP catalog differ.')
    sources = {'contracts/openapi.yaml', 'contracts/mcp-tool-catalog.json', 'contracts/operation-parity.json', 'apps/web/lib/mcp.ts', 'apps/web/lib/mcp-output-validation.ts', 'tools/check_m07_parity.py'}
    def digest(value):
        return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
    for row in runtime:
        tool = tools[row['name']]
        check(row['input'] == digest(tool['inputSchema']) and row['output'] == digest(tool['outputSchema']), f'{row["name"]}: advertised runtime schemas differ.')
        check(row['annotations'] == tool['annotations'], f'{row["name"]}: annotations differ.')
    for group in inventory['groups']:
        for source in group['ui_sources']:
            sources.add(source); check((ROOT / source).is_file(), f'{group["id"]}: UI source missing.')
        for row in group['operations']:
            name = row['operation']; tool = tools[name]; method, path, operation = operations[name]
            check(tool['operationId'] == name and tool['http'] == {'method': method, 'path': path}, f'{name}: HTTP mapping differs.')
            check(operation.get('x-mcp-exposed') is True and tool['capability'] == operation.get('x-capability'), f'{name}: exposure/capability differs.')
            for source in [row['domain_source'], row['http_source']]:
                sources.add(source); check((ROOT / source).is_file(), f'{name}: implementation source missing.')
            check(row['domain_symbol'] in (ROOT / row['domain_source']).read_text(encoding='utf-8'), f'{name}: shared service symbol missing.')
            check(row['domain_symbol'] in (ROOT / row['http_source']).read_text(encoding='utf-8'), f'{name}: HTTP does not reference shared operation.')
            body = operation.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema')
            check(body is None or tool['inputSchema']['properties'].get('body') == convert(body), f'{name}: body schema differs.')
            success = next((response.get('content', {}).get('application/json', {}).get('schema') for code, response in operation['responses'].items() if str(code).startswith('2') and 'application/json' in response.get('content', {})), None)
            check(success is not None and {key: value for key, value in tool['outputSchema'].items() if key != '$defs'} == convert(success), f'{name}: success envelope differs.')
            for side in ['inputSchema', 'outputSchema']:
                for definition, value in tool[side].get('$defs', {}).items():
                    check(value == convert(api['components']['schemas'][definition]), f'{name}: {definition} differs from OpenAPI.')
    excluded = inventory['excluded_operations']
    check(set(excluded) == set(operations) - set(tools), 'Non-tool operations need an explicit exclusion and implementation boundary.')
    check(sum(row['introduced_m07'] for row in excluded.values()) == 1 and len(excluded) == 29, 'Expected28 retained exclusions plus one documented binary companion.')
    check(excluded['mint_review_media_grant']['implementation'] == 'gateway_only_no_next_http_handler', 'Media-grant service endpoint must retain its real gateway-only boundary.')
    for name, row in excluded.items():
        check(operations[name][2].get('x-mcp-exposed') is False, f'{name}: private/binary operation is exposed.')
        for source in row['sources']:
            sources.add(source); check((ROOT / source).is_file(), f'{name}: exclusion source missing.')
    check(set(operations) == set(tools) | set(excluded), 'OpenAPI operation inventory differs.')
    if args.write_doc:
        lines = ['# Implemented operation delivery', '', 'Generated from `contracts/operation-parity.json` by `tools/check_m07_parity.py --write-doc`.', '',
            '**Local source inventory:** 87 user operations, 87 composed MCP tools and 116 OpenAPI operations. The additive workspace-summary operation requires migration35 and compatible deployment before live use. Twenty-eight prior non-tool operations remain excluded; the existing shared-media binary companion is the29th. This is source/contract reconciliation; it does not establish hosted availability or production acceptance.', '',
            'UI groups include writes and the reads/discovery needed to perform them. An operation need not have a separate button. Navigation, local drafts and viewer controls are listed explicitly below.', '',
            '| Meaningful UI group | Current UI sources |', '| --- | --- |']
        for group in inventory['groups']:
            lines.append(f'| {group["label"]} | ' + ', '.join(f'`{path}`' for path in group['ui_sources']) + ' |')
        lines += ['', '| UI group | Shared operation and service | HTTP under `/api/v1` | MCP |', '| --- | --- | --- | --- |']
        for group in inventory['groups']:
            for row in group['operations']:
                method, path, _ = operations[row['operation']]
                lines.append(f'| {group["label"]} | `{row["operation"]}` → `{row["domain_symbol"]}` in `{row["domain_source"]}` | `{method} {path}` | `{row["operation"]}` |')
        lines += ['', '## Explicit non-tool boundaries', '', '| Operation | HTTP contract | Actual mechanism / exclusion |', '| --- | --- | --- |']
        for name, row in excluded.items():
            method, path, _ = operations[name]
            lines.append(f'| `{name}` | `{method} {path}` | {row["implementation"]}: {row["reason"]} |')
        lines += ['', '## Local UI and identity exceptions', ''] + [f'- {entry}' for entry in inventory['ui_exceptions']]
        lines += ['', '## Evidence and remaining acceptance', '',
            'Candidate cursor/envelope/key reconciliation and24 controlled module cases are recorded in [candidate parity](../../development/m07/CANDIDATE_PARITY.md). Ten controlled desktop cases, later root-owned Settings/auth desktop cases and older MCP fixtures have separate scopes; their counts overlap other gates and must not be summed.', '',
            'Fresh capability/delegation checks and strict success validation are implemented. Full real-service delegated client journeys, OAuth issuer configuration, live token revocation and end-to-end byte transfer remain unverified. Synthetic installed-client compatibility and actual canonical Settings/session RPC installation have separate dated evidence in the M07 acceptance matrix; this source checker does not prove them. Job-service HTTP remains loopback development/test only. Media-grant minting uses the leased private gateway; its documented HTTP path has no Next handler.', '',
            'AT-072 manual screen-reader acceptance remains pending. Mobile is skipped by owner instruction. The hosted pilot remains running; accepted Claude initial authorization, reconnect and project-read evidence remains completed. See the [current handoff](../../tracking/HANDOFF.md) for English rollout and remaining release evidence. No additional language labels or selector are required.', '']
        (ROOT / 'docs/integrations/IMPLEMENTATION_PARITY.md').write_text('\n'.join(lines), encoding='utf-8', newline='\n')
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'PASS' if not errors else 'FAIL', 'errors': errors,
        'runtime_user_tools': len(runtime), 'catalog_tools': len(tools), 'openapi_operations': len(operations), 'semantic_ui_groups': len(inventory['groups']),
        'retained_non_tool_exclusions': 28, 'new_binary_companions': 1, 'source_sha256': {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in sorted(sources)},
        'limitations': ['Static source/symbol/contract checks and official local runtime schema imports only; no HTTP requests, business identities, providers, cloud, browser or actual Claude client.', 'UI semantic mapping is an explicit maintained inventory, not proof of every UI behavior.', 'Remote auth, canonical settings RPC installation, complete journeys, workload, restore/release acceptance require their own evidence.']}
    if args.report:
        (ROOT / args.report).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'source_sha256'}, indent=2))
    raise SystemExit(bool(errors))


if __name__ == '__main__':
    main()
