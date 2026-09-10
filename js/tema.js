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
 * Densidad visual NEXUM — opción interna de UI (Normal 100% / Compacta 90% /
 * Muy compacta 80%). NO es el zoom del navegador: solo ajusta padding y
 * espaciado vía variables CSS. Se guarda en sessionStorage (no localStorage)
 * para que cada pestaña/sesión mantenga su propia preferencia sin afectar
 * a otras pestañas ni a otros usuarios.
 */
const NEXUM_DENSIDADES = ['normal', 'compacta', 'muy-compacta'];
const NEXUM_DENSIDAD_LABEL = {
  'normal':       { texto: '🔍 100%', title: 'Densidad visual: Normal (100%) — clic para cambiar' },
  'compacta':     { texto: '🔍 90%',  title: 'Densidad visual: Compacta (90%) — clic para cambiar' },
  'muy-compacta': { texto: '🔍 80%',  title: 'Densidad visual: Muy compacta (80%) — clic para cambiar' },
};

(function () {
  const densidad = sessionStorage.getItem('nexum_densidad') || 'normal';
  if (densidad !== 'normal') document.documentElement.setAttribute('data-densidad', densidad);
})();

function alternarDensidad() {
  const actual = document.documentElement.getAttribute('data-densidad') || 'normal';
  const idx    = (NEXUM_DENSIDADES.indexOf(actual) + 1) % NEXUM_DENSIDADES.length;
  const nuevo  = NEXUM_DENSIDADES[idx];
  if (nuevo === 'normal') document.documentElement.removeAttribute('data-densidad');
  else document.documentElement.setAttribute('data-densidad', nuevo);
  sessionStorage.setItem('nexum_densidad', nuevo);
  actualizarIconoDensidad();
}

function actualizarIconoDensidad() {
  const densidad = document.documentElement.getAttribute('data-densidad') || 'normal';
  const info = NEXUM_DENSIDAD_LABEL[densidad] || NEXUM_DENSIDAD_LABEL.normal;
  document.querySelectorAll('.btn-densidad').forEach(btn => {
    btn.textContent = info.texto;
    btn.title = info.title;
  });
}

document.addEventListener('DOMContentLoaded', actualizarIconoDensidad);
