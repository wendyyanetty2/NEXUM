// ═══════════════════════════════════════════════════════════════
// Conciliación — Tab Conciliar
// ═══════════════════════════════════════════════════════════════

let _con_resultados    = { exactos: [], posibles: [], sin_match: [] };
let _con_tab_activo    = 'exactos';
let _con_periodo_actual = null;
let _con_cuenta_actual  = null;

async function renderTabConciliar(area) {
  area.innerHTML = `
    <div class="fadeIn">

      <!-- Paso 1: Seleccionar periodo -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
          <h3 style="margin:0">Paso 1: Seleccionar periodo</h3>
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
            <button class="btn btn-primario w-full" onclick="_conIniciar()">
              🔗 Iniciar conciliación
            </button>
          </div>
        </div>
      </div>

      <!-- Resumen de resultados -->
      <div id="con-resumen" style="display:none;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div class="card" style="text-align:center;border-left:4px solid #22c55e;padding:16px">
            <div style="font-size:28px;font-weight:700;color:#22c55e" id="con-cnt-exactos">0</div>
            <div class="text-muted text-sm">Matches exactos</div>
          </div>
          <div class="card" style="text-align:center;border-left:4px solid #f59e0b;padding:16px">
            <div style="font-size:28px;font-weight:700;color:#f59e0b" id="con-cnt-posibles">0</div>
            <div class="text-muted text-sm">Posibles matches</div>
          </div>
          <div class="card" style="text-align:center;border-left:4px solid #ef4444;padding:16px">
            <div style="font-size:28px;font-weight:700;color:#ef4444" id="con-cnt-sinmatch">0</div>
            <div class="text-muted text-sm">Sin match</div>
          </div>
        </div>
      </div>

      <!-- Tabs internos y tabla -->
      <div id="con-tabs-wrap" style="display:none">
        <div style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primario" id="con-itab-exactos"
                  onclick="_conActivarSubtab('exactos')">🟢 Exactos</button>
          <button class="btn btn-sm btn-secundario" id="con-itab-posibles"
                  onclick="_conActivarSubtab('posibles')">🟡 Posibles</button>
          <button class="btn btn-sm btn-secundario" id="con-itab-sinmatch"
                  onclick="_conActivarSubtab('sin_match')">🔴 Sin match</button>
          <div style="flex:1"></div>
          <button class="btn btn-sm btn-secundario" onclick="_conExportarAprobados()">
            📥 Exportar aprobados
          </button>
        </div>
        <div id="con-tabla-wrap"></div>
      </div>

      <!-- Estado vacío -->
      <div id="con-vacio" class="card" style="text-align:center;padding:48px;color:var(--color-texto-suave)">
        <div style="font-size:48px;margin-bottom:12px">🔗</div>
        <p style="font-weight:500">Selecciona un periodo e inicia la conciliación</p>
        <p class="text-muted text-sm">El sistema cruzará automáticamente los movimientos con compras, ventas y RH</p>
      </div>

    </div>`;

  await _conCargarCuentas();

  const hoy  = new Date();
  const yyyy = hoy.getFullYear();
  const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
  const el   = document.getElementById('con-periodo');
  if (el) el.value = `${yyyy}-${mm}`;
}

async function _conCargarCuentas() {
  // El filtro de cuenta se eliminó — contexto de empresa ya definido al iniciar sesión
}

async function _conBorrarMes() {
  const periodo = document.getElementById('con-periodo')?.value;
  if (!periodo) { mostrarToast('Selecciona un periodo primero', 'atencion'); return; }
  const ok1 = await confirmar(`¿Eliminar TODA la conciliación de ${periodo}? Esta acción no se puede deshacer.`, { btnOk: 'Sí, borrar', btnColor: '#C53030' });
  if (!ok1) return;
  const ok2 = await confirmar(`CONFIRMACIÓN FINAL: ¿Borrar conciliación ${periodo}?`, { btnOk: 'Confirmar', btnColor: '#C53030' });
  if (!ok2) return;
  const [yyyy, mm] = periodo.split('-');
  const inicio = `${yyyy}-${mm}-01`;
  const fin    = new Date(parseInt(yyyy), parseInt(mm), 0).toISOString().slice(0, 10);
  const { error } = await _supabase.from('conciliaciones')
    .delete()
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('created_at', inicio)
    .lte('created_at', fin);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ Conciliación ${periodo} eliminada.`, 'exito');
}

async function _conBorrarAnio() {
  const periodo = document.getElementById('con-periodo')?.value;
  if (!periodo) { mostrarToast('Selecciona un periodo para obtener el año', 'atencion'); return; }
  const yyyy = periodo.split('-')[0];
  const ok1 = await confirmar(`¿Eliminar TODA la conciliación del año ${yyyy}? Esta acción borra 12 meses completos.`, { btnOk: 'Sí, borrar año', btnColor: '#C53030' });
  if (!ok1) return;
  const ok2 = await confirmar(`CONFIRMACIÓN FINAL: ¿Borrar conciliación año ${yyyy} completo?`, { btnOk: 'Confirmar', btnColor: '#C53030' });
  if (!ok2) return;
  const { error } = await _supabase.from('conciliaciones')
    .delete()
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('created_at', `${yyyy}-01-01`)
    .lte('created_at', `${yyyy}-12-31`);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ Conciliación año ${yyyy} eliminada.`, 'exito');
}

