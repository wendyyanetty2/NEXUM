// ═══════════════════════════════════════════════════════════════
// Catálogos — Clientes / Proveedores
// ═══════════════════════════════════════════════════════════════

let clientes_lista = [];
let clientes_filtrada = [];
let clientes_pag = 1;
const CLIENTES_POR_PAG = 15;

async function renderTabClientes(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;flex:1;min-width:0">
          <input id="cli-buscar" type="text" class="input-buscar" placeholder="Buscar nombre o RUC/DNI…"
                 oninput="filtrarClientes()" style="max-width:260px">
          <select id="cli-tipo" onchange="filtrarClientes()" class="input-buscar" style="max-width:160px">
            <option value="">Todos los tipos</option>
            <option value="CLIENTE">Cliente</option>
            <option value="PROVEEDOR">Proveedor</option>
            <option value="AMBOS">Ambos</option>
          </select>
          <select id="cli-activo" onchange="filtrarClientes()" class="input-buscar" style="max-width:140px">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarClientesExcel()">⬇ Excel</button>
          <button class="btn btn-secundario btn-sm" onclick="precargarClientes()" title="Insertar empresas/proveedores predefinidos (omite los que ya existen)">📋 Precargar datos</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalCliente(null)">+ Nuevo</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabla" id="tabla-clientes">
          <thead><tr>
            <th>Nombre</th><th>RUC / DNI</th><th>Tipo</th>
            <th>Email</th><th>Teléfono</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-clientes"><tr><td colspan="7" class="text-center text-muted">Cargando…</td></tr></tbody>
        </table>
      </div>
      <div id="pag-clientes" class="paginacion"></div>
    </div>

    <!-- Modal cliente -->
    <div class="modal-overlay" id="modal-cliente" style="display:none">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3 id="modal-cli-titulo">Nuevo cliente/proveedor</h3>
          <button class="modal-cerrar" onclick="cerrarModalCliente()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-cli" class="alerta-error"></div>
          <input type="hidden" id="cli-id">
          <div class="grid-2">
            <div class="campo col-2">
              <label>Nombre / Razón social <span class="req">*</span></label>
              <input type="text" id="cli-nombre" placeholder="Nombre completo">
            </div>
            <div class="campo">
              <label>RUC / DNI</label>
              <input type="text" id="cli-ruc" placeholder="11 dígitos RUC ó 8 DNI">
            </div>
            <div class="campo">
              <label>Tipo <span class="req">*</span></label>
              <select id="cli-tipof">
                <option value="CLIENTE">Cliente</option>
                <option value="PROVEEDOR">Proveedor</option>
                <option value="AMBOS" selected>Ambos</option>
              </select>
            </div>
            <div class="campo col-2">
              <label>Dirección</label>
              <input type="text" id="cli-direccion" placeholder="Dirección">
            </div>
            <div class="campo">
              <label>Email</label>
              <input type="email" id="cli-email" placeholder="correo@empresa.com">
            </div>
            <div class="campo">
              <label>Teléfono</label>
              <input type="text" id="cli-telefono" placeholder="9XXXXXXXX">
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="cli-activof">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalCliente()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarCliente()" id="btn-guardar-cli">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarClientes();
}

async function cargarClientes() {
  const { data, error } = await _supabase
    .from('empresas_clientes')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre');

  if (error) { mostrarToast('Error al cargar clientes', 'error'); return; }
  clientes_lista = data || [];
  filtrarClientes();
}

function filtrarClientes() {
  const q      = (document.getElementById('cli-buscar')?.value || '').toLowerCase();
  const tipo   = document.getElementById('cli-tipo')?.value || '';
  const activo = document.getElementById('cli-activo')?.value || '';

  clientes_filtrada = clientes_lista.filter(c => {
    const matchQ = !q || c.nombre.toLowerCase().includes(q) || (c.ruc_dni || '').includes(q);
    const matchT = !tipo   || c.tipo === tipo;
    const matchA = activo === '' || String(c.activo) === activo;
    return matchQ && matchT && matchA;
  });
  clientes_pag = 1;
  renderTablaClientes();
}

function renderTablaClientes() {
  const inicio = (clientes_pag - 1) * CLIENTES_POR_PAG;
  const pagina = clientes_filtrada.slice(inicio, inicio + CLIENTES_POR_PAG);
  const tbody  = document.getElementById('tbody-clientes');
  if (!tbody) return;

  if (!pagina.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin resultados</td></tr>';
  } else {
    tbody.innerHTML = pagina.map(c => `
      <tr>
        <td>${escapar(c.nombre)}</td>
        <td>${escapar(c.ruc_dni || '—')}</td>
        <td><span class="badge ${c.tipo === 'CLIENTE' ? 'badge-primario' : c.tipo === 'PROVEEDOR' ? 'badge-warning' : 'badge-info'}">${c.tipo}</span></td>
        <td>${escapar(c.email || '—')}</td>
        <td>${escapar(c.telefono || '—')}</td>
        <td><span class="badge ${c.activo ? 'badge-activo' : 'badge-inactivo'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn-icono" onclick="abrirModalCliente('${c.id}')" title="Editar">✏️</button>
          <button class="btn-icono peligro" onclick="eliminarCliente('${c.id}','${escapar(c.nombre)}')" title="Eliminar">🗑️</button>
        </td>
      </tr>`).join('');
  }

  const total = clientes_filtrada.length;
  const pags  = Math.ceil(total / CLIENTES_POR_PAG);
  const pagEl = document.getElementById('pag-clientes');
  if (pagEl) pagEl.innerHTML = total > CLIENTES_POR_PAG ? `
    <span class="pag-info">${inicio + 1}–${Math.min(inicio + CLIENTES_POR_PAG, total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagCliente(-1)" ${clientes_pag <= 1 ? 'disabled' : ''}>‹</button>
    <span>${clientes_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagCliente(1)"  ${clientes_pag >= pags ? 'disabled' : ''}>›</button>` : '';
}

