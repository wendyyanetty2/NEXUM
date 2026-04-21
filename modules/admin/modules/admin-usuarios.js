/**
 * NEXUM v3.0 — Admin: CRUD Usuarios Globales
 */

let usuarios_lista = [];
let usuario_editando = null;
let usuarios_pagina = 1;
const USUARIOS_POR_PAGINA = 10;

async function renderTabUsuarios(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="filtros-barra">
        <input type="text" class="buscador" id="buscar-usuario"
               placeholder="🔍 Buscar por nombre, email o DNI…" oninput="filtrarUsuarios()">
        <select id="filtro-estado-usuario" onchange="filtrarUsuarios()">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <button class="btn btn-secundario btn-sm" onclick="exportarUsuariosExcel()">⬇️ Exportar Excel</button>
        <button class="btn btn-primario btn-sm"   onclick="abrirModalUsuario(null)"
                ${!perfil_usuario?.es_super_admin ? 'style="display:none"' : ''}>
          + Nuevo usuario
        </button>
      </div>

      <div class="tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>DNI</th>
              <th>Teléfono</th>
              <th>Rol sistema</th>
              <th>Estado</th>
              <th>Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tbody-usuarios">
            <tr><td colspan="7"><div class="cargando"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
        <div class="paginacion" id="pag-usuarios"></div>
      </div>
    </div>

    <!-- Modal usuario -->
    <div class="modal-overlay" id="modal-usuario" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h3 id="modal-usuario-titulo">Nuevo usuario</h3>
          <button class="modal-cerrar" onclick="cerrarModalUsuario()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-usuario" class="alerta-error"></div>
          <div class="grid-2">
            <div class="campo" style="grid-column:1/-1">
              <label>Nombre completo <span class="req">*</span></label>
              <input type="text" id="usr-nombre" placeholder="Nombre y apellidos">
            </div>
            <div class="campo">
              <label>Email <span class="req">*</span></label>
              <input type="email" id="usr-email" placeholder="correo@ejemplo.com">
            </div>
            <div class="campo" id="campo-password">
              <label>Contraseña inicial <span class="req">*</span></label>
              <input type="password" id="usr-password" placeholder="Mínimo 8 caracteres">
            </div>
            <div class="campo">
              <label>DNI</label>
              <input type="text" id="usr-dni" placeholder="8 dígitos" maxlength="8">
            </div>
            <div class="campo">
              <label>Teléfono</label>
              <input type="text" id="usr-telefono" placeholder="Ej: 987654321">
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="usr-activo">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalUsuario()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarUsuario()" id="btn-guardar-usuario">Guardar</button>
        </div>
      </div>
    </div>
  `;

  await cargarUsuarios();
}

async function cargarUsuarios() {
  const { data, error } = await _supabase
    .from('usuarios')
    .select('*')
    .order('nombre');

  if (error) { mostrarToast('Error al cargar usuarios', 'error'); return; }
  usuarios_lista = data || [];
  filtrarUsuarios();
}

function filtrarUsuarios() {
  const texto  = (document.getElementById('buscar-usuario')?.value || '').toLowerCase();
  const estado = document.getElementById('filtro-estado-usuario')?.value;

  let lista = usuarios_lista.filter(u => {
    const coincide = u.nombre.toLowerCase().includes(texto) ||
                     u.email.toLowerCase().includes(texto) ||
                     (u.dni || '').includes(texto);
    const estadoOk = estado === '' ? true : String(u.activo) === estado;
    return coincide && estadoOk;
  });
  usuarios_pagina = 1;
  renderTablaUsuarios(lista);
}

function renderTablaUsuarios(lista) {
  const tbody = document.getElementById('tbody-usuarios');
  if (!tbody) return;

  const inicio  = (usuarios_pagina - 1) * USUARIOS_POR_PAGINA;
  const pagina  = lista.slice(inicio, inicio + USUARIOS_POR_PAGINA);

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="estado-vacio">
      <div class="icono">👤</div><p>No se encontraron usuarios</p></div></td></tr>`;
    document.getElementById('pag-usuarios').innerHTML = '';
    return;
  }

  tbody.innerHTML = pagina.map(u => `
    <tr>
      <td data-label="Usuario">
        <div style="display:flex; align-items:center; gap:10px">
          <div style="width:32px; height:32px; border-radius:50%; background:var(--color-secundario);
                      display:flex; align-items:center; justify-content:center;
                      color:#fff; font-weight:700; font-size:13px">
            ${u.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="font-medium">${escapar(u.nombre)}</div>
            <div class="text-muted text-sm">${escapar(u.email)}</div>
          </div>
        </div>
      </td>
      <td data-label="DNI">${escapar(u.dni || '—')}</td>
      <td data-label="Teléfono">${escapar(u.telefono || '—')}</td>
      <td data-label="Rol">
        ${u.es_super_admin
          ? '<span class="badge badge-primario">SUPER ADMIN</span>'
          : '<span class="badge" style="background:#EDF2F7;color:#4A5568">Usuario</span>'}
      </td>
      <td data-label="Estado">
        <span class="badge ${u.activo ? 'badge-activo' : 'badge-inactivo'}">
          ${u.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td data-label="Creación">${formatearFecha(u.fecha_creacion)}</td>
      <td data-label="Acciones">
        <div class="acciones">
          ${perfil_usuario?.es_super_admin ? `
            <button class="btn btn-secundario btn-icono" onclick="abrirModalUsuario('${u.id}')" title="Editar">✏️</button>
            ${!u.es_super_admin ? `
              <button class="btn btn-peligro btn-icono" onclick="eliminarUsuario('${u.id}','${escapar(u.nombre)}')" title="Eliminar">🗑️</button>
            ` : ''}
          ` : '<span class="text-muted text-sm">Solo lectura</span>'}
        </div>
      </td>
    </tr>`).join('');

  // Paginación
  const total  = lista.length;
  const paginas = Math.ceil(total / USUARIOS_POR_PAGINA);
  document.getElementById('pag-usuarios').innerHTML = `
    <span class="info">Mostrando ${inicio + 1}–${Math.min(inicio + USUARIOS_POR_PAGINA, total)} de ${total}</span>
    <button ${usuarios_pagina <= 1 ? 'disabled' : ''} onclick="cambiarPagUsuario(-1)">‹ Ant.</button>
    <button class="activo">${usuarios_pagina}</button>
    <button ${usuarios_pagina >= paginas ? 'disabled' : ''} onclick="cambiarPagUsuario(1)">Sig. ›</button>`;
}