async function _conIniciar() {
  const periodoEl = document.getElementById('con-periodo');
  const periodo   = periodoEl?.value;
  const cuentaId  = null;

  if (!periodo) { mostrarToast('Selecciona un periodo', 'atencion'); return; }

  _con_periodo_actual = periodo;
  _con_cuenta_actual  = cuentaId;

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
    _con_resultados = await _ejecutarConciliacion(periodo, cuentaId);

    document.getElementById('con-cnt-exactos').textContent  = _con_resultados.exactos.length;
    document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
    document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;

    _conActivarSubtab(_con_tab_activo);

  } catch (err) {
    if (tablaWrap) tablaWrap.innerHTML = `<div class="alerta-error">${escapar(err.message)}</div>`;
  }
}

async function _ejecutarConciliacion(periodo, cuentaId) {
  const [yyyy, mm] = periodo.split('-');
  const inicio = `${yyyy}-${mm}-01`;
  const fin    = new Date(parseInt(yyyy), parseInt(mm), 0).toISOString().slice(0, 10);

  let qMov = _supabase
    .from('movimientos')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha', inicio)
    .lte('fecha', fin)
    .eq('estado_doc', 'PENDIENTE');

  if (cuentaId) qMov = qMov.eq('cuenta_bancaria_id', cuentaId);

  const [resMovs, resCompras, resVentas, resRh] = await Promise.all([
    qMov,
    _supabase
      .from('registro_compras')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo)
      .eq('estado', 'EMITIDO'),
    _supabase
      .from('registro_ventas')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo)
      .eq('estado', 'EMITIDO'),
    _supabase
      .from('rh_registros')
      .select('*, prestadores_servicios(nombre, dni)')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo)
      .eq('estado', 'EMITIDO'),
  ]);

  const movBanco = resMovs.data   || [];
  const compras  = (resCompras.data || []).map(d => ({ ...d, _tipo: 'COMPRA', total: d.total || d.importe_total || 0, ruc: d.ruc_proveedor || d.ruc || null, fecha_doc: d.fecha_emision || d.fecha || null }));
  const ventas   = (resVentas.data  || []).map(d => ({ ...d, _tipo: 'VENTA',  total: d.total || d.importe_total || 0, ruc: d.ruc_cliente   || d.ruc || null, fecha_doc: d.fecha_emision || d.fecha || null }));
  const rhRegs   = (resRh.data      || []).map(d => ({ ...d, _tipo: 'RH',     total: d.monto_neto || 0, ruc: d.prestadores_servicios?.dni || null, fecha_doc: d.fecha_emision || null }));

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

    if (mejorDoc && mejorScore >= 80) {
      usadosDoc.add(mejorDoc.id);
      exactos.push({ mov, doc: mejorDoc, score: mejorScore });
    } else if (mejorDoc && mejorScore >= 40) {
      posibles.push({ mov, doc: mejorDoc, score: mejorScore });
    } else {
      sin_match.push({ mov });
    }
  }

  return { exactos, posibles, sin_match };
}

