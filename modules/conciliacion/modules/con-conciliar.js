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
            <div style="padding:10px 14px;background:#16a34a;border-radius:8px;color:#fff">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.85">✅ Emitidos</div>
              <div id="pan-emit-n" style="font-size:22px;font-weight:700">0</div>
              <div id="pan-emit-s" style="font-size:11px;opacity:.8"></div>
            </div>
            <div style="padding:10px 14px;background:#b45309;border-radius:8px;color:#fff">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.85">⚠️ Observados</div>
              <div id="pan-obs-n"  style="font-size:22px;font-weight:700">0</div>
              <div id="pan-obs-s"  style="font-size:11px;opacity:.8"></div>
            </div>
            <div style="padding:10px 14px;background:#dc2626;border-radius:8px;color:#fff">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.85">🔴 Pendientes</div>
              <div id="pan-pend-n" style="font-size:22px;font-weight:700">0</div>
              <div id="pan-pend-s" style="font-size:11px;opacity:.8"></div>
            </div>
            <div style="padding:10px 14px;background:var(--color-primario);border-radius:8px;color:#fff">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.85">📋 Total</div>
              <div id="pan-total-n" style="font-size:22px;font-weight:700">0</div>
              <div id="pan-total-s" style="font-size:11px;opacity:.8"></div>
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
      .from('registro_compras')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .in('periodo', periodosDoc),

    _supabase
      .from('registro_ventas')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .in('periodo', periodosDoc),

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
          va = a.esMulti ? (a.sumaMovs||0) : Math.abs(parseFloat(a.mov?.monto)||0);
          vb = b.esMulti ? (b.sumaMovs||0) : Math.abs(parseFloat(b.mov?.monto)||0); break;
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
    fecha_actualizacion:  hoy,
  };
  if (itemLocal?.doc?._proveedor && !itemLocal?.mov?.proveedor_empresa_personal)
    updateMov.proveedor_empresa_personal = itemLocal.doc._proveedor;
  if (itemLocal?.doc?._ruc && !itemLocal?.mov?.ruc_dni)
    updateMov.ruc_dni = itemLocal.doc._ruc;

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
      fecha_actualizacion:  hoy,
    };
    if (d._proveedor && !m.proveedor_empresa_personal)
      updateMov.proveedor_empresa_personal = d._proveedor;
    if (d._ruc && !m.ruc_dni)
      updateMov.ruc_dni = d._ruc;

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
      fecha_actualizacion:  hoy,
    };
    if (item.doc._proveedor && !item.mov.proveedor_empresa_personal)
      updLote.proveedor_empresa_personal = item.doc._proveedor;
    if (item.doc._ruc && !item.mov.ruc_dni)
      updLote.ruc_dni = item.doc._ruc;
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
  // Construir ventana de 9 meses para búsqueda manual también
  const periodosVentana = periodo ? _conPeriodosAdyacentes(periodo) : [periodo];
  const [resC, resV, resR] = await Promise.all([
    _supabase.from('registro_compras').select('*').eq('empresa_operadora_id', empresa_activa.id).in('periodo', periodosVentana),
    _supabase.from('registro_ventas').select('*').eq('empresa_operadora_id', empresa_activa.id).in('periodo', periodosVentana),
    _supabase.from('rh_registros').select('*, prestadores_servicios(nombre, dni)').eq('empresa_operadora_id', empresa_activa.id).in('periodo', periodosVentana),
  ]);

  const todos = [
    ...(resC.data||[]).map(d=>({ ...d, _tipo:'COMPRA', _ndoc:[d.serie,d.numero].filter(Boolean).join('-')||d.id?.slice(0,8), _prov: d.nombre_proveedor||'', _total: d.total||0 })),
    ...(resV.data||[]).map(d=>({ ...d, _tipo:'VENTA',  _ndoc:[d.serie,d.numero].filter(Boolean).join('-')||d.id?.slice(0,8), _prov: d.nombre_cliente||d.razon_social||'', _total: d.total||0 })),
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
  // Buscar el documento en los resultados para obtener su número legible
  const todos = [..._con_resultados.exactos, ..._con_resultados.posibles, ..._con_resultados.sin_match];
  const itemDoc = todos.find(i => i.doc?.id === docId);
  const nroDoc  = itemDoc?.doc?._ndoc || null;

  const { error } = await _supabase.from('tesoreria_mbd')
    .update({
      entrega_doc:     'EMITIDO',
      nro_factura_doc: nroDoc,
      tipo_doc:        docTipo,
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
    .select('entrega_doc, monto, nro_factura_doc')
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

  // 4. Comprobantes duplicados
  if (emitN >= 2) {
    const conteo = {};
    filas.filter(r => r.entrega_doc === 'EMITIDO' && r.nro_factura_doc)
         .forEach(r => { conteo[r.nro_factura_doc] = (conteo[r.nro_factura_doc] || 0) + 1; });
    const dups = Object.entries(conteo).filter(([, c]) => c > 1).map(([n]) => n);
    if (dups.length) {
      chips.push({ solid: '#7c3aed',
        msg: `❌ Duplicados: ${dups.slice(0, 3).join(', ')}${dups.length > 3 ? '…' : ''}` });
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

  const cab = [
    'N° Operación','Fecha Depósito','Descripción','Moneda','Monto',
    'Proveedor / Empresa / Personal','RUC/DNI','Estado','N° Comprobante','Tipo DOC',
  ];
  const filas = data.map(m => [
    m.nro_operacion_bancaria || '',
    m.fecha_deposito         || '',
    m.descripcion            || '',
    m.moneda                 || 'PEN',
    m.monto,
    m.proveedor_empresa_personal || '',
    m.ruc_dni                || '',
    m.entrega_doc            || '',
    m.nro_factura_doc        || '',
    m.tipo_doc               || '',
  ]);

  // Resumen al final
  const grupos = {};
  data.forEach(m => { const e = m.entrega_doc || 'PENDIENTE'; grupos[e] = (grupos[e] || 0) + 1; });
  filas.push([], ['RESUMEN']);
  Object.entries(grupos).forEach(([k, v]) => filas.push([k, v]));
  filas.push(['TOTAL', data.length]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  ws['!cols'] = [14,14,30,8,14,30,14,12,16,12].map(w => ({ wch: w }));
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
              <td style="${_TD};font-weight:600;color:var(--color-secundario);white-space:nowrap">${escapar(m.nro_factura_doc || '—')}</td>
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
          ${_fila('N° Comprobante', mov.nro_factura_doc ? `<strong style="color:var(--color-secundario)">${escapar(mov.nro_factura_doc)}</strong>` : '<span style="color:var(--color-texto-suave)">Sin comprobante</span>')}
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
