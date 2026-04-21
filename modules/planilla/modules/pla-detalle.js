// ═══════════════════════════════════════════════════════════════
// Planilla — Detalle / Cálculo
// ═══════════════════════════════════════════════════════════════

let periodo_seleccionado_id = null;
let detalle_lista           = [];
let detalle_periodo_info    = null;

const UIT = 5350;
const AFP_TASA = 0.1023;
const ONP_TASA = 0.13;
const ESSALUD_TASA = 0.09;
const SENATI_TASA  = 0.0075;

async function renderTabDetalle(area) {
  if (!periodo_seleccionado_id) {
    area.innerHTML = `
      <div class="fadeIn">
        <div class="card" style="padding:48px;text-align:center">
          <div style="font-size:48px;margin-bottom:16px">📅</div>
          <h3 style="margin-bottom:8px">Sin periodo seleccionado</h3>
          <p class="text-muted" style="margin-bottom:20px">Ve a la pestaña <strong>Periodos</strong> y pulsa <strong>🧮 Ver</strong> en el periodo que deseas calcular.</p>
          <button class="btn btn-primario" onclick="activarTab('periodos')">Ir a Periodos</button>
        </div>
      </div>`;
    return;
  }

  area.innerHTML = `<div class="cargando"><div class="spinner"></div><span>Cargando detalle…</span></div>`;

  await Promise.all([
    _cargarInfoPeriodo(),
    _cargarDetalles(),
  ]);

  if (!detalle_periodo_info) {
    area.innerHTML = `<div class="card" style="padding:32px;text-align:center">
      <p class="text-muted">No se encontró el periodo seleccionado.</p>
      <button class="btn btn-secundario" onclick="activarTab('periodos')">Volver a Periodos</button>
    </div>`;
    return;
  }

  _renderDetalleCompleto(area);
}

async function _cargarInfoPeriodo() {
  const { data } = await _supabase
    .from('planilla_periodos')
    .select('*')
    .eq('id', periodo_seleccionado_id)
    .single();
  detalle_periodo_info = data || null;
}

async function _cargarDetalles() {
  const { data } = await _supabase
    .from('planilla_detalle')
    .select(`
      *,
      trabajadores (
        id, nombre, apellido_paterno, apellido_materno, cargo, afp, dni
      )
    `)
    .eq('periodo_id', periodo_seleccionado_id)
    .order('trabajadores(apellido_paterno)');
  detalle_lista = data || [];
}