function cambiarPagCliente(dir) { clientes_pag += dir; renderTablaClientes(); }

function abrirModalCliente(id) {
  const modal = document.getElementById('modal-cliente');
  document.getElementById('alerta-cli').classList.remove('visible');
  if (id) {
    const c = clientes_lista.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modal-cli-titulo').textContent = 'Editar cliente/proveedor';
    document.getElementById('cli-id').value        = c.id;
    document.getElementById('cli-nombre').value    = c.nombre;
    document.getElementById('cli-ruc').value       = c.ruc_dni || '';
    document.getElementById('cli-tipof').value     = c.tipo;
    document.getElementById('cli-direccion').value = c.direccion || '';
    document.getElementById('cli-email').value     = c.email || '';
    document.getElementById('cli-telefono').value  = c.telefono || '';
    document.getElementById('cli-activof').value   = String(c.activo);
  } else {
    document.getElementById('modal-cli-titulo').textContent = 'Nuevo cliente/proveedor';
    ['cli-id','cli-nombre','cli-ruc','cli-direccion','cli-email','cli-telefono'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('cli-tipof').value   = 'AMBOS';
    document.getElementById('cli-activof').value = 'true';
  }
  modal.style.display = 'flex';
}

function cerrarModalCliente() {
  document.getElementById('modal-cliente').style.display = 'none';
}

async function guardarCliente() {
  const nombre = document.getElementById('cli-nombre').value.trim();
  const ruc    = document.getElementById('cli-ruc').value.trim();
  const alerta = document.getElementById('alerta-cli');
  const btn    = document.getElementById('btn-guardar-cli');

  alerta.classList.remove('visible');
  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  if (ruc && ruc.length !== 11 && ruc.length !== 8) {
    alerta.textContent = 'RUC debe tener 11 dígitos o DNI 8 dígitos.';
    alerta.classList.add('visible'); return;
  }

  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('cli-id').value;

  const payload = {
    empresa_operadora_id: empresa_activa.id,
    nombre,
    ruc_dni:    ruc || null,
    tipo:       document.getElementById('cli-tipof').value,
    direccion:  document.getElementById('cli-direccion').value.trim() || null,
    email:      document.getElementById('cli-email').value.trim() || null,
    telefono:   document.getElementById('cli-telefono').value.trim() || null,
    activo:     document.getElementById('cli-activof').value === 'true',
  };

  const { error } = id
    ? await _supabase.from('empresas_clientes').update(payload).eq('id', id)
    : await _supabase.from('empresas_clientes').insert(payload);

  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = 'Error al guardar: ' + error.message; alerta.classList.add('visible'); return; }

  mostrarToast(id ? 'Cliente actualizado' : 'Cliente creado', 'exito');
  cerrarModalCliente();
  await cargarClientes();
}

async function eliminarCliente(id, nombre) {
  const ok = await confirmar(`¿Eliminar "${nombre}"?`);
  if (!ok) return;
  const { error } = await _supabase.from('empresas_clientes').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado correctamente', 'exito');
  await cargarClientes();
}

async function precargarClientes() {
  const DEFAULT = [
    'AFP','Banco BCP','Club Retamas','EPA SAC','EPS',
    'ESTADO DE CUENTA','FIBRAFORTE S.A.','GEOMECANICA','Hidromedick',
    'Huaraz','Impuesto BCP','Instituto','Jesús del Norte',
    'JVÑ GENERAL SERVICES SAC','La victoria','Mall bellavista',
    'MANTENIMIENTO BCP','Medicentro','MedickCenter',
    'PEVAL CORPORATION E.I.R.L.','San Gabriel','San Juan Bautista',
    'San Pablo','Santa Martha','SUPESA','TEMPLO - SAN PABLO','Torre San Pedro',
  ];
  const existentes = new Set(clientes_lista.map(c => c.nombre.toLowerCase()));
  const nuevos = DEFAULT.filter(n => !existentes.has(n.toLowerCase()));
  if (!nuevos.length) { mostrarToast('Todos los proveedores predefinidos ya están cargados.', 'info'); return; }
  if (!await confirmar(`¿Precargar ${nuevos.length} empresa(s)/proveedor(es) que no están registrados?`)) return;
  const { error } = await _supabase.from('empresas_clientes').insert(
    nuevos.map(n => ({ empresa_operadora_id: empresa_activa.id, nombre: n, tipo: 'PROVEEDOR', activo: true }))
  );
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ ${nuevos.length} proveedor(es) precargados.`, 'exito');
  await cargarClientes();
}

function exportarClientesExcel() {
  if (!clientes_filtrada.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const rows = clientes_filtrada.map(c => ({
    Nombre: c.nombre, 'RUC/DNI': c.ruc_dni || '', Tipo: c.tipo,
    Email: c.email || '', Teléfono: c.telefono || '',
    Dirección: c.direccion || '', Estado: c.activo ? 'Activo' : 'Inactivo',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, `clientes_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
