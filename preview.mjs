// V2 preview serves public assets only. It never opens SQLite or exposes V1 APIs.
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const projectRoot=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(projectRoot,'public');
const diagnostics=new Map([['__qa/index.html',path.join(projectRoot,'tools','browser-qa.html')],['__qa/browser-qa.js',path.join(projectRoot,'tools','browser-qa.js')]]);
const port=Number(process.env.BADMINTON_PORT||4197);
const allowed=new Set(['index.html','styles.css','app.js','cloud.js','config.js','data.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png']);
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{const url=new URL(req.url,`http://127.0.0.1:${port}`);const filename=url.pathname==='/'?'index.html':url.pathname.slice(1);if(req.method!=='GET'||(!allowed.has(filename)&&!diagnostics.has(filename))){res.writeHead(404);res.end('Not found');return;}try{const content=await readFile(diagnostics.get(filename)||path.join(root,filename));res.writeHead(200,{'Content-Type':`${types[path.extname(filename)]}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; worker-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});res.end(content);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Badminton Lab V2 preview http://127.0.0.1:${port}`));
