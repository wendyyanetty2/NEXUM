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

/* ============================================================
   DESCUADRES DE VINCULACIÓN — Compras/Ventas/RH vs Tesorería MBD
   (pedido por Wendy, 2026-09-17): un comprobante puede pagarse con
   varios movimientos bancarios (regla N:M, ver _conCobertura), pero
   si la SUMA de los movimientos vinculados a un mismo N° de
   comprobante supera su total en más del margen normal (5% o S/5
   mínimo — el mismo que usa la búsqueda de candidatos 🔗/🔍), casi
   siempre es porque un movimiento de OTRO comprobante quedó
   enganchado por error (mismo N° tecleado o elegido por error en la
   búsqueda manual). La clave es el N° de comprobante + tipo_doc —
   NO el nombre del proveedor, porque puede venir escrito distinto
   entre el banco y el comprobante (Wendy: "la clave está en el
   número de comprobante"). SÍ se usa el RUC como desempate (Wendy,
   2026-09-18): dos proveedores distintos pueden compartir serie-número
   (ej. dos Compras "E001-40" de RUCs distintos) — si ambos lados
   (comprobante y movimiento bancario) tienen RUC y son distintos, ese
   movimiento no se cuenta para ese comprobante. Si falta el RUC en
   cualquiera de los dos lados, nunca bloquea — el banco no siempre
   trae RUC. Cubre Compras, Ventas y RH.
   Solo lectura — no modifica ni desvincula nada automáticamente.
   ============================================================ */
