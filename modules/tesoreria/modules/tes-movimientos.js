// ═══════════════════════════════════════════════════════════════
// Tesorería — Movimientos (muestra datos de tesoreria_mbd)
// ═══════════════════════════════════════════════════════════════

let movimientos_lista    = [];
let movimientos_filtrada = [];
let movimientos_pag      = 1;
const MOV_POR_PAG        = 20;
let mov_seleccionados    = new Set();

async function renderTabMovimientos(area) {
  // Limpiar barra masiva de sesiones anteriores
  document.getElementById('mov-barra-masiva')?.remove();

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
                   placeholder="Descripción, proveedor, 15/01/2026…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="mov-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secundario btn-sm" onclick="limpiarFiltrosMov()"
              title="Restablecer todos los filtros a su valor por defecto">🔄 Limpiar filtros</button>
            <button class="btn btn-secundario btn-sm" onclick="cargarMovimientos()"
              title="Recargar los movimientos desde la base de datos">↺ Actualizar</button>
            <button class="btn btn-secundario btn-sm" onclick="exportarMovimientosExcel()"
              title="Exportar los movimientos visibles a Excel (.xlsx)">⬇ Excel</button>
            <button class="btn btn-sm" onclick="_abrirModalEliminarMesMov()"
              title="Eliminar TODOS los movimientos del mes seleccionado (requiere doble confirmación)"
              style="background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:var(--radio);padding:6px 12px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">
              🗑️ Eliminar mes completo
            </button>
            <button class="btn btn-sm" onclick="_movConciliarMes()"
              title="Ir al módulo de Conciliación con el mes actual preseleccionado"
              style="background:#276749;color:#fff;border:none;border-radius:var(--radio);padding:6px 12px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">
              ⚡ Conciliar mes
            </button>
            <button class="btn btn-primario btn-sm" onclick="abrirModalMovimiento(null)"
              title="Agregar un nuevo movimiento manualmente">+ Nuevo</button>
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
  _movActualizarBarra();
  filtrarMovimientos();
}

// ── Detección de fecha en búsqueda ───────────────────────────────
function _parsearFechaBusqueda(texto) {
  // DD/MM/YYYY o D/M/YYYY → { tipo:'dia', dia, mes, anio }
  const mDia = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mDia) return { tipo:'dia', dia:mDia[1].padStart(2,'0'), mes:mDia[2].padStart(2,'0'), anio:mDia[3] };
  // MM/YYYY o M/YYYY → { tipo:'mes', mes, anio }
  const mMes = texto.match(/^(\d{1,2})\/(\d{4})$/);
  if (mMes) return { tipo:'mes', mes:mMes[1].padStart(2,'0'), anio:mMes[2] };
  // YYYY → { tipo:'anio', anio }
  const mAnio = texto.match(/^(\d{4})$/);
  if (mAnio && parseInt(mAnio[1]) >= 2000) return { tipo:'anio', anio:mAnio[1] };
  return null;
}

function _fechaCoincide(isoDate, filtro) {
  if (!isoDate || !filtro) return false;
  const [fanio, fmes, fdia] = (isoDate || '').split('-');
  if (filtro.tipo === 'dia')  return fanio === filtro.anio && fmes === filtro.mes && fdia === filtro.dia;
  if (filtro.tipo === 'mes')  return fanio === filtro.anio && fmes === filtro.mes;
  if (filtro.tipo === 'anio') return fanio === filtro.anio;
  return false;
}

