// ═══════════════════════════════════════════════════════════════
// Conciliación — Tab Conciliar  (usa tesoreria_mbd como fuente)
// ═══════════════════════════════════════════════════════════════

let _con_resultados     = { exactos: [], posibles: [], sin_match: [] };
let _con_tab_activo     = 'exactos';
let _con_periodo_actual = null;
let _conItemCache       = {}; // cache de items para acceso seguro sin JSON en onclick

// Estado de filtros/orden por tab
let _con_filtros = {
  exactos:   { q: '', scoreMin: 85, sortCol: 'score', sortDir: -1 },
  posibles:  { q: '', scoreMin: 0,  sortCol: 'score', sortDir: -1 },
  sin_match: { q: '', sortCol: 'fecha', sortDir: 1 },
};

// ── Shell del módulo ─────────────────────────────────────────────
async function renderTabConciliar(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Paso 1 -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
          <h3 style="margin:0">Seleccionar periodo</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="_conBorrarMes()" style="padding:6px 12px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">🗑️ Borrar mes</button>
            <button onclick="_conBorrarAnio()" style="padding:6px 12px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">🗑️ Borrar año</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;align-items:end">
          <div class="campo" style="margin-bottom:0">
            <label class="label-filtro">Mes / Periodo</label>
            <input type="month" id="con-periodo" class="input-buscar w-full">
          </div>
          <div>
            <button class="btn btn-primario w-full" onclick="_conIniciar()">🔗 Iniciar conciliación</button>
          </div>
        </div>
      </div>

      <!-- Resumen -->
      <div id="con-resumen" style="display:none;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div class="card" style="text-align:center;border-left:4px solid #22c55e;padding:16px;cursor:pointer" onclick="_conActivarSubtab('exactos')">
            <div style="font-size:28px;font-weight:700;color:#22c55e" id="con-cnt-exactos">0</div>
            <div class="text-muted text-sm">✅ Exactos (≥85%)</div>
          </div>
          <div class="card" style="text-align:center;border-left:4px solid #f59e0b;padding:16px;cursor:pointer" onclick="_conActivarSubtab('posibles')">
            <div style="font-size:28px;font-weight:700;color:#f59e0b" id="con-cnt-posibles">0</div>
            <div class="text-muted text-sm">⚠️ Posibles (60–84%)</div>
          </div>
          <div class="card" style="text-align:center;border-left:4px solid #ef4444;padding:16px;cursor:pointer" onclick="_conActivarSubtab('sin_match')">
            <div style="font-size:28px;font-weight:700;color:#ef4444" id="con-cnt-sinmatch">0</div>
            <div class="text-muted text-sm">❌ Sin match (&lt;60%)</div>
          </div>
        </div>
      </div>

      <!-- Tabs y tabla -->
      <div id="con-tabs-wrap" style="display:none">
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-sm btn-primario"   id="con-itab-exactos"   onclick="_conActivarSubtab('exactos')">🟢 Exactos</button>
          <button class="btn btn-sm btn-secundario" id="con-itab-posibles"  onclick="_conActivarSubtab('posibles')">🟡 Posibles</button>
          <button class="btn btn-sm btn-secundario" id="con-itab-sin_match" onclick="_conActivarSubtab('sin_match')">🔴 Sin match</button>
          <div style="flex:1"></div>
          <button id="con-btn-lote" class="btn btn-sm" style="display:none;background:#166534;color:#fff;border-radius:var(--radio)"
            onclick="_aprobarEnLote()">✅ Aprobar todos los exactos</button>
          <button class="btn btn-sm btn-secundario" onclick="_conExportarAprobados()">📥 Exportar aprobados</button>
        </div>
        <div id="con-tabla-wrap"></div>
      </div>

      <!-- Vacío -->
      <div id="con-vacio" class="card" style="text-align:center;padding:48px;color:var(--color-texto-suave)">
        <div style="font-size:48px;margin-bottom:12px">🔗</div>
        <p style="font-weight:500">Selecciona un periodo e inicia la conciliación</p>
        <p class="text-muted text-sm">El sistema cruzará movimientos MBD con compras, RH y ventas</p>
      </div>

      <!-- Panel lateral búsqueda manual -->
      <div id="con-panel-manual" style="display:none;position:fixed;top:0;right:0;width:380px;height:100vh;
        background:var(--color-bg-card);border-left:2px solid var(--color-borde);z-index:500;
        overflow-y:auto;box-shadow:-4px 0 20px rgba(0,0,0,.15)">
        <div style="padding:16px;border-bottom:1px solid var(--color-borde);display:flex;justify-content:space-between;align-items:center">
          <strong>🔍 Vincular comprobante</strong>
          <button onclick="document.getElementById('con-panel-manual').style.display='none'"
            style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--color-texto)">✕</button>
        </div>
        <div id="con-panel-manual-body" style="padding:16px"></div>
      </div>
    </div>`;

  const hoy = new Date();
  const el  = document.getElementById('con-periodo');
  if (el) el.value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
}

// ── Borrar mes / año ─────────────────────────────────────────────
async function _conBorrarMes() {
  const periodo = document.getElementById('con-periodo')?.value;
  if (!periodo) { mostrarToast('Selecciona un periodo primero', 'atencion'); return; }
  if (!await confirmar(`¿Eliminar conciliación de ${periodo}?`, { btnOk: 'Sí, borrar', btnColor: '#C53030' })) return;
  if (!await confirmar(`CONFIRMACIÓN FINAL: ¿Borrar conciliación ${periodo}?`, { btnOk: 'Confirmar', btnColor: '#C53030' })) return;
  const [yyyy, mm] = periodo.split('-');
  const { error } = await _supabase.from('conciliaciones')
    .delete().eq('empresa_operadora_id', empresa_activa.id)
    .gte('created_at', `${yyyy}-${mm}-01`).lte('created_at', `${yyyy}-${mm}-31`);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ Conciliación ${periodo} eliminada.`, 'exito');
}

