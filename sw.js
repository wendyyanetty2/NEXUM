/**
 * NEXUM v3.0 — Service Worker (PWA)
 * Cachea recursos estáticos para uso offline básico
 */

const CACHE_VERSION = 'nexum-v3.2.0';
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
  // Módulos
  '/modules/admin/index.html',
  '/modules/admin/modules/admin-empresas.js',
  '/modules/admin/modules/admin-usuarios.js',
  '/modules/admin/modules/admin-asignaciones.js',
  '/modules/admin/modules/admin-catalogos.js',
  '/modules/catalogos/index.html',
  '/modules/catalogos/modules/cat-clientes.js',
  '/modules/catalogos/modules/cat-conceptos.js',
  '/modules/catalogos/modules/cat-autorizaciones.js',
  '/modules/catalogos/modules/cat-proyectos.js',
  '/modules/catalogos/modules/cat-mediospago.js',
  '/modules/catalogos/modules/cat-trabajadores.js',
  '/modules/tesoreria/index.html',
  '/modules/tesoreria/modules/tes-cuentas.js',
  '/modules/tesoreria/modules/tes-movimientos.js',
  '/modules/tesoreria/modules/tes-importar.js',
  '/modules/planilla/index.html',
  '/modules/planilla/modules/pla-periodos.js',
  '/modules/planilla/modules/pla-detalle.js',
  '/modules/tributaria/index.html',
  '/modules/tributaria/modules/tri-ventas.js',
  '/modules/tributaria/modules/tri-compras.js',
  '/modules/tributaria/modules/tri-resumen.js',
  '/modules/ocr/index.html',
  '/modules/reportes/index.html',
  '/modules/contabilidad/index.html',
  '/modules/contabilidad/modules/con-plan-cuentas.js',
  '/modules/contabilidad/modules/con-asientos.js',
  '/modules/contabilidad/modules/con-mayor.js',
  '/modules/contabilidad/modules/con-estados.js',
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
        if (resp && resp.status === 200 && event.request.method === 'GET') {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
