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