function _calcularScore(movimiento, documento) {
  let score = 0;

  // ── Monto (50 pts máx) ──────────────────────────────────────────
  const montoMov = Math.abs(parseFloat(movimiento.importe) || 0);
  const montoDoc = Math.abs(parseFloat(documento.total)    || 0);
  const diff     = Math.abs(montoMov - montoDoc);

  if (diff === 0) score += 50;
  else if (diff <= 1) score += 45;
  else if (diff <= 5) score += 40;
  else if (montoDoc > 0 && diff / montoDoc < 0.02) score += 30;
  else if (montoDoc > 0 && diff / montoDoc < 0.05) score += 15;

  // ── Fecha (20 pts máx) ──────────────────────────────────────────
  const fechaMov = movimiento.fecha ? new Date(movimiento.fecha) : null;
  const fechaDoc = documento.fecha_doc ? new Date(documento.fecha_doc) : null;
  if (fechaMov && fechaDoc) {
    const dias = Math.abs((fechaMov - fechaDoc) / (1000 * 60 * 60 * 24));
    if (dias === 0) score += 20;
    else if (dias <= 3) score += 15;
    else if (dias <= 7) score += 8;
  }

  // ── RUC / DNI (15 pts) ──────────────────────────────────────────
  const rucMov = (movimiento.ruc_dni_raw || '').toString().trim();
  const rucDoc = (documento.ruc         || '').toString().trim();
  if (rucMov && rucDoc && rucMov === rucDoc) score += 15;

  // ── Proveedor / Empresa / Personal (15 pts) ─────────────────────
  const provMov = (movimiento.nombre_proveedor_raw || movimiento.descripcion || '').toLowerCase().trim();
  const provDoc = (documento.nombre_proveedor || documento.razon_social ||
                   documento.prestadores_servicios?.nombre || '').toLowerCase().trim();
  if (provMov && provDoc) {
    if (provMov === provDoc) {
      score += 15;
    } else {
      // Similitud fuzzy: palabras en común
      const wordsA = provMov.split(/\s+/).filter(w => w.length > 3);
      const wordsB = new Set(provDoc.split(/\s+/).filter(w => w.length > 3));
      const comunes = wordsA.filter(w => wordsB.has(w)).length;
      if (comunes >= 2) score += 12;
      else if (comunes === 1) score += 6;
      // Coincidencia parcial de substring
      else if (provDoc.includes(provMov.slice(0, 6)) || provMov.includes(provDoc.slice(0, 6))) score += 5;
    }
  }

  return Math.min(score, 100);
}

// Helper: score visual con color
function _scoreChip(score) {
  let bg, color;
  if (score >= 80) { bg = '#dcfce7'; color = '#166534'; }
  else if (score >= 60) { bg = '#fef9c3'; color = '#854d0e'; }
  else if (score >= 40) { bg = '#ffedd5'; color = '#9a3412'; }
  else { bg = '#fee2e2'; color = '#991b1b'; }
  return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap">${score}%</span>`;
}

function _conActivarSubtab(tab) {
  _con_tab_activo = tab;

  ['exactos','posibles','sinmatch'].forEach(t => {
    const btn = document.getElementById('con-itab-' + t);
    if (btn) {
      btn.className = 'btn btn-sm ' + (
        (t === 'sin_match' ? 'sinmatch' : t) === tab || t === tab
          ? 'btn-primario'
          : 'btn-secundario'
      );
    }
  });

  const mapBtn = { exactos: 'exactos', posibles: 'posibles', sin_match: 'sinmatch' };
  Object.keys(mapBtn).forEach(k => {
    const btn = document.getElementById('con-itab-' + mapBtn[k]);
    if (btn) btn.className = 'btn btn-sm ' + (k === tab ? 'btn-primario' : 'btn-secundario');
  });

  const wrap = document.getElementById('con-tabla-wrap');
  if (!wrap) return;

  if (tab === 'exactos')   _renderTablaExactos(wrap);
  if (tab === 'posibles')  _renderTablaPosibles(wrap);
  if (tab === 'sin_match') _renderTablaSinMatch(wrap);
}

// ── Helpers de tabla ─────────────────────────────────────────────
function _tdEstado(estado) {
  const cfg = {
    PENDIENTE: { bg:'#C53030', label:'PENDIENTE' },
    OBSERVADO: { bg:'#D69E2E', label:'OBSERVADO' },
    EMITIDO:   { bg:'#2F855A', label:'EMITIDO'   },
    CANCELADO: { bg:'#718096', label:'CANCELADO'  },
  }[estado] || { bg:'#718096', label: estado || '—' };
  return `<span style="background:${cfg.bg};color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${cfg.label}</span>`;
}

function _thCon(cols) {
  return cols.map(c => `<th style="white-space:nowrap;padding:9px 10px;font-size:11px">${c}</th>`).join('');
}