function _renderDetalleCompleto(area) {
  const p = detalle_periodo_info;
  const estadoBadge = {
    BORRADOR:   'badge-warning',
    CALCULADO:  'badge-info',
    PAGADO:     'badge-activo',
    ANULADO:    'badge-inactivo',
  };
  const tipoLabel = {
    MENSUAL:      'Mensual',
    QUINCENAL_1:  '1ra Quincena',
    QUINCENAL_2:  '2da Quincena',
    GRATIFICACION:'Gratificación',
    CTS:          'CTS',
    LIQUIDACION:  'Liquidación',
  };
  const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const puedeCalcular = p.estado === 'BORRADOR' || p.estado === 'CALCULADO';

  area.innerHTML = `
    <div class="fadeIn">

      <!-- Info del periodo -->
      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <button class="btn btn-secundario btn-sm" onclick="activarTab('periodos')">← Volver</button>
            <div>
              <h3 style="margin:0">${meses[p.mes]} ${p.anio} — ${tipoLabel[p.tipo] || p.tipo}</h3>
              <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
                <span class="badge ${estadoBadge[p.estado] || 'badge-info'}">${p.estado}</span>
                ${p.fecha_pago ? `<span class="text-sm text-muted">F. pago: ${formatearFecha(p.fecha_pago)}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${puedeCalcular ? `<button class="btn btn-primario btn-sm" onclick="calcularPlanilla()" id="btn-calcular">🧮 Generar / Calcular planilla</button>` : ''}
            <button class="btn btn-secundario btn-sm" onclick="exportarDetalleExcel()">⬇ Excel</button>
          </div>
        </div>

        <!-- Totales resumen -->
        <div class="grid-3" id="det-totales" style="margin-top:16px;gap:12px">
          ${_htmlTotales(p)}
        </div>
      </div>

      <!-- Tabla detalle -->
      <div class="table-wrap">
        <table class="tabla" style="font-size:12px">
          <thead><tr>
            <th>Trabajador</th>
            <th class="text-center">Días</th>
            <th class="text-right">Sueldo base</th>
            <th class="text-right">Rem. Bruta</th>
            <th class="text-right">AFP / ONP</th>
            <th class="text-right">Renta 5ta</th>
            <th class="text-right">Otros desc.</th>
            <th class="text-right">Rem. Neta</th>
            <th class="text-right">Ap. EsSalud</th>
            <th class="text-center">Pagado</th>
            <th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-detalle"></tbody>
        </table>
      </div>
      <div id="det-sin-datos" style="display:none" class="card" style="padding:32px;text-align:center;margin-top:16px">
        <p class="text-muted">Sin registros. Pulsa <strong>🧮 Generar / Calcular planilla</strong> para calcular los datos del periodo.</p>
      </div>
    </div>

    <!-- Modal pago individual -->
    <div class="modal-overlay" id="modal-pago-det" style="display:none">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3>Registrar pago</h3>
          <button class="modal-cerrar" onclick="cerrarModalPagoDet()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-pago-det" class="alerta-error"></div>
          <input type="hidden" id="pago-det-id">
          <div class="grid-2">
            <div class="campo col-2">
              <label>Fecha de pago <span class="req">*</span></label>
              <input type="date" id="pago-det-fecha">
            </div>
            <div class="campo col-2">
              <label>Número de operación</label>
              <input type="text" id="pago-det-nro" placeholder="Código de transferencia">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalPagoDet()">Cancelar</button>
          <button class="btn btn-primario"   onclick="confirmarPagoDet()" id="btn-confirmar-pago">Confirmar pago</button>
        </div>
      </div>
    </div>

    <!-- Modal editar fila detalle -->
    <div class="modal-overlay" id="modal-editar-det" style="display:none">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3 id="modal-edit-det-titulo">Editar detalle</h3>
          <button class="modal-cerrar" onclick="cerrarModalEditarDet()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-edit-det" class="alerta-error"></div>
          <input type="hidden" id="edit-det-id">
          <div class="grid-2">
            <div class="campo">
              <label>Días trabajados</label>
              <input type="number" id="edit-det-dias" min="0" max="31" step="1" oninput="recalcularFilaEdit()">
            </div>
            <div class="campo">
              <label>Sueldo base (S/.)</label>
              <input type="number" id="edit-det-sueldo" min="0" step="0.01" oninput="recalcularFilaEdit()">
            </div>
            <div class="campo">
              <label>Otros descuentos (S/.)</label>
              <input type="number" id="edit-det-otros-desc" min="0" step="0.01" oninput="recalcularFilaEdit()">
            </div>
            <div class="campo">
              <label>Rem. Bruta (calculada)</label>
              <input type="number" id="edit-det-bruta" readonly style="background:var(--color-bg-alt,#f7fafc)">
            </div>
            <div class="campo">
              <label>Desc. AFP / ONP</label>
              <input type="number" id="edit-det-afp-onp" readonly style="background:var(--color-bg-alt,#f7fafc)">
            </div>
            <div class="campo">
              <label>Renta 5ta categoría</label>
              <input type="number" id="edit-det-renta" readonly style="background:var(--color-bg-alt,#f7fafc)">
            </div>
            <div class="campo">
              <label>Rem. Neta (calculada)</label>
              <input type="number" id="edit-det-neta" readonly style="background:var(--color-bg-alt,#f7fafc)">
            </div>
            <div class="campo">
              <label>Aporte EsSalud (empleador)</label>
              <input type="number" id="edit-det-essalud" readonly style="background:var(--color-bg-alt,#f7fafc)">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalEditarDet()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarEditarDet()" id="btn-guardar-edit-det">Guardar</button>
        </div>
      </div>
    </div>`;

  renderTablaDetalle();
}

function _htmlTotales(p) {
  const totalRem  = parseFloat(p.total_remuneraciones || 0);
  const totalDesc = parseFloat(p.total_descuentos || 0);
  const totalNeto = parseFloat(p.total_neto || 0);
  const totalAp   = parseFloat(p.total_aportes || 0);
  return `
    <div class="stat-card">
      <div class="stat-icono azul">💵</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(totalRem)}</div><div class="etiqueta">Total rem. brutas</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono rojo">📉</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(totalDesc)}</div><div class="etiqueta">Total descuentos</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono verde">✅</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(totalNeto)}</div><div class="etiqueta">Total neto a pagar</div></div>
    </div>`;
}

function renderTablaDetalle() {
  const tbody = document.getElementById('tbody-detalle');
  const sinDatos = document.getElementById('det-sin-datos');
  if (!tbody) return;

  if (!detalle_lista.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted" style="padding:32px">Sin registros. Usa "🧮 Generar / Calcular planilla" para generar el detalle.</td></tr>';
    return;
  }

  tbody.innerHTML = detalle_lista.map(d => {
    const t = d.trabajadores || {};
    const nombreCompleto = [t.apellido_paterno, t.apellido_materno, t.nombre].filter(Boolean).join(' ');
    const tieneAfp = d.descuento_afp > 0;
    const descSistema = tieneAfp ? d.descuento_afp : d.descuento_onp;
    const labelSistema = tieneAfp ? 'AFP' : 'ONP';
    return `
      <tr>
        <td>
          <div><strong>${escapar(nombreCompleto)}</strong></div>
          <div class="text-muted text-sm">${escapar(t.cargo || '')} ${t.afp ? '· ' + t.afp : '· ONP'}</div>
        </td>
        <td class="text-center">${d.dias_trabajados}</td>
        <td class="text-right">${formatearMoneda(d.sueldo_base)}</td>
        <td class="text-right">${formatearMoneda(d.remuneracion_bruta)}</td>
        <td class="text-right">
          <span class="badge badge-info" style="font-size:10px">${labelSistema}</span>
          ${formatearMoneda(descSistema)}
        </td>
        <td class="text-right">${d.descuento_renta5ta > 0 ? formatearMoneda(d.descuento_renta5ta) : '<span class="text-muted">—</span>'}</td>
        <td class="text-right">${d.otros_descuentos > 0 ? formatearMoneda(d.otros_descuentos) : '<span class="text-muted">—</span>'}</td>
        <td class="text-right"><strong>${formatearMoneda(d.remuneracion_neta)}</strong></td>
        <td class="text-right text-sm">${formatearMoneda(d.aporte_essalud)}</td>
        <td class="text-center">
          ${d.pagado
            ? `<span class="badge badge-activo" style="font-size:11px">✓ Pagado</span>`
            : `<span class="badge badge-warning" style="font-size:11px">Pendiente</span>`}
        </td>
        <td>
          <button class="btn-icono" onclick="abrirModalEditarDet('${d.id}')" title="Editar">✏️</button>
          ${!d.pagado
            ? `<button class="btn-icono" onclick="abrirModalPagoDet('${d.id}')" title="Marcar pagado" style="color:var(--color-exito)">💸</button>`
            : `<button class="btn-icono peligro" onclick="desmarcarPagado('${d.id}')" title="Revertir pago">↩️</button>`}
          <button class="btn-icono peligro" onclick="eliminarDetalle('${d.id}')" title="Eliminar">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

