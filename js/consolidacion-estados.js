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
  const todosEmitidos = movsVinculados.every(m => m.entrega_doc === 'EMITIDO');
  return {
    estado: todosEmitidos ? 'COMPLETO_EMITIDO' : 'COMPLETO_OBSERVADO',
    suma: round(suma), total: round(total), falta: 0,
  };
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
//    2026-08-19 — punto 2.5. Evalúa los 14 campos del comprobante.
//    Ningún campo faltante → PENDIENTE. Todos completos → EMITIDO.
//    Algunos completos → OBSERVADO. Se usa solo en acciones NUEVAS
//    (vincular, dividir) — nunca sobrescribe un estado CANCELADO
//    (ese se asigna manualmente en Tesorería → Movimientos). ──────
function _conEvalCompletitud14(mov) {
  if (mov.entrega_doc === 'CANCELADO') return 'CANCELADO';
  const ok = v => !!(v && String(v).trim());
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
  const completos = slots.filter(Boolean).length;
  if (completos === 0) return 'PENDIENTE';
  if (completos === slots.length) return 'EMITIDO';
  return 'OBSERVADO';
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

// ── Período del movimiento y del comprobante son compatibles ────
// Tolerancia ±2 meses (el pago puede caer en mes distinto al de emisión)
function _conPeriodoCercano(periodoMov, periodoComp) {
  if (!periodoMov || !periodoComp || periodoMov.length < 6 || periodoComp.length < 6) return true;
  const ym = parseInt(periodoMov.slice(0, 4)) * 12 + parseInt(periodoMov.slice(4, 6));
  const yc = parseInt(periodoComp.slice(0, 4)) * 12 + parseInt(periodoComp.slice(4, 6));
  return Math.abs(ym - yc) <= 2;
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
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Consolidando…'; }

  try {
    const hoy   = new Date().toISOString().slice(0, 10);
    const empId = empresa_activa.id;
    const uid   = typeof perfil_usuario !== 'undefined' ? (perfil_usuario?.id || null) : null;
    let actualizados = 0;
    let concCreadas  = 0;

    // ── Paso 1: Traer movimientos con comprobante vinculado ──────
    const { data: movsCrudos, error: errMovs } = await _supabase
      .from('tesoreria_mbd')
      .select('id,proveedor_empresa_personal,cotizacion,oc,proyecto,concepto,empresa,nro_factura_doc,tipo_doc,entrega_doc,fecha_deposito,monto')
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
    let discrepancias = 0;

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

        // Reforzado (1.2): además verificar que el MONTO del movimiento coincida
        // razonablemente con el total del comprobante — si no coincide, no se
        // actualiza el estado automáticamente (queda para revisión manual).
        const montoOk = !matchNombrePeriodo.length || matchNombrePeriodo.some(c =>
          Math.abs(Math.abs(Number(mov.monto) || 0) - c.total) < Math.max(c.total * 0.02, 1)
        );
        if (claveValida && matchNombrePeriodo.length && !montoOk) discrepancias++;

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
    const parts = [`${movs.length} mov. revisados`];
    if (actualizados)   parts.push(`${actualizados} estado(s) corregido(s)`);
    if (concCreadas)    parts.push(`${concCreadas} conciliación(es) RH creada(s)`);
    if (cancelados)     parts.push(`${cancelados} CANCELADO(s) respetado(s) sin tocar`);
    if (discrepancias)  parts.push(`⚠️ ${discrepancias} con monto que no coincide — revisar manualmente`);
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
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Consolidar estados'; }
  }
}
