/* ============================================================
   NEXUM — Consolidación de estados: Movimientos ↔ Comprobantes
   (RH Recibidos, Ventas, Compras)

   NUEVA funcionalidad. No modifica ningún flujo existente.

   Funciones públicas:
     consolidarMovimientoVinculado(movId)  — auto-trigger tras cada vinculación
     consolidarEstadosRetroactivo()        — proceso retroactivo masivo (botón UI)
     _conCobertura(movsVinculados, total)  — Estado Parcial (punto 1.7), soporta N:M
   ============================================================ */

// ── Cobertura de un comprobante frente a los movimientos bancarios vinculados
//    (regla de oro N:M — un comprobante puede cubrirse con varios movimientos,
//    y viceversa; ver punto 1.7). Recibe el array de movimientos ya filtrados
//    por nro_factura_doc y el total del comprobante. NO toca la base de datos.
function _conCobertura(movsVinculados, totalComprobante) {
  const suma  = (movsVinculados || []).reduce((s, m) => s + Math.abs(Number(m.monto) || 0), 0);
  const total = Number(totalComprobante) || 0;
  // TOL fijo de redondeo (NO el margen de referencia de S/3 — ese solo decide
  // si SE BLOQUEA el vínculo o se pregunta, ver _conValidarAntesDeVincular; el
  // badge EXCESIVO/PARCIAL debe seguir siendo exacto, corregido tras reporte de
  // Wendy 2026-09-18: "ahí debería decir EXCESIVO porque pasó del monto exacto").
  const TOL   = 0.01;
  const round = n => Math.round(n * 100) / 100;

  if (!movsVinculados?.length || suma <= TOL) {
    return { estado: 'PENDIENTE', suma: round(suma), total: round(total), falta: round(total) };
  }
  if (suma < total - TOL) {
    return { estado: 'PARCIAL', suma: round(suma), total: round(total), falta: round(total - suma) };
  }
  // Sobre-cobertura: el/los movimiento(s) vinculado(s) suman MÁS que el comprobante.
  // No es un match limpio — se marca igual como PARCIAL (con "excede" en vez de
  // "falta") para que se revise manualmente, en vez de darlo por completo sin más.
  if (suma > total + TOL) {
    return { estado: 'PARCIAL', suma: round(suma), total: round(total), falta: 0, excede: round(suma - total) };
  }
  const todosEmitidos = movsVinculados.every(m => m.entrega_doc === 'EMITIDO');
  return {
    estado: todosEmitidos ? 'COMPLETO_EMITIDO' : 'COMPLETO_OBSERVADO',
    suma: round(suma), total: round(total), falta: 0,
  };
}

// ── Validación de duplicados/descuadres ANTES de vincular
//    (Wendy, 2026-09-17; corregido en auditoría 2026-09-17 sección 6).
//    La clave de un comprobante es su N° (nro_factura_doc) + tipo_doc —
//    NO el nombre del proveedor, porque puede venir escrito distinto
//    entre el banco y el comprobante. Antes de grabar un nuevo vínculo
//    se recalcula cuánto suman TODOS los movimientos que ya apuntan a
//    ese mismo N° de comprobante y se reutiliza _conCobertura (el
//    badge EXCESIVO/PARCIAL sigue siendo exacto, TOL=0.01 — el exceso
//    real (cov.excede) es lo que se compara contra el margen de
//    referencia configurable por empresa (empresa_activa.margen_conciliacion,
//    S/3 por defecto, editable solo por el administrador):
//      - exceso > margen  → BLOQUEA (aviso de un solo botón, no se puede seguir).
//      - exceso ≤ margen  → NO bloquea, pero pregunta (Wendy decide si procede
//        cada vez — "está en mí como administrador si procedo o no", 2026-09-18).
//      - sin exceso       → sigue igual que siempre, sin preguntar nada.
//    Antes esta función usaba su propio margen (5%/S/5) para la decisión de
//    bloqueo, lo que abría una ventana donde el badge ya decía EXCESIVO pero
//    el sistema todavía dejaba vincular más — corregido tras la auditoría del
//    documento "NEXUM_Auditoria_y_Mejora_Conciliacion".
//    2026-09-19: `emisor` ({ruc, nombre}, opcional) permite ver también los
//    movimientos cuyo comprobante se escribió a mano en Tesorería y quedaron
//    SIN categoría (tipo_doc vacío/dañado) — antes este chequeo no los veía, y
//    un comprobante que ya tenía su N° de operación aparecía como disponible y
//    se podía vincular de nuevo. Sin `emisor` el comportamiento es el de siempre.
async function _conValidarAntesDeVincular(empresaId, tipoDoc, nroFacturaDoc, totalComprobante, movIdExcluir, montoNuevo, emisor = null) {
  const total = Number(totalComprobante) || 0;
  if (!nroFacturaDoc || !total) return { ok: true };

  // `emisor.alt` (opcional): otras claves con las que el mismo comprobante pudo quedar guardado
  // — p. ej. el código único (UUID) de un RH en datos antiguos, además de su N° legible.
  const claves = [nroFacturaDoc, ...((emisor && emisor.alt) || [])].filter(Boolean);
  let consulta = _supabase
    .from('tesoreria_mbd')
    .select('id,nro_operacion_bancaria,fecha_deposito,monto,proveedor_empresa_personal,entrega_doc,tipo_doc,ruc_dni,nro_factura_doc')
    .eq('empresa_id', empresaId)
    .in('nro_factura_doc', claves)
    .neq('id', movIdExcluir || '');
  consulta = emisor ? consulta.or(_conFiltroTipoDoc(tipoDoc)) : consulta.eq('tipo_doc', tipoDoc);
  const { data: existentesExactos } = await consulta;
  // Compras/Ventas: además del N° exacto, los movimientos con el N° escrito en otro formato (los mismos
  // que ya cuenta el estado de la pantalla) — si no, el aviso de exceso no los veía.
  let existentes = existentesExactos || [];
  if (emisor && (tipoDoc === 'COMPRA' || tipoDoc === 'VENTA')) {
    const { data: variantes } = await _conMovsDeComprobantes(empresaId, tipoDoc, [nroFacturaDoc],
      'id,nro_operacion_bancaria,fecha_deposito,monto,proveedor_empresa_personal,entrega_doc,tipo_doc,ruc_dni,nro_factura_doc');
    const vistos = new Set(existentes.map(m => m.id));
    (variantes || []).forEach(m => { if (m.id !== movIdExcluir && !vistos.has(m.id)) { existentes.push(m); vistos.add(m.id); } });
  }

  const lista    = emisor
    ? _conFiltrarVinculosDelComprobante(existentes, tipoDoc, emisor.ruc, emisor.nombre)
    : (existentes || []);
  const montoAbs = Math.abs(Number(montoNuevo) || 0);
  const cov      = _conCobertura([...lista, { monto: montoAbs, entrega_doc: 'OBSERVADO' }], total);

  if (cov.estado === 'PARCIAL' && cov.excede) {
    const margen = (typeof empresa_activa !== 'undefined' && empresa_activa?.margen_conciliacion != null && empresa_activa.margen_conciliacion >= 0)
      ? Number(empresa_activa.margen_conciliacion) : 3;
    const sumaPrevia = cov.suma - montoAbs;
    const detalle = lista.map(m =>
      `• Op. ${escapar(m.nro_operacion_bancaria || '—')} · ${formatearFecha(m.fecha_deposito)} · ${formatearMoneda(m.monto)} · ${escapar(m.proveedor_empresa_personal || '—')}`
    ).join('\n');

    if (cov.excede > margen) {
      return {
        ok: false, lista, sumaPrevia, sumaNueva: cov.suma, total, excede: cov.excede,
        mensaje: `⛔ No se puede vincular.\n\n`
          + `El comprobante "${escapar(nroFacturaDoc)}" ya tiene ${lista.length} movimiento(s) bancario(s) vinculado(s) que suman ${formatearMoneda(sumaPrevia)}.\n`
          + `Agregar este movimiento (${formatearMoneda(montoAbs)}) llevaría el total vinculado a ${formatearMoneda(cov.suma)}, que excede el total del comprobante (${formatearMoneda(total)}) por ${formatearMoneda(cov.excede)} — más del margen de referencia (${formatearMoneda(margen)}).\n`
          + (detalle ? `\nMovimiento(s) ya vinculado(s) a este comprobante:\n${detalle}\n` : '')
          + `\nSi este movimiento en realidad pertenece a otro comprobante, revisa el N° antes de continuar. Si el vínculo anterior está mal, desvincúlalo primero.`,
      };
    }

    // Dentro del margen de referencia: no bloquea — pero tampoco pasa en
    // silencio. El administrador decide cada vez si procede.
    const procede = await confirmar(
      `⚠️ Este comprobante quedará marcado EXCESIVO por ${formatearMoneda(cov.excede)} (dentro del margen de referencia de ${formatearMoneda(margen)}).\n\n`
      + `El comprobante "${escapar(nroFacturaDoc)}" ya tiene ${lista.length} movimiento(s) que suman ${formatearMoneda(sumaPrevia)}. Agregar este movimiento (${formatearMoneda(montoAbs)}) llevaría el total a ${formatearMoneda(cov.suma)}, sobre el total del comprobante (${formatearMoneda(total)}).\n\n`
      + `¿Deseas vincularlo de todas formas?`,
      { btnOk: 'Sí, vincular de todas formas', btnColor: '#DD6B20' }
    );
    return { ok: procede };
  }
  return { ok: true };
}

