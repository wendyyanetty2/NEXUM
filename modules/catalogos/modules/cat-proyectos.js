// ═══════════════════════════════════════════════════════════════
// Catálogos — Proyectos
// ═══════════════════════════════════════════════════════════════

let proyectos_lista = [];
let proyectos_clientes = [];

async function renderTabProyectos(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <input id="pro-buscar" type="text" class="input-buscar" placeholder="Buscar proyecto…"
               oninput="renderTablaProyectos()" style="max-width:280px">
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarProyectosExcel()">⬇ Excel</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalProyecto(null)">+ Nuevo</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Cliente</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tbody-proyectos"></tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" id="modal-proyecto" style="display:none">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3 id="modal-pro-titulo">Nuevo proyecto</h3>
          <button class="modal-cerrar" onclick="cerrarModalProyecto()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-pro" class="alerta-error"></div>
          <input type="hidden" id="pro-id">
          <div class="campo">
            <label>Nombre del proyecto <span class="req">*</span></label>
            <input type="text" id="pro-nombre" placeholder="Nombre descriptivo">
          </div>
          <div class="campo">
            <label>Cliente vinculado</label>
            <select id="pro-cliente">
              <option value="">— Sin cliente —</option>
            </select>
          </div>
          <div class="campo">
            <label>Descripción</label>
            <textarea id="pro-descripcion" rows="3" placeholder="Descripción opcional…"></textarea>
          </div>
          <div class="campo">
            <label>Estado</label>
            <select id="pro-activof">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalProyecto()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarProyecto()" id="btn-guardar-pro">Guardar</button>
        </div>
      </div>
    </div>`;

  await Promise.all([cargarProyectos(), cargarClientesParaProyectos()]);
}

async function cargarProyectos() {
  const { data } = await _supabase
    .from('proyectos')
    .select('*, empresas_clientes(nombre)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre');
  proyectos_lista = data || [];
  renderTablaProyectos();
}

async function cargarClientesParaProyectos() {
  const { data } = await _supabase
    .from('empresas_clientes')
    .select('id, nombre')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('activo', true)
    .order('nombre');
  proyectos_clientes = data || [];
}

function renderTablaProyectos() {
  const q    = (document.getElementById('pro-buscar')?.value || '').toLowerCase();
  const filt = proyectos_lista.filter(p =>
    !q || p.nombre.toLowerCase().includes(q) || (p.descripcion || '').toLowerCase().includes(q)
  );
  const tbody = document.getElementById('tbody-proyectos');
  if (!tbody) return;
  tbody.innerHTML = filt.length ? filt.map(p => `
    <tr>
      <td>${escapar(p.nombre)}</td>
      <td>${escapar(p.empresas_clientes?.nombre || '—')}</td>
      <td class="text-muted text-sm">${escapar((p.descripcion || '').slice(0, 60))}${p.descripcion?.length > 60 ? '…' : ''}</td>
      <td><span class="badge ${p.activo ? 'badge-activo' : 'badge-inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalProyecto('${p.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarProyecto('${p.id}','${escapar(p.nombre)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="5" class="text-center text-muted">Sin resultados</td></tr>';
}

function _poblarSelectClientes(selectedId) {
  const sel = document.getElementById('pro-cliente');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sin cliente —</option>' +
    proyectos_clientes.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapar(c.nombre)}</option>`).join('');
}

function abrirModalProyecto(id) {
  document.getElementById('alerta-pro').classList.remove('visible');
  if (id) {
    const p = proyectos_lista.find(x => x.id === id);
    document.getElementById('modal-pro-titulo').textContent = 'Editar proyecto';
    document.getElementById('pro-id').value          = p.id;
    document.getElementById('pro-nombre').value      = p.nombre;
    document.getElementById('pro-descripcion').value = p.descripcion || '';
    document.getElementById('pro-activof').value     = String(p.activo);
    _poblarSelectClientes(p.cliente_id);
  } else {
    document.getElementById('modal-pro-titulo').textContent = 'Nuevo proyecto';
    document.getElementById('pro-id').value          = '';
    document.getElementById('pro-nombre').value      = '';
    document.getElementById('pro-descripcion').value = '';
    document.getElementById('pro-activof').value     = 'true';
    _poblarSelectClientes(null);
  }
  document.getElementById('modal-proyecto').style.display = 'flex';
}
function cerrarModalProyecto() { document.getElementById('modal-proyecto').style.display = 'none'; }

async function guardarProyecto() {
  const nombre = document.getElementById('pro-nombre').value.trim();
  const alerta = document.getElementById('alerta-pro');
  const btn    = document.getElementById('btn-guardar-pro');
  alerta.classList.remove('visible');
  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id    = document.getElementById('pro-id').value;
  const cliId = document.getElementById('pro-cliente').value || null;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    nombre,
    cliente_id:  cliId,
    descripcion: document.getElementById('pro-descripcion').value.trim() || null,
    activo:      document.getElementById('pro-activof').value === 'true',
  };
  const { error } = id
    ? await _supabase.from('proyectos').update(payload).eq('id', id)
    : await _supabase.from('proyectos').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Proyecto actualizado' : 'Proyecto creado', 'exito');
  cerrarModalProyecto();
  await cargarProyectos();
}

async function eliminarProyecto(id, nombre) {
  if (!await confirmar(`¿Eliminar proyecto "${nombre}"?`)) return;
  const { error } = await _supabase.from('proyectos').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarProyectos();
}

function exportarProyectosExcel() {
  const rows = proyectos_lista.map(p => ({
    Nombre: p.nombre,
    Cliente: p.empresas_clientes?.nombre || '',
    Descripción: p.descripcion || '',
    Estado: p.activo ? 'Activo' : 'Inactivo',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Proyectos');
  XLSX.writeFile(wb, `proyectos_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
