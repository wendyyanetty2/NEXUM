// ═══════════════════════════════════════════════════════════════
// NEXUM v3.0 — Layout compartido: sidebar, header, modal contraseña
// ═══════════════════════════════════════════════════════════════

const NEXUM_MODULOS = [
  { id: 'dashboard',    icono: '🏠', nombre: 'Dashboard',      href: '/dashboard.html' },
  { id: 'admin',        icono: '⚙️', nombre: 'Administración', href: '/modules/admin/index.html' },
  { id: 'catalogos',    icono: '🗂️', nombre: 'Catálogos',      href: '/modules/catalogos/index.html' },
  { id: 'tesoreria',    icono: '🏦', nombre: 'Tesorería',      href: '/modules/tesoreria/index.html' },
  { id: 'conciliacion', icono: '🔗', nombre: 'Conciliación',   href: '/modules/conciliacion/index.html' },
  { id: 'planilla',     icono: '👥', nombre: 'Planilla',       href: '/modules/planilla/index.html' },
  { id: 'tributaria',   icono: '📋', nombre: 'Tributaria',     href: '/modules/tributaria/index.html' },
  { id: 'reportes',     icono: '📊', nombre: 'Reportes',       href: '/modules/reportes/index.html' },
  { id: 'contabilidad', icono: '📒', nombre: 'Contabilidad',   href: '/modules/contabilidad/index.html' },
];

// ── Inicializa el módulo: auth + sidebar + header + modal ─────
async function inicializarModulo(moduloActual) {
  const { sesion, empresa } = await protegerPaginaConEmpresa();
  if (!sesion || !empresa) return null;

  const perfil = await obtenerPerfil();
  if (!perfil) { await cerrarSesion(); return null; }

  // Verificar permiso de acceso al módulo
  if (moduloActual !== 'dashboard' && !tienePermiso(moduloActual, 'ver')) {
    mostrarToast('No tienes permiso para acceder a este módulo.', 'error');
    setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
    return null;
  }

  // Cargar empresas del usuario (con caché)
  const misEmpresas = await cargarEmpresasDelUsuario();

  _renderSidebar(moduloActual, empresa);
  _renderHeader(perfil, empresa, misEmpresas);
  _renderModalPassword();

  return { perfil, empresa };
}