// ── Aviso bloqueante de un solo botón (a diferencia de confirmar(), que
//    ofrece seguir adelante) — para cuando la acción simplemente NO puede
//    continuar y solo queda que la persona lea por qué y cierre el aviso.
function _conAlertaBloqueo(mensaje) {
  // Bug 2026-09-18: cuando _conValidarAntesDeVincular pregunta "¿procedes de
  // todas formas?" (dentro del margen) y la respuesta es no, no hay mensaje
  // de bloqueo que mostrar — antes esto abría un aviso roto con "undefined"
  // en vez de simplemente cancelar en silencio (la persona ya dijo que no).
  if (!mensaje) return Promise.resolve();
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
    overlay.innerHTML = `
      <div style="background:var(--color-bg-card);border-radius:12px;padding:26px 30px;max-width:480px;width:100%;box-shadow:var(--sombra-lg);border:1px solid var(--color-borde)">
        <div style="font-size:36px;margin-bottom:10px;text-align:center">⛔</div>
        <p style="color:var(--color-texto);font-size:13px;margin:0 0 20px;line-height:1.6;white-space:pre-line">${mensaje}</p>
        <div style="text-align:center">
          <button id="btn-alerta-entendido" style="padding:10px 28px;border:none;border-radius:8px;background:#C53030;color:#fff;cursor:pointer;font-size:14px;font-family:var(--font);font-weight:600">Entendido</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-alerta-entendido').onclick = () => { overlay.remove(); resolve(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(); } });
  });
}

// ── Tolerancia de coincidencia para candidatos POSIBLE (Wendy, regla de
//    negocio 2026-09-17): lo ideal es monto exacto (o suma exacta, N:M);
//    si se permite aproximado, la diferencia máxima es ±S/3 fijo — NO un
//    porcentaje del total. Un solo valor para toda la búsqueda de
//    candidatos (🔗/POSIBLE), tanto en Compras/Ventas como en el ícono 🔗.
const _CON_MARGEN_POSIBLE = 3;

// ── Modelo de 5 estados visibles en Compras/Ventas (Wendy, 2026-09-17):
//    PENDIENTE, POSIBLE, PARCIAL, EXCESIVO, APLICADO — mismo criterio de
//    color/palabra en toda la UI (compartido entre con-compras.js y
//    con-ventas.js). "POSIBLE" usa el margen fijo de ±S/3 (_CON_MARGEN_
//    POSIBLE) que también usa el ícono 🔗 al buscar candidatos — no es un
//    mecanismo nuevo, es "hay al menos un movimiento bancario sin vincular
//    que calza".
const _CON_ESTADO5_COLOR = { PENDIENTE: '#C53030', POSIBLE: '#D69E2E', PARCIAL: '#DD6B20', EXCESIVO: '#9B2C2C', APLICADO: '#2F855A' };
const _CON_ESTADO5_ICONO = { PENDIENTE: '🔴', POSIBLE: '🟡', PARCIAL: '🔶', EXCESIVO: '🔺', APLICADO: '✅' };
function _conEstado5(cov, esPosible) {
  if (cov.estado === 'PENDIENTE') return esPosible ? 'POSIBLE' : 'PENDIENTE';
  if (cov.estado === 'PARCIAL')   return cov.excede ? 'EXCESIVO' : 'PARCIAL';
  return 'APLICADO'; // COMPLETO_EMITIDO / COMPLETO_OBSERVADO
}

// ── N° de comprobante listo para MOSTRAR: si es un código interno de RH, su N° legible (o un aviso
//    neutro) — Wendy, 2026-09-19: nunca se ve un código UUID. Ver nexumNroLegible en utils.js.
function _conLegible(v) { return typeof nexumNroLegible === 'function' ? nexumNroLegible(v) : v; }

// ── Clave normalizada tipo_doc+nro_factura_doc para agrupar movimientos
//    del mismo comprobante (auditoría 2026-09-18): un espacio de más, o
//    mayúscula/minúscula distinta importado de un Excel, puede hacer que
//    dos movimientos del MISMO comprobante caigan en grupos distintos y
//    reaparezca el bug de comparar uno solo contra el total completo —
//    normalizar (trim + mayúsculas) es la defensa contra ese caso.
function _conClaveDoc(tipoDoc, nroFacturaDoc) {
  return `${(tipoDoc || '').trim().toUpperCase()}|${(nroFacturaDoc || '').toString().trim().toUpperCase()}`;
}

// ── Filtro PENDIENTE = PENDIENTE + POSIBLE (auditoría 2026-09-17, regla
//    3.3): POSIBLE sigue siendo una conciliación sin resolver, así que al
//    hacer clic en el badge PENDIENTE debe aparecer también lo POSIBLE —
//    pero POSIBLE conserva su identidad propia: filtrar específicamente
//    por POSIBLE muestra solo eso, nunca se mezcla con el conteo general.
function _conCoincideFiltroEstado(estado5, filtro) {
  if (!filtro) return true;
  if (filtro === 'PENDIENTE') return estado5 === 'PENDIENTE' || estado5 === 'POSIBLE';
  return estado5 === filtro;
}

// ── "POSIBLE" es solo una SUGERENCIA (Wendy, 2026-09-19): "hay un movimiento sin vincular con monto parecido".
//    No puede aparecer cuando YA hay un movimiento que trae el N° de ese comprobante pero no cuenta para su estado
//    (está PENDIENTE, su emisor no calza, etc.): eso es un vínculo roto, no una sugerencia — el comprobante está
//    pendiente de repararse con "🔧 Reparar estados", no de conciliarse con otro movimiento.
//    Trae, por N° exacto, los movimientos de la empresa que lo llevan (cualquier estado).
async function _conMovsConNroCualquierEstado(empId, numeros) {
  const lista = [...new Set((numeros || []).filter(Boolean))];
  const porNro = new Map();
  for (let i = 0; i < lista.length; i += 80) {
    const { data } = await _supabase.from('tesoreria_mbd')
      .select('id,nro_factura_doc,tipo_doc,entrega_doc,ruc_dni,proveedor_empresa_personal')
      .eq('empresa_id', empId).in('nro_factura_doc', lista.slice(i, i + 80));
    (data || []).forEach(m => {
      if (!porNro.has(m.nro_factura_doc)) porNro.set(m.nro_factura_doc, []);
      porNro.get(m.nro_factura_doc).push(m);
    });
  }
  return porNro;
}
// ¿Hay algún movimiento (no cancelado; de esta categoría o sin categoría válida; que NO sea de otro emisor por RUC)
// con el N° de este comprobante? Se usa solo para comprobantes que hoy no tienen movimientos contados.
function _conHayVinculoQueNoCuenta(movsDelNro, categoria, ruc) {
  return (movsDelNro || []).some(m => {
    if (m.entrega_doc === 'CANCELADO') return false;
    if (_CON_TIPOS_DOC_VALIDOS.includes(m.tipo_doc) && m.tipo_doc !== categoria) return false;
    const rucMov = (m.ruc_dni || '').toString().trim(), rucComp = (ruc || '').toString().trim();
    if (rucMov && rucComp && rucMov !== rucComp) return false; // es de otro emisor
    return true;
  });
}

// ── Busca movimientos SIN vincular (nro_factura_doc vacío) cuyo monto cae
//    dentro del margen ±S/3 (_CON_MARGEN_POSIBLE) del total de un
//    comprobante — usado por el ícono 🔗. Corrige TRES bugs reales:
//    (1) en tesoreria_mbd los CARGOS (compras/egresos) se guardan con
//    monto NEGATIVO (ver tes-importar.js:267 y el filtro de naturaleza en
//    tes-movimientos.js:221), así que comparar el monto crudo contra un
//    rango siempre positivo nunca encontraba compras reales — se compara
//    por valor absoluto. (2) el filtro de monto se aplicaba EN EL CLIENTE
//    después de traer solo los 500 movimientos más recientes — en una
//    empresa con mucho historial, el candidato real podía no estar entre
//    esos 500 aunque sí calzara en monto, y el modal decía "sin
//    resultados" mientras el badge POSIBLE (que sí revisa hasta 5000)
//    decía que había uno — corregido filtrando el monto EN LA BASE DE
//    DATOS (ambos signos), sin depender de qué tan reciente sea la fecha.
//    (3) reporte de Wendy 2026-09-18: "ya están aplicadas pero aparecen
//    como posible" — un movimiento OBSERVADO SIEMPRE tiene nro_factura_doc
//    (ver _conEvalCompletitud14: sin N° Factura el estado es PENDIENTE, no
//    OBSERVADO), o sea que ya está vinculado a ALGÚN comprobante. Filtrar
//    solo por entrega_doc != EMITIDO lo ofrecía igual como "candidato
//    disponible" para CUALQUIER otro comprobante con monto parecido —
//    tanto en el ícono 🔗 como en el badge POSIBLE. Ahora se exige además
//    nro_factura_doc vacío (el único caso realmente "sin vincular").
async function _conBuscarCandidatosPorMonto(empresaId, total, limite = 30) {
  const margen = _CON_MARGEN_POSIBLE;
  const t = Number(total) || 0;
  const lo = t - margen, hi = t + margen;
  const { data } = await _supabase.from('tesoreria_mbd').select('*')
    .eq('empresa_id', empresaId).neq('entrega_doc', 'EMITIDO').is('nro_factura_doc', null)
    .or(`and(monto.gte.${lo},monto.lte.${hi}),and(monto.gte.${-hi},monto.lte.${-lo})`)
    .order('fecha_deposito', { ascending: false }).limit(200);

  return (data || [])
    .sort((a, b) => Math.abs(Math.abs(Number(a.monto)) - t) - Math.abs(Math.abs(Number(b.monto)) - t))
    .slice(0, limite);
}

// ── Trae los montos de movimientos SIN vincular (nro_factura_doc vacío) de
//    la empresa, para marcar como POSIBLE cualquier PENDIENTE que tenga al
//    menos un candidato dentro del margen — reutilizado por Compras y Ventas.
//    Sin límite artificial (antes 3000): con la corrección de arriba, este
//    y _conBuscarCandidatosPorMonto deben ver exactamente el mismo universo
//    de movimientos, para que POSIBLE y el modal 🔗 nunca se contradigan.
//    nro_factura_doc vacío (no solo entrega_doc != EMITIDO) — ver comentario
//    en _conBuscarCandidatosPorMonto: un OBSERVADO ya está vinculado a algún
//    comprobante y no es un candidato real para otro.
async function _conCandidatosMontoDisponibles(empresaId) {
  const { data } = await _supabase.from('tesoreria_mbd').select('monto')
    .eq('empresa_id', empresaId).neq('entrega_doc', 'EMITIDO').is('nro_factura_doc', null);
  return (data || []).map(m => Math.abs(Number(m.monto) || 0));
}
function _conHayCandidato(montos, total) {
  const margen = _CON_MARGEN_POSIBLE;
  return montos.some(m => m >= total - margen && m <= total + margen);
}

// ── "Reparar estados" ya NO reescribe el estado (entrega_doc) de todos los movimientos vinculados con la
//    regla histórica de 5 campos: eso cambiaba en silencio EMITIDO/OBSERVADO que Wendy ya había trabajado, y
//    contradice la regla vigente de 14 campos (que sí se ofrece, opcional y sin marcar, en el reporte).
//    Se deja en false; si algún día se quiere volver al comportamiento antiguo, es solo cambiar este valor.
const _CON_REPARAR_RECALCULA_ESTADOS = false;

// ── Evalúa completitud de los 5 campos requeridos (fórmula histórica,
//    2 niveles: EMITIDO/OBSERVADO). Usada hoy solo por "🔄 Consolidar
//    estados" (proceso retroactivo masivo) para no alterar de golpe
//    el estado de registros ya existentes — ver _conEvalCompletitud14
//    para la fórmula nueva de 3 niveles. ──────────────────────────
function _conEvalCompletitud(mov) {
  const ok = v => !!(v && String(v).trim());
  return (ok(mov.proveedor_empresa_personal) &&
          (ok(mov.cotizacion) || ok(mov.oc)) &&
          ok(mov.proyecto) &&
          ok(mov.concepto) &&
          ok(mov.empresa))
    ? 'EMITIDO' : 'OBSERVADO';
}

// ── Fórmula nueva (3 niveles: PENDIENTE/OBSERVADO/EMITIDO), aprobada
//    2026-08-19 — punto 2.5. El Nº Factura o DOC es la puerta de
//    entrada obligatoria: sin ese dato el estado SIEMPRE es PENDIENTE,
//    sin importar cuántos otros campos estén llenos (corregido tras
//    feedback de Wendy — un movimiento con Proveedor/Concepto/Empresa
//    llenos pero SIN N° Factura no es "OBSERVADO", es "PENDIENTE").
//    Con el N° Factura presente: todos los 14 campos completos →
//    EMITIDO; si falta alguno → OBSERVADO. Se usa solo en acciones
//    NUEVAS (vincular, dividir) — nunca sobrescribe un estado
//    CANCELADO (ese se asigna manualmente en Tesorería → Movimientos).
function _conEvalCompletitud14(mov) {
  if (mov.entrega_doc === 'CANCELADO') return 'CANCELADO';
  const ok = v => !!(v && String(v).trim());

  if (!ok(mov.nro_factura_doc)) return 'PENDIENTE';

  const slots = [
    ok(mov.nro_operacion_bancaria),
    ok(mov.fecha_deposito),
    ok(mov.descripcion),
    ok(mov.moneda),
    !!(mov.monto || mov.monto === 0) && mov.monto !== '',
    ok(mov.proveedor_empresa_personal),
    ok(mov.ruc_dni),
    ok(mov.cotizacion) || ok(mov.oc),
    ok(mov.proyecto),
    ok(mov.concepto),
    ok(mov.empresa),
    ok(mov.nro_factura_doc),
    ok(mov.tipo_doc) || ok(mov.tipo_comprobante),
    ok(mov.autorizacion),
  ];
  const todosCompletos = slots.every(Boolean);
  return todosCompletos ? 'EMITIDO' : 'OBSERVADO';
}

// ── Qué datos le faltan a un movimiento para ser EMITIDO (mismos 14 campos que
//    _conEvalCompletitud14, en el mismo orden). Solo informa: no cambia estados.
//    Sirve para explicar por qué quedó OBSERVADO (o PENDIENTE) — p. ej. al
//    dividir una transferencia (Wendy, 2026-09-19). Devuelve [] si está completo.
function _conCamposFaltantes14(mov) {
  const ok = v => !!(v && String(v).trim());
  const faltan = [];
  if (!ok(mov.nro_factura_doc)) faltan.push('N° Factura/DOC');
  if (!ok(mov.nro_operacion_bancaria)) faltan.push('N° operación');
  if (!ok(mov.fecha_deposito)) faltan.push('Fecha');
  if (!ok(mov.descripcion)) faltan.push('Descripción');
  if (!ok(mov.moneda)) faltan.push('Moneda');
  if (!((mov.monto || mov.monto === 0) && mov.monto !== '')) faltan.push('Monto');
  if (!ok(mov.proveedor_empresa_personal)) faltan.push('Proveedor');
  if (!ok(mov.ruc_dni)) faltan.push('RUC/DNI');
  if (!(ok(mov.cotizacion) || ok(mov.oc))) faltan.push('Cotización u OC');
  if (!ok(mov.proyecto)) faltan.push('Proyecto');
  if (!ok(mov.concepto)) faltan.push('Concepto');
  if (!ok(mov.empresa)) faltan.push('Empresa');
  if (!(ok(mov.tipo_doc) || ok(mov.tipo_comprobante))) faltan.push('Tipo DOC');
  if (!ok(mov.autorizacion)) faltan.push('Autorización');
  return faltan;
}

// ── Extrae período YYYYMM de una fecha YYYY-MM-DD ───────────────
function _conPeriodoFromFecha(fecha) {
  if (!fecha) return '';
  return (fecha.slice(0, 4) + fecha.slice(5, 7)); // "2025-03-15" → "202503"
}

// ── Coincidencia aproximada de nombres (emisor) ─────────────────
function _conNombreCoincide(a, b) {
  if (!a || !b) return true; // si falta uno, no bloqueamos
  const na = String(a).trim().toLowerCase();
  const nb = String(b).trim().toLowerCase();
  return na.includes(nb) || nb.includes(na);
}

// ── Versión ESTRICTA: usada donde el N° de documento por sí solo NO
//    identifica de forma única al registro (ej. N° de RH, que puede
//    repetirse entre emisores distintos — ver con-rh-recibidas.js).
//    A diferencia de _conNombreCoincide(), si falta cualquiera de los
//    dos nombres NO se asume coincidencia — eso mezclaría montos de
//    personas/empresas distintas y produciría falsos "EXCEDE".
function _conNombreCoincideEstricto(a, b) {
  const na = String(a || '').trim().toLowerCase();
  const nb = String(b || '').trim().toLowerCase();
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

// ── Filtra movimientos por emisor (RUC exacto, o nombre estricto si no
//    hay RUC en algún lado). El N° de serie-comprobante SUNAT es único
//    POR EMISOR — dos proveedores/clientes distintos podrían coincidir
//    en la misma serie+número, así que agrupar solo por nro_factura_doc
//    puede mezclar montos de empresas distintas (mismo tipo de bug que
//    el de N° de RH repetido — aplicado 2026-08-19 a pedido de Wendy:
//    "la corrección para todos" — Compras, Ventas y RH). ──────────────
function _conFiltrarPorEmisor(movs, ruc, nombre) {
  if (!movs?.length) return [];
  return movs.filter(m => {
    if (ruc && m.ruc_dni) return String(m.ruc_dni).trim() === String(ruc).trim();
    return _conNombreCoincideEstricto(m.proveedor_empresa_personal, nombre);
  });
}

// ── Período del movimiento y del comprobante son compatibles ────
// Tolerancia ±2 meses (el pago puede caer en mes distinto al de emisión)
function _conPeriodoCercano(periodoMov, periodoComp) {
  if (!periodoMov || !periodoComp || periodoMov.length < 6 || periodoComp.length < 6) return true;
  const ym = parseInt(periodoMov.slice(0, 4)) * 12 + parseInt(periodoMov.slice(4, 6));
  const yc = parseInt(periodoComp.slice(0, 4)) * 12 + parseInt(periodoComp.slice(4, 6));
  return Math.abs(ym - yc) <= 2;
}

// ── Pago a terceros (Wendy, 2026-09-18, dirección corregida el mismo día):
//    proveedor_empresa_personal SIEMPRE migra el nombre oficial del
//    comprobante (Compras/Ventas/RH) — es el dato contable, la fuente de
//    verdad. titular_comprobante guarda a quién se le depositó de verdad
//    el dinero (dato del banco), SOLO cuando es distinto del emisor del
//    comprobante — nunca el mismo nombre en otro orden. Se usa en TODOS
//    los caminos que escriben proveedor_empresa_personal al vincular un
//    comprobante, para que la migración de datos (RUC, nombre, serie-
//    número) sea consistente en todos, no una regla suelta por archivo.
function _tercNombreNorm(v) {
  return (v || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
}
// rucActual/rucComprobante son opcionales — si no se pasan, ruc queda
// como antes (rucComprobante || rucActual || null).
// `titular` es `undefined` (no null) cuando no hay nada nuevo que guardar: quien escribe
// `titular_comprobante = rt.titular` en un update OMITE el campo y se conserva el "A quién se
// depositó" que ya estuviera escrito. Con null se BORRABA (p. ej. al re-vincular o al correr
// "Reparar estados" dos veces, cuando el nombre del banco ya coincidía con el del comprobante).
// `titularActual` (opcional) = el «A quién se depositó» que el movimiento YA tiene escrito (Wendy, 2026-09-19): el
// Proveedor/Empresa/Personal SIEMPRE toma el nombre del comprobante y el valor que ya tenía no se sobrescribe ni se
// pierde: se traslada a «A quién se depositó»; si ese campo ya tenía texto, se AGREGA a continuación ("uno / otro").
// Todos los botones que vinculan deben pasarlo.
function _tercNombreLlano(v) {
  return (v || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
// Une lo que ya estaba en «A quién se depositó» con el nombre que se traslada. Devuelve undefined si no hay nada
// nuevo que guardar (el campo se omite y se conserva lo escrito).
function _conUnirTitular(existente, nuevo) {
  const e = (existente || '').toString().trim(), n = (nuevo || '').toString().trim();
  if (!n) return undefined;
  if (!e) return n;
  if (_tercNombreNorm(e) === _tercNombreNorm(n) || _tercNombreLlano(e).includes(_tercNombreLlano(n))) return undefined; // ya está
  return `${e} / ${n}`;
}
function _resolverProveedorTitular(proveedorActual, proveedorComprobante, rucActual, rucComprobante, titularActual) {
  const actual = (proveedorActual || '').toString().trim();
  const comp   = (proveedorComprobante || '').toString().trim();
  const rucAct = (rucActual || '').toString().trim() || null;
  const rucComp = (rucComprobante || '').toString().trim() || null;

  if (!comp)   return { proveedor: actual || null, titular: undefined, ruc: rucAct };
  if (!actual) return { proveedor: comp, titular: undefined, ruc: rucComp || rucAct };
  if (_tercNombreNorm(actual) === _tercNombreNorm(comp)) return { proveedor: comp, titular: undefined, ruc: rucComp || rucAct };
  // Pago a tercero: el nombre que ya estaba en el movimiento (quien
  // realmente recibió el depósito, ej. "Valencia Nanez...") no es el
  // emisor del comprobante (ej. "TIENDAS DEL MEJORAMIENTO...") — el campo
  // Proveedor/Empresa/Personal migra igual al emisor del comprobante (dato
  // contable correcto) y el nombre del depositario se guarda aparte.
  return { proveedor: comp, titular: _conUnirTitular(titularActual, actual), ruc: rucComp || rucAct };
}

// ── Refresca las vistas cuyo estado se calcula en vivo desde tesoreria_mbd
//    (Tesorería > Movimientos, Compras, Ventas, RH Recibidas). Cualquier
//    acción que vincule, desvincule o apruebe un match debe llamar esto —
//    si no, la vista se queda mostrando el estado viejo hasta que se
//    recarga el módulo a mano (auditoría 2026-09-18: varias funciones de
//    vinculación en con-compras.js/con-ventas.js/con-conciliar.js escribían
//    en tesoreria_mbd pero nunca avisaban a las demás vistas). Cada carga
//    está protegida por typeof porque solo el módulo que está montado en
//    pantalla tiene su función definida.
function _refrescarVistasVinculadas() {
  if (typeof cargarMovimientos === 'function') cargarMovimientos(true);
  if (typeof cargarCompras     === 'function') cargarCompras();
  if (typeof cargarVentas      === 'function') cargarVentas();
  if (typeof cargarRHRecibidas === 'function') cargarRHRecibidas();
}

// ════════════════════════════════════════════════════════════════
// MOVIMIENTOS SIN CATEGORÍA DE COMPROBANTE (Wendy, 2026-09-19)
//
// Caso real: se rellena a mano en Tesorería → Movimientos el N° de
// comprobante (ej. F052-2073625) y el estado, pero la categoría interna
// tipo_doc (COMPRA/VENTA/RH/PM) queda vacía o dañada (registros guardados
// antes del fix del 2026-09-18). Contabilidad buscaba SOLO por
// tipo_doc='COMPRA' (o VENTA/RH), así que ese comprobante seguía en
// PENDIENTE aunque el movimiento ya estaba OBSERVADO/EMITIDO.
//
// Dos piezas, ambas ADITIVAS (lo que ya funcionaba con tipo_doc correcto
// no cambia):
//   1) _conMovsDeComprobantes / _conFiltroTipoDoc — Compras/Ventas/RH
//      además cuentan los movimientos SIN categoría válida cuyo N° de
//      comprobante coincide; la identidad del emisor (RUC, o nombre
//      estricto) sigue filtrando después con _conFiltrarPorEmisor.
//   2) "🔧 Reparar estados" ahora MUESTRA esos casos en un reporte y solo
//      corrige (asigna la categoría) los que Wendy aprueba.
// ════════════════════════════════════════════════════════════════
const _CON_TIPOS_DOC_VALIDOS = ['COMPRA', 'VENTA', 'RH', 'PM'];

// Filtro PostgREST: la categoría exacta O "sin categoría válida" (vacía o
// dañada, ej. 'FA'/'BO' escritos por el bug del modal). PM queda fuera a
// propósito: es una categoría válida que pertenece a otro flujo.
function _conFiltroTipoDoc(categoria) {
  return `tipo_doc.eq.${categoria},tipo_doc.is.null,tipo_doc.not.in.(${_CON_TIPOS_DOC_VALIDOS.join(',')})`;
}

// Dado un listado de movimientos con el mismo N° de comprobante, deja los de
// la categoría exacta (como siempre) y SUMA los que no tienen categoría válida
// (vacía/dañada) siempre que estén EMITIDO/OBSERVADO y el emisor coincida
// (RUC, o nombre estricto). Sin emisor conocido, esos NO se cuentan: es mejor
// no mezclar comprobantes de emisores distintos que compartan serie+número.
//
//    RH (Wendy, 2026-09-19): el N° legible de un RH se REPITE entre emisores (E001-6 puede
//    ser de 7 personas distintas: cada una numera desde 1), así que un vínculo guardado con
//    el N° legible solo pertenece a ese RH si el emisor coincide (DNI exacto o, si falta,
//    nombre). Un vínculo guardado con el código único (UUID, datos antiguos) es inequívoco.
function _conEsUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((v || '').toString().trim());
}
function _conFiltrarVinculosDelComprobante(movs, categoria, ruc, nombre) {
  return (movs || []).filter(m => {
    if (categoria === 'RH') {
      if (_conEsUUID(m.nro_factura_doc)) return true;                       // clave única (datos antiguos)
      const cubre = m.entrega_doc === 'EMITIDO' || m.entrega_doc === 'OBSERVADO';
      if (m.tipo_doc !== 'RH' && !cubre) return false;                      // ni es de categoría RH ni cubre
      return _conFiltrarPorEmisor([m], ruc, nombre).length > 0;             // N° legible: exige el emisor
    }
    if (m.tipo_doc === categoria) return true;
    if (m.entrega_doc !== 'EMITIDO' && m.entrega_doc !== 'OBSERVADO') return false;
    return _conFiltrarPorEmisor([m], ruc, nombre).length > 0;
  });
}

// Movimientos que cubren (EMITIDO/OBSERVADO) los comprobantes de `numeros`
// — reutilizado por Compras y Ventas en pantalla y en su exportación.
//    Devuelve { data, error } igual que una consulta de Supabase (se usa con await).
//    Dos pasos: (1) los de la categoría exacta con ese N° (como siempre,
//    troceado para no pasar el límite de largo de URL con periodos grandes);
//    (2) los SIN categoría válida, comparando el N° NORMALIZADO (espacios,
//    mayúsculas, ceros a la izquierda) — así un "F052 -2073625" escrito a mano
//    igual cubre a "F052-2073625". Los del paso 2 se devuelven con el N° del
//    comprobante para que quien llama pueda agruparlos por él.
async function _conMovsDeComprobantes(empresaId, categoria, numeros, columnas) {
  const lista = [...new Set((numeros || []).filter(Boolean))];
  const cols  = /\bid\b/.test(columnas) ? columnas : `${columnas},id`;
  const vistos = new Map();

  for (let i = 0; i < lista.length; i += 80) {
    const { data, error } = await _supabase.from('tesoreria_mbd').select(cols)
      .eq('empresa_id', empresaId).eq('tipo_doc', categoria)
      .in('entrega_doc', ['EMITIDO', 'OBSERVADO'])
      .in('nro_factura_doc', lista.slice(i, i + 80));
    if (error) return { data: null, error };
    (data || []).forEach(r => vistos.set(r.id, r));
  }

  if (lista.length) {
    const sinCategoria = await _conTraerTodo(() => _supabase.from('tesoreria_mbd').select(cols)
      .eq('empresa_id', empresaId)
      .or(`tipo_doc.is.null,tipo_doc.not.in.(${_CON_TIPOS_DOC_VALIDOS.join(',')})`)
      .in('entrega_doc', ['EMITIDO', 'OBSERVADO'])
      .not('nro_factura_doc', 'is', null).order('id'));
    const porNorm = new Map(lista.map(n => [_conNormNroDoc(n), n]));
    sinCategoria.forEach(r => {
      if (vistos.has(r.id)) return;
      const canonico = porNorm.get(_conNormNroDoc(r.nro_factura_doc));
      if (canonico) vistos.set(r.id, { ...r, nro_factura_doc: canonico });
    });
  }
  return { data: [...vistos.values()], error: null };
}

// ── Estado de conciliación bancaria de una lista de comprobantes de Compras o
//    Ventas, calculado EXACTAMENTE como lo muestra la pantalla (mismos movimientos
//    —incluidos los escritos a mano sin categoría—, mismo filtro de emisor, misma
//    cobertura N:M y el mismo POSIBLE). Lo usan las descargas (Exportar de cada
//    módulo y Histórico) para que el archivo diga lo mismo que el sistema y no una
//    escala distinta (Wendy, 2026-09-19: "no distorsionada, como están en el sistema").
//    `filas` = registros de contabilidad_compras/ventas; `campoNombre` = 'proveedor'
//    o 'cliente'. Devuelve, en el mismo orden: { estado5, cov, movs }.
async function _conEstadosCobertura(empresaId, categoria, filas, campoNombre) {
  const nroDe = r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
  const numeros = (filas || []).map(nroDe).filter(Boolean);
  const { data } = numeros.length
    ? await _conMovsDeComprobantes(empresaId, categoria, numeros,
        'nro_factura_doc,nro_operacion_bancaria,fecha_deposito,descripcion,monto,id,entrega_doc,ruc_dni,proveedor_empresa_personal')
    : { data: [] };
  const porNro = new Map();
  (data || []).forEach(m => { if (!porNro.has(m.nro_factura_doc)) porNro.set(m.nro_factura_doc, []); porNro.get(m.nro_factura_doc).push(m); });

  const base = (filas || []).map(r => {
    const movs = _conFiltrarPorEmisor(porNro.get(nroDe(r)), r.nro_doc_identidad, r[campoNombre]);
    return { movs, cov: _conCobertura(movs, r.total_cp) };
  });
  const hayPendientes = base.some(x => x.cov.estado === 'PENDIENTE');
  const candidatos = hayPendientes ? await _conCandidatosMontoDisponibles(empresaId) : [];
  const rotosMap = hayPendientes
    ? await _conMovsConNroCualquierEstado(empresaId, base.map((x, i) => x.cov.estado === 'PENDIENTE' ? nroDe(filas[i]) : null))
    : new Map();
  return base.map((x, i) => {
    const roto = x.cov.estado === 'PENDIENTE' && _conHayVinculoQueNoCuenta(rotosMap.get(nroDe(filas[i])), categoria, filas[i].nro_doc_identidad);
    return { ...x, roto,
      estado5: _conEstado5(x.cov, x.cov.estado === 'PENDIENTE' && !roto && _conHayCandidato(candidatos, filas[i].total_cp)) };
  });
}

// ── Los movimientos que CUENTAN para el estado de un comprobante de Compras/Ventas son los de
//    _conMovsDeComprobantes (categoría exacta + los sin categoría con el N° escrito en otro formato:
//    espacios, ceros, mayúsculas) filtrados por emisor. Los paneles "operaciones ya vinculadas" antes
//    solo buscaban el N° EXACTO, así que un movimiento contado en el estado (p. ej. un EXCESIVO)
//    podía no aparecer en el panel ni en el aviso de exceso (Wendy, 2026-09-19). Esta función une lo que
//    el panel ya lista con lo que cuenta el estado, sin repetir ninguno, para que se vea lo mismo.
async function _conUnirVinculos(base, empresaId, categoria, nro, ruc, nombre) {
  const lista = [...(base || [])];
  if (categoria !== 'COMPRA' && categoria !== 'VENTA') return lista;
  try {
    const { data } = await _conMovsDeComprobantes(empresaId, categoria, [nro],
      'id,nro_operacion_bancaria,fecha_deposito,monto,proveedor_empresa_personal,entrega_doc,tipo_doc,ruc_dni,nro_factura_doc');
    const vistos = new Set(lista.map(m => m.id));
    _conFiltrarPorEmisor(data, ruc, nombre).forEach(m => { if (!vistos.has(m.id)) { lista.push(m); vistos.add(m.id); } });
  } catch (e) { console.warn('[nexum] no se pudieron unir los vínculos del comprobante', e); }
  return lista;
}

// ── Comprobantes que YA están cubiertos por movimientos bancarios (APLICADO o
//    EXCESIVO según _conCobertura — misma regla que ven Compras/Ventas), para
//    que las sugerencias automáticas de Conciliación no los propongan de nuevo
//    (Wendy, 2026-09-19: "no me va a proponer algo que ya está consolidado").
//    PARCIAL y PENDIENTE siguen siendo candidatos (regla N:M: un comprobante
//    puede cubrirse con varios movimientos). Recibe los documentos ya
//    normalizados de con-conciliar.js (_tipo/_ndoc/_ruc/_proveedor/_total/id).
//    Devuelve un Set con los `id` de los documentos cubiertos.
async function _conDocsYaCubiertos(empresaId, documentos) {
  const cubiertos = new Set();
  const COLS = 'nro_factura_doc,monto,entrega_doc,ruc_dni,proveedor_empresa_personal';

  for (const cat of ['COMPRA', 'VENTA']) {
    const docs = documentos.filter(d => d._tipo === cat && d._ndoc && d._ndoc !== '—');
    if (!docs.length) continue;
    const { data } = await _conMovsDeComprobantes(empresaId, cat, docs.map(d => d._ndoc), COLS);
    const porNro = new Map();
    (data || []).forEach(m => { if (!porNro.has(m.nro_factura_doc)) porNro.set(m.nro_factura_doc, []); porNro.get(m.nro_factura_doc).push(m); });
    docs.forEach(d => {
      const movs = _conFiltrarPorEmisor(porNro.get(d._ndoc), d._ruc, d._proveedor);
      const e5 = _conEstado5(_conCobertura(movs, d._total), false);
      if (e5 === 'APLICADO' || e5 === 'EXCESIVO') cubiertos.add(d.id);
    });
  }

  // RH: el movimiento apunta al UUID del RH (vínculo por lupa) o a su N° legible
  // (carga por Excel; en ese caso se exige coincidencia estricta de nombre).
  const rhs = documentos.filter(d => d._tipo === 'RH');
  if (rhs.length) {
    const claves = [...new Set(rhs.flatMap(d => [d.id, d.numero_rh]).filter(Boolean))];
    const movs = [];
    for (let i = 0; i < claves.length; i += 80) {
      const { data } = await _supabase.from('tesoreria_mbd').select(COLS)
        .eq('empresa_id', empresaId).in('entrega_doc', ['EMITIDO', 'OBSERVADO'])
        .or(_conFiltroTipoDoc('RH')).in('nro_factura_doc', claves.slice(i, i + 80));
      movs.push(...(data || []));
    }
    rhs.forEach(d => {
      // Código único (datos antiguos) = inequívoco; N° legible = solo si el emisor coincide
      // (DNI exacto, o nombre si falta) — el mismo N° de RH lo usan varios emisores.
      const propios = movs.filter(m => m.nro_factura_doc === d.id
        || (d.numero_rh && m.nro_factura_doc === d.numero_rh && _conFiltrarPorEmisor([m], d._ruc, d._proveedor).length > 0));
      const e5 = _conEstado5(_conCobertura(propios, d._total), false);
      if (e5 === 'APLICADO' || e5 === 'EXCESIVO') cubiertos.add(d.id);
    });
  }
  return cubiertos;
}

// N° de comprobante comparable: sin espacios, mayúsculas y sin ceros a la
// izquierda en el correlativo ("f052 - 02073625" ≡ "F052-2073625").
function _conNormNroDoc(v) {
  const s = (v || '').toString().trim().toUpperCase().replace(/\s+/g, '');
  const i = s.indexOf('-');
  if (i < 0) return s;
  return `${s.slice(0, i)}-${s.slice(i + 1).replace(/^0+(?=\d)/, '')}`;
}

// ── Formato del N° de comprobante en Movimientos = el de Contabilidad: serie de hasta 4 caracteres,
//    guion y número SIN ceros a la izquierda (F001-118811, no F001-00118811). Contabilidad guarda el
//    número como entero, así que un N° con ceros no coincidía con su comprobante (Wendy, 2026-09-19).
//    Solo quita los ceros del número: nada más se toca (si no aplica, devuelve el texto tal cual).
function _conQuitarCerosNro(v) {
  const s = (v ?? '').toString();
  const m = s.trim().match(/^([A-Za-z0-9]{1,4})-0+([0-9]+)$/);
  return m ? `${m[1]}-${m[2]}` : s;
}

// Movimientos cuyo N° de comprobante lleva ceros a la izquierda. No se tocan las planillas (PM), los
// códigos internos ni los CANCELADOS. Los RH SÍ se incluyen (Wendy: ningún N° de RH empieza con ceros),
// salvo que en esta empresa exista algún RH cuyo N° guardado lleve ceros: en ese caso quitárselos al
// movimiento rompería el vínculo con ese RH, así que sus movimientos de RH se dejan tal cual.
function _conClasificarCerosNro(movs, rhs) {
  const rhConCeros = (rhs || []).some(r => (r.numero_rh || '') && _conQuitarCerosNro(r.numero_rh) !== r.numero_rh);
  return (movs || [])
    .filter(m => m.entrega_doc !== 'CANCELADO' && m.tipo_doc !== 'PM' && !_conEsUUID(m.nro_factura_doc)
      && !(m.tipo_doc === 'RH' && rhConCeros))
    .map(m => ({ mov: m, antes: m.nro_factura_doc, despues: _conQuitarCerosNro(m.nro_factura_doc) }))
    .filter(x => x.despues !== x.antes);
}

// Trae TODAS las filas (Supabase corta en 1000 por consulta).
async function _conTraerTodo(construir, pagina = 1000) {
  const out = [];
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await construir().range(desde, desde + pagina - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < pagina) break;
  }
  return out;
}

// ── Clasifica los movimientos con N° de comprobante pero sin categoría
//    válida. PURA (no toca la base de datos) para poder probarla sola.
//    Tipos de resultado:
//      seguro          → el N° calza con UN comprobante y el emisor coincide
//      sin_emisor      → el N° calza con UN comprobante pero RUC/nombre no
//                        coinciden (no se marca por defecto; Wendy decide)
//      ambiguo         → el N° calza con comprobantes de categorías distintas
//      sin_comprobante → ese N° no existe en Compras/Ventas/RH
//    Para los que sí calzan, predice cómo quedaría el comprobante en
//    Contabilidad (misma regla _conCobertura/_conEstado5, N:M incluido).
function _conClasificarVinculosSinCategoria(movs, compras, ventas, rhs) {
  const valido = m => _CON_TIPOS_DOC_VALIDOS.includes(m.tipo_doc);
  const cuenta = m => m.entrega_doc === 'EMITIDO' || m.entrega_doc === 'OBSERVADO';

  const idx = { COMPRA: new Map(), VENTA: new Map(), RH: new Map() };
  // Un comprobante importado dos veces (misma categoría + N° + RUC) es UNO solo:
  // no debe generar una falsa ambigüedad.
  const firma = c => `${c.cat}|${_conNormNroDoc(c.nro)}|${(c.ruc || '').toString().trim()}`;
  const alta = (cat, key, c) => {
    if (!key) return;
    if (!idx[cat].has(key)) idx[cat].set(key, []);
    const lista = idx[cat].get(key);
    if (!lista.includes(c) && !lista.some(x => firma(x) === firma(c))) lista.push(c);
  };
  (compras || []).forEach(c => {
    const nro = [c.serie_cdp, c.nro_cp_inicial].filter(Boolean).join('-');
    alta('COMPRA', _conNormNroDoc(nro), { cat: 'COMPRA', nro, nombre: c.proveedor || '', ruc: c.nro_doc_identidad || '', total: Number(c.total_cp) || 0 });
  });
  (ventas || []).forEach(v => {
    const nro = [v.serie_cdp, v.nro_cp_inicial].filter(Boolean).join('-');
    alta('VENTA', _conNormNroDoc(nro), { cat: 'VENTA', nro, nombre: v.cliente || '', ruc: v.nro_doc_identidad || '', total: Number(v.total_cp) || 0 });
  });
  (rhs || []).forEach(r => {
    const c = {
      cat: 'RH', nro: r.numero_rh || r.id,
      nombre: r.prestadores_servicios?.nombre || r.nombre_emisor || '',
      ruc: r.prestadores_servicios?.dni || r.nro_doc_emisor || '',
      total: Number(r.monto_neto) || 0,
    };
    alta('RH', _conNormNroDoc(r.numero_rh), c);
    alta('RH', _conNormNroDoc(r.id), c);
  });

  // Comprobantes que calzan con cada movimiento (y si el emisor coincide)
  const hitsDe = m => {
    const key = _conNormNroDoc(m.nro_factura_doc);
    const out = [];
    for (const cat of ['COMPRA', 'VENTA', 'RH']) {
      for (const c of (idx[cat].get(key) || [])) {
        out.push({ c, emisorOk: _conFiltrarPorEmisor([m], c.ruc, c.nombre).length > 0 });
      }
    }
    return out;
  };

  const lista = (movs || []).filter(m => (m.nro_factura_doc || '').toString().trim() && m.entrega_doc !== 'CANCELADO');
  const hitsPorMov = new Map();
  const miembros = new Map(); // comprobante → movimientos que hoy o mañana lo cubrirían
  lista.forEach(m => {
    const hits = hitsDe(m);
    hitsPorMov.set(m.id, hits);
    // Un movimiento con N° de comprobante que figura PENDIENTE también lo cubrirá al repararlo (su estado pasa a
    // OBSERVADO/EMITIDO por la regla de 14 campos), así que entra en la predicción del estado del comprobante.
    hits.filter(h => h.emisorOk && (!valido(m) || m.tipo_doc === h.c.cat)).forEach(h => {
      if (!miembros.has(h.c)) miembros.set(h.c, []);
      miembros.get(h.c).push(m);
    });
  });

  const items = [];
  for (const m of lista) {
    // Compras/Ventas YA categorizados también entran, pero solo si su comprobante (uno solo, de esa
    // categoría) no los reconoce por el emisor — p. ej. el nombre del banco es el de quien recibió el
    // depósito y no tiene RUC (2026-09-19). Los que ya calzan, y RH/PM, quedan fuera como siempre.
    const yaCategorizado = m.tipo_doc === 'COMPRA' || m.tipo_doc === 'VENTA';
    if (valido(m) && !yaCategorizado) continue;
    // Los N° guardados como código único (UUID) los atiende el bloque "UUID → N° legible"
    // del reporte (_conClasificarUUIDsRH), no este.
    if (_conEsUUID(m.nro_factura_doc)) continue;
    let hits = hitsPorMov.get(m.id) || [];
    if (yaCategorizado) {
      hits = hits.filter(h => h.c.cat === m.tipo_doc);
      // Nada que reparar si ya calza por emisor, ya cuenta (EMITIDO/OBSERVADO) y su N° es el mismo del comprobante.
      if (hits.length !== 1 || (hits[0].emisorOk && cuenta(m) && (m.nro_factura_doc || '').toString().trim() === hits[0].c.nro)) continue;
    }
    const conEmis = hits.filter(h => h.emisorOk);

    // Se decide por COMPROBANTES distintos (no solo por categoría): dos emisores
    // distintos pueden compartir el mismo N° dentro de la misma categoría (ej. el
    // mismo RH de dos personas). Un N° compartido no se "adivina": se pregunta.
    let tipo, elegido = null, candidatos = [];
    if (conEmis.length === 1)      { tipo = 'seguro';     elegido = conEmis[0].c; }
    else if (conEmis.length > 1)   { tipo = 'ambiguo';    candidatos = conEmis.map(h => h.c); }
    else if (hits.length === 1)    { tipo = 'sin_emisor'; elegido = hits[0].c; }
    else if (hits.length > 1)      { tipo = 'ambiguo';    candidatos = hits.map(h => h.c); }
    else                           { tipo = 'sin_comprobante'; }

    const item = { mov: m, tipo, categoria: null, comprobante: null, cuentaEnConta: cuenta(m),
                   nroCanonico: null, cambiaNro: false, cov: null, estado5: null, candidatos,
                   rucConflicto: false, marcarPorDefecto: false, corregirEstado: false, estadoNuevo: null };
    if (elegido) {
      _conAsignarCandidato(item, elegido);
      if (tipo === 'seguro') {
        item.cov = _conCobertura(miembros.get(elegido) || [], elegido.total);
        item.estado5 = _conEstado5(item.cov, false);
      }
      if (tipo === 'sin_emisor') {
        // Mismo N° de un único comprobante, pero el nombre del movimiento es el de quien recibió el
        // depósito (pago a terceros), no el del emisor. Es seguro pre-marcarlo solo si además el RUC
        // no lo contradice y el monto es exactamente el del comprobante (2026-09-19).
        const rucMov = (m.ruc_dni || '').toString().trim(), rucComp = (elegido.ruc || '').toString().trim();
        item.rucConflicto = !!(rucMov && rucComp && rucMov !== rucComp);
        item.marcarPorDefecto = (elegido.cat === 'COMPRA' || elegido.cat === 'VENTA')
          && Math.abs(Math.abs(Number(m.monto) || 0) - (Number(elegido.total) || 0)) <= 0.01;
      }
      // Movimiento con N° de comprobante pero en estado PENDIENTE (o vacío): no cuenta para su comprobante, que se
      // queda PENDIENTE/POSIBLE aunque ya esté pagado. Con N° presente la regla de 14 campos nunca da PENDIENTE
      // (EMITIDO si tiene todo, OBSERVADO si falta algo), así que el estado se corrige a lo que dice esa regla.
      if (!cuenta(m) && (tipo === 'seguro' || tipo === 'sin_emisor')) {
        const sincroniza = elegido.cat === 'COMPRA' || elegido.cat === 'VENTA';
        const rt = sincroniza ? _resolverProveedorTitular(m.proveedor_empresa_personal, elegido.nombre, m.ruc_dni, elegido.ruc) : null;
        const nuevo = _conEvalCompletitud14({
          ...m, nro_factura_doc: item.nroCanonico, tipo_doc: item.categoria,
          tipo_comprobante: m.tipo_comprobante || _conCodigoTipoDoc(item.categoria, item.nroCanonico),
          ...(rt ? { proveedor_empresa_personal: rt.proveedor, ruc_dni: rt.ruc } : {}),
        });
        if (nuevo === 'EMITIDO' || nuevo === 'OBSERVADO') { item.corregirEstado = true; item.estadoNuevo = nuevo; }
      }
    }
    items.push(item);
  }
  return items;
}

// Fija en el item el comprobante elegido (por el sistema o por Wendy).
// El N° escrito a mano puede diferir en formato (espacios, ceros, minúsculas);
// Contabilidad busca por igualdad exacta, así que se normaliza al del comprobante.
// RH conserva su forma (puede ser UUID o N° legible, ambos válidos).
function _conAsignarCandidato(item, c) {
  item.comprobante = c;
  item.categoria   = c.cat;
  // Siempre el N° LEGIBLE del comprobante (también RH): el emisor lo distingue, ya no un código.
  item.nroCanonico = c.nro;
  item.cambiaNro   = item.mov.nro_factura_doc !== c.nro;
}

// ── Tarjeta de un comprobante candidato (compartida por el aviso interactivo
//    de ambigüedad y por el reporte de "Reparar estados"). Acepta la forma de
//    candidato de este archivo {cat,nro,nombre,ruc,total,fecha} y la de
//    migracion-datos.js {tipoDoc,proveedor,ruc,monto}.
const _CON_NOMBRE_CATEGORIA = { COMPRA: 'Compras', VENTA: 'Ventas', RH: 'RH Recibidos' };
function _conHtmlCandidato(c, { name, value, checked = false, destacado = false } = {}) {
  const cat    = c.cat || c.tipoDoc;
  const nombre = c.nombre ?? c.proveedor ?? '';
  const total  = c.total ?? c.monto ?? 0;
  return `
    <label style="display:flex;gap:10px;align-items:flex-start;border:1px solid ${destacado ? 'var(--color-secundario)' : 'var(--color-borde)'};border-radius:8px;padding:10px 12px;margin-top:6px;cursor:pointer">
      <input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} style="margin-top:3px">
      <div style="flex:1;min-width:0;font-size:12px">
        <div style="font-weight:700;color:var(--color-secundario)">${escapar(_CON_NOMBRE_CATEGORIA[cat] || cat)} · ${escapar(c.nro || '')}</div>
        <div>${escapar(nombre || '—')} · RUC/DNI ${escapar(c.ruc || '—')}</div>
        <div style="color:var(--color-texto-suave)">Total ${formatearMoneda(total)}${c.fecha ? ' · emitido ' + formatearFecha(c.fecha) : ''}</div>
      </div>
    </label>`;
}

// ── Aviso interactivo cuando un mismo N° corresponde a VARIOS comprobantes
//    (Wendy, 2026-09-19: p. ej. la factura E001-156 y un RH E001-156, o el mismo
//    RH de dos emisores distintos — el sistema no adivina, pregunta cuál se
//    quiere vincular). Se abre SOBRE la pantalla actual (no reemplaza el
//    formulario que se está llenando). Resuelve con el candidato elegido, o
//    null si cancela. `ctx` = { nro, proveedor, ruc, monto, nroOperacion }.
function _conElegirComprobante(candidatos, ctx = {}) {
  return new Promise(resolve => {
    const puntaje = c => {
      const ruc = (ctx.ruc || '').toString().trim();
      let p = 0;
      if (ruc && String(c.ruc || '').trim() === ruc) p += 100;
      if (ctx.proveedor && typeof _tercNombreNorm === 'function'
          && _tercNombreNorm(ctx.proveedor) === _tercNombreNorm(c.nombre ?? c.proveedor)) p += 50;
      if (ctx.monto && Math.abs(Math.abs(Number(ctx.monto)) - Math.abs(Number(c.total ?? c.monto))) < 0.01) p += 30;
      return p;
    };
    const ordenados = candidatos.map(c => ({ c, p: puntaje(c) })).sort((a, b) => b.p - a.p);
    const sugerido  = ordenados[0].p > 0 && ordenados[0].p > (ordenados[1]?.p || 0) ? 0 : -1;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px';
    overlay.innerHTML = `
      <div style="background:var(--color-bg-card);border-radius:12px;padding:22px 24px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--sombra-lg);border:1px solid var(--color-borde)">
        <div style="font-size:15px;font-weight:700;color:var(--color-texto);margin-bottom:8px">⚠️ ${candidatos.length} comprobantes distintos comparten el N° ${escapar(ctx.nro || '')}</div>
        <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 6px;line-height:1.5">
          Un mismo N° puede repetirse entre emisores distintos (por ejemplo una factura y un RH, o el mismo RH de dos personas). Indica cuál es el que quieres vincular${ctx.nroOperacion || ctx.proveedor ? ' a este movimiento' : ''}:
        </p>
        ${(ctx.nroOperacion || ctx.proveedor || ctx.monto) ? `<div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:6px">Movimiento: ${escapar(ctx.nroOperacion ? 'Op. ' + ctx.nroOperacion + ' · ' : '')}${escapar(ctx.proveedor || '—')}${ctx.ruc ? ' · RUC/DNI ' + escapar(ctx.ruc) : ''}${ctx.monto ? ' · ' + formatearMoneda(ctx.monto) : ''}</div>` : ''}
        ${ordenados.map((o, i) => _conHtmlCandidato(o.c, { name: 'elegir-comp', value: i, checked: i === sugerido, destacado: i === sugerido })).join('')}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button id="elegir-cancel" class="btn btn-secundario">Cancelar</button>
          <button id="elegir-ok" class="btn btn-primario">Vincular el seleccionado</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const ok = overlay.querySelector('#elegir-ok');
    const habilitar = () => { ok.disabled = !overlay.querySelector('input[name="elegir-comp"]:checked'); };
    overlay.querySelectorAll('input[name="elegir-comp"]').forEach(r => r.addEventListener('change', habilitar));
    habilitar();
    const cerrar = v => { overlay.remove(); resolve(v); };
    ok.onclick = () => cerrar(ordenados[Number(overlay.querySelector('input[name="elegir-comp"]:checked').value)].c);
    overlay.querySelector('#elegir-cancel').onclick = () => cerrar(null);
  });
}

