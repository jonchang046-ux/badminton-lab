import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Repository,validateRecord,validateRacket,ratingKeys} from '../repository.mjs';
const racket={brand:'YONEX',model:'ASTROX 88 D PRO',weight:'4U',grip:'G5',notes:'測試',active:true};
const record={racketId:'test',date:'2026-01-01',stringBrand:'YONEX',stringModel:'EXBOLT 65',mainTension:25,crossTension:27,mismatch:true,shop:'測試店家',price:450,notes:'',review:'後場舒服，但防守略硬',...Object.fromEntries(ratingKeys.map(k=>[k,8]))};
test('球拍與穿線 CRUD、分開磅數、排序、重新開啟後保存、連動刪除',()=>{
 const file=path.join(mkdtempSync(path.join(tmpdir(),'badminton-test-')),'test.sqlite');let repo=new Repository(file);
 const a=repo.save('rackets',racket).id;const b=repo.save('rackets',{...racket,model:'備用拍'}).id;
 const first=repo.save('records',{...record,racketId:a}).id;
 const second=repo.save('records',{...record,racketId:a,date:'2026-02-01',mainTension:26,crossTension:28,price:null,smash:null}).id;
 repo.save('rackets',{...racket,active:false},a);repo.save('records',{...record,racketId:a,review:'編輯成功',mainTension:24},first);
 assert.equal(repo.all().records[0].id,second);assert.equal(repo.all().records[0].smash,null);
 assert.equal(repo.all().records[1].mainTension,24);assert.equal(repo.all().records[1].crossTension,27);
 repo.close();repo=new Repository(file);assert.equal(repo.all().rackets.find(r=>r.id===a).active,false);assert.equal(repo.all().records[1].review,'編輯成功');
 repo.delete('records',second);assert.equal(repo.all().records[0].id,first);
 repo.delete('rackets',a);assert.equal(repo.all().records.length,0);assert.equal(repo.all().rackets[0].id,b);
 assert.throws(()=>repo.save('records',{...record,racketId:a}),/找不到球拍/);assert.throws(()=>repo.delete('rackets',a),/已不存在/);repo.close();
});
test('拒絕錯誤日期、超出磅數、錯誤評分與負價格',()=>{
 for(const patch of [{date:'2026-02-30'},{date:'2999-01-01'},{mainTension:0},{crossTension:51},{smash:11},{comfort:1.5},{price:-1},{stringBrand:''},{mismatch:'true'},{control:'8'}])assert.throws(()=>validateRecord({...record,...patch}));
 assert.equal(validateRecord({...record,smash:null}).smash,null);assert.throws(()=>validateRacket({...racket,brand:' '}));
});
test('同日穿線排序穩定；備註不解讀成 SQL',()=>{const repo=new Repository(':memory:');const id=repo.save('rackets',{...racket,notes:"'); DROP TABLE rackets; --"}).id;const a=repo.save('records',{...record,racketId:id}).id;const b=repo.save('records',{...record,racketId:id}).id;assert.equal(repo.all().records[0].id,b);assert.equal(repo.all().records[1].id,a);assert.equal(repo.all().rackets.length,1);repo.close();});
