// ═══════════════════════════════════════════════════════════════
// Planilla — Periodos
// ═══════════════════════════════════════════════════════════════

let periodos_lista    = [];
let periodos_filtrada = [];
let periodos_pag      = 1;
const PER_POR_PAG     = 20;

const MESES_NOMBRE = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const TIPO_PERIODO_LABEL = {
  MENSUAL:      'Mensual',
  QUINCENAL_1:  '1ra Quincena',
  QUINCENAL_2:  '2da Quincena',
  GRATIFICACION:'Gratificación',
  CTS:          'CTS',
  LIQUIDACION:  'Liquidación',
};

const ESTADO_PERIODO_BADGE = {
  BORRADOR:   'badge-warning',
  CALCULADO:  'badge-info',
  PAGADO:     'badge-activo',
  ANULADO:    'badge-inactivo',
};

async function renderTabPeriodos(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="grid-3" id="per-resumen" style="margin-bottom:20px;gap:12px"></div>

      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:10px">
          <div>
            <label class="label-filtro">Año</label>
            <select id="per-f-anio" onchange="filtrarPeriodos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Mes</label>
            <select id="per-f-mes" onchange="filtrarPeriodos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Tipo</label>
            <select id="per-f-tipo" onchange="filtrarPeriodos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="MENSUAL">Mensual</option>
              <option value="QUINCENAL_1">1ra Quincena</option>
              <option value="QUINCENAL_2">2da Quincena</option>
              <option value="GRATIFICACION">Gratificación</option>
              <option value="CTS">CTS</option>
              <option value="LIQUIDACION">Liquidación</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="per-f-estado" onchange="filtrarPeriodos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="CALCULADO">Calculado</option>
              <option value="PAGADO">Pagado</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="per-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secundario btn-sm" onclick="limpiarFiltrosPer()">🔄 Limpiar</button>
            <button class="btn btn-secundario btn-sm" onclick="exportarPeriodosExcel()">⬇ Excel</button>
            <button class="btn btn-primario btn-sm"   onclick="abrirModalPeriodo(null)">+ Nuevo periodo</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Año</th><th>Mes</th><th>Tipo</th><th>Estado</th>
            <th class="text-right">Remuneraciones</th>
            <th class="text-right">Descuentos</th>
            <th class="text-right">Neto</th>
            <th>F. Pago</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-periodos"></tbody>
        </table>
      </div>
      <div id="pag-periodos" class="paginacion"></div>
    </div>

    <!-- Modal periodo -->
    <div class="modal-overlay" id="modal-periodo" style="display:none">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3 id="modal-per-titulo">Nuevo periodo</h3>
          <button class="modal-cerrar" onclick="cerrarModalPeriodo()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-per" class="alerta-error"></div>
          <input type="hidden" id="per-id">
          <div class="grid-2">
            <div class="campo">
              <label>Año <span class="req">*</span></label>
              <select id="per-anio">
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026" selected>2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
            <div class="campo">
              <label>Mes <span class="req">*</span></label>
              <select id="per-mes">
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
            </div>
            <div class="campo">
              <label>Tipo <span class="req">*</span></label>
              <select id="per-tipo">
                <option value="MENSUAL">Mensual</option>
                <option value="QUINCENAL_1">1ra Quincena</option>
                <option value="QUINCENAL_2">2da Quincena</option>
                <option value="GRATIFICACION">Gratificación</option>
                <option value="CTS">CTS</option>
                <option value="LIQUIDACION">Liquidación</option>
              </select>
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="per-estado">
                <option value="BORRADOR">Borrador</option>
                <option value="CALCULADO">Calculado</option>
                <option value="PAGADO">Pagado</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div class="campo col-2">
              <label>Fecha de pago</label>
              <input type="date" id="per-fecha-pago">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalPeriodo()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarPeriodo()" id="btn-guardar-per">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarPeriodos();
}

async function cargarPeriodos() {
  const { data } = await _supabase
    .from('planilla_periodos')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('anio', { ascending: false })
    .order('mes',  { ascending: false });
  periodos_lista = data || [];
  _renderResumenPeriodos();
  filtrarPeriodos();
}

