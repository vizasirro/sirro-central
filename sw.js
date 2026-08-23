const CACHE='sirro-v040';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./logo-region-olancho.png','./viza-logo.svg','./app-main.js','./sirro-core.js','./auth-security.js','./data-resilience.js','./pending-color-semantics.js','./followup.js','./reportes.js','./pendientes.js','./admin-pruebas.js'];

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

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const isNavigation=e.request.mode==='navigate'||u.pathname.endsWith('/index.html')||u.pathname==='/';
  if(isNavigation){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;})
        .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;})
      .catch(()=>caches.match(e.request))
  );
});
