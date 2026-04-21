/**
 * NEXUM v3.0 — Admin: Asignación usuario ↔ empresa operadora
 */

let asignaciones_lista = [];
let asignacion_editando = null;

async function renderTabAsignaciones(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="filtros-barra">
        <input type="text" class="buscador" id="buscar-asignacion"
               placeholder="🔍 Buscar por usuario o empresa…" oninput="filtrarAsignaciones()">
        <select id="filtro-rol-asignacion" onchange="filtrarAsignaciones()">
          <option value="">Todos los roles</option>
          <option value="CONTADOR">CONTADOR</option>
          <option value="ASISTENTE">ASISTENTE</option>
          <option value="CONSULTA">CONSULTA</option>
        </select>
        <select id="filtro-estado-asignacion" onchange="filtrarAsignaciones()">
          <option value="">Todos</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
        <button class="btn btn-secundario btn-sm" onclick="exportarAsignacionesExcel()">⬇️ Exportar Excel</button>
        <button class="btn btn-primario btn-sm"   onclick="abrirModalAsignacion(null)"
                ${!perfil_usuario?.es_super_admin ? 'style="display:none"' : ''}>
          + Nueva asignación
        </button>
      </div>

      <div class="tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Empresa</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Fecha asignación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tbody-asignaciones">
            <tr><td colspan="6"><div class="cargando"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal asignación -->
    <div class="modal-overlay" id="modal-asignacion" style="display:none">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3 id="modal-asignacion-titulo">Nueva asignación</h3>
          <button class="modal-cerrar" onclick="cerrarModalAsignacion()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-asignacion" class="alerta-error"></div>
          <div class="campo">
            <label>Usuario <span class="req">*</span></label>
            <select id="asig-usuario">
              <option value="">— Selecciona un usuario —</option>
            </select>
          </div>
          <div class="campo">
            <label>Empresa operadora <span class="req">*</span></label>
            <select id="asig-empresa">
              <option value="">— Selecciona una empresa —</option>
            </select>
          </div>
          <div class="campo">
            <label>Rol <span class="req">*</span></label>
            <select id="asig-rol">
              <option value="CONTADOR">CONTADOR — Acceso completo de lectura/escritura</option>
              <option value="ASISTENTE">ASISTENTE — Puede registrar, no eliminar</option>
              <option value="CONSULTA">CONSULTA — Solo lectura</option>
            </select>
          </div>
          <div class="campo">
            <label>Estado</label>
            <select id="asig-activo">
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalAsignacion()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarAsignacion()" id="btn-guardar-asig">Guardar</button>
        </div>
      </div>
    </div>
  `;

  await cargarAsignaciones();
}

async function cargarAsignaciones() {
  const { data, error } = await _supabase
    .from('usuarios_empresas')
    .select(`
      *,
      usuarios (nombre, email),
      empresas_operadoras (nombre, nombre_corto)
    `)
    .order('fecha_asignacion', { ascending: false });

  if (error) { mostrarToast('Error al cargar asignaciones', 'error'); return; }
  asignaciones_lista = data || [];
  filtrarAsignaciones();
}

function filtrarAsignaciones() {
  const texto  = (document.getElementById('buscar-asignacion')?.value || '').toLowerCase();
  const rol    = document.getElementById('filtro-rol-asignacion')?.value;
  const estado = document.getElementById('filtro-estado-asignacion')?.value;

  const lista = asignaciones_lista.filter(a => {
    const nombreU   = (a.usuarios?.nombre || '').toLowerCase();
    const emailU    = (a.usuarios?.email || '').toLowerCase();
    const nombreE   = (a.empresas_operadoras?.nombre || '').toLowerCase();
    const coincide  = nombreU.includes(texto) || emailU.includes(texto) || nombreE.includes(texto);
    const rolOk     = !rol    || a.rol === rol;
    const estadoOk  = estado === '' || String(a.activo) === estado;
    return coincide && rolOk && estadoOk;
  });
  renderTablaAsignaciones(lista);
}

function renderTablaAsignaciones(lista) {
  const tbody = document.getElementById('tbody-asignaciones');
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="estado-vacio">
      <div class="icono">🔗</div><p>No se encontraron asignaciones</p></div></td></tr>`;
    return;
  }

  const colores = { CONTADOR: 'badge-primario', ASISTENTE: 'badge-atencion', CONSULTA: '' };

  tbody.innerHTML = lista.map(a => `
    <tr>
      <td data-label="Usuario">
        <div class="font-medium">${escapar(a.usuarios?.nombre || '—')}</div>
        <div class="text-muted text-sm">${escapar(a.usuarios?.email || '')}</div>
      </td>
      <td data-label="Empresa">${escapar(a.empresas_operadoras?.nombre || '—')}</td>
      <td data-label="Rol">
        <span class="badge ${colores[a.rol] || ''}" style="${!colores[a.rol] ? 'background:#EDF2F7;color:#4A5568' : ''}">
          ${escapar(a.rol)}
        </span>
      </td>
      <td data-label="Estado">
        <span class="badge ${a.activo ? 'badge-activo' : 'badge-inactivo'}">
          ${a.activo ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td data-label="Fecha">${formatearFecha(a.fecha_asignacion)}</td>
      <td data-label="Acciones">
        <div class="acciones">
          ${perfil_usuario?.es_super_admin ? `
            <button class="btn btn-secundario btn-icono" onclick="abrirModalAsignacion('${a.id}')" title="Editar">✏️</button>
            <button class="btn btn-peligro btn-icono"   onclick="eliminarAsignacion('${a.id}')" title="Eliminar">🗑️</button>
          ` : '<span class="text-muted text-sm">Solo lectura</span>'}
        </div>
      </td>
    </tr>`).join('');
}

