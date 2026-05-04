// ═══════════════════════════════════════════════════════════════
// Tesorería — Cuentas bancarias
// ═══════════════════════════════════════════════════════════════

let cuentas_lista = [];

// ── Bank config map ─────────────────────────────────────────────
const _CB_BANCOS = {
  'BCP':        { bg:'#1A4FA0', fg:'white', abrev:'BCP'  },
  'BBVA':       { bg:'#004481', fg:'white', abrev:'BBVA' },
  'INTERBANK':  { bg:'#007A3D', fg:'white', abrev:'IBK'  },
  'SCOTIABANK': { bg:'#BF0000', fg:'white', abrev:'SCO'  },
  'BANBIF':     { bg:'#6B21A8', fg:'white', abrev:'BIF'  },
  'NACION':     { bg:'#5B2D0F', fg:'white', abrev:'BN'   },
  'PICHINCHA':  { bg:'#D97706', fg:'white', abrev:'PIC'  },
  'MIBANCO':    { bg:'#EA580C', fg:'white', abrev:'MIB'  },
};
const _CB_DEFAULT_BANCO = { bg:'#2D3748', fg:'white', abrev:'???' };

// ── Account number masking ───────────────────────────────────────
function _cbMascaraCuenta(numero) {
  if (!numero) return '—';
  const n = numero.replace(/\s/g,'');
  if (n.length <= 4) return n;
  return '•••• ' + n.slice(-4);
}

// ── Star / principal via localStorage ───────────────────────────
function _cbEsPrincipal(id) {
  return localStorage.getItem('nexum_cb_principal_' + empresa_activa?.id) === id;
}
function _cbTogglePrincipal(id) {
  const key = 'nexum_cb_principal_' + empresa_activa?.id;
  if (localStorage.getItem(key) === id) localStorage.removeItem(key);
  else localStorage.setItem(key, id);
  renderTarjetasCuentas();
}

// ── Banco format hints ───────────────────────────────────────────
const _CB_FORMATOS = {
  'BCP':       'Formato: 000-0000000-0-XX (13 dígitos)',
  'BBVA':      'Formato: 0011-0000-01-00000000-00 (18 dígitos)',
  'INTERBANK': 'Formato: 000-000000000-00 (13 dígitos)',
  'SCOTIABANK':'Formato: 0000000000 (10 dígitos)',
  'BANBIF':    'Formato: 000-000-000000-0',
};
function _cbBancoChange(codigo) {
  const hint = document.getElementById('cb-banco-hint');
  if (hint) hint.textContent = _CB_FORMATOS[codigo?.toUpperCase()] || '';
  const cfg = _CB_BANCOS[codigo?.toUpperCase()] || _CB_DEFAULT_BANCO;
  const preview = document.getElementById('cb-banco-preview');
  if (preview) {
    preview.textContent = cfg.abrev;
    preview.style.background = cfg.bg;
    preview.style.color = cfg.fg;
  }
}

