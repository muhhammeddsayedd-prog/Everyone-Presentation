"""Pure hash-only catalogue drilldown. No CLI, database or network operation.

Reuses the exact failed-inspection union without dropping/normalizing fields.
Both original release bytes and root's enablement-only variant are admitted.
"""
from pathlib import Path
import hashlib, importlib.util, re

HERE=Path(__file__).resolve().parent
RELEASE_SHAS={'8d8da522e6f9ba84437dda9b886e9e33c321663d5f225703457d0dbffa103edc',
 '3a3c9e26c73556fffb9de79f985226c74143e7dd171c8095e896a59fc48b4670'}
GROUPS={'procedure','pg_class','pg_type','pg_constraint','pg_policy','pg_trigger','pg_index','pg_attribute','pg_attrdef','pg_rewrite','enum','namespace','role','membership','default_acl'}

def release():
 file=HERE/'release.py'
 if hashlib.sha256(file.read_bytes()).hexdigest()not in RELEASE_SHAS:raise ValueError('CATALOGUE_DIAGNOSTIC_SOURCE_CHANGED')
 spec=importlib.util.spec_from_file_location('catalogue_diagnostic_frozen_release',file)
 value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def union_sql():
 source=release().catalogue_sql();anchor="from(select 'procedure:"
 if source.count(anchor)!=1 or not source.endswith(')catalogue)'):raise ValueError('CATALOGUE_DIAGNOSTIC_SEAM_CHANGED')
 return source[source.index(anchor)+len('from('):-len(')catalogue)')]

def literal(value):return "'"+value.replace("'","''")+"'"
def group_value(group):
 if group not in GROUPS:raise ValueError('CATALOGUE_DIAGNOSTIC_GROUP_INVALID')
 return literal(group)
def key_value(group,key,empty=False):
 group_value(group)
 if empty and key=='':return "''"
 if not isinstance(key,str)or not re.fullmatch(re.escape(group)+r':\d+(?::-?\d+)*',key):raise ValueError('CATALOGUE_DIAGNOSTIC_KEY_INVALID')
 return literal(key)
def digest(expression):return "encode(sha256(convert_to(("+expression+")::text,'UTF8')),'hex')"
def wrap(ctes,expression):
 return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';with catalogue as("+union_sql()+")"+ctes+" select jsonb_build_object('database',current_database(),'operator',current_user,'diagnostic_only',true,'metadata_hashes_only',true,"+expression+")as summary35_release;rollback;"

def groups_sql():
 ctes=", grouped as(select split_part(k,':',1)g,count(*)n,encode(sha256(convert_to(coalesce(string_agg(k||':'||"+digest('v')+",E'\\n'order by k collate \"C\"),''),'UTF8')),'hex')h from catalogue group by split_part(k,':',1))"
 return wrap(ctes,"'level','groups','groups',(select jsonb_agg(jsonb_build_object('group',g,'count',n,'sha256',h)order by g collate \"C\")from grouped)")

def keys_sql(group,after_key='',limit=1000):
 g=group_value(group);after=key_value(group,after_key,True)
 if type(limit)is not int or not 1<=limit<=1000:raise ValueError('CATALOGUE_DIAGNOSTIC_LIMIT_INVALID')
 ctes=", picked as(select k,"+digest('v')+"h from catalogue where split_part(k,':',1)="+g+"and k collate \"C\">"+after+" collate \"C\" order by k collate \"C\" limit "+str(limit+1)+"), page as(select * from picked order by k collate \"C\" limit "+str(limit)+")"
 return wrap(ctes,"'level','keys','group',"+g+",'items',(select coalesce(jsonb_agg(jsonb_build_object('key',k,'sha256',h)order by k collate \"C\"),'[]'::jsonb)from page),'next_key',case when(select count(*)from picked)>"+str(limit)+" then(select max(k collate \"C\")from page)else null end")

def fields_sql(group,key):
 g=group_value(group);k=key_value(group,key)
 ctes=", chosen as(select v from catalogue where k="+k+"), fields as(select f.key field,"+digest('f.value')+"h from chosen cross join lateral jsonb_each(v)f)"
 return wrap(ctes,"'level','fields','group',"+g+",'key',"+k+",'matched',(select count(*)from chosen),'fields',(select coalesce(jsonb_agg(jsonb_build_object('field',field,'sha256',h)order by field collate \"C\"),'[]'::jsonb)from fields)")
