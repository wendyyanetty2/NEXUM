/**
 * NEXUM v3.0 — Service Worker (PWA)
 * Cachea recursos estáticos para uso offline básico
 */

const CACHE_VERSION = 'nexum-v3.0.0';
const RECURSOS_ESTATICOS = [
  '/',
  '/login.html',
  '/selector.html',
  '/dashboard.html',
  '/css/main.css',
  '/css/auth.css',
  '/css/dashboard.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/manifest.json'
];

// Instalación: pre-cachear recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(RECURSOS_ESTATICOS))
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

// Fetch: network-first para API, cache-first para estáticos
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Siempre ir a red para las llamadas a Supabase
  if (url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then(resp => {
        // Guardar en caché si es exitoso
        if (resp && resp.status === 200 && event.request.method === 'GET') {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