function _renderResumenPeriodos() {
  const pagados   = periodos_lista.filter(p => p.estado === 'PAGADO').length;
  const borradores = periodos_lista.filter(p => p.estado === 'BORRADOR').length;
  const totalNeto = periodos_lista
    .filter(p => p.estado === 'PAGADO')
    .reduce((s, p) => s + parseFloat(p.total_neto || 0), 0);
  const grid = document.getElementById('per-resumen');
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icono verde">✅</div>
      <div class="stat-info"><div class="numero">${pagados}</div><div class="etiqueta">Periodos pagados</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono amarillo">📝</div>
      <div class="stat-info"><div class="numero">${borradores}</div><div class="etiqueta">En borrador</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono azul">💰</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(totalNeto)}</div><div class="etiqueta">Total neto pagado</div></div>
    </div>`;
}

function filtrarPeriodos() {
  const anio   = document.getElementById('per-f-anio')?.value   || '';
  const mes    = document.getElementById('per-f-mes')?.value    || '';
  const tipo   = document.getElementById('per-f-tipo')?.value   || '';
  const estado = document.getElementById('per-f-estado')?.value || '';

  periodos_filtrada = periodos_lista.filter(p => {
    const matchA = !anio   || String(p.anio)   === anio;
    const matchM = !mes    || String(p.mes)     === mes;
    const matchT = !tipo   || p.tipo            === tipo;
    const matchE = !estado || p.estado          === estado;
    return matchA && matchM && matchT && matchE;
  });

  const ctr = document.getElementById('per-contador');
  if (ctr) ctr.textContent = `${periodos_filtrada.length} periodo(s)`;
  periodos_pag = 1;
  renderTablaPeriodos();
}

function limpiarFiltrosPer() {
  ['per-f-anio','per-f-mes','per-f-tipo','per-f-estado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filtrarPeriodos();
}

function renderTablaPeriodos() {
  const inicio = (periodos_pag - 1) * PER_POR_PAG;
  const pagina = periodos_filtrada.slice(inicio, inicio + PER_POR_PAG);
  const tbody  = document.getElementById('tbody-periodos');
  if (!tbody) return;

  tbody.innerHTML = pagina.length ? pagina.map(p => `
    <tr>
      <td><strong>${p.anio}</strong></td>
      <td>${MESES_NOMBRE[p.mes] || p.mes}</td>
      <td><span class="badge badge-primario" style="font-size:11px">${TIPO_PERIODO_LABEL[p.tipo] || p.tipo}</span></td>
      <td><span class="badge ${ESTADO_PERIODO_BADGE[p.estado] || 'badge-info'}" style="font-size:11px">${p.estado}</span></td>
      <td class="text-right">${p.total_remuneraciones ? formatearMoneda(p.total_remuneraciones) : '<span class="text-muted">—</span>'}</td>
      <td class="text-right">${p.total_descuentos    ? formatearMoneda(p.total_descuentos)    : '<span class="text-muted">—</span>'}</td>
      <td class="text-right"><strong>${p.total_neto ? formatearMoneda(p.total_neto) : '<span class="text-muted">—</span>'}</strong></td>
      <td class="text-sm">${p.fecha_pago ? formatearFecha(p.fecha_pago) : '<span class="text-muted">—</span>'}</td>
      <td>
        <button class="btn-icono" onclick="abrirModalPeriodo('${p.id}')" title="Editar">✏️</button>
        <button class="btn btn-secundario btn-sm" onclick="irADetalle('${p.id}')" title="Ver / calcular detalle">🧮 Ver</button>
        <button class="btn-icono peligro" onclick="eliminarPeriodo('${p.id}')" title="Eliminar">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="9" class="text-center text-muted">Sin periodos registrados</td></tr>';

  const total = periodos_filtrada.length;
  const pags  = Math.ceil(total / PER_POR_PAG);
  const pagEl = document.getElementById('pag-periodos');
  if (pagEl) pagEl.innerHTML = total > PER_POR_PAG ? `
    <span class="pag-info">${inicio + 1}–${Math.min(inicio + PER_POR_PAG, total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagPer(-1)" ${periodos_pag <= 1 ? 'disabled' : ''}>‹</button>
    <span>${periodos_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagPer(1)"  ${periodos_pag >= pags ? 'disabled' : ''}>›</button>` : '';
}

