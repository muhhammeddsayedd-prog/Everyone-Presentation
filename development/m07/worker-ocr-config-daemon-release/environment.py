"""Exactly two existing production hash PATCHes; no POST or native change."""
from pathlib import Path
import importlib.util
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ocr_env_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
old=a.frozen('worker-source-identity-release/environment.py');need=a.need
EDITABLE=old.EDITABLE;selected=old.selected;projection=old.projection;preserved=old.preserved;production=old.production
def base():return old.base()
def actions(before,values):
 old.wanted(values);need(before['public']['EPS_NATIVE_MANIFEST_SHA256']==values['EPS_NATIVE_MANIFEST_SHA256']==a.BASELINE['native_manifest_sha256'])
 need(before['public']['EPS_DAEMON_SOURCE_SHA256']==a.BASELINE['daemon_source_sha256']and before['public']['EPS_NATIVE_COMPATIBILITY_SHA256']==a.BASELINE['native_compatibility_sha256'])
 result=[]
 for key in EDITABLE:
  row=selected(before['metadata'],key);need(row is not None)
  if key!='EPS_NATIVE_MANIFEST_SHA256':need(before['public'][key]!=values[key]);result.append({'method':'PATCH','key':key,'id':row['id'],'body':{'value':values[key]}})
 need(len(result)==2);return result
def response(value,action):
 need(action['method']=='PATCH'and type(value)is dict and value.get('id')==action['id']and value.get('key')==action['key']and value.get('value')==action['body']['value']);return {'normal_return_observed':True}
