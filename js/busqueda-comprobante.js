// ═══════════════════════════════════════════════════════════════
// NEXUM — Búsqueda Manual de Comprobantes (módulo compartido)
// Ícono: 📂  (diferenciado de 🔍 que es filtrado/conciliación automática)
//
// Expone dos funciones públicas:
//   _bmBuscarDoc(movBancoId, nroOp, monto, fecha, tablaBanco)
//     → abre modal para buscar comprobante desde un movimiento bancario
//
//   _bmBuscarMov(docTipo, docId, nDoc, proveedor, total, fecha)
//     → abre modal para buscar movimiento bancario desde un comprobante
// ═══════════════════════════════════════════════════════════════

// ── Utilidad interna ──────────────────────────────────────────────
function _bmOverlay() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9998;padding:12px';
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  return el;
}

function _bmBox(titulo, subtitulo, colorBg = '#2C5282') {
  return `
    <div style="background:var(--color-bg-card);border-radius:12px;width:700px;max-width:100%;
      max-height:calc(100vh - 24px);display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid var(--color-borde)">
      <div style="background:${colorBg};padding:14px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0">
        <div style="flex:1">
          <div style="color:#fff;font-weight:700;font-size:14px">📂 ${titulo}</div>
          <div style="color:rgba(255,255,255,.8);font-size:11px">${subtitulo}</div>
        </div>
        <button data-bm-close style="background:rgba(255,255,255,.2);border:none;border-radius:50%;
          width:28px;height:28px;cursor:pointer;color:#fff;font-size:16px;line-height:1">✕</button>
      </div>`;
}

function _bmFiltroWrap(html) {
  return `<div style="padding:12px 16px;border-bottom:1px solid var(--color-borde);flex-shrink:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;align-items:end">${html}</div>`;
}

const _bmInputStyle = 'padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:12px;box-sizing:border-box';

// ═══════════════════════════════════════════════════════════════
// DIRECCIÓN 1: Banco → Comprobante
// Abre modal para vincular manualmente un movimiento bancario
// con cualquier comprobante del sistema (Compras, Ventas, RH, PM)
// ═══════════════════════════════════════════════════════════════
async function _bmBuscarDoc(movBancoId, nroOp, monto, fecha, tablaBanco = 'tesoreria_mbd') {
  const overlay = _bmOverlay();

  overlay.innerHTML = _bmBox(
    'Buscar comprobante para vincular',
    `🏦 Mov: ${nroOp || movBancoId} · ${formatearMoneda ? formatearMoneda(monto) : monto} · ${fecha || ''}`,
    '#2C5282'
  ) + `
    ${_bmFiltroWrap(`
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Tipo</label>
        <select id="bm-tipo" style="${_bmInputStyle}">
          <option value="">Todos</option>
          <option value="COMPRA">Compras</option>
          <option value="VENTA">Ventas</option>
          <option value="RH">RH Honorarios</option>
          <option value="PM">Planilla Movilidad</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">N° comprobante / Planilla</label>
        <input type="text" id="bm-num" placeholder="E001-00014, 007-11-25…" style="${_bmInputStyle}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Proveedor / Trabajador / RUC/DNI</label>
        <input type="text" id="bm-prov" placeholder="Nombre o doc. identidad…" style="${_bmInputStyle}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Monto exacto</label>
        <input type="number" id="bm-monto" placeholder="${Math.abs(Number(monto)||0).toFixed(2)}" step="0.01" value="${Math.abs(Number(monto)||0)||''}" style="${_bmInputStyle}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Fecha desde</label>
        <input type="date" id="bm-desde" style="${_bmInputStyle}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Fecha hasta</label>
        <input type="date" id="bm-hasta" style="${_bmInputStyle}">
      </div>
      <div style="display:flex;gap:6px;align-self:end">
        <button id="bm-btn-buscar"
          style="flex:1;padding:8px 12px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:600">
          🔍 Buscar
        </button>
        <button id="bm-btn-limpiar" title="Limpiar"
          style="padding:8px 10px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px">
          ✕
        </button>
      </div>
    `)}

    <div id="bm-resultados" style="flex:1;overflow-y:auto;padding:12px 16px;font-size:12px;color:var(--color-texto-suave)">
      <p style="text-align:center;padding:20px">Ingresa filtros y presiona Buscar…</p>
    </div>
    </div>`;

  // Evento cerrar
  overlay.querySelectorAll('[data-bm-close]').forEach(b => b.onclick = () => overlay.remove());

  // Evento buscar
  const btnBuscar  = overlay.querySelector('#bm-btn-buscar');
  const btnLimpiar = overlay.querySelector('#bm-btn-limpiar');

  const doSearch = () => _bmEjecutarBusquedaDoc(overlay, movBancoId, tablaBanco);
  btnBuscar.onclick  = doSearch;
  btnLimpiar.onclick = () => {
    ['bm-num','bm-prov','bm-monto','bm-desde','bm-hasta'].forEach(id => {
      const el = overlay.querySelector(`#${id}`);
      if (el) el.value = id === 'bm-monto' ? (Math.abs(Number(monto)||0) || '') : '';
    });
    const tipo = overlay.querySelector('#bm-tipo');
    if (tipo) tipo.value = '';
    overlay.querySelector('#bm-resultados').innerHTML = '<p style="text-align:center;padding:20px">Ingresa filtros y presiona Buscar…</p>';
  };
  overlay.querySelector('#bm-num')?.addEventListener('keydown', e => { if(e.key==='Enter') doSearch(); });
  overlay.querySelector('#bm-prov')?.addEventListener('keydown', e => { if(e.key==='Enter') doSearch(); });
}

