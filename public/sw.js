// Cache only the public application shell. Never cache Supabase or user records.
const CACHE='badminton-lab-shell-v2-1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./cloud.js','./data.js','./config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('badminton-lab-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;e.respondWith(fetch(e.request).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return response;}).catch(()=>caches.match(e.request).then(result=>result||new Response('請連上網路再使用 Badminton Lab',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));});
