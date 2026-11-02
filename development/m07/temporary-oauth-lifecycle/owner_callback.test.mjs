import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIVE_ENABLED,ownerCallback,requestTarget } from './owner_callback.mjs';

test('live listener entry remains disabled before claims, callbacks, sockets or private access',async()=>{
 assert.equal(LIVE_ENABLED,false);let claims=0,codes=0;await assert.rejects(()=>ownerCallback({claim:async()=>{claims++;},onCode:async()=>{codes++;}}),/TEMP_OAUTH_OWNER_CALLBACK_REFUSED/u);assert.equal(claims,0);assert.equal(codes,0);
});
test('pure loopback request admission rejects foreign peers/hosts/origins and arbitrary paths',()=>{
 const valid={method:'GET',host:'localhost:3118',remoteAddress:'127.0.0.1',url:'/start'};assert.equal(requestTarget(valid).pathname,'/start');
 for(const change of[{method:'POST'},{host:'127.0.0.1:3118'},{host:'evil.example:3118'},{remoteAddress:'192.0.2.1'},{origin:'https://evil.example'},{url:'http://evil.example/callback'},{url:'/start?code=x'},{url:'/other'},{url:'/callback#fragment'}])assert.throws(()=>requestTarget({...valid,...change}),/TEMP_OAUTH_OWNER_CALLBACK_REFUSED/u);
});
