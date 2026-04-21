// ═══════════════════════════════════════════════════════════════
// Tesorería — Movimientos
// ═══════════════════════════════════════════════════════════════

let movimientos_lista     = [];
let movimientos_filtrada  = [];
let movimientos_pag       = 1;
const MOV_POR_PAG         = 20;
let mov_cuentas           = [];
let mov_conceptos         = [];
let mov_clientes          = [];
let mov_autorizaciones    = [];
let mov_proyectos         = [];
let mov_medios_pago       = [];
let mov_tipos_op          = [];
let mov_tipos_doc         = [];

async function renderTabMovimientos(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Resumen rápido -->
      <div class="grid-3" id="mov-resumen" style="margin-bottom:20px;gap:12px"></div>

      <!-- Filtros -->
      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:10px">
          <div>
            <label class="label-filtro">Cuenta</label>
            <select id="mov-cuenta" onchange="filtrarMovimientos()" class="input-buscar w-full">
              <option value="">Todas las cuentas</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Naturaleza</label>
            <select id="mov-naturaleza" onchange="filtrarMovimientos()" class="input-buscar w-full">
              <option value="">Cargo y Abono</option>
              <option value="CARGO">Cargo</option>
              <option value="ABONO">Abono</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="mov-estado-f" onchange="filtrarMovimientos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EMITIDO">Emitido</option>
              <option value="APROBADO">Aprobado</option>
              <option value="OBSERVADO">Observado</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Desde</label>
            <input type="date" id="mov-desde" onchange="filtrarMovimientos()" class="input-buscar w-full">
          </div>
          <div>
            <label class="label-filtro">Hasta</label>
            <input type="date" id="mov-hasta" onchange="filtrarMovimientos()" class="input-buscar w-full">
          </div>
          <div>
            <label class="label-filtro">Buscar</label>
            <input type="text" id="mov-buscar" oninput="filtrarMovimientos()" class="input-buscar w-full"
                   placeholder="Descripción, Nro…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="mov-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secundario btn-sm" onclick="limpiarFiltrosMov()">🔄 Limpiar</button>
            <button class="btn btn-secundario btn-sm" onclick="exportarMovimientosExcel()">⬇ Excel</button>
            <button class="btn btn-primario btn-sm"   onclick="abrirModalMovimiento(null)">+ Nuevo</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Fecha</th><th>Cuenta</th><th>Naturaleza</th><th>Importe</th>
            <th>Descripción</th><th>Nro Operación</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-movimientos"></tbody>
        </table>
      </div>
      <div id="pag-movimientos" class="paginacion"></div>
    </div>

    <!-- Modal movimiento -->
    <div class="modal-overlay" id="modal-movimiento" style="display:none">
      <div class="modal" style="max-width:720px">
        <div class="modal-header">
          <h3 id="modal-mov-titulo">Nuevo movimiento</h3>
          <button class="modal-cerrar" onclick="cerrarModalMovimiento()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-mov" class="alerta-error"></div>
          <input type="hidden" id="mov-id">

          <p class="text-muted text-sm" style="margin-bottom:12px">📋 Datos principales</p>
          <div class="grid-2">
            <div class="campo">
              <label>Cuenta bancaria <span class="req">*</span></label>
              <select id="mov-cuenta-f"></select>
            </div>
            <div class="campo">
              <label>Fecha <span class="req">*</span></label>
              <input type="date" id="mov-fecha-f">
            </div>
            <div class="campo">
              <label>Naturaleza <span class="req">*</span></label>
              <select id="mov-naturaleza-f">
                <option value="CARGO">CARGO (salida)</option>
                <option value="ABONO">ABONO (entrada)</option>
              </select>
            </div>
            <div class="campo">
              <label>Importe <span class="req">*</span></label>
              <input type="number" id="mov-importe-f" min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="campo">
              <label>Moneda</label>
              <select id="mov-moneda-f">
                <option value="PEN">PEN — Soles</option>
                <option value="USD">USD — Dólares</option>
                <option value="EUR">EUR — Euros</option>
              </select>
            </div>
            <div class="campo">
              <label>Nro de operación</label>
              <input type="text" id="mov-nro-op" placeholder="Código de operación">
            </div>
            <div class="campo col-2">
              <label>Descripción</label>
              <input type="text" id="mov-descripcion-f" placeholder="Descripción del movimiento">
            </div>
          </div>

          <p class="text-muted text-sm" style="margin:14px 0 12px">🗂️ Clasificación</p>
          <div class="grid-2">
            <div class="campo">
              <label>Tipo de operación</label>
              <select id="mov-tipo-op-f"></select>
            </div>
            <div class="campo">
              <label>Tipo de documento</label>
              <select id="mov-tipo-doc-f"></select>
            </div>
            <div class="campo">
              <label>Nro de documento</label>
              <input type="text" id="mov-nro-doc" placeholder="Serie-Número">
            </div>
            <div class="campo">
              <label>Empresa cliente/proveedor</label>
              <select id="mov-cliente-f"></select>
            </div>
            <div class="campo">
              <label>Concepto</label>
              <select id="mov-concepto-f"></select>
            </div>
            <div class="campo">
              <label>Autorización</label>
              <select id="mov-autorizacion-f"></select>
            </div>
            <div class="campo">
              <label>Proyecto</label>
              <select id="mov-proyecto-f"></select>
            </div>
            <div class="campo">
              <label>Medio de pago</label>
              <select id="mov-mediopago-f"></select>
            </div>
          </div>

          <p class="text-muted text-sm" style="margin:14px 0 12px">💰 Impuestos y detracción</p>
          <div class="grid-2">
            <div class="campo" style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="mov-tiene-igv" onchange="toggleIGV()" style="width:auto">
              <label style="margin:0">Tiene IGV</label>
            </div>
            <div id="mov-igv-campos" style="display:none;grid-column:span 2">
              <div class="grid-2">
                <div class="campo">
                  <label>Base imponible</label>
                  <input type="number" id="mov-base-imponible" min="0" step="0.01" oninput="calcularIGV()" placeholder="0.00">
                </div>
                <div class="campo">
                  <label>IGV (18%)</label>
                  <input type="number" id="mov-igv-monto" min="0" step="0.01" placeholder="0.00" readonly style="background:var(--color-bg-alt,#f7fafc)">
                </div>
              </div>
            </div>
            <div class="campo" style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="mov-tiene-detrac" onchange="toggleDetraccion()" style="width:auto">
              <label style="margin:0">Tiene detracción</label>
            </div>
            <div id="mov-detrac-campos" style="display:none;grid-column:span 2">
              <div class="grid-2">
                <div class="campo">
                  <label>Código detracción</label>
                  <input type="text" id="mov-cod-detrac" placeholder="Código SUNAT">
                </div>
                <div class="campo">
                  <label>% Detracción</label>
                  <input type="number" id="mov-pct-detrac" min="0" max="100" step="0.01" oninput="calcularDetraccion()" placeholder="0.00">
                </div>
                <div class="campo">
                  <label>Monto detracción</label>
                  <input type="number" id="mov-mto-detrac" min="0" step="0.01" placeholder="0.00">
                </div>
              </div>
            </div>
          </div>

          <p class="text-muted text-sm" style="margin:14px 0 12px">📌 Estado</p>
          <div class="grid-2">
            <div class="campo">
              <label>Estado</label>
              <select id="mov-estado-modal">
                <option value="PENDIENTE">Pendiente</option>
                <option value="EMITIDO">Emitido</option>
                <option value="APROBADO">Aprobado</option>
                <option value="OBSERVADO">Observado</option>
                <option value="EN_SIMULACION">En simulación</option>
                <option value="REQUIERE_RH">Requiere RR.HH.</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div class="campo">
              <label>Observaciones</label>
              <input type="text" id="mov-obs" placeholder="Observaciones adicionales">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalMovimiento()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarMovimiento()" id="btn-guardar-mov">Guardar</button>
        </div>
      </div>
    </div>`;

  await Promise.all([
    cargarMovimientos(),
    cargarCuentasParaMov(),
    cargarCatalogosParaMov(),
  ]);
  _renderResumenMov();
}

async function cargarMovimientos() {
  const { data } = await _supabase
    .from('movimientos')
    .select('*, cuentas_bancarias(nombre_alias)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('fecha', { ascending: false })
    .limit(500);
  movimientos_lista = data || [];
  filtrarMovimientos();
}

async function cargarCuentasParaMov() {
  const { data } = await _supabase
    .from('cuentas_bancarias')
    .select('id, nombre_alias, moneda')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('activo', true)
    .order('nombre_alias');
  mov_cuentas = data || [];
  const sel = document.getElementById('mov-cuenta');
  if (sel) {
    sel.innerHTML = '<option value="">Todas las cuentas</option>' +
      mov_cuentas.map(c => `<option value="${c.id}">${escapar(c.nombre_alias)} (${c.moneda})</option>`).join('');
  }
}

async function cargarCatalogosParaMov() {
  const eid = empresa_activa.id;
  const [resConceptos, resClientes, resAut, resPro, resMp, resTiposOp, resTiposDoc] = await Promise.all([
    _supabase.from('conceptos').select('id,nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('empresas_clientes').select('id,nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('autorizaciones').select('id,nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('proyectos').select('id,nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('medios_pago').select('id,nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('catalogo_tipos_operacion').select('codigo,nombre').eq('activo', true).order('nombre'),
    _supabase.from('catalogo_tipos_documento').select('codigo,nombre').eq('activo', true).order('nombre'),
  ]);
  mov_conceptos      = resConceptos.data || [];
  mov_clientes       = resClientes.data || [];
  mov_autorizaciones = resAut.data || [];
  mov_proyectos      = resPro.data || [];
  mov_medios_pago    = resMp.data || [];
  mov_tipos_op       = resTiposOp.data || [];
  mov_tipos_doc      = resTiposDoc.data || [];
}

function _renderResumenMov() {
  const cargos = movimientos_lista.filter(m => m.naturaleza === 'CARGO' && m.moneda === 'PEN')
    .reduce((s, m) => s + parseFloat(m.importe || 0), 0);
  const abonos = movimientos_lista.filter(m => m.naturaleza === 'ABONO' && m.moneda === 'PEN')
    .reduce((s, m) => s + parseFloat(m.importe || 0), 0);
  const pendientes = movimientos_lista.filter(m => m.estado === 'PENDIENTE').length;
  const grid = document.getElementById('mov-resumen');
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icono rojo">📤</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(cargos)}</div><div class="etiqueta">Cargos (PEN)</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono verde">📥</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(abonos)}</div><div class="etiqueta">Abonos (PEN)</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono amarillo">⏳</div>
      <div class="stat-info"><div class="numero">${pendientes}</div><div class="etiqueta">Pendientes</div></div>
    </div>`;
}

