/** Fresh independent-cluster + real Storage/PostgREST HTTP rehearsal. Import inert. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHmac,randomUUID,randomBytes} from 'node:crypto';
import process from 'node:process';
import {Buffer} from 'node:buffer';
import {setTimeout,clearTimeout} from 'node:timers';
import {mkdir,readFile,writeFile,lstat,realpath,unlink} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha,quote,resourceName,assertOwnedResource,checkedObjectPath,normalizeCatalogue,roleBootstrapSql,checkedHttpTarget,verifyObjectReference,LEGACY_CLAIM_BRIDGE_SQL} from './guards.mjs';
import {fullCatalogue33Sql} from '../recovery33/compiler.mjs';
import {dataSql36} from '../recovery36/runtime.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..');
const BACKUP_RUN='639da33a-7e90-4471-b0ec-c7a8ff6097ef';
const METADATA_HASH='12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c';
const IMAGES={db:'public.ecr.aws/supabase/postgres@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb',storage:'public.ecr.aws/supabase/storage-api@sha256:a0420573837ee08c0afdc9cd01f90b4b8027579da99e0b9a159fe912ef756c99',rest:'public.ecr.aws/supabase/postgrest@sha256:1347d7552b88f17832912c06afbf7c43209af6eeeb60834b04aae12c9bd9d5cc'};
const ACTOR='8a1a0000-0000-4000-8000-000000000001';
const {structuredClone}=globalThis;
const jsonRows=s=>s.split(/\r?\n/u).filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// A Docker internal-only bridge has no published host port. Run the HTTP client
// inside this run's Storage container; URLs and capabilities travel over stdin,
// never command arguments. Both server origins remain on the owned network.
const OWNED_HTTP=String.raw`let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{input+=chunk;if(input.length>8*1024*1024)process.exit(2);});process.stdin.on('end',async()=>{try{const request=JSON.parse(input),response=await fetch(request.url,{method:request.method,headers:request.headers,body:request.body===null?undefined:Buffer.from(request.body,'base64'),redirect:'error',signal:AbortSignal.timeout(10000)});const chunks=[];let size=0;if(response.body){const reader=response.body.getReader();try{while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>8*1024*1024){await reader.cancel();throw Error('limit');}chunks.push(result.value);}}finally{reader.releaseLock();}}process.stdout.write(JSON.stringify({status:response.status,bytes:Buffer.concat(chunks).toString('base64')}));}catch{process.stderr.write('RECOVERY_HTTP_UNCONFIRMED');process.exitCode=1;}});`;
async function protect(dir){
 await mkdir(dir,{mode:0o700});assert.equal(await realpath(dir),dir);
 if(process.platform!=='win32'){assert.equal((await lstat(dir)).mode&0o777,0o700);return;}
 const ps="$ErrorActionPreference='Stop';$p=$env:EPS_RECOVERY_PRIVATE;$s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a=New-Object System.Security.AccessControl.DirectorySecurity;$a.SetOwner($s);$a.SetAccessRuleProtection($true,$false);foreach($i in @($s,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($i,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a;$a=Get-Acl -LiteralPath $p;if(-not$a.AreAccessRulesProtected-or$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value-ne$s.Value){throw 'ACL'};foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value-notin@($s.Value,'S-1-5-18')-or$r.AccessControlType-ne'Allow'-or$r.FileSystemRights-ne'FullControl'){throw 'ACL'}};if($a.Access.Count-ne2){throw 'ACL'};Write-Output 'VERIFIED'";
 const r=await command(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',ps],{env:{...process.env,EPS_RECOVERY_PRIVATE:dir}});assert.equal(r.stdout.trim(),'VERIFIED');
}
async function command(exe,args,{input='',env=process.env,timeout=60000,allowFailure=false}={}){
 return new Promise((resolve,reject)=>{const p=spawn(exe,args,{cwd:ROOT,env,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',size=0,timedOut=false;const timer=setTimeout(()=>{timedOut=true;p.kill();},timeout);for(const[s,k]of[[p.stdout,'stdout'],[p.stderr,'stderr']])s.on('data',b=>{size+=b.length;if(size>8*1024*1024)p.kill();else if(k==='stdout')stdout+=b;else stderr+=b;});p.stdin.on('error',()=>{});p.stdin.end(input);p.once('error',()=>{clearTimeout(timer);reject(Error('RECOVERY_COMMAND_UNCONFIRMED'));});p.once('close',(code,signal)=>{clearTimeout(timer);if(timedOut||size>8*1024*1024)reject(Error('RECOVERY_COMMAND_UNCONFIRMED'));else if(code!==0&&!allowFailure)reject(Object.assign(Error('RECOVERY_COMMAND_FAILED'),{diagnostic:{code,signal,stdout,stderr}}));else resolve({code,signal,stdout,stderr});});});
}
export async function run(sourceRoot){
 assert.equal(process.version,'v24.18.0');assert(!process.env.NODE_OPTIONS&&!process.env.NPM_CONFIG_NODE_OPTIONS);
 sourceRoot=await realpath(path.resolve(sourceRoot));assert.notEqual(sourceRoot,ROOT);
 const runId=randomUUID(),started=Date.now(),privateRoot=path.join(ROOT,'.local/m07-independent-recovery',runId),resources=[];
 const report={schema_version:'1.0',run_id:runId,started_at:new Date(started).toISOString(),result:'failed',checkpoint:'initialization',scope:'AT-070 synthetic independent Docker PG17 cluster plus real local Storage and PostgREST HTTP; no deployed/provider/real-user authentication/AT069/RTO/RPO claim',cloud_called:false,provider_called:false,pilot_called:false,at069_performed:false,source_backup_run:BACKUP_RUN};
 let lock,originalBefore,originalPort,lockPath,privateReady=false,db,network,catalogueSqlReady,controllerSeals,httpContainer,httpOrigins=[],database='postgres';
 const host=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
 const docker=(args,options)=>command('docker',['--host',host,...args],options);
 const labels={'eps.recovery.run':runId,'eps.recovery.workspace':ROOT,'eps.recovery.purpose':'independent38'};
 const labelArgs=Object.entries(labels).flatMap(([k,v])=>['--label',k+'='+v]);
 const password=randomBytes(32).toString('base64url'),jwtSecret=randomBytes(48).toString('base64url');
 const inspect=async r=>{const v=JSON.parse((await docker([r.type,'inspect',r.id])).stdout)[0];if(r.type==='volume')v.Id=v.Name;return assertOwnedResource(v,{...r,run:runId,workspace:ROOT});};
 async function create(type,kind,args){const name=resourceName(runId,kind);assert.notEqual((await docker([type,'inspect',name],{allowFailure:true})).code,0,'RECOVERY_RESOURCE_ALREADY_EXISTS');const out=await docker([type,'create',...labelArgs,...args,name]);const id=out.stdout.trim();assert(id);const r={type,kind,name,id};resources.push(r);await inspect(r);return r;}
 async function container(kind,args){const name=resourceName(runId,kind);assert.notEqual((await docker(['container','inspect',name],{allowFailure:true})).code,0);const out=await docker(['container','create','--pull=never','--name',name,...labelArgs,'--network',network.name,...args]);const r={type:'container',kind,name,id:out.stdout.trim()};resources.push(r);const v=await inspect(r);assert.equal(v.Image,report.images[kind]);await docker(['container','start',r.id]);return r;}
 async function sql(body,{allowFailure=false}={}){const c=await inspect(db);assert.equal(c.State.Running,true);return docker(['exec','-i','--user','postgres',db.id,'psql','-h','/var/run/postgresql','-U','supabase_admin','-d',database,'-X','-v','ON_ERROR_STOP=1','-A','-t','-q'],{input:body,allowFailure});}
 async function value(body){const r=await sql('BEGIN;SET LOCAL search_path=pg_catalog;'+body+'\nCOMMIT;');const rows=jsonRows(r.stdout);assert.equal(rows.length,1,'RECOVERY_SQL_ENVELOPE');return rows[0];}
 function jwt(role,sub){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000),s=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,...(sub?{sub,aud:'authenticated'}:{}),iat:now,exp:now+1800});return s+'.'+createHmac('sha256',jwtSecret).update(s).digest('base64url');}
 async function http(base,pathname,{method='GET',token,body,headers={}}={}){assert(httpContainer);await inspect(httpContainer);const url=checkedHttpTarget(base,pathname,httpOrigins);const request={url,method,headers:{...(token?{authorization:'Bearer '+token}:{}),...headers},body:body===undefined?null:Buffer.from(body).toString('base64')};const output=await docker(['exec','-i',httpContainer.id,'node','-e',OWNED_HTTP],{input:JSON.stringify(request),timeout:15000});const response=JSON.parse(output.stdout);assert(Number.isInteger(response.status)&&response.status>=100&&response.status<=599&&typeof response.bytes==='string','RECOVERY_HTTP_RESPONSE_INVALID');return {status:response.status,bytes:Buffer.from(response.bytes,'base64')};}
 async function awaitHttp(base,pathname){for(let i=0;i<45;i++){try{const r=await http(base,pathname);if(r.status<500)return;}catch{/* The fixed startup window permits temporary connection refusal. */}await delay(500);}throw Error('RECOVERY_HTTP_STARTUP_UNCONFIRMED');}
 async function baseline(){assert(catalogueSqlReady);const roleSql="select jsonb_build_object('roles',(select jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'super',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassrls',rolbypassrls,'connlimit',rolconnlimit,'validuntil',rolvaliduntil)order by oid)from pg_roles),'memberships',(select jsonb_agg(to_jsonb(m)order by roleid,member,grantor)from pg_auth_members m),'system_identifier',(pg_control_system()).system_identifier::text);";const r=await originalPort.runOwnedLocalSql('BEGIN READ ONLY;SET LOCAL search_path=pg_catalog;'+dataSql36()+catalogueSqlReady+roleSql+'ROLLBACK;');const rows=jsonRows(r.stdout);assert.equal(rows.length,3);return{data:rows[0],catalogue:rows[1],global_roles:rows[2]};}
 try{
  await mkdir(path.dirname(privateRoot),{recursive:true});await protect(privateRoot);privateReady=true;report.private_acl_verified=true;
  await writeFile(path.join(privateRoot,'owner.json'),JSON.stringify({run_id:runId,workspace:ROOT,purpose:'m07-independent-recovery38'}),{flag:'wx'});
  await writeFile(path.join(privateRoot,'claim.json'),JSON.stringify({one_use:true,automatic_retry:false,run_id:runId}),{flag:'wx'});
  controllerSeals={};for(const file of ['development/m07/independent-recovery38/run.mjs','development/m07/independent-recovery38/guards.mjs','development/m07/recovery33/compiler.mjs','development/m07/recovery36/runtime.mjs']){const bytes=await readFile(path.join(ROOT,file));controllerSeals[file]=sha(bytes);const dest=path.join(privateRoot,'executed-sources',file);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'});}report.executed_source_seals=controllerSeals;report.executed_source_snapshots_retained_privately=true;
  report.checkpoint='verify-read-only-source-backup';
  const backupRoot=path.join(sourceRoot,'.local/m07-recovery',BACKUP_RUN);
  const bundlePort=await import(pathToFileURL(path.join(sourceRoot,'tools/m07-recovery-bundle.mjs')).href);
  const verified=await bundlePort.verifyRecoveryBundle(backupRoot,BACKUP_RUN,'backup'),manifest=verified.manifest;
  assert.equal(manifest.metadata.sha256,METADATA_HASH);assert.equal(verified.objects,4);assert.equal(verified.sources,373);
  const sourceReceiptBytes=await readFile(path.join(sourceRoot,'tracking/evidence/m07/recovery38/2026-11-01T20-19-31-495Z-639da33a.json'));
  const sourceReceipt=JSON.parse(sourceReceiptBytes);assert.equal(sourceReceipt.result,'passed');assert.equal(sourceReceipt.metadata_backup_sha256,METADATA_HASH);
  const metadata=await readFile(path.join(backupRoot,'backup/metadata.sql'));assert.equal(sha(metadata),METADATA_HASH);
  const expectedRows=JSON.parse(await readFile(path.join(backupRoot,'source38-populated-row-hashes.json')));assert.equal(sha(JSON.stringify(expectedRows)),sourceReceipt.full38_populated_hashes_sha256);
  const expectedCatalogue=JSON.parse(await readFile(path.join(backupRoot,'restore38-before-profile.json')));
  report.source_receipt_sha256=sha(sourceReceiptBytes);report.metadata_sha256=METADATA_HASH;report.verified_source_count=verified.sources;report.verified_object_count=verified.objects;
  const sourceMap=new Map();for(const e of manifest.sources){const bytes=await readFile(path.join(backupRoot,'backup',e.file));sourceMap.set(e.path,bytes);const dest=path.join(privateRoot,'restored-sources',e.path);assert(dest.startsWith(path.join(privateRoot,'restored-sources')+path.sep));await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'});assert.equal(sha(await readFile(dest)),e.sha256);}
  report.source_bytes_restored=sourceMap.size;
  catalogueSqlReady=fullCatalogue33Sql(sourceMap).sql;
  originalPort=await import(pathToFileURL(path.join(sourceRoot,'tools/local-postgres.mjs')).href);await originalPort.verifyLocalTarget();
  lockPath=path.join(sourceRoot,'.local/local-postgres/test-db.lock');lock={run_id:runId,purpose:'independent-recovery38-read-only-preservation',workspace:ROOT};await writeFile(lockPath,JSON.stringify(lock),{flag:'wx'});originalBefore=await baseline();report.original_baseline_sha256=sha(JSON.stringify(originalBefore));
  report.images={};for(const[k,image]of Object.entries(IMAGES)){const v=JSON.parse((await docker(['image','inspect',image])).stdout)[0];assert(/^sha256:[a-f0-9]{64}$/u.test(v.Id));report.images[k]=v.Id;}
  report.checkpoint='new-owned-independent-cluster';
  network=await create('network','network',['--internal']);assert.equal((await inspect(network)).Internal,true);const dbVolume=await create('volume','dbdata',[]),objectVolume=await create('volume','objects',[]);
  const dbEnv=path.join(privateRoot,'db.env');await writeFile(dbEnv,`POSTGRES_PASSWORD=${password}\nPGPASSWORD=${password}\nPOSTGRES_DB=postgres\nPGDATA=/var/lib/postgresql/data\n`,{flag:'wx'});
  db=await container('db',['--env-file',dbEnv,'--mount',`type=volume,source=${dbVolume.name},target=/var/lib/postgresql/data`,IMAGES.db]);
  // The entrypoint's temporary initialization server accepts Unix sockets but
  // deliberately has no TCP listener. Require final TCP readiness/health before
  // issuing any restoration SQL; a cold init must not race its shutdown.
  let ready=false;for(let i=0;i<90;i++){const c=await inspect(db),r=await docker(['exec',db.id,'pg_isready','-h','127.0.0.1','-U','supabase_admin','-d','postgres'],{allowFailure:true,timeout:5000});if(r.code===0&&c.State.Health?.Status==='healthy'){ready=true;break;}await delay(500);}assert(ready,'RECOVERY_DB_STARTUP_UNCONFIRMED');
  const identity=await value("select jsonb_build_object('system_identifier',(pg_control_system()).system_identifier::text,'user',current_user,'version',current_setting('server_version'));");assert.notEqual(identity.system_identifier,originalBefore.global_roles.system_identifier);assert.equal(identity.user,'supabase_admin');report.independent_cluster=identity;
  report.checkpoint='restore-roles-and-metadata';
  const roles=structuredClone(sourceReceipt.existing_global_roles_before);const extras=['eps_mcp_issuer_owner','eps_oauth_consent_owner','eps_job_trace_owner'];
  for(const[name,i]of extras.map((x,i)=>[x,i]))roles.roles.push({oid:'new'+i,name,login:false,superuser:false,inherit:false,bypassrls:false,create_db:false,create_role:false,replication:false,connection_limit:-1,valid_until:null});
  // Reconstruct the source's exact named membership set for the added roles.
  const sourceRoles=roles.roles;const oid=n=>{const r=sourceRoles.find(x=>x.name===n);assert(r);return r.oid;};
  for(const[k,v]of Object.entries(expectedCatalogue).filter(([k])=>k.startsWith('memberships|')&&k.endsWith('|admin'))){const match=/^memberships\|([^>]+)>([^/]+)\/([^|]+)\|admin$/u.exec(k);assert(match);if(!extras.includes(match[1])&&!extras.includes(match[2]))continue;const stem=k.slice(0,-5);roles.memberships.push({role_oid:oid(match[1]),member_oid:oid(match[2]),grantor_oid:oid(match[3]),admin:v,inherit:expectedCatalogue[stem+'inherit'],set:expectedCatalogue[stem+'set']});}
  await sql(roleBootstrapSql(roles));
  // The image's initialized postgres database contains unrelated pg_graphql DDL
  // event triggers. Restore into an empty template0 database instead; no trigger
  // or dump byte is changed to admit a restore over managed initial contents.
  const targetDatabase='eps_r38_'+runId.replaceAll('-','');assert(/^[a-z][a-z0-9_]+$/u.test(targetDatabase));
  await sql(`CREATE DATABASE ${targetDatabase} WITH OWNER postgres TEMPLATE template0;`);database=targetDatabase;
  const targetIdentity=await value("select jsonb_build_object('database',current_database(),'owner',(select datdba::regrole::text from pg_database where datname=current_database()),'system_identifier',(pg_control_system()).system_identifier::text);");assert.equal(targetIdentity.database,targetDatabase);assert.equal(targetIdentity.owner,'postgres');assert.equal(targetIdentity.system_identifier,identity.system_identifier);report.independent_cluster.restore_database=targetIdentity;
  await sql(metadata);
  const restoredRows=await value(dataSql36());assert.deepEqual(restoredRows,expectedRows);assert.equal(restoredRows['supabase_migrations.schema_migrations'].count,38);report.all_restored_table_data_exact=true;
  const catalogueSql=catalogueSqlReady,actualCatalogue=await value(catalogueSql);
  const expectedNorm=normalizeCatalogue(expectedCatalogue),actualNorm=normalizeCatalogue(actualCatalogue),keys=[...new Set([...Object.keys(expectedNorm),...Object.keys(actualNorm)])];
  const diffs=keys.filter(k=>JSON.stringify(expectedNorm[k])!==JSON.stringify(actualNorm[k]));
  await writeFile(path.join(privateRoot,'catalogue-differences.json'),JSON.stringify(diffs.map(key=>({key,expected:expectedNorm[key],actual:actualNorm[key]}))));
  assert.equal(diffs.length,0,'RECOVERY_CATALOGUE_MISMATCH');report.restored_catalogue_fields=keys.length;report.before_api_functions_owners_grants_rls_constraints_exact=true;
  report.checkpoint='restore-private-runtime-api-configuration';
  const authPrerequisite=await value("select jsonb_build_object('legacy_subject',position('request.jwt.claim.sub'in pg_get_functiondef('auth.uid()'::regprocedure))>0,'json_subject',position('request.jwt.claims'in pg_get_functiondef('auth.uid()'::regprocedure))>0,'runtime_schema_absent',not exists(select 1 from pg_namespace where nspname='recovery_http'));");assert.deepEqual(authPrerequisite,{legacy_subject:true,json_subject:false,runtime_schema_absent:true});
  await sql(LEGACY_CLAIM_BRIDGE_SQL);
  await sql(`BEGIN;SET LOCAL ROLE authenticated;DO $verify$ BEGIN
   PERFORM set_config('request.jwt.claims','{"role":"authenticated","sub":"${ACTOR}"}',true);PERFORM recovery_http.restore_claims();
   IF auth.uid() IS DISTINCT FROM '${ACTOR}'::uuid THEN RAISE EXCEPTION 'RECOVERY_SUBJECT_BRIDGE_FAILED';END IF;
   BEGIN PERFORM set_config('request.jwt.claims','{"role":"service_role","sub":"${ACTOR}"}',true);PERFORM recovery_http.restore_claims();RAISE EXCEPTION 'RECOVERY_ROLE_DRIFT_ACCEPTED';EXCEPTION WHEN SQLSTATE '28000' THEN NULL;END;
   BEGIN PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);PERFORM recovery_http.restore_claims();RAISE EXCEPTION 'RECOVERY_MISSING_SUBJECT_ACCEPTED';EXCEPTION WHEN SQLSTATE '28000' THEN NULL;END;
   END $verify$;ROLLBACK;
   BEGIN;SET LOCAL ROLE anon;DO $verify$ BEGIN PERFORM set_config('request.jwt.claim.sub','${ACTOR}',true);PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);PERFORM recovery_http.restore_claims();IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'RECOVERY_ANON_SUBJECT_RETAINED';END IF;END $verify$;ROLLBACK;`);
  report.synthetic_auth_runtime_adapter={source_auth_function_unchanged:true,security_definer:false,verified_claims_only:true,role_drift_and_missing_subject_denied:true,anonymous_subject_cleared:true,sql_sha256:sha(LEGACY_CLAIM_BRIDGE_SQL),restored_real_auth_configuration:false};
  await sql(`ALTER ROLE authenticator PASSWORD ${quote(password)};ALTER ROLE supabase_storage_admin PASSWORD ${quote(password)};`);
  const restEnv=path.join(privateRoot,'rest.env'),storageEnv=path.join(privateRoot,'storage.env');
  await writeFile(restEnv,`PGRST_DB_URI=postgresql://authenticator:${password}@${db.name}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${jwtSecret}\nPGRST_JWT_AUD=authenticated\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\nPGRST_DB_CONFIG=false\nPGRST_DB_PRE_REQUEST=recovery_http.restore_claims\n`,{flag:'wx'});
  const rest=await container('rest',['--env-file',restEnv,IMAGES.rest]);const restBase='http://'+rest.name+':3000';
  await writeFile(storageEnv,`AUTH_JWT_SECRET=${jwtSecret}\nDATABASE_URL=postgresql://supabase_storage_admin:${password}@${db.name}:5432/${database}\nDATABASE_POOL_URL=postgresql://supabase_storage_admin:${password}@${db.name}:5432/${database}\nSTORAGE_BACKEND=file\nSTORAGE_FILE_BACKEND_PATH=/var/lib/storage\nTENANT_ID=${runId}\nREGION=local\nGLOBAL_S3_BUCKET=${runId}\nUPLOAD_FILE_SIZE_LIMIT=10485760\nUPLOAD_FILE_SIZE_LIMIT_STANDARD=10485760\nLOG_LEVEL=error\nDB_INSTALL_ROLES=false\nDB_ALLOW_MIGRATION_REFRESH=false\nDB_MIGRATIONS_STRATEGY=on_request\nIMAGE_TRANSFORMATION_ENABLED=false\n`,{flag:'wx'});
  const storage=await container('storage',['--env-file',storageEnv,'--mount',`type=volume,source=${objectVolume.name},target=/var/lib/storage`,IMAGES.storage]);const storageBase='http://'+storage.name+':5000';httpContainer=storage;httpOrigins=[storageBase,restBase];await awaitHttp(restBase,'/');await awaitHttp(storageBase,'/status');report.http_transport={owned_internal_network:true,published_host_ports:false,credentials_in_command_arguments:false};
  report.checkpoint='restore-four-object-bytes-over-storage-http';
  const service=jwt('service_role'),auth=jwt('authenticated',ACTOR),other=jwt('authenticated','8a1a0000-0000-4000-8000-000000000099'),anonymous=jwt('anon');
  report.storage_http=[];
  for(const object of manifest.objects){const key=checkedObjectPath(object.bucket,object.object_key),bytes=await readFile(path.join(backupRoot,'backup',object.file));assert.equal(sha(bytes),object.sha256);const mime=object.object_key.endsWith('.pdf')?'application/pdf':object.object_key.endsWith('.json')?'application/json':'video/mp4';
   const upload=await http(storageBase,'/object/'+key,{method:'POST',token:service,body:bytes,headers:{'content-type':mime,'x-upsert':'true'}});assert.equal(upload.status,200,'RECOVERY_STORAGE_UPLOAD_FAILED');
   const read=await http(storageBase,'/object/authenticated/'+key,{token:service});assert.equal(read.status,200);assert.equal(read.bytes.length,object.size_bytes);assert.equal(sha(read.bytes),object.sha256);
   const denied=await http(storageBase,'/object/authenticated/'+key,{token:anonymous});assert(denied.status>=400);const publicDenied=await http(storageBase,'/object/public/'+key);assert(publicDenied.status>=400);
   report.storage_http.push({asset_id:object.asset_id,upload_status:upload.status,read_status:read.status,bytes:read.bytes.length,sha256:sha(read.bytes),anonymous_status:denied.status,public_status:publicDenied.status});
  }
  report.checkpoint='restored-api-fixed-version-and-authority';
  const scope=await value("select jsonb_build_object('version_id',(select id from eps.presentation_versions where status='ready'order by created_at limit 1),'export_id',(select id from eps.presentation_exports where status='ready'order by created_at limit 1),'video_id','8a9f0000-0000-4000-8000-000000000001');");
  const rpc=async(name,body,token)=>{const response=await http(restBase,'/rpc/'+name,{method:'POST',token,body:JSON.stringify(body),headers:{'content-type':'application/json'}});if(response.status>=400){await writeFile(path.join(privateRoot,name+'-response-private.json'),response.bytes);let code;try{const value=JSON.parse(response.bytes);if(typeof value.code==='string'&&/^[A-Z0-9_]{2,100}$/u.test(value.code))code=value.code;}catch{/* Non-JSON failures remain private. */}(report.api_denial_observations??=[]).push({operation:name,status:response.status,...(code?{code}:{})});}return response;};
  const video=await rpc('eps_get_version_asset',{p_version_id:scope.version_id,p_asset_id:scope.video_id,p_purpose:'video'},auth);assert.equal(video.status,200,'RECOVERY_API_VIDEO_READ_FAILED');const videoData=JSON.parse(video.bytes);assert.equal(videoData.asset.id,scope.video_id);verifyObjectReference(videoData,manifest.objects);
  const unauthorized=await rpc('eps_get_version_asset',{p_version_id:scope.version_id,p_asset_id:scope.video_id,p_purpose:'video'},other);assert(unauthorized.status>=400);
  const saved=await rpc('eps_get_version',{p_version_id:scope.version_id},auth);assert.equal(saved.status,200);const savedData=JSON.parse(saved.bytes);assert.equal(savedData.id,scope.version_id);assert.equal(savedData.status,'ready');
  const pdf=await rpc('eps_get_version_asset',{p_version_id:scope.version_id,p_asset_id:savedData.pdf_asset_id,p_purpose:'pdf'},auth);assert.equal(pdf.status,200);const pdfData=JSON.parse(pdf.bytes);verifyObjectReference(pdfData,manifest.objects);
  const exported=await rpc('eps_get_pdf_export_asset',{p_export_id:scope.export_id},auth);assert.equal(exported.status,200);const exportData=JSON.parse(exported.bytes);verifyObjectReference(exportData,manifest.objects);
  const deniedDirect=await http(restBase,'/media_assets?select=id&limit=1',{token:anonymous});assert(deniedDirect.status>=400);
  report.api={fixed_version_id:scope.version_id,video_asset_id:scope.video_id,pdf_asset_id:pdfData.asset.id,export_pdf_asset_id:exportData.asset.id,fixed_video_status:video.status,version_status:saved.status,fixed_pdf_status:pdf.status,pdf_export_status:exported.status,asset_references_match_restored_bytes:true,unauthorized_status:unauthorized.status,anonymous_private_table_status:deniedDirect.status};
  const after=await value(dataSql36());for(const[k,v]of Object.entries(expectedRows))if(!k.startsWith('storage.'))assert.deepEqual(after[k],v,'RECOVERY_NONSTORAGE_DATA_CHANGED');report.saved_versions_and_all_nonstorage_data_unchanged=true;
  const finalNorm=normalizeCatalogue(await value(catalogueSql)),finalKeys=[...new Set([...Object.keys(actualNorm),...Object.keys(finalNorm)])],schemaDelta=finalKeys.filter(k=>JSON.stringify(actualNorm[k])!==JSON.stringify(finalNorm[k]));
  await writeFile(path.join(privateRoot,'post-api-catalogue-differences.json'),JSON.stringify(schemaDelta.map(key=>({key,before:actualNorm[key],after:finalNorm[key]}))));
  assert(schemaDelta.every(k=>/^(?:functions|tables|columns|policies|constraints|indexes|triggers|types)\|storage\./u.test(k)||/^schemas\|storage\|/u.test(k)||/^default_acl\|supabase_storage_admin\/storage\//u.test(k)),'RECOVERY_API_CHANGED_NONSTORAGE_CATALOGUE');
  report.post_api_catalogue={nonstorage_catalogue_exact:true,storage_delta_field_count:schemaDelta.length,storage_delta_keys:schemaDelta};
  const reverified=await bundlePort.verifyRecoveryBundle(backupRoot,BACKUP_RUN,'backup');assert.deepEqual(reverified.manifest,manifest);report.source_backup_unchanged=true;for(const[file,hash]of Object.entries(controllerSeals))assert.equal(sha(await readFile(path.join(ROOT,file))),hash);report.controller_sources_unchanged=true;report.result='passed';report.checkpoint='complete';
 }catch(e){report.result='failed';report.failure_code=String(e.message).match(/^RECOVERY_[A-Z_]+$/u)?.[0]??'RECOVERY_ASSERTION_FAILED';if(privateReady)await writeFile(path.join(privateRoot,'failure-private.json'),JSON.stringify({message:e.message,stack:e.stack,diagnostic:e.diagnostic}));}
 finally{
  try{for(const r of resources.slice().reverse().filter(x=>x.type==='container')){await inspect(r);await docker(['container','stop','--time','10',r.id]);await inspect(r);await docker(['container','rm',r.id]);assert.notEqual((await docker(['container','inspect',r.id],{allowFailure:true})).code,0);}
   for(const r of resources.slice().reverse().filter(x=>x.type!=='container')){await inspect(r);await docker([r.type,'rm',r.id]);assert.notEqual((await docker([r.type,'inspect',r.id],{allowFailure:true})).code,0);}
   report.all_owned_resources_absent=true;
   if(originalBefore){assert.deepEqual(await baseline(),originalBefore);report.original_database_unchanged=true;report.original_catalogue_and_role_oids_attributes_memberships_unchanged=true;}
   if(lock&&originalBefore&&report.original_database_unchanged){assert.deepEqual(JSON.parse(await readFile(lockPath)),lock);await unlink(lockPath);report.original_shared_lock_released=true;}
  }catch(e){report.result='failed';report.cleanup_unconfirmed=true;if(privateReady)await writeFile(path.join(privateRoot,'cleanup-failure-private.json'),JSON.stringify({message:e.message,stack:e.stack,diagnostic:e.diagnostic}));}
  report.finished_at=new Date().toISOString();report.elapsed_ms=Date.now()-started;
  const evidence=path.join(ROOT,'tracking/evidence/m07/independent-recovery38');await mkdir(evidence,{recursive:true});const receipt=path.join(evidence,report.started_at.replaceAll(':','-')+'-'+runId.slice(0,8)+'.json');await writeFile(receipt,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({result:report.result,checkpoint:report.checkpoint,receipt:path.relative(ROOT,receipt).replaceAll('\\','/'),cleanup:report.all_owned_resources_absent===true,original_unchanged:report.original_database_unchanged===true})+'\n');
 }
 return report;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const [action,sourceRoot,...extra]=process.argv.slice(2);if(action!=='execute'||!sourceRoot||extra.length)throw Error('RECOVERY_USAGE');run(sourceRoot).then(r=>{if(r.result!=='passed')process.exitCode=1;}).catch(()=>{process.stderr.write('RECOVERY_INITIALIZATION_UNCONFIRMED\n');process.exitCode=1;});}
