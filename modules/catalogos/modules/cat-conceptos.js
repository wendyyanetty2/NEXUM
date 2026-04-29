// ═══════════════════════════════════════════════════════════════
// Catálogos — Conceptos (rubros de gasto/ingreso)
// ═══════════════════════════════════════════════════════════════

let conceptos_lista = [];

async function renderTabConceptos(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="con-buscar" type="text" class="input-buscar" placeholder="Buscar concepto…"
                 oninput="renderTablaConceptos()" style="max-width:240px">
          <select id="con-tipo" onchange="renderTablaConceptos()" class="input-buscar" style="max-width:160px">
            <option value="">Todos los tipos</option>
            <option value="GASTO">Gasto</option>
            <option value="INGRESO">Ingreso</option>
            <option value="AMBOS">Ambos</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarConceptosExcel()">⬇ Excel</button>
          <button class="btn btn-secundario btn-sm" onclick="precargarConceptos()" title="Insertar la lista de conceptos predefinidos (omite los que ya existen)">📋 Precargar datos</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalConcepto(null)">+ Nuevo</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tbody-conceptos"></tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" id="modal-concepto" style="display:none">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 id="modal-con-titulo">Nuevo concepto</h3>
          <button class="modal-cerrar" onclick="cerrarModalConcepto()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-con" class="alerta-error"></div>
          <input type="hidden" id="con-id">
          <div class="campo">
            <label>Nombre <span class="req">*</span></label>
            <input type="text" id="con-nombre" placeholder="Nombre del concepto">
          </div>
          <div class="campo">
            <label>Tipo</label>
            <select id="con-tipof">
              <option value="GASTO">Gasto</option>
              <option value="INGRESO">Ingreso</option>
              <option value="AMBOS" selected>Ambos</option>
            </select>
          </div>
          <div class="campo">
            <label>Estado</label>
            <select id="con-activof">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalConcepto()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarConcepto()" id="btn-guardar-con">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarConceptos();
}

async function cargarConceptos() {
  const { data } = await _supabase
    .from('conceptos')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre');
  conceptos_lista = data || [];
  renderTablaConceptos();
}

function renderTablaConceptos() {
  const q    = (document.getElementById('con-buscar')?.value || '').toLowerCase();
  const tipo = document.getElementById('con-tipo')?.value || '';
  const filt = conceptos_lista.filter(c =>
    (!q || c.nombre.toLowerCase().includes(q)) &&
    (!tipo || c.tipo === tipo)
  );
  const tbody = document.getElementById('tbody-conceptos');
  if (!tbody) return;
  tbody.innerHTML = filt.length ? filt.map(c => `
    <tr>
      <td>${escapar(c.nombre)}</td>
      <td><span class="badge ${c.tipo === 'GASTO' ? 'badge-warning' : c.tipo === 'INGRESO' ? 'badge-activo' : 'badge-info'}">${c.tipo}</span></td>
      <td><span class="badge ${c.activo ? 'badge-activo' : 'badge-inactivo'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalConcepto('${c.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarConcepto('${c.id}','${escapar(c.nombre)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="4" class="text-center text-muted">Sin resultados</td></tr>';
}

function abrirModalConcepto(id) {
  document.getElementById('alerta-con').classList.remove('visible');
  if (id) {
    const c = conceptos_lista.find(x => x.id === id);
    document.getElementById('modal-con-titulo').textContent = 'Editar concepto';
    document.getElementById('con-id').value      = c.id;
    document.getElementById('con-nombre').value  = c.nombre;
    document.getElementById('con-tipof').value   = c.tipo;
    document.getElementById('con-activof').value = String(c.activo);
  } else {
    document.getElementById('modal-con-titulo').textContent = 'Nuevo concepto';
    document.getElementById('con-id').value = '';
    document.getElementById('con-nombre').value  = '';
    document.getElementById('con-tipof').value   = 'AMBOS';
    document.getElementById('con-activof').value = 'true';
  }
  document.getElementById('modal-concepto').style.display = 'flex';
}
function cerrarModalConcepto() { document.getElementById('modal-concepto').style.display = 'none'; }

async function guardarConcepto() {
  const nombre = document.getElementById('con-nombre').value.trim();
  const alerta = document.getElementById('alerta-con');
  const btn    = document.getElementById('btn-guardar-con');
  alerta.classList.remove('visible');
  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('con-id').value;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    nombre,
    tipo:   document.getElementById('con-tipof').value,
    activo: document.getElementById('con-activof').value === 'true',
  };
  const { error } = id
    ? await _supabase.from('conceptos').update(payload).eq('id', id)
    : await _supabase.from('conceptos').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Concepto actualizado' : 'Concepto creado', 'exito');
  cerrarModalConcepto();
  await cargarConceptos();
}

async function eliminarConcepto(id, nombre) {
  if (!await confirmar(`¿Eliminar concepto "${nombre}"?`)) return;
  const { error } = await _supabase.from('conceptos').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarConceptos();
}

function exportarConceptosExcel() {
  if (!conceptos_lista.length) { mostrarToast('No hay datos', 'atencion'); return; }
  const rows = conceptos_lista.map(c => ({ Nombre: c.nombre, Tipo: c.tipo, Estado: c.activo ? 'Activo' : 'Inactivo' }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conceptos');
  XLSX.writeFile(wb, `conceptos_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function precargarConceptos() {
  const CONCEPTOS_DEFAULT = [
    '1° Quincena','2° Quincena','AFP','Almuerzo','Alquiler',
    'Banca BCP','Cena','Certificación','Cochera','Combustible',
    'Comisión','Comisión BCP','Compras','Cursos','Declaración',
    'Depósitos','Desayuno','Devolución','EPS','Estado de Cuenta BCP',
    'Examen Médico','Impuesto BCP','Liquidación','Mantenimiento BCP','NPS',
    'Peaje','Planilla De Movilidad','Préstamo','Reembolso','RH',
    'SCTR','Seguro','Servicio','SSOMA','Trámites','Ventas',
  ];

  const existentes = new Set(conceptos_lista.map(c => c.nombre.toLowerCase()));
  const nuevos = CONCEPTOS_DEFAULT.filter(n => !existentes.has(n.toLowerCase()));

  if (!nuevos.length) {
    mostrarToast('Todos los conceptos predefinidos ya están cargados.', 'info');
    return;
  }

  if (!await confirmar(`¿Precargar ${nuevos.length} concepto(s) que no están registrados?`)) return;

  const payload = nuevos.map(n => ({
    empresa_operadora_id: empresa_activa.id,
    nombre: n,
    tipo: 'AMBOS',
    activo: true,
  }));

  const { error } = await _supabase.from('conceptos').insert(payload);
  if (error) { mostrarToast('Error al precargar: ' + error.message, 'error'); return; }
  mostrarToast(`✓ ${nuevos.length} concepto(s) precargados correctamente.`, 'exito');
  await cargarConceptos();
}
