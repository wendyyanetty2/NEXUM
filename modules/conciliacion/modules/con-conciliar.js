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

      <!-- Selector de periodo + borrar -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <h3 style="margin:0">Seleccionar periodo</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="_conVerificarMontosClick()" style="padding:6px 12px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)" title="Revisa comprobantes vinculados a un movimiento bancario cuyo monto no coincide">⚠️ Verificar montos</button>
            <button onclick="_dupDescuadresVinculacion()" style="padding:6px 12px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)" title="Compras/Ventas/RH cuyos movimientos bancarios vinculados (mismo N° de comprobante) suman más de lo que corresponde">⚖️ Descuadres de vínculo</button>
            <button onclick="_dupNumerosCompartidosEntreEmisores()" style="padding:6px 12px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)" title="Compras/Ventas/RH donde el mismo N° de comprobante aparece con proveedores/emisores distintos — para revisar a mano, sobre todo cuando falta el RUC">🔀 N° compartidos entre emisores</button>
            <button onclick="_conBorrarMes()" style="padding:6px 12px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">🗑️ Borrar mes</button>
            <button onclick="_conBorrarAnio()" style="padding:6px 12px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">🗑️ Borrar año</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;align-items:end">
          <div class="campo" style="margin-bottom:0">
            <label class="label-filtro">Mes / Periodo</label>
            <input type="month" id="con-periodo" class="input-buscar w-full" onchange="_conPanelCambiarMes()">
          </div>
          <div>
            <button class="btn btn-primario w-full" onclick="_conIniciar()">🔗 Iniciar conciliación</button>
          </div>
        </div>

        <!-- Info ventana temporal siempre activa -->
        <div style="margin-top:12px;padding:10px 14px;background:rgba(44,82,130,.07);border-radius:8px;border:1px solid rgba(44,82,130,.2);display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:16px;flex-shrink:0;margin-top:1px">📅</span>
          <div style="font-size:13px;color:var(--color-texto);line-height:1.4">
            <strong>Ventana de búsqueda: 9 meses (siempre activa)</strong><br>
            <span style="font-size:11px;color:var(--color-texto-suave)">
              El motor busca comprobantes desde 3 meses antes hasta 6 meses después del mes seleccionado.
            </span>
          </div>
        </div>
      </div>

      <!-- ═══ PANEL DE AVANCE ══════════════════════════════════════ -->
      <div id="con-panel-avance" style="display:none;margin-bottom:16px">
        <div class="card" style="padding:18px 22px;border-left:4px solid var(--color-secundario)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px">
            <div>
              <span style="font-weight:700;font-size:14px">📊 Avance de conciliación — </span>
              <span id="pan-label-mes" style="font-weight:700;font-size:14px;color:var(--color-secundario)"></span>
            </div>
            <button onclick="_conExportarAvance()" class="btn btn-sm btn-secundario">📥 Exportar avance</button>
          </div>

          <!-- Barra de progreso -->
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-texto-suave);margin-bottom:4px">
              <span id="pan-barra-label">Calculando…</span>
              <span id="pan-pct" style="font-weight:700;font-size:14px;color:var(--color-secundario)">0%</span>
            </div>
            <div style="height:14px;background:var(--color-hover);border-radius:7px;overflow:hidden">
              <div id="pan-barra" style="height:100%;width:0%;background:var(--color-secundario);border-radius:7px;transition:width 0.5s ease"></div>
            </div>
          </div>

          <!-- Indicador mes completo -->
          <div id="pan-completo" style="display:none;margin-bottom:12px;padding:8px 14px;background:rgba(34,197,94,.12);border:1px solid #22c55e;border-radius:8px;color:#166534;font-weight:600;font-size:13px;text-align:center">
            ✅ Mes conciliado completo — todos los movimientos tienen comprobante
          </div>

          <!-- Alertas de validación -->
          <div id="pan-alertas" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px"></div>

          <!-- Stats por estado -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
            <div class="resumen-card" style="background:#16a34a">
              <div class="rc-label">✅ Emitidos</div>
              <div id="pan-emit-n" class="rc-valor">0</div>
              <div id="pan-emit-s" class="rc-sub"></div>
            </div>
            <div class="resumen-card" style="background:#b45309">
              <div class="rc-label">⚠️ Observados</div>
              <div id="pan-obs-n"  class="rc-valor">0</div>
              <div id="pan-obs-s"  class="rc-sub"></div>
            </div>
            <div class="resumen-card" style="background:#dc2626">
              <div class="rc-label">🔴 Pendientes</div>
              <div id="pan-pend-n" class="rc-valor">0</div>
              <div id="pan-pend-s" class="rc-sub"></div>
            </div>
            <div class="resumen-card" style="background:var(--color-primario)">
              <div class="rc-label">📋 Total</div>
              <div id="pan-total-n" class="rc-valor">0</div>
              <div id="pan-total-s" class="rc-sub"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sugerencias del motor (tabs) -->
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
          <button class="btn btn-sm btn-secundario" id="con-itab-historial" onclick="_conActivarSubtab('historial')">📋 Historial</button>
          <div style="flex:1"></div>
          <button id="con-btn-lote" class="btn btn-sm" style="display:none;background:#166534;color:#fff;border-radius:var(--radio)"
            onclick="_aprobarEnLote()">✅ Aprobar todos los exactos</button>
          <button class="btn btn-sm btn-secundario" onclick="_conExportarAprobados()">📥 Exportar aprobados</button>
        </div>
        <div id="con-tabla-wrap"></div>
      </div>

      <!-- Estado vacío -->
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
  if (el) {
    // MEJORA 5: si venimos del botón de Tesorería, usar ese periodo
    const periodoSug = localStorage.getItem('conc_periodo_sugerido');
    if (periodoSug) {
      el.value = periodoSug;
      localStorage.removeItem('conc_periodo_sugerido');
    } else {
      el.value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
    }
  }
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
    _conRefrescarPanel(); // mostrar panel de avance al iniciar

  } catch (err) {
    if (tablaWrap) tablaWrap.innerHTML = `<div class="alerta-error">${escapar(err.message)}</div>`;
  }
}

// ── Helper: ventana -3/+6 meses (9 meses, regla transversal) ─────
function _conPeriodosAdyacentes(periodo, antes = 3, despues = 6) {
  const [yyyy, mm] = periodo.split('-');
  const lista = [];
  for (let d = -antes; d <= despues; d++) {
    const fecha = new Date(parseInt(yyyy), parseInt(mm) - 1 + d, 1);
    lista.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
  }
  return lista;
}

