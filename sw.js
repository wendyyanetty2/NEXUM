/**
 * NEXUM v3.0 — Service Worker (PWA)
 * v3.9.0 — HTML de módulos siempre desde red, JS versionado
 */

const CACHE_VERSION = 'nexum-v3.9.0';

// Solo cachear recursos que NO cambian frecuentemente (sin HTML de módulos)
const RECURSOS_ESTATICOS = [
  '/',
  '/login.html',
  '/selector.html',
  '/dashboard.html',
  '/cambiar-password.html',
  '/css/main.css',
  '/css/auth.css',
  '/css/dashboard.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/tema.js',
  '/js/layout.js',
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

// Fetch: network-first para todo
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Siempre ir a red para Supabase
  if (url.includes('supabase.co')) return;

  // Los archivos HTML de módulos SIEMPRE van a la red (nunca desde caché)
  if (url.includes('/modules/') && url.includes('.html')) return;

  // JS con parámetros de versión van siempre a la red
  if (url.includes('?v=') || url.includes('?t=')) return;

  event.respondWith(
    fetch(event.request)
      .then(resp => {
        // No cachear respuestas HTML (siempre deben estar frescas)
        const isHtml = resp.headers.get('content-type')?.includes('text/html');
        if (resp && resp.status === 200 && event.request.method === 'GET' && !isHtml) {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
