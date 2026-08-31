/* ============================================================
   NEXUM — Detección de duplicados (punto 3.1)
   Corregido 2026-08-19 tras feedback de Wendy: el N° de factura/DOC
   que emite SUNAT es correlativo y nunca se repite legítimamente,
   así que en Compras/Ventas/RH el ÚNICO criterio de duplicado es
   ese N° de factura/DOC exacto (+ mismo proveedor/RUC). El criterio
   "mismo monto, fecha cercana" daba falsos positivos con pagos
   recurrentes legítimos (mismo proveedor, mismo monto, mes tras mes)
   y se trasladó a donde sí aplica: Tesorería → Movimientos bancarios,
   donde el riesgo real es que la MISMA fila del banco se haya
   importado o registrado dos veces.

   Importante: esto NO debe confundirse con el Estado Parcial (1.7) —
   que varios movimientos bancarios compartan el mismo N° de factura
   vinculado (regla N:M) es NORMAL cuando un comprobante se paga en
   partes; eso no es un duplicado.

   Solo LECTURA — nunca borra ni modifica nada.
   ============================================================ */

// ── Comprobantes (Compras/Ventas/RH): duplicado = mismo N° factura/DOC
//    + mismo proveedor/RUC. Sin criterio de monto/fecha. ─────────────
async function _dupBuscarCompraVenta(tabla, campoProveedor, candidato, excluirId = null) {
  let q = _supabase.from(tabla).select('*').eq('empresa_id', empresa_activa.id);
  if (excluirId) q = q.neq('id', excluirId);
  const { data } = await q;

  return (data || []).filter(r => {
    const rNDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    return candidato.nDoc && rNDoc === candidato.nDoc && r.nro_doc_identidad === candidato.docIdentidad;
  });
}

async function _dupBuscarRH(candidato, excluirId = null) {
  let q = _supabase.from('rh_registros').select('*, prestadores_servicios(nombre,dni)').eq('empresa_operadora_id', empresa_activa.id);
  if (excluirId) q = q.neq('id', excluirId);
  const { data } = await q;

  return (data || []).filter(r =>
    candidato.numeroRH && r.numero_rh === candidato.numeroRH && r.nro_doc_emisor === candidato.docIdentidad
  );
}

// ── Arma el detalle legible de cada ocurrencia previa, incluyendo
//    el movimiento bancario vinculado (si existe) y su estado ──────
async function _dupDetalleOcurrencias(candidatos, nDocKey = 'nDocCalc') {
  if (!candidatos.length) return '';
  const numeros = candidatos.map(c => c[nDocKey]).filter(Boolean);
  const { data: movs } = numeros.length
    ? await _supabase.from('tesoreria_mbd')
        .select('nro_factura_doc,nro_operacion_bancaria,monto,entrega_doc')
        .eq('empresa_id', empresa_activa.id).in('nro_factura_doc', numeros)
    : { data: [] };
  const movsPorDoc = new Map();
  (movs || []).forEach(m => {
    if (!movsPorDoc.has(m.nro_factura_doc)) movsPorDoc.set(m.nro_factura_doc, []);
    movsPorDoc.get(m.nro_factura_doc).push(m);
  });

  return candidatos.map(c => {
    const fecha = c._fecha || '—';
    const mesAnio = fecha !== '—' ? `${fecha.slice(0,7)}` : '—';
    const vinculados = movsPorDoc.get(c[nDocKey]) || [];
    const bancoTxt = vinculados.length
      ? vinculados.map(m => `Op. ${m.nro_operacion_bancaria || '—'} (${formatearMoneda(m.monto)}, ${m.entrega_doc})`).join(' · ')
      : 'sin movimiento bancario vinculado';
    return `• ${c._label} — ${mesAnio} (${fecha}) — ${formatearMoneda(c._total)} — ${bancoTxt}`;
  }).join('\n');
}

// ════════════════════════════════════════════════════════════════
// REPORTE HISTÓRICO — solo lectura, no modifica nada.
// ════════════════════════════════════════════════════════════════
function _dupAgruparClusters(filas, matchFn) {
  const usados = new Set();
  const grupos = [];
  for (let i = 0; i < filas.length; i++) {
    if (usados.has(filas[i].id)) continue;
    const grupo = [filas[i]];
    for (let j = i + 1; j < filas.length; j++) {
      if (usados.has(filas[j].id)) continue;
      if (matchFn(filas[i], filas[j])) grupo.push(filas[j]);
    }
    if (grupo.length > 1) {
      grupo.forEach(g => usados.add(g.id));
      grupos.push(grupo);
    }
  }
  return grupos;
}