async function _conBorrarAnio() {
  const periodo = document.getElementById('con-periodo')?.value;
  if (!periodo) { mostrarToast('Selecciona un periodo', 'atencion'); return; }
  const yyyy = periodo.split('-')[0];
  if (!await confirmar(`¿Eliminar conciliación completa del año ${yyyy}?`, { btnOk: 'Sí, borrar año', btnColor: '#C53030' })) return;
  if (!await confirmar(`CONFIRMACIÓN FINAL: ¿Borrar año ${yyyy}?`, { btnOk: 'Confirmar', btnColor: '#C53030' })) return;
  const { error } = await _supabase.from('conciliaciones')
    .delete().eq('empresa_operadora_id', empresa_activa.id)
    .gte('created_at', `${yyyy}-01-01`).lte('created_at', `${yyyy}-12-31`);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ Conciliación ${yyyy} eliminada.`, 'exito');
}

// ── Iniciar conciliación ─────────────────────────────────────────
async function _conIniciar() {
  const periodo = document.getElementById('con-periodo')?.value;
  if (!periodo) { mostrarToast('Selecciona un periodo', 'atencion'); return; }

  _con_periodo_actual = periodo;

  document.getElementById('con-vacio').style.display    = 'none';
  document.getElementById('con-resumen').style.display  = 'none';
  document.getElementById('con-tabs-wrap').style.display = 'none';

  const tablaWrap = document.getElementById('con-tabla-wrap');
  if (tablaWrap) tablaWrap.innerHTML = `
    <div class="cargando" style="padding:40px">
      <div class="spinner"></div><span>Ejecutando conciliación…</span>
    </div>`;

  document.getElementById('con-resumen').style.display   = 'block';
  document.getElementById('con-tabs-wrap').style.display = 'block';

  try {
    _con_resultados = await _ejecutarConciliacion(periodo);

    document.getElementById('con-cnt-exactos').textContent  = _con_resultados.exactos.length;
    document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
    document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;

    _conActualizarBtnLote();
    _conActivarSubtab('exactos');

  } catch (err) {
    if (tablaWrap) tablaWrap.innerHTML = `<div class="alerta-error">${escapar(err.message)}</div>`;
  }
}

// ── Motor de conciliación ────────────────────────────────────────
async function _ejecutarConciliacion(periodo) {
  const [yyyy, mm] = periodo.split('-');
  const inicio = `${yyyy}-${mm}-01`;
  const fin    = new Date(parseInt(yyyy), parseInt(mm), 0).toISOString().slice(0, 10);

  const [resMbd, resCompras, resVentas, resRh] = await Promise.all([
    _supabase
      .from('tesoreria_mbd')
      .select('*')
      .eq('empresa_id', empresa_activa.id)
      .eq('entrega_doc', 'PENDIENTE')
      .gte('fecha_deposito', inicio)
      .lte('fecha_deposito', fin),

    _supabase
      .from('registro_compras')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo),

    _supabase
      .from('registro_ventas')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo),

    _supabase
      .from('rh_registros')
      .select('*, prestadores_servicios(nombre, dni)')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo),
  ]);

  const movBanco = resMbd.data || [];

  const compras = (resCompras.data || []).map(d => ({
    ...d,
    _tipo:    'COMPRA',
    _ndoc:    [d.serie, d.numero].filter(Boolean).join('-') || d.id?.slice(0,8) || '—',
    _proveedor: d.nombre_proveedor || '',
    _ruc:     d.ruc_proveedor || '',
    _total:   Math.abs(parseFloat(d.total || d.importe_total || 0)),
    _fecha:   d.fecha_emision || d.fecha || null,
  }));

  const ventas = (resVentas.data || []).map(d => ({
    ...d,
    _tipo:    'VENTA',
    _ndoc:    [d.serie, d.numero].filter(Boolean).join('-') || d.id?.slice(0,8) || '—',
    _proveedor: d.nombre_cliente || d.razon_social || '',
    _ruc:     d.ruc_cliente || d.ruc || '',
    _total:   Math.abs(parseFloat(d.total || d.importe_total || 0)),
    _fecha:   d.fecha_emision || d.fecha || null,
  }));

  const rhRegs = (resRh.data || []).map(d => ({
    ...d,
    _tipo:    'RH',
    _ndoc:    d.numero_rh || d.id?.slice(0,8) || '—',
    _proveedor: d.prestadores_servicios?.nombre || '',
    _ruc:     d.prestadores_servicios?.dni || '',
    _total:   Math.abs(parseFloat(d.monto_neto || 0)),
    _fecha:   d.fecha_emision || null,
  }));

  const documentos = [...compras, ...ventas, ...rhRegs];

  const exactos   = [];
  const posibles  = [];
  const sin_match = [];
  const usadosDoc = new Set();

  for (const mov of movBanco) {
    let mejorScore = -1;
    let mejorDoc   = null;

    for (const doc of documentos) {
      if (usadosDoc.has(doc.id)) continue;
      const s = _calcularScore(mov, doc);
      if (s > mejorScore) { mejorScore = s; mejorDoc = doc; }
    }

    if (mejorDoc && mejorScore >= 85) {
      usadosDoc.add(mejorDoc.id);
      exactos.push({ mov, doc: mejorDoc, score: mejorScore });
    } else if (mejorDoc && mejorScore >= 60) {
      posibles.push({ mov, doc: mejorDoc, score: mejorScore });
    } else {
      sin_match.push({ mov, score: mejorDoc ? mejorScore : 0 });
    }
  }

  // Ordenar: score DESC, fecha ASC
  const byScoreFecha = (a, b) =>
    b.score !== a.score ? b.score - a.score
    : (a.mov.fecha_deposito || '').localeCompare(b.mov.fecha_deposito || '');

  exactos.sort(byScoreFecha);
  posibles.sort(byScoreFecha);
  sin_match.sort((a, b) => (a.mov.fecha_deposito || '').localeCompare(b.mov.fecha_deposito || ''));

  return { exactos, posibles, sin_match };
}

// ── Score ponderado (100 pts) ────────────────────────────────────
// Monto(35) + Proveedor fuzzy(25) + RUC/DNI(20) + Fecha(15) + Tipo(5)
function _calcularScore(mov, doc) {
  let score = 0;

  // ── Monto (35 pts) ──────────────────────────────────────────────
  const montoMov = Math.abs(parseFloat(mov.monto) || 0);
  const montoDoc = doc._total || 0;
  const diff     = Math.abs(montoMov - montoDoc);

  if (montoDoc > 0) {
    if (diff === 0)                      score += 35;
    else if (diff <= 1)                  score += 32;
    else if (diff <= 5)                  score += 28;
    else if (diff / montoDoc < 0.02)     score += 20;
    else if (diff / montoDoc < 0.05)     score += 10;
  }

  // ── Proveedor fuzzy (25 pts) ────────────────────────────────────
  const provMov = (mov.proveedor_empresa_personal || '').toLowerCase().trim();
  const provDoc = (doc._proveedor || '').toLowerCase().trim();

  if (provMov && provDoc) {
    if (provMov === provDoc) {
      score += 25;
    } else {
      const wordsA = provMov.split(/\s+/).filter(w => w.length > 2);
      const wordsB = new Set(provDoc.split(/\s+/).filter(w => w.length > 2));
      const comunes = wordsA.filter(w => wordsB.has(w)).length;
      if (comunes >= 3)      score += 22;
      else if (comunes >= 2) score += 17;
      else if (comunes === 1) score += 10;
      else if (provDoc.length > 4 && (provDoc.includes(provMov.slice(0,5)) ||
               provMov.includes(provDoc.slice(0,5)))) score += 6;
    }
  }

  // ── RUC / DNI (20 pts) ──────────────────────────────────────────
  const rucMov = (mov.ruc_dni || '').toString().trim().replace(/\s/g, '');
  const rucDoc = (doc._ruc   || '').toString().trim().replace(/\s/g, '');
  if (rucMov && rucDoc && rucMov === rucDoc) score += 20;

  // ── Fecha (15 pts) ──────────────────────────────────────────────
  const fechaMov = mov.fecha_deposito ? new Date(mov.fecha_deposito + 'T00:00:00') : null;
  const fechaDoc = doc._fecha         ? new Date(doc._fecha         + 'T00:00:00') : null;
  if (fechaMov && fechaDoc) {
    const dias = Math.abs((fechaMov - fechaDoc) / 86400000);
    if (dias === 0)       score += 15;
    else if (dias <= 3)   score += 12;
    else if (dias <= 7)   score += 7;
    else if (dias <= 15)  score += 3;
  }

  // ── Tipo de movimiento coherente (5 pts) ────────────────────────
  const desc = (mov.descripcion || '').toUpperCase();
  if (desc.includes('TRAN.CEL') || desc.includes('CEL.BM')) {
    if (doc._tipo === 'RH') score += 5;
  } else if (desc.includes('TRANSF') || desc.includes('TRAN.CTAS')) {
    if (doc._tipo === 'COMPRA') score += 5;
    else score += 2;
  } else {
    score += 2; // neutro
  }

  return Math.min(score, 100);
}

// ── Helpers visuales ─────────────────────────────────────────────
function _scoreChip(score) {
  let bg, color, icon;
  if (score >= 85) { bg = '#166534'; color = '#fff';    icon = '✅'; }
  else if (score >= 60) { bg = '#854d0e'; color = '#fff'; icon = '⚠️'; }
  else { bg = '#991b1b'; color = '#fff'; icon = '❌'; }
  return `<span style="background:${bg};color:${color};padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap">${icon} ${score}%</span>`;
}

function _tdEstado(estado) {
  const cfg = {
    PENDIENTE: { bg:'#C53030', label:'PENDIENTE' },
    OBSERVADO: { bg:'#D69E2E', label:'OBSERVADO' },
    EMITIDO:   { bg:'#2F855A', label:'EMITIDO'   },
    CANCELADO: { bg:'#718096', label:'CANCELADO'  },
  }[estado] || { bg:'#718096', label: estado || '—' };
  return `<span style="background:${cfg.bg};color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${cfg.label}</span>`;
}