// ── Paso 0 de "🔧 Reparar estados": detecta, MUESTRA y solo con aprobación
//    asigna la categoría (tipo_doc) faltante o dañada. Antes esto corría en
//    silencio y, además, dependía de _migBuscarComprobante — que solo se
//    carga en Tesorería —, así que desde Contabilidad NUNCA hacía nada.
//    Devuelve { cancelado } o { aplicados, sinResolver }.
async function _conRevisarVinculosSinCategoria(empId, hoy) {
  const [movs, compras, ventas, rhs] = await Promise.all([
    _conTraerTodo(() => _supabase.from('tesoreria_mbd')
      .select('id,nro_factura_doc,tipo_doc,tipo_comprobante,entrega_doc,monto,ruc_dni,proveedor_empresa_personal,titular_comprobante,nro_operacion_bancaria,fecha_deposito,descripcion,moneda,cotizacion,oc,proyecto,concepto,empresa,autorizacion')
      .eq('empresa_id', empId).not('nro_factura_doc', 'is', null).order('id')),
    _conTraerTodo(() => _supabase.from('contabilidad_compras')
      .select('serie_cdp,nro_cp_inicial,proveedor,nro_doc_identidad,total_cp').eq('empresa_id', empId).order('id')),
    _conTraerTodo(() => _supabase.from('contabilidad_ventas')
      .select('serie_cdp,nro_cp_inicial,cliente,nro_doc_identidad,total_cp').eq('empresa_id', empId).order('id')),
    _conTraerTodo(() => _supabase.from('rh_registros')
      .select('id,numero_rh,nombre_emisor,nro_doc_emisor,monto_neto,prestadores_servicios(nombre,dni)')
      .eq('empresa_operadora_id', empId).order('id')),
  ]);

  const items = _conClasificarVinculosSinCategoria(movs, compras, ventas, rhs);

  // Movimientos YA vinculados (categoría COMPRA/VENTA/RH correcta) con el "Tipo DOC"
  // vacío: se les completa con el código de la lista (FA/BO/RH). Wendy, 2026-09-19:
  // "los comprobantes no se llaman COMPRAS, son facturas → en la lista es FA; si es RH → RH".
  const faltantesTipo = movs
    .filter(m => ['COMPRA', 'VENTA', 'RH'].includes(m.tipo_doc) && !(m.tipo_comprobante || '').toString().trim()
      && m.entrega_doc !== 'CANCELADO' && (m.nro_factura_doc || '').toString().trim())
    .map(m => ({ ...m, _codigo: _conCodigoTipoDoc(m.tipo_doc, m.nro_factura_doc) }));

  // RH guardados con el código único (UUID) → se pueden pasar a su N° legible (Wendy, 2026-09-19:
  // "no quiero que exista el código UUID, debe ser legible"). Y estados que no calzan con la
  // regla de los 14 campos (opcional, sin marcar por defecto).
  const uuidItems = _conClasificarUUIDsRH(movs, rhs);
  const estados14 = _conClasificarEstados14(movs);
  const cerosItems = _conClasificarCerosNro(movs, rhs);

  if (!items.length && !faltantesTipo.length && !uuidItems.length && !estados14.length && !cerosItems.length) {
    return { idsAprobados: new Set(), aplicados: 0, sinResolver: 0, tipoCompletados: 0, uuidConvertidos: 0, uuidSinConvertir: 0, estadosReevaluados: 0, cerosQuitados: 0 };
  }

  const decision = await _conModalVinculosSinCategoria(items, faltantesTipo, { uuids: uuidItems, estados14, ceros: cerosItems });
  if (!decision) return { cancelado: true };

  // Respaldo ANTES de tocar nada (Wendy, 2026-09-19: "¿esto va a borrar lo que he conciliado?"): se
  // descarga una copia de TODOS los movimientos tal como están. Si no se puede guardar, no se cambia nada.
  if (decision.items.length || decision.completarTipo || decision.convertirUUIDs || decision.reevaluar14 || decision.quitarCeros || decision.corregirEstados) {
    try {
      const n = await _conRespaldarMovimientos(empId, hoy);
      mostrarToast(`📥 Respaldo descargado (${n} movimientos) antes de aplicar los cambios.`, 'info');
    } catch (e) {
      console.error('[consolidacion-estados] respaldo', e);
      mostrarToast('No se pudo descargar el respaldo, por eso NO se cambió nada. Inténtalo de nuevo.', 'error');
      return { cancelado: true };
    }
  }

  let aplicados = 0;
  for (const it of decision.items) {
    const patch = { tipo_doc: it.categoria, fecha_actualizacion: hoy };
    if (!it.mov.tipo_comprobante) {
      // El bug del modal escribió en tipo_doc UNO DE LOS CÓDIGOS del desplegable "Tipo DOC"
      // (ej. 'FA'): es justo lo que se eligió como tipo de comprobante, así que se conserva
      // en tipo_comprobante en vez de perderlo. Si no era un código, se deduce de la categoría.
      patch.tipo_comprobante = _CON_CODIGOS_TIPO_COMPROBANTE.includes(it.mov.tipo_doc)
        ? it.mov.tipo_doc
        : _conCodigoTipoDoc(it.categoria, it.nroCanonico);
    }
    if (it.cambiaNro) patch.nro_factura_doc = it.nroCanonico;
    // Estado de un movimiento con N° pero PENDIENTE → el que da la regla de 14 campos (solo si sigue PENDIENTE/vacío).
    if (decision.corregirEstados && it.corregirEstado && it.estadoNuevo && !['EMITIDO', 'OBSERVADO', 'CANCELADO'].includes(it.mov.entrega_doc)) patch.entrega_doc = it.estadoNuevo;
    const { error } = await _supabase.from('tesoreria_mbd').update(patch).eq('id', it.mov.id);
    if (!error) aplicados++;
  }

  // Tipo DOC vacío en ya vinculados: un update por código (FA / BO / RH), en trozos.
  let tipoCompletados = 0;
  if (decision.completarTipo) {
    for (const codigo of ['FA', 'BO', 'RH']) {
      const ids = faltantesTipo.filter(m => m._codigo === codigo).map(m => m.id);
      for (let i = 0; i < ids.length; i += 80) {
        const { error } = await _supabase.from('tesoreria_mbd')
          .update({ tipo_comprobante: codigo, fecha_actualizacion: hoy })
          .eq('empresa_id', empId).is('tipo_comprobante', null).in('id', ids.slice(i, i + 80));
        if (!error) tipoCompletados += Math.min(80, ids.length - i);
      }
    }
  }

  // UUID → N° legible (solo los que se pueden distinguir sin ambigüedad; el resto queda igual).
  let uuidConvertidos = 0;
  const convertidosIds = new Set();
  if (decision.convertirUUIDs) {
    const aConvertir = uuidItems.filter(u => u.ok);
    for (let i = 0; i < aConvertir.length; i += 10) {
      await Promise.all(aConvertir.slice(i, i + 10).map(async u => {
        const patch = { nro_factura_doc: u.nuevoNro, tipo_doc: 'RH', fecha_actualizacion: hoy };
        if (!(u.mov.tipo_comprobante || '').toString().trim()) patch.tipo_comprobante = 'RH';
        if (u.cambiaRuc && u.nuevoRuc) patch.ruc_dni = u.nuevoRuc;
        const { error } = await _supabase.from('tesoreria_mbd').update(patch).eq('id', u.mov.id);
        if (!error) { uuidConvertidos++; convertidosIds.add(u.mov.id); }
      }));
    }
  }

  // Re-evaluar EMITIDO/OBSERVADO con la regla de 14 campos (solo si Wendy lo marcó).
  let estadosReevaluados = 0;
  if (decision.reevaluar14) {
    for (const estado of ['EMITIDO', 'OBSERVADO']) {
      const ids = estados14.filter(x => x.nuevo === estado && !convertidosIds.has(x.mov.id)).map(x => x.mov.id);
      for (let i = 0; i < ids.length; i += 80) {
        const { error } = await _supabase.from('tesoreria_mbd')
          .update({ entrega_doc: estado, fecha_actualizacion: hoy })
          .eq('empresa_id', empId).in('id', ids.slice(i, i + 80));
        if (!error) estadosReevaluados += Math.min(80, ids.length - i);
      }
    }
  }
  // Quitar ceros a la izquierda del N° (solo si el N° sigue igual que cuando se revisó).
  let cerosQuitados = 0;
  if (decision.quitarCeros) {
    for (let i = 0; i < cerosItems.length; i += 10) {
      await Promise.all(cerosItems.slice(i, i + 10).map(async c => {
        const { data, error } = await _supabase.from('tesoreria_mbd')
          .update({ nro_factura_doc: c.despues, fecha_actualizacion: hoy })
          .eq('id', c.mov.id).eq('empresa_id', empId).eq('nro_factura_doc', c.antes).select('id');
        if (!error && data && data.length) cerosQuitados++; // solo cuenta las filas realmente actualizadas
      }));
    }
  }
  return {
    cerosQuitados,
    // Solo estos movimientos (los que Wendy aprobó) se sincronizan después con el emisor de su comprobante.
    idsAprobados: new Set(decision.items.map(it => it.mov.id)),
    aplicados, sinResolver: items.length - aplicados, tipoCompletados, uuidConvertidos,
    uuidSinConvertir: uuidItems.filter(u => !u.ok).length + (decision.convertirUUIDs ? 0 : uuidItems.filter(u => u.ok).length),
    estadosReevaluados,
  };
}

