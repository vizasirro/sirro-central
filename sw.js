const CACHE='sirro-v041';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./logo-region-olancho.png','./viza-logo.svg','./app-main.js','./sirro-core.js','./auth-security.js','./data-resilience.js','./pending-color-semantics.js','./followup.js','./reportes.js','./pendientes.js','./admin-pruebas.js'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(a=>new Request(a,{cache:'reload'})))));
});

self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const sameOrigin=u.origin===self.location.origin;
  const isNavigation=e.request.mode==='navigate'||u.pathname.endsWith('/index.html')||u.pathname==='/';
  const isAppAsset=sameOrigin&&/\.(?:js|html|webmanifest)$/.test(u.pathname);

  if(isNavigation||isAppAsset){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;})
        .catch(()=>caches.match(e.request).then(r=>r||(isNavigation?caches.match('./index.html'):undefined)))
    );
    return;
  }

  e.respondWith(
    fetch(e.request,{cache:'no-store'})
      .then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;})
      .catch(()=>caches.match(e.request))
  );
});
