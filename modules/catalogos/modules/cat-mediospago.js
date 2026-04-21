// ═══════════════════════════════════════════════════════════════
// Catálogos — Medios de pago
// ═══════════════════════════════════════════════════════════════

let mediospago_lista = [];

async function renderTabMediosPago(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="mp-buscar" type="text" class="input-buscar" placeholder="Buscar medio de pago…"
                 oninput="renderTablaMediosPago()" style="max-width:240px">
          <select id="mp-tipo" onchange="renderTablaMediosPago()" class="input-buscar" style="max-width:160px">
            <option value="">Todos los tipos</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CHEQUE">Cheque</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="YAPE">Yape</option>
            <option value="PLIN">Plin</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarMediosPagoExcel()">⬇ Excel</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalMedioPago(null)">+ Nuevo</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Banco</th><th>Cuenta / CCI</th><th>Moneda</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tbody-mediospago"></tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" id="modal-mediopago" style="display:none">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3 id="modal-mp-titulo">Nuevo medio de pago</h3>
          <button class="modal-cerrar" onclick="cerrarModalMedioPago()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-mp" class="alerta-error"></div>
          <input type="hidden" id="mp-id">
          <div class="grid-2">
            <div class="campo col-2">
              <label>Nombre <span class="req">*</span></label>
              <input type="text" id="mp-nombre" placeholder="Ej: BCP Soles Principal">
            </div>
            <div class="campo">
              <label>Tipo <span class="req">*</span></label>
              <select id="mp-tipof">
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div class="campo">
              <label>Moneda</label>
              <select id="mp-moneda">
                <option value="PEN">PEN — Soles</option>
                <option value="USD">USD — Dólares</option>
                <option value="EUR">EUR — Euros</option>
              </select>
            </div>
            <div class="campo">
              <label>Banco</label>
              <select id="mp-banco"></select>
            </div>
            <div class="campo">
              <label>Número de cuenta</label>
              <input type="text" id="mp-cuenta" placeholder="Nro de cuenta">
            </div>
            <div class="campo">
              <label>CCI</label>
              <input type="text" id="mp-cci" placeholder="20 dígitos">
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="mp-activof">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalMedioPago()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarMedioPago()" id="btn-guardar-mp">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarMediosPago();
  await _cargarBancosMP();
}

async function cargarMediosPago() {
  const { data } = await _supabase
    .from('medios_pago')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre');
  mediospago_lista = data || [];
  renderTablaMediosPago();
}

async function _cargarBancosMP() {
  const { data } = await _supabase
    .from('catalogo_bancos')
    .select('codigo, nombre')
    .eq('activo', true)
    .order('nombre');
  const sel = document.getElementById('mp-banco');
  if (!sel || !data) return;
  sel.innerHTML = '<option value="">— Sin banco —</option>' +
    data.map(b => `<option value="${b.codigo}">${escapar(b.nombre)}</option>`).join('');
}

function renderTablaMediosPago() {
  const q    = (document.getElementById('mp-buscar')?.value || '').toLowerCase();
  const tipo = document.getElementById('mp-tipo')?.value || '';
  const filt = mediospago_lista.filter(m =>
    (!q || m.nombre.toLowerCase().includes(q)) &&
    (!tipo || m.tipo === tipo)
  );
  const tbody = document.getElementById('tbody-mediospago');
  if (!tbody) return;
  tbody.innerHTML = filt.length ? filt.map(m => `
    <tr>
      <td>${escapar(m.nombre)}</td>
      <td><span class="badge badge-info">${m.tipo}</span></td>
      <td>${escapar(m.banco_codigo || '—')}</td>
      <td class="text-sm">${escapar(m.numero_cuenta || '—')}${m.cci ? '<br><span class="text-muted">CCI: ' + escapar(m.cci) + '</span>' : ''}</td>
      <td>${m.moneda}</td>
      <td><span class="badge ${m.activo ? 'badge-activo' : 'badge-inactivo'}">${m.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalMedioPago('${m.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarMedioPago('${m.id}','${escapar(m.nombre)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="7" class="text-center text-muted">Sin resultados</td></tr>';
}

function abrirModalMedioPago(id) {
  document.getElementById('alerta-mp').classList.remove('visible');
  if (id) {
    const m = mediospago_lista.find(x => x.id === id);
    document.getElementById('modal-mp-titulo').textContent = 'Editar medio de pago';
    document.getElementById('mp-id').value      = m.id;
    document.getElementById('mp-nombre').value  = m.nombre;
    document.getElementById('mp-tipof').value   = m.tipo;
    document.getElementById('mp-moneda').value  = m.moneda || 'PEN';
    document.getElementById('mp-cuenta').value  = m.numero_cuenta || '';
    document.getElementById('mp-cci').value     = m.cci || '';
    document.getElementById('mp-activof').value = String(m.activo);
    setTimeout(() => { const sel = document.getElementById('mp-banco'); if (sel) sel.value = m.banco_codigo || ''; }, 50);
  } else {
    document.getElementById('modal-mp-titulo').textContent = 'Nuevo medio de pago';
    ['mp-id','mp-nombre','mp-cuenta','mp-cci'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('mp-tipof').value   = 'TRANSFERENCIA';
    document.getElementById('mp-moneda').value  = 'PEN';
    document.getElementById('mp-activof').value = 'true';
  }
  document.getElementById('modal-mediopago').style.display = 'flex';
}
function cerrarModalMedioPago() { document.getElementById('modal-mediopago').style.display = 'none'; }

async function guardarMedioPago() {
  const nombre = document.getElementById('mp-nombre').value.trim();
  const alerta = document.getElementById('alerta-mp');
  const btn    = document.getElementById('btn-guardar-mp');
  alerta.classList.remove('visible');
  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('mp-id').value;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    nombre,
    tipo:          document.getElementById('mp-tipof').value,
    moneda:        document.getElementById('mp-moneda').value,
    banco_codigo:  document.getElementById('mp-banco').value || null,
    numero_cuenta: document.getElementById('mp-cuenta').value.trim() || null,
    cci:           document.getElementById('mp-cci').value.trim() || null,
    activo:        document.getElementById('mp-activof').value === 'true',
  };
  const { error } = id
    ? await _supabase.from('medios_pago').update(payload).eq('id', id)
    : await _supabase.from('medios_pago').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Actualizado' : 'Creado', 'exito');
  cerrarModalMedioPago();
  await cargarMediosPago();
}

async function eliminarMedioPago(id, nombre) {
  if (!await confirmar(`¿Eliminar "${nombre}"?`)) return;
  const { error } = await _supabase.from('medios_pago').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarMediosPago();
}

function exportarMediosPagoExcel() {
  const rows = mediospago_lista.map(m => ({
    Nombre: m.nombre, Tipo: m.tipo, Banco: m.banco_codigo || '',
    Cuenta: m.numero_cuenta || '', CCI: m.cci || '',
    Moneda: m.moneda, Estado: m.activo ? 'Activo' : 'Inactivo',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MediosPago');
  XLSX.writeFile(wb, `medios_pago_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