// ── Cálculo de planilla ────────────────────────────────────────

async function calcularPlanilla() {
  const btn = document.getElementById('btn-calcular');
  if (!btn) return;

  if (!await confirmar('¿Calcular la planilla? Se sobrescribirán los datos actuales del periodo.', { btnOk: 'Calcular', btnColor: '#2C5282' })) return;

  btn.disabled = true; btn.textContent = '⏳ Calculando…';

  const { data: trabajadores, error: errTrab } = await _supabase
    .from('trabajadores')
    .select('id, nombre, apellido_paterno, apellido_materno, cargo, tipo_contrato, sueldo_base, afp')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('tipo_contrato', 'PLANILLA')
    .eq('activo', true);

  if (errTrab) {
    mostrarToast('Error al cargar trabajadores: ' + errTrab.message, 'error');
    btn.disabled = false; btn.textContent = '🧮 Generar / Calcular planilla';
    return;
  }

  if (!trabajadores || !trabajadores.length) {
    mostrarToast('No hay trabajadores en planilla activos.', 'atencion');
    btn.disabled = false; btn.textContent = '🧮 Generar / Calcular planilla';
    return;
  }

  const filas = trabajadores.map(t => _calcularFila(t, 30));

  const { error: errDel } = await _supabase
    .from('planilla_detalle')
    .delete()
    .eq('periodo_id', periodo_seleccionado_id);

  if (errDel) {
    mostrarToast('Error al limpiar detalle previo: ' + errDel.message, 'error');
    btn.disabled = false; btn.textContent = '🧮 Generar / Calcular planilla';
    return;
  }

  const { error: errIns } = await _supabase
    .from('planilla_detalle')
    .insert(filas);

  if (errIns) {
    mostrarToast('Error al insertar detalle: ' + errIns.message, 'error');
    btn.disabled = false; btn.textContent = '🧮 Generar / Calcular planilla';
    return;
  }

  await _actualizarTotalesPeriodo();
  await Promise.all([_cargarInfoPeriodo(), _cargarDetalles()]);

  const area = document.getElementById('contenido-tab');
  _renderDetalleCompleto(area);
  mostrarToast(`Planilla calculada: ${filas.length} trabajador(es)`, 'exito');
}