function _dupClaveDoc(r) { return [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-'); }

async function _dupDescuadresVinculacion() {
  mostrarToast('Buscando descuadres de vinculación…', 'atencion');
  const empId = empresa_activa.id;

  const [{ data: compras }, { data: ventas }, { data: rh }, { data: movs }] = await Promise.all([
    _supabase.from('contabilidad_compras').select('id,serie_cdp,nro_cp_inicial,proveedor,nro_doc_identidad,total_cp').eq('empresa_id', empId),
    _supabase.from('contabilidad_ventas').select('id,serie_cdp,nro_cp_inicial,cliente,nro_doc_identidad,total_cp').eq('empresa_id', empId),
    _supabase.from('rh_registros').select('id,numero_rh,monto_neto,prestadores_servicios(nombre,dni)').eq('empresa_operadora_id', empId),
    _supabase.from('tesoreria_mbd').select('id,nro_operacion_bancaria,fecha_deposito,monto,tipo_doc,nro_factura_doc,proveedor_empresa_personal,ruc_dni,entrega_doc')
      .eq('empresa_id', empId).not('nro_factura_doc', 'is', null).in('tipo_doc', ['COMPRA', 'VENTA', 'RH']),
  ]);

  // RUC normalizado (solo dígitos) para descartar cruces falsos: dos proveedores
  // distintos pueden emitir la misma serie-número (ej. dos Compras "E001-40" de
  // RUCs distintos) — el tipo_doc ya separa RH de Factura, esto separa además por
  // emisor. Si falta el RUC en cualquiera de los dos lados NO se descarta el match
  // (el banco no siempre trae RUC) — solo se descarta cuando AMBOS lo tienen y son
  // distintos (pedido de Wendy, 2026-09-18, confirmado: RUC nunca bloquea, solo
  // desempata cuando hay dato en ambos lados).
  const _rucNorm = v => (v || '').toString().replace(/\D/g, '');
  const _rucCompatible = (a, b) => {
    const na = _rucNorm(a), nb = _rucNorm(b);
    if (!na || !nb) return true;
    return na === nb;
  };

  const movsPorClave = new Map(); // _conClaveDoc(tipo_doc, nro_factura_doc) → [movs]
  (movs || []).forEach(m => {
    if (_esComprobantePlaceholder(m.nro_factura_doc)) return;
    const k = _conClaveDoc(m.tipo_doc, m.nro_factura_doc);
    if (!movsPorClave.has(k)) movsPorClave.set(k, []);
    movsPorClave.get(k).push(m);
  });

  const descuadres = [];
  // Misma tolerancia que el badge EXCESIVO y el bloqueo al vincular (_conCobertura,
  // 0.01) — no una tercera regla distinta para "¿esto es un exceso?" (auditoría 2026-09-18).
  // mostrarFn: qué N° mostrar en el reporte — puede ser distinto de claveFn (que sirve
  // solo para EMPAREJAR contra tesoreria_mbd). Nunca se muestra un UUID crudo en pantalla
  // (fix 2026-09-18: RH mostraba el UUID interno en vez de "E001-23" en este reporte).
  const evaluar = (comprobantes, tipoDoc, claveFn, labelFn, totalFn, mostrarFn, rucFn) => {
    (comprobantes || []).forEach(c => {
      const clave = claveFn(c);
      if (!clave) return;
      const rucDoc = rucFn ? rucFn(c) : '';
      const lista = (movsPorClave.get(_conClaveDoc(tipoDoc, clave)) || [])
        .filter(m => _rucCompatible(rucDoc, m.ruc_dni));
      if (!lista.length) return;
      const total = totalFn(c);
      if (!total) return;
      const cov = _conCobertura(lista, total);
      if (cov.estado === 'PARCIAL' && cov.excede) {
        descuadres.push({ tipoDoc, nDoc: (mostrarFn ? mostrarFn(c) : clave), label: labelFn(c), total, suma: cov.suma, exceso: cov.excede, movs: lista });
      }
    });
  };

  evaluar(compras, 'COMPRA', _dupClaveDoc, c => c.proveedor || '—', c => Number(c.total_cp) || 0, null, c => c.nro_doc_identidad);
  evaluar(ventas,  'VENTA',  _dupClaveDoc, c => c.cliente   || '—', c => Number(c.total_cp) || 0, null, c => c.nro_doc_identidad);
  // RH: nro_factura_doc puede ser el UUID (vínculo manual 🔍/📂) o el N° de RH legible
  // (carga por Excel/Importar MBD) — se evalúan ambas claves, igual criterio que _bmCargarLinks.
  // En pantalla SIEMPRE se muestra el N° de RH legible (nunca el UUID), igual que en el
  // resto del sistema (tes-movimientos.js, historico.js, con-conciliar.js).
  const _rhMostrar = c => c.numero_rh || `RH sin N° · ${(c.id || '').slice(0, 8)}`;
  const _rhRuc = c => c.prestadores_servicios?.dni;
  evaluar(rh, 'RH', c => c.id,        c => c.prestadores_servicios?.nombre || '—', c => Number(c.monto_neto) || 0, _rhMostrar, _rhRuc);
  evaluar(rh, 'RH', c => c.numero_rh, c => c.prestadores_servicios?.nombre || '—', c => Number(c.monto_neto) || 0, _rhMostrar, _rhRuc);

  // Un mismo RH puede calzar por las dos claves a la vez — no listarlo dos veces.
  const vistos = new Set();
  const descuadresUnicos = descuadres.filter(d => {
    const k = `${d.tipoDoc}|${d.nDoc}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  _dupRenderDescuadres(descuadresUnicos);
}

function _dupRenderDescuadres(descuadres) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;
  const tipoLabel = { COMPRA: '🛒 Compra', VENTA: '📄 Venta', RH: '🧾 RH' };

  if (!descuadres.length) {
    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
        <div class="modal" style="max-width:460px;width:95%;padding:28px;text-align:center">
          <div style="font-size:36px;margin-bottom:10px">✅</div>
          <p style="color:var(--color-texto)">No se encontraron comprobantes (Compras/Ventas/RH) cuyos movimientos bancarios vinculados sumen más del total permitido.</p>
          <button class="btn btn-secundario" style="margin-top:16px" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>`;
    return;
  }

  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:720px;width:95%;max-height:88vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>⚖️ Descuadres de vinculación — ${descuadres.length} comprobante(s)</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px">
            Solo lectura — nada se modifica automáticamente. Comprobantes (Compras/Ventas/RH) cuyos movimientos bancarios vinculados
            (agrupados por N° de comprobante) suman más de lo que corresponde — casi siempre porque un movimiento de otro comprobante
            quedó enganchado por error. Revisa cada grupo y desvincula el que sobra desde su modal de edición (✏️).
          </p>
          ${descuadres.map(d => `
            <div style="border:1px solid #C53030;border-radius:8px;padding:12px 14px;margin-bottom:10px;background:rgba(197,48,48,.04)">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px">
                <div><span style="font-weight:700">${tipoLabel[d.tipoDoc]||d.tipoDoc}</span> — <strong style="color:var(--color-secundario)">${escapar(d.nDoc)}</strong> · ${escapar(d.label)}</div>
                <div style="font-weight:700;color:#C53030">Exceso: ${formatearMoneda(d.exceso)}</div>
              </div>
              <div style="font-size:12px;color:var(--color-texto-suave);margin-bottom:8px">
                Total del comprobante: ${formatearMoneda(d.total)} · Suma vinculada: ${formatearMoneda(d.suma)} (${d.movs.length} movimiento(s))
              </div>
              ${d.movs.map(m => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--color-borde);font-size:12px">
                  <span>Op. ${escapar(m.nro_operacion_bancaria||'—')} · ${formatearFecha(m.fecha_deposito)} · ${escapar(m.proveedor_empresa_personal||'—')} · ${escapar(m.entrega_doc||'')}</span>
                  <span style="display:flex;align-items:center;gap:10px">
                    <strong>${formatearMoneda(m.monto)}</strong>
                    ${typeof abrirModalMovimiento === 'function'
                      ? `<button onclick="document.querySelector('.modal-overlay').remove();abrirModalMovimiento('${m.id}')"
                          style="padding:3px 10px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">✏️ Ver/editar</button>`
                      : `<button onclick="navigator.clipboard.writeText('${escapar(m.nro_operacion_bancaria||'')}').then(()=>mostrarToast('N° de operación copiado','exito'))"
                          style="padding:3px 10px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px" title="Cópialo y búscalo en Tesorería → Movimientos para editar o desvincular">📋 Copiar N° op.</button>`}
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

/* ============================================================
   Motor de coincidencia MBD ↔ EECC (punto 6, acordado con Wendy)

   Al importar por "Importar MBD" (últimos 20 movimientos) o por
   "Importar EECC" (cierre del mes completo), ambos deben terminar
   en el mismo registro de tesoreria_mbd sin duplicarse — aunque el
   N° de operación venga con los 2 primeros dígitos distintos entre
   fuentes (ej. 04597853 en MBD vs 00597853 en EECC, mismo movimiento
   real). No reemplaza a _dupRazonMovimiento (que es para "🔍 Buscar
   duplicados" dentro de Movimientos ya cargados) — este es el
   criterio para decidir, AL MOMENTO DE IMPORTAR, si una fila del
   Excel ya existe, es nueva, o es dudosa y hay que revisarla a mano.
   ============================================================ */

// Últimos 6 dígitos del N° de operación, o null si es un placeholder
// (vacío o solo ceros) que no sirve como clave de coincidencia.
function _dupUltimos6(numOp) {
  const s = (numOp || '').toString().trim();
  if (!s || /^0+$/.test(s)) return null;
  return s.slice(-6);
}

// Diferencia en días calendario entre dos fechas "YYYY-MM-DD" (Infinity si
// falta alguna). MBD y EECC pueden registrar la misma operación con fechas
// distintas (fecha de proceso del banco vs. fecha en que se cargó a mano) —
// Wendy confirmó (2026-09-12) tolerar hasta 3 días sin que eso impida
// reconocer que es la misma operación cuando el N° de operación sí coincide.
function _dupDiasEntre(f1, f2) {
  if (!f1 || !f2) return Infinity;
  const d1 = new Date(f1 + 'T00:00:00'), d2 = new Date(f2 + 'T00:00:00');
  if (isNaN(d1) || isNaN(d2)) return Infinity;
  return Math.abs((d1 - d2) / 86400000);
}
const _DUP_TOLERANCIA_DIAS = 3;

// Clasifica una fila candidata (de un Excel recién leído) contra los
// movimientos ya existentes en tesoreria_mbd para esa empresa.
// candidato: { fecha, descripcion, moneda, monto, numero_operacion }
// existentes: filas de tesoreria_mbd (fecha_deposito, descripcion, moneda, monto, nro_operacion_bancaria, nro_operacion_alt, ...)
// Devuelve { estado: 'ya_existe'|'posible'|'nuevo', match: fila existente o null, razon }
function _dupClasificarMovimiento(candidato, existentes, conceptosRecurrentes) {
  const clave6Cand = _dupUltimos6(candidato.numero_operacion);
  const fechaCand  = (candidato.fecha || '').slice(0, 10);
  const montoCand  = Math.abs(Number(candidato.monto) || 0);
  const monedaCand = (candidato.moneda || 'PEN').toUpperCase().replace('S/.', 'PEN').replace('S/', 'PEN');
  const descCand   = (candidato.descripcion || '').trim().toLowerCase();

  let mejorPosible = null;

  for (const ex of (existentes || [])) {
    const clave6Ex = _dupUltimos6(ex.nro_operacion_bancaria) || _dupUltimos6(ex.nro_operacion_alt);
    const fechaEx  = (ex.fecha_deposito || '').slice(0, 10);
    const montoEx  = Math.abs(Number(ex.monto) || 0);
    const monedaEx = (ex.moneda || 'PEN').toUpperCase().replace('S/.', 'PEN').replace('S/', 'PEN');
    const descEx   = (ex.descripcion || '').trim().toLowerCase();

    const montoOk    = Math.abs(montoCand - montoEx) < 0.01;
    const monedaOk   = monedaCand === monedaEx;
    const fechaOk    = fechaCand === fechaEx;
    const diasFecha  = _dupDiasEntre(fechaCand, fechaEx);
    const fechaCerca = diasFecha <= _DUP_TOLERANCIA_DIAS;
    const descOk     = !!descCand && descCand === descEx;

    const ambosConfiables = !!clave6Cand && !!clave6Ex;

    if (ambosConfiables) {
      if (clave6Cand === clave6Ex) {
        // Núcleo de identificación: N° de operación (últimos 6) + descripción +
        // moneda + monto. La fecha es un validador adicional, no bloqueante —
        // MBD y EECC pueden registrar la misma operación con fechas distintas
        // (±3 días tolerados) sin que eso impida reconocerla como la misma.
        if (montoOk && monedaOk && descOk && fechaCerca) {
          const fechaTxt = fechaOk ? '' : ' (con unos días de diferencia en la fecha)';
          return { estado: 'ya_existe', match: ex, razon: `Mismo N° de operación, monto y descripción — ya está registrado${fechaTxt}.` };
        }
        // El N° de operación coincide pero algo más no cuadra (o la fecha se
        // aleja más de lo tolerado) — no se descarta sola, pero tampoco se da
        // por buena automáticamente: a revisar.
        mejorPosible = { estado: 'posible', match: ex, razon: 'El N° de operación coincide, pero el monto, la moneda o la descripción no calzan del todo — revisa antes de decidir.' };
        continue;
      }
      // Ambos lados tienen N° de operación confiable, pero DISTINTO: son
      // operaciones diferentes aunque coincidan monto/fecha/descripción
      // (ej. dos transferencias iguales el mismo día con distinto N° de
      // operación). Wendy 2026-09-15: el N° de operación es la clave única
      // de cada movimiento — nunca tratar como duplicado (ni "posible") solo
      // porque monto/fecha/descripción coincidan si el N° de operación difiere.
      continue;
    }

    // Sin N° de operación confiable en alguno de los dos lados (ej. "00000000"
    // de ITF/comisiones): mismo criterio que ya usa el sistema para esos casos.
    if (montoOk && monedaOk && descOk) {
      if (fechaOk) {
        if (conceptosRecurrentes?.has(descCand)) {
          return { estado: 'ya_existe', match: ex, razon: 'Es un concepto recurrente conocido (comisión, ITF, etc.) en la misma fecha — ya está registrado.' };
        }
        return { estado: 'ya_existe', match: ex, razon: 'Mismo monto, descripción y fecha — ya está registrado.' };
      }
      // Fecha distinta: si es un concepto recurrente conocido (ITF, comisiones,
      // transferencias entre cuentas de terceros, etc.) NO se marca como dudoso
      // — es normal que se repita mes a mes con el mismo monto y descripción,
      // así que una fecha distinta significa que es el cargo de OTRO mes, no un
      // duplicado. Wendy lo señaló (2026-09-12): el sistema comparaba filas de
      // setiembre contra julio solo por coincidir monto+descripción genérica.
      if (conceptosRecurrentes?.has(descCand)) continue;
      if (!mejorPosible) mejorPosible = { estado: 'posible', match: ex, razon: 'El monto y la descripción coinciden, pero la fecha es distinta — revisa antes de decidir.' };
    }
  }

  return mejorPosible || { estado: 'nuevo', match: null, razon: '' };
}

// Clasifica un lote completo de filas leídas de un Excel (MBD o EECC) contra
// lo ya existente en tesoreria_mbd para la empresa activa. Trae "existentes"
// una sola vez (±2 meses alrededor de las fechas del lote, no toda la
// historia) para no sobrecargar la consulta en empresas con mucho volumen.
async function _dupClasificarLoteMovimientos(filas) {
  const conceptosRecurrentes = await _dupCargarConceptosRecurrentes();

  const fechas = filas.map(f => f.fecha).filter(Boolean).sort();
  let desde = fechas[0], hasta = fechas[fechas.length - 1];
  if (desde) { const d = new Date(desde + 'T00:00:00'); d.setMonth(d.getMonth() - 2); desde = d.toISOString().slice(0,10); }
  if (hasta) { const d = new Date(hasta + 'T00:00:00'); d.setMonth(d.getMonth() + 2); hasta = d.toISOString().slice(0,10); }

  let q = _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empresa_activa.id);
  if (desde) q = q.gte('fecha_deposito', desde);
  if (hasta) q = q.lte('fecha_deposito', hasta);
  const { data: existentes } = await q;

  // Los "ya_existe"/"posible" detectados DENTRO del propio lote (dos filas del
  // mismo Excel que resultan ser el mismo movimiento) también cuentan como
  // "existentes" para las filas siguientes, para no crear dos nuevos iguales.
  const acumulados = [...(existentes || [])];
  const resultados = filas.map(fila => {
    const r = _dupClasificarMovimiento(fila, acumulados, conceptosRecurrentes);
    if (r.estado === 'nuevo') acumulados.push({ ...fila, fecha_deposito: fila.fecha, nro_operacion_bancaria: fila.numero_operacion });
    return { fila, ...r };
  });
  return resultados;
}

// ── Dedup para la tabla "movimientos" (libro bancario en crudo, por
//    cuenta) — usada por "🏦 Cuentas bancarias" para el saldo. Antes se
//    insertaban TODAS las filas válidas del Excel en cada importación sin
//    verificar si ya existían, así que reportes diarios que se solapan
//    inflaban el saldo con filas repetidas. Wendy 2026-09-15: corregir
//    esto también, con el mismo motor de coincidencia (N° de operación
//    normalizado + monto + moneda + descripción, fecha como corroboración
//    ±3 días). Filtra "validos" (filas ya parseadas del Excel) dejando
//    solo las que NO son duplicado confiable de un movimiento ya cargado
//    para esa cuenta (o para la empresa, si aún no se asignó cuenta).
//    Las "posible" (ambiguas) SÍ se insertan: esta tabla es el libro
//    crudo, no el registro de negocio, así que ante la duda se prefiere
//    no perder una fila real en vez de arriesgarse a omitirla en el saldo.
async function _dupFiltrarNuevosParaMovimientos(validos, cuenta) {
  if (!validos.length) return validos;
  const conceptosRecurrentes = await _dupCargarConceptosRecurrentes();

  const fechas = validos.map(r => r.fecha).filter(Boolean).sort();
  let desde = fechas[0], hasta = fechas[fechas.length - 1];
  if (desde) { const d = new Date(desde + 'T00:00:00'); d.setMonth(d.getMonth() - 2); desde = d.toISOString().slice(0,10); }
  if (hasta) { const d = new Date(hasta + 'T00:00:00'); d.setMonth(d.getMonth() + 2); hasta = d.toISOString().slice(0,10); }

  let q = _supabase.from('movimientos').select('fecha, naturaleza, importe, moneda, descripcion, numero_operacion')
    .eq('empresa_operadora_id', empresa_activa.id);
  if (cuenta) q = q.eq('cuenta_bancaria_id', cuenta);
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  const { data: existentesRaw } = await q;

  const aExistente = (m) => ({
    fecha_deposito: m.fecha, descripcion: m.descripcion, moneda: m.moneda,
    monto: m.naturaleza === 'CARGO' ? -Math.abs(Number(m.importe) || 0) : Math.abs(Number(m.importe) || 0),
    nro_operacion_bancaria: m.numero_operacion, nro_operacion_alt: null,
  });
  const acumulados = (existentesRaw || []).map(aExistente);

  return validos.filter(r => {
    const cand = {
      fecha: r.fecha, descripcion: r.descripcion, moneda: r.moneda,
      monto: r.naturaleza === 'CARGO' ? -Math.abs(r.importe) : Math.abs(r.importe),
      numero_operacion: r.numero_operacion,
    };
    const esDuplicado = _dupClasificarMovimiento(cand, acumulados, conceptosRecurrentes).estado === 'ya_existe';
    if (!esDuplicado) acumulados.push({ fecha_deposito: cand.fecha, descripcion: cand.descripcion, moneda: cand.moneda, monto: cand.monto, nro_operacion_bancaria: cand.numero_operacion, nro_operacion_alt: null });
    return !esDuplicado;
  });
}

/* ============================================================
   COMPARAR MBD ↔ EECC — detecta lo que falta de un lado o del otro
   (pedido por Wendy, 2026-09-12): no solo evitar duplicar al importar,
   sino poder revisar para un período si hay movimientos cargados a mano
   en tesoreria_mbd (MBD) que el extracto bancario (tabla "movimientos",
   cargado por Importar EECC) no muestra, o viceversa — usando el MISMO
   criterio de identificación (N° operación últimos 6 + descripción +
   moneda + monto, fecha como validador con tolerancia de
   _DUP_TOLERANCIA_DIAS días, no bloqueante). Solo lectura. ────────────
   ============================================================ */
async function _dupCompararMbdEecc(desde, hasta) {
  const conceptosRecurrentes = await _dupCargarConceptosRecurrentes();
  const empId = empresa_activa.id;

  // Margen de _DUP_TOLERANCIA_DIAS días a cada lado para no perder pares
  // cuya fecha cae justo en el borde del rango pedido.
  const desdeM = new Date(desde + 'T00:00:00'); desdeM.setDate(desdeM.getDate() - _DUP_TOLERANCIA_DIAS);
  const hastaM = new Date(hasta + 'T00:00:00'); hastaM.setDate(hastaM.getDate() + _DUP_TOLERANCIA_DIAS);
  const desdeQ = desdeM.toISOString().slice(0,10), hastaQ = hastaM.toISOString().slice(0,10);

  const [{ data: mbd }, { data: eecc }] = await Promise.all([
    _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empId)
      .gte('fecha_deposito', desdeQ).lte('fecha_deposito', hastaQ),
    _supabase.from('movimientos').select('*, cuentas_bancarias(nombre_alias)').eq('empresa_operadora_id', empId)
      .gte('fecha', desdeQ).lte('fecha', hastaQ),
  ]);

  const mbdList  = mbd  || [];
  const eeccList = eecc || [];

  // EECC en el "formato existentes" que espera _dupClasificarMovimiento
  const eeccComoExistentes = eeccList.map(m => ({
    fecha_deposito: m.fecha, descripcion: m.descripcion, moneda: m.moneda,
    monto: m.importe, nro_operacion_bancaria: m.numero_operacion, nro_operacion_alt: null,
  }));
  const mbdComoExistentes = mbdList.map(m => ({
    fecha_deposito: m.fecha_deposito, descripcion: m.descripcion, moneda: m.moneda,
    monto: m.monto, nro_operacion_bancaria: m.nro_operacion_bancaria, nro_operacion_alt: m.nro_operacion_alt,
  }));

  const enFecha = (f) => f >= desde && f <= hasta; // solo reportar "faltantes" del período pedido, aunque se haya buscado con margen

  const faltanEnEecc = mbdList
    .filter(m => enFecha((m.fecha_deposito||'').slice(0,10)))
    .filter(m => {
      const cand = { fecha: m.fecha_deposito, descripcion: m.descripcion, moneda: m.moneda, monto: m.monto, numero_operacion: m.nro_operacion_bancaria };
      return _dupClasificarMovimiento(cand, eeccComoExistentes, conceptosRecurrentes).estado === 'nuevo';
    });

  const faltanEnMbd = eeccList
    .filter(m => enFecha((m.fecha||'').slice(0,10)))
    .filter(m => {
      const cand = { fecha: m.fecha, descripcion: m.descripcion, moneda: m.moneda, monto: m.importe, numero_operacion: m.numero_operacion };
      return _dupClasificarMovimiento(cand, mbdComoExistentes, conceptosRecurrentes).estado === 'nuevo';
    });

  return { faltanEnEecc, faltanEnMbd };
}

function _dupRenderComparacionMbdEecc(desde, hasta, faltanEnEecc, faltanEnMbd) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;

  const filaMbd = (m) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--color-borde);font-size:12px">
      <span>${formatearFecha(m.fecha_deposito)} · ${escapar((m.descripcion||'').slice(0,40))} · Op. ${escapar(m.nro_operacion_bancaria||'—')}</span>
      <span style="display:flex;align-items:center;gap:10px">
        <strong>${formatearMoneda(m.monto)}</strong>
        <button onclick="document.querySelector('.modal-overlay').remove();abrirModalMovimiento('${m.id}')"
          style="padding:3px 10px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Ver</button>
      </span>
    </div>`;
  const filaEecc = (m) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--color-borde);font-size:12px">
      <span>${formatearFecha(m.fecha)} · ${escapar((m.descripcion||'').slice(0,40))} · Op. ${escapar(m.numero_operacion||'—')} · ${escapar(m.cuentas_bancarias?.nombre_alias||'—')}</span>
      <strong>${formatearMoneda(m.importe)}</strong>
    </div>`;

  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:760px;width:95%;max-height:88vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>🔍 Comparar MBD ↔ EECC — ${escapar(desde)} a ${escapar(hasta)}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px">
            Compara por N° de operación (últimos 6 dígitos) + descripción + moneda + monto, con la fecha como validador
            (tolerancia de ${_DUP_TOLERANCIA_DIAS} días, no bloqueante). Solo lectura — no modifica nada.
          </p>
          <h4 style="margin:0 0 8px">🔴 En MBD (Tesorería → Movimientos) pero SIN match en el extracto bancario — ${faltanEnEecc.length}</h4>
          ${faltanEnEecc.length ? faltanEnEecc.map(filaMbd).join('') : '<p class="text-muted text-sm" style="padding:8px 0">Ninguno.</p>'}
          <h4 style="margin:18px 0 8px">🔵 En el extracto bancario (EECC) pero SIN match en MBD — ${faltanEnMbd.length}</h4>
          ${faltanEnMbd.length ? faltanEnMbd.map(filaEecc).join('') : '<p class="text-muted text-sm" style="padding:8px 0">Ninguno.</p>'}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}

async function _dupCompararMbdEeccClick() {
  const mes  = document.getElementById('mov-mes')?.value;
  const anio = document.getElementById('mov-anio')?.value;
  if (!mes || !anio) { mostrarToast('Selecciona mes y año primero', 'atencion'); return; }
  const desde = `${anio}-${mes}-01`;
  const hasta = new Date(Number(anio), Number(mes), 0).toISOString().slice(0,10);

  mostrarToast('Comparando MBD contra el extracto bancario…', 'info');
  const { faltanEnEecc, faltanEnMbd } = await _dupCompararMbdEecc(desde, hasta);
  _dupRenderComparacionMbdEecc(desde, hasta, faltanEnEecc, faltanEnMbd);
}

// ── Validación de integridad + reporte de coincidencias ───────────
// Wendy 2026-09-15: prioridad absoluta = integridad de datos. Antes de
// escribir CUALQUIER cosa en la base de datos, el sistema debe mostrar
// el cuadre completo del lote (cuántos nuevos, cuántos duplicados,
// cuántos "REQUIERE REVISIÓN", e importe por moneda de cada grupo) y
// esperar aprobación explícita — incluso cuando no hay ninguna
// coincidencia (para que quede visible que el archivo completo se
// reconoció como nuevo). Nada se aplica en silencio: ni el N° de
// operación alterno, ni una corrección de fecha.
function _dupResumenIntegridad(clasificados) {
  const nuevos      = clasificados.filter(c => c.estado === 'nuevo');
  const duplicados  = clasificados.filter(c => c.estado === 'ya_existe');
  const revision    = clasificados.filter(c => c.estado === 'posible');

  const sumPorMoneda = (arr) => {
    const m = {};
    arr.forEach(c => {
      const mon = (c.fila.moneda || 'PEN').toUpperCase();
      m[mon] = (m[mon] || 0) + Math.abs(Number(c.fila.monto) || 0);
    });
    return m;
  };
  const diferenciasFecha = clasificados.filter(c =>
    c.match && (c.fila.fecha || '').slice(0, 10) !== (c.match.fecha_deposito || '').slice(0, 10)).length;
  const diferenciasNumOp = clasificados.filter(c =>
    c.match && (c.fila.numero_operacion || '').trim() !== (c.match.nro_operacion_bancaria || '').trim()).length;

  return {
    total: clasificados.length,
    nuevos: nuevos.length, duplicados: duplicados.length, revision: revision.length,
    diferenciasFecha, diferenciasNumOp,
    importePorMoneda: {
      total:      sumPorMoneda(clasificados),
      nuevos:     sumPorMoneda(nuevos),
      duplicados: sumPorMoneda(duplicados),
      revision:   sumPorMoneda(revision),
    },
  };
}

// Importe que quedará registrado vs. descartado por duplicidad, según las
// decisiones ACTUALES en el modal (se recalcula en vivo si la persona
// cambia una fila de "ya existe" a "es nuevo" o viceversa). Pedido por
// Wendy 2026-09-15: "importe total que quedará registrado después de la
// importación" es uno de los mínimos exigidos antes de confirmar.
function _dupCalcularTotalesFinales(coincidencias, resumen, leerDom) {
  const registrado = {};
  const descartado = {};
  Object.keys(resumen.importePorMoneda.nuevos).forEach(mon => { registrado[mon] = resumen.importePorMoneda.nuevos[mon]; });

  coincidencias.forEach((c, i) => {
    const accion = leerDom ? (document.querySelector(`input[name="dup-rev-${i}"]:checked`)?.value || 'existente') : 'existente';
    const mon = (c.fila.moneda || 'PEN').toUpperCase();
    const monto = Math.abs(Number(c.fila.monto) || 0);
    if (accion === 'nuevo') registrado[mon] = (registrado[mon] || 0) + monto;
    else descartado[mon] = (descartado[mon] || 0) + monto;
  });
  return { registrado, descartado };
}

function _dupRenderTotalesFinales(coincidencias, resumen, leerDom) {
  const { registrado, descartado } = _dupCalcularTotalesFinales(coincidencias, resumen, leerDom);
  const monedas = [...new Set([...Object.keys(registrado), ...Object.keys(descartado), ...Object.keys(resumen.importePorMoneda.total)])];
  if (!monedas.length) return '<div style="font-size:12px;color:var(--color-texto-suave)">Sin movimientos.</div>';
  return monedas.map(mon => `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span>${escapar(mon)}</span>
      <span>Quedará registrado: <strong style="color:var(--color-secundario)">${formatearMoneda(registrado[mon]||0, mon)}</strong> · Descartado según tus decisiones actuales: ${formatearMoneda(descartado[mon]||0, mon)}</span>
    </div>`).join('');
}

function _dupRenderResumenIntegridad(r) {
  const monedas = Object.keys(r.importePorMoneda.total);
  const cuadreOk = r.total === r.nuevos + r.duplicados + r.revision; // siempre verdadero por construcción — se muestra como control visible
  const filaImporte = (mon) => {
    const t = r.importePorMoneda.total[mon] || 0;
    const n = r.importePorMoneda.nuevos[mon] || 0;
    const d = r.importePorMoneda.duplicados[mon] || 0;
    const p = r.importePorMoneda.revision[mon] || 0;
    const cuadraImporte = Math.abs(t - (n + d + p)) < 0.01;
    return `
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-top:1px solid var(--color-borde)">
        <span>${escapar(mon)}</span>
        <span>${cuadraImporte ? '✅' : '⚠️'} Total ${formatearMoneda(t, mon)} = Nuevos ${formatearMoneda(n, mon)} + Duplicados (según clasificación automática) ${formatearMoneda(d, mon)} + Revisión ${formatearMoneda(p, mon)}</span>
      </div>`;
  };

  return `
    <div style="border:1px solid var(--color-borde);border-radius:8px;padding:14px;margin-bottom:16px;background:rgba(44,82,130,.04)">
      <div style="font-weight:700;margin-bottom:8px;font-size:13px">📋 Validación de integridad del lote</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:12px;margin-bottom:10px">
        <div>Total en archivo: <strong>${r.total}</strong></div>
        <div>Nuevos: <strong style="color:var(--color-secundario)">${r.nuevos}</strong></div>
        <div>Duplicados: <strong>${r.duplicados}</strong></div>
        <div>Requieren revisión: <strong style="color:#D69E2E">${r.revision}</strong></div>
        <div>Coinciden con registros existentes: <strong>${r.duplicados + r.revision}</strong></div>
        <div>Con fecha distinta: <strong>${r.diferenciasFecha}</strong></div>
        <div>Con N° operación distinto: <strong>${r.diferenciasNumOp}</strong></div>
      </div>
      <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:4px">
        ${cuadreOk ? '✅' : '⚠️'} Total del archivo = Nuevos + Duplicados + Requieren revisión (${r.nuevos} + ${r.duplicados} + ${r.revision} = ${r.nuevos + r.duplicados + r.revision})
      </div>
      ${monedas.map(filaImporte).join('')}
    </div>`;
}

// Recibe TODOS los resultados clasificados del lote (nuevo/ya_existe/posible).
// Devuelve una Promise que resuelve a { decisiones, resumen } — decisiones
// alineadas 1:1 con las filas que SÍ requerían decisión (ya_existe/posible),
// cada una { accion: 'existente'|'nuevo', actualizarFecha: bool } — o null
// si se cancela toda la importación (por seguridad, nada se toca ni se
// importa). Se muestra SIEMPRE, incluso sin coincidencias, para que la
// validación de integridad quede visible antes de escribir en la base.
function _dupMostrarValidacionIntegridad(clasificados) {
  const resumen = _dupResumenIntegridad(clasificados);
  const coincidencias = clasificados.filter(c => c.estado === 'ya_existe' || c.estado === 'posible');

  return new Promise(resolve => {
    const mc = document.getElementById('modal-container');
    if (!mc) { resolve({ decisiones: coincidencias.map(() => ({ accion: 'existente', actualizarFecha: false })), resumen }); return; }

    const filaFecha = (c) => (c.fila.fecha || '').slice(0, 10);
    const matchFecha = (c) => (c.match.fecha_deposito || '').slice(0, 10);
    const filaNumOp  = (c) => (c.fila.numero_operacion || '').trim();
    const matchNumOp = (c) => (c.match.nro_operacion_bancaria || c.match.nro_operacion_alt || '').trim();
    const fechaDifiere = (c) => filaFecha(c) && matchFecha(c) && filaFecha(c) !== matchFecha(c);
    const numOpDifiere = (c) => filaNumOp(c) && matchNumOp(c) && filaNumOp(c) !== matchNumOp(c);
    const montoDifiere = (c) => Math.abs(Math.abs(Number(c.fila.monto) || 0) - Math.abs(Number(c.match.monto) || 0)) > 0.01;
    const descDifiere  = (c) => (c.fila.descripcion || '').trim().toLowerCase() !== (c.match.descripcion || '').trim().toLowerCase();
    const esIdentico   = (c) => !fechaDifiere(c) && !numOpDifiere(c) && !montoDifiere(c) && !descDifiere(c);

    const listaCoincidencias = coincidencias.length ? coincidencias.map((c, i) => {
      const confianza = c.estado === 'ya_existe'
        ? '<span style="color:var(--color-secundario);font-weight:700">✅ Ya está registrado</span>'
        : '<span style="color:#D69E2E;font-weight:700">⚠️ REQUIERE REVISIÓN</span>';
      const difiere = fechaDifiere(c);

      const bloqueComparacion = esIdentico(c)
        ? `<div style="font-size:12px;margin-bottom:10px">
             📄 ${escapar(filaFecha(c)||'—')} · ${formatearMoneda(c.fila.monto, c.fila.moneda)} · ${escapar(c.fila.descripcion||'—')} · Op. ${escapar(c.fila.numero_operacion||'—')}
           </div>`
        : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:10px">
             <div>
               <div style="font-weight:700;margin-bottom:2px">En el archivo que estás importando</div>
               <div>${escapar(filaFecha(c)||'—')} · ${formatearMoneda(c.fila.monto, c.fila.moneda)} · ${escapar(c.fila.descripcion||'—')}</div>
               <div style="color:var(--color-texto-suave)">Op. ${escapar(c.fila.numero_operacion||'—')}</div>
             </div>
             <div>
               <div style="font-weight:700;margin-bottom:2px">Ya registrado en NEXUM</div>
               <div>${escapar(matchFecha(c)||'—')} · ${formatearMoneda(c.match.monto, c.match.moneda)} · ${escapar(c.match.descripcion||'—')}</div>
               <div style="color:var(--color-texto-suave)">Op. ${escapar(c.match.nro_operacion_bancaria||c.match.nro_operacion_alt||'—')}</div>
             </div>
           </div>`;

      return `
      <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:10px">
        <div style="font-size:12px;margin-bottom:4px">${confianza}</div>
        <div style="font-size:12px;color:var(--color-texto-suave);margin-bottom:8px">${escapar(c.razon)}</div>
        ${bloqueComparacion}
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;cursor:pointer">
          <input type="radio" name="dup-rev-${i}" value="existente" checked> Ya existe — no importar de nuevo
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;${difiere?'margin-bottom:6px':''};cursor:pointer">
          <input type="radio" name="dup-rev-${i}" value="nuevo"> Es un movimiento nuevo — registrar como nuevo
        </label>
        ${difiere ? `
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding-left:22px;color:var(--color-texto-suave)">
          <input type="checkbox" id="dup-fecha-${i}"> Actualizar la fecha registrada (${escapar(matchFecha(c))}) a la fecha de este archivo (${escapar(filaFecha(c))})
        </label>` : ''}
      </div>`;
    }).join('') : `<p class="text-muted text-sm" style="padding:8px 0">No se detectó ninguna coincidencia con registros existentes — todo el archivo se registrará como nuevo.</p>`;

    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex">
        <div class="modal" style="max-width:760px;width:95%;max-height:88vh;display:flex;flex-direction:column">
          <div class="modal-header">
            <h3>🔍 Validación antes de importar — ${resumen.total} movimiento(s)</h3>
          </div>
          <div class="modal-body" style="flex:1;overflow-y:auto">
            ${_dupRenderResumenIntegridad(resumen)}
            <div style="border:1px solid var(--color-borde);border-radius:8px;padding:10px 14px;margin-bottom:16px">
              <div style="font-weight:700;font-size:12px;margin-bottom:4px">💰 Importe que quedará registrado tras esta importación</div>
              <div id="dup-total-final-body">${_dupRenderTotalesFinales(coincidencias, resumen, false)}</div>
            </div>
            ${coincidencias.length ? `<p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px">
              Estos movimientos parecen corresponder a registros ya existentes en NEXUM. Nada se modifica todavía — revisa cada uno y decide antes de confirmar.
            </p>` : ''}
            ${listaCoincidencias}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" id="dup-rev-cancelar">Cancelar importación</button>
            <button class="btn btn-primario" id="dup-rev-confirmar">Confirmar e importar</button>
          </div>
        </div>
      </div>`;

    mc.querySelector('.modal-body').addEventListener('change', (e) => {
      if (e.target.name && e.target.name.startsWith('dup-rev-')) {
        const cont = document.getElementById('dup-total-final-body');
        if (cont) cont.innerHTML = _dupRenderTotalesFinales(coincidencias, resumen, true);
      }
    });

    document.getElementById('dup-rev-cancelar').onclick = () => { mc.innerHTML = ''; resolve(null); };
    document.getElementById('dup-rev-confirmar').onclick = () => {
      const decisiones = coincidencias.map((_, i) => {
        const accion = document.querySelector(`input[name="dup-rev-${i}"]:checked`)?.value || 'existente';
        const actualizarFecha = accion === 'existente' && !!document.getElementById(`dup-fecha-${i}`)?.checked;
        return { accion, actualizarFecha };
      });
      mc.innerHTML = '';
      resolve({ decisiones, resumen });
    };
  });
}