async function _bmEjecutarBusquedaDoc(overlay, movBancoId, tablaBanco) {
  const resEl  = overlay.querySelector('#bm-resultados');
  const tipo   = overlay.querySelector('#bm-tipo')?.value  || '';
  const qNum   = (overlay.querySelector('#bm-num')?.value  || '').trim().toLowerCase();
  const qProv  = (overlay.querySelector('#bm-prov')?.value || '').trim().toLowerCase();
  const qMonto = parseFloat(overlay.querySelector('#bm-monto')?.value || '') || 0;
  const desde  = overlay.querySelector('#bm-desde')?.value || '';
  const hasta  = overlay.querySelector('#bm-hasta')?.value || '';

  resEl.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></div>';

  const empId = empresa_activa.id;
  const todos = [];

  // ── Compras ──────────────────────────────────────────────────
  if (!tipo || tipo === 'COMPRA') {
    let q = _supabase.from('registro_compras').select('id,serie,numero,nombre_proveedor,ruc_proveedor,total,fecha_emision,periodo')
      .eq('empresa_operadora_id', empId);
    if (desde) q = q.gte('fecha_emision', desde);
    if (hasta) q = q.lte('fecha_emision', hasta);
    const { data } = await q.limit(50);
    (data || []).forEach(d => {
      const ndoc = [d.serie, d.numero].filter(Boolean).join('-') || d.id?.slice(0,8);
      todos.push({ _tipo:'COMPRA', _ndoc: ndoc, _prov: d.nombre_proveedor||'', _ruc: d.ruc_proveedor||'', _total: d.total||0, _fecha: d.fecha_emision, id: d.id });
    });
  }

  // ── Ventas ───────────────────────────────────────────────────
  if (!tipo || tipo === 'VENTA') {
    let q = _supabase.from('registro_ventas').select('id,serie,numero,nombre_cliente,razon_social,ruc_cliente,total,fecha_emision,periodo')
      .eq('empresa_operadora_id', empId);
    if (desde) q = q.gte('fecha_emision', desde);
    if (hasta) q = q.lte('fecha_emision', hasta);
    const { data } = await q.limit(50);
    (data || []).forEach(d => {
      const ndoc = [d.serie, d.numero].filter(Boolean).join('-') || d.id?.slice(0,8);
      todos.push({ _tipo:'VENTA', _ndoc: ndoc, _prov: d.nombre_cliente||d.razon_social||'', _ruc: d.ruc_cliente||'', _total: d.total||0, _fecha: d.fecha_emision, id: d.id });
    });
  }

  // ── RH ───────────────────────────────────────────────────────
  if (!tipo || tipo === 'RH') {
    let q = _supabase.from('rh_registros').select('id,numero_rh,monto_neto,fecha_emision,prestadores_servicios(nombre,dni)')
      .eq('empresa_operadora_id', empId);
    if (desde) q = q.gte('fecha_emision', desde);
    if (hasta) q = q.lte('fecha_emision', hasta);
    const { data } = await q.limit(50);
    (data || []).forEach(d => {
      todos.push({ _tipo:'RH', _ndoc: d.numero_rh||d.id?.slice(0,8), _prov: d.prestadores_servicios?.nombre||'', _ruc: d.prestadores_servicios?.dni||'', _total: d.monto_neto||0, _fecha: d.fecha_emision, id: d.id });
    });
  }

  // ── Planillas de Movilidad ────────────────────────────────────
  if (!tipo || tipo === 'PM') {
    let q = _supabase.from('planillas_movilidad').select('id,numero_planilla,trabajador_nombre,trabajador_dni,total_gastos,fecha_emision,mes,estado')
      .eq('empresa_operadora_id', empId);
    if (desde) q = q.gte('fecha_emision', desde);
    if (hasta) q = q.lte('fecha_emision', hasta);
    const { data } = await q.limit(50);
    (data || []).forEach(d => {
      todos.push({ _tipo:'PM', _ndoc: d.numero_planilla||d.id?.slice(0,8), _prov: d.trabajador_nombre||'', _ruc: d.trabajador_dni||'', _total: d.total_gastos||0, _fecha: d.fecha_emision, id: d.id, _estado: d.estado });
    });
  }

  // ── Filtrado local ────────────────────────────────────────────
  let filtrados = todos.filter(d => {
    if (qNum  && !(d._ndoc||'').toLowerCase().includes(qNum))  return false;
    if (qProv && ![(d._prov||''),(d._ruc||'')].join(' ').toLowerCase().includes(qProv)) return false;
    if (qMonto > 0 && Math.abs(Number(d._total||0) - qMonto) > 1) return false;
    return true;
  }).slice(0, 20);

  if (!filtrados.length) {
    resEl.innerHTML = '<p style="text-align:center;padding:24px;color:var(--color-texto-suave)">Sin resultados. Ajusta los filtros.</p>';
    return;
  }

  const tipoBg = { COMPRA:'#2C5282', VENTA:'#276749', RH:'#744210', PM:'#553C9A' };
  const tipoIcon = { COMPRA:'🛒', VENTA:'📄', RH:'🧾', PM:'🚗' };

  resEl.innerHTML = `
    <div style="margin-bottom:8px;font-size:11px;color:var(--color-texto-suave)">${filtrados.length} resultado(s)</div>
    ${filtrados.map(d => `
      <div style="border:1px solid var(--color-borde);border-radius:8px;padding:10px 12px;margin-bottom:8px;
        display:flex;align-items:center;gap:10px;background:var(--color-bg-card)">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="background:${tipoBg[d._tipo]||'#718096'};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">
              ${tipoIcon[d._tipo]||'📋'} ${d._tipo}
            </span>
            <strong style="color:var(--color-secundario);font-size:12px">${escapar(d._ndoc||'—')}</strong>
            ${d._estado ? `<span style="background:#553C9A;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px">${d._estado}</span>` : ''}
          </div>
          <div style="font-size:11px;color:var(--color-texto-suave)">
            ${escapar(d._prov||'—')}
            ${d._ruc ? `<span style="margin-left:6px;font-family:monospace">${escapar(d._ruc)}</span>` : ''}
          </div>
          <div style="font-size:11px;margin-top:2px">
            <span style="font-weight:700;color:var(--color-secundario)">${formatearMoneda ? formatearMoneda(d._total) : 'S/ '+Number(d._total).toFixed(2)}</span>
            ${d._fecha ? `<span style="color:var(--color-texto-suave);margin-left:8px">${d._fecha}</span>` : ''}
          </div>
        </div>
        <button data-bm-vincular data-tipo="${d._tipo}" data-id="${d.id}" data-ndoc="${escapar(d._ndoc)}"
          style="flex-shrink:0;padding:7px 14px;background:var(--color-secundario);color:#fff;border:none;
            border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font);font-weight:600;white-space:nowrap">
          ✓ Vincular
        </button>
      </div>`).join('')}`;

  // Eventos de vincular
  resEl.querySelectorAll('[data-bm-vincular]').forEach(btn => {
    btn.onclick = async () => {
      const docTipo = btn.dataset.tipo;
      const docId   = btn.dataset.id;
      const nDoc    = btn.dataset.ndoc;
      await _bmEjecutarVinculacionDoc(movBancoId, docTipo, docId, nDoc, tablaBanco);
      overlay.remove();
    };
  });
}

