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

  let consulta = _supabase
    .from('tesoreria_mbd')
    .select('id,nro_operacion_bancaria,fecha_deposito,monto,proveedor_empresa_personal,entrega_doc,tipo_doc,ruc_dni')
    .eq('empresa_id', empresaId)
    .eq('nro_factura_doc', nroFacturaDoc)
    .neq('id', movIdExcluir || '');
  consulta = emisor ? consulta.or(_conFiltroTipoDoc(tipoDoc)) : consulta.eq('tipo_doc', tipoDoc);
  const { data: existentes } = await consulta;

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
function _resolverProveedorTitular(proveedorActual, proveedorComprobante, rucActual, rucComprobante) {
  const actual = (proveedorActual || '').toString().trim();
  const comp   = (proveedorComprobante || '').toString().trim();
  const rucAct = (rucActual || '').toString().trim() || null;
  const rucComp = (rucComprobante || '').toString().trim() || null;

  if (!comp)   return { proveedor: actual || null, titular: null, ruc: rucAct };
  if (!actual) return { proveedor: comp, titular: null, ruc: rucComp || rucAct };
  if (_tercNombreNorm(actual) === _tercNombreNorm(comp)) return { proveedor: comp, titular: null, ruc: rucComp || rucAct };
  // Pago a tercero: el nombre que ya estaba en el movimiento (quien
  // realmente recibió el depósito, ej. "Valencia Nanez...") no es el
  // emisor del comprobante (ej. "TIENDAS DEL MEJORAMIENTO...") — el campo
  // Proveedor/Empresa/Personal migra igual al emisor del comprobante (dato
  // contable correcto) y el nombre del depositario se guarda aparte.
  return { proveedor: comp, titular: actual, ruc: rucComp || rucAct };
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
function _conFiltrarVinculosDelComprobante(movs, categoria, ruc, nombre) {
  return (movs || []).filter(m => {
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
      const propios = movs.filter(m => m.nro_factura_doc === d.id
        || (d.numero_rh && m.nro_factura_doc === d.numero_rh && _conNombreCoincideEstricto(m.proveedor_empresa_personal, d._proveedor)));
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
  const alta = (cat, key, c) => {
    if (!key) return;
    if (!idx[cat].has(key)) idx[cat].set(key, []);
    if (!idx[cat].get(key).includes(c)) idx[cat].get(key).push(c);
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
      nombre: r.nombre_emisor || r.prestadores_servicios?.nombre || '',
      ruc: r.nro_doc_emisor || r.prestadores_servicios?.dni || '',
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
    if (!cuenta(m)) return;
    hits.filter(h => h.emisorOk && (!valido(m) || m.tipo_doc === h.c.cat)).forEach(h => {
      if (!miembros.has(h.c)) miembros.set(h.c, []);
      miembros.get(h.c).push(m);
    });
  });

  const items = [];
  for (const m of lista) {
    if (valido(m)) continue;
    const hits     = hitsPorMov.get(m.id) || [];
    const conEmis  = hits.filter(h => h.emisorOk);
    const catsEmis = [...new Set(conEmis.map(h => h.c.cat))];
    const catsTodas = [...new Set(hits.map(h => h.c.cat))];

    let tipo, elegido = null;
    if (catsEmis.length === 1)       { tipo = 'seguro';     elegido = conEmis[0].c; }
    else if (catsEmis.length > 1)    { tipo = 'ambiguo'; }
    else if (catsTodas.length === 1) { tipo = 'sin_emisor'; elegido = hits[0].c; }
    else if (catsTodas.length > 1)   { tipo = 'ambiguo'; }
    else                             { tipo = 'sin_comprobante'; }

    const item = { mov: m, tipo, categoria: elegido?.cat || null, comprobante: elegido, cuentaEnConta: cuenta(m),
                   nroCanonico: null, cambiaNro: false, cov: null, estado5: null, categoriasPosibles: catsTodas };
    if (elegido) {
      // El N° escrito a mano puede diferir en formato (espacios, ceros, minúsculas);
      // Contabilidad busca por igualdad exacta, así que se normaliza al del comprobante.
      // RH conserva su forma (puede ser UUID o N° legible, ambos válidos).
      item.nroCanonico = elegido.cat === 'RH' ? m.nro_factura_doc : elegido.nro;
      item.cambiaNro   = elegido.cat !== 'RH' && m.nro_factura_doc !== elegido.nro;
      if (tipo === 'seguro' && item.cuentaEnConta) {
        item.cov = _conCobertura(miembros.get(elegido) || [], elegido.total);
        item.estado5 = _conEstado5(item.cov, false);
      }
    }
    items.push(item);
  }
  return items;
}

// ── Paso 0 de "🔧 Reparar estados": detecta, MUESTRA y solo con aprobación
//    asigna la categoría (tipo_doc) faltante o dañada. Antes esto corría en
//    silencio y, además, dependía de _migBuscarComprobante — que solo se
//    carga en Tesorería —, así que desde Contabilidad NUNCA hacía nada.
//    Devuelve { cancelado } o { aplicados, sinResolver }.
async function _conRevisarVinculosSinCategoria(empId, hoy) {
  const [movs, compras, ventas, rhs] = await Promise.all([
    _conTraerTodo(() => _supabase.from('tesoreria_mbd')
      .select('id,nro_factura_doc,tipo_doc,tipo_comprobante,entrega_doc,monto,ruc_dni,proveedor_empresa_personal,nro_operacion_bancaria,fecha_deposito')
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
  if (!items.length) return { aplicados: 0, sinResolver: 0 };

  const elegidos = await _conModalVinculosSinCategoria(items);
  if (!elegidos) return { cancelado: true };

  let aplicados = 0;
  for (const it of elegidos) {
    const patch = { tipo_doc: it.categoria, fecha_actualizacion: hoy };
    if (!it.mov.tipo_comprobante && typeof _mbdCodigoTipoComprobante === 'function') {
      patch.tipo_comprobante = _mbdCodigoTipoComprobante(it.categoria, it.nroCanonico);
    }
    if (it.cambiaNro) patch.nro_factura_doc = it.nroCanonico;
    const { error } = await _supabase.from('tesoreria_mbd').update(patch).eq('id', it.mov.id);
    if (!error) aplicados++;
  }
  return { aplicados, sinResolver: items.length - aplicados };
}

// Reporte previo (regla de Wendy: reporte + aprobación antes de tocar datos
// existentes). Resuelve con la lista de items aprobados, o null si cancela.
function _conModalVinculosSinCategoria(items) {
  return new Promise(resolve => {
    const mc = document.getElementById('modal-container');
    if (!mc) { resolve(null); return; }

    const NOMBRE_CAT = { COMPRA: 'Compras', VENTA: 'Ventas', RH: 'RH Recibidos' };
    const MOTIVO = {
      sin_emisor: 'El N° existe, pero el RUC/nombre del movimiento no coincide con el del comprobante. Marca la casilla solo si es el comprobante correcto.',
      ambiguo: 'Ese N° existe en más de una categoría (Compras/Ventas/RH). Vincúlalo a mano desde el módulo correspondiente.',
      sin_comprobante: 'Ese N° no existe en Compras, Ventas ni RH. Revisa que esté bien escrito o que el comprobante ya esté cargado.',
    };
    const aplicables = items.filter(i => i.categoria);
    const porTipo = t => items.filter(i => i.tipo === t).length;

    const tarjeta = (it, i) => {
      const m = it.mov;
      const marcable = !!it.categoria;
      const c = it.comprobante;
      const cabecera = `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px">
          <span style="font-weight:700;color:var(--color-secundario)">${escapar(m.nro_factura_doc)} · ${escapar(m.proveedor_empresa_personal || '—')}</span>
          <span style="font-family:monospace;font-size:11px;color:var(--color-texto-suave)">Op. ${escapar(m.nro_operacion_bancaria || '—')} · ${formatearFecha(m.fecha_deposito)} · ${formatearMoneda(m.monto)} · ${escapar(m.entrega_doc || '—')}</span>
        </div>`;
      let cuerpo;
      if (marcable) {
        let despues;
        if (it.estado5) {
          const col = _CON_ESTADO5_COLOR[it.estado5];
          despues = `En Contabilidad quedará: <strong style="color:${col}">${_CON_ESTADO5_ICONO[it.estado5]} ${it.estado5}</strong> (vinculado ${formatearMoneda(it.cov.suma)} de ${formatearMoneda(it.cov.total)})`;
        } else if (!it.cuentaEnConta) {
          despues = 'Su estado en Movimientos es PENDIENTE: Contabilidad seguirá mostrándolo PENDIENTE (regla), aunque se le asigne la categoría.';
        } else {
          despues = 'Aunque se asigne la categoría, Contabilidad no lo contará porque el RUC/nombre no coincide con el comprobante.';
        }
        cuerpo = `
          <div style="font-size:12px;margin-bottom:4px">Comprobante hallado en <strong>${NOMBRE_CAT[it.categoria]}</strong>: ${escapar(c.nombre || '—')} · RUC/DNI ${escapar(c.ruc || '—')} · Total ${formatearMoneda(c.total)}</div>
          <div style="font-size:12px;margin-bottom:4px">Se asignará categoría <strong style="font-family:monospace">${it.categoria}</strong> (hoy: <span style="font-family:monospace">${escapar(m.tipo_doc || 'vacío')}</span>)${it.cambiaNro ? ` y el N° se normalizará a <strong style="font-family:monospace">${escapar(it.nroCanonico)}</strong>` : ''}.</div>
          <div style="font-size:12px">${despues}</div>
          ${it.tipo === 'sin_emisor' ? `<div style="font-size:11px;color:#C05621;margin-top:4px">⚠️ ${MOTIVO.sin_emisor}</div>` : ''}`;
      } else {
        cuerpo = `<div style="font-size:12px;color:var(--color-texto-suave)">${MOTIVO[it.tipo]}</div>`;
      }
      return `
        <label style="display:flex;gap:10px;align-items:flex-start;border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:10px;${marcable ? 'cursor:pointer' : 'opacity:.85'}">
          <input type="checkbox" class="rev-chk" data-i="${i}" ${it.tipo === 'seguro' ? 'checked' : ''} ${marcable ? '' : 'disabled'} style="margin-top:3px">
          <div style="flex:1;min-width:0">${cabecera}${cuerpo}</div>
        </label>`;
    };

    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex">
        <div class="modal" style="max-width:860px;width:95%;max-height:90vh;display:flex;flex-direction:column">
          <div class="modal-header">
            <h3>🔧 Movimientos con comprobante pero sin categoría — ${items.length} caso(s)</h3>
            <button class="modal-cerrar" id="rev-x">✕</button>
          </div>
          <div class="modal-body" style="flex:1;overflow-y:auto">
            <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:6px">
              Estos movimientos ya tienen un N° de comprobante escrito, pero les falta (o tienen dañada) la categoría interna que Contabilidad usa para saber a qué comprobante pertenecen. Por eso hoy su comprobante puede aparecer PENDIENTE aunque el movimiento esté OBSERVADO o EMITIDO.
            </p>
            <p style="font-size:12px;margin-bottom:14px">
              <strong>${porTipo('seguro')}</strong> seguro(s) · <strong>${porTipo('sin_emisor')}</strong> con emisor distinto · <strong>${porTipo('ambiguo')}</strong> ambiguo(s) · <strong>${porTipo('sin_comprobante')}</strong> sin comprobante.
              Nada se modifica hasta que confirmes; solo se corrigen las casillas marcadas. El estado de cada movimiento (Emitido/Observado/Pendiente) no se cambia aquí.
            </p>
            ${items.map(tarjeta).join('')}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" id="rev-cancel">Cancelar (no cambia nada)</button>
            <button class="btn btn-primario" id="rev-ok">Aplicar seleccionados y reparar</button>
          </div>
        </div>
      </div>`;

    const cerrar = valor => { mc.innerHTML = ''; resolve(valor); };
    const btnOk = mc.querySelector('#rev-ok');
    const actualizarBoton = () => {
      const n = mc.querySelectorAll('.rev-chk:checked').length;
      btnOk.textContent = n ? `Aplicar ${n} seleccionado(s) y reparar` : 'Continuar sin cambiar categorías';
    };
    mc.querySelectorAll('.rev-chk').forEach(ch => ch.addEventListener('change', actualizarBoton));
    actualizarBoton();
    btnOk.onclick = () => cerrar([...mc.querySelectorAll('.rev-chk:checked')].map(ch => items[Number(ch.dataset.i)]));
    mc.querySelector('#rev-cancel').onclick = () => cerrar(null);
    mc.querySelector('#rev-x').onclick = () => cerrar(null);
  });
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
        let candidatoProveedor = null;
        if (candidatos.length === 1) {
          candidatoProveedor = candidatos[0];
        } else if (candidatos.length > 1) {
          const porPeriodo = candidatos.filter(c => _conPeriodoCercano(periodoMov, c.periodo));
          const pool = porPeriodo.length ? porPeriodo : candidatos;
          candidatoProveedor = pool.reduce((a, b) =>
            Math.abs(sumaGrupo - a.total) <= Math.abs(sumaGrupo - b.total) ? a : b);
        }
        if (candidatoProveedor && typeof _resolverProveedorTitular === 'function') {
          const rt = _resolverProveedorTitular(
            mov.proveedor_empresa_personal, candidatoProveedor.proveedor,
            mov.ruc_dni, candidatoProveedor.ruc
          );
          const cambiosProv = {};
          if (rt.proveedor !== (mov.proveedor_empresa_personal || null)) cambiosProv.proveedor_empresa_personal = rt.proveedor;
          if (rt.ruc !== (mov.ruc_dni || null)) cambiosProv.ruc_dni = rt.ruc;
          if (rt.titular !== (mov.titular_comprobante || null)) cambiosProv.titular_comprobante = rt.titular;
          if (Object.keys(cambiosProv).length) {
            cambiosProv.fecha_actualizacion = hoy;
            await _supabase.from('tesoreria_mbd').update(cambiosProv).eq('id', mov.id);
            mov.proveedor_empresa_personal = rt.proveedor;
            mov.ruc_dni = rt.ruc;
            proveedorSincronizados++;
          }
        }

        if (claveValida && montoOk) {
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
        if (nuevoEstado !== mov.entrega_doc) {
          await _supabase
            .from('tesoreria_mbd')
            .update({ entrega_doc: nuevoEstado, fecha_actualizacion: hoy })
            .eq('id', mov.id);
          actualizados++;
        }
        // Paso 2 – asegurar registro en conciliaciones para que _estadoCalculado lo detecte
        if (!docIdsRHConc.has(mov.nro_factura_doc)) {
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
        if (nuevoEstado !== mov.entrega_doc) {
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
    if (sinResolver)    parts.push(`⚠️ ${sinResolver} con N° de comprobante sin resolver — revísalos a mano en Movimientos`);
    if (actualizados)   parts.push(`${actualizados} estado(s) corregido(s)`);
    if (proveedorSincronizados) parts.push(`${proveedorSincronizados} proveedor/RUC resincronizado(s) con el comprobante`);
    if (concCreadas)    parts.push(`${concCreadas} conciliación(es) RH creada(s)`);
    if (cancelados)     parts.push(`${cancelados} CANCELADO(s) respetado(s) sin tocar`);
    if (discrepancias)  parts.push(`⚠️ ${discrepancias} con monto que no coincide — revísalas en Conciliación → Verificar montos`);
    if (!tipoDocSanados && !sinResolver && !actualizados && !proveedorSincronizados && !concCreadas && !discrepancias) parts.push('todo ya consistente');
    const hayAviso = discrepancias || sinResolver;
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
