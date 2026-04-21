// ═══════════════════════════════════════════════════════════════
// Tesorería — Cuentas bancarias
// ═══════════════════════════════════════════════════════════════

let cuentas_lista = [];

async function renderTabCuentas(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Resumen de saldos -->
      <div class="grid-3" id="saldos-grid" style="margin-bottom:24px;gap:12px"></div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="cb-buscar" type="text" class="input-buscar" placeholder="Buscar cuenta…"
                 oninput="renderTablaCuentas()" style="max-width:240px">
          <select id="cb-moneda" onchange="renderTablaCuentas()" class="input-buscar" style="max-width:130px">
            <option value="">Todas las monedas</option>
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarCuentasExcel()">⬇ Excel</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalCuenta(null)">+ Nueva cuenta</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Alias / Nombre</th><th>Banco</th><th>Número de cuenta</th>
            <th>CCI</th><th>Moneda</th><th>Saldo inicial</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-cuentas"></tbody>
        </table>
      </div>
    </div>

    <!-- Modal cuenta bancaria -->
    <div class="modal-overlay" id="modal-cuenta" style="display:none">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3 id="modal-cb-titulo">Nueva cuenta bancaria</h3>
          <button class="modal-cerrar" onclick="cerrarModalCuenta()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-cb" class="alerta-error"></div>
          <input type="hidden" id="cb-id">
          <div class="grid-2">
            <div class="campo col-2">
              <label>Nombre / Alias <span class="req">*</span></label>
              <input type="text" id="cb-alias" placeholder="Ej: BCP Soles Principal">
            </div>
            <div class="campo">
              <label>Banco <span class="req">*</span></label>
              <select id="cb-banco"></select>
            </div>
            <div class="campo">
              <label>Moneda</label>
              <select id="cb-monedaf">
                <option value="PEN">PEN — Soles</option>
                <option value="USD">USD — Dólares</option>
                <option value="EUR">EUR — Euros</option>
              </select>
            </div>
            <div class="campo">
              <label>Número de cuenta <span class="req">*</span></label>
              <input type="text" id="cb-numero" placeholder="Número de cuenta">
            </div>
            <div class="campo">
              <label>CCI (20 dígitos)</label>
              <input type="text" id="cb-cci" maxlength="20" placeholder="CCI interbancario">
            </div>
            <div class="campo">
              <label>Saldo inicial (S/.)</label>
              <input type="number" id="cb-saldo" min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="cb-activof">
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalCuenta()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarCuenta()" id="btn-guardar-cb">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarCuentas();
  await _cargarBancosCB();
}

async function cargarCuentas() {
  const { data } = await _supabase
    .from('cuentas_bancarias')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre_alias');
  cuentas_lista = data || [];
  _renderSaldos();
  renderTablaCuentas();
}

function _renderSaldos() {
  const porMoneda = {};
  cuentas_lista.filter(c => c.activo).forEach(c => {
    if (!porMoneda[c.moneda]) porMoneda[c.moneda] = 0;
    porMoneda[c.moneda] += parseFloat(c.saldo_inicial || 0);
  });
  const grid = document.getElementById('saldos-grid');
  if (!grid) return;
  const iconos = { PEN: '🇵🇪', USD: '🇺🇸', EUR: '🇪🇺' };
  grid.innerHTML = Object.entries(porMoneda).map(([mon, total]) => `
    <div class="stat-card">
      <div class="stat-icono azul">${iconos[mon] || '💰'}</div>
      <div class="stat-info">
        <div class="numero">${formatearMoneda(total, mon)}</div>
        <div class="etiqueta">Total cuentas ${mon}</div>
      </div>
    </div>`).join('') +
    `<div class="stat-card">
      <div class="stat-icono verde">🏦</div>
      <div class="stat-info">
        <div class="numero">${cuentas_lista.filter(c => c.activo).length}</div>
        <div class="etiqueta">Cuentas activas</div>
      </div>
    </div>`;
}