function cambiarPagUsuario(dir) {
  usuarios_pagina += dir;
  filtrarUsuarios();
}

function abrirModalUsuario(id) {
  usuario_editando = id;
  document.getElementById('alerta-usuario').classList.remove('visible');
  const campoPass = document.getElementById('campo-password');

  if (id) {
    const u = usuarios_lista.find(x => x.id === id);
    if (!u) return;
    document.getElementById('modal-usuario-titulo').textContent = 'Editar usuario';
    document.getElementById('usr-nombre').value   = u.nombre;
    document.getElementById('usr-email').value    = u.email;
    document.getElementById('usr-dni').value      = u.dni || '';
    document.getElementById('usr-telefono').value = u.telefono || '';
    document.getElementById('usr-activo').value   = String(u.activo);
    campoPass.style.display = 'none'; // No se cambia password desde aquí
  } else {
    document.getElementById('modal-usuario-titulo').textContent = 'Nuevo usuario';
    ['usr-nombre','usr-email','usr-dni','usr-telefono','usr-password']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('usr-activo').value = 'true';
    campoPass.style.display = 'block';
  }
  document.getElementById('modal-usuario').style.display = 'flex';
}

function cerrarModalUsuario() {
  document.getElementById('modal-usuario').style.display = 'none';
  usuario_editando = null;
}