async function abrirModalAsignacion(id) {
  asignacion_editando = id;
  document.getElementById('alerta-asignacion').classList.remove('visible');

  // Cargar opciones de selects
  const [{ data: usrs }, { data: emps }] = await Promise.all([
    _supabase.from('usuarios').select('id, nombre, email').eq('activo', true).order('nombre'),
    _supabase.from('empresas_operadoras').select('id, nombre').eq('activa', true).order('nombre')
  ]);

  const selUsr = document.getElementById('asig-usuario');
  const selEmp = document.getElementById('asig-empresa');

  selUsr.innerHTML = '<option value="">— Selecciona un usuario —</option>' +
    (usrs || []).filter(u => !u.es_super_admin)
      .map(u => `<option value="${u.id}">${escapar(u.nombre)} (${escapar(u.email)})</option>`).join('');

  selEmp.innerHTML = '<option value="">— Selecciona una empresa —</option>' +
    (emps || []).map(e => `<option value="${e.id}">${escapar(e.nombre)}</option>`).join('');

  if (id) {
    const a = asignaciones_lista.find(x => x.id === id);
    if (!a) return;
    document.getElementById('modal-asignacion-titulo').textContent = 'Editar asignación';
    selUsr.value = a.usuario_id;
    selEmp.value = a.empresa_operadora_id;
    document.getElementById('asig-rol').value    = a.rol;
    document.getElementById('asig-activo').value = String(a.activo);
    selUsr.disabled = true; // No cambiar usuario al editar
    selEmp.disabled = true;
  } else {
    document.getElementById('modal-asignacion-titulo').textContent = 'Nueva asignación';
    selUsr.disabled = false;
    selEmp.disabled = false;
    document.getElementById('asig-rol').value    = 'CONTADOR';
    document.getElementById('asig-activo').value = 'true';
  }
  document.getElementById('modal-asignacion').style.display = 'flex';
}

function cerrarModalAsignacion() {
  document.getElementById('modal-asignacion').style.display = 'none';
  document.getElementById('asig-usuario').disabled = false;
  document.getElementById('asig-empresa').disabled = false;
  asignacion_editando = null;
}

async function guardarAsignacion() {
  const alerta    = document.getElementById('alerta-asignacion');
  alerta.classList.remove('visible');

  const usuario_id           = document.getElementById('asig-usuario').value;
  const empresa_operadora_id = document.getElementById('asig-empresa').value;
  const rol                  = document.getElementById('asig-rol').value;
  const activo               = document.getElementById('asig-activo').value === 'true';

  if (!usuario_id)           { alerta.textContent = 'Selecciona un usuario.';  alerta.classList.add('visible'); return; }
  if (!empresa_operadora_id) { alerta.textContent = 'Selecciona una empresa.'; alerta.classList.add('visible'); return; }

  const btn = document.getElementById('btn-guardar-asig');
  btn.disabled = true; btn.textContent = 'Guardando…';

  let error;
  if (asignacion_editando) {
    ({ error } = await _supabase.from('usuarios_empresas')
      .update({ rol, activo }).eq('id', asignacion_editando));
    if (!error) await registrarHistorial('usuarios_empresas', asignacion_editando, 'EDITAR', null, { rol, activo });
  } else {
    ({ error } = await _supabase.from('usuarios_empresas')
      .insert({ usuario_id, empresa_operadora_id, rol, activo }));
    if (!error) await registrarHistorial('usuarios_empresas', usuario_id, 'CREAR', null, { usuario_id, empresa_operadora_id, rol });
  }

  btn.disabled = false; btn.textContent = 'Guardar';

  if (error) {
    let msg = 'Error al guardar.';
    if (error.code === '23505') msg = 'Este usuario ya está asignado a esa empresa.';
    alerta.textContent = msg; alerta.classList.add('visible'); return;
  }

  mostrarToast(asignacion_editando ? 'Asignación actualizada' : 'Asignación creada', 'exito');
  cerrarModalAsignacion();
  await cargarAsignaciones();
}

async function eliminarAsignacion(id) {
  const ok = await confirmar('¿Eliminar esta asignación?<br>El usuario perderá acceso a esa empresa.');
  if (!ok) return;
  const { error } = await _supabase.from('usuarios_empresas').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar asignación.', 'error'); return; }
  await registrarHistorial('usuarios_empresas', id, 'ELIMINAR', { id }, null);
  mostrarToast('Asignación eliminada', 'exito');
  await cargarAsignaciones();
}

function exportarAsignacionesExcel() {
  if (!asignaciones_lista.length) { mostrarToast('No hay datos', 'atencion'); return; }
  const datos = asignaciones_lista.map(a => ({
    'Usuario':  a.usuarios?.nombre || '',
    'Email':    a.usuarios?.email  || '',
    'Empresa':  a.empresas_operadoras?.nombre || '',
    'Rol':      a.rol,
    'Estado':   a.activo ? 'Activa' : 'Inactiva',
    'Asignado': formatearFecha(a.fecha_asignacion)
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), 'Asignaciones');
  XLSX.writeFile(wb, `NEXUM_Asignaciones_${fechaHoy().replace(/\//g,'-')}.xlsx`);
  mostrarToast('Excel exportado', 'exito');
}
