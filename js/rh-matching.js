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

// ── Calcula estado visible de un RH basado en sus links ──────────
async function calcularEstadoRH(rh) {
  const links = await _linksExistentes(rh.id);
  if (!links.length) return { estado: 'PENDIENTE', color: '#C53030', links: [] };

  const confirmados = links.filter(l => l.confirmado_en);
  const posibles    = links.filter(l => !l.confirmado_en);

  if (!confirmados.length && posibles.length) {
    return { estado: 'POSIBLE', color: '#D69E2E', links, posibles };
  }

  const montoPagado = confirmados.reduce((s, l) => s + parseFloat(l.monto_parcial || l.movimientos?.importe || 0), 0);
  const montoRH     = parseFloat(rh.monto_bruto || 0);

  if (Math.abs(montoPagado - montoRH) < 0.01) {
    return { estado: 'APLICADO', color: '#2F855A', links, confirmados };
  }
  if (montoPagado > 0 && montoPagado < montoRH) {
    return { estado: 'PARCIAL', color: '#DD6B20', links, confirmados, montoPagado, montoRH };
  }
  return { estado: 'PENDIENTE', color: '#C53030', links: [] };
}

// ── Ejecuta conciliación automática para todos los RH del período ─
async function ejecutarMatchingAutomatico(empresaId, mes, anio, usuarioId) {
  const periodo = `${anio}-${String(mes).padStart(2,'0')}`;
  const { desde: desdeFiltro, hasta: hastaFiltro } = (() => {
    const d = `${anio}-${String(mes).padStart(2,'0')}-01`;
    const h = `${anio}-${String(mes).padStart(2,'0')}-${new Date(anio, mes, 0).getDate()}`;
    return { desde: d, hasta: h };
  })();

  // Cargar RH del período
  const { data: rhList } = await _supabase
    .from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('empresa_operadora_id', empresaId)
    .gte('fecha_emision', desdeFiltro)
    .lte('fecha_emision', hastaFiltro)
    .neq('estado', 'ANULADO');

  if (!rhList?.length) return { ok: 0, posibles: 0, sinMatch: 0 };

  // Cargar movimientos en ventana temporal
  const movimientos = await _cargarMovimientosVentana(empresaId, mes, anio);

  let ok = 0, posibles = 0, sinMatch = 0;

  for (const rh of rhList) {
    // Verificar si ya tiene links
    const existing = await _linksExistentes(rh.id);
    if (existing.length) { ok++; continue; }

    const matches = _matchearRH(rh, movimientos);

    if (!matches.length) {
      // Intentar combinaciones (pago en cuotas)
      const combo = _buscarCombinaciones(rh, movimientos);
      if (combo) {
        for (const mov of combo.movimientos) {
          const montoParcial = parseFloat(mov.importe);
          await _supabase.from('rh_movimiento_links').upsert({
            empresa_id:      empresaId,
            rh_id:           rh.id,
            movimiento_id:   mov.id,
            nivel_confianza: 'posible',
            es_parcial:      true,
            monto_parcial:   montoParcial,
          }, { onConflict: 'rh_id,movimiento_id', ignoreDuplicates: true });
        }
        posibles++;
      } else {
        sinMatch++;
      }
      continue;
    }

    const mejor = matches[0];
    const autoConfirmar = mejor.nivel <= 2;

    const { error } = await _supabase.from('rh_movimiento_links').upsert({
      empresa_id:      empresaId,
      rh_id:           rh.id,
      movimiento_id:   mejor.movimiento.id,
      nivel_confianza: mejor.confianza,
      es_parcial:      false,
      monto_parcial:   null,
      confirmado_por:  autoConfirmar ? usuarioId : null,
      confirmado_en:   autoConfirmar ? new Date().toISOString() : null,
    }, { onConflict: 'rh_id,movimiento_id', ignoreDuplicates: true });

    if (!error) {
      if (autoConfirmar) ok++;
      else posibles++;
    }
  }

  return { ok, posibles, sinMatch, total: rhList.length };
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

// ── Confirma un link posible ──────────────────────────────────────
async function confirmarLinkRH(rhId, movimientoId, usuarioId) {
  const { error } = await _supabase
    .from('rh_movimiento_links')
    .update({ confirmado_por: usuarioId, confirmado_en: new Date().toISOString() })
    .eq('rh_id', rhId)
    .eq('movimiento_id', movimientoId);
  if (error) return false;

  // MEJORA 6: migrar datos del RH al movimiento bancario en tesoreria_mbd
  const [{ data: rh }, { data: mov }] = await Promise.all([
    _supabase.from('rh_registros').select('nombre,ruc,numero,serie').eq('id', rhId).single(),
    _supabase.from('tesoreria_mbd').select('proveedor_empresa_personal,ruc_dni,nro_factura_doc,tipo_doc').eq('id', movimientoId).single(),
  ]);
  if (rh && mov) {
    const patch = { estado_conciliacion: 'conciliado', entrega_doc: 'EMITIDO' };
    const nroDoc = [rh.serie, rh.numero].filter(Boolean).join('-') || null;
    if (nroDoc  && !mov.nro_factura_doc)              patch.nro_factura_doc            = nroDoc;
    if (!mov.tipo_doc)                                patch.tipo_doc                   = 'RH';
    if (rh.nombre && !mov.proveedor_empresa_personal) patch.proveedor_empresa_personal = rh.nombre;
    if (rh.ruc    && !mov.ruc_dni)                    patch.ruc_dni                    = rh.ruc;
    await _supabase.from('tesoreria_mbd').update(patch).eq('id', movimientoId);
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