// ── Motor de conciliación ────────────────────────────────────────
async function _ejecutarConciliacion(periodo) {
  const [yyyy, mm] = periodo.split('-');
  const inicio = `${yyyy}-${mm}-01`;
  const fin    = new Date(parseInt(yyyy), parseInt(mm), 0).toISOString().slice(0, 10);

  // Ventana siempre activa: 3 meses antes + 6 meses después (9 meses total)
  const periodosDoc = _conPeriodosAdyacentes(periodo);
  const periodosDocCompacto = periodosDoc.map(p => p.replace('-', ''));

  const [resMbd, resCompras, resVentas, resRh] = await Promise.all([
    _supabase
      .from('tesoreria_mbd')
      .select('*')
      .eq('empresa_id', empresa_activa.id)
      .eq('entrega_doc', 'PENDIENTE')
      .is('nro_factura_doc', null)   // CORRECCIÓN 10: solo movimientos sin comprobante asignado
      .is('tipo_doc', null)           // CORRECCIÓN 10: excluir los que ya tienen tipo doc asignado
      .gte('fecha_deposito', inicio)
      .lte('fecha_deposito', fin),

    _supabase
      .from('contabilidad_compras')
      .select('*')
      .eq('empresa_id', empresa_activa.id)
      .in('periodo', periodosDocCompacto),

    _supabase
      .from('contabilidad_ventas')
      .select('*')
      .eq('empresa_id', empresa_activa.id)
      .in('periodo', periodosDocCompacto),

    _supabase
      .from('rh_registros')
      .select('*, prestadores_servicios(nombre, dni)')
      .eq('empresa_operadora_id', empresa_activa.id)
      .in('periodo', periodosDoc),
  ]);

  // CORRECCIÓN 10: excluir movimientos ya conciliados en sesiones anteriores
  const movBanco = (resMbd.data || []).filter(m => m.estado_conciliacion !== 'conciliado');

  const compras = (resCompras.data || []).map(d => ({
    ...d,
    _tipo:    'COMPRA',
    _ndoc:    [d.serie_cdp, d.nro_cp_inicial].filter(Boolean).join('-') || d.id?.slice(0,8) || '—',
    _proveedor: d.proveedor || '',
    _ruc:     d.nro_doc_identidad || '',
    _total:   Math.abs(parseFloat(d.total_cp || 0)),
    _fecha:   d.fecha_emision || null,
  }));

  const ventas = (resVentas.data || []).map(d => ({
    ...d,
    _tipo:    'VENTA',
    _ndoc:    [d.serie_cdp, d.nro_cp_inicial].filter(Boolean).join('-') || d.id?.slice(0,8) || '—',
    _proveedor: d.cliente || '',
    _ruc:     d.nro_doc_identidad || '',
    _total:   Math.abs(parseFloat(d.total_cp || 0)),
    _fecha:   d.fecha_emision || null,
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

  // 2026-09-19 (Wendy): las sugerencias automáticas NO deben proponer un comprobante
  // que ya está consolidado (cubierto por su(s) movimiento(s) bancario(s) — APLICADO
  // o EXCESIVO, misma regla que Compras/Ventas, incluidos los que se rellenaron a mano
  // en Tesorería). Los PARCIALES siguen siendo candidatos (regla N:M).
  const todosLosDocs = [...compras, ...ventas, ...rhRegs];
  let cubiertos = new Set();
  try { cubiertos = await _conDocsYaCubiertos(empresa_activa.id, todosLosDocs); }
  catch (e) { console.error('[conciliar] no se pudo excluir comprobantes ya cubiertos:', e); }
  const documentos = todosLosDocs.filter(d => !cubiertos.has(d.id));

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
      // MEJORA 9: conservar mejorDoc aunque score < 60 para mostrar sugerencia al usuario
      sin_match.push({ mov, doc: mejorDoc || null, score: mejorDoc ? mejorScore : 0 });
    }
  }

  // CORRECCIÓN 13 + MEJORA 9: Multi-transfer matching (N movs → 1 comprobante)
  const usadosSinMatch = new Set();
  for (const doc of documentos) {
    if (usadosDoc.has(doc.id)) continue;
    const libresMovs = sin_match
      .filter(i => !usadosSinMatch.has(i.mov.id))
      .map(i => i.mov);
    const combo = _buscarComboNTransfer(doc, libresMovs);
    if (!combo) continue;
    usadosDoc.add(doc.id);
    combo.movs.forEach(m => usadosSinMatch.add(m.id));
    posibles.push({
      movs:      combo.movs,
      doc,
      score:     75,
      diferencia: combo.diferencia,
      sumaMovs:  combo.suma,
      esMulti:   true,
    });
  }
  // Sacar de sin_match los que fueron asignados a multi-transfer
  sin_match.splice(0, sin_match.length, ...sin_match.filter(i => !usadosSinMatch.has(i.mov.id)));

  // Fase A.5 (Wendy, 2026-09-18): dirección inversa — 1 movimiento grande
  // puede ser el pago conjunto de VARIOS comprobantes (Compras/Ventas/RH).
  // Ya tiene su propia vista/aprobación/rechazo (item.docs, esMultiDoc).
  const usadosSinMatchDoc = new Set();
  for (const item of [...sin_match]) {
    if (usadosSinMatchDoc.has(item.mov.id)) continue;
    const docsLibres = documentos.filter(d => !usadosDoc.has(d.id));
    const combo = _buscarComboDocsPorMonto(item.mov, docsLibres);
    if (!combo) continue;
    usadosSinMatchDoc.add(item.mov.id);
    combo.docs.forEach(d => usadosDoc.add(d.id));
    posibles.push({
      mov:        item.mov,
      docs:       combo.docs,
      score:      75,
      diferencia: combo.diferencia,
      sumaDocs:   combo.suma,
      esMultiDoc: true,
    });
  }
  sin_match.splice(0, sin_match.length, ...sin_match.filter(i => !usadosSinMatchDoc.has(i.mov.id)));

  // Ordenar: score DESC, fecha ASC
  const byScoreFecha = (a, b) =>
    b.score !== a.score ? b.score - a.score
    : (a.esMulti ? (a.movs[0]?.fecha_deposito||'') : (a.mov.fecha_deposito || ''))
      .localeCompare(b.esMulti ? (b.movs[0]?.fecha_deposito||'') : (b.mov.fecha_deposito || ''));

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

// ── Similitud de nombre por palabras comunes (0-1) ───────────────
function _simNombre(a, b) {
  a = (a || '').toLowerCase().trim();
  b = (b || '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wa = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(b.split(/\s+/).filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let comunes = 0;
  wa.forEach(w => { if (wb.has(w)) comunes++; });
  return comunes / Math.max(wa.size, wb.size);
}

// ── CORRECCIÓN 13: buscar N movimientos (sin límite) que sumen al total del doc ─
function _buscarComboNTransfer(doc, movsList) {
  const target = Math.abs(doc._total || doc.importe || doc.monto_total || 0);
  if (target <= 0 || movsList.length < 2) return null;

  // Candidatos: similitud de nombre ≥ 15% ó incluir todos si pocos candidatos
  const conSim = movsList
    .map(m => ({ m, sim: _simNombre(m.proveedor_empresa_personal || m.descripcion || '', doc._proveedor || '') }))
    .sort((a, b) => b.sim - a.sim);
  const candidatos = conSim.filter(c => c.sim > 0.15).length >= 2
    ? conSim.filter(c => c.sim > 0.15).slice(0, 15).map(c => c.m)
    : movsList.slice(0, 15);

  if (candidatos.length < 2) return null;

  // Búsqueda recursiva de combinaciones de tamaño 2..N (hasta 6)
  const montos = candidatos.map(m => Math.abs(parseFloat(m.monto) || 0));
  const MAX_N  = Math.min(candidatos.length, 6);

  function combinar(inicio, n, sumaAcum, idxs) {
    if (n === 0) {
      const diff = Math.abs(sumaAcum - target);
      // Sin límite fijo de diferencia: siempre presentar como POSIBLE MATCH
      if (diff / target < 0.5) {
        return { movs: idxs.map(i => candidatos[i]), suma: sumaAcum, diferencia: sumaAcum - target };
      }
      return null;
    }
    for (let i = inicio; i <= candidatos.length - n; i++) {
      const res = combinar(i + 1, n - 1, sumaAcum + montos[i], [...idxs, i]);
      if (res) return res;
    }
    return null;
  }

  for (let n = 2; n <= MAX_N; n++) {
    const res = combinar(0, n, 0, []);
    if (res) return res;
  }
  return null;
}

// ── Wendy, 2026-09-18: dirección inversa de _buscarComboNTransfer — un
//    movimiento bancario grande puede ser el pago conjunto de VARIOS
//    comprobantes (Compras/Ventas/RH mezclados), ej. una transferencia que
//    paga a 3 prestadores de servicio en un solo abono. Busca combinaciones
//    de 2..6 documentos sin usar cuya suma se acerque al monto del movimiento.
function _buscarComboDocsPorMonto(mov, docsList) {
  const target = Math.abs(parseFloat(mov.monto) || 0);
  if (target <= 0 || docsList.length < 2) return null;

  const conSim = docsList
    .map(d => ({ d, sim: _simNombre(d._proveedor || '', mov.proveedor_empresa_personal || mov.descripcion || '') }))
    .sort((a, b) => b.sim - a.sim);
  const candidatos = conSim.filter(c => c.sim > 0.15).length >= 2
    ? conSim.filter(c => c.sim > 0.15).slice(0, 15).map(c => c.d)
    : docsList.slice(0, 15);

  if (candidatos.length < 2) return null;

  const montos = candidatos.map(d => Math.abs(d._total || 0));
  const MAX_N  = Math.min(candidatos.length, 6);

  function combinar(inicio, n, sumaAcum, idxs) {
    if (n === 0) {
      const diff = Math.abs(sumaAcum - target);
      if (diff / target < 0.5) {
        return { docs: idxs.map(i => candidatos[i]), suma: sumaAcum, diferencia: sumaAcum - target };
      }
      return null;
    }
    for (let i = inicio; i <= candidatos.length - n; i++) {
      const res = combinar(i + 1, n - 1, sumaAcum + montos[i], [...idxs, i]);
      if (res) return res;
    }
    return null;
  }

  for (let n = 2; n <= MAX_N; n++) {
    const res = combinar(0, n, 0, []);
    if (res) return res;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// BÚSQUEDA POR UN SOLO COMPROBANTE (Fase A.1, Wendy 2026-09-18)
// Reemplaza lo que hacían el 🔗 y la 🔍 por fila de Compras/Ventas/RH:
// dado un comprobante puntual, busca candidatos (±S/3) + permite búsqueda
// manual libre + vincula — todo centralizado en este módulo.
// ═══════════════════════════════════════════════════════════════

// Código FA/BO/RH — copia local liviana de _mbdCodigoTipoComprobante
// (busqueda-comprobante.js) para no depender de ese archivo aquí.
function _conCodigoTipoComprobante(docTipo, nDoc) {
  if (docTipo === 'RH') return 'RH';
  if (docTipo === 'PM') return 'PM';
  const serie = String(nDoc || '').trim().toUpperCase();
  return serie.startsWith('B') ? 'BO' : 'FA';
}

async function _conCargarComprobante(docTipo, docId) {
  const empId = empresa_activa.id;
  if (docTipo === 'COMPRA') {
    const { data: d } = await _supabase.from('contabilidad_compras').select('*').eq('id', docId).eq('empresa_id', empId).single();
    if (!d) return null;
    return { id: d.id, tipo: 'COMPRA', nDoc: [d.serie_cdp, d.nro_cp_inicial].filter(Boolean).join('-'), proveedor: d.proveedor || '', ruc: d.nro_doc_identidad || '', total: Math.abs(parseFloat(d.total_cp) || 0), fecha: d.fecha_emision };
  }
  if (docTipo === 'VENTA') {
    const { data: d } = await _supabase.from('contabilidad_ventas').select('*').eq('id', docId).eq('empresa_id', empId).single();
    if (!d) return null;
    return { id: d.id, tipo: 'VENTA', nDoc: [d.serie_cdp, d.nro_cp_inicial].filter(Boolean).join('-'), proveedor: d.cliente || '', ruc: d.nro_doc_identidad || '', total: Math.abs(parseFloat(d.total_cp) || 0), fecha: d.fecha_emision };
  }
  if (docTipo === 'RH') {
    const { data: d } = await _supabase.from('rh_registros').select('*, prestadores_servicios(nombre,dni)').eq('id', docId).eq('empresa_operadora_id', empId).single();
    if (!d) return null;
    return { id: d.id, tipo: 'RH', nDoc: d.numero_rh || d.id.slice(0, 8), proveedor: d.prestadores_servicios?.nombre || '', ruc: d.prestadores_servicios?.dni || '', total: Math.abs(parseFloat(d.monto_neto) || 0), fecha: d.fecha_emision };
  }
  return null;
}

// Fase A.3 — respaldo en la tabla vieja `movimientos` (extracto crudo de
// "Importar EECC"): un movimiento puede existir ahí sin haberse copiado
// todavía a tesoreria_mbd, y hasta ahora solo el motor viejo de RH lo veía.
// Se muestra como candidato adicional de SOLO LECTURA — vincular directo
// desde aquí requeriría escribir en tesoreria_mbd un registro que no
// existe todavía, así que se le pide a la persona que primero lo agregue
// a Tesorería (Importar EECC o manual) y luego lo busque normal.
async function _conBuscarEnMovimientosCrudos(doc) {
  const margen = _CON_MARGEN_POSIBLE;
  const { data } = await _supabase.from('movimientos')
    .select('id,fecha,importe,descripcion,numero_operacion,naturaleza')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('naturaleza', 'CARGO')
    .gte('importe', doc.total - margen).lte('importe', doc.total + margen)
    .order('fecha', { ascending: false }).limit(20);
  return data || [];
}

async function abrirBusquedaComprobante(docTipo, docId) {
  const doc = await _conCargarComprobante(docTipo, docId);
  if (!doc) { mostrarToast('No se pudo cargar el comprobante', 'error'); return; }

  const [candidatos, yaVinculadosRes, crudos] = await Promise.all([
    _conBuscarCandidatosPorMonto(empresa_activa.id, doc.total),
    // 2026-09-19: también los movimientos sin categoría (comprobante escrito a mano en Tesorería)
    _supabase.from('tesoreria_mbd').select('id,nro_operacion_bancaria,fecha_deposito,monto,proveedor_empresa_personal,entrega_doc,tipo_doc,ruc_dni')
      .eq('empresa_id', empresa_activa.id).or(_conFiltroTipoDoc(doc.tipo)).eq('nro_factura_doc', doc.nDoc)
      .order('fecha_deposito', { ascending: false }),
    doc.tipo === 'RH' ? _conBuscarEnMovimientosCrudos(doc) : Promise.resolve([]),
  ]);

  _conRenderBusquedaComprobante(doc, candidatos, _conFiltrarVinculosDelComprobante(yaVinculadosRes.data, doc.tipo, doc.ruc, doc.proveedor), crudos);
}

function _conRenderBusquedaComprobante(doc, candidatos, yaVinculados, crudos) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;

  const linksHtml = yaVinculados.length
    ? yaVinculados.map(m => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;font-size:12px">
          <span><span style="font-family:monospace;font-weight:600;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria || '—')}</span>
            · ${formatearFecha(m.fecha_deposito)} · ${escapar(m.proveedor_empresa_personal || '—')}</span>
          <span style="display:flex;align-items:center;gap:6px">
            <strong>${formatearMoneda(m.monto)}</strong>
            <span style="font-size:9px;padding:1px 6px;border-radius:8px;${m.entrega_doc === 'EMITIDO' ? 'background:#2F855A;color:#fff' : 'background:#718096;color:#fff'}">${escapar(m.entrega_doc || '')}</span>
          </span>
        </div>`).join('')
    : '<span style="font-style:italic;font-size:12px;color:var(--color-texto-suave)">Sin operaciones vinculadas aún.</span>';

  const candHtml = candidatos.length
    ? candidatos.slice(0, 15).map(m => {
        const diff = Math.abs(Math.abs(Number(m.monto)) - doc.total);
        const pct = doc.total > 0 ? Math.round(diff / doc.total * 100) : 0;
        return `
          <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px;margin-bottom:8px;background:var(--color-bg-card)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <div>
                <div style="font-family:monospace;font-size:12px;font-weight:600;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria || '—')}</div>
                <div style="font-size:11px;color:var(--color-texto-suave)">${formatearFecha(m.fecha_deposito)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--color-exito)">${formatearMoneda(Math.abs(Number(m.monto)))}</div>
                ${diff > 0 ? `<div style="font-size:10px;color:${pct > 5 ? '#ef4444' : '#f59e0b'}">Dif: ${formatearMoneda(diff)} (${pct}%)</div>` : '<div style="font-size:10px;color:#22c55e">✓ Monto exacto</div>'}
              </div>
            </div>
            <div style="font-size:11px;color:var(--color-texto);margin-bottom:2px">${escapar(truncar(m.descripcion || '—', 60))}</div>
            ${m.proveedor_empresa_personal ? `<div style="font-size:11px;color:var(--color-texto-suave)">${escapar(m.proveedor_empresa_personal)}</div>` : ''}
            <div style="margin-top:8px;text-align:right">
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;${m.entrega_doc === 'EMITIDO' ? 'background:#2F855A;color:#fff' : 'background:#C53030;color:#fff'}">${escapar(m.entrega_doc || 'PENDIENTE')}</span>
              <button onclick="_conVincularComprobante(${JSON.stringify(doc).replace(/"/g, '&quot;')},'${m.id}')"
                style="margin-left:8px;padding:4px 12px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-family:var(--font)">
                🔗 Vincular
              </button>
            </div>
          </div>`;
      }).join('')
    : '<div style="padding:24px;text-align:center;color:var(--color-texto-suave)">Sin movimientos bancarios con monto similar (±S/3). Prueba la búsqueda manual.</div>';

  const crudosHtml = crudos.length ? `
    <div style="margin-top:14px;padding:10px 14px;background:rgba(214,158,46,.08);border:1px solid rgba(214,158,46,.3);border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:#D69E2E;text-transform:uppercase;margin-bottom:6px">⚠️ Encontrados en el extracto bancario, aún no en Tesorería</div>
      ${crudos.map(c => `
        <div style="font-size:12px;padding:4px 0;border-top:1px solid rgba(214,158,46,.2)">
          Op. ${escapar(c.numero_operacion || '—')} · ${formatearFecha(c.fecha)} · ${escapar(truncar(c.descripcion || '—', 40))} · <strong>${formatearMoneda(c.importe)}</strong>
        </div>`).join('')}
      <div style="font-size:11px;color:var(--color-texto-suave);margin-top:6px">Agrégalo primero en Tesorería → Movimientos (Importar EECC o manual) y luego búscalo aquí.</div>
    </div>` : '';

  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:620px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h3>🔗 Conciliar con Banco — ${escapar(doc.nDoc)}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <div style="padding:10px 14px;background:rgba(44,82,130,.07);border-radius:8px;margin-bottom:14px;font-size:12px">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
              <div><strong>Comprobante:</strong> ${escapar(doc.nDoc)} (${escapar(doc.tipo)})</div>
              <div><strong>Total:</strong> ${formatearMoneda(doc.total)}</div>
            </div>
            <div style="margin-top:4px"><strong>Proveedor/Trabajador:</strong> ${escapar(truncar(doc.proveedor || '—', 40))}</div>
            <div><strong>Fecha:</strong> ${formatearFecha(doc.fecha)}</div>
          </div>
          <div style="padding:10px 14px;background:rgba(44,82,130,.06);border:1px solid rgba(44,82,130,.2);border-radius:8px;margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">
              Operaciones bancarias ya vinculadas — <span style="color:var(--color-secundario)">${yaVinculados.length} operación(es)</span>
            </div>
            ${linksHtml}
          </div>
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:10px">
            ${candidatos.length} movimiento(s) bancario(s) dentro de ±S/3 encontrado(s):
          </p>
          ${candHtml}
          ${crudosHtml}
          <div style="margin-top:14px;border-top:1px solid var(--color-borde);padding-top:12px">
            <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:8px">¿No encuentras el movimiento? Búsqueda manual (sin límite de monto — último recurso):</p>
            <div style="display:flex;gap:8px">
              <input type="text" id="con-buscar-doc-manual" autocomplete="off" placeholder="N° operación o proveedor"
                style="flex:1;padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
              <button onclick="_conBuscarComprobanteManual(${JSON.stringify(doc).replace(/"/g, '&quot;')})"
                class="btn btn-primario" style="font-size:12px;white-space:nowrap">🔍 Buscar</button>
            </div>
            <div id="con-buscar-doc-manual-res" style="margin-top:10px"></div>
          </div>
        </div>
        <div class="modal-footer" style="flex-shrink:0">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}

async function _conBuscarComprobanteManual(doc) {
  const q = (document.getElementById('con-buscar-doc-manual')?.value || '').trim().toLowerCase();
  const res = document.getElementById('con-buscar-doc-manual-res');
  if (!q || !res) return;
  res.innerHTML = '<div class="spinner" style="margin:8px auto"></div>';

  const { data: movs } = await _supabase.from('tesoreria_mbd')
    .select('id,fecha_deposito,monto,descripcion,nro_operacion_bancaria,proveedor_empresa_personal,entrega_doc')
    .eq('empresa_id', empresa_activa.id)
    .or(`nro_operacion_bancaria.ilike.%${q}%,proveedor_empresa_personal.ilike.%${q}%,descripcion.ilike.%${q}%`)
    .limit(10);

  if (!movs?.length) { res.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave)">Sin resultados</p>'; return; }
  res.innerHTML = movs.map(m => `
    <div style="border:1px solid var(--color-borde);border-radius:6px;padding:10px;margin-bottom:6px;font-size:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-family:monospace;font-weight:600;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria || '—')}</div>
          <div style="color:var(--color-texto-suave);font-size:11px">${formatearFecha(m.fecha_deposito)} · ${escapar(truncar(m.descripcion || '—', 40))}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${formatearMoneda(Math.abs(Number(m.monto)))}</div>
          <button onclick="_conVincularComprobante(${JSON.stringify(doc).replace(/"/g, '&quot;')},'${m.id}')"
            style="padding:3px 10px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-family:var(--font)">
            🔗 Vincular
          </button>
        </div>
      </div>
    </div>`).join('');
}

async function _conVincularComprobante(doc, movId) {
  const { data: mov } = await _supabase.from('tesoreria_mbd')
    .select('nro_operacion_bancaria,fecha_deposito,descripcion,moneda,monto,proveedor_empresa_personal,ruc_dni,cotizacion,oc,proyecto,concepto,empresa,autorizacion,entrega_doc')
    .eq('id', movId).single();
  if (!mov) { mostrarToast('No se pudo cargar el movimiento', 'error'); return; }

  const val = await _conValidarAntesDeVincular(empresa_activa.id, doc.tipo, doc.nDoc, doc.total, movId, mov.monto, { ruc: doc.ruc, nombre: doc.proveedor });
  if (!val.ok) { await _conAlertaBloqueo(val.mensaje); return; }

  const mensajeConfirm = mov.entrega_doc === 'EMITIDO'
    ? `⚠️ Este movimiento bancario ya fue registrado por completo (EMITIDO).\n¿Está segura de vincularlo con "${escapar(doc.nDoc)}"?`
    : `¿Está segura de vincular "${escapar(doc.nDoc)}" con este movimiento bancario?`;
  if (!await confirmar(mensajeConfirm, { btnOk: 'Sí, vincular', btnColor: mov.entrega_doc === 'EMITIDO' ? '#C53030' : '#2C5282' })) return;

  const hoy = new Date().toISOString().slice(0, 10);
  const entregaDoc = typeof _conEvalCompletitud14 === 'function'
    ? _conEvalCompletitud14({ ...mov, proveedor_empresa_personal: doc.proveedor || mov.proveedor_empresa_personal, ruc_dni: doc.ruc || mov.ruc_dni, nro_factura_doc: doc.nDoc, tipo_doc: doc.tipo })
    : 'OBSERVADO';

  const patch = {
    entrega_doc: entregaDoc,
    estado_conciliacion: 'conciliado',
    nro_factura_doc: doc.nDoc,
    tipo_doc: doc.tipo,
    tipo_comprobante: _conCodigoTipoComprobante(doc.tipo, doc.nDoc),
    fecha_actualizacion: hoy,
  };
  if (typeof _resolverProveedorTitular === 'function') {
    const rt = _resolverProveedorTitular(mov.proveedor_empresa_personal, doc.proveedor, mov.ruc_dni, doc.ruc);
    patch.proveedor_empresa_personal = rt.proveedor;
    patch.titular_comprobante = rt.titular;
    patch.ruc_dni = rt.ruc;
  } else {
    if (doc.proveedor) patch.proveedor_empresa_personal = doc.proveedor;
    if (doc.ruc) patch.ruc_dni = doc.ruc;
  }

  const { error } = await _supabase.from('tesoreria_mbd').update(patch).eq('id', movId);
  if (error) { mostrarToast('Error al vincular: ' + error.message, 'error'); return; }

  await _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id, movimiento_id: movId, doc_tipo: doc.tipo, doc_id: doc.id,
    score: 0, tipo_match: 'MANUAL', estado: 'APROBADO', usuario_id: perfil_usuario?.id || null,
  });

  if (typeof consolidarMovimientoVinculado === 'function') await consolidarMovimientoVinculado(movId);

  mostrarToast(`✓ Vinculado: ${doc.nDoc}`, 'exito');
  document.querySelector('.modal-overlay')?.remove();
  if (typeof _refrescarVistasVinculadas === 'function') _refrescarVistasVinculadas();
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
  ['exactos','posibles','sin_match','historial'].forEach(t => {
    const btn = document.getElementById('con-itab-' + t);
    if (btn) btn.className = 'btn btn-sm ' + (t === tab ? 'btn-primario' : 'btn-secundario');
  });
  const wrap = document.getElementById('con-tabla-wrap');
  if (!wrap) return;
  if (tab === 'exactos')   _renderTablaExactos(wrap);
  if (tab === 'posibles')  _renderTablaPosibles(wrap);
  if (tab === 'sin_match') _renderTablaSinMatch(wrap);
  if (tab === 'historial') _renderHistorial(wrap);
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
      if (item.esMulti) {
        const str = [
          item.doc?._ndoc, item.doc?._proveedor,
          ...(item.movs || []).flatMap(m => [m.nro_operacion_bancaria, m.descripcion, m.proveedor_empresa_personal]),
        ].map(v => (v||'').toLowerCase()).join(' ');
        return str.includes(q);
      }
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
        case 'score':
          va = a.score || 0; vb = b.score || 0; break;
        case 'fecha':
          va = a.esMulti ? (a.movs[0]?.fecha_deposito||'') : (a.mov?.fecha_deposito||'');
          vb = b.esMulti ? (b.movs[0]?.fecha_deposito||'') : (b.mov?.fecha_deposito||''); break;
        case 'monto':
          va = a.esMulti ? (a.sumaMovs||0) : a.esMultiDoc ? (a.sumaDocs||0) : Math.abs(parseFloat(a.mov?.monto)||0);
          vb = b.esMulti ? (b.sumaMovs||0) : b.esMultiDoc ? (b.sumaDocs||0) : Math.abs(parseFloat(b.mov?.monto)||0); break;
        case 'proveedor':
          va = a.esMulti ? (a.movs[0]?.proveedor_empresa_personal||'') : (a.mov?.proveedor_empresa_personal||'');
          vb = b.esMulti ? (b.movs[0]?.proveedor_empresa_personal||'') : (b.mov?.proveedor_empresa_personal||''); break;
        default: va = ''; vb = '';
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
          ${items.length ? items.map((item, idx) =>
              item.esMulti
                ? _rowMultiMatchHtml(item, idx, _TD)
                : item.esMultiDoc
                  ? _rowMultiComprobanteHtml(item, idx, _TD)
                  : _rowMatchHtml(item, idx, 'pos', _TD)
            ).join('') :
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
        <button title="Ver documentos enlazados a este movimiento" style="padding:4px 8px;background:rgba(113,71,224,.1);color:#7147e0;border:none;border-radius:4px;cursor:pointer;font-size:13px"
          onclick="_verDocumentosEnlazados('${m.id}','${escapar(m.nro_operacion_bancaria||'')}')">🔗</button>
        <button title="Rechazar sugerencia" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px"
          onclick="_rechazarMatch(${idx},'${prefijo}')">✕</button>
      </div>
    </td>
  </tr>`;
}

