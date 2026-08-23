const CACHE='sirro-v035';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./logo-region-olancho.png','./viza-logo.svg','./sirro-core.js','./followup.js','./reportes.js','./pendientes.js','./admin-pruebas.js'];

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

function ensureModuleScripts(html){
  const scripts=[];
  if(!html.includes('sirro-core.js'))scripts.push('<script src="./sirro-core.js"></script>');
  if(!html.includes('reportes.js'))scripts.push('<script src="./reportes.js"></script>');
  if(!html.includes('pendientes.js'))scripts.push('<script src="./pendientes.js"></script>');
  if(!html.includes('admin-pruebas.js'))scripts.push('<script src="./admin-pruebas.js"></script>');
  if(!scripts.length)return html;
  return html.replace('</body>',scripts.join('\n')+'\n</body>');
}

async function navigationResponse(request){
  try{
    const r=await fetch(request,{cache:'no-store'});
    if(!r.ok)return r;
    const type=r.headers.get('content-type')||'';
    if(!type.includes('text/html'))return r;
    const html=ensureModuleScripts(await r.text());
    const out=new Response(html,{status:r.status,statusText:r.statusText,headers:r.headers});
    caches.open(CACHE).then(c=>c.put(request,out.clone()));
    return out;
  }catch{
    const cached=await caches.match(request)||await caches.match('./index.html');
    if(!cached)return new Response('SIRRO no disponible sin conexión.',{status:503});
    const type=cached.headers.get('content-type')||'';
    if(!type.includes('text/html'))return cached;
    const html=ensureModuleScripts(await cached.text());
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