function cambiarPagPer(dir) { periodos_pag += dir; renderTablaPeriodos(); }

function irADetalle(periodoId) {
  periodo_seleccionado_id = periodoId;
  activarTab('detalle');
}

function abrirModalPeriodo(id) {
  document.getElementById('alerta-per').classList.remove('visible');
  if (id) {
    const p = periodos_lista.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modal-per-titulo').textContent = 'Editar periodo';
    document.getElementById('per-id').value         = p.id;
    document.getElementById('per-anio').value        = p.anio;
    document.getElementById('per-mes').value         = p.mes;
    document.getElementById('per-tipo').value        = p.tipo;
    document.getElementById('per-estado').value      = p.estado;
    document.getElementById('per-fecha-pago').value  = p.fecha_pago || '';
  } else {
    document.getElementById('modal-per-titulo').textContent = 'Nuevo periodo';
    document.getElementById('per-id').value         = '';
    const hoy = new Date();
    document.getElementById('per-anio').value        = hoy.getFullYear();
    document.getElementById('per-mes').value         = hoy.getMonth() + 1;
    document.getElementById('per-tipo').value        = 'MENSUAL';
    document.getElementById('per-estado').value      = 'BORRADOR';
    document.getElementById('per-fecha-pago').value  = '';
  }
  document.getElementById('modal-periodo').style.display = 'flex';
}

function cerrarModalPeriodo() {
  document.getElementById('modal-periodo').style.display = 'none';
}

async function guardarPeriodo() {
  const anio   = parseInt(document.getElementById('per-anio').value);
  const mes    = parseInt(document.getElementById('per-mes').value);
  const tipo   = document.getElementById('per-tipo').value;
  const alerta = document.getElementById('alerta-per');
  const btn    = document.getElementById('btn-guardar-per');
  alerta.classList.remove('visible');

  if (!anio || !mes) {
    alerta.textContent = 'Año y mes son obligatorios.';
    alerta.classList.add('visible');
    return;
  }

  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('per-id').value;

  const payload = {
    empresa_operadora_id: empresa_activa.id,
    anio,
    mes,
    tipo,
    estado:      document.getElementById('per-estado').value,
    fecha_pago:  document.getElementById('per-fecha-pago').value || null,
    usuario_id:  perfil_usuario?.id || null,
  };

  const { error } = id
    ? await _supabase.from('planilla_periodos').update(payload).eq('id', id)
    : await _supabase.from('planilla_periodos').insert(payload);

  btn.disabled = false; btn.textContent = 'Guardar';

  if (error) {
    alerta.textContent = error.code === '23505'
      ? 'Ya existe un periodo con el mismo año, mes y tipo.'
      : error.message;
    alerta.classList.add('visible');
    return;
  }

  mostrarToast(id ? 'Periodo actualizado' : 'Periodo creado', 'exito');
  cerrarModalPeriodo();
  await cargarPeriodos();
}

async function eliminarPeriodo(id) {
  if (!await confirmar('¿Eliminar este periodo? Se eliminará también todo su detalle de planilla.')) return;
  const { error: errDet } = await _supabase
    .from('planilla_detalle')
    .delete()
    .eq('periodo_id', id);
  if (errDet) { mostrarToast('Error al eliminar detalle: ' + errDet.message, 'error'); return; }
  const { error } = await _supabase.from('planilla_periodos').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Periodo eliminado', 'exito');
  if (periodo_seleccionado_id === id) periodo_seleccionado_id = null;
  await cargarPeriodos();
}

function exportarPeriodosExcel() {
  if (!periodos_filtrada.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const rows = periodos_filtrada.map(p => ({
    Año:             p.anio,
    Mes:             MESES_NOMBRE[p.mes] || p.mes,
    Tipo:            TIPO_PERIODO_LABEL[p.tipo] || p.tipo,
    Estado:          p.estado,
    'Remuneraciones': p.total_remuneraciones || 0,
    'Total Aportes':  p.total_aportes || 0,
    'Total Descuentos': p.total_descuentos || 0,
    'Neto a Pagar':  p.total_neto || 0,
    'Fecha Pago':    p.fecha_pago || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Periodos');
  XLSX.writeFile(wb, `planilla_periodos_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