// ── Row multi-transferencia (N movimientos → 1 comprobante) ──────
function _rowMultiMatchHtml(item, idx, _TD) {
  const d        = item.doc;
  const key      = `pos_${idx}`;
  _conItemCache[key] = item;
  const tipoBg      = d._tipo === 'RH' ? '#744210' : d._tipo === 'VENTA' ? '#276749' : '#2C5282';
  const rowspan     = item.movs.length;
  const multiBg     = 'rgba(44,82,130,.05)';
  const firstMovId  = item.movs[0]?.id || '';
  const firstMovNro = (item.movs[0]?.nro_operacion_bancaria || '').replace(/'/g, '');

  return item.movs.map((m, mi) => {
    const isFirst = mi === 0;
    return `<tr id="${isFirst ? `con-row-pos-${idx}` : `con-row-pos-${idx}-${mi}`}"
      style="background:${multiBg}"
      onmouseover="this.style.background='var(--color-hover)'"
      onmouseout="this.style.background='${multiBg}'">
      <td style="${_TD};font-family:monospace;font-size:11px;white-space:nowrap">${escapar(m.nro_operacion_bancaria||'—')}</td>
      <td style="${_TD};white-space:nowrap">${formatearFecha(m.fecha_deposito)}</td>
      <td style="${_TD};max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(m.descripcion||'')}">${escapar(m.descripcion||'—')}</td>
      <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        <strong style="font-size:11px">${escapar((m.proveedor_empresa_personal||'—').slice(0,30))}</strong>
        ${isFirst ? `<div style="font-size:10px;color:var(--color-secundario);margin-top:2px">🔗 Multi-transfer (${rowspan} movs)</div>` : ''}
      </td>
      <td style="${_TD};text-align:right;white-space:nowrap;font-weight:700;color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'}">
        ${formatearMoneda(m.monto, m.moneda==='USD'?'USD':'PEN')}
      </td>
      ${isFirst ? `<td style="${_TD};text-align:center" rowspan="${rowspan}">${_scoreChip(item.score)}</td>` : ''}
      ${isFirst ? `<td style="${_TD};max-width:160px;white-space:nowrap" rowspan="${rowspan}">
        <div style="font-size:11px;font-weight:600;color:var(--color-secundario)">${escapar(d._ndoc||'—')}</div>
        <div style="font-size:10px;color:var(--color-texto-suave)">${escapar((d._proveedor||'—').slice(0,25))}</div>
        <div style="font-size:10px;color:var(--color-texto-suave);margin-top:2px">Σ ${formatearMoneda(item.sumaMovs)} / Total ${formatearMoneda(d._total)}</div>
      </td>` : ''}
      ${isFirst ? `<td style="${_TD};text-align:center" rowspan="${rowspan}">
        <span style="background:${tipoBg};color:#fff;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">${escapar(d._tipo||'—')}</span>
        <div style="font-size:10px;color:var(--color-texto-suave);margin-top:3px">N→1</div>
      </td>` : ''}
      ${isFirst ? `<td style="${_TD}" rowspan="${rowspan}">${_tdEstado('PENDIENTE')}</td>` : ''}
      ${isFirst ? `<td style="${_TD}" rowspan="${rowspan}">
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 9px"
            onclick="_aprobarMatchMulti('${key}',${idx})">✓ Aprobar</button>
          <div style="display:flex;gap:3px">
            <button title="Ver comprobante completo" style="padding:4px 8px;background:rgba(39,103,73,.15);color:#276749;border:1px solid rgba(39,103,73,.3);border-radius:4px;cursor:pointer;font-size:12px"
              onclick="_verComprobanteMultiDoc('${key}')">👁️</button>
            <button title="Ver documentos enlazados" style="padding:4px 8px;background:rgba(113,71,224,.1);color:#7147e0;border:none;border-radius:4px;cursor:pointer;font-size:12px"
              onclick="_verDocumentosEnlazados('${firstMovId}','${firstMovNro}')">🔗</button>
            <button title="Rechazar sugerencia" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
              onclick="_rechazarMatchMulti(${idx})">✕</button>
          </div>
        </div>
      </td>` : ''}
    </tr>`;
  }).join('');
}

// ── Row multi-comprobante (1 movimiento → varios comprobantes) ───
// Fase A.5 (Wendy, 2026-09-18): dirección inversa a la de arriba — un solo
// movimiento grande puede ser el pago conjunto de varios comprobantes.
function _rowMultiComprobanteHtml(item, idx, _TD) {
  const m = item.mov;
  const key = `pos_${idx}`;
  _conItemCache[key] = item;
  const rowspan = item.docs.length;
  const multiBg = 'rgba(124,58,237,.05)';

  return item.docs.map((d, di) => {
    const isFirst = di === 0;
    const tipoBg = d._tipo === 'RH' ? '#744210' : d._tipo === 'VENTA' ? '#276749' : '#2C5282';
    return `<tr id="${isFirst ? `con-row-pos-${idx}` : `con-row-pos-${idx}-${di}`}"
      style="background:${multiBg}"
      onmouseover="this.style.background='var(--color-hover)'"
      onmouseout="this.style.background='${multiBg}'">
      ${isFirst ? `<td style="${_TD};font-family:monospace;font-size:11px;white-space:nowrap" rowspan="${rowspan}">${escapar(m.nro_operacion_bancaria||'—')}</td>` : ''}
      ${isFirst ? `<td style="${_TD};white-space:nowrap" rowspan="${rowspan}">${formatearFecha(m.fecha_deposito)}</td>` : ''}
      ${isFirst ? `<td style="${_TD};max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" rowspan="${rowspan}" title="${escapar(m.descripcion||'')}">${escapar(m.descripcion||'—')}</td>` : ''}
      ${isFirst ? `<td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" rowspan="${rowspan}">
        <strong style="font-size:11px">${escapar((m.proveedor_empresa_personal||'—').slice(0,30))}</strong>
        <div style="font-size:10px;color:#7c3aed;margin-top:2px">🔗 1 movimiento → ${rowspan} comprobantes</div>
      </td>` : ''}
      ${isFirst ? `<td style="${_TD};text-align:right;white-space:nowrap;font-weight:700;color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'}" rowspan="${rowspan}">
        ${formatearMoneda(m.monto, m.moneda==='USD'?'USD':'PEN')}
        <div style="font-size:9px;color:var(--color-texto-suave);font-weight:400">Σ docs ${formatearMoneda(item.sumaDocs)}</div>
      </td>` : ''}
      ${isFirst ? `<td style="${_TD};text-align:center" rowspan="${rowspan}">${_scoreChip(item.score)}</td>` : ''}
      <td style="${_TD};max-width:160px;white-space:nowrap">
        <div style="font-size:11px;font-weight:600;color:var(--color-secundario)">${escapar(d._ndoc||'—')}</div>
        <div style="font-size:10px;color:var(--color-texto-suave)">${escapar((d._proveedor||'—').slice(0,25))}</div>
      </td>
      <td style="${_TD};text-align:center">
        <span style="background:${tipoBg};color:#fff;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">${escapar(d._tipo||'—')}</span>
        <div style="font-size:9px;color:var(--color-texto-suave);margin-top:2px">${formatearMoneda(d._total)}</div>
      </td>
      ${isFirst ? `<td style="${_TD}" rowspan="${rowspan}">${_tdEstado('PENDIENTE')}</td>` : ''}
      ${isFirst ? `<td style="${_TD}" rowspan="${rowspan}">
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 9px"
            onclick="_aprobarMatchMultiComprobante('${key}',${idx})" title="Divide el movimiento en ${rowspan} filas, una por comprobante">✓ Aprobar</button>
          <button title="Rechazar sugerencia" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
            onclick="_rechazarMatchMultiComprobante(${idx})">✕ Rechazar</button>
        </div>
      </td>` : ''}
    </tr>`;
  }).join('');
}

// ── Aprobar multi-comprobante: divide el movimiento en N filas, una por
//    comprobante, cada una con el monto exacto de ese comprobante. ──────
async function _aprobarMatchMultiComprobante(key, idx) {
  const item = _conItemCache[key];
  if (!item || !item.esMultiDoc) return;
  if (!await confirmar(`Se dividirá el movimiento ${escapar(item.mov.nro_operacion_bancaria||'')} en ${item.docs.length} comprobantes distintos. ¿Está segura de continuar?`, { btnOk: 'Sí, dividir y vincular', btnColor: '#2C5282' })) return;

  const { data: base } = await _supabase.from('tesoreria_mbd').select('*').eq('id', item.mov.id).single();
  if (!base) { mostrarToast('No se pudo cargar el movimiento', 'error'); return; }
  const signo = Number(base.monto) < 0 ? -1 : 1;
  const hoy = new Date().toISOString().slice(0, 10);

  let ok = 0, errores = 0;
  for (const d of item.docs) {
    const rt = typeof _resolverProveedorTitular === 'function'
      ? _resolverProveedorTitular(base.proveedor_empresa_personal, d._proveedor, base.ruc_dni, d._ruc)
      : { proveedor: d._proveedor || base.proveedor_empresa_personal || null, titular: null, ruc: d._ruc || base.ruc_dni || null };
    const { data: ins, error: errIns } = await _supabase.from('tesoreria_mbd').insert({
      empresa_id: base.empresa_id, nro_operacion_bancaria: base.nro_operacion_bancaria,
      fecha_deposito: base.fecha_deposito, moneda: base.moneda, monto: signo * Math.abs(d._total || 0),
      descripcion: (base.descripcion || '') + ` (${d._ndoc})`,
      proveedor_empresa_personal: rt.proveedor,
      titular_comprobante: rt.titular,
      ruc_dni: rt.ruc,
      tipo_doc: d._tipo, nro_factura_doc: d._ndoc,
      tipo_comprobante: _conCodigoTipoComprobante(d._tipo, d._ndoc),
      estado_conciliacion: 'conciliado', entrega_doc: 'OBSERVADO', fecha_actualizacion: hoy,
      concepto: base.concepto, empresa: base.empresa, proyecto: base.proyecto,
      autorizacion: base.autorizacion, cotizacion: base.cotizacion, oc: base.oc,
      observaciones: base.observaciones, detalles_compra_servicio: base.detalles_compra_servicio,
      observaciones_2: base.observaciones_2,
    }).select('id').single();

    if (errIns || !ins) { errores++; continue; }

    await _supabase.from('conciliaciones').insert({
      empresa_operadora_id: empresa_activa.id, movimiento_id: ins.id,
      doc_tipo: d._tipo, doc_id: d.id, score: item.score, tipo_match: 'MULTI_COMPROBANTE',
      estado: 'APROBADO', usuario_id: perfil_usuario?.id || null,
    });
    if (typeof consolidarMovimientoVinculado === 'function') await consolidarMovimientoVinculado(ins.id);
    ok++;
  }

  if (ok > 0) {
    const { error: errDel } = await _supabase.from('tesoreria_mbd').delete().eq('id', item.mov.id);
    if (errDel) mostrarToast('Dividido, pero hubo un error al eliminar la fila original. Revisa duplicados en Tesorería.', 'atencion');
  }

  const fila = document.getElementById(`con-row-pos-${idx}`);
  if (fila) { fila.style.opacity = '0.35'; fila.querySelectorAll('button').forEach(b => b.disabled = true); }
  _con_resultados.posibles = _con_resultados.posibles.filter((_, i) => i !== idx);
  document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  _conRefrescarPanel();
  if (typeof _refrescarVistasVinculadas === 'function') _refrescarVistasVinculadas();
  mostrarToast(`✅ Movimiento dividido en ${ok} comprobante(s)${errores ? ` · ${errores} con error` : ''}`, ok ? 'exito' : 'error');
}

function _rechazarMatchMultiComprobante(idx) {
  const item = _con_resultados.posibles[idx];
  if (!item || !item.esMultiDoc) return;
  _con_resultados.sin_match.push({ mov: item.mov, score: 0 });
  _con_resultados.posibles = _con_resultados.posibles.filter((_, i) => i !== idx);
  document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
  _conActivarSubtab('posibles');
}

// ── Vista completa del comprobante sugerido (👁️) ─────────────────
function _verComprobante(key) {
  const item = _conItemCache[key];
  if (!item) { mostrarToast('Dato no disponible', 'atencion'); return; }

  const m = item.mov;
  const d = item.doc;

  const tipoBg   = d._tipo === 'RH' ? '#744210' : d._tipo === 'VENTA' ? '#276749' : '#2C5282';
  const tipoIcon = d._tipo === 'RH' ? '🧾' : d._tipo === 'VENTA' ? '📄' : '🛒';

  const _f = (lbl, val, bold = false) => val
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;font-size:13px;border-bottom:1px solid rgba(128,128,128,.1)">
        <span style="color:var(--color-texto-suave);font-size:12px;flex-shrink:0;margin-right:12px;min-width:130px">${lbl}</span>
        <span style="${bold?'font-weight:700;':''}text-align:right;word-break:break-all">${val}</span>
       </div>`
    : '';

  // ── Campos del comprobante según tipo ───────────────────────────
  let docCampos = '';
  if (d._tipo === 'COMPRA') {
    docCampos = [
      _f('N° Comprobante',  `<strong style="color:var(--color-secundario)">${escapar(d._ndoc||'—')}</strong>`),
      _f('Proveedor',       escapar(d.nombre_proveedor||d._proveedor||'—'), true),
      _f('RUC proveedor',   escapar(d.ruc_proveedor||d._ruc||'—')),
      _f('Tipo doc.',       escapar(d.tipo_documento_codigo||d.tipo_cp_doc||'—')),
      _f('Fecha emisión',   formatearFecha(d.fecha_emision||d._fecha)),
      _f('Período',         escapar(d.periodo||'—')),
      _f('Base imponible',  `<strong>${formatearMoneda(d.base_imponible||0)}</strong>`),
      _f('IGV',             formatearMoneda(d.igv||0)),
      _f('Total',           `<strong style="color:var(--color-exito);font-size:15px">${formatearMoneda(d.total||d._total||0, d.moneda==='USD'?'USD':'PEN')}</strong>`),
      _f('Moneda',          escapar(d.moneda||'PEN')),
      _f('Tipo de cambio',  d.tipo_cambio && d.tipo_cambio !== 1 ? String(d.tipo_cambio) : null),
      _f('Estado',          escapar(d.estado||'—')),
    ].join('');
  } else if (d._tipo === 'VENTA') {
    docCampos = [
      _f('N° Comprobante',  `<strong style="color:var(--color-secundario)">${escapar(d._ndoc||'—')}</strong>`),
      _f('Cliente',         escapar(d.nombre_cliente||d.razon_social||d._proveedor||'—'), true),
      _f('RUC / DNI',       escapar(d.ruc_cliente||d.ruc||d._ruc||'—')),
      _f('Tipo doc.',       escapar(d.tipo_documento_codigo||d.tipo_cp_doc||'—')),
      _f('Fecha emisión',   formatearFecha(d.fecha_emision||d._fecha)),
      _f('Período',         escapar(d.periodo||'—')),
      _f('Base imponible',  `<strong>${formatearMoneda(d.base_imponible||0)}</strong>`),
      _f('IGV',             formatearMoneda(d.igv||0)),
      _f('Total',           `<strong style="color:var(--color-exito);font-size:15px">${formatearMoneda(d.total||d._total||0, d.moneda==='USD'?'USD':'PEN')}</strong>`),
      _f('Moneda',          escapar(d.moneda||'PEN')),
      _f('Estado',          escapar(d.estado||'—')),
    ].join('');
  } else { // RH
    docCampos = [
      _f('N° RH',           `<strong style="color:var(--color-secundario)">${escapar(d._ndoc||'—')}</strong>`),
      _f('Prestador',       escapar(d.prestadores_servicios?.nombre||d._proveedor||'—'), true),
      _f('DNI prestador',   escapar(d.prestadores_servicios?.dni||d._ruc||'—')),
      _f('Concepto',        escapar(d.concepto||'—')),
      _f('Fecha emisión',   formatearFecha(d.fecha_emision||d._fecha)),
      _f('Período',         escapar(d.periodo||'—')),
      _f('Renta bruta',     `<strong>${formatearMoneda(d.monto_bruto||0)}</strong>`),
      _f('Retención',       formatearMoneda(d.monto_retencion||0)),
      _f('Renta neta',      `<strong style="color:var(--color-exito);font-size:15px">${formatearMoneda(d.monto_neto||d._total||0)}</strong>`),
      _f('Moneda',          escapar(d.moneda||'PEN')),
      _f('Estado',          escapar(d.estado||'—')),
    ].join('');
  }

  // ── Campos del movimiento bancario ──────────────────────────────
  const movCampos = [
    _f('N° Operación',     `<span style="font-family:monospace">${escapar(m.nro_operacion_bancaria||'—')}</span>`),
    _f('Fecha depósito',   formatearFecha(m.fecha_deposito)),
    _f('Descripción banco',escapar(m.descripcion||'—')),
    _f('Proveedor / Empresa', escapar(m.proveedor_empresa_personal||'—'), true),
    _f('RUC / DNI',        escapar(m.ruc_dni||'—')),
    _f('Monto',            `<strong style="color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'};font-size:15px">${formatearMoneda(m.monto, m.moneda==='USD'?'USD':'PEN')}</strong>`),
    _f('Moneda',           escapar(m.moneda||'PEN')),
    _f('Concepto',         escapar(m.concepto||'—')),
    _f('Proyecto',         m.proyecto ? escapar(m.proyecto) : null),
    _f('Empresa',          m.empresa ? escapar(m.empresa) : null),
    _f('Cotización',       m.cotizacion ? escapar(m.cotizacion) : null),
    _f('OC',               m.oc ? escapar(m.oc) : null),
    _f('Autorización',     m.autorizacion ? escapar(m.autorizacion) : null),
    _f('Detalles compra',  m.detalles_compra_servicio ? escapar(m.detalles_compra_servicio) : null),
    _f('Observaciones',    m.observaciones ? escapar(m.observaciones) : null),
    _f('Estado actual',    `<span style="background:${m.entrega_doc==='EMITIDO'?'#2F855A':'#C53030'};color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${escapar(m.entrega_doc||'PENDIENTE')}</span>`),
    _f('Estado conciliación', m.estado_conciliacion ? `<span style="color:${m.estado_conciliacion==='conciliado'?'#22c55e':'#f59e0b'};font-weight:700">${escapar(m.estado_conciliacion)}</span>` : null),
  ].join('');

  // ── Diferencia de montos ─────────────────────────────────────────
  const montoMov = Math.abs(Number(m.monto));
  const montoDoc = Math.abs(Number(d._total || d.monto_neto || 0));
  const diff     = Math.abs(montoMov - montoDoc);
  const diffPct  = montoDoc > 0 ? Math.round(diff / montoDoc * 100) : 0;
  const diffHtml = diff === 0
    ? '<span style="color:#22c55e;font-weight:700">✓ Montos exactos</span>'
    : `<span style="color:${diffPct>5?'#ef4444':'#f59e0b'}">Diferencia: ${formatearMoneda(diff)} (${diffPct}%)</span>`;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';

  overlay.innerHTML = `
    <div style="background:var(--color-bg-card);border-radius:12px;padding:0;max-width:680px;width:100%;
      box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid var(--color-borde);overflow:hidden;
      max-height:calc(100vh - 24px);display:flex;flex-direction:column">

      <!-- Header -->
      <div style="background:${tipoBg};padding:16px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0">
        <span style="font-size:24px">${tipoIcon}</span>
        <div>
          <div style="color:#fff;font-weight:700;font-size:16px">${escapar(d._ndoc || '—')}</div>
          <div style="color:rgba(255,255,255,.8);font-size:12px">Vista previa completa · ${escapar(d._tipo || '')} ${_scoreChip(item.score)}</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="margin-left:auto;background:rgba(255,255,255,.2);border:none;border-radius:50%;
            width:30px;height:30px;cursor:pointer;color:#fff;font-size:18px;line-height:1">✕</button>
      </div>

      <!-- Diferencia rápida -->
      <div style="padding:10px 20px;background:rgba(128,128,128,.05);border-bottom:1px solid var(--color-borde);
        display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;flex-shrink:0">
        <div style="font-size:12px;color:var(--color-texto-suave)">
          🏦 Mov: <strong>${formatearMoneda(montoMov)}</strong>
          &nbsp;·&nbsp;
          📋 Doc: <strong>${formatearMoneda(montoDoc)}</strong>
          &nbsp;·&nbsp;${diffHtml}
        </div>
        <div style="font-size:12px;color:var(--color-texto-suave)">
          ${item.score >= 85 ? '✅ Alta confianza' : item.score >= 60 ? '⚠️ Media confianza' : '❌ Baja confianza'}
        </div>
      </div>

      <!-- Cuerpo en 2 columnas -->
      <div style="flex:1;overflow-y:auto;padding:0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">

          <!-- Col izq: Comprobante -->
          <div style="padding:16px 20px;border-right:1px solid var(--color-borde)">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
              color:var(--color-texto-suave);margin-bottom:10px;display:flex;align-items:center;gap:6px">
              ${tipoIcon} Comprobante
              <span style="background:${tipoBg};color:#fff;padding:2px 6px;border-radius:4px;font-size:9px">${escapar(d._tipo||'')}</span>
            </div>
            ${docCampos || '<div style="color:var(--color-texto-suave);font-size:12px">Sin datos</div>'}
          </div>

          <!-- Col der: Movimiento bancario -->
          <div style="padding:16px 20px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
              color:var(--color-texto-suave);margin-bottom:10px">🏦 Movimiento bancario</div>
            ${movCampos || '<div style="color:var(--color-texto-suave);font-size:12px">Sin datos</div>'}
          </div>
        </div>
      </div>

      <!-- Acciones -->
      <div style="padding:14px 20px;border-top:1px solid var(--color-borde);display:flex;gap:8px;justify-content:flex-end;flex-shrink:0;flex-wrap:wrap">
        <button onclick="_verDocumentosEnlazados('${m.id}','${escapar(m.nro_operacion_bancaria||'')}');this.closest('[style*=fixed]').remove()"
          style="padding:8px 14px;border:1px solid rgba(113,71,224,.4);border-radius:8px;background:rgba(113,71,224,.1);
            color:#7147e0;cursor:pointer;font-size:12px;font-family:var(--font)">
          🔗 Ver enlaces
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="padding:8px 16px;border:1px solid var(--color-borde);border-radius:8px;
            background:var(--color-bg-card);color:var(--color-texto);cursor:pointer;font-size:13px;font-family:var(--font)">
          Cerrar
        </button>
        <button onclick="this.closest('[style*=fixed]').remove(); _aprobarMatch('${m.id}','${d._tipo}','${d.id}',${item.score},'${item.score>=85?'EXACTO':'POSIBLE'}',${parseInt(key.split('_')[1])},'${key.split('_')[0]}')"
          style="padding:8px 18px;border:none;border-radius:8px;background:#2C5282;color:#fff;
            cursor:pointer;font-size:13px;font-family:var(--font);font-weight:600">
          ✓ Aprobar match
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Vista comprobante para Multi-transfer (👁️) ──────────────────
function _verComprobanteMultiDoc(key) {
  const item = _conItemCache[key];
  if (!item || !item.esMulti) { mostrarToast('Dato no disponible', 'atencion'); return; }

  const d       = item.doc;
  const tipoBg  = d._tipo === 'RH' ? '#744210' : d._tipo === 'VENTA' ? '#276749' : '#2C5282';
  const tipoIcon = d._tipo === 'RH' ? '🧾' : d._tipo === 'VENTA' ? '📄' : '🛒';

  const _f = (lbl, val) => val
    ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid rgba(128,128,128,.1)">
        <span style="color:var(--color-texto-suave);font-size:11px;flex-shrink:0;margin-right:10px;min-width:110px">${lbl}</span>
        <span style="text-align:right;word-break:break-all">${val}</span>
       </div>`
    : '';

  let docCampos = '';
  if (d._tipo === 'COMPRA') {
    docCampos = [
      _f('N° Comprobante', `<strong style="color:var(--color-secundario)">${escapar(d._ndoc||'—')}</strong>`),
      _f('Proveedor', escapar(d.nombre_proveedor||d._proveedor||'—')),
      _f('RUC proveedor', escapar(d.ruc_proveedor||d._ruc||'—')),
      _f('Fecha emisión', formatearFecha(d.fecha_emision||d._fecha)),
      _f('Período', escapar(d.periodo||'—')),
      _f('Base imponible', formatearMoneda(d.base_imponible||0)),
      _f('IGV', formatearMoneda(d.igv||0)),
      _f('Total', `<strong style="color:var(--color-exito);font-size:14px">${formatearMoneda(d.total||d._total||0)}</strong>`),
    ].join('');
  } else if (d._tipo === 'VENTA') {
    docCampos = [
      _f('N° Comprobante', `<strong style="color:var(--color-secundario)">${escapar(d._ndoc||'—')}</strong>`),
      _f('Cliente', escapar(d.nombre_cliente||d.razon_social||d._proveedor||'—')),
      _f('RUC / DNI', escapar(d.ruc_cliente||d.ruc||d._ruc||'—')),
      _f('Fecha emisión', formatearFecha(d.fecha_emision||d._fecha)),
      _f('Período', escapar(d.periodo||'—')),
      _f('Total', `<strong style="color:var(--color-exito);font-size:14px">${formatearMoneda(d.total||d._total||0)}</strong>`),
    ].join('');
  } else { // RH
    docCampos = [
      _f('N° RH', `<strong style="color:var(--color-secundario)">${escapar(d._ndoc||'—')}</strong>`),
      _f('Prestador', escapar(d.prestadores_servicios?.nombre||d._proveedor||'—')),
      _f('DNI prestador', escapar(d.prestadores_servicios?.dni||d._ruc||'—')),
      _f('Concepto', escapar(d.concepto||'—')),
      _f('Fecha emisión', formatearFecha(d.fecha_emision||d._fecha)),
      _f('Renta bruta', formatearMoneda(d.monto_bruto||0)),
      _f('Retención', formatearMoneda(d.monto_retencion||0)),
      _f('Renta neta', `<strong style="color:var(--color-exito);font-size:14px">${formatearMoneda(d.monto_neto||d._total||0)}</strong>`),
    ].join('');
  }

  const movsResumen = item.movs.map((m, i) => `
    <div style="padding:8px 10px;background:rgba(44,82,130,.05);border:1px solid rgba(44,82,130,.15);border-radius:6px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <div style="font-family:monospace;font-size:11px;font-weight:600;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria||'—')}</div>
          <div style="font-size:11px;color:var(--color-texto-suave);margin-top:1px">${formatearFecha(m.fecha_deposito)} · ${escapar(truncar(m.descripcion||'—',35))}</div>
        </div>
        <div style="font-weight:700;font-size:13px;flex-shrink:0;color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'}">${formatearMoneda(m.monto)}</div>
      </div>
    </div>`).join('');

  const firstMovId  = item.movs[0]?.id || '';
  const firstMovNro = (item.movs[0]?.nro_operacion_bancaria || '').replace(/'/g, '');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';
  overlay.innerHTML = `
    <div style="background:var(--color-bg-card);border-radius:12px;max-width:520px;width:100%;
      box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid var(--color-borde);overflow:hidden;
      max-height:calc(100vh - 24px);display:flex;flex-direction:column">

      <div style="background:${tipoBg};padding:14px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0">
        <span style="font-size:22px">${tipoIcon}</span>
        <div style="flex:1">
          <div style="color:#fff;font-weight:700;font-size:15px">${escapar(d._ndoc||'—')}</div>
          <div style="color:rgba(255,255,255,.8);font-size:11px">Multi-transfer · ${item.movs.length} movimientos · Σ ${formatearMoneda(item.sumaMovs)} · Score ${item.score}%</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="background:rgba(255,255,255,.2);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;color:#fff;font-size:16px">✕</button>
      </div>

      <div style="flex:1;overflow-y:auto;padding:0">
        <div style="padding:14px 18px;border-bottom:1px solid var(--color-borde)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--color-texto-suave);margin-bottom:8px">
            ${tipoIcon} Comprobante — ${escapar(d._tipo||'')}
          </div>
          ${docCampos}
        </div>
        <div style="padding:14px 18px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#7147e0;margin-bottom:8px">
            🏦 ${item.movs.length} Movimientos bancarios vinculados — Total: ${formatearMoneda(item.sumaMovs)} / Doc: ${formatearMoneda(d._total||0)}
          </div>
          ${movsResumen}
        </div>
      </div>

      <div style="padding:12px 18px;border-top:1px solid var(--color-borde);display:flex;gap:8px;justify-content:flex-end;flex-shrink:0">
        <button onclick="_verDocumentosEnlazados('${firstMovId}','${firstMovNro}');this.closest('[style*=fixed]').remove()"
          style="padding:7px 14px;border:1px solid rgba(113,71,224,.4);border-radius:8px;background:rgba(113,71,224,.1);color:#7147e0;cursor:pointer;font-size:12px;font-family:var(--font)">
          🔗 Ver enlaces
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="padding:7px 16px;border:1px solid var(--color-borde);border-radius:8px;background:var(--color-bg-card);color:var(--color-texto);cursor:pointer;font-size:13px;font-family:var(--font)">
          Cerrar
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

  // MEJORA 9: registrar ítems con sugerencia en cache para que _aprobarMatch los encuentre
  lista.forEach((item, idx) => {
    if (item.doc) _conItemCache[`sm_${idx}`] = { mov: item.mov, doc: item.doc, score: item.score };
  });

  const opciones = [
    { v:'',   t:'— Clasificar como —' },
    { v:'FA', t:'FA — Factura' },
    { v:'BO', t:'BO — Boleta' },
    { v:'BP', t:'BP — Boleta de Pago' },
    { v:'RH', t:'RH — Recibo por Honorarios' },
    { v:'TK', t:'TK — Ticket' },
    { v:'PM', t:'PM — Planilla de Movilidad' },
    { v:'AT', t:'AT — App de Taxi' },
    { v:'DL', t:'DL — Delivery' },
    { v:'PJ', t:'PJ — Ticket de Peaje' },
    { v:'SB', t:'SB — Recibo de Luz / Agua / Gas' },
    { v:'VB', t:'VB — Voucher de Banco' },
    { v:'OT', t:'OT — Comprobante sin serie legible' },
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
            ${_thFijo('Posible match / Clasificar')}
            ${_thFijo('Acciones')}
          </tr>
        </thead>
        <tbody>
          ${lista.length ? lista.map((item, idx) => {
            const m = item.mov;

            // MEJORA 9: bloque de sugerencia si existe un doc con cualquier score
            let sugerenciaHtml = '';
            if (item.doc) {
              const d    = item.doc;
              const montoDoc = Math.abs(Number(d.importe || d.monto_total || 0));
              const diff = Math.abs(Math.abs(Number(m.monto)) - montoDoc);
              sugerenciaHtml = `
                <div style="margin-bottom:5px;padding:6px 8px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:6px;font-size:11px">
                  <div style="font-weight:600;color:#d97706;margin-bottom:2px">⚠️ POSIBLE MATCH (${item.score}%)</div>
                  <div style="color:var(--color-texto);margin-bottom:1px">${escapar(d._ndoc||'—')} · ${escapar((d._proveedor||'').slice(0,25)||'—')}</div>
                  <div style="color:var(--color-texto-suave)">
                    Comprobante: ${formatearMoneda(montoDoc)}
                    · <strong style="color:${diff>0?'#ef4444':'#22c55e'}">Diferencia: ${formatearMoneda(diff)}</strong>
                  </div>
                  <div style="display:flex;gap:4px;margin-top:4px">
                    <button style="padding:3px 8px;background:#166534;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-family:var(--font)"
                      onclick="_aprobarMatch('${m.id}','${d._tipo||''}','${d.id||''}',${item.score},'POSIBLE',${idx},'sm')">✓ Confirmar</button>
                    <button style="padding:3px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
                      onclick="_descartarSugerenciaSM(${idx})">✕ Descartar</button>
                  </div>
                </div>`;
            }

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
              <td style="${_TD};min-width:220px">
                ${sugerenciaHtml}
                <select id="con-clas-${idx}"
                  style="padding:4px 8px;border:1px solid var(--color-borde);border-radius:4px;
                         background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font);width:100%">
                  ${opciones.map(o=>`<option value="${o.v}">${o.t}</option>`).join('')}
                </select>
              </td>
              <td style="${_TD}">
                <div style="display:flex;gap:4px">
                  <button class="btn btn-sm btn-primario" style="font-size:11px;padding:4px 9px"
                    onclick="_guardarClasificacion('${m.id}',${idx})">Guardar</button>
                  <button title="Buscar comprobante manualmente" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px"
                    onclick="_abrirPanelManual('${m.id}',${m.monto},'${m.fecha_deposito || ''}','${(m.nro_operacion_bancaria||'').replace(/'/g,'') }')">🔍</button>
                  <button title="Ver documentos enlazados a este movimiento" style="padding:4px 8px;background:rgba(113,71,224,.1);color:#7147e0;border:none;border-radius:4px;cursor:pointer;font-size:13px"
                    onclick="_verDocumentosEnlazados('${m.id}','${escapar(m.nro_operacion_bancaria||'')}')">🔗</button>
                </div>
              </td>
            </tr>`;
          }).join('') :
          `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--color-texto-suave)">Sin resultados para este filtro</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ── Descartar sugerencia sin match ───────────────────────────────
function _descartarSugerenciaSM(idx) {
  const item = _con_resultados.sin_match[idx];
  if (item) item.doc = null;
  delete _conItemCache[`sm_${idx}`];
  _conActivarSubtab('sin_match');
}

// ── Aprobar match individual ─────────────────────────────────────
async function _aprobarMatch(movId, docTipo, docId, score, tipoMatch, idx, prefijo) {
  const hoy = new Date().toISOString().slice(0, 10);

  // Actualizar tesoreria_mbd: EMITIDO + escribir el número de comprobante
  const itemLocal = Object.values(_conItemCache).find(it => it.mov?.id === movId);
  const nroDoc    = itemLocal?.doc?._ndoc || null;
  const tipoDoc   = itemLocal?.doc?._tipo || null;

  // MEJORA 6: migrar proveedor y ruc sólo si el comprobante los tiene y el mov no
  const updateMov = {
    entrega_doc:          'EMITIDO',
    estado_conciliacion:  'conciliado',
    nro_factura_doc:      nroDoc,
    tipo_doc:             tipoDoc,
    // Tipo de comprobante de la lista (FA/BO/RH), no la categoría interna (COMPRA/VENTA)
    tipo_comprobante:     tipoDoc ? _conCodigoTipoComprobante(tipoDoc, nroDoc) : undefined,
    fecha_actualizacion:  hoy,
  };
  if (typeof _resolverProveedorTitular === 'function') {
    const rt = _resolverProveedorTitular(itemLocal?.mov?.proveedor_empresa_personal, itemLocal?.doc?._proveedor, itemLocal?.mov?.ruc_dni, itemLocal?.doc?._ruc);
    updateMov.proveedor_empresa_personal = rt.proveedor;
    updateMov.titular_comprobante = rt.titular;
    updateMov.ruc_dni = rt.ruc;
  } else {
    if (itemLocal?.doc?._proveedor && !itemLocal?.mov?.proveedor_empresa_personal)
      updateMov.proveedor_empresa_personal = itemLocal.doc._proveedor;
    if (itemLocal?.doc?._ruc && !itemLocal?.mov?.ruc_dni)
      updateMov.ruc_dni = itemLocal.doc._ruc;
  }

  const { error: errMov } = await _supabase
    .from('tesoreria_mbd')
    .update(updateMov)
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
  } else if (prefijo === 'sm') {
    // MEJORA 9: aprobado desde pestaña Sin match
    _con_resultados.sin_match = _con_resultados.sin_match.filter(i => i.mov.id !== movId);
    document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
    delete _conItemCache[`sm_${idx}`];
    _conActivarSubtab('sin_match');
  } else {
    _con_resultados.posibles = _con_resultados.posibles.filter(i => i.mov.id !== movId);
    document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  }
  _conRefrescarPanel(); // actualizar panel de avance en tiempo real
  // Compras/Ventas/RH y Movimientos calculan su estado en vivo desde
  // tesoreria_mbd — sin esto se quedaban con el estado viejo (auditoría 2026-09-18).
  if (typeof _refrescarVistasVinculadas === 'function') _refrescarVistasVinculadas();
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

// ── Aprobar multi-transferencia ───────────────────────────────────
async function _aprobarMatchMulti(key, idx) {
  const item = _conItemCache[key];
  if (!item || !item.esMulti) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const d   = item.doc;
  let ok = 0, errores = 0;

  for (const m of item.movs) {
    const updateMov = {
      entrega_doc:          'EMITIDO',
      estado_conciliacion:  'conciliado',
      nro_factura_doc:      d._ndoc || null,
      tipo_doc:             d._tipo || null,
      tipo_comprobante:     d._tipo ? _conCodigoTipoComprobante(d._tipo, d._ndoc) : undefined,
      fecha_actualizacion:  hoy,
    };
    if (typeof _resolverProveedorTitular === 'function') {
      const rt = _resolverProveedorTitular(m.proveedor_empresa_personal, d._proveedor, m.ruc_dni, d._ruc);
      updateMov.proveedor_empresa_personal = rt.proveedor;
      updateMov.titular_comprobante = rt.titular;
      updateMov.ruc_dni = rt.ruc;
    } else {
      if (d._proveedor && !m.proveedor_empresa_personal) updateMov.proveedor_empresa_personal = d._proveedor;
      if (d._ruc && !m.ruc_dni) updateMov.ruc_dni = d._ruc;
    }

    const { error: errMov } = await _supabase.from('tesoreria_mbd').update(updateMov).eq('id', m.id);
    if (errMov) { errores++; continue; }

    await _supabase.from('conciliaciones').insert({
      empresa_operadora_id: empresa_activa.id,
      movimiento_id:        m.id,
      doc_tipo:             d._tipo,
      doc_id:               d.id || null,
      score:                item.score,
      tipo_match:           'MULTI_TRANSFER',
      estado:               'APROBADO',
      usuario_id:           perfil_usuario?.id || null,
    });
    ok++;
  }

  for (let mi = 0; mi < item.movs.length; mi++) {
    const rowId = mi === 0 ? `con-row-pos-${idx}` : `con-row-pos-${idx}-${mi}`;
    const fila  = document.getElementById(rowId);
    if (fila) { fila.style.opacity = '0.35'; fila.querySelectorAll('button').forEach(b => b.disabled = true); }
  }

  _con_resultados.posibles = _con_resultados.posibles.filter((_, i) => i !== idx);
  document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  _conRefrescarPanel();
  if (typeof _refrescarVistasVinculadas === 'function') _refrescarVistasVinculadas();
  mostrarToast(`✅ Multi-transferencia aprobada (${ok} movimientos)${errores ? ` · ${errores} con error` : ''}`, ok ? 'exito' : 'error');
}

// ── Rechazar multi-transferencia ──────────────────────────────────
function _rechazarMatchMulti(idx) {
  const item = _con_resultados.posibles[idx];
  if (!item || !item.esMulti) return;
  for (const m of item.movs) {
    _con_resultados.sin_match.push({ mov: m, score: 0 });
  }
  _con_resultados.posibles = _con_resultados.posibles.filter((_, i) => i !== idx);
  document.getElementById('con-cnt-posibles').textContent = _con_resultados.posibles.length;
  document.getElementById('con-cnt-sinmatch').textContent = _con_resultados.sin_match.length;
  _conActivarSubtab('posibles');
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
    // MEJORA 6: migrar proveedor y ruc sólo si el comprobante los tiene y el mov no
    const updLote = {
      entrega_doc:          'EMITIDO',
      estado_conciliacion:  'conciliado',
      nro_factura_doc:      item.doc._ndoc || null,
      tipo_doc:             item.doc._tipo || null,
      tipo_comprobante:     item.doc._tipo ? _conCodigoTipoComprobante(item.doc._tipo, item.doc._ndoc) : undefined,
      fecha_actualizacion:  hoy,
    };
    if (typeof _resolverProveedorTitular === 'function') {
      const rt = _resolverProveedorTitular(item.mov.proveedor_empresa_personal, item.doc._proveedor, item.mov.ruc_dni, item.doc._ruc);
      updLote.proveedor_empresa_personal = rt.proveedor;
      updLote.titular_comprobante = rt.titular;
      updLote.ruc_dni = rt.ruc;
    } else {
      if (item.doc._proveedor && !item.mov.proveedor_empresa_personal) updLote.proveedor_empresa_personal = item.doc._proveedor;
      if (item.doc._ruc && !item.mov.ruc_dni) updLote.ruc_dni = item.doc._ruc;
    }
    const { error: e1 } = await _supabase.from('tesoreria_mbd')
      .update(updLote).eq('id', item.mov.id);

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
  _conRefrescarPanel(); // actualizar panel de avance en tiempo real
  // Compras/Ventas/RH y Movimientos calculan su estado en vivo desde
  // tesoreria_mbd — sin esto se quedaban con el estado viejo (auditoría 2026-09-18).
  if (typeof _refrescarVistasVinculadas === 'function') _refrescarVistasVinculadas();

  mostrarToast(`✅ ${ok} aprobados${errores ? ` · ${errores} con error` : ''}.`, ok ? 'exito' : 'error');
}

// ── Guardar clasificación sin match ──────────────────────────────
async function _guardarClasificacion(movId, idx) {
  const sel  = document.getElementById(`con-clas-${idx}`);
  const clas = sel?.value || '';
  if (!clas) { mostrarToast('Selecciona una clasificación', 'atencion'); return; }

  const { error } = await _supabase.from('tesoreria_mbd')
    .update({ entrega_doc: 'EMITIDO', tipo_doc: clas, estado_conciliacion: 'conciliado' })
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
  _conRefrescarPanel(); // actualizar panel de avance en tiempo real
  // Compras/Ventas/RH y Movimientos calculan su estado en vivo desde
  // tesoreria_mbd — sin esto se quedaban con el estado viejo (auditoría 2026-09-18).
  if (typeof _refrescarVistasVinculadas === 'function') _refrescarVistasVinculadas();
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
      <select id="pm-q-tipo"
        style="padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
        <option value="">Todos los tipos</option>
        <option value="COMPRA">🛒 Compras</option>
        <option value="VENTA">📄 Ventas</option>
        <option value="RH">🧾 RH Honorarios</option>
        <option value="PM">🚗 Planilla Movilidad</option>
      </select>
      <input type="text" id="pm-q-num" placeholder="N° comprobante / planilla…"
        style="padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
      <input type="text" id="pm-q-prov" placeholder="Proveedor / Trabajador / RUC / DNI"
        style="padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
      <button class="btn btn-primario" style="width:100%" onclick="_panelBuscar('${movId}')">🔍 Buscar</button>
    </div>
    <div id="pm-resultados" style="font-size:12px;color:var(--color-texto-suave)">Ingresa criterios de búsqueda…</div>`;
}

