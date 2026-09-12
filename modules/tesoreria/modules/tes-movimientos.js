// ═══════════════════════════════════════════════════════════════
// Tesorería — Movimientos (muestra datos de tesoreria_mbd)
// ═══════════════════════════════════════════════════════════════

let movimientos_lista    = [];
let movimientos_filtrada = [];
let movimientos_pag      = 1;
const MOV_POR_PAG        = 20;
let mov_seleccionados    = new Set();
let mov_ultimo_undo      = null; // { campos, registros: [{id, ...valoresAnteriores}] }

async function renderTabMovimientos(area) {
  // Limpiar barra masiva de sesiones anteriores
  document.getElementById('mov-barra-masiva')?.remove();
  mov_ultimo_undo = null;

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
            <input type="text" id="mov-buscar" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')"
                   data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"
                   oninput="filtrarMovimientos()" class="input-buscar w-full"
                   placeholder="Buscar en cualquier columna…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="mov-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secundario btn-sm" onclick="limpiarFiltrosMov()"
              title="Restablecer todos los filtros a su valor por defecto">🔄 Limpiar filtros</button>
            <button class="btn btn-secundario btn-sm" onclick="cargarMovimientos()"
              title="Recargar los movimientos desde la base de datos">↺ Actualizar</button>
            <button id="btn-mov-deshacer" class="btn btn-sm" onclick="_movDeshacerUltimaEdicion()"
              title="Revertir la última edición masiva aplicada"
              style="display:none;background:rgba(214,158,46,.12);color:#B7791F;border:1px solid #B7791F;border-radius:var(--radio);padding:6px 12px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">
              ↩️ Deshacer última edición
            </button>
            <button class="btn btn-secundario btn-sm" onclick="exportarMovimientosExcel()"
              title="Exportar los movimientos visibles a Excel (.xlsx)">⬇ Excel</button>
            <button class="btn btn-secundario btn-sm" onclick="_dupReporteHistoricoMovimientos()"
              title="Buscar movimientos bancarios duplicados en TODA la base (mismo monto, descripción y comprobante vinculado)">🔍 Buscar duplicados</button>
            <button class="btn btn-secundario btn-sm" onclick="_dupCompararMbdEeccClick()"
              title="Comparar el mes seleccionado (Mes/Año de arriba) contra el extracto bancario importado: qué falta de un lado o del otro">🔍 Comparar con EECC</button>
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

async function cargarMovimientos(mantenerPagina = false) {
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
  if (!mantenerPagina) movimientos_pag = 1;
  mov_seleccionados = new Set();

  // Resolver UUID → numero_rh solo para links ANTIGUOS donde nro_factura_doc es un UUID.
  // Los links nuevos ya guardan el número legible directamente (ej. "E001-17").
  const _uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rhIds = (data || [])
    .filter(r => r.tipo_doc === 'RH' && r.nro_factura_doc && _uuidRx.test(r.nro_factura_doc))
    .map(r => r.nro_factura_doc);
  window._rhUuidMap = {};
  if (rhIds.length) {
    const { data: rhData } = await _supabase
      .from('rh_registros').select('id,numero_rh').in('id', rhIds);
    (rhData || []).forEach(rh => { window._rhUuidMap[rh.id] = rh.numero_rh; });
  }

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
        const nroDocDisplay = (r.tipo_doc === 'RH' && window._rhUuidMap?.[r.nro_factura_doc])
          || r.nro_factura_doc;
        const haystack = [
          r.nro_operacion_bancaria, r.descripcion, r.proveedor_empresa_personal,
          r.ruc_dni, r.concepto, r.empresa, r.proyecto, nroDocDisplay,
          r.autorizacion, r.observaciones, r.observaciones_2,
          r.cotizacion, r.oc, r.moneda, r.entrega_doc, r.tipo_doc,
          r.detalles_compra_servicio,
          r.monto != null ? String(r.monto) : ''
        ].map(v=>(v||'').toLowerCase()).join(' ');
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
    <div class="resumen-card" style="background:var(--color-exito)">
      <div class="rc-label">Total soles</div>
      <div class="rc-valor">S/ ${_fmtMov(totS)}</div>
    </div>
    ${totD ? `<div class="resumen-card" style="background:#2B6CB0">
      <div class="rc-label">Total USD</div>
      <div class="rc-valor">$ ${_fmtMov(totD)}</div>
    </div>` : ''}
    <div class="resumen-card" style="background:${pend>0?'var(--color-atencion)':'#4A5568'}">
      <div class="rc-label">Pendientes doc</div>
      <div class="rc-valor">${pend}</div>
    </div>
    <div class="resumen-card" style="background:#4A5568">
      <div class="rc-label">Total movimientos</div>
      <div class="rc-valor">${filas.length}</div>
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
        <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar((r.tipo_doc==='RH'&&window._rhUuidMap?.[r.nro_factura_doc])||r.nro_factura_doc||'—')}</td>
        <td style="${_TD}text-align:center">
          ${(r.tipo_comprobante||r.tipo_doc)?`<span style="background:var(--color-secundario);color:#fff;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:600">${escapar(r.tipo_comprobante||r.tipo_doc)}</span>`:'—'}
        </td>
        <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(r.autorizacion||'—')}</td>
        <td style="${_TD}max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.observaciones||'')}">${escapar(r.observaciones||'—')}</td>
        <td style="${_TD}max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.detalles_compra_servicio||'')}">${escapar(r.detalles_compra_servicio||'—')}</td>
        <td style="${_TD}max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(r.observaciones_2||'')}">${escapar(r.observaciones_2||'—')}</td>
        <td style="${_TD}text-align:center;white-space:nowrap">
          <button class="btn-tabla-accion" onclick="abrirModalMovimiento('${r.id}')"
            title="Editar este movimiento individualmente"
            style="background:rgba(44,82,130,.1);color:var(--color-secundario)">✏️</button>
          <button class="btn-tabla-accion" onclick="_abrirModalDividirMBD('${r.id}')"
            title="Dividir este movimiento en varios comprobantes"
            style="background:rgba(44,82,130,.1);color:var(--color-secundario)">✂️</button>
          <button class="btn-tabla-accion" onclick="_bmBuscarDoc('${r.id}','${escapar(r.nro_operacion_bancaria||'')}',${r.monto},'${r.fecha_deposito}','tesoreria_mbd')"
            title="Vincular con comprobante (Compras / Ventas / RH)"
            style="background:rgba(85,60,154,.1);color:#553C9A">📂</button>
          <button class="btn-tabla-accion" onclick="eliminarMovimiento('${r.id}')"
            title="Eliminar solo este movimiento"
            style="background:rgba(197,48,48,.1);color:#C53030">🗑️</button>
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
  const _y = window.scrollY;
  await cargarMovimientos(true);
  requestAnimationFrame(() => window.scrollTo(0, _y));
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
    'Observaciones 2','Estado Conciliación EECC','Tipo Comprobante','Última Actualización',
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
    (r.tipo_doc === 'RH' && window._rhUuidMap?.[r.nro_factura_doc]) || r.nro_factura_doc || null,
    r.tipo_doc || null,
    r.autorizacion || null,
    r.observaciones || null,
    r.detalles_compra_servicio || null,
    r.observaciones_2 || null,
    r.estado_conciliacion === 'conciliado' ? 'CONCILIADO' : 'PENDIENTE',
    r.tipo_comprobante || null,
    _fmtF(r.fecha_actualizacion) || null,
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

  // Eliminar overlay previo para evitar IDs duplicados en el DOM
  document.getElementById('overlay-masivo')?.remove();

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
        ${_movFilaCampo('tipo_comprobante',        'Tipo de DOC',                   'select', TIPO_DOC)}
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
      if (!found?.doc) return;
      rucInp.value = found.doc;
      // Activar también su ☑ y habilitar el campo, si no se marca no se guarda al
      // aplicar la edición masiva. No usa _movToggleCampo() para no robar el foco
      // del campo Proveedor mientras el usuario sigue escribiendo/seleccionando.
      const chkRuc = document.getElementById('chk-mas-ruc_dni');
      if (chkRuc && !chkRuc.checked) {
        chkRuc.checked = true;
        rucInp.disabled = false;
        rucInp.style.opacity = '1';
        rucInp.style.cursor = '';
      }
    });
  }
}