function _thSort(col, label, tab) {
  const f = _con_filtros[tab];
  const arrow = f.sortCol === col ? (f.sortDir === 1 ? ' ↑' : ' ↓') : '';
  return `<th onclick="_conOrdenar('${tab}','${col}')"
    style="white-space:nowrap;padding:9px 10px;font-size:11px;cursor:pointer;user-select:none">${label}${arrow}</th>`;
}

function _thFijo(label) {
  return `<th style="white-space:nowrap;padding:9px 10px;font-size:11px">${label}</th>`;
}

// ── Activar subtab ───────────────────────────────────────────────
function _conActivarSubtab(tab) {
  _con_tab_activo = tab;
  ['exactos','posibles','sin_match'].forEach(t => {
    const btn = document.getElementById('con-itab-' + t);
    if (btn) btn.className = 'btn btn-sm ' + (t === tab ? 'btn-primario' : 'btn-secundario');
  });
  const wrap = document.getElementById('con-tabla-wrap');
  if (!wrap) return;
  if (tab === 'exactos')   _renderTablaExactos(wrap);
  if (tab === 'posibles')  _renderTablaPosibles(wrap);
  if (tab === 'sin_match') _renderTablaSinMatch(wrap);
}

function _conOrdenar(tab, col) {
  const f = _con_filtros[tab];
  if (f.sortCol === col) f.sortDir *= -1;
  else { f.sortCol = col; f.sortDir = 1; }
  _conActivarSubtab(tab);
}