async function _bmEjecutarVinculacionDoc(movBancoId, docTipo, docId, nDoc, tablaBanco) {
  const hoy = new Date().toISOString().slice(0,10);

  // Actualizar movimiento bancario
  const updatePayload = {
    entrega_doc:         'EMITIDO',
    estado_conciliacion: 'conciliado',
    nro_factura_doc:     nDoc || null,
    tipo_doc:            docTipo,
    fecha_actualizacion: hoy,
  };

  const tabla = tablaBanco || 'tesoreria_mbd';
  const { error: errMov } = await _supabase.from(tabla).update(updatePayload).eq('id', movBancoId);
  if (errMov) { mostrarToast('Error al vincular: ' + errMov.message, 'error'); return; }

  // Registrar en conciliaciones si disponible
  if (typeof empresa_activa !== 'undefined' && empresa_activa?.id) {
    await _supabase.from('conciliaciones').insert({
      empresa_operadora_id: empresa_activa.id,
      movimiento_id:        tabla === 'movimientos' ? movBancoId : null,
      doc_tipo:             docTipo,
      doc_id:               docId || null,
      score:                0,
      tipo_match:           'MANUAL',
      estado:               'APROBADO',
      usuario_id:           typeof perfil_usuario !== 'undefined' ? (perfil_usuario?.id || null) : null,
    }).maybeSingle();
  }

  mostrarToast('✓ Comprobante vinculado correctamente', 'exito');

  // Refrescar lista si hay función disponible
  if (typeof cargarListaPlanillas === 'function')  cargarListaPlanillas();
  if (typeof cargarCompras === 'function')         cargarCompras();
  if (typeof cargarVentas  === 'function')         cargarVentas();
  if (typeof _concCargarDatos === 'function')      _concCargarDatos();
}

