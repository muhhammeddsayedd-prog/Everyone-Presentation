import assert from 'node:assert/strict';
import test from 'node:test';
import {resourceName,assertOwnedResource,checkedObjectPath,normalizeCatalogue,roleBootstrapSql} from './guards.mjs';
const run='12345678-1234-4234-8234-123456789abc';
test('resource identity requires exact run, purpose, workspace and immutable ID',()=>{
 const resource={Id:'abc',Name:resourceName(run,'db'),Labels:{'eps.recovery.run':run,'eps.recovery.workspace':'D:/project','eps.recovery.purpose':'independent38'}};
 assertOwnedResource(resource,{id:'abc',name:resourceName(run,'db'),run,workspace:'D:/project'});
 for(const mutation of [{Id:'other'},{Name:'unrelated'},{Labels:{...resource.Labels,'eps.recovery.run':'other'}}]) assert.throws(()=>assertOwnedResource({...resource,...mutation},{id:'abc',name:resourceName(run,'db'),run,workspace:'D:/project'}));
});
test('resource names and object paths reject traversal and arbitrary resources',()=>{
 assert.equal(resourceName(run,'storage'), 'eps-r38-12345678123442348234123456789abc-storage');
 for(const x of ['../x','db; rm','', 'db/other'])assert.throws(()=>resourceName(run,x));
 assert.equal(checkedObjectPath('eps-candidate-assets','jobs/abc/source.mp4'),'eps-candidate-assets/jobs/abc/source.mp4');
 for(const x of ['../outside','jobs/../outside','a//b','/root','a?token=secret','a\\b'])assert.throws(()=>checkedObjectPath('eps-candidate-assets',x));
});
test('catalogue normalization sorts ACL entries without waiving privileges',()=>{
 const a={'tables|eps.jobs|acl':'{z=r/postgres,a=rw/postgres}','tables|eps.jobs|rls':true};
 assert.deepEqual(normalizeCatalogue(a),normalizeCatalogue({...a,'tables|eps.jobs|acl':'{a=rw/postgres,z=r/postgres}'}));
 assert.notDeepEqual(normalizeCatalogue(a),normalizeCatalogue({...a,'tables|eps.jobs|acl':'{a=r/postgres,z=r/postgres}'}));
});
test('role bootstrap admits only safe names and restores explicit membership flags',()=>{
 const r={roles:[{oid:'1',name:'postgres',login:true,superuser:false,inherit:true,bypassrls:false,create_db:true,create_role:true,replication:true,connection_limit:-1,valid_until:null},{oid:'2',name:'eps_owner',login:false,superuser:false,inherit:false,bypassrls:false,create_db:false,create_role:false,replication:false,connection_limit:-1,valid_until:null}],memberships:[{role_oid:'2',member_oid:'1',grantor_oid:'1',admin:false,inherit:true,set:false}]};
 const sql=roleBootstrapSql(r);assert(sql.includes('WITH ADMIN FALSE, INHERIT TRUE, SET FALSE GRANTED BY "postgres"'));assert(!sql.includes('VALID UNTIL'),'source NULL validity remains NULL on newly initialized roles');
 assert.throws(()=>roleBootstrapSql({...r,roles:[{...r.roles[0],name:'x;drop role y'}]}));
 assert.throws(()=>roleBootstrapSql({...r,memberships:[{...r.memberships[0],member_oid:'999'}]}));
});
test('role bootstrap grants grantor administration before dependent delegated grants',()=>{
 const attrs={login:false,superuser:false,inherit:false,bypassrls:false,create_db:false,create_role:false,replication:false,connection_limit:-1,valid_until:null};
 const s={roles:[{...attrs,name:'supabase_admin',oid:'1'},{...attrs,name:'postgres',oid:'2'},{...attrs,name:'eps_owner',oid:'3'}],memberships:[{role_oid:'3',member_oid:'2',grantor_oid:'2',admin:false,inherit:true,set:true},{role_oid:'3',member_oid:'2',grantor_oid:'1',admin:true,inherit:false,set:false}]};
 const sql=roleBootstrapSql(s);assert(sql.indexOf('ADMIN TRUE')<sql.indexOf('ADMIN FALSE'));
});
