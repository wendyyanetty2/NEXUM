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

// ── Validación de duplicados/descuadres ANTES de vincular — bloqueante
//    (Wendy, 2026-09-17; corregido en auditoría 2026-09-17 sección 6).
//    La clave de un comprobante es su N° (nro_factura_doc) + tipo_doc —
//    NO el nombre del proveedor, porque puede venir escrito distinto
//    entre el banco y el comprobante. Antes de grabar un nuevo vínculo
//    se recalcula cuánto suman TODOS los movimientos que ya apuntan a
//    ese mismo N° de comprobante y se reutiliza _conCobertura (misma
//    tolerancia 0.01 que ya decide el badge EXCESIVO) para decidir si
//    hay exceso — UNA sola regla para la misma decisión, no dos. Antes
//    esta función usaba su propio margen (5%/S/5), lo que abría una
//    ventana donde el badge ya decía EXCESIVO pero el sistema todavía
//    dejaba vincular más — corregido tras la auditoría del documento
//    "NEXUM_Auditoria_y_Mejora_Conciliacion".
async function _conValidarAntesDeVincular(empresaId, tipoDoc, nroFacturaDoc, totalComprobante, movIdExcluir, montoNuevo) {
  const total = Number(totalComprobante) || 0;
  if (!nroFacturaDoc || !total) return { ok: true };

  const { data: existentes } = await _supabase
    .from('tesoreria_mbd')
    .select('id,nro_operacion_bancaria,fecha_deposito,monto,proveedor_empresa_personal,entrega_doc')
    .eq('empresa_id', empresaId)
    .eq('tipo_doc', tipoDoc)
    .eq('nro_factura_doc', nroFacturaDoc)
    .neq('id', movIdExcluir || '');

  const lista    = existentes || [];
  const montoAbs = Math.abs(Number(montoNuevo) || 0);
  const cov      = _conCobertura([...lista, { monto: montoAbs, entrega_doc: 'OBSERVADO' }], total);

  if (cov.estado === 'PARCIAL' && cov.excede) {
    const sumaPrevia = cov.suma - montoAbs;
    const detalle = lista.map(m =>
      `• Op. ${escapar(m.nro_operacion_bancaria || '—')} · ${formatearFecha(m.fecha_deposito)} · ${formatearMoneda(m.monto)} · ${escapar(m.proveedor_empresa_personal || '—')}`
    ).join('\n');
    return {
      ok: false, lista, sumaPrevia, sumaNueva: cov.suma, total, excede: cov.excede,
      mensaje: `⛔ No se puede vincular.\n\n`
        + `El comprobante "${escapar(nroFacturaDoc)}" ya tiene ${lista.length} movimiento(s) bancario(s) vinculado(s) que suman ${formatearMoneda(sumaPrevia)}.\n`
        + `Agregar este movimiento (${formatearMoneda(montoAbs)}) llevaría el total vinculado a ${formatearMoneda(cov.suma)}, que excede el total del comprobante (${formatearMoneda(total)}) por ${formatearMoneda(cov.excede)}.\n`
        + (detalle ? `\nMovimiento(s) ya vinculado(s) a este comprobante:\n${detalle}\n` : '')
        + `\nSi este movimiento en realidad pertenece a otro comprobante, revisa el N° antes de continuar. Si el vínculo anterior está mal, desvincúlalo primero.`,
    };
  }
  return { ok: true };
}