function _calcularFila(trabajador, diasTrabajados) {
  const sueldo = parseFloat(trabajador.sueldo_base || 0);
  const bruta  = sueldo * (diasTrabajados / 30);

  const tieneAfp = !!(trabajador.afp);
  const descAfp  = tieneAfp ? +(bruta * AFP_TASA).toFixed(2) : 0;
  const descOnp  = tieneAfp ? 0 : +(bruta * ONP_TASA).toFixed(2);

  const renta5ta = _calcularRenta5ta(bruta);
  const neta     = +(bruta - descAfp - descOnp - renta5ta).toFixed(2);
  const essalud  = +(bruta * ESSALUD_TASA).toFixed(2);

  return {
    periodo_id:           periodo_seleccionado_id,
    trabajador_id:        trabajador.id,
    empresa_operadora_id: empresa_activa.id,
    dias_trabajados:      diasTrabajados,
    sueldo_base:          +sueldo.toFixed(2),
    remuneracion_bruta:   +bruta.toFixed(2),
    descuento_afp:        descAfp,
    descuento_onp:        descOnp,
    descuento_essalud:    0,
    descuento_renta5ta:   renta5ta,
    otros_descuentos:     0,
    remuneracion_neta:    neta < 0 ? 0 : neta,
    aporte_essalud:       essalud,
    aporte_senati:        0,
    pagado:               false,
    fecha_pago:           null,
    numero_operacion:     null,
  };
}