// ── Respaldo de seguridad: descarga un .json con TODAS las filas de tesoreria_mbd de la empresa tal como están
//    ahora (todas las columnas), para poder revertir cualquier reparación. Devuelve cuántas filas guardó.
async function _conRespaldarMovimientos(empId, hoy) {
  const filas = await _conTraerTodo(() => _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empId).order('id'));
  const contenido = JSON.stringify({ generado: new Date().toISOString(), tabla: 'tesoreria_mbd', empresa_id: empId, total: filas.length, filas }, null, 1);
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo_movimientos_antes_de_reparar_${hoy}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return filas.length;
}

// ── Paso B: los RH vinculados con el código único (UUID) se pasan a su N° legible.
//    PURA (no toca la base de datos). Un N° de RH se repite entre emisores (E001-6 puede ser
//    de 7 personas), así que el N° legible solo es seguro si el RH se distingue por su emisor:
//      - con DNI: no debe existir OTRO RH con el mismo N° y el mismo DNI (o, si el otro no
//        tiene DNI, el mismo nombre) → si existe, es un posible RH duplicado y NO se convierte;
//      - sin DNI: solo si nadie más usa ese N°.
//    Al convertir, el DNI del movimiento se iguala al del emisor del RH (misma regla de todas
//    las vinculaciones: el dato del comprobante manda) para que el vínculo se reconozca por
//    N° + emisor. Lo que no se puede convertir queda intacto y se explica por qué.
function _conClasificarUUIDsRH(movs, rhs) {
  const dniDe = r => (r.nro_doc_emisor || r.prestadores_servicios?.dni || '').toString().replace(/\D/g, '');
  const nomDe = r => _tercNombreNorm(r.nombre_emisor || r.prestadores_servicios?.nombre || '');
  const porId = new Map((rhs || []).map(r => [String(r.id).toLowerCase(), r]));
  const porNro = new Map();
  (rhs || []).forEach(r => {
    const k = _conNormNroDoc(r.numero_rh);
    if (!k) return;
    if (!porNro.has(k)) porNro.set(k, []);
    porNro.get(k).push(r);
  });

  const out = [];
  for (const m of movs || []) {
    if (!_conEsUUID(m.nro_factura_doc) || m.entrega_doc === 'CANCELADO') continue;
    const rh = porId.get(String(m.nro_factura_doc).trim().toLowerCase());
    const item = { mov: m, rh: rh || null, ok: false, motivo: '', nuevoNro: null, nuevoRuc: null, cambiaRuc: false };
    if (!rh) { item.motivo = 'El código no corresponde a ningún RH de esta empresa'; out.push(item); continue; }
    const nro = (rh.numero_rh || '').toString().trim();
    if (!nro) { item.motivo = 'Ese RH no tiene N° de RH'; out.push(item); continue; }

    const otros = (porNro.get(_conNormNroDoc(nro)) || []).filter(o => o !== rh);
    const dni = dniDe(rh), nombre = nomDe(rh);
    if (dni) {
      const igual = otros.some(o => dniDe(o) === dni || (!dniDe(o) && nombre && nomDe(o) === nombre));
      if (igual) { item.motivo = 'Hay otro RH con el mismo N° y el mismo emisor (posible RH duplicado)'; out.push(item); continue; }
    } else if (otros.length) {
      item.motivo = 'Ese RH no tiene DNI y otros emisores usan el mismo N°: no se puede distinguir'; out.push(item); continue;
    }
    item.ok = true;
    item.nuevoNro = nro;
    if (dni) {
      item.nuevoRuc  = (rh.nro_doc_emisor || rh.prestadores_servicios?.dni || '').toString().trim();
      item.cambiaRuc = (m.ruc_dni || '').toString().replace(/\D/g, '') !== dni;
    }
    out.push(item);
  }
  return out;
}

