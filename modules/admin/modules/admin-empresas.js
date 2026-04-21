/**
 * NEXUM v3.0 — Admin: CRUD Empresas Operadoras
 */

let empresas_lista = [];
let empresa_editando = null;
let empresas_pagina = 1;
const EMPRESAS_POR_PAGINA = 10;

async function renderTabEmpresas(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Barra de acciones -->
      <div class="filtros-barra">
        <input type="text" class="buscador" id="buscar-empresa"
               placeholder="🔍 Buscar por nombre o RUC…" oninput="filtrarEmpresas()">
        <select id="filtro-estado-empresa" onchange="filtrarEmpresas()">
          <option value="">Todos los estados</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
        <button class="btn btn-secundario btn-sm" onclick="exportarEmpresasExcel()">
          ⬇️ Exportar Excel
        </button>
        <button class="btn btn-primario btn-sm" onclick="abrirModalEmpresa(null)" id="btn-nueva-empresa"
                ${!perfil_usuario?.es_super_admin ? 'style="display:none"' : ''}>
          + Nueva empresa
        </button>
      </div>

      <!-- Tabla -->
      <div class="tabla-contenedor">
        <table class="tabla" id="tabla-empresas">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>RUC</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tbody-empresas">
            <tr><td colspan="7"><div class="cargando"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
        <div class="paginacion" id="pag-empresas"></div>
      </div>
    </div>

    <!-- Modal empresa -->
    <div class="modal-overlay" id="modal-empresa" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h3 id="modal-empresa-titulo">Nueva empresa operadora</h3>
          <button class="modal-cerrar" onclick="cerrarModalEmpresa()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-empresa" class="alerta-error"></div>
          <div class="grid-2">
            <div class="campo" style="grid-column:1/-1">
              <label>Nombre completo <span class="req">*</span></label>
              <input type="text" id="emp-nombre" placeholder="Ej: JVÑ Servicios Generales S.A.C.">
            </div>
            <div class="campo">
              <label>Nombre corto <span class="req">*</span></label>
              <input type="text" id="emp-nombre-corto" placeholder="Ej: JVÑ" maxlength="20">
            </div>
            <div class="campo">
              <label>RUC <span class="req">*</span></label>
              <input type="text" id="emp-ruc" placeholder="11 dígitos" maxlength="11">
            </div>
            <div class="campo">
              <label>Teléfono</label>
              <input type="text" id="emp-telefono" placeholder="Ej: 01-234-5678">
            </div>
            <div class="campo">
              <label>Email</label>
              <input type="email" id="emp-email" placeholder="empresa@correo.com">
            </div>
            <div class="campo" style="grid-column:1/-1">
              <label>Dirección</label>
              <input type="text" id="emp-direccion" placeholder="Dirección fiscal">
            </div>
            <div class="campo">
              <label>Color primario</label>
              <div style="display:flex; gap:8px; align-items:center">
                <input type="color" id="emp-color" value="#2C5282" style="width:50px; height:38px; padding:2px; border-radius:6px; border:1px solid var(--color-borde); cursor:pointer">
                <input type="text" id="emp-color-texto" value="#2C5282" placeholder="#2C5282"
                       maxlength="7" oninput="sincronizarColor(this)"
                       style="flex:1">
              </div>
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="emp-activa">
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalEmpresa()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarEmpresa()" id="btn-guardar-empresa">
            Guardar
          </button>
        </div>
      </div>
    </div>
  `;

  // Sincronizar picker de color con texto
  document.getElementById('emp-color').addEventListener('input', function() {
    document.getElementById('emp-color-texto').value = this.value;
  });

  await cargarEmpresas();
}

async function cargarEmpresas() {
  const { data, error } = await _supabase
    .from('empresas_operadoras')
    .select('*')
    .order('nombre');

  if (error) { mostrarToast('Error al cargar empresas', 'error'); return; }
  empresas_lista = data || [];
  filtrarEmpresas();
}

function filtrarEmpresas() {
  const texto  = (document.getElementById('buscar-empresa')?.value || '').toLowerCase();
  const estado = document.getElementById('filtro-estado-empresa')?.value;

  let lista = empresas_lista.filter(e => {
    const coincide = e.nombre.toLowerCase().includes(texto) ||
                     e.ruc.includes(texto) ||
                     (e.nombre_corto || '').toLowerCase().includes(texto);
    const estadoOk = estado === '' ? true : String(e.activa) === estado;
    return coincide && estadoOk;
  });

  empresas_pagina = 1;
  renderTablaEmpresas(lista);
}

function renderTablaEmpresas(lista) {
  const tbody = document.getElementById('tbody-empresas');
  if (!tbody) return;

  const inicio = (empresas_pagina - 1) * EMPRESAS_POR_PAGINA;
  const pagina = lista.slice(inicio, inicio + EMPRESAS_POR_PAGINA);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="estado-vacio"><div class="icono">🏢</div>
      <p>No se encontraron empresas</p></div></td></tr>`;
    document.getElementById('pag-empresas').innerHTML = '';
    return;
  }

  tbody.innerHTML = pagina.map(e => `
    <tr>
      <td data-label="Empresa">
        <div style="display:flex; align-items:center; gap:10px">
          <div style="width:32px; height:32px; border-radius:6px; background:${escapar(e.color_primario || '#2C5282')};
                      display:flex; align-items:center; justify-content:center;
                      color:#fff; font-weight:700; font-size:12px; flex-shrink:0">
            ${iniciales(e.nombre)}
          </div>
          <div>
            <div class="font-medium">${escapar(e.nombre)}</div>
            <div class="text-muted text-sm">${escapar(e.nombre_corto)}</div>
          </div>
        </div>
      </td>
      <td data-label="RUC">${escapar(e.ruc)}</td>
      <td data-label="Teléfono">${escapar(e.telefono || '—')}</td>
      <td data-label="Email">${escapar(e.email || '—')}</td>
      <td data-label="Estado">
        <span class="badge ${e.activa ? 'badge-activo' : 'badge-inactivo'}">
          ${e.activa ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td data-label="Creación">${formatearFecha(e.fecha_creacion)}</td>
      <td data-label="Acciones">
        <div class="acciones">
          ${perfil_usuario?.es_super_admin ? `
            <button class="btn btn-secundario btn-icono" onclick="abrirModalEmpresa('${e.id}')" title="Editar">✏️</button>
            <button class="btn btn-peligro btn-icono"   onclick="eliminarEmpresa('${e.id}','${escapar(e.nombre)}')" title="Eliminar">🗑️</button>
          ` : '<span class="text-muted text-sm">Solo lectura</span>'}
        </div>
      </td>
    </tr>`).join('');

  // Paginación
  const total  = lista.length;
  const paginas = Math.ceil(total / EMPRESAS_POR_PAGINA);
  const pag    = document.getElementById('pag-empresas');
  pag.innerHTML = `
    <span class="info">Mostrando ${inicio + 1}–${Math.min(inicio + EMPRESAS_POR_PAGINA, total)} de ${total}</span>
    <button ${empresas_pagina <= 1 ? 'disabled' : ''} onclick="cambiarPagEmpresa(-1)">‹ Ant.</button>
    <button class="activo">${empresas_pagina}</button>
    <button ${empresas_pagina >= paginas ? 'disabled' : ''} onclick="cambiarPagEmpresa(1)">Sig. ›</button>`;
}

