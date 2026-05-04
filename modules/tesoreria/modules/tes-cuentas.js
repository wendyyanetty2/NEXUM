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
  // Contar movimientos vinculados antes de mostrar opciones
  const { count } = await _supabase
    .from('movimientos')
    .select('id', { count: 'exact', head: true })
    .eq('cuenta_bancaria_id', id);

  if (!count || count === 0) {
    // Sin movimientos: confirmación simple
    if (!await confirmar(
      `¿Eliminar la cuenta "${nombre}"?\nEsta acción no se puede deshacer.`,
      { btnOk: 'Eliminar', btnColor: '#C53030' }
    )) return;
    const { error } = await _supabase.from('cuentas_bancarias').delete().eq('id', id);
    if (error) { mostrarToast('No se pudo eliminar: ' + error.message, 'error'); return; }
    mostrarToast('Cuenta eliminada', 'exito');
    await cargarCuentas();
  } else {
    // Con movimientos: modal con 3 opciones
    _mostrarModalEliminarCuenta(id, nombre, count);
  }
}

function _mostrarModalEliminarCuenta(id, nombre, cantMovimientos) {
  document.getElementById('modal-del-cuenta')?.remove();
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'modal-del-cuenta';
  m.style.display = 'flex';
  m.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h3>⚠️ Cuenta con movimientos</h3>
        <button class="modal-cerrar"
                onclick="document.getElementById('modal-del-cuenta').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:18px">
          La cuenta <strong>"${escapar(nombre)}"</strong> tiene
          <strong>${cantMovimientos} movimiento(s)</strong> registrado(s).
          ¿Qué deseas hacer?
        </p>

        <div style="display:flex;flex-direction:column;gap:10px">

          <!-- Opción 1: Desactivar -->
          <button onclick="_eliminarCuentaDesactivar('${id}')"
                  style="text-align:left;padding:12px 16px;border:1px solid var(--color-borde);
                         border-radius:var(--radio);background:var(--color-fondo);cursor:pointer;
                         font-family:var(--font);transition:background 0.15s"
                  onmouseover="this.style.background='var(--color-fondo-2)'"
                  onmouseout="this.style.background='var(--color-fondo)'">
            <div style="font-weight:600;margin-bottom:2px">⏸ Desactivar cuenta (recomendado)</div>
            <div style="font-size:12px;color:var(--color-texto-suave)">
              La cuenta queda inactiva y oculta en filtros. El historial de movimientos se conserva.
            </div>
          </button>

          <!-- Opción 2: Eliminar todo -->
          <div style="border:1px solid #FC8181;border-radius:var(--radio);padding:12px 16px">
            <div style="font-weight:600;color:#C53030;margin-bottom:4px">
              🗑️ Eliminar cuenta y sus ${cantMovimientos} movimiento(s)
            </div>
            <div style="font-size:12px;color:var(--color-texto-suave);margin-bottom:10px">
              Esta acción no se puede deshacer. Escribe <strong>CONFIRMAR</strong> para proceder:
            </div>
            <div style="display:flex;gap:8px">
              <input type="text" id="del-cuenta-palabra"
                     placeholder="Escribe CONFIRMAR"
                     style="flex:1;padding:7px 10px;border:1px solid var(--color-borde);
                            border-radius:var(--radio);font-family:var(--font);font-size:13px">
              <button onclick="_eliminarCuentaTotal('${id}')"
                      style="background:#C53030;color:white;border:none;border-radius:var(--radio);
                             padding:0 14px;cursor:pointer;font-family:var(--font);font-size:13px;
                             font-weight:500">
                Eliminar todo
              </button>
            </div>
          </div>

          <!-- Opción 3: Cancelar -->
          <button class="btn btn-secundario"
                  onclick="document.getElementById('modal-del-cuenta').remove()">
            Cancelar
          </button>

        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
}

async function _eliminarCuentaDesactivar(id) {
  document.getElementById('modal-del-cuenta')?.remove();
  const { error } = await _supabase
    .from('cuentas_bancarias').update({ activo: false }).eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Cuenta desactivada. El historial de movimientos se conserva.', 'exito');
  await cargarCuentas();
}

async function _eliminarCuentaTotal(id) {
  const palabra = (document.getElementById('del-cuenta-palabra')?.value || '').trim().toUpperCase();
  if (palabra !== 'CONFIRMAR') {
    mostrarToast('Debes escribir CONFIRMAR para proceder', 'atencion');
    return;
  }
  document.getElementById('modal-del-cuenta')?.remove();
  // Primero eliminar movimientos (FK), luego la cuenta
  await _supabase.from('movimientos').delete().eq('cuenta_bancaria_id', id);
  const { error } = await _supabase.from('cuentas_bancarias').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar: ' + error.message, 'error'); return; }
  mostrarToast('Cuenta y todos sus movimientos han sido eliminados.', 'exito');
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
