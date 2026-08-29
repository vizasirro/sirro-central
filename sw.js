const CACHE='sirro-v045';
const ASSETS=[
  './','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./logo-region-olancho.png','./viza-logo.svg',
  './app-main.js','./sirro-core.js','./startup-ready.js','./data-resilience.js','./pending-color-semantics.js',
  './followup.js','./observacion-obstetrica.js','./reportes.js','./pendientes.js','./admin-pruebas.js','./borrado-referencia-pruebas.js',
  './specialty-filter.js','./specialty-transfers.js','./specialty-selector-fix.js','./appointment-role.js','./ce-referral-hint.js',
  './hospital-profile.js','./gerencia-profile.js','./administrador-profile.js','./maternal-monitor.js','./maternal-monitor-style.js'
];

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

  if(sameOrigin&&u.pathname.endsWith('/admin-pruebas.js')){
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      let base;
      let fix;
      try{base=await fetch(e.request,{cache:'no-store'});if(base.ok)await cache.put(e.request,base.clone());}catch{base=await cache.match(e.request);}
      try{fix=await fetch('./specialty-selector-fix.js',{cache:'no-store'});if(fix.ok)await cache.put('./specialty-selector-fix.js',fix.clone());}catch{fix=await cache.match('./specialty-selector-fix.js');}
      if(!base)return new Response('',{status:503,headers:{'Content-Type':'application/javascript; charset=utf-8'}});
      const baseText=await base.text();
      const fixText=fix?await fix.text():'';
      return new Response(baseText+'\n'+fixText,{status:200,headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}});
    })());
    return;
  }

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