// ═══════════════════════════════════════════════════════════════
// DIRECCIÓN 2: Comprobante → Banco
// Abre modal para buscar movimiento bancario desde un comprobante
// ═══════════════════════════════════════════════════════════════
async function _bmBuscarMov(docTipo, docId, nDoc, proveedor, total, fechaDoc) {
  const overlay = _bmOverlay();
  const montoRef = Math.abs(Number(total)||0);

  overlay.innerHTML = _bmBox(
    'Buscar movimiento bancario para vincular',
    `${docTipo === 'PM' ? '🚗' : docTipo === 'RH' ? '🧾' : docTipo === 'VENTA' ? '📄' : '🛒'} ${nDoc} · ${proveedor || ''} · ${formatearMoneda ? formatearMoneda(total) : 'S/ '+Number(total).toFixed(2)}`,
    docTipo === 'VENTA' ? '#276749' : docTipo === 'RH' ? '#744210' : docTipo === 'PM' ? '#553C9A' : '#2C5282'
  ) + `
    ${_bmFiltroWrap(`
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Descripción / Proveedor</label>
        <input type="text" id="bm2-desc" value="${escapar(proveedor||'')}" placeholder="Nombre, descripción…" style="${_bmInputStyle}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Monto exacto o rango</label>
        <div style="display:flex;gap:4px">
          <input type="number" id="bm2-monto-min" value="${montoRef ? (montoRef - 2).toFixed(2) : ''}" placeholder="Mínimo" step="0.01" style="${_bmInputStyle};width:50%">
          <input type="number" id="bm2-monto-max" value="${montoRef ? (montoRef + 2).toFixed(2) : ''}" placeholder="Máximo" step="0.01" style="${_bmInputStyle};width:50%">
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Fecha desde</label>
        <input type="date" id="bm2-desde" value="${fechaDoc ? _bmMesAnterior(fechaDoc) : ''}" style="${_bmInputStyle}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Fecha hasta</label>
        <input type="date" id="bm2-hasta" value="${fechaDoc ? _bmMesSiguiente(fechaDoc) : ''}" style="${_bmInputStyle}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px">Naturaleza</label>
        <select id="bm2-nat" style="${_bmInputStyle}">
          <option value="">Todas</option>
          <option value="CARGO" selected>CARGO (salidas)</option>
          <option value="ABONO">ABONO (entradas)</option>
        </select>
      </div>
      <div style="display:flex;gap:6px;align-self:end">
        <button id="bm2-btn-buscar"
          style="flex:1;padding:8px 12px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:600">
          🔍 Buscar
        </button>
        <button id="bm2-btn-limpiar" title="Limpiar"
          style="padding:8px 10px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px">✕</button>
      </div>
    `)}

    <div id="bm2-resultados" style="flex:1;overflow-y:auto;padding:12px 16px;font-size:12px;color:var(--color-texto-suave)">
      <p style="text-align:center;padding:20px">Presiona Buscar para encontrar movimientos bancarios…</p>
    </div>
    <div style="border-top:1px solid var(--color-borde);padding:12px 16px;flex-shrink:0;background:var(--color-bg-card)">
      <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 8px 0">¿No encuentras el movimiento? Búsqueda manual:</p>
      <div style="display:flex;gap:8px">
        <input type="text" id="bm2-manual-q" placeholder="N° operación o proveedor"
          style="${_bmInputStyle};flex:1">
        <button id="bm2-manual-btn"
          style="padding:7px 14px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:600;white-space:nowrap">
          🔍 Buscar
        </button>
      </div>
      <div id="bm2-manual-res" style="margin-top:8px"></div>
    </div>
    </div>`;

  overlay.querySelectorAll('[data-bm-close]').forEach(b => b.onclick = () => overlay.remove());

  const doSearch = () => _bmEjecutarBusquedaMov(overlay, docTipo, docId, nDoc);
  overlay.querySelector('#bm2-btn-buscar').onclick = doSearch;
  overlay.querySelector('#bm2-btn-limpiar').onclick = () => {
    ['bm2-desc','bm2-desde','bm2-hasta'].forEach(id => {
      const el = overlay.querySelector(`#${id}`);
      if (el) el.value = '';
    });
    ['bm2-monto-min','bm2-monto-max'].forEach(id => {
      const el = overlay.querySelector(`#${id}`);
      if (el) el.value = '';
    });
    const nat = overlay.querySelector('#bm2-nat');
    if (nat) nat.value = 'CARGO';
    overlay.querySelector('#bm2-resultados').innerHTML = '<p style="text-align:center;padding:20px">Presiona Buscar para encontrar movimientos bancarios…</p>';
  };
  overlay.querySelector('#bm2-desc')?.addEventListener('keydown', e => { if(e.key==='Enter') doSearch(); });

  const doManual = () => _bmBuscarMovManual(overlay, docTipo, docId, nDoc);
  overlay.querySelector('#bm2-manual-btn').onclick = doManual;
  overlay.querySelector('#bm2-manual-q')?.addEventListener('keydown', e => { if(e.key==='Enter') doManual(); });

  // Auto-buscar al abrir si hay datos
  if (montoRef || proveedor) setTimeout(doSearch, 100);
}

