"""Control-plane readiness; lastCheckedAt is cached metadata, not a heartbeat."""
from pathlib import Path
import hashlib,importlib.util,time
HERE=Path(__file__).resolve().parent;file=HERE/'provider.py'
if hashlib.sha256(file.read_bytes()).hexdigest()!='8ae748c4176ae6553e2fcdef81696aa0bce6652a8d0991c449aa95e147749054':raise ValueError('CACHED_HEALTH_FROZEN_SOURCE_CHANGED')
spec=importlib.util.spec_from_file_location('cached_health_frozen_provider',file);p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
def control_plane_ready(value,deployment,digest,now=None):
 now=int(time.time()*1000)if now is None else now;p.need(type(now)is int and now>0)
 p.need(value['project_id']==p.PROJECT and value['team_id']==p.TEAM and value['daemon']=='worker'and value['deployment_id']==deployment and value['environment']=='production'and value['status']=='ready'
  and value['requested_image']['digest']==value['resolved_image']['digest']==digest and value['configured_instances']=={'dub1':1}and value['configured_override']is None and value['memory_mib']==2048 and value['termination_grace_seconds']==300
  and value['desired']==value['ready']==value['total']==1 and len(value['instances'])==1)
 row=value['instances'][0];p.need(row['alive']is True and row['image']['digest']==digest and row['region']=='dub1'and row['memory_mib']==2048 and row['stopped_at_ms']is None and type(row['started_at_ms'])is int and type(row['last_checked_at_ms'])is int and 0<row['started_at_ms']<=row['last_checked_at_ms']<=now+60000)
 identity={'instance_id':row['id'],'id':row['id'],'started_at_ms':row['started_at_ms'],'deployment_id':deployment,'digest':digest}
 cached={'last_checked_at_ms':row['last_checked_at_ms'],'last_checked_age_ms':now-row['last_checked_at_ms'],'observed_at_ms':now,'kind':'cached_platform_metadata','fresh_application_heartbeat_proven':False}
 return identity,cached