function _calcularRenta5ta(sueldo_mensual) {
  const anual_proyectado = sueldo_mensual * 12;
  const uit7 = UIT * 7;
  if (anual_proyectado <= uit7) return 0;

  const renta_neta = anual_proyectado - uit7;
  let impuesto = 0;

  if (renta_neta <= UIT * 5)            impuesto = renta_neta * 0.08;
  else if (renta_neta <= UIT * 20)      impuesto = UIT * 5 * 0.08 + (renta_neta - UIT * 5) * 0.14;
  else if (renta_neta <= UIT * 35)      impuesto = UIT * 5 * 0.08 + UIT * 15 * 0.14 + (renta_neta - UIT * 20) * 0.17;
  else if (renta_neta <= UIT * 45)      impuesto = UIT * 5 * 0.08 + UIT * 15 * 0.14 + UIT * 15 * 0.17 + (renta_neta - UIT * 35) * 0.20;
  else                                   impuesto = UIT * 5 * 0.08 + UIT * 15 * 0.14 + UIT * 15 * 0.17 + UIT * 10 * 0.20 + (renta_neta - UIT * 45) * 0.30;

  return +(impuesto / 12).toFixed(2);
}

async function _actualizarTotalesPeriodo() {
  const { data } = await _supabase
    .from('planilla_detalle')
    .select('remuneracion_bruta, descuento_afp, descuento_onp, descuento_renta5ta, otros_descuentos, remuneracion_neta, aporte_essalud, aporte_senati')
    .eq('periodo_id', periodo_seleccionado_id);

  if (!data || !data.length) return;

  const totalRem  = data.reduce((s, d) => s + parseFloat(d.remuneracion_bruta || 0), 0);
  const totalDesc = data.reduce((s, d) => s +
    parseFloat(d.descuento_afp || 0) +
    parseFloat(d.descuento_onp || 0) +
    parseFloat(d.descuento_renta5ta || 0) +
    parseFloat(d.otros_descuentos || 0), 0);
  const totalNeto = data.reduce((s, d) => s + parseFloat(d.remuneracion_neta || 0), 0);
  const totalAp   = data.reduce((s, d) => s + parseFloat(d.aporte_essalud || 0) + parseFloat(d.aporte_senati || 0), 0);

  await _supabase
    .from('planilla_periodos')
    .update({
      total_remuneraciones: +totalRem.toFixed(2),
      total_descuentos:     +totalDesc.toFixed(2),
      total_neto:           +totalNeto.toFixed(2),
      total_aportes:        +totalAp.toFixed(2),
      estado:               'CALCULADO',
    })
    .eq('id', periodo_seleccionado_id);
}

// ── Editar fila individual ─────────────────────────────────────

let _edit_det_afp_code = null;

function abrirModalEditarDet(id) {
  const d = detalle_lista.find(x => x.id === id);
  if (!d) return;
  document.getElementById('alerta-edit-det').classList.remove('visible');
  document.getElementById('modal-edit-det-titulo').textContent =
    `Editar — ${[d.trabajadores?.apellido_paterno, d.trabajadores?.nombre].filter(Boolean).join(' ')}`;
  document.getElementById('edit-det-id').value          = d.id;
  document.getElementById('edit-det-dias').value        = d.dias_trabajados;
  document.getElementById('edit-det-sueldo').value      = d.sueldo_base;
  document.getElementById('edit-det-otros-desc').value  = d.otros_descuentos || 0;
  _edit_det_afp_code = d.trabajadores?.afp || null;

  document.getElementById('edit-det-bruta').value    = d.remuneracion_bruta;
  document.getElementById('edit-det-afp-onp').value  = d.descuento_afp > 0 ? d.descuento_afp : d.descuento_onp;
  document.getElementById('edit-det-renta').value    = d.descuento_renta5ta;
  document.getElementById('edit-det-neta').value     = d.remuneracion_neta;
  document.getElementById('edit-det-essalud').value  = d.aporte_essalud;

  document.getElementById('modal-editar-det').style.display = 'flex';
}

function cerrarModalEditarDet() {
  document.getElementById('modal-editar-det').style.display = 'none';
}

