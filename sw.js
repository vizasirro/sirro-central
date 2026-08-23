const CACHE='sirro-v033';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./logo-region-olancho.png','./viza-logo.svg','./followup.js','./reportes.js','./pendientes.js','./admin-pruebas.js'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});

async function navigationResponse(request){
  try{
    const r=await fetch(request,{cache:'no-store'});
    if(!r.ok)return r;
    const type=r.headers.get('content-type')||'';
    if(!type.includes('text/html'))return r;
    let html=await r.text();
    if(!html.includes('admin-pruebas.js'))html=html.replace('</body>','<script src="./admin-pruebas.js"></script>\n</body>');
    const out=new Response(html,{status:r.status,statusText:r.statusText,headers:r.headers});
    caches.open(CACHE).then(c=>c.put(request,out.clone()));
    return out;
  }catch{
    const cached=await caches.match(request)||await caches.match('./index.html');
    if(!cached)return new Response('SIRRO no disponible sin conexión.',{status:503});
    const type=cached.headers.get('content-type')||'';
    if(!type.includes('text/html'))return cached;
    let html=await cached.text();
    if(!html.includes('admin-pruebas.js'))html=html.replace('</body>','<script src="./admin-pruebas.js"></script>\n</body>');
    return new Response(html,{status:cached.status,statusText:cached.statusText,headers:cached.headers});
  }
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const isNavigation=e.request.mode==='navigate'||u.pathname.endsWith('/index.html')||u.pathname==='/';
  if(isNavigation){
    e.respondWith(navigationResponse(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;})
      .catch(()=>caches.match(e.request))
  );
});