async function _bmEjecutarBusquedaMov(overlay, docTipo, docId, nDoc) {
  const resEl    = overlay.querySelector('#bm2-resultados');
  const qDesc    = (overlay.querySelector('#bm2-desc')?.value || '').trim().toLowerCase();
  const montoMin = parseFloat(overlay.querySelector('#bm2-monto-min')?.value || '') || 0;
  const montoMax = parseFloat(overlay.querySelector('#bm2-monto-max')?.value || '') || 9999999;
  const desde    = overlay.querySelector('#bm2-desde')?.value || '';
  const hasta    = overlay.querySelector('#bm2-hasta')?.value || '';
  const nat      = overlay.querySelector('#bm2-nat')?.value || '';

  resEl.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></div>';

  // Buscar en tesoreria_mbd (tabla principal de movimientos banco)
  let q = _supabase
    .from('tesoreria_mbd')
    .select('id,nro_operacion_bancaria,fecha_deposito,descripcion,proveedor_empresa_personal,monto,moneda,entrega_doc')
    .eq('empresa_id', empresa_activa.id)
    .eq('entrega_doc', 'PENDIENTE')
    .order('fecha_deposito', { ascending: false });

  if (desde) q = q.gte('fecha_deposito', desde);
  if (hasta) q = q.lte('fecha_deposito', hasta);

  const { data, error } = await q.limit(200);
  if (error) {
    resEl.innerHTML = `<p style="color:var(--color-critico);padding:16px">Error: ${escapar(error.message)}</p>`;
    return;
  }

  let filtrados = (data || []).filter(m => {
    const monto = Number(m.monto||0);
    const absM = Math.abs(monto);
    if (montoMin > 0 && absM < montoMin) return false;
    if (montoMax > 0 && absM > montoMax) return false;
    if (nat === 'CARGO'  && monto >= 0) return false;
    if (nat === 'ABONO'  && monto <  0) return false;
    if (qDesc) {
      const haystack = [(m.descripcion||''),(m.proveedor_empresa_personal||'')].join(' ').toLowerCase();
      if (!haystack.includes(qDesc)) return false;
    }
    return true;
  }).slice(0, 20);

  if (!filtrados.length) {
    resEl.innerHTML = '<p style="text-align:center;padding:24px;color:var(--color-texto-suave)">Sin movimientos bancarios para los filtros indicados.<br><small>Prueba ampliar el rango de fechas o monto.</small></p>';
    return;
  }

  resEl.innerHTML = `
    <div style="margin-bottom:8px;font-size:11px;color:var(--color-texto-suave)">${filtrados.length} movimiento(s) bancario(s) pendientes</div>
    ${filtrados.map(m => {
      const absM = Math.abs(Number(m.monto||0));
      const signo = Number(m.monto||0) < 0 ? '-' : '+';
      const color = Number(m.monto||0) < 0 ? 'var(--color-critico)' : 'var(--color-exito)';
      return `
        <div style="border:1px solid var(--color-borde);border-radius:8px;padding:10px 12px;margin-bottom:8px;
          display:flex;align-items:center;gap:10px;background:var(--color-bg-card)">
          <div style="flex:1;min-width:0">
            <div style="font-family:monospace;font-weight:600;font-size:11px;color:var(--color-secundario);margin-bottom:3px">
              ${escapar(m.nro_operacion_bancaria||'—')}
            </div>
            <div style="font-size:12px;font-weight:500">${escapar((m.proveedor_empresa_personal||m.descripcion||'—').slice(0,45))}</div>
            <div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px">
              ${m.fecha_deposito||'—'} · ${escapar((m.descripcion||'').slice(0,40))}
            </div>
          </div>
          <div style="flex-shrink:0;text-align:right">
            <div style="font-weight:700;font-size:14px;color:${color}">${signo}${formatearMoneda ? formatearMoneda(absM,m.moneda||'PEN') : 'S/'+absM.toFixed(2)}</div>
            <button data-bm2-vincular data-movid="${m.id}" data-nrop="${escapar(m.nro_operacion_bancaria||'')}"
              style="margin-top:4px;padding:5px 12px;background:var(--color-secundario);color:#fff;border:none;
                border-radius:6px;cursor:pointer;font-size:11px;font-family:var(--font);font-weight:600">
              ✓ Vincular
            </button>
          </div>
        </div>`;
    }).join('')}`;

  resEl.querySelectorAll('[data-bm2-vincular]').forEach(btn => {
    btn.onclick = async () => {
      const movId = btn.dataset.movid;
      const nrop  = btn.dataset.nrop;
      await _bmEjecutarVinculacionDoc(movId, docTipo, docId, nDoc, 'tesoreria_mbd');
      mostrarToast(`✓ Movimiento ${nrop} vinculado al comprobante ${nDoc}`, 'exito');
      overlay.remove();
    };
  });
}

