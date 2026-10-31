"""Compile unchanged production renderers against verified synthetic local input.

Only check_before is replaced, scoped to this process and exact input equality;
all SQL generation, state, candidate, postconditions and history writes are real.
"""
from pathlib import Path
import importlib.util,json,re,sys,uuid
HERE=Path(__file__).resolve().parent
def load(name):
 s=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
value=json.load(sys.stdin);before=value['before'];marker=value['marker'];assert str(uuid.UUID(marker))==marker
assert re.fullmatch('eps_oauth_consent_[a-f0-9]{32}',before['catalogue']['database'])
assert before['catalogue']['operator']=='postgres'and before['security']is None and not any(before['new_objects'].values())
def exact_before(observed):assert observed==before
old=load('release_v2');new=load('release_v3');old.check_before=exact_before;new.check_before=exact_before
red=old.render(before,marker);green=new.render(before,marker)
assert red.count('::jsonbthen')==2 and green.count('::jsonbthen')==0 and green.count('::jsonb then')==2
assert green==red.replace('::jsonbthen','::jsonb then')
print(json.dumps({'red':red,'green':green,'only_sql_change':'two required whitespace separators','production_check_before_override':'exact verified synthetic input only'}))
