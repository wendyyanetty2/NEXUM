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
// ════════════════════════════════════════════════════════════════
function _dupMismoMovimiento(a, b) {
  const montoOk = Math.abs(Math.abs(Number(a.monto)||0) - Math.abs(Number(b.monto)||0)) < 0.01;
  const descA = (a.descripcion || '').trim().toLowerCase();
  const descB = (b.descripcion || '').trim().toLowerCase();
  const descOk = descA && descB && descA === descB;
  const mismoComprobante = !!(a.nro_factura_doc && b.nro_factura_doc && a.nro_factura_doc === b.nro_factura_doc);
  return montoOk && descOk && mismoComprobante;
}

async function _dupBuscarMovimientoBancario(candidato, excluirId = null) {
  let q = _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empresa_activa.id);
  if (excluirId) q = q.neq('id', excluirId);
  const { data } = await q;
  return (data || []).filter(r => _dupMismoMovimiento(r, candidato));
}

function _dupDetalleMovimientos(candidatos) {
  return candidatos.map(m =>
    `• Op. ${m.nro_operacion_bancaria || '—'} — ${formatearFecha(m.fecha_deposito)} — ${formatearMoneda(m.monto)} — ${m.entrega_doc || 'PENDIENTE'}${m.nro_factura_doc ? ` — vinculado a ${m.nro_factura_doc}` : ''}`
  ).join('\n');
}

async function _dupReporteHistoricoMovimientos() {
  mostrarToast('Buscando movimientos bancarios duplicados…', 'atencion');
  const { data } = await _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empresa_activa.id);
  const filas = data || [];

  const grupos = _dupAgruparClusters(filas, _dupMismoMovimiento);

  _dupRenderReporte(grupos.map(g => g.map(r => ({
    id: r.id,
    label: `Op. ${r.nro_operacion_bancaria || '—'} · ${(r.descripcion||'').slice(0,40)}`,
    periodo: r.fecha_deposito ? r.fecha_deposito.slice(0,7) : '', fecha: r.fecha_deposito, total: r.monto,
  }))), 'Movimientos Bancarios', 'abrirModalMBD', 'Mismo monto + misma descripción + vinculados al mismo comprobante');
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
              <div style="font-size:11px;font-weight:700;color:var(--color-texto-suave);text-transform:uppercase;margin-bottom:8px">Grupo ${i+1} — ${g.length} registros similares</div>
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