// ── Guardar edición masiva ──────────────────────────────────────────
async function _movGuardarMasivo() {
  const CAMPOS = [
    'proveedor_empresa_personal', 'ruc_dni', 'proyecto', 'nro_factura_doc',
    'tipo_comprobante', 'entrega_doc', 'concepto', 'empresa', 'cotizacion', 'oc',
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
  const campos = Object.keys(payload);

  // Guardar valores anteriores para poder deshacer esta edición
  const registrosPrevios = movimientos_lista
    .filter(r => ids.includes(r.id))
    .map(r => {
      const prev = { id: r.id };
      campos.forEach(c => { prev[c] = r[c] ?? null; });
      return prev;
    });

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

  mov_ultimo_undo = { campos, registros: registrosPrevios };
  const btnDeshacer = document.getElementById('btn-mov-deshacer');
  if (btnDeshacer) btnDeshacer.style.display = '';

  document.getElementById('overlay-masivo')?.remove();
  mov_seleccionados.clear();
  _movActualizarBarra();
  const hdr = document.getElementById('chk-todos-mov');
  if (hdr) hdr.checked = false;
  filtrarMovimientos();

  mostrarToast(`✅ ${n} registro${n > 1 ? 's' : ''} actualizado${n > 1 ? 's' : ''} correctamente`, 'exito');
}

// ── Deshacer la última edición masiva ───────────────────────────────
async function _movDeshacerUltimaEdicion() {
  if (!mov_ultimo_undo) return;
  const { registros } = mov_ultimo_undo;
  const n = registros.length;

  if (!await confirmar(
    `¿Revertir la última edición masiva en ${n} registro${n > 1 ? 's' : ''} a sus valores anteriores?`
  )) return;

  const btn = document.getElementById('btn-mov-deshacer');
  if (btn) { btn.disabled = true; btn.textContent = 'Deshaciendo…'; }

  for (const prev of registros) {
    const { id, ...valores } = prev;
    const { error } = await _supabase
      .from('tesoreria_mbd')
      .update(valores)
      .eq('id', id)
      .eq('empresa_id', empresa_activa.id);

    if (error) {
      mostrarToast('Error al deshacer registro ' + id + ': ' + error.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '↩️ Deshacer última edición'; }
      return;
    }

    movimientos_lista = movimientos_lista.map(r =>
      r.id === id ? { ...r, ...valores } : r
    );
  }

  mov_ultimo_undo = null;
  if (btn) { btn.style.display = 'none'; btn.disabled = false; btn.textContent = '↩️ Deshacer última edición'; }

  filtrarMovimientos();
  mostrarToast(`↩️ ${n} registro${n > 1 ? 's' : ''} revertido${n > 1 ? 's' : ''} a su valor anterior`, 'exito');
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
  const pDocCompacto = pDoc.map(p => p.replace('-', ''));
  const [rMov,rComp,rVent,rRh] = await Promise.all([
    _supabase.from('tesoreria_mbd').select('*').eq('empresa_id',empresa_activa.id).eq('entrega_doc','PENDIENTE').is('nro_factura_doc',null).is('tipo_doc',null).gte('fecha_deposito',inicio).lte('fecha_deposito',fin),
    _supabase.from('contabilidad_compras').select('*').eq('empresa_id',empresa_activa.id).in('periodo',pDocCompacto),
    _supabase.from('contabilidad_ventas').select('*').eq('empresa_id',empresa_activa.id).in('periodo',pDocCompacto),
    _supabase.from('rh_registros').select('*,prestadores_servicios(nombre,dni)').eq('empresa_operadora_id',empresa_activa.id).in('periodo',pDoc),
  ]);
  // CORRECCIÓN 10: excluir movimientos ya conciliados en sesiones anteriores
  const movs = (rMov.data||[]).filter(m => m.estado_conciliacion !== 'conciliado');
  const docs = [
    ...(rComp.data||[]).map(d=>({...d,_tipo:'COMPRA',_ndoc:[d.serie_cdp,d.nro_cp_inicial].filter(Boolean).join('-')||'—',_proveedor:d.proveedor||'',_ruc:d.nro_doc_identidad||'',importe:d.total_cp||0})),
    ...(rVent.data||[]).map(d=>({...d,_tipo:'VENTA', _ndoc:[d.serie_cdp,d.nro_cp_inicial].filter(Boolean).join('-')||'—',_proveedor:d.cliente||'',  _ruc:d.nro_doc_identidad||'',  importe:d.total_cp||0})),
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
  const patch={entrega_doc:'EMITIDO',estado_conciliacion:'conciliado',nro_factura_doc:item.doc._ndoc||null,tipo_doc:item.doc._tipo||null,tipo_comprobante:_mbdCodigoTipoComprobante(item.doc._tipo,item.doc._ndoc),fecha_actualizacion:hoy};
  if(item.doc._proveedor) patch.proveedor_empresa_personal=item.doc._proveedor;
  if(item.doc._ruc) patch.ruc_dni=item.doc._ruc;
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
    const patch={entrega_doc:'EMITIDO',estado_conciliacion:'conciliado',nro_factura_doc:item.doc._ndoc||null,tipo_doc:item.doc._tipo||null,tipo_comprobante:_mbdCodigoTipoComprobante(item.doc._tipo,item.doc._ndoc),fecha_actualizacion:hoy};
    if(item.doc._proveedor) patch.proveedor_empresa_personal=item.doc._proveedor;
    if(item.doc._ruc) patch.ruc_dni=item.doc._ruc;
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

/* ============================================================
   Migrado desde tes-importar-mbd.js (2026-09-11): modal de editar
   un movimiento y modal de dividir un cargo entre varios
   comprobantes. Antes vivian en el archivo de la pestana "Importar
   MBD" (ya eliminada); se quedan aqui porque Movimientos los usa
   directamente (boton editar y boton dividir de cada fila).
   ============================================================ */
const TIPOS_DOC_MBD = [
  {val:'FA',lab:'FA — Factura'},{val:'BO',lab:'BO — Boletas'},
  {val:'BP',lab:'BP — Boletas de Pago'},{val:'RH',lab:'RH — Recibo por honorarios'},
  {val:'TK',lab:'TK — Ticket'},{val:'PM',lab:'PM — Planilla de Movilidad'},
  {val:'AT',lab:'AT — App de taxi'},{val:'DL',lab:'DL — Delivery'},
  {val:'PJ',lab:'PJ — Ticket de peaje'},{val:'SB',lab:'SB — Recibo de luz/agua/gas'},
  {val:'VB',lab:'VB — Voucher de banco'},{val:'OT',lab:'OT — Comprobante sin serie legible'}
];

let _mbdCatalogos = { conceptos: [], empresas: [], autorizaciones: [], mediosPago: [], proveedores: [], proyectos: [] };

async function _mbdCargarCatalogos() {
  // Catálogo propio de la empresa activa (igual que el módulo Catálogos).
  const eid = empresa_activa.id;
  const [rc, re, ra, rm, rproy, rmov, rComp, rVent, rRh] = await Promise.all([
    _supabase.from('conceptos').select('nombre').eq('activo', true).eq('empresa_operadora_id', eid).order('nombre'),
    _supabase.from('empresas_clientes').select('nombre,ruc_dni').eq('activo', true).eq('empresa_operadora_id', eid).order('nombre'),
    _supabase.from('autorizaciones').select('nombre').eq('activo', true).eq('empresa_operadora_id', eid).order('nombre'),
    _supabase.from('medios_pago').select('nombre').eq('activo', true).eq('empresa_operadora_id', eid).order('nombre'),
    _supabase.from('proyectos').select('nombre').eq('activo', true).eq('empresa_operadora_id', eid).order('nombre'),
    // Proveedor / Empresa / Personal: SOLO nombres que ya existen en registros reales
    // de esta empresa (movimientos bancarios, compras, ventas y RH) — no el catálogo
    // de Clientes/Proveedores. Así el autocompletado nunca "memoriza" un nombre nuevo
    // o mal escrito hasta que haya quedado guardado de verdad en uno de esos módulos.
    // Solo lectura: no toca ni depende de la lógica de vinculación/migración con
    // Tesorería (_qkEjecutar y afines), que sigue igual.
    _supabase.from('tesoreria_mbd').select('proveedor_empresa_personal,ruc_dni')
      .eq('empresa_id', eid)
      .not('proveedor_empresa_personal', 'is', null)
      .order('fecha_deposito', { ascending: false })
      .limit(5000),
    _supabase.from('contabilidad_compras').select('proveedor,nro_doc_identidad')
      .eq('empresa_id', eid).not('proveedor', 'is', null).limit(5000),
    _supabase.from('contabilidad_ventas').select('cliente,nro_doc_identidad')
      .eq('empresa_id', eid).not('cliente', 'is', null).limit(5000),
    _supabase.from('rh_registros').select('prestadores_servicios(nombre,dni)')
      .eq('empresa_operadora_id', eid).limit(5000),
  ]);

  // De-duplicar por nombre (por si hubiera ítems repetidos con distinta tilde/espacios
  // dentro de la misma empresa)
  const _normNombre = (s) => (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  const _uniq = (arr) => {
    const seen = new Set();
    return arr.filter(v => { const k = _normNombre(v); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  };

  _mbdCatalogos.conceptos      = _uniq((rc.data || []).map(r => r.nombre));
  _mbdCatalogos.empresas       = _uniq((re.data || []).map(r => r.nombre));
  _mbdCatalogos.autorizaciones = _uniq((ra.data || []).map(r => r.nombre));
  _mbdCatalogos.mediosPago     = _uniq((rm.data || []).map(r => r.nombre));
  _mbdCatalogos.proyectos      = _uniq((rproy.data || []).map(r => r.nombre));

  // Nombres distintos ya usados en registros reales de Movimientos Bancarios,
  // Compras, Ventas y RH (en ese orden de prioridad para el RUC/DNI mostrado)
  const candidatosProv = [
    ...(rmov.data  || []).map(r => ({ nombre: r.proveedor_empresa_personal, doc: r.ruc_dni })),
    ...(rComp.data || []).map(r => ({ nombre: r.proveedor,                  doc: r.nro_doc_identidad })),
    ...(rVent.data || []).map(r => ({ nombre: r.cliente,                   doc: r.nro_doc_identidad })),
    ...(rRh.data   || []).map(r => ({ nombre: r.prestadores_servicios?.nombre, doc: r.prestadores_servicios?.dni })),
  ];
  const seenProv = new Set();
  _mbdCatalogos.proveedores = candidatosProv
    .filter(r => (r.nombre || '').trim())
    .filter(r => {
      const k = _normNombre(r.nombre);
      if (seenProv.has(k)) return false;
      seenProv.add(k);
      return true;
    })
    .map(r => ({ nombre: r.nombre.trim(), doc: r.doc || '' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Auto-completar RUC/DNI al seleccionar un proveedor ya registrado en Movimientos
// Bancarios, Compras, Ventas o RH
function _mbdFillRucFromProveedor(val) {
  const rucEl = document.getElementById('mbd-ruc-dni');
  if (!val || !rucEl || rucEl.value) return;
  const found = (_mbdCatalogos.proveedores || []).find(p => p.nombre.toLowerCase() === val.toLowerCase());
  if (found?.doc) rucEl.value = found.doc;
}

async function abrirModalMBD(id = null) {
  let item = null;
  await _mbdCargarCatalogos();
  if (id) {
    const { data } = await _supabase.from('tesoreria_mbd').select('*').eq('id', id).single();
    item = data;
  }

  // Resolver UUID → número legible para tipo RH
  let _nroFacturaDisplay = item?.nro_factura_doc || '';
  let _nroFacturaIsRhUuid = false;
  if (item?.tipo_doc === 'RH' && item?.nro_factura_doc && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(item.nro_factura_doc)) {
    const { data: rhReg } = await _supabase.from('rh_registros').select('numero_rh').eq('id', item.nro_factura_doc).single();
    if (rhReg?.numero_rh) { _nroFacturaDisplay = rhReg.numero_rh; _nroFacturaIsRhUuid = true; }
  }

  const nroOps = (item?.nro_operacion_bancaria || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!nroOps.length) nroOps.push('');

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalMBD()">
      <div class="modal" style="max-width:780px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>📊 ${id ? 'Editar' : 'Nuevo'} Movimiento Bancario</h3>
          <button class="modal-cerrar" onclick="cerrarModalMBD()">✕</button>
        </div>
        <div class="modal-body">
          <div id="mbd-alerta" class="alerta-error"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="campo">
              <label>Fecha <span class="req">*</span></label>
              <input type="date" id="mbd-fecha" value="${item?.fecha_deposito||new Date().toISOString().slice(0,10)}">
            </div>
            <div class="campo">
              <label>Monto <span class="req">*</span></label>
              <input type="number" id="mbd-monto" step="0.01" placeholder="0.00" value="${item?.monto||''}">
            </div>
            <div class="campo">
              <label>Moneda</label>
              <select id="mbd-moneda">
                <option value="S/" ${item?.moneda==='S/'?'selected':''}>S/ — Soles</option>
                <option value="USD" ${item?.moneda==='USD'?'selected':''}>USD — Dólares</option>
              </select>
            </div>
            <div class="campo">
              <label style="display:flex;align-items:center;justify-content:space-between">
                N° Operación Bancaria
                <button type="button" onclick="_mbdAgregarNroOp()" title="Agregar N° adicional"
                  style="padding:1px 8px;font-size:11px;background:var(--color-secundario);color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:var(--font)">+ Agregar</button>
              </label>
              <div id="mbd-nro-ops-container" style="display:flex;flex-direction:column;gap:4px">
                ${nroOps.map((n, i) => i === 0
                  ? `<input type="text" class="mbd-nro-op-input" value="${escapar(n)}" placeholder="Opcional" style="padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px;width:100%;box-sizing:border-box">`
                  : `<div style="display:flex;gap:4px"><input type="text" class="mbd-nro-op-input" value="${escapar(n)}" placeholder="N° adicional" style="flex:1;padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px"><button type="button" onclick="_mbdQuitarNroOp(this)" style="padding:4px 9px;background:rgba(197,48,48,.12);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px;flex-shrink:0">×</button></div>`
                ).join('')}
              </div>
            </div>
            <div class="campo" style="grid-column:span 2">
              <label>Descripción</label>
              <input type="text" id="mbd-descripcion" value="${escapar(item?.descripcion||'')}" placeholder="Descripción del movimiento">
            </div>
            <div class="campo" style="grid-column:span 2">
              <label>Proveedor / Empresa / Personal</label>
              <input type="text" id="mbd-proveedor"
                value="${escapar(item?.proveedor_empresa_personal||'')}"
                placeholder="Escribir o seleccionar de la lista"
                list="mbd-prov-datalist"
                oninput="_mbdFillRucFromProveedor(this.value)"
                onchange="_mbdFillRucFromProveedor(this.value)">
              <datalist id="mbd-prov-datalist">
                ${_mbdCatalogos.proveedores.map(p=>`<option value="${escapar(p.nombre)}">${escapar(p.nombre)}${p.doc?' · '+p.doc:''}</option>`).join('')}
              </datalist>
            </div>
            <div class="campo">
              <label>RUC / DNI</label>
              <input type="text" id="mbd-ruc-dni" value="${escapar(item?.ruc_dni||'')}" placeholder="Autocompletado al seleccionar">
            </div>
            <div class="campo">
              <label>Concepto</label>
              <select id="mbd-concepto">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.conceptos.map(c=>`<option value="${c}" ${item?.concepto===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Empresa / Proveedor</label>
              <select id="mbd-empresa">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.empresas.map(e=>`<option value="${e}" ${item?.empresa===e?'selected':''}>${e}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Tipo DOC</label>
              <select id="mbd-tipo-doc">
                <option value="">— Seleccionar —</option>
                ${TIPOS_DOC_MBD.map(t=>`<option value="${t.val}" ${item?.tipo_doc===t.val?'selected':''}>${t.lab}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Estado Entrega DOC</label>
              <select id="mbd-entrega-doc">
                ${['PENDIENTE','OBSERVADO','EMITIDO','CANCELADO'].map(e=>`<option value="${e}" ${(item?.entrega_doc||'PENDIENTE')===e?'selected':''}>${e}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>N° Factura / DOC</label>
              <input type="hidden" id="mbd-nro-factura" value="${escapar(item?.nro_factura_doc||'')}">
              <input type="text" id="mbd-nro-factura-display" value="${escapar(_nroFacturaDisplay)}"
                placeholder="Serie-Número"
                ${_nroFacturaIsRhUuid ? 'readonly style="background:rgba(128,128,128,.08);cursor:default" title="Vinculado a RH — para cambiar usar función de vinculación"' : 'oninput="document.getElementById(\'mbd-nro-factura\').value=this.value"'}>
            </div>
            <div class="campo">
              <label>Autorización</label>
              <select id="mbd-autorizacion">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.autorizaciones.map(a=>`<option value="${a}" ${item?.autorizacion===a?'selected':''}>${a}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Medio de Pago</label>
              <select id="mbd-medio-pago">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.mediosPago.map(m=>`<option value="${m}" ${item?.observaciones_3===m?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Cotización</label>
              <input type="text" id="mbd-cotizacion" value="${escapar(item?.cotizacion||'')}">
            </div>
            <div class="campo">
              <label>OC</label>
              <input type="text" id="mbd-oc" value="${escapar(item?.oc||'')}">
            </div>
            <div class="campo">
              <label>Proyecto</label>
              <input type="text" id="mbd-proyecto"
                value="${escapar(item?.proyecto||'')}"
                placeholder="Escribir o seleccionar"
                list="mbd-proy-datalist">
              <datalist id="mbd-proy-datalist">
                ${_mbdCatalogos.proyectos.map(p=>`<option value="${escapar(p)}">`).join('')}
              </datalist>
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Detalles Compra / Servicio</label>
              <input type="text" id="mbd-detalles" value="${escapar(item?.detalles_compra_servicio||'')}">
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Observaciones</label>
              <input type="text" id="mbd-obs" value="${escapar(item?.observaciones||'')}">
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Obs. 2</label>
              <input type="text" id="mbd-obs2" value="${escapar(item?.observaciones_2||'')}">
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Obs. 4</label>
              <input type="text" id="mbd-obs4" value="${escapar(item?.observaciones_4||'')}">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalMBD()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarMBD('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;

  // Autocompletar RUC/DNI si el proveedor ya viene con nombre pero sin RUC/DNI
  // (al editar, el campo se llena vía value="" y eso no dispara oninput/onchange)
  _mbdFillRucFromProveedor(document.getElementById('mbd-proveedor')?.value || '');
}

function cerrarModalMBD() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarMBD(id) {
  const alerta = document.getElementById('mbd-alerta');
  alerta.classList.remove('visible');

  const fecha  = document.getElementById('mbd-fecha').value;
  const monto  = parseFloat(document.getElementById('mbd-monto').value);

  if (!fecha) { alerta.textContent = 'La fecha es requerida.'; alerta.classList.add('visible'); return; }
  if (isNaN(monto)) { alerta.textContent = 'Ingrese un monto válido.'; alerta.classList.add('visible'); return; }

  const payload = {
    empresa_id:               empresa_activa.id,
    fecha_deposito:           fecha,
    monto,
    moneda:                   document.getElementById('mbd-moneda').value,
    nro_operacion_bancaria:   Array.from(document.querySelectorAll('#mbd-nro-ops-container .mbd-nro-op-input')).map(el=>el.value.trim()).filter(Boolean).join(', ')||null,
    descripcion:              document.getElementById('mbd-descripcion').value.trim()||null,
    proveedor_empresa_personal: document.getElementById('mbd-proveedor').value.trim()||null,
    ruc_dni:                  document.getElementById('mbd-ruc-dni').value.trim()||null,
    concepto:                 document.getElementById('mbd-concepto').value||null,
    empresa:                  document.getElementById('mbd-empresa').value||null,
    tipo_doc:                 document.getElementById('mbd-tipo-doc').value||null,
    entrega_doc:              document.getElementById('mbd-entrega-doc').value,
    nro_factura_doc:          document.getElementById('mbd-nro-factura').value.trim()||null,
    autorizacion:             document.getElementById('mbd-autorizacion').value||null,
    cotizacion:               document.getElementById('mbd-cotizacion').value.trim()||null,
    oc:                       document.getElementById('mbd-oc').value.trim()||null,
    proyecto:                 document.getElementById('mbd-proyecto').value.trim()||null,
    detalles_compra_servicio: document.getElementById('mbd-detalles').value.trim()||null,
    observaciones:            document.getElementById('mbd-obs').value.trim()||null,
    observaciones_2:          document.getElementById('mbd-obs2').value.trim()||null,
    observaciones_3:          document.getElementById('mbd-medio-pago').value||null,
    observaciones_4:          document.getElementById('mbd-obs4').value.trim()||null,
    creado_por:               perfil_usuario.id,
    fecha_actualizacion:      new Date().toISOString(),
  };

  // Migración 2.4 — si el N° Factura/DOC coincide con un comprobante ya
  // registrado en Contabilidad, autocompletar lo que falte y fusionar
  // lo que ya esté escrito distinto (nunca sobrescribir en silencio).
  if (payload.nro_factura_doc && payload.tipo_doc && typeof _migBuscarComprobante === 'function') {
    const comprobante = await _migBuscarComprobante(payload.nro_factura_doc, payload.tipo_doc);
    if (comprobante) {
      const { autocompletar, conflictos } = _migCompararCampos(
        { proveedor: payload.proveedor_empresa_personal, ruc: payload.ruc_dni, monto: payload.monto },
        comprobante
      );
      if (autocompletar.proveedor) payload.proveedor_empresa_personal = autocompletar.proveedor;
      if (autocompletar.ruc)       payload.ruc_dni = autocompletar.ruc;
      if (autocompletar.monto != null) payload.monto = autocompletar.monto;

      if (conflictos.length) {
        const elegido = await _migModalFusion(conflictos, {
          proveedor: payload.proveedor_empresa_personal, ruc: payload.ruc_dni, monto: payload.monto,
        });
        if (!elegido) return; // canceló — no se guarda nada
        if (elegido.proveedor != null) payload.proveedor_empresa_personal = elegido.proveedor;
        if (elegido.ruc != null)       payload.ruc_dni = elegido.ruc;
        if (elegido.monto != null)     payload.monto = elegido.monto;
      }
    }
  }

  if (id) {
    const ok = await confirmar('¿Está segura de guardar los cambios en este movimiento?', { btnOk: 'Guardar cambios', btnColor: '#2C5282' });
    if (!ok) return;
  } else if (typeof _dupBuscarMovimientoBancario === 'function') {
    // Alerta de movimiento bancario duplicado (3.1) — mismo monto + misma descripción,
    // solo al registrar movimientos NUEVOS (no aplica al Estado Parcial: varios
    // movimientos distintos vinculados al mismo comprobante son normales).
    const dups = await _dupBuscarMovimientoBancario({
      monto: payload.monto, descripcion: payload.descripcion,
      fecha_deposito: payload.fecha_deposito, nro_factura_doc: payload.nro_factura_doc,
    });
    if (dups.length) {
      const ok = await confirmar(
        `⚠️ Ya existe un movimiento bancario similar (mismo monto y descripción, y mismo comprobante o misma fecha si es un cargo recurrente):\n\n${_dupDetalleMovimientos(dups)}\n\n¿Está segura de registrarlo de todas formas?`,
        { btnOk: 'Sí, registrar de todas formas', btnColor: '#C53030' }
      );
      if (!ok) return;
    }
  }

  let error;
  if (id) {
    ({ error } = await _supabase.from('tesoreria_mbd').update(payload).eq('id', id));
  } else {
    ({ error } = await _supabase.from('tesoreria_mbd').insert(payload));
  }

  if (error) { alerta.textContent = 'Error al guardar: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Movimiento actualizado.' : 'Movimiento registrado.', 'exito');
  cerrarModalMBD();
  // Refrescar Movimientos manteniendo página y posición de scroll (no
  // reiniciar la vista al editar)
  const _y = window.scrollY;
  await cargarMovimientos(true);
  requestAnimationFrame(() => window.scrollTo(0, _y));
}

function _mbdAgregarNroOp() {
  const container = document.getElementById('mbd-nro-ops-container');
  if (!container) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:4px';
  wrap.innerHTML = '<input type="text" class="mbd-nro-op-input" placeholder="N° adicional" style="flex:1;padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px"><button type="button" onclick="_mbdQuitarNroOp(this)" style="padding:4px 9px;background:rgba(197,48,48,.12);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px;flex-shrink:0">×</button>';
  container.appendChild(wrap);
  wrap.querySelector('input').focus();
}

function _mbdQuitarNroOp(btn) {
  const wrap = btn.closest('div');
  if (wrap && wrap.parentElement?.id === 'mbd-nro-ops-container') wrap.remove();
}


let _dividirOriginal = null;
let _dividirFilas    = [];

async function _abrirModalDividirMBD(id) {
  const { data: r, error } = await _supabase.from('tesoreria_mbd').select('*').eq('id', id).single();
  if (error || !r) { mostrarToast('No se pudo cargar el movimiento.', 'error'); return; }
  _dividirOriginal = r;
  _dividirFilas = [
    { tipodoc: r.tipo_doc || '', nrodoc: r.nro_factura_doc || '', proveedor: r.proveedor_empresa_personal || '', ruc: r.ruc_dni || '', monto: '' },
    { tipodoc: '', nrodoc: '', proveedor: '', ruc: '', monto: '' },
  ];
  _renderModalDividir();
}

function _guardarFilasDividir() {
  _dividirFilas.forEach((f, i) => {
    f.tipodoc   = document.getElementById(`div-tipo-${i}`)?.value   || '';
    f.nrodoc    = (document.getElementById(`div-nro-${i}`)?.value   || '').trim();
    f.proveedor = (document.getElementById(`div-prov-${i}`)?.value  || '').trim();
    f.ruc       = (document.getElementById(`div-ruc-${i}`)?.value   || '').trim();
    f.monto     = document.getElementById(`div-monto-${i}`)?.value  || '';
  });
}

function _addFilaDividir() {
  _guardarFilasDividir();
  _dividirFilas.push({ tipodoc: '', nrodoc: '', proveedor: '', ruc: '', monto: '' });
  _renderModalDividir();
}

function _removeFilaDividir(i) {
  if (_dividirFilas.length <= 2) return;
  _guardarFilasDividir();
  _dividirFilas.splice(i, 1);
  _renderModalDividir();
}

function _actualizarSumaDividir() {
  if (!_dividirOriginal) return;
  const montoOrig = Number(_dividirOriginal.monto);
  const moneda    = _dividirOriginal.moneda === 'USD' ? 'USD' : 'PEN';
  let suma = 0;
  _dividirFilas.forEach((_, i) => { suma += parseFloat(document.getElementById(`div-monto-${i}`)?.value || 0); });
  suma = Math.round(suma * 100) / 100;
  const diff = Math.round((montoOrig - suma) * 100) / 100;
  const ok   = Math.abs(diff) < 0.01;

  const sumEl = document.getElementById('div-suma-info');
  const btnEl = document.getElementById('btn-div-confirmar');
  if (sumEl) {
    if (ok) {
      sumEl.innerHTML = `<span style="color:var(--color-exito);font-weight:700">✅ Suma: ${formatearMoneda(suma, moneda)} = transferencia original</span>`;
    } else if (suma > montoOrig) {
      sumEl.innerHTML = `<span style="color:var(--color-critico);font-weight:700">⚠️ Suma: ${formatearMoneda(suma, moneda)} — excede ${formatearMoneda(Math.abs(diff), moneda)} el total</span>`;
    } else {
      sumEl.innerHTML = `<span style="color:var(--color-atencion);font-weight:700">⏳ Suma: ${formatearMoneda(suma, moneda)} — faltan ${formatearMoneda(diff, moneda)}</span>`;
    }
  }
  if (btnEl) {
    btnEl.disabled = !ok;
    btnEl.textContent = ok
      ? `✂️ Confirmar división (${_dividirFilas.length} comprobantes)`
      : `✂️ Confirmar división`;
  }
}

function _renderModalDividir() {
  const r        = _dividirOriginal;
  const moneda  = r.moneda === 'USD' ? 'USD' : 'PEN';
  const n        = _dividirFilas.length;

  const mc = document.getElementById('modal-container');
  if (!mc) return;
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cerrarModalDividir()">
      <div class="modal" style="max-width:720px;width:95%;max-height:92vh;overflow-y:auto">
        <div class="modal-header">
          <h3>✂️ Dividir transferencia en comprobantes</h3>
          <button class="modal-cerrar" onclick="_cerrarModalDividir()">✕</button>
        </div>
        <div class="modal-body">

          <!-- Banner transferencia original -->
          <div style="margin-bottom:16px;padding:12px 16px;background:rgba(44,82,130,.08);border-radius:8px;border-left:4px solid var(--color-secundario);display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px">Transferencia original</div>
              <span style="font-family:monospace;font-weight:700">${escapar(r.nro_operacion_bancaria || '—')}</span>
              <span style="margin-left:8px;font-size:12px;color:var(--color-texto-suave)">${formatearFecha(r.fecha_deposito)}</span>
              ${r.descripcion ? `<span style="margin-left:8px;font-size:12px">${escapar(r.descripcion)}</span>` : ''}
            </div>
            <strong style="font-size:20px;color:var(--color-exito)">${formatearMoneda(Number(r.monto), moneda)}</strong>
          </div>

          <div style="font-size:12px;color:var(--color-texto-suave);margin-bottom:12px;padding:8px 12px;background:rgba(214,158,46,.08);border-radius:6px;border-left:3px solid var(--color-atencion)">
            💡 La suma de los montos debe ser exactamente igual al total de la transferencia. Se eliminará la fila original y se crearán las filas por comprobante.
          </div>

          <!-- Filas de comprobantes -->
          ${_dividirFilas.map((f, i) => `
            <div style="background:var(--color-bg);border:1px solid var(--color-borde);border-radius:8px;padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-size:12px;font-weight:700;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.5px">
                  📄 Comprobante ${i + 1}
                </span>
                ${n > 2 ? `<button onclick="_removeFilaDividir(${i})" style="background:none;border:none;cursor:pointer;color:var(--color-critico);font-size:18px;line-height:1;padding:2px 4px" title="Quitar">✕</button>` : ''}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                <div class="campo" style="margin:0">
                  <label>Tipo de DOC</label>
                  <select id="div-tipo-${i}" onchange="_actualizarSumaDividir()">
                    <option value="">— Seleccionar —</option>
                    ${TIPOS_DOC_MBD.map(t => `<option value="${t.val}" ${f.tipodoc === t.val ? 'selected' : ''}>${t.lab}</option>`).join('')}
                  </select>
                </div>
                <div class="campo" style="margin:0">
                  <label>N° Comprobante</label>
                  <input type="text" id="div-nro-${i}" value="${escapar(f.nrodoc)}" placeholder="Ej: E001-17, 001-10-25 (opcional, puede completarse después)">
                </div>
                <div class="campo" style="margin:0">
                  <label>Monto (${moneda}) <span style="color:var(--color-critico)">*</span></label>
                  <input type="number" id="div-monto-${i}" value="${escapar(String(f.monto))}" placeholder="0.00" step="0.01" oninput="_actualizarSumaDividir()" style="text-align:right">
                </div>
                <div class="campo" style="margin:0;grid-column:span 2">
                  <label>Proveedor / Trabajador / Personal</label>
                  <input type="text" id="div-prov-${i}" value="${escapar(f.proveedor)}" placeholder="Nombre completo">
                </div>
                <div class="campo" style="margin:0">
                  <label>DNI / RUC</label>
                  <input type="text" id="div-ruc-${i}" value="${escapar(f.ruc)}" placeholder="Documento de identidad">
                </div>
              </div>
            </div>`).join('')}

          <button onclick="_addFilaDividir()" style="${estiloBtnSecundario()};width:100%;margin-bottom:14px;font-size:13px">
            + Agregar comprobante
          </button>

          <!-- Indicador de suma -->
          <div id="div-suma-info" style="text-align:center;padding:10px 14px;border-radius:6px;background:var(--color-bg);font-size:13px;margin-bottom:4px">
            <span style="color:var(--color-texto-suave)">Ingresa los montos para verificar la suma</span>
          </div>

          <div id="div-alerta" class="alerta-error"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="_cerrarModalDividir()">Cancelar</button>
          <button class="btn btn-primario" id="btn-div-confirmar" disabled onclick="_confirmarDividirMBD()">
            ✂️ Confirmar división
          </button>
        </div>
      </div>
    </div>`;

  _actualizarSumaDividir();
}

function _cerrarModalDividir() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
  _dividirOriginal = null;
  _dividirFilas    = [];
}

async function _confirmarDividirMBD() {
  _guardarFilasDividir();
  const r      = _dividirOriginal;
  const alerta = document.getElementById('div-alerta');
  const btn    = document.getElementById('btn-div-confirmar');
  const moneda = r.moneda === 'USD' ? 'USD' : 'PEN';
  const n      = _dividirFilas.length;

  // Validar cada fila — solo el monto es obligatorio (la suma debe cuadrar con el total original).
  // Tipo de DOC, N° Comprobante y Proveedor pueden completarse después.
  for (let i = 0; i < n; i++) {
    const f = _dividirFilas[i];
    if (!parseFloat(f.monto)) {
      if (alerta) { alerta.textContent = `Comprobante ${i+1}: ingresa un monto válido distinto de cero.`; alerta.classList.add('visible'); }
      return;
    }
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; }

  // Construir las N filas hijas
  const nuevasFilas = _dividirFilas.map((f, i) => {
    const proveedor = f.proveedor || r.proveedor_empresa_personal || null;
    const cotizacion = r.cotizacion;
    const oc = r.oc;
    const proyecto = r.proyecto;
    const concepto = r.concepto;
    const empresa = r.empresa;
    const descripcion = (r.descripcion || '') + (n > 1 ? ` (${i+1}/${n})` : '');
    // Estado según completitud real de los 14 campos (PENDIENTE/OBSERVADO/EMITIDO) — punto 2.5
    const estadoDoc = typeof _conEvalCompletitud14 === 'function'
      ? _conEvalCompletitud14({
          nro_operacion_bancaria: r.nro_operacion_bancaria, fecha_deposito: r.fecha_deposito,
          descripcion, moneda: r.moneda, monto: f.monto,
          proveedor_empresa_personal: proveedor, ruc_dni: f.ruc,
          cotizacion, oc, proyecto, concepto, empresa,
          nro_factura_doc: f.nrodoc, tipo_doc: f.tipodoc, autorizacion: r.autorizacion,
        })
      : 'PENDIENTE';
    return {
      empresa_id:                 r.empresa_id,
      nro_operacion_bancaria:     r.nro_operacion_bancaria,
      fecha_deposito:             r.fecha_deposito,
      moneda:                     r.moneda,
      monto:                      parseFloat(f.monto),
      descripcion,
      proveedor_empresa_personal: proveedor,
      ruc_dni:                    f.ruc || null,
      tipo_doc:                   f.tipodoc,
      nro_factura_doc:            f.nrodoc,
      entrega_doc:                estadoDoc,
      concepto,
      empresa,
      proyecto,
      autorizacion:               r.autorizacion,
      cotizacion,
      oc,
      observaciones:              r.observaciones,
      detalles_compra_servicio:   r.detalles_compra_servicio,
      observaciones_2:            r.observaciones_2,
      fecha_actualizacion:        new Date().toISOString(),
    };
  });

  // 1. Insertar las filas nuevas
  const { error: errIns } = await _supabase.from('tesoreria_mbd').insert(nuevasFilas);
  if (errIns) {
    if (alerta) { alerta.textContent = 'Error al crear los comprobantes: ' + errIns.message; alerta.classList.add('visible'); }
    if (btn) { btn.disabled = false; btn.textContent = `✂️ Confirmar división (${n} comprobantes)`; }
    return;
  }

  // 2. Eliminar la fila original
  const { error: errDel } = await _supabase.from('tesoreria_mbd').delete().eq('id', r.id);
  if (errDel) {
    mostrarToast('Comprobantes creados, pero hubo un error al eliminar la fila original. Revisa duplicados.', 'atencion');
    _cerrarModalDividir();
    cargarMovimientos(true);
    return;
  }

  mostrarToast(`✅ Transferencia dividida en ${n} comprobantes. Estado asignado según completitud de campos.`, 'exito');
  _cerrarModalDividir();
  cargarMovimientos(true);
}


function estiloSelect() {
  return 'padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)';
}
function estiloInput() {
  return 'padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)';
}
function estiloBtnPrimario() {
  return 'padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500';
}
function estiloBtnSecundario() {
  return 'padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px';
}
function estiloBtnIcono(tipo) {
  const bg = tipo === 'danger' ? 'rgba(197,48,48,.1)' : 'rgba(44,82,130,.1)';
  const co = tipo === 'danger' ? '#C53030' : 'var(--color-secundario)';
  return `padding:4px 8px;background:${bg};color:${co};border:none;border-radius:4px;cursor:pointer;font-size:13px`;
}
function estiloCard(color) {
  return `background:${color};color:#fff;padding:12px 16px;border-radius:8px;min-width:140px`;
}
function estilosBadge() {
  return `<style>
    .badge-doc{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:var(--color-secundario);color:#fff}
    .badge-medio{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#553C9A;color:#fff}
    .badge-estado-pendiente{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#C53030;color:#fff}
    .badge-estado-observado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#D69E2E;color:#fff}
    .badge-estado-emitido{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#2F855A;color:#fff}
    .badge-estado-cancelado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#718096;color:#fff}
  </style>`;
}

