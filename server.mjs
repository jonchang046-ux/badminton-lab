import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Repository, InputError } from './repository.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.BADMINTON_DATA_DIR || path.join(root,'data');
await mkdir(dataDir,{recursive:true});
const repo=new Repository(path.join(dataDir,'badminton.sqlite'));
const port=Number(process.env.PORT || 4173);
const lan=process.argv.includes('--lan');
const localIPs=Object.values(networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address);
const allowedHosts=new Set(['127.0.0.1','localhost',...(lan?localIPs:[])].map(host=>`${host}:${port}`));
const origin=`http://127.0.0.1:${port}`;
const assets={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js'};
const server=http.createServer(async(req,res)=>{
  const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
  try {
    if (!allowedHosts.has(req.headers.host)) return send(403,{error:'此連線位址未開放'});
    const url=new URL(req.url,origin);
    if(url.pathname.startsWith('/api/')) {
      if (req.method==='GET' && url.pathname==='/api/state') return send(200,repo.all());
      if (req.method==='GET' && url.pathname==='/api/export') {res.setHeader('Content-Disposition','attachment; filename="badminton-lab-backup.json"');return send(200,repo.all());}
      if (!['POST','PUT','DELETE'].includes(req.method)) return send(405,{error:'不支援的操作'});
      if (req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return send(403,{error:'不允許其他網站修改資料'});
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'需要 JSON 格式'});
      const match=url.pathname.match(/^\/api\/(rackets|records)(?:\/([a-f0-9-]{36}))?$/);
      if (!match) return send(404,{error:'找不到此操作'});
      const [,kind,id]=match;
      if ((req.method==='POST'&&id) || (req.method!=='POST'&&!id)) return send(400,{error:'操作路徑不正確'});
      if (req.method==='DELETE') {repo.delete(kind,id);return send(200,{ok:true});}
      let body='';for await (const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>100000) throw new InputError('資料太長',413);}
      let value;try {value=JSON.parse(body);} catch {throw new InputError('資料格式不正確');}
      if (!value || Array.isArray(value) || typeof value!=='object') throw new InputError('資料格式不正確');
      return send(req.method==='POST'?201:200,repo.save(kind,value,id));
    }
    if (req.method!=='GET' || !assets[url.pathname]) return send(404,{error:'找不到頁面'});
    const file=assets[url.pathname];const content=await readFile(path.join(root,'public',file));
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(content);
  } catch(err) {if (!(err instanceof InputError)) console.error(err);send(err.status||500,{error:err.status?err.message:'儲存或讀取失敗，請確認資料夾可寫入後重試。'});}
});
server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{console.log(`Badminton Lab running at ${origin}`);if(lan){console.log('區域網路模式已開啟：同網路的人可讀寫資料，僅在信任的私人網路使用。');for(const ip of localIPs)console.log(`手機連線：http://${ip}:${port}`);}});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`連接埠 ${port} 已被使用。請關閉先前的程式，或設定 PORT。`:err);repo.close();process.exit(1);});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{repo.close();process.exit(0);}));
