import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export const ratingKeys = ['smash','control','repulsion','comfort','durability','satisfaction'];
const text = (v, label, required = false, max = 200) => { if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new InputError(`${label}格式不正確${required ? '，請填寫此欄位' : ''}`); return v.trim(); };
function number(v, label, min, max, nullable = false, integer = false) { if (nullable && (v === null || v === '')) return null; if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) throw new InputError(`${label}必須是 ${min}–${max}${integer ? ' 的整數' : ' 之間的數字'}`); return v; }
function boolean(v, label) { if (typeof v !== 'boolean') throw new InputError(`${label}格式不正確`); return v; }
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function validateRacket(v) { return {brand:text(v.brand,'品牌',true),model:text(v.model,'型號',true),weight:text(v.weight,'重量規格'),grip:text(v.grip,'握把規格'),notes:text(v.notes,'備註',false,5000),active:boolean(v.active,'使用狀態')}; }
export function validateRecord(v) {
  const date = text(v.date,'穿線日期',true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date > today() || date < '1900-01-01') throw new InputError('請輸入有效的穿線日期，不能晚於今天');
  const r = {racketId:text(v.racketId,'球拍',true),date,stringBrand:text(v.stringBrand,'球線品牌',true),stringModel:text(v.stringModel,'球線型號',true),mainTension:number(v.mainTension,'主線磅數',1,50),crossTension:number(v.crossTension,'橫線磅數',1,50),mismatch:boolean(v.mismatch,'錯磅'),shop:text(v.shop,'店家'),price:number(v.price,'價格',0,1000000,true),notes:text(v.notes,'穿線備註',false,5000),review:text(v.review,'心得備註',false,5000)};
  for (const key of ratingKeys) r[key] = number(v[key], '心得評分', 1, 10, true, true);
  return r;
}
export class Repository {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS rackets (id TEXT PRIMARY KEY, brand TEXT NOT NULL, model TEXT NOT NULL, weight TEXT NOT NULL, grip TEXT NOT NULL, notes TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)), createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, racketId TEXT NOT NULL REFERENCES rackets(id) ON DELETE CASCADE, date TEXT NOT NULL, stringBrand TEXT NOT NULL, stringModel TEXT NOT NULL, mainTension REAL NOT NULL CHECK(mainTension BETWEEN 1 AND 50), crossTension REAL NOT NULL CHECK(crossTension BETWEEN 1 AND 50), mismatch INTEGER NOT NULL CHECK(mismatch IN (0,1)), shop TEXT NOT NULL, price REAL, notes TEXT NOT NULL, review TEXT NOT NULL, smash INTEGER, control INTEGER, repulsion INTEGER, comfort INTEGER, durability INTEGER, satisfaction INTEGER, createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_racket_date ON records(racketId, date DESC); PRAGMA user_version = 1;`);
  }
  all() { return {schemaVersion:1,rackets:this.db.prepare('SELECT * FROM rackets ORDER BY createdAt, id').all().map(r=>({...r,active:!!r.active})),records:this.db.prepare('SELECT * FROM records ORDER BY date DESC, createdAt DESC, rowid DESC').all().map(r=>({...r,mismatch:!!r.mismatch}))}; }
  save(kind, input, id) {
    const table = kind === 'rackets' ? 'rackets' : 'records';
    const row = table === 'rackets' ? validateRacket(input) : validateRecord(input);
    if (table === 'records' && !this.db.prepare('SELECT id FROM rackets WHERE id=?').get(row.racketId)) throw new InputError('找不到球拍，請重新整理',404);
    if (id && !this.db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id)) throw new InputError('紀錄已不存在，請重新整理',404);
    const keys = Object.keys(row); const vals = Object.values(row).map(x=> typeof x === 'boolean' ? Number(x) : x);
    if (id) this.db.prepare(`UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...vals,id);
    else { id=randomUUID(); this.db.prepare(`INSERT INTO ${table} (id,${keys.join(',')},createdAt) VALUES (${Array(keys.length+2).fill('?').join(',')})`).run(id,...vals,new Date().toISOString()); }
    return {id};
  }
  delete(kind,id) { const table=kind==='rackets'?'rackets':'records'; if (!this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id).changes) throw new InputError('紀錄已不存在',404); }
  close() { this.db.close(); }
}