function _conActualizarBtnLote() {
  const btn = document.getElementById('con-btn-lote');
  if (!btn) return;
  const n = _con_resultados.exactos.length;
  btn.style.display = n > 0 ? 'inline-flex' : 'none';
  btn.textContent   = `✅ Aprobar todos los exactos (${n})`;
}

// ── Barra de filtros ─────────────────────────────────────────────
function _filtroBarra(tab, extraFiltros = '') {
  const f = _con_filtros[tab];
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <input type="text" value="${escapar(f.q || '')}"
        oninput="_conFiltroQ('${tab}',this.value)"
        placeholder="🔍 Buscar…"
        style="padding:6px 10px;border:1px solid var(--color-borde);border-radius:6px;
               background:var(--color-bg-card);color:var(--color-texto);font-size:12px;
               font-family:var(--font);width:220px">
      ${extraFiltros}
      <button onclick="_conFiltroQ('${tab}','')" title="Limpiar filtro"
        style="padding:6px 10px;background:none;border:1px solid var(--color-borde);
               border-radius:6px;cursor:pointer;color:var(--color-texto-suave);font-size:12px">✕ Limpiar</button>
    </div>`;
}

function _conFiltroQ(tab, val) {
  _con_filtros[tab].q = val.toLowerCase().trim();
  // actualizar input si fue llamado programáticamente
  _conActivarSubtab(tab);
}

function _filtrarItems(lista, tab) {
  const f   = _con_filtros[tab];
  let items = lista;

  if (f.q) {
    const q = f.q;
    items = items.filter(item => {
      const m   = item.mov;
      const str = [
        m.nro_operacion_bancaria, m.descripcion, m.proveedor_empresa_personal,
        m.ruc_dni, m.concepto, m.proyecto,
        item.doc?._ndoc, item.doc?._proveedor,
      ].map(v => (v||'').toLowerCase()).join(' ');
      return str.includes(q);
    });
  }

  if (f.scoreMin != null) {
    items = items.filter(i => (i.score || 0) >= f.scoreMin);
  }

  // Ordenar
  if (f.sortCol) {
    items = [...items].sort((a, b) => {
      let va, vb;
      switch (f.sortCol) {
        case 'score':     va = a.score || 0;             vb = b.score || 0;             break;
        case 'fecha':     va = a.mov.fecha_deposito||''; vb = b.mov.fecha_deposito||''; break;
        case 'monto':     va = Math.abs(parseFloat(a.mov.monto)||0); vb = Math.abs(parseFloat(b.mov.monto)||0); break;
        case 'proveedor': va = a.mov.proveedor_empresa_personal||''; vb = b.mov.proveedor_empresa_personal||''; break;
        default:          va = ''; vb = '';
      }
      if (typeof va === 'string') return f.sortDir * va.localeCompare(vb);
      return f.sortDir * (va - vb);
    });
  }

  return items;
}

// ── Tabla Exactos ─────────────────────────────────────────────────
function _renderTablaExactos(wrap) {
  const items = _filtrarItems(_con_resultados.exactos, 'exactos');
  const tab   = 'exactos';

  if (!_con_resultados.exactos.length) {
    wrap.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)"><p>Sin matches exactos para este periodo</p></div>';
    return;
  }

  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';

  wrap.innerHTML = `
    ${_filtroBarra(tab)}
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            ${_thFijo('N° Operación')}
            ${_thSort('fecha','Fecha',tab)}
            ${_thFijo('Descripción')}
            ${_thSort('proveedor','Proveedor / Empresa / Personal',tab)}
            ${_thSort('monto','Monto',tab)}
            ${_thSort('score','Score',tab)}
            ${_thFijo('Comprobante sugerido')}
            ${_thFijo('Tipo DOC')}
            ${_thFijo('Estado')}
            ${_thFijo('Acciones')}
          </tr>
        </thead>
        <tbody>
          ${items.length ? items.map((item, idx) => _rowMatchHtml(item, idx, 'ex', _TD)).join('') :
            `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--color-texto-suave)">Sin resultados para este filtro</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ── Tabla Posibles ────────────────────────────────────────────────
function _renderTablaPosibles(wrap) {
  const items = _filtrarItems(_con_resultados.posibles, 'posibles');
  const tab   = 'posibles';

  if (!_con_resultados.posibles.length) {
    wrap.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)"><p>Sin matches posibles para este periodo</p></div>';
    return;
  }

  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';

  wrap.innerHTML = `
    ${_filtroBarra(tab)}
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            ${_thFijo('N° Operación')}
            ${_thSort('fecha','Fecha',tab)}
            ${_thFijo('Descripción')}
            ${_thSort('proveedor','Proveedor / Empresa / Personal',tab)}
            ${_thSort('monto','Monto',tab)}
            ${_thSort('score','Score',tab)}
            ${_thFijo('Comprobante sugerido')}
            ${_thFijo('Tipo DOC')}
            ${_thFijo('Estado')}
            ${_thFijo('Acciones')}
          </tr>
        </thead>
        <tbody>
          ${items.length ? items.map((item, idx) => _rowMatchHtml(item, idx, 'pos', _TD)).join('') :
            `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--color-texto-suave)">Sin resultados para este filtro</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ── Row compartido Exactos/Posibles ──────────────────────────────
function _rowMatchHtml(item, idx, prefijo, _TD) {
  const m    = item.mov;
  const d    = item.doc;
  const prov = d._proveedor || '—';
  const nDoc = d._ndoc || '—';
  const tipoBg = d._tipo === 'RH' ? '#744210' : d._tipo === 'VENTA' ? '#276749' : '#2C5282';
  // Usamos idx+prefijo como clave para lookup seguro (sin JSON en onclick)
  const key  = `${prefijo}_${idx}`;
  _conItemCache[key] = item;

  return `<tr id="con-row-${prefijo}-${idx}"
    onmouseover="this.style.background='var(--color-hover)'"
    onmouseout="this.style.background=''">
    <td style="${_TD};font-family:monospace;font-size:11px;white-space:nowrap">${escapar(m.nro_operacion_bancaria||'—')}</td>
    <td style="${_TD};white-space:nowrap">${formatearFecha(m.fecha_deposito)}</td>
    <td style="${_TD};max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(m.descripcion||'')}">${escapar(m.descripcion||'—')}</td>
    <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.proveedor_empresa_personal||'')}">
      <strong style="font-size:11px">${escapar((m.proveedor_empresa_personal||'—').slice(0,30))}</strong>
    </td>
    <td style="${_TD};text-align:right;white-space:nowrap;font-weight:700;color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'}">
      ${formatearMoneda(m.monto, m.moneda==='USD'?'USD':'PEN')}
    </td>
    <td style="${_TD};text-align:center">${_scoreChip(item.score)}</td>
    <td style="${_TD};max-width:160px;white-space:nowrap">
      <div style="font-size:11px;font-weight:600;color:var(--color-secundario)">${escapar(nDoc)}</div>
      <div style="font-size:10px;color:var(--color-texto-suave);overflow:hidden;text-overflow:ellipsis;max-width:150px">${escapar(prov.slice(0,25))}</div>
    </td>
    <td style="${_TD};text-align:center">
      <span style="background:${tipoBg};color:#fff;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">${escapar(d._tipo||'—')}</span>
    </td>
    <td style="${_TD}">${_tdEstado(m.entrega_doc)}</td>
    <td style="${_TD}">
      <div style="display:flex;gap:4px;white-space:nowrap">
        <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 9px"
          onclick="_aprobarMatch('${m.id}','${d._tipo}','${d.id}',${item.score},'${prefijo==='ex'?'EXACTO':'POSIBLE'}',${idx},'${prefijo}')">✓ Aprobar</button>
        <button title="Ver comprobante sugerido" style="padding:4px 8px;background:rgba(39,103,73,.15);color:#276749;border:1px solid rgba(39,103,73,.3);border-radius:4px;cursor:pointer;font-size:13px"
          onclick="_verComprobante('${key}')">👁️</button>
        <button title="Buscar comprobante manualmente" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px"
          onclick="_abrirPanelManualPorKey('${key}')">🔍</button>
        <button title="Rechazar sugerencia" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px"
          onclick="_rechazarMatch(${idx},'${prefijo}')">✕</button>
      </div>
    </td>
  </tr>`;
}

// ── Vista rápida del comprobante sugerido ─────────────────────────
function _verComprobante(key) {
  const item = _conItemCache[key];
  if (!item) { mostrarToast('Dato no disponible', 'atencion'); return; }

  const m = item.mov;
  const d = item.doc;

  const tipoBg  = d._tipo === 'RH' ? '#744210' : d._tipo === 'VENTA' ? '#276749' : '#2C5282';
  const tipoIcon = d._tipo === 'RH' ? '🧾' : d._tipo === 'VENTA' ? '📄' : '🛒';

  // Detalles extras según tipo
  const extrasDoc = d._tipo === 'RH'
    ? `<div class="__cv-fila"><span class="__cv-lbl">DNI prestador</span><span>${escapar(d._ruc || '—')}</span></div>`
    : `<div class="__cv-fila"><span class="__cv-lbl">RUC proveedor</span><span>${escapar(d._ruc || '—')}</span></div>`;

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;z-index:9999`;

  overlay.innerHTML = `
    <div style="background:var(--color-bg-card);border-radius:12px;padding:0;max-width:480px;width:94%;
      box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid var(--color-borde);overflow:hidden">

      <!-- Header -->
      <div style="background:${tipoBg};padding:16px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">${tipoIcon}</span>
        <div>
          <div style="color:#fff;font-weight:700;font-size:15px">${escapar(d._ndoc || '—')}</div>
          <div style="color:rgba(255,255,255,.75);font-size:12px">Comprobante sugerido · ${escapar(d._tipo || '')}</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="margin-left:auto;background:rgba(255,255,255,.2);border:none;border-radius:50%;
            width:28px;height:28px;cursor:pointer;color:#fff;font-size:16px;line-height:1">✕</button>
      </div>

      <!-- Cuerpo -->
      <style>
        .__cv-sec { padding:14px 20px; border-bottom:1px solid var(--color-borde); }
        .__cv-sec:last-child { border-bottom:none; }
        .__cv-titulo { font-size:10px;font-weight:700;color:var(--color-texto-suave);
          text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px; }
        .__cv-fila { display:flex;justify-content:space-between;align-items:baseline;
          font-size:13px;color:var(--color-texto);padding:3px 0; }
        .__cv-lbl { color:var(--color-texto-suave);font-size:12px;flex-shrink:0;margin-right:12px; }
        .__cv-monto { font-size:22px;font-weight:700;color:var(--color-exito); }
      </style>

      <!-- Comprobante -->
      <div class="__cv-sec">
        <div class="__cv-titulo">📋 Datos del comprobante</div>
        <div class="__cv-fila"><span class="__cv-lbl">Número</span><strong style="color:var(--color-secundario)">${escapar(d._ndoc || '—')}</strong></div>
        <div class="__cv-fila"><span class="__cv-lbl">Proveedor / Prestador</span><span>${escapar(d._proveedor || '—')}</span></div>
        ${extrasDoc}
        <div class="__cv-fila"><span class="__cv-lbl">Fecha emisión</span><span>${formatearFecha(d._fecha)}</span></div>
        <div class="__cv-fila"><span class="__cv-lbl">Total</span><strong class="__cv-monto">${formatearMoneda(d._total, 'PEN')}</strong></div>
      </div>

      <!-- Movimiento bancario -->
      <div class="__cv-sec">
        <div class="__cv-titulo">🏦 Movimiento bancario</div>
        <div class="__cv-fila"><span class="__cv-lbl">N° Operación</span><span style="font-family:monospace">${escapar(m.nro_operacion_bancaria || '—')}</span></div>
        <div class="__cv-fila"><span class="__cv-lbl">Fecha depósito</span><span>${formatearFecha(m.fecha_deposito)}</span></div>
        <div class="__cv-fila"><span class="__cv-lbl">Proveedor / Empresa</span><span>${escapar(m.proveedor_empresa_personal || '—')}</span></div>
        <div class="__cv-fila"><span class="__cv-lbl">Monto</span>
          <strong style="color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'}">${formatearMoneda(m.monto, m.moneda==='USD'?'USD':'PEN')}</strong>
        </div>
      </div>

      <!-- Score -->
      <div class="__cv-sec" style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="__cv-titulo" style="margin-bottom:4px">🎯 Confianza del match</div>
          <div style="font-size:12px;color:var(--color-texto-suave)">
            ${item.score >= 85 ? '✅ Alta — se puede aprobar con confianza'
              : item.score >= 60 ? '⚠️ Media — revisa antes de aprobar'
              : '❌ Baja — verificar manualmente'}
          </div>
        </div>
        ${_scoreChip(item.score)}
      </div>

      <!-- Acciones -->
      <div style="padding:14px 20px;display:flex;gap:8px;justify-content:flex-end">
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="padding:8px 16px;border:1px solid var(--color-borde);border-radius:8px;
            background:var(--color-bg-card);color:var(--color-texto);cursor:pointer;font-size:13px;font-family:var(--font)">
          Cerrar
        </button>
        <button onclick="this.closest('[style*=fixed]').remove(); _aprobarMatch('${m.id}','${d._tipo}','${d.id}',${item.score},'${item.score>=85?'EXACTO':'POSIBLE'}',${parseInt(key.split('_')[1])},'${key.split('_')[0]}')"
          style="padding:8px 16px;border:none;border-radius:8px;background:#2C5282;color:#fff;
            cursor:pointer;font-size:13px;font-family:var(--font);font-weight:500">
          ✓ Aprobar este match
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Panel lateral búsqueda manual (por key) ───────────────────────
function _abrirPanelManualPorKey(key) {
  const item = _conItemCache[key];
  if (!item) { mostrarToast('Dato no disponible', 'atencion'); return; }
  const m = item.mov;
  _abrirPanelManual(m.id, m.monto, m.fecha_deposito, m.nro_operacion_bancaria || '');
}

// ── Tabla Sin Match ───────────────────────────────────────────────
function _renderTablaSinMatch(wrap) {
  const lista = _filtrarItems(_con_resultados.sin_match, 'sin_match');
  const tab   = 'sin_match';

  if (!_con_resultados.sin_match.length) {
    wrap.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)"><p>Todos los movimientos tienen match ✓</p></div>';
    return;
  }

  const opciones = [
    { v:'', t:'— Clasificar como —' },
    { v:'FACTURA',       t:'FA — Factura' },
    { v:'RH',            t:'RH — Recibo honorarios' },
    { v:'GASTO_DIRECTO', t:'Gasto directo' },
    { v:'ITF',           t:'ITF — Impuesto bancario' },
    { v:'COMISION',      t:'Comisión bancaria' },
    { v:'OTRO',          t:'Otro' },
  ];
  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';

  wrap.innerHTML = `
    ${_filtroBarra(tab)}
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            ${_thFijo('N° Operación')}
            ${_thSort('fecha','Fecha',tab)}
            ${_thFijo('Descripción')}
            ${_thFijo('Proveedor / Empresa / Personal')}
            ${_thSort('monto','Monto',tab)}
            ${_thFijo('Estado')}
            ${_thFijo('Clasificar como')}
            ${_thFijo('Acciones')}
          </tr>
        </thead>
        <tbody>
          ${lista.length ? lista.map((item, idx) => {
            const m = item.mov;
            return `<tr id="con-row-sm-${idx}"
              onmouseover="this.style.background='var(--color-hover)'"
              onmouseout="this.style.background=''">
              <td style="${_TD};font-family:monospace;font-size:11px;white-space:nowrap">${escapar(m.nro_operacion_bancaria||'—')}</td>
              <td style="${_TD};white-space:nowrap">${formatearFecha(m.fecha_deposito)}</td>
              <td style="${_TD};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(m.descripcion||'')}">${escapar(m.descripcion||'—')}</td>
              <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.proveedor_empresa_personal||'')}">
                <strong style="font-size:11px">${escapar((m.proveedor_empresa_personal||'—').slice(0,30))}</strong>
              </td>
              <td style="${_TD};text-align:right;white-space:nowrap;font-weight:700;color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'}">
                ${formatearMoneda(m.monto, m.moneda==='USD'?'USD':'PEN')}
              </td>
              <td style="${_TD}">${_tdEstado(m.entrega_doc)}</td>
              <td style="${_TD}">
                <select id="con-clas-${idx}"
                  style="padding:4px 8px;border:1px solid var(--color-borde);border-radius:4px;
                         background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
                  ${opciones.map(o=>`<option value="${o.v}">${o.t}</option>`).join('')}
                </select>
              </td>
              <td style="${_TD}">
                <div style="display:flex;gap:4px">
                  <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 9px"
                    onclick="_guardarClasificacion('${m.id}',${idx})">Guardar</button>
                  <button title="Buscar comprobante manualmente" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px"
                    onclick="_abrirPanelManual('${m.id}',${m.monto},'${m.fecha_deposito || ''}','${(m.nro_operacion_bancaria||'').replace(/'/g,'') }')">🔍</button>
                </div>
              </td>
            </tr>`;
          }).join('') :
          `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--color-texto-suave)">Sin resultados para este filtro</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ── Aprobar match individual ─────────────────────────────────────
async function _aprobarMatch(movId, docTipo, docId, score, tipoMatch, idx, prefijo) {
  const hoy = new Date().toISOString().slice(0, 10);

  // Actualizar tesoreria_mbd
  const { error: errMov } = await _supabase
    .from('tesoreria_mbd')
    .update({ entrega_doc: 'EMITIDO' })
    .eq('id', movId);

  if (errMov) { mostrarToast('Error al actualizar movimiento: ' + errMov.message, 'error'); return; }

  // Registrar en conciliaciones
  await _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id,
    movimiento_id:        movId,
    doc_tipo:             docTipo,
    doc_id:               docId || null,
    score,
    tipo_match:           tipoMatch,
    estado:               'APROBADO',
    usuario_id:           perfil_usuario?.id || null,
  });

  // Animar fila
  const fila = document.getElementById(`con-row-${prefijo}-${idx}`);
  if (fila) {
    fila.style.opacity    = '0.35';
    fila.style.transition = 'opacity 0.3s';
    fila.querySelectorAll('button').forEach(b => b.disabled = true);
  }

  mostrarToast('✓ Match aprobado', 'exito');

  if (prefijo === 'ex') {
    _con_resultados.exactos  = _con_resultados.exactos.filter(i => i.mov.id !== movId);
    document.getElementById('con-cnt-exactos').textContent  = _con_resultados.exactos.length;
    _conActualizarBtnLote();
  } else {
    _con_resultados.posibles = _con_resultados.posibles.filter(i => i.mov.id !== movId);
    document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  }
}

// ── Rechazar match ────────────────────────────────────────────────
function _rechazarMatch(idx, prefijo) {
  const arr = prefijo === 'ex' ? _con_resultados.exactos : _con_resultados.posibles;
  const item = arr[idx];
  if (!item) return;

  _con_resultados.sin_match.push({ mov: item.mov, score: 0 });

  if (prefijo === 'ex') {
    _con_resultados.exactos  = arr.filter((_, i) => i !== idx);
    document.getElementById('con-cnt-exactos').textContent  = _con_resultados.exactos.length;
    _conActualizarBtnLote();
  } else {
    _con_resultados.posibles = arr.filter((_, i) => i !== idx);
    document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  }
  document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
  _conActivarSubtab(prefijo === 'ex' ? 'exactos' : 'posibles');
}

// ── Aprobar en lote ───────────────────────────────────────────────
async function _aprobarEnLote() {
  const lista = _con_resultados.exactos;
  if (!lista.length) return;

  if (!await confirmar(`¿Aprobar los ${lista.length} matches exactos en lote?`, { btnOk: 'Sí, aprobar todos', btnColor: '#166534' })) return;
  if (!await confirmar(`CONFIRMACIÓN FINAL: ¿Aprobar ${lista.length} registros como EMITIDOS?`, { btnOk: 'Confirmar', btnColor: '#166534' })) return;

  const hoy    = new Date().toISOString().slice(0, 10);
  let   ok     = 0;
  let   errores = 0;

  for (const item of lista) {
    const { error: e1 } = await _supabase.from('tesoreria_mbd')
      .update({ entrega_doc: 'EMITIDO' }).eq('id', item.mov.id);

    if (e1) { errores++; continue; }

    await _supabase.from('conciliaciones').insert({
      empresa_operadora_id: empresa_activa.id,
      movimiento_id:        item.mov.id,
      doc_tipo:             item.doc._tipo,
      doc_id:               item.doc.id || null,
      score:                item.score,
      tipo_match:           'EXACTO',
      estado:               'APROBADO',
      usuario_id:           perfil_usuario?.id || null,
    });
    ok++;
  }

  _con_resultados.exactos = [];
  document.getElementById('con-cnt-exactos').textContent = 0;
  _conActualizarBtnLote();
  _conActivarSubtab('exactos');

  mostrarToast(`✅ ${ok} aprobados${errores ? ` · ${errores} con error` : ''}.`, ok ? 'exito' : 'error');
}

// ── Guardar clasificación sin match ──────────────────────────────
async function _guardarClasificacion(movId, idx) {
  const sel  = document.getElementById(`con-clas-${idx}`);
  const clas = sel?.value || '';
  if (!clas) { mostrarToast('Selecciona una clasificación', 'atencion'); return; }

  const { error } = await _supabase.from('tesoreria_mbd')
    .update({ entrega_doc: 'EMITIDO', tipo_doc: clas })
    .eq('id', movId);

  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }

  await _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id,
    movimiento_id:        movId,
    doc_tipo:             'OTRO',
    doc_id:               null,
    score:                0,
    tipo_match:           'MANUAL',
    estado:               'APROBADO',
    clasificacion_manual: clas,
    usuario_id:           perfil_usuario?.id || null,
  });

  _con_resultados.sin_match = _con_resultados.sin_match.filter(i => i.mov.id !== movId);
  document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
  mostrarToast('✓ Clasificación guardada', 'exito');
  _conActivarSubtab('sin_match');
}

// ── Panel lateral búsqueda manual ────────────────────────────────
async function _abrirPanelManual(movId, monto, fecha, nroOp) {
  const panel = document.getElementById('con-panel-manual');
  const body  = document.getElementById('con-panel-manual-body');
  if (!panel || !body) return;

  panel.style.display = 'block';
  body.innerHTML = `
    <div style="margin-bottom:12px;padding:10px;background:var(--color-bg-alt,var(--color-hover));border-radius:6px;font-size:12px">
      <div><strong>N° Op:</strong> ${escapar(nroOp)}</div>
      <div><strong>Monto:</strong> ${formatearMoneda(monto)}</div>
      <div><strong>Fecha:</strong> ${formatearFecha(fecha)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
      <input type="text" id="pm-q-num" placeholder="N° comprobante (E001-14, F001-...)"
        style="padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
      <input type="text" id="pm-q-prov" placeholder="Proveedor / RUC"
        style="padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
      <button class="btn btn-primario" style="width:100%" onclick="_panelBuscar('${movId}')">🔍 Buscar</button>
    </div>
    <div id="pm-resultados" style="font-size:12px;color:var(--color-texto-suave)">Ingresa criterios de búsqueda…</div>`;
}

async function _panelBuscar(movId) {
  const qNum  = (document.getElementById('pm-q-num')?.value  || '').trim().toLowerCase();
  const qProv = (document.getElementById('pm-q-prov')?.value || '').trim().toLowerCase();
  const resEl = document.getElementById('pm-resultados');
  if (!resEl) return;
  if (!qNum && !qProv) { mostrarToast('Ingresa al menos un criterio', 'atencion'); return; }

  resEl.innerHTML = '<div class="spinner" style="margin:10px auto"></div>';

  const periodo = _con_periodo_actual;
  const [resC, resR] = await Promise.all([
    _supabase.from('registro_compras').select('*').eq('empresa_operadora_id', empresa_activa.id).eq('periodo', periodo),
    _supabase.from('rh_registros').select('*, prestadores_servicios(nombre, dni)').eq('empresa_operadora_id', empresa_activa.id).eq('periodo', periodo),
  ]);

  const todos = [
    ...(resC.data||[]).map(d=>({ ...d, _tipo:'COMPRA', _ndoc:[d.serie,d.numero].filter(Boolean).join('-')||d.id?.slice(0,8), _prov: d.nombre_proveedor||'', _total: d.total||0 })),
    ...(resR.data||[]).map(d=>({ ...d, _tipo:'RH',     _ndoc: d.numero_rh||d.id?.slice(0,8), _prov: d.prestadores_servicios?.nombre||'', _total: d.monto_neto||0 })),
  ].filter(d => {
    const ndocL = (d._ndoc||'').toLowerCase();
    const provL = (d._prov||'').toLowerCase();
    if (qNum  && !ndocL.includes(qNum))  return false;
    if (qProv && !provL.includes(qProv)) return false;
    return true;
  });

  if (!todos.length) {
    resEl.innerHTML = '<p style="text-align:center;padding:16px">Sin resultados</p>';
    return;
  }

  resEl.innerHTML = todos.slice(0,10).map(d => `
    <div style="border:1px solid var(--color-borde);border-radius:6px;padding:10px;margin-bottom:8px">
      <div style="font-weight:600;color:var(--color-secundario)">${escapar(d._ndoc)}</div>
      <div style="font-size:11px;color:var(--color-texto-suave)">${escapar(d._prov)} · ${formatearMoneda(d._total)}</div>
      <div style="margin-top:6px">
        <button class="btn btn-sm btn-primario" style="font-size:11px"
          onclick="_vincularManual('${movId}','${d._tipo}','${d.id}')">✓ Vincular</button>
      </div>
    </div>`).join('');
}

async function _vincularManual(movId, docTipo, docId) {
  const { error } = await _supabase.from('tesoreria_mbd')
    .update({ entrega_doc: 'EMITIDO' }).eq('id', movId);

  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }

  await _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id,
    movimiento_id:        movId,
    doc_tipo:             docTipo,
    doc_id:               docId,
    score:                0,
    tipo_match:           'MANUAL',
    estado:               'APROBADO',
    usuario_id:           perfil_usuario?.id || null,
  });

  document.getElementById('con-panel-manual').style.display = 'none';
  mostrarToast('✓ Vinculación manual guardada', 'exito');

  // Quitar de listas
  _con_resultados.exactos   = _con_resultados.exactos.filter(i => i.mov.id !== movId);
  _con_resultados.posibles  = _con_resultados.posibles.filter(i => i.mov.id !== movId);
  _con_resultados.sin_match = _con_resultados.sin_match.filter(i => i.mov.id !== movId);
  document.getElementById('con-cnt-exactos').textContent  = _con_resultados.exactos.length;
  document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
  _conActualizarBtnLote();
  _conActivarSubtab(_con_tab_activo);
}

// ── Exportar aprobados ────────────────────────────────────────────
async function _conExportarAprobados() {
  if (!_con_periodo_actual) { mostrarToast('Primero ejecuta la conciliación', 'atencion'); return; }
  const [yyyy, mm] = _con_periodo_actual.split('-');

  const { data, error } = await _supabase
    .from('tesoreria_mbd')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .eq('entrega_doc', 'EMITIDO')
    .gte('fecha_deposito', `${yyyy}-${mm}-01`)
    .lte('fecha_deposito', `${yyyy}-${mm}-31`);

  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  if (!data?.length) { mostrarToast('Sin registros aprobados para exportar', 'atencion'); return; }

  const cab = ['N° Operación','Fecha Depósito','Descripción','Moneda','Monto',
    'Proveedor/Empresa/Personal','RUC/DNI','Cotización','OC','Proyecto','Concepto',
    'Empresa','Estado Doc','Nº Factura/DOC','Tipo DOC','Autorización',
    'Observaciones','Detalles Compra/Servicio','Observaciones 2'];

  const filas = data.map(m => [
    m.nro_operacion_bancaria||'', m.fecha_deposito||'', m.descripcion||'',
    m.moneda||'S/', m.monto,
    m.proveedor_empresa_personal||'', m.ruc_dni||'', m.cotizacion||'',
    m.oc||'', m.proyecto||'', m.concepto||'', m.empresa||'',
    m.entrega_doc||'', m.nro_factura_doc||'', m.tipo_doc||'',
    m.autorizacion||'', m.observaciones||'',
    m.detalles_compra_servicio||'', m.observaciones_2||'',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'APROBADOS');
  XLSX.writeFile(wb, `Conciliacion_${_con_periodo_actual}_${empresa_activa.ruc||''}.xlsx`);
  mostrarToast('✓ Exportación completada', 'exito');
}
