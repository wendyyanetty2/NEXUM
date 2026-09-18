/**
 * NEXUM v3.0 — Gestión de tema oscuro/claro
 * Se aplica en todas las páginas antes del render para evitar parpadeo
 */

// ── Aplicar tema guardado inmediatamente (evita flash) ────────────
(function () {
  const tema = localStorage.getItem('nexum_tema') || 'claro';
  document.documentElement.setAttribute('data-tema', tema);
})();

// ── Alternar tema ─────────────────────────────────────────────────
function alternarTema() {
  const actual = document.documentElement.getAttribute('data-tema') || 'claro';
  const nuevo  = actual === 'claro' ? 'oscuro' : 'claro';
  document.documentElement.setAttribute('data-tema', nuevo);
  localStorage.setItem('nexum_tema', nuevo);
  actualizarIconoTema();
}

// ── Actualizar ícono del botón ────────────────────────────────────
function actualizarIconoTema() {
  const tema   = document.documentElement.getAttribute('data-tema') || 'claro';
  const botones = document.querySelectorAll('.btn-tema');
  botones.forEach(btn => {
    btn.textContent = tema === 'oscuro' ? '☀️' : '🌙';
    btn.title       = tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  });
}

// Inicializar ícono cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', actualizarIconoTema);

/**
 * Zoom visual NEXUM — botón 🔍 en el header. Aplica un zoom real (CSS
 * zoom) a un % elegido libremente por el usuario, guardado en
 * sessionStorage: cada pestaña/ventana mantiene su propio nivel, sin
 * afectar a otras pestañas del mismo link ni a otros usuarios.
 * Se aplica SOLO a .contenido-principal (encabezado + área de datos),
 * nunca a <html>/<body>: el sidebar usa position:fixed + 100vh, y hacer
 * zoom del documento completo desalinea los elementos fijos (overlays,
 * pie del sidebar duplicado visualmente) — bug reportado por Wendy,
 * 2026-09-18.
 */
function _nexumAplicarZoom(pct) {
  const el = document.querySelector('.contenido-principal');
  if (!el) return;
  el.style.zoom = pct === 100 ? '' : pct + '%';
}

document.addEventListener('DOMContentLoaded', () => {
  const pct = parseInt(sessionStorage.getItem('nexum_zoom'), 10) || 100;
  if (pct !== 100) _nexumAplicarZoom(pct);
});

function alternarDensidad() {
  const actual = parseInt(sessionStorage.getItem('nexum_zoom'), 10) || 100;
  const input = window.prompt('Zoom de esta ventana (50% – 200%):', actual);
  if (input === null) return;
  let pct = parseInt(input, 10);
  if (isNaN(pct)) return;
  pct = Math.min(200, Math.max(50, pct));
  _nexumAplicarZoom(pct);
  sessionStorage.setItem('nexum_zoom', String(pct));
  actualizarIconoDensidad();
}

function actualizarIconoDensidad() {
  const pct = parseInt(sessionStorage.getItem('nexum_zoom'), 10) || 100;
  document.querySelectorAll('.btn-densidad').forEach(btn => {
    btn.textContent = `🔍 ${pct}%`;
    btn.title = 'Zoom de esta ventana — clic para elegir % (solo afecta esta pestaña)';
  });
}

document.addEventListener('DOMContentLoaded', actualizarIconoDensidad);