function filtrarMovimientos() {
  const nat   = document.getElementById('mov-naturaleza')?.value || '';
  const est   = document.getElementById('mov-estado-doc-f')?.value || '';
  const qRaw  = (document.getElementById('mov-buscar')?.value || '').trim();
  const q     = qRaw.toLowerCase();

  // Detectar si la búsqueda es una fecha
  const fechaFiltro = q ? _parsearFechaBusqueda(qRaw) : null;

  movimientos_filtrada = movimientos_lista.filter(r => {
    if (nat === 'CARGO'  && Number(r.monto) >= 0) return false;
    if (nat === 'ABONO'  && Number(r.monto) < 0)  return false;
    if (est && r.entrega_doc !== est) return false;
    if (q) {
      if (fechaFiltro) {
        // Filtrar por fecha exacta / mes / año
        if (!_fechaCoincide(r.fecha_deposito, fechaFiltro)) return false;
      } else {
        // Búsqueda de texto normal
        const haystack = [r.nro_operacion_bancaria,r.descripcion,r.proveedor_empresa_personal,
          r.ruc_dni,r.concepto,r.empresa,r.proyecto,r.nro_factura_doc,r.autorizacion,r.observaciones]
          .map(v=>(v||'').toLowerCase()).join(' ');
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });

  const ctr = document.getElementById('mov-contador');
  if (ctr) {
    const fechaLabel = fechaFiltro
      ? ` · 📅 Fecha: <strong>${qRaw}</strong>`
      : '';
    ctr.innerHTML = `${movimientos_filtrada.length} de ${movimientos_lista.length} registros${fechaLabel}`;
  }

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
            title="Editar este movimiento individualmente"
            style="padding:4px 7px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">✏️</button>
          <button onclick="_abrirModalDividirMBD('${r.id}')"
            title="Dividir este movimiento en varios comprobantes"
            style="padding:4px 7px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">✂️</button>
          <button onclick="eliminarMovimiento('${r.id}')"
            title="Eliminar solo este movimiento"
            style="padding:4px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">🗑️</button>
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
    <button class="btn-pag" title="Página anterior" onclick="cambiarPagMov(-1)" ${movimientos_pag<=1?'disabled':''}>‹</button>
    <span>${movimientos_pag} / ${pags}</span>
    <button class="btn-pag" title="Página siguiente" onclick="cambiarPagMov(1)"  ${movimientos_pag>=pags?'disabled':''}>›</button>` : '';
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
  _movActualizarBarra();
  renderTablaMovimientos();
}

function toggleSeleccionMov(id, checked) {
  if (checked) mov_seleccionados.add(id); else mov_seleccionados.delete(id);
  _movActualizarBarra();
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

// ══════════════════════════════════════════════════════════════════
// EDICIÓN / ELIMINACIÓN MASIVA
// ══════════════════════════════════════════════════════════════════

// ── Barra flotante de acciones (aparece al seleccionar) ─────────────
function _movActualizarBarra() {
  const n = mov_seleccionados.size;

  // Buscar o crear el contenedor
  let barra = document.getElementById('mov-barra-masiva');

  if (n === 0) {
    if (barra) barra.remove();
    return;
  }

  if (!barra) {
    barra = document.createElement('div');
    barra.id = 'mov-barra-masiva';
    Object.assign(barra.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '8000',
      background: '#2C5282', color: '#fff',
      padding: '12px 24px', display: 'flex', alignItems: 'center',
      gap: '12px', flexWrap: 'wrap',
      boxShadow: '0 -4px 24px rgba(0,0,0,.35)',
      fontFamily: 'inherit',
    });
    document.body.appendChild(barra);
  }

  const editLabel = n === 1
    ? '✏️ Editar este registro'
    : `✏️ Editar ${n} registros`;

  barra.innerHTML = `
    <span style="font-size:14px;font-weight:600;white-space:nowrap">
      ☑ ${n} registro${n > 1 ? 's' : ''} seleccionado${n > 1 ? 's' : ''}
    </span>
    <div style="flex:1;min-width:16px"></div>
    <button onclick="_movEditarMasivo()"
      title="${n === 1
        ? 'Editar individualmente el registro seleccionado'
        : 'Abrir modal para editar campos en los ' + n + ' registros seleccionados (solo los campos que actives se sobreescribirán)'}"
      style="padding:8px 18px;background:#fff;color:#2C5282;border:none;
             border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;font-family:inherit">
      ${editLabel}
    </button>
    <button onclick="_movEliminarMasivo()"
      title="Eliminar SOLO los ${n} registros seleccionados (distinto al botón \'Eliminar mes completo\')"
      style="padding:8px 18px;background:rgba(255,255,255,.18);color:#fff;
             border:1px solid rgba(255,255,255,.4);border-radius:6px;cursor:pointer;
             font-weight:500;font-size:13px;font-family:inherit">
      🗑️ Eliminar seleccionados
    </button>
    <button onclick="_movCancelarSeleccion()"
      title="Deseleccionar todos los registros y cerrar esta barra"
      style="padding:8px 12px;background:none;color:rgba(255,255,255,.7);border:none;
             border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit">
      ✕ Cancelar selección
    </button>
  `;
}

function _movCancelarSeleccion() {
  mov_seleccionados.clear();
  _movActualizarBarra();
  const hdr = document.getElementById('chk-todos-mov');
  if (hdr) hdr.checked = false;
  renderTablaMovimientos();
}

// ── Genera una fila de campo editable con checkbox ──────────────────
// tipo: 'text' | 'select' | 'combobox'
// opciones: array {v,t} para select
// listaItems: array de strings para combobox (datalist)
function _movFilaCampo(campo, label, tipo, opciones, listaItems) {
  const inputId = `mas-${campo}`;
  const chkId   = `chk-mas-${campo}`;
  const listId  = `dl-mas-${campo}`;
  const inputEstilo = `width:100%;padding:6px 10px;border:1px solid var(--color-borde);
    border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);
    font-family:var(--font);font-size:13px;opacity:.4;cursor:not-allowed;box-sizing:border-box`;

  let inputHtml;
  if (tipo === 'select') {
    inputHtml = `<select id="${inputId}" disabled style="${inputEstilo}">
      ${(opciones||[]).map(o => `<option value="${o.v}">${o.t}</option>`).join('')}
    </select>`;
  } else if (tipo === 'combobox') {
    inputHtml = `
      <input type="text" id="${inputId}" disabled placeholder="${label}"
        list="${listId}" style="${inputEstilo}">
      <datalist id="${listId}">
        ${(listaItems||[]).map(i=>`<option value="${escapar(i)}">`).join('')}
      </datalist>`;
  } else {
    inputHtml = `<input type="text" id="${inputId}" disabled placeholder="${label}"
      style="${inputEstilo}">`;
  }

  return `
    <div style="display:flex;gap:10px;align-items:flex-start;
                padding:10px 0;border-bottom:1px solid var(--color-borde)">
      <div style="padding-top:3px">
        <input type="checkbox" id="${chkId}"
          onchange="_movToggleCampo('${campo}',this.checked)"
          style="width:16px;height:16px;cursor:pointer;accent-color:var(--color-secundario)">
      </div>
      <div style="flex:1;min-width:0">
        <label for="${chkId}"
          style="display:block;font-size:12px;font-weight:600;
                 color:var(--color-texto-suave);margin-bottom:5px;cursor:pointer">
          ${label}
        </label>
        ${inputHtml}
      </div>
    </div>`;
}

function _movToggleCampo(campo, enabled) {
  const inp = document.getElementById(`mas-${campo}`);
  if (!inp) return;
  inp.disabled       = !enabled;
  inp.style.opacity  = enabled ? '1' : '.4';
  inp.style.cursor   = enabled ? '' : 'not-allowed';
  if (enabled) inp.focus();
}

// ── Abrir modal de edición masiva ───────────────────────────────────
async function _movEditarMasivo() {
  const n = mov_seleccionados.size;
  if (n === 0) return;

  // Un solo registro → edición individual normal
  if (n === 1) {
    abrirModalMovimiento([...mov_seleccionados][0]);
    return;
  }

  // Cargar catálogos para los dropdowns
  await _mbdCargarCatalogos();

  const TIPO_DOC = [
    { v: '', t: '— Seleccionar —' },
    ...TIPOS_DOC_MBD.map(t => ({ v: t.val, t: t.lab })),
  ];

  const ESTADO = [
    { v: '',          t: '— Seleccionar —' },
    { v: 'PENDIENTE', t: '🔴 Pendiente' },
    { v: 'EMITIDO',   t: '🟢 Emitido' },
    { v: 'OBSERVADO', t: '🟡 Observado' },
    { v: 'CANCELADO', t: '⚫ Cancelado' },
  ];

  const overlay = document.createElement('div');
  overlay.id = 'overlay-masivo';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;z-index:9000`;

  overlay.innerHTML = `
    <div style="background:var(--color-bg-card);border-radius:12px;width:94%;max-width:580px;
      max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);
      border:1px solid var(--color-borde)">

      <!-- Cabecera fija -->
      <div style="padding:18px 22px;border-bottom:1px solid var(--color-borde);
        display:flex;align-items:center;justify-content:space-between;
        position:sticky;top:0;background:var(--color-bg-card);z-index:1">
        <div>
          <div style="font-weight:700;font-size:15px">✏️ Editar campos en ${n} registros</div>
          <div style="font-size:12px;color:var(--color-texto-suave);margin-top:3px">
            Solo se modificarán los campos que actives (☑)
          </div>
        </div>
        <button onclick="document.getElementById('overlay-masivo').remove()"
          style="background:none;border:none;cursor:pointer;font-size:20px;
                 color:var(--color-texto-suave);padding:4px">✕</button>
      </div>

      <!-- Campos -->
      <div style="padding:4px 22px 8px">
        ${_movFilaCampo('proveedor_empresa_personal', 'Proveedor / Empresa / Personal', 'combobox', null, _mbdCatalogos.proveedores.map(p=>p.nombre))}
        ${_movFilaCampo('ruc_dni',                 'RUC / DNI',                     'text')}
        ${_movFilaCampo('proyecto',                'Proyecto',                      'combobox', null, _mbdCatalogos.proyectos)}
        ${_movFilaCampo('nro_factura_doc',         'N° Factura / DOC',              'text')}
        ${_movFilaCampo('tipo_doc',                'Tipo de DOC',                   'select', TIPO_DOC)}
        ${_movFilaCampo('entrega_doc',             'Estado DOC',                    'select', ESTADO)}
        ${_movFilaCampo('concepto',                'Concepto',                      'combobox', null, _mbdCatalogos.conceptos)}
        ${_movFilaCampo('empresa',                 'Empresa',                       'combobox', null, _mbdCatalogos.empresas)}
        ${_movFilaCampo('cotizacion',              'COTIZACIÓN',                    'text')}
        ${_movFilaCampo('oc',                      'OC',                            'text')}
        ${_movFilaCampo('autorizacion',            'Autorización',                  'combobox', null, _mbdCatalogos.autorizaciones)}
        ${_movFilaCampo('detalles_compra_servicio','Detalles Compra / Servicio',    'text')}
        ${_movFilaCampo('observaciones',           'Observaciones',                 'text')}
        ${_movFilaCampo('observaciones_2',         'Observaciones 2',               'text')}
      </div>

      <!-- Pie fijo -->
      <div style="padding:14px 22px;border-top:1px solid var(--color-borde);
        position:sticky;bottom:0;background:var(--color-bg-card)">
        <div style="padding:8px 12px;background:rgba(44,82,130,.08);border-radius:6px;
          font-size:12px;color:var(--color-texto-suave);margin-bottom:12px">
          ⚠️ Solo se sobrescribirán los campos con ☑ activado. Los campos sin ☑ no se tocarán en ningún registro.
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button onclick="document.getElementById('overlay-masivo').remove()"
            title="Cerrar sin guardar cambios"
            style="padding:9px 20px;border:1px solid var(--color-borde);border-radius:8px;
              background:var(--color-bg-card);color:var(--color-texto);cursor:pointer;
              font-size:13px;font-family:var(--font)">Cancelar</button>
          <button id="btn-guardar-masivo" onclick="_movGuardarMasivo()"
            title="Aplicar los campos activados (☑) a todos los ${n} registros seleccionados"
            style="padding:9px 20px;border:none;border-radius:8px;
              background:var(--color-secundario);color:#fff;cursor:pointer;
              font-size:13px;font-family:var(--font);font-weight:600">
            ✅ Guardar en ${n} registros
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Auto-completar RUC/DNI al seleccionar proveedor en edición masiva
  const provInp = document.getElementById('mas-proveedor_empresa_personal');
  if (provInp) {
    provInp.addEventListener('input', () => {
      const rucInp = document.getElementById('mas-ruc_dni');
      if (!rucInp || rucInp.value) return;
      const found = _mbdCatalogos.proveedores.find(p => p.nombre.toLowerCase() === provInp.value.toLowerCase());
      if (found?.doc) rucInp.value = found.doc;
    });
  }
}

// ── Guardar edición masiva ──────────────────────────────────────────
async function _movGuardarMasivo() {
  const CAMPOS = [
    'proveedor_empresa_personal', 'ruc_dni', 'proyecto', 'nro_factura_doc',
    'tipo_doc', 'entrega_doc', 'concepto', 'empresa', 'cotizacion', 'oc',
    'autorizacion', 'detalles_compra_servicio', 'observaciones', 'observaciones_2',
  ];

  const payload = {};
  for (const c of CAMPOS) {
    if (!document.getElementById(`chk-mas-${c}`)?.checked) continue;
    const val = (document.getElementById(`mas-${c}`)?.value || '').trim();
    payload[c] = val || null;
  }

  if (!Object.keys(payload).length) {
    mostrarToast('Activa al menos un campo para editar', 'atencion');
    return;
  }

  const ids = [...mov_seleccionados];
  const n   = ids.length;

  const btn = document.getElementById('btn-guardar-masivo');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  const { error } = await _supabase
    .from('tesoreria_mbd')
    .update(payload)
    .in('id', ids)
    .eq('empresa_id', empresa_activa.id);

  if (error) {
    mostrarToast('Error al actualizar: ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = `✅ Guardar en ${n} registros`; }
    return;
  }

  // Parchear caché local (evita recargar desde BD)
  movimientos_lista = movimientos_lista.map(r =>
    ids.includes(r.id) ? { ...r, ...payload } : r
  );

  document.getElementById('overlay-masivo')?.remove();
  mov_seleccionados.clear();
  _movActualizarBarra();
  const hdr = document.getElementById('chk-todos-mov');
  if (hdr) hdr.checked = false;
  filtrarMovimientos();

  mostrarToast(`✅ ${n} registro${n > 1 ? 's' : ''} actualizado${n > 1 ? 's' : ''} correctamente`, 'exito');
}

// ── Eliminar masivo ─────────────────────────────────────────────────
async function _movEliminarMasivo() {
  const ids = [...mov_seleccionados];
  const n   = ids.length;

  if (!await confirmar(
    `¿Eliminar los ${n} registro${n > 1 ? 's' : ''} seleccionado${n > 1 ? 's' : ''}?\n\nEsta acción no se puede deshacer.`,
    { btnOk: 'Sí, eliminar', btnColor: '#C53030' }
  )) return;

  if (!await confirmar(
    `CONFIRMACIÓN FINAL: ¿Borrar ${n} movimiento${n > 1 ? 's' : ''} permanentemente?`,
    { btnOk: 'Confirmar', btnColor: '#C53030' }
  )) return;

  const { error } = await _supabase
    .from('tesoreria_mbd')
    .delete()
    .in('id', ids)
    .eq('empresa_id', empresa_activa.id);

  if (error) { mostrarToast('Error al eliminar: ' + error.message, 'error'); return; }

  // Parchear caché local
  movimientos_lista = movimientos_lista.filter(r => !ids.includes(r.id));
  mov_seleccionados.clear();
  _movActualizarBarra();
  const hdr = document.getElementById('chk-todos-mov');
  if (hdr) hdr.checked = false;
  filtrarMovimientos();

  mostrarToast(`✅ ${n} registro${n > 1 ? 's' : ''} eliminado${n > 1 ? 's' : ''}`, 'exito');
}

// ════════════════════════════════════════════════════════════════
// MEJORA 5 — Conciliación rápida integrada en Movimientos
// Motor de matching inline: sin redirigir al módulo Conciliación
// ════════════════════════════════════════════════════════════════

function _qkSim(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().trim(); b = b.toLowerCase().trim();
  if (a === b) return 1;
  if (a.includes(b.slice(0,5)) || b.includes(a.slice(0,5))) return 0.7;
  const la = a.length, lb = b.length;
  const dp = Array.from({length: la+1}, (_, i) => Array.from({length: lb+1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[la][lb] / Math.max(la, lb);
}

function _qkScore(mov, doc) {
  let s = 0;
  const mM = Math.abs(Number(mov.monto)), mD = Math.abs(Number(doc.importe||doc.monto_total||0));
  if (mD > 0) { const p = Math.abs(mM-mD)/mD; s += p===0?50:p<0.01?42:p<0.05?28:p<0.20?12:0; }
  const nM = (mov.descripcion||mov.proveedor_empresa_personal||'').toLowerCase();
  const nD = (doc._proveedor||'').toLowerCase();
  if (nM && nD) { const sim = _qkSim(nM, nD); s += sim>=0.9?40:sim>=0.7?26:sim>=0.5?12:0; }
  const rM = (mov.ruc_dni||'').replace(/\D/g,''), rD = (doc._ruc||'').replace(/\D/g,'');
  if (rM && rD && rM===rD) s += 10;
  return Math.min(s, 100);
}

function _qkCombo(doc, movs) {
  const target = Math.abs(Number(doc.importe||doc.monto_total||0));
  if (target<=0 || movs.length<2) return null;
  const cands = movs.map(m=>({m,sim:_qkSim(m.proveedor_empresa_personal||m.descripcion||'',doc._proveedor||'')})).sort((a,b)=>b.sim-a.sim).slice(0,15).map(c=>c.m);
  if (cands.length<2) return null;
  const montos = cands.map(m=>Math.abs(Number(m.monto)));
  function buscar(i,n,suma,idxs) {
    if (n===0) { const d=Math.abs(suma-target); return d/target<0.5?{movs:idxs.map(k=>cands[k]),suma,diferencia:suma-target}:null; }
    for (let j=i;j<=cands.length-n;j++) { const r=buscar(j+1,n-1,suma+montos[j],[...idxs,j]); if(r) return r; }
    return null;
  }
  for (let n=2;n<=Math.min(cands.length,6);n++) { const r=buscar(0,n,0,[]); if(r) return r; }
  return null;
}

function _qkPeriodos(periodo) {
  const [y,m] = periodo.split('-');
  return Array.from({length:10},(_,i)=>{ const d=new Date(+y,+m-1+(i-3),1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
}

async function _qkEjecutar(periodo) {
  const [y,m] = periodo.split('-');
  const inicio = `${y}-${m}-01`, fin = new Date(+y,+m,0).toISOString().slice(0,10), pDoc = _qkPeriodos(periodo);
  const [rMov,rComp,rVent,rRh] = await Promise.all([
    _supabase.from('tesoreria_mbd').select('*').eq('empresa_id',empresa_activa.id).eq('entrega_doc','PENDIENTE').is('nro_factura_doc',null).is('tipo_doc',null).gte('fecha_deposito',inicio).lte('fecha_deposito',fin),
    _supabase.from('registro_compras').select('*').eq('empresa_operadora_id',empresa_activa.id).in('periodo',pDoc),
    _supabase.from('registro_ventas').select('*').eq('empresa_operadora_id',empresa_activa.id).in('periodo',pDoc),
    _supabase.from('rh_registros').select('*,prestadores_servicios(nombre,dni)').eq('empresa_operadora_id',empresa_activa.id).in('periodo',pDoc),
  ]);
  // CORRECCIÓN 10: excluir movimientos ya conciliados en sesiones anteriores
  const movs = (rMov.data||[]).filter(m => m.estado_conciliacion !== 'conciliado');
  const docs = [
    ...(rComp.data||[]).map(d=>({...d,_tipo:'COMPRA',_ndoc:[d.serie,d.numero].filter(Boolean).join('-')||'—',_proveedor:d.nombre_proveedor||'',_ruc:d.ruc_proveedor||'',importe:d.monto_total||0})),
    ...(rVent.data||[]).map(d=>({...d,_tipo:'VENTA', _ndoc:[d.serie,d.numero].filter(Boolean).join('-')||'—',_proveedor:d.nombre_cliente||'',  _ruc:d.ruc_cliente||'',  importe:d.monto_total||0})),
    ...(rRh.data  ||[]).map(d=>({...d,_tipo:'RH',    _ndoc:[d.serie,d.numero].filter(Boolean).join('-')||'—',_proveedor:d.prestadores_servicios?.nombre||d.nombre||'',_ruc:d.prestadores_servicios?.dni||d.ruc||'',importe:d.monto_neto||d.monto||0})),
  ];
  const exactos=[],posibles=[],sinMatch=[];
  const usadosDoc=new Set();
  for (const mov of movs) {
    let best=-1,bestDoc=null;
    for (const doc of docs) { if(usadosDoc.has(doc.id)) continue; const s=_qkScore(mov,doc); if(s>best){best=s;bestDoc=doc;} }
    if (bestDoc&&best>=85) { usadosDoc.add(bestDoc.id); exactos.push({mov,doc:bestDoc,score:best}); }
    else if (bestDoc&&best>=60) posibles.push({mov,doc:bestDoc,score:best});
    else sinMatch.push({mov,doc:bestDoc,score:best});
  }
  const usadosSM=new Set();
  for (const doc of docs) {
    if (usadosDoc.has(doc.id)) continue;
    const libres=sinMatch.filter(i=>!usadosSM.has(i.mov.id)).map(i=>i.mov);
    const combo=_qkCombo(doc,libres); if(!combo) continue;
    usadosDoc.add(doc.id); combo.movs.forEach(mv=>usadosSM.add(mv.id));
    posibles.push({movs:combo.movs,doc,score:75,diferencia:combo.diferencia,sumaMovs:combo.suma,esMulti:true});
  }
  sinMatch.splice(0,sinMatch.length,...sinMatch.filter(i=>!usadosSM.has(i.mov.id)));
  return {exactos,posibles,sinMatch,total:movs.length};
}

async function _qkAprobarUno(idx,pref) {
  const arr=(pref==='ex'?window._qkRes?.exactos:window._qkRes?.posibles)||[];
  const item=arr[idx]; if(!item||item._ok) return;
  const hoy=new Date().toISOString().slice(0,10);
  const patch={entrega_doc:'EMITIDO',estado_conciliacion:'conciliado',nro_factura_doc:item.doc._ndoc||null,tipo_doc:item.doc._tipo||null,fecha_actualizacion:hoy};
  if(item.doc._proveedor&&!item.mov.proveedor_empresa_personal) patch.proveedor_empresa_personal=item.doc._proveedor;
  if(item.doc._ruc&&!item.mov.ruc_dni) patch.ruc_dni=item.doc._ruc;
  const {error}=await _supabase.from('tesoreria_mbd').update(patch).eq('id',item.mov.id);
  if(error){mostrarToast('Error: '+error.message,'error');return;}
  await _supabase.from('conciliaciones').insert({empresa_operadora_id:empresa_activa.id,movimiento_id:item.mov.id,doc_tipo:item.doc._tipo,doc_id:item.doc.id||null,score:item.score,tipo_match:pref==='ex'?'EXACTO':'POSIBLE',estado:'APROBADO',usuario_id:perfil_usuario?.id||null});
  item._ok=true;
  const fila=document.getElementById(`qk-row-${pref}-${idx}`);
  if(fila){fila.style.opacity='0.35';fila.querySelectorAll('button').forEach(b=>b.disabled=true);}
  mostrarToast('✓ Aprobado','exito');
}

async function _qkAprobarMulti(idx) {
  const item=(window._qkRes?.posibles||[])[idx]; if(!item?.esMulti||item._ok) return;
  const hoy=new Date().toISOString().slice(0,10); let ok=0;
  for (const mov of item.movs) {
    const patch={entrega_doc:'EMITIDO',estado_conciliacion:'conciliado',nro_factura_doc:item.doc._ndoc||null,tipo_doc:item.doc._tipo||null,fecha_actualizacion:hoy};
    if(item.doc._proveedor&&!mov.proveedor_empresa_personal) patch.proveedor_empresa_personal=item.doc._proveedor;
    if(item.doc._ruc&&!mov.ruc_dni) patch.ruc_dni=item.doc._ruc;
    const {error}=await _supabase.from('tesoreria_mbd').update(patch).eq('id',mov.id);
    if(!error){await _supabase.from('conciliaciones').insert({empresa_operadora_id:empresa_activa.id,movimiento_id:mov.id,doc_tipo:item.doc._tipo,doc_id:item.doc.id||null,score:item.score,tipo_match:'MULTI_TRANSFER',estado:'APROBADO',usuario_id:perfil_usuario?.id||null});ok++;}
  }
  item._ok=true;
  const fila=document.getElementById(`qk-row-pos-${idx}`);
  if(fila){fila.style.opacity='0.35';fila.querySelectorAll('button').forEach(b=>b.disabled=true);}
  mostrarToast(`✅ Multi-transferencia: ${ok} mov. aprobados`,'exito');
}

async function _qkAprobarLote() {
  const pend=(window._qkRes?.exactos||[]).filter(i=>!i._ok);
  if(!pend.length){mostrarToast('No hay exactos pendientes','atencion');return;}
  if(!await confirmar(`¿Aprobar los ${pend.length} matches exactos?`,{btnOk:'Sí, aprobar',btnColor:'#166534'})) return;
  (window._qkRes?.exactos||[]).forEach((_,i)=>{ if(!window._qkRes.exactos[i]._ok) _qkAprobarUno(i,'ex'); });
  mostrarToast(`✅ ${pend.length} en proceso…`,'exito');
  setTimeout(cargarMovimientos, 1500);
}

function _qkDescartar(idx,pref) {
  const arr=pref==='ex'?(window._qkRes?.exactos||[]):(window._qkRes?.posibles||[]);
  if(arr[idx]) arr[idx]._ok=true;
  const fila=document.getElementById(`qk-row-${pref}-${idx}`);
  if(fila){fila.style.opacity='0.3';fila.querySelectorAll('button').forEach(b=>b.disabled=true);}
}

function _qkRender(res, nombreMes) {
  const body=document.getElementById('qk-body'); if(!body) return;
  window._qkRes=res;
  if(res.total===0){body.innerHTML='<div class="card" style="text-align:center;padding:24px;color:var(--color-texto-suave)">No hay movimientos pendientes sin comprobante para este mes.</div>';return;}
  const fila=(it,i,pref)=>{
    if(it.esMulti){
      const diff=Math.abs(it.diferencia??0);
      return `<div id="qk-row-${pref}-${i}" style="padding:8px 10px;margin-bottom:6px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.25);border-radius:6px;font-size:12px">
        <div style="font-weight:600;color:#d97706;margin-bottom:3px">⚠️ Multi-transferencia — ${it.movs.length} movs → ${escapar(it.doc._ndoc||'—')}</div>
        <div style="color:var(--color-texto-suave);margin-bottom:3px">${it.movs.map(mv=>`${formatearFecha(mv.fecha_deposito)} ${formatearMoneda(mv.monto)}`).join(' + ')} = ${formatearMoneda(it.sumaMovs)} · Doc: ${formatearMoneda(it.doc.importe||0)} · <strong style="color:${diff>0?'#ef4444':'#22c55e'}">Dif: ${formatearMoneda(diff)}</strong></div>
        <div style="display:flex;gap:6px"><button onclick="_qkAprobarMulti(${i})" style="padding:4px 12px;background:#166534;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-family:var(--font)">✓ Confirmar</button><button onclick="_qkDescartar(${i},'${pref}')" style="padding:4px 10px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px">✕</button></div>
      </div>`;
    }
    const diff=Math.abs(Math.abs(Number(it.mov.monto))-Math.abs(Number(it.doc.importe||it.doc.monto_total||0)));
    return `<div id="qk-row-${pref}-${i}" style="padding:8px 10px;margin-bottom:6px;background:${pref==='ex'?'rgba(34,197,94,.06)':'rgba(245,158,11,.06)'};border:1px solid ${pref==='ex'?'rgba(34,197,94,.25)':'rgba(245,158,11,.25)'};border-radius:6px;font-size:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
        <div><div style="font-weight:600">${escapar(it.mov.descripcion||it.mov.proveedor_empresa_personal||'—')} → ${escapar(it.doc._ndoc||'—')} · ${escapar((it.doc._proveedor||'').slice(0,25))}</div>
          <div style="color:var(--color-texto-suave);margin-top:2px">Mov: ${formatearMoneda(it.mov.monto)} · Doc: ${formatearMoneda(it.doc.importe||it.doc.monto_total||0)} · <strong style="color:${diff>0?'#ef4444':'#22c55e'}">Dif: ${formatearMoneda(diff)}</strong> · ${it.score}%</div></div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button onclick="_qkAprobarUno(${i},'${pref}')" style="padding:4px 12px;background:#166534;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-family:var(--font)">✓ Aprobar</button>
          <button onclick="_qkDescartar(${i},'${pref}')" style="padding:4px 9px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px">✕</button>
        </div>
      </div>
    </div>`;
  };
  body.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      <div class="card" style="text-align:center;padding:12px;border-left:4px solid #22c55e"><div style="font-size:22px;font-weight:700;color:#22c55e">${res.exactos.length}</div><div class="text-muted text-sm">🟢 Exactos</div></div>
      <div class="card" style="text-align:center;padding:12px;border-left:4px solid #f59e0b"><div style="font-size:22px;font-weight:700;color:#f59e0b">${res.posibles.length}</div><div class="text-muted text-sm">🟡 Posibles</div></div>
      <div class="card" style="text-align:center;padding:12px;border-left:4px solid #ef4444"><div style="font-size:22px;font-weight:700;color:#ef4444">${res.sinMatch.length}</div><div class="text-muted text-sm">🔴 Sin match</div></div>
    </div>
    ${res.exactos.length?`<div style="font-weight:700;font-size:13px;margin-bottom:6px">🟢 Exactos</div>${res.exactos.map((it,i)=>fila(it,i,'ex')).join('')}<div style="margin-bottom:14px"><button onclick="_qkAprobarLote()" style="padding:7px 16px;background:#166534;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600">✅ Aprobar todos los exactos</button></div>`:''}
    ${res.posibles.length?`<div style="font-weight:700;font-size:13px;margin:10px 0 6px">🟡 Posibles</div>${res.posibles.map((it,i)=>fila(it,i,'pos')).join('')}`:''}
    ${res.sinMatch.length?`<div style="font-weight:700;font-size:13px;margin:10px 0 6px">🔴 Sin match (${res.sinMatch.length})</div><div class="card" style="padding:8px 12px;font-size:11px;color:var(--color-texto-suave)">${res.sinMatch.map(it=>`<div style="padding:3px 0;border-bottom:1px solid var(--color-borde)">${formatearFecha(it.mov.fecha_deposito)} · ${escapar(it.mov.descripcion||'—')} · ${formatearMoneda(it.mov.monto)}</div>`).join('')}</div>`:''}`;
}

