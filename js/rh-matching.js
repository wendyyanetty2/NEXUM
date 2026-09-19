// ═══════════════════════════════════════════════════════════════
// NEXUM v3.0 — Motor de Matching RH ↔ Movimientos
// ═══════════════════════════════════════════════════════════════

// ── Levenshtein similarity (0 a 1) ───────────────────────────────
function _levenshteinSim(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return 0;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

// ── Ventana temporal: mes_filtro -3 hasta +6 meses ───────────────
function _ventanaTemporal(mes, anio) {
  const base   = new Date(Number(anio), Number(mes) - 1, 1);
  const inicio = new Date(base); inicio.setMonth(inicio.getMonth() - 3);
  const fin    = new Date(base); fin.setMonth(fin.getMonth() + 6);
  const fmt    = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { desde: fmt(inicio), hasta: fmt(new Date(fin.getFullYear(), fin.getMonth()+1, 0)) };
}

// ── Palabras clave de RH en descripción de movimiento ────────────
function _tieneKeywordRH(desc) {
  if (!desc) return false;
  const d = desc.toLowerCase();
  return d.includes('rh') || d.includes('honorario') || d.includes('recibo') ||
         d.includes('servicio') || d.includes('cuarta');
}

// ── Aplica los 4 niveles de matching RH vs un movimiento ─────────
function _nivelMatch(rh, mov) {
  const montoRH  = parseFloat(rh.monto_bruto || 0);
  const montoMov = parseFloat(mov.importe || 0);
  const montoOk  = Math.abs(montoRH - montoMov) < 0.01;
  const desc     = (mov.descripcion || '').toLowerCase();
  const dniRH    = (rh.nro_doc_emisor || '').trim();
  const nomRH    = (rh.nombre_emisor  || rh.prestadores_servicios?.nombre || '').trim();

  // NIVEL 1: DNI exacto + monto exacto
  if (montoOk && dniRH && desc.includes(dniRH)) return 1;

  // NIVEL 2: Similitud de nombre >= 0.80 + monto exacto
  if (montoOk && nomRH) {
    const sim = _levenshteinSim(nomRH, desc);
    // También buscar cada palabra del nombre
    const palabras = nomRH.split(/\s+/).filter(p => p.length > 3);
    const coincide = palabras.length > 0 && palabras.some(p => desc.includes(p.toLowerCase()));
    if (sim >= 0.80 || (coincide && montoOk && sim >= 0.50)) return 2;
  }

  // NIVEL 3: Sin nombre en movimiento + monto exacto + keyword RH
  if (montoOk && _tieneKeywordRH(desc)) return 3;

  // NIVEL 4: Solo monto exacto + keyword honorario
  if (montoOk && desc && (desc.includes('honorario') || desc.includes('rh'))) return 4;

  return 0;
}

// ── Busca matches para un RH dentro de una lista de movimientos ──
function _matchearRH(rh, movimientos) {
  const resultados = [];
  for (const mov of movimientos) {
    const nivel = _nivelMatch(rh, mov);
    if (nivel > 0) {
      resultados.push({
        movimiento: mov,
        nivel,
        confianza: nivel <= 2 ? 'alto' : nivel === 3 ? 'medio' : 'posible',
        esAuto:    nivel <= 2,
      });
    }
  }
  // Ordenar por nivel (1=mejor)
  return resultados.sort((a, b) => a.nivel - b.nivel);
}

// ── Busca combinaciones de movimientos que sumen el monto del RH ─
function _buscarCombinaciones(rh, movimientos) {
  const montoRH = parseFloat(rh.monto_bruto || 0);
  const movsFilt = movimientos.filter(m => parseFloat(m.importe) < montoRH + 0.01);

  // Intentar pares
  for (let i = 0; i < movsFilt.length; i++) {
    for (let j = i + 1; j < movsFilt.length; j++) {
      const suma = parseFloat(movsFilt[i].importe) + parseFloat(movsFilt[j].importe);
      if (Math.abs(suma - montoRH) < 0.01) {
        return { movimientos: [movsFilt[i], movsFilt[j]], cuotas: 2 };
      }
    }
  }
  // Intentar tríos
  for (let i = 0; i < movsFilt.length; i++) {
    for (let j = i + 1; j < movsFilt.length; j++) {
      for (let k = j + 1; k < movsFilt.length; k++) {
        const suma = parseFloat(movsFilt[i].importe) + parseFloat(movsFilt[j].importe) + parseFloat(movsFilt[k].importe);
        if (Math.abs(suma - montoRH) < 0.01) {
          return { movimientos: [movsFilt[i], movsFilt[j], movsFilt[k]], cuotas: 3 };
        }
      }
    }
  }
  return null;
}

// ── Carga movimientos en la ventana temporal ──────────────────────
async function _cargarMovimientosVentana(empresaId, mes, anio) {
  const { desde, hasta } = _ventanaTemporal(mes, anio);
  const { data } = await _supabase
    .from('movimientos')
    .select('id, fecha, importe, naturaleza, descripcion, numero_operacion, estado')
    .eq('empresa_operadora_id', empresaId)
    .eq('naturaleza', 'CARGO')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha');
  return data || [];
}

// ── Verifica si un RH ya tiene links confirmados ─────────────────
async function _linksExistentes(rhId) {
  const { data } = await _supabase
    .from('rh_movimiento_links')
    .select('id, movimiento_id, nivel_confianza, es_parcial, monto_parcial, confirmado_en, movimientos(fecha, importe, descripcion)')
    .eq('rh_id', rhId);
  return data || [];
}

// ── Calcula matches SIN guardar — para preview antes de confirmar ─
async function _rhCalcularMatchesSinGuardar(empresaId, mes, anio) {
  const desdeFiltro = `${anio}-${String(mes).padStart(2,'0')}-01`;
  const hastaFiltro = `${anio}-${String(mes).padStart(2,'0')}-${new Date(anio, mes, 0).getDate()}`;

  const { data: rhList } = await _supabase
    .from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('empresa_operadora_id', empresaId)
    .gte('fecha_emision', desdeFiltro)
    .lte('fecha_emision', hastaFiltro)
    .neq('estado', 'ANULADO');

  if (!rhList?.length) return { lista: [], total: 0 };

  const movimientos = await _cargarMovimientosVentana(empresaId, mes, anio);
  const resultado   = [];

  for (const rh of rhList) {
    // Verificar si ya tiene links guardados
    const existing = await _linksExistentes(rh.id);
    if (existing.length) {
      resultado.push({ rh, tipo: 'ya_conciliado', matches: [], combo: null, existing });
      continue;
    }

    const matches = _matchearRH(rh, movimientos);

    if (!matches.length) {
      const combo = _buscarCombinaciones(rh, movimientos);
      if (combo) {
        resultado.push({ rh, tipo: 'combo', matches: [], combo });
      } else {
        resultado.push({ rh, tipo: 'sin_match', matches: [], combo: null });
      }
    } else {
      const mejor = matches[0];
      resultado.push({
        rh,
        tipo:     mejor.nivel <= 2 ? 'auto' : 'posible',
        matches,
        mejorMatch: mejor,
        combo: null,
      });
    }
  }

  return { lista: resultado, total: rhList.length };
}

// ── ¿Se puede vincular este RH a este movimiento? (Wendy, 2026-09-19)
//    Misma validación central que todos los demás caminos de vinculación
//    (_conValidarAntesDeVincular): lo vinculado a un comprobante no puede pasarse de su total
//    ni repetirse — bloquea o pregunta según el margen. Se llama ANTES de crear el vínculo
//    antiguo (rh_movimiento_links), para no dejar un vínculo a medias si se bloquea.
//    El RH se identifica por N° + emisor (DNI exacto o nombre), y también por su código
//    antiguo (UUID) para ver vínculos hechos antes. Si el movimiento no está en
//    tesoreria_mbd (solo en la tabla vieja), no hay nada que validar.
async function _rhValidarVinculo(rhId, movimientoId) {
  if (typeof _conValidarAntesDeVincular !== 'function' || typeof empresa_activa === 'undefined' || !empresa_activa?.id) return { ok: true };
  const [{ data: rh }, { data: movOld }] = await Promise.all([
    _supabase.from('rh_registros').select('numero_rh, nombre_emisor, nro_doc_emisor, monto_neto, prestadores_servicios(nombre, dni)').eq('id', rhId).single(),
    _supabase.from('movimientos').select('numero_operacion').eq('id', movimientoId).single(),
  ]);
  if (!rh || !movOld?.numero_operacion) return { ok: true };
  const nroOp    = String(movOld.numero_operacion);
  const nroOpSin = nroOp.replace(/^0+/, '');
  const { data: mbdRows } = await _supabase.from('tesoreria_mbd').select('id, monto')
    .eq('empresa_id', empresa_activa.id)
    .or(`nro_operacion_bancaria.eq.${nroOp},nro_operacion_bancaria.eq.${nroOpSin}`).limit(1);
  const mbd = mbdRows?.[0];
  if (!mbd) return { ok: true };
  return _conValidarAntesDeVincular(
    empresa_activa.id, 'RH', rh.numero_rh || rhId, Number(rh.monto_neto) || 0, mbd.id, mbd.monto,
    { ruc: rh.nro_doc_emisor || rh.prestadores_servicios?.dni || '', nombre: rh.nombre_emisor || rh.prestadores_servicios?.nombre || '', alt: [rhId] }
  );
}

// ── Confirma un link posible ──────────────────────────────────────
async function confirmarLinkRH(rhId, movimientoId, usuarioId) {
  const { error } = await _supabase
    .from('rh_movimiento_links')
    .update({ confirmado_por: usuarioId, confirmado_en: new Date().toISOString() })
    .eq('rh_id', rhId)
    .eq('movimiento_id', movimientoId);
  if (error) return false;

  // Buscar el movimiento en `movimientos` para obtener su N° operación
  const [{ data: rh }, { data: movOld }] = await Promise.all([
    _supabase.from('rh_registros').select('numero_rh, nombre_emisor, nro_doc_emisor, prestadores_servicios(nombre, dni)').eq('id', rhId).single(),
    _supabase.from('movimientos').select('numero_operacion').eq('id', movimientoId).single(),
  ]);
  const rhNombre = rh?.nombre_emisor  || rh?.prestadores_servicios?.nombre || '';
  const rhDni    = rh?.nro_doc_emisor || rh?.prestadores_servicios?.dni    || '';

  // Buscar en tesoreria_mbd el registro por N° operación (con o sin ceros iniciales)
  if (movOld?.numero_operacion) {
    const nroOp     = String(movOld.numero_operacion);
    const nroOpSin  = nroOp.replace(/^0+/, '');
    let consulta = _supabase
      .from('tesoreria_mbd')
      .select('id, nro_operacion_bancaria, fecha_deposito, descripcion, moneda, monto, proveedor_empresa_personal, ruc_dni, nro_factura_doc, tipo_doc, tipo_comprobante, cotizacion, oc, proyecto, concepto, empresa, autorizacion, entrega_doc')
      .or(`nro_operacion_bancaria.eq.${nroOp},nro_operacion_bancaria.eq.${nroOpSin}`);
    // Solo movimientos de la empresa activa (el N° de operación puede repetirse entre empresas).
    if (typeof empresa_activa !== 'undefined' && empresa_activa?.id) consulta = consulta.eq('empresa_id', empresa_activa.id);
    const { data: mbdRows } = await consulta.limit(1);

    if (mbdRows?.length) {
      const mbd   = mbdRows[0];
      const patch = { estado_conciliacion: 'conciliado', fecha_actualizacion: new Date().toISOString().slice(0, 10) };
      const esUUID = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((v || '').toString().trim());

      // El movimiento guarda el N° LEGIBLE del RH (nunca un código UUID). El mismo N° lo usan varios
      // emisores: el RH se distingue por N° + emisor (DNI/nombre, que se copian más abajo).
      // Se completa si estaba vacío o si tenía un código antiguo; un comprobante real distinto no se pisa.
      if (rh?.numero_rh && (!mbd.nro_factura_doc || esUUID(mbd.nro_factura_doc))) patch.nro_factura_doc = rh.numero_rh;
      // Categoría interna: solo se completa si faltaba o estaba DAÑADA (ej. 'FA', bug del modal).
      if (!['COMPRA', 'VENTA', 'RH', 'PM'].includes(mbd.tipo_doc)) patch.tipo_doc = 'RH';
      patch.tipo_comprobante = 'RH';
      // Proveedor/Empresa: si ya tenía un nombre distinto al del RH (pago a
      // tercero), se conserva y el del RH se guarda aparte en titular_comprobante
      // — nunca se sobrescribe en silencio (Wendy, 2026-09-18). El DNI del RH pasa al
      // movimiento: con él se reconoce el vínculo (N° + emisor).
      if (typeof _resolverProveedorTitular === 'function') {
        const rt = _resolverProveedorTitular(mbd.proveedor_empresa_personal, rhNombre, mbd.ruc_dni, rhDni);
        patch.proveedor_empresa_personal = rt.proveedor;
        patch.titular_comprobante = rt.titular;
        patch.ruc_dni = rt.ruc;
      } else {
        if (rhNombre) patch.proveedor_empresa_personal = rhNombre;
        if (rhDni)    patch.ruc_dni = rhDni;
      }

      // Estado con la MISMA regla de los 14 campos que usan todos los demás caminos de vinculación
      // (antes aquí EMITIDO exigía Cotización Y OC; en el resto basta una de las dos).
      const completo = { ...mbd, ...patch,
        nro_factura_doc: patch.nro_factura_doc || mbd.nro_factura_doc,
        tipo_doc: patch.tipo_doc || mbd.tipo_doc };
      if (typeof _conEvalCompletitud14 === 'function') {
        patch.entrega_doc = _conEvalCompletitud14(completo);
      } else {
        const proveedor = (completo.proveedor_empresa_personal || '').trim();
        const okc = v => !!(v && String(v).trim());
        patch.entrega_doc = (proveedor && (okc(mbd.cotizacion) || okc(mbd.oc)) && okc(mbd.proyecto) && okc(mbd.concepto) && okc(mbd.empresa))
          ? 'EMITIDO' : 'OBSERVADO';
      }

      await _supabase.from('tesoreria_mbd').update(patch).eq('id', mbd.id);
    }
  }

  return true;
}

// ── Elimina un link específico ────────────────────────────────────
async function eliminarLinkRH(rhId, movimientoId) {
  const { error } = await _supabase
    .from('rh_movimiento_links')
    .delete()
    .eq('rh_id', rhId)
    .eq('movimiento_id', movimientoId);
  return !error;
}
