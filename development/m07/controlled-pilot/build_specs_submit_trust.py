"""Public-source-only materializer; never consults a database or live body hash."""
from pathlib import Path
import hashlib
import json
import re
from pglast import parse_sql

M05='20261029215218_m05_immutable_presentation_versions.sql'
M06='20261030002634_m06_guest_review_feedback_exports.sql'
M07='20261030111549_m07_settings_delegated_session.sql'
PINS={M05:'09d78c225ca02d436a8b1c2bcc6e55f273dfea116976807af4a8b228b99de5f4',
      M06:'2c72507216efdcd3e9dcea3f9b94270b19e1275ebcd2fcf91dad9253ddde8d2a',
      M07:'6531e8decab5496e212eb01575aca666cd9e03b0575f92dd66bd380760f84af4'}
PRE_M05='17158fb3e7895e526718a620a1d9c2cbab373062a25c347ea066d6bd27438431'
PRE_M06='d74480b632637a5fd74b1b52146cf7969aa2ef87e78e6da1b1f8132b898efac8'
PRE_M07='35af18435653ebb4249711e926d342e25adab1d9adb029079c38b27a0297bd7f'
POST_M06='3fa5199046618f9ccda24f55a7f4bd23fc7870d27747f17a55e51d83baf3f9d7'


def digest(value):return hashlib.sha256(value.encode()if isinstance(value,str)else value).hexdigest()


def need(value):
    if not value:raise ValueError('SPECS_SOURCE_MATERIALIZATION_INVALID')


def compose(body,migration):
    """Exact literal replacements from the three sealed DO forward blocks."""
    expected={M05:PRE_M05,M06:PRE_M06,M07:PRE_M07}[migration]
    need(digest(body)==expected)
    if migration==M05:
        marker='  from eps.jobs where id=p_job'
        replacement="    ||case when kind='presentation_render'then eps.presentation_job_actions(jobs)else'{}'::jsonb end\n  from eps.jobs where id=p_job"
    elif migration==M06:
        marker="||case when kind='presentation_render'then"
        replacement="||case when kind='presentation_export'then eps.export_job_actions(jobs)else'{}'::jsonb end\n    "+marker
    else:return body+'    and eps.mcp_token_permits_capability(p_capability)\n'
    need(body.count(marker)==1);result=body.replace(marker,replacement)
    need(digest(result)==(PRE_M06 if migration==M05 else POST_M06));return result


def build(root):
    functions={};triggers={};migrations={};transforms=[]
    for file in sorted((Path(root)/'supabase/migrations').glob('*.sql')):
        raw=file.read_bytes();text=raw.decode().replace('\r\n','\n');migrations[file.name]=digest(raw)
        if file.name in PINS:need(migrations[file.name]==PINS[file.name])
        for node in parse_sql(text):
            statement=node.stmt;kind=type(statement).__name__
            if kind=='CreateFunctionStmt':
                name='.'.join(part.sval for part in statement.funcname)
                options={option.defname:option.arg for option in statement.options}
                if 'as'not in options:continue
                parameters=[p for p in statement.parameters or()if p.mode.value not in('o','t')]
                signature=(name,tuple('.'.join(v.sval for v in p.argType.names)+('[]'if p.argType.arrayBounds else'')for p in parameters))
                configs=[option.arg for option in statement.options if option.defname=='set']
                path_empty=len(configs)==1 and configs[0].name=='search_path'and len(configs[0].args or())==1 and getattr(configs[0].args[0].val,'sval',None)==''
                functions[signature]={'name':name,'nargs':len(parameters),'language':options['language'].sval,
                  'security_definer':bool(options.get('security')and options['security'].boolval),
                  'volatility':options['volatility'].sval[0]if'volatility'in options else'v',
                  'body':options['as'][0].sval,'search_path_empty':path_empty,'migration':file.name}
            elif kind=='CreateTrigStmt':
                table=statement.relation.schemaname+'.'+statement.relation.relname
                triggers[(table,statement.trigname)]={'table':table,'name':statement.trigname,'function':'.'.join(p.sval for p in statement.funcname),
                    'type':int(statement.events)|int(statement.timing)|int(statement.row),'enabled':'O','nargs':len(statement.args or()),'migration':file.name}
        if file.name in PINS:
            target='eps.has_capability'if file.name==M07 else'eps.jobs_dto'
            matches=[entry for entry in functions.values()if entry['name']==target];need(len(matches)==1)
            entry=matches[0];before=digest(entry['body']);entry['body']=compose(entry['body'],file.name)
            transforms.append({'function':target,'migration':file.name,'before_sha256':before,'after_sha256':digest(entry['body'])})
    names={'public.eps_submit_specs'};tables=set();selected_triggers={};changed=True
    while changed:
        previous=(set(names),set(tables),set(selected_triggers))
        for entry in functions.values():
            if entry['name']not in names:continue
            names.update(name for name in re.findall(r'\b((?:eps|public)\.[a-z_][a-z_0-9]*)\s*\(',entry['body'])if any(f['name']==name for f in functions.values()))
            tables.update(re.findall(r'\b(?:insert\s+into|update|delete\s+from)\s+((?:eps|public)\.[a-z_][a-z_0-9]*)',entry['body'],re.I))
        for key,trigger in triggers.items():
            if trigger['table']in tables:selected_triggers[key]=trigger;names.add(trigger['function'])
        changed=previous!=(names,tables,set(selected_triggers))
    selected=[entry for entry in functions.values()if entry['name']in names]
    need(len({(entry['name'],entry['nargs'])for entry in selected})==len(selected))
    need(all(entry['search_path_empty']and entry['language']in('sql','plpgsql')for entry in selected))
    need(not any(re.search(r'\b(?:http_[a-z_]*|dblink[a-z_]*|plpython[a-z_]*|plperl[a-z_]*|execute|copy|notify)\b',entry['body'],re.I)for entry in selected))
    used={entry['migration']for entry in selected}|{entry['migration']for entry in selected_triggers.values()}|set(PINS)
    return {'schema_version':'1.0','scope':'Source-derived normalized prosrc and trigger closure including exact sealed M05/M06/M07 DO forwards; no actual DB observation',
      'functions':[{**{k:entry[k]for k in('name','nargs','language','security_definer','volatility')},'sha256':digest(entry['body']),'search_path_empty':True}
                   for entry in sorted(selected,key=lambda x:(x['name'],x['nargs']))],
      'triggers':[{k:v for k,v in trigger.items()if k!='migration'}for _,trigger in sorted(selected_triggers.items())],
      'tables':sorted(tables),'source_migrations':{name:migrations[name]for name in sorted(used)},
      'source_transforms':transforms,'external_call_tokens_found':False}


if __name__=='__main__':print(json.dumps(build(Path(__file__).resolve().parents[3]),indent=2))
