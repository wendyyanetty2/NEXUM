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
            <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--color-borde);white-space:nowrap;min-width:60px">Mon..</th>
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

    <!-- El resto del HTML de los modales se mantiene igual... -->
    `;

  await Promise.all([
    cargarMovimientos(),
    cargarCuentasParaMov(),
    cargarCatalogosParaMov(),
  ]);
  _renderResumenMov();
}

/**
 * CARGAR MOVIMIENTOS:
 * Modificada para consultar la TABLA FÍSICA y no la vista, 
 * asegurando la migración real de datos.
 */
async function cargarMovimientos() {
  const desde = document.getElementById('mov-desde')?.value;
  const hasta = document.getElementById('mov-hasta')?.value;
  const cuentaId = document.getElementById('mov-cuenta')?.value;

  // Consultamos directamente la TABLA FÍSICA donde el Trigger inserta los datos
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
    .eq('empresa_operadora_id', empresa_activa.id); // Filtro obligatorio de empresa

  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  
  if (cuentaId) {
    q = q.eq('cuenta_bancaria_id', cuentaId);
  }

  const { data, error } = await q.order('fecha', { ascending: false }).limit(1000);

  if (error) {
    console.error('Error al cargar datos migrados:', error.message);
    return;
  }

  movimientos_lista = data || [];
  filtrarMovimientos();
}

// Las funciones de filtrado, limpieza y auxiliares se mantienen...

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
    const matchC   = !cuenta    || m.cuenta_bancaria_id === cuenta;
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

async function guardarMovimiento() {
  // ... lógica de guardado que ya tienes ...
  // Asegúrate de que al final llame a cargarMovimientos() para refrescar
  await cargarMovimientos();
  _renderResumenMov();
}

// El resto de funciones (eliminar, exportar, modales masivos) siguen igual...