function cambiarPagEmpresa(dir) {
  empresas_pagina += dir;
  const texto  = (document.getElementById('buscar-empresa')?.value || '').toLowerCase();
  const estado = document.getElementById('filtro-estado-empresa')?.value;
  let lista = empresas_lista.filter(e => {
    const coincide = e.nombre.toLowerCase().includes(texto) || e.ruc.includes(texto);
    const estadoOk = estado === '' ? true : String(e.activa) === estado;
    return coincide && estadoOk;
  });
  renderTablaEmpresas(lista);
}

function abrirModalEmpresa(id) {
  empresa_editando = id;
  const modal = document.getElementById('modal-empresa');
  document.getElementById('alerta-empresa').classList.remove('visible');

  if (id) {
    const e = empresas_lista.find(x => x.id === id);
    if (!e) return;
    document.getElementById('modal-empresa-titulo').textContent = 'Editar empresa';
    document.getElementById('emp-nombre').value       = e.nombre;
    document.getElementById('emp-nombre-corto').value = e.nombre_corto;
    document.getElementById('emp-ruc').value          = e.ruc;
    document.getElementById('emp-telefono').value     = e.telefono || '';
    document.getElementById('emp-email').value        = e.email || '';
    document.getElementById('emp-direccion').value    = e.direccion || '';
    document.getElementById('emp-color').value        = e.color_primario || '#2C5282';
    document.getElementById('emp-color-texto').value  = e.color_primario || '#2C5282';
    document.getElementById('emp-activa').value       = String(e.activa);
  } else {
    document.getElementById('modal-empresa-titulo').textContent = 'Nueva empresa operadora';
    ['emp-nombre','emp-nombre-corto','emp-ruc','emp-telefono','emp-email','emp-direccion']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('emp-color').value       = '#2C5282';
    document.getElementById('emp-color-texto').value = '#2C5282';
    document.getElementById('emp-activa').value      = 'true';
  }
  modal.style.display = 'flex';
}

