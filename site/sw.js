// Catalog files are versioned (?v=...) so they can be cached for good; everything else is network-first.
const C="sof-v27";
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys()) if(k!==C) await caches.delete(k); await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET'||u.pathname.includes('/models/'))return; // AI models: the model library keeps its own cache
  if(u.pathname.includes('/data/')&&u.searchParams.has('v')){
    e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(e.request); if(hit) return hit;
      const r=await fetch(e.request); if(r.ok){ // drop older versions of the same file
        for(const k of await c.keys()){const ku=new URL(k.url); if(ku.pathname===u.pathname) await c.delete(k);} c.put(e.request,r.clone()); } return r;}));
    return;
  }
  if(u.pathname.endsWith('version.json'))return;
  // always ask GitHub whether there's a newer copy (cheap when nothing changed), so updates show on a normal reload
  e.respondWith(fetch(new Request(e.request,{cache:'no-cache'})).then(r=>{if(r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));}return r;}).catch(()=>caches.match(e.request)));
});