async function _dupReporteHistorico(tabla, campoProveedor, tituloTipo, nombreFnAbrir) {
  mostrarToast('Buscando duplicados históricos…', 'atencion');
  const { data } = await _supabase.from(tabla).select('*').eq('empresa_id', empresa_activa.id);
  const filas = data || [];

  const grupos = _dupAgruparClusters(filas, (a, b) => {
    const nDocA = [a.serie_cdp, a.nro_cp_inicial].filter(Boolean).join('-');
    const nDocB = [b.serie_cdp, b.nro_cp_inicial].filter(Boolean).join('-');
    return nDocA === nDocB && a.nro_doc_identidad === b.nro_doc_identidad;
  });

  _dupRenderReporte(grupos.map(g => g.map(r => ({
    id: r.id,
    label: `${r.serie_cdp}-${r.nro_cp_inicial} · ${r[campoProveedor]||''}`,
    periodo: r.periodo, fecha: r.fecha_emision, total: r.total_cp,
  }))), tituloTipo, nombreFnAbrir, 'N° de factura/DOC exacto + mismo proveedor/RUC');
}

async function _dupReporteHistoricoRH() {
  mostrarToast('Buscando RH duplicados históricos…', 'atencion');
  const { data } = await _supabase.from('rh_registros').select('*').eq('empresa_operadora_id', empresa_activa.id);
  const filas = data || [];

  const grupos = _dupAgruparClusters(filas, (a, b) =>
    a.numero_rh === b.numero_rh && a.nro_doc_emisor === b.nro_doc_emisor
  );

  _dupRenderReporte(grupos.map(g => g.map(r => ({
    id: r.id,
    label: `${r.numero_rh} · ${r.nombre_emisor||''}`,
    periodo: r.periodo, fecha: r.fecha_emision, total: r.monto_neto,
  }))), 'RH Recibidos', 'abrirModalRHR', 'N° de RH exacto + mismo emisor');
}

// ════════════════════════════════════════════════════════════════
// TESORERÍA → MOVIMIENTOS BANCARIOS (tesoreria_mbd)
// Aquí SÍ aplica monto + descripción — sin ventana de fecha, porque
// una fila duplicada puede reimportarse en cualquier momento, y el
// N° de operación bancaria puede venir vacío o distinto en la copia
// duplicada, así que no es un criterio confiable por sí solo.
//
// Corregido 2026-08-19 (feedback Wendy, 109 falsos positivos): la
// "descripcion" del banco suele ser solo el TIPO de transacción
// (ej. "IMPUESTO ITF", "TRAN.CTAS.TERC.BM", "COM.MANTENIM") — no un
// identificador único, y se repite todos los meses por cargos
// recurrentes legítimos (comisiones, ITF, mantenimiento de tarjeta).
// Por eso ahora TAMBIÉN se exige que ambos movimientos estén
// vinculados al MISMO comprobante (nro_factura_doc). Si no hay
// comprobante vinculado en alguno de los dos, o están vinculados a
// comprobantes distintos, no se considera duplicado.
//
// Corregido 2026-08-31 (feedback Wendy, 42 falsos positivos): el
// banco exporta "00000000" (u otro valor de puros ceros) como
// nro_factura_doc/N° operación para cargos como ITF y comisiones —
// no es un comprobante real, así que ya NO cuenta como "mismo
// comprobante" solo por coincidir ese placeholder. Para esos casos
// (descripción dentro del catálogo por empresa "conceptos_recurrentes_
// bancarios") se exige en cambio que ambos movimientos caigan en la
// MISMA fecha exacta para considerarse sospechosos de duplicado real.
// ════════════════════════════════════════════════════════════════
function _esComprobantePlaceholder(v) {
  if (!v) return true;
  const t = String(v).trim();
  return !t || /^0+$/.test(t);
}

async function _dupCargarConceptosRecurrentes() {
  const { data } = await _supabase.from('conceptos_recurrentes_bancarios')
    .select('nombre').eq('empresa_operadora_id', empresa_activa.id).eq('activo', true);
  return new Set((data || []).map(c => c.nombre.trim().toLowerCase()));
}

// Devuelve la razón del posible duplicado ('comprobante' | 'recurrente') o null si no aplica.
function _dupRazonMovimiento(a, b, conceptosRecurrentes) {
  const montoOk = Math.abs(Math.abs(Number(a.monto)||0) - Math.abs(Number(b.monto)||0)) < 0.01;
  if (!montoOk) return null;
  const descA = (a.descripcion || '').trim().toLowerCase();
  const descB = (b.descripcion || '').trim().toLowerCase();
  if (!descA || descA !== descB) return null;

  const compA = _esComprobantePlaceholder(a.nro_factura_doc) ? null : String(a.nro_factura_doc).trim();
  const compB = _esComprobantePlaceholder(b.nro_factura_doc) ? null : String(b.nro_factura_doc).trim();
  if (compA && compB && compA === compB) return 'comprobante';

  if (conceptosRecurrentes && conceptosRecurrentes.has(descA)) {
    const fechaA = (a.fecha_deposito || '').slice(0, 10);
    const fechaB = (b.fecha_deposito || '').slice(0, 10);
    if (fechaA && fechaA === fechaB) return 'recurrente';
  }
  return null;
}