async function _panelBuscar(movId) {
  const qTipo = (document.getElementById('pm-q-tipo')?.value  || '').trim();
  const qNum  = (document.getElementById('pm-q-num')?.value   || '').trim().toLowerCase();
  const qProv = (document.getElementById('pm-q-prov')?.value  || '').trim().toLowerCase();
  const resEl = document.getElementById('pm-resultados');
  if (!resEl) return;
  if (!qNum && !qProv) { mostrarToast('Ingresa al menos un criterio de búsqueda', 'atencion'); return; }

  resEl.innerHTML = '<div class="spinner" style="margin:10px auto"></div>';

  const periodo = _con_periodo_actual;
  const periodosVentana = periodo ? _conPeriodosAdyacentes(periodo) : [];
  const periodosVentanaCompacto = periodosVentana.map(p => p.replace('-', ''));
  const empId = empresa_activa.id;

  // ── Cargar fuentes según tipo seleccionado ──────────────────────
  const promesas = [];
  if (!qTipo || qTipo === 'COMPRA')
    promesas.push(_supabase.from('contabilidad_compras').select('id,serie_cdp,nro_cp_inicial,proveedor,nro_doc_identidad,total_cp,fecha_emision').eq('empresa_id', empId).in('periodo', periodosVentanaCompacto));
  else promesas.push(Promise.resolve({ data: [] }));

  if (!qTipo || qTipo === 'VENTA')
    promesas.push(_supabase.from('contabilidad_ventas').select('id,serie_cdp,nro_cp_inicial,cliente,nro_doc_identidad,total_cp,fecha_emision').eq('empresa_id', empId).in('periodo', periodosVentanaCompacto));
  else promesas.push(Promise.resolve({ data: [] }));

  if (!qTipo || qTipo === 'RH')
    promesas.push(_supabase.from('rh_registros').select('id,numero_rh,monto_neto,fecha_emision,prestadores_servicios(nombre,dni)').eq('empresa_operadora_id', empId).in('periodo', periodosVentana));
  else promesas.push(Promise.resolve({ data: [] }));

  if (!qTipo || qTipo === 'PM')
    promesas.push(_supabase.from('planillas_movilidad').select('id,numero_planilla,trabajador_nombre,trabajador_dni,total_gastos,mes,fecha_emision,estado').eq('empresa_operadora_id', empId).in('mes', periodosVentana));
  else promesas.push(Promise.resolve({ data: [] }));

  const [resC, resV, resR, resPM] = await Promise.all(promesas);

  const tipoBg   = { COMPRA:'#2C5282', VENTA:'#276749', RH:'#744210', PM:'#553C9A' };
  const tipoIcon = { COMPRA:'🛒', VENTA:'📄', RH:'🧾', PM:'🚗' };

  const todos = [
    ...(resC.data||[]).map(d => ({ _tipo:'COMPRA', _ndoc:[d.serie_cdp,d.nro_cp_inicial].filter(Boolean).join('-')||d.id?.slice(0,8), _prov: d.proveedor||'', _ruc: d.nro_doc_identidad||'', _total: d.total_cp||0, id: d.id })),
    ...(resV.data||[]).map(d => ({ _tipo:'VENTA',  _ndoc:[d.serie_cdp,d.nro_cp_inicial].filter(Boolean).join('-')||d.id?.slice(0,8), _prov: d.cliente||'', _ruc: d.nro_doc_identidad||'', _total: d.total_cp||0, id: d.id })),
    ...(resR.data||[]).map(d => ({ _tipo:'RH',     _ndoc: d.numero_rh||d.id?.slice(0,8), _prov: d.prestadores_servicios?.nombre||'', _ruc: d.prestadores_servicios?.dni||'', _total: d.monto_neto||0, id: d.id })),
    ...(resPM.data||[]).map(d => ({ _tipo:'PM',    _ndoc: d.numero_planilla||d.id?.slice(0,8), _prov: d.trabajador_nombre||'', _ruc: d.trabajador_dni||'', _total: d.total_gastos||0, id: d.id, _estado: d.estado })),
  ].filter(d => {
    const ndocL = (d._ndoc||'').toLowerCase();
    const provL = [(d._prov||''),(d._ruc||'')].join(' ').toLowerCase();
    if (qNum  && !ndocL.includes(qNum))  return false;
    if (qProv && !provL.includes(qProv)) return false;
    return true;
  });

  if (!todos.length) {
    resEl.innerHTML = '<p style="text-align:center;padding:16px;color:var(--color-texto-suave)">Sin resultados</p>';
    return;
  }

  resEl.innerHTML = `
    <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:8px">${todos.length} resultado(s)</div>
    ${todos.slice(0, 12).map(d => `
      <div style="border:1px solid var(--color-borde);border-radius:6px;padding:9px 10px;margin-bottom:7px;background:var(--color-bg-card)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="background:${tipoBg[d._tipo]||'#718096'};color:#fff;padding:2px 5px;border-radius:3px;font-size:9px;font-weight:700">${tipoIcon[d._tipo]||''} ${d._tipo}</span>
          <strong style="color:var(--color-secundario);font-size:11px">${escapar(d._ndoc||'—')}</strong>
          ${d._estado ? `<span style="font-size:9px;color:#553C9A">${d._estado}</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--color-texto-suave)">${escapar(d._prov||'—')} ${d._ruc ? `· ${escapar(d._ruc)}` : ''}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
          <span style="font-weight:700;color:var(--color-secundario);font-size:12px">${formatearMoneda(d._total)}</span>
          <button class="btn btn-sm btn-primario" style="font-size:10px;padding:3px 9px"
            onclick="_vincularManual('${movId}','${d._tipo}','${d.id}','${escapar(d._ndoc||'')}')">✓ Vincular</button>
        </div>
      </div>`).join('')}`;
}

async function _vincularManual(movId, docTipo, docId, nDocDirecto) {
  // Intentar obtener el nroDoc del cache; usar el nDocDirecto si viene del panel de búsqueda
  let nroDoc = nDocDirecto || null;
  if (!nroDoc) {
    const todos = [..._con_resultados.exactos, ..._con_resultados.posibles, ..._con_resultados.sin_match];
    const itemDoc = todos.find(i => i.doc?.id === docId);
    nroDoc = itemDoc?.doc?._ndoc || null;
  }

  const { error } = await _supabase.from('tesoreria_mbd')
    .update({
      entrega_doc:     'OBSERVADO',
      nro_factura_doc: nroDoc,
      tipo_doc:        docTipo,
      tipo_comprobante: docTipo ? _conCodigoTipoComprobante(docTipo, nroDoc) : undefined,
    }).eq('id', movId);

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
  _conRefrescarPanel(); // actualizar avance en tiempo real
  if (typeof _refrescarVistasVinculadas === 'function') _refrescarVistasVinculadas();
}

// ── Vinculación manual de RH vía 🔍 lupa guarda el UUID del RH en
//    nro_factura_doc (dos emisores distintos pueden repetir el mismo N° RH
//    legible) — ver comentario en busqueda-comprobante.js línea 252. Para que
//    los Excel exportados se lean igual que en pantalla, se resuelve ese
//    UUID al N° RH legible (ej. "E001-8") antes de exportar. ──────────────
const _conUuidRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function _conMapaNumeroRH(mbdRows) {
  const ids = [...new Set((mbdRows || [])
    .filter(r => _conUuidRE.test(r.nro_factura_doc || '')) // un UUID solo puede ser un RH, aunque tipo_doc esté vacío/dañado
    .map(r => r.nro_factura_doc))];
  const mapa = new Map();
  if (!ids.length) return mapa;
  const { data } = await _supabase.from('rh_registros').select('id,numero_rh').in('id', ids);
  (data || []).forEach(rh => { if (rh.numero_rh) mapa.set(rh.id, rh.numero_rh); });
  return mapa;
}
function _conNroFacturaLegible(m, mapaRH) {
  return mapaRH?.has(m.nro_factura_doc) ? mapaRH.get(m.nro_factura_doc) : (m.nro_factura_doc || '');
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

  // Traer score/tipo_match de la conciliación que aprobó cada movimiento
  // (aquí conciliaciones.movimiento_id apunta al id de tesoreria_mbd, no al de movimientos)
  const { data: concils } = await _supabase.from('conciliaciones')
    .select('movimiento_id,score,tipo_match,estado')
    .eq('empresa_operadora_id', empresa_activa.id)
    .in('movimiento_id', data.map(m => m.id));
  const concilMap = new Map((concils || []).map(c => [c.movimiento_id, c]));
  const mapaRH = await _conMapaNumeroRH(data);

  const cab = ['N° Operación','Fecha Depósito','Descripción','Moneda','Monto',
    'Proveedor/Empresa/Personal','RUC/DNI','Cotización','OC','Proyecto','Concepto',
    'Empresa','Estado Doc','Nº Factura/DOC','Tipo DOC','Autorización',
    'Observaciones','Detalles Compra/Servicio','Observaciones 2',
    'Tipo Match','Score Conciliación','Estado Conciliación'];

  const filas = data.map(m => {
    const c = concilMap.get(m.id);
    return [
      m.nro_operacion_bancaria||'', m.fecha_deposito||'', m.descripcion||'',
      m.moneda||'S/', m.monto,
      m.proveedor_empresa_personal||'', m.ruc_dni||'', m.cotizacion||'',
      m.oc||'', m.proyecto||'', m.concepto||'', m.empresa||'',
      m.entrega_doc||'', _conNroFacturaLegible(m, mapaRH), m.tipo_comprobante||m.tipo_doc||'', // FA/BO/RH como en pantalla, no la categoría interna
      m.autorizacion||'', m.observaciones||'',
      m.detalles_compra_servicio||'', m.observaciones_2||'',
      c?.tipo_match||'', c?.score ?? '', c?.estado||'',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'APROBADOS');
  XLSX.writeFile(wb, `Conciliacion_${_con_periodo_actual}_${empresa_activa.ruc||''}.xlsx`);
  mostrarToast('✓ Exportación completada', 'exito');
}

// ══════════════════════════════════════════════════════════════════
// PANEL DE AVANCE — funciones de soporte
// ══════════════════════════════════════════════════════════════════

// ── Cambio de mes en el selector (actualiza panel sin re-conciliar) ─
function _conPanelCambiarMes() {
  const el = document.getElementById('con-periodo');
  if (!el?.value) return;
  _con_periodo_actual = el.value;
  _conRefrescarPanel();
}

// ── Refrescar panel de avance en tiempo real ────────────────────────
async function _conRefrescarPanel() {
  const panel = document.getElementById('con-panel-avance');
  if (!panel || !_con_periodo_actual) return;

  const [yyyy, mm] = _con_periodo_actual.split('-');
  const fin = new Date(parseInt(yyyy), parseInt(mm), 0).toISOString().slice(0, 10);

  const { data, error } = await _supabase
    .from('tesoreria_mbd')
    .select('entrega_doc, monto, nro_factura_doc, tipo_doc')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_deposito', `${yyyy}-${mm}-01`)
    .lte('fecha_deposito', fin);

  if (error) return;

  const rows = data || [];

  // Agrupar por estado
  const grupos = {};
  let totalN = 0, totalS = 0;
  for (const row of rows) {
    const est = row.entrega_doc || 'PENDIENTE';
    const mnt = Math.abs(parseFloat(row.monto) || 0);
    if (!grupos[est]) grupos[est] = { n: 0, s: 0 };
    grupos[est].n++;
    grupos[est].s += mnt;
    totalN++;
    totalS += mnt;
  }

  const emitN = grupos.EMITIDO?.n   || 0;
  const emitS = grupos.EMITIDO?.s   || 0;
  const obsN  = grupos.OBSERVADO?.n || 0;
  const obsS  = grupos.OBSERVADO?.s || 0;
  const pendN = grupos.PENDIENTE?.n || 0;
  const pendS = grupos.PENDIENTE?.s || 0;
  const pct   = totalN > 0 ? Math.round((emitN / totalN) * 100) : 0;

  // Mostrar panel
  panel.style.display = 'block';

  // Etiqueta mes
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const lblMes = document.getElementById('pan-label-mes');
  if (lblMes) lblMes.textContent = `${meses[parseInt(mm) - 1]} ${yyyy}`;

  // Barra de progreso
  const barra  = document.getElementById('pan-barra');
  const pctEl  = document.getElementById('pan-pct');
  const lblBar = document.getElementById('pan-barra-label');
  if (barra)  barra.style.width = `${pct}%`;
  if (pctEl)  pctEl.textContent = `${pct}%`;
  if (lblBar) lblBar.textContent = `${emitN} de ${totalN} movimientos conciliados`;

  // Indicador de mes completo
  const completo = document.getElementById('pan-completo');
  if (completo) completo.style.display =
    (totalN > 0 && pendN === 0 && obsN === 0) ? 'block' : 'none';

  // Stats por estado
  const _s = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  _s('pan-emit-n',  emitN);
  _s('pan-emit-s',  formatearMoneda(emitS));
  _s('pan-obs-n',   obsN);
  _s('pan-obs-s',   formatearMoneda(obsS));
  _s('pan-pend-n',  pendN);
  _s('pan-pend-s',  formatearMoneda(pendS));
  _s('pan-total-n', totalN);
  _s('pan-total-s', formatearMoneda(totalS));

  // Validaciones automáticas
  await _conValidar(rows, { emitN, obsN, pendN, totalN });
}

// ── Validaciones automáticas (chips compactos) ──────────────────────
async function _conValidar(filas, { emitN, obsN, pendN, totalN }) {
  const alertasEl = document.getElementById('pan-alertas');
  if (!alertasEl) return;

  const chips = [];

  // 1. Mes 100% conciliado
  if (totalN > 0 && pendN === 0 && obsN === 0) {
    chips.push({ solid: '#16a34a', msg: '✅ Mes conciliado al 100%' });
  }

  // 2. Observados sin resolver
  if (obsN > 0) {
    chips.push({ solid: '#b45309',
      msg: `⚠ ${obsN} observado${obsN > 1 ? 's' : ''} sin resolver` });
  }

  // 3. >20% pendiente
  if (totalN > 0 && pendN / totalN > 0.2) {
    chips.push({ solid: '#dc2626',
      msg: `🔴 ${pendN} pendiente${pendN > 1 ? 's' : ''} (${Math.round(pendN / totalN * 100)}%)` });
  }

  // 4. Mismo N° de comprobante en varios movimientos EMITIDO — puede ser un
  //    pago dividido legítimo (regla N:M, ver _conCobertura) o un error real
  //    (dos movimientos distintos enganchados al mismo N° por error). Aquí
  //    solo se avisa para revisar — el análisis real (¿la suma excede el
  //    total del comprobante?) está en "⚖️ Descuadres de vínculo". Se agrupa
  //    por tipo_doc + N° (no solo N°, para no mezclar Compra/Venta/RH que
  //    coincidan en el mismo número), y el UUID de RH se resuelve a su N°
  //    legible antes de mostrarlo — nunca un id crudo en pantalla.
  if (emitN >= 2) {
    const porClave = {};
    filas.filter(r => r.entrega_doc === 'EMITIDO' && r.nro_factura_doc)
         .forEach(r => {
           const k = `${r.tipo_doc || ''}|${r.nro_factura_doc}`;
           (porClave[k] = porClave[k] || []).push(r);
         });
    const gruposRepetidos = Object.entries(porClave).filter(([, rs]) => rs.length > 1);
    if (gruposRepetidos.length) {
      const idsRH = gruposRepetidos.filter(([k]) => k.startsWith('RH|')).map(([k]) => k.split('|')[1]);
      let nombresRH = {};
      if (idsRH.length) {
        const { data: rhRows } = await _supabase.from('rh_registros').select('id,numero_rh').in('id', idsRH);
        (rhRows || []).forEach(r => { nombresRH[r.id] = r.numero_rh || r.id.slice(0, 8); });
      }
      const etiquetas = gruposRepetidos.map(([k]) => {
        const [tipo, nDoc] = k.split('|');
        return tipo === 'RH' ? escapar(nombresRH[nDoc] || nDoc.slice(0, 8)) : escapar(nDoc);
      });
      chips.push({ solid: '#7c3aed',
        msg: `⚠ ${etiquetas.length} comprobante(s) con varios movimientos: ${etiquetas.slice(0, 3).join(', ')}${etiquetas.length > 3 ? '…' : ''} — revisar en ⚖️ Descuadres de vínculo` });
    }
  }

  if (!chips.length) { alertasEl.innerHTML = ''; return; }

  // Usamos fondo sólido + texto blanco para que funcione en modo oscuro y claro
  alertasEl.innerHTML = chips.map(c => `
    <span title="${c.msg}" style="display:inline-flex;align-items:center;
      padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
      white-space:nowrap;color:#fff;background:${c.solid}">
      ${c.msg}
    </span>`).join('');
}

// ── Exportar avance completo del mes a Excel ────────────────────────
async function _conExportarAvance() {
  if (!_con_periodo_actual) { mostrarToast('Ejecuta la conciliación primero', 'atencion'); return; }

  const [yyyy, mm] = _con_periodo_actual.split('-');
  const fin = new Date(parseInt(yyyy), parseInt(mm), 0).toISOString().slice(0, 10);

  const { data, error } = await _supabase
    .from('tesoreria_mbd')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_deposito', `${yyyy}-${mm}-01`)
    .lte('fecha_deposito', fin)
    .order('fecha_deposito', { ascending: true });

  if (error) { mostrarToast('Error al exportar: ' + error.message, 'error'); return; }
  if (!data?.length) { mostrarToast('Sin datos para este periodo', 'atencion'); return; }

  // Traer score/tipo_match de la conciliación de cada movimiento (si ya fue conciliado)
  const { data: concils } = await _supabase.from('conciliaciones')
    .select('movimiento_id,score,tipo_match')
    .eq('empresa_operadora_id', empresa_activa.id)
    .in('movimiento_id', data.map(m => m.id));
  const concilMap = new Map((concils || []).map(c => [c.movimiento_id, c]));
  const mapaRH = await _conMapaNumeroRH(data);

  const cab = [
    'N° Operación','Fecha Depósito','Descripción','Moneda','Monto',
    'Proveedor / Empresa / Personal','RUC/DNI','Estado','N° Comprobante','Tipo DOC',
    'Tipo Match','Score Conciliación',
  ];
  const filas = data.map(m => {
    const c = concilMap.get(m.id);
    return [
      m.nro_operacion_bancaria || '',
      m.fecha_deposito         || '',
      m.descripcion            || '',
      m.moneda                 || 'PEN',
      m.monto,
      m.proveedor_empresa_personal || '',
      m.ruc_dni                || '',
      m.entrega_doc            || '',
      _conNroFacturaLegible(m, mapaRH),
      m.tipo_comprobante || m.tipo_doc || '', // FA/BO/RH como en pantalla, no la categoría interna
      c?.tipo_match||'', c?.score ?? '',
    ];
  });

  // Resumen al final
  const grupos = {};
  data.forEach(m => { const e = m.entrega_doc || 'PENDIENTE'; grupos[e] = (grupos[e] || 0) + 1; });
  filas.push([], ['RESUMEN']);
  Object.entries(grupos).forEach(([k, v]) => filas.push([k, v]));
  filas.push(['TOTAL', data.length]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  ws['!cols'] = [14,14,30,8,14,30,14,12,16,12,12,10].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AVANCE');
  XLSX.writeFile(wb, `Avance_Conciliacion_${_con_periodo_actual}_${empresa_activa.ruc || ''}.xlsx`);
  mostrarToast('✓ Reporte de avance exportado', 'exito');
}

// ══════════════════════════════════════════════════════════════════
// HISTORIAL — log de conciliaciones aprobadas con opción a revertir
// ══════════════════════════════════════════════════════════════════

async function _renderHistorial(wrap) {
  if (!_con_periodo_actual) {
    wrap.innerHTML = `<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)">
      <p>Selecciona un periodo e inicia la conciliación primero</p></div>`;
    return;
  }

  wrap.innerHTML = `<div class="cargando" style="padding:32px"><div class="spinner"></div><span>Cargando historial…</span></div>`;

  const [yyyy, mm] = _con_periodo_actual.split('-');
  const fin = new Date(parseInt(yyyy), parseInt(mm), 0).toISOString().slice(0, 10);

  // Movimientos EMITIDO del periodo (fuente de verdad)
  const { data: movs, error: errMovs } = await _supabase
    .from('tesoreria_mbd')
    .select('id, nro_operacion_bancaria, fecha_deposito, descripcion, proveedor_empresa_personal, ruc_dni, monto, moneda, entrega_doc, nro_factura_doc, tipo_doc')
    .eq('empresa_id', empresa_activa.id)
    .eq('entrega_doc', 'EMITIDO')
    .gte('fecha_deposito', `${yyyy}-${mm}-01`)
    .lte('fecha_deposito', fin)
    .order('fecha_deposito', { ascending: false });
  // El N° de comprobante de un RH puede estar guardado como UUID: se muestra su N° legible.
  const mapaRHHist = errMovs ? new Map() : await _conMapaNumeroRH(movs);

  if (errMovs) {
    wrap.innerHTML = `<div class="alerta-error">${escapar(errMovs.message)}</div>`;
    return;
  }

  // Registros en tabla conciliaciones para obtener score y tipo_match
  const { data: concils } = await _supabase
    .from('conciliaciones')
    .select('movimiento_id, score, tipo_match, created_at')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('created_at', `${yyyy}-${mm}-01T00:00:00`)
    .lte('created_at', `${yyyy}-${mm}-31T23:59:59`);

  const concilMap = {};
  (concils || []).forEach(c => { concilMap[c.movimiento_id] = c; });

  if (!movs?.length) {
    wrap.innerHTML = `<div class="card" style="text-align:center;padding:32px;color:var(--color-texto-suave)">
      <p>No hay movimientos conciliados en este periodo</p></div>`;
    return;
  }

  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';

  wrap.innerHTML = `
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span style="font-size:13px;color:var(--color-texto-suave)">
        ${movs.length} movimiento(s) conciliados — ${_con_periodo_actual}
      </span>
      <button onclick="_conExportarAvance()" class="btn btn-sm btn-secundario">📥 Exportar avance</button>
    </div>
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Fecha</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">N° Operación</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Proveedor / Empresa</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Monto</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Estado</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">N° Comprobante</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Tipo DOC</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Score</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Tipo Match</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${movs.map(m => {
            const c      = concilMap[m.id] || {};
            const score  = c.score != null ? c.score : null;
            const tMatch = c.tipo_match || 'MANUAL';
            const chipMatch =
              tMatch === 'EXACTO'  ? `<span style="background:#166534;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">EXACTO</span>`
            : tMatch === 'POSIBLE' ? `<span style="background:#854d0e;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">POSIBLE</span>`
                                   : `<span style="background:#2C5282;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">MANUAL</span>`;
            return `<tr
              onmouseover="this.style.background='var(--color-hover)'"
              onmouseout="this.style.background=''">
              <td style="${_TD};white-space:nowrap">${formatearFecha(m.fecha_deposito)}</td>
              <td style="${_TD};font-family:monospace;font-size:11px;white-space:nowrap">${escapar(m.nro_operacion_bancaria || '—')}</td>
              <td style="${_TD};max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                title="${escapar(m.proveedor_empresa_personal || '')}">${escapar((m.proveedor_empresa_personal || '—').slice(0, 30))}</td>
              <td style="${_TD};text-align:right;font-weight:700;white-space:nowrap;color:${Number(m.monto) < 0 ? 'var(--color-critico)' : 'var(--color-exito)'}">
                ${formatearMoneda(m.monto, m.moneda === 'USD' ? 'USD' : 'PEN')}</td>
              <td style="${_TD}">${_tdEstado(m.entrega_doc)}</td>
              <td style="${_TD};font-weight:600;color:var(--color-secundario);white-space:nowrap">${escapar(_conNroFacturaLegible(m, mapaRHHist) || '—')}</td>
              <td style="${_TD};text-align:center">
                ${m.tipo_doc
                  ? `<span style="background:#2C5282;color:#fff;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">${escapar(m.tipo_doc)}</span>`
                  : '—'}
              </td>
              <td style="${_TD};text-align:center">
                ${score != null ? _scoreChip(score) : '<span style="color:var(--color-texto-suave)">—</span>'}
              </td>
              <td style="${_TD};text-align:center">${chipMatch}</td>
              <td style="${_TD}">
                <button title="Revertir conciliación — vuelve a PENDIENTE"
                  style="padding:4px 10px;background:rgba(197,48,48,.1);color:#C53030;
                    border:1px solid rgba(197,48,48,.3);border-radius:4px;cursor:pointer;
                    font-size:11px;font-family:var(--font)"
                  onclick="_conRevertir('${m.id}')">↩ Revertir</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Ver documentos enlazados al movimiento bancario (🔗) ─────────────
async function _verDocumentosEnlazados(movId, nroOp) {
  // Overlay de carga
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999';
  overlay.innerHTML = `<div style="background:var(--color-bg-card);border-radius:12px;padding:32px;min-width:320px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div class="spinner" style="margin:0 auto 12px"></div><div style="font-size:13px;color:var(--color-texto-suave)">Cargando enlaces…</div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Obtener movimiento actual
  const [resMov, resConcils] = await Promise.all([
    _supabase.from('tesoreria_mbd').select('*').eq('id', movId).maybeSingle(),
    _supabase.from('conciliaciones').select('*').eq('movimiento_id', movId).order('created_at', { ascending: false }),
  ]);

  const mov     = resMov.data;
  const concils = resConcils.data || [];
  // El N° de comprobante de un RH puede estar guardado como UUID: se muestra su N° legible.
  const mapaRHDet = mov ? await _conMapaNumeroRH([mov]) : new Map();

  const _fila = (lbl, val) => `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;font-size:13px;border-bottom:1px solid var(--color-borde)">
    <span style="color:var(--color-texto-suave);font-size:12px;flex-shrink:0;margin-right:16px">${lbl}</span>
    <span style="font-weight:500;text-align:right">${val}</span></div>`;

  const chipTipo = tipo => {
    const bg = tipo === 'RH' ? '#744210' : tipo === 'VENTA' ? '#276749' : '#2C5282';
    return `<span style="background:${bg};color:#fff;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">${escapar(tipo)}</span>`;
  };

  const estadoMov = mov?.entrega_doc || 'PENDIENTE';
  const estadoColor = estadoMov === 'EMITIDO' ? '#22c55e' : estadoMov === 'OBSERVADO' ? '#f59e0b' : '#ef4444';

  const concilsHtml = concils.length
    ? concils.map(c => `
      <div style="margin-top:10px;padding:10px 14px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.25);border-radius:8px;font-size:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;color:var(--color-secundario)">${chipTipo(c.doc_tipo || '—')}</span>
          ${c.score != null ? _scoreChip(c.score) : ''}
        </div>
        ${c.clasificacion_manual ? _fila('Clasificación', `<strong>${escapar(c.clasificacion_manual)}</strong>`) : ''}
        ${_fila('Tipo match', `<span style="font-family:monospace;font-size:11px">${escapar(c.tipo_match || '—')}</span>`)}
        ${_fila('Estado',     `<span style="color:${c.estado === 'APROBADO' ? '#22c55e' : '#ef4444'};font-weight:700">${escapar(c.estado || '—')}</span>`)}
        ${_fila('Fecha reg.', `${c.created_at ? formatearFecha(c.created_at.slice(0,10)) : '—'}`)}
        <div style="margin-top:8px;text-align:right">
          <button onclick="document.querySelector('[style*=fixed][style*=9999]')?.remove();_conRevertir('${movId}')"
            style="padding:4px 12px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid rgba(197,48,48,.3);border-radius:4px;cursor:pointer;font-size:11px;font-family:var(--font)">
            ↩ Revertir esta conciliación
          </button>
        </div>
      </div>`).join('')
    : `<div style="padding:20px;text-align:center;color:var(--color-texto-suave);font-size:13px">
        Sin registros de conciliación para este movimiento
       </div>`;

  overlay.innerHTML = `
    <div style="background:var(--color-bg-card);border-radius:12px;padding:0;max-width:500px;width:94%;
      box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid var(--color-borde);overflow:hidden;max-height:90vh;overflow-y:auto">

      <!-- Header -->
      <div style="background:#7147e0;padding:16px 20px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:1">
        <span style="font-size:22px">🔗</span>
        <div>
          <div style="color:#fff;font-weight:700;font-size:15px">Documentos enlazados</div>
          <div style="color:rgba(255,255,255,.75);font-size:12px;font-family:monospace">${escapar(nroOp || movId)}</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="margin-left:auto;background:rgba(255,255,255,.2);border:none;border-radius:50%;
            width:28px;height:28px;cursor:pointer;color:#fff;font-size:16px;line-height:1">✕</button>
      </div>

      <!-- Estado actual del movimiento -->
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-borde)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--color-texto-suave);margin-bottom:8px">Estado actual del movimiento</div>
        ${mov ? `
          ${_fila('N° Operación',   `<span style="font-family:monospace;font-size:11px">${escapar(mov.nro_operacion_bancaria || '—')}</span>`)}
          ${_fila('Fecha',          formatearFecha(mov.fecha_deposito))}
          ${_fila('Proveedor',      escapar(mov.proveedor_empresa_personal || '—'))}
          ${_fila('Monto',          `<strong style="color:${Number(mov.monto)<0?'var(--color-critico)':'var(--color-exito)'}">${formatearMoneda(mov.monto, mov.moneda==='USD'?'USD':'PEN')}</strong>`)}
          ${_fila('Estado doc',     `<span style="color:${estadoColor};font-weight:700">${escapar(estadoMov)}</span>`)}
          ${_fila('N° Comprobante', mov.nro_factura_doc ? `<strong style="color:var(--color-secundario)">${escapar(_conNroFacturaLegible(mov, mapaRHDet))}</strong>` : '<span style="color:var(--color-texto-suave)">Sin comprobante</span>')}
          ${mov.tipo_doc ? _fila('Tipo DOC', chipTipo(mov.tipo_doc)) : ''}
          ${mov.estado_conciliacion ? _fila('Conciliación', `<span style="color:${mov.estado_conciliacion==='conciliado'?'#22c55e':'#f59e0b'};font-weight:700">${escapar(mov.estado_conciliacion)}</span>`) : ''}
        ` : '<div style="color:var(--color-texto-suave);font-size:13px">No se encontró el movimiento</div>'}
      </div>

      <!-- Registros de conciliación -->
      <div style="padding:14px 20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--color-texto-suave);margin-bottom:4px">
          Historial de conciliación (${concils.length} registro${concils.length !== 1 ? 's' : ''})
        </div>
        ${concilsHtml}
      </div>

      <!-- Pie -->
      <div style="padding:14px 20px;border-top:1px solid var(--color-borde);display:flex;justify-content:flex-end">
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="padding:8px 20px;border:1px solid var(--color-borde);border-radius:8px;
            background:var(--color-bg-card);color:var(--color-texto);cursor:pointer;font-size:13px;font-family:var(--font)">
          Cerrar
        </button>
      </div>
    </div>`;
}

// ── Revertir una conciliación individual ────────────────────────────
async function _conRevertir(movId) {
  if (!await confirmar(
    '¿Revertir esta conciliación?\nEl movimiento volverá a estado PENDIENTE.',
    { btnOk: 'Sí, revertir', btnColor: '#C53030' }
  )) return;

  // 1. Revertir en tesoreria_mbd
  const { error: errMov } = await _supabase
    .from('tesoreria_mbd')
    .update({ entrega_doc: 'PENDIENTE', nro_factura_doc: null, tipo_doc: null })
    .eq('id', movId);

  if (errMov) { mostrarToast('Error al revertir: ' + errMov.message, 'error'); return; }

  // 2. Eliminar el registro de auditoría en conciliaciones
  await _supabase
    .from('conciliaciones')
    .delete()
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('movimiento_id', movId);

  mostrarToast('↩ Conciliación revertida — movimiento vuelve a PENDIENTE', 'exito');

  // 3. Refrescar panel + recargar historial
  await _conRefrescarPanel();
  const wrap = document.getElementById('con-tabla-wrap');
  if (wrap && _con_tab_activo === 'historial') await _renderHistorial(wrap);
}