// ── Movimientos ya vinculados (EMITIDO/OBSERVADO) cuyo estado no coincide con la regla de los
//    14 campos (_conEvalCompletitud14). PURA. "Reparar estados" re-evalúa con la regla histórica
//    de 5 campos; esta es la regla vigente de todo lo nuevo. Se ofrece aparte y sin marcar.
function _conClasificarEstados14(movs) {
  return (movs || [])
    .filter(m => ['COMPRA', 'VENTA', 'RH'].includes(m.tipo_doc)
      && (m.nro_factura_doc || '').toString().trim()
      && (m.entrega_doc === 'EMITIDO' || m.entrega_doc === 'OBSERVADO'))
    .map(m => ({ mov: m, actual: m.entrega_doc, nuevo: _conEvalCompletitud14(m) }))
    .filter(x => x.nuevo !== x.actual && (x.nuevo === 'EMITIDO' || x.nuevo === 'OBSERVADO'));
}

// Códigos de tipo de comprobante = los del desplegable "Tipo DOC" de Movimientos.
const _CON_CODIGOS_TIPO_COMPROBANTE = ['FA', 'BO', 'BP', 'RH', 'TK', 'PM', 'AT', 'DL', 'PJ', 'SB', 'VB', 'OT'];
// Código de la lista según la categoría interna: factura→FA (BO si la serie empieza con B),
// RH→RH, PM→PM. NUNCA devuelve COMPRA/VENTA (eso es la categoría, no el tipo de comprobante).
function _conCodigoTipoDoc(categoria, nroDoc) {
  if (categoria === 'RH') return 'RH';
  if (categoria === 'PM') return 'PM';
  return String(nroDoc || '').trim().toUpperCase().startsWith('B') ? 'BO' : 'FA';
}