function renderTablaCuentas() {
  const q      = (document.getElementById('cb-buscar')?.value || '').toLowerCase();
  const moneda = document.getElementById('cb-moneda')?.value || '';
  const filt   = cuentas_lista.filter(c =>
    (!q || c.nombre_alias.toLowerCase().includes(q) || c.numero_cuenta.includes(q)) &&
    (!moneda || c.moneda === moneda)
  );
  const tbody = document.getElementById('tbody-cuentas');
  if (!tbody) return;
  tbody.innerHTML = filt.length ? filt.map(c => `
    <tr>
      <td><strong>${escapar(c.nombre_alias)}</strong></td>
      <td>${escapar(c.banco_codigo || '—')}</td>
      <td class="text-mono">${escapar(c.numero_cuenta)}</td>
      <td class="text-mono text-sm">${escapar(c.cci || '—')}</td>
      <td><span class="badge badge-info">${c.moneda}</span></td>
      <td class="text-right">${formatearMoneda(c.saldo_inicial || 0, c.moneda)}</td>
      <td><span class="badge ${c.activo ? 'badge-activo' : 'badge-inactivo'}">${c.activo ? 'Activa' : 'Inactiva'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalCuenta('${c.id}')">✏️</button>
        <button class="btn-icono" onclick="verMovimientosCuenta('${c.id}')" title="Ver movimientos">📊</button>
        <button class="btn-icono peligro" onclick="eliminarCuenta('${c.id}','${escapar(c.nombre_alias)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="8" class="text-center text-muted">Sin cuentas registradas</td></tr>';
}

async function _cargarBancosCB() {
  const { data } = await _supabase
    .from('catalogo_bancos')
    .select('codigo, nombre')
    .eq('activo', true)
    .order('nombre');
  const sel = document.getElementById('cb-banco');
  if (!sel || !data) return;
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    data.map(b => `<option value="${b.codigo}">${escapar(b.nombre)}</option>`).join('');
}

function abrirModalCuenta(id) {
  document.getElementById('alerta-cb').classList.remove('visible');
  if (id) {
    const c = cuentas_lista.find(x => x.id === id);
    document.getElementById('modal-cb-titulo').textContent = 'Editar cuenta bancaria';
    document.getElementById('cb-id').value      = c.id;
    document.getElementById('cb-alias').value   = c.nombre_alias;
    document.getElementById('cb-numero').value  = c.numero_cuenta;
    document.getElementById('cb-cci').value     = c.cci || '';
    document.getElementById('cb-saldo').value   = c.saldo_inicial || 0;
    document.getElementById('cb-monedaf').value = c.moneda;
    document.getElementById('cb-activof').value = String(c.activo);
    setTimeout(() => { const b = document.getElementById('cb-banco'); if (b) b.value = c.banco_codigo || ''; }, 50);
  } else {
    document.getElementById('modal-cb-titulo').textContent = 'Nueva cuenta bancaria';
    ['cb-id','cb-alias','cb-numero','cb-cci'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('cb-saldo').value   = '0';
    document.getElementById('cb-monedaf').value = 'PEN';
    document.getElementById('cb-activof').value = 'true';
  }
  document.getElementById('modal-cuenta').style.display = 'flex';
}
function cerrarModalCuenta() { document.getElementById('modal-cuenta').style.display = 'none'; }

async function guardarCuenta() {
  const alias  = document.getElementById('cb-alias').value.trim();
  const numero = document.getElementById('cb-numero').value.trim();
  const banco  = document.getElementById('cb-banco').value;
  const alerta = document.getElementById('alerta-cb');
  const btn    = document.getElementById('btn-guardar-cb');
  alerta.classList.remove('visible');
  if (!alias)  { alerta.textContent = 'El alias es obligatorio.'; alerta.classList.add('visible'); return; }
  if (!banco)  { alerta.textContent = 'Selecciona un banco.'; alerta.classList.add('visible'); return; }
  if (!numero) { alerta.textContent = 'El número de cuenta es obligatorio.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('cb-id').value;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    nombre_alias:   alias,
    banco_codigo:   banco,
    numero_cuenta:  numero,
    cci:            document.getElementById('cb-cci').value.trim() || null,
    moneda:         document.getElementById('cb-monedaf').value,
    saldo_inicial:  parseFloat(document.getElementById('cb-saldo').value) || 0,
    activo:         document.getElementById('cb-activof').value === 'true',
  };
  const { error } = id
    ? await _supabase.from('cuentas_bancarias').update(payload).eq('id', id)
    : await _supabase.from('cuentas_bancarias').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Cuenta actualizada' : 'Cuenta creada', 'exito');
  cerrarModalCuenta();
  await cargarCuentas();
}

async function eliminarCuenta(id, nombre) {
  if (!await confirmar(`¿Eliminar cuenta "${nombre}"? Se eliminarán todos sus movimientos.`)) return;
  const { error } = await _supabase.from('cuentas_bancarias').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Cuenta eliminada', 'exito');
  await cargarCuentas();
}

function verMovimientosCuenta(id) {
  activarTab('movimientos');
  setTimeout(() => {
    const sel = document.getElementById('mov-cuenta');
    if (sel) { sel.value = id; filtrarMovimientos(); }
  }, 300);
}

function exportarCuentasExcel() {
  const rows = cuentas_lista.map(c => ({
    Alias: c.nombre_alias, Banco: c.banco_codigo || '',
    Cuenta: c.numero_cuenta, CCI: c.cci || '',
    Moneda: c.moneda, 'Saldo Inicial': c.saldo_inicial || 0,
    Estado: c.activo ? 'Activa' : 'Inactiva',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cuentas');
  XLSX.writeFile(wb, `cuentas_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
