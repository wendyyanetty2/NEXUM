// ═══════════════════════════════════════════════════════════════
// NEXUM v3.0 — Sistema de Notas Operativas
// Botón flotante + panel lateral disponible en todas las páginas
// ═══════════════════════════════════════════════════════════════

(function () {
  // Variables de estado del módulo de notas
  let _notasPanelAbierto = false;
  let _notasFiltro = 'pendientes';
  let _notasEmpresaId = null;
  let _notasUsuarioId = null;

  const TIPOS = {
    adelanto:              '💰 Adelanto',
    rh_pendiente:          '📄 RH Pendiente',
    comprobante_pendiente: '🧾 Comprobante pendiente',
    regularizar:           '🔄 Regularizar',
    descuento_planilla:    '👥 Descuento planilla',
    libre:                 '📝 Libre',
  };

  const PRIORIDADES = {
    alta:  { label: '🔴 Alta',   color: '#C53030' },
    media: { label: '🟡 Media',  color: '#D69E2E' },
    baja:  { label: '⚪ Baja',   color: '#4A5568' },
  };

  // ── Inyectar HTML del sistema de notas ─────────────────────────
  function _inyectarDOM() {
    if (document.getElementById('nexum-notas-root')) return;

    const root = document.createElement('div');
    root.id = 'nexum-notas-root';
    root.innerHTML = `
      <!-- Botón flotante — arrastrable, posición por defecto esquina superior derecha -->
      <div id="nexum-notas-fab"
        title="📝 Notas — Arrastrar para mover"
        style="position:fixed;top:68px;right:16px;z-index:9000;cursor:grab;
               background:var(--color-secundario,#2B6CB0);color:#fff;border-radius:50px;
               padding:7px 14px;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.4);
               display:flex;align-items:center;gap:6px;user-select:none;transition:box-shadow .15s">
        <span style="font-size:11px;opacity:.6;letter-spacing:1px">⠿</span> 📝 Notas
        <span id="nexum-notas-badge" style="display:none;background:#C53030;color:#fff;
          border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;
          align-items:center;justify-content:center;min-width:20px"></span>
      </div>

      <!-- Overlay -->
      <div id="nexum-notas-overlay" onclick="window.NEXUM_NOTAS.toggle()"
        style="display:none;position:fixed;inset:0;z-index:8998;background:rgba(0,0,0,.4)"></div>

      <!-- Panel lateral -->
      <div id="nexum-notas-panel"
        style="display:none;position:fixed;top:0;right:0;width:400px;max-width:100vw;height:100vh;
               z-index:8999;background:var(--color-bg-card,#1e293b);border-left:1px solid var(--color-borde,#334155);
               flex-direction:column;box-shadow:-8px 0 32px rgba(0,0,0,.4);font-family:var(--font,sans-serif)">

        <!-- Cabecera -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--color-borde);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div>
            <h3 style="margin:0;font-size:15px;color:var(--color-texto)">📝 Mis Notas Operativas</h3>
            <div id="nexum-notas-resumen" style="font-size:11px;color:var(--color-texto-suave);margin-top:2px"></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button onclick="window.NEXUM_NOTAS.abrirNueva()"
              style="padding:6px 12px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font);font-weight:500">
              + Nueva
            </button>
            <button onclick="window.NEXUM_NOTAS.toggle()"
              style="padding:6px 10px;background:none;border:none;cursor:pointer;font-size:18px;color:var(--color-texto-suave)">✕</button>
          </div>
        </div>

        <!-- Filtros -->
        <div style="padding:10px 20px;border-bottom:1px solid var(--color-borde);display:flex;gap:6px;flex-shrink:0">
          ${['todas','pendientes','alta','resueltas'].map(f => `
            <button onclick="window.NEXUM_NOTAS.setFiltro('${f}')" id="notas-tab-${f}"
              style="padding:4px 10px;border:1px solid var(--color-borde);border-radius:20px;cursor:pointer;font-size:11px;font-family:var(--font);background:var(--color-bg-card);color:var(--color-texto);transition:all .15s">
              ${f === 'todas' ? 'Todas' : f === 'pendientes' ? 'Pendientes' : f === 'alta' ? '🔴 Urgentes' : 'Resueltas'}
            </button>`).join('')}
        </div>

        <!-- Lista de notas -->
        <div id="nexum-notas-lista" style="flex:1;overflow-y:auto;padding:12px 16px"></div>

        <!-- Formulario nueva nota (modal interno) -->
        <div id="nexum-notas-form-wrap" style="display:none;position:absolute;inset:0;background:var(--color-bg-card);z-index:10;flex-direction:column;overflow-y:auto">
          <div style="padding:16px 20px;border-bottom:1px solid var(--color-borde);display:flex;align-items:center;justify-content:space-between">
            <h3 id="nexum-notas-form-titulo" style="margin:0;font-size:14px;color:var(--color-texto)">Nueva nota</h3>
            <button onclick="window.NEXUM_NOTAS.cerrarForm()"
              style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--color-texto-suave)">✕</button>
          </div>
          <div style="padding:16px 20px;flex:1">
            <div id="notas-form-alerta" style="display:none;background:rgba(197,48,48,.15);color:#FC8181;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px"></div>

            <div style="margin-bottom:12px">
              <label style="font-size:12px;color:var(--color-texto-suave);display:block;margin-bottom:4px">Título *</label>
              <input id="notas-inp-titulo" type="text" maxlength="200" placeholder="Ej: Adelanto ARIZA GIULIANA"
                style="width:100%;padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg);color:var(--color-texto);font-size:13px;font-family:var(--font);box-sizing:border-box">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
              <div>
                <label style="font-size:12px;color:var(--color-texto-suave);display:block;margin-bottom:4px">Tipo</label>
                <select id="notas-inp-tipo"
                  style="width:100%;padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
                  ${Object.entries(TIPOS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="font-size:12px;color:var(--color-texto-suave);display:block;margin-bottom:4px">Prioridad</label>
                <select id="notas-inp-prioridad"
                  style="width:100%;padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
                  <option value="alta">🔴 Alta</option>
                  <option value="media" selected>🟡 Media</option>
                  <option value="baja">⚪ Baja</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:12px;color:var(--color-texto-suave);display:block;margin-bottom:4px">Descripción</label>
              <textarea id="notas-inp-desc" rows="3" placeholder="Detalles adicionales…"
                style="width:100%;padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg);color:var(--color-texto);font-size:12px;font-family:var(--font);resize:vertical;box-sizing:border-box"></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
              <div>
                <label style="font-size:12px;color:var(--color-texto-suave);display:block;margin-bottom:4px">Monto referencia (S/)</label>
                <input id="notas-inp-monto" type="number" step="0.01" placeholder="0.00"
                  style="width:100%;padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg);color:var(--color-texto);font-size:13px;font-family:var(--font);box-sizing:border-box">
              </div>
              <div>
                <label style="font-size:12px;color:var(--color-texto-suave);display:block;margin-bottom:4px">Fecha de vencimiento</label>
                <input id="notas-inp-vence" type="date"
                  style="width:100%;padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg);color:var(--color-texto);font-size:13px;font-family:var(--font);box-sizing:border-box">
              </div>
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:12px;color:var(--color-texto-suave);display:block;margin-bottom:4px">Persona referencia</label>
              <input id="notas-inp-persona" type="text" placeholder="Nombre del trabajador o proveedor"
                style="width:100%;padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg);color:var(--color-texto);font-size:13px;font-family:var(--font);box-sizing:border-box">
            </div>
          </div>

          <div style="padding:12px 20px;border-top:1px solid var(--color-borde);display:flex;gap:8px;justify-content:flex-end">
            <button onclick="window.NEXUM_NOTAS.cerrarForm()"
              style="padding:7px 16px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:13px;font-family:var(--font)">
              Cancelar
            </button>
            <button onclick="window.NEXUM_NOTAS.guardar()"
              style="padding:7px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-family:var(--font);font-weight:500">
              💾 Guardar nota
            </button>
          </div>
        </div>

      </div><!-- /panel -->
    `;
    document.body.appendChild(root);
    _actualizarTabsFiltro();
  }

  // ── Cargar y renderizar notas ───────────────────────────────────
  async function _cargarNotas() {
    const lista = document.getElementById('nexum-notas-lista');
    if (!lista || !_notasEmpresaId) return;

    lista.innerHTML = '<div style="text-align:center;padding:24px;color:var(--color-texto-suave);font-size:13px">Cargando…</div>';

    let q = _supabase
      .from('notas_operativas')
      .select('*')
      .eq('empresa_id', _notasEmpresaId)
      .order('created_at', { ascending: false });

    if (_notasFiltro === 'pendientes') {
      q = q.in('estado', ['pendiente', 'en_proceso']);
    } else if (_notasFiltro === 'alta') {
      q = q.eq('prioridad', 'alta').neq('estado', 'resuelta');
    } else if (_notasFiltro === 'resueltas') {
      q = q.in('estado', ['resuelta', 'ignorada']);
    }

    const { data: notas } = await q.limit(50);
    const lista2 = document.getElementById('nexum-notas-lista');
    if (!lista2) return;

    if (!notas?.length) {
      lista2.innerHTML = `<div style="text-align:center;padding:32px 16px;color:var(--color-texto-suave);font-size:13px">
        ${_notasFiltro === 'pendientes' ? '✅ Sin notas pendientes' : 'Sin notas en esta categoría'}
      </div>`;
      return;
    }

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    lista2.innerHTML = notas.map(n => {
      const pri     = PRIORIDADES[n.prioridad] || PRIORIDADES.media;
      const tipo    = TIPOS[n.tipo] || '📝 Libre';
      const vence   = n.fecha_vencimiento ? new Date(n.fecha_vencimiento + 'T00:00:00') : null;
      const diasAl  = vence ? Math.ceil((vence - hoy) / 86400000) : null;
      let urgenciaLabel = '';
      if (diasAl !== null) {
        if (diasAl < 0)       urgenciaLabel = `<span style="color:#FC8181;font-size:10px;font-weight:700">VENCIDO ${Math.abs(diasAl)}d</span>`;
        else if (diasAl === 0) urgenciaLabel = `<span style="color:#FC8181;font-size:10px;font-weight:700">HOY</span>`;
        else if (diasAl <= 3)  urgenciaLabel = `<span style="color:#F6AD55;font-size:10px;font-weight:700">En ${diasAl}d</span>`;
        else                   urgenciaLabel = `<span style="color:var(--color-texto-suave);font-size:10px">Vence ${n.fecha_vencimiento}</span>`;
      }

      const resuelta = n.estado === 'resuelta' || n.estado === 'ignorada';
      return `
      <div style="border:1px solid var(--color-borde);border-left:3px solid ${pri.color};border-radius:8px;padding:12px;margin-bottom:8px;
                  background:var(--color-bg,#0f172a);opacity:${resuelta?'.6':'1'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div style="font-weight:600;font-size:13px;color:var(--color-texto);flex:1;margin-right:8px">${escaparHTML(n.titulo)}</div>
          <span style="font-size:10px;padding:2px 6px;border-radius:8px;background:${pri.color}20;color:${pri.color};white-space:nowrap;flex-shrink:0">${pri.label}</span>
        </div>
        <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:6px">
          ${tipo}${n.persona_referencia ? ' · ' + escaparHTML(n.persona_referencia) : ''}${n.monto_referencia ? ' · S/ ' + Number(n.monto_referencia).toFixed(2) : ''}
        </div>
        ${n.descripcion ? `<div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:6px;line-height:1.4">${escaparHTML(n.descripcion.slice(0,120))}${n.descripcion.length>120?'…':''}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>${urgenciaLabel}</div>
          <div style="display:flex;gap:4px">
            ${resuelta ? '' : `
              <button onclick="window.NEXUM_NOTAS.resolver('${n.id}')"
                style="padding:3px 8px;background:rgba(47,133,90,.2);color:#68D391;border:none;border-radius:4px;cursor:pointer;font-size:11px">
                ✓ Resolver
              </button>`}
            <button onclick="window.NEXUM_NOTAS.editar('${n.id}')"
              style="padding:3px 8px;background:rgba(44,82,130,.15);color:#90CDF4;border:none;border-radius:4px;cursor:pointer;font-size:11px">
              ✏️
            </button>
            <button onclick="window.NEXUM_NOTAS.eliminar('${n.id}')"
              style="padding:3px 8px;background:rgba(197,48,48,.15);color:#FC8181;border:none;border-radius:4px;cursor:pointer;font-size:11px">
              🗑️
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Badge con urgentes
    const urgentes = (notas || []).filter(n => {
      const vence = n.fecha_vencimiento ? new Date(n.fecha_vencimiento + 'T00:00:00') : null;
      const dias  = vence ? Math.ceil((vence - hoy) / 86400000) : null;
      return n.estado === 'pendiente' && (dias !== null && dias <= 1);
    }).length;

    const badge = document.getElementById('nexum-notas-badge');
    if (badge) {
      if (urgentes > 0) {
        badge.style.display = 'flex';
        badge.textContent   = urgentes;
      } else {
        badge.style.display = 'none';
      }
    }

    // Resumen
    const pending = (notas || []).filter(n => n.estado === 'pendiente' || n.estado === 'en_proceso').length;
    const resumenEl = document.getElementById('nexum-notas-resumen');
    if (resumenEl) resumenEl.textContent = `${pending} pendiente(s)`;
  }

  // ── Escape HTML simple ──────────────────────────────────────────
  function escaparHTML(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Toggle panel ─────────────────────────────────────────────────
  function toggle() {
    _notasPanelAbierto = !_notasPanelAbierto;
    const panel   = document.getElementById('nexum-notas-panel');
    const overlay = document.getElementById('nexum-notas-overlay');
    if (panel)   { panel.style.display   = _notasPanelAbierto ? 'flex' : 'none'; }
    if (overlay) { overlay.style.display = _notasPanelAbierto ? 'block' : 'none'; }
    if (_notasPanelAbierto) _cargarNotas();
  }

  // ── Filtros ────────────────────────────────────────────────────
  function setFiltro(f) {
    _notasFiltro = f;
    _actualizarTabsFiltro();
    _cargarNotas();
  }

  function _actualizarTabsFiltro() {
    ['todas','pendientes','alta','resueltas'].forEach(f => {
      const btn = document.getElementById('notas-tab-' + f);
      if (!btn) return;
      btn.style.background = f === _notasFiltro ? 'var(--color-secundario)' : 'var(--color-bg-card)';
      btn.style.color      = f === _notasFiltro ? '#fff' : 'var(--color-texto)';
      btn.style.borderColor= f === _notasFiltro ? 'var(--color-secundario)' : 'var(--color-borde)';
    });
  }

  // ── Formulario nueva/editar ─────────────────────────────────────
  let _editandoId = null;

  function abrirNueva() {
    _editandoId = null;
    _limpiarForm();
    document.getElementById('nexum-notas-form-titulo').textContent = 'Nueva nota';
    document.getElementById('nexum-notas-form-wrap').style.display = 'flex';
  }

  async function editar(id) {
    const { data } = await _supabase.from('notas_operativas').select('*').eq('id', id).single();
    if (!data) return;
    _editandoId = id;
    _limpiarForm();
    document.getElementById('nexum-notas-form-titulo').textContent = 'Editar nota';
    document.getElementById('notas-inp-titulo').value    = data.titulo || '';
    document.getElementById('notas-inp-tipo').value      = data.tipo || 'libre';
    document.getElementById('notas-inp-prioridad').value = data.prioridad || 'media';
    document.getElementById('notas-inp-desc').value      = data.descripcion || '';
    document.getElementById('notas-inp-monto').value     = data.monto_referencia || '';
    document.getElementById('notas-inp-vence').value     = data.fecha_vencimiento || '';
    document.getElementById('notas-inp-persona').value   = data.persona_referencia || '';
    document.getElementById('nexum-notas-form-wrap').style.display = 'flex';
  }

  function cerrarForm() {
    document.getElementById('nexum-notas-form-wrap').style.display = 'none';
    _editandoId = null;
  }

  function _limpiarForm() {
    ['titulo','tipo','prioridad','desc','monto','vence','persona'].forEach(k => {
      const el = document.getElementById('notas-inp-' + k);
      if (el) el.value = k === 'tipo' ? 'libre' : k === 'prioridad' ? 'media' : '';
    });
    const alerta = document.getElementById('notas-form-alerta');
    if (alerta) alerta.style.display = 'none';
  }

  async function guardar() {
    const titulo    = (document.getElementById('notas-inp-titulo')?.value || '').trim();
    const tipo      = document.getElementById('notas-inp-tipo')?.value || 'libre';
    const prioridad = document.getElementById('notas-inp-prioridad')?.value || 'media';
    const desc      = (document.getElementById('notas-inp-desc')?.value || '').trim();
    const monto     = parseFloat(document.getElementById('notas-inp-monto')?.value) || null;
    const vence     = document.getElementById('notas-inp-vence')?.value || null;
    const persona   = (document.getElementById('notas-inp-persona')?.value || '').trim() || null;

    const alerta = document.getElementById('notas-form-alerta');
    if (!titulo) {
      alerta.textContent = 'El título es requerido.';
      alerta.style.display = 'block';
      return;
    }
    alerta.style.display = 'none';

    const payload = {
      empresa_id:         _notasEmpresaId,
      usuario_id:         _notasUsuarioId,
      titulo,
      tipo,
      prioridad,
      descripcion:        desc || null,
      monto_referencia:   monto,
      fecha_vencimiento:  vence || null,
      persona_referencia: persona,
    };

    let error;
    if (_editandoId) {
      ({ error } = await _supabase.from('notas_operativas').update(payload).eq('id', _editandoId));
    } else {
      ({ error } = await _supabase.from('notas_operativas').insert(payload));
    }

    if (error) {
      alerta.textContent = 'Error al guardar: ' + error.message;
      alerta.style.display = 'block';
      return;
    }

    cerrarForm();
    _cargarNotas();
    if (typeof mostrarToast === 'function') mostrarToast('Nota guardada.', 'exito');
  }

  async function resolver(id) {
    const { error } = await _supabase.from('notas_operativas')
      .update({ estado: 'resuelta', resuelta_por: _notasUsuarioId, resuelta_en: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      if (typeof mostrarToast === 'function') mostrarToast('Nota marcada como resuelta.', 'exito');
      _cargarNotas();
    }
  }

  async function eliminar(id) {
    const ok = typeof confirmar === 'function'
      ? await confirmar('¿Eliminar esta nota?', { btnOk: 'Eliminar', btnColor: '#C53030' })
      : window.confirm('¿Eliminar esta nota?');
    if (!ok) return;
    await _supabase.from('notas_operativas').delete().eq('id', id);
    _cargarNotas();
  }

  // ── Drag & Drop del botón flotante ──────────────────────────────
  function _initDrag() {
    const fab = document.getElementById('nexum-notas-fab');
    if (!fab) return;

    // Restaurar posición guardada (solo si top >= 60px para no quedar debajo del header)
    try {
      const saved = JSON.parse(localStorage.getItem('nexum_notas_pos') || 'null');
      if (saved && saved.top && parseInt(saved.top) >= 60) {
        fab.style.left   = saved.left   || 'auto';
        fab.style.top    = saved.top    || 'auto';
        fab.style.right  = saved.right  || '16px';
        fab.style.bottom = 'auto';
      }
    } catch(e) {}

    let dragging = false, moved = false;
    let startX, startY, startLeft, startTop;

    fab.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      const rect = fab.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      fab.style.cursor = 'grabbing';
      fab.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      const newLeft = Math.max(4, Math.min(window.innerWidth  - fab.offsetWidth  - 4, startLeft + dx));
      const newTop  = Math.max(4, Math.min(window.innerHeight - fab.offsetHeight - 4, startTop  + dy));
      fab.style.left   = newLeft + 'px';
      fab.style.top    = newTop  + 'px';
      fab.style.right  = 'auto';
      fab.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      fab.style.cursor = 'grab';
      fab.style.transition = 'box-shadow .15s';
      if (moved) {
        try {
          localStorage.setItem('nexum_notas_pos', JSON.stringify({
            left: fab.style.left, top: fab.style.top, right: 'auto', bottom: 'auto'
          }));
        } catch(e) {}
      }
    });

    // Click: solo abrir/cerrar si NO hubo arrastre
    fab.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      window.NEXUM_NOTAS.toggle();
    });
  }

  // ── Inicializar con contexto de empresa/usuario ─────────────────
  function init(empresaId, usuarioId) {
    _notasEmpresaId = empresaId;
    _notasUsuarioId = usuarioId;
    _inyectarDOM();
    _initDrag();       // activar drag & drop
    // Cargar badge sin abrir panel
    _cargarBadge();
  }

  async function _cargarBadge() {
    if (!_notasEmpresaId) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const { data } = await _supabase
      .from('notas_operativas')
      .select('id, fecha_vencimiento, prioridad')
      .eq('empresa_id', _notasEmpresaId)
      .in('estado', ['pendiente', 'en_proceso']);

    const urgentes = (data || []).filter(n => {
      if (!n.fecha_vencimiento) return n.prioridad === 'alta';
      return n.fecha_vencimiento <= hoy;
    }).length;

    const badge = document.getElementById('nexum-notas-badge');
    if (badge) {
      if (urgentes > 0) {
        badge.style.display = 'flex';
        badge.textContent   = urgentes > 9 ? '9+' : urgentes;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // ── API pública ────────────────────────────────────────────────
  window.NEXUM_NOTAS = {
    init,
    toggle,
    setFiltro,
    abrirNueva,
    editar,
    cerrarForm,
    guardar,
    resolver,
    eliminar,
    recargar: _cargarNotas,
  };

  // ── Cargar widget de dashboard (llamado desde dashboard.html) ──
  window.NEXUM_NOTAS.cargarWidgetDashboard = async function (contenedorId, empresaId) {
    const el = document.getElementById(contenedorId);
    if (!el || !empresaId) return;

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hoyStr = hoy.toISOString().slice(0, 10);

    const { data: notas } = await _supabase
      .from('notas_operativas')
      .select('*')
      .eq('empresa_id', empresaId)
      .in('estado', ['pendiente', 'en_proceso'])
      .order('prioridad', { ascending: true })
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
      .limit(10);

    const lista = notas || [];
    const urgentes = lista.filter(n => n.fecha_vencimiento && n.fecha_vencimiento <= hoyStr);
    const proximas = lista.filter(n => {
      if (!n.fecha_vencimiento) return false;
      const d = Math.ceil((new Date(n.fecha_vencimiento + 'T00:00:00') - hoy) / 86400000);
      return d > 0 && d <= 7;
    });
    const sinVencer = lista.filter(n => !n.fecha_vencimiento || n.fecha_vencimiento > new Date(hoy.getTime() + 7*86400000).toISOString().slice(0,10));

    if (!lista.length) {
      el.innerHTML = `<div style="text-align:center;color:var(--color-exito);padding:16px;font-size:13px">✅ Sin tareas pendientes</div>`;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <span style="padding:4px 12px;border-radius:20px;background:rgba(197,48,48,.2);color:#FC8181;font-size:12px;font-weight:600">🔴 ${urgentes.length} urgentes</span>
        <span style="padding:4px 12px;border-radius:20px;background:rgba(214,158,46,.2);color:#F6AD55;font-size:12px;font-weight:600">🟡 ${proximas.length} próximas</span>
        <span style="padding:4px 12px;border-radius:20px;background:rgba(74,85,104,.2);color:var(--color-texto-suave);font-size:12px;font-weight:600">⚪ ${sinVencer.length} sin vencer</span>
      </div>
      ${lista.slice(0, 4).map(n => {
        const vence  = n.fecha_vencimiento ? new Date(n.fecha_vencimiento + 'T00:00:00') : null;
        const dias   = vence ? Math.ceil((vence - hoy) / 86400000) : null;
        const color  = dias !== null && dias <= 0 ? '#FC8181' : dias !== null && dias <= 3 ? '#F6AD55' : 'var(--color-texto-suave)';
        const label  = dias === null ? '' : dias <= 0 ? ' 🔴 VENCIDO' : dias === 0 ? ' 🔴 HOY' : ` · En ${dias}d`;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--color-borde)">
          <span style="font-size:13px">${TIPOS[n.tipo]?.split(' ')[0] || '📝'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-texto)">${escaparHTML(n.titulo)}</div>
            ${n.monto_referencia ? `<div style="font-size:11px;color:${color}">S/ ${Number(n.monto_referencia).toFixed(2)}${label}</div>` : `<div style="font-size:11px;color:${color}">${label||'Sin vencimiento'}</div>`}
          </div>
        </div>`;
      }).join('')}
      <div style="margin-top:10px;text-align:right">
        <button onclick="window.NEXUM_NOTAS.toggle()" style="padding:5px 12px;background:var(--color-bg-card);color:var(--color-texto-suave);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">Ver todas las notas →</button>
      </div>`;
  };

})();
