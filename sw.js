/**
 * NEXUM v3.0 — Service Worker (PWA)
 * v3.9.0 — HTML de módulos siempre desde red, JS versionado
 */

const CACHE_VERSION = 'nexum-v4.1.0';

// Solo cachear recursos que NO cambian frecuentemente (sin HTML de módulos, sin JS dinámico)
const RECURSOS_ESTATICOS = [
  '/css/main.css',
  '/css/auth.css',
  '/css/dashboard.css',
  '/manifest.json',
];

// Instalación: pre-cachear solo recursos base (bypass HTTP cache)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.all(RECURSOS_ESTATICOS.map(url =>
        cache.add(new Request(url, { cache: 'reload' }))
      ))
    )
  );
  self.skipWaiting();
});

// Activación: limpiar cachés anteriores
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first para todo — JS y HTML SIEMPRE desde red
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // API Supabase: sin interceptar
  if (url.includes('supabase.co')) return;

  // HTML y JS: SIEMPRE desde red, bypaseando caché HTTP del browser
  if (url.includes('.html') || url.includes('/modules/') || url.includes('/js/') || url.includes('.js')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  if (url.includes('?v=') || url.includes('?t=')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Solo cachear CSS y assets estáticos
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp && resp.status === 200 && event.request.method === 'GET') {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