async function _movConciliarMes() {
  const mes=document.getElementById('mov-mes')?.value||'', anio=document.getElementById('mov-anio')?.value||'';
  if(!mes||!anio) return;
  const periodo=`${anio}-${mes}`, nombreMes=new Date(+anio,+mes-1,1).toLocaleString('es-PE',{month:'long',year:'numeric'});
  const overlay=document.createElement('div');
  overlay.id='qk-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9500';
  overlay.innerHTML=`
    <div style="background:var(--color-bg-card);border-radius:12px;width:96%;max-width:820px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.5);border:1px solid var(--color-borde)">
      <div style="padding:16px 20px;border-bottom:1px solid var(--color-borde);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--color-bg-card);z-index:1">
        <div>
          <div style="font-weight:700;font-size:15px">⚡ Conciliación Rápida — ${escapar(nombreMes)}</div>
          <div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px">Solo mov. PENDIENTES sin comprobante · ventana 9 meses</div>
        </div>
        <button onclick="document.getElementById('qk-overlay').remove()" style="background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-texto-suave)">✕</button>
      </div>
      <div id="qk-body" style="padding:18px">
        <div style="text-align:center;padding:36px"><div class="spinner" style="margin:0 auto"></div><p style="margin-top:12px;color:var(--color-texto-suave)">Ejecutando motor de matching…</p></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  const res=await _qkEjecutar(periodo);
  _qkRender(res,nombreMes);
}
