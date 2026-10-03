// Read-only export. Does not start the old server or change the SQLite file.
import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const db=new DatabaseSync(path.join(root,'data','badminton.sqlite'),{readOnly:true});
const rackets=db.prepare('select * from rackets order by createdAt,id').all().map(r=>({...r,active:!!r.active}));
const records=db.prepare('select * from records order by date desc,createdAt desc,rowid desc').all().map(r=>({...r,mismatch:!!r.mismatch}));
db.close();const folder=path.join(root,'private-backups');await mkdir(folder,{recursive:true});
const filename=path.join(folder,`badminton-lab-v1-${new Date().toISOString().replaceAll(':','-')}.json`);
await writeFile(filename,JSON.stringify({schemaVersion:1,rackets,records},null,2),{flag:'wx'});
console.log(`Exported ${rackets.length} rackets / ${records.length} records to ${filename}`);
