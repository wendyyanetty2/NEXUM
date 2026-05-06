/* ============================================================
   NEXUM — Contabilidad: RH Recibidas
   Incluye: estados calculados (APLICADO/PARCIAL/POSIBLE/PENDIENTE)
            matching automático RH ↔ Movimientos
   ============================================================ */

function renderTabRHRecibidas(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="rhr-mes" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            ${Array.from({length:12},(_,i)=>{
              const m = String(i+1).padStart(2,'0');
              const nom = new Date(2000,i,1).toLocaleString('es-PE',{month:'long'});
              return `<option value="${m}" ${m===mesActual?'selected':''}>${nom.charAt(0).toUpperCase()+nom.slice(1)}</option>`;
            }).join('')}
          </select>
          <select id="rhr-anio" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            ${[anioActual-1, anioActual, anioActual+1].map(a=>`<option value="${a}" ${a===anioActual?'selected':''}>${a}</option>`).join('')}
          </select>
          <select id="rhr-estado" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            <option value="">Todos los estados</option>
            <option value="APLICADO">Aplicado</option>
            <option value="PARCIAL">Parcial</option>
            <option value="POSIBLE">Posible match</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <button onclick="cargarRHRecibidas()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="rhConciliarAutomatico()" id="btn-rhr-auto" style="padding:8px 14px;background:#2C5282;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">⚡ Conciliar automáticamente</button>
          <button onclick="rhVerHistorialConciliacion()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📋 Historial conciliación</button>
          <button onclick="exportarExcelRHRecibidas()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📥 Exportar Excel</button>
          <button onclick="document.getElementById('rhr-file-input').click()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📂 Importar Excel</button>
          <input type="file" id="rhr-file-input" accept=".xlsx,.xls" style="display:none" onchange="procesarImportRHR(this)">
          <button onclick="abrirModalRHR()" style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">+ Nuevo RH</button>
        </div>
      </div>

      <!-- Leyenda de estados -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:11px">
        <span style="padding:2px 8px;border-radius:10px;background:#2F855A;color:#fff">✅ APLICADO</span>
        <span style="padding:2px 8px;border-radius:10px;background:#DD6B20;color:#fff">🔶 PARCIAL</span>
        <span style="padding:2px 8px;border-radius:10px;background:#D69E2E;color:#fff">⚠️ POSIBLE</span>
        <span style="padding:2px 8px;border-radius:10px;background:#C53030;color:#fff">🔴 PENDIENTE</span>
        <span style="color:var(--color-texto-suave);font-style:italic">— Ventana de búsqueda: ±9 meses</span>
      </div>

      <div id="rhr-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="rhr-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>
    </div>
  `;

  cargarRHRecibidas();
}

// ── Estado calculado desde rh_movimiento_links ────────────────────
async function _estadoCalculado(rh) {
  const { data: links } = await _supabase
    .from('rh_movimiento_links')
    .select('id, nivel_confianza, es_parcial, monto_parcial, confirmado_en, movimiento_id, movimientos(fecha, importe, descripcion, numero_operacion)')
    .eq('rh_id', rh.id);

  if (!links?.length) {
    return { estado: 'PENDIENTE', color: '#C53030', etiqueta: '🔴 PENDIENTE', links: [] };
  }

  const confirmados = links.filter(l => l.confirmado_en);
  const posibles    = links.filter(l => !l.confirmado_en);

  if (!confirmados.length && posibles.length) {
    return { estado: 'POSIBLE', color: '#D69E2E', etiqueta: '⚠️ POSIBLE', links, posibles };
  }

  const montoPagado = confirmados.reduce((s, l) => {
    return s + parseFloat(l.monto_parcial ?? l.movimientos?.importe ?? 0);
  }, 0);
  const montoRH = parseFloat(rh.monto_bruto || 0);

  if (Math.abs(montoPagado - montoRH) < 0.01) {
    return { estado: 'APLICADO', color: '#2F855A', etiqueta: '✅ APLICADO', links, confirmados };
  }
  if (montoPagado > 0 && montoPagado < montoRH) {
    return { estado: 'PARCIAL', color: '#DD6B20', etiqueta: `🔶 PARCIAL (${formatearMoneda(montoPagado)})`, links, confirmados, montoPagado };
  }
  return { estado: 'PENDIENTE', color: '#C53030', etiqueta: '🔴 PENDIENTE', links: [] };
}

async function cargarRHRecibidas() {
  const mes    = document.getElementById('rhr-mes')?.value;
  const anio   = document.getElementById('rhr-anio')?.value;
  const filtroEstado = document.getElementById('rhr-estado')?.value;
  const wrap   = document.getElementById('rhr-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>';

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const { data, error } = await _supabase.from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision', { ascending: false });

  if (error) { wrap.innerHTML = `<p class="error-texto">Error: ${escapar(error.message)}</p>`; return; }

  // Calcular estados para todos los RH en paralelo
  const filas = data || [];
  const estadosMap = {};
  await Promise.all(filas.map(async r => {
    if (r.estado === 'ANULADO') {
      estadosMap[r.id] = { estado: 'CANCELADO', color: '#4A5568', etiqueta: 'CANCELADO', links: [] };
    } else {
      estadosMap[r.id] = await _estadoCalculado(r);
    }
  }));

  // Filtrar por estado si aplica
  const filasFiltradas = filtroEstado
    ? filas.filter(r => estadosMap[r.id]?.estado === filtroEstado)
    : filas;

  const totalBruto  = filasFiltradas.reduce((s,r) => s + Number(r.monto_bruto||0), 0);
  const totalRet    = filasFiltradas.reduce((s,r) => s + Number(r.monto_retencion||0), 0);
  const totalNeto   = filasFiltradas.reduce((s,r) => s + Number(r.monto_neto||0), 0);
  const pendientes  = filasFiltradas.filter(r => estadosMap[r.id]?.estado === 'PENDIENTE').length;
  const posibles    = filasFiltradas.filter(r => estadosMap[r.id]?.estado === 'POSIBLE').length;

  const resumen = document.getElementById('rhr-resumen');
  if (resumen) resumen.innerHTML = `
    <div style="background:var(--color-secundario);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RENTA BRUTA</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalBruto)}</div>
    </div>
    <div style="background:var(--color-critico);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RETENCIÓN</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalRet)}</div>
    </div>
    <div style="background:var(--color-exito);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RENTA NETA A PAGAR</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalNeto)}</div>
    </div>
    <div style="background:${pendientes>0?'var(--color-atencion)':'#4A5568'};color:#fff;padding:12px 16px;border-radius:8px;min-width:120px">
      <div style="font-size:11px;opacity:.8">PENDIENTES</div>
      <div style="font-size:18px;font-weight:700">${pendientes}</div>
    </div>
    ${posibles>0?`<div style="background:#D69E2E;color:#fff;padding:12px 16px;border-radius:8px;min-width:120px">
      <div style="font-size:11px;opacity:.8">POSIBLES MATCH</div>
      <div style="font-size:18px;font-weight:700">${posibles}</div>
    </div>`:''}
  `;

  if (!filasFiltradas.length) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin RH en este período.</p>';
    return;
  }

  wrap.innerHTML = `
    <table class="tabla-nexum">
      <thead><tr>
        <th>Fecha</th><th>N° RH</th><th>N° Doc</th>
        <th>Emisor</th><th>Concepto</th><th>Mon.</th>
        <th style="text-align:right">Renta Bruta</th>
        <th style="text-align:right">Retención</th>
        <th style="text-align:right">Renta Neta</th>
        <th>Estado</th><th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${filasFiltradas.map(r => {
          const estInfo = estadosMap[r.id];
          const mon     = r.moneda === 'USD' ? 'USD' : 'PEN';
          const nombre  = r.prestadores_servicios?.nombre || r.nombre_emisor || '—';
          const docNum  = r.prestadores_servicios?.dni    || r.nro_doc_emisor || '—';
          const tienePosible = estInfo?.posibles?.length > 0;
          const tieneLinks   = estInfo?.links?.length > 0;
          return `
          <tr>
            <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
            <td style="font-weight:600">${escapar(r.numero_rh||'—')}</td>
            <td>${escapar(docNum)}</td>
            <td>${escapar(truncar(nombre,25))}</td>
            <td>${escapar(truncar(r.concepto||'—',28))}</td>
            <td>${escapar(r.moneda||'PEN')}</td>
            <td style="text-align:right">${formatearMoneda(r.monto_bruto, mon)}</td>
            <td style="text-align:right;color:var(--color-critico)">${formatearMoneda(r.monto_retencion, mon)}</td>
            <td style="text-align:right;font-weight:600;color:var(--color-exito)">${formatearMoneda(r.monto_neto, mon)}</td>
            <td>
              <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${estInfo.color};color:#fff;white-space:nowrap">${estInfo.etiqueta}</span>
            </td>
            <td style="text-align:center;white-space:nowrap">
              ${tienePosible ? `<button onclick="rhConfirmarPosible('${r.id}')" title="Confirmar match posible" style="padding:4px 8px;background:rgba(214,158,46,.2);color:#D69E2E;border:1px solid #D69E2E;border-radius:4px;cursor:pointer;font-size:12px;margin-right:2px">✓</button>` : ''}
              ${tieneLinks ? `<button onclick="rhVerLinks('${r.id}','${escapar(nombre)}')" title="Ver movimientos vinculados" style="padding:4px 8px;background:rgba(44,82,130,.1);color:#3182CE;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-right:2px">🔗</button>` : ''}
              <button onclick="rhVincularManual('${r.id}','${escapar(nombre)}')" title="Vincular manualmente" style="padding:4px 8px;background:rgba(44,82,130,.05);color:var(--color-texto-suave);border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-right:2px">🔍</button>
              <button onclick="abrirModalRHR('${r.id}')" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">✏️</button>
              <button onclick="eliminarRHR('${r.id}')" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">🗑️</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ── Conciliación automática — muestra PREVIEW antes de guardar ────
async function rhConciliarAutomatico() {
  const mes  = document.getElementById('rhr-mes')?.value;
  const anio = document.getElementById('rhr-anio')?.value;
  const btn  = document.getElementById('btn-rhr-auto');
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = '⏳ Calculando…';

  let resultado;
  try {
    resultado = await _rhCalcularMatchesSinGuardar(
      empresa_activa.id, Number(mes), Number(anio)
    );
  } catch (e) {
    mostrarToast('Error al calcular matches: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = '⚡ Conciliar automáticamente';
    return;
  }

  btn.disabled = false;
  btn.textContent = '⚡ Conciliar automáticamente';

  if (!resultado.total) {
    mostrarToast('No hay RH en este periodo', 'atencion');
    return;
  }

  // ── Construir modal de preview ─────────────────────────────────
  const { lista } = resultado;
  const autoItems    = lista.filter(i => i.tipo === 'auto');
  const posibItems   = lista.filter(i => i.tipo === 'posible');
  const comboItems   = lista.filter(i => i.tipo === 'combo');
  const yaConc       = lista.filter(i => i.tipo === 'ya_conciliado');
  const sinMatch     = lista.filter(i => i.tipo === 'sin_match');

  const confianzaLabel = c =>
    c === 'alto'    ? '<span style="background:#166534;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">ALTA</span>'
    : c === 'medio' ? '<span style="background:#854d0e;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">MEDIA</span>'
    :                 '<span style="background:#2C5282;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">POSIBLE</span>';

  const _itemHtml = (item, idx, preChecked) => {
    const rh  = item.rh;
    const mov = item.mejorMatch?.movimiento;
    const key = `rhr-chk-${idx}`;
    return `
      <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:8px;background:var(--color-bg-card)">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
          <input type="checkbox" id="${key}" data-idx="${idx}"
            style="margin-top:3px;width:16px;height:16px;flex-shrink:0;cursor:pointer"
            ${preChecked ? 'checked' : ''}>
          <div style="flex:1;min-width:0">
            <!-- RH info -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:6px">
              <div>
                <span style="font-weight:700;font-size:13px;color:var(--color-texto)">${escapar(rh.prestadores_servicios?.nombre || rh.nombre_emisor || '—')}</span>
                ${rh.nro_doc_emisor ? `<span style="font-size:11px;color:var(--color-texto-suave);margin-left:6px">DNI: ${escapar(rh.nro_doc_emisor)}</span>` : ''}
              </div>
              <div style="font-size:13px;font-weight:700;color:var(--color-exito);white-space:nowrap">${formatearMoneda(rh.monto_bruto)}</div>
            </div>
            <!-- Movimiento sugerido -->
            ${mov ? `<div style="padding:8px 10px;background:rgba(44,82,130,.06);border:1px solid rgba(44,82,130,.2);border-radius:6px;font-size:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <div>
                  <div style="color:var(--color-secundario);font-weight:600">${formatearFecha(mov.fecha)} — N° Op: <span style="font-family:monospace;font-size:11px">${escapar(mov.numero_operacion||'—')}</span></div>
                  <div style="color:var(--color-texto-suave);font-size:11px;margin-top:1px">${escapar((mov.descripcion||'').slice(0,60))}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-weight:700;color:var(--color-exito)">${formatearMoneda(mov.importe)}</div>
                  <div style="margin-top:3px">${confianzaLabel(item.mejorMatch.confianza)}</div>
                </div>
              </div>
            </div>` : (item.tipo === 'combo'
              ? `<div style="padding:8px 10px;background:rgba(113,71,224,.06);border:1px solid rgba(113,71,224,.2);border-radius:6px;font-size:12px;color:var(--color-texto-suave)">
                  🔗 Pago en ${item.combo.cuotas} cuotas: ${item.combo.movimientos.map(m=>`${formatearFecha(m.fecha)} ${formatearMoneda(m.importe)}`).join(' + ')}
                </div>`
              : '')}
          </div>
        </label>
      </div>`;
  };

  const itemsHtml = [
    ...autoItems.map((it, i) => _itemHtml(it, lista.indexOf(it), true)),
    ...posibItems.map((it, i)  => _itemHtml(it, lista.indexOf(it), false)),
    ...comboItems.map((it, i)  => _itemHtml(it, lista.indexOf(it), false)),
  ].join('');

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:700px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h3>⚡ Preview de Conciliación RH — ${String(mes).padStart(2,'0')}/${anio}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">

          <!-- Resumen stats -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:16px">
            <div style="padding:10px;background:#166534;border-radius:8px;color:#fff;text-align:center">
              <div style="font-size:20px;font-weight:700">${autoItems.length}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px">✅ Auto-match</div>
            </div>
            <div style="padding:10px;background:#854d0e;border-radius:8px;color:#fff;text-align:center">
              <div style="font-size:20px;font-weight:700">${posibItems.length}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px">⚠️ Posibles</div>
            </div>
            <div style="padding:10px;background:#2C5282;border-radius:8px;color:#fff;text-align:center">
              <div style="font-size:20px;font-weight:700">${comboItems.length}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px">🔗 Combos</div>
            </div>
            <div style="padding:10px;background:#718096;border-radius:8px;color:#fff;text-align:center">
              <div style="font-size:20px;font-weight:700">${yaConc.length}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px">✔ Ya concil.</div>
            </div>
            <div style="padding:10px;background:#C53030;border-radius:8px;color:#fff;text-align:center">
              <div style="font-size:20px;font-weight:700">${sinMatch.length}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px">❌ Sin match</div>
            </div>
          </div>

          ${(autoItems.length || posibItems.length || comboItems.length) ? `
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:10px">
            ✅ <strong>Auto-match</strong> = DNI/nombre exacto — pre-seleccionados.
            ⚠️ <strong>Posibles</strong> = solo monto — revisa antes de confirmar.
            Marca los que deseas aplicar y haz clic en "Aplicar seleccionados".
          </p>
          <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <button onclick="document.querySelectorAll('[id^=rhr-chk-]').forEach(c=>c.checked=true)"
              style="padding:5px 12px;border:1px solid var(--color-borde);border-radius:6px;background:none;cursor:pointer;font-size:12px;font-family:var(--font);color:var(--color-texto)">
              ☑ Marcar todos</button>
            <button onclick="document.querySelectorAll('[id^=rhr-chk-]').forEach(c=>c.checked=false)"
              style="padding:5px 12px;border:1px solid var(--color-borde);border-radius:6px;background:none;cursor:pointer;font-size:12px;font-family:var(--font);color:var(--color-texto)">
              ☐ Desmarcar todos</button>
          </div>
          ${itemsHtml}
          ` : `<div style="padding:24px;text-align:center;color:var(--color-texto-suave)">
            ${yaConc.length ? `${yaConc.length} RH ya están conciliados. ` : ''}
            ${sinMatch.length ? `${sinMatch.length} sin match posible.` : 'No hay nuevos matches para este periodo.'}
          </div>`}
        </div>
        <div class="modal-footer" style="flex-shrink:0;gap:8px">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          ${(autoItems.length || posibItems.length || comboItems.length) ? `
          <button class="btn btn-primario" id="rhr-btn-aplicar"
            onclick="_rhAplicarSeleccionados(${JSON.stringify(lista.map(i=>({
              tipo: i.tipo,
              rhId: i.rh.id,
              movId: i.mejorMatch?.movimiento?.id || null,
              confianza: i.mejorMatch?.confianza || null,
              nivel: i.mejorMatch?.nivel || null,
              comboMovIds: i.combo?.movimientos?.map(m=>m.id) || [],
            })))})">
            ✅ Aplicar seleccionados
          </button>` : ''}
        </div>
      </div>
    </div>`;
}