// ── Tabla Exactos ─────────────────────────────────────────────────
function _renderTablaExactos(wrap) {
  const lista = _con_resultados.exactos;
  if (!lista.length) {
    wrap.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)"><p>Sin matches exactos para este periodo</p></div>';
    return;
  }
  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';
  wrap.innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            ${_thCon(['N° Operación','Fecha','Descripción','Proveedor / Empresa / Personal','Monto','Score','Comprobante sugerido','Tipo DOC','Estado','Acciones'])}
          </tr>
        </thead>
        <tbody>
          ${lista.map((item, idx) => {
            const m   = item.mov;
            const d   = item.doc;
            const prov = d.nombre_proveedor || d.razon_social || d.prestadores_servicios?.nombre || '—';
            const nDoc = d.numero_documento || d.numero_rh || d.serie_numero || d.id?.slice(0,8) || '—';
            return `<tr id="con-row-ex-${idx}" onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''">
              <td style="${_TD};font-family:monospace;font-size:11px">${escapar(m.numero_operacion || '—')}</td>
              <td style="${_TD};white-space:nowrap">${formatearFecha(m.fecha)}</td>
              <td style="${_TD};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.descripcion||'')}">${escapar((m.descripcion||'—').slice(0,35))}</td>
              <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.nombre_proveedor_raw||'')}"><strong>${escapar((m.nombre_proveedor_raw||'—').slice(0,30))}</strong></td>
              <td style="${_TD};text-align:right;white-space:nowrap">
                <span class="${m.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:700">
                  ${m.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(Math.abs(m.importe||0),m.moneda)}
                </span>
              </td>
              <td style="${_TD};text-align:center">${_scoreChip(item.score)}</td>
              <td style="${_TD};max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(prov)}">
                <div style="font-size:11px;font-weight:600">${escapar(nDoc)}</div>
                <div style="font-size:10px;color:var(--color-texto-suave)">${escapar(prov.slice(0,25))}</div>
              </td>
              <td style="${_TD};text-align:center"><span style="background:var(--color-secundario);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escapar(d._tipo||'—')}</span></td>
              <td style="${_TD}">${_tdEstado(m.estado_doc)}</td>
              <td style="${_TD}">
                <div style="display:flex;gap:4px;white-space:nowrap">
                  <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 8px"
                    onclick="_aprobarMatch('${m.id}','${d._tipo}','${d.id}',${item.score},'EXACTO',${idx},'ex')">✓ Aprobar</button>
                  <button class="btn btn-sm btn-secundario" style="font-size:11px;padding:4px 8px"
                    onclick="_rechazarMatch(${idx},'ex')">✗</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Tabla Posibles ────────────────────────────────────────────────
function _renderTablaPosibles(wrap) {
  const lista = _con_resultados.posibles;
  if (!lista.length) {
    wrap.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)"><p>Sin matches posibles para este periodo</p></div>';
    return;
  }
  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';
  wrap.innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            ${_thCon(['N° Operación','Fecha','Descripción','Proveedor / Empresa / Personal','Monto','Score','Comprobante sugerido','Tipo DOC','Estado','Acciones'])}
          </tr>
        </thead>
        <tbody>
          ${lista.map((item, idx) => {
            const m   = item.mov;
            const d   = item.doc;
            const prov = d.nombre_proveedor || d.razon_social || d.prestadores_servicios?.nombre || '—';
            const nDoc = d.numero_documento || d.numero_rh || d.serie_numero || d.id?.slice(0,8) || '—';
            return `<tr id="con-row-pos-${idx}" onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''">
              <td style="${_TD};font-family:monospace;font-size:11px">${escapar(m.numero_operacion || '—')}</td>
              <td style="${_TD};white-space:nowrap">${formatearFecha(m.fecha)}</td>
              <td style="${_TD};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.descripcion||'')}">${escapar((m.descripcion||'—').slice(0,35))}</td>
              <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.nombre_proveedor_raw||'')}"><strong>${escapar((m.nombre_proveedor_raw||'—').slice(0,30))}</strong></td>
              <td style="${_TD};text-align:right;white-space:nowrap">
                <span class="${m.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:700">
                  ${m.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(Math.abs(m.importe||0),m.moneda)}
                </span>
              </td>
              <td style="${_TD};text-align:center">${_scoreChip(item.score)}</td>
              <td style="${_TD};max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(prov)}">
                <div style="font-size:11px;font-weight:600">${escapar(nDoc)}</div>
                <div style="font-size:10px;color:var(--color-texto-suave)">${escapar(prov.slice(0,25))}</div>
              </td>
              <td style="${_TD};text-align:center"><span style="background:#D69E2E;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escapar(d._tipo||'—')}</span></td>
              <td style="${_TD}">${_tdEstado(m.estado_doc)}</td>
              <td style="${_TD}">
                <div style="display:flex;gap:4px;white-space:nowrap">
                  <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 8px"
                    onclick="_aprobarMatch('${m.id}','${d._tipo}','${d.id}',${item.score},'POSIBLE',${idx},'pos')">✓ Aprobar</button>
                  <button class="btn btn-sm btn-secundario" style="font-size:11px;padding:4px 8px"
                    onclick="_rechazarMatch(${idx},'pos')">✗</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Tabla Sin Match ───────────────────────────────────────────────
function _renderTablaSinMatch(wrap) {
  const lista = _con_resultados.sin_match;
  if (!lista.length) {
    wrap.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)"><p>Todos los movimientos tienen match ✓</p></div>';
    return;
  }

  const opciones = [
    { v: '', t: '— Clasificar como —' },
    { v: 'FACTURA',       t: 'FA — Factura' },
    { v: 'RH',            t: 'RH — Recibo honorarios' },
    { v: 'GASTO_DIRECTO', t: 'Gasto directo' },
    { v: 'ITF',           t: 'ITF — Impuesto transacciones' },
    { v: 'COMISION',      t: 'Comisión bancaria' },
    { v: 'OTRO',          t: 'Otro' },
  ];
  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';

  wrap.innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            ${_thCon(['N° Operación','Fecha','Descripción','Proveedor / Empresa / Personal','Monto','Estado','Clasificar como',''])}
          </tr>
        </thead>
        <tbody>
          ${lista.map((item, idx) => {
            const m = item.mov;
            return `<tr id="con-row-sm-${idx}" onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''">
              <td style="${_TD};font-family:monospace;font-size:11px">${escapar(m.numero_operacion || '—')}</td>
              <td style="${_TD};white-space:nowrap">${formatearFecha(m.fecha)}</td>
              <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.descripcion||'')}">${escapar((m.descripcion||'—').slice(0,40))}</td>
              <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.nombre_proveedor_raw||'')}"><strong>${escapar((m.nombre_proveedor_raw||'—').slice(0,30))}</strong></td>
              <td style="${_TD};text-align:right;white-space:nowrap">
                <span class="${m.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:700">
                  ${m.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(Math.abs(m.importe||0),m.moneda)}
                </span>
              </td>
              <td style="${_TD}">${_tdEstado(m.estado_doc)}</td>
              <td style="${_TD}">
                <select id="con-clas-${idx}" style="padding:4px 8px;border:1px solid var(--color-borde);border-radius:4px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
                  ${opciones.map(o => `<option value="${o.v}">${o.t}</option>`).join('')}
                </select>
              </td>
              <td style="${_TD}">
                <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 10px"
                  onclick="_guardarClasificacion('${m.id}',${idx})">Guardar</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Aprobar match ─────────────────────────────────────────────────
async function _aprobarMatch(movId, docTipo, docId, score, tipoMatch, idx, prefijo) {
  const hoy = new Date().toISOString().slice(0, 10);

  const { error: errMov } = await _supabase
    .from('movimientos')
    .update({
      estado_doc:        'EMITIDO',
      conciliado:        true,
      fecha_conciliacion: hoy,
    })
    .eq('id', movId);

  if (errMov) { mostrarToast('Error al actualizar movimiento: ' + errMov.message, 'error'); return; }

  const { error: errCon } = await _supabase
    .from('conciliaciones')
    .insert({
      empresa_operadora_id: empresa_activa.id,
      movimiento_id:        movId,
      doc_tipo:             docTipo,
      doc_id:               docId || null,
      score,
      tipo_match:           tipoMatch,
      estado:               'APROBADO',
      usuario_id:           perfil_usuario?.id || null,
    });

  if (errCon) { mostrarToast('Error al registrar conciliación: ' + errCon.message, 'error'); return; }

  const fila = document.getElementById(`con-row-${prefijo}-${idx}`);
  if (fila) {
    fila.style.opacity    = '0.4';
    fila.style.transition = 'opacity 0.3s';
    fila.querySelectorAll('button').forEach(b => b.disabled = true);
  }

  mostrarToast('Match aprobado', 'exito');

  if (prefijo === 'ex') {
    _con_resultados.exactos  = _con_resultados.exactos.filter((_, i) => i !== idx);
    document.getElementById('con-cnt-exactos').textContent = _con_resultados.exactos.length;
  } else {
    _con_resultados.posibles = _con_resultados.posibles.filter((_, i) => i !== idx);
    document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  }
}

// ── Rechazar match ────────────────────────────────────────────────
function _rechazarMatch(idx, prefijo) {
  const fila = document.getElementById(`con-row-${prefijo}-${idx}`);
  if (fila) {
    fila.style.background = 'var(--color-danger-bg,#FFF5F5)';
    fila.querySelectorAll('button').forEach(b => b.disabled = true);
  }

  if (prefijo === 'ex') {
    const item = _con_resultados.exactos[idx];
    if (item) {
      _con_resultados.sin_match.push({ mov: item.mov });
      _con_resultados.exactos = _con_resultados.exactos.filter((_, i) => i !== idx);
      document.getElementById('con-cnt-exactos').textContent  = _con_resultados.exactos.length;
      document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
    }
  } else {
    const item = _con_resultados.posibles[idx];
    if (item) {
      _con_resultados.sin_match.push({ mov: item.mov });
      _con_resultados.posibles = _con_resultados.posibles.filter((_, i) => i !== idx);
      document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
      document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
    }
  }
}

// ── Guardar clasificación sin match ──────────────────────────────
async function _guardarClasificacion(movId, idx) {
  const sel = document.getElementById(`con-clas-${idx}`);
  const clas = sel?.value || '';
  if (!clas) { mostrarToast('Selecciona una clasificación', 'atencion'); return; }

  const { error } = await _supabase
    .from('movimientos')
    .update({
      estado_doc:      'EMITIDO',
      observaciones_2: clas,
    })
    .eq('id', movId);

  if (error) { mostrarToast('Error al guardar: ' + error.message, 'error'); return; }

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

  const fila = document.getElementById(`con-row-sm-${idx}`);
  if (fila) {
    fila.style.opacity = '0.4';
    fila.querySelectorAll('button, select').forEach(b => b.disabled = true);
  }

  _con_resultados.sin_match = _con_resultados.sin_match.filter((_, i) => i !== idx);
  document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
  mostrarToast('Clasificación guardada', 'exito');
}

// ── Exportar aprobados ────────────────────────────────────────────
async function _conExportarAprobados() {
  if (!_con_periodo_actual) { mostrarToast('Primero ejecuta la conciliación', 'atencion'); return; }

  const { data, error } = await _supabase
    .from('movimientos')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('conciliado', true)
    .gte('fecha', _con_periodo_actual + '-01')
    .lte('fecha', _con_periodo_actual + '-31');

  if (error) { mostrarToast('Error al obtener datos: ' + error.message, 'error'); return; }
  if (!data?.length) { mostrarToast('Sin registros aprobados para exportar', 'atencion'); return; }

  const filas = [
    [
      'N° Operación','Fecha Depósito','Descripción','Moneda','Monto',
      'Proveedor/Empresa/Personal','RUC/DNI','Cotización','OC','Proyecto',
      'Concepto','Empresa','Estado Doc','Nº Factura/DOC','Tipo DOC',
      'Autorización','Observaciones','Detalles Compra/Servicio','Observaciones 2',
      'Fecha Registro','Usuario',
    ],
    ...data.map(m => [
      m.numero_operacion   || '',
      m.fecha              || '',
      m.descripcion        || '',
      m.moneda             || 'PEN',
      m.naturaleza === 'CARGO' ? -Math.abs(m.importe) : Math.abs(m.importe),
      '',
      m.ruc_dni_raw        || '',
      m.cotizacion         || '',
      m.oc                 || '',
      '',
      '',
      empresa_activa.nombre || '',
      m.estado_doc         || '',
      m.numero_documento   || '',
      m.tipo_documento_codigo || '',
      '',
      m.observaciones      || '',
      m.detalles_servicio  || '',
      m.observaciones_2    || '',
      m.fecha_creacion?.slice(0,10) || '',
      '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'REGISTRO');
  XLSX.writeFile(wb, `MBD_Conciliado_${_con_periodo_actual}_${empresa_activa.ruc || ''}.xlsx`);
  mostrarToast('Exportación completada', 'exito');
}