// Reporte previo (regla de Wendy: reporte + aprobación antes de tocar datos
// existentes). Resuelve con lo aprobado, o null si cancela.
//
// Diseño simple (Wendy, 2026-09-19: "no se ha utilizado, está complicado"): antes eran cientos de
// tarjetas en una sola lista. Ahora hay un resumen en lenguaje claro, secciones plegables (lo seguro ya
// viene marcado), el botón dice cuántos cambios va a hacer, y lo que no se puede reparar aquí (N° que no
// existe en Contabilidad) va aparte, sin casillas. El contrato de salida es el mismo de siempre.
function _conModalVinculosSinCategoria(items, faltantesTipo = [], extras = {}) {
  return new Promise(resolve => {
    const mc = document.getElementById('modal-container');
    if (!mc) { resolve(null); return; }
    const uuids = extras.uuids || [];
    const estados14 = extras.estados14 || [];
    const ceros = extras.ceros || [];

    const NOMBRE_CAT = { COMPRA: 'Compras', VENTA: 'Ventas', RH: 'RH Recibidos' };
    const indexados = items.map((it, i) => ({ it, i }));
    const de = t => indexados.filter(x => x.it.tipo === t);
    const seguros = de('seguro'), terceros = de('sin_emisor'), ambiguos = de('ambiguo'), sinComp = de('sin_comprobante');
    const preMarcado = x => x.it.tipo === 'seguro' || x.it.marcarPorDefecto;

    const linea = m => `Op. ${escapar(m.nro_operacion_bancaria || '—')} · ${formatearFecha(m.fecha_deposito)} · ${formatearMoneda(m.monto)} · ${escapar(m.entrega_doc || '—')}`;
    const titulo = it => `<strong style="color:var(--color-secundario)">${escapar(_conLegible(it.mov.nro_factura_doc))}</strong> · ${escapar(it.mov.proveedor_empresa_personal || '—')}`;

    // Una fila compacta (una casilla) para los que se pueden reparar.
    const fila = ({ it, i }) => {
      const m = it.mov, c = it.comprobante;
      const cv = it.categoria === 'COMPRA' || it.categoria === 'VENTA';
      let nota = '';
      const cambio = it.corregirEstado
        ? `⚠️ Está ${escapar(m.entrega_doc || 'PENDIENTE')} aunque ya tiene N° de comprobante (por eso su comprobante no lo cuenta). Con la opción «Pasar a OBSERVADO/EMITIDO» de arriba quedaría <strong>${it.estadoNuevo}</strong>. ` : '';
      if (it.estado5) {
        nota = cambio + `${it.corregirEstado ? 'Y en Contabilidad quedaría' : 'En Contabilidad quedará'} <strong style="color:${_CON_ESTADO5_COLOR[it.estado5]}">${_CON_ESTADO5_ICONO[it.estado5]} ${it.estado5}</strong> (${formatearMoneda(it.cov.suma)} de ${formatearMoneda(it.cov.total)}).`;
      } else if (cambio) {
        nota = cambio;
      }
      if (it.tipo === 'sin_emisor') {
        if (cv) {
          nota = cambio + `Pago a tercero: el Proveedor y el RUC pasan a ser los del comprobante y «${escapar(m.proveedor_empresa_personal || '—')}» ${(m.titular_comprobante || '').toString().trim() ? `se agrega a lo que ya tenía en «A quién se depositó» («${escapar(m.titular_comprobante)}»)` : 'queda en «A quién se depositó»'}.${it.rucConflicto ? ` Su RUC/DNI (${escapar(m.ruc_dni)}) se reemplaza por el del comprobante (${escapar(c.ruc || '—')}).` : ''}`
            + (it.marcarPorDefecto ? '' : ' Su monto no es el total del comprobante (¿pago parcial?): márcalo solo si es el correcto.');
        } else {
          nota = cambio + 'El RUC/nombre no coincide con el comprobante: márcalo solo si es el correcto.';
        }
      }
      return `
        <label style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid var(--color-borde);cursor:pointer">
          <input type="checkbox" class="rev-chk" data-i="${i}" data-g="${it.tipo}" ${preMarcado({ it }) ? 'checked' : ''} style="margin-top:3px">
          <div style="flex:1;min-width:0;font-size:12px">
            <div>${titulo(it)}${c ? ` <span style="color:var(--color-texto-suave)">→ ${NOMBRE_CAT[it.categoria] || ''}: ${escapar(c.nombre || '—')}</span>` : ''}</div>
            <div style="font-size:11px;color:var(--color-texto-suave);font-family:monospace">${linea(m)}</div>
            ${nota ? `<div style="font-size:11px;margin-top:2px;${it.rucConflicto ? 'color:#C05621' : ''}">${nota}</div>` : ''}
          </div>
        </label>`;
    };

    // N° compartido por varios comprobantes: hay que elegir cuál (o no tocarlo).
    const filaAmbigua = ({ it, i }) => `
      <div style="padding:8px 10px;border-bottom:1px solid var(--color-borde)">
        <div style="font-size:12px">${titulo(it)}</div>
        <div style="font-size:11px;color:var(--color-texto-suave);font-family:monospace">${linea(it.mov)}</div>
        <div style="font-size:11px;color:#C05621;margin:2px 0">Ese N° lo comparten varios comprobantes. Elige cuál es; si no eliges ninguno, no se toca.</div>
        ${it.candidatos.map((cand, k) => _conHtmlCandidato(cand, { name: `rev-cand-${i}`, value: k })).join('')}
      </div>`;

    // Sin comprobante: solo informativo, no hay nada que aprobar.
    const filaInfo = ({ it }) => `
      <div style="padding:6px 10px;border-bottom:1px solid var(--color-borde);font-size:12px">
        ${titulo(it)}<div style="font-size:11px;color:var(--color-texto-suave);font-family:monospace">${linea(it.mov)}</div>
      </div>`;

    const seccion = (id, icono, texto, ayuda, lista, cuerpo, { abierto = false, botones = false } = {}) => !lista ? '' : `
      <details ${abierto ? 'open' : ''} style="border:1px solid var(--color-borde);border-radius:10px;margin-bottom:10px">
        <summary style="cursor:pointer;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:13px">${icono} ${texto} <span style="color:var(--color-texto-suave);font-weight:400">(${lista})</span></span>
          <span class="rev-cont" data-g="${id}" style="font-size:11px;color:var(--color-texto-suave)"></span>
        </summary>
        <div style="padding:0 14px 12px">
          <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 8px;line-height:1.5">${ayuda}</p>
          ${botones ? `<div style="font-size:11px;margin-bottom:6px">
            <span class="rev-todos" data-g="${id}" data-v="1" style="cursor:pointer;text-decoration:underline;color:var(--color-secundario)">Marcar todos</span> ·
            <span class="rev-todos" data-g="${id}" data-v="0" style="cursor:pointer;text-decoration:underline;color:var(--color-secundario)">Quitar todos</span></div>` : ''}
          <div style="max-height:280px;overflow-y:auto;border:1px solid var(--color-borde);border-radius:8px">${cuerpo}</div>
        </div>
      </details>`;

    // ── Arreglos de formato (una casilla por tipo de arreglo; data-n = cuántos cambios hace) ──
    const uuidOk = uuids.filter(u => u.ok), uuidNo = uuids.filter(u => !u.ok);
    const a_obs = estados14.filter(x => x.nuevo === 'OBSERVADO').length;
    const a_emi = estados14.filter(x => x.nuevo === 'EMITIDO').length;
    const opcion = (id, marcado, n, titular, detalle) => `
      <label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--color-borde);cursor:pointer">
        <input type="checkbox" id="${id}" data-n="${n}" ${marcado && n ? 'checked' : ''} ${n ? '' : 'disabled'} style="margin-top:3px">
        <div style="font-size:12px;line-height:1.5"><strong>${titular}</strong><div style="color:var(--color-texto-suave)">${detalle}</div></div>
      </label>`;
    const opciones = [
      ceros.length ? opcion('rev-ceros', true, ceros.length,
        `Quitar ceros a la izquierda del N° de comprobante — ${ceros.length} movimiento(s)`,
        'F001-00118811 pasa a F001-118811, igual que en Contabilidad. Solo se quitan los ceros; nada más cambia.') : '',
      uuidOk.length || uuidNo.length ? opcion('rev-uuid', uuidOk.length > 0, uuidOk.length,
        `RH guardados con un código interno: ${uuidOk.length} se pasan a su N° legible${uuidNo.length ? ` (${uuidNo.length} no se pueden distinguir con seguridad y quedan igual)` : ''}`,
        'El N° del movimiento pasa del código al N° del RH (ej. E001-6) y su DNI se iguala al del emisor.') : '',
      faltantesTipo.length ? opcion('rev-tipo', true, faltantesTipo.length,
        `Completar «Tipo DOC» vacío — ${faltantesTipo.length} movimiento(s)`,
        `${['FA', 'BO', 'RH'].map(cod => { const n = faltantesTipo.filter(m => m._codigo === cod).length; return n ? `${n} → ${cod}` : ''; }).filter(Boolean).join(' · ')}. Solo se llena el vacío; nunca se cambia uno ya elegido.`) : '',
      items.some(i => i.corregirEstado) ? opcion('rev-estpend', false, items.filter(i => i.corregirEstado).length,
        `(Opcional) Pasar a OBSERVADO/EMITIDO los ${items.filter(i => i.corregirEstado).length} movimientos que ya tienen N° de comprobante pero figuran PENDIENTE`,
        'Por eso su comprobante no los cuenta y sigue Pendiente/Posible. Viene sin marcar: en Movimientos los verás con una alerta ⚠️ para corregirlos tú. Si lo marcas, cada uno pasa a EMITIDO (si tiene sus 14 campos) o a OBSERVADO (si le falta alguno).') : '',
      estados14.length ? opcion('rev-est14', false, estados14.length,
        `(Opcional) Re-evaluar el estado con la regla de los 14 campos — ${estados14.length} movimiento(s)`,
        `${a_obs} pasarían de EMITIDO a OBSERVADO (les falta algún dato) y ${a_emi} de OBSERVADO a EMITIDO. No afecta a Contabilidad; por eso viene sin marcar.`) : '',
    ].join('');
    const nOpciones = [ceros, uuids, faltantesTipo, estados14, items.filter(i => i.corregirEstado)].filter(a => a.length).length;

    const hayAlgo = seguros.length || terceros.length || ambiguos.length || opciones;
    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex">
        <div class="modal" style="max-width:820px;width:95%;max-height:90vh;display:flex;flex-direction:column">
          <div class="modal-header">
            <h3>🔧 Reparar estados</h3>
            <button class="modal-cerrar" id="rev-x">✕</button>
          </div>
          <div class="modal-body" style="flex:1;overflow-y:auto">
            <div style="background:rgba(72,187,120,.1);border:1px solid rgba(72,187,120,.4);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.6">
              <strong>Lo seguro ya viene marcado.</strong> Si estás de acuerdo, solo presiona <strong>«Aplicar»</strong> abajo.
              Nada cambia hasta que lo hagas; con <strong>«Cancelar»</strong> no se toca nada.
              <div style="font-size:12px;color:var(--color-texto-suave);margin-top:4px;line-height:1.5">
                <strong>Antes de aplicar se descarga un respaldo</strong> de todos tus movimientos, por si quieres volver atrás.
                Nunca se tocan montos, observaciones ni notas, y el estado de un movimiento solo cambia si tú marcas la opción «Pasar a OBSERVADO/EMITIDO». Lo que se escribe es la categoría, el N° en formato Contabilidad y, en los pagos a terceros, el Proveedor/RUC del comprobante
                (el nombre del banco pasa a «A quién se depositó»; si ya había uno escrito, no se pisa).
                Abre cada sección solo si quieres ver el detalle o quitar algún caso.
              </div>
            </div>
            ${!hayAlgo && !sinComp.length ? '<p style="font-size:13px">No hay nada que reparar.</p>' : ''}
            ${seccion('fmt', '🧹', 'Arreglos de formato', 'Correcciones automáticas de datos; cada casilla es un tipo de arreglo.', nOpciones, opciones, { abierto: true })}
            ${seccion('seguro', '✅', 'Movimientos que se vinculan con su comprobante',
              'Su N° de comprobante existe en Contabilidad y el emisor coincide. Solo falta asignarles la categoría para que el comprobante los cuente.',
              seguros.length, seguros.map(fila).join(''), { botones: true })}
            ${seccion('sin_emisor', '🤝', 'Pagos a terceros (el nombre del banco no es el del emisor)',
              'El N° existe en un solo comprobante, pero el movimiento está a nombre de quien recibió el dinero. Vienen marcados solo los que tienen el monto exacto del comprobante y ningún RUC que los contradiga.',
              terceros.length, terceros.map(fila).join(''), { botones: true, abierto: terceros.some(x => preMarcado(x)) })}
            ${seccion('ambiguo', '❓', 'Necesitan tu decisión',
              'El mismo N° lo tienen varios comprobantes (distinto tipo o emisor). El sistema no adivina: elige cuál corresponde, o déjalo sin elegir.',
              ambiguos.length, ambiguos.map(filaAmbigua).join(''))}
            ${seccion('sin_comprobante', '➖', 'No se pueden reparar aquí',
              'Ese N° no existe en Compras, Ventas ni RH: revisa que esté bien escrito o importa el comprobante que falta. Es solo informativo, aquí no hay nada que marcar.',
              sinComp.length, sinComp.map(filaInfo).join(''))}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" id="rev-cancel">Cancelar (no cambia nada)</button>
            <button class="btn btn-primario" id="rev-ok">Aplicar</button>
          </div>
        </div>
      </div>`;

    const cerrar = valor => { mc.innerHTML = ''; resolve(valor); };
    const btnOk = mc.querySelector('#rev-ok');
    const chk = () => [...mc.querySelectorAll('.rev-chk')];
    const radios = () => [...mc.querySelectorAll('input[name^="rev-cand-"]:checked')];
    const actualizar = () => {
      // Contadores por sección
      ['seguro', 'sin_emisor'].forEach(g => {
        const lista = chk().filter(c => c.dataset.g === g);
        const cont = mc.querySelector(`.rev-cont[data-g="${g}"]`);
        if (cont) cont.textContent = `${lista.filter(c => c.checked).length} de ${lista.length} marcados`;
      });
      const cAmb = mc.querySelector('.rev-cont[data-g="ambiguo"]');
      if (cAmb) cAmb.textContent = `${radios().length} elegidos`;
      const cFmt = mc.querySelector('.rev-cont[data-g="fmt"]');
      if (cFmt) cFmt.textContent = `${mc.querySelectorAll('#rev-tipo:checked, #rev-uuid:checked, #rev-est14:checked, #rev-ceros:checked, #rev-estpend:checked').length} marcados`;
      // Botón: cuántos cambios se harán
      let n = chk().filter(c => c.checked).length + radios().length;
      mc.querySelectorAll('#rev-tipo:checked, #rev-uuid:checked, #rev-est14:checked, #rev-ceros:checked, #rev-estpend:checked').forEach(c => { n += Number(c.dataset.n) || 0; });
      btnOk.textContent = n ? `Aplicar (${n} cambio${n === 1 ? '' : 's'})` : 'Continuar sin cambiar nada';
    };
    mc.querySelector('.modal-overlay').addEventListener('change', actualizar);
    mc.querySelectorAll('.rev-todos').forEach(b => b.addEventListener('click', () => {
      chk().filter(c => c.dataset.g === b.dataset.g).forEach(c => { c.checked = b.dataset.v === '1'; });
      actualizar();
    }));
    actualizar();
    btnOk.onclick = () => {
      const aprobados = [];
      chk().filter(c => c.checked).forEach(c => aprobados.push(items[Number(c.dataset.i)]));
      // Ambiguos: se aplican SOLO si Wendy eligió uno de los comprobantes candidatos.
      radios().forEach(r => {
        const it = items[Number(r.name.replace('rev-cand-', ''))];
        _conAsignarCandidato(it, it.candidatos[Number(r.value)]);
        aprobados.push(it);
      });
      cerrar({
        items: aprobados,
        completarTipo:   !!mc.querySelector('#rev-tipo:checked'),
        convertirUUIDs:  !!mc.querySelector('#rev-uuid:checked'),
        reevaluar14:     !!mc.querySelector('#rev-est14:checked'),
        corregirEstados: !!mc.querySelector('#rev-estpend:checked'),
        quitarCeros:     !!mc.querySelector('#rev-ceros:checked'),
      });
    };
    mc.querySelector('#rev-cancel').onclick = () => cerrar(null);
    mc.querySelector('#rev-x').onclick = () => cerrar(null);
  });
}

// ════════════════════════════════════════════════════════════════
// VINCULACIÓN CENTRAL — una sola regla para TODO botón que concilia a mano
// (Wendy, 2026-09-19: "todos los botones que permiten conciliar de manera manual deben
// respetar las reglas de migración de los estados hacia Contabilidad").
//
// Cada botón tenía su propia versión y varios se saltaban reglas: forzaban EMITIDO sin mirar los
// 14 campos, no avisaban de exceso/duplicado, pisaban el nombre del banco. Esta función aplica
// SIEMPRE lo mismo:
//   1. Exceso/duplicado: lo vinculado no puede pasarse del total del comprobante
//      (_conValidarAntesDeVincular: bloquea o pregunta según el margen configurado).
//   2. Categoría interna (tipo_doc) + código «Tipo DOC» (FA/BO/RH), N° del comprobante.
//   3. Proveedor/RUC del comprobante y nombre del banco a «A quién se depositó» — sin pisar ni
//      borrar un titular ya escrito (mismo criterio que "Reparar estados").
//   4. Estado del movimiento por la regla de 14 campos (EMITIDO/OBSERVADO), nunca forzado. De ese
//      estado sale el de Contabilidad: la suma de lo vinculado contra el total (Aplicado / Parcial /
//      Exceso; Posible es solo una sugerencia y no cuenta como vínculo).
// NO refresca pantallas: quien llama lo hace una sola vez al terminar (_refrescarVistasVinculadas).
// ════════════════════════════════════════════════════════════════

// Marcadores que las pantallas ponen cuando un comprobante no tiene N° — nunca deben guardarse como N°.
const _CON_MARCADORES_SIN_NRO = ['—', 'Sin N°', 'RH sin N°', 'Planilla sin N°'];
function _conNroReal(v) {
  const s = (v ?? '').toString().trim();
  return s && !_CON_MARCADORES_SIN_NRO.includes(s) ? s : '';
}

// Datos del comprobante a partir de su id (Compras/Ventas/RH). null si no existe o es de otra categoría (PM).
async function _conCargarDocPorId(tipo, id) {
  if (!tipo || !id || typeof empresa_activa === 'undefined' || !empresa_activa?.id) return null;
  if (tipo === 'COMPRA' || tipo === 'VENTA') {
    const tabla = tipo === 'COMPRA' ? 'contabilidad_compras' : 'contabilidad_ventas';
    const { data: d } = await _supabase.from(tabla).select('*').eq('id', id).eq('empresa_id', empresa_activa.id).maybeSingle();
    if (!d) return null;
    return { tipo, id: d.id, nDoc: [d.serie_cdp, d.nro_cp_inicial].filter(Boolean).join('-'),
      proveedor: (tipo === 'COMPRA' ? d.proveedor : d.cliente) || '', ruc: d.nro_doc_identidad || '', total: Number(d.total_cp) || 0 };
  }
  if (tipo === 'RH') {
    const { data: d } = await _supabase.from('rh_registros').select('*, prestadores_servicios(nombre, dni)').eq('id', id).eq('empresa_operadora_id', empresa_activa.id).maybeSingle();
    if (!d) return null;
    return { tipo, id: d.id, nDoc: d.numero_rh || '', proveedor: d.prestadores_servicios?.nombre || d.nombre_emisor || '',
      ruc: d.prestadores_servicios?.dni || d.nro_doc_emisor || '', total: Number(d.monto_neto) || 0 };
  }
  return null;
}

// Vincula UN movimiento a UN comprobante con todas las reglas. `doc` = { tipo, id, nDoc, proveedor, ruc, total }.
// Opciones: tipoMatch/score (para la tabla conciliaciones), omitirValidacion (ya se validó el grupo entero),
// silencioso (no abrir el aviso de bloqueo: devuelve el mensaje para que el llamador lo junte).
// Devuelve { ok, estado, motivo, mensaje }.
async function _conVincularCentral(movId, doc, opc = {}) {
  const { tipoMatch = 'MANUAL', score = 0, omitirValidacion = false, silencioso = false } = opc;
  if (typeof empresa_activa === 'undefined' || !empresa_activa?.id) return { ok: false, motivo: 'sin_empresa' };
  const nDoc = _conNroReal(doc?.nDoc);
  if (!nDoc) {
    const mensaje = 'Este comprobante no tiene N° (serie-número): sin N° no se puede vincular, porque todo el sistema reconoce los vínculos por el N° del comprobante.';
    if (!silencioso) await _conAlertaBloqueo(mensaje);
    return { ok: false, motivo: 'sin_numero', mensaje };
  }
  const { data: mov } = await _supabase.from('tesoreria_mbd').select('*').eq('id', movId).eq('empresa_id', empresa_activa.id).maybeSingle();
  if (!mov) return { ok: false, motivo: 'no_encontrado', mensaje: 'No se pudo cargar el movimiento.' };

  if (!omitirValidacion && doc.total) {
    const val = await _conValidarAntesDeVincular(empresa_activa.id, doc.tipo, nDoc, doc.total, movId, mov.monto,
      { ruc: doc.ruc, nombre: doc.proveedor, alt: doc.tipo === 'RH' && doc.id ? [doc.id] : [] });
    if (!val.ok) {
      if (val.mensaje && !silencioso) await _conAlertaBloqueo(val.mensaje);
      return { ok: false, motivo: 'exceso', mensaje: val.mensaje || '' };
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const patch = {
    nro_factura_doc: nDoc,
    tipo_doc: doc.tipo,
    tipo_comprobante: _conCodigoTipoDoc(doc.tipo, nDoc),
    estado_conciliacion: 'conciliado',
    fecha_actualizacion: hoy,
  };
  // Proveedor/RUC ← comprobante; lo que ya estaba en Proveedor pasa a «A quién se depositó» (se une con lo que ese
  // campo ya tuviera): nada se sobrescribe ni se pierde.
  const rt = _resolverProveedorTitular(mov.proveedor_empresa_personal, doc.proveedor, mov.ruc_dni, doc.ruc, mov.titular_comprobante);
  patch.proveedor_empresa_personal = rt.proveedor;
  patch.ruc_dni = rt.ruc;
  if (rt.titular !== undefined) patch.titular_comprobante = rt.titular;
  patch.entrega_doc = _conEvalCompletitud14({ ...mov, ...patch });

  const { error } = await _supabase.from('tesoreria_mbd').update(patch).eq('id', movId);
  if (error) return { ok: false, motivo: 'error', mensaje: error.message };

  await _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id, movimiento_id: movId, doc_tipo: doc.tipo, doc_id: doc.id || null,
    score, tipo_match: tipoMatch, estado: 'APROBADO', usuario_id: (typeof perfil_usuario !== 'undefined' ? perfil_usuario?.id : null) || null,
  });
  return { ok: true, estado: patch.entrega_doc };
}

// ════════════════════════════════════════════════════════════════
// CONSOLIDACIÓN INDIVIDUAL
// Llamada automáticamente tras cada vinculación nueva.
// Re-evalúa entrega_doc con datos frescos de BD.
// ════════════════════════════════════════════════════════════════
async function consolidarMovimientoVinculado(movId) {
  if (!movId || typeof empresa_activa === 'undefined' || !empresa_activa?.id) return;

  const { data: mov } = await _supabase
    .from('tesoreria_mbd')
    .select('id,nro_operacion_bancaria,fecha_deposito,descripcion,moneda,monto,proveedor_empresa_personal,ruc_dni,cotizacion,oc,proyecto,concepto,empresa,nro_factura_doc,tipo_doc,tipo_comprobante,autorizacion,entrega_doc')
    .eq('id', movId)
    .eq('empresa_id', empresa_activa.id)
    .single();

  if (!mov?.nro_factura_doc || mov.entrega_doc === 'CANCELADO') return;

  const estadoCorrecto = _conEvalCompletitud14(mov);
  if (estadoCorrecto !== mov.entrega_doc) {
    await _supabase
      .from('tesoreria_mbd')
      .update({ entrega_doc: estadoCorrecto, fecha_actualizacion: new Date().toISOString().slice(0, 10) })
      .eq('id', movId);
  }
}

// ════════════════════════════════════════════════════════════════
// CONSOLIDACIÓN RETROACTIVA MASIVA
// Recorre TODOS los registros ya vinculados y sana estados.
// Clave compuesta: serie+número + emisor + período para validar
// la coincidencia entre Movimientos y Compras/Ventas/RH.
// ════════════════════════════════════════════════════════════════
async function consolidarEstadosRetroactivo() {
  if (typeof empresa_activa === 'undefined' || !empresa_activa?.id) {
    mostrarToast('No hay empresa activa.', 'error');
    return;
  }

  const btn = document.getElementById('btn-consolidar-estados');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Reparando…'; }

  try {
    const hoy   = new Date().toISOString().slice(0, 10);
    const empId = empresa_activa.id;
    const uid   = typeof perfil_usuario !== 'undefined' ? (perfil_usuario?.id || null) : null;
    let actualizados = 0;
    let concCreadas  = 0;
    let proveedorSincronizados = 0;
    let tipoDocSanados = 0;
    let sinResolver = 0;
    let tipoCompletados = 0;
    let uuidConvertidos = 0, uuidSinConvertir = 0, estadosReevaluados = 0, cerosQuitados = 0;
    let ambiguosSinSync = 0;

    // ── Paso 0: Sanar tipo_doc dañado (bug 2026-09-18 corregido en
    //    guardarMBD: el desplegable "Tipo DOC" del modal de Movimientos
    //    escribía por error en tipo_doc — COMPRA/VENTA/RH/PM, la categoría
    //    interna que usa TODO el sistema para saber a qué comprobante
    //    pertenece un movimiento — en vez de tipo_comprobante (FA/BO/RH/
    //    PM/OT). Cada guardado de un movimiento ya vinculado lo corrompía
    //    en silencio y lo hacía desaparecer del cálculo de su comprobante.
    //    Aquí se detectan los que quedaron con nro_factura_doc pero
    //    tipo_doc fuera de las categorías válidas, y se re-detecta
    //    buscando en Compras/Ventas/RH — igual que hace guardarMBD ahora.
    //    2026-09-19: antes esto dependía de _migBuscarComprobante (solo se
    //    carga en Tesorería), así que desde Contabilidad se saltaba en
    //    silencio y nunca sanaba nada. Ahora es autónomo y, siguiendo la
    //    regla de Wendy (reporte + aprobación antes de tocar datos
    //    existentes), muestra los casos y solo corrige los aprobados.
    const rev = await _conRevisarVinculosSinCategoria(empId, hoy);
    if (rev.cancelado) {
      mostrarToast('Reparación cancelada — no se modificó nada.', 'info');
      return;
    }
    tipoDocSanados = rev.aplicados;
    sinResolver    = rev.sinResolver;
    tipoCompletados = rev.tipoCompletados || 0;
    uuidConvertidos = rev.uuidConvertidos || 0;
    uuidSinConvertir = rev.uuidSinConvertir || 0;
    estadosReevaluados = rev.estadosReevaluados || 0;
    cerosQuitados = rev.cerosQuitados || 0;
    const idsAprobados = rev.idsAprobados || new Set();

    // ── Paso 1: Traer movimientos con comprobante vinculado ──────
    const { data: movsCrudos, error: errMovs } = await _supabase
      .from('tesoreria_mbd')
      .select('id,proveedor_empresa_personal,ruc_dni,titular_comprobante,cotizacion,oc,proyecto,concepto,empresa,nro_factura_doc,tipo_doc,entrega_doc,fecha_deposito,monto,nro_operacion_bancaria')
      .eq('empresa_id', empId)
      .not('nro_factura_doc', 'is', null)
      .in('tipo_doc', ['COMPRA', 'VENTA', 'RH', 'PM']);

    if (errMovs) throw errMovs;

    if (!movsCrudos?.length) {
      mostrarToast('No hay movimientos vinculados para consolidar.', 'atencion');
      return;
    }

    // CANCELADO es manual (se asigna en Tesorería → Movimientos) — nunca se sobrescribe aquí.
    const movs = movsCrudos.filter(m => m.entrega_doc !== 'CANCELADO');
    const cancelados = movsCrudos.length - movs.length;
    const discrepanciasDetalle = [];

    // ── Paso 1b: Traer comprobantes de Compras para clave compuesta
    let comprasMap = new Map(); // "SERIE-NRO" → [{proveedor, periodo}]
    const hayCompras = movs.some(m => m.tipo_doc === 'COMPRA');
    if (hayCompras) {
      const { data: compras } = await _supabase
        .from('contabilidad_compras')
        .select('serie_cdp,nro_cp_inicial,proveedor,nro_doc_identidad,periodo,total_cp')
        .eq('empresa_id', empId);
      (compras || []).forEach(c => {
        const k = [c.serie_cdp, c.nro_cp_inicial].filter(Boolean).join('-');
        if (k) {
          if (!comprasMap.has(k)) comprasMap.set(k, []);
          comprasMap.get(k).push({ proveedor: c.proveedor || '', ruc: c.nro_doc_identidad || '', periodo: c.periodo || '', total: Number(c.total_cp) || 0 });
        }
      });
    }

    // ── Paso 1c: Traer comprobantes de Ventas para clave compuesta
    let ventasMap = new Map(); // "SERIE-NRO" → [{cliente, periodo}]
    const hayVentas = movs.some(m => m.tipo_doc === 'VENTA');
    if (hayVentas) {
      const { data: ventas } = await _supabase
        .from('contabilidad_ventas')
        .select('serie_cdp,nro_cp_inicial,cliente,nro_doc_identidad,periodo,total_cp')
        .eq('empresa_id', empId);
      (ventas || []).forEach(v => {
        const k = [v.serie_cdp, v.nro_cp_inicial].filter(Boolean).join('-');
        if (k) {
          if (!ventasMap.has(k)) ventasMap.set(k, []);
          ventasMap.get(k).push({ proveedor: v.cliente || '', ruc: v.nro_doc_identidad || '', periodo: v.periodo || '', total: Number(v.total_cp) || 0 });
        }
      });
    }

    // ── Paso 1d: Conciliaciones RH existentes (evitar duplicados)
    const { data: concsRH } = await _supabase
      .from('conciliaciones')
      .select('doc_id')
      .eq('empresa_operadora_id', empId)
      .eq('doc_tipo', 'RH')
      .eq('estado', 'APROBADO');
    const docIdsRHConc = new Set((concsRH || []).map(c => c.doc_id).filter(Boolean));

    const newConcs = [];

    // Regla N:M (_conCobertura): varios movimientos pueden sumar el total de un
    // mismo comprobante (pago dividido). Sumar por clave ANTES de comparar montos
    // evita el mismo falso positivo de detectarDiscrepanciasMontos — y aquí es más
    // grave, porque antes bloqueaba la reparación real de entrega_doc de esos movs.
    const sumaPorClave = new Map(); // _conClaveDoc(tipo_doc, nro_factura_doc) → suma abs(monto)
    movs.forEach(m => {
      if (m.tipo_doc !== 'COMPRA' && m.tipo_doc !== 'VENTA') return;
      const k = _conClaveDoc(m.tipo_doc, m.nro_factura_doc);
      sumaPorClave.set(k, (sumaPorClave.get(k) || 0) + Math.abs(Number(m.monto) || 0));
    });
    const discrepanciasVistas = new Set(); // no contar el mismo comprobante 2 veces

    // ── Paso 2 + 3: Cruce con clave compuesta → actualizar estados
    for (const mov of movs) {
      const periodoMov = _conPeriodoFromFecha(mov.fecha_deposito);

      if (mov.tipo_doc === 'COMPRA' || mov.tipo_doc === 'VENTA') {
        const mapa       = mov.tipo_doc === 'COMPRA' ? comprasMap : ventasMap;
        const candidatos = mapa.get(mov.nro_factura_doc) || [];

        // Si existen comprobantes en BD con ese número, validar clave compuesta
        // (nombre + período). Si todavía no hay comprobante registrado, actualizamos
        // igual (vínculo manual ya validado por el usuario).
        const matchNombrePeriodo = candidatos.filter(c =>
          _conNombreCoincide(mov.proveedor_empresa_personal, c.proveedor) &&
          _conPeriodoCercano(periodoMov, c.periodo)
        );
        const claveValida = !candidatos.length || matchNombrePeriodo.length > 0;
        const sumaGrupo   = sumaPorClave.get(_conClaveDoc(mov.tipo_doc, mov.nro_factura_doc)) ?? Math.abs(Number(mov.monto) || 0);

        // Reforzado (1.2): además verificar que la SUMA de movimientos vinculados a
        // este comprobante (regla N:M) coincida razonablemente con su total — si no
        // coincide, no se actualiza el estado automáticamente (revisión manual).
        const montoOk = !matchNombrePeriodo.length || matchNombrePeriodo.some(c =>
          Math.abs(sumaGrupo - c.total) < Math.max(c.total * 0.02, 1)
        );
        const claveGrupo = _conClaveDoc(mov.tipo_doc, mov.nro_factura_doc);
        if (claveValida && matchNombrePeriodo.length && !montoOk && !discrepanciasVistas.has(claveGrupo)) {
          discrepanciasVistas.add(claveGrupo);
          const mejorCandidato = matchNombrePeriodo.reduce((a, b) =>
            Math.abs(sumaGrupo - a.total) <= Math.abs(sumaGrupo - b.total) ? a : b
          );
          discrepanciasDetalle.push({
            id: mov.id, nDoc: mov.nro_factura_doc, tipoDoc: mov.tipo_doc,
            nroOp: mov.nro_operacion_bancaria, fecha: mov.fecha_deposito,
            montoMov: sumaGrupo, montoComprobante: mejorCandidato.total,
            proveedor: mejorCandidato.proveedor,
          });
        }

        // Sincronizar Proveedor/RUC/titular_comprobante (Wendy, 2026-09-18):
        // vínculos hechos ANTES del fix de dirección se quedaron con el
        // nombre de quien recibió el depósito en Proveedor/Empresa/Personal
        // en vez del emisor del comprobante — por eso NO se filtra por
        // matchNombrePeriodo aquí (el nombre actual es justo lo que puede
        // estar mal). Se elige el candidato más cercano en período/monto.
        // 2026-09-19 (Wendy: "¿esto va a borrar lo que he conciliado?"): ya NO se reescribe el Proveedor/RUC
        // de todos los movimientos vinculados en silencio — solo el de los que se aprobaron en el reporte.
        let candidatoProveedor = null;
        if (!idsAprobados.has(mov.id)) {
          // no aprobado en el reporte: no se toca
        } else if (candidatos.length === 1) {
          candidatoProveedor = candidatos[0];
        } else if (candidatos.length > 1) {
          // N° compartido por varios emisores (Wendy, 2026-09-19): NO se adivina por cercanía
          // de monto/periodo — eso podía pisar el proveedor/RUC con el de OTRO emisor. Solo se
          // sincroniza si el RUC del movimiento identifica UN solo comprobante; si no, se deja
          // como está y se avisa (se resuelve vinculando y eligiendo el comprobante).
          const rucMov = (mov.ruc_dni || '').toString().trim();
          const porRuc = rucMov ? candidatos.filter(c => String(c.ruc || '').trim() === rucMov) : [];
          const mismoEmisor = new Set(candidatos.map(c => String(c.ruc || '').trim())).size === 1; // mismo comprobante cargado 2 veces
          if (mismoEmisor)             candidatoProveedor = candidatos[0];
          else if (porRuc.length >= 1) candidatoProveedor = porRuc[0];
          else                         ambiguosSinSync++;
        }
        if (candidatoProveedor && typeof _resolverProveedorTitular === 'function') {
          const rt = _resolverProveedorTitular(
            mov.proveedor_empresa_personal, candidatoProveedor.proveedor,
            mov.ruc_dni, candidatoProveedor.ruc, mov.titular_comprobante
          );
          const cambiosProv = {};
          if (rt.proveedor !== (mov.proveedor_empresa_personal || null)) cambiosProv.proveedor_empresa_personal = rt.proveedor;
          if (rt.ruc !== (mov.ruc_dni || null)) cambiosProv.ruc_dni = rt.ruc;
          // El nombre que ya tenía el movimiento se traslada a «A quién se depositó» (unido a lo que hubiera): no se pierde.
          if (rt.titular !== undefined && rt.titular !== (mov.titular_comprobante || null)) cambiosProv.titular_comprobante = rt.titular;
          if (Object.keys(cambiosProv).length) {
            cambiosProv.fecha_actualizacion = hoy;
            await _supabase.from('tesoreria_mbd').update(cambiosProv).eq('id', mov.id);
            mov.proveedor_empresa_personal = rt.proveedor;
            mov.ruc_dni = rt.ruc;
            proveedorSincronizados++;
          }
        }

        if (_CON_REPARAR_RECALCULA_ESTADOS && claveValida && montoOk) {
          // Paso 3 – evaluar completitud y actualizar entrega_doc
          const nuevoEstado = _conEvalCompletitud(mov);
          if (nuevoEstado !== mov.entrega_doc) {
            await _supabase
              .from('tesoreria_mbd')
              .update({ entrega_doc: nuevoEstado, fecha_actualizacion: hoy })
              .eq('id', mov.id);
            actualizados++;
          }
        }

      } else if (mov.tipo_doc === 'RH') {
        // RH usa UUID — clave ya única por prestador; no necesita clave compuesta extra.
        // Paso 3 – completitud
        const nuevoEstado = _conEvalCompletitud(mov);
        if (_CON_REPARAR_RECALCULA_ESTADOS && nuevoEstado !== mov.entrega_doc) {
          await _supabase
            .from('tesoreria_mbd')
            .update({ entrega_doc: nuevoEstado, fecha_actualizacion: hoy })
            .eq('id', mov.id);
          actualizados++;
        }
        // Paso 2 – asegurar registro en conciliaciones para que _estadoCalculado lo detecte
        // `conciliaciones.doc_id` es una referencia interna al id del RH: solo tiene sentido con el
        // código único. Con N° legible (ya no se crean códigos nuevos) el estado del RH sale de
        // tesoreria_mbd (N° + emisor) y NO se escribe un N° legible en una columna de ids.
        if (_conEsUUID(mov.nro_factura_doc) && !docIdsRHConc.has(mov.nro_factura_doc)) {
          newConcs.push({
            empresa_operadora_id: empId,
            movimiento_id:        null,
            doc_tipo:             'RH',
            doc_id:               mov.nro_factura_doc,
            score:                0,
            tipo_match:           'CONSOLIDACION',
            estado:               'APROBADO',
            usuario_id:           uid,
          });
          docIdsRHConc.add(mov.nro_factura_doc);
          concCreadas++;
        }

      } else {
        // PM u otros tipos: solo completitud
        const nuevoEstado = _conEvalCompletitud(mov);
        if (_CON_REPARAR_RECALCULA_ESTADOS && nuevoEstado !== mov.entrega_doc) {
          await _supabase
            .from('tesoreria_mbd')
            .update({ entrega_doc: nuevoEstado, fecha_actualizacion: hoy })
            .eq('id', mov.id);
          actualizados++;
        }
      }
    }

    // ── Insertar conciliaciones RH faltantes en un solo batch ────
    if (newConcs.length) {
      await _supabase.from('conciliaciones').insert(newConcs);
    }

    // ── Resumen ──────────────────────────────────────────────────
    // Nota (2026-09): el reporte de montos que no coinciden se movió a
    // Conciliación → "⚠️ Verificar montos" (detectarDiscrepanciasMontos),
    // porque no es una reparación de estado — es una verificación de
    // conciliación. Este botón solo repara, y si encuentra discrepancias
    // avisa dónde revisarlas, en vez de abrir el reporte aquí mismo.
    const discrepancias = discrepanciasDetalle.length;
    const parts = [`${movs.length} mov. revisados`];
    if (tipoDocSanados) parts.push(`${tipoDocSanados} movimiento(s) sin categoría de comprobante corregido(s)`);
    if (tipoCompletados) parts.push(`${tipoCompletados} "Tipo DOC" completado(s) (FA/BO/RH)`);
    if (cerosQuitados) parts.push(`${cerosQuitados} N° de comprobante sin ceros a la izquierda (formato de Contabilidad)`);
    if (uuidConvertidos) parts.push(`${uuidConvertidos} RH pasaron de código a N° legible`);
    if (uuidSinConvertir) parts.push(`⚠️ ${uuidSinConvertir} RH con código quedaron igual (no se pueden distinguir con seguridad — revísalos a mano)`);
    if (estadosReevaluados) parts.push(`${estadosReevaluados} estado(s) re-evaluado(s) con la regla de 14 campos`);
    if (sinResolver)    parts.push(`⚠️ ${sinResolver} con N° de comprobante sin resolver — revísalos a mano en Movimientos`);
    if (ambiguosSinSync) parts.push(`⚠️ ${ambiguosSinSync} con N° compartido por varios emisores: no se tocó su proveedor/RUC — vincúlalos eligiendo el comprobante`);
    if (actualizados)   parts.push(`${actualizados} estado(s) corregido(s)`);
    if (proveedorSincronizados) parts.push(`${proveedorSincronizados} proveedor/RUC resincronizado(s) con el comprobante`);
    if (concCreadas)    parts.push(`${concCreadas} conciliación(es) RH creada(s)`);
    if (cancelados)     parts.push(`${cancelados} CANCELADO(s) respetado(s) sin tocar`);
    if (discrepancias)  parts.push(`⚠️ ${discrepancias} con monto que no coincide — revísalas en Conciliación → Verificar montos`);
    if (!tipoDocSanados && !tipoCompletados && !uuidConvertidos && !uuidSinConvertir && !estadosReevaluados && !cerosQuitados && !sinResolver && !ambiguosSinSync && !actualizados && !proveedorSincronizados && !concCreadas && !discrepancias) parts.push('todo ya consistente');
    const hayAviso = discrepancias || sinResolver || ambiguosSinSync || uuidSinConvertir;
    mostrarToast((hayAviso ? '⚠️ ' : '✅ ') + parts.join(' · '), hayAviso ? 'atencion' : 'exito');

    // ── Refrescar módulos abiertos ───────────────────────────────
    if (typeof cargarRHRecibidas === 'function') cargarRHRecibidas();
    if (typeof cargarCompras     === 'function') cargarCompras();
    if (typeof cargarVentas      === 'function') cargarVentas();
    if (typeof _concCargarDatos  === 'function') _concCargarDatos();

  } catch (err) {
    mostrarToast('Error en consolidación: ' + err.message, 'error');
    console.error('[consolidacion-estados]', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔧 Reparar estados'; }
  }
}

// ════════════════════════════════════════════════════════════════
// VERIFICACIÓN DE MONTOS (solo lectura, vive en Conciliación)
// Detecta comprobantes de Compras/Ventas vinculados a un movimiento
// bancario cuyo monto NO coincide (>2%) — no repara nada, solo avisa
// para revisión manual. Antes vivía dentro de "Consolidar estados";
// se separó porque es un reporte de conciliación, no de reparación.
// ════════════════════════════════════════════════════════════════
async function detectarDiscrepanciasMontos() {
  if (typeof empresa_activa === 'undefined' || !empresa_activa?.id) return [];
  const empId = empresa_activa.id;

  const { data: movsCrudos } = await _supabase
    .from('tesoreria_mbd')
    .select('id,proveedor_empresa_personal,nro_factura_doc,tipo_doc,entrega_doc,fecha_deposito,monto,nro_operacion_bancaria')
    .eq('empresa_id', empId)
    .not('nro_factura_doc', 'is', null)
    .in('tipo_doc', ['COMPRA', 'VENTA']);

  const movs = (movsCrudos || []).filter(m => m.entrega_doc !== 'CANCELADO');
  const discrepanciasDetalle = [];
  if (!movs.length) return discrepanciasDetalle;

  let comprasMap = new Map();
  if (movs.some(m => m.tipo_doc === 'COMPRA')) {
    const { data: compras } = await _supabase.from('contabilidad_compras')
      .select('serie_cdp,nro_cp_inicial,proveedor,periodo,total_cp').eq('empresa_id', empId);
    (compras || []).forEach(c => {
      const k = [c.serie_cdp, c.nro_cp_inicial].filter(Boolean).join('-');
      if (k) { if (!comprasMap.has(k)) comprasMap.set(k, []); comprasMap.get(k).push({ proveedor: c.proveedor||'', periodo: c.periodo||'', total: Number(c.total_cp)||0 }); }
    });
  }
  let ventasMap = new Map();
  if (movs.some(m => m.tipo_doc === 'VENTA')) {
    const { data: ventas } = await _supabase.from('contabilidad_ventas')
      .select('serie_cdp,nro_cp_inicial,cliente,periodo,total_cp').eq('empresa_id', empId);
    (ventas || []).forEach(v => {
      const k = [v.serie_cdp, v.nro_cp_inicial].filter(Boolean).join('-');
      if (k) { if (!ventasMap.has(k)) ventasMap.set(k, []); ventasMap.get(k).push({ proveedor: v.cliente||'', periodo: v.periodo||'', total: Number(v.total_cp)||0 }); }
    });
  }

  // Agrupar por comprobante — regla N:M (_conCobertura): varios movimientos
  // pueden sumar el total de un mismo comprobante. Comparar cada movimiento
  // por separado contra el total daba falsos positivos (Wendy, 2026-09-17):
  // 2 movimientos de S/4.80 vinculados al mismo comprobante de S/9.60 — cada
  // uno "no coincidía" solo, pero sumados cuadran exacto.
  const gruposPorClave = new Map(); // _conClaveDoc(tipo_doc, nro_factura_doc) → [movs]
  movs.forEach(m => {
    const k = _conClaveDoc(m.tipo_doc, m.nro_factura_doc);
    if (!gruposPorClave.has(k)) gruposPorClave.set(k, []);
    gruposPorClave.get(k).push(m);
  });

  for (const grupo of gruposPorClave.values()) {
    const mov0 = grupo[0];
    const periodoMov = _conPeriodoFromFecha(mov0.fecha_deposito);
    const mapa = mov0.tipo_doc === 'COMPRA' ? comprasMap : ventasMap;
    const candidatos = mapa.get(mov0.nro_factura_doc) || [];
    const matchNombrePeriodo = candidatos.filter(c =>
      _conNombreCoincide(mov0.proveedor_empresa_personal, c.proveedor) && _conPeriodoCercano(periodoMov, c.periodo));
    if (!matchNombrePeriodo.length) continue;
    const sumaGrupo = grupo.reduce((s, m) => s + Math.abs(Number(m.monto) || 0), 0);
    const montoOk = matchNombrePeriodo.some(c => Math.abs(sumaGrupo - c.total) < Math.max(c.total * 0.02, 1));
    if (!montoOk) {
      const mejorCandidato = matchNombrePeriodo.reduce((a, b) =>
        Math.abs(sumaGrupo - a.total) <= Math.abs(sumaGrupo - b.total) ? a : b);
      discrepanciasDetalle.push({
        id: mov0.id, nDoc: mov0.nro_factura_doc, tipoDoc: mov0.tipo_doc,
        nroOp: grupo.map(m => m.nro_operacion_bancaria).filter(Boolean).join(', '),
        fecha: mov0.fecha_deposito,
        montoMov: sumaGrupo, montoComprobante: mejorCandidato.total,
        proveedor: mejorCandidato.proveedor,
      });
    }
  }
  return discrepanciasDetalle;
}

// ── Botón "⚠️ Verificar montos" en Conciliación ───────────────────
async function _conVerificarMontosClick() {
  mostrarToast('Verificando montos vinculados…', 'info');
  const discrepancias = await detectarDiscrepanciasMontos();
  if (!discrepancias.length) { mostrarToast('✅ No se encontraron montos que no coincidan', 'exito'); return; }
  _conRenderDiscrepancias(discrepancias);
}

// ── Reporte visual de discrepancias detectadas (solo lectura) ────
//    Cada fila tiene la info del movimiento y el comprobante para
//    revisarlo a mano — no modifica nada.
function _conRenderDiscrepancias(detalle) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:760px;width:95%;max-height:88vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>⚠️ Montos que no coinciden — ${detalle.length} caso(s)</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px">
            El movimiento bancario está vinculado a un comprobante con el mismo proveedor/período, pero el monto no coincide (más de un 2% de diferencia). No se tocó su estado — revisa cada caso y corrígelo manualmente si corresponde.
          </p>
          ${detalle.map(d => {
            const diff = Math.round((d.montoMov - d.montoComprobante) * 100) / 100;
            return `
            <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px">
                <span style="font-weight:700;color:var(--color-secundario)">${escapar(d.tipoDoc)} ${escapar(d.nDoc||'')} · ${escapar(d.proveedor||'')}</span>
                <span style="font-family:monospace;font-size:11px;color:var(--color-texto-suave)">Op. ${escapar(d.nroOp||'—')} · ${formatearFecha(d.fecha)}</span>
              </div>
              <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px">
                <span>Movimiento bancario: <strong>${formatearMoneda(d.montoMov)}</strong></span>
                <span>Comprobante: <strong>${formatearMoneda(d.montoComprobante)}</strong></span>
                <span style="color:${diff>0?'#C53030':'#D69E2E'}">Diferencia: <strong>${diff>0?'+':''}${formatearMoneda(diff)}</strong></span>
              </div>
              <div style="margin-top:8px;font-size:11px;color:var(--color-texto-suave)">
                💡 Búscalo en Tesorería → Movimientos con el N° de operación <strong style="font-family:monospace;color:var(--color-texto)">${escapar(d.nroOp||'—')}</strong>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}
