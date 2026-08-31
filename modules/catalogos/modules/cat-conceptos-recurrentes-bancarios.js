// ═══════════════════════════════════════════════════════════════
// Catálogos — Conceptos recurrentes bancarios
// Cargos bancarios que se repiten legítimamente (ITF, comisiones,
// mantenimiento de tarjeta, etc.) y que el detector de duplicados
// de Tesorería → Movimientos NO debe tratar como duplicado por el
// solo hecho de compartir monto y descripción con un N° de
// comprobante genérico (00000000/vacío). Ver js/duplicados.js.
// ═══════════════════════════════════════════════════════════════

let crb_lista = [];

async function renderTabConceptosRecurrentesBancarios(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px;max-width:680px">
        Descripciones de cargos bancarios que se repiten cada mes con el mismo monto (impuestos, comisiones).
        El buscador de duplicados de Tesorería solo los agrupa como posible duplicado si además caen en la misma fecha exacta.
      </p>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <input id="crb-buscar" type="text" autocomplete="off" class="input-buscar" placeholder="Buscar concepto…"
               oninput="renderTablaCRB()" style="max-width:280px">
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="precargarCRB()" title="Insertar conceptos predefinidos (omite los que ya existen)">📋 Precargar datos</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalCRB(null)">+ Nuevo</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr><th>Descripción del banco</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tbody-crb"></tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" id="modal-crb" style="display:none">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 id="modal-crb-titulo">Nuevo concepto recurrente</h3>
          <button class="modal-cerrar" onclick="cerrarModalCRB()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-crb" class="alerta-error"></div>
          <input type="hidden" id="crb-id">
          <div class="campo">
            <label>Descripción exacta del banco <span class="req">*</span></label>
            <input type="text" id="crb-nombre" placeholder="Ej: IMPUESTO ITF">
          </div>
          <div class="campo">
            <label>Estado</label>
            <select id="crb-activof">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalCRB()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarCRB()" id="btn-guardar-crb">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarCRB();
}

async function cargarCRB() {
  const { data } = await _supabase
    .from('conceptos_recurrentes_bancarios')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre');
  crb_lista = data || [];
  renderTablaCRB();
}

function renderTablaCRB() {
  const q = (document.getElementById('crb-buscar')?.value || '').toLowerCase();
  const filt = crb_lista.filter(c => !q || c.nombre.toLowerCase().includes(q));
  const tbody = document.getElementById('tbody-crb');
  if (!tbody) return;
  tbody.innerHTML = filt.length ? filt.map(c => `
    <tr>
      <td>${escapar(c.nombre)}</td>
      <td><span class="badge ${c.activo ? 'badge-activo' : 'badge-inactivo'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalCRB('${c.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarCRB('${c.id}','${escapar(c.nombre)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="3" class="text-center text-muted">Sin resultados</td></tr>';
}

function abrirModalCRB(id) {
  document.getElementById('alerta-crb').classList.remove('visible');
  if (id) {
    const c = crb_lista.find(x => x.id === id);
    document.getElementById('modal-crb-titulo').textContent = 'Editar concepto recurrente';
    document.getElementById('crb-id').value      = c.id;
    document.getElementById('crb-nombre').value  = c.nombre;
    document.getElementById('crb-activof').value = String(c.activo);
  } else {
    document.getElementById('modal-crb-titulo').textContent = 'Nuevo concepto recurrente';
    document.getElementById('crb-id').value = '';
    document.getElementById('crb-nombre').value  = '';
    document.getElementById('crb-activof').value = 'true';
  }
  document.getElementById('modal-crb').style.display = 'flex';
}
function cerrarModalCRB() { document.getElementById('modal-crb').style.display = 'none'; }

async function guardarCRB() {
  const nombre = document.getElementById('crb-nombre').value.trim();
  const alerta = document.getElementById('alerta-crb');
  const btn    = document.getElementById('btn-guardar-crb');
  alerta.classList.remove('visible');
  if (!nombre) { alerta.textContent = 'La descripción es obligatoria.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('crb-id').value;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    nombre,
    activo: document.getElementById('crb-activof').value === 'true',
  };
  const { error } = id
    ? await _supabase.from('conceptos_recurrentes_bancarios').update(payload).eq('id', id)
    : await _supabase.from('conceptos_recurrentes_bancarios').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Concepto actualizado' : 'Concepto creado', 'exito');
  cerrarModalCRB();
  await cargarCRB();
}

async function eliminarCRB(id, nombre) {
  if (!await confirmar(`¿Eliminar concepto recurrente "${nombre}"?`)) return;
  const { error } = await _supabase.from('conceptos_recurrentes_bancarios').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarCRB();
}

async function precargarCRB() {
  const DEFAULT = ['IMPUESTO ITF', 'MANT TD ADIC NEG', 'COM.MANTENIM'];
  const existentes = new Set(crb_lista.map(c => c.nombre.toLowerCase()));
  const nuevos = DEFAULT.filter(n => !existentes.has(n.toLowerCase()));
  if (!nuevos.length) { mostrarToast('Todos los conceptos predefinidos ya están cargados.', 'info'); return; }
  if (!await confirmar(`¿Precargar ${nuevos.length} concepto(s) que no están registrados?`)) return;
  const { error } = await _supabase.from('conceptos_recurrentes_bancarios').insert(
    nuevos.map(n => ({ empresa_operadora_id: empresa_activa.id, nombre: n, activo: true }))
  );
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ ${nuevos.length} concepto(s) precargados correctamente.`, 'exito');
  await cargarCRB();
}