function recalcularFilaEdit() {
  const dias    = parseFloat(document.getElementById('edit-det-dias').value) || 0;
  const sueldo  = parseFloat(document.getElementById('edit-det-sueldo').value) || 0;
  const otrosD  = parseFloat(document.getElementById('edit-det-otros-desc').value) || 0;

  const bruta   = +(sueldo * (dias / 30)).toFixed(2);
  const tieneAfp = !!_edit_det_afp_code;
  const afpOnp  = tieneAfp ? +(bruta * AFP_TASA).toFixed(2) : +(bruta * ONP_TASA).toFixed(2);
  const renta   = _calcularRenta5ta(bruta);
  const neta    = Math.max(0, +(bruta - afpOnp - renta - otrosD).toFixed(2));
  const essalud = +(bruta * ESSALUD_TASA).toFixed(2);

  document.getElementById('edit-det-bruta').value   = bruta;
  document.getElementById('edit-det-afp-onp').value = afpOnp;
  document.getElementById('edit-det-renta').value   = renta;
  document.getElementById('edit-det-neta').value    = neta;
  document.getElementById('edit-det-essalud').value = essalud;
}

async function guardarEditarDet() {
  const id       = document.getElementById('edit-det-id').value;
  const dias     = parseInt(document.getElementById('edit-det-dias').value) || 30;
  const sueldo   = parseFloat(document.getElementById('edit-det-sueldo').value) || 0;
  const otrosD   = parseFloat(document.getElementById('edit-det-otros-desc').value) || 0;
  const alerta   = document.getElementById('alerta-edit-det');
  const btn      = document.getElementById('btn-guardar-edit-det');
  alerta.classList.remove('visible');

  if (dias < 0 || dias > 31) {
    alerta.textContent = 'Los días deben estar entre 0 y 31.';
    alerta.classList.add('visible');
    return;
  }

  const bruta    = +(sueldo * (dias / 30)).toFixed(2);
  const tieneAfp = !!_edit_det_afp_code;
  const descAfp  = tieneAfp ? +(bruta * AFP_TASA).toFixed(2) : 0;
  const descOnp  = tieneAfp ? 0 : +(bruta * ONP_TASA).toFixed(2);
  const renta    = _calcularRenta5ta(bruta);
  const neta     = Math.max(0, +(bruta - descAfp - descOnp - renta - otrosD).toFixed(2));
  const essalud  = +(bruta * ESSALUD_TASA).toFixed(2);

  btn.disabled = true; btn.textContent = 'Guardando…';

  const { error } = await _supabase
    .from('planilla_detalle')
    .update({
      dias_trabajados:   dias,
      sueldo_base:       +sueldo.toFixed(2),
      remuneracion_bruta: bruta,
      descuento_afp:     descAfp,
      descuento_onp:     descOnp,
      descuento_renta5ta: renta,
      otros_descuentos:  +otrosD.toFixed(2),
      remuneracion_neta: neta,
      aporte_essalud:    essalud,
    })
    .eq('id', id);

  btn.disabled = false; btn.textContent = 'Guardar';

  if (error) {
    alerta.textContent = error.message;
    alerta.classList.add('visible');
    return;
  }

  mostrarToast('Detalle actualizado', 'exito');
  cerrarModalEditarDet();
  await _actualizarTotalesPeriodo();
  await Promise.all([_cargarInfoPeriodo(), _cargarDetalles()]);
  const area = document.getElementById('contenido-tab');
  _renderDetalleCompleto(area);
}

// ── Pago individual ────────────────────────────────────────────

function abrirModalPagoDet(id) {
  document.getElementById('alerta-pago-det').classList.remove('visible');
  document.getElementById('pago-det-id').value     = id;
  document.getElementById('pago-det-fecha').value  = new Date().toISOString().slice(0, 10);
  document.getElementById('pago-det-nro').value    = '';
  document.getElementById('modal-pago-det').style.display = 'flex';
}

function cerrarModalPagoDet() {
  document.getElementById('modal-pago-det').style.display = 'none';
}