function _dupMismoMovimiento(a, b, conceptosRecurrentes) {
  return !!_dupRazonMovimiento(a, b, conceptosRecurrentes);
}

async function _dupBuscarMovimientoBancario(candidato, excluirId = null) {
  const conceptosRecurrentes = await _dupCargarConceptosRecurrentes();
  let q = _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empresa_activa.id);
  if (excluirId) q = q.neq('id', excluirId);
  const { data } = await q;
  return (data || []).filter(r => _dupMismoMovimiento(r, candidato, conceptosRecurrentes));
}

function _dupDetalleMovimientos(candidatos) {
  return candidatos.map(m =>
    `• Op. ${m.nro_operacion_bancaria || '—'} — ${formatearFecha(m.fecha_deposito)} — ${formatearMoneda(m.monto)} — ${m.entrega_doc || 'PENDIENTE'}${m.nro_factura_doc ? ` — vinculado a ${m.nro_factura_doc}` : ''}`
  ).join('\n');
}

const _DUP_CRITERIO_LABEL = {
  comprobante: 'Comprobante real idéntico',
  recurrente:  'Concepto recurrente — misma fecha',
};

async function _dupReporteHistoricoMovimientos() {
  mostrarToast('Buscando movimientos bancarios duplicados…', 'atencion');
  const [{ data }, conceptosRecurrentes] = await Promise.all([
    _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empresa_activa.id),
    _dupCargarConceptosRecurrentes(),
  ]);
  const filas = data || [];

  const grupos = _dupAgruparClusters(filas, (a, b) => _dupMismoMovimiento(a, b, conceptosRecurrentes));

  _dupRenderReporte(grupos.map(g => {
    const anchor = g[0];
    const razones = new Set(g.slice(1).map(m => _dupRazonMovimiento(anchor, m, conceptosRecurrentes)));
    const criterio = razones.size === 1 ? _DUP_CRITERIO_LABEL[[...razones][0]] : 'Mixto (revisar)';
    return g.map(r => ({
      id: r.id,
      label: `Op. ${r.nro_operacion_bancaria || '—'} · ${(r.descripcion||'').slice(0,40)}`,
      periodo: r.fecha_deposito ? r.fecha_deposito.slice(0,7) : '', fecha: r.fecha_deposito, total: r.monto,
      criterio,
    }));
  }), 'Movimientos Bancarios', 'abrirModalMBD', 'Comprobante real idéntico, o concepto recurrente (catálogo por empresa) con la misma fecha exacta');
}

function _dupRenderReporte(grupos, tituloTipo, nombreFnAbrir, criterioTxt) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;
  if (!grupos.length) {
    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
        <div class="modal" style="max-width:460px;width:95%;padding:28px;text-align:center">
          <div style="font-size:36px;margin-bottom:10px">✅</div>
          <p style="color:var(--color-texto)">No se encontraron ${tituloTipo.toLowerCase()} duplicados con el criterio actual (${criterioTxt || ''}).</p>
          <button class="btn btn-secundario" style="margin-top:16px" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>`;
    return;
  }
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:700px;width:95%;max-height:88vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>⚠️ Posibles ${tituloTipo} duplicados — ${grupos.length} grupo(s)</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px">
            Solo lectura — nada se modifica automáticamente. Criterio: ${criterioTxt || ''}. Revisa cada grupo y decide manualmente.
          </p>
          ${grupos.map((g, i) => `
            <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div style="font-size:11px;font-weight:700;color:var(--color-texto-suave);text-transform:uppercase;margin-bottom:8px">
                Grupo ${i+1} — ${g.length} registros similares${g[0].criterio ? ` · <span style="color:var(--color-secundario)">${escapar(g[0].criterio)}</span>` : ''}
              </div>
              ${g.map(r => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--color-borde);font-size:12px">
                  <span>${escapar(r.label)} — ${escapar(r.periodo||'')} (${formatearFecha(r.fecha)})</span>
                  <span style="display:flex;align-items:center;gap:10px">
                    <strong>${formatearMoneda(r.total)}</strong>
                    <button onclick="document.querySelector('.modal-overlay').remove();${nombreFnAbrir}('${r.id}')"
                      style="padding:3px 10px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Ver</button>
                  </span>
                </div>`).join('')}
            </div>`).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}
