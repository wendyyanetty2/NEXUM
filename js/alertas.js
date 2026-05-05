// ═══════════════════════════════════════════════════════════════
// NEXUM v3.0 — Sistema de Alertas Automáticas
// ═══════════════════════════════════════════════════════════════

(function () {

  // ── Crear o actualizar una alerta ─────────────────────────────
  async function _upsertAlerta(empresaId, tipo, titulo, opts = {}) {
    const { prioridad = 'media', descripcion = null, entidad_tipo = null, entidad_id = null, monto = null, fecha_vencimiento = null, nota_id = null } = opts;
    // Verificar si ya existe una alerta activa del mismo tipo+entidad
    let q = _supabase.from('alertas_sistema')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tipo', tipo)
      .eq('estado', 'activa');
    if (entidad_id) q = q.eq('entidad_id', entidad_id);
    else q = q.eq('titulo', titulo);

    const { data: existing } = await q.maybeSingle();
    if (existing) return; // ya existe

    await _supabase.from('alertas_sistema').insert({
      empresa_id: empresaId, tipo, prioridad, titulo, descripcion,
      entidad_tipo, entidad_id, nota_id, monto, fecha_vencimiento,
    });
  }

  // ── Verificar duplicados ──────────────────────────────────────
  async function _verificarDuplicados(empresaId) {
    const haceUnaSemana = new Date();
    haceUnaSemana.setDate(haceUnaSemana.getDate() - 5);
    const desde = haceUnaSemana.toISOString().slice(0, 10);

    const { data: movs } = await _supabase
      .from('movimientos')
      .select('id, fecha, importe, descripcion, naturaleza')
      .eq('empresa_operadora_id', empresaId)
      .eq('naturaleza', 'CARGO')
      .gte('fecha', desde)
      .order('importe');

    if (!movs?.length) return;

    // Agrupar por importe y buscar duplicados en ≤5 días
    const grupos = {};
    movs.forEach(m => {
      const key = parseFloat(m.importe).toFixed(2);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(m);
    });

    for (const [monto, lista] of Object.entries(grupos)) {
      if (lista.length < 2) continue;
      for (let i = 0; i < lista.length - 1; i++) {
        const a = lista[i], b = lista[i + 1];
        const dias = Math.abs(new Date(a.fecha) - new Date(b.fecha)) / 86400000;
        if (dias <= 5) {
          await _upsertAlerta(empresaId, 'posible_duplicado',
            `Posible pago duplicado S/ ${monto}`,
            {
              prioridad: 'alta',
              descripcion: `Movimientos del ${a.fecha} y ${b.fecha} tienen el mismo monto S/ ${monto} con ${Math.round(dias)} día(s) de diferencia`,
              entidad_id: a.id,
              entidad_tipo: 'movimiento',
              monto: parseFloat(monto),
            });
        }
      }
    }
  }

  // ── RH sin aplicar por más de 90 días ─────────────────────────
  async function _verificarRHSinAplicar(empresaId) {
    const hace90 = new Date();
    hace90.setDate(hace90.getDate() - 90);
    const limite = hace90.toISOString().slice(0, 10);

    const { data: rhList } = await _supabase
      .from('rh_registros')
      .select('id, numero_rh, nombre_emisor, monto_bruto, fecha_emision')
      .eq('empresa_operadora_id', empresaId)
      .eq('estado', 'EMITIDO')
      .eq('conciliado', false)
      .lte('fecha_emision', limite);

    if (!rhList?.length) return;

    // Verificar cuáles no tienen links confirmados
    for (const rh of rhList) {
      const { data: links } = await _supabase
        .from('rh_movimiento_links')
        .select('id')
        .eq('rh_id', rh.id)
        .not('confirmado_en', 'is', null)
        .limit(1);

      if (!links?.length) {
        const dias = Math.floor((new Date() - new Date(rh.fecha_emision)) / 86400000);
        await _upsertAlerta(empresaId, 'rh_sin_aplicar',
          `RH ${rh.numero_rh || ''} sin aplicar (${dias} días)`,
          {
            prioridad: dias > 180 ? 'alta' : 'media',
            descripcion: `${rh.nombre_emisor || 'Emisor desconocido'} — S/ ${Number(rh.monto_bruto).toFixed(2)} — Emitido el ${rh.fecha_emision}`,
            entidad_id: rh.id,
            entidad_tipo: 'rh',
            monto: parseFloat(rh.monto_bruto),
          });
      }
    }
  }

  // ── Movimientos sin comprobante por más de 15 días ─────────────
  async function _verificarSinComprobante(empresaId) {
    const hace15 = new Date();
    hace15.setDate(hace15.getDate() - 15);
    const limite = hace15.toISOString().slice(0, 10);

    const { data: movs } = await _supabase
      .from('movimientos')
      .select('id, fecha, importe, descripcion, naturaleza')
      .eq('empresa_operadora_id', empresaId)
      .eq('naturaleza', 'CARGO')
      .eq('estado', 'PENDIENTE')
      .lte('fecha', limite)
      .limit(20);

    if (!movs?.length) return;

    for (const mov of movs) {
      const dias = Math.floor((new Date() - new Date(mov.fecha)) / 86400000);
      await _upsertAlerta(empresaId, 'sin_comprobante',
        `Cargo sin comprobante (${dias} días)`,
        {
          prioridad: dias > 30 ? 'alta' : 'media',
          descripcion: `S/ ${Number(mov.importe).toFixed(2)} — ${(mov.descripcion || '').slice(0, 80)} — Fecha: ${mov.fecha}`,
          entidad_id: mov.id,
          entidad_tipo: 'movimiento',
          monto: parseFloat(mov.importe),
        });
    }
  }

  // ── Alertas por notas próximas a vencer ───────────────────────
  async function _verificarNotasVencimiento(empresaId) {
    const hoy     = new Date().toISOString().slice(0, 10);
    const en3dias = new Date(); en3dias.setDate(en3dias.getDate() + 3);
    const en3str  = en3dias.toISOString().slice(0, 10);

    const { data: notas } = await _supabase
      .from('notas_operativas')
      .select('id, titulo, fecha_vencimiento, tipo, monto_referencia, persona_referencia')
      .eq('empresa_id', empresaId)
      .in('estado', ['pendiente', 'en_proceso'])
      .lte('fecha_vencimiento', en3str)
      .not('fecha_vencimiento', 'is', null);

    if (!notas?.length) return;

    for (const nota of notas) {
      const dias = Math.ceil((new Date(nota.fecha_vencimiento + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 86400000);
      const label = dias <= 0 ? 'VENCIDA' : dias === 1 ? 'mañana' : `en ${dias} días`;
      await _upsertAlerta(empresaId, 'nota_vence',
        `Nota vence ${label}: ${nota.titulo}`,
        {
          prioridad: dias <= 0 ? 'alta' : 'media',
          descripcion: nota.persona_referencia
            ? `${nota.persona_referencia}${nota.monto_referencia ? ' — S/ ' + Number(nota.monto_referencia).toFixed(2) : ''}`
            : null,
          nota_id: nota.id,
          entidad_tipo: 'nota',
          fecha_vencimiento: nota.fecha_vencimiento,
          monto: nota.monto_referencia ? parseFloat(nota.monto_referencia) : null,
        });
    }
  }

  // ── Ejecutar todas las verificaciones ─────────────────────────
  async function ejecutarVerificacion(empresaId) {
    if (!empresaId) return;
    await Promise.allSettled([
      _verificarDuplicados(empresaId),
      _verificarRHSinAplicar(empresaId),
      _verificarSinComprobante(empresaId),
      _verificarNotasVencimiento(empresaId),
    ]);
  }

  // ── Ignorar una alerta ─────────────────────────────────────────
  async function ignorarAlerta(alertaId) {
    await _supabase.from('alertas_sistema')
      .update({ estado: 'ignorada' })
      .eq('id', alertaId);
  }

  async function resolverAlerta(alertaId, usuarioId) {
    await _supabase.from('alertas_sistema')
      .update({ estado: 'resuelta', resuelta_por: usuarioId, resuelta_en: new Date().toISOString() })
      .eq('id', alertaId);
  }

  // ── Widget para el dashboard ───────────────────────────────────
  async function cargarWidgetDashboard(contenedorId, cardId, empresaId) {
    const el   = document.getElementById(contenedorId);
    const card = document.getElementById(cardId);
    if (!el || !empresaId) return;

    // Ejecutar verificación en background
    ejecutarVerificacion(empresaId).catch(() => {});

    const { data: alertas } = await _supabase
      .from('alertas_sistema')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('estado', 'activa')
      .order('prioridad', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(10);

    if (!alertas?.length) {
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = 'block';

    const iconos = {
      posible_duplicado: '⚠️',
      rh_sin_aplicar:    '📄',
      sin_comprobante:   '🧾',
      diferencia_planilla: '👥',
      nota_vence:        '🔔',
      adelanto_pendiente: '💰',
    };
    const colores = { alta: '#C53030', media: '#D69E2E', baja: '#4A5568' };

    el.innerHTML = alertas.map(a => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-borde)">
        <span style="font-size:16px;flex-shrink:0">${iconos[a.tipo] || '🔔'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:${colores[a.prioridad]||'var(--color-texto)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapar(a.titulo)}</div>
          ${a.descripcion ? `<div style="font-size:11px;color:var(--color-texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapar(a.descripcion.slice(0,80))}</div>` : ''}
        </div>
        <button onclick="window.NEXUM_ALERTAS.ignorar('${a.id}')" title="Ignorar" style="padding:2px 6px;background:none;border:1px solid var(--color-borde);border-radius:4px;cursor:pointer;font-size:11px;color:var(--color-texto-suave);flex-shrink:0">✕</button>
      </div>`).join('') +
      (alertas.length >= 10 ? `<div style="font-size:11px;color:var(--color-texto-suave);text-align:center;padding:8px 0">Mostrando las 10 más recientes</div>` : '');
  }

  // ── Inicializar (ejecuta verificación al cargar) ───────────────
  function init(empresaId) {
    if (!empresaId) return;
    // Verificar después de 3 segundos para no bloquear la carga inicial
    setTimeout(() => ejecutarVerificacion(empresaId).catch(() => {}), 3000);
  }

  // ── API pública ────────────────────────────────────────────────
  window.NEXUM_ALERTAS = {
    init,
    ejecutarVerificacion,
    ignorar: async (id) => {
      await ignorarAlerta(id);
      // Recargar widget si existe
      const el = document.getElementById('dash-alertas-widget');
      const card = document.getElementById('dash-alertas-card');
      if (el && empresa_activa) await cargarWidgetDashboard('dash-alertas-widget', 'dash-alertas-card', empresa_activa.id);
    },
    resolver: resolverAlerta,
    cargarWidgetDashboard,
  };

})();