// ── Aviso bloqueante de un solo botón (a diferencia de confirmar(), que
//    ofrece seguir adelante) — para cuando la acción simplemente NO puede
//    continuar y solo queda que la persona lea por qué y cierre el aviso.
function _conAlertaBloqueo(mensaje) {
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

// ── Busca movimientos SIN vincular (entrega_doc != EMITIDO) cuyo monto cae
//    dentro del margen ±S/3 (_CON_MARGEN_POSIBLE) del total de un
//    comprobante — usado por el ícono 🔗. Corrige DOS bugs reales:
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
async function _conBuscarCandidatosPorMonto(empresaId, total, limite = 30) {
  const margen = _CON_MARGEN_POSIBLE;
  const t = Number(total) || 0;
  const lo = t - margen, hi = t + margen;
  const { data } = await _supabase.from('tesoreria_mbd').select('*')
    .eq('empresa_id', empresaId).neq('entrega_doc', 'EMITIDO')
    .or(`and(monto.gte.${lo},monto.lte.${hi}),and(monto.gte.${-hi},monto.lte.${-lo})`)
    .order('fecha_deposito', { ascending: false }).limit(200);

  return (data || [])
    .sort((a, b) => Math.abs(Math.abs(Number(a.monto)) - t) - Math.abs(Math.abs(Number(b.monto)) - t))
    .slice(0, limite);
}

// ── Trae los montos de movimientos SIN vincular (entrega_doc != EMITIDO) de
//    la empresa, para marcar como POSIBLE cualquier PENDIENTE que tenga al
//    menos un candidato dentro del margen — reutilizado por Compras y Ventas.
//    Sin límite artificial (antes 3000): con la corrección de arriba, este
//    y _conBuscarCandidatosPorMonto deben ver exactamente el mismo universo
//    de movimientos, para que POSIBLE y el modal 🔗 nunca se contradigan.
async function _conCandidatosMontoDisponibles(empresaId) {
  const { data } = await _supabase.from('tesoreria_mbd').select('monto')
    .eq('empresa_id', empresaId).neq('entrega_doc', 'EMITIDO');
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

    // ── Paso 1: Traer movimientos con comprobante vinculado ──────
    const { data: movsCrudos, error: errMovs } = await _supabase
      .from('tesoreria_mbd')
      .select('id,proveedor_empresa_personal,cotizacion,oc,proyecto,concepto,empresa,nro_factura_doc,tipo_doc,entrega_doc,fecha_deposito,monto,nro_operacion_bancaria')
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
        .select('serie_cdp,nro_cp_inicial,proveedor,periodo,total_cp')
        .eq('empresa_id', empId);
      (compras || []).forEach(c => {
        const k = [c.serie_cdp, c.nro_cp_inicial].filter(Boolean).join('-');
        if (k) {
          if (!comprasMap.has(k)) comprasMap.set(k, []);
          comprasMap.get(k).push({ proveedor: c.proveedor || '', periodo: c.periodo || '', total: Number(c.total_cp) || 0 });
        }
      });
    }

    // ── Paso 1c: Traer comprobantes de Ventas para clave compuesta
    let ventasMap = new Map(); // "SERIE-NRO" → [{cliente, periodo}]
    const hayVentas = movs.some(m => m.tipo_doc === 'VENTA');
    if (hayVentas) {
      const { data: ventas } = await _supabase
        .from('contabilidad_ventas')
        .select('serie_cdp,nro_cp_inicial,cliente,periodo,total_cp')
        .eq('empresa_id', empId);
      (ventas || []).forEach(v => {
        const k = [v.serie_cdp, v.nro_cp_inicial].filter(Boolean).join('-');
        if (k) {
          if (!ventasMap.has(k)) ventasMap.set(k, []);
          ventasMap.get(k).push({ proveedor: v.cliente || '', periodo: v.periodo || '', total: Number(v.total_cp) || 0 });
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
    if (actualizados)   parts.push(`${actualizados} estado(s) corregido(s)`);
    if (concCreadas)    parts.push(`${concCreadas} conciliación(es) RH creada(s)`);
    if (cancelados)     parts.push(`${cancelados} CANCELADO(s) respetado(s) sin tocar`);
    if (discrepancias)  parts.push(`⚠️ ${discrepancias} con monto que no coincide — revísalas en Conciliación → Verificar montos`);
    if (!actualizados && !concCreadas && !discrepancias) parts.push('todo ya consistente');
    mostrarToast((discrepancias ? '⚠️ ' : '✅ ') + parts.join(' · '), discrepancias ? 'atencion' : 'exito');

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