// ── Sidebar ───────────────────────────────────────────────────
function _renderSidebar(moduloActual, empresa) {
  const nav = NEXUM_MODULOS
    .filter(m => tienePermiso(m.id, 'ver'))
    .map(m => {
      const activo   = m.id === moduloActual ? 'activo' : '';
      const click    = m.href ? `onclick="window.location.href='${m.href}'"` : '';
      const pronto   = !m.href ? '<span class="badge-pronto">Pronto</span>' : '';
      const disabled = !m.href ? 'style="opacity:0.55;cursor:default"' : '';
      return `<a class="nav-item ${activo}" ${click} ${disabled}>
        <span class="icono">${m.icono}</span> ${m.nombre} ${pronto}
      </a>`;
    }).join('\n');

  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="nombre">NEXUM</div>
      <div class="claim">El vínculo que sustenta</div>
    </div>
    <div class="sidebar-empresa">
      <div class="label">Empresa activa</div>
      <div class="nombre-empresa">${escapar(empresa.nombre || '')}</div>
      <div class="ruc-empresa">RUC: ${escapar(empresa.ruc || '—')}</div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-seccion">Módulos</div>
      ${nav}
    </nav>
    <div class="sidebar-footer">
      <button class="btn-sidebar-accion" onclick="cambiarEmpresa()">🔄 Cambiar empresa</button>
      <button class="btn-sidebar-accion" onclick="layout_abrirPass()">🔑 Cambiar contraseña</button>
      <button class="btn-sidebar-accion peligro" onclick="layout_cerrarSesion()">🚪 Cerrar sesión</button>
    </div>`;

  if (empresa.color_primario)
    sidebar.style.background = empresa.color_primario;
}

// ── Header ────────────────────────────────────────────────────
function _renderHeader(perfil, empresa, misEmpresas) {
  const selectorHTML = misEmpresas.length > 1
    ? `<div class="sel-empresa-wrap" style="position:relative">
        <button onclick="toggleSelectorEmpresa(event)"
          style="display:flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--color-borde);border-radius:var(--radio);background:var(--color-bg-card);cursor:pointer;font-size:13px;color:var(--color-texto);max-width:200px">
          <span>🏢</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${escapar(empresa.nombre_corto || empresa.nombre)}</span>
          <span style="font-size:10px;flex-shrink:0">▾</span>
        </button>
        <div id="layout-dropdown-empresa" style="display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--color-bg-card);border:1px solid var(--color-borde);border-radius:var(--radio-lg);box-shadow:var(--sombra-md);min-width:260px;z-index:500;overflow:hidden">
          <div style="padding:8px 12px;font-size:11px;color:var(--color-texto-suave);border-bottom:1px solid var(--color-borde);text-transform:uppercase;letter-spacing:.5px">Mis empresas</div>
          ${misEmpresas.map(e => `
            <button onclick="cambiarEmpresaRapido(${JSON.stringify(e).replace(/"/g, '&quot;')})"
              style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border:none;background:${e.id === empresa.id ? 'var(--color-hover)' : 'none'};cursor:pointer;font-family:var(--font);font-size:13px;color:var(--color-texto);text-align:left;transition:background .15s">
              <div style="width:30px;height:30px;border-radius:50%;background:${e.color_primario||'#2C5282'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px;flex-shrink:0">${_iniciales(e.nombre)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapar(e.nombre_corto || e.nombre)}</div>
                <div style="font-size:11px;color:var(--color-texto-suave)">${escapar(e.rol)}</div>
              </div>
              ${e.id === empresa.id ? '<span style="color:var(--color-secundario);font-weight:700;flex-shrink:0">✓</span>' : ''}
            </button>
          `).join('')}
        </div>
      </div>`
    : `<div style="padding:4px 10px;font-size:12px;color:var(--color-texto-suave);border:1px solid var(--color-borde);border-radius:var(--radio);background:var(--color-bg-card);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">
        🏢 ${escapar(empresa.nombre_corto || empresa.nombre)}
      </div>`;

  const rolBadge = empresa.rol && empresa.rol !== 'SUPER_ADMIN'
    ? `<span style="font-size:10px;background:var(--color-hover);color:var(--color-texto-suave);padding:2px 7px;border-radius:10px;border:1px solid var(--color-borde)">${escapar(empresa.rol)}</span>`
    : '';

  document.getElementById('header-top').innerHTML = `
    <div class="header-izq">
      <button class="btn-menu-movil" onclick="abrirSidebar()">☰</button>
      <div class="breadcrumb" id="breadcrumb-main">NEXUM &rsaquo; <span id="breadcrumb-sub">—</span></div>
    </div>
    <div class="header-der" style="gap:8px">
      ${selectorHTML}
      ${rolBadge}
      <button class="btn-tema" onclick="alternarTema()" title="Cambiar tema">🌙</button>
      <div class="header-usuario">
        <div class="avatar">${perfil.nombre.charAt(0).toUpperCase()}</div>
        <span class="nombre-usuario">${escapar(perfil.nombre.split(' ')[0])}</span>
      </div>
    </div>`;
  actualizarIconoTema();
}

function _iniciales(nombre) {
  return (nombre || '').split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
}

let _dropdownClickHandler = null;
function toggleSelectorEmpresa(e) {
  e && e.stopPropagation();
  const dd = document.getElementById('layout-dropdown-empresa');
  if (!dd) return;
  const visible = dd.style.display !== 'none';
  dd.style.display = visible ? 'none' : 'block';
  if (!visible) {
    if (_dropdownClickHandler) document.removeEventListener('click', _dropdownClickHandler);
    _dropdownClickHandler = () => { dd.style.display = 'none'; };
    setTimeout(() => document.addEventListener('click', _dropdownClickHandler, { once: true }), 10);
  }
}

function cambiarEmpresaRapido(empresa) {
  guardarEmpresaActiva(empresa);
  window.location.reload();
}

// ── Modal contraseña ──────────────────────────────────────────
function _renderModalPassword() {
  const mc = document.getElementById('modal-container');
  if (!mc) return;
  mc.innerHTML = `
  <div class="modal-overlay" id="modal-layout-pass" style="display:none">
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h3>🔑 Cambiar contraseña</h3>
        <button class="modal-cerrar" onclick="layout_cerrarPass()">✕</button>
      </div>
      <div class="modal-body">
        <div id="alerta-layout-pass" class="alerta-error"></div>
        <div id="exito-layout-pass"  class="alerta-exito"></div>
        <div class="campo">
          <label>Nueva contraseña <span class="req">*</span></label>
          <input type="password" id="inp-layout-nueva" placeholder="Mínimo 8 caracteres">
        </div>
        <div class="campo">
          <label>Confirmar contraseña <span class="req">*</span></label>
          <input type="password" id="inp-layout-conf" placeholder="Repite la contraseña">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" onclick="layout_cerrarPass()">Cancelar</button>
        <button class="btn btn-primario" onclick="layout_guardarPass()" id="btn-layout-pass">Guardar</button>
      </div>
    </div>
  </div>`;
}

// ── Sidebar móvil ─────────────────────────────────────────────
function abrirSidebar() {
  document.getElementById('sidebar').classList.add('abierto');
  document.getElementById('sidebar-overlay').classList.add('visible');
}
function cerrarSidebar() {
  document.getElementById('sidebar').classList.remove('abierto');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

function setBreadcrumb(texto) {
  const el = document.getElementById('breadcrumb-sub');
  if (el) el.textContent = texto;
}

// ── Empresa / sesión ──────────────────────────────────────────
function cambiarEmpresa() {
  sessionStorage.removeItem('nexum_empresa_activa');
  sessionStorage.removeItem('nexum_permisos');
  sessionStorage.removeItem('nexum_mis_empresas');
  window.location.href = '/selector.html';
}

async function layout_cerrarSesion() {
  const ok = await confirmar('¿Seguro que deseas cerrar sesión?', { btnOk: 'Cerrar sesión' });
  if (ok) await cerrarSesion();
}

// ── Modal contraseña ──────────────────────────────────────────
function layout_abrirPass() {
  document.getElementById('modal-layout-pass').style.display = 'flex';
  document.getElementById('inp-layout-nueva').value = '';
  document.getElementById('inp-layout-conf').value  = '';
  document.getElementById('alerta-layout-pass').classList.remove('visible');
  document.getElementById('exito-layout-pass').classList.remove('visible');
}
function layout_cerrarPass() {
  document.getElementById('modal-layout-pass').style.display = 'none';
}
async function layout_guardarPass() {
  const nueva  = document.getElementById('inp-layout-nueva').value;
  const conf   = document.getElementById('inp-layout-conf').value;
  const alerta = document.getElementById('alerta-layout-pass');
  const exito  = document.getElementById('exito-layout-pass');
  const btn    = document.getElementById('btn-layout-pass');
  alerta.classList.remove('visible'); exito.classList.remove('visible');
  if (nueva.length < 8) { alerta.textContent = 'Mínimo 8 caracteres.'; alerta.classList.add('visible'); return; }
  if (nueva !== conf)   { alerta.textContent = 'Las contraseñas no coinciden.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const { error } = await _supabase.auth.updateUser({ password: nueva });
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = 'Error al cambiar contraseña.'; alerta.classList.add('visible'); }
  else { exito.textContent = '✓ Contraseña actualizada.'; exito.classList.add('visible'); setTimeout(layout_cerrarPass, 2000); }
}