// ── renderTabCuentas ─────────────────────────────────────────────
async function renderTabCuentas(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Resumen de saldos -->
      <div class="grid-3" id="saldos-grid" style="margin-bottom:24px;gap:12px"></div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="cb-buscar" type="text" class="input-buscar" placeholder="Buscar cuenta…"
                 oninput="renderTarjetasCuentas()" style="max-width:240px">
          <select id="cb-moneda" onchange="renderTarjetasCuentas()" class="input-buscar" style="max-width:130px">
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

      <div id="cb-tarjetas-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-top:4px"></div>
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
              <span id="cb-banco-preview" style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:#CBD5E0;color:#2D3748;margin-bottom:6px">???</span>
              <select id="cb-banco" onchange="_cbBancoChange(this.value)"></select>
              <div id="cb-banco-hint" class="text-muted text-sm" style="margin-top:4px;min-height:16px"></div>
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
    </div>

    <style>
      .cb-card { background:var(--color-bg,#fff); border:1px solid var(--color-borde); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; transition:box-shadow 0.2s; }
      .cb-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.1); }
      .cb-card-head { padding:14px 16px; display:flex; justify-content:space-between; align-items:center; }
      .cb-banco-pill { font-size:13px; font-weight:700; letter-spacing:.5px; padding:3px 10px; border-radius:20px; background:rgba(255,255,255,.2); }
      .cb-star-btn { background:none; border:none; cursor:pointer; font-size:18px; line-height:1; padding:0; opacity:.5; transition:opacity .2s,transform .2s; }
      .cb-star-btn.activo { opacity:1; transform:scale(1.15); }
      .cb-card-body { padding:14px 16px; flex:1; }
      .cb-alias { font-weight:600; font-size:14px; margin-bottom:6px; }
      .cb-numero { font-family:monospace; font-size:13px; color:var(--color-texto-suave); margin-bottom:12px; letter-spacing:1px; }
      .cb-saldo-wrap { display:flex; align-items:baseline; gap:8px; }
      .cb-saldo-monto { font-size:22px; font-weight:700; }
      .cb-saldo-label { font-size:11px; color:var(--color-texto-suave); margin-top:4px; }
      .cb-card-foot { padding:10px 16px; border-top:1px solid var(--color-borde); display:flex; gap:6px; }
      .cb-card-foot button { flex:1; padding:7px 4px; border:1px solid var(--color-borde); border-radius:var(--radio,6px); background:none; cursor:pointer; font-family:var(--font); font-size:12px; font-weight:500; transition:all .15s; }
      .cb-card-foot button:hover { background:var(--color-fondo-2,#f7fafc); }
      .cb-card-foot .btn-mov { color:var(--color-primario); border-color:var(--color-primario); }
      .cb-card-foot .btn-danger { color:#C53030; border-color:#FC8181; }
      .cb-card-inactiva { opacity:.6; }
      .cb-principal-banner { background:linear-gradient(135deg,#F6E05E,#ECC94B); color:#744210; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; }
    </style>`;

  await cargarCuentas();
  await _cargarBancosCB();
}

// ── cargarCuentas ────────────────────────────────────────────────
async function cargarCuentas() {
  const { data } = await _supabase
    .from('cuentas_bancarias')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('nombre_alias');
  cuentas_lista = data || [];
  _renderSaldos();
  renderTarjetasCuentas();
}

// ── _renderSaldos ────────────────────────────────────────────────
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

// ── renderTarjetasCuentas ────────────────────────────────────────
function renderTarjetasCuentas() {
  const q      = (document.getElementById('cb-buscar')?.value || '').toLowerCase();
  const moneda = document.getElementById('cb-moneda')?.value || '';
  const filt   = cuentas_lista.filter(c =>
    (!q || c.nombre_alias.toLowerCase().includes(q) || (c.numero_cuenta||'').includes(q) || (c.banco_codigo||'').toLowerCase().includes(q)) &&
    (!moneda || c.moneda === moneda)
  );
  const grid = document.getElementById('cb-tarjetas-grid');
  if (!grid) return;
  if (!filt.length) {
    grid.innerHTML = '<div class="text-center text-muted" style="padding:40px;grid-column:1/-1">Sin cuentas registradas</div>';
    return;
  }
  grid.innerHTML = filt.map(c => {
    const cfg = _CB_BANCOS[c.banco_codigo?.toUpperCase()] || _CB_DEFAULT_BANCO;
    const principal = _cbEsPrincipal(c.id);
    return `
      <div class="cb-card ${!c.activo ? 'cb-card-inactiva' : ''}">
        <div class="cb-card-head" style="background:${cfg.bg};color:${cfg.fg}">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="cb-banco-pill">${cfg.abrev}</span>
            ${principal ? '<span class="cb-principal-banner">Principal</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:${c.activo?'rgba(255,255,255,.25)':'rgba(0,0,0,.25)'}">
              ${c.activo ? 'Activa' : 'Inactiva'}
            </span>
            <button class="cb-star-btn ${principal ? 'activo' : ''}"
                    onclick="_cbTogglePrincipal('${c.id}')"
                    title="${principal ? 'Quitar como principal' : 'Marcar como principal'}">
              ${principal ? '⭐' : '☆'}
            </button>
          </div>
        </div>
        <div class="cb-card-body">
          <div class="cb-alias">${escapar(c.nombre_alias)}</div>
          <div class="cb-numero">${_cbMascaraCuenta(c.numero_cuenta)}</div>
          <div class="cb-saldo-wrap">
            <span class="cb-saldo-monto">${formatearMoneda(c.saldo_inicial || 0, c.moneda)}</span>
            <span class="badge badge-info" style="font-size:10px">${c.moneda}</span>
          </div>
          <div class="cb-saldo-label">Saldo inicial registrado</div>
          ${c.cci ? `<div style="margin-top:8px;font-size:11px;color:var(--color-texto-suave)">CCI: ${c.cci}</div>` : ''}
        </div>
        <div class="cb-card-foot">
          <button class="btn-mov" onclick="verMovimientosCuenta('${c.id}')">📊 Movimientos</button>
          <button onclick="abrirModalCuenta('${c.id}')">✏️ Editar</button>
          <button class="btn-danger" onclick="eliminarCuenta('${c.id}','${escapar(c.nombre_alias).replace(/'/g,'&#39;')}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// ── _cargarBancosCB ──────────────────────────────────────────────
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

// ── abrirModalCuenta ─────────────────────────────────────────────
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
    setTimeout(() => {
      const b = document.getElementById('cb-banco');
      if (b) {
        b.value = c.banco_codigo || '';
        _cbBancoChange(c.banco_codigo || '');
      }
    }, 50);
  } else {
    document.getElementById('modal-cb-titulo').textContent = 'Nueva cuenta bancaria';
    ['cb-id','cb-alias','cb-numero','cb-cci'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('cb-saldo').value   = '0';
    document.getElementById('cb-monedaf').value = 'PEN';
    document.getElementById('cb-activof').value = 'true';
    _cbBancoChange('');
  }
  document.getElementById('modal-cuenta').style.display = 'flex';
}
function cerrarModalCuenta() { document.getElementById('modal-cuenta').style.display = 'none'; }

// ── guardarCuenta ────────────────────────────────────────────────
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

// ── eliminarCuenta (3-option delete flow) ───────────────────────
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

// ── verMovimientosCuenta ─────────────────────────────────────────
function verMovimientosCuenta(id) {
  activarTab('movimientos');
  setTimeout(() => {
    const sel = document.getElementById('mov-cuenta');
    if (sel) { sel.value = id; filtrarMovimientos(); }
  }, 300);
}

// ── exportarCuentasExcel ─────────────────────────────────────────
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
