// ═══════════════════════════════════════════════════════════════
// Tesorería — Movimientos (muestra datos de tesoreria_mbd)
// ═══════════════════════════════════════════════════════════════

let movimientos_lista    = [];
let movimientos_filtrada = [];
let movimientos_pag      = 1;
const MOV_POR_PAG        = 20;
let mov_seleccionados    = new Set();

async function renderTabMovimientos(area) {
  const hoy      = new Date();
  const mesAct   = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioAct  = hoy.getFullYear();

  area.innerHTML = `
    <div class="fadeIn">
      <!-- Resumen rápido -->
      <div class="grid-3" id="mov-resumen" style="margin-bottom:20px;gap:12px"></div>

      <!-- Filtros -->
      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:10px">
          <div>
            <label class="label-filtro">Mes</label>
            <select id="mov-mes" onchange="cargarMovimientos()" class="input-buscar w-full">
              ${Array.from({length:12},(_,i)=>{
                const m = String(i+1).padStart(2,'0');
                const nom = new Date(2000,i,1).toLocaleString('es-PE',{month:'long'});
                return `<option value="${m}" ${m===mesAct?'selected':''}>${nom.charAt(0).toUpperCase()+nom.slice(1)}</option>`;
              }).join('')}
            </select>
          </div>
          <div>
            <label class="label-filtro">Año</label>
            <select id="mov-anio" onchange="cargarMovimientos()" class="input-buscar w-full">
              ${[anioAct-1,anioAct,anioAct+1].map(a=>`<option value="${a}" ${a===anioAct?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label-filtro">Naturaleza</label>
            <select id="mov-naturaleza" onchange="filtrarMovimientos()" class="input-buscar w-full">
              <option value="">Cargo y Abono</option>
              <option value="CARGO">Cargo (−)</option>
              <option value="ABONO">Abono (+)</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Estado DOC</label>
            <select id="mov-estado-doc-f" onchange="filtrarMovimientos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="PENDIENTE">🔴 Pendiente</option>
              <option value="EMITIDO">🟢 Emitido</option>
              <option value="OBSERVADO">🟡 Observado</option>
              <option value="CANCELADO">⚫ Cancelado</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Buscar</label>
            <input type="text" id="mov-buscar" oninput="filtrarMovimientos()" class="input-buscar w-full"
                   placeholder="Descripción, N° op, proveedor…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="mov-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secundario btn-sm" onclick="limpiarFiltrosMov()">🔄 Limpiar</button>
            <button class="btn btn-secundario btn-sm" onclick="cargarMovimientos()">↺ Actualizar</button>
            <button class="btn btn-secundario btn-sm" onclick="exportarMovimientosExcel()">⬇ Excel</button>
            <button class="btn btn-sm" onclick="_abrirModalEliminarMesMov()"
              style="background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:var(--radio);padding:6px 12px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">
              🗑️ Eliminar mes
            </button>
            <button class="btn btn-primario btn-sm" onclick="abrirModalMovimiento(null)">+ Nuevo</button>
          </div>
        </div>
      </div>

      <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
        <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--color-bg-card)">
            <th style="width:32px;padding:8px;border-bottom:2px solid var(--color-borde);position:sticky;left:0;background:var(--color-bg-card);z-index:2">
              <input type="checkbox" id="chk-todos-mov" title="Seleccionar todos" onchange="seleccionarTodosMov(this.checked)">
            </th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:110px">N° de operación</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">Fecha</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:180px">Descripción</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:55px">Mon.</th>
            <th style="padding:8px 10px;text-align:right;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">Monto</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:200px">Proveedor / Empresa / Personal</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:120px">RUC / DNI</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:120px">COTIZACIÓN</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">OC</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:180px">Proyecto</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:130px">Concepto</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:160px">Empresa</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">Entrega FA/DOC</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:130px">Nº Factura o DOC</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:90px">Tipo DOC</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:120px">Autorización</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:180px">Observaciones</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:200px">Detalles Compra / Servicio</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:180px">Observaciones 2</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:90px">Acc.</th>
          </tr></thead>
          <tbody id="tbody-movimientos"></tbody>
        </table>
      </div>
      <div id="pag-movimientos" class="paginacion"></div>
    </div>
  `;

  await cargarMovimientos();
}

async function cargarMovimientos() {
  const mes  = document.getElementById('mov-mes')?.value;
  const anio = document.getElementById('mov-anio')?.value;
  if (!mes || !anio) return;

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const tbody = document.getElementById('tbody-movimientos');
  if (tbody) tbody.innerHTML = `<tr><td colspan="21" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;

  const { data, error } = await _supabase
    .from('tesoreria_mbd')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_deposito', desde)
    .lte('fecha_deposito', hasta)
    .order('fecha_deposito', { ascending: true })
    .order('nro_operacion_bancaria', { ascending: true });

  if (error) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="21" style="text-align:center;padding:20px;color:#C53030">Error: ${escapar(error.message)}</td></tr>`;
    return;
  }

  movimientos_lista = data || [];
  movimientos_pag   = 1;
  mov_seleccionados = new Set();
  filtrarMovimientos();
}

function filtrarMovimientos() {
  const nat   = document.getElementById('mov-naturaleza')?.value || '';
  const est   = document.getElementById('mov-estado-doc-f')?.value || '';
  const q     = (document.getElementById('mov-buscar')?.value || '').toLowerCase();

  movimientos_filtrada = movimientos_lista.filter(r => {
    if (nat === 'CARGO'  && Number(r.monto) >= 0) return false;
    if (nat === 'ABONO'  && Number(r.monto) < 0)  return false;
    if (est && r.entrega_doc !== est) return false;
    if (q) {
      const haystack = [r.nro_operacion_bancaria,r.descripcion,r.proveedor_empresa_personal,
        r.ruc_dni,r.concepto,r.empresa,r.proyecto,r.nro_factura_doc,r.autorizacion,r.observaciones]
        .map(v=>(v||'').toLowerCase()).join(' ');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const ctr = document.getElementById('mov-contador');
  if (ctr) ctr.textContent = `${movimientos_filtrada.length} de ${movimientos_lista.length} registros`;

  _renderResumenMov();
  renderTablaMovimientos();
}

function _renderResumenMov() {
  const div = document.getElementById('mov-resumen');
  if (!div) return;
  const filas = movimientos_filtrada;
  const totS   = filas.filter(r => r.moneda !== 'USD').reduce((s,r)=>s+Number(r.monto),0);
  const totD   = filas.filter(r => r.moneda === 'USD').reduce((s,r)=>s+Number(r.monto),0);
  const pend   = filas.filter(r => r.entrega_doc === 'PENDIENTE').length;
  div.innerHTML = `
    <div style="background:var(--color-exito);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">TOTAL SOLES</div>
      <div style="font-size:18px;font-weight:700">S/ ${_fmtMov(totS)}</div>
    </div>
    ${totD ? `<div style="background:#2B6CB0;color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">TOTAL USD</div>
      <div style="font-size:18px;font-weight:700">$ ${_fmtMov(totD)}</div>
    </div>` : ''}
    <div style="background:${pend>0?'var(--color-atencion)':'#4A5568'};color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">PENDIENTES DOC</div>
      <div style="font-size:18px;font-weight:700">${pend}</div>
    </div>
    <div style="background:#4A5568;color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">TOTAL MOVIMIENTOS</div>
      <div style="font-size:18px;font-weight:700">${filas.length}</div>
    </div>`;
}

function _fmtMov(n) {
  return Number(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function renderTablaMovimientos() {
  const inicio = (movimientos_pag - 1) * MOV_POR_PAG;
  const pagina = movimientos_filtrada.slice(inicio, inicio + MOV_POR_PAG);
  const tbody  = document.getElementById('tbody-movimientos');
  if (!tbody) return;

  const _TD = 'padding:6px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;';

  if (!pagina.length) {
    tbody.innerHTML = `<tr><td colspan="21" style="text-align:center;padding:30px;color:var(--color-texto-suave)">Sin movimientos para este período.</td></tr>`;
  } else {
    const badgeBg = { PENDIENTE:'#C53030', OBSERVADO:'#D69E2E', EMITIDO:'#2F855A', CANCELADO:'#718096' };
    tbody.innerHTML = pagina.map(r => {
      const est   = r.entrega_doc || 'PENDIENTE';
      const rowBg = { PENDIENTE:'background:rgba(197,48,48,.05)', OBSERVADO:'background:rgba(214,158,46,.06)', EMITIDO:'', CANCELADO:'opacity:.7' }[est] || '';
      const chk   = mov_seleccionados.has(r.id) ? 'checked' : '';
      return `<tr style="${rowBg}" onmouseover="this.style.filter='brightness(.97)'" onmouseout="this.style.filter=''">
        <td style="${_TD}text-align:center;position:sticky;left:0;background:var(--color-bg-card);z-index:1">
          <input type="checkbox" ${chk} onchange="toggleSeleccionMov('${r.id}',this.checked)">
        </td>
        <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(r.nro_operacion_bancaria||'—')}</td>
        <td style="${_TD}white-space:nowrap">${formatearFecha(r.fecha_deposito)}</td>
        <td style="${_TD}max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.descripcion||'')}">${escapar(r.descripcion||'—')}</td>
        <td style="${_TD}text-align:center">${escapar(r.moneda||'S/')}</td>
        <td style="${_TD}text-align:right;font-weight:700;color:${Number(r.monto)>=0?'var(--color-exito)':'var(--color-critico)'};white-space:nowrap">${formatearMoneda(r.monto,r.moneda==='USD'?'USD':'PEN')}</td>
        <td style="${_TD}max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.proveedor_empresa_personal||'')}">${escapar(r.proveedor_empresa_personal||'—')}</td>
        <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(r.ruc_dni||'—')}</td>
        <td style="${_TD}font-size:11px">${escapar(r.cotizacion||'—')}</td>
        <td style="${_TD}font-size:11px">${escapar(r.oc||'—')}</td>
        <td style="${_TD}max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.proyecto||'')}">${escapar(r.proyecto||'—')}</td>
        <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(r.concepto||'—')}</td>
        <td style="${_TD}max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.empresa||'')}">${escapar(r.empresa||'—')}</td>
        <td style="${_TD}">
          <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${badgeBg[est]||'#718096'};color:#fff;white-space:nowrap">${est}</span>
        </td>
        <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(r.nro_factura_doc||'—')}</td>
        <td style="${_TD}text-align:center">
          ${r.tipo_doc?`<span style="background:var(--color-secundario);color:#fff;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:600">${escapar(r.tipo_doc)}</span>`:'—'}
        </td>
        <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(r.autorizacion||'—')}</td>
        <td style="${_TD}max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.observaciones||'')}">${escapar(r.observaciones||'—')}</td>
        <td style="${_TD}max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.detalles_compra_servicio||'')}">${escapar(r.detalles_compra_servicio||'—')}</td>
        <td style="${_TD}max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.observaciones_2||'')}">${escapar(r.observaciones_2||'—')}</td>
        <td style="${_TD}text-align:center;white-space:nowrap">
          <button onclick="abrirModalMovimiento('${r.id}')"
            style="padding:4px 7px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Editar">✏️</button>
          <button onclick="_abrirModalDividirMBD('${r.id}')"
            style="padding:4px 7px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Dividir en comprobantes">✂️</button>
          <button onclick="eliminarMovimiento('${r.id}')"
            style="padding:4px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Eliminar">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  // Paginación
  const total = movimientos_filtrada.length;
  const pags  = Math.ceil(total / MOV_POR_PAG);
  const pagEl = document.getElementById('pag-movimientos');
  if (pagEl) pagEl.innerHTML = total > MOV_POR_PAG ? `
    <span class="pag-info">${inicio+1}–${Math.min(inicio+MOV_POR_PAG,total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagMov(-1)" ${movimientos_pag<=1?'disabled':''}>‹</button>
    <span>${movimientos_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagMov(1)"  ${movimientos_pag>=pags?'disabled':''}>›</button>` : '';
}

