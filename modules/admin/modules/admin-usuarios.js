/**
 * NEXUM v3.0 — Admin: CRUD Usuarios + asignación de empresas y permisos
 */

let usuarios_lista     = [];
let usuario_editando   = null;
let usuarios_pagina    = 1;
const USUARIOS_POR_PAG = 10;

// Datos temporales al editar usuario
let _usr_empresas_disponibles  = []; // todas las empresas del sistema
let _usr_asignaciones_actuales = []; // asignaciones actuales del usuario editado

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
        <button class="btn btn-primario btn-sm" onclick="abrirModalUsuario(null)"
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
              <th>Empresas</th>
              <th>Estado</th>
              <th>Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tbody-usuarios">
            <tr><td colspan="8"><div class="cargando"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
        <div class="paginacion" id="pag-usuarios"></div>
      </div>
    </div>

    <!-- Modal usuario (3 tabs) -->
    <div class="modal-overlay" id="modal-usuario" style="display:none">
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h3 id="modal-usuario-titulo">Nuevo usuario</h3>
          <button class="modal-cerrar" onclick="cerrarModalUsuario()">✕</button>
        </div>

        <!-- Tabs del modal -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--color-borde);padding:0 20px">
          <button class="modal-tab-btn activo" id="mtab-datos"    onclick="activarTabModal('datos')">👤 Datos</button>
          <button class="modal-tab-btn"        id="mtab-empresas" onclick="activarTabModal('empresas')">🏢 Empresas</button>
          <button class="modal-tab-btn"        id="mtab-permisos" onclick="activarTabModal('permisos')">🔐 Permisos</button>
        </div>

        <div class="modal-body">
          <div id="alerta-usuario" class="alerta-error"></div>

          <!-- TAB: Datos -->
          <div id="panel-datos">
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

          <!-- TAB: Empresas -->
          <div id="panel-empresas" style="display:none">
            <p class="text-muted text-sm" style="margin-bottom:14px">
              Selecciona las empresas a las que tendrá acceso y el rol que tendrá en cada una.
            </p>
            <div id="lista-empresas-usuario" style="display:flex;flex-direction:column;gap:10px">
              <div class="cargando"><div class="spinner"></div></div>
            </div>
          </div>

          <!-- TAB: Permisos (solo lectura, derivado del rol) -->
          <div id="panel-permisos" style="display:none">
            <p class="text-muted text-sm" style="margin-bottom:14px">
              Los permisos se derivan automáticamente del rol asignado a cada empresa.
              Selecciona una empresa para ver sus permisos efectivos.
            </p>
            <div id="permisos-empresa-sel" style="margin-bottom:12px">
              <select id="sel-empresa-permisos" onchange="renderPermisosEfectivos()" style="padding:7px 10px;border:1px solid var(--color-borde);border-radius:var(--radio);background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px;width:100%">
                <option value="">— Selecciona una empresa —</option>
              </select>
            </div>
            <div id="tabla-permisos-efectivos"></div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalUsuario()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarUsuario()" id="btn-guardar-usuario">Guardar</button>
        </div>
      </div>
    </div>
  `;

  _inyectarEstilosTabsModal();
  await cargarUsuarios();
}

function _inyectarEstilosTabsModal() {
  if (document.getElementById('modal-tab-styles')) return;
  const s = document.createElement('style');
  s.id = 'modal-tab-styles';
  s.textContent = `
    .modal-tab-btn {
      padding: 10px 16px; border: none; background: none; cursor: pointer;
      font-family: var(--font); font-size: 13px; font-weight: 500;
      color: var(--color-texto-suave); border-bottom: 2px solid transparent;
      margin-bottom: -2px; transition: all 0.2s;
    }
    .modal-tab-btn:hover { color: var(--color-primario); }
    .modal-tab-btn.activo { color: var(--color-secundario); border-bottom-color: var(--color-secundario); }
    .empresa-asig-row {
      display: flex; align-items: center; gap: 12px; padding: 12px 14px;
      border: 1px solid var(--color-borde); border-radius: var(--radio);
      background: var(--color-bg-card);
    }
    .empresa-asig-row.asignada { border-color: var(--color-secundario); background: var(--color-hover); }
    .permiso-grid { border-collapse: collapse; width: 100%; font-size: 13px; }
    .permiso-grid th, .permiso-grid td { padding: 7px 10px; border: 1px solid var(--color-borde); text-align: center; }
    .permiso-grid th:first-child, .permiso-grid td:first-child { text-align: left; }
    .permiso-grid thead th { background: var(--color-bg-card); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
    .permiso-check { font-size: 16px; }
    .permiso-check.si { color: #2F855A; }
    .permiso-check.no { color: #A0AEC0; }
  `;
  document.head.appendChild(s);
}

function activarTabModal(tab) {
  ['datos', 'empresas', 'permisos'].forEach(t => {
    document.getElementById('mtab-' + t).classList.toggle('activo', t === tab);
    document.getElementById('panel-' + t).style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'permisos') _actualizarSelectorPermisosEmpresas();
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

  const inicio  = (usuarios_pagina - 1) * USUARIOS_POR_PAG;
  const pagina  = lista.slice(inicio, inicio + USUARIOS_POR_PAG);

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="estado-vacio">
      <div class="icono">👤</div><p>No se encontraron usuarios</p></div></td></tr>`;
    document.getElementById('pag-usuarios').innerHTML = '';
    return;
  }

  tbody.innerHTML = pagina.map(u => `
    <tr>
      <td data-label="Usuario">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--color-secundario);
                      display:flex;align-items:center;justify-content:center;
                      color:#fff;font-weight:700;font-size:13px">
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
      <td data-label="Empresas" id="cell-emp-${u.id}">
        <span class="text-muted text-sm">—</span>
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

  // Cargar conteo de empresas async
  _cargarEmpresasCeldas(pagina);

  // Paginación
  const total  = lista.length;
  const paginas = Math.ceil(total / USUARIOS_POR_PAG);
  document.getElementById('pag-usuarios').innerHTML = `
    <span class="info">Mostrando ${inicio + 1}–${Math.min(inicio + USUARIOS_POR_PAG, total)} de ${total}</span>
    <button ${usuarios_pagina <= 1 ? 'disabled' : ''} onclick="cambiarPagUsuario(-1)">‹ Ant.</button>
    <button class="activo">${usuarios_pagina}</button>
    <button ${usuarios_pagina >= paginas ? 'disabled' : ''} onclick="cambiarPagUsuario(1)">Sig. ›</button>`;
}

async function _cargarEmpresasCeldas(pagina) {
  const ids = pagina.filter(u => !u.es_super_admin).map(u => u.id);
  if (!ids.length) return;
  const { data } = await _supabase
    .from('usuarios_empresas')
    .select('usuario_id, rol, empresas_operadoras(nombre_corto, nombre)')
    .in('usuario_id', ids)
    .eq('activo', true);

  (data || []).forEach(a => {
    const cell = document.getElementById('cell-emp-' + a.usuario_id);
    if (!cell) return;
    const nombre = a.empresas_operadoras?.nombre_corto || a.empresas_operadoras?.nombre || '?';
    const existing = cell.querySelector('.emp-tags') || (() => {
      const d = document.createElement('div');
      d.className = 'emp-tags';
      d.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
      cell.innerHTML = '';
      cell.appendChild(d);
      return d;
    })();
    const span = document.createElement('span');
    span.className = 'badge';
    span.style.cssText = 'background:#EDF2F7;color:#4A5568;font-size:10px';
    span.textContent = nombre;
    existing.appendChild(span);
  });
}

function cambiarPagUsuario(dir) {
  usuarios_pagina += dir;
  filtrarUsuarios();
}

async function abrirModalUsuario(id) {
  usuario_editando = id;
  document.getElementById('alerta-usuario').classList.remove('visible');
  activarTabModal('datos');

  // Cargar empresas disponibles
  const { data: emps } = await _supabase
    .from('empresas_operadoras')
    .select('id, nombre, nombre_corto, color_primario')
    .eq('activa', true)
    .order('nombre');
  _usr_empresas_disponibles = emps || [];

  if (id) {
    const u = usuarios_lista.find(x => x.id === id);
    if (!u) return;
    document.getElementById('modal-usuario-titulo').textContent = 'Editar usuario';
    document.getElementById('usr-nombre').value   = u.nombre;
    document.getElementById('usr-email').value    = u.email;
    document.getElementById('usr-dni').value      = u.dni || '';
    document.getElementById('usr-telefono').value = u.telefono || '';
    document.getElementById('usr-activo').value   = String(u.activo);
    document.getElementById('campo-password').style.display = 'none';

    // Cargar asignaciones actuales
    const { data: asigs } = await _supabase
      .from('usuarios_empresas')
      .select('id, empresa_operadora_id, rol, activo')
      .eq('usuario_id', id);
    _usr_asignaciones_actuales = asigs || [];
  } else {
    document.getElementById('modal-usuario-titulo').textContent = 'Nuevo usuario';
    ['usr-nombre','usr-email','usr-dni','usr-telefono','usr-password']
      .forEach(fid => document.getElementById(fid).value = '');
    document.getElementById('usr-activo').value = 'true';
    document.getElementById('campo-password').style.display = 'block';
    _usr_asignaciones_actuales = [];
  }

  _renderListaEmpresasModal();
  document.getElementById('modal-usuario').style.display = 'flex';
}

function _renderListaEmpresasModal() {
  const cont = document.getElementById('lista-empresas-usuario');
  if (!cont) return;

  if (!_usr_empresas_disponibles.length) {
    cont.innerHTML = `<p class="text-muted text-sm">No hay empresas registradas en el sistema.</p>`;
    return;
  }

  cont.innerHTML = _usr_empresas_disponibles.map(emp => {
    const asig = _usr_asignaciones_actuales.find(a => a.empresa_operadora_id === emp.id);
    const checked = asig && asig.activo !== false;
    const rol     = asig?.rol || 'CONTADOR';
    return `
      <div class="empresa-asig-row ${checked ? 'asignada' : ''}" id="row-emp-${emp.id}">
        <input type="checkbox" id="chk-emp-${emp.id}"
               ${checked ? 'checked' : ''}
               onchange="_toggleEmpresaCheck('${emp.id}')">
        <div style="width:34px;height:34px;border-radius:50%;background:${emp.color_primario||'#2C5282'};
                    display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0">
          ${(emp.nombre_corto || emp.nombre).charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:500;font-size:13px">${escapar(emp.nombre)}</div>
          <div style="font-size:11px;color:var(--color-texto-suave)">${escapar(emp.nombre_corto || '')}</div>
        </div>
        <select id="rol-emp-${emp.id}"
                ${!checked ? 'disabled' : ''}
                style="padding:5px 8px;border:1px solid var(--color-borde);border-radius:var(--radio);background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:12px">
          <option value="CONTADOR"  ${rol==='CONTADOR'  ? 'selected':''}>CONTADOR — Acceso completo</option>
          <option value="ASISTENTE" ${rol==='ASISTENTE' ? 'selected':''}>ASISTENTE — Puede editar</option>
          <option value="CONSULTA"  ${rol==='CONSULTA'  ? 'selected':''}>CONSULTA — Solo lectura</option>
        </select>
      </div>`;
  }).join('');
}

function _toggleEmpresaCheck(empId) {
  const chk = document.getElementById('chk-emp-' + empId);
  const sel = document.getElementById('rol-emp-' + empId);
  const row = document.getElementById('row-emp-' + empId);
  sel.disabled = !chk.checked;
  row.classList.toggle('asignada', chk.checked);
  // Actualizar selector de permisos si está en ese tab
  _actualizarSelectorPermisosEmpresas();
}

function _actualizarSelectorPermisosEmpresas() {
  const sel = document.getElementById('sel-empresa-permisos');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona una empresa —</option>';
  _usr_empresas_disponibles.forEach(emp => {
    const chk = document.getElementById('chk-emp-' + emp.id);
    if (chk?.checked) {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = emp.nombre;
      sel.appendChild(opt);
    }
  });
  document.getElementById('tabla-permisos-efectivos').innerHTML = '';
}

function renderPermisosEfectivos() {
  const sel    = document.getElementById('sel-empresa-permisos');
  const empId  = sel?.value;
  const cont   = document.getElementById('tabla-permisos-efectivos');
  if (!empId || !cont) return;

  const selRol = document.getElementById('rol-emp-' + empId);
  const rol    = selRol?.value || 'CONSULTA';
  const p      = _permisosBaseDeRol(rol);

  const modulosVis = Object.entries(NEXUM_PERMISOS_MODULOS)
    .filter(([id]) => id !== 'admin' || rol === 'SUPER_ADMIN');

  const check = (val) => val
    ? '<span class="permiso-check si">✓</span>'
    : '<span class="permiso-check no">—</span>';

  cont.innerHTML = `
    <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:10px">
      Permisos efectivos para el rol <strong>${rol}</strong>:
    </p>
    <table class="permiso-grid">
      <thead>
        <tr>
          <th style="min-width:140px">Módulo</th>
          <th style="width:80px">Ver</th>
          <th style="width:80px">Editar</th>
          <th style="width:80px">Eliminar</th>
        </tr>
      </thead>
      <tbody>
        ${modulosVis.map(([id, m]) => `
          <tr>
            <td>${m.icono} ${m.nombre}</td>
            <td>${check(p[id]?.ver)}</td>
            <td>${check(p[id]?.editar)}</td>
            <td>${check(p[id]?.eliminar)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function cerrarModalUsuario() {
  document.getElementById('modal-usuario').style.display = 'none';
  usuario_editando              = null;
  _usr_asignaciones_actuales    = [];
  _usr_empresas_disponibles     = [];
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
  let nuevoUsuarioId = usuario_editando;

  if (usuario_editando) {
    const anterior = usuarios_lista.find(u => u.id === usuario_editando);
    ({ error } = await _supabase.from('usuarios')
      .update({ nombre, dni, telefono, activo })
      .eq('id', usuario_editando));
    if (!error) await registrarHistorial('usuarios', usuario_editando, 'EDITAR', anterior, { nombre, dni, telefono, activo });
  } else {
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZm5oanlxZWh2ZHF6aWtqaG1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjczNDQ1MCwiZXhwIjoyMDkyMzEwNDUwfQ.zdGxwMEgPq8iN5zjfHUj9Gf3IEcDiebaNe0OOTF-ZUw';
    const resp = await fetch(`${NEXUM_CONFIG.supabase.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
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
      if (!error && data) {
        nuevoUsuarioId = data.id;
        await registrarHistorial('usuarios', data.id, 'CREAR', null, { email, nombre });
      }
    }
  }

  if (error) {
    btn.disabled = false; btn.textContent = 'Guardar';
    let msg = 'Error al guardar. Intenta de nuevo.';
    if (error.message?.includes('already registered') || error.code === '23505') msg = 'Ya existe un usuario con ese email.';
    alerta.textContent = msg; alerta.classList.add('visible'); return;
  }

  // Guardar asignaciones de empresas
  if (nuevoUsuarioId) {
    await _guardarAsignacionesUsuario(nuevoUsuarioId);
  }

  btn.disabled = false; btn.textContent = 'Guardar';
  mostrarToast(usuario_editando ? 'Usuario actualizado' : 'Usuario creado', 'exito');
  cerrarModalUsuario();
  await cargarUsuarios();
}

async function _guardarAsignacionesUsuario(usuarioId) {
  for (const emp of _usr_empresas_disponibles) {
    const chk = document.getElementById('chk-emp-' + emp.id);
    const sel = document.getElementById('rol-emp-' + emp.id);
    if (!chk) continue;

    const checked = chk.checked;
    const rol     = sel?.value || 'CONTADOR';
    const asigExistente = _usr_asignaciones_actuales.find(a => a.empresa_operadora_id === emp.id);

    if (checked) {
      if (asigExistente) {
        // Actualizar rol si cambió
        if (asigExistente.rol !== rol || asigExistente.activo === false) {
          await _supabase.from('usuarios_empresas')
            .update({ rol, activo: true })
            .eq('id', asigExistente.id);
        }
      } else {
        // Crear nueva asignación
        await _supabase.from('usuarios_empresas')
          .insert({ usuario_id: usuarioId, empresa_operadora_id: emp.id, rol, activo: true });
      }
    } else if (asigExistente) {
      // Desactivar asignación (no eliminar para mantener historial)
      await _supabase.from('usuarios_empresas')
        .update({ activo: false })
        .eq('id', asigExistente.id);
    }
  }
}

async function eliminarUsuario(id, nombre) {
  const ok = await confirmar(`¿Eliminar al usuario "<strong>${nombre}</strong>"?\nSe eliminará también su acceso al sistema.`);
  if (!ok) return;

  const u = usuarios_lista.find(x => x.id === id);
  const { error } = await _supabase.from('usuarios').delete().eq('id', id);
  if (error) { mostrarToast('No se pudo eliminar el usuario.', 'error'); return; }

  if (u?.auth_id) {
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZm5oanlxZWh2ZHF6aWtqaG1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjczNDQ1MCwiZXhwIjoyMDkyMzEwNDUwfQ.zdGxwMEgPq8iN5zjfHUj9Gf3IEcDiebaNe0OOTF-ZUw';
    await fetch(`${NEXUM_CONFIG.supabase.url}/auth/v1/admin/users/${u.auth_id}`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
    });
  }

  await registrarHistorial('usuarios', id, 'ELIMINAR', { id, nombre }, null);
  mostrarToast('Usuario eliminado', 'exito');
  await cargarUsuarios();
}

function exportarUsuariosExcel() {
  if (!usuarios_lista.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const datos = usuarios_lista.map(u => ({
    'Nombre':      u.nombre,
    'Email':       u.email,
    'DNI':         u.dni || '',
    'Teléfono':    u.telefono || '',
    'Super Admin': u.es_super_admin ? 'Sí' : 'No',
    'Estado':      u.activo ? 'Activo' : 'Inactivo',
    'Creación':    formatearFecha(u.fecha_creacion)
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), 'Usuarios');
  XLSX.writeFile(wb, `NEXUM_Usuarios_${fechaHoy().replace(/\//g,'-')}.xlsx`);
  mostrarToast('Excel exportado', 'exito');
}
