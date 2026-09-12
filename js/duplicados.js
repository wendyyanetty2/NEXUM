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

    const montoOk  = Math.abs(montoCand - montoEx) < 0.01;
    const monedaOk = monedaCand === monedaEx;
    const fechaOk  = fechaCand === fechaEx;
    const descOk   = !!descCand && descCand === descEx;

    if (clave6Cand && clave6Ex && clave6Cand === clave6Ex) {
      if (montoOk && monedaOk && fechaOk && descOk) {
        return { estado: 'ya_existe', match: ex, razon: 'Mismo N° de operación (últimos 6 dígitos) + fecha + monto + descripción' };
      }
      // El N° de operación coincide pero algo más no cuadra — no se descarta
      // sola, pero tampoco se da por buena automáticamente: a revisar.
      mejorPosible = { estado: 'posible', match: ex, razon: 'N° de operación coincide, pero fecha/monto/descripción no calzan del todo' };
      continue;
    }

    // Sin N° de operación confiable en alguno de los dos lados (ej. "00000000"
    // de ITF/comisiones): mismo criterio que ya usa el sistema para esos casos.
    if (montoOk && monedaOk && descOk) {
      if (fechaOk) {
        if (conceptosRecurrentes?.has(descCand)) {
          return { estado: 'ya_existe', match: ex, razon: 'Concepto recurrente (catálogo) + misma fecha' };
        }
        return { estado: 'ya_existe', match: ex, razon: 'Monto + descripción + fecha exactos' };
      }
      // Fecha distinta: si es un concepto recurrente conocido (ITF, comisiones,
      // transferencias entre cuentas de terceros, etc.) NO se marca como dudoso
      // — es normal que se repita mes a mes con el mismo monto y descripción,
      // así que una fecha distinta significa que es el cargo de OTRO mes, no un
      // duplicado. Wendy lo señaló (2026-09-12): el sistema comparaba filas de
      // setiembre contra julio solo por coincidir monto+descripción genérica.
      if (conceptosRecurrentes?.has(descCand)) continue;
      if (!mejorPosible) mejorPosible = { estado: 'posible', match: ex, razon: 'Monto y descripción coinciden, pero la fecha no' };
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

// ── Modal de revisión para los casos "posible" (dudosos) ──────────
// Recibe la lista de resultados con estado==='posible'. Devuelve una
// Promise que resuelve a un array del mismo largo con 'nuevo' o
// 'existente' según lo que decida la persona, o null si cancela todo
// (en cuyo caso ninguna fila dudosa se importa, por seguridad).
function _dupRevisarPosibles(posibles) {
  return new Promise(resolve => {
    const mc = document.getElementById('modal-container');
    if (!mc) { resolve(posibles.map(() => 'existente')); return; }

    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex">
        <div class="modal" style="max-width:720px;width:95%;max-height:88vh;display:flex;flex-direction:column">
          <div class="modal-header">
            <h3>⚠️ ${posibles.length} movimiento(s) necesitan revisión</h3>
          </div>
          <div class="modal-body" style="flex:1;overflow-y:auto">
            <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px">
              No se pudo determinar con seguridad si estos ya existen o son nuevos. Revisa cada uno y decide — por defecto queda marcado como "Ya existe" (más seguro, no se importa).
            </p>
            ${posibles.map((p, i) => `
              <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:10px">
                <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:8px">${escapar(p.razon)}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:10px">
                  <div>
                    <div style="font-weight:700;margin-bottom:2px">Archivo que estás importando</div>
                    <div>${escapar(p.fila.fecha||'')} · ${formatearMoneda(p.fila.monto)} · ${escapar(p.fila.descripcion||'')}</div>
                    <div style="color:var(--color-texto-suave)">Op. ${escapar(p.fila.numero_operacion||'—')}</div>
                  </div>
                  <div>
                    <div style="font-weight:700;margin-bottom:2px">Ya existente en NEXUM</div>
                    <div>${escapar((p.match.fecha_deposito||'').slice(0,10))} · ${formatearMoneda(p.match.monto)} · ${escapar(p.match.descripcion||'')}</div>
                    <div style="color:var(--color-texto-suave)">Op. ${escapar(p.match.nro_operacion_bancaria||p.match.nro_operacion_alt||'—')}</div>
                  </div>
                </div>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;cursor:pointer">
                  <input type="radio" name="dup-rev-${i}" value="existente" checked> Ya existe — no importar
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                  <input type="radio" name="dup-rev-${i}" value="nuevo"> Es un movimiento nuevo — importar
                </label>
              </div>`).join('')}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" id="dup-rev-cancelar">Cancelar importación</button>
            <button class="btn btn-primario" id="dup-rev-confirmar">Confirmar y continuar</button>
          </div>
        </div>
      </div>`;

    document.getElementById('dup-rev-cancelar').onclick = () => { mc.innerHTML = ''; resolve(null); };
    document.getElementById('dup-rev-confirmar').onclick = () => {
      const decisiones = posibles.map((_, i) => document.querySelector(`input[name="dup-rev-${i}"]:checked`)?.value || 'existente');
      mc.innerHTML = '';
      resolve(decisiones);
    };
  });
}
