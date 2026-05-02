// ═══════════════════════════════════════════════════════════════
// Tesorería — Movimientos (Versión Sincronizada con MBD)
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
let mov_seleccionados     = new Set();

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
          <div>
            <label class="label-filtro">FA/DOC/RH</label>
            <select id="mov-estado-doc-f" onchange="filtrarMovimientos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="EMITIDO">Emitido</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="OBSERVADO">Observado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="mov-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secundario btn-sm" onclick="limpiarFiltrosMov()">🔄 Limpiar</button>
            <button class="btn btn-secundario btn-sm" onclick="exportarMovimientosExcel()">⬇ Excel</button>
            <button class="btn btn-sm" onclick="_abrirModalEliminarMes()"
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
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:150px">Descripción</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:60px">Mon.</th>
            <th style="padding:8px 10px;text-align:right;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">Monto</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:200px">Proveedores / Empresa / Personal</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:120px">RUC / DNI</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:120px">COTIZACIÓN</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">OC</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:180px">Proyecto</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:130px">Concepto</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:160px">Empresa</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">Entrega FA/DOC</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:130px">Nª Factura o DOC.</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:90px">Tipo DOC</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:120px">Autorización</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:180px">Observaciones</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:200px">Detalles Compra / Servicio</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:180px">Observaciones 2</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:120px">Fecha Registro</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:100px">Usuario</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:80px">Acc.</th>
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
            <div class="campo">
              <label>Cotización</label>
              <input type="text" id="mov-cotizacion" placeholder="N° cotización" autocomplete="off" data-form-type="other">
            </div>
            <div class="campo">
              <label>OC (Orden de Compra)</label>
              <input type="text" id="mov-oc" placeholder="N° orden de compra" autocomplete="off" data-form-type="other">
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

          <p class="text-muted text-sm" style="margin:14px 0 12px">📌 Estado y documento</p>
          <div class="grid-2">
            <div class="campo">
              <label>Entrega FA/DOC/RH</label>
              <select id="mov-estado-doc-modal">
                <option value="PENDIENTE">Pendiente</option>
                <option value="EMITIDO">Emitido</option>
                <option value="OBSERVADO">Obsersado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <div class="campo">
              <label>Estado del movimiento</label>
              <select id="mov-estado-modal">
                <option value="PENDIENTE">Pendiente</option>
                <option value="EMITIDO">Emitido</option>
                <option value="APROBADO">Aprobado</option>
                <option value="OBSERVADO">Obsersado</option>
                <option value="EN_SIMULACION">En simulación</option>
                <option value="REQUIERE_RH">Requiere RH</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div class="campo">
              <label>Observaciones</label>
              <input type="text" id="mov-obs" placeholder="Observaciones" autocomplete="off" data-form-type="other">
            </div>
            <div class="campo col-2">
              <label>Detalles del servicio / compra</label>
              <input type="text" id="mov-detalles-servicio" placeholder="Descripción detallada del servicio o compra" autocomplete="off" data-form-type="other">
            </div>
            <div class="campo col-2">
              <label>Observaciones 2</label>
              <input type="text" id="mov-observaciones-2" placeholder="Observaciones adicionales" autocomplete="off" data-form-type="other">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalMovimiento()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarMovimiento()" id="btn-guardar-mov">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Barra flotante de selección -->
    <div id="mov-barra-seleccion" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:900;background:#1A202C;color:#fff;padding:12px 24px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;box-shadow:0 -4px 24px rgba(0,0,0,0.35);border-top:2px solid var(--color-secundario)">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">☑️</span>
        <div>
          <div id="mov-barra-count" style="font-weight:700;font-size:15px">0 seleccionados</div>
          <div id="mov-barra-monto" style="font-size:12px;opacity:.75"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="_cancelarSeleccionMov()" style="padding:8px 16px;background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">
          ✕ Cancelar selección
        </button>
        <button onclick="abrirModalEdicionMasiva()" style="padding:8px 16px;background:rgba(66,153,225,.3);color:#fff;border:1px solid rgba(66,153,225,.5);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">
          ✏️ Editar seleccionados
        </button>
        <button onclick="eliminarSeleccionadosMov()" style="padding:8px 20px;background:#C53030;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:700">
          🗑️ Eliminar seleccionados
        </button>
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
  const desde = document.getElementById('mov-desde')?.value;
  const hasta = document.getElementById('mov-hasta')?.value;
  const cuentaId = document.getElementById('mov-cuenta')?.value;

  // Lógica mejorada: Trae movimientos del periodo sin filtrar rígidamente por cuenta
  // para permitir ver los registros recién importados de MBD.
  let q = _supabase
    .from('movimientos')
    .select(`*,
      cuentas_bancarias(nombre_alias),
      empresas_clientes:empresa_cliente_id(nombre, ruc_dni),
      conceptos:concepto_id(nombre),
      autorizaciones:autorizacion_id(nombre),
      proyectos:proyecto_id(nombre),
      medios_pago:medio_pago_id(nombre),
      usuarios:usuario_id(nombre)
    `)
    .eq('empresa_operadora_id', empresa_activa.id);

  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  
  // Si hay cuenta seleccionada, traemos esa cuenta O los que no tienen cuenta (MBD)
  if (cuentaId) {
    q = q.or(`cuenta_bancaria_id.eq.${cuentaId},cuenta_bancaria_id.is.null`);
  }

  const { data } = await q.order('fecha', { ascending: true })
    .order('numero_operacion', { ascending: true })
    .limit(1000);

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
    if (mov_cuentas.length === 1) sel.value = mov_cuentas[0].id;
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
  const q         = (document.getElementById('mov-buscar')?.value || '').toLowerCase();
  const cuenta    = document.getElementById('mov-cuenta')?.value || '';
  const nat       = document.getElementById('mov-naturaleza')?.value || '';
  const estado    = document.getElementById('mov-estado-f')?.value || '';
  const estadoDoc = document.getElementById('mov-estado-doc-f')?.value || '';
  const desde     = document.getElementById('mov-desde')?.value || '';
  const hasta     = document.getElementById('mov-hasta')?.value || '';

  movimientos_filtrada = movimientos_lista.filter(m => {
    const matchQ   = !q         || (m.descripcion||'').toLowerCase().includes(q) || (m.numero_operacion||'').includes(q);
    // Ajuste aquí: si se filtra por cuenta, también mostramos los registros sin cuenta (MBD)
    const matchC   = !cuenta    || m.cuenta_bancaria_id === cuenta || m.cuenta_bancaria_id === null;
    const matchN   = !nat        || m.naturaleza === nat;
    const matchE   = !estado     || m.estado === estado;
    const matchED  = !estadoDoc || (m.estado_doc || 'PENDIENTE') === estadoDoc;
    const matchD   = !desde      || m.fecha >= desde;
    const matchH   = !hasta      || m.fecha <= hasta;
    return matchQ && matchC && matchN && matchE && matchED && matchD && matchH;
  });

  const ctr = document.getElementById('mov-contador');
  if (ctr) ctr.textContent = `${movimientos_filtrada.length} registro(s)`;
  movimientos_pag = 1;
  renderTablaMovimientos();
}

