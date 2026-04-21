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