function filtrarMovimientos() {
  const q        = (document.getElementById('mov-buscar')?.value || '').toLowerCase();
  const cuenta   = document.getElementById('mov-cuenta')?.value || '';
  const nat      = document.getElementById('mov-naturaleza')?.value || '';
  const estado   = document.getElementById('mov-estado-f')?.value || '';
  const desde    = document.getElementById('mov-desde')?.value || '';
  const hasta    = document.getElementById('mov-hasta')?.value || '';

  movimientos_filtrada = movimientos_lista.filter(m => {
    const matchQ  = !q || (m.descripcion||'').toLowerCase().includes(q) || (m.numero_operacion||'').includes(q);
    const matchC  = !cuenta  || m.cuenta_bancaria_id === cuenta;
    const matchN  = !nat     || m.naturaleza === nat;
    const matchE  = !estado  || m.estado === estado;
    const matchD  = !desde   || m.fecha >= desde;
    const matchH  = !hasta   || m.fecha <= hasta;
    return matchQ && matchC && matchN && matchE && matchD && matchH;
  });

  const ctr = document.getElementById('mov-contador');
  if (ctr) ctr.textContent = `${movimientos_filtrada.length} registro(s)`;
  movimientos_pag = 1;
  renderTablaMovimientos();
}

function limpiarFiltrosMov() {
  ['mov-buscar','mov-desde','mov-hasta'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['mov-cuenta','mov-naturaleza','mov-estado-f'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  filtrarMovimientos();
}

function renderTablaMovimientos() {
  const inicio = (movimientos_pag - 1) * MOV_POR_PAG;
  const pagina = movimientos_filtrada.slice(inicio, inicio + MOV_POR_PAG);
  const tbody  = document.getElementById('tbody-movimientos');
  if (!tbody) return;

  const colores = {
    PENDIENTE: 'badge-warning', EMITIDO: 'badge-info', APROBADO: 'badge-activo',
    OBSERVADO: 'badge-warning', ANULADO: 'badge-inactivo', EN_SIMULACION: 'badge-info',
    REQUIERE_RH: 'badge-warning',
  };

  tbody.innerHTML = pagina.length ? pagina.map(m => `
    <tr>
      <td>${formatearFecha(m.fecha)}</td>
      <td class="text-sm">${escapar(m.cuentas_bancarias?.nombre_alias || '—')}</td>
      <td><span class="badge ${m.naturaleza === 'CARGO' ? 'badge-critico' : 'badge-activo'}" style="font-size:11px">${m.naturaleza}</span></td>
      <td class="text-right ${m.naturaleza === 'CARGO' ? 'text-rojo' : 'text-verde'}">
        ${m.naturaleza === 'CARGO' ? '−' : '+'}${formatearMoneda(m.importe, m.moneda)}
      </td>
      <td class="text-sm">${escapar((m.descripcion||'').slice(0,45))}${(m.descripcion||'').length>45?'…':''}</td>
      <td class="text-mono text-sm">${escapar(m.numero_operacion || '—')}</td>
      <td><span class="badge ${colores[m.estado] || 'badge-info'}" style="font-size:11px">${m.estado}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalMovimiento('${m.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarMovimiento('${m.id}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="8" class="text-center text-muted">Sin movimientos</td></tr>';

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

function toggleIGV() {
  const checked = document.getElementById('mov-tiene-igv')?.checked;
  const campos  = document.getElementById('mov-igv-campos');
  if (campos) campos.style.display = checked ? 'contents' : 'none';
}
function calcularIGV() {
  const base = parseFloat(document.getElementById('mov-base-imponible')?.value) || 0;
  const igv  = document.getElementById('mov-igv-monto');
  if (igv) igv.value = (base * 0.18).toFixed(2);
}
function toggleDetraccion() {
  const checked = document.getElementById('mov-tiene-detrac')?.checked;
  const campos  = document.getElementById('mov-detrac-campos');
  if (campos) campos.style.display = checked ? 'contents' : 'none';
}
function calcularDetraccion() {
  const imp = parseFloat(document.getElementById('mov-importe-f')?.value) || 0;
  const pct = parseFloat(document.getElementById('mov-pct-detrac')?.value) || 0;
  const mto = document.getElementById('mov-mto-detrac');
  if (mto) mto.value = (imp * pct / 100).toFixed(2);
}

function _poblarSelectsMov(registro) {
  const opc = (arr, campo, labelCampo) => '<option value="">— Sin selección —</option>' +
    arr.map(x => `<option value="${x[campo]}" ${registro && registro[campo+'_id'] === x[campo] ? 'selected' : ''}>${escapar(x[labelCampo])}</option>`).join('');

  const sets = [
    ['mov-cuenta-f',      mov_cuentas,      'id',     'nombre_alias'],
    ['mov-tipo-op-f',     mov_tipos_op,     'codigo', 'nombre'],
    ['mov-tipo-doc-f',    mov_tipos_doc,    'codigo', 'nombre'],
    ['mov-cliente-f',     mov_clientes,     'id',     'nombre'],
    ['mov-concepto-f',    mov_conceptos,    'id',     'nombre'],
    ['mov-autorizacion-f',mov_autorizaciones,'id',    'nombre'],
    ['mov-proyecto-f',    mov_proyectos,    'id',     'nombre'],
    ['mov-mediopago-f',   mov_medios_pago,  'id',     'nombre'],
  ];
  sets.forEach(([selId, arr, valF, labF]) => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Sin selección —</option>' +
      arr.map(x => `<option value="${x[valF]}">${escapar(x[labF])}</option>`).join('');
  });
  if (registro) {
    setTimeout(() => {
      const mapa = {
        'mov-cuenta-f': registro.cuenta_bancaria_id,
        'mov-tipo-op-f': registro.tipo_operacion_codigo,
        'mov-tipo-doc-f': registro.tipo_documento_codigo,
        'mov-cliente-f': registro.empresa_cliente_id,
        'mov-concepto-f': registro.concepto_id,
        'mov-autorizacion-f': registro.autorizacion_id,
        'mov-proyecto-f': registro.proyecto_id,
        'mov-mediopago-f': registro.medio_pago_id,
      };
      Object.entries(mapa).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
      });
    }, 50);
  }
}

function abrirModalMovimiento(id) {
  document.getElementById('alerta-mov').classList.remove('visible');
  document.getElementById('mov-igv-campos').style.display   = 'none';
  document.getElementById('mov-detrac-campos').style.display = 'none';

  if (id) {
    const m = movimientos_lista.find(x => x.id === id);
    if (!m) return;
    document.getElementById('modal-mov-titulo').textContent = 'Editar movimiento';
    document.getElementById('mov-id').value            = m.id;
    document.getElementById('mov-fecha-f').value       = m.fecha;
    document.getElementById('mov-naturaleza-f').value  = m.naturaleza;
    document.getElementById('mov-importe-f').value     = m.importe;
    document.getElementById('mov-moneda-f').value      = m.moneda;
    document.getElementById('mov-nro-op').value        = m.numero_operacion || '';
    document.getElementById('mov-descripcion-f').value = m.descripcion || '';
    document.getElementById('mov-nro-doc').value       = m.numero_documento || '';
    document.getElementById('mov-estado-modal').value  = m.estado;
    document.getElementById('mov-obs').value           = m.observaciones || '';
    document.getElementById('mov-tiene-igv').checked   = m.tiene_igv;
    document.getElementById('mov-tiene-detrac').checked = m.tiene_detraccion;
    if (m.tiene_igv) {
      document.getElementById('mov-igv-campos').style.display = 'contents';
      document.getElementById('mov-base-imponible').value     = m.base_imponible || '';
      document.getElementById('mov-igv-monto').value          = m.igv || '';
    }
    if (m.tiene_detraccion) {
      document.getElementById('mov-detrac-campos').style.display = 'contents';
      document.getElementById('mov-cod-detrac').value  = m.codigo_detraccion || '';
      document.getElementById('mov-pct-detrac').value  = m.porcentaje_detraccion || '';
      document.getElementById('mov-mto-detrac').value  = m.monto_detraccion || '';
    }
    _poblarSelectsMov(m);
  } else {
    document.getElementById('modal-mov-titulo').textContent = 'Nuevo movimiento';
    document.getElementById('mov-id').value            = '';
    document.getElementById('mov-fecha-f').value       = new Date().toISOString().slice(0,10);
    document.getElementById('mov-naturaleza-f').value  = 'CARGO';
    document.getElementById('mov-importe-f').value     = '';
    document.getElementById('mov-moneda-f').value      = 'PEN';
    document.getElementById('mov-nro-op').value        = '';
    document.getElementById('mov-descripcion-f').value = '';
    document.getElementById('mov-nro-doc').value       = '';
    document.getElementById('mov-estado-modal').value  = 'PENDIENTE';
    document.getElementById('mov-obs').value           = '';
    document.getElementById('mov-tiene-igv').checked   = false;
    document.getElementById('mov-tiene-detrac').checked = false;
    _poblarSelectsMov(null);
  }
  document.getElementById('modal-movimiento').style.display = 'flex';
}
function cerrarModalMovimiento() { document.getElementById('modal-movimiento').style.display = 'none'; }

async function guardarMovimiento() {
  const fecha    = document.getElementById('mov-fecha-f').value;
  const importe  = parseFloat(document.getElementById('mov-importe-f').value);
  const cuenta   = document.getElementById('mov-cuenta-f').value;
  const alerta   = document.getElementById('alerta-mov');
  const btn      = document.getElementById('btn-guardar-mov');
  alerta.classList.remove('visible');
  if (!fecha)       { alerta.textContent = 'La fecha es obligatoria.';    alerta.classList.add('visible'); return; }
  if (!importe || importe <= 0) { alerta.textContent = 'Ingresa un importe válido.'; alerta.classList.add('visible'); return; }
  if (!cuenta)      { alerta.textContent = 'Selecciona una cuenta.';      alerta.classList.add('visible'); return; }

  btn.disabled = true; btn.textContent = 'Guardando…';
  const id       = document.getElementById('mov-id').value;
  const tieneIGV = document.getElementById('mov-tiene-igv').checked;
  const tieneD   = document.getElementById('mov-tiene-detrac').checked;

  const payload = {
    empresa_operadora_id:    empresa_activa.id,
    cuenta_bancaria_id:      cuenta || null,
    fecha,
    naturaleza:              document.getElementById('mov-naturaleza-f').value,
    importe,
    moneda:                  document.getElementById('mov-moneda-f').value,
    numero_operacion:        document.getElementById('mov-nro-op').value.trim() || null,
    descripcion:             document.getElementById('mov-descripcion-f').value.trim() || null,
    tipo_operacion_codigo:   document.getElementById('mov-tipo-op-f').value || null,
    tipo_documento_codigo:   document.getElementById('mov-tipo-doc-f').value || null,
    numero_documento:        document.getElementById('mov-nro-doc').value.trim() || null,
    empresa_cliente_id:      document.getElementById('mov-cliente-f').value || null,
    concepto_id:             document.getElementById('mov-concepto-f').value || null,
    autorizacion_id:         document.getElementById('mov-autorizacion-f').value || null,
    proyecto_id:             document.getElementById('mov-proyecto-f').value || null,
    medio_pago_id:           document.getElementById('mov-mediopago-f').value || null,
    tiene_igv:               tieneIGV,
    base_imponible:          tieneIGV ? (parseFloat(document.getElementById('mov-base-imponible').value) || null) : null,
    igv:                     tieneIGV ? (parseFloat(document.getElementById('mov-igv-monto').value) || null) : null,
    tiene_detraccion:        tieneD,
    codigo_detraccion:       tieneD ? (document.getElementById('mov-cod-detrac').value || null) : null,
    porcentaje_detraccion:   tieneD ? (parseFloat(document.getElementById('mov-pct-detrac').value) || null) : null,
    monto_detraccion:        tieneD ? (parseFloat(document.getElementById('mov-mto-detrac').value) || null) : null,
    estado:                  document.getElementById('mov-estado-modal').value,
    observaciones:           document.getElementById('mov-obs').value.trim() || null,
    usuario_id:              perfil_usuario?.id || null,
  };

  const { error } = id
    ? await _supabase.from('movimientos').update(payload).eq('id', id)
    : await _supabase.from('movimientos').insert(payload);

  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Movimiento actualizado' : 'Movimiento registrado', 'exito');
  cerrarModalMovimiento();
  await cargarMovimientos();
  _renderResumenMov();
}

async function eliminarMovimiento(id) {
  if (!await confirmar('¿Eliminar este movimiento?')) return;
  const { error } = await _supabase.from('movimientos').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarMovimientos();
}

function exportarMovimientosExcel() {
  if (!movimientos_filtrada.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const rows = movimientos_filtrada.map(m => ({
    Fecha:      m.fecha,
    Cuenta:     m.cuentas_bancarias?.nombre_alias || '',
    Naturaleza: m.naturaleza,
    Importe:    m.importe,
    Moneda:     m.moneda,
    Descripción: m.descripcion || '',
    'Nro Operación': m.numero_operacion || '',
    Estado:     m.estado,
    'Base Imponible': m.base_imponible || '',
    IGV:        m.igv || '',
    'Tiene Detracción': m.tiene_detraccion ? 'Sí' : 'No',
    'Monto Detracción': m.monto_detraccion || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, `movimientos_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