// ── Aplica solo los items seleccionados en el modal de preview ────
async function _rhAplicarSeleccionados(listaPlana) {
  const btn = document.getElementById('rhr-btn-aplicar');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  const checks = document.querySelectorAll('[id^=rhr-chk-]');
  let ok = 0, errores = 0;
  const hoy = new Date().toISOString();
  const usuarioId = perfil_usuario?.id || null;

  for (const chk of checks) {
    if (!chk.checked) continue;
    const idx  = parseInt(chk.dataset.idx, 10);
    const item = listaPlana[idx];
    if (!item) continue;

    if (item.tipo === 'auto' || item.tipo === 'posible') {
      if (!item.movId) continue;
      const autoConf = item.nivel <= 2;
      const { error } = await _supabase.from('rh_movimiento_links').upsert({
        empresa_id:      empresa_activa.id,
        rh_id:           item.rhId,
        movimiento_id:   item.movId,
        nivel_confianza: item.confianza || 'medio',
        es_parcial:      false,
        monto_parcial:   null,
        confirmado_por:  usuarioId,
        confirmado_en:   hoy,
      }, { onConflict: 'rh_id,movimiento_id', ignoreDuplicates: true });
      if (!error) {
        // Actualizar tesoreria_mbd via confirmarLinkRH
        await confirmarLinkRH(item.rhId, item.movId, usuarioId);
        ok++;
      } else {
        errores++;
      }
    } else if (item.tipo === 'combo') {
      let comboOk = true;
      for (const movId of item.comboMovIds) {
        const { error } = await _supabase.from('rh_movimiento_links').upsert({
          empresa_id:      empresa_activa.id,
          rh_id:           item.rhId,
          movimiento_id:   movId,
          nivel_confianza: 'posible',
          es_parcial:      true,
          monto_parcial:   null,
          confirmado_por:  usuarioId,
          confirmado_en:   hoy,
        }, { onConflict: 'rh_id,movimiento_id', ignoreDuplicates: true });
        if (!error) await confirmarLinkRH(item.rhId, movId, usuarioId);
        else comboOk = false;
      }
      if (comboOk) ok++;
      else errores++;
    }
  }

  // Cerrar modal
  document.querySelector('.modal-overlay')?.remove();
  mostrarToast(
    `✅ ${ok} conciliacion${ok !== 1 ? 'es' : ''} aplicada${ok !== 1 ? 's' : ''}${errores ? ` · ${errores} con error` : ''}`,
    ok > 0 ? 'exito' : 'error',
    5000
  );
  cargarRHRecibidas();
}