async function confirmarPagoDet() {
  const id     = document.getElementById('pago-det-id').value;
  const fecha  = document.getElementById('pago-det-fecha').value;
  const nro    = document.getElementById('pago-det-nro').value.trim();
  const alerta = document.getElementById('alerta-pago-det');
  const btn    = document.getElementById('btn-confirmar-pago');
  alerta.classList.remove('visible');

  if (!fecha) {
    alerta.textContent = 'La fecha de pago es obligatoria.';
    alerta.classList.add('visible');
    return;
  }

  btn.disabled = true; btn.textContent = 'Guardando…';

  const { error } = await _supabase
    .from('planilla_detalle')
    .update({ pagado: true, fecha_pago: fecha, numero_operacion: nro || null })
    .eq('id', id);

  btn.disabled = false; btn.textContent = 'Confirmar pago';

  if (error) {
    alerta.textContent = error.message;
    alerta.classList.add('visible');
    return;
  }

  mostrarToast('Pago registrado', 'exito');
  cerrarModalPagoDet();
  await _verificarTodoPagado();
  await _cargarDetalles();
  renderTablaDetalle();
}

async function desmarcarPagado(id) {
  if (!await confirmar('¿Revertir el pago de este trabajador?', { btnOk: 'Revertir', btnColor: '#D69E2E' })) return;
  const { error } = await _supabase
    .from('planilla_detalle')
    .update({ pagado: false, fecha_pago: null, numero_operacion: null })
    .eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Pago revertido', 'exito');
  await _cargarDetalles();
  renderTablaDetalle();
}

async function _verificarTodoPagado() {
  const todoPagado = detalle_lista.every(d => d.pagado) && detalle_lista.length > 0;
  if (!todoPagado) return;
  await _supabase
    .from('planilla_periodos')
    .update({ estado: 'PAGADO' })
    .eq('id', periodo_seleccionado_id);
  await _cargarInfoPeriodo();
}

// ── Eliminar fila ──────────────────────────────────────────────

async function eliminarDetalle(id) {
  if (!await confirmar('¿Eliminar este trabajador del periodo?', { btnOk: 'Eliminar' })) return;
  const { error } = await _supabase.from('planilla_detalle').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await _actualizarTotalesPeriodo();
  await Promise.all([_cargarInfoPeriodo(), _cargarDetalles()]);
  const area = document.getElementById('contenido-tab');
  _renderDetalleCompleto(area);
}

// ── Export Excel ───────────────────────────────────────────────

function exportarDetalleExcel() {
  if (!detalle_lista.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  if (!detalle_periodo_info) return;

  const p = detalle_periodo_info;
  const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const rows = detalle_lista.map(d => {
    const t = d.trabajadores || {};
    return {
      'Trabajador':     [t.apellido_paterno, t.apellido_materno, t.nombre].filter(Boolean).join(' '),
      'DNI':            t.dni || '',
      'Cargo':          t.cargo || '',
      'AFP/ONP':        t.afp || 'ONP',
      'Días':           d.dias_trabajados,
      'Sueldo Base':    d.sueldo_base,
      'Rem. Bruta':     d.remuneracion_bruta,
      'Desc. AFP':      d.descuento_afp || 0,
      'Desc. ONP':      d.descuento_onp || 0,
      'Renta 5ta':      d.descuento_renta5ta || 0,
      'Otros Desc.':    d.otros_descuentos || 0,
      'Rem. Neta':      d.remuneracion_neta,
      'Ap. EsSalud':    d.aporte_essalud || 0,
      'Ap. SENATI':     d.aporte_senati || 0,
      'Pagado':         d.pagado ? 'Sí' : 'No',
      'Fecha Pago':     d.fecha_pago || '',
      'Nro Operación':  d.numero_operacion || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle Planilla');
  const nombreArchivo = `planilla_${meses[p.mes]}_${p.anio}_${p.tipo}_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
}