function limpiarFiltrosMov() {
  ['mov-buscar','mov-desde','mov-hasta'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['mov-cuenta','mov-naturaleza','mov-estado-f','mov-estado-doc-f'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  mov_seleccionados.clear();
  _actualizarBtnEliminarSel();
  cargarMovimientos(); // Recargamos desde DB para traer todo
}

function toggleSeleccionMov(id, checked) {
  if (checked) mov_seleccionados.add(id);
  else mov_seleccionados.delete(id);
  _actualizarBtnEliminarSel();
}

function seleccionarTodosMov(checked) {
  movimientos_filtrada.forEach(m => { if (checked) mov_seleccionados.add(m.id); else mov_seleccionados.delete(m.id); });
  document.querySelectorAll('.chk-mov').forEach(el => el.checked = checked);
  _actualizarBtnEliminarSel();
}

function _cancelarSeleccionMov() {
  mov_seleccionados.clear();
  document.querySelectorAll('.chk-mov').forEach(el => el.checked = false);
  const chkTodos = document.getElementById('chk-todos-mov');
  if (chkTodos) { chkTodos.checked = false; chkTodos.indeterminate = false; }
  _actualizarBtnEliminarSel();
}

function _actualizarBtnEliminarSel() {
  const n     = mov_seleccionados.size;
  const total = movimientos_filtrada.length;

  const barra = document.getElementById('mov-barra-seleccion');
  if (barra) barra.style.display = n > 0 ? 'flex' : 'none';
  const barraCount = document.getElementById('mov-barra-count');
  if (barraCount) barraCount.textContent = `${n} movimiento${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;

  const barraMonto = document.getElementById('mov-barra-monto');
  if (barraMonto && n > 0) {
    const sel = movimientos_lista.filter(m => mov_seleccionados.has(m.id));
    const suma = sel.reduce((s, m) => s + (m.naturaleza === 'CARGO' ? -1 : 1) * Math.abs(parseFloat(m.importe || 0)), 0);
    barraMonto.textContent = `Total seleccionado: ${formatearMoneda(Math.abs(suma), 'PEN')}`;
  }

  const chkTodos = document.getElementById('chk-todos-mov');
  if (chkTodos) {
    chkTodos.checked       = n > 0 && n >= total;
    chkTodos.indeterminate = n > 0 && n < total;
  }
}

async function eliminarSeleccionadosMov() {
  const ids = [...mov_seleccionados];
  if (!ids.length) return;
  if (!await confirmar(
    `¿Eliminar ${ids.length} movimiento${ids.length !== 1 ? 's' : ''} seleccionado${ids.length !== 1 ? 's' : ''}?\nEsta acción no se puede deshacer.`,
    { btnOk: 'Sí, eliminar', btnColor: '#C53030' }
  )) return;

  mostrarToast('Eliminando…', 'atencion');
  await _eliminarConciliacionesDe(ids);

  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await _supabase.from('movimientos').delete().in('id', ids.slice(i, i + CHUNK));
    if (error) { mostrarToast('Error al eliminar: ' + error.message, 'error'); return; }
  }

  mostrarToast(`✅ ${ids.length} movimiento${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}.`, 'exito');
  _cancelarSeleccionMov();
  await cargarMovimientos();
  _renderResumenMov();
}

function renderTablaMovimientos() {
  const inicio = (movimientos_pag - 1) * MOV_POR_PAG;
  const pagina = movimientos_filtrada.slice(inicio, inicio + MOV_POR_PAG);
  const tbody  = document.getElementById('tbody-movimientos');
  if (!tbody) return;

  const _TD = 'padding:6px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;';
  const badgeBgDoc = { PENDIENTE:'#C53030', OBSERVADO:'#D69E2E', EMITIDO:'#2F855A', CANCELADO:'#718096' };
  const rowBgDoc   = {
    PENDIENTE: 'background:rgba(197,48,48,.06);border-left:3px solid #C53030',
    OBSERVADO:  'background:rgba(214,158,46,.07);border-left:3px solid #D69E2E',
    EMITIDO:    'background:rgba(47,133,90,.04);border-left:3px solid #2F855A',
    CANCELADO:  'background:rgba(74,85,104,.05);border-left:3px solid #718096;opacity:.8',
  };

  tbody.innerHTML = pagina.length ? pagina.map(m => {
    const docEstado = m.estado_doc || 'PENDIENTE';
    const monto     = m.naturaleza === 'CARGO' ? -Math.abs(m.importe) : Math.abs(m.importe);
    const proveedor = m.empresas_clientes?.nombre || '';
    const rucDni    = m.empresas_clientes?.ruc_dni || '';
    const concepto  = m.conceptos?.nombre || '';
    const autorizacion = m.autorizaciones?.nombre || '';
    const proyecto  = m.proyectos?.nombre || '';
    const usuarioNombre = m.usuarios?.nombre || '';
    const fmtFecha  = iso => {
      if (!iso) return '—';
      const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };
    const rowStyle = rowBgDoc[docEstado] || '';
    return `
    <tr style="${rowStyle}" onmouseover="this.style.filter='brightness(.97)'" onmouseout="this.style.filter=''">
      <td style="${_TD}padding:6px 8px;position:sticky;left:0;background:inherit">
        <input type="checkbox" class="chk-mov" data-id="${m.id}"
          ${mov_seleccionados.has(m.id) ? 'checked' : ''}
          onchange="toggleSeleccionMov('${m.id}', this.checked)">
      </td>
      <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(m.numero_operacion || '—')}</td>
      <td style="${_TD}white-space:nowrap">${fmtFecha(m.fecha)}</td>
      <td style="${_TD}font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.descripcion||'')}">${escapar(m.descripcion || '—')}</td>
      <td style="${_TD}text-align:center;font-size:11px">${escapar(m.moneda || 'PEN')}</td>
      <td style="${_TD}text-align:right;font-weight:700;white-space:nowrap;color:${monto < 0 ? 'var(--color-critico)' : 'var(--color-exito)'}">${formatearMoneda(Math.abs(monto), m.moneda)}</td>
      <td style="${_TD}max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${escapar(proveedor)}">${escapar(proveedor || '—')}</td>
      <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(rucDni || '—')}</td>
      <td style="${_TD}font-size:11px">${escapar(m.cotizacion || '—')}</td>
      <td style="${_TD}font-size:11px">${escapar(m.oc || '—')}</td>
      <td style="${_TD}font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(proyecto)}">${escapar(proyecto || '—')}</td>
      <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(concepto || '—')}</td>
      <td style="${_TD}font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapar(empresa_activa?.nombre || '—')}</td>
      <td style="${_TD}"><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${badgeBgDoc[docEstado]||'#718096'};color:#fff;white-space:nowrap">${docEstado}</span></td>
      <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(m.numero_documento || '—')}</td>
      <td style="${_TD}text-align:center"><span style="background:var(--color-secundario);color:#fff;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:600">${escapar(m.tipo_documento_codigo || '—')}</span></td>
      <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(autorizacion || '—')}</td>
      <td style="${_TD}font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.observaciones||'')}">${escapar(m.observaciones || '—')}</td>
      <td style="${_TD}font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.detalles_servicio||'')}">${escapar(m.detalles_servicio || '—')}</td>
      <td style="${_TD}font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(m.observaciones_2||'')}">${escapar(m.observaciones_2 || '—')}</td>
      <td style="${_TD}font-size:11px;white-space:nowrap;color:var(--color-texto-suave)">${fmtFecha(m.fecha_creacion)}</td>
      <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(usuarioNombre || '—')}</td>
      <td style="${_TD}text-align:center;white-space:nowrap">
        <button class="btn-icono" onclick="abrirModalMovimiento('${m.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarMovimiento('${m.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('') :
    '<tr><td colspan="23" class="text-center text-muted" style="padding:32px">Sin movimientos</td></tr>';

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
    ['mov-autorizacion-f',mov_autorizaciones,'id',     'nombre'],
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
    document.getElementById('mov-estado-modal').value      = m.estado;
    document.getElementById('mov-estado-doc-modal').value  = m.estado_doc || 'PENDIENTE';
    document.getElementById('mov-obs').value                = m.observaciones || '';
    document.getElementById('mov-cotizacion').value         = m.cotizacion || '';
    document.getElementById('mov-oc').value                 = m.oc || '';
    document.getElementById('mov-detalles-servicio').value  = m.detalles_servicio || '';
    document.getElementById('mov-observaciones-2').value    = m.observaciones_2 || '';
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
    document.getElementById('mov-estado-modal').value      = 'PENDIENTE';
    document.getElementById('mov-estado-doc-modal').value  = 'PENDIENTE';
    document.getElementById('mov-obs').value                = '';
    document.getElementById('mov-cotizacion').value         = '';
    document.getElementById('mov-oc').value                 = '';
    document.getElementById('mov-detalles-servicio').value  = '';
    document.getElementById('mov-observaciones-2').value    = '';
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

  const _nroDocVal    = document.getElementById('mov-nro-doc')?.value.trim();
  const _estadoDocVal = document.getElementById('mov-estado-doc-modal')?.value;
  if (_nroDocVal && _estadoDocVal === 'PENDIENTE') {
    const cambiar = await confirmar(
      `Se ha ingresado el comprobante "${_nroDocVal}".\n¿Cambiar el estado FA/DOC/RH a EMITIDO automáticamente?`,
      { btnOk: 'Sí, cambiar a EMITIDO', btnColor: '#2F855A' }
    );
    if (cambiar) {
      const sel = document.getElementById('mov-estado-doc-modal');
      if (sel) sel.value = 'EMITIDO';
    }
  }

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
    estado_doc:              document.getElementById('mov-estado-doc-modal').value,
    observaciones:           document.getElementById('mov-obs').value.trim() || null,
    cotizacion:              document.getElementById('mov-cotizacion').value.trim() || null,
    oc:                      document.getElementById('mov-oc').value.trim() || null,
    detalles_servicio:       document.getElementById('mov-detalles-servicio').value.trim() || null,
    observaciones_2:         document.getElementById('mov-observaciones-2').value.trim() || null,
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
  if (!await confirmar('¿Eliminar este movimiento?', { btnOk: 'Eliminar', btnColor: '#C53030' })) return;
  await _eliminarConciliacionesDe([id]);
  const { error } = await _supabase.from('movimientos').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarMovimientos();
}