function cambiarPagMov(dir) { movimientos_pag += dir; renderTablaMovimientos(); }

function limpiarFiltrosMov() {
  ['mov-naturaleza','mov-estado-doc-f'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const b = document.getElementById('mov-buscar'); if (b) b.value = '';
  filtrarMovimientos();
}

function seleccionarTodosMov(checked) {
  movimientos_filtrada.forEach(r => { if (checked) mov_seleccionados.add(r.id); else mov_seleccionados.delete(r.id); });
  renderTablaMovimientos();
}

function toggleSeleccionMov(id, checked) {
  if (checked) mov_seleccionados.add(id); else mov_seleccionados.delete(id);
}

async function eliminarMovimiento(id) {
  if (!await confirmar('¿Eliminar este movimiento?', { btnOk: 'Eliminar', btnColor: '#C53030' })) return;
  const { error } = await _supabase.from('tesoreria_mbd').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar: ' + error.message, 'error'); return; }
  mostrarToast('Movimiento eliminado.', 'exito');
  await cargarMovimientos();
}

// ── Modal Editar / Nuevo movimiento ──────────────────────────────
async function abrirModalMovimiento(id) {
  // Delegar al modal de MBD (mismo formulario, misma tabla)
  await abrirModalMBD(id);
}

// ── Eliminar mes completo ────────────────────────────────────────
async function _abrirModalEliminarMesMov() {
  const mes  = document.getElementById('mov-mes')?.value;
  const anio = document.getElementById('mov-anio')?.value;
  if (!mes || !anio) return;

  const nomMes = new Date(anio, mes - 1, 1).toLocaleString('es-PE', { month: 'long' });
  const ok1 = await confirmar(
    `¿Eliminar TODOS los movimientos de ${nomMes.toUpperCase()} ${anio}?\n\nEsta acción no se puede deshacer.`,
    { btnOk: 'Sí, eliminar', btnColor: '#C53030' }
  );
  if (!ok1) return;

  const ok2 = await confirmar(
    `CONFIRMACIÓN FINAL: ¿Borrar ${nomMes.toUpperCase()} ${anio} permanentemente?`,
    { btnOk: 'Confirmar eliminación', btnColor: '#C53030' }
  );
  if (!ok2) return;

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const { error } = await _supabase
    .from('tesoreria_mbd')
    .delete()
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_deposito', desde)
    .lte('fecha_deposito', hasta);

  if (error) {
    mostrarToast('Error al eliminar: ' + error.message, 'error');
  } else {
    mostrarToast(`✓ Mes ${nomMes} ${anio} eliminado correctamente.`, 'exito');
    await cargarMovimientos();
  }
}

// ── Exportar Excel (mismo formato que plantilla MBD) ─────────────
async function exportarMovimientosExcel() {
  if (!movimientos_filtrada.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cabecera = [
    'N° de operación','Fecha de Deposito','Descripcion','Moneda','Monto',
    'Proveedores / Empresa / Personal','RUC / DNI','COTIZACIÓN','OC','Proyecto',
    'Concepto','Empresa','Entrega de FA / DOC / RRHH','Nª Factura o DOC.',
    'Tipo de DOC','Autorización','Observaciones','Detalles Compra / Servicio',
    'Observaciones 2',
  ];

  const _fmtF = iso => {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const filas = movimientos_filtrada.map(r => [
    r.nro_operacion_bancaria ? String(r.nro_operacion_bancaria).padStart(8,'0') : null,
    _fmtF(r.fecha_deposito),
    r.descripcion || null,
    r.moneda || 'S/',
    r.monto,
    r.proveedor_empresa_personal || null,
    r.ruc_dni || null,
    r.cotizacion || null,
    r.oc || null,
    r.proyecto || null,
    r.concepto || null,
    r.empresa || null,
    r.entrega_doc || 'PENDIENTE',
    r.nro_factura_doc || null,
    r.tipo_doc || null,
    r.autorizacion || null,
    r.observaciones || null,
    r.detalles_compra_servicio || null,
    r.observaciones_2 || null,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cabecera, ...filas]);
  filas.forEach((_, rowIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 0 });
    if (ws[cellRef]) ws[cellRef].t = 's';
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'REGISTRO');
  const mes  = document.getElementById('mov-mes')?.value  || '';
  const anio = document.getElementById('mov-anio')?.value || '';
  XLSX.writeFile(wb, `MBD_${empresa_activa.nombre_corto||empresa_activa.nombre}_${anio}${mes}.xlsx`);
  mostrarToast(`✓ Excel exportado.`, 'exito');
}