async function _bmBuscarMovManual(overlay, docTipo, docId, nDoc) {
  const q   = (overlay.querySelector('#bm2-manual-q')?.value || '').trim();
  const res = overlay.querySelector('#bm2-manual-res');
  if (!q || !res) return;
  res.innerHTML = '<div class="spinner" style="margin:8px auto"></div>';

  const { data: movs } = await _supabase
    .from('tesoreria_mbd')
    .select('id,nro_operacion_bancaria,fecha_deposito,descripcion,proveedor_empresa_personal,monto,moneda,entrega_doc')
    .eq('empresa_id', empresa_activa.id)
    .or(`nro_operacion_bancaria.ilike.%${q}%,proveedor_empresa_personal.ilike.%${q}%,descripcion.ilike.%${q}%`)
    .order('fecha_deposito', { ascending: false })
    .limit(10);

  if (!movs?.length) {
    res.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave);margin:4px 0">Sin resultados para ese criterio.</p>';
    return;
  }

  res.innerHTML = movs.map(m => {
    const estadoBadge = m.entrega_doc === 'EMITIDO'
      ? '<span style="background:#2F855A;color:#fff;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700">EMITIDO</span>'
      : m.entrega_doc === 'PENDIENTE'
        ? '<span style="background:#C53030;color:#fff;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700">PENDIENTE</span>'
        : `<span style="background:#718096;color:#fff;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700">${escapar(m.entrega_doc||'')}</span>`;
    return `
    <div style="border:1px solid var(--color-borde);border-radius:6px;padding:8px 10px;margin-bottom:6px;
      display:flex;align-items:center;gap:10px;background:var(--color-bg-card)">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-family:monospace;font-size:11px;font-weight:600;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria||'—')}</span>
          ${estadoBadge}
          <span style="font-size:11px;color:var(--color-texto-suave)">${m.fecha_deposito||''}</span>
        </div>
        <div style="font-size:12px;margin-top:2px">${escapar((m.proveedor_empresa_personal||m.descripcion||'—').slice(0,45))}</div>
      </div>
      <div style="flex-shrink:0;text-align:right">
        <div style="font-weight:700;color:${Number(m.monto||0)<0?'var(--color-critico)':'var(--color-exito)'}">${formatearMoneda?formatearMoneda(m.monto,m.moneda||'PEN'):'S/'+Number(m.monto||0).toFixed(2)}</div>
        <button data-bm2m-id="${m.id}" data-bm2m-nrop="${escapar(m.nro_operacion_bancaria||'')}"
          style="margin-top:4px;padding:3px 10px;background:var(--color-secundario);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-family:var(--font);font-weight:600">
          🔗 Vincular
        </button>
      </div>
    </div>`;
  }).join('');

  res.querySelectorAll('[data-bm2m-id]').forEach(btn => {
    btn.onclick = async () => {
      const movId = btn.dataset.bm2mId;
      const nrop  = btn.dataset.bm2mNrop;
      await _bmEjecutarVinculacionDoc(movId, docTipo, docId, nDoc, 'tesoreria_mbd');
      mostrarToast(`✓ Movimiento ${nrop} vinculado a ${nDoc}`, 'exito');
      overlay.remove();
    };
  });
}

// ── Helpers de fecha ──────────────────────────────────────────────
function _bmMesAnterior(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function _bmMesSiguiente(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