async function _eliminarConciliacionesDe(ids) {
  if (!ids.length) return { error: null };
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await _supabase
      .from('conciliaciones')
      .delete()
      .in('movimiento_id', ids.slice(i, i + CHUNK));
    if (error) return { error };
  }
  return { error: null };
}

async function _abrirModalEliminarMes() {
  const hoy    = new Date();
  const mesD   = document.getElementById('mov-desde')?.value;
  const initY  = mesD ? mesD.slice(0, 4) : String(hoy.getFullYear());
  const initM  = mesD ? mesD.slice(5, 7) : String(hoy.getMonth() + 1).padStart(2, '0');
  const cuentaId = document.getElementById('mov-cuenta')?.value || '';

  const anios = [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1];
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cerrarModalEliminarMes()">
      <div class="modal" style="max-width:520px;width:95%">
        <div class="modal-header">
          <h3>🗑️ Eliminar movimientos de un mes</h3>
          <button class="modal-cerrar" onclick="_cerrarModalEliminarMes()">✕</button>
        </div>
        <div class="modal-body">
          <div style="padding:12px 14px;background:rgba(197,48,48,.08);border-radius:8px;border-left:4px solid #C53030;margin-bottom:18px;font-size:13px">
            ⚠️ <strong>Acción irreversible.</strong> Se eliminarán todos los movimientos del mes seleccionado.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div class="campo" style="margin:0">
              <label>Mes</label>
              <select id="em-mes" onchange="_previewEliminarMes()" class="input-buscar w-full">
                ${meses.map((n, i) => {
                  const v = String(i + 1).padStart(2, '0');
                  return `<option value="${v}" ${v === initM ? 'selected' : ''}>${n}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="campo" style="margin:0">
              <label>Año</label>
              <select id="em-anio" onchange="_previewEliminarMes()" class="input-buscar w-full">
                ${anios.map(a => `<option value="${a}" ${String(a) === initY ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
          </div>
          <div id="em-preview" style="padding:12px 16px;background:var(--color-bg);border-radius:8px;border:1px solid var(--color-borde);margin-bottom:16px;font-size:13px;min-height:60px"></div>
          <div class="campo" style="margin-bottom:4px">
            <label>Escribe <strong style="color:#C53030;font-family:monospace">CONFIRMAR</strong> para habilitar el botón</label>
            <input type="text" id="em-confirm-texto" oninput="_checkTextoEliminarMes()" placeholder="Escribe CONFIRMAR aquí" class="input-buscar w-full" autocomplete="off">
          </div>
          <div id="em-alerta" class="alerta-error"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="_cerrarModalEliminarMes()">Cancelar</button>
          <button class="btn" id="btn-em-confirmar" disabled onclick="_ejecutarEliminarMes('${cuentaId}')"
            style="background:#C53030;color:#fff;border:none;border-radius:var(--radio);padding:9px 20px;cursor:pointer;font-family:var(--font);font-size:14px;font-weight:600;opacity:.45">
            🗑️ Eliminar mes
          </button>
        </div>
      </div>
    </div>`;

  _previewEliminarMes(cuentaId);
}

async function _previewEliminarMes(cuentaId) {
  const mes  = document.getElementById('em-mes')?.value;
  const anio = document.getElementById('em-anio')?.value;
  if (!mes || !anio) return;

  const prev = document.getElementById('em-preview');
  if (prev) prev.innerHTML = '<div class="cargando" style="padding:8px"><div class="spinner" style="width:20px;height:20px;border-width:2px"></div><span style="font-size:12px">Calculando…</span></div>';

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  let q = _supabase
    .from('movimientos')
    .select('id, importe, naturaleza, moneda')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha', desde)
    .lte('fecha', hasta);

  const cid = cuentaId || '';
  if (cid) q = q.eq('cuenta_bancaria_id', cid);

  const { data } = await q;
  const filas = data || [];
  const totalCargos  = filas.filter(r => r.naturaleza === 'CARGO').reduce((s, r) => s + parseFloat(r.importe), 0);
  const totalAbonos  = filas.filter(r => r.naturaleza === 'ABONO').reduce((s, r) => s + parseFloat(r.importe), 0);
  const nombreMes    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][parseInt(mes) - 1];

  if (prev) prev.innerHTML = filas.length === 0
    ? `<div style="color:var(--color-texto-suave);text-align:center;padding:8px">Sin movimientos para ${nombreMes} ${anio}</div>`
    : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="color:var(--color-texto-suave);font-size:11px">Período</span><br><strong>${nombreMes} ${anio}</strong></div>
        <div><span style="color:var(--color-texto-suave);font-size:11px">Registros</span><br><strong style="font-size:18px;color:#C53030">${filas.length}</strong></div>
        <div style="grid-column:span 2"><span style="color:var(--color-texto-suave);font-size:11px">Cargos / Abonos</span><br><strong style="color:var(--color-critico)">${formatearMoneda(totalCargos,'PEN')}</strong> / <strong style="color:var(--color-exito)">${formatearMoneda(totalAbonos,'PEN')}</strong></div>
      </div>`;
}

function _checkTextoEliminarMes() {
  const texto = document.getElementById('em-confirm-texto')?.value || '';
  const btn   = document.getElementById('btn-em-confirmar');
  if (!btn) return;
  const ok = texto.trim().toUpperCase() === 'CONFIRMAR';
  btn.disabled = !ok;
  btn.style.opacity = ok ? '1' : '.45';
  btn.style.cursor  = ok ? 'pointer' : 'not-allowed';
}

function _cerrarModalEliminarMes() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function _ejecutarEliminarMes(cuentaId) {
  const mes  = document.getElementById('em-mes')?.value;
  const anio = document.getElementById('em-anio')?.value;
  const btn  = document.getElementById('btn-em-confirmar');
  if (!mes || !anio) return;

  if (btn) { btn.disabled = true; btn.textContent = 'Eliminando…'; }

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  let q = _supabase
    .from('movimientos')
    .select('id')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  const cid = cuentaId || '';
  if (cid) q = q.eq('cuenta_bancaria_id', cid);

  const { data } = await q;
  const ids = (data || []).map(r => r.id);
  
  if (ids.length) {
    await _eliminarConciliacionesDe(ids);
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      await _supabase.from('movimientos').delete().in('id', ids.slice(i, i + CHUNK));
    }
    mostrarToast(`✅ ${ids.length} movimientos eliminados.`, 'exito');
  }

  _cerrarModalEliminarMes();
  await cargarMovimientos();
  _renderResumenMov();
}

function abrirModalEdicionMasiva() {
  const ids = [...mov_seleccionados];
  if (!ids.length) return;

  const opcionesConcepto     = mov_conceptos.map(c => `<option value="${c.id}">${escapar(c.nombre)}</option>`).join('');
  const opcionesCliente      = mov_clientes.map(c => `<option value="${c.id}">${escapar(c.nombre)}</option>`).join('');
  const opcionesTipoDoc      = mov_tipos_doc.map(t => `<option value="${t.codigo}">${escapar(t.codigo)} — ${escapar(t.nombre)}</option>`).join('');

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cerrarEdicionMasiva()">
      <div class="modal" style="max-width:620px;width:95%">
        <div class="modal-header">
          <h3>✏️ Editar ${ids.length} movimiento(s)</h3>
          <button class="modal-cerrar" onclick="_cerrarEdicionMasiva()">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="campo">
              <label>Concepto</label>
              <select id="em-concepto"><option value="">— Sin cambio —</option>${opcionesConcepto}</select>
            </div>
            <div class="campo">
              <label>Empresa / Proveedor</label>
              <select id="em-cliente"><option value="">— Sin cambio —</option>${opcionesCliente}</select>
            </div>
            <div class="campo">
              <label>Tipo de documento</label>
              <select id="em-tipo-doc"><option value="">— Sin cambio —</option>${opcionesTipoDoc}</select>
            </div>
            <div class="campo">
              <label>Estado FA/DOC/RH</label>
              <select id="em-estado-doc">
                <option value="">— Sin cambio —</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EMITIDO">Emitido</option>
                <option value="OBSERVADO">Obsersado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="_cerrarEdicionMasiva()">Cancelar</button>
          <button class="btn btn-primario" onclick="_aplicarEdicionMasiva()">✅ Aplicar</button>
        </div>
      </div>
    </div>`;
}

function _cerrarEdicionMasiva() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function _aplicarEdicionMasiva() {
  const ids = [...mov_seleccionados];
  const patch = {};
  
  const concepto = document.getElementById('em-concepto')?.value;
  const cliente  = document.getElementById('em-cliente')?.value;
  const tipoDoc  = document.getElementById('em-tipo-doc')?.value;
  const estadoDoc = document.getElementById('em-estado-doc')?.value;

  if (concepto) patch.concepto_id = concepto;
  if (cliente)  patch.empresa_cliente_id = cliente;
  if (tipoDoc)  patch.tipo_documento_codigo = tipoDoc;
  if (estadoDoc) patch.estado_doc = estadoDoc;

  if (Object.keys(patch).length) {
    await _supabase.from('movimientos').update(patch).in('id', ids);
    mostrarToast(`✓ ${ids.length} movimientos actualizados.`, 'exito');
  }

  _cerrarEdicionMasiva();
  mov_seleccionados.clear();
  await cargarMovimientos();
}

function exportarMovimientosExcel() {
  if (!movimientos_filtrada.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const rows = movimientos_filtrada.map(m => ({
    Fecha:                 m.fecha,
    Cuenta:                m.cuentas_bancarias?.nombre_alias || '',
    Naturaleza:            m.naturaleza,
    Importe:               m.importe,
    Moneda:                m.moneda,
    Descripción:           m.descripcion || '',
    'Nro Operación':       m.numero_operacion || '',
    'Empresa / Proveedor': m.empresas_clientes?.nombre || '',
    'FA/DOC/RH':           m.estado_doc || 'PENDIENTE',
    'Estado Movimiento':   m.estado,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, `movimientos_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
