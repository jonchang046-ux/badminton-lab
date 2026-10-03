import {Cloud} from '/cloud.js';
const $=s=>document.querySelector(s);
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const noStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
let target;
const checks=[];
function pass(name){checks.push(name);const li=document.createElement('li');li.textContent='PASS · '+name;$('#checks').append(li);}
async function activeCloud(){const c=new Cloud();assert(c.session,'請先在 Badminton Lab 登入');await c.restore();return c;}
$('#capture').onclick=async()=>{
 try{
  const c=await activeCloud(),id=$('#fixture-id').value.trim();
  const data=await c.snapshot(),r=data.rackets.find(r=>r.id===id);
  assert(r?.brand==='Badminton Lab QA'&&r.notes.startsWith('QA '),'只能指定本次 QA 測試球拍');
  const records=data.records.filter(s=>s.racketId===id);
  assert(records.length>0&&records.every(s=>s.notes.startsWith('QA ')),'需要本次 QA 穿線紀錄');
  target={userId:c.session.user.id,racketId:id,recordIds:records.map(s=>s.id)};
  $('#target-status').textContent='A 目標已保存：1 支 QA 球拍、'+records.length+' 筆 QA 穿線。請在主 App 登出並登入另一個帳號 B；保留此頁。';
  $('#run-b').disabled=false;
 }catch(e){$('#target-status').textContent=e.message;}
};
$('#run-b').onclick=async()=>{
 $('#run-b').disabled=true;$('#checks').replaceChildren();checks.length=0;$('#report').value='';$('#test-status').textContent='驗證中…';
 let fixture;
 try{
  assert(target,'請先保存 A 目標');
  const b=await activeCloud();
  assert(b.session.user.id!==target.userId,'目前仍是 A；請先在主 App 登入不同的帳號 B');
  pass('A/B 是經 Auth 驗證的不同使用者');
  const empty=async(path,method='GET',body)=>{const rows=await b.request(path,method,body,{Prefer:'return=representation'});assert(Array.isArray(rows)&&rows.length===0,'跨帳號請求未被隔離：'+path.split('?')[0]+' '+method);};
  await empty('badminton_rackets?id=eq.'+target.racketId);pass('B 不能讀 A 球拍');
  await empty('badminton_rackets?id=eq.'+target.racketId,'PATCH',{notes:'QA B forbidden update'});pass('B 不能修改 A 球拍');
  await empty('badminton_rackets?id=eq.'+target.racketId,'DELETE');pass('B 不能刪除 A 球拍');
  for(const id of target.recordIds){
   await empty('badminton_stringing_records?id=eq.'+id);
   await empty('badminton_stringing_records?id=eq.'+id,'PATCH',{notes:'QA B forbidden update'});
   await empty('badminton_stringing_records?id=eq.'+id,'DELETE');
  }pass('B 不能讀取、修改或刪除 A 的所有 QA 穿線');
  for(const table of ['badminton_profiles','badminton_user_options','badminton_import_runs'])await empty(table+'?user_id=eq.'+target.userId);
  pass('profile、選項與匯入紀錄各自隔離');
  const snapshot=await b.snapshot();
  assert(!snapshot.rackets.some(r=>r.id===target.racketId)&&!snapshot.records.some(r=>target.recordIds.includes(r.id)),'B snapshot 含 A');
  pass('B 的 snapshot 不含 A');
  const reject=async(action,predicate,message)=>{let error;try{await action();}catch(e){error=e;}assert(error&&predicate(error),message);};
  const anon=new Cloud(undefined,noStorage);
  for(const table of ['badminton_profiles','badminton_rackets','badminton_stringing_records','badminton_user_options','badminton_import_runs'])await reject(()=>anon.raw('/rest/v1/'+table+'?select=*&limit=1'),e=>[401,403].includes(e.status)&&e.code==='42501','未登入者未被拒絕 '+table);
  for(const rpc of ['badminton_snapshot','badminton_security_status','badminton_import_v1'])await reject(()=>anon.raw('/rest/v1/rpc/'+rpc,{method:'POST',body:rpc==='badminton_import_v1'?{payload:{rackets:[],records:[]},source_hash:'0'.repeat(64)}:{}}),e=>[401,403].includes(e.status)&&e.code==='42501','未登入者未被拒絕 '+rpc);
  pass('未登入者無法讀五張表或執行三個 RPC');
  const racketId=crypto.randomUUID(),recordId=crypto.randomUUID();
  const body={id:racketId,brand:'Badminton Lab QA',model:'B 隔離驗證拍 '+racketId.slice(0,8),active:true,notes:'QA B 測試紀錄，完成驗證後移除。'};
  await b.request('badminton_rackets','POST',body);
  fixture={racketId,recordId,userId:b.session.user.id};
  await b.request('badminton_stringing_records','POST',{id:recordId,racket_id:racketId,date:'2026-10-03',string_brand:'測試線材 QA',string_model:'QA-B',main_tension:25,cross_tension:27,mismatch:false,notes:'QA B 穿線，完成驗證後移除。'});
  assert((await b.request('badminton_rackets?id=eq.'+racketId)).length===1,'B 無法讀取自己的球拍');
  assert((await b.request('badminton_stringing_records?id=eq.'+recordId)).length===1,'B 無法讀取自己的穿線');
  pass('B 可以建立與讀取自己的球拍／穿線');
  await reject(()=>b.request('badminton_rackets','POST',{...body,id:crypto.randomUUID(),user_id:target.userId}),e=>[401,403].includes(e.status)&&e.code==='42501','B 可以冒用 A 新增');
  await reject(()=>b.request('badminton_rackets?id=eq.'+racketId,'PATCH',{user_id:target.userId}),e=>[401,403].includes(e.status)&&e.code==='42501','B 可以改成 A 所有');
  pass('新增／修改不能冒用 A user_id');
  await reject(()=>b.request('badminton_stringing_records','POST',{racket_id:target.racketId,date:'2026-10-03',string_brand:'測試線材 QA',string_model:'QA-B',main_tension:25,cross_tension:27,mismatch:false}),e=>e.code==='23503','跨帳號球拍外鍵未阻擋');
  pass('複合外鍵阻擋 B 關聯 A 球拍');
  const flags=await b.request('rpc/badminton_security_status','POST',{});
  assert(flags.length===5&&flags.every(r=>r.rls_enabled&&!r.anon_can_select&&!r.anon_can_insert),'安全旗標不正確');
  pass('五張表 RLS 啟用且 anon 權限撤銷');
  $('#test-status').textContent='全部隔離測試通過；B 測試紀錄保留供確認，稍後僅清理指定 QA UUID。';
  $('#report').value=JSON.stringify({status:'passed',method:'real_Auth_sessions_in_browser',checks,checkedAt:new Date().toISOString(),aTarget:target,bFixture:fixture},null,2);
 }catch(e){
  $('#test-status').textContent='驗證未完成：'+e.message;
  $('#report').value=JSON.stringify({status:'failed',checks,message:e.message,aTarget:target,bFixture:fixture},null,2);
  $('#run-b').disabled=false;
 }
};