function cerrarModalEmpresa() {
  document.getElementById('modal-empresa').style.display = 'none';
  empresa_editando = null;
}

function sincronizarColor(input) {
  const val = input.value;
  if (/^#[0-9A-Fa-f]{6}$/.test(val))
    document.getElementById('emp-color').value = val;
}

async function guardarEmpresa() {
  const alerta = document.getElementById('alerta-empresa');
  alerta.classList.remove('visible');

  const datos = {
    nombre:        document.getElementById('emp-nombre').value.trim(),
    nombre_corto:  document.getElementById('emp-nombre-corto').value.trim(),
    ruc:           document.getElementById('emp-ruc').value.trim(),
    telefono:      document.getElementById('emp-telefono').value.trim() || null,
    email:         document.getElementById('emp-email').value.trim() || null,
    direccion:     document.getElementById('emp-direccion').value.trim() || null,
    color_primario:document.getElementById('emp-color').value,
    activa:        document.getElementById('emp-activa').value === 'true'
  };

  // Validaciones
  if (!datos.nombre)       { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  if (!datos.nombre_corto) { alerta.textContent = 'El nombre corto es obligatorio.'; alerta.classList.add('visible'); return; }
  if (!validarRUC(datos.ruc)) { alerta.textContent = 'El RUC debe tener 11 dígitos.'; alerta.classList.add('visible'); return; }

  const btn = document.getElementById('btn-guardar-empresa');
  btn.disabled = true; btn.textContent = 'Guardando…';

  let error;
  if (empresa_editando) {
    const anterior = empresas_lista.find(e => e.id === empresa_editando);
    ({ error } = await _supabase.from('empresas_operadoras').update(datos).eq('id', empresa_editando));
    if (!error) await registrarHistorial('empresas_operadoras', empresa_editando, 'EDITAR', anterior, datos);
  } else {
    const { error: err, data } = await _supabase.from('empresas_operadoras').insert(datos).select().single();
    error = err;
    if (!error && data) await registrarHistorial('empresas_operadoras', data.id, 'CREAR', null, datos);
  }

  btn.disabled = false; btn.textContent = 'Guardar';

  if (error) {
    let msg = 'Error al guardar. Intenta de nuevo.';
    if (error.code === '23505') msg = 'Ya existe una empresa con ese RUC.';
    alerta.textContent = msg; alerta.classList.add('visible'); return;
  }

  mostrarToast(empresa_editando ? 'Empresa actualizada' : 'Empresa creada', 'exito');
  cerrarModalEmpresa();
  await cargarEmpresas();
}

async function eliminarEmpresa(id, nombre) {
  const ok = await confirmar(`¿Eliminar la empresa "<strong>${nombre}</strong>"?<br><br>Esta acción no se puede deshacer.`);
  if (!ok) return;

  const { error } = await _supabase.from('empresas_operadoras').delete().eq('id', id);
  if (error) {
    mostrarToast('No se pudo eliminar. Puede tener usuarios asignados.', 'error'); return;
  }
  await registrarHistorial('empresas_operadoras', id, 'ELIMINAR', { id, nombre }, null);
  mostrarToast('Empresa eliminada', 'exito');
  await cargarEmpresas();
}

function exportarEmpresasExcel() {
  if (!empresas_lista.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const datos = empresas_lista.map(e => ({
    'Nombre':        e.nombre,
    'Nombre Corto':  e.nombre_corto,
    'RUC':           e.ruc,
    'Dirección':     e.direccion || '',
    'Teléfono':      e.telefono  || '',
    'Email':         e.email     || '',
    'Color':         e.color_primario,
    'Estado':        e.activa ? 'Activa' : 'Inactiva',
    'Fecha Creación':formatearFecha(e.fecha_creacion)
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
  XLSX.writeFile(wb, `NEXUM_Empresas_${fechaHoy().replace(/\//g,'-')}.xlsx`);
  mostrarToast('Excel exportado correctamente', 'exito');
}

function iniciales(nombre) {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}