// ── Ver links de un RH ────────────────────────────────────────────
async function rhVerLinks(rhId, nombre) {
  const { data: links } = await _supabase
    .from('rh_movimiento_links')
    .select('*, movimientos(fecha, importe, descripcion, numero_operacion, naturaleza)')
    .eq('rh_id', rhId);

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:640px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>🔗 Movimientos vinculados — ${escapar(nombre)}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          ${!links?.length ? '<p style="color:var(--color-texto-suave)">Sin movimientos vinculados.</p>' : `
          <table class="tabla-nexum" style="font-size:13px">
            <thead><tr>
              <th>Fecha mov.</th><th>N° Op.</th><th>Descripción</th>
              <th style="text-align:right">Monto</th><th>Confianza</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              ${(links||[]).map(l => {
                const mov = l.movimientos;
                const conf = l.nivel_confianza === 'alto' ? '🟢 Alta' : l.nivel_confianza === 'medio' ? '🟡 Media' : '🔸 Posible';
                const confirmado = l.confirmado_en ? '✅ Confirmado' : '⚠️ Sin confirmar';
                return `<tr>
                  <td>${formatearFecha(mov?.fecha)}</td>
                  <td style="font-size:11px">${escapar(mov?.numero_operacion||'—')}</td>
                  <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis">${escapar(truncar(mov?.descripcion||'—',35))}</td>
                  <td style="text-align:right;font-weight:600">${formatearMoneda(l.monto_parcial ?? mov?.importe)}</td>
                  <td style="font-size:11px">${conf}</td>
                  <td style="font-size:11px">${confirmado}</td>
                  <td>
                    ${!l.confirmado_en ? `<button onclick="rhConfirmarLink('${rhId}','${l.movimiento_id}')" style="padding:3px 8px;background:#2F855A;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">✓ Confirmar</button>` : ''}
                    <button onclick="rhEliminarLink('${rhId}','${l.movimiento_id}')" style="padding:3px 8px;background:rgba(197,48,48,.15);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px;margin-left:4px">✕</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}

// ── Confirmar posibles matches de un RH ──────────────────────────
async function rhConfirmarPosible(rhId) {
  const { data: links } = await _supabase
    .from('rh_movimiento_links')
    .select('*, movimientos(fecha, importe, descripcion)')
    .eq('rh_id', rhId)
    .is('confirmado_en', null);

  if (!links?.length) { mostrarToast('No hay matches posibles para confirmar.', 'atencion'); return; }

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:580px;width:95%">
        <div class="modal-header">
          <h3>⚠️ Confirmar match posible</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:12px;font-size:13px;color:var(--color-texto-suave)">Los siguientes movimientos coinciden por monto. Confirma si corresponden a este RH:</p>
          ${links.map(l => `
            <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600">${formatearFecha(l.movimientos?.fecha)} — ${formatearMoneda(l.monto_parcial ?? l.movimientos?.importe)}</div>
                <div style="font-size:12px;color:var(--color-texto-suave)">${escapar(truncar(l.movimientos?.descripcion||'—',50))}</div>
              </div>
              <button onclick="rhConfirmarLink('${rhId}','${l.movimiento_id}',true)" style="padding:6px 14px;background:#2F855A;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">✓ Sí, confirmar</button>
            </div>`).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}

async function rhConfirmarLink(rhId, movId, recargar = false) {
  const ok = await confirmarLinkRH(rhId, movId, perfil_usuario?.id);
  if (ok) {
    mostrarToast('Vinculación confirmada.', 'exito');
    if (recargar) { document.querySelector('.modal-overlay')?.remove(); cargarRHRecibidas(); }
    else cargarRHRecibidas();
  } else {
    mostrarToast('Error al confirmar vinculación.', 'error');
  }
}

async function rhEliminarLink(rhId, movId) {
  const ok = await confirmar('¿Eliminar esta vinculación?', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const eliminado = await eliminarLinkRH(rhId, movId);
  if (eliminado) {
    mostrarToast('Vinculación eliminada.', 'exito');
    document.querySelector('.modal-overlay')?.remove();
    cargarRHRecibidas();
  } else {
    mostrarToast('Error al eliminar vinculación.', 'error');
  }
}

// ── Búsqueda manual de movimientos para vincular ─────────────────
async function rhVincularManual(rhId, nombre) {
  const { data: rh } = await _supabase
    .from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('id', rhId).single();

  if (!rh) return;
  const mes  = document.getElementById('rhr-mes')?.value;
  const anio = document.getElementById('rhr-anio')?.value;

  const movs = await _cargarMovimientosVentana(empresa_activa.id, Number(mes), Number(anio));
  const matches = [];
  for (const mov of movs) {
    const n = _nivelMatch(rh, mov);
    if (n > 0) matches.push({ mov, nivel: n });
    else if (Math.abs(parseFloat(mov.importe) - parseFloat(rh.monto_bruto)) < 1.00) {
      matches.push({ mov, nivel: 99 });
    }
  }
  matches.sort((a,b) => a.nivel - b.nivel);
  const lista = matches.length ? matches : movs.slice(0,20).map(m => ({ mov: m, nivel: 99 }));

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:700px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>🔍 Vincular manualmente — ${escapar(nombre)}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:8px;font-size:12px;color:var(--color-texto-suave)">RH por conciliar: <strong>${formatearMoneda(rh.monto_bruto)}</strong> | Emisor: ${escapar(nombre)}</p>
          <div style="overflow-x:auto">
          <table class="tabla-nexum" style="font-size:12px">
            <thead><tr><th>Fecha</th><th>N° Op.</th><th>Descripción</th><th style="text-align:right">Monto</th><th>Match</th><th></th></tr></thead>
            <tbody>
              ${lista.map(({mov, nivel}) => {
                const matchLabel = nivel === 1 ? '🟢 DNI+Monto' : nivel === 2 ? '🟢 Nombre+Monto' : nivel === 3 ? '🟡 Monto+Keyword' : nivel === 4 ? '🟡 Monto' : '⚪ Manual';
                return `<tr>
                  <td>${formatearFecha(mov.fecha)}</td>
                  <td style="font-size:11px">${escapar(mov.numero_operacion||'—')}</td>
                  <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${escapar(truncar(mov.descripcion||'—',40))}</td>
                  <td style="text-align:right;font-weight:600">${formatearMoneda(mov.importe)}</td>
                  <td style="font-size:11px">${matchLabel}</td>
                  <td><button onclick="rhVincularConfirmar('${rhId}','${mov.id}','${nivel <= 2 ? 'alto' : nivel <= 4 ? 'medio' : 'posible'}')" style="padding:4px 10px;background:var(--color-secundario);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Vincular</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}

async function rhVincularConfirmar(rhId, movId, confianza) {
  const { error } = await _supabase.from('rh_movimiento_links').upsert({
    empresa_id:      empresa_activa.id,
    rh_id:           rhId,
    movimiento_id:   movId,
    nivel_confianza: confianza,
    confirmado_por:  perfil_usuario?.id,
    confirmado_en:   new Date().toISOString(),
  }, { onConflict: 'rh_id,movimiento_id' });

  if (error) { mostrarToast('Error al vincular: ' + error.message, 'error'); return; }
  mostrarToast('Movimiento vinculado correctamente.', 'exito');
  document.querySelector('.modal-overlay')?.remove();
  cargarRHRecibidas();
}

// ── Modal nuevo/editar RH ─────────────────────────────────────────
async function abrirModalRHR(id = null) {
  let item = null;
  if (id) {
    const { data } = await _supabase.from('rh_registros')
      .select('*, prestadores_servicios(nombre, dni)')
      .eq('id', id).single();
    item = data;
  }
  const hoy       = new Date().toISOString().slice(0,10);
  const monedaVal = item?.moneda === 'USD' ? 'USD' : 'PEN';
  const nroDoc    = item?.prestadores_servicios?.dni  || item?.nro_doc_emisor || '';
  const nombre    = item?.prestadores_servicios?.nombre || item?.nombre_emisor || '';

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalRHR()">
      <div class="modal" style="max-width:580px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>🧾 ${id?'Editar':'Nuevo'} RH Recibido</h3>
          <button class="modal-cerrar" onclick="cerrarModalRHR()">✕</button>
        </div>
        <div class="modal-body">
          <div id="rhr-alerta" class="alerta-error"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="campo"><label>Fecha Emisión <span class="req">*</span></label>
              <input type="date" id="rhr-fecha" value="${item?.fecha_emision||hoy}"></div>
            <div class="campo"><label>N° RH <span class="req">*</span></label>
              <input type="text" id="rhr-nro" value="${escapar(item?.numero_rh||'')}" placeholder="E001-68"></div>
            <div class="campo"><label>DNI / RUC Emisor <span class="req">*</span></label>
              <input type="text" id="rhr-nro-doc" value="${escapar(nroDoc)}" maxlength="11" placeholder="12345678"></div>
            <div class="campo"><label>Nombre Emisor <span class="req">*</span></label>
              <input type="text" id="rhr-nombre" value="${escapar(nombre)}"></div>
            <div class="campo" style="grid-column:span 2"><label>Concepto / Servicio <span class="req">*</span></label>
              <input type="text" id="rhr-desc" value="${escapar(item?.concepto||'')}"></div>
            <div class="campo"><label>Moneda</label>
              <select id="rhr-moneda">
                <option value="PEN" ${monedaVal==='PEN'?'selected':''}>Soles (PEN)</option>
                <option value="USD" ${monedaVal==='USD'?'selected':''}>Dólares (USD)</option>
              </select></div>
            <div class="campo"><label>Estado doc.</label>
              <select id="rhr-estado-doc">
                <option value="EMITIDO" ${(item?.estado||'EMITIDO')==='EMITIDO'?'selected':''}>Emitido</option>
                <option value="ANULADO" ${item?.estado==='ANULADO'?'selected':''}>Anulado</option>
              </select></div>
            <div class="campo"><label>Renta Bruta <span class="req">*</span></label>
              <input type="number" id="rhr-bruta" step="0.01" value="${item?.monto_bruto||''}" onchange="calcRHR()"></div>
            <div class="campo"><label>Retención</label>
              <input type="number" id="rhr-retencion" step="0.01" value="${item?.monto_retencion||0}" onchange="calcRHR()"></div>
            <div class="campo" style="grid-column:span 2">
              <label style="font-weight:700;color:var(--color-secundario)">Renta Neta</label>
              <input type="number" id="rhr-neta" step="0.01" value="${item?.monto_neto||''}">
              <small style="color:var(--color-texto-suave)">Bruta − Retención (editable)</small></div>
            <div class="campo" style="grid-column:span 2"><label>Observaciones</label>
              <input type="text" id="rhr-obs" value="${escapar(item?.observaciones||'')}"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalRHR()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarRHR('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function calcRHR() {
  const bruta = parseFloat(document.getElementById('rhr-bruta')?.value)||0;
  const ret   = parseFloat(document.getElementById('rhr-retencion')?.value)||0;
  const el    = document.getElementById('rhr-neta');
  if (el) el.value = (bruta - ret).toFixed(2);
}

function cerrarModalRHR() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarRHR(id) {
  const alerta = document.getElementById('rhr-alerta');
  alerta.classList.remove('visible');

  const fecha    = document.getElementById('rhr-fecha').value;
  const nroRH    = document.getElementById('rhr-nro').value.trim();
  let nroDoc     = document.getElementById('rhr-nro-doc').value.trim();
  const nombre   = document.getElementById('rhr-nombre').value.trim();
  const concepto = document.getElementById('rhr-desc').value.trim();
  const bruta    = parseFloat(document.getElementById('rhr-bruta').value);
  const neta     = parseFloat(document.getElementById('rhr-neta').value);

  if (!fecha||!nroRH||!nroDoc||!nombre||!concepto||isNaN(bruta)||isNaN(neta)) {
    alerta.textContent = 'Complete todos los campos requeridos (*)';
    alerta.classList.add('visible'); return;
  }

  if (nroDoc.length < 8) nroDoc = nroDoc.padStart(8, '0');
  else if (nroDoc.length > 8 && nroDoc.length < 11) nroDoc = nroDoc.padStart(11, '0');

  let { data: ps } = await _supabase
    .from('prestadores_servicios').select('id').eq('dni', nroDoc).maybeSingle();
  if (!ps) {
    const { data: nuevo, error: errPS } = await _supabase
      .from('prestadores_servicios')
      .insert({ dni: nroDoc, nombre, ruc: nroDoc.length === 11 ? nroDoc : null, activo: true })
      .select('id').single();
    if (errPS) { alerta.textContent = 'Error al registrar prestador: ' + errPS.message; alerta.classList.add('visible'); return; }
    ps = nuevo;
  }

  const ret    = parseFloat(document.getElementById('rhr-retencion').value) || 0;
  const moneda = document.getElementById('rhr-moneda').value;
  const estado = document.getElementById('rhr-estado-doc')?.value || 'EMITIDO';

  const payload = {
    empresa_operadora_id: empresa_activa.id,
    prestador_id:         ps.id,
    periodo:              fecha.slice(0, 7),
    fecha_emision:        fecha,
    numero_rh:            nroRH,
    concepto,
    moneda,
    monto_bruto:          bruta,
    tiene_retencion:      ret > 0,
    porcentaje_retencion: bruta > 0 ? Math.round(ret / bruta * 10000) / 100 : 0,
    monto_retencion:      ret,
    monto_neto:           neta,
    estado,
    observaciones:        document.getElementById('rhr-obs').value.trim() || null,
    nro_doc_emisor:       nroDoc,
    nombre_emisor:        nombre,
    usuario_id:           perfil_usuario?.id || null,
  };

  let error;
  if (id) ({ error } = await _supabase.from('rh_registros').update(payload).eq('id', id));
  else    ({ error } = await _supabase.from('rh_registros').insert(payload));

  if (error) { alerta.textContent = 'Error: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'RH actualizado.' : 'RH registrado.', 'exito');
  cerrarModalRHR();
  cargarRHRecibidas();
}

async function eliminarRHR(id) {
  const ok = await confirmar('¿Eliminar este RH? Esta acción no se puede deshacer.', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  // Eliminar links primero
  await _supabase.from('rh_movimiento_links').delete().eq('rh_id', id);
  const { error } = await _supabase.from('rh_registros').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar: ' + error.message, 'error'); return; }
  mostrarToast('Registro eliminado.', 'exito');
  cargarRHRecibidas();
}

// ── Importar Excel ────────────────────────────────────────────────
let _rhrDatosPreview = [];

function procesarImportRHR(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: false, raw: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      if (rows.length < 2) { mostrarToast('El archivo está vacío.', 'atencion'); return; }

      const toDate = v => {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number') {
          const d = new Date(Math.round((v - 25569) * 86400 * 1000));
          if (isNaN(d.getTime())) return null;
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        }
        if (v instanceof Date) return v.toISOString().slice(0,10);
        const s = v.toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/'); return `${y}-${m}-${d}`; }
        const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0,10);
      };
      const toNum = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

      _rhrDatosPreview = rows.slice(1).map((r, i) => {
        const fecha  = toDate(r[0]);
        const nroRH  = r[2]?.toString().trim() || null;
        const bruta  = toNum(r[12]);
        const ok     = !!fecha && !!nroRH && bruta > 0;
        const estadoDoc = (r[3] || '').toString().trim().toUpperCase();
        return {
          _fila: i + 2, _ok: ok,
          _error: !fecha ? 'Sin fecha' : !nroRH ? 'Sin N° RH' : bruta <= 0 ? 'Sin monto' : null,
          fecha_emision:   fecha,
          nro_rh:          nroRH,
          tipo_doc_emisor: r[4]?.toString().trim() || 'DNI',
          nro_doc_emisor:  r[5]?.toString().trim() || '',
          nombre_emisor:   r[6]?.toString().trim() || '',
          descripcion:     r[9]?.toString().trim() || '',
          observaciones:   r[10]?.toString().trim() || null,
          moneda:          r[11]?.toString().trim() || 'SOLES',
          renta_bruta:     bruta,
          retencion:       toNum(r[13]),
          renta_neta:      toNum(r[14]),
          estado_pago:     estadoDoc === 'ANULADO' ? 'CANCELADO' : 'PENDIENTE',
        };
      });

      const validos = _rhrDatosPreview.filter(r => r._ok).length;
      const errores = _rhrDatosPreview.length - validos;

      const mc = document.getElementById('modal-container');
      mc.innerHTML = `
        <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cerrarPrevRHR()">
          <div class="modal" style="max-width:820px;width:95%;max-height:90vh;overflow-y:auto">
            <div class="modal-header">
              <h3>👁️ Vista previa — ${_rhrDatosPreview.length} registros</h3>
              <button class="modal-cerrar" onclick="_cerrarPrevRHR()">✕</button>
            </div>
            <div class="modal-body">
              <p style="margin-bottom:12px;font-size:13px;color:var(--color-texto-suave)">
                ✅ <strong>${validos}</strong> válidos &nbsp; ⚠️ <strong>${errores}</strong> con error (se omitirán)
              </p>
              <div style="overflow-x:auto;max-height:320px;overflow-y:auto">
                <table class="tabla-nexum" style="font-size:12px">
                  <thead><tr>
                    <th>#</th><th>Fecha</th><th>N° RH</th><th>Emisor</th>
                    <th>Desc.</th><th>Mon.</th><th style="text-align:right">Bruta</th>
                    <th style="text-align:right">Ret.</th><th style="text-align:right">Neta</th><th>Estado</th>
                  </tr></thead>
                  <tbody>
                    ${_rhrDatosPreview.map(r => `
                      <tr ${!r._ok ? 'style="background:rgba(197,48,48,.05)"' : ''}>
                        <td style="font-size:11px;color:var(--color-texto-suave)">${r._fila}</td>
                        <td style="white-space:nowrap">${r.fecha_emision || `<span style="color:#C53030">${r._error}</span>`}</td>
                        <td style="font-weight:600">${escapar(r.nro_rh||'—')}</td>
                        <td style="font-size:11px">${escapar((r.nombre_emisor||'—').slice(0,20))}</td>
                        <td style="font-size:11px">${escapar((r.descripcion||'—').slice(0,20))}</td>
                        <td>${escapar(r.moneda||'—')}</td>
                        <td style="text-align:right">${formatearMoneda(r.renta_bruta)}</td>
                        <td style="text-align:right;color:var(--color-critico)">${formatearMoneda(r.retencion)}</td>
                        <td style="text-align:right;font-weight:600;color:var(--color-exito)">${formatearMoneda(r.renta_neta)}</td>
                        <td>${r._ok ? '<span style="font-size:10px;background:#2F855A;color:#fff;padding:2px 6px;border-radius:8px">OK</span>' : `<span style="font-size:10px;background:#C53030;color:#fff;padding:2px 6px;border-radius:8px">${escapar(r._error)}</span>`}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secundario" onclick="_cerrarPrevRHR()">Cancelar</button>
              <button class="btn btn-primario" onclick="_confirmarImportRHR()" id="btn-conf-rhr" ${!validos ? 'disabled' : ''}>✅ Importar ${validos} registro(s)</button>
            </div>
          </div>
        </div>`;
    } catch(err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function _cerrarPrevRHR() {
  _rhrDatosPreview = [];
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function _confirmarImportRHR() {
  const validos = _rhrDatosPreview.filter(r => r._ok);
  if (!validos.length) return;

  const btn = document.getElementById('btn-conf-rhr');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  let ok = 0, errCount = 0;

  for (const r of validos) {
    let dni = (r.nro_doc_emisor || '').toString().trim();
    if (dni) {
      if (dni.length < 8) dni = dni.padStart(8, '0');
      else if (dni.length > 8 && dni.length < 11) dni = dni.padStart(11, '0');
    }
    if (!dni) { errCount++; continue; }

    let { data: ps } = await _supabase
      .from('prestadores_servicios').select('id').eq('dni', dni).maybeSingle();
    if (!ps) {
      const { data: nuevo, error: errPS } = await _supabase
        .from('prestadores_servicios')
        .insert({ dni, nombre: r.nombre_emisor || dni, ruc: dni.length === 11 ? dni : null, activo: true })
        .select('id').single();
      if (errPS) { errCount++; continue; }
      ps = nuevo;
    }

    const monedaNorm = ['DOLARES','USD'].includes((r.moneda||'').toUpperCase()) ? 'USD' : 'PEN';
    const estadoDoc  = r.estado_pago === 'CANCELADO' ? 'ANULADO' : 'EMITIDO';
    const { error } = await _supabase.from('rh_registros').insert({
      empresa_operadora_id: empresa_activa.id,
      prestador_id:         ps.id,
      periodo:              r.fecha_emision?.slice(0, 7) || null,
      fecha_emision:        r.fecha_emision,
      numero_rh:            r.nro_rh,
      concepto:             r.descripcion || 'SERVICIO',
      moneda:               monedaNorm,
      monto_bruto:          parseFloat(r.renta_bruta) || 0,
      tiene_retencion:      parseFloat(r.retencion) > 0,
      porcentaje_retencion: parseFloat(r.renta_bruta) > 0 ? Math.round(parseFloat(r.retencion) / parseFloat(r.renta_bruta) * 10000) / 100 : 0,
      monto_retencion:      parseFloat(r.retencion) || 0,
      monto_neto:           parseFloat(r.renta_neta) || 0,
      estado:               estadoDoc,
      observaciones:        r.observaciones || null,
      nro_doc_emisor:       dni,
      nombre_emisor:        r.nombre_emisor || null,
      usuario_id:           perfil_usuario?.id || null,
    });
    if (error) errCount++; else ok++;
  }

  _cerrarPrevRHR();
  mostrarToast(`✓ ${ok} RH importado(s). ${errCount ? errCount + ' errores.' : ''}`, ok ? 'exito' : 'error');
  cargarRHRecibidas();
}

// ── Exportar Excel ────────────────────────────────────────────────
async function exportarExcelRHRecibidas() {
  const mes   = document.getElementById('rhr-mes')?.value;
  const anio  = document.getElementById('rhr-anio')?.value;
  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const { data } = await _supabase.from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision');

  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  // Calcular estados
  const estadosMap = {};
  await Promise.all(data.map(async r => {
    estadosMap[r.id] = r.estado === 'ANULADO' ? { estado: 'CANCELADO' } : await _estadoCalculado(r);
  }));

  const cab = ['Fecha Emisión','N° RH','N° Doc Emisor','Nombre Emisor','Concepto','Moneda','Renta Bruta','Retención','Renta Neta','Estado','Observaciones'];
  const filas = data.map(r => [
    r.fecha_emision, r.numero_rh,
    r.prestadores_servicios?.dni || r.nro_doc_emisor,
    r.prestadores_servicios?.nombre || r.nombre_emisor,
    r.concepto, r.moneda, r.monto_bruto, r.monto_retencion, r.monto_neto,
    estadosMap[r.id]?.estado || 'PENDIENTE',
    r.observaciones
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RH Recibidas');
  XLSX.writeFile(wb, `RH_Recibidas_${empresa_activa.nombre_corto}_${anio}${mes}.xlsx`);
  mostrarToast('Archivo exportado.', 'exito');
}

// ── Historial de conciliación RH — links confirmados ─────────────
async function rhVerHistorialConciliacion() {
  const mes  = document.getElementById('rhr-mes')?.value;
  const anio = document.getElementById('rhr-anio')?.value;
  if (!mes || !anio) { mostrarToast('Selecciona mes y año', 'atencion'); return; }

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:750px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h3>📋 Historial de Conciliación RH — ${String(mes).padStart(2,'0')}/${anio}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <div class="cargando"><div class="spinner"></div><span>Cargando historial…</span></div>
        </div>
        <div class="modal-footer" style="flex-shrink:0">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;

  // Cargar datos
  const desde = `${anio}-${String(mes).padStart(2,'0')}-01`;
  const hasta  = `${anio}-${String(mes).padStart(2,'0')}-${new Date(anio, mes, 0).getDate()}`;

  const [{ data: rhList }, { data: links }] = await Promise.all([
    _supabase.from('rh_registros')
      .select('id, numero_rh, fecha_emision, monto_bruto, monto_neto, nombre_emisor, nro_doc_emisor, prestadores_servicios(nombre,dni)')
      .eq('empresa_operadora_id', empresa_activa.id)
      .gte('fecha_emision', desde).lte('fecha_emision', hasta)
      .order('fecha_emision'),
    _supabase.from('rh_movimiento_links')
      .select('*, movimientos(id, fecha, importe, descripcion, numero_operacion)')
      .in('rh_id', (await _supabase.from('rh_registros').select('id')
        .eq('empresa_operadora_id', empresa_activa.id)
        .gte('fecha_emision', desde).lte('fecha_emision', hasta)
      ).data?.map(r => r.id) || [])
      .not('confirmado_en', 'is', null)
      .order('confirmado_en', { ascending: false }),
  ]);

  const linksByRH = {};
  (links || []).forEach(l => {
    if (!linksByRH[l.rh_id]) linksByRH[l.rh_id] = [];
    linksByRH[l.rh_id].push(l);
  });

  const rhConLinks = (rhList || []).filter(r => linksByRH[r.id]?.length);
  const body = document.querySelector('#modal-container .modal-body');
  if (!body) return;

  if (!rhConLinks.length) {
    body.innerHTML = `<div style="padding:32px;text-align:center;color:var(--color-texto-suave)">
      No hay conciliaciones confirmadas en este periodo.</div>`;
    return;
  }

  const _TD = 'padding:7px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;font-size:12px';

  body.innerHTML = `
    <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:12px">
      ${rhConLinks.length} RH con conciliaciones confirmadas. Puedes revertir individualmente.
    </p>
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
      <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;background:var(--color-bg-card)">
        <thead>
          <tr style="background:var(--color-primario);color:#fff">
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Fecha RH</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">N° RH</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Prestador</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap;text-align:right">Monto</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Movimiento vinculado</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Confianza</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Confirmado</th>
            <th style="padding:9px 10px;font-size:11px;white-space:nowrap">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${rhConLinks.flatMap(rh => (linksByRH[rh.id] || []).map(l => {
            const mov = l.movimientos;
            const confChip = l.nivel_confianza === 'alto'
              ? '<span style="background:#166534;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">ALTA</span>'
              : l.nivel_confianza === 'medio'
              ? '<span style="background:#854d0e;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">MEDIA</span>'
              : '<span style="background:#2C5282;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">POSIBLE</span>';
            return `<tr
              onmouseover="this.style.background='var(--color-hover)'"
              onmouseout="this.style.background=''">
              <td style="${_TD};white-space:nowrap">${formatearFecha(rh.fecha_emision)}</td>
              <td style="${_TD};font-weight:600;color:var(--color-secundario)">${escapar(rh.numero_rh||'—')}</td>
              <td style="${_TD};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${escapar((rh.prestadores_servicios?.nombre || rh.nombre_emisor || '—').slice(0,25))}</td>
              <td style="${_TD};text-align:right;font-weight:700;color:var(--color-exito)">${formatearMoneda(rh.monto_neto)}</td>
              <td style="${_TD};max-width:200px">
                ${mov ? `<div style="font-size:11px;font-family:monospace">${escapar(mov.numero_operacion||'—')}</div>
                  <div style="font-size:11px;color:var(--color-texto-suave)">${formatearFecha(mov.fecha)} · ${formatearMoneda(mov.importe)}</div>` : '—'}
              </td>
              <td style="${_TD};text-align:center">${confChip}</td>
              <td style="${_TD};font-size:11px;white-space:nowrap">${l.confirmado_en ? formatearFecha(l.confirmado_en.slice(0,10)) : '—'}</td>
              <td style="${_TD}">
                <button title="Revertir esta conciliación"
                  onclick="_rhRevertirLink('${rh.id}','${l.movimiento_id}')"
                  style="padding:4px 10px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid rgba(197,48,48,.3);border-radius:4px;cursor:pointer;font-size:11px;font-family:var(--font)">
                  ↩ Revertir
                </button>
              </td>
            </tr>`;
          })).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Revertir un link de conciliación RH ────────────────────────────
async function _rhRevertirLink(rhId, movId) {
  if (!await confirmar('¿Revertir esta conciliación? El link se eliminará y el movimiento bancario volverá a PENDIENTE.',
    { btnOk: 'Sí, revertir', btnColor: '#C53030' })) return;

  // Eliminar link
  await eliminarLinkRH(rhId, movId);

  // Revertir estado en tesoreria_mbd
  if (movId) {
    await _supabase.from('tesoreria_mbd')
      .update({ entrega_doc: 'PENDIENTE', nro_factura_doc: null, tipo_doc: null, estado_conciliacion: null })
      .eq('id', movId);
  }

  mostrarToast('↩ Conciliación revertida', 'exito');

  // Recargar el historial si el modal sigue abierto
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
  rhVerHistorialConciliacion();
  cargarRHRecibidas();
}