async function guardarUsuario() {
  const alerta = document.getElementById('alerta-usuario');
  alerta.classList.remove('visible');

  const nombre   = document.getElementById('usr-nombre').value.trim();
  const email    = document.getElementById('usr-email').value.trim();
  const password = document.getElementById('usr-password')?.value;
  const dni      = document.getElementById('usr-dni').value.trim() || null;
  const telefono = document.getElementById('usr-telefono').value.trim() || null;
  const activo   = document.getElementById('usr-activo').value === 'true';

  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  if (!email)  { alerta.textContent = 'El email es obligatorio.';  alerta.classList.add('visible'); return; }
  if (!usuario_editando && (!password || password.length < 8)) {
    alerta.textContent = 'La contraseña debe tener al menos 8 caracteres.';
    alerta.classList.add('visible'); return;
  }
  if (dni && !validarDNI(dni)) {
    alerta.textContent = 'El DNI debe tener 8 dígitos.'; alerta.classList.add('visible'); return;
  }

  const btn = document.getElementById('btn-guardar-usuario');
  btn.disabled = true; btn.textContent = 'Guardando…';

  let error;

  if (usuario_editando) {
    // Solo actualiza perfil (no contraseña desde aquí)
    const anterior = usuarios_lista.find(u => u.id === usuario_editando);
    ({ error } = await _supabase.from('usuarios').update({ nombre, dni, telefono, activo }).eq('id', usuario_editando));
    if (!error) await registrarHistorial('usuarios', usuario_editando, 'EDITAR', anterior, { nombre, dni, telefono, activo });
  } else {
    // Crear usuario en Auth + tabla usuarios
    const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZm5oanlxZWh2ZHF6aWtqaG1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjczNDQ1MCwiZXhwIjoyMDkyMzEwNDUwfQ.zdGxwMEgPq8iN5zjfHUj9Gf3IEcDiebaNe0OOTF-ZUw';
    const resp = await fetch(`${NEXUM_CONFIG.supabase.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const authData = await resp.json();
    if (!authData.id) {
      error = { message: authData.msg || authData.error_description || 'Error al crear usuario en Auth' };
    } else {
      const { error: err2, data } = await _supabase.from('usuarios')
        .insert({ auth_id: authData.id, email, nombre, dni, telefono, activo })
        .select().single();
      error = err2;
      if (!error && data) await registrarHistorial('usuarios', data.id, 'CREAR', null, { email, nombre });
    }
  }

  btn.disabled = false; btn.textContent = 'Guardar';

  if (error) {
    let msg = 'Error al guardar. Intenta de nuevo.';
    if (error.message?.includes('already registered') || error.code === '23505') msg = 'Ya existe un usuario con ese email.';
    alerta.textContent = msg; alerta.classList.add('visible'); return;
  }

  mostrarToast(usuario_editando ? 'Usuario actualizado' : 'Usuario creado', 'exito');
  cerrarModalUsuario();
  await cargarUsuarios();
}

async function eliminarUsuario(id, nombre) {
  const ok = await confirmar(`¿Eliminar al usuario "<strong>${nombre}</strong>"?<br>Se eliminará también su acceso al sistema.`);
  if (!ok) return;

  const u = usuarios_lista.find(x => x.id === id);
  const { error } = await _supabase.from('usuarios').delete().eq('id', id);
  if (error) { mostrarToast('No se pudo eliminar el usuario.', 'error'); return; }

  // Eliminar de Auth también
  if (u?.auth_id) {
    const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZm5oanlxZWh2ZHF6aWtqaG1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjczNDQ1MCwiZXhwIjoyMDkyMzEwNDUwfQ.zdGxwMEgPq8iN5zjfHUj9Gf3IEcDiebaNe0OOTF-ZUw';
    await fetch(`${NEXUM_CONFIG.supabase.url}/auth/v1/admin/users/${u.auth_id}`, {
      method: 'DELETE',
      headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
    });
  }

  await registrarHistorial('usuarios', id, 'ELIMINAR', { id, nombre }, null);
  mostrarToast('Usuario eliminado', 'exito');
  await cargarUsuarios();
}

function exportarUsuariosExcel() {
  if (!usuarios_lista.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const datos = usuarios_lista.map(u => ({
    'Nombre':    u.nombre,
    'Email':     u.email,
    'DNI':       u.dni || '',
    'Teléfono':  u.telefono || '',
    'Super Admin': u.es_super_admin ? 'Sí' : 'No',
    'Estado':    u.activo ? 'Activo' : 'Inactivo',
    'Creación':  formatearFecha(u.fecha_creacion)
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), 'Usuarios');
  XLSX.writeFile(wb, `NEXUM_Usuarios_${fechaHoy().replace(/\//g,'-')}.xlsx`);
  mostrarToast('Excel exportado', 'exito');
}
