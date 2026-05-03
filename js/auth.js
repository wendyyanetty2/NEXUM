/**
 * NEXUM v3.0 - Autenticación y sesión
 */

// ── Obtener sesión activa ──────────────────────────────────────────────────────
async function obtenerSesion() {
  const { data: { session } } = await _supabase.auth.getSession();
  return session;
}

// ── Obtener perfil del usuario actual ─────────────────────────────────────────
async function obtenerPerfil() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const { data, error } = await _supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', sesion.user.id)
    .single();

  if (error) return null;
  return data;
}

// ── Verificar si es super-admin ────────────────────────────────────────────────
async function esSuperAdmin() {
  const perfil = await obtenerPerfil();
  return perfil?.es_super_admin === true;
}

// ── Obtener empresa activa de la sesión ───────────────────────────────────────
function obtenerEmpresaActiva() {
  const datos = sessionStorage.getItem('nexum_empresa_activa');
  return datos ? JSON.parse(datos) : null;
}

// ── Guardar empresa activa en sesión ──────────────────────────────────────────
function guardarEmpresaActiva(empresa) {
  sessionStorage.setItem('nexum_empresa_activa', JSON.stringify(empresa));
  sessionStorage.removeItem('nexum_permisos');     // forzar recomputo de permisos
  sessionStorage.removeItem('nexum_mis_empresas'); // forzar recarga de empresas
}

// ── Cerrar sesión ─────────────────────────────────────────────────────────────
async function cerrarSesion() {
  sessionStorage.clear();
  await _supabase.auth.signOut();
  window.location.href = '/login.html';
}

// ── Proteger página (redirige al login si no hay sesión) ──────────────────────
async function protegerPagina() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    window.location.href = '/login.html';
    return null;
  }
  return sesion;
}

// ── Proteger página y requerir empresa activa ─────────────────────────────────
async function protegerPaginaConEmpresa() {
  const sesion = await protegerPagina();
  if (!sesion) return { sesion: null, empresa: null };

  const empresa = obtenerEmpresaActiva();
  if (!empresa) {
    window.location.href = '/selector.html';
    return { sesion, empresa: null };
  }
  return { sesion, empresa };
}

// ── Registrar acción en historial ─────────────────────────────────────────────
async function registrarHistorial(tabla, registroId, accion, datosAnteriores = null, datosNuevos = null) {
  const empresa = obtenerEmpresaActiva();
  const sesion = await obtenerSesion();
  if (!sesion) return;

  const perfil = await obtenerPerfil();

  await _supabase.from('historial_cambios').insert({
    empresa_id: empresa?.id || null,
    usuario_id: perfil?.id || null,
    tabla,
    registro_id: String(registroId),
    accion,
    datos_anteriores: datosAnteriores,
    datos_nuevos: datosNuevos
  });
}

// ══════════════════════════════════════════════════════════════
// NEXUM v3.0 — Sistema de permisos y control de acceso
// ══════════════════════════════════════════════════════════════

// Definición de módulos con permisos (OCR eliminado)
const NEXUM_PERMISOS_MODULOS = {
  dashboard:    { nombre: 'Dashboard',      icono: '🏠' },
  admin:        { nombre: 'Administración', icono: '⚙️' },
  catalogos:    { nombre: 'Catálogos',      icono: '🗂️' },
  tesoreria:    { nombre: 'Tesorería',      icono: '🏦' },
  conciliacion: { nombre: 'Conciliación',   icono: '🔗' },
  planilla:     { nombre: 'Planilla',       icono: '👥' },
  tributaria:   { nombre: 'Tributaria',     icono: '📋' },
  reportes:     { nombre: 'Reportes',       icono: '📊' },
  contabilidad: { nombre: 'Contabilidad',   icono: '📒' },
};

// Permisos por defecto según rol
function _permisosBaseDeRol(rol) {
  const ids = Object.keys(NEXUM_PERMISOS_MODULOS);
  const all  = (v, e, d) => Object.fromEntries(ids.map(id => [id, { ver: v, editar: e, eliminar: d }]));

  if (rol === 'SUPER_ADMIN') return all(true, true, true);

  const base = all(true, false, false);
  base.admin     = { ver: false, editar: false, eliminar: false };
  base.dashboard = { ver: true,  editar: false, eliminar: false };

  if (rol === 'CONTADOR') {
    ids.filter(k => k !== 'admin').forEach(k => {
      base[k].editar   = true;
      base[k].eliminar = true;
    });
  } else if (rol === 'ASISTENTE') {
    ids.filter(k => k !== 'admin').forEach(k => {
      base[k].editar = true;
    });
  }
  // CONSULTA: solo ver=true en todo excepto admin
  return base;
}

// Obtener permisos activos (desde sessionStorage o derivados del rol)
function obtenerPermisosActivos() {
  const stored = sessionStorage.getItem('nexum_permisos');
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  const empresa = obtenerEmpresaActiva();
  const rol     = empresa?.rol || 'CONSULTA';
  // Si la empresa tiene permisos granulares configurados, usarlos; si no, derivar del rol
  const modulos = empresa?.permisos_json || _permisosBaseDeRol(rol);
  const p       = { rol, modulos };
  sessionStorage.setItem('nexum_permisos', JSON.stringify(p));
  return p;
}

function guardarPermisos(permisos) {
  sessionStorage.setItem('nexum_permisos', JSON.stringify(permisos));
}

// Verificar permiso específico
function tienePermiso(moduloId, accion = 'ver') {
  const p = obtenerPermisosActivos();
  return p?.modulos?.[moduloId]?.[accion] === true;
}

function puedeEditar(moduloId)   { return tienePermiso(moduloId, 'editar'); }
function puedeEliminar(moduloId) { return tienePermiso(moduloId, 'eliminar'); }

function esAdminSistema() {
  const empresa = obtenerEmpresaActiva();
  return empresa?.rol === 'SUPER_ADMIN';
}

// Cargar todas las empresas accesibles por el usuario (con caché en sessionStorage)
async function cargarEmpresasDelUsuario() {
  const stored = sessionStorage.getItem('nexum_mis_empresas');
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }

  const perfil = await obtenerPerfil();
  if (!perfil) return [];

  let empresas = [];
  if (perfil.es_super_admin) {
    const { data } = await _supabase
      .from('empresas_operadoras')
      .select('*')
      .eq('activa', true)
      .order('nombre');
    empresas = (data || []).map(e => ({ ...e, rol: 'SUPER_ADMIN' }));
  } else {
    const { data } = await _supabase
      .from('usuarios_empresas')
      .select('rol, empresa_operadora_id, permisos_json, empresas_operadoras(*)')
      .eq('usuario_id', perfil.id)
      .eq('activo', true);
    empresas = (data || [])
      .filter(ue => ue.empresas_operadoras?.activa)
      .map(ue => ({ ...ue.empresas_operadoras, rol: ue.rol, permisos_json: ue.permisos_json || null }));
  }

  sessionStorage.setItem('nexum_mis_empresas', JSON.stringify(empresas));
  return empresas;
}
