/* ============================================================
   NEXUM — Detección de comprobantes duplicados (Compras/Ventas/RH)
   Punto 3.1. Criterio aprobado por Wendy 2026-08-19:
     N° de factura/DOC  O  (Proveedor + Monto + fecha ≤5 días)
   Solo LECTURA — nunca borra ni modifica nada. La alerta hacia
   adelante se dispara al guardar un comprobante NUEVO; el reporte
   histórico es un escaneo aparte, bajo demanda.
   ============================================================ */

const _DUP_TOL_DIAS = 5;

function _dupFechaCercana(f1, f2) {
  if (!f1 || !f2) return false;
  const dias = Math.abs(new Date(f1) - new Date(f2)) / 86400000;
  return dias <= _DUP_TOL_DIAS;
}

// ── Busca posibles duplicados de un comprobante (Compras/Ventas) ──
// candidato: { nDoc, docIdentidad, proveedor, total, fecha }
// tabla: 'contabilidad_compras' | 'contabilidad_ventas'
// campoProveedor: 'proveedor' | 'cliente'
async function _dupBuscarCompraVenta(tabla, campoProveedor, candidato, excluirId = null) {
  let q = _supabase.from(tabla).select('*').eq('empresa_id', empresa_activa.id);
  if (excluirId) q = q.neq('id', excluirId);
  const { data } = await q;

  return (data || []).filter(r => {
    const rNDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    const mismoDoc = candidato.nDoc && rNDoc === candidato.nDoc && r.nro_doc_identidad === candidato.docIdentidad;
    const mismoMontoProveedor =
      Math.abs(Number(r.total_cp || 0) - Number(candidato.total || 0)) < 0.01 &&
      (r[campoProveedor] || '').trim().toLowerCase() === (candidato.proveedor || '').trim().toLowerCase() &&
      _dupFechaCercana(r.fecha_emision, candidato.fecha);
    return mismoDoc || mismoMontoProveedor;
  });
}

// ── Busca posibles duplicados de un RH ─────────────────────────────
async function _dupBuscarRH(candidato, excluirId = null) {
  let q = _supabase.from('rh_registros').select('*, prestadores_servicios(nombre,dni)').eq('empresa_operadora_id', empresa_activa.id);
  if (excluirId) q = q.neq('id', excluirId);
  const { data } = await q;

  return (data || []).filter(r => {
    const mismoNumero = candidato.numeroRH && r.numero_rh === candidato.numeroRH && r.nro_doc_emisor === candidato.docIdentidad;
    const mismoMontoEmisor =
      Math.abs(Number(r.monto_neto || 0) - Number(candidato.total || 0)) < 0.01 &&
      (r.nombre_emisor || '').trim().toLowerCase() === (candidato.proveedor || '').trim().toLowerCase() &&
      _dupFechaCercana(r.fecha_emision, candidato.fecha);
    return mismoNumero || mismoMontoEmisor;
  });
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
// REPORTE HISTÓRICO DE DUPLICADOS — solo lectura, no modifica nada.
// Agrupa comprobantes ya existentes que cumplen el criterio de
// duplicado entre sí (regla aprobada 2026-08-19).
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
    const mismoDoc = nDocA === nDocB && a.nro_doc_identidad === b.nro_doc_identidad;
    const mismoMontoProveedor =
      Math.abs(Number(a.total_cp||0) - Number(b.total_cp||0)) < 0.01 &&
      (a[campoProveedor]||'').trim().toLowerCase() === (b[campoProveedor]||'').trim().toLowerCase() &&
      _dupFechaCercana(a.fecha_emision, b.fecha_emision);
    return mismoDoc || mismoMontoProveedor;
  });

  _dupRenderReporte(grupos.map(g => g.map(r => ({
    id: r.id,
    label: `${r.serie_cdp}-${r.nro_cp_inicial} · ${r[campoProveedor]||''}`,
    periodo: r.periodo, fecha: r.fecha_emision, total: r.total_cp,
  }))), tituloTipo, nombreFnAbrir);
}

async function _dupReporteHistoricoRH() {
  mostrarToast('Buscando RH duplicados históricos…', 'atencion');
  const { data } = await _supabase.from('rh_registros').select('*').eq('empresa_operadora_id', empresa_activa.id);
  const filas = data || [];

  const grupos = _dupAgruparClusters(filas, (a, b) => {
    const mismoNumero = a.numero_rh === b.numero_rh && a.nro_doc_emisor === b.nro_doc_emisor;
    const mismoMontoEmisor =
      Math.abs(Number(a.monto_neto||0) - Number(b.monto_neto||0)) < 0.01 &&
      (a.nombre_emisor||'').trim().toLowerCase() === (b.nombre_emisor||'').trim().toLowerCase() &&
      _dupFechaCercana(a.fecha_emision, b.fecha_emision);
    return mismoNumero || mismoMontoEmisor;
  });

  _dupRenderReporte(grupos.map(g => g.map(r => ({
    id: r.id,
    label: `${r.numero_rh} · ${r.nombre_emisor||''}`,
    periodo: r.periodo, fecha: r.fecha_emision, total: r.monto_neto,
  }))), 'RH Recibidos', 'abrirModalRHR');
}

function _dupRenderReporte(grupos, tituloTipo, nombreFnAbrir) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;
  if (!grupos.length) {
    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
        <div class="modal" style="max-width:460px;width:95%;padding:28px;text-align:center">
          <div style="font-size:36px;margin-bottom:10px">✅</div>
          <p style="color:var(--color-texto)">No se encontraron ${tituloTipo.toLowerCase()} duplicados con el criterio actual (N° factura/DOC, o Proveedor + Monto + fecha ≤5 días).</p>
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
            Solo lectura — nada se modifica automáticamente. Revisa cada grupo y decide manualmente si corresponde eliminar o corregir alguno.
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
