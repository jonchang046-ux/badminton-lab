// Real Supabase security test. Reads credentials from stdin, never writes them to disk.
// Input: {"a":{"email":"...","password":"..."},"b":{"email":"...","password":"..."}}
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Cloud} from '../public/cloud.js';
import {createInterface} from 'node:readline';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const rl=createInterface({input:process.stdin,terminal:false});
console.log('Ready for two TEST accounts JSON on stdin. Passwords/tokens will not be printed.');
let input;for await(const line of rl){if(line.trim()){input=JSON.parse(line);break;}}rl.close();
if(!input?.a?.email||!input?.b?.email)throw new Error('需要兩個不同的已驗證測試帳號');
const a=new Cloud(undefined,memory()),b=new Cloud(undefined,memory()),anon=new Cloud(undefined,memory());
const checks=[];const pass=name=>{checks.push(name);console.log('PASS '+name);};
const aId=randomUUID(),bId=randomUUID(),recordId=randomUUID();
const brand=`RLS-${aId}-brand`,aModel=`RLS-${aId}-model`,bModel=`RLS-${bId}-model`,line=`RLS-${recordId}-line`;
let aCreated=false,bCreated=false;
try {
 await a.signIn(input.a.email,input.a.password);await b.signIn(input.b.email,input.b.password);
 assert.notEqual(a.session.user.id,b.session.user.id,'A/B 必須是不同帳號');pass('不同 Auth 使用者');
 const body={id:aId,brand,model:aModel,weight:'',grip:'',notes:'test-only fixture',active:true};
 await a.request('badminton_rackets','POST',body);aCreated=true;
 await b.request('badminton_rackets','POST',{...body,id:bId,model:bModel});bCreated=true;
 await a.request('badminton_stringing_records','POST',{id:recordId,racket_id:aId,date:'2026-01-01',string_brand:brand,string_model:line,main_tension:25,cross_tension:27,mismatch:false});pass('A/B 可建立自己的資料');
 for(const [table,id] of [['badminton_rackets',aId],['badminton_stringing_records',recordId]]){
  assert.deepEqual(await b.request(`${table}?id=eq.${id}&select=*`),[]);pass(`B 不能讀 A ${table}`);
  assert.deepEqual(await b.request(`${table}?id=eq.${id}`,'PATCH',{notes:'B attack'},{Prefer:'return=representation'}),[]);pass(`B 不能修改 A ${table}`);
  assert.deepEqual(await b.request(`${table}?id=eq.${id}`,'DELETE',undefined,{Prefer:'return=representation'}),[]);pass(`B 不能刪 A ${table}`);
  const own=await a.request(`${table}?id=eq.${id}&select=*`);assert.equal(own.length,1);assert.notEqual(own[0].notes,'B attack');
 }
 assert(!(await b.snapshot()).rackets.some(r=>r.id===aId));pass('B 的 snapshot 不包含 A');
 const profilePath=`badminton_profiles?user_id=eq.${a.session.user.id}`;
 const originalProfile=await a.request(profilePath+'&select=*');assert.equal(originalProfile.length,1);
 assert.deepEqual(await b.request(profilePath+'&select=*'),[]);
 assert.deepEqual(await b.request(profilePath,'PATCH',{display_name:'B attack'},{Prefer:'return=representation'}),[]);
 assert.deepEqual(await b.request(profilePath,'DELETE',undefined,{Prefer:'return=representation'}),[]);
 assert.deepEqual(await a.request(profilePath+'&select=*'),originalProfile);pass('B 無法讀取、修改或刪除 A profile');
 for(const table of ['badminton_profiles','badminton_rackets','badminton_stringing_records','badminton_user_options','badminton_import_runs']){
  await assert.rejects(()=>anon.raw(`/rest/v1/${table}?select=*`),e=>[401,403].includes(e.status));pass(`未登入無法讀 ${table}`);
 }
 await assert.rejects(()=>anon.raw('/rest/v1/rpc/badminton_snapshot',{method:'POST',body:{}}),e=>[401,403].includes(e.status));pass('未登入無法呼叫 snapshot');
 await assert.rejects(()=>b.request('badminton_rackets','POST',{...body,id:randomUUID(),user_id:a.session.user.id}),e=>[401,403].includes(e.status));pass('不能冒用 A user_id 新增球拍');
 await assert.rejects(()=>b.request('badminton_stringing_records','POST',{racket_id:aId,date:'2026-01-01',string_brand:brand,string_model:'B attack',main_tension:25,cross_tension:27}),e=>e.code==='23503');pass('複合外鍵阻擋跨帳號球拍關聯');
 const audit=await a.request('rpc/badminton_security_status','POST',{});assert.equal(audit.length,5);for(const row of audit){assert.equal(row.rls_enabled,true);assert.equal(row.anon_can_select,false);assert.equal(row.anon_can_insert,false);}pass('實際資料庫五張表啟用 RLS 且 anon 權限撤銷');
 console.log(JSON.stringify({status:'passed',checks:checks.length,checkedAt:new Date().toISOString()},null,2));
} finally {
 // Remove only the UUIDs created by this test, never existing equipment.
 if(aCreated)await a.request(`badminton_rackets?id=eq.${aId}`,'DELETE').catch(()=>console.error('A 測試資料清理失敗，請按 UUID 手動檢查'));
 if(bCreated)await b.request(`badminton_rackets?id=eq.${bId}`,'DELETE').catch(()=>console.error('B 測試資料清理失敗，請按 UUID 手動檢查'));
 for(const [client,created,values] of [[a,aCreated,[brand,aModel,line]],[b,bCreated,[brand,bModel]]])if(created)await client.request(`badminton_user_options?value=in.(${values.join(',')})`,'DELETE').catch(()=>console.error('測試專屬選項清理失敗，請按 RLS UUID 手動檢查'));
 await Promise.allSettled([a.signOut(),b.signOut()]);
}
