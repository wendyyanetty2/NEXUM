// ═══════════════════════════════════════════════════════════════
// Catálogos — Autorizaciones
// ═══════════════════════════════════════════════════════════════

let autorizaciones_lista = [];

async function renderTabAutorizaciones(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <input id="aut-buscar" type="text" class="input-buscar" placeholder="Buscar nombre o cargo…"
               oninput="renderTablaAutorizaciones()" style="max-width:280px">
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarAutorizacionesExcel()">⬇ Excel</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalAutorizacion(null)">+ Nuevo</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Cargo</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tbody-autorizaciones"></tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" id="modal-autorizacion" style="display:none">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 id="modal-aut-titulo">Nueva autorización</h3>
          <button class="modal-cerrar" onclick="cerrarModalAutorizacion()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-aut" class="alerta-error"></div>
          <input type="hidden" id="aut-id">
          <div class="campo">
            <label>Nombre completo <span class="req">*</span></label>
            <input type="text" id="aut-nombre" placeholder="Nombres y apellidos">
          </div>
          <div class="campo">
            <label>Cargo</label>
            <input type="text" id="aut-cargo" placeholder="Gerente, Director, etc.">
          </div>
          <div class="campo">
            <label>Estado</label>
            <select id="aut-activof">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalAutorizacion()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarAutorizacion()" id="btn-guardar-aut">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarAutorizaciones();
}

async function cargarAutorizaciones() {
  const { data } = await _supabase
    .from('autorizaciones')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre');
  autorizaciones_lista = data || [];
  renderTablaAutorizaciones();
}

function renderTablaAutorizaciones() {
  const q    = (document.getElementById('aut-buscar')?.value || '').toLowerCase();
  const filt = autorizaciones_lista.filter(a =>
    !q || a.nombre.toLowerCase().includes(q) || (a.cargo || '').toLowerCase().includes(q)
  );
  const tbody = document.getElementById('tbody-autorizaciones');
  if (!tbody) return;
  tbody.innerHTML = filt.length ? filt.map(a => `
    <tr>
      <td>${escapar(a.nombre)}</td>
      <td>${escapar(a.cargo || '—')}</td>
      <td><span class="badge ${a.activo ? 'badge-activo' : 'badge-inactivo'}">${a.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalAutorizacion('${a.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarAutorizacion('${a.id}','${escapar(a.nombre)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="4" class="text-center text-muted">Sin resultados</td></tr>';
}

function abrirModalAutorizacion(id) {
  document.getElementById('alerta-aut').classList.remove('visible');
  if (id) {
    const a = autorizaciones_lista.find(x => x.id === id);
    document.getElementById('modal-aut-titulo').textContent = 'Editar autorización';
    document.getElementById('aut-id').value      = a.id;
    document.getElementById('aut-nombre').value  = a.nombre;
    document.getElementById('aut-cargo').value   = a.cargo || '';
    document.getElementById('aut-activof').value = String(a.activo);
  } else {
    document.getElementById('modal-aut-titulo').textContent = 'Nueva autorización';
    document.getElementById('aut-id').value = '';
    document.getElementById('aut-nombre').value  = '';
    document.getElementById('aut-cargo').value   = '';
    document.getElementById('aut-activof').value = 'true';
  }
  document.getElementById('modal-autorizacion').style.display = 'flex';
}
function cerrarModalAutorizacion() { document.getElementById('modal-autorizacion').style.display = 'none'; }

async function guardarAutorizacion() {
  const nombre = document.getElementById('aut-nombre').value.trim();
  const alerta = document.getElementById('alerta-aut');
  const btn    = document.getElementById('btn-guardar-aut');
  alerta.classList.remove('visible');
  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('aut-id').value;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    nombre,
    cargo:  document.getElementById('aut-cargo').value.trim() || null,
    activo: document.getElementById('aut-activof').value === 'true',
  };
  const { error } = id
    ? await _supabase.from('autorizaciones').update(payload).eq('id', id)
    : await _supabase.from('autorizaciones').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Actualizado' : 'Creado', 'exito');
  cerrarModalAutorizacion();
  await cargarAutorizaciones();
}

async function eliminarAutorizacion(id, nombre) {
  if (!await confirmar(`¿Eliminar "${nombre}"?`)) return;
  const { error } = await _supabase.from('autorizaciones').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarAutorizaciones();
}

function exportarAutorizacionesExcel() {
  const rows = autorizaciones_lista.map(a => ({ Nombre: a.nombre, Cargo: a.cargo || '', Estado: a.activo ? 'Activo' : 'Inactivo' }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Autorizaciones');
  XLSX.writeFile(wb, `autorizaciones_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
