import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../app/api/internal/closer-contacts/route.js';
test('internal importer requires its server credential, limits dates and strips unrelated source fields',async()=>{
 process.env.CLOSER_SYNC_SECRET='test-internal-only';
 process.env.DISCORD_BOT_URL='https://source.example.test';
 process.env.DISCORD_CHANNEL_ID='allowed-channel';
 process.env.BOT_IMPORT_SECRET='test-source-only';
 let calls=[];
 mock.method(globalThis,'fetch',async(url,opts)=>{calls.push({url,opts});return Response.json({ok:true,contacts:[{phone:'8613800138000',product:'Demo',created_at:new Date().toISOString(),private_field:'omit me'}]});});
 try{
  const request=(suffix='',key)=>new Request('https://panel.example.test/api/internal/closer-contacts?days=30'+suffix,{headers:key?{'x-closer-sync':key}:{}});
  assert.equal((await GET(request())).status,401);
  assert.equal((await GET(request('','wrong'))).status,401);assert.equal(calls.length,0);
  const response=await GET(request('&since=2000-01-01&channelId=untrusted','test-internal-only'));
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.contacts[0].private_field,undefined);
  assert.equal(calls[0].url.searchParams.get('channelId'),'allowed-channel');
  assert.ok(Date.parse(calls[0].url.searchParams.get('since'))>=Date.now()-30*86400000-1000);
  assert.equal((await GET(new Request('https://panel.example.test/api/internal/closer-contacts?days=60',{headers:{'x-closer-sync':'test-internal-only'}}))).status,400);
  assert.equal(calls[0].opts.headers['x-import-secret'],'test-source-only');
  assert.equal((await GET(new Request('https://panel.example.test/api/internal/closer-contacts?days=400',{headers:{'x-closer-sync':'test-internal-only'}}))).status,400);
 }finally{mock.restoreAll();}
});
