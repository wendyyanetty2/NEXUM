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
            <button class="btn btn-secundario btn-sm" onclick="cargarMovimientos()">🔄 Actualizar</button>
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
  `;

  await Promise.all([
    verificarYMigrarMBD(), 
    cargarCuentasParaMov(),
    cargarCatalogosParaMov(),
  ]);
  
  await cargarMovimientos();
  _renderResumenMov();
}

async function verificarYMigrarMBD() {
    console.log("Sincronizando con tabla de importación MBD...");
    
    const { data: cuenta } = await _supabase
        .from('cuentas_bancarias')
        .select('id')
        .eq('empresa_operadora_id', empresa_activa.id)
        .limit(1)
        .single();

    if (!cuenta) return;

    const { data: mbdData } = await _supabase
        .from('tesoreria_mbd')
        .select('*')
        .eq('empresa_id', empresa_activa.id);

    if (!mbdData || mbdData.length === 0) return;

    const registrosParaMov = mbdData.map(reg => ({
        numero_operacion: reg.nro_operacion_bancaria,
        fecha: reg.fecha_deposito,
        descripcion: reg.descripcion,
        moneda: reg.moneda,
        importe: reg.monto,
        ruc_dni: reg.ruc_dni,
        estado_doc: reg.entrega_doc || 'PENDIENTE',
        empresa_operadora_id: empresa_activa.id,
        cuenta_bancaria_id: cuenta.id,
        estado: 'PENDIENTE',
        cotizacion: reg.cotizacion,
        oc: reg.oc,
        detalles_servicio: reg.detalles_servicio,
        observaciones: reg.observaciones
    }));

    const { error } = await _supabase.from('movimientos')
        .upsert(registrosParaMov, { onConflict: 'numero_operacion, fecha, importe' });
    
    if (error) console.error("Error en migración:", error.message);
    else console.log("Migración MBD -> Movimientos exitosa.");
}

async function cargarMovimientos() {
  const desde = document.getElementById('mov-desde')?.value;
  const hasta = document.getElementById('mov-hasta')?.value;
  const cuentaId = document.getElementById('mov-cuenta')?.value;

  let q = _supabase
    .from('movimientos')
    .select(`*,
      cuentas_bancarias(nombre_alias),
      empresas_clientes:empresa_cliente_id(nombre, ruc_dni),
      conceptos:concepto_id(nombre),
      usuarios:usuario_id(nombre)
    `)
    .eq('empresa_operadora_id', empresa_activa.id);

  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  if (cuentaId) q = q.eq('cuenta_bancaria_id', cuentaId);

  const { data, error } = await q.order('fecha', { ascending: false });

  if (error) {
    console.error('Error al cargar movimientos:', error);
    return;
  }

  // Si después de la migración sigue vacío, intentamos forzar visualización
  movimientos_lista = data || [];
  
  const ctr = document.getElementById('mov-contador');
  if (ctr) ctr.textContent = `${movimientos_lista.length} registros cargados`;
  
  filtrarMovimientos();
}

// Las funciones filtrarMovimientos, cargarCuentasParaMov, etc., se mantienen igual que en tu versión original.
